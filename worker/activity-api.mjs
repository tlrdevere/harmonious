import {AccountError,projectAccountWorkspace} from './account-policy.mjs';
import {discussionSource,DISCUSSION_LABELS} from '../dist/discussion.mjs';
import {stableJSON} from '../dist/account-model.mjs';

const labels={agree:'Agreed',disagree:'Disagreed',no_position:'Recorded no position',inquiry:'New inquiry',dispute:'New dispute',respond:'New response',interaction_changed:'Updated a contribution',interaction_withdrawn:'Withdrew a contribution',counterpart_requested:'Requested a counterpart',counterpart_linked:'Linked counterparts',counterpart_unlinked:'Unlinked counterparts',standstill_proposed:'Proposed a standstill',standstill_suggested:'Suggested a standstill change',standstill_confirmed:'Confirmed a standstill',standstill_resumed:'Resumed discussion',standstill_changed:'Updated a standstill',standstill_withdrawn:'Withdrew a standstill',cosigned:'Co-signed your map'};
const fail=(condition,message='This activity is unavailable.',status=404)=>{if(!condition)throw new AccountError(message,status);};
const validId=id=>typeof id==='string'&&/^[1-9][0-9]{0,19}$/.test(id);
const compareIds=(a,b)=>BigInt(a)<BigInt(b)?-1:BigInt(a)>BigInt(b)?1:0;
const fingerprint=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stableJSON(value))))).map(b=>b.toString(16).padStart(2,'0')).join('');
const tokenFor=(actorId,ids)=>fingerprint([actorId,[...ids].sort(compareIds)]);
function sourceFor(workspace,record){
 const byId=new Map(workspace.discussions.map(r=>[r.id,r])),seen=new Set();let r=record,dispute=null;
 while(r&&!seen.has(r.id)){
  seen.add(r.id);if(r.kind==='interaction'&&r.action==='dispute')dispute=r.id;if(r.standstill?.disputeId)dispute=r.standstill.disputeId;
  if(['node','edge'].includes(r.target?.type)){const source=discussionSource(workspace,r.target);return source?{source,target:r.target,dispute:record.standstill?.disputeId||dispute}:null;}
  r=byId.get(r.target?.entryId);
 }
 return null;
}
export function projectActivity(snapshot,actorId){
 const envelope=projectAccountWorkspace(snapshot,actorId),ws=envelope.workspace;
 const name=id=>ws.participants.find(p=>p.id===id)?.name||'Participant';
 const items=[];
 for(const event of snapshot.events||[]){
  if(event.recipientId&&event.recipientId!==actorId||!validId(String(event.id))||!labels[event.eventType])continue;
  let record,source,route,target,groupKey,comparisonId=event.comparisonId||null,contextLabel;
  if(event.recordKind==='discussion'){
   record=ws.discussions.find(r=>r.id===event.recordId);if(!record)continue;
   const thread=ws.comparisonThreads.find(t=>t.id===record.comparisonId);if(!thread?.participants.includes(actorId)||![thread.aMapId,thread.bMapId].every(id=>ws.maps.some(m=>m.id===id&&!m.unavailable)))continue;
   const resolved=sourceFor(ws,record);if(!resolved)continue;
   if(record.other&&['node','edge'].includes(record.other.type)&&!discussionSource(ws,record.other))continue;
   source=resolved.source;target=record.target;comparisonId=record.comparisonId;
   const mode=record.interaction?.mode||(record.kind==='standstill'?'argument':record.kind==='counterpart'?'compare':'compare');
   route={comparison:comparisonId,view:mode,entry:record.id};
   if(mode==='argument'&&resolved.target.type==='node'){route={...route,view:'dialogue',map:resolved.target.mapId,node:resolved.target.nodeId};}
   groupKey=JSON.stringify([comparisonId,resolved.dispute||resolved.target]);
   contextLabel=`${source.map.name} · ${source.label}`;
  }else if(event.recordKind==='endorsement'){
   record=ws.endorsements.find(r=>r.id===event.recordId);if(!record)continue;
   const map=ws.maps.find(m=>m.id===record.sourceMapId&&!m.unavailable);if(!map||map.ownerId!==actorId)continue;
   const nodeId=record.anchorId||record.entries.find(e=>map.nodes.some(n=>n.id===e.sourceNodeId))?.sourceNodeId;
   source=nodeId?discussionSource(ws,{type:'node',mapId:map.id,nodeId}):{map,label:map.name};if(!source)continue;
   target={type:'node',mapId:map.id,...(nodeId?{nodeId}:{})};route={source:map.id,...(nodeId?{node:nodeId}:{})};
   groupKey=JSON.stringify(['cosign',map.id]);contextLabel=`${map.name}${nodeId?' · '+source.label:''}`;
  }else continue;
  items.push({id:String(event.id),eventType:event.eventType,title:event.eventType==='inquiry'?(DISCUSSION_LABELS[record.action]||labels.inquiry):labels[event.eventType],body:record.body||'',actorName:name(event.authorId),...(event.recorderId?{recorderName:name(event.recorderId)}:{}),contextLabel,createdAt:event.createdAt,read:!!event.read,suppressed:!!event.suppressed,comparisonId,groupKey,target,route,recordId:event.recordId});
 }
 items.sort((a,b)=>compareIds(b.id,a.id));
 const groupCounts=new Map();for(const item of items)groupCounts.set(item.groupKey,(groupCounts.get(item.groupKey)||0)+1);for(const item of items)item.groupCount=groupCounts.get(item.groupKey);
 return {items,envelope:{...envelope,actor:{id:actorId,name:name(actorId)}},mutedComparisons:(snapshot.mutes||[]).filter(id=>ws.comparisonThreads.some(t=>t.id===id&&t.participants.includes(actorId)&&[t.aMapId,t.bMapId].every(mid=>ws.maps.some(m=>m.id===mid&&!m.unavailable))))};
}
function cursorValue(cursor,actorId,filter){
 if(!cursor)return null;
 try{const data=JSON.parse(atob(cursor));fail(data.actorId===actorId&&data.filter===filter&&validId(data.before),'This activity page has expired. Refresh Activity.',400);return data.before;}catch{throw new AccountError('This activity page has expired. Refresh Activity.',400);}
}
export async function handleActivity(store,actor,command,input={}){
 fail(input!==null&&typeof input==='object'&&!Array.isArray(input),'Invalid activity request.',400);
 fail(typeof store.activity==='function','Activity is temporarily unavailable.',503);
 for(let attempt=0;attempt<4;attempt++){
  const snapshot=await store.activity(actor.id,'snapshot',{}),view=projectActivity(snapshot,actor.id),byId=new Map(view.items.map(item=>[item.id,item]));
  if(command==='list'){
   const filter=input.filter||'all';fail(['all','unread'].includes(filter),'Choose All or Unread activity.',400);
   fail(!input.cursor||typeof input.cursor==='string'&&input.cursor.length<=2000,'Invalid activity page.',400);
   const before=cursorValue(input.cursor,actor.id,filter),filtered=view.items.filter(item=>(filter!=='unread'||!item.read&&!item.suppressed)&&(!before||compareIds(item.id,before)<0)),items=filtered.slice(0,50);
   return {actorId:actor.id,items,unreadCount:view.items.filter(item=>!item.read&&!item.suppressed).length,nextCursor:filtered.length>items.length?btoa(JSON.stringify({actorId:actor.id,filter,before:items.at(-1).id})):null,snapshotToken:await tokenFor(actor.id,items.map(item=>item.id)),mutedComparisons:view.mutedComparisons};
  }
  if(command==='open'){
   const item=byId.get(input.id);fail(item);return {actorId:actor.id,item,workspaceEnvelope:view.envelope};
  }
  if(command==='read'){
   fail(Array.isArray(input.ids)&&input.ids.length>0&&input.ids.length<=200&&new Set(input.ids).size===input.ids.length&&input.ids.every(validId)&&typeof input.read==='boolean','Choose activity to mark.',400);
   fail(input.ids.every(id=>byId.has(id)));
   // An explicit item action can omit the list token. A bulk action binds to
   // the exact IDs shown, never a sequence range that consumes later commits.
   if(input.ids.length>1)fail(input.snapshotToken===await tokenFor(actor.id,input.ids),'Refresh this activity list before marking it.',409);
  }else if(command==='mute'){
   fail(typeof input.comparisonId==='string'&&typeof input.muted==='boolean','Choose a comparison to mute.',400);
   fail(view.envelope.workspace.comparisonThreads.some(t=>t.id===input.comparisonId&&t.participants.includes(actor.id)&&[t.aMapId,t.bMapId].every(id=>view.envelope.workspace.maps.some(m=>m.id===id&&!m.unavailable))));
  }else throw new AccountError('Not found.',404);
  try{await store.activity(actor.id,command,{...input,generation:snapshot.revision});return {actorId:actor.id,updated:true};}catch(error){if(error.snapshotChanged)continue;throw error;}
 }
 throw new AccountError('Your activity changed. Refresh and try again.',409);
}
