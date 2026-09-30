import {stableJSON} from './account-model.mjs';
import {discussionSourceSnapshot} from './discussion.mjs';

export function standstillActions(){return {propose_standstill:'Propose standstill',suggest_standstill:'Suggest changes',confirm_standstill:'Confirm standstill',resume_standstill:'Resume discussion'};}
export const STANDSTILL_ACTIONS=standstillActions();
export const isStandstill=r=>r?.kind==='standstill';
export const isStandstillProposal=r=>isStandstill(r)&&r.action==='propose_standstill';
const eq=(a,b)=>stableJSON(a)===stableJSON(b),clone=v=>structuredClone(v);
const check=(ok,message,status)=>{if(!ok)throw Object.assign(Error(message),status?{status}:{});};
const exact=(value,keys)=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
const id=v=>typeof v==='string'&&v.length>0&&v.length<=200;
const revision=v=>Number.isSafeInteger(v)&&v>0;
const validRef=v=>exact(v,['entryId','version'])&&id(v.entryId)&&revision(v.version);
const ref=r=>({entryId:r.id,version:r.version});
const refKey=v=>JSON.stringify([v?.entryId,v?.version]);
const versions=r=>[...(r?.history||[]),r].filter(Boolean);
const isDispute=r=>r?.kind==='interaction'&&r.action==='dispute'&&r.interaction?.mode==='argument'&&r.target?.type==='node';
const isReply=(r,d)=>r?.kind==='interaction'&&r.action==='respond'&&r.interaction?.mode==='argument'&&r.target?.type==='entry'&&r.target.entryId===d?.id;

function contextVisible(ws,records,participants){
 const seen=new Set(),queue=[...records];
 for(let i=0;i<queue.length;i++){
  const r=queue[i];if(!r||seen.has(r.id))continue;seen.add(r.id);
  for(const v of versions(r)){
   for(const target of [v.target,v.other,v.interaction?.reference?.target].filter(Boolean)){
    if(['entry','inference'].includes(target.type)){const parent=ws.discussions.find(e=>e.id===target.entryId);if(!parent)return false;queue.push(parent);}
    else {const map=ws.maps.find(m=>m.id===target.mapId);if(!map||map.unavailable||!participants.every(p=>map.ownerId===p||map.visibility==='shared')||target.type==='node'&&!map.nodes.some(n=>n.id===target.nodeId))return false;}
   }
   if(v.interaction?.replyTo){const parent=ws.discussions.find(e=>e.id===v.interaction.replyTo.entryId);if(!parent)return false;queue.push(parent);}
  }
 }
 return true;
}

export function standstillContext(ws,comparisonId,anchorId){
 const anchor=ws.discussions?.find(r=>r.id===anchorId&&r.comparisonId===comparisonId),dispute=isDispute(anchor)?anchor:ws.discussions?.find(r=>r.id===anchor?.target?.entryId&&r.comparisonId===comparisonId&&isDispute(r));
 const thread=ws.comparisonThreads?.find(t=>t.id===comparisonId),target=dispute?.target,map=ws.maps?.find(m=>m.id===target?.mapId&&!m.unavailable),item=map?.nodes.find(n=>n.id===target.nodeId&&n.parent!==null),source=map&&item?{map,item,target:clone(target)}:null;
 const participants=dispute?[dispute.authorId,dispute.interaction.recipientId]:[];
 const available=!!(thread&&dispute&&anchor&&(anchor.id===dispute.id||isReply(anchor,dispute))&&participants.length===2&&participants[0]!==participants[1]&&participants.every(p=>thread.participants.includes(p))&&thread.participants.length===2&&[thread.aMapId,thread.bMapId].includes(target?.mapId)&&[thread.aMapId,thread.bMapId].every(mid=>ws.maps.some(m=>m.id===mid&&!m.unavailable&&participants.every(p=>m.ownerId===p||m.visibility==='shared')))&&source&&dispute.status==='active'&&anchor.status==='active'&&contextVisible(ws,[anchor,dispute],participants));
 return {source,dispute,anchor,participants,thread,available};
}

// Every explanation version and every immutable response consumes one exact
// predecessor. This orders competing actions without relying on client clocks.
export function standstillChain(ws,proposal){
 const events=(ws.discussions||[]).filter(r=>isStandstill(r)&&!isStandstillProposal(r)&&r.target?.type==='entry'&&r.target.entryId===proposal.id);
 const all=[...versions(proposal),...events],byRef=new Map(all.map(r=>[refKey(ref(r)),r])),next=new Map();let missing=false,invalid=false;
 for(const r of all){const previous=r.standstill?.previous;if(previous===null){if(r.id!==proposal.id||r.version!==1)invalid=true;continue;}if(!validRef(previous)){invalid=true;continue;}const key=refKey(previous);if(!byRef.has(key))missing=true;if(next.has(key))invalid=true;next.set(key,r);}
 const ordered=[],seen=new Set();let current=byRef.get(refKey({entryId:proposal.id,version:1})),proposalVersion=0,terminal=false;
 while(current){const key=refKey(ref(current));if(seen.has(key)){invalid=true;break;}seen.add(key);ordered.push(current);if(terminal)invalid=true;
  if(current.id===proposal.id){if(current.version!==proposalVersion+1)invalid=true;proposalVersion=current.version;}else if(current.standstill?.proposalVersion!==proposalVersion)invalid=true;
  if(current.status==='withdrawn'||current.action==='resume_standstill')terminal=true;
  current=next.get(key);
 }
 if(seen.size!==all.length)missing=true;
 return {events:ordered.filter(r=>r.id!==proposal.id),allEvents:events,ordered,head:ordered.length?ref(ordered.at(-1)):null,missing,invalid};
}

export function standstillHealth(ws,proposal){
 const m=proposal?.standstill,context=standstillContext(ws,proposal?.comparisonId,m?.anchor?.entryId);
 if(!context.available||!eq(context.dispute?.target,proposal.target)||context.dispute?.id!==m.disputeId)return {state:'unavailable',context};
 const baseline=(proposal.reviewedSources||proposal.sourceSnapshots)?.[0],current=discussionSourceSnapshot(ws,proposal.target,proposal.id);
 const changed=!baseline||!eq(baseline,current)||context.anchor.version!==m.reviewedAnchorVersion||context.dispute.version!==m.reviewedDisputeVersion;
 return {state:changed?'changed':'current',context,current};
}

export function standstillState(ws,proposal){
 if(typeof proposal==='string')proposal=ws.discussions?.find(r=>r.id===proposal);
 if(!isStandstillProposal(proposal))return null;
 const chain=standstillChain(ws,proposal),health=standstillHealth(ws,proposal),latest=chain.ordered.at(-1),confirmation=latest?.action==='confirm_standstill'?latest:null,suggestion=latest?.action==='suggest_standstill'?latest:null;
 let state=chain.missing||chain.invalid?'unavailable':versions(proposal).some(r=>r.status==='withdrawn')?'withdrawn':chain.allEvents.some(r=>r.action==='resume_standstill')?'resumed':health.state==='unavailable'?'unavailable':health.state==='changed'||confirmation&&!eq(confirmation.standstill.reviewedContext,eventContext(ws,proposal))?'needs_review':confirmation?'confirmed':'proposed';
 const labels={proposed:'Standstill proposed',confirmed:'Standstill confirmed',resumed:'Discussion resumed',withdrawn:'Proposal withdrawn',needs_review:'Needs review',unavailable:'Unavailable'};
 return {state,label:labels[state],proposal,events:chain.events,history:chain.ordered,head:chain.head,confirmation,suggestion,context:health.context,health,active:['proposed','confirmed','needs_review'].includes(state)};
}
export const standstillProposals=(ws,comparisonId,target=null)=>(ws.discussions||[]).filter(r=>isStandstillProposal(r)&&(!comparisonId||r.comparisonId===comparisonId)&&(!target||eq(r.target,target)));
export function standstillCounts(ws,comparisonId,target=null){const counts={proposed:0,confirmed:0,needsReview:0,total:0};for(const p of standstillProposals(ws,comparisonId,target)){const state=standstillState(ws,p).state;if(state==='proposed'||state==='confirmed'){counts[state]++;counts.total++;}else if(state==='needs_review'){counts.needsReview++;counts.total++;}}return counts;}

export function standstillProposalMetadata(ws,comparisonId,anchorId,old=null,{withdraw=false}={}){
 if(withdraw&&old)return {...clone(old.standstill),previous:clone(standstillState(ws,old).head)};
 const context=standstillContext(ws,comparisonId,anchorId);check(context.available,'Choose an available dispute or reply on an ordinary source node.');
 return {version:1,disputeId:context.dispute.id,anchor:old?clone(old.standstill.anchor):ref(context.anchor),reviewedAnchorVersion:context.anchor.version,reviewedDisputeVersion:context.dispute.version,previous:old?clone(standstillState(ws,old).head):null};
}
const eventContext=(ws,proposal)=>{const context=standstillContext(ws,proposal.comparisonId,proposal.standstill.anchor.entryId);return {source:discussionSourceSnapshot(ws,proposal.target,proposal.id),anchorVersion:context.anchor?.version||null,disputeVersion:context.dispute?.version||null};};
export function standstillEventMetadata(ws,proposal){const state=standstillState(ws,proposal);check(state,'Choose a standstill proposal.');return {version:1,proposalVersion:state.proposal.version,previous:clone(state.head),reviewedContext:eventContext(ws,state.proposal)};}

export function validateStandstills(ws){
 for(const r of ws.discussions||[]){
  for(const v of versions(r)){
   if(!isStandstill(v)){check(v.standstill===undefined,'Standstill metadata belongs only to a standstill.');continue;}
   const m=v.standstill;
   check(isStandstill(r)&&Object.hasOwn(STANDSTILL_ACTIONS,r.action)&&v.action===r.action&&v.layer==='arguments'&&v.other===null,'A standstill keeps its role and argument attachment.');
   check(['premise','adoption','reflection','interaction','definitionRefs','referenceUrl','unlinkedRecordIds'].every(k=>v[k]===undefined),'Use only the standstill fields for this contribution.');
   check(m?.version===1,'Unsupported standstill metadata.');
   if(isStandstillProposal(v)){
    check(exact(v.target,['type','mapId','nodeId'])&&v.target.type==='node'&&id(v.target.mapId)&&id(v.target.nodeId),'A standstill requires an ordinary source node.');
    check(exact(m,['version','disputeId','anchor','reviewedAnchorVersion','reviewedDisputeVersion','previous'])&&id(m.disputeId)&&validRef(m.anchor)&&revision(m.reviewedAnchorVersion)&&m.reviewedAnchorVersion>=m.anchor.version&&revision(m.reviewedDisputeVersion)&&(v.version===1?m.previous===null:validRef(m.previous)),'Invalid standstill proposal context.');
    check(eq(m.anchor,r.standstill.anchor)&&m.disputeId===r.standstill.disputeId&&eq(v.sourceSnapshots,r.sourceSnapshots),'A standstill keeps its original source and addressed contribution.');
   }else{
    check(exact(v.target,['type','entryId'])&&v.target.type==='entry'&&id(v.target.entryId)&&exact(m,['version','proposalVersion','previous','reviewedContext'])&&revision(m.proposalVersion)&&validRef(m.previous)&&exact(m.reviewedContext,['source','anchorVersion','disputeVersion'])&&revision(m.reviewedContext.anchorVersion)&&revision(m.reviewedContext.disputeVersion)&&m.reviewedContext.source&&eq(m.reviewedContext.source.target,ws.discussions.find(p=>p.id===v.target.entryId)?.target),'Invalid standstill response context.');
    check(r.version===1&&!r.history.length&&r.status==='active'&&r.createdAt===r.updatedAt&&r.reviewedSources===undefined,'Standstill responses cannot be edited or withdrawn.');
   }
   check(typeof v.body==='string'&&v.body.length<=10000&&v.body===v.body.trim()&&(['propose_standstill','suggest_standstill'].includes(v.action)?v.body.length>0:v.body===''),'Explain why the argument cannot move forward, or write your suggested changes.');
  }
  if(!isStandstill(r))continue;
  const p=isStandstillProposal(r)?r:ws.discussions.find(e=>e.id===r.target.entryId);
  check(isStandstillProposal(p)&&p.comparisonId===r.comparisonId,'Choose a proposal in the same comparison.');
  const context=standstillContext(ws,p.comparisonId,p.standstill.anchor.entryId),anchor=context.anchor,dispute=context.dispute;
  if(dispute)check(dispute.id===p.standstill.disputeId&&eq(dispute.target,p.target),'The standstill must stay in its original dispute and source.');
  if(anchor)check((anchor.id===dispute?.id||isReply(anchor,dispute))&&versions(anchor).some(v=>v.version===p.standstill.anchor.version)&&versions(anchor).some(v=>v.version===p.standstill.reviewedAnchorVersion),'Choose a saved revision of a contribution in this dispute.');
  if(dispute){check(versions(dispute).some(v=>v.version===p.standstill.reviewedDisputeVersion),'Choose a saved dispute revision.');check(context.participants.includes(r.authorId),'Only the two dispute participants can record a standstill.');}
  if(['suggest_standstill','confirm_standstill'].includes(r.action))check(r.authorId!==p.authorId,'Only the other participant can suggest changes or confirm standstill.');
 }
 for(const p of standstillProposals(ws)){const chain=standstillChain(ws,p);check(!chain.invalid,'Standstill actions must follow one exact causal sequence.');}
}

// ws contains the submitted row. Reconstruct the immediately preceding record
// set so changes are validated against committed state, not their own receipt.
export function validateStandstillEdit(ws,old,r,actor){
 const parent=r.target?.type==='entry'?ws.discussions.find(p=>p.id===r.target.entryId):null;
 if(isStandstill(parent)&&!isStandstill(r))throw Error('Use the standstill actions; reply to its addressed contribution.');
 if(!isStandstill(r))return;
 check(r.authorId===actor,'Record only your own standstill contribution.');
 const before={...ws,discussions:ws.discussions.filter(e=>e.id!==r.id)};if(old)before.discussions.push(old);
 if(old)check(isStandstillProposal(old)&&isStandstillProposal(r)&&r.version===old.version+1,'Standstill responses cannot be edited or withdrawn.');
 const proposal=isStandstillProposal(r)?old:before.discussions.find(e=>e.id===r.target.entryId),state=proposal?standstillState(before,proposal):null;
 if(proposal){check(state&&!['resumed','withdrawn'].includes(state.state),'This standstill has ended. Propose a new standstill.');check(!standstillChain(before,proposal).missing&&!standstillChain(before,proposal).invalid,'The standstill history is unavailable. Reopen its details.',409);check(eq(r.standstill.previous,state.head),'The standstill changed. Reopen its details before saving.',409);}
 const p=isStandstillProposal(r)?r:proposal,m=p.standstill,context=standstillContext(before,p.comparisonId,m.anchor.entryId);
 check(context.participants.includes(actor),'Only the two dispute participants can record a standstill.');
 if(old&&r.status==='withdrawn'){
  const unchanged=({status,version,history,updatedAt,standstill,...rest})=>rest;
  check(old.status==='active'&&eq(unchanged(old),unchanged(r))&&eq({...old.standstill,previous:r.standstill.previous},r.standstill),'Withdraw only your own unchanged proposal.');return;
 }
 check(context.available&&context.dispute.id===m.disputeId&&eq(context.dispute.target,p.target),'Choose an available source and dispute before continuing.');
 if(isStandstillProposal(r)){
  check(r.status==='active','A new standstill must be active.');
  check(m.reviewedAnchorVersion===context.anchor.version&&m.reviewedDisputeVersion===context.dispute.version,'The addressed contribution changed. Review it before saving.',409);
  check(old||m.anchor.version===context.anchor.version,'The addressed contribution changed. Reopen it before saving.',409);
  const latest=discussionSourceSnapshot(before,r.target,r.id),reviewed=(r.reviewedSources||r.sourceSnapshots)?.[0];check(eq(latest,reviewed),'The source changed. Review its current wording before saving.',409);
  if(old)check(eq(old.standstill.anchor,m.anchor)&&old.standstill.disputeId===m.disputeId,'A standstill keeps its original addressed contribution.');
  else check(!standstillProposals(before,r.comparisonId,r.target).some(p=>p.authorId===actor&&p.standstill.anchor.entryId===m.anchor.entryId&&p.status!=='withdrawn'&&!before.discussions.some(e=>e.kind==='standstill'&&e.action==='resume_standstill'&&e.target?.entryId===p.id)),'You already proposed a standstill here. Edit the existing proposal.');
 }else{
  check(r.standstill.proposalVersion===proposal.version,'The explanation changed. Read the current proposal before responding.',409);
  check(eq(r.standstill.reviewedContext,eventContext(before,proposal)),'The source or addressed contribution changed. Reopen the standstill before responding.',409);
  check(r.action==='resume_standstill'||standstillHealth(before,proposal).state==='current','The source or contribution changed. The proposer must review it first.',409);
  check(r.action==='resume_standstill'||actor!==proposal.authorId,'Only the other participant can suggest changes or confirm standstill.');
 }
}
