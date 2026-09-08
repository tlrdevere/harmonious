import { roots, exampleMap, exampleRelations } from './data.mjs';
import { validateGraph, graphEdges } from './model.mjs';
import {upgradeWorkspace,validateAdoptionData,createOwnedMap} from './adoption.mjs';
import {stableJSON} from './account-model.mjs';

export const QUESTION_STATUSES={matched:'Same question',unmatched_relevant:'Unanswered but relevant',incommensurable:'Different questions'};
export const ANSWER_STATUSES={aligned:'Aligned',partial:'Partially aligned',divergent:'Apparent divergence',asymmetric:'Unanswered on one side'};
export function newId(prefix){return `${prefix}-${globalThis.crypto.randomUUID()}`;}
export function createMap(name,person,withExample=false){return {id:newId('map'),name,person,revision:1,nodes:withExample?exampleMap():exampleMap().filter(n=>n.parent===null),relations:withExample?exampleRelations():[],updatedAt:new Date().toISOString()};}
export function initialWorkspace(){
  const a=createMap('Example A','Participant A',true),b=createMap('Example B','Participant B',true);
  const node=b.nodes.find(n=>n.id==='a1');node.title='Start with a shared decision';node.summary='Choose a concrete decision and surface the reasoning needed to make it together.';node.details='Illustrative difference: begin with a bounded decision rather than a broad worldview mapping exercise.';
  b.nodes.find(n=>n.id==='a211').summary='Compare answers first, then clarify which underlying question each answer addresses.';
  const workspace=upgradeWorkspace({schemaVersion:1,maps:[a,b],comparisons:[]});
  createOwnedMap(workspace,{name:'Map first — reference',ownerId:a.ownerId,mapType:'reference',fromMapId:a.id});
  createOwnedMap(workspace,{name:'Decision first — reference',ownerId:b.ownerId,mapType:'reference',fromMapId:b.id});
  return workspace;
}
const comparisonNodeContent=node=>{const {ideaId,ideaVersion,reuseMode,copiedFrom,...content}=node;return JSON.parse(JSON.stringify(content));};
export function sourceSnapshot(map,nodeId){
  if(!nodeId)return {node:null,mapRevision:map.revision};
  const n=map.nodes.find(n=>n.id===nodeId);if(!n)return null;
  const ancestors=[];let p=map.nodes.find(m=>m.id===n.parent);
  while(p){ancestors.unshift({id:p.id,title:p.title,kind:p.kind,summary:p.summary,details:p.details});p=map.nodes.find(m=>m.id===p.parent);}
  const links=graphEdges(map.nodes,map.relations).filter(e=>e.from===nodeId||e.to===nodeId).map(e=>({...e,otherNode:comparisonNodeContent(map.nodes.find(n=>n.id===(e.from===nodeId?e.to:e.from)))})).sort((a,b)=>a.id.localeCompare(b.id));
  return {node:comparisonNodeContent(n),ancestors,links};
}
export function comparisonHealth(workspace,record){
  const changed=[],missing=[];
  for(const side of ['a','b']){const map=workspace.maps.find(m=>m.id===record[`${side}MapId`]);if(!map){missing.push(side);continue;}
    const current=sourceSnapshot(map,record[`${side}NodeId`]);if(current===null){missing.push(side);continue;}
    if(stableJSON(current)!==stableJSON(record[`${side}Snapshot`]))changed.push(side);
  }
  return {changed,missing,needsReview:!!(changed.length||missing.length)};
}
export function validateComparisonInput(workspace,input){
  const a=workspace.maps.find(m=>m.id===input.aMapId),b=workspace.maps.find(m=>m.id===input.bMapId);
  if(!a||!b||a.id===b.id)throw Error('Choose two different maps.');
  if(!input.aNodeId&&!input.bNodeId)throw Error('Select a node on at least one side.');
  for(const [map,id]of [[a,input.aNodeId],[b,input.bNodeId]])if(id&&!map.nodes.some(n=>n.id===id))throw Error('A selected node is no longer in its map.');
  if(!QUESTION_STATUSES[input.questionStatus])throw Error('First decide whether the nodes address the same question.');
  if(!input.question.trim())throw Error('Write the shared question, or describe how the questions differ.');
  if(input.questionStatus==='matched'){
    if(!ANSWER_STATUSES[input.answerStatus])throw Error('Compare the answers after establishing the shared question.');
    if((!input.aNodeId||!input.bNodeId)&&input.answerStatus!=='asymmetric')throw Error('A missing response must be recorded as unanswered on one side.');
  }else if(input.answerStatus)throw Error('Answer comparison requires an established shared question.');
}
export function recordComparison(workspace,input,existing=null){
  validateComparisonInput(workspace,input);
  const a=workspace.maps.find(m=>m.id===input.aMapId),b=workspace.maps.find(m=>m.id===input.bMapId),now=new Date().toISOString();
  const history=existing?[...(existing.history||[]),(({history,...rest})=>rest)(existing)]:[];
  return {id:existing?.id||newId('comparison'),aMapId:a.id,bMapId:b.id,aNodeId:input.aNodeId||null,bNodeId:input.bNodeId||null,questionStatus:input.questionStatus,question:input.question.trim(),answerStatus:input.questionStatus==='matched'?input.answerStatus:null,notes:input.notes?.trim()||'',provisional:input.answerStatus==='divergent',aSnapshot:sourceSnapshot(a,input.aNodeId),bSnapshot:sourceSnapshot(b,input.bNodeId),createdAt:existing?.createdAt||now,updatedAt:now,history};
}
export function validateWorkspace(workspace){
  if(![1,2].includes(workspace?.schemaVersion)||!Array.isArray(workspace.maps)||!Array.isArray(workspace.comparisons)||workspace.maps.length<1||workspace.maps.length>100)throw Error('This is not a supported Harmonious workspace.');
  const ids=new Set();
  for(const map of workspace.maps){
    if(typeof map.id!=='string'||ids.has(map.id)||typeof map.name!=='string'||!map.name.trim()||typeof map.person!=='string'||!Number.isSafeInteger(map.revision)||map.revision<1||!Array.isArray(map.nodes)||!Array.isArray(map.relations)||map.nodes.length>2000)throw Error('A map contains invalid or duplicate details.');
    ids.add(map.id);
    for(const n of map.nodes)if(typeof n.id!=='string'||typeof n.title!=='string'||typeof n.summary!=='string'||typeof n.details!=='string'||(n.parent!==null&&typeof n.parent!=='string')||(n.parent===null&&n.kind!=='frame')||(n.confidence!==null&&(!Number.isFinite(n.confidence)||n.confidence<0||n.confidence>100)))throw Error('A map contains an invalid node.');
    validateGraph(map.nodes,roots,map.relations);
  }
  const comparisons=new Set();
  for(const c of workspace.comparisons){
    if(typeof c.id!=='string'||comparisons.has(c.id)||!ids.has(c.aMapId)||!ids.has(c.bMapId)||c.aMapId===c.bMapId||!QUESTION_STATUSES[c.questionStatus]||typeof c.question!=='string'||typeof c.notes!=='string'||!Array.isArray(c.history)||!c.aSnapshot||!c.bSnapshot)throw Error('A comparison has invalid source references.');
    if(c.questionStatus==='matched'?!ANSWER_STATUSES[c.answerStatus]:c.answerStatus!==null)throw Error('A comparison skips the question step.');
    if(c.answerStatus==='divergent'&&c.provisional!==true)throw Error('Apparent divergences must remain provisional.');
    for(const side of ['a','b'])if(c[`${side}NodeId`]!==null&&c[`${side}Snapshot`].node?.id!==c[`${side}NodeId`])throw Error('A source snapshot does not match its node reference.');
    if(!c.aNodeId&&!c.bNodeId)throw Error('A comparison needs at least one source node.');
    for(const version of [c,...c.history]){
      if(!version||!QUESTION_STATUSES[version.questionStatus]||typeof version.question!=='string'||typeof version.notes!=='string'||!version.aSnapshot||!version.bSnapshot)throw Error('A comparison history entry is invalid.');
      if(version.questionStatus==='matched'?!ANSWER_STATUSES[version.answerStatus]:version.answerStatus!==null)throw Error('A comparison history entry skips the question step.');
      for(const side of ['a','b']){const snapshot=version[`${side}Snapshot`];if(snapshot.node!==null&&(typeof snapshot.node?.title!=='string'||typeof snapshot.node?.summary!=='string'))throw Error('A saved source snapshot is invalid.');}
    }
    comparisons.add(c.id);
  }
  upgradeWorkspace(workspace);validateAdoptionData(workspace);return workspace;
}
