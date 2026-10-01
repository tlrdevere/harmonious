import {stableJSON} from './account-model.mjs';

export const FACILITATION_CAPABILITY='facilitation-v1';
const same=(a,b)=>stableJSON(a)===stableJSON(b);
export function facilitationChanges(snapshot,changes){
 const items=[];
 for(const c of changes){
  const old=snapshot.records.find(r=>r.kind===c.kind&&r.id===c.id)?.value;
  if(c.kind==='map'){
   for(const key of ['name','visibility'])if(old?.[key]!==c.value[key])items.push({kind:'map',id:c.id,label:key==='visibility'?'Map sharing':'Map name',before:old?.[key]||'',after:c.value[key]});
   for(const collection of ['nodes','relations'])for(const id of new Set([...(old?.[collection]||[]),...(c.value[collection]||[])].map(v=>v.id))){
    const before=old?.[collection]?.find(v=>v.id===id),after=c.value[collection]?.find(v=>v.id===id);
    const fields=[...new Set([...Object.keys(before||{}),...Object.keys(after||{})])].filter(k=>!['ideaId','ideaVersion','reuseMode','copiedFrom'].includes(k)&&!same(before?.[k],after?.[k]));
    if(fields.length)items.push({kind:collection==='nodes'?'node':'connection',mapId:c.id,id,label:after?.title||before?.title||'Connection',before:before||null,after:after||null,fields});
   }
  }else if(c.kind==='discussion')items.push({kind:'discussion',id:c.id,label:c.value.action,before:old||null,after:c.value});
  else if(!['idea','comparison_thread'].includes(c.kind))items.push({kind:c.kind,id:c.id,label:c.kind,before:old||null,after:c.value});
 }
 return items;
}
export function validateFacilitatedBatch(snapshot,participant,changes,{draft=false}={}){
 if(!Array.isArray(changes)||!changes.length||changes.length>30)throw Error('Choose one contribution to record.');
 if(changes.some(c=>!['map','idea','discussion','comparison_thread'].includes(c.kind)))throw Error('This action is not available while facilitating.');
 const maps=changes.filter(c=>c.kind==='map'),discussions=changes.filter(c=>c.kind==='discussion');
 if(maps.length>1||discussions.length>1)throw Error('Record each map change or conversation contribution separately.');
 if(changes.some(c=>c.kind==='comparison_thread')&&(changes.length!==1||draft))throw Error('Open the comparison separately before contributing.');
 if(discussions.some(c=>!['interaction','standstill','correspondence','counterpart','counterpart_unlink','context'].includes(c.value.kind)))throw Error('This earlier contribution type cannot be authored through facilitation.');
 const items=facilitationChanges(snapshot,changes);
 if(!items.length&&!changes.some(c=>c.kind==='comparison_thread'))throw Error('Choose a node, connection or contribution to record.');
 const changedNodes=items.filter(i=>i.kind==='node'),connections=items.filter(i=>i.kind==='connection');
 if(maps.length&&discussions.length){const refs=[discussions[0].value.other,discussions[0].value.interaction?.reference];if(changedNodes.length!==1||changedNodes[0].before||!refs.some(r=>r?.mapId===maps[0].id&&r.nodeId===changedNodes[0].id))throw Error('Record unrelated map and conversation changes separately.');}
 const removal=changedNodes.length>1&&changedNodes.every(i=>i.after===null);
 const newMap=maps.length===1&&!snapshot.records.some(r=>r.kind==='map'&&r.id===maps[0].id);
 if(changedNodes.length>1&&!removal&&!newMap||connections.length>1&&!removal&&!newMap)throw Error('Finish one node or connection before recording another.');
 if(draft&&(items.some(i=>!['node','discussion','connection'].includes(i.kind))||changedNodes.some(i=>!i.after||i.fields.includes('confidence')&&(i.before||i.after.confidence!==null))||connections.some(i=>i.before||!changedNodes.some(n=>!n.before&&[i.after?.from,i.after?.to].includes(n.id)))||discussions.some(c=>c.value.action==='respond'&&c.value.interaction?.options?.some(o=>o!=='reply')||c.value.kind!=='interaction'||!['dispute','respond'].includes(c.value.action)||c.value.status!=='active')))throw Error('Drafts support node wording, disputes and replies. Record other actions only at the participant’s direction.');
 return items;
}
export function validateFacilitationHistory(ws){
 if(ws.facilitationHistory===undefined)return;
 if(!Array.isArray(ws.facilitationHistory)||ws.facilitationHistory.length>50000)throw Error('Invalid facilitator history.');
 const ids=new Set();for(const r of ws.facilitationHistory){
  if(!r||typeof r.id!=='string'||ids.has(r.id)||typeof r.operatorId!=='string'||typeof r.participantId!=='string'||typeof r.recordId!=='string'||!['map','discussion'].includes(r.kind)||!Number.isSafeInteger(r.revision)||r.revision<1||!['direct','directed','verbal'].includes(r.method)||!Array.isArray(r.nodes)||!Array.isArray(r.connections)||typeof r.at!=='string'||!Number.isFinite(Date.parse(r.at)))throw Error('Invalid facilitator attribution.');ids.add(r.id);
 }
}
export function facilitatorHistory(ws,{kind,id,nodeId=null,connectionId=null}){return (ws.facilitationHistory||[]).filter(r=>r.kind===kind&&r.recordId===id&&(!nodeId||r.nodes.includes(nodeId))&&(!connectionId||r.connections.includes(connectionId)));}
export function facilitatorLabel(ws,records){
 const last=records.at(-1);if(!last)return '';const name=id=>ws.participants.find(p=>p.id===id)?.name||'Participant';
 if(last.draftId&&last.method==='direct')return `Entered by ${name(last.enteredBy)} · Approved by ${name(last.participantId)}`;
 return last.operatorId===last.participantId?(records.some(r=>r.operatorId!==r.participantId||r.enteredBy&&r.enteredBy!==r.participantId)?'Facilitated history':''):last.method==='verbal'?`Approval recorded by ${name(last.operatorId)}`:`Entered by ${name(last.operatorId)}`;
}
