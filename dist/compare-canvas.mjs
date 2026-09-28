import {CARD_W,CARD_H} from './layout.mjs';
import {createConnectionRouter,createSourceConnectionRouter,labelSourceRoute} from './comparison-routing.mjs';
import {roots} from './data.mjs';
import {FRAME_COLORS,installFramePalette} from './frame-palette.mjs';
import {NODE_KINDS,revealPath,graphEdges} from './model.mjs';
import {confidenceBadge} from './confidence-ui.mjs';
import {SourceConnectionsUI,createSourceConnectionHighlights} from './source-connections-ui.mjs';
import {groupSourceConnections,visibleNodePairKey,actualNodePairKey} from './conversation-tree.mjs';
import {QUESTION_STATUSES,ANSWER_STATUSES} from './workspace.mjs';
import {comparisonNodeKey,layoutComparison,visibleComparisonEndpoint,comparisonRecordEnds,comparisonDisplayRects} from './comparison-layout.mjs';

export class ComparisonCanvas{
  constructor(host,onSelect,onRecord,options={}){
    installFramePalette();
    this.options=options;
    this.onSelect=onSelect;this.onRecord=onRecord;this.states={a:{map:null,expanded:new Set(),selected:null,frame:'all'},b:{map:null,expanded:new Set(),selected:null,frame:'all'}};
    this.camera={x:0,y:0,z:1};this.positions=new Map();this.records=[];this.colors=FRAME_COLORS;this.animation=null;this.routeConnection=createConnectionRouter();this.routeSources=createSourceConnectionRouter({preferStraight:!options.single});this.sourceHighlights=createSourceConnectionHighlights();this.sourceRoutes=new Map();
    this.surface=document.createElement('div');this.surface.className='comparison-canvas';this.surface.tabIndex=0;this.surface.setAttribute('role','region');this.surface.setAttribute('aria-label','Both worldview maps on one canvas. Select a node in each map. Drag empty space to pan; scroll to zoom; use F to fit both maps.');
    this.world=document.createElement('div');this.world.className='comparison-world';this.surface.append(this.world);
    this.hint=document.createElement('div');this.hint.className='comparison-canvas-hint';this.hint.textContent='Choose a node in A, then one in B.';this.surface.append(this.hint);
    this.linkStatus=document.createElement('div');this.linkStatus.className='comparison-link-status';this.linkStatus.setAttribute('role','status');this.surface.append(this.linkStatus);
    const controls=document.createElement('div');controls.className='comparison-map-controls';
    for(const [label,aria,action]of [['−','Zoom out',()=>this.zoom(1/1.2)],['＋','Zoom in',()=>this.zoom(1.2)],['Fit both','Fit both maps',()=>this.fit()],['Focus pair','Focus selected nodes',()=>this.fitSelection()]]){
      const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-label',aria);button.onclick=action;controls.append(button);if(label==='Focus pair')this.focusButton=button;
    }
    this.zoomLabel=document.createElement('span');this.zoomLabel.className='comparison-zoom';controls.prepend(this.zoomLabel);this.surface.append(controls);host.append(this.surface);
    if(!options.single){
      this.layerControls=document.createElement('div');this.layerControls.className='comparison-layer-controls';this.layerControls.setAttribute('role','group');this.layerControls.setAttribute('aria-label','Emphasize a map');
      this.layerButtons=new Map();for(const [value,label]of [['both','Both maps'],['a','First map'],['b','Second map']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.layer=value;button.setAttribute('aria-pressed',String(value==='both'));button.onclick=()=>{this.surface.dataset.layer=value;for(const b of this.layerControls.children)b.setAttribute('aria-pressed',String(b===button));};this.layerControls.append(button);this.layerButtons.set(value,button);}
      host.before(this.layerControls);
    }
    if(options.single){this.surface.classList.add('single-map-canvas');this.surface.setAttribute('aria-label','Radial map. Select a node for its wording and co-signs. Drag to pan and scroll to zoom.');controls.children[3].textContent='Fit map';controls.children[3].setAttribute('aria-label','Fit map');this.focusButton.textContent='Focus node';this.focusButton.setAttribute('aria-label','Focus selected node');}
    if(options.single)this.sourceConnections=new SourceConnectionsUI(this);
    const pointers=new Map();let drag=null,pinch=null;
    this.surface.addEventListener('wheel',e=>{if(e.target.closest('button'))return;e.preventDefault();const r=this.surface.getBoundingClientRect();this.zoom(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
    this.surface.addEventListener('pointerdown',e=>{
      if(e.button>0||e.target.closest('button,.node,.counterpart-placeholder,.comparison-link-hit,.discussion-edge-hit'))return;this.stopAnimation();this.surface.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});this.surface.classList.add('panning');
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
    if(this.layerButtons)for(const side of ['a','b']){const map=this.states[side].map,button=this.layerButtons.get(side),owner=this.ownerName(map);button.textContent=map?owner:side==='a'?'First map':'Second map';button.setAttribute('aria-label',map?`Highlight ${map.name} by ${owner}`:`Highlight ${button.textContent.toLowerCase()}`);}
    this.records=records;this.activeRecord=activeRecord;this.reflow({fit:fit||changed||!this.layout,animate:false});
  }
  ownerName(map){return map?(this.options.ownerName?.(map)||map.person||'Participant'):'Participant';}
  identity(side){const id=this.states[side].map?.id,ordered=[...new Set(['a','b'].map(key=>this.states[key].map?.id).filter(Boolean))].sort();return ordered.indexOf(id)===1?'two':'one';}
  frameAnchor(side){
    const state=this.states[side];if(!state.map)return null;let node=state.map.nodes.find(n=>n.id===state.selected);const byId=new Map(state.map.nodes.map(n=>[n.id,n]));while(node?.parent)node=byId.get(node.parent);
    const id=[node?.id,...roots].find(id=>id&&this.positions.has(comparisonNodeKey(side,id)));return id?comparisonNodeKey(side,id):null;
  }
  setFrame(side,frame){
    this.stopAnimation();
    const state=this.states[side],key=this.frameAnchor(side),point=key&&this.positions.get(key),anchor=point?{key,x:this.camera.x+(point.x+CARD_W/2)*this.camera.z,y:this.camera.y+(point.y+CARD_H/2)*this.camera.z,z:this.camera.z}:null;
    state.frame=frame;if(this.options.single){this.reflow({fit:true});return;}this.reflow({animate:false,anchor:key});
    // Switching between disjoint frame filters replaces the visible anchor;
    // keep its screen location and the user's chosen scale instead of fitting.
    if(anchor&&!this.positions.has(key)){anchor.key=this.frameAnchor(side);this.restoreAnchor(anchor);}
  }
  expand(side,all=false){const state=this.states[side];if(!state.map)return;const anchor=this.frameAnchor(side);for(const id of all?state.map.nodes.map(n=>n.id):this.layout.maps[side].positions.keys())state.expanded.add(id);this.reflow(this.options.single?{fit:true}:{anchor});}
  collapse(side){const anchor=this.frameAnchor(side);this.states[side].expanded.clear();this.reflow(this.options.single?{fit:true}:{anchor});}
  pick(side,id,focus=false){
    const state=this.states[side];state.selected=id;
    if(id&&state.map){state.expanded=revealPath(state.map.nodes,id,state.expanded);let node=state.map.nodes.find(n=>n.id===id);while(node?.parent)node=state.map.nodes.find(n=>n.id===node.parent);if(state.frame!=='all'&&node?.id!==state.frame)state.frame='all';}
    this.reflow({animate:false});
    // Ordinary selection preserves the camera. Explicit reveal/focus actions
    // still bring hidden or searched-for sources into view.
    if(focus)this.fitSelection();
  }
  reflow({fit=false,animate=true,anchor=null}={}){
    this.stopAnimation();const previous=this.positions,fromCamera={...this.camera},oldLanes=this.layout?.lanes||[];
    const focused=[...(this.cards||[])].find(([,card])=>card.contains(document.activeElement)),focusToggle=document.activeElement?.classList.contains('toggle');
    this.layout=layoutComparison(this.states,roots,this.options.counterparts?.()||{});let toCamera=fit?this.fitCamera():{...this.camera};
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
    this.sourceHighlights.reset();this.world.replaceChildren();this.cards=new Map();this.laneElements=new Map();this.branches=[];this.links=[];this.sourcePairs=new Map();this.sourceRoutedPositions=null;
    for(const lane of this.layout.lanes){const el=document.createElement('div');el.className='comparison-map-lane';const label=document.createElement('div');label.className='comparison-map-label';for(const side of this.layout.overlay?['a','b']:[lane.side]){const badge=document.createElement('span');badge.className='map-letter';badge.textContent=side.toUpperCase();badge.dataset.identity=this.identity(side);const title=document.createElement('strong');title.textContent=`${this.states[side].map.name} · ${this.ownerName(this.states[side].map)}`;label.append(badge,title);}el.append(label);this.world.append(el);this.laneElements.set(lane.side,el);}
    const svg=this.svgElement('svg',{'aria-label':'Map connections'});svg.classList.add('comparison-lines');this.world.append(svg);
    for(const side of ['a','b']){
      const view=this.layout.maps[side],state=this.states[side];if(!view)continue;
      for(const grouped of groupSourceConnections(graphEdges(state.map.nodes,state.map.relations))){
        const edges=[...grouped].sort((a,b)=>Number(a.structural)-Number(b.structural)||a.id.localeCompare(b.id)),edge=edges[0];if(!view.positions.has(edge.from)||!view.positions.has(edge.to))continue;
        const fromKey=comparisonNodeKey(side,edge.from),toKey=comparisonNodeKey(side,edge.to),key=visibleNodePairKey(fromKey,toKey),routeKey=actualNodePairKey({mapId:state.map.id,nodeId:edge.from},{mapId:state.map.id,nodeId:edge.to});this.sourcePairs.set(key,{key,routeKey,fromKey,toKey,side,edge,edges});
      }
      for(const edge of view.layout.edges){if(edge.kind==='spine'&&!this.options.single||!view.positions.has(edge.from)||!view.positions.has(edge.to))continue;const path=this.svgElement('path',{stroke:'#8396a1',fill:'none','stroke-width':1.6,'aria-hidden':'true','data-side':side,'data-identity':this.identity(side)});path.classList.add('comparison-tree-edge');if(edge.kind!=='spine')path.classList.add('source-connection-path');svg.append(path);this.branches.push({path,edge,side,key:visibleNodePairKey(comparisonNodeKey(side,edge.from),comparisonNodeKey(side,edge.to))});}
      const byId=new Map(state.map.nodes.map(n=>[n.id,n]));
      for(const [id,p]of view.positions){
        const node=byId.get(id),kids=view.layout.children.get(id),owner=this.ownerName(state.map),card=document.createElement('article');card.className=`node${node.parent===null?' root':''}${state.selected===id?' selected':''}`;card.dataset.frame=p.frame;card.dataset.side=side;card.dataset.nodeId=id;card.dataset.identity=this.identity(side);
        const main=document.createElement('button');main.type='button';main.className='node-main';main.setAttribute('aria-label',`Select ${node.title} from ${state.map.name} by ${owner}`);main.setAttribute('aria-pressed',String(state.selected===id));
        const title=document.createElement('div');title.className='node-title';title.textContent=node.title;const summary=document.createElement('div');summary.className='node-summary';summary.textContent=node.summary;main.append(title,summary);main.onclick=()=>this.onSelect(side,id);
        const bottom=document.createElement('div');bottom.className='node-bottom';const meta=document.createElement('span');meta.className='node-meta';meta.textContent=owner;meta.title=`${state.map.name} by ${owner}`;bottom.append(meta);
        const confidence=confidenceBadge(node,owner,this.options.canSetConfidence?.(state.map,node)?()=>this.options.onConfidence?.(side,id):null);if(confidence)bottom.append(confidence);
        if(kids.length){const toggle=document.createElement('button');toggle.className='toggle';toggle.type='button';toggle.textContent=`${state.expanded.has(id)?'−':'＋'} ${kids.length}`;toggle.setAttribute('aria-label',`${state.expanded.has(id)?'Collapse':'Expand'} ${node.title} in map ${side.toUpperCase()}`);toggle.title=`${kids.length} child ${kids.length===1?'node':'nodes'}`;toggle.setAttribute('aria-description',toggle.title);toggle.setAttribute('aria-expanded',String(state.expanded.has(id)));toggle.onclick=()=>{state.expanded.has(id)?state.expanded.delete(id):state.expanded.add(id);this.reflow({anchor:comparisonNodeKey(side,id)});};bottom.append(toggle);}
        if(this.options.single){meta.textContent=this.options.nodeMeta?.(node)||(node.parent===null?'Frame':NODE_KINDS[node.kind].label);card.classList.toggle('pod-context',!!node.podContext);main.setAttribute('aria-label',`Select ${node.title}`);}
        card.append(main,bottom);this.world.append(card);this.cards.set(comparisonNodeKey(side,id),card);
      }
    }
    // A question can belong to a single source while its counterpart is unknown.
    // Keep it discoverable even though there is no two-ended line to draw yet.
    for(const record of this.records){if(record.questionStatus!=='needs_elicitation')continue;const ends=comparisonRecordEnds(record,this.states);if(!ends)continue;for(const side of ['a','b']){const endpoint=visibleComparisonEndpoint(this.layout,side,ends[side]);if(!endpoint)continue;const card=this.cards.get(endpoint.key),button=document.createElement('button');button.type='button';button.className='elicitation-marker';button.textContent='?';button.title=record.question;button.setAttribute('aria-label',`Review elicitation question: ${record.question}`);button.onclick=()=>this.onRecord(record.id);card.querySelector('.node-bottom').append(button);}}
    let relevant=0,drawn=0,collapsed=0;
    for(const record of this.records){const ends=comparisonRecordEnds(record,this.states);if(!ends)continue;relevant++;const a=visibleComparisonEndpoint(this.layout,'a',ends.a),b=visibleComparisonEndpoint(this.layout,'b',ends.b);if(!a||!b)continue;
      if(a.proxy||b.proxy){collapsed++;continue;}
      const baseStatus=record.needsReview?'Needs review':record.answerStatus?ANSWER_STATUSES[record.answerStatus]:QUESTION_STATUSES[record.questionStatus];
      const agreed=record.consensus?.state==='agreed';
      const status=agreed?`Both agree · ${baseStatus}`:baseStatus;
      this.addLink(svg,a,b,{id:record.id,label:status,question:record.question,status:record.needsReview?'review':agreed?'agreed':record.answerStatus||record.questionStatus,active:record.id===this.activeRecord});drawn++;
    }
    const a=visibleComparisonEndpoint(this.layout,'a',this.states.a.selected),b=visibleComparisonEndpoint(this.layout,'b',this.states.b.selected);
    const active=this.records.find(r=>r.id===this.activeRecord),activeEnds=active&&comparisonRecordEnds(active,this.states);
    const same=activeEnds&&activeEnds.a===this.states.a.selected&&activeEnds.b===this.states.b.selected;
    if(a&&b&&!a.proxy&&!b.proxy&&!same)this.addLink(svg,a,b,{label:'Selected pair · not recorded',status:'draft',active:true});
    this.hint.textContent=a&&b?'Candidate pair selected. Decide on counterparts or record an elicitation question.':a||b?`Choose a counterpart in ${this.states[a?'b':'a'].map?.name||'the other map'}, or record a question for this node.`:'Shared frame layout · Nearby nodes are not yet confirmed counterparts.';
    this.linkStatus.textContent=relevant?`${drawn} of ${relevant} recorded links shown${collapsed?` · ${collapsed} inside collapsed branches`:''}`:'Recorded comparisons will connect these maps.';
    this.focusButton.disabled=!a&&!b;
    if(this.options.single){this.hint.textContent=this.options.hint||'Choose a node to read, co-sign, or copy it.';this.linkStatus.hidden=true;}
    this.sourceConnections?.build();this.options.afterBuild?.();
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
    const center=p=>p&&({x:p.x+CARD_W/2,y:p.y+CARD_H/2,w:CARD_W,h:CARD_H});
    const obstacles=comparisonDisplayRects(this.layout,this.positions).map(p=>({x:p.x+p.w/2,y:p.y+p.h/2,w:p.w,h:p.h}));
    this.ensureSourceRoutes();
    for(const branch of this.branches){const {path,edge,side}=branch,a=center(this.positions.get(comparisonNodeKey(side,edge.from))),b=center(this.positions.get(comparisonNodeKey(side,edge.to)));branch.route=edge.kind==='spine'?(a&&b?this.routeConnection(a,b,obstacles):null):this.sourceRoutes.get(branch.key);path.setAttribute('d',branch.route?.d||'');}
    for(const link of this.links){
      const a=center(this.positions.get(link.a.key)),b=center(this.positions.get(link.b.key));link.route=a&&b?this.routeConnection(a,b,obstacles):null;const route=link.route;
      link.path.setAttribute('d',route?.d||'');link.hit?.setAttribute('d',route?.d||'');
      if(link.badge){link.badge.hidden=false;const labeled=route&&this.routeConnection(a,b,obstacles,{w:link.badge.offsetWidth,h:link.badge.offsetHeight}),label=labeled?.d===route?.d?labeled?.label:null;link.badge.hidden=!label;if(label)link.badge.style.transform=`translate(${label.x}px,${label.y}px) translate(-50%,-50%)`;}
    }
    this.sourceConnections?.position();this.options.afterGeometry?.();
  }
  ensureSourceRoutes(){
    if(this.sourceRoutedPositions===this.positions)return;
    const center=p=>p&&({x:p.x+CARD_W/2,y:p.y+CARD_H/2,w:CARD_W,h:CARD_H});this.sourceObstacles=comparisonDisplayRects(this.layout,this.positions).map(p=>({x:p.x+p.w/2,y:p.y+p.h/2,w:p.w,h:p.h}));
    const requests=[];for(const pair of this.sourcePairs?.values()||[]){const from=center(this.positions.get(pair.fromKey)),to=center(this.positions.get(pair.toKey));if(from&&to)requests.push({key:pair.routeKey,from,to});}
    const routes=this.routeSources(requests,this.sourceObstacles);this.sourceRoutes=new Map([...this.sourcePairs?.values()||[]].map(pair=>[pair.key,routes.get(pair.routeKey)]).filter(([,route])=>route));this.sourceRoutedPositions=this.positions;
  }
  sourceRouteLabel(key,size){this.ensureSourceRoutes();return labelSourceRoute(this.sourceRoutes.get(key),size,this.sourceObstacles);}
  captureAnchor(target){
    this.stopAnimation();const side=['a','b'].find(s=>this.states[s].map?.id===target?.mapId),key=side&&comparisonNodeKey(side,target.nodeId),p=key&&this.positions.get(key);if(!p)return null;
    return {key,x:this.camera.x+(p.x+CARD_W/2)*this.camera.z,y:this.camera.y+(p.y+CARD_H/2)*this.camera.z,z:this.camera.z};
  }
  restoreAnchor(anchor){
    if(!anchor)return;this.stopAnimation();const p=this.positions.get(anchor.key);if(!p)return;
    this.camera={z:anchor.z,x:anchor.x-(p.x+CARD_W/2)*anchor.z,y:anchor.y-(p.y+CARD_H/2)*anchor.z};this.drawCamera();
  }
  fitCamera(points=null){
    const w=this.surface.clientWidth,h=this.surface.clientHeight;if(!w||!h)return this.camera;
    let bounds=this.layout.bounds;
    if(points?.length){const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));bounds={x,y,width:Math.max(...points.map(p=>p.x+CARD_W))-x,height:Math.max(...points.map(p=>p.y+CARD_H))-y};}
    if(!bounds.height)return this.camera;const z=Math.max(.02,Math.min(1.25,(w-64)/bounds.width,(h-116)/bounds.height));return {z,x:(w-bounds.width*z)/2-bounds.x*z,y:52+(h-116-bounds.height*z)/2-bounds.y*z};
  }
  fit(){if(!this.layout)return;this.stopAnimation();this.positions=new Map(this.layout.positions);this.camera=this.fitCamera();this.drawGeometry();this.drawCamera();}
  fitSelection(){const points=['a','b'].map(side=>visibleComparisonEndpoint(this.layout,side,this.states[side].selected)).filter(Boolean).map(end=>this.layout.positions.get(end.key));if(!points.length)return;this.stopAnimation();this.positions=new Map(this.layout.positions);this.camera=this.fitCamera(points);this.drawGeometry();this.drawCamera();}
  zoom(factor,x=this.surface.clientWidth/2,y=this.surface.clientHeight/2){this.stopAnimation();const z=Math.min(2,Math.max(.02,this.camera.z*factor)),ratio=z/this.camera.z;this.camera={z,x:x-(x-this.camera.x)*ratio,y:y-(y-this.camera.y)*ratio};this.drawCamera();}
  drawCamera(){this.world.style.transform=`translate(${this.camera.x}px,${this.camera.y}px) scale(${this.camera.z})`;this.zoomLabel.textContent=Math.round(this.camera.z*100)+'%';this.sourceConnections?.positionMenu();this.options.afterCamera?.();}
}
