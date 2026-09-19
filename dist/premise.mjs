import {nodeWording} from './adoption.mjs';
import {frameOf,graphEdges} from './model.mjs';
import {roots} from './data.mjs';
import {stableJSON} from './account-model.mjs';

const equal=(a,b)=>stableJSON(a)===stableJSON(b),reason=r=>r?.kind==='argument'&&r.action==='reason';
const check=(ok,message)=>{if(!ok)throw Error(message);};
const text=(value,max=200,empty=false)=>typeof value==='string'&&value.length<=max&&(empty||value.trim().length>0);
const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const sourceKey=p=>JSON.stringify([p.mapId,p.nodeId]);
// Match SQL COLLATE "C" for imported IDs as well as generated ASCII IDs.
const compareIds=(a,b)=>{const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);for(let i=0;i<Math.min(x.length,y.length);i++)if(x[i]!==y[i])return x[i]-y[i];return x.length-y.length;};

export function capturePremise(ws,{mapId,nodeId}){
  const map=ws.maps.find(m=>m.id===mapId&&!m.unavailable),node=map?.nodes.find(n=>n.id===nodeId&&n.parent!==null&&n.kind==='position');
  if(!node||!node.ideaId||!Number.isSafeInteger(node.ideaVersion)||!frameOf(map.nodes,node.id))return null;
  const contexts=(ws.discussions||[]).filter(r=>r.kind==='context'&&r.status==='active'&&r.authorId===map.ownerId&&r.target.type==='node'&&r.target.mapId===mapId&&r.target.nodeId===nodeId).map(r=>({id:r.id,authorId:r.authorId,version:r.version,body:r.body,definitionRefs:structuredClone(r.definitionRefs||[])})).sort((a,b)=>compareIds(a.id,b.id));
  if(contexts.length>30)return null;
  return {mapId,nodeId,ideaId:node.ideaId,ideaVersion:node.ideaVersion,wording:structuredClone(nodeWording(map,node)),contexts};
}

// Follow contextual ancestry only to find the map/frame. A response to a
// challenge is contextually anchored there, but is not a support dependency.
export function premiseScope(ws,{comparisonId,target},actor){
  const thread=ws.comparisonThreads.find(t=>t.id===comparisonId),byId=new Map((ws.discussions||[]).map(r=>[r.id,r])),seen=new Set();
  if(!thread?.participants.includes(actor))return null;
  if(target?.type==='entry'){const parent=byId.get(target.entryId);if(!parent||parent.authorId!==actor||!(reason(parent)||parent.kind==='reply'&&parent.layer==='arguments'))return null;}
  else if(target?.type!=='node'||!ws.maps.some(m=>m.id===target.mapId&&m.ownerId===actor&&m.nodes.some(n=>n.id===target.nodeId&&n.parent!==null)))return null;
  while(['entry','inference'].includes(target?.type)){
    const entry=byId.get(target.entryId);if(!entry||entry.comparisonId!==comparisonId||seen.has(entry.id))return null;
    seen.add(entry.id);target=entry.target;
  }
  const anchor=ws.maps.find(m=>m.id===target?.mapId&&!m.unavailable&&[thread.aMapId,thread.bMapId].includes(m.id));if(!anchor)return null;
  let frame;
  if(target.type==='node')frame=frameOf(anchor.nodes,target.nodeId);
  else if(target.type==='edge'){const edge=graphEdges(anchor.nodes,anchor.relations||[]).find(e=>e.id===target.edgeId);if(edge){const a=frameOf(anchor.nodes,edge.from),b=frameOf(anchor.nodes,edge.to);if(a===b)frame=a;}}
  const map=anchor.ownerId===actor?anchor:ws.maps.find(m=>!m.unavailable&&m.ownerId===actor&&[thread.aMapId,thread.bMapId].includes(m.id));
  return frame&&map?{map,frame}:null;
}

export function premiseHealth(ws,r){
  if(r.premise===undefined)return {state:'current',label:'Source current',current:null};
  const current=capturePremise(ws,r.premise),scope=premiseScope(ws,r,r.authorId);
  if(!current||!scope||scope.map.id!==current.mapId||scope.frame!==current.wording.frame)return {state:'unavailable',label:'Source position unavailable in this frame',current};
  return equal(current,r.premise)?{state:'current',label:'Source current',current}:{state:'changed',label:'Source position changed · review needed',current};
}

function validDefinition(ref,actor){
  return exactKeys(ref,['definitionId','authorId','type','version','title','body'])&&text(ref.definitionId)&&ref.authorId===actor&&['definition','standard'].includes(ref.type)&&Number.isSafeInteger(ref.version)&&ref.version>0&&text(ref.title)&&text(ref.body,10000);
}
function validPinned(p,actor){
  if(!exactKeys(p,['mapId','nodeId','ideaId','ideaVersion','wording','contexts'])||![p.mapId,p.nodeId,p.ideaId].every(v=>text(v))||!Number.isSafeInteger(p.ideaVersion)||p.ideaVersion<1)return false;
  const w=p.wording;
  if(!exactKeys(w,['kind','title','summary','details','timeScope','sourceTitle','sourceUrl','frame'])||w.kind!=='position'||!text(w.title)||!text(w.summary,10000,true)||!text(w.details,10000,true)||!['present','history','likely_future'].includes(w.timeScope)||!text(w.sourceTitle,2000,true)||!text(w.sourceUrl,2000,true)||!roots.includes(w.frame))return false;
  if(w.sourceUrl){try{if(!['http:','https:'].includes(new URL(w.sourceUrl).protocol))return false;}catch{return false;}}
  return Array.isArray(p.contexts)&&p.contexts.length<=30&&p.contexts.every((c,i)=>exactKeys(c,['id','authorId','version','body','definitionRefs'])&&text(c.id)&&c.authorId===actor&&Number.isSafeInteger(c.version)&&c.version>0&&text(c.body,10000,true)&&Array.isArray(c.definitionRefs)&&c.definitionRefs.length<=30&&new Set(c.definitionRefs.map(ref=>ref?.definitionId)).size===c.definitionRefs.length&&c.definitionRefs.every(ref=>validDefinition(ref,actor))&&(!i||compareIds(p.contexts[i-1].id,c.id)<0));
}

const targetKey=(comparisonId,target)=>JSON.stringify([comparisonId,target.type==='node'?'node':'entry',target.type==='node'?target.mapId:target.entryId,target.type==='node'?target.nodeId:null]);
const entryKey=(comparisonId,id)=>targetKey(comparisonId,{type:'entry',entryId:id});
const nodeKey=(comparisonId,p)=>targetKey(comparisonId,{type:'node',...p});
function supportGraph(records){
  const graph=new Map(),add=(from,to)=>{if(!graph.has(from))graph.set(from,new Set());graph.get(from).add(to);if(!graph.has(to))graph.set(to,new Set());};
  for(const r of records)if(reason(r)&&r.status==='active'){
    add(targetKey(r.comparisonId,r.target),entryKey(r.comparisonId,r.id));
    if(r.premise)add(entryKey(r.comparisonId,r.id),nodeKey(r.comparisonId,r.premise));
  }
  return graph;
}
function repeatedPremise(byId,r){
  const key=sourceKey(r.premise),seen=new Set();let target=r.target;
  while(target?.type==='entry'){
    const parent=byId.get(target.entryId);if(!parent||seen.has(parent.id)||!reason(parent))break;
    seen.add(parent.id);if(parent.premise&&sourceKey(parent.premise)===key)return true;target=parent.target;
  }
  return target?.type==='node'&&sourceKey(target)===key;
}
export function validatePremises(ws){
  const records=ws.discussions||[],duplicates=new Set(),byId=new Map(records.map(r=>[r.id,r]));
  for(const r of records){
    if(r.premise!==undefined)check(reason(r)&&validPinned(r.premise,r.authorId)&&r.body===r.premise.wording.title,'Invalid saved premise wording or context.');
    for(const version of [...(r.history||[]),r]){
      check((version.premise===undefined)===(r.premise===undefined),'A reason must preserve whether it uses an existing position.');
      if(version.premise===undefined)continue;
      check(reason(version)&&validPinned(version.premise,r.authorId)&&version.body===version.premise.wording.title,'Invalid saved premise wording or context.');
      check(sourceKey(version.premise)===sourceKey(r.premise),'A reason must preserve its source position.');
    }
    if(r.premise===undefined||r.status!=='active')continue;
    const key=JSON.stringify([r.comparisonId,sourceKey(r.premise),targetKey(r.comparisonId,r.target)]);
    check(!duplicates.has(key),'This position already supports that conclusion.');duplicates.add(key);
    check(!repeatedPremise(byId,r),'A position cannot support itself or repeat within its support ancestry.');
  }
  // Kahn's algorithm keeps imported or maliciously long chains stack-safe.
  const graph=supportGraph(records),incoming=new Map([...graph.keys()].map(key=>[key,0]));
  for(const next of graph.values())for(const id of next)incoming.set(id,incoming.get(id)+1);
  const ready=[...incoming].filter(([,count])=>!count).map(([id])=>id);let visited=0;
  for(let i=0;i<ready.length;i++){visited++;for(const next of graph.get(ready[i])){incoming.set(next,incoming.get(next)-1);if(!incoming.get(next))ready.push(next);}}
  check(visited===graph.size,'Supporting reasons cannot form a cycle.');
}

export function validatePremiseEdit(ws,old,r,actor){
  if(old){check((old.premise===undefined)===(r.premise===undefined),'A reason must preserve whether it uses an existing position.');if(r.premise)check(sourceKey(old.premise)===sourceKey(r.premise),'A reason must preserve its source position.');}
  if(r.premise===undefined)return;
  check(reason(r)&&validPinned(r.premise,actor)&&r.body===r.premise.wording.title,'Invalid saved premise wording or context.');
  const appended=old?r.history.slice(old.version):[];
  if(old&&equal(old.premise,r.premise)&&appended.every(version=>equal(version.premise,old.premise)))return;
  const scope=premiseScope(ws,r,actor),current=capturePremise(ws,r.premise);
  check(scope&&current&&scope.map.id===current.mapId&&scope.frame===current.wording.frame,'Choose your own Position in the same comparison map and frame.');
  check(appended.every(version=>equal(version.premise,old.premise)||equal(version.premise,current)),'New premise history must match the saved or current source position.');
  check(old&&equal(old.premise,r.premise)||equal(current,r.premise),'The source position changed. Review its current wording before saving.');
}

export function premiseChoices(ws,input,actor,excludeId=null){
  const scope=premiseScope(ws,input,actor);if(!scope)return [];
  const records=(ws.discussions||[]).filter(r=>r.id!==excludeId),byId=new Map(scope.map.nodes.map(n=>[n.id,n])),entries=new Map(records.map(r=>[r.id,r]));
  const graph=supportGraph(records),reverse=new Map();for(const [from,next]of graph)for(const to of next){if(!reverse.has(to))reverse.set(to,[]);reverse.get(to).push(from);}
  const blocked=new Set([targetKey(input.comparisonId,input.target)]),queue=[...blocked];
  for(let i=0;i<queue.length;i++)for(const id of reverse.get(queue[i])||[])if(!blocked.has(id)){blocked.add(id);queue.push(id);}
  return scope.map.nodes.filter(node=>node.parent!==null&&node.kind==='position'&&frameOf(scope.map.nodes,node.id)===scope.frame).filter(node=>{
    const r={...input,premise:{mapId:scope.map.id,nodeId:node.id}};
    return !!capturePremise(ws,r.premise)&&!blocked.has(nodeKey(input.comparisonId,r.premise))&&!repeatedPremise(entries,r)&&!records.some(other=>reason(other)&&other.status==='active'&&other.comparisonId===input.comparisonId&&other.premise&&sourceKey(other.premise)===sourceKey(r.premise)&&equal(other.target,input.target));
  }).map(node=>{const path=[],seen=new Set();let parent=byId.get(node.parent);while(parent&&!seen.has(parent.id)){seen.add(parent.id);path.unshift(parent.title);parent=byId.get(parent.parent);}return {map:scope.map,node,path:path.join(' › ')};}).sort((a,b)=>a.path.localeCompare(b.path,'en',{sensitivity:'base',numeric:true})||a.node.title.localeCompare(b.node.title,'en',{sensitivity:'base',numeric:true})||compareIds(a.node.id,b.node.id));
}
