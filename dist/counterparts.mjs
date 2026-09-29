// Counterpart identity is independent of agreement or disagreement.
export const counterpartResponseActions=['no_position','not_applicable','close_request','reopen_request'];
export function counterpartFrame(map,id){
  const byId=new Map((map?.nodes||[]).map(n=>[n.id,n])),seen=new Set();let n=byId.get(id);
  while(n?.parent){if(seen.has(n.id))return null;seen.add(n.id);n=byId.get(n.parent);}return n?.id||null;
}
export const sameCounterpartSource=(a,b)=>a?.type==='node'&&b?.type==='node'&&a.mapId===b.mapId&&a.nodeId===b.nodeId;
export const sameCounterpartPair=(r,target,other)=>sameCounterpartSource(r.target,target)&&sameCounterpartSource(r.other,other)||sameCounterpartSource(r.target,other)&&sameCounterpartSource(r.other,target);
const counterpartOrder=(a,b)=>(a.kind==='correspondence'?0:1)-(b.kind==='correspondence'?0:1)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id);
// This projection reads only the records already supplied to the participant.
// Missing source cards must not erase a permitted, deliberately saved link.
export function counterpartRecords(ws,comparisonId){
  const thread=ws.comparisonThreads?.find(t=>t.id===comparisonId);if(!thread)return [];
  const ids=[thread.aMapId,thread.bMapId];
  const receipts=(ws.discussions||[]).filter(r=>r.comparisonId===comparisonId&&r.kind==='counterpart_unlink'&&r.status==='active');
  return (ws.discussions||[]).filter(r=>r.comparisonId===comparisonId&&r.status==='active'&&['correspondence','relationship'].includes(r.kind)&&r.target?.type==='node'&&r.other?.type==='node'&&r.target.mapId!==r.other.mapId&&ids.includes(r.target.mapId)&&ids.includes(r.other.mapId)&&!receipts.some(u=>u.unlinkedRecordIds?.includes(r.id)&&sameCounterpartPair(u,r.target,r.other))).sort(counterpartOrder);
}
export function counterpartLinks(ws,comparisonId){
  const available=t=>ws.maps.find(m=>m.id===t?.mapId&&!m.unavailable)?.nodes.some(n=>n.id===t.nodeId);
  return counterpartRecords(ws,comparisonId).filter(r=>available(r.target)&&available(r.other));
}
// Only new links use these eligibility rules. Historical pairs remain readable.
export function counterpartLinkProblem(ws,comparisonId,target,other,{excludeId}={}){
  const thread=ws.comparisonThreads?.find(t=>t.id===comparisonId),ids=thread&&[thread.aMapId,thread.bMapId];
  if(!ids||target?.type!=='node'||other?.type!=='node'||target.mapId===other.mapId||![target.mapId,other.mapId].every(id=>ids.includes(id)))return 'Choose one node from each map in this comparison.';
  const sources=[target,other].map(t=>{const map=ws.maps.find(m=>m.id===t.mapId&&!m.unavailable);return {map,node:map?.nodes.find(n=>n.id===t.nodeId)};});
  if(sources.some(s=>!s.node))return 'The source changed. Choose an available node before linking.';
  if(sources.some(s=>s.node.parent===null))return 'Choose ordinary nodes; frame headings already correspond.';
  if(counterpartFrame(sources[0].map,target.nodeId)!==counterpartFrame(sources[1].map,other.nodeId))return 'Choose a counterpart in the same frame.';
  const occupied=counterpartRecords(ws,comparisonId).filter(r=>r.id!==excludeId);
  if(occupied.some(r=>!sameCounterpartPair(r,target,other)&&[target,other].some(t=>sameCounterpartSource(r.target,t)||sameCounterpartSource(r.other,t))))return 'One of these nodes already has a counterpart. Unlink its current counterpart first.';
  return '';
}
export function counterpartUnlinkInput(ws,comparisonId,target,other){
  const unlinkedRecordIds=counterpartRecords(ws,comparisonId).filter(r=>sameCounterpartPair(r,target,other)).map(r=>r.id).sort();
  if(!unlinkedRecordIds.length)throw Error('These nodes are no longer linked. Reopen their counterpart details.');
  return {kind:'counterpart_unlink',action:'unlink_counterpart',comparisonId,target,other,unlinkedRecordIds};
}
export function counterpartPairs(ws,comparisonId,target){
  const pairs=new Map();
  for(const record of counterpartLinks(ws,comparisonId)){
    const other=sameCounterpartSource(record.target,target)?record.other:sameCounterpartSource(record.other,target)?record.target:null;if(!other)continue;
    const key=JSON.stringify([other.mapId,other.nodeId]);if(!pairs.has(key))pairs.set(key,{other,records:[]});pairs.get(key).records.push(record);
  }
  return [...pairs.values()];
}
export function counterpartState(ws,comparisonId,target,{endpoint,adjacent}={}){
  const sourceMap=ws.maps.find(m=>m.id===target?.mapId),pairs=new Map();
  const classify=other=>{
    const map=ws.maps.find(m=>m.id===other.mapId);let status=endpoint?.(other)?.status;
    if(!status)status=!map||map.unavailable?'unavailable':map.nodes.some(n=>n.id===other.nodeId)?'visible':'missing';
    if(status==='visible'&&counterpartFrame(sourceMap,target.nodeId)!==counterpartFrame(map,other.nodeId))status='cross-frame';
    return status;
  };
  for(const record of counterpartRecords(ws,comparisonId)){
    const other=sameCounterpartSource(record.target,target)?record.other:sameCounterpartSource(record.other,target)?record.target:null;if(!other)continue;
    const key=JSON.stringify([other.mapId,other.nodeId]);if(!pairs.has(key))pairs.set(key,{other,status:classify(other),records:[]});pairs.get(key).records.push(record);
  }
  const requests=(ws.discussions||[]).filter(r=>r.comparisonId===comparisonId&&r.kind==='counterpart'&&sameCounterpartSource(r.target,target)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)),request=requests.at(-1),linked=[...pairs.values()];
  if(linked.length){
    const unavailable=linked.every(p=>['missing','unavailable'].includes(p.status));
    const labels={visible:'Linked elsewhere',collapsed:'Counterpart in collapsed branch',filtered:'Counterpart in hidden frame','cross-frame':'Counterpart in another frame',missing:'Counterpart unavailable',unavailable:'Counterpart unavailable'};
    return {kind:unavailable?'unavailable':'linked',label:linked.length>1?`Linked counterparts (${linked.length})`:linked[0].status==='visible'&&adjacent?.(linked[0].other)?'Counterpart linked':labels[linked[0].status],pairs:linked,count:linked.length,request,requests};
  }
  if(request){const state=counterpartRequestState(ws,request);return {kind:state==='Awaiting counterpart'?'requested':'request-state',label:state==='Awaiting counterpart'?'Counterpart requested':state,pairs:[],count:0,request,requests};}
  return {kind:'unlinked',label:'No counterpart linked',pairs:[],count:0,request:null,requests};
}
export function counterpartRequestState(ws,r){
  if(r.status!=='active')return 'Request closed';
  if(counterpartLinks(ws,r.comparisonId).some(e=>sameCounterpartSource(e.target,r.target)||sameCounterpartSource(e.other,r.target)))return 'Counterpart linked';
  const last=(ws.discussions||[]).filter(e=>e.status==='active'&&e.kind==='reply'&&e.target.entryId===r.id&&counterpartResponseActions.includes(e.action)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).at(-1);
  return ({no_position:'No position yet',not_applicable:'Not applicable',close_request:'Request closed'})[last?.action]||'Awaiting counterpart';
}
export function comparisonCounterparts(ws,states){
  const ids=['a','b'].map(s=>states[s].map?.id),thread=ws.comparisonThreads?.find(t=>ids.includes(t.aMapId)&&ids.includes(t.bMapId)&&t.aMapId!==t.bMapId);
  if(!ids.every(Boolean)||ids[0]===ids[1]||['a','b'].some(side=>states[side].map.unavailable))return {links:[],reserved:[]};
  const links=thread?counterpartRecords(ws,thread.id):[],reserved=[];
  const add=target=>{const map=ws.maps.find(m=>m.id===target?.mapId&&!m.unavailable),n=map?.nodes.find(n=>n.id===target.nodeId);if(!n||n.parent===null||links.some(r=>sameCounterpartSource(r.target,target)||sameCounterpartSource(r.other,target))||reserved.some(t=>sameCounterpartSource(t,target)))return;reserved.push(target);};
  for(const r of ws.discussions||[])if(r.kind==='counterpart'&&r.comparisonId===thread?.id&&counterpartRequestState(ws,r)==='Awaiting counterpart')add(r.target);
  return {links,reserved};
}
