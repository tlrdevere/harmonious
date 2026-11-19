import {outlineMap,outlineConnections} from './outline-projection.mjs';
import {topicNodeKey} from './topic-focus-ui.mjs';
import {confidenceBadge} from './confidence-ui.mjs';
import {temporalRoots} from './temporal-frames.mjs';

const mapOutlineEl=(tag,text='',className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
const mapOutlineButton=(text,action)=>{const b=mapOutlineEl('button',text);b.type='button';b.onclick=action;return b;};

// This is a presentation of the existing map. All commands go back to its controller.
export class MapOutlineUI{
 constructor(c,host,kind='map'){
  this.c=c;this.host=host;this.kind=kind;this.sessions=new Map();
  this.toolbar=mapOutlineEl('div','','outline-toolbar');this.search=mapOutlineEl('input');this.search.type='search';this.search.placeholder='Find a node';this.search.setAttribute('aria-label','Find a node in this outline');
  this.search.oninput=()=>{this.state.query=this.search.value;this.state.limit=120;this.render(true);};
  this.toolbar.append(this.search,mapOutlineButton('Expand all',()=>{for(const row of this.projection.rows)this.state.expanded.add(row.id);this.render(true);}),mapOutlineButton('Collapse all',()=>{this.state.expanded=new Set(this.projection.rows.filter(r=>r.node.parent===null).map(r=>r.id));this.render(true);}));
  if(kind!=='map')this.toolbar.append(mapOutlineButton('Focus selection',()=>this.topicFocus()?.open()));
  this.status=mapOutlineEl('p','','field-help');this.status.setAttribute('role','status');this.list=mapOutlineEl('div','','outline-list');this.detailHost=mapOutlineEl('section','','outline-detail');this.detailHost.id='outline-'+kind+'-detail';this.detailHost.setAttribute('aria-label','Selected node details');
  host.append(this.toolbar,this.status,this.list,this.detailHost);
 }
 current(){const p=this.c.participation;return this.kind==='map'?(this.c.editor.outlineState().map||this.c.activeMap()):this.kind==='source'?p.source():p.pod?.map;}
 selection(){return this.kind==='map'?this.c.editor.outlineState().selected:this.kind==='source'?this.c.participation.nodeId:this.c.participation.podNodeId;}
 topicFocus(){return this.kind==='map'?this.c.editor.outlineState().topicFocus:(this.kind==='source'?this.c.participation.canvas:this.c.participation.podCanvas).topicFocus;}
 reset(){this.sessions.clear();this.key=null;this.signature=null;this.projection=null;this.lastSelected=null;this.search.value='';this.list.replaceChildren();this.status.textContent='';}
 open(id,action='select',timeScope){
  const map=this.current(),node=map?.nodes.find(n=>n.id===id);
  if(!node||this.kind!=='pod'&&!this.c.presentation.showFrameForNode(node,map))return;
  if(this.kind==='map')this.c.editor.outlineAction(id,action,timeScope);
  else if(this.kind==='source'){if(!this.c.library.openSource(map.id,id))return;}
  else{const p=this.c.participation;p.podNodeId=id;p.podCanvas.pick('a',id);p.renderPodDetail();}
  this.render();this.c.presentation?.mountPanels();
  const active=document.activeElement;if(!this.detailHost.contains(active)||!active.getClientRects().length){const controls=[...this.detailHost.querySelectorAll('input:not([disabled]),textarea:not([disabled]),select:not([disabled]),button:not([disabled])')].filter(el=>el.getClientRects().length),detail=controls.find(el=>el.matches('input,textarea,select'))||controls[0];detail?.focus({preventScroll:true});}this.detailHost.scrollIntoView({block:'nearest'});
 }
 render(force=false){
  const map=this.current(),selected=this.selection(),topic=this.topicFocus();
  const view=this.kind==='pod'?null:(document.body.dataset.frameView||'main'),timeline=view==='timeline';
  const key=JSON.stringify([this.kind,this.c.account?.actor?.id||'local',map?.id,view]);
  if(this.key!==key){this.key=key;this.state=this.sessions.get(key)||{expanded:new Set(temporalRoots(view,[map])),query:'',branch:null,limit:120};this.sessions.set(key,this.state);this.search.value=this.state.query;this.signature=null;this.lastSelected=null;}
  const signature=JSON.stringify([map,this.c.workspace.participants,this.c.workspace.facilitationHistory,selected,topic?.active,[...topic?.members||[]],this.state.query,this.state.branch,[...this.state.expanded],this.state.limit]);
  if(!force&&signature===this.signature)return;this.signature=signature;
  const active=document.activeElement,focusId=active?.closest('[data-outline-node]')?.dataset.outlineNode,focusLabel=active?.textContent,focusAction=active?.dataset.outlineAction;
  const projection=this.projection=outlineMap(map,{view});this.list.replaceChildren();
  if(!projection.available){this.status.textContent='This map is unavailable.';this.detailHost.hidden=true;return;}this.detailHost.hidden=false;
  const rows=projection.rows,byId=projection.byId,chosen=byId.get(selected),query=this.state.query.trim().toLocaleLowerCase();
  if(selected!==this.lastSelected){let parent=byId.get(chosen?.parentId);while(parent){this.state.expanded.add(parent.id);parent=byId.get(parent.parentId);}this.lastSelected=selected;}
  if(this.state.branch&&!byId.has(this.state.branch))this.state.branch=null;
  // Each row keeps a short parent context. Full ancestry for every visible row
  // would grow quadratically on a long branch, even with limited indentation.
  const originals=new Map(map.nodes.map(n=>[n.id,n]));
  const breadcrumb=row=>{const parts=[];let parent=originals.get(row.node.parent);for(let i=0;parent&&i<2;i++){parts.unshift(parent.title);parent=originals.get(parent.parent);}if(parent)parts.unshift((originals.get(row.sourceFrameId)?.title||row.sourceFrameId)+' / …');return parts.join(' / ');};
  if(this.state.branch){const branch=byId.get(this.state.branch);this.list.append(mapOutlineButton('Back to all frames',()=>{this.state.branch=null;this.render(true);}),mapOutlineEl('p',[breadcrumb(branch),branch.node.title].filter(Boolean).join(' / '),'outline-breadcrumb'));}
  const matches=row=>!query||[row.node.title,row.node.summary,row.node.details].some(t=>(t||'').toLocaleLowerCase().includes(query));
  // Pre-order rows let visibility follow the parent in one pass. A selected
  // node remains reachable even after changing focus, search or branch scope.
  const inBranch=new Set(),expandedPath=new Set();
  const visible=rows.filter(row=>{
   const branchMember=!this.state.branch||row.id===this.state.branch||inBranch.has(row.parentId);if(branchMember)inBranch.add(row.id);
   const pathOpen=row.node.parent===null||row.id===this.state.branch||expandedPath.has(row.parentId)&&this.state.expanded.has(row.parentId);if(pathOpen)expandedPath.add(row.id);
   if(row.node.temporalHeading)return false;
   if(row.id===selected)return true;
   if(!branchMember)return false;
   if(topic?.active&&!topic.members.has(topicNodeKey(map.id,row.id))&&row.node.parent!==null&&row.id!==selected)return false;
   if(query)return matches(row);
   return pathOpen;
  });
  this.status.textContent=`${visible.length} nodes in this outline${query?' matching your search':''}${topic?.active?' · Other topic branches are excluded by focus.':''}`;
  if(topic?.active)this.list.append(mapOutlineButton('Clear focus',()=>{topic.set([]);this.render(true);}));
  if(chosen&&query&&!matches(chosen))this.list.append(mapOutlineButton('Show selected node (clear search)',()=>{this.search.value=this.state.query='';this.render(true);}));
  if(chosen&&this.state.branch&&!inBranch.has(selected))this.list.append(mapOutlineButton('Show selected node in all frames',()=>{this.state.branch=null;this.render(true);}));
  const limit=this.state.limit,shown=visible.slice(0,limit);
  if(chosen&&!shown.some(row=>row.id===selected)){this.list.append(mapOutlineEl('p','Your selected node is shown first; other nodes continue below.','field-help'));shown.unshift(chosen);}
  const sections=new Map(),canEdit=this.kind==='map'&&this.c.canEditMap(map);
  if(timeline)for(const frame of projection.frames){
   const section=mapOutlineEl('section','','outline-frame'),heading=projection.byId.get(frame.id).node;
   section.dataset.frame=frame.id;section.append(mapOutlineEl('h2',frame.title));
   if(heading.temporalHeading&&canEdit)section.append(mapOutlineButton('Add node to '+frame.title,()=>this.open('status','add',heading.timeScope)));
   if(heading.temporalHeading&&frame.rows.length===1)section.append(mapOutlineEl('p','No nodes in this period.','field-help'));
   this.list.append(section);sections.set(frame.id,section);
  }
  for(const row of shown){
   const n=row.node,card=mapOutlineEl('article','','outline-card outline-node');card.dataset.outlineNode=n.id;card.dataset.nodeId=n.id;card.dataset.mapId=map.id;card.dataset.frame=row.frameId;card.classList.toggle('selected',n.id===selected);card.classList.toggle('outline-context',!!n.podContext);card.style.setProperty('--outline-depth',Math.min(2,row.depth));
   card.append(mapOutlineEl(n.parent===null?'h2':'h3',n.title));
   if(row.parentId!==null)card.append(mapOutlineEl('p',breadcrumb(row),'outline-breadcrumb'));
   if(n.summary)card.append(mapOutlineEl('p',n.summary,'outline-wording'));
   if(n.details||n.sourceTitle||n.sourceUrl){const details=mapOutlineEl('details');details.append(mapOutlineEl('summary','Full context and source'));if(n.details)details.append(mapOutlineEl('p',n.details,'outline-wording'));if(n.sourceTitle)details.append(mapOutlineEl('p',n.sourceTitle));if(n.sourceUrl){try{const url=new URL(n.sourceUrl);if(['http:','https:'].includes(url.protocol)){const link=mapOutlineEl('a','Open source');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';details.append(link);}}catch{}}card.append(details);}
   const owner=this.c.library.name(map);card.append(mapOutlineEl('small',n.podContext?'Context only · Does not meet this threshold':owner));
   const badge=confidenceBadge(n,owner,this.kind==='map'&&this.c.canEditMap(map)?()=>this.open(n.id,'confidence'):null);if(badge)card.append(badge);
   const actions=mapOutlineEl('div','','outline-actions');actions.append(mapOutlineButton('Open node',()=>this.open(n.id)));
   if(canEdit){
    actions.append(mapOutlineButton(n.parent===null?'Edit frame details':'Edit',()=>this.open(n.id,'edit')),mapOutlineButton('Add child node',()=>this.open(n.id,'add')));
    if(n.parent!==null&&!this.c.account?.facilitator?.context)actions.append(mapOutlineButton('Insert node above',()=>this.open(n.id,'insert')));
   }
   if(row.children.length){const expanded=this.state.expanded.has(n.id),toggle=mapOutlineButton(`${expanded?'Collapse':'Expand'} children (${row.children.length})`,()=>{expanded?this.state.expanded.delete(n.id):this.state.expanded.add(n.id);this.render(true);});toggle.dataset.outlineAction='children';toggle.setAttribute('aria-expanded',String(expanded));actions.append(toggle,mapOutlineButton('Open this branch',()=>{this.state.branch=n.id;this.state.expanded.add(n.id);this.render(true);}));}
   card.append(actions);(sections.get(row.frameId)||this.list).append(card);
  }
  if(visible.length>limit)this.list.append(mapOutlineButton(`Show more nodes (${visible.length-limit} remaining)`,()=>{this.state.limit=limit+120;this.render(true);}));
  if(!visible.length)this.list.append(mapOutlineEl('p','No nodes match this selection.'));
  if(query&&view){
   const branchScope=new Set(),hidden=[];
   for(const row of projection.sourceRows.values()){
    if(this.state.branch&&row.id!==this.state.branch&&!branchScope.has(row.parentId))continue;
    if(this.state.branch)branchScope.add(row.id);
    if(!byId.has(row.id)&&matches(row)&&(!topic?.active||topic.members.has(row.key)))hidden.push(row);
   }
   if(hidden.length){
    const other=mapOutlineEl('section','','outline-frame');other.append(mapOutlineEl('h3','Matches in the other frame view'));
    for(const row of hidden.slice(0,limit))other.append(mapOutlineButton('Open '+row.node.title,()=>this.open(row.id)));
    if(hidden.length>limit)other.append(mapOutlineButton('Show more matches',()=>{this.state.limit+=120;this.render(true);}));
    this.list.append(other);
   }
  }
  if(this.kind!=='map')this.renderConnections(map);
  if(focusId){const card=[...this.list.querySelectorAll('[data-outline-node]')].find(e=>e.dataset.outlineNode===focusId);[...card?.querySelectorAll('button')||[]].find(b=>focusAction?b.dataset.outlineAction===focusAction:b.textContent===focusLabel)?.focus({preventScroll:true});}
 }
 renderConnections(map){
  const visible=this.projection.byId;
  const connections=outlineConnections(map).filter(c=>visible.has(c.from.id)||visible.has(c.to.id));if(!connections.length)return;
  const details=mapOutlineEl('details','','outline-source-connections'),body=mapOutlineEl('div');details.open=!!this.state.connectionsOpen;details.append(mapOutlineEl('summary',`Source connections (${connections.length})`),body);this.list.append(details);
  const endpoint=row=>mapOutlineButton(row.node.title+(visible.has(row.id)?'':' · Open in other frame view'),()=>this.open(row.id));
  const render=()=>{body.replaceChildren();const limit=this.state.connectionLimit||80;for(const connection of connections.slice(0,limit)){const item=mapOutlineEl('article','','outline-connection');item.dataset.edgeId=connection.id;item.append(mapOutlineEl('p',connection.structural?'Parent structure':'Source relationship','eyebrow'),endpoint(connection.from),mapOutlineEl('span',connection.structural?(connection.forward||'contains'):connection.label),endpoint(connection.to),mapOutlineEl('p',connection.directed?'Direction: first node to second node':'Undirected relationship','field-help'));if(connection.edge.note)item.append(mapOutlineEl('p',connection.edge.note,'outline-wording'));body.append(item);}if(connections.length>limit)body.append(mapOutlineButton(`Show more connections (${connections.length-limit} remaining)`,()=>{this.state.connectionLimit=limit+80;render();}));};
  details.addEventListener('toggle',()=>{this.state.connectionsOpen=details.open;if(details.open&&!body.childElementCount)render();});if(details.open)render();
 }
}
