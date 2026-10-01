// Account storage is separate from the facilitator-operated file format.
export const accountKey=(kind,id)=>JSON.stringify([kind,id]);
export const accountClone=value=>JSON.parse(JSON.stringify(value));
export function stableJSON(value){
  if(Array.isArray(value))return '['+value.map(stableJSON).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableJSON(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
export function ownedAccountRecords(workspace,actorId,ownedKeys=[]){
  const known=new Set(ownedKeys),maps=workspace.maps.filter(m=>m.ownerId===actorId&&!m.unavailable&&!m.deletedAt),mapIds=new Set(maps.map(m=>m.id)),records=[];
  const add=(kind,value)=>records.push({kind,id:value.id,value:accountClone(value)});
  const person=workspace.participants.find(p=>p.id===actorId);if(person)add('profile',person);
  for(const m of maps)add('map',m);
  for(const i of workspace.ideas)if(mapIds.has(i.originMapId)||known.has(accountKey('idea',i.id)))add('idea',i);
  for(const e of workspace.endorsements)if(e.participantId===actorId){const value=accountClone(e);for(const entry of value.entries)delete entry.serverIssue;add('endorsement',value);}
  for(const thread of workspace.comparisonThreads||[])add('comparison_thread',thread);
  for(const c of workspace.comparisons)add('comparison',c);
  for(const node of workspace.argumentNodes||[])if(node.authorId===actorId)add('argument_node',node);
  for(const edge of workspace.argumentEdges||[])if(edge.authorId===actorId)add('argument_edge',edge);
  for(const item of workspace.discussions||[])if(item.authorId===actorId)add('discussion',item);
  for(const d of workspace.definitions||[])if(d.authorId===actorId)add('definition',d);
  return records;
}
export function accountChanges(records,baseline,revisions){
  return records.filter(r=>stableJSON(r.value)!==stableJSON(baseline.get(accountKey(r.kind,r.id))))
    .map(r=>({...r,expectedRevision:revisions[accountKey(r.kind,r.id)]||0}));
}
