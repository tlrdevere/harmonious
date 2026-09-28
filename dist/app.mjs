import {WorkspaceController} from './workspace-ui.mjs';
import {NodeActions} from './node-actions.mjs';
import {MapConnectionsUI} from './map-connections-ui.mjs';
import {createConnectionRouter,createSourceConnectionRouter,labelSourceRoute} from './comparison-routing.mjs';
import {createSourceConnectionHighlights} from './source-connections-ui.mjs';
import {groupSourceConnections,visibleNodePairKey} from './conversation-tree.mjs';
import {NodeFaceEditor} from './node-face-editor.mjs';
import {confidenceBadge,attachConfidenceScale} from './confidence-ui.mjs';
import {FRAME_COLORS,installFramePalette} from './frame-palette.mjs';
import {newId} from './workspace.mjs';
import {CARD_W,CARD_H,layoutForest} from './layout.mjs';
import {roots,exampleMap,exampleRelations} from './data.mjs';
import {NODE_KINDS,STRUCTURAL_TYPES,RELATION_TYPES,graphEdges,frameOf,allowedRelationTypes,validateGraph,validateRelationship,createChildStatement,revealPath,removeBranch} from './model.mjs';
const $=id=>document.getElementById(id),viewport=$('viewport'),world=$('world');
const svgNS='http://www.w3.org/2000/svg';
let nodes=exampleMap(),relations=exampleRelations(),expanded=new Set(),selected=null,result,positions=new Map(),camera={x:0,y:0,z:1},animation=0,serial=0;
let dirty=false,connectionDirty=false,activeRelation=null,editingRelation=null,relationDrawables=[],childDraft=null,inspectorMode='edit';
let activeConnectionKey=null,routedPositions=null;
const mapRoute=createConnectionRouter(),sourceRoutes=createSourceConnectionRouter(),sourceHighlights=createSourceConnectionHighlights(),connectionRoutes=new Map();
const elements=new Map(),colors=FRAME_COLORS;
installFramePalette();
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function renderNodes(){return childDraft?[...nodes,childDraft.node]:nodes;}
function nodeById(id){return nodes.find(n=>n.id===id)||(childDraft?.node.id===id?childDraft.node:undefined);}
function descendants(id){const out=[];for(const n of renderNodes())if(n.parent===id)out.push(n.id,...descendants(n.id));return out;}
function connectedEdges(id){return relations.filter(e=>e.from===id||e.to===id);}
function svg(tag,attrs={}){const el=document.createElementNS(svgNS,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);return el;}
function option(value,label){const el=document.createElement('option');el.value=value;el.textContent=label;return el;}
function allowLeave(){
  if(!dirty&&!connectionDirty&&!childDraft)return true;
  if(!confirm(childDraft?'Discard this unfinished child node?':'Discard unsaved changes to this node or connection?'))return false;
  if(childDraft)discardChild();else{const panelOpen=!$('inspector').hidden;loadInspector('inspect');$('inspector').hidden=!panelOpen;syncCards();draw();}
  return true;
}
function relationSentence(edge){return `${nodeById(edge.from).title} ${RELATION_TYPES[edge.type].label.toLowerCase()} ${nodeById(edge.to).title}`;}
function makeLabel(text,structural=false){const group=svg('g',{class:`edge-label${structural?' structural-label':''}`}),width=text.length*7.2+20;group.dataset.width=width;group.append(svg('rect',{x:-width/2,y:-12,width,height:24}));const label=svg('text',{x:0,y:0});label.textContent=text;group.append(label);return group;}
function inspectionPath(parent,path,edges){
  const edge=edges[0],key=visibleNodePairKey(edge.from,edge.to),group=svg('g',{class:`map-edge-group${key===activeConnectionKey?' active':''}`});
  path.dataset.nodePair=key;path.classList.add('source-connection-path');
  const hit=svg('path',{class:'map-edge-hit',fill:'none',tabindex:'0',role:'button','aria-label':`Inspect connection: ${nodeById(edge.from).title} to ${nodeById(edge.to).title}`});hit.dataset.nodePair=key;
  const labelText=edges.length>1?`${edges.length} connection meanings`:edge.structural?(STRUCTURAL_TYPES[edge.type]?.label||'Branch'):(RELATION_TYPES[edge.type]?.label||'Connection'),label=makeLabel(labelText,edge.structural);
  const select=()=>inspectConnection(key,edges);hit.onclick=select;hit.onkeydown=event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();select();}};
  hit.onpointerdown=event=>event.stopPropagation();group.append(path,hit,label);parent.append(group);sourceHighlights.bind(key,path,hit,[edge.from,edge.to].map(id=>elements.get(id)?.card));return {hit,label,key,edges};
}
function makeCard(n){
  const card=document.createElement('article');card.className='node';card.dataset.id=n.id;
  const main=document.createElement('button');main.className='node-main';main.type='button';
  const title=document.createElement('div');title.className='node-title';
  const summary=document.createElement('div');summary.className='node-summary';main.append(title,summary);
  const bottom=document.createElement('div');bottom.className='node-bottom';
  const toggle=document.createElement('button');toggle.type='button';toggle.className='toggle';
  const sign=document.createElement('span'),count=document.createElement('span');count.className='child-count';toggle.append(sign,count);
  const add=document.createElement('button');add.type='button';add.className='node-add-child';add.textContent='+';add.setAttribute('aria-label',`Add a child to “${n.title}”`);add.title='Add child';
  add.onclick=e=>{e.stopPropagation();selectNode(n.id);if(selected===n.id)addChild();};
  const confidence=document.createElement('span');confidence.className='node-confidence-slot';
  const controls=document.createElement('div');controls.className='node-controls';controls.append(toggle,add);
  bottom.append(confidence,controls);card.append(main,bottom);
  main.addEventListener('click',()=>selectNode(n.id));
  toggle.addEventListener('click',()=>{if(expanded.has(n.id)){if(selected&&descendants(n.id).includes(selected)&&!allowLeave())return;expanded.delete(n.id);}else expanded.add(n.id);update({anchor:n.id});});
  $('cards').append(card);const el={card,main,title,summary,confidence,toggle,sign,count,add};elements.set(n.id,el);return el;
}
function syncCards(){
  routedPositions=null;sourceHighlights.reset();sourceHighlights.select(activeConnectionKey);
  workspaceController.captureActive();
  const neighbors=new Set(connectedEdges(selected).flatMap(e=>[e.from,e.to]));
  for(const [id,el]of elements)if(!result.positions.has(id)){el.card.remove();elements.delete(id);}
  for(const [id,p]of result.positions){
    const n=nodeById(id),el=elements.get(id)||makeCard(n),kids=result.children.get(id);
    el.card.dataset.frame=p.frame;el.card.toggleAttribute('data-draft',childDraft?.node.id===id);el.card.classList.toggle('face-editing',faceEditor.nodeId===id);el.card.classList.toggle('root',roots.includes(id));el.card.classList.toggle('selected',selected===id);el.card.classList.toggle('related-node',selected!==id&&neighbors.has(id)&&$('relation-view').value!=='none');
    el.title.textContent=n.title;el.summary.textContent=n.summary;el.main.setAttribute('aria-label',`Select node: ${n.title}`);el.main.title=n.summary||n.title;
    el.add.hidden=childDraft?.node.id===id||!workspaceController.canEditMap(workspaceController.activeMap());el.add.setAttribute('aria-label',`Add a child to “${n.title}”`);
    const map=workspaceController.activeMap(),owner=workspaceController.workspace.participants.find(person=>person.id===map?.ownerId)?.name||map?.person||'Author',badge=confidenceBadge(n,owner,workspaceController.canEditMap(map)?()=>showConfidence(n.id):null);el.confidence.replaceChildren(...(badge?[badge]:[]));
    el.sign.textContent=expanded.has(id)?'−':'＋';el.count.textContent=String(kids.length);el.toggle.style.display=kids.length?'flex':'none';
    el.toggle.setAttribute('aria-expanded',String(expanded.has(id)));el.toggle.setAttribute('aria-label',`${expanded.has(id)?'Collapse':'Expand'} ${n.title}, ${kids.length} child nodes`);
  }
  $('connections').replaceChildren();
  rebuildRelations();
  for(const edge of result.edges){
    edge.element=null;edge.label=null;edge.hit=null;
    // A semantic connection replaces the organizational line for this pair.
    // Hiding a semantic connection must not invent a substitute structural line.
    if(relations.some(e=>visibleNodePairKey(e.from,e.to)===visibleNodePairKey(edge.from,edge.to)))continue;
    const focused=selected&&(edge.from===selected||edge.to===selected)&&edge.kind!=='spine';
    const path=svg('path',{class:`edge${edge.kind==='spine'?' spine':''}${focused?' focused':''}`,stroke:edge.kind==='spine'?'#718398':colors[edge.frame]});
    edge.element=path;
    if(edge.kind==='spine'||childDraft?.node.id===edge.to)$('connections').append(path);
    else Object.assign(edge,inspectionPath($('connections'),path,[{id:'structure:'+edge.to,from:edge.from,to:edge.to,type:nodeById(edge.to).structuralType,structural:true}]));
  }
  $('count').textContent=`${result.positions.size} of ${renderNodes().length} nodes visible${childDraft?' · 1 unsaved child':''}`;
  $('all').disabled=result.positions.size===renderNodes().length;
  $('next').disabled=![...result.positions.keys()].some(id=>result.children.get(id).length&&!expanded.has(id));
  $('collapse').disabled=result.positions.size===3;
  document.querySelector('.canvas-hint').hidden=result.positions.size!==3;
  if(selected){renderConnections();$('shared-node-note').textContent=workspaceController.sharedNodeNote(nodeById(selected));$('shared-node-note').hidden=!nodeById(selected)?.ideaId;}
}
function rebuildRelations(){
  $('relationships').replaceChildren();const defs=svg('defs'),marker=svg('marker',{id:'relationship-arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:5,markerHeight:5,orient:'auto-start-reverse'});marker.append(svg('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#758995'}));defs.append(marker);$('relationships').append(defs);
  relationDrawables=[];const mode=$('relation-view').value;
  for(const grouped of groupSourceConnections(graphEdges(nodes,relations))){
    const meanings=[...grouped].sort((a,b)=>Number(a.structural)-Number(b.structural)||a.id.localeCompare(b.id)),e=meanings[0];if(e.structural)continue;
    if(mode==='none'||(mode==='selected'&&e.from!==selected&&e.to!==selected)||!result.positions.has(e.from)||!result.positions.has(e.to))continue;
    const path=svg('path',{class:`semantic-edge${meanings.some(item=>item.id===activeRelation)?' active':''}`});
    if(meanings.some(item=>!item.structural&&RELATION_TYPES[item.type].directed&&item.from===e.from))path.setAttribute('marker-end','url(#relationship-arrow)');
    if(meanings.some(item=>!item.structural&&RELATION_TYPES[item.type].directed&&item.from===e.to))path.setAttribute('marker-start','url(#relationship-arrow)');
    relationDrawables.push({edge:e,path,...inspectionPath($('relationships'),path,meanings)});
  }
}
function draw(){
  world.style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.z})`;
  for(const [id,p]of positions){const el=elements.get(id);if(el)el.card.style.transform=`translate(${p.x}px,${p.y}px)`;}
  // Camera-only redraws reuse the completed graph even when the graph is
  // larger than the bounded route cache. Layout animation replaces positions.
  if(routedPositions!==positions){
  const boxes=new Map([...positions].map(([id,p])=>[id,{x:p.x+CARD_W/2,y:p.y+CARD_H/2,w:CARD_W,h:CARD_H}])),obstacles=[...boxes.values()];connectionRoutes.clear();
  const requests=groupSourceConnections(graphEdges(renderNodes(),relations)).map(grouped=>{
    const edge=[...grouped].sort((a,b)=>Number(a.structural)-Number(b.structural)||a.id.localeCompare(b.id))[0];
    return {key:visibleNodePairKey(edge.from,edge.to),from:boxes.get(edge.from),to:boxes.get(edge.to)};
  }).filter(request=>request.from&&request.to),routes=sourceRoutes(requests,obstacles);
  const routeEdge=(edge,path,hit,label,key)=>{const a=boxes.get(edge.from),b=boxes.get(edge.to);if(!a||!b||!path)return;const route=edge.kind==='spine'?mapRoute(a,b,obstacles):routes.get(visibleNodePairKey(edge.from,edge.to));if(!route)return;path.setAttribute('d',route.d);hit?.setAttribute('d',route.d);if(hit){hit.style.display=route.blocked?'none':'';hit.setAttribute('tabindex',route.blocked?'-1':'0');}if(key)connectionRoutes.set(key,route);if(label){const point=labelSourceRoute(route,{w:Number(label.dataset.width),h:24},obstacles);label.style.display=point?'':'none';if(point)label.setAttribute('transform',`translate(${point.x},${point.y})`);}};
  for(const edge of result.edges)routeEdge(edge,edge.element,edge.hit,edge.label,edge.key);
  for(const item of relationDrawables)routeEdge(item.edge,item.path,item.hit,item.label,item.key);
  routedPositions=positions;
  }
  $('zoom').textContent=`${Math.round(camera.z*100)}%`;
  nodeActions.position(positions.get(selected),camera);
  connectionMenu.position(connectionRoutes.get(connectionMenu.key)?.midpoint,camera);
  faceEditor.position(positions.get(faceEditor.nodeId),camera);
}
function fitCamera(){const w=viewport.clientWidth,h=viewport.clientHeight;const z=Math.min(1,(w-90)/result.width,(h-140)/result.height);return {z:Math.max(.02,z),x:(w-result.width*Math.max(.02,z))/2,y:Math.max(62,(h-result.height*Math.max(.02,z))/2-10)};}
function transition(targets,targetCamera,instant=false){
  cancelAnimationFrame(animation);const old=new Map(positions),startCam={...camera};
  for(const [id,p] of targets)if(!old.has(id)){let parent=nodeById(id)?.parent;while(parent&&!old.has(parent))parent=nodeById(parent)?.parent;old.set(id,parent?{...old.get(parent)}:{...p});}
  const start=performance.now(),duration=instant||reduced?0:340;
  function step(now){const t=duration?Math.min(1,(now-start)/duration):1,e=1-Math.pow(1-t,3);positions=new Map();for(const [id,p] of targets){const a=old.get(id);positions.set(id,{...p,x:a.x+(p.x-a.x)*e,y:a.y+(p.y-a.y)*e});}camera={x:startCam.x+(targetCamera.x-startCam.x)*e,y:startCam.y+(targetCamera.y-startCam.y)*e,z:startCam.z+(targetCamera.z-startCam.z)*e};if(t===1)positions=targets;draw();if(t<1)animation=requestAnimationFrame(step);else animation=0;}
  animation=requestAnimationFrame(step);
}
function update({anchor=null,fit=false,instant=false}={}){
  const oldAnchor=anchor?positions.get(anchor):null;
  result=layoutForest(renderNodes(),roots,expanded);
  if(selected&&!result.positions.has(selected))closeInspector(true);
  if(activeConnectionKey){const edge=connectionMeanings(activeConnectionKey)[0];if(!edge||!result.positions.has(edge.from)||!result.positions.has(edge.to)){connectionMenu.hide();activeConnectionKey=null;activeRelation=null;}}
  syncCards();let target={...camera};
  if(fit)target=fitCamera();else if(oldAnchor&&result.positions.has(anchor)){const p=result.positions.get(anchor);target.x+=(oldAnchor.x-p.x)*camera.z;target.y+=(oldAnchor.y-p.y)*camera.z;}
  transition(result.positions,target,instant);
}

function settle(){if(animation){cancelAnimationFrame(animation);animation=0;}}
function closeInspector(force=false){if(!force&&!allowLeave())return false;const id=childDraft?.parent||selected,hadChild=!!childDraft;faceEditor.hide();selected=null;dirty=false;connectionDirty=false;childDraft=null;if(hadChild){result=layoutForest(nodes,roots,expanded);positions=result.positions;}activeRelation=null;activeConnectionKey=null;connectionMenu.hide();nodeActions.hide();$('inspector').hidden=true;$('connection-form').hidden=true;$('child-form').hidden=true;if(result){syncCards();draw();}elements.get(id)?.main.focus({preventScroll:true});workspaceController.status();return true;}
function refreshKindFields(){
  if(!selected)return;const n=nodeById(selected),kind=$('kind').value,isRoot=n.parent===null;
  $('kind-group').hidden=true;$('structural-group').hidden=true;$('time-group').hidden=true;$('confidence-group').hidden=kind!=='position'||isRoot;
  $('kind-hint').textContent=NODE_KINDS[kind]?.hint||'';
  const previous=$('structural-type').value||n.structuralType;
  $('structural-type').replaceChildren();for(const [key,value]of Object.entries(STRUCTURAL_TYPES)){if(key==='answer'&&(kind!=='position'||nodeById(n.parent)?.kind!=='question'))continue;$('structural-type').append(option(key,value.label));}
  $('structural-type').value=[...$('structural-type').options].some(o=>o.value===previous)?previous:'nesting';
  $('parent-hint').textContent=n.parent?`Parent: ${nodeById(n.parent).title}`:'';
}
function renderNodeReading(n){
  const host=$('node-reading');host.replaceChildren();
  for(const [tag,text]of [['h2',n.title],['p',n.summary],['p',n.details]])if(text){const el=document.createElement(tag);el.textContent=text;host.append(el);}
  if(n.sourceTitle||n.sourceUrl){const source=document.createElement('p');source.textContent=n.sourceTitle||'Source';if(n.sourceUrl){const link=document.createElement('a');link.href=n.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open source';source.append(document.createElement('br'),link);}host.append(source);}
  const map=workspaceController.activeMap(),owner=workspaceController.workspace.participants.find(person=>person.id===map?.ownerId)?.name||map?.person||'Author',badge=confidenceBadge(n,owner);if(badge)host.append(badge);
  const definitions=$('node-definition-list');definitions.replaceChildren();
  const refs=(workspaceController.workspace.discussions||[]).filter(r=>r.kind==='context'&&r.status==='active'&&r.target?.type==='node'&&r.target.mapId===workspaceController.activeMapId&&r.target.nodeId===n.id).flatMap(r=>r.definitionRefs||[]);
  for(const ref of refs){const entry=document.createElement('div'),title=document.createElement('h3'),byline=document.createElement('p'),body=document.createElement('p');title.textContent=ref.title;byline.className='field-help';const author=workspaceController.workspace.participants.find(p=>p.id===ref.authorId)?.name||'Author';byline.textContent=`${ref.type==='standard'?'Standard':'Definition'} · ${author} · Version ${ref.version}`;body.textContent=ref.body;entry.append(title,byline,body);definitions.append(entry);}
  if(!refs.length){const p=document.createElement('p');p.className='field-help';p.textContent='No definitions or standards attached.';definitions.append(p);}
  $('node-definitions').hidden=!workspaceController.canEditMap(workspaceController.activeMap());
}
function setInspectorMode(mode){
  inspectorMode=mode;$('inspector-mode').textContent=mode==='child'?'ADD CHILD NODE':mode==='inspect'?'NODE DETAILS':'EDIT NODE';
  $('edit-form').hidden=mode!=='edit';$('child-form').hidden=mode!=='child';$('node-reading').hidden=mode!=='inspect';$('node-meaning').hidden=mode!=='inspect';$('node-connections').hidden=mode==='child';$('inspector-node-actions').hidden=mode!=='edit';
}
function loadInspector(mode=inspectorMode==='child'?'edit':inspectorMode){
  const n=nodeById(selected);if(!n)return;faceEditor.hide();dirty=false;connectionDirty=false;childDraft=null;setInspectorMode(mode);$('inspector').hidden=false;
  $('kind').replaceChildren(option(n.kind,'Node'));$('kind').value=n.kind;$('title').value=n.title;$('title').disabled=n.parent===null;$('summary').value=n.summary;$('details').value=n.details;
  $('source-title').value=n.sourceTitle||'';$('source-url').value=n.sourceUrl||'';$('time-scope').value=n.timeScope||'present';$('confidence').value=n.confidence===null?'':String(n.confidence);$('confidence').setCustomValidity('');confidenceScale.sync();
  $('structural-type').replaceChildren();$('structural-type').append(option(n.structuralType||'nesting',''));$('structural-type').value=n.structuralType||'nesting';refreshKindFields();
  $('saved').textContent='';$('saved').classList.remove('error');$('remove').hidden=n.parent===null;$('connect').hidden=n.parent===null||!workspaceController.canEditMap(workspaceController.activeMap());$('connection-form').hidden=true;editingRelation=null;
  $('source-link').hidden=!n.sourceUrl;if(n.sourceUrl)$('source-link').href=n.sourceUrl;
  const chain=[];let p=n;while(p){chain.unshift(p.title);p=nodeById(p.parent);} $('breadcrumb').textContent=chain.join(' / ');
  $('shared-node-note').textContent=workspaceController.sharedNodeNote(n);$('shared-node-note').hidden=!n.ideaId;$('inspect-cosigns').hidden=!n.ideaId;
  renderNodeReading(n);renderConnections();
}
function showNodeFace(form,child=false){
  $('inspector').hidden=true;nodeActions.hide();connectionMenu.hide();
  const n=nodeById(selected);faceEditor.show(n,form,{frame:result.positions.get(selected)?.frame,child});
  settle();positions=result.positions;oldWidth=viewport.clientWidth;oldHeight=viewport.clientHeight;const p=positions.get(selected),z=1;
  if(p)camera={z,x:(viewport.clientWidth-Math.min(350,viewport.clientWidth-24))/2-p.x*z,y:24-p.y*z};
  syncCards();draw();(child?$('child-title'):$('title').disabled?$('summary'):$('title')).focus({preventScroll:true});
  workspaceController.status();
}
function openNodeInspector(mode){if(!selected||!allowLeave())return;loadInspector(mode);if(mode==='edit')showNodeFace($('edit-form'));else{$('inspector').hidden=false;nodeActions.hide();syncCards();draw();$('close').focus();}workspaceController.status();}
function selectNode(id){
  if(selected===id){if(childDraft||faceEditor.nodeId===id)return;connectionMenu.hide();activeConnectionKey=null;nodeActions.show(nodeById(id));syncCards();draw();return;}if(!allowLeave())return;
  connectionMenu.hide();activeConnectionKey=null;
  const panelOpen=!$('inspector').hidden;selected=id;activeRelation=null;loadInspector();$('inspector').hidden=!panelOpen;nodeActions.show(nodeById(id));syncCards();draw();
}
function showConfidence(id){
  if(!workspaceController.canEditMap(workspaceController.activeMap())||nodeById(id)?.kind!=='position'||nodeById(id)?.parent===null)return;
  if(!workspaceController.editor.flushDraft())return;
  selectNode(id);if(selected!==id)return;nodeActions.show(nodeById(id),'confidence');nodeActions.position(positions.get(id),camera);nodeActions.host.querySelector('input')?.focus();
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
function connectionMeanings(key){return (groupSourceConnections(graphEdges(nodes,relations)).find(edges=>visibleNodePairKey(edges[0].from,edges[0].to)===key)||[]).sort((a,b)=>Number(a.structural)-Number(b.structural)||a.id.localeCompare(b.id));}
function focusConnection(key){const hit=[...document.querySelectorAll('#world .map-edge-hit')].find(el=>el.dataset.nodePair===key&&el.style.display!=='none');(hit||elements.get(selected)?.main||viewport).focus({preventScroll:true});}
function inspectConnection(key,edges=connectionMeanings(key)){
  if(!edges.length||!allowLeave())return;const panelOpen=!$('inspector').hidden;
  selected=edges[0].from;activeRelation=edges.find(edge=>!edge.structural)?.id||null;activeConnectionKey=key;
  loadInspector();$('inspector').hidden=!panelOpen;nodeActions.hide();syncCards();draw();
  connectionMenu.show(key,edges,nodes,workspaceController.canEditMap(workspaceController.activeMap()));connectionMenu.position(connectionRoutes.get(key)?.midpoint,camera);
}
function closeConnection(key){connectionMenu.hide();activeConnectionKey=null;activeRelation=null;syncCards();draw();focusConnection(key);}
function editConnection(id){
  const edge=relations.find(item=>item.id===id);if(!edge||!workspaceController.canEditMap(workspaceController.activeMap())||!allowLeave())return;
  selected=edge.from;activeRelation=id;loadInspector('inspect');connectionMenu.hide();nodeActions.hide();openConnectionForm(edge);syncCards();draw();
}
function removeConnection(id,key){
  if(!workspaceController.canEditMap(workspaceController.activeMap())||!allowLeave())return;
  relations=relations.filter(edge=>edge.id!==id);activeRelation=null;
  // The single leave check above accepted discarding the current draft. Reload
  // it before capture and before opening any remaining meaning for this pair.
  const panelOpen=!$('inspector').hidden;loadInspector();$('inspector').hidden=!panelOpen;
  syncCards();draw();const remaining=connectionMeanings(key);if(remaining.length)inspectConnection(key,remaining);else closeConnection(key);
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
    const edit=document.createElement('button');edit.textContent='Edit';edit.type='button';edit.addEventListener('click',()=>editConnection(edge.id));
    const remove=document.createElement('button');remove.textContent='Remove';remove.type='button';remove.className='delete-connection';remove.setAttribute('aria-label',`Remove connection: ${relationSentence(edge)}`);remove.addEventListener('click',()=>removeConnection(edge.id,visibleNodePairKey(edge.from,edge.to)));
    actions.append(show);if(workspaceController.canEditMap(workspaceController.activeMap()))actions.append(edit,remove);item.append(actions);$('connection-list').append(item);
  }
}
function openConnectionForm(edge=null){
  if(!workspaceController.canEditMap(workspaceController.activeMap())||(!edge&&nodeById(selected)?.parent===null))return;
  if(connectionDirty&&!confirm('Discard the unsaved connection changes?'))return;connectionDirty=false;
  editingRelation=edge?.id||null;$('connection-form').hidden=false;$('connection-direction').value=edge?.to===selected?'in':'out';$('connection-target').replaceChildren(option('','Choose a node…'));
  for(const root of roots){const group=document.createElement('optgroup');group.label=nodeById(root).title;for(const n of nodes)if(n.id!==selected&&(n.parent!==null||edge?.from===n.id||edge?.to===n.id)&&frameOf(nodes,n.id)===root)group.append(option(n.id,n.title));$('connection-target').append(group);}
  $('connection-target').value=edge?(edge.from===selected?edge.to:edge.from):'';$('connection-note-input').value=edge?.note||'';$('connection-submit').textContent=edge?'Save connection':'Add connection';$('connection-error').textContent='';refreshConnectionTypes(edge?.type);$('connection-target').focus();
}
function connectionEnds(){const other=$('connection-target').value;return $('connection-direction').value==='out'?{from:selected,to:other}:{from:other,to:selected};}
function refreshConnectionTypes(preferred=null){
  const {from,to}=connectionEnds(),types=allowedRelationTypes(nodes,from,to),previous=preferred||$('connection-type').value;
  // Keep an older saved connection editable without offering its old type for new links.
  if(preferred&&RELATION_TYPES[preferred]&&!types.includes(preferred))types.push(preferred);
  $('connection-type').replaceChildren();for(const type of types)$('connection-type').append(option(type,RELATION_TYPES[type].label));
  if(types.includes(previous))$('connection-type').value=previous;
  $('connection-type').disabled=!types.length;$('connection-submit').disabled=!types.length;
  $('connection-hint').textContent=!from||!to?'Choose the other node first.':!types.length?'This pairing uses the other direction. Try changing “From this node” to “To this node,” or vice versa.':frameOf(nodes,from)===frameOf(nodes,to)?'A connection within this frame.':'A connection between frames.';
  $('connection-error').textContent='';
}
function addChild(){
  if(!selected||!workspaceController.canEditMap(workspaceController.activeMap())||!allowLeave())return;
  const parent=selected,panelOpen=!$('inspector').hidden,mode=inspectorMode;
  const {node}=createChildStatement(nodes,parent,newId('node'));node.title='New child node';
  faceEditor.hide();childDraft={parent,panelOpen,mode,node,camera:{...camera},parentPosition:positions.get(parent)};dirty=false;connectionDirty=false;selected=node.id;expanded.add(parent);
  setInspectorMode('child');$('child-form').reset();childConfidenceScale.sync();$('child-form').querySelector('details').open=false;$('child-error').textContent='';$('child-parent').textContent=`Parent: ${nodeById(parent).title}`;$('child-relationship-group').hidden=nodeById(parent).parent===null;
  update({anchor:parent,instant:true});showNodeFace($('child-form'),true);
}
function discardChild(){
  if(!childDraft)return;const {parent,panelOpen,mode,camera:previousCamera,parentPosition}=childDraft;faceEditor.hide();childDraft=null;selected=parent;
  loadInspector(mode==='inspect'?'inspect':'edit');$('inspector').hidden=!panelOpen;update({instant:true});settle();positions=result.positions;camera=previousCamera;
  const p=positions.get(parent);if(p&&parentPosition){camera.x+=(parentPosition.x-p.x)*camera.z;camera.y+=(parentPosition.y-p.y)*camera.z;}draw();
}
function cancelChild(){if(!childDraft)return;discardChild();nodeActions.show(nodeById(selected));draw();elements.get(selected)?.main.focus({preventScroll:true});workspaceController.status();}
$('cancel-child').onclick=cancelChild;
$('child-form').addEventListener('input',()=>{if(childDraft){childDraft.node.title=$('child-title').value.trim()||'New child node';childDraft.node.summary=$('child-summary').value.trim();} $('child-error').textContent='';workspaceController.status();});
$('child-form').addEventListener('submit',event=>{
  event.preventDefault();if(!childDraft||!workspaceController.canEditMap(workspaceController.activeMap()))return;
  try{
    const parent=childDraft.parent,title=$('child-title').value.trim();if(!title)throw Error('Enter a title.');
    const asReason=$('child-relationship').value==='reason'&&nodeById(parent)?.parent!==null;
    const {node,relation}=createChildStatement(nodes,parent,childDraft.node.id,{reasonId:asReason?newId('relation'):null});
    Object.assign(node,{title,summary:$('child-summary').value.trim(),details:$('child-details').value.trim(),sourceTitle:$('child-source-title').value.trim(),sourceUrl:$('child-source-url').value.trim(),confidence:$('child-confidence').value===''?null:Number($('child-confidence').value)});
    const nextNodes=[...nodes,node],nextRelations=relation?[...relations,relation]:relations;validateGraph(nextNodes,roots,nextRelations);
    faceEditor.hide();nodes=nextNodes;relations=nextRelations;childDraft=null;dirty=false;expanded.add(parent);selected=node.id;nodeActions.hide();update({instant:true});loadInspector('edit');showNodeFace($('edit-form'));$('saved').textContent='Node added.';workspaceController.status();
  }catch(error){$('child-error').textContent=error.message;}
});
$('close').addEventListener('click',()=>closeInspector());
$('inspect-cosigns').addEventListener('click',()=>{if(selected)workspaceController.exploreNode(workspaceController.activeMapId,selected);});
$('edit-form').addEventListener('input',()=>{dirty=true;$('saved').textContent='Unsaved changes';$('saved').classList.remove('error');});
$('edit-form').addEventListener('change',()=>{dirty=true;$('saved').textContent='Unsaved changes';});
$('kind').addEventListener('change',refreshKindFields);
$('edit-form').addEventListener('submit',event=>{
  event.preventDefault();if(!selected)return;if(connectionDirty&&!confirm('Discard the unsaved connection changes and save this node?'))return;const n=nodeById(selected),title=n.parent===null?n.title:$('title').value.trim();
  try{
    if(!title)throw Error('Enter a title.');
    const next={...n,title,summary:$('summary').value.trim(),details:$('details').value.trim(),sourceTitle:$('source-title').value.trim(),sourceUrl:$('source-url').value.trim(),confidence:$('confidence').value===''?null:Number($('confidence').value)};
    const candidate=nodes.map(node=>node.id===selected?next:node);validateGraph(candidate,roots,relations);nodes=candidate;dirty=false;if(!faceEditor.nodeId){const panelOpen=!$('inspector').hidden;loadInspector();$('inspector').hidden=!panelOpen;}else{renderNodeReading(next);$('source-link').hidden=!next.sourceUrl;if(next.sourceUrl)$('source-link').href=next.sourceUrl;}syncCards();draw();$('saved').textContent=workspaceController.accountMode?'Node updated.':'Node updated. Save the workspace to keep changes.';
  }catch(error){$('saved').textContent=error.message;$('saved').classList.add('error');}
});
$('add-child').addEventListener('click',()=>addChild());
$('node-definitions').onclick=()=>{if(selected)workspaceController.library.definitions.choose({type:'node',mapId:workspaceController.activeMapId,nodeId:selected});};
$('connect').addEventListener('click',()=>openConnectionForm());$('cancel-connect').addEventListener('click',()=>{if(connectionDirty&&!confirm('Discard the unsaved connection changes?'))return;connectionDirty=false;$('connection-form').hidden=true;editingRelation=null;});
$('connection-form').addEventListener('input',()=>{connectionDirty=true;});$('connection-form').addEventListener('change',()=>{connectionDirty=true;});
$('connection-direction').addEventListener('change',()=>refreshConnectionTypes());$('connection-target').addEventListener('change',()=>refreshConnectionTypes());
$('connection-form').addEventListener('submit',event=>{
  event.preventDefault();const edge={id:editingRelation||newId('relation'),...connectionEnds(),type:$('connection-type').value,note:$('connection-note-input').value.trim()};
  try{validateRelationship(nodes,relations,edge,editingRelation);relations=editingRelation?relations.map(e=>e.id===editingRelation?edge:e):[...relations,edge];activeRelation=edge.id;connectionDirty=false;$('connection-form').hidden=true;editingRelation=null;syncCards();draw();}
  catch(error){$('connection-error').textContent=error.message;}
});
$('relation-view').addEventListener('change',()=>{connectionMenu.hide();activeConnectionKey=null;syncCards();draw();});
$('remove').addEventListener('click',()=>{if(!selected||roots.includes(selected))return;const id=selected,branch=removeBranch(nodes,relations,id),parent=nodeById(id).parent;if(!confirm(`Delete “${nodeById(id).title}”${branch.removed.size>1?` and its ${branch.removed.size-1} descendant nodes`:''}? Connections to these nodes will also be removed.`))return;faceEditor.hide();nodes=branch.nodes;relations=branch.relations;for(const key of branch.removed)expanded.delete(key);selected=null;dirty=false;connectionDirty=false;activeRelation=null;activeConnectionKey=null;nodeActions.hide();connectionMenu.hide();$('inspector').hidden=true;$('connection-form').hidden=true;editingRelation=null;update({anchor:parent});elements.get(parent)?.main.focus({preventScroll:true});});
$('next').addEventListener('click',()=>{const visible=[...result.positions.keys()];for(const id of visible)if(result.children.get(id).length)expanded.add(id);update({fit:true});});
$('all').addEventListener('click',()=>{expanded=new Set(nodes.filter(n=>result.children.get(n.id).length).map(n=>n.id));update({fit:true});});
$('collapse').addEventListener('click',()=>{if(!allowLeave())return;expanded.clear();closeInspector(true);update({fit:true});});
$('reset').addEventListener('click',()=>{if(!confirm('Reset to the illustrative map? This will discard your edits.'))return;faceEditor.hide();nodes=exampleMap();relations=exampleRelations();expanded.clear();selected=null;dirty=false;connectionDirty=false;childDraft=null;activeRelation=null;editingRelation=null;activeConnectionKey=null;connectionMenu.hide();nodeActions.hide();$('inspector').hidden=true;$('child-form').hidden=true;$('connection-form').hidden=true;$('relation-view').value='all';update({fit:true});});
$('fit').addEventListener('click',()=>transition(result.positions,fitCamera()));
function zoom(factor,x=viewport.clientWidth/2,y=viewport.clientHeight/2,absolute=false){settle();const z=Math.min(2,Math.max(.02,absolute?factor:camera.z*factor)),ratio=z/camera.z;camera={x:x-(x-camera.x)*ratio,y:y-(y-camera.y)*ratio,z};positions=result.positions;draw();}
$('plus').addEventListener('click',()=>zoom(1.2));$('minus').addEventListener('click',()=>zoom(1/1.2));$('zoom').addEventListener('click',()=>zoom(1,viewport.clientWidth/2,viewport.clientHeight/2,true));
viewport.addEventListener('wheel',event=>{if(event.target.closest('.viewport-controls,.node-face-editor'))return;event.preventDefault();const rect=viewport.getBoundingClientRect();zoom(Math.exp(-event.deltaY*.0015),event.clientX-rect.left,event.clientY-rect.top);},{passive:false});
const pointers=new Map();let drag=null,pinch=null;
viewport.addEventListener('pointerdown',event=>{if(event.target.closest('button,.node,.node-face-editor')||event.button>0)return;settle();positions=result.positions;draw();viewport.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===1)drag={x:event.clientX,y:event.clientY,cx:camera.x,cy:camera.y};if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),z:camera.z};drag=null;}viewport.classList.add('panning');});
viewport.addEventListener('pointermove',event=>{if(!pointers.has(event.pointerId))return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===2&&pinch){const [a,b]=[...pointers.values()],rect=viewport.getBoundingClientRect();zoom(pinch.z*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance),(a.x+b.x)/2-rect.left,(a.y+b.y)/2-rect.top,true);}else if(drag){camera.x=drag.cx+event.clientX-drag.x;camera.y=drag.cy+event.clientY-drag.y;draw();}});
function endPointer(event){pointers.delete(event.pointerId);pinch=null;drag=null;if(pointers.size===1){const p=[...pointers.values()][0];drag={x:p.x,y:p.y,cx:camera.x,cy:camera.y};}if(!pointers.size)viewport.classList.remove('panning');}
viewport.addEventListener('pointerup',endPointer);viewport.addEventListener('pointercancel',endPointer);
viewport.addEventListener('keydown',event=>{if(event.target!==viewport)return;const steps={ArrowLeft:[60,0],ArrowRight:[-60,0],ArrowUp:[0,60],ArrowDown:[0,-60]};if(steps[event.key]){event.preventDefault();settle();positions=result.positions;camera.x+=steps[event.key][0];camera.y+=steps[event.key][1];draw();}else if(event.key==='+'||event.key==='=')zoom(1.2);else if(event.key==='-')zoom(1/1.2);else if(event.key.toLowerCase()==='f')transition(result.positions,fitCamera());});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeInspector();});
let oldWidth=viewport.clientWidth,oldHeight=viewport.clientHeight;
new ResizeObserver(()=>{const w=viewport.clientWidth,h=viewport.clientHeight;if(result&&(w!==oldWidth||h!==oldHeight)){settle();positions=result.positions;if(!oldWidth||!oldHeight)camera=fitCamera();else{camera.x+=(w-oldWidth)/2;camera.y+=(h-oldHeight)/2;}draw();}oldWidth=w;oldHeight=h;}).observe(viewport);
const confidenceScale=attachConfidenceScale($('confidence')),childConfidenceScale=attachConfidenceScale($('child-confidence'));
const faceEditor=new NodeFaceEditor(viewport,{
  done:()=>{if(!workspaceController.editor.flushDraft()){faceEditor.form?.reportValidity();return;}closeInspector(true);},
  cancel:()=>closeInspector()
});
const workspaceController=new WorkspaceController({
  getMapData:()=>({nodes,relations}),beforeLeave:allowLeave,hasDraft:()=>dirty||connectionDirty||!!childDraft,hasChildDraft:()=>!!childDraft,
  discardDraft:()=>closeInspector(true),
  updateConfidence:(id,value)=>{const n=nodeById(id);if(!n)return;n.confidence=value;if(selected===id){$('confidence').value=value===null?'':String(value);confidenceScale.sync();}syncCards();draw();},
  flushDraft:()=>{if(childDraft){workspaceController.message('Finish or cancel the child node before saving or downloading the workspace.');$('child-title').focus();return false;}if(connectionDirty)$('connection-form').requestSubmit();if(connectionDirty)return false;if(dirty)$('edit-form').requestSubmit();return !dirty;},
  setMap:map=>{faceEditor.hide();nodeActions.hide();connectionMenu.hide();activeConnectionKey=null;mapRoute.clear();sourceRoutes.clear();selected=null;dirty=false;connectionDirty=false;childDraft=null;activeRelation=null;editingRelation=null;$('inspector').hidden=true;$('connection-form').hidden=true;$('child-form').hidden=true;nodes=map.nodes;relations=map.relations;expanded=new Set();positions=new Map();update({fit:true,instant:true});},
  focusNode:id=>{expanded=revealPath(nodes,id,expanded);selected=id;update({instant:true});loadInspector('edit');showNodeFace($('edit-form'));}
});
const connectionMenu=new MapConnectionsUI(viewport,{
  close:closeConnection,edit:editConnection,remove:removeConnection,
  reveal:(from,to)=>{if(!allowLeave())return;expanded=revealPath(nodes,to,revealPath(nodes,from,expanded));update({instant:true});requestAnimationFrame(()=>{const a=positions.get(from),b=positions.get(to);if(a&&b){camera.x=viewport.clientWidth/2-((a.x+b.x+CARD_W)/2)*camera.z;camera.y=viewport.clientHeight/2-((a.y+b.y+CARD_H)/2)*camera.z;draw();}});}
});
const nodeActions=new NodeActions(viewport,{
  canEdit:()=>workspaceController.canEditMap(workspaceController.activeMap()),
  canSetConfidence:()=>workspaceController.canEditMap(workspaceController.activeMap()),confidence:showConfidence,
  draftConfidence:(value,valid)=>{$('confidence').value=value;$('confidence').setCustomValidity(valid?'':'Enter a confidence from 0 to 100.');confidenceScale.sync();dirty=true;$('saved').textContent='Unsaved confidence';},
  cancelConfidence:()=>{const n=nodeById(selected);$('confidence').value=n.confidence===null?'':String(n.confidence);$('confidence').setCustomValidity('');confidenceScale.sync();dirty=[['title','title'],['summary','summary'],['details','details'],['kind','kind'],['source-title','sourceTitle'],['source-url','sourceUrl'],['time-scope','timeScope'],['structural-type','structuralType']].some(([id,key])=>$(id).value.trim()!==(n[key]||''));$('saved').textContent=dirty?'Unsaved changes':'';},
  saveConfidence:value=>{$('confidence').value=value===null?'':String(value);$('confidence').setCustomValidity('');confidenceScale.sync();dirty=true;$('edit-form').requestSubmit();if(dirty)throw Error('Resolve the node fields before saving confidence.');},
  focusConfidence:()=>elements.get(selected)?.confidence.querySelector('button')?.focus({preventScroll:true}),
  addChild,edit:()=>openNodeInspector('edit'),inspect:()=>openNodeInspector('inspect'),remove:()=>{$('remove').click();},
  contributions:id=>workspaceController.library.openSource(workspaceController.activeMapId,id),
  canArgue:id=>{const p=workspaceController.workspace.comparisons.find(p=>p.id===workspaceController.editingRecord);return !!p&&['a','b'].some(s=>p[`${s}MapId`]===workspaceController.activeMapId&&p[`${s}NodeId`]===id);},
  argue:()=>workspaceController.argument.open(),focusNode:()=>elements.get(selected)?.main.focus()
});
workspaceController.library.definitions.dialog.addEventListener('close',()=>{if(selected&&!childDraft)renderNodeReading(nodeById(selected));});
update({fit:true,instant:true});
workspaceController.initialize();
