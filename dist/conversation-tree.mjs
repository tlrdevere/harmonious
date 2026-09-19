import {stableJSON} from './account-model.mjs';

// Direction and record type do not multiply the visible edge. Saved meanings
// remain separate records, grouped behind one connection on the canvas.
export const visibleNodePairKey=(a,b)=>JSON.stringify([a,b].sort());
export function groupSourceConnections(edges){
  const groups=new Map();
  for(const edge of edges){const key=visibleNodePairKey(edge.from,edge.to);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(edge);}
  return [...groups.values()];
}
export function groupComparisonConnections(records,endpoint){
  const groups=new Map();
  for(const r of records){const a=endpoint(r.target),b=endpoint(r.other);if(!a||!b||a===b)continue;const key=visibleNodePairKey(a,b);if(!groups.has(key))groups.set(key,{key,records:[]});groups.get(key).records.push(r);}
  return [...groups.values()];
}

export function conversationAnchor(records,entry){
  const byId=new Map(records.map(r=>[r.id,r])),seen=new Set();let target=entry.target;
  while(target?.type==='entry'){
    if(seen.has(target.entryId))return null;seen.add(target.entryId);
    const parent=byId.get(target.entryId);if(!parent)return null;
    if(['relationship','correspondence'].includes(parent.kind))return target;
    target=parent.target;
  }
  return target;
}
export function challengeState(records,entry){
  if(entry.status==='withdrawn')return 'Withdrawn';
  const events=records.filter(r=>r.status==='active'&&r.kind==='reply'&&r.authorId===entry.authorId&&r.target.entryId===entry.id&&['resolve','reopen'].includes(r.action)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
  return events.at(-1)?.action==='resolve'?'Resolved by challenger':'Open';
}
export function conversationGroups(records){
  const groups=new Map();
  for(const r of records){
    if(r.status!=='active'||['relationship','correspondence','context'].includes(r.kind))continue;
    const target=conversationAnchor(records,r);if(!target)continue;
    const key=stableJSON(target);if(!groups.has(key))groups.set(key,{key,target,entries:[],questions:0,challenges:0,openChallenges:0});
    const g=groups.get(key);g.entries.push(r);
    if(r.kind==='argument'){g.challenges++;if(challengeState(records,r)==='Open')g.openChallenges++;}
    else if(r.kind!=='reply')g.questions++;
  }
  return [...groups.values()];
}
