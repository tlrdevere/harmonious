import {roots,exampleMap} from '../dist/data.mjs';
import {validateWorkspace,sourceSnapshot,newId} from '../dist/workspace.mjs';
import {nodeWording,selectionContext,scopeNodeIds,endorsementEntryHealth} from '../dist/adoption.mjs';
import {accountKey,accountClone,stableJSON} from '../dist/account-model.mjs';

export class AccountError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const check=(condition,message,status=400)=>{if(!condition)throw new AccountError(message,status);};
const equal=(a,b)=>stableJSON(a)===stableJSON(b);
export function fullAccountWorkspace(snapshot){
  const get=kind=>snapshot.records.filter(r=>r.kind===kind).map(r=>accountClone(r.value));
  return {schemaVersion:2,participants:get('profile'),maps:get('map'),ideas:get('idea'),endorsements:get('endorsement'),comparisons:get('comparison')};
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
// Only this projection crosses the Worker/browser boundary. No email addresses,
// private map placements, unpublished wording history, or other users' notes do.
export function projectAccountWorkspace(snapshot,actorId){
  const full=fullAccountWorkspace(snapshot),owned=snapshot.records.filter(r=>r.ownerId===actorId),ownKeys=new Set(owned.map(r=>accountKey(r.kind,r.id)));
  const maps=full.maps.filter(m=>m.ownerId===actorId||m.visibility==='shared'),visibleIds=new Set(maps.map(m=>m.id));
  const comparisons=full.comparisons.filter(c=>ownKeys.has(accountKey('comparison',c.id)));
  const healthIndexes=new Map();
  const endorsements=full.endorsements.filter(e=>e.participantId===actorId||visibleIds.has(e.sourceMapId)&&full.maps.find(m=>m.id===e.sourceMapId)?.visibility==='shared').map(e=>{
    const copy=accountClone(e);if(e.participantId!==actorId){if(!healthIndexes.has(e.participantId))healthIndexes.set(e.participantId,visibleVersionIndex(full,e.participantId));for(const entry of copy.entries){entry.serverIssue=accountEntryIssue(full,e,entry,healthIndexes.get(e.participantId));entry.targetMapId=null;entry.targetNodeId=null;}}
    return copy;
  });
  // Personal comparison history survives a source becoming private, without
  // exposing that source's current title, nodes, or later edits.
  const missing=new Set(comparisons.flatMap(c=>[c.aMapId,c.bMapId]).filter(id=>!visibleIds.has(id)));
  for(const id of missing){const previous=full.maps.find(m=>m.id===id);if(previous)maps.push({id,name:'Unavailable source map',person:'',ownerId:previous.ownerId,mapType:previous.mapType,visibility:'private',unavailable:true,revision:1,nodes:exampleMap().filter(n=>n.parent===null),relations:[]});}
  const allowed=new Map();const include=(id,version)=>{if(!allowed.has(id))allowed.set(id,new Set());allowed.get(id).add(version);};
  for(const m of maps)for(const n of m.nodes){if(n.ideaId)include(n.ideaId,n.ideaVersion);if(n.copiedFrom)include(n.copiedFrom.ideaId,n.copiedFrom.version);}
  for(const e of endorsements)for(const entry of e.entries)include(entry.ideaId,entry.version);
  const ideas=full.ideas.filter(i=>allowed.has(i.id)||ownKeys.has(accountKey('idea',i.id))).map(i=>{
    if(ownKeys.has(accountKey('idea',i.id)))return i;
    const versions=allowed.get(i.id),maximum=Math.max(...versions);
    return {...i,versions:i.versions.slice(0,maximum).map(v=>versions.has(v.version)?v:{version:v.version,redacted:true,content:{kind:'explainer',title:'Private wording version',summary:'',details:'',timeScope:'present',sourceTitle:'',sourceUrl:'',frame:roots[0]}})};
  });
  const workspace={schemaVersion:2,participants:full.participants,maps,ideas,endorsements,comparisons};
  if(maps.length)validateWorkspace(workspace);
  return {workspace,ownedKeys:[...ownKeys],revisions:Object.fromEntries(owned.map(r=>[accountKey(r.kind,r.id),r.revision]))};
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
export function validateAccountChanges(snapshot,actorId,input){
  check(Array.isArray(input)&&input.length>0&&input.length<=500,'Choose between 1 and 500 changes.');
  const records=new Map(snapshot.records.map(r=>[accountKey(r.kind,r.id),accountClone(r)])),seen=new Set();
  const before=projectAccountWorkspace(snapshot,actorId).workspace,visibleMaps=new Set(before.maps.filter(m=>!m.unavailable).map(m=>m.id));
  const visibleVersions=new Set(before.ideas.flatMap(i=>i.versions.filter(v=>!v.redacted).map(v=>accountKey(i.id,v.version))));
  for(const change of input){
    const {kind,id,value,expectedRevision}=change,key=accountKey(kind,id),existing=records.get(key);
    check(['profile','map','idea','endorsement','comparison'].includes(kind)&&typeof id==='string'&&id.length>0&&id.length<=200&&!seen.has(key)&&value?.id===id,'Invalid or duplicate record.');seen.add(key);
    check(Number.isSafeInteger(expectedRevision)&&expectedRevision>=0,'Missing record revision.');
    check(!existing||existing.ownerId===actorId,'You can only change your own maps and choices.',403);
    check((existing?.revision||0)===expectedRevision,'This item changed in another session. Download your work, then reopen saved before continuing.',409);
    if(kind==='profile')check(id===actorId&&typeof value.name==='string'&&value.name.trim().length>0&&value.name.length<=100&&Object.keys(value).every(k=>['id','name'].includes(k)),'Invalid display name.');
    if(kind==='map')check(value.ownerId===actorId&&['private','shared'].includes(value.visibility)&&!value.unavailable,'You can only save your own private or shared maps.',403);
    if(kind==='idea'&&existing){const old=existing.value;check(value.originMapId===old.originMapId&&value.originNodeId===old.originNodeId&&value.versions.length>=old.versions.length&&equal(value.versions.slice(0,old.versions.length),old.versions),'Earlier wording versions must remain unchanged.');}
    records.set(key,{kind,id,ownerId:actorId,revision:(existing?.revision||0)+1,value:accountClone(value)});
  }
  const candidate=fullAccountWorkspace({records:[...records.values()]});
  const latestVersions=visibleVersionIndex(candidate,actorId);
  check(candidate.participants.some(p=>p.id===actorId),'Account profile is missing.');
  for(const change of input){
    const {kind,value}=change,old=snapshot.records.find(r=>r.kind===kind&&r.id===change.id)?.value;
    if(kind==='idea'){const map=candidate.maps.find(m=>m.id===value.originMapId);check(map?.ownerId===actorId,'Shared wording can only be edited by its author.',403);}
    if(kind==='map')for(const n of value.nodes){
      if(n.parent===null)continue;const idea=records.get(accountKey('idea',n.ideaId));
      check(idea?.ownerId===actorId||visibleVersions.has(accountKey(n.ideaId,n.ideaVersion)),'This wording is not available to add to your map.',403);
      if(n.copiedFrom)check(visibleVersions.has(accountKey(n.copiedFrom.ideaId,n.copiedFrom.version))||records.get(accountKey('idea',n.copiedFrom.ideaId))?.ownerId===actorId,'The copy source is unavailable.',403);
    }
    if(kind==='endorsement')validateEndorsement(candidate,old,value,actorId,latestVersions);
    if(kind==='comparison'){
      for(const side of ['a','b']){const map=candidate.maps.find(m=>m.id===value[`${side}MapId`]);check(map&&(map.ownerId===actorId||visibleMaps.has(map.id)),'A comparison source is no longer shared.',403);check(equal(sourceSnapshot(map,value[`${side}NodeId`]),value[`${side}Snapshot`]),'A comparison source changed. Review it again.',409);}
      const expectedHistory=old?[...old.history,(({history,...record})=>record)(old)]:[];check(equal(value.history,expectedHistory),'Earlier comparison history must remain unchanged.');
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
  validateWorkspace(candidate);
  return input.map(c=>({...c,value:accountClone(c.value)}));
}
