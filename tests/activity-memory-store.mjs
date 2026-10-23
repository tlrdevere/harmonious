import {activityEventForChange} from '../worker/activity-events.mjs';
import {AccountError} from '../worker/account-policy.mjs';

export function withMemoryActivity(store){
 const commit=store.commit.bind(store),events=[],mutes=new Map();let sequence=0;
 store.commit=async(actor,generation,changes)=>{
  const before=await store.snapshot(),result=await commit(actor,generation,changes),after=await store.snapshot();
  for(const change of changes){
   const row=after.records.find(r=>r.kind===change.kind&&r.id===change.id),old=before.records.find(r=>r.kind===change.kind&&r.id===change.id),event=activityEventForChange(after,old,row);
   if(event&&!events.some(e=>e.recordKind===event.recordKind&&e.recordId===event.recordId&&e.revision===event.revision&&e.eventType===event.eventType&&e.recipientId===event.recipientId))events.push({...event,id:String(++sequence),createdAt:new Date().toISOString(),read:false,suppressed:!!mutes.get(event.recipientId)?.has(event.comparisonId)});
  }
  return result;
 };
 store.activity=async(actor,command,input={})=>{
  const snapshot=await store.snapshot(),own=events.filter(e=>e.recipientId===actor);
  if(command==='snapshot')return {...snapshot,events:structuredClone(own),mutes:[...(mutes.get(actor)||[])]};
  if(snapshot.revision!==input.generation){const error=new AccountError('snapshot_changed',409);error.snapshotChanged=true;throw error;}
  if(command==='read'){
   if(!Array.isArray(input.ids)||input.ids.length>200||typeof input.read!=='boolean'||input.ids.some(id=>!own.some(e=>e.id===id)))throw new AccountError('Activity unavailable.',403);
   for(const event of own.filter(e=>input.ids.includes(e.id))){event.read=input.read;if(!input.read)event.suppressed=false;}return {updated:true};
  }
  if(command==='mute'){
   if(!snapshot.records.some(r=>r.kind==='comparison_thread'&&r.id===input.comparisonId&&r.value.participants.includes(actor)))throw new AccountError('Comparison unavailable.',403);
   if(!mutes.has(actor))mutes.set(actor,new Set());if(input.muted)mutes.get(actor).add(input.comparisonId);else mutes.get(actor).delete(input.comparisonId);return {updated:true};
  }
  throw new AccountError('Unknown activity operation.');
 };
 return store;
}
