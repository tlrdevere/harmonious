import {stableJSON} from './account-model.mjs';
import {nodeWording,synchronizeIdeas} from './adoption.mjs';
import {makeDiscussion} from './discussion.mjs';
import {makeDefinition,definitionReference,definitionReferenceText,validDefinitionOrigin} from './definitions.mjs';
import {validateWorkspace} from './workspace.mjs';
import {counterpartLinks,sameCounterpartSource} from './counterparts.mjs';

export const adoptionActions=['adoption_added','adoption_existing','adoption_not_now'];
export const isAdoptionReceipt=r=>r?.kind==='reply'&&['adoption_added','adoption_existing'].includes(r.action);
const equal=(a,b)=>stableJSON(a)===stableJSON(b),clone=value=>structuredClone(value);
const check=(ok,message)=>{if(!ok)throw Error(message);};
const refKey=ref=>JSON.stringify([ref.authorId,ref.definitionId,ref.version]);
// Match PostgreSQL COLLATE "C" even for IDs imported from portable workspaces.
const compareUTF8=(a,b)=>{const x=new TextEncoder().encode(String(a)),y=new TextEncoder().encode(String(b));for(let i=0;i<Math.min(x.length,y.length);i++)if(x[i]!==y[i])return x[i]-y[i];return x.length-y.length;};
const compareReference=(a,b)=>compareUTF8(a.authorId,b.authorId)||compareUTF8(a.definitionId,b.definitionId)||compareUTF8(a.version,b.version);
export const adoptionDefinitionKey=ref=>refKey(ref);
export async function adoptionFulfillmentId(suggestionId,actor){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(suggestionId+'\n'+actor));
  return 'adoption-result-'+[...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
function sides(ws,suggestion,actor){
  check(suggestion?.kind==='adoption'&&suggestion.target?.type==='node','Choose an adoption suggestion.');
  const thread=ws.comparisonThreads.find(t=>t.id===suggestion.comparisonId),sourceMap=ws.maps.find(m=>m.id===suggestion.target.mapId),destinationMap=ws.maps.find(m=>[thread?.aMapId,thread?.bMapId].includes(m.id)&&m.id!==sourceMap?.id);
  check(thread?.participants.includes(actor)&&sourceMap?.ownerId===suggestion.authorId&&destinationMap?.ownerId===actor&&sourceMap.ownerId!==actor,'Only the other map owner can respond to this suggestion.');
  return {thread,sourceMap,destinationMap,sourceNode:sourceMap.nodes.find(n=>n.id===suggestion.target.nodeId)};
}
// Only material already invoked on this one node travels in the snapshot.
// Foreign libraries and uninvoked later versions are deliberately absent.
export function adoptionSourceSnapshot(ws,suggestion){
  const map=ws.maps.find(m=>m.id===suggestion?.target?.mapId&&!m.unavailable),node=map?.nodes.find(n=>n.id===suggestion.target.nodeId);
  if(!node||node.parent===null)return null;
  const contexts=(ws.discussions||[]).filter(r=>r.kind==='context'&&r.status==='active'&&r.authorId===map.ownerId&&sameCounterpartSource(r.target,suggestion.target)).map(r=>({id:r.id,version:r.version,authorId:r.authorId,body:r.body,definitionRefs:clone(r.definitionRefs||[])})).sort((a,b)=>compareUTF8(a.id,b.id));
  check(contexts.length<=30,'This node has too many separate definition notes to adopt at once.');
  const unique=new Map();for(const context of contexts)for(const ref of context.definitionRefs)unique.set(refKey(ref),ref);
  check(unique.size<=30,'Choose a node with at most 30 invoked definitions.');
  return {mapId:map.id,nodeId:node.id,ideaId:node.ideaId,ideaVersion:node.ideaVersion,mapRevision:map.revision,suggestionVersion:suggestion.version,wording:clone(nodeWording(map,node)),contexts,definitions:[...unique.values()].sort(compareReference).map(clone)};
}
export function adoptionState(ws,suggestion){
  const receipt=(ws.discussions||[]).find(r=>isAdoptionReceipt(r)&&r.target.entryId===suggestion.id);
  if(receipt){const destination=receipt.adoption.destination,map=ws.maps.find(m=>m.id===destination.mapId&&!m.unavailable),node=map?.nodes.find(n=>n.id===destination.nodeId);return {label:receipt.action==='adoption_added'?'Added to my map':'Used an existing node',receipt,removed:!node,changed:!!node&&(!equal(nodeWording(map,node),destination.wording)||node.parent!==destination.parentId),suggestionWithdrawn:suggestion.status!=='active'};}
  const response=(ws.discussions||[]).filter(r=>r.kind==='reply'&&r.action==='adoption_not_now'&&r.status==='active'&&r.target.entryId===suggestion.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).at(-1);
  return {label:suggestion.status!=='active'?'Suggestion withdrawn':response?'Not now':'Awaiting response',receipt:null,removed:false,changed:false,suggestionWithdrawn:suggestion.status!=='active'};
}
/** Preview.definitions is [{key,reference}]. Pass preview.sourceSnapshot back
 * unchanged as reviewedSource; a save never silently upgrades that selection. */
export function adoptionPreview(ws,suggestionId,actor){
  const suggestion=ws.discussions.find(r=>r.id===suggestionId),context=sides(ws,suggestion,actor),state=adoptionState(ws,suggestion),sourceSnapshot=adoptionSourceSnapshot(ws,suggestion);
  return {...context,suggestion,state,receipt:state.receipt,sourceSnapshot,definitions:(sourceSnapshot?.definitions||[]).map(reference=>({key:refKey(reference),reference}))};
}
function available(preview,actor){
  check(preview.suggestion.status==='active','This suggestion has been withdrawn.');
  check([preview.sourceMap,preview.destinationMap].every(m=>!m.unavailable&&(m.ownerId===actor||m.visibility==='shared')),'Both comparison maps must remain available.');
  check(preview.sourceNode&&preview.sourceNode.parent!==null&&preview.sourceSnapshot,'The suggested source is unavailable.');
}
/** Pure staged operation: never mutates ws. Save workspace as one account batch.
 * receipt.adoption retains exact source and destination wording, imported
 * definition provenance, and the optional neutral counterpart record ID. */
export async function prepareAdoption(ws,input,actor){
  const preview=adoptionPreview(ws,input.suggestionId,actor);
  if(preview.receipt)return {workspace:ws,receipt:preview.receipt,node:preview.destinationMap.nodes.find(n=>n.id===preview.receipt.adoption.destination.nodeId)||null,reused:true};
  available(preview,actor);check(equal(input.reviewedSource,preview.sourceSnapshot),'The source changed. Review the updated source before saving; your draft can be kept.');
  check(['copy','existing','not_now'].includes(input.mode),'Choose how to respond to the suggestion.');
  const candidate=clone(ws),suggestion=candidate.discussions.find(r=>r.id===input.suggestionId),destination=candidate.maps.find(m=>m.id===preview.destinationMap.id);
  if(input.mode==='not_now'){
    const receipt=makeDiscussion(candidate,{comparisonId:suggestion.comparisonId,kind:'reply',action:'adoption_not_now',target:{type:'entry',entryId:suggestion.id},layer:'inquiries',body:input.body?.trim()||'Not now.'},actor);candidate.discussions.push(receipt);validateWorkspace(candidate);return {workspace:candidate,receipt,node:null,reused:false};
  }
  const id=await adoptionFulfillmentId(suggestion.id,actor),selected=new Set(input.definitionKeys||[]);check(selected.size===(input.definitionKeys||[]).length&&[...selected].every(key=>preview.definitions.some(d=>d.key===key)),'Choose only definitions shown in this source preview.');
  const imports=[];let node,contextId=null,counterpartId=null;
  if(input.mode==='copy'){
    const parent=destination.nodes.find(n=>n.id===input.parentId);check(parent,'Choose a parent in your comparison map.');
    node={...clone(preview.sourceNode),id:'node-'+crypto.randomUUID(),parent:parent.id,title:(input.title??preview.sourceNode.title).trim(),summary:(input.summary??preview.sourceNode.summary).trim(),details:(input.details??preview.sourceNode.details).trim(),kind:input.kind||preview.sourceNode.kind,confidence:null,structuralType:'nesting',reuseMode:'adapted',copiedFrom:{ideaId:preview.sourceNode.ideaId,version:preview.sourceNode.ideaVersion,mapId:preview.sourceMap.id,nodeId:preview.sourceNode.id}};
    check(node.title.length>0&&node.title.length<=200&&node.summary.length<=10000&&node.details.length<=10000,'Use a title of 1–200 characters and explanations up to 10,000 characters.');delete node.ideaId;delete node.ideaVersion;destination.nodes.push(node);destination.revision++;destination.updatedAt=new Date().toISOString();synchronizeIdeas(candidate,destination);
    for(const item of preview.definitions.filter(d=>selected.has(d.key))){
      const ref=item.reference;let definition=candidate.definitions.find(d=>d.authorId===actor&&d.status==='active'&&equal(d.copiedFrom,ref)&&d.type===ref.type&&d.versions.at(-1).title===ref.title&&d.versions.at(-1).body===ref.body);
      if(!definition){definition=makeDefinition(candidate,{type:ref.type,title:ref.title,body:ref.body,copiedFrom:ref},actor);candidate.definitions.push(definition);}
      imports.push({source:clone(ref),definitionId:definition.id,version:definition.versions.at(-1).version});
    }
    if(imports.length){const refs=imports.map(item=>definitionReference(candidate.definitions.find(d=>d.id===item.definitionId),item.version)),context=makeDiscussion(candidate,{kind:'context',action:'context',target:{type:'node',mapId:destination.id,nodeId:node.id},body:definitionReferenceText(refs),definitionRefs:refs},actor);candidate.discussions.push(context);contextId=context.id;}
  }else{check(!selected.size,'An existing node keeps its definitions unchanged.');node=destination.nodes.find(n=>n.id===input.nodeId&&n.parent!==null);check(node,'Choose an ordinary node in your comparison map.');}
  const target={type:'node',mapId:destination.id,nodeId:node.id};
  if(input.linkCounterpart){let counterpart=counterpartLinks(candidate,suggestion.comparisonId).find(r=>[r.target,r.other].some(t=>sameCounterpartSource(t,suggestion.target))&&[r.target,r.other].some(t=>sameCounterpartSource(t,target)));if(!counterpart){counterpart=makeDiscussion(candidate,{comparisonId:suggestion.comparisonId,kind:'correspondence',action:'counterpart_link',target:suggestion.target,other:target,body:'Comparable nodes linked. Agreement has not been judged.'},actor);candidate.discussions.push(counterpart);}counterpartId=counterpart.id;}
  const adoption={mode:input.mode,suggestionVersion:suggestion.version,source:clone(preview.sourceSnapshot),destination:{mapId:destination.id,nodeId:node.id,parentId:node.parent,wording:clone(nodeWording(destination,node))},importedDefinitions:imports,contextId,counterpartId};
  const receipt=makeDiscussion(candidate,{id,comparisonId:suggestion.comparisonId,kind:'reply',action:input.mode==='copy'?'adoption_added':'adoption_existing',target:{type:'entry',entryId:suggestion.id},layer:'inquiries',body:input.mode==='copy'?'Added an independent copy to my map.':'Used an existing node in my map.',adoption},actor);candidate.discussions.push(receipt);validateWorkspace(candidate);return {workspace:candidate,receipt,node,reused:false};
}
export function validateAdoptionRecord(ws,old,r,actor,{historical=false}={}){
  if(!isAdoptionReceipt(r)&&r.action!=='adoption_not_now'){check(r.adoption===undefined,'Only a fulfillment receipt can carry adoption details.');return;}
  const suggestion=ws.discussions.find(d=>d.id===r.target?.entryId),context=sides(ws,suggestion,actor);
  check(r.kind==='reply'&&r.layer==='inquiries','An adoption response stays with its suggestion.');
  if(r.action==='adoption_not_now'){check(r.adoption===undefined,'Not now cannot change a map.');return;}
  const a=r.adoption;check(a&&a.mode===(r.action==='adoption_added'?'copy':'existing')&&/^adoption-result-[a-f0-9]{64}$/.test(r.id)&&r.status==='active'&&r.version===1&&r.history.length===0,'A fulfillment receipt is an immutable record of the map action.');
  if(old)check(equal(old,r),'A fulfillment receipt cannot be edited or withdrawn.');
  check(a.destination?.mapId===context.destinationMap.id&&typeof a.destination.nodeId==='string'&&typeof a.destination.parentId==='string'&&a.destination.wording&&Array.isArray(a.importedDefinitions)&&a.importedDefinitions.length<=30,'Invalid adoption destination.');
  check(a.source?.mapId===context.sourceMap.id&&a.source.nodeId===suggestion.target.nodeId&&Number.isSafeInteger(a.suggestionVersion)&&a.suggestionVersion>=1&&a.source.suggestionVersion===a.suggestionVersion&&Array.isArray(a.source.definitions)&&a.source.definitions.length<=30&&Array.isArray(a.source.contexts)&&a.source.contexts.length<=30,'Invalid adoption provenance.');
  const boundedWording=value=>value&&['title','summary','details','kind','timeScope','sourceTitle','sourceUrl','frame'].every(key=>typeof value[key]==='string'&&value[key].length<=10000);
  check(typeof a.source.ideaId==='string'&&a.source.ideaId.length<=200&&Number.isSafeInteger(a.source.ideaVersion)&&a.source.ideaVersion>0&&Number.isSafeInteger(a.source.mapRevision)&&a.source.mapRevision>0&&boundedWording(a.source.wording)&&boundedWording(a.destination.wording)&&a.source.definitions.every(ref=>validDefinitionOrigin(ref,actor)&&ref.authorId===suggestion.authorId)&&a.source.contexts.every(c=>typeof c.id==='string'&&c.id.length<=200&&c.authorId===suggestion.authorId&&Number.isSafeInteger(c.version)&&c.version>0&&typeof c.body==='string'&&c.body.length<=10000&&Array.isArray(c.definitionRefs)&&c.definitionRefs.length<=30&&c.definitionRefs.every(ref=>validDefinitionOrigin(ref,actor)&&ref.authorId===suggestion.authorId)),'Invalid or excessive adoption source snapshot.');
  check((a.contextId===null||typeof a.contextId==='string'&&a.contextId.length<=200)&&(a.counterpartId===null||typeof a.counterpartId==='string'&&a.counterpartId.length<=200)&&a.importedDefinitions.every(item=>item&&typeof item.definitionId==='string'&&item.definitionId.length<=200&&Number.isSafeInteger(item.version)&&item.version>0&&validDefinitionOrigin(item.source,actor)),'Invalid adoption definition or counterpart references.');
  check(ws.discussions.filter(d=>isAdoptionReceipt(d)&&d.target.entryId===suggestion.id&&d.authorId===actor).length<=1,'This suggestion was already fulfilled.');
  if(historical||old)return;
  const preview=adoptionPreview(ws,suggestion.id,actor);available(preview,actor);check(equal(a.source,preview.sourceSnapshot)&&a.suggestionVersion===suggestion.version,'The source changed. Review it before saving.');
  const node=context.destinationMap.nodes.find(n=>n.id===a.destination.nodeId&&n.parent!==null);check(node&&node.parent===a.destination.parentId&&equal(nodeWording(context.destinationMap,node),a.destination.wording),'The destination node changed. Review it before saving.');
  check(a.mode==='copy'||(!a.importedDefinitions.length&&a.contextId===null),'An existing node keeps its definitions unchanged.');
  if(a.mode==='copy')check(equal(node.copiedFrom,{ideaId:a.source.ideaId,version:a.source.ideaVersion,mapId:a.source.mapId,nodeId:a.source.nodeId})&&ws.ideas.some(i=>i.id===node.ideaId&&i.originMapId===context.destinationMap.id&&i.originNodeId===node.id),'An adopted copy needs its own identity and exact source attribution.');
  for(const item of a.importedDefinitions){const definition=ws.definitions.find(d=>d.id===item.definitionId&&d.authorId===actor),v=definition?.versions.find(v=>v.version===item.version);check(a.source.definitions.some(ref=>equal(ref,item.source))&&definition?.type===item.source.type&&equal(definition.copiedFrom,item.source)&&v?.title===item.source.title&&v?.body===item.source.body,'Choose only the exact definitions shared by this source.');}
  check(new Set(a.importedDefinitions.map(d=>d.definitionId)).size===a.importedDefinitions.length,'A definition can be imported only once.');
  const ctx=ws.discussions.find(d=>d.id===a.contextId);if(a.importedDefinitions.length)check(ctx?.kind==='context'&&ctx.authorId===actor&&sameCounterpartSource(ctx.target,{type:'node',mapId:context.destinationMap.id,nodeId:node.id})&&equal(ctx.definitionRefs,a.importedDefinitions.map(d=>definitionReference(ws.definitions.find(x=>x.id===d.definitionId),d.version))),'The copied definitions must be explicitly invoked on your new node.');else check(a.contextId===null,'Unexpected adoption context.');
  if(a.counterpartId){const link=counterpartLinks(ws,suggestion.comparisonId).find(d=>d.id===a.counterpartId);check(link&&[link.target,link.other].some(t=>sameCounterpartSource(t,suggestion.target))&&[link.target,link.other].some(t=>sameCounterpartSource(t,{type:'node',mapId:context.destinationMap.id,nodeId:node.id})),'Choose a counterpart link for these exact nodes.');}
}
export function validateAdoptionBatch(before,candidate,actor,changes){
  for(const change of changes){
    const r=change.value,old=change.kind==='discussion'?before.discussions.find(d=>d.id===r.id):null;
    if(change.kind==='discussion'&&isAdoptionReceipt(r)&&!old){const originalMap=before.maps.find(m=>m.id===r.adoption.destination.mapId),existing=originalMap?.nodes.find(n=>n.id===r.adoption.destination.nodeId);if(r.adoption.mode==='copy')check(!existing,'An added copy must be a new independent node.');else check(existing&&equal(originalMap,candidate.maps.find(m=>m.id===originalMap.id)),'Using an existing node cannot alter its map.');}
    if(change.kind==='definition'&&r.copiedFrom&&!before.definitions.some(d=>d.id===r.id))check(changes.some(c=>c.kind==='discussion'&&isAdoptionReceipt(c.value)&&!before.discussions.some(d=>d.id===c.id)&&c.value.adoption.importedDefinitions.some(i=>i.definitionId===r.id&&equal(i.source,r.copiedFrom))),'Import a shared definition only through the reviewed adoption.');
  }
}
