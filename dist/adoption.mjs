import {roots,exampleMap} from './data.mjs';
import {frameOf,validateGraph,NODE_KINDS} from './model.mjs';
import {stableJSON} from './account-model.mjs';

const adoptionId=prefix=>`${prefix}-${globalThis.crypto.randomUUID()}`;
const adoptionClone=value=>JSON.parse(JSON.stringify(value));
const adoptionEqual=(a,b)=>stableJSON(a)===stableJSON(b);
export const sharedKey=(ideaId,version)=>JSON.stringify([ideaId,version]);
export function nodeWording(map,node){return {kind:node.kind,title:node.title,summary:node.summary,details:node.details,timeScope:node.timeScope||'present',sourceTitle:node.sourceTitle||'',sourceUrl:node.sourceUrl||'',frame:frameOf(map.nodes,node.id)};}
export function ideaVersion(workspace,id,version){return workspace.ideas.find(i=>i.id===id)?.versions.find(v=>v.version===version);}
export function synchronizeIdeas(workspace,map){
  for(const node of map.nodes){
    if(node.parent===null)continue;const content=nodeWording(map,node),idea=workspace.ideas.find(i=>i.id===node.ideaId),saved=idea?.versions.find(v=>v.version===node.ideaVersion);
    if(saved&&adoptionEqual(saved.content,content))continue;
    if(idea&&idea.originMapId===map.id&&idea.originNodeId===node.id){const version=idea.versions.length+1;idea.versions.push({version,content,createdAt:new Date().toISOString()});node.ideaVersion=version;}
    else {const copiedFrom=saved?{ideaId:node.ideaId,version:node.ideaVersion,mapId:idea.originMapId,nodeId:idea.originNodeId}:node.copiedFrom||null,id=adoptionId('idea');workspace.ideas.push({id,originMapId:map.id,originNodeId:node.id,versions:[{version:1,content,createdAt:new Date().toISOString()}]});node.ideaId=id;node.ideaVersion=1;node.copiedFrom=copiedFrom;node.reuseMode=copiedFrom?'adapted':'original';}
  }
}
export function upgradeWorkspace(workspace){
  if(workspace.schemaVersion===2)return workspace;
  if(workspace.schemaVersion!==1)throw Error('This workspace version is not supported.');
  workspace.schemaVersion=2;workspace.participants=[];workspace.ideas=[];workspace.endorsements=[];
  for(const map of workspace.maps){map.mapType='personal';map.ownerId=`participant:${map.id}`;workspace.participants.push({id:map.ownerId,name:map.person.trim()||map.name});synchronizeIdeas(workspace,map);}
  return workspace;
}
export function createOwnedMap(workspace,{name,ownerId,personName,mapType='personal',fromMapId=null}){
  if(workspace.maps.length>=100)throw Error('This prototype supports up to 100 maps per workspace.');
  if(!name?.trim())throw Error('Enter a map name.');if(!['personal','reference'].includes(mapType))throw Error('Choose a map type.');
  let person=workspace.participants.find(p=>p.id===ownerId);if(!person){if(!personName?.trim())throw Error('Enter the participant or creator’s name.');person={id:adoptionId('participant'),name:personName.trim()};}
  const source=fromMapId?workspace.maps.find(m=>m.id===fromMapId):null;if(fromMapId&&!source)throw Error('The starting map is unavailable.');
  const map={id:adoptionId('map'),name:name.trim(),ownerId:person.id,person:person.name,mapType,revision:1,nodes:exampleMap().filter(n=>n.parent===null),relations:[],updatedAt:new Date().toISOString()};
  if(!workspace.participants.some(p=>p.id===person.id))workspace.participants.push(person);workspace.maps.push(map);
  if(source)transferNodes(workspace,{sourceMapId:source.id,targetMapId:map.id,nodeIds:source.nodes.filter(n=>n.parent!==null).map(n=>n.id),mode:'copy'});
  return map;
}
export function scopeNodeIds(map,scope='node',anchorId=null){
  if(scope==='map')return map.nodes.filter(n=>n.parent!==null).map(n=>n.id);
  if(!map.nodes.some(n=>n.id===anchorId))return [];
  if(scope==='node')return roots.includes(anchorId)?[]:[anchorId];
  const ids=new Set([anchorId]);let changed=true;while(changed){changed=false;for(const n of map.nodes)if(ids.has(n.parent)&&!ids.has(n.id)){ids.add(n.id);changed=true;}}
  return map.nodes.filter(n=>n.parent!==null&&ids.has(n.id)).map(n=>n.id);
}
export function selectionContext(map,nodeIds){
  const set=new Set(nodeIds);return {nodes:map.nodes.filter(n=>set.has(n.id)).map(n=>({id:n.id,parent:n.parent,structuralType:n.structuralType})).sort((a,b)=>a.id.localeCompare(b.id)),relations:map.relations.filter(e=>set.has(e.from)&&set.has(e.to)).map(e=>adoptionClone(e)).sort((a,b)=>a.id.localeCompare(b.id))};
}
// Placement is local to a map. Co-signing preserves wording identity; copying starts a new one.
export function transferNodes(workspace,{sourceMapId,targetMapId,nodeIds,mode='linked',parentId=null,updateExisting=false}){
  const source=workspace.maps.find(m=>m.id===sourceMapId),target=workspace.maps.find(m=>m.id===targetMapId);
  if(!source||!target||source===target)throw Error('Choose a different destination map.');if(!['linked','copy'].includes(mode))throw Error('Choose a reuse action.');
  const ids=new Set(nodeIds);if(!ids.size)throw Error('Select at least one node.');
  const selected=source.nodes.filter(n=>ids.has(n.id));if(selected.length!==ids.size||selected.some(n=>n.parent===null))throw Error('Choose content nodes, not frame headings.');
  const frames=new Set(selected.map(n=>frameOf(source.nodes,n.id))),parent=parentId?target.nodes.find(n=>n.id===parentId):null;
  if(parentId&&(!parent||frames.size!==1||!frames.has(frameOf(target.nodes,parent.id))))throw Error('Choose a destination within the same frame.');
  const candidate=adoptionClone(target),mapping=new Map(),added=[],updated=[];
  for(const n of selected){const existing=mode==='linked'?candidate.nodes.find(p=>p.ideaId===n.ideaId&&(p.ideaVersion===n.ideaVersion||(updateExisting&&p.reuseMode==='linked'&&frameOf(target.nodes,p.id)===frameOf(source.nodes,n.id)))):null;mapping.set(n.id,existing?.id||adoptionId('node'));if(existing&&existing.ideaVersion!==n.ideaVersion){const {frame,...wording}=nodeWording(source,n);Object.assign(existing,wording,{ideaVersion:n.ideaVersion});updated.push(existing.id);}}
  for(const n of selected){
    const id=mapping.get(n.id);if(candidate.nodes.some(p=>p.id===id))continue;
    let ancestor=source.nodes.find(p=>p.id===n.parent);while(ancestor&&ancestor.parent!==null&&!mapping.has(ancestor.id))ancestor=source.nodes.find(p=>p.id===ancestor.parent);
    const destination=mapping.get(ancestor?.id)||parent?.id||frameOf(source.nodes,n.id),sameParent=mapping.has(n.parent);
    const copy={...adoptionClone(n),id,parent:destination,structuralType:sameParent?n.structuralType:'nesting',confidence:null,reuseMode:mode==='linked'?'linked':'adapted',copiedFrom:{ideaId:n.ideaId,version:n.ideaVersion,mapId:source.id,nodeId:n.id}};
    if(mode==='copy'){delete copy.ideaId;delete copy.ideaVersion;}
    candidate.nodes.push(copy);added.push(id);
  }
  for(const edge of source.relations){if(!mapping.has(edge.from)||!mapping.has(edge.to))continue;const from=mapping.get(edge.from),to=mapping.get(edge.to);if(!candidate.relations.some(e=>e.from===from&&e.to===to&&e.type===edge.type))candidate.relations.push({...adoptionClone(edge),id:adoptionId('relation'),from,to});}
  if(candidate.nodes.length>2000)throw Error('This would exceed the 2,000-node limit for a map. Choose a smaller section.');
  validateGraph(candidate.nodes,roots,candidate.relations);target.nodes=candidate.nodes;target.relations=candidate.relations;if(added.length||updated.length){target.revision++;target.updatedAt=new Date().toISOString();}synchronizeIdeas(workspace,target);
  return {mapping,added,updated};
}
export function endorseNodes(workspace,{participantId,sourceMapId,nodeIds,scope='node',anchorId=null,targetMapId=null,parentId=null,replaceId=null}){
  const person=workspace.participants.find(p=>p.id===participantId),source=workspace.maps.find(m=>m.id===sourceMapId),target=workspace.maps.find(m=>m.id===targetMapId);
  if(!person||!source)throw Error('Choose a participant and source map.');if(!['node','section','map','selection'].includes(scope))throw Error('Choose an endorsement scope.');
  const selected=new Set(nodeIds),nodes=source.nodes.filter(n=>selected.has(n.id));if(!nodes.length||nodes.length!==selected.size||nodes.some(n=>n.parent===null))throw Error('Select at least one content node.');
  if(targetMapId&&(!target||target.mapType!=='personal'||target.ownerId!==participantId||target===source))throw Error('Choose this participant’s own personal map as the destination.');
  if(replaceId&&!workspace.endorsements.some(e=>e.id===replaceId&&e.participantId===participantId&&e.status==='active'))throw Error('This co-sign record can no longer be replaced.');
  for(const n of nodes){const idea=workspace.ideas.find(i=>i.id===n.ideaId);if(!idea||n.ideaVersion!==idea.versions.at(-1).version)throw Error('This map includes an older shared node. Open its original source to review the current wording.');}
  const transfer=target?transferNodes(workspace,{sourceMapId,targetMapId,nodeIds:[...selected],mode:'linked',parentId,updateExisting:!!replaceId}):null;
  const record={id:adoptionId('endorsement'),participantId,sourceMapId,sourceMapName:source.name,scope,anchorId,entries:nodes.map(n=>({ideaId:n.ideaId,version:n.ideaVersion,sourceNodeId:n.id,targetMapId:target?.id||null,targetNodeId:transfer?.mapping.get(n.id)||null})),context:selectionContext(source,[...selected]),scopeNodeIds:scopeNodeIds(source,scope,anchorId),createdAt:new Date().toISOString(),status:'active',replacesId:replaceId,method:'facilitator-recorded'};
  if(replaceId){const previous=workspace.endorsements.find(e=>e.id===replaceId);previous.status='superseded';previous.endedAt=record.createdAt;}
  workspace.endorsements.push(record);return record;
}
export function endorsementEntryHealth(workspace,record,entry){
  if(Object.hasOwn(entry,'serverIssue'))return entry.serverIssue;
  const idea=workspace.ideas.find(i=>i.id===entry.ideaId),source=workspace.maps.find(m=>m.id===record.sourceMapId),node=source?.nodes.find(n=>n.id===entry.sourceNodeId);
  if(!idea||!node)return 'Source removed';
  if(node.ideaId!==entry.ideaId)return 'Source adapted';
  if(idea.versions.at(-1).version!==entry.version||node.ideaVersion!==entry.version)return 'Wording changed';
  if(entry.targetMapId){const target=workspace.maps.find(m=>m.id===entry.targetMapId)?.nodes.find(n=>n.id===entry.targetNodeId);if(!target)return 'Removed from personal map';if(target.ideaId!==entry.ideaId||target.ideaVersion!==entry.version)return 'Personal version changed';}
  return null;
}
export function endorsementHealth(workspace,record){
  const issues=record.entries.map(e=>endorsementEntryHealth(workspace,record,e)).filter(Boolean),source=workspace.maps.find(m=>m.id===record.sourceMapId);
  if(source){if(!adoptionEqual(record.context,selectionContext(source,record.entries.map(e=>e.sourceNodeId))))issues.push('Selected structure changed');if(['map','section'].includes(record.scope)&&!adoptionEqual(record.scopeNodeIds,scopeNodeIds(source,record.scope,record.anchorId)))issues.push('Section or map membership changed');}
  return {needsReview:issues.length>0,issues:[...new Set(issues)]};
}
export function withdrawEndorsement(workspace,id,participantId){const record=workspace.endorsements.find(e=>e.id===id&&e.participantId===participantId);if(!record||record.status!=='active')throw Error('This co-sign is no longer active.');record.status='withdrawn';record.endedAt=new Date().toISOString();return record;}
export function endorsementIndex(workspace,participantIds=workspace.participants.map(p=>p.id)){
  const selected=new Set(participantIds),result=new Map();
  for(const record of workspace.endorsements){if(record.status!=='active'||!selected.has(record.participantId))continue;for(const entry of record.entries){const key=sharedKey(entry.ideaId,entry.version);if(!result.has(key))result.set(key,{current:new Set(),review:new Set()});const group=result.get(key);group[endorsementEntryHealth(workspace,record,entry)?'review':'current'].add(record.participantId);}}
  for(const value of result.values())for(const id of value.current)value.review.delete(id);return result;
}
export function nodeEndorsements(index,node){return index.get(sharedKey(node.ideaId,node.ideaVersion))||{current:new Set(),review:new Set()};}
export function commonEndorsers(index,nodes){if(!nodes.length)return new Set();let people=new Set(nodeEndorsements(index,nodes[0]).current);for(const node of nodes.slice(1)){const next=nodeEndorsements(index,node).current;people=new Set([...people].filter(id=>next.has(id)));}return people;}
export function derivePodMap(workspace,mapId,participantIds,minimum){
  const source=workspace.maps.find(m=>m.id===mapId);if(!source)throw Error('Choose a map to view.');const people=[...new Set(participantIds)].filter(id=>workspace.participants.some(p=>p.id===id)),index=endorsementIndex(workspace,people),threshold=Math.max(1,Math.min(people.length||1,Number(minimum)||1));
  const matched=new Set(source.nodes.filter(n=>n.parent!==null&&nodeEndorsements(index,n).current.size>=threshold).map(n=>n.id)),included=new Set(roots),byId=new Map(source.nodes.map(n=>[n.id,n]));
  for(const id of matched){let n=byId.get(id);while(n){included.add(n.id);n=byId.get(n.parent);}}
  return {map:{...source,id:`pod:${source.id}`,nodes:source.nodes.filter(n=>included.has(n.id)).map(n=>({...n,podContext:!matched.has(n.id)})),relations:source.relations.filter(e=>included.has(e.from)&&included.has(e.to))},matched,index,people,threshold};
}
export function validateAdoptionData(workspace){
  if(!Array.isArray(workspace.participants)||!Array.isArray(workspace.ideas)||!Array.isArray(workspace.endorsements)||workspace.participants.length>500||workspace.ideas.length>15000||workspace.endorsements.length>10000)throw Error('Invalid shared-node workspace.');
  const people=new Set(),ideas=new Map(),records=new Set();
  for(const p of workspace.participants){if(typeof p.id!=='string'||people.has(p.id)||typeof p.name!=='string'||!p.name.trim())throw Error('Invalid or duplicate participant.');people.add(p.id);}
  for(const idea of workspace.ideas){
    if(typeof idea.id!=='string'||ideas.has(idea.id)||typeof idea.originMapId!=='string'||typeof idea.originNodeId!=='string'||!Array.isArray(idea.versions)||!idea.versions.length)throw Error('Invalid shared-node identity.');ideas.set(idea.id,idea);
    for(const [i,v]of idea.versions.entries()){const c=v.content;if(v.version!==i+1||!c||!NODE_KINDS[c.kind]||!roots.includes(c.frame)||['title','summary','details','sourceTitle','sourceUrl','timeScope'].some(k=>typeof c[k]!=='string'))throw Error('Invalid shared-node version.');if(c.sourceUrl){let url;try{url=new URL(c.sourceUrl);}catch{throw Error('Invalid saved source URL.');}if(!['https:','http:'].includes(url.protocol))throw Error('Invalid saved source URL.');}}
  }
  for(const map of workspace.maps){if(!people.has(map.ownerId)||!['personal','reference'].includes(map.mapType))throw Error('Invalid map owner or type.');for(const n of map.nodes){if(n.parent===null)continue;const version=ideas.get(n.ideaId)?.versions.find(v=>v.version===n.ideaVersion);if(!version||!adoptionEqual(version.content,nodeWording(map,n)))throw Error('A map node no longer matches its saved shared wording.');if(n.copiedFrom&&!ideas.get(n.copiedFrom.ideaId)?.versions.some(v=>v.version===n.copiedFrom.version))throw Error('Invalid copy attribution.');}}
  for(const record of workspace.endorsements){
    if(typeof record.id!=='string'||records.has(record.id)||!people.has(record.participantId)||typeof record.sourceMapId!=='string'||!['active','withdrawn','superseded'].includes(record.status)||!['facilitator-recorded','authenticated'].includes(record.method)||!Array.isArray(record.entries)||!record.entries.length||!Array.isArray(record.scopeNodeIds)||!Array.isArray(record.context?.nodes)||!Array.isArray(record.context?.relations)||!['node','section','map','selection'].includes(record.scope))throw Error('Invalid co-sign record.');records.add(record.id);
    const entries=new Set();for(const e of record.entries){const key=sharedKey(e.ideaId,e.version);if(entries.has(e.sourceNodeId)||!ideas.get(e.ideaId)?.versions.some(v=>v.version===e.version)||typeof e.sourceNodeId!=='string'||(e.targetMapId!==null&&typeof e.targetMapId!=='string')||(e.targetNodeId!==null&&typeof e.targetNodeId!=='string'))throw Error('Invalid co-sign source or version.');entries.add(e.sourceNodeId);}
  }
}
