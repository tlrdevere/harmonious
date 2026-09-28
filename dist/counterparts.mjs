// Counterpart identity is independent of agreement or disagreement.
export const counterpartResponseActions=['no_position','not_applicable','close_request','reopen_request'];
export function counterpartFrame(map,id){
  const byId=new Map((map?.nodes||[]).map(n=>[n.id,n])),seen=new Set();let n=byId.get(id);
  while(n?.parent){if(seen.has(n.id))return null;seen.add(n.id);n=byId.get(n.parent);}return n?.id||null;
}
export const sameCounterpartSource=(a,b)=>a?.type==='node'&&b?.type==='node'&&a.mapId===b.mapId&&a.nodeId===b.nodeId;
export function counterpartLinks(ws,comparisonId){
  const available=t=>ws.maps.find(m=>m.id===t?.mapId&&!m.unavailable)?.nodes.some(n=>n.id===t.nodeId);
  return (ws.discussions||[]).filter(r=>r.comparisonId===comparisonId&&r.status==='active'&&['correspondence','relationship'].includes(r.kind)&&available(r.target)&&available(r.other))
    .sort((a,b)=>(a.kind==='correspondence'?0:1)-(b.kind==='correspondence'?0:1)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
}
export function counterpartPairs(ws,comparisonId,target){
  const pairs=new Map();
  for(const record of counterpartLinks(ws,comparisonId)){
    const other=sameCounterpartSource(record.target,target)?record.other:sameCounterpartSource(record.other,target)?record.target:null;if(!other)continue;
    const key=JSON.stringify([other.mapId,other.nodeId]);if(!pairs.has(key))pairs.set(key,{other,records:[]});pairs.get(key).records.push(record);
  }
  return [...pairs.values()];
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
  const links=thread?counterpartLinks(ws,thread.id):[],reserved=[];
  const add=target=>{const map=ws.maps.find(m=>m.id===target?.mapId&&!m.unavailable),n=map?.nodes.find(n=>n.id===target.nodeId);if(!n||n.parent===null||links.some(r=>sameCounterpartSource(r.target,target)||sameCounterpartSource(r.other,target))||reserved.some(t=>sameCounterpartSource(t,target)))return;reserved.push(target);};
  for(const r of ws.discussions||[])if(r.kind==='counterpart'&&r.comparisonId===thread?.id&&counterpartRequestState(ws,r)==='Awaiting counterpart')add(r.target);
  return {links,reserved};
}
