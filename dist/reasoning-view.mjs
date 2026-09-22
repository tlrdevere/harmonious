import {stableJSON} from './account-model.mjs';
import {isReason,isChallenge} from './discussion.mjs';
import {isReflection,isDisagreementPoint,isReflectionOutcome,REFLECTION_CATEGORIES,REFLECTION_RESULTS} from './reflection.mjs';

export const reasoningTargetKey=target=>stableJSON(target);
const entryTarget=id=>({type:'entry',entryId:id});
const inferenceTarget=id=>({type:'inference',entryId:id});
const hasParent=target=>['entry','inference'].includes(target?.type);
const ordinary=r=>r.status==='active'&&(r.kind==='argument'||r.kind==='reply'&&r.layer==='arguments'&&r.action==='reply');
const byTime=(a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id);

// One index per refreshed Comparison. Target type is part of its identity:
// a reason's statement and its support connection have independent follow-ups.
export function buildReasoningIndex(records){
  const byId=new Map(records.map(r=>[r.id,r])),childrenByTarget=new Map(),childrenById=new Map(),parentById=new Map(),roots=[],latest=new Map();
  for(const r of records){
    const key=reasoningTargetKey(r.target);if(!childrenByTarget.has(key))childrenByTarget.set(key,[]);childrenByTarget.get(key).push(r);
    const parent=hasParent(r.target)&&byId.has(r.target.entryId)?r.target.entryId:null;parentById.set(r.id,parent);
    if(parent){if(!childrenById.has(parent))childrenById.set(parent,[]);childrenById.get(parent).push(r);}else roots.push(r);
    if(r.status==='active'&&r.kind==='reply'&&['resolve','reopen'].includes(r.action)){
      const challenge=byId.get(r.target.entryId);if(challenge&&isChallenge(challenge)&&challenge.authorId===r.authorId){const previous=latest.get(challenge.id);if(!previous||byTime(previous,r)<0)latest.set(challenge.id,r);}
    }
  }
  for(const list of [...childrenByTarget.values(),...childrenById.values()])list.sort(byTime);roots.sort(byTime);
  const ordered=[];for(let i=0;i<roots.length;i++){const r=roots[i];ordered.push(r);roots.push(...(childrenById.get(r.id)||[]));}
  const openChallenges=new Set(records.filter(r=>r.status==='active'&&isChallenge(r)&&latest.get(r.id)?.action!=='resolve').map(r=>r.id)),anchorById=new Map();
  for(const r of ordered){
    const parent=byId.get(parentById.get(r.id));
    anchorById.set(r.id,['relationship','correspondence'].includes(r.kind)?entryTarget(r.id):parent?(['relationship','correspondence'].includes(parent.kind)?entryTarget(parent.id):anchorById.get(parent.id)):hasParent(r.target)?null:r.target);
  }
  const subtree=new Map();
  for(const r of [...ordered].reverse()){
    const counts={total:ordinary(r)?1:0,openChallenges:openChallenges.has(r.id)?1:0};
    for(const child of childrenById.get(r.id)||[]){const c=subtree.get(child.id);if(c){counts.total+=c.total;counts.openChallenges+=c.openChallenges;}}
    subtree.set(r.id,counts);
  }
  return {records,byId,ordered,childrenByTarget,childrenById,parentById,anchorById,openChallenges,subtree};
}

const recordPath=(index,id,stop=null)=>{const path=[],seen=new Set();let r=index.byId.get(id);while(r&&!seen.has(r.id)&&r.id!==stop){seen.add(r.id);path.push(r);r=index.byId.get(index.parentById.get(r.id));}return path;};

export function projectReasoning(index,{anchor,collapsed=new Set(),focusId=null,pinnedIds=[],budget=40,revealFocus=false}={}){
  // Attached annotations are searchable, but are never graph cards, including
  // when a restored view or caller passes one as a focused/pinned contribution.
  if(isReflection(index.byId.get(focusId)))focusId=null;
  pinnedIds=pinnedIds.filter(id=>!isReflection(index.byId.get(id)));
  const limit=Math.max(3,Math.min(40,Number.isFinite(budget)?Math.floor(budget):40)),anchorKey=reasoningTargetKey(anchor),anchorId=anchor?.type==='entry'?anchor.entryId:null;
  const needed=new Set(),eligible=new Set(),pinned=new Set(),effectiveFolds=new Set(collapsed),revealedFoldKeys=[];
  const needPath=id=>{let p=index.byId.get(id);const seen=new Set();while(p&&p.id!==anchorId&&!needed.has(p.id)&&!seen.has(p.id)){seen.add(p.id);if(!isReflection(p))needed.add(p.id);p=index.byId.get(index.parentById.get(p.id));}};
  for(const r of index.ordered){
    if(!ordinary(r)||reasoningTargetKey(index.anchorById.get(r.id))!==anchorKey)continue;
    eligible.add(r.id);needPath(r.id);
  }
  const focused=index.byId.get(focusId);if(focused&&focused.status==='active'&&reasoningTargetKey(index.anchorById.get(focusId))===anchorKey)needPath(focusId);
  for(const id of pinnedIds){const r=index.byId.get(id);if(r&&reasoningTargetKey(index.anchorById.get(id))===anchorKey){needPath(id);for(const p of recordPath(index,id,anchorId))pinned.add(p.id);}}
  if(revealFocus&&needed.has(focusId))for(const r of recordPath(index,focusId,anchorId)){const key=reasoningTargetKey(r.target);if(effectiveFolds.delete(key))revealedFoldKeys.push(key);}
  const candidates=[],foldHidden=new Set(),blocked=new Map();
  for(const r of index.ordered){
    if(!needed.has(r.id))continue;
    const key=reasoningTargetKey(r.target),parent=index.parentById.get(r.id),block=blocked.get(parent)||(effectiveFolds.has(key)?key:null);blocked.set(r.id,block);
    if(block&&!pinned.has(r.id)){if(eligible.has(r.id))foldHidden.add(r.id);continue;}
    candidates.push(r);
  }
  // Keep context only while an active visible descendant requires it.
  const candidateIds=new Set(candidates.map(r=>r.id)),useful=new Set();
  for(const r of candidates)if(eligible.has(r.id)||pinned.has(r.id)||r.id===focusId){let p=r;while(p&&p.id!==anchorId&&candidateIds.has(p.id)&&!useful.has(p.id)){useful.add(p.id);p=index.byId.get(index.parentById.get(p.id));}}
  const available=candidates.filter(r=>useful.has(r.id)),availableIds=new Set(available.map(r=>r.id)),selected=new Set();
  const focusPath=availableIds.has(focusId)?recordPath(index,focusId,anchorId).filter(r=>availableIds.has(r.id)):[];
  const requiredGroup=id=>{
    const ids=new Set();const r=index.byId.get(id);if(!r||!availableIds.has(id))return ids;ids.add(id);
    if(r.target.type==='inference'){
      const reason=index.byId.get(r.target.entryId);if(reason&&availableIds.has(reason.id)){ids.add(reason.id);if(reason.target.type==='entry'&&availableIds.has(reason.target.entryId))ids.add(reason.target.entryId);}
    }
    return ids;
  };
  const addGroup=id=>{const ids=requiredGroup(id);if(new Set([...selected,...ids]).size>limit)return false;for(const value of ids)selected.add(value);return true;};
  // A long path becomes a real contiguous section, not a pretend edge to the
  // original map. Its omitted parent is exposed below as an Earlier steps control.
  for(const id of [...new Set([...pinnedIds,focusId].filter(Boolean))])if(availableIds.has(id))addGroup(id);
  const priorityPaths=[...pinnedIds.filter(id=>availableIds.has(id)).map(id=>recordPath(index,id,anchorId)),focusPath];
  const deep=priorityPaths.some(path=>path.length>limit),ancestryBudget=deep?Math.min(12,limit):limit;
  for(let depth=0;depth<ancestryBudget&&selected.size<limit;depth++)for(const path of priorityPaths){const r=path[depth];if(r&&availableIds.has(r.id))addGroup(r.id);}
  if(!selected.size){for(const r of available){if(selected.size>=limit)break;const parent=index.parentById.get(r.id);if(parent&&availableIds.has(parent)&&!selected.has(parent))continue;addGroup(r.id);}}
  else{
    const queue=index.ordered.filter(r=>selected.has(r.id));const visited=new Set(queue.map(r=>r.id));
    for(let i=0;i<queue.length&&selected.size<limit;i++)for(const child of index.childrenById.get(queue[i].id)||[]){if(visited.has(child.id)||!availableIds.has(child.id))continue;visited.add(child.id);if(addGroup(child.id))queue.push(child);}
    // Separate roots are useful in short groups, but never substitute for an
    // omitted ancestor in a bounded deep-chain section.
    if(!deep)for(const r of available){if(selected.size>=limit)break;const parent=index.parentById.get(r.id);if(!parent||!availableIds.has(parent)||selected.has(parent))addGroup(r.id);}
  }
  const entries=available.filter(r=>selected.has(r.id)),links=[],earlierSteps=[];
  for(const r of entries){
    const target=r.target;let visible=!hasParent(target)||target.type==='entry'&&target.entryId===anchorId;
    if(target.type==='entry'&&selected.has(target.entryId))visible=true;
    if(target.type==='inference'){
      const reason=index.byId.get(target.entryId);visible=selected.has(target.entryId)&&!!reason&&(!hasParent(reason.target)||reason.target.type==='entry'&&(selected.has(reason.target.entryId)||reason.target.entryId===anchorId));
    }
    if(visible)links.push({entryId:r.id,target,kind:isReason(r)?'supports':isChallenge(r)?'challenge':'response'});
    else if(hasParent(target)){
      const omitted=recordPath(index,target.entryId,anchorId).filter(p=>!selected.has(p.id));
      if(omitted.length)earlierSteps.push({entryId:r.id,target,count:omitted.length,firstOmittedId:target.entryId,label:`Earlier steps · ${omitted.length}`});
    }
  }
  const folds=new Map();
  for(const target of [anchor,...entries.flatMap(r=>[entryTarget(r.id),...(isReason(r)?[inferenceTarget(r.id)]:[])])].filter(Boolean)){
    const key=reasoningTargetKey(target),children=(index.childrenByTarget.get(key)||[]).filter(r=>needed.has(r.id));let total=0,hidden=0,openChallenges=0,totalOpenChallenges=0;
    for(const child of children){const counts=index.subtree.get(child.id);total+=counts?.total||0;totalOpenChallenges+=counts?.openChallenges||0;const stack=[child];for(let i=0;i<stack.length;i++){const r=stack[i];if(foldHidden.has(r.id)){hidden++;if(index.openChallenges.has(r.id))openChallenges++;}stack.push(...(index.childrenById.get(r.id)||[]));}}
    if(total)folds.set(key,{target,total,hidden,openChallenges,totalOpenChallenges,directChallenges:children.filter(r=>r.status==='active'&&isChallenge(r)).length,collapsed:effectiveFolds.has(key)});
  }
  return {entries,links,folds,hiddenByFold:foldHidden.size,overflowCount:available.filter(r=>eligible.has(r.id)&&!selected.has(r.id)).length,earlierSteps,revealedFoldKeys,focusHidden:!!focusId&&focusId!==anchorId&&!selected.has(focusId)};
}

export function searchReasoning(index,{query='',filter='all',authorName=id=>id,limit=200,includeWithdrawn=false}={}){
  const words=String(query).trim().toLocaleLowerCase().split(/\s+/).filter(Boolean),results=[];
  for(const entry of index.ordered){
    if(entry.kind==='context'||entry.status!=='active'&&!includeWithdrawn)continue;
    const openChallenge=index.openChallenges.has(entry.id);if(filter==='open'&&!openChallenge)continue;
    const parent=index.byId.get(entry.target.entryId),targetType=entry.target.type==='inference'?'Reasoning connection':entry.target.type==='node'?'Position':entry.target.type==='edge'?'Map connection':isDisagreementPoint(parent)?'Point of disagreement':isReason(parent)?'Reason statement':parent?.kind==='reply'?'Response':isChallenge(parent)?'Challenge':['relationship','correspondence'].includes(parent?.kind)?'Relationship':parent?.kind==='inquiry'?'Question':'Contribution';
    const type=isDisagreementPoint(entry)?'Point of disagreement':isReflectionOutcome(entry)?'Outcome':isReason(entry)?'Reason':isChallenge(entry)?'Challenge':entry.kind==='reply'?'Response':entry.kind==='inquiry'?'Question':entry.kind==='relationship'?'Relationship':entry.kind==='correspondence'?'Counterpart link':'Request';
    const metadata=isReflection(entry)?[REFLECTION_CATEGORIES[entry.reflection?.category],REFLECTION_RESULTS[entry.reflection?.result],entry.reflection?.nextStep].filter(Boolean):[];
    const text=[entry.body,entry.targetLabel,authorName(entry.authorId),type,targetType,...['title','summary','details'].map(key=>entry.premise?.wording?.[key]),...metadata].join(' ').toLocaleLowerCase();if(!words.every(word=>text.includes(word)))continue;
    results.push({entry,type,targetType,anchor:index.anchorById.get(entry.id),openChallenge});
  }
  return {results:results.slice(0,Math.max(1,limit)),total:results.length};
}

export class ReasoningViewState{
  constructor(){this.scopes=new Map();}
  get(actorId,threadId,anchor){const key=stableJSON([actorId,threadId,anchor]);if(!this.scopes.has(key))this.scopes.set(key,{actorId,threadId,anchor:structuredClone(anchor),collapsed:new Set(),focusId:null,camera:null});return this.scopes.get(key);}
  reset(){this.scopes.clear();}
  clearThread(actorId,threadId){for(const [key,value]of this.scopes)if(value.actorId===actorId&&value.threadId===threadId)this.scopes.delete(key);}
  prune(actorId,threadId,allowedIds){const allowed=allowedIds instanceof Set?allowedIds:new Set(allowedIds);for(const [key,value]of this.scopes){if(value.actorId!==actorId){this.scopes.delete(key);continue;}if(value.threadId!==threadId)continue;if(hasParent(value.anchor)&&!allowed.has(value.anchor.entryId)){this.scopes.delete(key);continue;}if(value.focusId&&!allowed.has(value.focusId))value.focusId=null;for(const folded of value.collapsed){try{const target=JSON.parse(folded);if(hasParent(target)&&!allowed.has(target.entryId))value.collapsed.delete(folded);}catch{value.collapsed.delete(folded);}}}}
}
