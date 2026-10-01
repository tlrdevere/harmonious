import {validateDefinitionEdit} from '../dist/definitions.mjs';
import {validateDiscussionEdit} from '../dist/discussion.mjs';
import {roots,exampleMap} from '../dist/data.mjs';
import {validateWorkspace,sourceSnapshot,newId,comparisonParticipants,comparisonJudgments,comparisonJudgmentRevision,validateComparisonInput,comparisonPairKey,comparisonProposalVersions,comparisonResponseSet} from '../dist/workspace.mjs';
import {nodeWording,selectionContext,scopeNodeIds,endorsementEntryHealth} from '../dist/adoption.mjs';
import {accountKey,accountClone,stableJSON} from '../dist/account-model.mjs';
import {validateArgumentEdit} from '../dist/argument.mjs';
import {validateAdoptionBatch} from '../dist/adoption-fulfillment.mjs';
import {validateReflections,isReflectionOutcome} from '../dist/reflection.mjs';

export class AccountError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const check=(condition,message,status=400)=>{if(!condition)throw new AccountError(message,status);};
const equal=(a,b)=>stableJSON(a)===stableJSON(b);
export function fullAccountWorkspace(snapshot){
  const get=kind=>snapshot.records.filter(r=>r.kind===kind).map(r=>accountClone(r.value));
  return {schemaVersion:6,participants:get('profile'),maps:get('map'),ideas:get('idea'),endorsements:get('endorsement'),comparisons:get('comparison'),comparisonThreads:get('comparison_thread'),argumentNodes:get('argument_node'),argumentEdges:get('argument_edge'),discussions:get('discussion'),definitions:get('definition')};
}
export function initialAccountChanges(actor){
  const now=new Date().toISOString(),map={id:newId('map'),name:'My worldview',person:actor.name,ownerId:actor.id,mapType:'personal',visibility:'private',revision:1,nodes:exampleMap().filter(n=>n.parent===null),relations:[],updatedAt:now};
  return [{kind:'profile',id:actor.id,expectedRevision:0,value:{id:actor.id,name:actor.name}}, {kind:'map',id:map.id,expectedRevision:0,value:map}];
}
function visibleVersionIndex(workspace,actorId){
  const result=new Map(),include=(id,version)=>{if(id)result.set(id,Math.max(result.get(id)||0,version));};
  const maps=workspace.maps.filter(m=>m.ownerId===actorId||m.visibility==='shared');
  const sharedIds=new Set(workspace.maps.filter(m=>m.visibility==='shared').map(m=>m.id));
  for(const map of maps)for(const node of map.nodes){include(node.ideaId,node.ideaVersion);if(node.copiedFrom)include(node.copiedFrom.ideaId,node.copiedFrom.version);}
  for(const record of workspace.endorsements)if(record.participantId===actorId||sharedIds.has(record.sourceMapId))for(const entry of record.entries)include(entry.ideaId,entry.version);
  const ownMaps=new Set(maps.filter(m=>m.ownerId===actorId).map(m=>m.id));for(const idea of workspace.ideas)if(ownMaps.has(idea.originMapId))include(idea.id,idea.versions.at(-1).version);
  return result;
}
function accountEntryIssue(workspace,record,entry,index){
  const source=workspace.maps.find(m=>m.id===record.sourceMapId);
  if(source&&source.ownerId!==record.participantId&&source.visibility!=='shared')return 'Source is no longer shared';
  // A later private draft must not invalidate someone else's co-sign of a
  // still-visible shared version, or make that private draft discoverable.
  const idea=workspace.ideas.find(i=>i.id===entry.ideaId),latest=index.get(entry.ideaId)||0;
  if(idea&&latest&&latest<idea.versions.length)return endorsementEntryHealth({...workspace,ideas:workspace.ideas.map(i=>i.id===idea.id?{...i,versions:i.versions.slice(0,latest)}:i)},record,entry);
  return endorsementEntryHealth(workspace,record,entry);
}
function accountComparisonValue(workspace,record,ownerId){
  const value=accountClone(record),participants=comparisonParticipants(workspace,value);
  value.participants=participants;value.createdBy=value.createdBy||ownerId||participants[0]||null;value.judgments=comparisonJudgments(workspace,value);
  return value;
}
// Only this projection crosses the Worker/browser boundary. No email addresses,
// private map placements or unpublished wording history do. Comparison notes
// are shared only while both sources remain visible to the other participant.
export function projectAccountWorkspace(snapshot,actorId){
  const full=fullAccountWorkspace(snapshot),owned=snapshot.records.filter(r=>r.ownerId===actorId),ownKeys=new Set(owned.map(r=>accountKey(r.kind,r.id)));
  const maps=full.maps.filter(m=>!m.deletedAt&&(m.ownerId===actorId||m.visibility==='shared')),visibleIds=new Set(maps.map(m=>m.id));
  const comparisonRecords=snapshot.records.filter(r=>r.kind==='comparison'),comparisons=comparisonRecords.map(r=>accountComparisonValue(full,r.value,r.ownerId)).filter(c=>ownKeys.has(accountKey('comparison',c.id))||(comparisonParticipants(full,c).includes(actorId)&&visibleIds.has(c.aMapId)&&visibleIds.has(c.bMapId)));
  const healthIndexes=new Map();
  const endorsements=full.endorsements.filter(e=>e.participantId===actorId||visibleIds.has(e.sourceMapId)&&full.maps.find(m=>m.id===e.sourceMapId)?.visibility==='shared').map(e=>{
    const copy=accountClone(e);if(e.participantId!==actorId){if(!healthIndexes.has(e.participantId))healthIndexes.set(e.participantId,visibleVersionIndex(full,e.participantId));for(const entry of copy.entries){entry.serverIssue=accountEntryIssue(full,e,entry,healthIndexes.get(e.participantId));entry.targetMapId=null;entry.targetNodeId=null;}}
    return copy;
  });
  // Personal comparison history survives a source becoming private, without
  // exposing that source's current title, nodes, or later edits.
  const comparisonThreads=full.comparisonThreads.filter(thread=>ownKeys.has(accountKey('comparison_thread',thread.id))||comparisons.some(proposal=>proposal.comparisonId===thread.id)||(thread.participants.includes(actorId)&&visibleIds.has(thread.aMapId)&&visibleIds.has(thread.bMapId)));
  const missing=new Set([...comparisons,...comparisonThreads].flatMap(c=>[c.aMapId,c.bMapId]).filter(id=>!visibleIds.has(id)));
  for(const id of missing){const previous=full.maps.find(m=>m.id===id);if(previous)maps.push({id,name:'Unavailable source map',person:'',ownerId:previous.ownerId,mapType:previous.mapType,visibility:'private',unavailable:true,revision:1,nodes:exampleMap().filter(n=>n.parent===null),relations:[]});}
  const allowed=new Map();const include=(id,version)=>{if(!allowed.has(id))allowed.set(id,new Set());allowed.get(id).add(version);};
  for(const m of maps)for(const n of m.nodes){if(n.ideaId)include(n.ideaId,n.ideaVersion);if(n.copiedFrom)include(n.copiedFrom.ideaId,n.copiedFrom.version);}
  for(const e of endorsements)for(const entry of e.entries)include(entry.ideaId,entry.version);
  const ideas=full.ideas.filter(i=>allowed.has(i.id)||ownKeys.has(accountKey('idea',i.id))).map(i=>{
    if(ownKeys.has(accountKey('idea',i.id)))return i;
    const versions=allowed.get(i.id),maximum=Math.max(...versions);
    return {...i,versions:i.versions.slice(0,maximum).map(v=>versions.has(v.version)?v:{version:v.version,redacted:true,content:{kind:'explainer',title:'Private wording version',summary:'',details:'',timeScope:'present',sourceTitle:'',sourceUrl:'',frame:roots[0]}})};
  });
  const visibleProposals=new Set(comparisons.map(p=>p.id)),argumentNodes=full.argumentNodes.filter(n=>visibleProposals.has(n.proposalId)),argumentEdges=full.argumentEdges.filter(e=>visibleProposals.has(e.proposalId));
  const sharedThreads=new Set(comparisonThreads.filter(t=>t.participants.includes(actorId)&&[t.aMapId,t.bMapId].every(id=>visibleIds.has(id))).map(t=>t.id));
  let discussions=full.discussions.filter(r=>r.kind==='context'?visibleIds.has(r.target.mapId):sharedThreads.has(r.comparisonId));
  // References may point beyond the comparison. If a cited map stops being
  // shared, neither a saved snapshot nor a descendant response may disclose it.
  const referenceVisible=(value,participants)=>{
    if(!value||typeof value!=='object')return true;
    if(value.interaction?.reference){const map=full.maps.find(m=>m.id===value.interaction.reference.target.mapId);if(!map||map.deletedAt||!participants.every(id=>map.ownerId===id||map.visibility==='shared'))return false;}
    return Object.values(value).every(child=>referenceVisible(child,participants));
  };
  const hidden=new Set(discussions.filter(r=>!referenceVisible(r,full.comparisonThreads.find(t=>t.id===r.comparisonId)?.participants||[actorId])).map(r=>r.id));
  // Removing a private reference must not make an older personal assessment
  // appear current. Suppress that stance's earlier records in this projection
  // as well, while retaining every original record in account storage.
  const stanceGroups=new Map();
  for(const r of discussions)if(r.kind==='interaction'&&r.interaction?.mode==='compare'&&['endorse','disagree','decline'].includes(r.action)){
    const key=stableJSON([r.comparisonId,r.authorId,r.target]);if(!stanceGroups.has(key))stanceGroups.set(key,[]);stanceGroups.get(key).push(r);
  }
  for(const records of stanceGroups.values()){
    const newest=records.reduce((a,b)=>Date.parse(b.createdAt)>Date.parse(a.createdAt)||Date.parse(b.createdAt)===Date.parse(a.createdAt)&&String(b.id)>String(a.id)?b:a);
    if(hidden.has(newest.id))for(const r of records)hidden.add(r.id);
  }
  const references=record=>[record,...(record.history||[])].flatMap(r=>[r.target?.entryId,r.other?.entryId,r.interaction?.replyTo?.entryId,r.standstill?.disputeId,r.standstill?.anchor?.entryId,r.standstill?.previous?.entryId]).filter(Boolean);
  // A hidden successor must not resurrect an earlier confirmation. Hide the
  // complete standstill family when any history or causal dependency is hidden.
  const families=new Map();
  for(const r of discussions)if(r.kind==='standstill'){
    const id=r.action==='propose_standstill'?r.id:r.target?.entryId;
    if(!families.has(id))families.set(id,[]);families.get(id).push(r);
  }
  const available=new Set(discussions.map(r=>r.id));
  let changed=true;while(changed){
    changed=false;
    for(const r of discussions)if(!hidden.has(r.id)&&references(r).some(id=>hidden.has(id)||r.kind==='standstill'&&!available.has(id))){hidden.add(r.id);changed=true;}
    for(const records of families.values())if(records.some(r=>hidden.has(r.id)))for(const r of records)if(!hidden.has(r.id)){hidden.add(r.id);changed=true;}
  }
  discussions=discussions.filter(r=>!hidden.has(r.id));
  const workspace={schemaVersion:6,participants:full.participants,maps,ideas,endorsements,comparisons,comparisonThreads,argumentNodes,argumentEdges,discussions,definitions:full.definitions.filter(d=>d.authorId===actorId)};
  if(maps.length)validateWorkspace(workspace);
  const accessibleRevisions=snapshot.records.filter(r=>r.kind==='comparison'&&comparisons.some(c=>c.id===r.id)||r.kind==='comparison_thread'&&comparisonThreads.some(c=>c.id===r.id));
  const history=(snapshot.facilitationHistory||[]).filter(r=>r.kind==='map'?maps.some(m=>m.id===r.recordId&&!m.unavailable):discussions.some(d=>d.id===r.recordId));
  if(history.length){workspace.facilitationHistory=history;workspace.schemaVersion=7;}
  return {workspace,ownedKeys:[...ownKeys],revisions:Object.fromEntries([...owned,...accessibleRevisions].map(r=>[accountKey(r.kind,r.id),r.revision]))};
}
function validateEndorsement(candidate,old,value,actorId,latestVersions){
  check(value.participantId===actorId&&value.method==='authenticated','A co-sign must belong to the signed-in person.',403);
  if(old){
    const {status,endedAt,...before}=old,{status:nextStatus,endedAt:nextEnded,...after}=value;
    check(equal(before,after)&&status==='active'&&['withdrawn','superseded'].includes(nextStatus)&&Number.isFinite(Date.parse(nextEnded)),'A saved co-sign can only be withdrawn or replaced.');
    return;
  }
  check(value.status==='active'&&Number.isFinite(Date.parse(value.createdAt)),'Invalid new co-sign.');
  const source=candidate.maps.find(m=>m.id===value.sourceMapId);
  check(source&&(source.ownerId===actorId||source.visibility==='shared'),'This source is no longer available to co-sign.',409);
  check(value.sourceMapName===source.name,'The source map changed. Reopen it before co-signing.',409);
  for(const entry of value.entries){
    const node=source.nodes.find(n=>n.id===entry.sourceNodeId),idea=candidate.ideas.find(i=>i.id===entry.ideaId);
    check(node&&node.parent!==null&&node.ideaId===entry.ideaId&&node.ideaVersion===entry.version&&idea&&latestVersions.get(entry.ideaId)===entry.version,'The selected wording changed. Reopen the map to review it.',409);
    check(!('serverIssue' in entry),'Invalid co-sign metadata.');
    if(entry.targetMapId){const target=candidate.maps.find(m=>m.id===entry.targetMapId),copy=target?.nodes.find(n=>n.id===entry.targetNodeId);check(target?.ownerId===actorId&&target.mapType==='personal'&&copy?.ideaId===entry.ideaId&&copy.ideaVersion===entry.version,'A co-sign can only add wording to your own personal map.',403);}
    else check(entry.targetNodeId===null,'Invalid personal placement.');
  }
  const ids=value.entries.map(e=>e.sourceNodeId);
  check(equal(value.context,selectionContext(source,ids))&&equal(value.scopeNodeIds,scopeNodeIds(source,value.scope,value.anchorId)),'The selected map structure changed. Review the selection again.',409);
}
export function validateAccountChanges(snapshot,actorId,input,{allowMapDeletion=false}={}){
  check(Array.isArray(input)&&input.length>0&&input.length<=500,'Choose between 1 and 500 changes.');
  const records=new Map(snapshot.records.map(r=>[accountKey(r.kind,r.id),accountClone(r)])),seen=new Set(),fullBefore=fullAccountWorkspace(snapshot);
  const before=projectAccountWorkspace(snapshot,actorId).workspace,visibleMaps=new Set(before.maps.filter(m=>!m.unavailable).map(m=>m.id));
  const visibleVersions=new Set(before.ideas.flatMap(i=>i.versions.filter(v=>!v.redacted).map(v=>accountKey(i.id,v.version))));
  for(const change of input){
    const {kind,id,value,expectedRevision}=change,key=accountKey(kind,id),existing=records.get(key);
    check(['profile','map','idea','endorsement','comparison','comparison_thread','argument_node','argument_edge','discussion','definition'].includes(kind)&&typeof id==='string'&&id.length>0&&id.length<=200&&!seen.has(key)&&value?.id===id,'Invalid or duplicate record.');seen.add(key);
    check(Number.isSafeInteger(expectedRevision)&&expectedRevision>=0,'Missing record revision.');
    const sharedComparisonMember=kind==='comparison'&&existing&&comparisonParticipants(fullBefore,existing.value).includes(actorId);
    check(!existing||existing.ownerId===actorId||sharedComparisonMember,'You can only change your own maps and choices.',403);
    check((existing?.revision||0)===expectedRevision,'This item changed in another session. Download your work, then reopen saved before continuing.',409);
    if(kind==='profile')check(id===actorId&&typeof value.name==='string'&&value.name.trim().length>0&&value.name.length<=100&&Object.keys(value).every(k=>['id','name'].includes(k)),'Invalid display name.');
    if(kind==='map'){
      check(!existing?.value.deletedAt,'This map was deleted. Refresh maps before continuing.',409);
      check(value.ownerId===actorId&&['private','shared'].includes(value.visibility)&&!value.unavailable,'You can only save your own private or shared maps.',403);
      if(Object.hasOwn(value,'deletedAt'))check(allowMapDeletion&&existing&&typeof value.deletedAt==='string'&&Number.isFinite(Date.parse(value.deletedAt))&&value.visibility==='private'&&equal({...value,deletedAt:undefined,visibility:existing.value.visibility},{...existing.value,deletedAt:undefined}),'Use Delete map to remove your own map.',403);
    }
    if(kind==='idea'&&existing){const old=existing.value;check(value.originMapId===old.originMapId&&value.originNodeId===old.originNodeId&&value.versions.length>=old.versions.length&&equal(value.versions.slice(0,old.versions.length),old.versions),'Earlier wording versions must remain unchanged.');}
    records.set(key,{kind,id,ownerId:existing?.ownerId||actorId,revision:(existing?.revision||0)+1,value:accountClone(value)});
  }
  const candidate=fullAccountWorkspace({records:[...records.values()]});
  const deletedIds=new Set(candidate.maps.filter(m=>m.deletedAt).map(m=>m.id));
  const referencesDeleted=value=>value&&typeof value==='object'&&Object.entries(value).some(([key,child])=>(['mapId','aMapId','bMapId','originMapId','sourceMapId','targetMapId'].includes(key)&&deletedIds.has(child))||referencesDeleted(child));
  for(const {kind,value} of input){
    if(kind==='map'||kind==='profile'||kind==='definition')continue;
    const thread=candidate.comparisonThreads.find(t=>t.id===value.comparisonId),proposal=candidate.comparisons.find(p=>p.id===value.proposalId);
    // Withdrawing an old co-sign is still allowed; no new contributions can use deleted sources.
    if(kind==='endorsement'&&value.status!=='active')continue;
    check(!referencesDeleted(value)&&!referencesDeleted(thread)&&!referencesDeleted(proposal),'A source map was deleted. Refresh maps before continuing.',409);
  }
  for(const {value} of input.filter(c=>c.kind==='discussion'&&isReflectionOutcome(c.value)&&c.value.status==='active'))check(candidate.discussions.filter(r=>isReflectionOutcome(r)&&r.status==='active'&&r.authorId===value.authorId&&r.target?.entryId===value.target?.entryId).length===1,'You already have an outcome here. Reopen the point to edit your existing assessment.',409);
  try{validateReflections(candidate);}catch(error){throw new AccountError(error.message);}
  const latestVersions=visibleVersionIndex(candidate,actorId);
  check(candidate.participants.some(p=>p.id===actorId),'Account profile is missing.');
  for(const change of input){
    const {kind,value}=change,old=snapshot.records.find(r=>r.kind===kind&&r.id===change.id)?.value;
    if(kind==='definition')validateDefinitionEdit(old,value,actorId);
    if(kind==='discussion'){
      const newRecordIds=input.filter(c=>c.kind==='discussion'&&!snapshot.records.some(r=>r.kind==='discussion'&&r.id===c.id)).map(c=>c.id);
      try{validateDiscussionEdit(candidate,old,value,actorId,{newRecordIds});}catch(error){throw new AccountError(error.message,error.status||403);}
    }
    if(kind==='argument_node'||kind==='argument_edge'){
      check(value.authorId===actorId,'Only the author can save this reasoning.',403);
      const proposal=candidate.comparisons.find(p=>p.id===value.proposalId);
      check(proposal&&[proposal.aMapId,proposal.bMapId].every(id=>visibleMaps.has(id)||candidate.maps.some(map=>map.id===id&&map.ownerId===actorId)),'Both comparison sources must still be available to save reasoning.',403);
      try{validateArgumentEdit(candidate,old,value,actorId);}catch(error){throw new AccountError(error.message,409);}
    }
    if(kind==='comparison_thread'){
      check(!old||equal(old,value),'An overall comparison’s identity cannot be changed.',409);
      check(value.createdBy===actorId,'Start a comparison under your own account.',403);
      const sources=[value.aMapId,value.bMapId].map(id=>candidate.maps.find(map=>map.id===id));
      check(sources.every(map=>map&&!map.unavailable&&(map.ownerId===actorId||visibleMaps.has(map.id)))&&sources.some(map=>map.ownerId===actorId),'Choose one of your maps and another visible map.',403);
      check(candidate.comparisonThreads.filter(thread=>comparisonPairKey(thread)===comparisonPairKey(value)).length===1,'This comparison already exists. Refresh maps to open it.',409);
    }
    if(kind==='idea'){const map=candidate.maps.find(m=>m.id===value.originMapId);check(map?.ownerId===actorId,'Shared wording can only be edited by its author.',403);}
    if(kind==='map')for(const n of value.nodes){
      if(n.parent===null)continue;const idea=records.get(accountKey('idea',n.ideaId));
      check(idea?.ownerId===actorId||visibleVersions.has(accountKey(n.ideaId,n.ideaVersion)),'This wording is not available to add to your map.',403);
      if(n.copiedFrom)check(visibleVersions.has(accountKey(n.copiedFrom.ideaId,n.copiedFrom.version))||records.get(accountKey('idea',n.copiedFrom.ideaId))?.ownerId===actorId,'The copy source is unavailable.',403);
    }
    if(kind==='endorsement')validateEndorsement(candidate,old,value,actorId,latestVersions);
    if(kind==='comparison'){
      check(candidate.comparisonThreads.some(thread=>thread.id===value.comparisonId&&comparisonPairKey(thread)===comparisonPairKey(value)),'Open the overall comparison before recording a judgment.',409);
      check(!old||!old.comparisonId||old.comparisonId===value.comparisonId,'A judgment cannot move to another comparison.',409);
      const oldComparison=old,oldRecord=snapshot.records.find(r=>r.kind==='comparison'&&r.id===change.id),oldValue=oldComparison?accountComparisonValue(fullBefore,oldComparison,oldRecord?.ownerId):null,oldJudgments=oldValue?comparisonJudgments(fullBefore,oldValue):[],nextJudgments=comparisonJudgments(candidate,value),mapOwners=[value.aMapId,value.bMapId].map(id=>candidate.maps.find(m=>m.id===id)?.ownerId).filter(Boolean),declared=[...new Set(value.participants||[])];
      check(value.createdBy=== (oldValue?.createdBy||actorId),'A comparison creator cannot be changed.',403);
      check(declared.length===new Set(mapOwners).size&&declared.every(id=>mapOwners.includes(id)),'A comparison must stay between the map owners.',403);
      check(value.aMapId===oldComparison?.aMapId||!oldComparison,'A comparison source cannot be changed.',409);
      check(value.bMapId===oldComparison?.bMapId||!oldComparison,'A comparison source cannot be changed.',409);
      check(nextJudgments.some(j=>j.actorId===actorId),'Save your own judgment in this comparison.',403);
      const oldActors=new Set(oldJudgments.map(j=>j.actorId));
      for(const judgment of nextJudgments){if(!oldActors.has(judgment.actorId)&&judgment.actorId!==actorId)throw new AccountError('You can only add your own judgment.',403);}
      for(const prior of oldJudgments){const next=nextJudgments.find(j=>j.actorId===prior.actorId);check(next&&equal(next,prior)||prior.actorId===actorId,'Another participant’s judgment cannot be changed.',403);}
      const own=nextJudgments.find(j=>j.actorId===actorId),prior=oldJudgments.find(j=>j.actorId===actorId);
      const oldVersions=oldValue?comparisonProposalVersions(oldValue):[],versions=comparisonProposalVersions(value);
      check(Array.isArray(versions)&&versions.length>0&&versions.length>=oldVersions.length&&equal(versions.slice(0,oldVersions.length),oldVersions),'Earlier proposal revisions must remain unchanged.',409);
      check(versions.slice(oldVersions.length).every(version=>version.actorId===actorId&&(actorId===value.createdBy||version.question===oldVersions.at(-1)?.question)),'Only the proposer can revise the proposed question.',403);
      const latest=versions.at(-1);
      check(own.proposalRevision===latest.revision,'Review the current proposal before saving your judgment.',409);
      check(latest.question===nextJudgments.find(j=>j.actorId===value.createdBy)?.question,'The proposed question must match its author’s wording.',409);
      if(own.divergenceConfirmed){
        const responses=comparisonResponseSet(candidate,value);
        check(mapOwners.length>1&&new Set(mapOwners).size>1&&mapOwners.every(id=>responses.some(response=>response.actorId===id&&response.proposalRevision===latest.revision&&response.response.trim()))&&equal(own.reviewedResponses,responses),'Review both current clarification responses before confirming divergence.',409);
      }else check(own.reviewedResponses.length===0,'Only a confirmation records reviewed responses.',409);
      validateComparisonInput(candidate,{...value,...own});
      const expectedHistory=prior?[...prior.history,comparisonJudgmentRevision(prior)]:[];
      // Several local revisions may be recorded before autosave completes.
      // The saved prefix must survive exactly; new revisions belong to this actor.
      check(own.history.length>=expectedHistory.length&&equal(own.history.slice(0,expectedHistory.length),expectedHistory),'Earlier judgment history must remain unchanged.',409);
      check(own.history.slice(expectedHistory.length).every(version=>version.actorId===actorId),'You can only append your own judgment history.',403);
      let previousResponse=prior?.elicitationResponse||'',responseRevision=prior?.responseRevision||0;
      for(const version of [...own.history.slice(expectedHistory.length),own]){
        if(version.elicitationResponse!==previousResponse)responseRevision++;
        check(version.responseRevision===responseRevision,'Clarification response revisions must preserve earlier changes.',409);
        previousResponse=version.elicitationResponse;
      }
      check(!prior||own.createdAt===prior.createdAt,'A judgment creation date cannot be changed.',409);
      check(!oldValue||value.createdAt===oldValue.createdAt,'A comparison creation date cannot be changed.',409);
      const primary=nextJudgments.find(j=>j.actorId===value.createdBy)||nextJudgments[0];
      check(primary&&['aNodeId','bNodeId','questionStatus','question','answerStatus','notes','provisional','history','proposalRevision','elicitationResponse','responseRevision','divergenceConfirmed','reviewedResponses'].every(field=>equal(value[field],primary[field])),'A comparison must reflect its creator’s judgment.',409);
      if(oldValue&&oldJudgments.some(j=>j.actorId!==actorId))check(value.aNodeId===oldValue.aNodeId&&value.bNodeId===oldValue.bNodeId,'Start a new proposal to change shared sources.',409);
      check(['a','b'].every(side=>equal(own[`${side}Snapshot`],value[`${side}Snapshot`])),'Your judgment must refer to the reviewed sources.',409);
      for(const side of ['a','b']){const map=candidate.maps.find(m=>m.id===value[`${side}MapId`]);check(map&&(map.ownerId===actorId||visibleMaps.has(map.id)),'A comparison source is no longer shared.',403);check(equal(sourceSnapshot(map,value[`${side}NodeId`]),value[`${side}Snapshot`]),'A comparison source changed. Review it again.',409);}
    }
  }
  for(const change of input.filter(c=>c.kind==='endorsement')){
    const e=change.value;
    if(e.replacesId&&!snapshot.records.some(r=>r.kind==='endorsement'&&r.id===e.id)){
      const old=snapshot.records.find(r=>r.kind==='endorsement'&&r.id===e.replacesId),next=records.get(accountKey('endorsement',e.replacesId));
      check(old?.ownerId===actorId&&old.value.status==='active'&&next?.value.status==='superseded'&&next.value.endedAt===e.createdAt,'The previous co-sign can no longer be replaced.',409);
    }
    if(e.status==='superseded')check(input.some(c=>c.kind==='endorsement'&&c.value.replacesId===e.id&&c.value.status==='active'),'A replacement co-sign is missing.');
  }
  validateAdoptionBatch(fullBefore,candidate,actorId,input);validateWorkspace(candidate);
  return orderAccountChanges(input.map(c=>({...c,value:accountClone(c.value)})));
}

// The database checks each discussion target when its row is written. Keep
// dependencies before dependants even when a client submits a reversed chain.
export function orderAccountChanges(changes){
  const discussions=new Map(changes.filter(change=>change.kind==='discussion').map(change=>[change.id,change])),done=new Set(),ordered=[];
  for(const start of discussions.values()){
    const path=new Set(),stack=[{change:start,expanded:false}];
    while(stack.length){
      const step=stack.pop(),id=step.change.id;if(done.has(id))continue;
      if(step.expanded){path.delete(id);done.add(id);ordered.push(step.change);continue;}
      check(!path.has(id),'Conversation targets cannot form a cycle.');path.add(id);stack.push({...step,expanded:true});
      const value=step.change.value,dependencies=[value.other?.entryId,value.target?.entryId,value.interaction?.replyTo?.entryId,value.standstill?.disputeId,value.standstill?.anchor?.entryId,value.standstill?.previous?.entryId];
      for(const dependency of new Set(dependencies))if(dependency!==id&&discussions.has(dependency))stack.push({change:discussions.get(dependency),expanded:false});
    }
  }
  return [...changes.filter(change=>change.kind!=='discussion'),...ordered];
}
