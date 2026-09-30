import {makeDiscussion,discussionSourceSnapshot} from './discussion.mjs';
import {standstillContext,standstillState,standstillProposals,standstillProposalMetadata,standstillEventMetadata,validateStandstillEdit} from './standstill.mjs';
import {dialogueRecords} from './argument-dialogue.mjs';
import {validateWorkspace} from './workspace.mjs';
import {stableJSON} from './account-model.mjs';
import {comparisonNodeKey,visibleComparisonEndpoint} from './comparison-layout.mjs';

const stEl=(tag,text='',cls='')=>{const e=document.createElement(tag);e.textContent=text;e.className=cls;return e;};
const stButton=(text,run,cls='')=>{const e=stEl('button',text,cls);e.type='button';e.onclick=run;return e;};
const stActive=state=>['proposed','confirmed','needs_review'].includes(state.state);
const stCounts=states=>({proposed:states.filter(s=>s.state==='proposed').length,confirmed:states.filter(s=>s.state==='confirmed').length,review:states.filter(s=>s.state==='needs_review').length});
const stCountLabel=states=>{const c=stCounts(states);return [[c.proposed,'proposed'],[c.confirmed,'confirmed'],[c.review,'need review']].filter(([n])=>n).map(([n,label])=>`${n} ${label}`).join(' · ');};

// Standstills annotate the existing source and contribution. They never become
// dialogue cards or carry the meaning of a position assessment or a locked thread.
export class StandstillUI{
 constructor(d){this.d=d;this.c=d.c;}
 states(target=null){const comparisonId=this.d.thread()?.id;return comparisonId?standstillProposals(this.c.workspace,comparisonId,target).map(p=>standstillState(this.c.workspace,p)):[];}
 proposal(id){const r=this.c.workspace.discussions.find(r=>r.id===id&&r.comparisonId===this.d.thread()?.id);return r?.kind==='standstill'?(r.action==='propose_standstill'?r:this.c.workspace.discussions.find(p=>p.id===r.target.entryId&&p.comparisonId===r.comparisonId)):null;}
 context(anchorId){return standstillContext(this.c.workspace,this.d.thread()?.id,anchorId);}
 eligible(anchorId){const context=this.context(anchorId);return !!context?.available&&context.participants.includes(this.d.actor());}
 points(anchorId){return this.states().filter(s=>s.proposal.standstill.anchor.entryId===anchorId);}
 byline(r){return `${this.d.name(r.authorId)} · ${new Date(r.updatedAt||r.createdAt).toLocaleString()}`;}
 prepareView(title,target,anchorId=null){const focus=document.activeElement,returnFocus=this.d.host.contains(focus)?this.d.returnFocus:focus;if(!this.d.canLeave())return false;this.d.returnFocus=returnFocus;this.d.activateMode('argument');this.d.target=target;this.d.shell(title);if(this.d.dialogue?.active&&anchorId)this.d.dialogue.selected=anchorId;return true;}
 contextView(host,context){
  const source=context?.source;if(source){const box=stEl('details','','standstill-context');box.open=true;box.append(stEl('summary','Source node: '+(source.item?.title||source.label||'Node')));for(const text of [source.item?.summary,source.item?.details,source.item?.note].filter(Boolean))box.append(stEl('p',text,'discussion-body'));host.append(box);}
  const anchor=context?.anchor;if(anchor){const box=stEl('details','','standstill-context');box.open=true;box.append(stEl('summary',`Addressed ${anchor.action==='dispute'?'dispute':'reply'} · ${this.d.name(anchor.authorId)} · version ${anchor.version}`));for(const text of [anchor.body,anchor.interaction?.otherText].filter(Boolean))box.append(stEl('p',text,'discussion-body'));host.append(box);}
 }
 choose(target){
  if(!this.prepareView('Propose standstill',target,'claim'))return;
  const records=dialogueRecords(this.c.workspace,this.d.thread()?.id,target).filter(r=>this.eligible(r.id));
  if(!records.length){this.d.host.append(stEl('p','Record a dispute on this node first. A standstill must identify a specific dispute or reply.','field-help'));this.d.positionPopover();return;}
  const form=stEl('form','','standstill-form'),label=stEl('label','Which dispute or reply has reached a standstill?'),select=stEl('select');select.id='standstill-anchor';select.required=true;label.htmlFor=select.id;select.append(new Option('Choose a dispute or reply',''));
  for(const r of records)select.append(new Option(`${r.action==='dispute'?'Dispute':'Reply'} · ${this.d.name(r.authorId)} · ${(r.body||r.interaction?.otherText||'No additional explanation').slice(0,140)}`,r.id));
  const next=stEl('button','Continue','primary');next.type='submit';form.append(label,select,next,stButton('Cancel',()=>{this.d.dirty=false;this.d.close();}));form.onsubmit=e=>{e.preventDefault();if(!select.value)return;this.d.dirty=false;this.compose(select.value);};this.d.host.append(form);this.d.positionPopover();select.focus({preventScroll:true});
 }
 compose(anchorId,old=null){
  if(!old){const own=this.points(anchorId).find(s=>s.proposal.authorId===this.d.actor()&&stActive(s));if(own)old=own.proposal;}
  const context=this.context(anchorId);if(!context?.available||!context.participants.includes(this.d.actor())){this.c.message('This discussion point is unavailable for a new or revised standstill.');return;}
  let metadata;try{metadata=standstillProposalMetadata(this.c.workspace,this.d.thread().id,anchorId,old);}catch(error){this.c.message(error.message);return;}
  const target=context.dispute.target;if(!this.prepareView(old?'Revise standstill':'Propose standstill',target,anchorId))return;
  this.contextView(this.d.host,context);if(old)this.d.host.append(stEl('p','Review this context and explanation. Saving a new version requires the other participant to confirm it again.','field-help'));
  const form=stEl('form','','standstill-form'),label=stEl('label','Why do you believe this argument cannot move forward at this time?'),body=stEl('textarea');body.id='standstill-explanation';body.rows=5;body.maxLength=10000;body.required=true;body.value=old?.body||'';label.htmlFor=body.id;
  const submit=stEl('button',old?'Save revised proposal':'Propose standstill','primary');submit.type='submit';form.append(label,body,submit,stButton('Cancel',()=>{this.d.dirty=false;if(old)this.open(old.id);else this.d.close();}));this.d.host.append(form);
  const id=old?.id||'discussion-'+crypto.randomUUID(),reviewed=discussionSourceSnapshot(this.c.workspace,target),save=this.saver(form,{old,reviewed,target});
  form.onsubmit=e=>{e.preventDefault();const explanation=body.value.trim();if(!explanation){this.error(form,'Enter an explanation of the standstill.');body.focus();return;}save({id,kind:'standstill',action:'propose_standstill',comparisonId:this.d.thread().id,target,body:explanation,standstill:metadata,...(old?{reviewSources:true}:{})});};this.d.positionPopover();body.focus({preventScroll:true});
 }
 error(host,text){let error=host.querySelector('[role="alert"]');if(!error){error=stEl('p','','standstill-error');error.setAttribute('role','alert');host.append(error);}error.textContent=text;this.d.positionPopover();}
 saver(form,{old=null,reviewed=null,target=null,proposalId=null}={}){
  let staged=null,stagedInput=null;
  return async input=>{
   const d=this.d;if(d.saving)return;d.saving=true;d.dirty=true;d.host.inert=true;
   try{
    if(this.c.editor.hasDraft()){throw Error('Finish or cancel your map edit before saving this standstill. Your explanation has been kept.');}
    const serialized=stableJSON(input),prepare=workspace=>{
     const current=workspace.discussions.find(r=>r.id===input.id);
     if(staged&&current&&stableJSON(current)===stableJSON(staged)){if(serialized===stagedInput)return {workspace,record:current};throw Error('Your earlier submission was saved, but this draft has further changes. Copy this draft before reopening the saved standstill.');}
     if(old?stableJSON(current)!==stableJSON(old):!!current)throw Error('This standstill changed in another session. Your draft is still here. Copy it before reopening the latest saved explanation.');
     if(reviewed&&stableJSON(discussionSourceSnapshot(workspace,target))!==stableJSON(reviewed))throw Error('The source changed while this form was open. Your draft has been kept. Copy it before reviewing the latest source.');
     const candidate=structuredClone(workspace),record=staged&&serialized===stagedInput?structuredClone(staged):makeDiscussion(candidate,input,d.actor(),old);
     candidate.discussions=candidate.discussions.filter(r=>r.id!==record.id);candidate.discussions.push(record);validateWorkspace(candidate);validateStandstillEdit(candidate,old,record,d.actor());staged=structuredClone(record);stagedInput=serialized;return {workspace:candidate,record};
    };
    const result=this.c.account?await this.c.account.commitCandidate(prepare):prepare(this.c.workspace);
    if(!this.c.account){this.c.workspace=result.workspace;this.c.markDirty();}
    d.dirty=false;d.saving=false;this.c.library.render();this.c.renderComparison();this.open(proposalId||result.record.id);d.dialogue?.refresh();d.host.querySelector('header button')?.focus({preventScroll:true});
   }catch(error){this.error(form,error.message);}finally{d.saving=false;d.host.inert=false;this.c.status();d.positionPopover();}
  };
 }
 action(proposal,action){
  const state=standstillState(this.c.workspace,proposal),labels={suggest_standstill:'Suggest changes',confirm_standstill:'Confirm standstill',resume_standstill:'Resume discussion',withdraw:'Withdraw proposal'},label=labels[action];
  let metadata;try{metadata=action==='withdraw'?{...proposal.standstill,previous:state.head}:standstillEventMetadata(this.c.workspace,proposal);}catch(error){this.c.message(error.message);return;}
  if(!this.prepareView(label,proposal.target,proposal.standstill.anchor.entryId))return;
  this.contextView(this.d.host,state.context);this.d.host.append(stEl('p',`Proposal version ${proposal.version} · ${this.byline(proposal)}`,'discussion-byline'),stEl('p',proposal.body,'discussion-body standstill-explanation'));
  const form=stEl('form','','standstill-form');
  let body=null;if(action==='suggest_standstill'){const field=stEl('label','What would you change in this explanation?');body=stEl('textarea');body.id='standstill-suggestion';body.required=true;body.maxLength=10000;body.rows=5;field.htmlFor=body.id;form.append(field,body);}
  if(action==='confirm_standstill')form.append(stEl('p','You are confirming this description of the impasse, not agreeing with the underlying position.','standstill-confirm-help'));
  if(action==='resume_standstill')form.append(stEl('p','This ends the active standstill and keeps its history. Replies remain available.','field-help'));
  if(action==='withdraw')form.append(stEl('p','Withdraw your proposal while keeping its history. A later proposal will require a new explanation and confirmation.','field-help'));
  const submit=stEl('button',label,'primary');submit.type='submit';form.append(submit,stButton('Cancel',()=>{this.d.dirty=false;this.open(proposal.id);}));this.d.host.append(form);
  const id=action==='withdraw'?proposal.id:'discussion-'+crypto.randomUUID(),target=proposal.target,reviewed=action==='withdraw'?null:discussionSourceSnapshot(this.c.workspace,target),save=this.saver(form,{old:action==='withdraw'?proposal:null,reviewed,target,proposalId:proposal.id});
  form.onsubmit=e=>{e.preventDefault();if(body&&!body.value.trim()){this.error(form,'Enter your suggested changes.');body.focus();return;}save(action==='withdraw'?{...proposal,status:'withdrawn',standstill:metadata}:{id,kind:'standstill',action,comparisonId:proposal.comparisonId,target:{type:'entry',entryId:proposal.id},body:body?.value.trim()||'',standstill:metadata});};this.d.positionPopover();(body||submit).focus({preventScroll:true});
 }
 open(id){
  const proposal=this.proposal(id);if(!proposal)return false;const state=standstillState(this.c.workspace,proposal);
  if(!this.prepareView(state.label,proposal.target,proposal.standstill.anchor.entryId))return false;this.d.viewId=proposal.id;this.d.host.dataset.standstillId=proposal.id;
  this.d.host.append(stEl('p',`Proposal version ${proposal.version} · ${this.byline(proposal)}`,'discussion-byline'),stEl('strong',state.label,'standstill-status'));this.contextView(this.d.host,state.context);
  if(state.state!=='unavailable')this.d.host.append(stEl('p',proposal.body,'discussion-body standstill-explanation'));else this.d.host.append(stEl('p','This point is no longer available. No current shared standstill is asserted.','review-warning'));
  if(state.suggestion&&state.state!=='unavailable')this.d.host.append(stEl('h3','Suggested changes'),stEl('p',this.byline(state.suggestion),'discussion-byline'),stEl('p',state.suggestion.body,'discussion-body'));
  const member=state.context?.participants?.includes(this.d.actor()),own=proposal.authorId===this.d.actor();
  if(member&&stActive(state)){
   if(own)this.d.host.append(stButton(state.state==='needs_review'?'Review and renew proposal':'Revise explanation',()=>this.compose(proposal.standstill.anchor.entryId,proposal)));
   else if(state.state!=='needs_review'){this.d.host.append(stButton('Suggest changes',()=>this.action(proposal,'suggest_standstill')));if(state.state!=='confirmed')this.d.host.append(stButton('Confirm standstill',()=>this.action(proposal,'confirm_standstill'),'primary'));}
   if(state.state==='needs_review')this.d.host.append(stEl('p','The source or addressed contribution changed. The proposer must review it before confirmation. Either participant can resume discussion.','review-warning'));
   this.d.host.append(stButton('Resume discussion',()=>this.action(proposal,'resume_standstill')));
  }
  if(own&&!['resumed','withdrawn'].includes(state.state))this.d.host.append(stButton('Withdraw proposal',()=>this.action(proposal,'withdraw'),'discussion-text-action'));
  const anchor=state.context?.anchor;if(anchor&&state.context.available)this.d.interactions.replyControl(anchor,this.d.host,'Reply to this point');
  if(state.state!=='unavailable')this.history(proposal,state,this.d.host);
  if(state.context?.available)this.d.host.append(stButton('Show this point on the argument canvas',()=>this.reveal(proposal.id),'discussion-text-action'));
  this.detailSnapshot=stableJSON(this.c.workspace);this.d.positionPopover();return true;
 }
 refresh(){
  const d=this.d;if(d.host.hidden||d.dirty||d.saving||d.host.querySelector('form')||!d.host.dataset.standstillId||this.detailSnapshot===stableJSON(this.c.workspace))return;
  const id=d.host.dataset.standstillId,scroll=d.host.scrollTop,focus=d.host.contains(document.activeElement)?document.activeElement.textContent:null,expanded=[...d.host.querySelectorAll('details')].map(e=>e.open);
  if(!this.open(id))return;[...d.host.querySelectorAll('details')].forEach((e,i)=>{if(expanded[i]!==undefined)e.open=expanded[i];});if(focus)[...d.host.querySelectorAll('button,summary')].find(e=>e.textContent===focus)?.focus({preventScroll:true});d.host.scrollTop=scroll;
 }
 history(proposal,state,host){
  const history=stEl('details','','standstill-history');history.dataset.standstillHistory=proposal.id;history.append(stEl('summary','Standstill history'));
  const records=state.history||[...(proposal.history||[]),proposal,...(state.events||[])];
  for(const r of records){const row=stEl('section'),labels={propose_standstill:r.status==='withdrawn'?'Proposal withdrawn':`Explanation version ${r.version}`,suggest_standstill:`Suggested changes to version ${r.standstill?.proposalVersion}`,confirm_standstill:`Confirmed version ${r.standstill?.proposalVersion}`,resume_standstill:'Discussion resumed'};row.append(stEl('strong',labels[r.action]||'Standstill'),stEl('small',this.byline(r),'discussion-byline'));if(r.body)row.append(stEl('p',r.body,'discussion-body'));history.append(row);}host.append(history);
 }
 list(target,{proposals=null,title='Standstills at this node'}={}){
  if(!this.prepareView(title,target))return;const states=(proposals||this.states(target).map(s=>s.proposal)).map(p=>standstillState(this.c.workspace,p)),count=stCountLabel(states);if(count)this.d.host.append(stEl('p',count,'standstill-counts'));
  for(const s of states){const row=stEl('section','','standstill-list-item');row.dataset.standstillId=s.proposal.id;row.append(stButton(`${s.label} · ${this.d.name(s.proposal.authorId)}`,()=>this.open(s.proposal.id)));if(s.state!=='unavailable'){row.append(stEl('p',s.proposal.body,'discussion-body'));if(s.context.available)row.append(stButton('Show point',()=>this.reveal(s.proposal.id)));}this.d.host.append(row);}this.d.positionPopover();
 }
 async reveal(id){
  const p=this.proposal(id),state=p&&standstillState(this.c.workspace,p);if(!state?.context?.available)return false;
  if(!this.d.canLeave())return false;
  if(!this.d.dialogue.active||stableJSON(this.d.dialogue.target)!==stableJSON(p.target)){if(!await this.d.dialogue.open(p.target,{entry:p.id}))return false;}
  else{this.d.dialogue.reveal(p.standstill.anchor.entryId);this.open(p.id);history.replaceState(null,'',this.d.dialogue.url(p.id));}
  return true;
 }
 marker(state,run){const button=stButton(`${state.state==='confirmed'?'◆':'◷'} ${state.label} · ${this.d.name(state.proposal.authorId)}`,run,'standstill-marker');button.dataset.standstillId=state.proposal.id;button.dataset.standstillState=state.state;return button;}
 pointControls(host,record,{offer=true}={}){
  const states=this.points(record.id);if(!states.length&&!this.eligible(record.id))return;
  const section=stEl('section','','standstill-point');for(const s of states.filter(stActive)){section.append(this.marker(s,()=>this.open(s.proposal.id)));if(s.context.participants.includes(this.d.actor()))section.append(stButton('Resume discussion',()=>this.action(s.proposal,'resume_standstill'),'discussion-text-action'));}
  for(const s of states)if(s.state!=='unavailable')this.history(s.proposal,s,section);
  if(states.some(s=>!stActive(s)))section.append(stButton('Standstill history',()=>this.list(this.context(record.id)?.dispute?.target,{proposals:states.map(s=>s.proposal),title:'Standstills at this point'}),'discussion-text-action'));
  if(offer&&this.eligible(record.id))section.append(stButton('Propose standstill',()=>this.compose(record.id),'discussion-text-action'));host.append(section);
 }
 resumeControls(host,anchorId){for(const s of this.points(anchorId).filter(stActive))if(s.context.participants.includes(this.d.actor()))host.append(stButton('Resume discussion',()=>this.action(s.proposal,'resume_standstill')));}
 sourceControls(host,target){const states=this.states(target);if(states.length)host.append(stButton(`Standstills · ${stCountLabel(states)||'History'}`,()=>this.list(target),'standstill-summary'));host.append(stButton('Propose standstill',()=>this.choose(target),'discussion-text-action'));}
 dialogueMarkers(card,id,tree){
  const states=this.states(this.d.dialogue.target);if(id!=='claim')for(const s of states.filter(s=>s.proposal.standstill.anchor.entryId===id&&stActive(s)))card.append(this.marker(s,()=>this.open(s.proposal.id)));
  if(!this.d.dialogue.state.collapsed.has(id))return;
  const hidden=new Set(),pending=[...tree.nodes.get(id).children];for(let i=0;i<pending.length;i++){hidden.add(pending[i]);pending.push(...(tree.nodes.get(pending[i])?.children||[]));}
  const hiddenStates=states.filter(s=>hidden.has(s.proposal.standstill.anchor.entryId)&&stActive(s));if(hiddenStates.length){const b=stButton(`Standstills inside · ${stCountLabel(hiddenStates)}`,()=>this.list(this.d.dialogue.target,{proposals:hiddenStates.map(s=>s.proposal),title:'Standstills inside this branch'}),'standstill-collapsed');b.dataset.standstillCollapsed=id;card.append(b);}
 }
 draw(){
  if(this.d.mode()!=='argument'||!this.d.layers.map)return;const grouped=new Map(),canvas=this.d.canvas;
  for(const s of this.states().filter(stActive)){const t=s.proposal.target,side=['a','b'].find(side=>canvas.states[side].map?.id===t.mapId),end=side&&visibleComparisonEndpoint(canvas.layout,side,t.nodeId);if(!end)continue;if(!grouped.has(end.key))grouped.set(end.key,[]);grouped.get(end.key).push(s);}
  for(const [key,states]of grouped){const card=canvas.cards.get(key);if(!card)continue;const collapsed=states.some(s=>{const side=['a','b'].find(side=>canvas.states[side].map?.id===s.proposal.target.mapId);return comparisonNodeKey(side,s.proposal.target.nodeId)!==key;}),label=`Standstills${collapsed?' inside':''}: ${stCountLabel(states)}`,b=stButton(label,()=>this.list(states[0].proposal.target,{proposals:states.map(s=>s.proposal),title:collapsed?'Standstills inside this branch':'Standstills at this node'}),'standstill-map-summary discussion-drawing');b.dataset.standstillSummary=key;b.title=label;b.setAttribute('aria-label',label);card.querySelector('.node-bottom').append(b);}
 }
}
