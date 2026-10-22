import {outlineComparison,outlineConnections,outlineDialogue} from './outline-projection.mjs';
import {counterpartRecords,counterpartState} from './counterparts.mjs';
import {counterpartDisplay,nodeAssessment,interactionPresentation,conversationThreads} from './interaction-presentation.mjs';
import {conversationAnchor} from './conversation-tree.mjs';
import {dialogueRecords,dialogueTree} from './argument-dialogue.mjs';
import {interactionOptions,canReplyArgument,interactionSource} from './interaction-grammar.mjs';
import {topicNodeKey} from './topic-focus-ui.mjs';

const coEl=(tag,text='',className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
const coButton=(label,run,className='')=>{const b=coEl('button',label,className);b.type='button';b.onclick=run;return b;};
const coFrameNames={status:'Status Quo',action:'Transformative Action',goal:'Goal State'};
const coTargetKey=target=>target?JSON.stringify(target):'';
const coText=node=>[node.title,node.summary,node.details,node.sourceTitle].filter(Boolean).join(' ').toLocaleLowerCase();

// The outline owns only reading and navigation. All contributions use the same
// DiscussionUI host, eligibility checks and commands as the canvas.
export class ComparisonOutlineUI{
 constructor(c,host){
  this.c=c;this.d=c.discussion;this.host=host;this.frame='all';this.topic='';this.query='';this.limit=60;this.signature='';this.connectionsOpen=false;
  host.classList.add('comparison-outline');
  this.header=coEl('header','','outline-comparison-heading');this.heading=coEl('h2','Comparison outline');this.header.append(this.heading);
  this.filters=coEl('div','','outline-comparison-filters');
  this.search=coEl('input');this.search.type='search';this.search.id='outline-comparison-search';this.search.placeholder='Find wording or a person';
  this.frameSelect=coEl('select');this.frameSelect.id='outline-comparison-frame';this.frameSelect.append(new Option('All frames','all'));for(const [value,label]of Object.entries(coFrameNames))this.frameSelect.append(new Option(label,value));
  this.topicSelect=coEl('select');this.topicSelect.id='outline-comparison-topic';this.topicSelect.append(new Option('All topics',''));
  for(const [control,label]of [[this.search,'Search this outline'],[this.frameSelect,'Frame'],[this.topicSelect,'Topic']]){const field=coEl('label',label);field.htmlFor=control.id;field.append(control);this.filters.append(field);}
  this.search.oninput=()=>{this.query=this.search.value;this.limit=60;this.render();};this.frameSelect.onchange=()=>{this.frame=this.frameSelect.value;this.limit=60;this.render();};this.topicSelect.onchange=()=>{this.topic=this.topicSelect.value;this.limit=60;this.render();};
  this.notice=coEl('div','','outline-comparison-notice');this.notice.setAttribute('role','status');
  this.listHost=coEl('div','','comparison-outline-list');this.listHost.setAttribute('aria-label','Nodes and counterparts');
  this.detailHost=coEl('section','','comparison-outline-detail');this.detailHost.setAttribute('aria-label','Selected item and conversation');
  this.connectionsHost=coEl('section','','outline-source-connections');
  host.append(this.header,this.filters,this.notice,this.detailHost,this.listHost,this.connectionsHost);
 }
 async run(action,{detail=true}={}){
  this.forcedTarget=null;await action();this.render();if(detail)this.showDetail();
 }
 reset(){
  this.frame='all';this.topic='';this.query='';this.limit=60;this.signature='';this.topicSignature='';this.forcedTarget=null;this.connectionsOpen=false;this.projection=null;
  this.search.value='';this.frameSelect.value='all';this.topicSelect.replaceChildren(new Option('All topics',''));this.listHost.replaceChildren();this.notice.replaceChildren();this.connectionsHost.replaceChildren();
 }
 showDetail(){
  if(this.d.host.hidden)return;
  const current=document.activeElement;
  this.d.host.scrollIntoView({block:'nearest'});
  if(!this.d.host.contains(current))this.d.host.querySelector('header button')?.focus({preventScroll:true});
 }
 selectedTargets(){
  const d=this.d,record=d.viewId&&this.c.workspace.discussions.find(r=>r.id===d.viewId),target=record?conversationAnchor(this.c.workspace.discussions,record):d.target;
  if(target?.type==='entry'){const pair=this.c.workspace.discussions.find(r=>r.id===target.entryId);return [pair?.target,pair?.other].filter(t=>t?.type==='node');}
  return target?.type==='node'?[target]:[];
 }
 reveal(target=this.d.target){
  this.forcedTarget=target;this.render();const node=target?.type==='node'&&[...this.listHost.querySelectorAll('[data-node-id]')].find(el=>el.dataset.mapId===target.mapId&&el.dataset.nodeId===target.nodeId),entry=target?.type==='entry'&&[...this.listHost.querySelectorAll('[data-entry-id]')].find(el=>el.dataset.entryId===target.entryId);
  (node||entry)?.scrollIntoView({block:'nearest'});
 }
 render(){
  const d=this.d,ws=this.c.workspace,maps={a:ws.maps.find(m=>m.id===this.c.sides.a.mapId),b:ws.maps.find(m=>m.id===this.c.sides.b.mapId)};
  const focus=d.canvas.topicFocus;
  const signature=JSON.stringify([maps,ws.discussions,ws.participants,d.actor(),d.mode(),d.dialogue?.active,d.dialogue?.target,d.dialogue?.selected,this.frame,this.topic,this.query,this.limit,[...focus?.selection||[]],d.target,d.viewId,this.forcedTarget]);
  if(signature===this.signature)return;this.signature=signature;
  const oldFocus=document.activeElement,control=oldFocus?.closest('[data-outline-control]')?.dataset.outlineControl,scroll=this.host.scrollTop;
  this.notice.replaceChildren();this.listHost.replaceChildren();this.connectionsHost.replaceChildren();
  this.heading.textContent=d.dialogue?.active?'Argument dialogue':({compare:'Comparison outline',inquiry:'Inquiry outline',argument:'Argument outline'}[d.mode()]||'Comparison outline');
  this.filters.hidden=!!d.dialogue?.active;this.header.querySelectorAll('button').forEach(b=>b.remove());
  if(d.dialogue?.active)this.renderDialogue();else this.renderComparison(maps,focus);
  if(control){const replacement=[...this.listHost.querySelectorAll('[data-outline-control]')].find(el=>el.dataset.outlineControl===control);replacement?.focus({preventScroll:true});}
  this.host.scrollTop=scroll;
 }
 renderComparison(maps,focus){
  const d=this.d,ws=this.c.workspace,thread=d.thread(),links=thread?counterpartRecords(ws,thread.id):[],projection=outlineComparison(maps,links);
  this.projection=projection;
  const topics=[];for(const side of ['a','b'])for(const row of projection.maps[side]?.allRows||[])if(row.depth===1)topics.push({value:topicNodeKey(row.mapId,row.id),label:`${d.name(maps[side].ownerId)} · ${row.node.title}`});
  const topicSignature=JSON.stringify(topics);if(topicSignature!==this.topicSignature){this.topicSignature=topicSignature;this.topicSelect.replaceChildren(new Option('All topics',''),...topics.map(t=>new Option(t.label,t.value)));if(!topics.some(t=>t.value===this.topic))this.topic='';this.topicSelect.value=this.topic;}
  if(!maps.a||!maps.b){this.listHost.append(coEl('p','Choose two maps to view their comparison.','field-help'));return;}
  if(maps.a.unavailable||maps.b.unavailable)this.notice.append(coEl('p','A source map is no longer available. Only accessible material is shown.','review-warning'));
  const selected=[...this.selectedTargets(),this.forcedTarget].filter(t=>t?.type==='node'),isSelected=group=>group.members.some(m=>selected.some(t=>t.mapId===m.mapId&&t.nodeId===m.id));
  const query=this.query.trim().toLocaleLowerCase(),matches=group=>group.members.some(m=>(this.frame==='all'||m.frameId===this.frame)&&(!this.topic||topicNodeKey(m.mapId,m.topicId)===this.topic)&&(!query||`${coText(m.node)} ${d.name(m.map.ownerId).toLocaleLowerCase()}`.includes(query))&&(!focus?.active||focus.members.has(m.key)||focus.frames.has(m.key)));
  const filtered=projection.groups.filter(matches),shown=filtered.slice(0,this.limit),pinned=projection.groups.filter(g=>isSelected(g)&&!shown.includes(g));
  if(focus?.active){const line=coEl('p',`${focus.selection.size} focused topic ${focus.selection.size===1?'branch':'branches'}. Other branches are excluded from this outline. `);line.append(coButton('Clear focus',()=>{focus.set([]);this.render();}));this.notice.append(line);}
  if(pinned.length){const section=coEl('section','','outline-filter-exception');section.append(coEl('h3','Selected outside the current list'));for(const g of pinned)section.append(this.group(g));this.listHost.append(section);}
  const frameOrder=[...Object.keys(coFrameNames),...new Set(shown.map(g=>g.frameId).filter(id=>!coFrameNames[id]))];
  for(const id of frameOrder){const groups=shown.filter(g=>g.frameId===id);if(!groups.length)continue;const section=coEl('section','','outline-frame');section.dataset.frame=id;section.append(coEl('h3',coFrameNames[id]||'Other source material'));for(const group of groups)section.append(this.group(group));this.listHost.append(section);}
  if(!filtered.length)this.listHost.append(coEl('p',projection.groups.length?'No nodes match these filters.':'No accessible nodes are available.','field-help'));
  if(shown.length<filtered.length){const more=coButton(`Show more (${filtered.length-shown.length} remaining)`,()=>{this.limit+=60;this.render();});more.dataset.outlineControl='more';this.listHost.append(more);}
  this.notice.prepend(coEl('p',`${filtered.length} ${filtered.length===1?'item':'items'} · Counterparts are explicitly linked. Each card keeps its own parent path.`,'field-help'));
  this.renderConnections(maps,projection);
 }
 group(group){
  const d=this.d,section=coEl('section','','outline-comparison-group');section.dataset.groupKind=group.kind;section.dataset.groupId=group.id;
  const label=group.kind==='pair'?'Linked counterparts':group.kind==='frame'?'Frame context':group.unavailableCounterpart?'Counterpart unavailable':'Unmatched node';
  const heading=coEl('div','','outline-group-heading');heading.append(coEl('strong',label));
  if(group.kind==='pair'){
   const member=group.members[0],display=counterpartDisplay(this.c.workspace,d.thread()?.id,{type:'node',mapId:member.mapId,nodeId:member.id});
   if(display){const state=coEl('span',display.label,'outline-pair-state');state.dataset.pairAssessment=display.state;heading.append(state);}
   if(group.crossFrame)heading.append(coEl('span','Earlier link across frames','field-help'));
   const history=coEl('details');history.append(coEl('summary','Link details'));for(const r of group.records){const b=coButton(`${r.kind==='correspondence'?'Counterpart link':'Earlier '+(r.action==='agreement'?'agreement':'disagreement')} · ${d.name(r.authorId)}`,()=>this.run(()=>d.open(r.id)));b.dataset.entry=r.id;history.append(b);}heading.append(history);
  }
  section.append(heading);const cards=coEl('div','','outline-pair-cards');for(const member of group.members)cards.append(this.nodeCard(member));section.append(cards);return section;
 }
 nodeCard(member){
  const d=this.d,ws=this.c.workspace,{node,map,mapId,id}=member,target={type:'node',mapId,nodeId:id},card=coEl('article','','outline-node outline-card outline-node-card');card.dataset.mapId=mapId;card.dataset.nodeId=id;card.dataset.identity=member.side==='a'?'one':'two';
  const selected=this.selectedTargets().some(t=>t.mapId===mapId&&t.nodeId===id);card.setAttribute('aria-current',selected?'true':'false');
  card.append(coEl('p',`${d.name(map.ownerId)} · ${map.name}`,'outline-owner'),coEl('h4',node.title),coEl('p',member.ancestors.map(a=>a.title).join(' › ')||'Frame heading','outline-breadcrumb'));
  for(const text of [node.summary,node.details].filter(Boolean))card.append(coEl('p',text,'outline-full-text'));
  if(node.sourceTitle||node.sourceUrl){const source=coEl('p',node.sourceTitle||'Source','field-help');if(node.sourceUrl){const link=coEl('a','Open source');link.href=node.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';source.append(' · ',link);}card.append(source);}
  const actions=coEl('div','','outline-actions'),select=()=>this.run(()=>this.c.selectSource(member.side,id));
  const button=coButton(`Actions for ${node.title}`,select);button.dataset.outlineControl=member.key;actions.append(button);
  if(node.parent!==null){
   const confidence=node.confidence===null||node.confidence===undefined?'Confidence —':`Confidence ${node.confidence}%`;
   if(map.ownerId===d.actor()&&node.kind==='position')actions.append(coButton(confidence,()=>this.run(()=>{if(d.selectTarget(target))d.confidence();}),'outline-confidence'));
   else card.append(coEl('p',confidence,'outline-confidence'));
   const other=['a','b'].map(side=>this.c.workspace.maps.find(m=>m.id===this.c.sides[side].mapId&&!m.unavailable)).find(m=>m&&m.id!==mapId),assessment=other&&nodeAssessment(ws,d.thread()?.id,target,other.ownerId);
   if(assessment){const text=`${d.name(assessment.authorId)}: ${assessment.label}${assessment.needsReview?' · Needs review':''}`,el=assessment.record?coButton(text,()=>this.run(()=>d.open(assessment.record.id)),'outline-assessment'):coEl('p',text,'outline-assessment');el.dataset.assessment=assessment.state;card.append(el);}
   const state=counterpartState(ws,d.thread()?.id,target);if(state.kind!=='linked')card.append(coEl('p',state.label,'outline-counterpart-status'));
   if(d.mode()==='argument'){
    const roots=d.allEntries().filter(r=>r.kind==='interaction'&&r.action==='dispute'&&r.target?.mapId===mapId&&r.target?.nodeId===id),active=roots.filter(r=>r.status==='active'),responses=d.allEntries().filter(r=>r.kind==='interaction'&&r.action==='respond'&&roots.some(root=>root.id===r.target?.entryId));
    card.append(coEl('strong',`${active.length} ${active.length===1?'dispute':'disputes'} · ${responses.length} ${responses.length===1?'response':'responses'}`,'outline-dispute-count'));
    actions.append(coButton('Open dialogue',()=>this.run(()=>d.dialogue.open(target),{detail:false})));
   }else{
    const count=conversationThreads(d.allEntries(),{mode:d.mode()}).filter(r=>coTargetKey(conversationAnchor(ws.discussions,r))===coTargetKey(target)).length;if(count)card.append(coEl('p',`${count} attached ${count===1?'interaction':'interactions'}`,'field-help'));
   }
  }
  card.append(actions);return card;
 }
 renderConnections(maps,projection){
  const d=this.d,box=coEl('details');box.dataset.outlineConnections='true';box.append(coEl('summary','Source connections'));if(d.target?.type==='edge')this.connectionsOpen=true;
  const body=coEl('div');box.append(body);let built=false;
  const build=()=>{
   if(!box.open||built)return;built=true;
   const query=this.query.trim().toLocaleLowerCase(),connections=[];
   for(const side of ['a','b']){
    const map=maps[side];if(!map||map.unavailable)continue;
    for(const connection of outlineConnections(map)){
     const {from,to}=connection;
     const focus=d.canvas.topicFocus,selected=coTargetKey(d.target)===coTargetKey(connection.target),excluded=this.frame!=='all'&&![from.frameId,to.frameId].includes(this.frame)||this.topic&&![from,to].some(row=>topicNodeKey(map.id,row.topicId)===this.topic)||query&&!`${from.node.title} ${to.node.title} ${connection.label} ${connection.edge.note||''}`.toLocaleLowerCase().includes(query)||focus?.active&&![from,to].every(row=>focus.members.has(row.key)||focus.frames.has(row.key));
     if(excluded&&!selected)continue;
     connections.push({connection,map,selected,excluded});
    }
   }
   connections.sort((a,b)=>Number(b.selected)-Number(a.selected));let shown=0;const more=coButton('Show more connections',()=>append());
   const append=()=>{more.remove();for(const {connection,map,selected,excluded}of connections.slice(shown,shown+60)){
    const {from,to}=connection,row=coEl('div','','outline-connection');row.append(coEl('p',`${d.name(map.ownerId)} · ${connection.structural?'Parent structure':'Source relationship'}`,'field-help'));
    const label=`${from.node.title} ${connection.directed?'→':'↔'} ${to.node.title} · ${connection.forward||connection.label}`,button=coButton(label,()=>this.run(()=>d.selectTarget(connection.target)));button.dataset.outlineControl=coTargetKey(connection.target);button.setAttribute('aria-current',selected?'true':'false');row.append(button);if(excluded)row.append(coEl('p','Selected connection outside the current filters','field-help'));if(connection.edge.note)row.append(coEl('p',connection.edge.note,'outline-full-text'));body.append(row);
   }shown+=60;if(shown<connections.length)body.append(more);};
   if(!connections.length)body.append(coEl('p','No connections match these filters.','field-help'));else append();
  };
  box.addEventListener('toggle',()=>{this.connectionsOpen=box.open;build();});box.open=this.connectionsOpen;
  this.connectionsHost.append(box);build();
 }
 renderDialogue(){
  const d=this.d,dialogue=d.dialogue,source=interactionSource(this.c.workspace,dialogue.target);
  this.header.append(coButton('Back to comparison',()=>this.run(()=>dialogue.close())),coButton('Chronological log',()=>this.run(()=>dialogue.log())));
  if(!source){this.listHost.append(coEl('p','This source is no longer available.','review-warning'));return;}
  const records=dialogueRecords(this.c.workspace,d.thread()?.id,dialogue.target),rows=outlineDialogue(records),tree=dialogueTree(records),byId=new Map(rows.map(row=>[row.id,row]));
  const claim=coEl('article','','outline-card outline-dialogue-claim');claim.dataset.dialogueEntry='claim';claim.dataset.entryId='claim';claim.append(coEl('h3',source.item.title),coEl('p',`${d.name(source.map.ownerId)} · Original claim`,'outline-owner'));
  for(const text of [source.item.summary,source.item.details].filter(Boolean))claim.append(coEl('p',text,'outline-full-text'));
  const claimActions=coEl('div','','outline-actions');claimActions.append(coButton('Claim details',()=>this.run(()=>dialogue.inspect('claim'))));
  if(source.map.ownerId!==d.actor()&&interactionOptions(this.c.workspace,dialogue.target,'dispute').length)claimActions.append(coButton('Dispute reasoning',()=>this.run(()=>{if(!d.canLeave())return;dialogue.selected='claim';d.target={...dialogue.target};d.interactions.compose('dispute');})));
  claimActions.append(coButton('Propose standstill',()=>this.run(()=>d.standstills.choose(dialogue.target))));claim.append(claimActions);this.listHost.append(claim);
  this.notice.append(coEl('p',`${records.filter(r=>r.action==='dispute').length} disputes · ${records.filter(r=>r.action==='respond').length} responses. Each response names the point it addresses.`,'field-help'));
  if(!rows.length)this.listHost.append(coEl('p','No disputes have been recorded.','field-help'));
  const selected=rows.find(row=>row.id===dialogue.selected),shown=rows.slice(0,this.limit),pinned=selected&&!shown.includes(selected)?selected:null;
  if(pinned){this.listHost.append(coEl('p','The selected response is shown first; the chronological list follows.','field-help'));shown.unshift(pinned);}
  for(const row of shown){
   const r=row.record,p=interactionPresentation(this.c.workspace,r),card=coEl('article','','outline-card outline-dialogue-entry');card.dataset.dialogueEntry=r.id;card.dataset.entryId=r.id;card.dataset.status=r.status;card.setAttribute('aria-current',dialogue.selected===r.id?'true':'false');
   card.append(coEl('h3',r.action==='dispute'?'Dispute':p.label),coEl('p',`${d.name(r.authorId)} · ${new Date(r.createdAt).toLocaleString()}`,'outline-owner'));
   if(r.status==='withdrawn')card.append(coEl('strong','Withdrawn','review-warning'));
   if(row.targetId==='claim')card.append(coEl('p','Disputes the original claim','outline-reply-target'));
   else{
    const addressed=byId.get(row.targetId)?.record,label=addressed?`Responds to ${d.name(addressed.authorId)} · ${addressed.action==='dispute'?'dispute':'response'}${row.targetVersion?' · version '+row.targetVersion:''}`:'Reply target unavailable';
    card.append(addressed?coButton(label,()=>this.run(()=>dialogue.inspect(addressed.id)),'outline-reply-target'):coEl('p',label,'outline-reply-target'));
    if(r.interaction.version===6)card.append(coEl('p','Earlier response — no specific reply target recorded','field-help'));
   }
   for(const choice of p.choices)card.append(coEl('p',choice,'interaction-selected'));
   for(const text of [r.body,r.interaction.otherText].filter(Boolean))card.append(coEl('p',text,'outline-full-text'));
   if(row.placement)card.append(coEl('p',`Canvas placement: ${row.placement==='right'?'to the right':row.placement}`,'field-help'));
   d.standstills.dialogueMarkers(card,r.id,tree);
   const actions=coEl('div','','outline-actions'),details=coButton('Details',()=>this.run(()=>dialogue.inspect(r.id)));details.dataset.outlineControl='entry:'+r.id;actions.append(details);
   if(r.status==='active'&&canReplyArgument(dialogue.root(r),d.actor())){
    let placement;
    if(r.action==='respond'){
     const choices=coEl('details','','outline-placement'),selection=coEl('select');choices.append(coEl('summary','Placement in canvas'));selection.setAttribute('aria-label','Placement in canvas');for(const [value,label]of [['right','To the right'],['above','Above'],['below','Below']])selection.append(new Option(label,value));selection.onchange=()=>{placement=selection.value;};choices.append(selection,coEl('p','Placement does not change the meaning of your reply.','field-help'));actions.append(choices);
    }
    const label=r.action==='dispute'&&r.interaction.recipientId===d.actor()&&!d.interactions.responses(r.id).length?'Respond':'Reply';actions.append(coButton(label,()=>this.run(()=>dialogue.reply(r,placement)),'primary'));
   }
   d.standstills.resumeControls(actions,r.id);if(d.standstills.eligible(r.id))actions.append(coButton('Propose standstill',()=>this.run(()=>d.standstills.compose(r.id))));card.append(actions);this.listHost.append(card);
  }
  if(this.limit<rows.length)this.listHost.append(coButton(`Show more (${rows.length-this.limit} remaining)`,()=>{this.limit+=60;this.render();}));
 }
}
