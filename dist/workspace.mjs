import { roots, exampleMap, exampleRelations } from './data.mjs';
import { validateGraph, graphEdges } from './model.mjs';
import {upgradeWorkspace,validateAdoptionData,createOwnedMap} from './adoption.mjs';
import {stableJSON} from './account-model.mjs';
import {validateDefinitions} from './definitions.mjs';
import {validateDiscussions} from './discussion.mjs';
import {validateArguments} from './argument.mjs';

export const QUESTION_STATUSES={matched:'Same question',needs_elicitation:'Needs elicitation',unmatched_relevant:'Unanswered but relevant',incommensurable:'Different questions'};
export const ANSWER_STATUSES={aligned:'Aligned',partial:'Partially aligned',divergent:'Apparent divergence',asymmetric:'Unanswered on one side'};
export function newId(prefix){return `${prefix}-${globalThis.crypto.randomUUID()}`;}
export function createMap(name,person,withExample=false){return {id:newId('map'),name,person,revision:1,nodes:withExample?exampleMap():exampleMap().filter(n=>n.parent===null),relations:withExample?exampleRelations():[],updatedAt:new Date().toISOString()};}
export function initialWorkspace(){
  const a=createMap('Example A','Participant A',true),b=createMap('Example B','Participant B',true);
  const node=b.nodes.find(n=>n.id==='a1');node.title='Start with a shared decision';node.summary='Choose a concrete decision and surface the reasoning needed to make it together.';node.details='Illustrative difference: begin with a bounded decision rather than a broad worldview mapping exercise.';
  b.nodes.find(n=>n.id==='a211').summary='Compare answers first, then clarify which underlying question each answer addresses.';
  const workspace=upgradeWorkspace({schemaVersion:1,maps:[a,b],comparisons:[],comparisonThreads:[],argumentNodes:[],argumentEdges:[],discussions:[],definitions:[]});
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
const comparisonJudgmentFields=['aNodeId','bNodeId','questionStatus','question','answerStatus','notes','provisional'];
const comparisonJudgmentValue=(record,judgment)=>{
  const value={actorId:judgment.actorId};
  for(const field of comparisonJudgmentFields)value[field]=judgment[field]??(['aNodeId','bNodeId','answerStatus'].includes(field)?null:'');
  value.history=Array.isArray(judgment.history)?judgment.history:[];
  value.createdAt=judgment.createdAt||record.createdAt;
  value.updatedAt=judgment.updatedAt||record.updatedAt;
  value.aSnapshot=judgment.aSnapshot??record.aSnapshot;
  value.bSnapshot=judgment.bSnapshot??record.bSnapshot;
  // Earlier shared records did not pin the sources each person reviewed.
  value.sourceReviewRequired=judgment.sourceReviewRequired??!(judgment.aSnapshot&&judgment.bSnapshot);
  value.proposalRevision=judgment.proposalRevision??null;
  value.elicitationResponse=judgment.elicitationResponse??'';
  value.responseRevision=judgment.responseRevision??(judgment.elicitationResponse?1:0);
  value.divergenceConfirmed=judgment.divergenceConfirmed??false;
  value.reviewedResponses=judgment.reviewedResponses??[];
  return value;
};
export function comparisonProposalVersions(record){
  if(record.proposalVersions!==undefined)return record.proposalVersions;
  return [{revision:1,actorId:record.createdBy||record.judgments?.[0]?.actorId||null,question:record.question,aNodeId:record.aNodeId,bNodeId:record.bNodeId,aSnapshot:record.aSnapshot,bSnapshot:record.bSnapshot,createdAt:record.createdAt}];
}
export function comparisonResponseSet(workspace,record){
  return comparisonJudgments(workspace,record).filter(j=>comparisonParticipants(workspace,record).includes(j.actorId))
    .map(j=>({actorId:j.actorId,proposalRevision:j.proposalRevision,responseRevision:j.responseRevision,response:j.elicitationResponse})).sort((a,b)=>a.actorId.localeCompare(b.actorId));
}
export function comparisonElicitation(workspace,record){
  const judgments=comparisonJudgments(workspace,record),participants=comparisonParticipants(workspace,record),revision=comparisonProposalVersions(record).at(-1).revision;
  if(participants.length<2)return {state:'single',label:'Personal comparison · joint confirmation requires two owners',responsesComplete:false};
  const responses=comparisonResponseSet(workspace,record),responsesComplete=participants.length>1&&participants.every(id=>responses.some(r=>r.actorId===id&&r.proposalRevision===revision&&r.response.trim()));
  const current=!comparisonHealth(workspace,record).needsReview&&judgments.every(j=>!j.sourceReviewRequired&&j.proposalRevision===revision);
  const confirmed=responsesComplete&&current&&comparisonConsensus(workspace,record).state==='agreed'&&judgments.every(j=>j.questionStatus==='matched'&&j.answerStatus==='divergent'&&j.divergenceConfirmed&&stableJSON(j.reviewedResponses)===stableJSON(responses));
  if(confirmed)return {state:'confirmed',label:'Divergence confirmed after clarification',responsesComplete};
  if(!current&&responses.some(r=>r.response))return {state:'review',label:'Clarification needs review',responsesComplete:false};
  return {state:responsesComplete?'ready':'pending',label:responsesComplete?'Responses ready for both people to review':'Awaiting clarification responses',responsesComplete};
}
export function comparisonJudgmentRevision(judgment){
  const {history,...revision}=judgment;
  return revision;
}
export const comparisonPairKey=record=>JSON.stringify([record.aMapId,record.bMapId].sort());
export function startComparisonThread(workspace,aMapId,bMapId,actorId=null,metadata={}){
  const [a,b]=[aMapId,bMapId].sort().map(id=>workspace.maps.find(map=>map.id===id));
  if(!a||!b||a.id===b.id)throw Error('Choose two different maps.');
  workspace.comparisonThreads??=[];
  const existing=workspace.comparisonThreads.find(thread=>comparisonPairKey(thread)===comparisonPairKey({aMapId,bMapId}));
  if(existing)return existing;
  const now=metadata.createdAt||new Date().toISOString();
  const thread={id:metadata.id||newId('comparison-thread'),aMapId:a.id,bMapId:b.id,participants:[...new Set([a.ownerId,b.ownerId])].sort(),createdBy:actorId||a.ownerId,createdAt:now,status:'active'};
  workspace.comparisonThreads.push(thread);return thread;
}
// Old portable workspaces contained only node-level comparison records.
// Preserve proposal IDs and histories while giving each pair a stable parent.
export function upgradeComparisonThreads(workspace){
  workspace.comparisonThreads??=[];
  for(const proposal of [...workspace.comparisons].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)){
    if(proposal.comparisonId)continue;
    const thread=startComparisonThread(workspace,proposal.aMapId,proposal.bMapId,proposal.createdBy,{id:proposal.id,createdAt:proposal.createdAt});
    proposal.comparisonId=thread.id;
  }
  return workspace;
}
export function comparisonParticipants(workspace,record){
  const result=new Set(Array.isArray(record?.participants)?record.participants.filter(id=>typeof id==='string'&&id):[]);
  for(const side of ['a','b']){const map=workspace?.maps?.find(m=>m.id===record?.[`${side}MapId`]);if(map?.ownerId)result.add(map.ownerId);}
  return [...result];
}
export function comparisonJudgments(workspace,record){
  if(Array.isArray(record?.judgments)&&record.judgments.length)return record.judgments.map(j=>comparisonJudgmentValue(record,j));
  const actor=record?.createdBy||comparisonParticipants(workspace,record)[0]||null;
  return actor?[comparisonJudgmentValue(record,{...record,actorId:actor})]:[];
}
export function comparisonJudgmentFor(workspace,record,actorId){
  const judgments=comparisonJudgments(workspace,record);
  return (actorId?judgments.find(j=>j.actorId===actorId):judgments[0])||null;
}
export function comparisonConsensus(workspace,record){
  const judgments=comparisonJudgments(workspace,record),participants=comparisonParticipants(workspace,record),actors=new Set(judgments.map(j=>j.actorId).filter(Boolean));
  const complete=participants.length>1&&participants.every(id=>actors.has(id));
  if(participants.length===1)return {state:'single',label:'Your comparison'};
  if(!complete)return {state:'pending',label:'Awaiting the other person'};
  if(judgments.some(j=>j.proposalRevision!==comparisonProposalVersions(record).at(-1).revision))return {state:'review',label:'Proposal review needed'};
  if(comparisonHealth(workspace,record).needsReview||judgments.some(j=>j.sourceReviewRequired||['a','b'].some(side=>stableJSON(j[`${side}Snapshot`])!==stableJSON(record[`${side}Snapshot`]))))return {state:'review',label:'Source review needed'};
  const decisions=new Set(judgments.filter(j=>participants.includes(j.actorId)).map(j=>JSON.stringify([j.questionStatus,j.answerStatus||'',j.question.trim().replace(/\s+/g,' ')])));
  return decisions.size===1?{state:'agreed',label:'Both agree'}:{state:'disputed',label:'Judgments differ'};
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
  if(input.elicitationResponse!==undefined&&(typeof input.elicitationResponse!=='string'||input.elicitationResponse.length>10000))throw Error('Keep your clarification response within 10,000 characters.');
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
export function recordComparison(workspace,input,existing=null,actorId=null){
  if(workspace.schemaVersion===1)upgradeWorkspace(workspace);
  validateComparisonInput(workspace,input);
  const a=workspace.maps.find(m=>m.id===input.aMapId),b=workspace.maps.find(m=>m.id===input.bMapId),now=new Date().toISOString();
  const base=existing||{id:newId('comparison'),aMapId:a.id,bMapId:b.id,aNodeId:input.aNodeId||null,bNodeId:input.bNodeId||null,createdAt:now};
  if(existing&&(existing.aMapId!==a.id||existing.bMapId!==b.id))throw Error('Start a new comparison for a different pair of maps.');
  const sourceChanged=existing&&(existing.aNodeId!==(input.aNodeId||null)||existing.bNodeId!==(input.bNodeId||null));
  if(sourceChanged&&comparisonJudgments(workspace,existing).some(j=>j.actorId!==(actorId||existing.createdBy||a.ownerId)))throw Error('Start a new proposal to change sources after another participant has judged them.');
  const nextBase={...base,aNodeId:input.aNodeId||null,bNodeId:input.bNodeId||null,aSnapshot:sourceSnapshot(a,input.aNodeId),bSnapshot:sourceSnapshot(b,input.bNodeId)};
  const participants=comparisonParticipants(workspace,{...nextBase,participants:existing?.participants});
  const actor=actorId||existing?.createdBy||a.ownerId||b.ownerId||participants[0];
  const prior=existing?comparisonJudgments(workspace,base).find(j=>j.actorId===actor):null;
  const priorHistory=prior?[...(prior.history||[]),comparisonJudgmentRevision(prior)]:[];
  const versions=existing?[...comparisonProposalVersions(existing)]:[],last=versions.at(-1);
  const proposed={question:!existing||actor===(existing.createdBy||actor)?input.question.trim():last.question,aNodeId:nextBase.aNodeId,bNodeId:nextBase.bNodeId,aSnapshot:nextBase.aSnapshot,bSnapshot:nextBase.bSnapshot};
  if(!last||Object.keys(proposed).some(key=>stableJSON(proposed[key])!==stableJSON(last[key])))versions.push({...proposed,revision:(last?.revision||0)+1,actorId:actor,createdAt:now});
  const judgment={actorId:actor,aNodeId:nextBase.aNodeId,bNodeId:nextBase.bNodeId,questionStatus:input.questionStatus,question:input.question.trim(),answerStatus:input.questionStatus==='matched'?input.answerStatus:null,notes:input.notes?.trim()||'',provisional:input.answerStatus==='divergent',aSnapshot:nextBase.aSnapshot,bSnapshot:nextBase.bSnapshot,proposalRevision:versions.at(-1).revision,elicitationResponse:input.elicitationResponse?.trim()??prior?.elicitationResponse??'',divergenceConfirmed:input.divergenceConfirmed===true,reviewedResponses:[],history:priorHistory,createdAt:prior?.createdAt||now,updatedAt:now};
  const judgments=[...(existing?comparisonJudgments(workspace,base):[]).filter(j=>j.actorId!==actor),judgment];
  judgment.responseRevision=(prior?.responseRevision||0)+(judgment.elicitationResponse!==(prior?.elicitationResponse||'')?1:0);
  if(judgment.divergenceConfirmed){
    const responses=comparisonResponseSet(workspace,{...nextBase,participants,judgments});
    if(judgment.questionStatus!=='matched'||judgment.answerStatus!=='divergent'||participants.length<2||!participants.every(id=>responses.some(r=>r.actorId===id&&r.proposalRevision===judgment.proposalRevision&&r.response.trim())))throw Error('Both people must save clarification responses to this proposal before confirming divergence.');
    judgment.reviewedResponses=responses;
  }
  const createdBy=existing?.createdBy||actor,primary=judgments.find(j=>j.actorId===createdBy)||judgments[0]||judgment;
  const thread=startComparisonThread(workspace,a.id,b.id,actor);
  return {...nextBase,comparisonId:thread.id,createdBy,participants,judgments,proposalVersions:versions,aMapId:a.id,bMapId:b.id,...comparisonJudgmentValue(nextBase,primary),aSnapshot:nextBase.aSnapshot,bSnapshot:nextBase.bSnapshot,history:primary.history,createdAt:nextBase.createdAt||now,updatedAt:now};
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
    const participants=comparisonParticipants(workspace,c),declared=Array.isArray(c.participants)?c.participants:null;
    if(declared&&(!declared.length||new Set(declared).size!==declared.length||declared.some(id=>typeof id!=='string'||!id||!workspace.participants.some(p=>p.id===id))))throw Error('A comparison has invalid participants.');
    if(c.createdBy!==undefined&&(!declared?.includes(c.createdBy)||typeof c.createdBy!=='string'))throw Error('A comparison has an invalid creator.');
    const judgments=comparisonJudgments(workspace,c),actors=new Set();
    const versions=comparisonProposalVersions(c);
    if(!Array.isArray(versions)||!versions.length||versions.length>1000)throw Error('Invalid proposal revisions.');
    for(const [index,version]of versions.entries()){
      if(version?.revision!==index+1||typeof version.question!=='string'||!version.question.trim()||!Number.isFinite(Date.parse(version.createdAt))||(version.actorId!==null&&!participants.includes(version.actorId)))throw Error('Invalid proposal revision.');
      for(const side of ['a','b'])if(!version[`${side}Snapshot`]||(version[`${side}NodeId`]!==null&&version[`${side}Snapshot`].node?.id!==version[`${side}NodeId`]))throw Error('A proposal revision has invalid sources.');
    }
    const latest=versions.at(-1);
    if(['aNodeId','bNodeId','aSnapshot','bSnapshot'].some(field=>stableJSON(latest[field])!==stableJSON(c[field])))throw Error('The proposal revision must describe the current sources.');
    if(c.judgments!==undefined&&!Array.isArray(c.judgments))throw Error('A comparison has invalid judgments.');
    for(const judgment of judgments){
      if(typeof judgment.actorId!=='string'||actors.has(judgment.actorId)||!participants.includes(judgment.actorId)||!Array.isArray(judgment.history)||!Number.isFinite(Date.parse(judgment.createdAt))||!Number.isFinite(Date.parse(judgment.updatedAt)))throw Error('A comparison judgment is invalid.');
      if(judgment.aNodeId!==c.aNodeId||judgment.bNodeId!==c.bNodeId||!QUESTION_STATUSES[judgment.questionStatus]||typeof judgment.question!=='string'||typeof judgment.notes!=='string')throw Error('A comparison judgment has invalid sources.');
      if(judgment.questionStatus==='matched'?!ANSWER_STATUSES[judgment.answerStatus]:judgment.answerStatus!==null)throw Error('A comparison judgment skips the question step.');
      if(judgment.answerStatus==='divergent'&&judgment.provisional!==true)throw Error('Apparent divergences must remain provisional.');
      if(judgment.proposalRevision!==null&&(!Number.isSafeInteger(judgment.proposalRevision)||judgment.proposalRevision<1||judgment.proposalRevision>latest.revision))throw Error('A judgment refers to an invalid proposal revision.');
      if(typeof judgment.elicitationResponse!=='string'||judgment.elicitationResponse.length>10000||!Number.isSafeInteger(judgment.responseRevision)||judgment.responseRevision<0||typeof judgment.divergenceConfirmed!=='boolean'||!Array.isArray(judgment.reviewedResponses))throw Error('Invalid clarification response.');
      if(judgment.divergenceConfirmed&&(judgment.questionStatus!=='matched'||judgment.answerStatus!=='divergent'||judgment.reviewedResponses.length!==participants.length||judgment.reviewedResponses.some(response=>!participants.includes(response.actorId)||typeof response.response!=='string'||!response.response.trim()||response.proposalRevision!==judgment.proposalRevision)))throw Error('Invalid divergence confirmation.');
      for(const version of judgment.history){const saved={...c,...version,history:[]};if(!QUESTION_STATUSES[saved.questionStatus]||typeof saved.question!=='string'||typeof saved.notes!=='string'||!saved.aSnapshot||!saved.bSnapshot)throw Error('A comparison judgment history entry is invalid.');if(saved.questionStatus==='matched'?!ANSWER_STATUSES[saved.answerStatus]:saved.answerStatus!==null)throw Error('A comparison judgment history skips the question step.');}
      actors.add(judgment.actorId);
    }
    comparisons.add(c.id);
  }
  upgradeWorkspace(workspace);validateAdoptionData(workspace);upgradeComparisonThreads(workspace);
  if(!Array.isArray(workspace.comparisonThreads))throw Error('Invalid overall comparisons.');
  const threadIds=new Set(),pairs=new Set();
  for(const thread of workspace.comparisonThreads){
    const pair=comparisonPairKey(thread),owners=[...new Set([thread.aMapId,thread.bMapId].map(id=>workspace.maps.find(map=>map.id===id)?.ownerId))].sort();
    if(typeof thread.id!=='string'||!thread.id||thread.id.length>200||threadIds.has(thread.id)||pairs.has(pair)||!ids.has(thread.aMapId)||!ids.has(thread.bMapId)||thread.aMapId>=thread.bMapId||thread.status!=='active'||!owners.includes(thread.createdBy)||stableJSON(thread.participants)!==stableJSON(owners)||!Number.isFinite(Date.parse(thread.createdAt)))throw Error('An overall comparison has invalid sources or participants.');
    threadIds.add(thread.id);pairs.add(pair);
  }
  for(const proposal of workspace.comparisons)if(!workspace.comparisonThreads.some(thread=>thread.id===proposal.comparisonId&&comparisonPairKey(thread)===comparisonPairKey(proposal)))throw Error('A proposed judgment must belong to its overall comparison.');
  validateArguments(workspace);validateDefinitions(workspace);validateDiscussions(workspace);
  return workspace;
}
