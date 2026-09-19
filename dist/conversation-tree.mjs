import {stableJSON} from './account-model.mjs';
import {isReason,isChallenge} from './discussion.mjs';

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
  while(['entry','inference'].includes(target?.type)){
    if(seen.has(target.entryId))return null;seen.add(target.entryId);
    const parent=byId.get(target.entryId);if(!parent)return null;
    if(['relationship','correspondence'].includes(parent.kind))return target;
    target=parent.target;
  }
  return target;
}
export function challengeState(records,entry){
  if(!isChallenge(entry))return null;
  if(entry.status==='withdrawn')return 'Withdrawn';
  const events=records.filter(r=>r.status==='active'&&r.kind==='reply'&&r.authorId===entry.authorId&&r.target.entryId===entry.id&&['resolve','reopen'].includes(r.action)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
  return events.at(-1)?.action==='resolve'?'Resolved by challenger':'Open';
}
export function conversationGroups(records){
  const groups=new Map();
  for(const r of records){
    if(r.status!=='active'||['relationship','correspondence','context'].includes(r.kind))continue;
    const target=conversationAnchor(records,r);if(!target)continue;
    const key=stableJSON(target);if(!groups.has(key))groups.set(key,{key,target,entries:[],questions:0,reasons:0,challenges:0,openChallenges:0});
    const g=groups.get(key);g.entries.push(r);
    if(isReason(r))g.reasons++;
    else if(isChallenge(r)){g.challenges++;if(challengeState(records,r)==='Open')g.openChallenges++;}
    else if(r.kind!=='reply')g.questions++;
  }
  return [...groups.values()];
}

// A display projection only: cards and support connections are derived from
// the existing contributions, never persisted as another graph collection.
export function reasoningBranch(records,anchor){
  const key=stableJSON(anchor),byId=new Map(records.map(r=>[r.id,r])),anchors=new Map(),needed=new Set(),ordinary=new Set();
  const anchorOf=entry=>{
    const path=[],seen=new Set();let current=entry,result=null;
    while(current){
      if(anchors.has(current.id)){result=anchors.get(current.id);break;}
      if(seen.has(current.id))break;seen.add(current.id);path.push(current.id);
      const target=current.target;
      if(!['entry','inference'].includes(target?.type)){result=target;break;}
      const parent=byId.get(target.entryId);if(!parent)break;
      if(['relationship','correspondence'].includes(parent.kind)){result={type:'entry',entryId:parent.id};break;}
      current=parent;
    }
    for(const id of path)anchors.set(id,result);return result;
  };
  for(const r of records){
    if(r.status!=='active'||!(r.kind==='argument'||r.kind==='reply'&&r.layer==='arguments'&&r.action==='reply')||stableJSON(anchorOf(r))!==key)continue;
    ordinary.add(r.id);let current=r;
    while(current&&!needed.has(current.id)){
      needed.add(current.id);
      if(!['entry','inference'].includes(current.target.type)||stableJSON(current.target)===key)break;
      const parent=byId.get(current.target.entryId);if(!parent||['relationship','correspondence'].includes(parent.kind))break;current=parent;
    }
  }
  const byTime=(a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id),roots=[],children=new Map();
  for(const id of needed){const r=byId.get(id),parent=['entry','inference'].includes(r.target.type)&&needed.has(r.target.entryId)?r.target.entryId:null;if(parent){if(!children.has(parent))children.set(parent,[]);children.get(parent).push(r);}else roots.push(r);}
  roots.sort(byTime);for(const values of children.values())values.sort(byTime);
  const entries=[];for(let i=0;i<roots.length;i++){const r=roots[i];entries.push(r);roots.push(...(children.get(r.id)||[]));}
  const placeholders=entries.filter(r=>!ordinary.has(r.id)).map(r=>({entryId:r.id,withdrawn:r.status==='withdrawn',contextOnly:r.status==='active'}));
  return {target:anchor,entries,placeholders,reasons:entries.filter(r=>r.status==='active'&&isReason(r)),challenges:entries.filter(r=>r.status==='active'&&isChallenge(r)),connections:entries.filter(isReason).map(reason=>({id:`inference:${reason.id}`,reasonId:reason.id,from:{type:'entry',entryId:reason.id},to:reason.target,target:{type:'inference',entryId:reason.id},withdrawn:reason.status==='withdrawn'}))};
}

// A limit must never keep a child while dropping its displayed parent. Prefer
// the focused chain when it fits; otherwise keep a truthful root-first prefix.
export function selectReasoningEntries(branch,max=40,focusId=null){
  const limit=Math.max(1,Math.floor(max)||40),byId=new Map(branch.entries.map(r=>[r.id,r])),selected=new Set(),chain=[],seen=new Set();let current=byId.get(focusId);
  while(current&&!seen.has(current.id)){seen.add(current.id);chain.push(current.id);current=['entry','inference'].includes(current.target.type)?byId.get(current.target.entryId):null;}
  const focusOmitted=chain.length>limit;
  if(!focusOmitted)for(const id of chain)selected.add(id);
  for(const r of branch.entries){if(selected.size>=limit)break;const parent=['entry','inference'].includes(r.target.type)&&byId.has(r.target.entryId)?r.target.entryId:null;if(!parent||selected.has(parent))selected.add(r.id);}
  const entries=branch.entries.filter(r=>selected.has(r.id));
  return {entries,hiddenCount:branch.entries.length-entries.length,focusOmitted};
}
