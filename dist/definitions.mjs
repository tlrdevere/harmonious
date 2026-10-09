import {stableJSON} from './account-model.mjs';

export const PHILOSOPHY_TYPES={definition:'Definition',standard:'Standard',principle:'Principle',belief:'Belief',other:'Other'};
export const philosophyTypeLabel=type=>PHILOSOPHY_TYPES[type]||'Other';

export function validateDefinitions(ws){
  ws.definitions??=[];
  if(!Array.isArray(ws.definitions)||ws.definitions.length>2000)throw Error('Invalid definitions library.');
  const ids=new Set();
  for(const d of ws.definitions){
    if(!d||typeof d.id!=='string'||!d.id||d.id.length>200||ids.has(d.id)||!ws.participants.some(p=>p.id===d.authorId)||!['definition','standard','principle','belief','other'].includes(d.type)||!['active','archived'].includes(d.status)||!Array.isArray(d.versions)||!d.versions.length||d.versions.length>1000)throw Error('Invalid library entry.');
    ids.add(d.id);
    for(const [i,v]of d.versions.entries())if(v.version!==i+1||typeof v.title!=='string'||!v.title.trim()||v.title.length>200||typeof v.body!=='string'||!v.body.trim()||v.body.length>10000||!Number.isFinite(Date.parse(v.createdAt)))throw Error('Invalid definition version.');
    if(d.copiedFrom!==undefined&&!validDefinitionOrigin(d.copiedFrom,d.authorId))throw Error('Invalid definition attribution.');
  }
  return ws;
}
export function validateDefinitionEdit(old,d,actor){
  if(d.authorId!==actor)throw Error('Only the author can edit this library entry.');
  if(old){
    if(d.id!==old.id||d.type!==old.type||d.authorId!==old.authorId||stableJSON(d.copiedFrom)!==stableJSON(old.copiedFrom)||d.versions.length<old.versions.length||stableJSON(d.versions.slice(0,old.versions.length))!==stableJSON(old.versions))throw Error('Earlier definition versions and attribution must remain unchanged.');
  }else if(d.versions.length!==1)throw Error('Start a library entry with one version.');
}
export function makeDefinition(ws,input,actor,old=null){
  const versions=old?[...old.versions]:[];
  if(!old||input.title!==undefined)versions.push({version:versions.length+1,title:input.title?.trim()||'',body:input.body?.trim()||'',createdAt:new Date().toISOString()});
  const d={id:old?.id||'definition-'+crypto.randomUUID(),authorId:actor,type:old?.type||input.type,status:input.status||old?.status||'active',versions};
  if(old?.copiedFrom||input.copiedFrom)d.copiedFrom=structuredClone(old?.copiedFrom||input.copiedFrom);
  validateDefinitions({...ws,definitions:[...(ws.definitions||[]).filter(e=>e.id!==d.id),d]});validateDefinitionEdit(old,d,actor);return d;
}
export function validDefinitionOrigin(ref,actor){return ref&&typeof ref.definitionId==='string'&&ref.definitionId.length>0&&ref.definitionId.length<=200&&typeof ref.authorId==='string'&&ref.authorId!==actor&&['definition','standard','principle','belief','other'].includes(ref.type)&&Number.isSafeInteger(ref.version)&&ref.version>0&&typeof ref.title==='string'&&ref.title.trim().length>0&&ref.title.length<=200&&typeof ref.body==='string'&&ref.body.trim().length>0&&ref.body.length<=10000;}
export function definitionReference(d,version=d.versions.length){
  const v=d.versions.find(v=>v.version===version);if(!v)throw Error('Definition version unavailable.');
  return {definitionId:d.id,authorId:d.authorId,type:d.type,version:v.version,title:v.title,body:v.body};
}
export const definitionReferenceText=refs=>refs.map(r=>`${philosophyTypeLabel(r.type)}: ${r.title}\n${r.body}`).join('\n\n');
export const canInvokeDefinitions=r=>r.kind==='context'||r.kind==='argument'||r.kind==='reply'&&r.layer==='arguments';
export function validateDefinitionReferences(ws,old,r,actor){
  if(r.definitionRefs===undefined){if(old?.definitionRefs)throw Error('Keep the referenced definitions when editing.');return;}
  if(!canInvokeDefinitions(r)||!Array.isArray(r.definitionRefs)||r.definitionRefs.length>30||new Set(r.definitionRefs.map(v=>v.definitionId)).size!==r.definitionRefs.length)throw Error('Invalid definition references.');
  for(const ref of r.definitionRefs){
    const d=ws.definitions?.find(d=>d.id===ref.definitionId);
    if(!d||d.authorId!==actor||stableJSON(ref)!==stableJSON(definitionReference(d,ref.version)))throw Error('Choose an available version from your definitions library.');
  }
  if(r.kind==='context'&&r.body!==definitionReferenceText(r.definitionRefs))throw Error('Referenced wording must match its library version.');
}
