import {WorkspaceController} from './workspace-ui.mjs';
import {newId} from './workspace.mjs';
import {CARD_W,CARD_H,layoutForest,connectorRoute,edgeEndpoints} from './layout.mjs';
import {roots,exampleMap,exampleRelations} from './data.mjs';
import {NODE_KINDS,STRUCTURAL_TYPES,RELATION_TYPES,frameOf,allowedRelationTypes,validateGraph,validateRelationship,revealPath,removeBranch} from './model.mjs';
const $=id=>document.getElementById(id),viewport=$('viewport'),world=$('world');
const svgNS='http://www.w3.org/2000/svg';
let nodes=exampleMap(),relations=exampleRelations(),expanded=new Set(),selected=null,result,positions=new Map(),camera={x:0,y:0,z:1},animation=0,serial=0;
let dirty=false,connectionDirty=false,activeRelation=null,editingRelation=null,relationDrawables=[];
const elements=new Map(),colors=['#008575','#3263cc','#8250bd'];
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function nodeById(id){return nodes.find(n=>n.id===id);}
function descendants(id){const out=[];for(const n of nodes)if(n.parent===id)out.push(n.id,...descendants(n.id));return out;}
function connectedEdges(id){return relations.filter(e=>e.from===id||e.to===id);}
function svg(tag,attrs={}){const el=document.createElementNS(svgNS,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);return el;}
function option(value,label){const el=document.createElement('option');el.value=value;el.textContent=label;return el;}
function allowLeave(){return (!dirty&&!connectionDirty)||confirm('Discard unsaved changes to this node or connection?');}
function kindLabel(n){return n.parent===null?'Frame':NODE_KINDS[n.kind].label;}
function relationSentence(edge){return `${nodeById(edge.from).title} ${RELATION_TYPES[edge.type].label.toLowerCase()} ${nodeById(edge.to).title}`;}
function makeLabel(text,structural=false){const group=svg('g',{class:`edge-label${structural?' structural-label':''}`}),width=text.length*7.2+20;group.append(svg('rect',{x:-width/2,y:-12,width,height:24}));const label=svg('text',{x:0,y:0});label.textContent=text;group.append(label);return group;}
function makeCard(n){
  const card=document.createElement('article');card.className='node';card.dataset.id=n.id;
  const main=document.createElement('button');main.className='node-main';main.type='button';
  const title=document.createElement('div');title.className='node-title';
  const summary=document.createElement('div');summary.className='node-summary';main.append(title,summary);
  const bottom=document.createElement('div');bottom.className='node-bottom';
  const meta=document.createElement('span');meta.className='node-meta';
  const toggle=document.createElement('button');toggle.type='button';toggle.className='toggle';
  const sign=document.createElement('span'),count=document.createElement('span');count.className='child-count';toggle.append(sign,count);
  const leaf=document.createElement('span');leaf.className='leaf';bottom.append(meta,toggle,leaf);card.append(main,bottom);
  main.addEventListener('click',()=>selectNode(n.id));
  toggle.addEventListener('click',()=>{if(expanded.has(n.id)){if(selected&&descendants(n.id).includes(selected)&&!allowLeave())return;expanded.delete(n.id);}else expanded.add(n.id);update({anchor:n.id});});
  $('cards').append(card);const el={card,main,title,summary,meta,toggle,sign,count,leaf};elements.set(n.id,el);return el;
}
function syncCards(){
  workspaceController.captureActive();
  const neighbors=new Set(connectedEdges(selected).flatMap(e=>[e.from,e.to]));
  for(const [id,el]of elements)if(!result.positions.has(id)){el.card.remove();elements.delete(id);}
  for(const [id,p]of result.positions){
    const n=nodeById(id),el=elements.get(id)||makeCard(n),kids=result.children.get(id),links=connectedEdges(id);
    el.card.dataset.frame=p.frame;el.card.classList.toggle('root',roots.includes(id));el.card.classList.toggle('selected',selected===id);el.card.classList.toggle('related-node',selected!==id&&neighbors.has(id)&&$('relation-view').value!=='none');
    el.title.textContent=n.title;el.summary.textContent=n.summary;el.main.setAttribute('aria-label',`Edit ${kindLabel(n).toLowerCase()}: ${n.title}`);el.main.title=n.summary||n.title;
    el.meta.textContent=kindLabel(n)+(n.kind==='position'&&n.confidence!==null?` · ${n.confidence}%`:'');el.meta.dataset.kind=n.kind;el.meta.title=n.confidence===null?'Confidence not assessed':`Confidence ${n.confidence}%`;
    el.sign.textContent=expanded.has(id)?'−':'＋';el.count.textContent=String(kids.length);el.toggle.style.display=kids.length?'flex':'none';el.leaf.hidden=!!kids.length;el.leaf.textContent=links.length?`${links.length} ${links.length===1?'link':'links'}`:'Leaf node';
    el.toggle.setAttribute('aria-expanded',String(expanded.has(id)));el.toggle.setAttribute('aria-label',`${expanded.has(id)?'Collapse':'Expand'} ${n.title}, ${kids.length} child nodes`);
  }
  $('connections').replaceChildren();const defs=svg('defs');
  for(let i=0;i<4;i++){const marker=svg('marker',{id:`arrow-${i}`,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto'});marker.append(svg('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:i===3?'#718398':colors[i]}));defs.append(marker);}
  $('connections').append(defs);
  for(const edge of result.edges){
    const focused=selected&&(edge.from===selected||edge.to===selected)&&edge.kind!=='spine';
    const path=svg('path',{class:`edge${edge.kind==='spine'?' spine':''}${focused?' focused':''}`,stroke:edge.kind==='spine'?'#718398':colors[edge.frame]});
    if(edge.kind!=='spine')path.setAttribute('marker-end',`url(#arrow-${edge.frame})`);
    edge.element=path;edge.label=null;$('connections').append(path);
    if(focused&&$('relation-view').value!=='none'){edge.label=makeLabel(STRUCTURAL_TYPES[nodeById(edge.to).structuralType].forward,true);$('connections').append(edge.label);}
  }
  rebuildRelations();
  $('count').textContent=`${result.positions.size} of ${nodes.length} nodes visible`;
  $('all').disabled=result.positions.size===nodes.length;
  $('next').disabled=![...result.positions.keys()].some(id=>result.children.get(id).length&&!expanded.has(id));
  $('collapse').disabled=result.positions.size===3;
  document.querySelector('.canvas-hint').hidden=result.positions.size!==3;
  if(selected){renderConnections();$('shared-node-note').textContent=workspaceController.sharedNodeNote(nodeById(selected));$('shared-node-note').hidden=!nodeById(selected)?.ideaId;}
}
function rebuildRelations(){
  $('relationships').replaceChildren();const defs=svg('defs'),marker=svg('marker',{id:'relationship-arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto'});marker.append(svg('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#925832'}));defs.append(marker);$('relationships').append(defs);
  relationDrawables=[];const mode=$('relation-view').value;
  for(const e of relations){
    if(mode==='none'||(mode==='selected'&&e.from!==selected&&e.to!==selected)||!result.positions.has(e.from)||!result.positions.has(e.to))continue;
    const path=svg('path',{class:`semantic-edge${e.id===activeRelation?' active':''}`});if(RELATION_TYPES[e.type].directed)path.setAttribute('marker-end','url(#relationship-arrow)');
    const title=svg('title');title.textContent=relationSentence(e);path.append(title);$('relationships').append(path);
    const label=(e.from===selected||e.to===selected||e.id===activeRelation)?makeLabel(RELATION_TYPES[e.type].label):null;if(label)$('relationships').append(label);
    relationDrawables.push({edge:e,path,label});
  }
}
function draw(){
  world.style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.z})`;
  for(const [id,p]of positions){const el=elements.get(id);if(el)el.card.style.transform=`translate(${p.x}px,${p.y}px)`;}
  for(const e of result.edges){const a=positions.get(e.from),b=positions.get(e.to);if(!a||!b)continue;const route=connectorRoute(a,b,e.kind==='spine'?null:positions.get(roots[e.frame]),!!e.label);e.element.setAttribute('d',route.d);if(e.label){const index=Math.floor(route.points.length/2),q=route.points[index],p=route.points[index-1]||q;e.label.setAttribute('transform',`translate(${(p.x+q.x)/2},${(p.y+q.y)/2})`);}}
  for(const r of relationDrawables){
    const a=positions.get(r.edge.from),b=positions.get(r.edge.to);if(!a||!b)continue;
    const {x1,y1,x2,y2}=edgeEndpoints(a,b),dx=x2-x1,dy=y2-y1,len=Math.max(1,Math.hypot(dx,dy));
    const centerY=positions.get(roots[0])?.y??0,sign=(y1+y2)/2<centerY?-1:1,bend=Math.min(170,Math.max(45,len*.14));
    const nx=-dy/len*bend*sign,ny=dx/len*bend*sign,c1x=x1+dx/3+nx,c1y=y1+dy/3+ny,c2x=x1+dx*2/3+nx,c2y=y1+dy*2/3+ny;
    r.path.setAttribute('d',`M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`);
    if(r.label)r.label.setAttribute('transform',`translate(${(x1+3*c1x+3*c2x+x2)/8},${(y1+3*c1y+3*c2y+y2)/8})`);
  }
  $('zoom').textContent=`${Math.round(camera.z*100)}%`;
}
function fitCamera(){const w=viewport.clientWidth,h=viewport.clientHeight;const z=Math.min(1,(w-90)/result.width,(h-140)/result.height);return {z:Math.max(.02,z),x:(w-result.width*Math.max(.02,z))/2,y:Math.max(62,(h-result.height*Math.max(.02,z))/2-10)};}
function transition(targets,targetCamera,instant=false){
  cancelAnimationFrame(animation);const old=new Map(positions),startCam={...camera};
  for(const [id,p] of targets)if(!old.has(id)){let parent=nodeById(id)?.parent;while(parent&&!old.has(parent))parent=nodeById(parent)?.parent;old.set(id,parent?{...old.get(parent)}:{...p});}
  const start=performance.now(),duration=instant||reduced?0:340;
  function step(now){const t=duration?Math.min(1,(now-start)/duration):1,e=1-Math.pow(1-t,3);positions=new Map();for(const [id,p] of targets){const a=old.get(id);positions.set(id,{...p,x:a.x+(p.x-a.x)*e,y:a.y+(p.y-a.y)*e});}camera={x:startCam.x+(targetCamera.x-startCam.x)*e,y:startCam.y+(targetCamera.y-startCam.y)*e,z:startCam.z+(targetCamera.z-startCam.z)*e};draw();if(t<1)animation=requestAnimationFrame(step);else animation=0;}
  animation=requestAnimationFrame(step);
}
function update({anchor=null,fit=false,instant=false}={}){
  const oldAnchor=anchor?positions.get(anchor):null;
  result=layoutForest(nodes,roots,expanded);
  if(selected&&!result.positions.has(selected))closeInspector(true);
  syncCards();let target={...camera};
  if(fit)target=fitCamera();else if(oldAnchor&&result.positions.has(anchor)){const p=result.positions.get(anchor);target.x+=(oldAnchor.x-p.x)*camera.z;target.y+=(oldAnchor.y-p.y)*camera.z;}
  transition(result.positions,target,instant);
}

function settle(){if(animation){cancelAnimationFrame(animation);animation=0;}}
function closeInspector(force=false){if(!force&&!allowLeave())return false;selected=null;dirty=false;connectionDirty=false;activeRelation=null;$('inspector').hidden=true;$('connection-form').hidden=true;if(result){syncCards();draw();}return true;}
function refreshKindFields(){
  if(!selected)return;const n=nodeById(selected),kind=$('kind').value,isRoot=n.parent===null;
  $('kind-group').hidden=isRoot;$('structural-group').hidden=isRoot;$('time-group').hidden=isRoot||frameOf(nodes,n.id)!=='status';$('confidence-group').hidden=kind!=='position'||isRoot;
  $('kind-hint').textContent=NODE_KINDS[kind]?.hint||'';
  const previous=$('structural-type').value||n.structuralType;
  $('structural-type').replaceChildren();for(const [key,value]of Object.entries(STRUCTURAL_TYPES)){if(key==='answer'&&(kind!=='position'||nodeById(n.parent)?.kind!=='question'))continue;$('structural-type').append(option(key,value.label));}
  $('structural-type').value=[...$('structural-type').options].some(o=>o.value===previous)?previous:'nesting';
  $('parent-hint').textContent=n.parent?`Parent: ${nodeById(n.parent).title}`:'';
}
function loadInspector(){
  const n=nodeById(selected);if(!n)return;dirty=false;connectionDirty=false;$('inspector').hidden=false;
  $('kind').value=n.kind==='frame'?'topic':n.kind;$('title').value=n.title;$('title').disabled=n.parent===null;$('summary').value=n.summary;$('details').value=n.details;
  $('source-title').value=n.sourceTitle||'';$('source-url').value=n.sourceUrl||'';$('time-scope').value=n.timeScope||'present';$('confidence').value=n.confidence===null?'':String(n.confidence);
  $('structural-type').replaceChildren();$('structural-type').append(option(n.structuralType||'nesting',''));$('structural-type').value=n.structuralType||'nesting';refreshKindFields();
  $('saved').textContent='';$('saved').classList.remove('error');$('remove').hidden=n.parent===null;$('connection-form').hidden=true;editingRelation=null;
  $('source-link').hidden=!n.sourceUrl;if(n.sourceUrl)$('source-link').href=n.sourceUrl;
  const chain=[];let p=n;while(p){chain.unshift(p.title);p=nodeById(p.parent);} $('breadcrumb').textContent=chain.join(' / ');
  $('shared-node-note').textContent=workspaceController.sharedNodeNote(n);$('shared-node-note').hidden=!n.ideaId;$('inspect-cosigns').hidden=!n.ideaId;
  renderConnections();
}
function selectNode(id){
  if(selected===id)return;if(!allowLeave())return;
  selected=id;activeRelation=null;loadInspector();syncCards();draw();
}
function focusNodes(ids){
  const pts=ids.map(id=>result.positions.get(id)).filter(Boolean);if(!pts.length)return;
  const minX=Math.min(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y)),width=Math.max(...pts.map(p=>p.x+CARD_W))-minX,height=Math.max(...pts.map(p=>p.y+CARD_H))-minY;
  const z=Math.max(.02,Math.min(1,(viewport.clientWidth-100)/width,(viewport.clientHeight-140)/height));
  transition(result.positions,{z,x:(viewport.clientWidth-width*z)/2-minX*z,y:(viewport.clientHeight-height*z)/2-minY*z-10});
}
function revealConnection(id,otherOnly=false){
  const e=relations.find(e=>e.id===id);if(!e)return;
  const other=e.from===selected?e.to:e.from;
  if(otherOnly&&!allowLeave())return;
  expanded=revealPath(nodes,e.from,revealPath(nodes,e.to,expanded));
  if(otherOnly){selected=other;loadInspector();}activeRelation=id;
  if($('relation-view').value==='none')$('relation-view').value='selected';
  update();requestAnimationFrame(()=>focusNodes(otherOnly?[other]:[e.from,e.to]));
}
function renderConnections(){
  if(!selected)return;const edges=connectedEdges(selected);$('connection-count').textContent=String(edges.length);$('connection-list').replaceChildren();
  const hidden=edges.filter(e=>!result.positions.has(e.from)||!result.positions.has(e.to)).length;
  $('connection-note').textContent=edges.length?(hidden?`${hidden} ${hidden===1?'connection leads':'connections lead'} into collapsed branches. Use “Show on map” to reveal both ends.`:'Additional connections beyond the parent and child links.'):'No additional connections yet.';
  for(const edge of edges){
    const item=document.createElement('div');item.className=`connection-item${activeRelation===edge.id?' active':''}`;const outgoing=edge.from===selected,other=nodeById(outgoing?edge.to:edge.from);
    const direction=document.createElement('div');direction.className='connection-direction';direction.textContent=`${RELATION_TYPES[edge.type].directed?(outgoing?'Outgoing':'Incoming'):'Two-way'} · ${RELATION_TYPES[edge.type].label}`;
    const target=document.createElement('button');target.type='button';target.className='connection-target-button';target.textContent=other.title;target.title=relationSentence(edge);target.addEventListener('click',()=>revealConnection(edge.id,true));
    const location=document.createElement('div');location.className='connection-location';location.textContent=nodeById(frameOf(nodes,other.id)).title+(result.positions.has(other.id)?'':' · Collapsed');
    item.append(direction,target,location);
    if(edge.note){const note=document.createElement('p');note.className='connection-note-text';note.textContent=edge.note;item.append(note);}
    const actions=document.createElement('div');actions.className='connection-actions';
    const show=document.createElement('button');show.textContent='Show on map';show.type='button';show.addEventListener('click',()=>revealConnection(edge.id));
    const edit=document.createElement('button');edit.textContent='Edit';edit.type='button';edit.addEventListener('click',()=>openConnectionForm(edge));
    const remove=document.createElement('button');remove.textContent='Remove';remove.type='button';remove.className='delete-connection';remove.setAttribute('aria-label',`Remove connection: ${relationSentence(edge)}`);remove.addEventListener('click',()=>{relations=relations.filter(e=>e.id!==edge.id);if(activeRelation===edge.id)activeRelation=null;if(editingRelation===edge.id){$('connection-form').hidden=true;connectionDirty=false;}syncCards();draw();});
    actions.append(show,edit,remove);item.append(actions);$('connection-list').append(item);
  }
}
function openConnectionForm(edge=null){
  if(connectionDirty&&!confirm('Discard the unsaved connection changes?'))return;connectionDirty=false;
  editingRelation=edge?.id||null;$('connection-form').hidden=false;$('connection-direction').value=edge?.to===selected?'in':'out';$('connection-target').replaceChildren(option('','Choose a node…'));
  for(const root of roots){const group=document.createElement('optgroup');group.label=nodeById(root).title;for(const n of nodes)if(n.id!==selected&&frameOf(nodes,n.id)===root)group.append(option(n.id,n.title));$('connection-target').append(group);}
  $('connection-target').value=edge?(edge.from===selected?edge.to:edge.from):'';$('connection-note-input').value=edge?.note||'';$('connection-submit').textContent=edge?'Save connection':'Add connection';$('connection-error').textContent='';refreshConnectionTypes(edge?.type);$('connection-target').focus();
}
function connectionEnds(){const other=$('connection-target').value;return $('connection-direction').value==='out'?{from:selected,to:other}:{from:other,to:selected};}
function refreshConnectionTypes(preferred=null){
  const {from,to}=connectionEnds(),types=allowedRelationTypes(nodes,from,to),previous=preferred||$('connection-type').value;
  $('connection-type').replaceChildren();for(const type of types)$('connection-type').append(option(type,RELATION_TYPES[type].label));
  if(types.includes(previous))$('connection-type').value=previous;
  $('connection-type').disabled=!types.length;$('connection-submit').disabled=!types.length;
  $('connection-hint').textContent=!from||!to?'Choose the other node first.':!types.length?'This pairing uses the other direction. Try changing “From this node” to “To this node,” or vice versa.':frameOf(nodes,from)===frameOf(nodes,to)?'A connection within this frame.':'A connection between frames.';
  $('connection-error').textContent='';
}
function addChild(kind){
  if(!selected||!allowLeave())return;const parent=selected,p=nodeById(parent),id=newId('node');
  const node={id,parent,title:kind==='question'?'New question':kind==='explainer'?'New example':kind==='topic'?'New topic':'New position',summary:'',details:'',confidence:null,kind,structuralType:p.kind==='question'&&kind==='position'?'answer':'nesting',timeScope:p.timeScope||'present',sourceTitle:'',sourceUrl:''};
  nodes.push(node);if(kind==='explainer')relations.push({id:newId('relation'),from:id,to:parent,type:'illustrative',note:''});
  dirty=false;expanded.add(parent);selected=id;update({anchor:parent});loadInspector();syncCards();draw();$('title').focus();$('title').select();
}
$('close').addEventListener('click',()=>closeInspector());
$('inspect-cosigns').addEventListener('click',()=>{if(selected)workspaceController.exploreNode(workspaceController.activeMapId,selected);});
$('edit-form').addEventListener('input',()=>{dirty=true;$('saved').textContent='Unsaved changes';$('saved').classList.remove('error');});
$('edit-form').addEventListener('change',()=>{dirty=true;$('saved').textContent='Unsaved changes';});
$('kind').addEventListener('change',refreshKindFields);
$('edit-form').addEventListener('submit',event=>{
  event.preventDefault();if(!selected)return;if(connectionDirty&&!confirm('Discard the unsaved connection changes and save this node?'))return;const n=nodeById(selected),title=n.parent===null?n.title:$('title').value.trim();
  try{
    if(!title)throw Error('Enter a title.');
    const next={...n,title,kind:n.parent===null?'frame':$('kind').value,summary:$('summary').value.trim(),details:$('details').value.trim(),structuralType:n.parent===null?null:$('structural-type').value,timeScope:$('time-scope').value,sourceTitle:$('source-title').value.trim(),sourceUrl:$('source-url').value.trim(),confidence:$('confidence').value===''?null:Number($('confidence').value)};
    const candidate=nodes.map(node=>node.id===selected?next:node);validateGraph(candidate,roots,relations);nodes=candidate;dirty=false;loadInspector();syncCards();draw();$('saved').textContent='Node updated. Save the workspace to keep changes.';
  }catch(error){$('saved').textContent=error.message;$('saved').classList.add('error');}
});
$('add-child').addEventListener('click',()=>addChild($('child-kind').value));$('add-example').addEventListener('click',()=>addChild('explainer'));
$('connect').addEventListener('click',()=>openConnectionForm());$('cancel-connect').addEventListener('click',()=>{if(connectionDirty&&!confirm('Discard the unsaved connection changes?'))return;connectionDirty=false;$('connection-form').hidden=true;editingRelation=null;});
$('connection-form').addEventListener('input',()=>{connectionDirty=true;});$('connection-form').addEventListener('change',()=>{connectionDirty=true;});
$('connection-direction').addEventListener('change',()=>refreshConnectionTypes());$('connection-target').addEventListener('change',()=>refreshConnectionTypes());
$('connection-form').addEventListener('submit',event=>{
  event.preventDefault();const edge={id:editingRelation||newId('relation'),...connectionEnds(),type:$('connection-type').value,note:$('connection-note-input').value.trim()};
  try{validateRelationship(nodes,relations,edge,editingRelation);relations=editingRelation?relations.map(e=>e.id===editingRelation?edge:e):[...relations,edge];activeRelation=edge.id;connectionDirty=false;$('connection-form').hidden=true;editingRelation=null;syncCards();draw();}
  catch(error){$('connection-error').textContent=error.message;}
});
$('relation-view').addEventListener('change',()=>{syncCards();draw();});
$('remove').addEventListener('click',()=>{if(!selected||roots.includes(selected))return;const id=selected,branch=removeBranch(nodes,relations,id),parent=nodeById(id).parent;if(!confirm(`Delete “${nodeById(id).title}”${branch.removed.size>1?` and its ${branch.removed.size-1} descendant nodes`:''}? Connections to these nodes will also be removed.`))return;nodes=branch.nodes;relations=branch.relations;for(const key of branch.removed)expanded.delete(key);selected=null;dirty=false;connectionDirty=false;activeRelation=null;$('inspector').hidden=true;update({anchor:parent});});
$('next').addEventListener('click',()=>{const visible=[...result.positions.keys()];for(const id of visible)if(result.children.get(id).length)expanded.add(id);update({fit:true});});
$('all').addEventListener('click',()=>{expanded=new Set(nodes.filter(n=>result.children.get(n.id).length).map(n=>n.id));update({fit:true});});
$('collapse').addEventListener('click',()=>{if(!allowLeave())return;expanded.clear();closeInspector(true);update({fit:true});});
$('reset').addEventListener('click',()=>{if(!confirm('Reset to the illustrative map? This will discard your edits.'))return;nodes=exampleMap();relations=exampleRelations();expanded.clear();selected=null;dirty=false;connectionDirty=false;activeRelation=null;$('inspector').hidden=true;$('relation-view').value='selected';update({fit:true});});
$('fit').addEventListener('click',()=>transition(result.positions,fitCamera()));
function zoom(factor,x=viewport.clientWidth/2,y=viewport.clientHeight/2,absolute=false){settle();const z=Math.min(2,Math.max(.02,absolute?factor:camera.z*factor)),ratio=z/camera.z;camera={x:x-(x-camera.x)*ratio,y:y-(y-camera.y)*ratio,z};positions=new Map(result.positions);draw();}
$('plus').addEventListener('click',()=>zoom(1.2));$('minus').addEventListener('click',()=>zoom(1/1.2));$('zoom').addEventListener('click',()=>zoom(1,viewport.clientWidth/2,viewport.clientHeight/2,true));
viewport.addEventListener('wheel',event=>{if(event.target.closest('.viewport-controls'))return;event.preventDefault();const rect=viewport.getBoundingClientRect();zoom(Math.exp(-event.deltaY*.0015),event.clientX-rect.left,event.clientY-rect.top);},{passive:false});
const pointers=new Map();let drag=null,pinch=null;
viewport.addEventListener('pointerdown',event=>{if(event.target.closest('button,.node')||event.button>0)return;settle();positions=new Map(result.positions);draw();viewport.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===1)drag={x:event.clientX,y:event.clientY,cx:camera.x,cy:camera.y};if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),z:camera.z};drag=null;}viewport.classList.add('panning');});
viewport.addEventListener('pointermove',event=>{if(!pointers.has(event.pointerId))return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===2&&pinch){const [a,b]=[...pointers.values()],rect=viewport.getBoundingClientRect();zoom(pinch.z*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance),(a.x+b.x)/2-rect.left,(a.y+b.y)/2-rect.top,true);}else if(drag){camera.x=drag.cx+event.clientX-drag.x;camera.y=drag.cy+event.clientY-drag.y;draw();}});
function endPointer(event){pointers.delete(event.pointerId);pinch=null;drag=null;if(pointers.size===1){const p=[...pointers.values()][0];drag={x:p.x,y:p.y,cx:camera.x,cy:camera.y};}if(!pointers.size)viewport.classList.remove('panning');}
viewport.addEventListener('pointerup',endPointer);viewport.addEventListener('pointercancel',endPointer);
viewport.addEventListener('keydown',event=>{if(event.target!==viewport)return;const steps={ArrowLeft:[60,0],ArrowRight:[-60,0],ArrowUp:[0,60],ArrowDown:[0,-60]};if(steps[event.key]){event.preventDefault();settle();positions=new Map(result.positions);camera.x+=steps[event.key][0];camera.y+=steps[event.key][1];draw();}else if(event.key==='+'||event.key==='=')zoom(1.2);else if(event.key==='-')zoom(1/1.2);else if(event.key.toLowerCase()==='f')transition(result.positions,fitCamera());});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeInspector();});
let oldWidth=viewport.clientWidth,oldHeight=viewport.clientHeight;
new ResizeObserver(()=>{const w=viewport.clientWidth,h=viewport.clientHeight;if(result&&(w!==oldWidth||h!==oldHeight)){settle();positions=new Map(result.positions);camera.x+=(w-oldWidth)/2;camera.y+=(h-oldHeight)/2;draw();}oldWidth=w;oldHeight=h;}).observe(viewport);
const workspaceController=new WorkspaceController({
  getMapData:()=>({nodes,relations}),beforeLeave:allowLeave,hasDraft:()=>dirty||connectionDirty,
  discardDraft:()=>closeInspector(true),
  flushDraft:()=>{if(connectionDirty)$('connection-form').requestSubmit();if(connectionDirty)return false;if(dirty)$('edit-form').requestSubmit();return !dirty;},
  setMap:map=>{selected=null;dirty=false;connectionDirty=false;activeRelation=null;editingRelation=null;$('inspector').hidden=true;$('connection-form').hidden=true;nodes=map.nodes;relations=map.relations;expanded=new Set();positions=new Map();update({fit:true,instant:true});},
  focusNode:id=>{expanded=revealPath(nodes,id,expanded);selected=id;update();loadInspector();requestAnimationFrame(()=>focusNodes([id]));}
});
update({fit:true,instant:true});
workspaceController.initialize();
