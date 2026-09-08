import {CARD_W,CARD_H,connectorRoute,edgeEndpoints} from './layout.mjs';
import {roots} from './data.mjs';
import {NODE_KINDS,revealPath} from './model.mjs';
import {QUESTION_STATUSES,ANSWER_STATUSES} from './workspace.mjs';
import {comparisonNodeKey,layoutComparison,visibleComparisonEndpoint,comparisonRecordEnds} from './comparison-layout.mjs';

export class ComparisonCanvas{
  constructor(host,onSelect,onRecord,options={}){
    this.options=options;
    this.onSelect=onSelect;this.onRecord=onRecord;this.states={a:{map:null,expanded:new Set(),selected:null,frame:'all'},b:{map:null,expanded:new Set(),selected:null,frame:'all'}};
    this.camera={x:0,y:0,z:1};this.positions=new Map();this.records=[];this.colors=['#008575','#3263cc','#8250bd'];this.animation=null;
    this.surface=document.createElement('div');this.surface.className='comparison-canvas';this.surface.tabIndex=0;this.surface.setAttribute('role','region');this.surface.setAttribute('aria-label','Both worldview maps on one canvas. Select a node in each map. Drag empty space to pan; scroll to zoom; use F to fit both maps.');
    this.world=document.createElement('div');this.world.className='comparison-world';this.surface.append(this.world);
    this.hint=document.createElement('div');this.hint.className='comparison-canvas-hint';this.hint.textContent='Choose a node in A, then one in B.';this.surface.append(this.hint);
    this.linkStatus=document.createElement('div');this.linkStatus.className='comparison-link-status';this.linkStatus.setAttribute('role','status');this.surface.append(this.linkStatus);
    const controls=document.createElement('div');controls.className='comparison-map-controls';
    for(const [label,aria,action]of [['−','Zoom out',()=>this.zoom(1/1.2)],['＋','Zoom in',()=>this.zoom(1.2)],['Fit both','Fit both maps',()=>this.fit()],['Focus pair','Focus selected nodes',()=>this.fitSelection()]]){
      const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-label',aria);button.onclick=action;controls.append(button);if(label==='Focus pair')this.focusButton=button;
    }
    this.zoomLabel=document.createElement('span');this.zoomLabel.className='comparison-zoom';controls.prepend(this.zoomLabel);this.surface.append(controls);host.append(this.surface);
    if(options.single){this.surface.classList.add('single-map-canvas');this.surface.setAttribute('aria-label','Radial map. Select a node for its wording and co-signs. Drag to pan and scroll to zoom.');controls.children[3].textContent='Fit map';controls.children[3].setAttribute('aria-label','Fit map');this.focusButton.textContent='Focus node';this.focusButton.setAttribute('aria-label','Focus selected node');}
    const pointers=new Map();let drag=null,pinch=null;
    this.surface.addEventListener('wheel',e=>{if(e.target.closest('button'))return;e.preventDefault();const r=this.surface.getBoundingClientRect();this.zoom(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
    this.surface.addEventListener('pointerdown',e=>{
      if(e.button>0||e.target.closest('button,.node,.comparison-link-hit'))return;this.stopAnimation();this.surface.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});this.surface.classList.add('panning');
      if(pointers.size===1)drag={x:e.clientX,y:e.clientY,cx:this.camera.x,cy:this.camera.y};
      if(pointers.size===2){const [a,b]=[...pointers.values()],r=this.surface.getBoundingClientRect(),x=(a.x+b.x)/2-r.left,y=(a.y+b.y)/2-r.top;pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),z:this.camera.z,wx:(x-this.camera.x)/this.camera.z,wy:(y-this.camera.y)/this.camera.z};drag=null;}
    });
    this.surface.addEventListener('pointermove',e=>{
      if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pinch&&pointers.size===2){const [a,b]=[...pointers.values()],r=this.surface.getBoundingClientRect(),z=Math.max(.02,Math.min(2,pinch.z*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance)));this.camera={z,x:(a.x+b.x)/2-r.left-pinch.wx*z,y:(a.y+b.y)/2-r.top-pinch.wy*z};}
      else if(drag){this.camera.x=drag.cx+e.clientX-drag.x;this.camera.y=drag.cy+e.clientY-drag.y;}this.drawCamera();
    });
    const end=e=>{pointers.delete(e.pointerId);pinch=null;drag=null;if(pointers.size===1){const p=[...pointers.values()][0];drag={x:p.x,y:p.y,cx:this.camera.x,cy:this.camera.y};}if(!pointers.size)this.surface.classList.remove('panning');};
    for(const event of ['pointerup','pointercancel','lostpointercapture'])this.surface.addEventListener(event,end);
    this.surface.addEventListener('keydown',e=>{if(e.target!==this.surface)return;const delta={ArrowLeft:[60,0],ArrowRight:[-60,0],ArrowUp:[0,60],ArrowDown:[0,-60]}[e.key];if(delta){e.preventDefault();this.stopAnimation();this.camera.x+=delta[0];this.camera.y+=delta[1];this.drawCamera();}else if(e.key==='+'||e.key==='='){e.preventDefault();this.zoom(1.2);}else if(e.key==='-'){e.preventDefault();this.zoom(1/1.2);}else if(e.key.toLowerCase()==='f'){e.preventDefault();this.fit();}});
    let width=0,height=0;
    new ResizeObserver(()=>{const w=this.surface.clientWidth,h=this.surface.clientHeight;if(!w||!h)return;if(this.layout){if(!width)this.fit();else{this.stopAnimation();this.camera.x+=(w-width)/2;this.camera.y+=(h-height)/2;this.drawCamera();}}width=w;height=h;}).observe(this.surface);
  }
  setMaps(sides,records=[],activeRecord=null,{fit=false}={}){
    let changed=false;
    for(const side of ['a','b']){
      const next=sides[side],state=this.states[side];if(next.map?.id!==state.map?.id){state.expanded=new Set();changed=true;}
      state.map=next.map;state.selected=next.nodeId;state.frame=next.frame||'all';
      if(state.map&&state.selected)state.expanded=revealPath(state.map.nodes,state.selected,state.expanded);
    }
    this.records=records;this.activeRecord=activeRecord;this.reflow({fit:fit||changed||!this.layout,animate:false});
  }
  setFrame(side,frame){this.states[side].frame=frame;this.reflow({fit:true});}
  expand(side,all=false){const state=this.states[side];if(!state.map)return;for(const id of all?state.map.nodes.map(n=>n.id):this.layout.maps[side].positions.keys())state.expanded.add(id);this.reflow({fit:true});}
  collapse(side){this.states[side].expanded.clear();this.reflow({fit:true});}
  pick(side,id,focus=false){
    const state=this.states[side];state.selected=id;
    if(id&&state.map){state.expanded=revealPath(state.map.nodes,id,state.expanded);let node=state.map.nodes.find(n=>n.id===id);while(node?.parent)node=state.map.nodes.find(n=>n.id===node.parent);if(state.frame!=='all'&&node?.id!==state.frame)state.frame='all';}
    this.reflow({animate:false});if(focus)this.fitSelection();
  }
  reflow({fit=false,animate=true,anchor=null}={}){
    this.stopAnimation();const previous=this.positions,fromCamera={...this.camera},oldLanes=this.layout?.lanes||[];
    const focused=[...(this.cards||[])].find(([,card])=>card.contains(document.activeElement)),focusToggle=document.activeElement?.classList.contains('toggle');
    this.layout=layoutComparison(this.states,roots);let toCamera=fit?this.fitCamera():{...this.camera};
    if(anchor&&previous.has(anchor)&&this.layout.positions.has(anchor)){const a=previous.get(anchor),b=this.layout.positions.get(anchor);toCamera.x+=(a.x-b.x)*toCamera.z;toCamera.y+=(a.y-b.y)*toCamera.z;}
    this.buildWorld();const next=this.layout.positions;
    if(focused){const card=this.cards.get(focused[0]);card?.querySelector(focusToggle?'.toggle':'.node-main')?.focus({preventScroll:true});}
    if(!animate||!previous.size||matchMedia('(prefers-reduced-motion: reduce)').matches){this.positions=new Map(next);this.camera=toCamera;this.drawGeometry();this.drawCamera();return;}
    const starts=new Map();
    for(const [key,p]of next){let start=previous.get(key);if(!start){const state=this.states[p.side];let node=state.map.nodes.find(n=>comparisonNodeKey(p.side,n.id)===key);while(!start&&node?.parent){start=previous.get(comparisonNodeKey(p.side,node.parent));node=state.map.nodes.find(n=>n.id===node.parent);}}starts.set(key,start||p);}
    this.finishAnimation=()=>{this.positions=new Map(next);this.camera=toCamera;this.drawGeometry();this.drawCamera();};
    const begin=performance.now(),mix=(a,b,t)=>a+(b-a)*t;
    const tick=now=>{const t=Math.min(1,(now-begin)/300),eased=1-Math.pow(1-t,3);this.positions=new Map([...next].map(([key,p])=>[key,{...p,x:mix(starts.get(key).x,p.x,eased),y:mix(starts.get(key).y,p.y,eased)}]));this.camera={x:mix(fromCamera.x,toCamera.x,eased),y:mix(fromCamera.y,toCamera.y,eased),z:mix(fromCamera.z,toCamera.z,eased)};
      const lanes=this.layout.lanes.map(lane=>{const old=oldLanes.find(l=>l.side===lane.side)||lane;return {...lane,y:mix(old.y,lane.y,eased),width:mix(old.width,lane.width,eased),height:mix(old.height,lane.height,eased)};});
      this.drawGeometry(lanes);this.drawCamera();if(t<1)this.animation=requestAnimationFrame(tick);else{this.animation=null;this.finishAnimation=null;}};tick(begin);
  }
  stopAnimation(){if(this.animation!==null){cancelAnimationFrame(this.animation);this.animation=null;this.finishAnimation?.();this.finishAnimation=null;}}
  svgElement(tag,attributes={}){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attributes))el.setAttribute(key,value);return el;}
  buildWorld(){
    this.world.replaceChildren();this.cards=new Map();this.laneElements=new Map();this.branches=[];this.links=[];
    for(const lane of this.layout.lanes){const el=document.createElement('div');el.className='comparison-map-lane';const label=document.createElement('div');label.className='comparison-map-label';const badge=document.createElement('span');badge.className='map-letter';badge.textContent=lane.side.toUpperCase();const title=document.createElement('strong');title.textContent=this.states[lane.side].map.name;label.append(badge,title);el.append(label);this.world.append(el);this.laneElements.set(lane.side,el);}
    const svg=this.svgElement('svg',{'aria-label':'Map connections'});svg.classList.add('comparison-lines');this.world.append(svg);
    for(const side of ['a','b']){
      const view=this.layout.maps[side],state=this.states[side];if(!view)continue;
      for(const edge of view.layout.edges){if(!view.positions.has(edge.from)||!view.positions.has(edge.to))continue;const path=this.svgElement('path',{stroke:edge.frame<0?'#899bb0':this.colors[edge.frame],fill:'none','stroke-width':2,'aria-hidden':'true'});if(edge.kind==='spine')path.setAttribute('stroke-dasharray','6 5');path.classList.add('comparison-tree-edge');svg.append(path);this.branches.push({path,edge,side});}
      const byId=new Map(state.map.nodes.map(n=>[n.id,n]));
      for(const [id,p]of view.positions){
        const node=byId.get(id),kids=view.layout.children.get(id),card=document.createElement('article');card.className=`node${node.parent===null?' root':''}${state.selected===id?' selected':''}`;card.dataset.frame=p.frame;card.dataset.side=side;
        const main=document.createElement('button');main.type='button';main.className='node-main';main.setAttribute('aria-label',`Select ${node.title} in map ${side.toUpperCase()}`);main.setAttribute('aria-pressed',String(state.selected===id));
        const title=document.createElement('div');title.className='node-title';title.textContent=node.title;const summary=document.createElement('div');summary.className='node-summary';summary.textContent=node.summary;main.append(title,summary);main.onclick=()=>this.onSelect(side,id);
        const bottom=document.createElement('div');bottom.className='node-bottom';const meta=document.createElement('span');meta.className='node-meta';meta.textContent=`${side.toUpperCase()} · ${node.parent===null?'Frame':NODE_KINDS[node.kind].label}`;bottom.append(meta);
        if(kids.length){const toggle=document.createElement('button');toggle.className='toggle';toggle.type='button';toggle.textContent=`${state.expanded.has(id)?'−':'＋'} ${kids.length}`;toggle.setAttribute('aria-label',`${state.expanded.has(id)?'Collapse':'Expand'} ${node.title} in map ${side.toUpperCase()}`);toggle.setAttribute('aria-expanded',String(state.expanded.has(id)));toggle.onclick=()=>{state.expanded.has(id)?state.expanded.delete(id):state.expanded.add(id);this.reflow({anchor:comparisonNodeKey(side,id)});};bottom.append(toggle);}
        if(this.options.single){meta.textContent=this.options.nodeMeta?.(node)||(node.parent===null?'Frame':NODE_KINDS[node.kind].label);card.classList.toggle('pod-context',!!node.podContext);main.setAttribute('aria-label',`Select ${node.title}`);}
        card.append(main,bottom);this.world.append(card);this.cards.set(comparisonNodeKey(side,id),card);
      }
    }
    let relevant=0,drawn=0,proxied=0;
    for(const record of this.records){const ends=comparisonRecordEnds(record,this.states);if(!ends)continue;relevant++;const a=visibleComparisonEndpoint(this.layout,'a',ends.a),b=visibleComparisonEndpoint(this.layout,'b',ends.b);if(!a||!b)continue;
      const status=record.needsReview?'Needs review':record.answerStatus?ANSWER_STATUSES[record.answerStatus]:QUESTION_STATUSES[record.questionStatus];
      this.addLink(svg,a,b,{id:record.id,label:status,question:record.question,status:record.needsReview?'review':record.answerStatus||record.questionStatus,active:record.id===this.activeRecord});drawn++;if(a.proxy||b.proxy)proxied++;
    }
    const a=visibleComparisonEndpoint(this.layout,'a',this.states.a.selected),b=visibleComparisonEndpoint(this.layout,'b',this.states.b.selected);
    const active=this.records.find(r=>r.id===this.activeRecord),activeEnds=active&&comparisonRecordEnds(active,this.states);
    const same=activeEnds&&activeEnds.a===this.states.a.selected&&activeEnds.b===this.states.b.selected;
    if(a&&b&&!same)this.addLink(svg,a,b,{label:'Selected pair · not recorded',status:'draft',active:true});
    this.hint.textContent=a&&b?'Selected pair connected. Review the question in the panel.':a||b?`Choose a node in map ${a?'B':'A'} to connect the pair.`:'Choose a node in A, then one in B.';
    this.linkStatus.textContent=relevant?`${drawn} of ${relevant} recorded links shown${proxied?' · Dashed ends include collapsed nodes':''}`:'Recorded comparisons will connect these maps.';
    this.focusButton.disabled=!a&&!b;
    if(this.options.single){this.hint.textContent=this.options.hint||'Choose a node to read, co-sign, or copy it.';this.linkStatus.hidden=true;}
  }
  addLink(svg,a,b,item){
    const proxy=a.proxy||b.proxy,path=this.svgElement('path',{fill:'none',class:`comparison-link ${item.status}${item.active?' active':''}${proxy?' proxy':''}`});svg.append(path);
    const suffix=proxy?' · Via collapsed branch':'',title=this.svgElement('title');title.textContent=(item.question?item.question+' — ':'')+item.label+suffix;path.append(title);
    let badge=null;
    if(item.id){const hit=this.svgElement('path',{fill:'none',class:'comparison-link-hit','aria-hidden':'true'});hit.onclick=()=>this.onRecord(item.id);svg.append(hit);item.hit=hit;}
    if(item.active){badge=document.createElement('button');badge.type='button';badge.className=`comparison-link-label ${item.status}`;badge.textContent=item.label+suffix;badge.title=item.question||'Choose a question relationship, then record this comparison.';badge.onclick=()=>item.id?this.onRecord(item.id):document.getElementById('question-status').focus();this.world.append(badge);}
    if(proxy)for(const end of [a,b])if(end.proxy)this.cards.get(end.key)?.classList.add('has-hidden-comparison');
    this.links.push({a,b,path,badge,...item});
  }
  drawGeometry(lanes=this.layout.lanes){
    for(const [key,card]of this.cards){const p=this.positions.get(key);card.style.transform=`translate(${p.x}px,${p.y}px)`;}
    for(const lane of lanes){const el=this.laneElements.get(lane.side);el.style.transform=`translate(${lane.x}px,${lane.y}px)`;el.style.width=lane.width+'px';el.style.height=lane.height+'px';}
    for(const {path,edge,side}of this.branches){const a=this.positions.get(comparisonNodeKey(side,edge.from)),b=this.positions.get(comparisonNodeKey(side,edge.to)),root=this.positions.get(comparisonNodeKey(side,roots[edge.frame]));path.setAttribute('d',connectorRoute(a,b,edge.kind==='spine'?null:root).d);}
    for(const link of this.links){const a=this.positions.get(link.a.key),b=this.positions.get(link.b.key);if(!a||!b)continue;const {x1,y1,x2,y2}=edgeEndpoints(a,b),middle=(y1+y2)/2,d=`M ${x1} ${y1} C ${x1} ${middle} ${x2} ${middle} ${x2} ${y2}`;link.path.setAttribute('d',d);link.hit?.setAttribute('d',d);if(link.badge)link.badge.style.transform=`translate(${(x1+x2)/2}px,${middle}px) translate(-50%,-50%)`;}
  }
  fitCamera(points=null){
    const w=this.surface.clientWidth,h=this.surface.clientHeight;if(!w||!h)return this.camera;
    let bounds=this.layout.bounds;
    if(points?.length){const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));bounds={x,y,width:Math.max(...points.map(p=>p.x+CARD_W))-x,height:Math.max(...points.map(p=>p.y+CARD_H))-y};}
    if(!bounds.height)return this.camera;const z=Math.max(.02,Math.min(1,(w-64)/bounds.width,(h-116)/bounds.height));return {z,x:(w-bounds.width*z)/2-bounds.x*z,y:52+(h-116-bounds.height*z)/2-bounds.y*z};
  }
  fit(){if(!this.layout)return;this.stopAnimation();this.positions=new Map(this.layout.positions);this.camera=this.fitCamera();this.drawGeometry();this.drawCamera();}
  fitSelection(){const points=['a','b'].map(side=>visibleComparisonEndpoint(this.layout,side,this.states[side].selected)).filter(Boolean).map(end=>this.layout.positions.get(end.key));if(!points.length)return;this.stopAnimation();this.positions=new Map(this.layout.positions);this.camera=this.fitCamera(points);this.drawGeometry();this.drawCamera();}
  zoom(factor,x=this.surface.clientWidth/2,y=this.surface.clientHeight/2){this.stopAnimation();const z=Math.min(2,Math.max(.02,this.camera.z*factor)),ratio=z/this.camera.z;this.camera={z,x:x-(x-this.camera.x)*ratio,y:y-(y-this.camera.y)*ratio};this.drawCamera();}
  drawCamera(){this.world.style.transform=`translate(${this.camera.x}px,${this.camera.y}px) scale(${this.camera.z})`;this.zoomLabel.textContent=Math.round(this.camera.z*100)+'%';}
}
