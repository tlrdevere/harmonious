import {roots} from './data.mjs';
import {graphEdges} from './model.mjs';
import {discussionHealth,discussionSnapshots} from './discussion.mjs';
import {stableJSON} from './account-model.mjs';

export const REFLECTION_CATEGORIES={'':'Unspecified',facts:'Facts',reasoning:'Reasoning',values:'Values',other:'Other'};
export const REFLECTION_RESULTS={'':'Unspecified',changed_position:'Changed my position',more_work:'More work needed',difference_understood:'Difference understood'};
export const isReflection=r=>r?.kind==='reflection';
export const isDisagreementPoint=r=>isReflection(r)&&r.action==='disagreement_point';
export const isReflectionOutcome=r=>isReflection(r)&&r.action==='outcome';
const reason=r=>r?.kind==='argument'&&r.action==='reason';
const check=(ok,message)=>{if(!ok)throw Error(message);};
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const response=r=>r?.kind==='reply'&&r.layer==='arguments';

function pointTarget(ws,target,comparisonId,{historical=false}={}){
  const thread=ws.comparisonThreads.find(t=>t.id===comparisonId);if(!thread||!target)return false;
  if(['entry','inference'].includes(target.type)){
    const parent=ws.discussions.find(r=>r.id===target.entryId&&r.comparisonId===comparisonId);return !!parent&&(historical||parent.status==='active')&&(target.type==='inference'?reason(parent):reason(parent)||response(parent));
  }
  if(![thread.aMapId,thread.bMapId].includes(target.mapId))return false;
  if(target.type==='node'&&roots.includes(target.nodeId))return false;
  if(historical)return ['node','edge'].includes(target.type);
  const map=ws.maps.find(m=>m.id===target.mapId&&!m.unavailable);if(!map)return false;
  return target.type==='node'?map.nodes.some(n=>n.id===target.nodeId&&n.parent!==null):target.type==='edge'&&graphEdges(map.nodes,map.relations||[]).some(edge=>edge.id===target.edgeId);
}

export function canMarkDisagreement(ws,target,comparisonId){
  if(!pointTarget(ws,target,comparisonId))return false;
  return discussionHealth(ws,{id:'',target,comparisonId}).state!=='unavailable';
}
export function reflectionOutcomes(ws,pointId){
  return (ws.discussions||[]).filter(r=>isReflectionOutcome(r)&&r.status==='active'&&r.target.type==='entry'&&r.target.entryId===pointId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
}

// Historical notes retain their source snapshots even after a node is removed.
// Their role and metadata shape still have to be unambiguous on every version.
export function validateReflections(ws){
  const outcomes=new Set();
  for(const r of ws.discussions||[]){
    for(const version of [...(r.history||[]),r]){
      if(!isReflection(version)){check(version.reflection===undefined,'Reflection details belong only to a reflection.');continue;}
      check(isReflection(r)&&['disagreement_point','outcome'].includes(r.action)&&version.action===r.action,'A reflection must preserve its role.');
      check(stableJSON(version.sourceSnapshots)===stableJSON(r.sourceSnapshots),'Earlier reflection source snapshots must remain unchanged.');
      check(version.layer==='arguments'&&version.other===null&&typeof version.body==='string'&&version.body.trim().length>0&&version.body.length<=10000,'Write a reflection attached to one source.');
      check(['premise','adoption','definitionRefs','referenceUrl'].every(key=>version[key]===undefined),'A reflection cannot add support, adoption, definitions, or reference links.');
      const details=version.reflection;
      if(isDisagreementPoint(r))check(exact(details,['category'])&&typeof details.category==='string'&&Object.hasOwn(REFLECTION_CATEGORIES,details.category),'Invalid disagreement category.');
      else check(exact(details,['result','nextStep'])&&typeof details.result==='string'&&Object.hasOwn(REFLECTION_RESULTS,details.result)&&typeof details.nextStep==='string'&&details.nextStep.length<=2000,'Invalid reflection outcome.');
    }
    if(!isReflection(r))continue;
    if(isDisagreementPoint(r))check(pointTarget(ws,r.target,r.comparisonId,{historical:true}),'Mark a source node, map connection, reason, argument response, or Supports connection.');
    else {
      const parent=ws.discussions.find(p=>p.id===r.target.entryId&&p.comparisonId===r.comparisonId);
      check(r.target.type==='entry'&&isDisagreementPoint(parent),'Record an outcome on a point of disagreement.');
      if(r.status==='active'){const key=JSON.stringify([r.authorId,parent.id]);check(!outcomes.has(key),'You already have an outcome here. Edit your existing assessment.');outcomes.add(key);}
    }
  }
}

// Called after the existing exact status-only withdrawal exception. Other
// contributions cannot grow reply/challenge graphs beneath attached notes.
export function validateReflectionEdit(ws,old,r,actor){
  const parent=r.target?.type==='entry'?ws.discussions.find(p=>p.id===r.target.entryId):null;
  if(isReflection(parent)&&!isReflectionOutcome(r))throw Error('Use an outcome to reflect on a point of disagreement; this note does not start another conversation.');
  if(!isReflection(r))return;
  check(r.authorId===actor,'Record only your own reflection.');
  if(old)check(old.action===r.action,'A reflection must preserve its role.');
  else if(r.reviewedSources!==undefined)check(stableJSON(r.reviewedSources)===stableJSON(discussionSnapshots(ws,r)),'Review the current reflection source before recording it.');
  if(isDisagreementPoint(r))check(canMarkDisagreement(ws,r.target,r.comparisonId),'Choose an available source, reason, argument response, or Supports connection.');
  else check(isDisagreementPoint(parent)&&parent.status==='active'&&parent.comparisonId===r.comparisonId,'Choose an active point of disagreement.');
}
