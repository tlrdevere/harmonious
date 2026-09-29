import {counterpartResponseActions,counterpartRecords,counterpartLinks,counterpartLinkProblem,sameCounterpartPair,sameCounterpartSource} from './counterparts.mjs';
import {validateDefinitionReferences,canInvokeDefinitions} from './definitions.mjs';
import {graphEdges} from './model.mjs';
import {stableJSON} from './account-model.mjs';
import {validateAdoptionRecord,isAdoptionReceipt} from './adoption-fulfillment.mjs';
import {premiseHealth,validatePremises,validatePremiseEdit} from './premise.mjs';
import {validateReflections,validateReflectionEdit} from './reflection.mjs';
import {INTERACTION_ACTIONS,interactionHealth,makeInteraction,validateInteractionRecord,validateInteractionEdit} from './interaction-grammar.mjs';

export const DISCUSSION_LABELS={agreement:'Agreement',disagreement:'Disagreement',counterpart:'Request counterpart',adoption:'Suggest adoption',explain:'Ask for explanation',example:'Ask for an example',evidence:'Ask for evidence',question:'Question',support:'Support',challenge:'General challenge',counterexample:'Counterexample',inference:'Reasoning does not follow',contradiction:'Possible contradiction',fallacy:'Logical fallacy or reasoning error',reply:'Response',resolve:'Resolved by challenger',reopen:'Reopened by challenger',accept:'Accept challenge',maintain:'Maintain position',counterpart_link:'Counterparts',no_position:'No position yet',not_applicable:'Not applicable',close_request:'Close request',reopen_request:'Reopen request',context:'Definitions & standards'};
DISCUSSION_LABELS.reason='Reason';
Object.assign(DISCUSSION_LABELS,{adoption_added:'Added to my map',adoption_existing:'Used an existing node',adoption_not_now:'Not now'});
Object.assign(DISCUSSION_LABELS,{disagreement_point:'Point of disagreement',outcome:'Reflection outcome'});
for(const [action,label] of Object.values(INTERACTION_ACTIONS).flat())DISCUSSION_LABELS[action]=label;
DISCUSSION_LABELS.respond='Response';
DISCUSSION_LABELS.unlink_counterpart='Counterparts unlinked';
export const isReason=r=>r?.kind==='argument'&&r.action==='reason';
export const isChallenge=r=>r?.kind==='argument'&&!isReason(r);
export const discussionLayer=r=>r.kind==='interaction'?({compare:'map',inquiry:'inquiries',argument:'arguments'}[r.interaction?.mode]||'inquiries'):['relationship','correspondence','counterpart_unlink','context'].includes(r.kind)?'map':['argument','reflection'].includes(r.kind)?'arguments':r.kind==='reply'?r.layer:'inquiries';
const discussionKinds={correspondence:['counterpart_link'],relationship:['agreement','disagreement'],counterpart:['counterpart'],adoption:['adoption'],inquiry:['explain','example','evidence','question'],argument:['reason','support','challenge','evidence','counterexample','inference','contradiction','fallacy'],reply:['reply','resolve','reopen','accept','maintain','adoption_added','adoption_existing','adoption_not_now',...counterpartResponseActions],context:['context']};
discussionKinds.reflection=['disagreement_point','outcome'];
discussionKinds.interaction=[...Object.values(INTERACTION_ACTIONS).flat().map(([id])=>id),'respond'];
discussionKinds.counterpart_unlink=['unlink_counterpart'];
const discussionIdentity=['id','authorId','comparisonId','kind','target','other','createdAt','layer'];
const discussionEqual=(a,b)=>stableJSON(a)===stableJSON(b);
export function discussionSource(ws,target){
  const map=ws.maps.find(m=>m.id===target?.mapId&&!m.unavailable);if(!map)return null;
  const item=target.type==='node'?map.nodes.find(n=>n.id===target.nodeId):target.type==='edge'?graphEdges(map.nodes,map.relations).find(e=>e.id===target.edgeId):null;
  if(!item)return null;
  return {map,item,label:target.type==='node'?item.title:`${map.nodes.find(n=>n.id===item.from)?.title} → ${map.nodes.find(n=>n.id===item.to)?.title}`};
}
export function discussionTargetLabel(ws,target){return target?.type==='inference'?'Reasoning connection':target?.type==='entry'?DISCUSSION_LABELS[ws.discussions?.find(r=>r.id===target.entryId)?.action]||'Earlier contribution':discussionSource(ws,target)?.label||'Unavailable source';}
export function discussionTargetValid(target){return target&&typeof target==='object'&&((['entry','inference'].includes(target.type)&&typeof target.entryId==='string'&&target.entryId.length>0)||(typeof target.mapId==='string'&&target.mapId.length>0&&(target.type==='node'&&typeof target.nodeId==='string'&&target.nodeId.length>0||target.type==='edge'&&typeof target.edgeId==='string'&&target.edgeId.length>0)));}
export function canExplainReasoning(ws,target,actor){
  if(target?.type==='node'){const source=discussionSource(ws,target);return !!source&&source.map.ownerId===actor&&source.item.parent!==null;}
  if(target?.type==='entry'){const parent=ws.discussions?.find(r=>r.id===target.entryId);return !!parent&&parent.status==='active'&&parent.authorId===actor&&(isReason(parent)||parent.kind==='reply'&&parent.layer==='arguments');}
  return false;
}
const sourceWording=node=>Object.fromEntries(['title','summary','details','kind','timeScope','sourceTitle','sourceUrl'].map(key=>[key,node?.[key]||'']));
export function discussionSourceSnapshot(ws,target,excludeId=null){
  if(target.type==='inference'){
    const reason=ws.discussions.find(r=>r.id===target.entryId);if(!isReason(reason)||reason.target.type==='inference')return null;
    // Capture only the two direct endpoints. Upstream health is traversed below,
    // rather than recursively copying a growing chain into every saved record.
    const statement=discussionSourceSnapshot(ws,{type:'entry',entryId:reason.id},excludeId),conclusion=discussionSourceSnapshot(ws,reason.target,excludeId);
    if(!statement||!conclusion)return null;
    return {target,label:'Reasoning connection',wording:{reason:statement,conclusion},definitions:[]};
  }
  if(target.type==='entry'){
    const entry=ws.discussions.find(r=>r.id===target.entryId);
    return entry?{target,label:DISCUSSION_LABELS[entry.action],wording:{action:entry.action,body:entry.body,referenceUrl:entry.referenceUrl||'',version:entry.version,status:entry.status,...(entry.premise?{premise:structuredClone(entry.premise)}:{}),...(entry.reflection?{reflection:structuredClone(entry.reflection)}:{}),...(entry.interaction?{interaction:structuredClone(entry.interaction)}:{})},definitions:structuredClone(entry.definitionRefs||[])}:null;
  }
  const source=discussionSource(ws,target);if(!source)return null;
  const wording=target.type==='node'?sourceWording(source.item):{kind:source.item.kind||source.item.type||'',from:sourceWording(source.map.nodes.find(n=>n.id===source.item.from)),to:sourceWording(source.map.nodes.find(n=>n.id===source.item.to)),...(source.item.note?{note:source.item.note}:{})};
  const definitions=ws.discussions.filter(r=>r.id!==excludeId&&r.kind==='context'&&r.status==='active'&&discussionEqual(r.target,target)).map(r=>({id:r.id,authorId:r.authorId,body:r.body,version:r.version})).sort((a,b)=>a.id.localeCompare(b.id));
  return {target,label:source.label,wording,definitions};
}
export const discussionSnapshots=(ws,r)=>[r.target,r.other].filter(Boolean).map(target=>discussionSourceSnapshot(ws,target,r.id));
const snapshotUnavailable=s=>!s||s.wording.status==='withdrawn'||s.target.type==='inference'&&(!s.wording.reason||!s.wording.conclusion||s.wording.reason.wording.status==='withdrawn'||s.wording.conclusion.wording.status==='withdrawn');
export function discussionHealth(ws,r){
  const current=discussionSnapshots(ws,r),baseline=r.reviewedSources||r.sourceSnapshots;
  const premise=premiseHealth(ws,r),interaction=interactionHealth(ws,r);
  let missing=current.some(snapshotUnavailable)||premise.state==='unavailable'||interaction.state==='unavailable',upstreamChanged=false;
  const byId=new Map(ws.discussions.map(entry=>[entry.id,entry])),seen=new Set([r.id]);let target=r.target;
  while(['entry','inference'].includes(target?.type)){
    const parent=byId.get(target.entryId);if(!parent||seen.has(parent.id)){missing=true;break;}seen.add(parent.id);
    const snapshots=discussionSnapshots(ws,parent),prior=parent.reviewedSources||parent.sourceSnapshots;
    const parentPremise=premiseHealth(ws,parent),parentInteraction=interactionHealth(ws,parent);
    if(parent.status==='withdrawn'||snapshots.some(snapshotUnavailable)||parentPremise.state==='unavailable'||parentInteraction.state==='unavailable')missing=true;
    if(prior&&!discussionEqual(snapshots,prior)||parentPremise.state==='changed'||parentInteraction.state==='changed')upstreamChanged=true;
    target=parent.target;
  }
  if(missing)return {state:'unavailable',label:'Source unavailable or withdrawn',needsReview:true,current};
  if(!baseline)return {state:'unrecorded',label:'Earlier source wording not captured',needsReview:true,current};
  const changed=!discussionEqual(current,baseline)||upstreamChanged||premise.state==='changed'||interaction.state==='changed';
  return {state:changed?'changed':'current',label:changed?'Source changed · review needed':'Sources reviewed',needsReview:changed,current,upstreamChanged};
}
function validReference(url){if(!url)return true;try{return typeof url==='string'&&url.length<=2000&&['http:','https:'].includes(new URL(url).protocol);}catch{return false;}}
export function validateDiscussions(ws){
  ws.discussions??=[];if(!Array.isArray(ws.discussions)||ws.discussions.length>10000)throw Error('Invalid comparison conversations.');
  const ids=new Set();
  for(const r of ws.discussions){
    if(!r||typeof r.id!=='string'||!r.id||r.id.length>200||ids.has(r.id)||!discussionKinds[r.kind]?.includes(r.action)||!ws.participants.some(p=>p.id===r.authorId)||!discussionTargetValid(r.target)||typeof r.body!=='string'||r.body.length>10000||typeof r.targetLabel!=='string'||r.targetLabel.length>2000||!['active','withdrawn'].includes(r.status)||!Number.isFinite(Date.parse(r.createdAt))||!Number.isFinite(Date.parse(r.updatedAt))||!Array.isArray(r.history)||r.version!==r.history.length+1)throw Error('Invalid comparison contribution.');
    ids.add(r.id);
    for(const v of [...r.history,r])validateInteractionRecord(v);
    const thread=ws.comparisonThreads.find(t=>t.id===r.comparisonId);
    if(r.kind==='context'?r.comparisonId!==null||!['node','edge'].includes(r.target.type):!thread?.participants.includes(r.authorId))throw Error('Invalid conversation membership.');
    if(['relationship','correspondence','counterpart_unlink'].includes(r.kind)&&(r.target.type!=='node'||r.other?.type!=='node'||!discussionTargetValid(r.other)||r.target.mapId===r.other.mapId))throw Error('Choose one node from each map.');
    if(!['relationship','correspondence','counterpart_unlink'].includes(r.kind)&&r.other!=null)throw Error('Only a relationship can have a second source.');
    if(r.kind==='counterpart_unlink'){
      if(r.version!==1||r.history.length||r.status!=='active'||r.body!==''||r.layer!==null||r.createdAt!==new Date(r.createdAt).toISOString()||r.updatedAt!==r.createdAt||!Array.isArray(r.unlinkedRecordIds)||!r.unlinkedRecordIds.length||r.unlinkedRecordIds.length>10000||r.unlinkedRecordIds.some(id=>typeof id!=='string'||!id||id.length>200)||new Set(r.unlinkedRecordIds).size!==r.unlinkedRecordIds.length||['sourceSnapshots','reviewedSources','definitionRefs','premise','adoption','reflection','interaction','referenceUrl'].some(k=>r[k]!==undefined))throw Error('Invalid counterpart unlink receipt.');
      // A private external reference can hide an original contribution from a
      // participant. Keep the receipt so its other visible IDs stay unlinked.
      // New writes below still require every actual, currently effective record.
      if(r.unlinkedRecordIds.some(id=>{const link=ws.discussions.find(e=>e.id===id);return link&&(link.comparisonId!==r.comparisonId||!['correspondence','relationship'].includes(link.kind)||!sameCounterpartPair(link,r.target,r.other));}))throw Error('An unlink receipt must preserve its original counterpart identities.');
    }else if(r.unlinkedRecordIds!==undefined)throw Error('Only a counterpart unlink receipt can identify unlinked records.');
    if(['counterpart','adoption'].includes(r.kind)&&r.target.type!=='node')throw Error('Choose one of your own nodes.');
    for(const v of [...r.history,r])if(v.definitionRefs!==undefined&&(!canInvokeDefinitions(r)||!Array.isArray(v.definitionRefs)||v.definitionRefs.length>30||new Set(v.definitionRefs.map(ref=>ref?.definitionId)).size!==v.definitionRefs.length||v.definitionRefs.some(ref=>!ref||typeof ref.definitionId!=='string'||!ref.definitionId||ref.authorId!==r.authorId||!['definition','standard'].includes(ref.type)||!Number.isSafeInteger(ref.version)||ref.version<1||typeof ref.title!=='string'||!ref.title.trim()||ref.title.length>200||typeof ref.body!=='string'||!ref.body.trim()||ref.body.length>10000)))throw Error('Invalid referenced definitions.');
    if(r.kind==='reply'&&(r.target.type!=='entry'||!['map','inquiries','arguments'].includes(r.layer)))throw Error('Invalid reply.');
    if(!validReference(r.referenceUrl))throw Error('Use an http or https reference URL.');
    for(const value of [r.sourceSnapshots,r.reviewedSources])if(value!==undefined&&(!Array.isArray(value)||value.length!==(r.other?2:1)||value.some((s,i)=>!s||!discussionEqual(s.target,i?r.other:r.target)||typeof s.label!=='string'||!s.wording||!Array.isArray(s.definitions))))throw Error('Invalid source history.');
    for(const [i,v]of [...r.history,r].entries())if(v.version!==i+1||discussionIdentity.some(k=>!discussionEqual(v[k],r[k]))||isReason(v)!==isReason(r))throw Error('Contribution history must preserve its identity and reason role.');
    if(isReason(r)&&!['node','entry'].includes(r.target.type))throw Error('Explain your own position, reason, or argument response.');
    validateAdoptionRecord(ws,null,r,r.authorId,{historical:true});
  }
  // Entry targets form a directed forest. Check iteratively so imported chains
  // cannot overflow the stack or create conversations with no source anchor.
  const byId=new Map(ws.discussions.map(r=>[r.id,r])),checked=new Set();
  for(const start of ws.discussions){
    const path=new Set();let current=start;
    while(current&&!checked.has(current.id)){
      if(path.has(current.id))throw Error('Conversation targets cannot form a cycle.');
      path.add(current.id);
      if(!['entry','inference'].includes(current.target.type))break;
      const parent=byId.get(current.target.entryId);
      if(!parent||parent.comparisonId!==current.comparisonId)throw Error('Conversation target must belong to the same comparison.');
      if(current.target.type==='inference'&&!isReason(parent))throw Error('A reasoning connection must belong to a reason.');
      if(isReason(current)&&(parent.authorId!==current.authorId||!(isReason(parent)||parent.kind==='reply'&&parent.layer==='arguments')))throw Error('Explain your own position, reason, or argument response.');
      current=parent;
    }
    for(const id of path)checked.add(id);
  }
  validatePremises(ws);validateReflections(ws);return ws;
}
export function validateDiscussionEdit(ws,old,r,actor,{newRecordIds=[]}={}){
  if(r.authorId!==actor)throw Error('Only the author can change this contribution.');
  if(r.kind==='counterpart_unlink'){
    if(old)throw Error('An unlink receipt cannot be edited or withdrawn. Create a new link to reconnect these nodes.');
    const thread=ws.comparisonThreads.find(t=>t.id===r.comparisonId),maps=thread&&[thread.aMapId,thread.bMapId].map(id=>ws.maps.find(m=>m.id===id));
    if(!thread?.participants.includes(actor)||!maps?.every(m=>m&&!m.unavailable&&(m.ownerId===actor||m.visibility==='shared'))||!maps.some(m=>m.ownerId===actor)||![r.target.mapId,r.other.mapId].every(id=>maps.some(m=>m.id===id)))throw Error('Both comparison maps must be available to a participating map owner.');
    const beforeReceipt={...ws,discussions:ws.discussions.filter(e=>e.id!==r.id)},effective=counterpartRecords(beforeReceipt,r.comparisonId);
    if(!r.unlinkedRecordIds?.length||r.unlinkedRecordIds.some(id=>!effective.some(link=>link.id===id&&sameCounterpartPair(link,r.target,r.other))))throw Error('These counterparts changed or were already unlinked. Reopen their details.');
    const expected=effective.filter(link=>!newRecordIds.includes(link.id)&&sameCounterpartPair(link,r.target,r.other)).map(link=>link.id).sort();
    if(!discussionEqual(expected,[...r.unlinkedRecordIds].sort()))throw Object.assign(Error('These counterparts changed. Reopen their details before unlinking.'),{status:409});
    return;
  }
  validateAdoptionRecord(ws,old,r,actor);
  validatePremiseEdit(ws,old,r,actor);
  if(old){
    if(isReason(old)!==isReason(r))throw Error('A contribution cannot change its role as a reason.');
    if(discussionIdentity.some(k=>!discussionEqual(old[k],r[k]))||r.history.length<=old.history.length||!discussionEqual(r.history.slice(0,old.version),[...old.history,(({history,...rest})=>rest)(old)]))throw Error('Earlier contributions must remain in history.');
  }else if(r.version!==1||r.history.length)throw Error('Invalid new contribution.');
  validateDefinitionReferences(ws,old,r,actor);
  if(old&&r.kind==='reply'&&r.action!==old.action)throw Error('Add a new response to preserve the outcome history.');
  const current=discussionSnapshots(ws,r);
  if(old){
    if(!discussionEqual(r.sourceSnapshots,old.sourceSnapshots))throw Error('Original source wording must remain unchanged.');
    if(!discussionEqual(r.reviewedSources,old.reviewedSources)&&(!discussionEqual(r.reviewedSources,current)||current.some(snapshotUnavailable)))throw Error('Review the current sources before recording them.');
  }else if(!discussionEqual(r.sourceSnapshots,current)||current.some(snapshotUnavailable))throw Error('The source changed or was withdrawn. Reopen it before saving.');
  const thread=ws.comparisonThreads.find(t=>t.id===r.comparisonId);
  if(r.kind!=='context'&&(!thread?.participants.includes(actor)||![thread.aMapId,thread.bMapId].every(id=>ws.maps.some(m=>m.id===id&&!m.unavailable&&(m.ownerId===actor||m.visibility==='shared')))))throw Error('Both comparison maps must be available.');
  // Authors can withdraw an existing contribution after its target is withdrawn.
  // This exception cannot carry edited text, references, or changed source history.
  const withdrawalFields=({status,version,history,updatedAt,...rest})=>rest;
  const statusOnlyWithdrawal=old&&old.status==='active'&&r.status==='withdrawn'&&r.version===old.version+1&&discussionEqual(withdrawalFields(old),withdrawalFields(r));
  if(statusOnlyWithdrawal&&r.kind!=='context')return;
  validateInteractionEdit(ws,old,r,actor);
  validateReflectionEdit(ws,old,r,actor);
  if(discussionHealth(ws,r).state==='unavailable')throw Error('Choose an available source before continuing this conversation.');
  for(const target of [r.target,r.other].filter(Boolean)){
    if(['entry','inference'].includes(target.type)){
      const parent=ws.discussions.find(p=>p.id===target.entryId);
      if(!parent||parent.id===r.id||parent.comparisonId!==r.comparisonId||parent.status!=='active')throw Error('Choose an available contribution in this comparison.');
      if(target.type==='inference'&&!isReason(parent))throw Error('A reasoning connection must belong to a reason.');
      if(r.kind==='reply'&&r.action!=='reply'){
        if(['adoption_added','adoption_existing','adoption_not_now'].includes(r.action)){
          if(parent.kind!=='adoption')throw Error('Choose an adoption suggestion.');
          if(ws.discussions.some(d=>d.id!==r.id&&isAdoptionReceipt(d)&&d.target.entryId===parent.id&&d.authorId===actor))throw Error('This suggestion was already fulfilled.');
        }else if(counterpartResponseActions.includes(r.action)){
          if(parent.kind!=='counterpart')throw Error('Choose a counterpart request.');
          const source=discussionSource(ws,parent.target),recipient=ws.maps.find(m=>[thread.aMapId,thread.bMapId].includes(m.id)&&m.id!==parent.target.mapId);
          if(['close_request','reopen_request'].includes(r.action)?source?.map.ownerId!==actor:recipient?.ownerId!==actor)throw Error('Only the request author can close it, and only the recipient can give their position.');
        }else {if(!isChallenge(parent))throw Error('Choose a challenge before recording an outcome.');
        if(['resolve','reopen'].includes(r.action)?parent.authorId!==actor:parent.authorId===actor)throw Error('Record only your own response or resolution.');
        }
        if(old&&r.action!==old.action)throw Error('Add a new outcome to preserve the conversation history.');
      }
      if(r.kind==='reply'&&r.layer!==discussionLayer(parent))throw Error('A reply must stay with its conversation.');
    }else{
      const source=discussionSource(ws,target);if(!source)throw Error('The source changed. Reopen it before saving.');
      if(r.kind==='context'){if(source.map.ownerId!==actor)throw Error('Only the map author can define its terms and standards.');}
      else if(![thread.aMapId,thread.bMapId].includes(target.mapId))throw Error('The source must belong to this comparison.');
      if(['counterpart','adoption'].includes(r.kind)&&source.map.ownerId!==actor)throw Error('Choose one of your own nodes.');
      if(['counterpart','adoption'].includes(r.kind)&&target.type!=='node')throw Error('Choose one of your own nodes.');
      if(!old&&r.kind==='adoption'&&(source.item.parent===null||!thread.participants.some(id=>id!==actor)))throw Error('Suggest one ordinary node to another map owner.');
      if(r.kind==='inquiry'&&target.type==='node'&&source.map.ownerId===actor)throw Error('Choose the other person’s node to inquire.');
    }
  }
  if(isReason(r)&&!canExplainReasoning(ws,r.target,actor))throw Error('Explain your own position, reason, or argument response.');
  if(['correspondence','relationship'].includes(r.kind)&&r.status==='active'&&(!old||old.status!=='active')){
    if(ws.discussions.some(e=>e.kind==='counterpart_unlink'&&e.status==='active'&&e.unlinkedRecordIds?.includes(r.id)))throw Error('This link was unlinked. Create a new counterpart link.');
    const problem=counterpartLinkProblem(ws,r.comparisonId,r.target,r.other,{excludeId:r.id});if(problem)throw Object.assign(Error(problem),{status:409});
  }
  if(!old&&r.kind==='counterpart'&&counterpartLinks(ws,r.comparisonId).some(link=>sameCounterpartSource(link.target,r.target)||sameCounterpartSource(link.other,r.target)))throw Error('A counterpart is already linked to this node.');
  if(r.kind==='correspondence'&&![r.target,r.other].some(t=>discussionSource(ws,t)?.map.ownerId===actor))throw Error('Link a counterpart from your own map.');
  if(r.kind==='correspondence'&&[r.target,r.other].some(t=>discussionSource(ws,t)?.item.parent===null))throw Error('Choose ordinary nodes; frame headings already correspond.');
  if(r.kind==='correspondence'&&counterpartRecords(ws,r.comparisonId).some(e=>e.id!==r.id&&e.kind==='correspondence'&&sameCounterpartPair(e,r.target,r.other)))throw Error('These counterparts are already linked.');
  if(!['relationship','correspondence','counterpart','adoption','interaction'].includes(r.kind)&&!r.body.trim()&&r.status==='active')throw Error('Write your contribution before saving.');
  if(r.kind==='relationship'&&counterpartRecords(ws,r.comparisonId).some(e=>e.id!==r.id&&e.kind==='relationship'&&e.authorId===actor&&sameCounterpartPair(e,r.target,r.other)))throw Error('You already recorded this pair. Open its connection to edit it.');
}
export function makeDiscussion(ws,input,actor,old=null){
  const now=new Date().toISOString(),{history,...prior}=old||{};
  // Referenced titles retain exact saved wording, including imported spacing.
  const body=isReason(input)&&(input.premise!==undefined||old?.premise!==undefined)?input.body??'':input.body?.trim()||'';
  const r={id:old?.id||((isAdoptionReceipt(input)||['interaction','counterpart_unlink'].includes(input.kind))&&input.id)||`discussion-${crypto.randomUUID()}`,authorId:actor,comparisonId:input.kind==='context'?null:input.comparisonId,kind:input.kind,action:input.action,target:input.target,other:input.other||null,body,targetLabel:old?.targetLabel||discussionTargetLabel(ws,input.target),layer:input.layer||null,status:input.status||'active',createdAt:old?.createdAt||now,updatedAt:now,version:(old?.version||0)+1,history:old?[...history,prior]:[]};
  if(input.unlinkedRecordIds!==undefined)r.unlinkedRecordIds=structuredClone(input.unlinkedRecordIds);
  if(input.kind==='interaction')r.interaction=input.status==='withdrawn'&&old&&discussionEqual(input.interaction,old.interaction)?structuredClone(old.interaction):makeInteraction(ws,{...input,...(input.interaction||old?.interaction||{})},actor);
  if(input.adoption!==undefined)r.adoption=structuredClone(input.adoption);else if(old?.adoption)r.adoption=structuredClone(old.adoption);
  if(input.premise!==undefined)r.premise=structuredClone(input.premise);else if(old?.premise)r.premise=structuredClone(old.premise);
  if(input.reflection!==undefined)r.reflection=structuredClone(input.reflection);else if(old?.reflection)r.reflection=structuredClone(old.reflection);
  if(input.definitionRefs!==undefined)r.definitionRefs=structuredClone(input.definitionRefs);
  else if(old?.definitionRefs)r.definitionRefs=structuredClone(old.definitionRefs);
  if(old?.sourceSnapshots)r.sourceSnapshots=old.sourceSnapshots;
  else if(!old&&r.kind!=='counterpart_unlink')r.sourceSnapshots=discussionSnapshots(ws,r);
  if(old?.reviewedSources)r.reviewedSources=old.reviewedSources;
  if(input.reviewSources)r.reviewedSources=discussionSnapshots(ws,r);
  if(input.referenceUrl)r.referenceUrl=input.referenceUrl.trim();
  if(!old&&r.sourceSnapshots?.some(s=>!s))throw Error('The source changed. Reopen it before saving.');
  const candidate={...ws,discussions:[...(ws.discussions||[]).filter(e=>e.id!==r.id),r]};validateDiscussions(candidate);validateDiscussionEdit(candidate,old,r,actor);return r;
}
