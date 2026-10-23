import {stableJSON} from '../dist/account-model.mjs';

// The memory fixture uses this classifier; PostgreSQL captures the same events
// in the canonical-record transaction, including facilitated publication.
const significant=r=>({action:r.action??null,body:r.body??null,status:r.status??null,interaction:{...Object.fromEntries(['mode','options','otherText','replyTo','placement'].map(k=>[k,r.interaction?.[k]??null])),reference:r.interaction?.reference?.target??null},definitionRefs:r.definitionRefs??null,referenceUrl:r.referenceUrl??null,premise:r.premise??null});
export function activityEventForChange(snapshot,old,row,{recorderId=null}={}){
 const r=row.value,previous=old?.value;let eventType,recipientId,authorId=row.ownerId||r.authorId,comparisonId=r.comparisonId||null,sourceMapId=null;
 if(old&&stableJSON(previous)===stableJSON(r))return null;
 const thread=snapshot.records.find(x=>x.kind==='comparison_thread'&&x.id===comparisonId)?.value;
 const other=()=>thread?.participants.find(id=>id!==authorId);
 if(row.kind==='discussion'){
  if(!thread?.participants.includes(authorId))return null;
  if(r.kind==='interaction'){
   recipientId=r.interaction?.recipientId;
   if(!old&&r.status==='active')eventType=({endorse:'agree',disagree:'disagree',decline:'no_position',dispute:'dispute',respond:'respond',request_reason:'inquiry',request_explanation:'inquiry',offer_reason:'inquiry',propose_alternative:'inquiry'})[r.action];
   else if(old&&stableJSON(significant(previous))!==stableJSON(significant(r)))eventType=r.status==='withdrawn'&&previous.status!=='withdrawn'?'interaction_withdrawn':'interaction_changed';
  }else if(r.kind==='counterpart'&&!old&&r.status==='active'){eventType='counterpart_requested';recipientId=other();}
  else if(['correspondence','relationship'].includes(r.kind)&&(!old&&r.status==='active'||previous?.status==='active'&&r.status==='withdrawn')){eventType=old?'counterpart_unlinked':'counterpart_linked';recipientId=other();}
  else if(r.kind==='counterpart_unlink'&&!old&&r.status==='active'){eventType='counterpart_unlinked';recipientId=other();}
  else if(r.kind==='standstill'){
   recipientId=other();
   if(!old&&r.status==='active')eventType=({propose_standstill:'standstill_proposed',suggest_standstill:'standstill_suggested',confirm_standstill:'standstill_confirmed',resume_standstill:'standstill_resumed'})[r.action];
   else if(old&&previous.status!=='withdrawn'&&r.status==='withdrawn')eventType='standstill_withdrawn';
   else if(old&&r.status==='active'&&stableJSON({body:r.body,standstill:r.standstill})!==stableJSON({body:previous.body,standstill:previous.standstill}))eventType='standstill_changed';
  }
  let target=r.target;const seen=new Set();
  while(['entry','inference'].includes(target?.type)&&!seen.has(target.entryId)){seen.add(target.entryId);target=snapshot.records.find(x=>x.kind==='discussion'&&x.id===target.entryId)?.value.target;}
  sourceMapId=target?.mapId||null;
 }else if(row.kind==='endorsement'&&!old&&r.status==='active'){
  authorId=row.ownerId||r.participantId;comparisonId=null;sourceMapId=r.sourceMapId;const source=snapshot.records.find(x=>x.kind==='map'&&x.id===sourceMapId);recipientId=source?.ownerId||source?.value.ownerId;eventType='cosigned';
 }
 if(!eventType||!recipientId||recipientId===authorId||comparisonId&&!thread?.participants.includes(recipientId))return null;
 return {recordKind:row.kind,recordId:row.id,revision:row.revision,eventType,authorId,recipientId,recorderId:recorderId===authorId?null:recorderId,comparisonId,sourceMapId};
}
