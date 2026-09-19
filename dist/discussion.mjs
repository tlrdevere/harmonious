import {counterpartResponseActions,counterpartLinks,sameCounterpartSource} from './counterparts.mjs';
import {validateDefinitionReferences} from './definitions.mjs';
import {graphEdges} from './model.mjs';
import {stableJSON} from './account-model.mjs';

export const DISCUSSION_LABELS={agreement:'Agreement',disagreement:'Disagreement',counterpart:'Request counterpart',adoption:'Suggest adoption',explain:'Ask for explanation',example:'Ask for an example',evidence:'Ask for evidence',question:'Question',support:'Support',challenge:'General challenge',counterexample:'Counterexample',inference:'Reasoning does not follow',contradiction:'Possible contradiction',fallacy:'Logical fallacy or reasoning error',reply:'Response',resolve:'Resolved by challenger',reopen:'Reopened by challenger',accept:'Accept challenge',maintain:'Maintain position',counterpart_link:'Counterparts',no_position:'No position yet',not_applicable:'Not applicable',close_request:'Close request',reopen_request:'Reopen request',context:'Definitions & standards'};
export const discussionLayer=r=>r.kind==='relationship'||r.kind==='correspondence'||r.kind==='context'?'map':r.kind==='argument'?'arguments':r.kind==='reply'?r.layer:'inquiries';
const discussionKinds={correspondence:['counterpart_link'],relationship:['agreement','disagreement'],counterpart:['counterpart'],adoption:['adoption'],inquiry:['explain','example','evidence','question'],argument:['support','challenge','evidence','counterexample','inference','contradiction','fallacy'],reply:['reply','resolve','reopen','accept','maintain',...counterpartResponseActions],context:['context']};
const discussionIdentity=['id','authorId','comparisonId','kind','target','other','createdAt','layer'];
const discussionEqual=(a,b)=>stableJSON(a)===stableJSON(b);
export function discussionSource(ws,target){
  const map=ws.maps.find(m=>m.id===target?.mapId&&!m.unavailable);if(!map)return null;
  const item=target.type==='node'?map.nodes.find(n=>n.id===target.nodeId):target.type==='edge'?graphEdges(map.nodes,map.relations).find(e=>e.id===target.edgeId):null;
  if(!item)return null;
  return {map,item,label:target.type==='node'?item.title:`${map.nodes.find(n=>n.id===item.from)?.title} → ${map.nodes.find(n=>n.id===item.to)?.title}`};
}
export function discussionTargetLabel(ws,target){return target?.type==='entry'?DISCUSSION_LABELS[ws.discussions?.find(r=>r.id===target.entryId)?.action]||'Earlier contribution':discussionSource(ws,target)?.label||'Unavailable source';}
export function discussionTargetValid(target){return target&&typeof target==='object'&&((target.type==='entry'&&typeof target.entryId==='string'&&target.entryId.length>0)||(typeof target.mapId==='string'&&target.mapId.length>0&&(target.type==='node'&&typeof target.nodeId==='string'&&target.nodeId.length>0||target.type==='edge'&&typeof target.edgeId==='string'&&target.edgeId.length>0)));}
const sourceWording=node=>Object.fromEntries(['title','summary','details','kind','timeScope','sourceTitle','sourceUrl'].map(key=>[key,node?.[key]||'']));
export function discussionSourceSnapshot(ws,target,excludeId=null){
  if(target.type==='entry'){
    const entry=ws.discussions.find(r=>r.id===target.entryId);
    return entry?{target,label:DISCUSSION_LABELS[entry.action],wording:{action:entry.action,body:entry.body,referenceUrl:entry.referenceUrl||'',version:entry.version,status:entry.status},definitions:[]}:null;
  }
  const source=discussionSource(ws,target);if(!source)return null;
  const wording=target.type==='node'?sourceWording(source.item):{kind:source.item.kind||source.item.type||'',from:sourceWording(source.map.nodes.find(n=>n.id===source.item.from)),to:sourceWording(source.map.nodes.find(n=>n.id===source.item.to))};
  const definitions=ws.discussions.filter(r=>r.id!==excludeId&&r.kind==='context'&&r.status==='active'&&discussionEqual(r.target,target)).map(r=>({id:r.id,authorId:r.authorId,body:r.body,version:r.version})).sort((a,b)=>a.id.localeCompare(b.id));
  return {target,label:source.label,wording,definitions};
}
export const discussionSnapshots=(ws,r)=>[r.target,r.other].filter(Boolean).map(target=>discussionSourceSnapshot(ws,target,r.id));
export function discussionHealth(ws,r){
  const current=discussionSnapshots(ws,r),baseline=r.reviewedSources||r.sourceSnapshots;
  const missing=current.some(s=>!s||s.wording.status==='withdrawn');
  if(missing)return {state:'unavailable',label:'Source unavailable or withdrawn',needsReview:true,current};
  if(!baseline)return {state:'unrecorded',label:'Earlier source wording not captured',needsReview:true,current};
  const changed=!discussionEqual(current,baseline);
  return {state:changed?'changed':'current',label:changed?'Source changed · review needed':'Sources reviewed',needsReview:changed,current};
}
function validReference(url){if(!url)return true;try{return typeof url==='string'&&url.length<=2000&&['http:','https:'].includes(new URL(url).protocol);}catch{return false;}}
export function validateDiscussions(ws){
  ws.discussions??=[];if(!Array.isArray(ws.discussions)||ws.discussions.length>10000)throw Error('Invalid comparison conversations.');
  const ids=new Set();
  for(const r of ws.discussions){
    if(!r||typeof r.id!=='string'||!r.id||r.id.length>200||ids.has(r.id)||!discussionKinds[r.kind]?.includes(r.action)||!ws.participants.some(p=>p.id===r.authorId)||!discussionTargetValid(r.target)||typeof r.body!=='string'||r.body.length>10000||typeof r.targetLabel!=='string'||r.targetLabel.length>2000||!['active','withdrawn'].includes(r.status)||!Number.isFinite(Date.parse(r.createdAt))||!Number.isFinite(Date.parse(r.updatedAt))||!Array.isArray(r.history)||r.version!==r.history.length+1)throw Error('Invalid comparison contribution.');
    ids.add(r.id);
    const thread=ws.comparisonThreads.find(t=>t.id===r.comparisonId);
    if(r.kind==='context'?r.comparisonId!==null||!['node','edge'].includes(r.target.type):!thread?.participants.includes(r.authorId))throw Error('Invalid conversation membership.');
    if(['relationship','correspondence'].includes(r.kind)&&(r.target.type!=='node'||r.other?.type!=='node'||!discussionTargetValid(r.other)||r.target.mapId===r.other.mapId))throw Error('Choose one node from each map.');
    if(!['relationship','correspondence'].includes(r.kind)&&r.other!=null)throw Error('Only a relationship can have a second source.');
    if(['counterpart','adoption'].includes(r.kind)&&r.target.type!=='node')throw Error('Choose one of your own nodes.');
    for(const v of [...r.history,r])if(v.definitionRefs!==undefined&&(r.kind!=='context'||!Array.isArray(v.definitionRefs)||v.definitionRefs.length>30||v.definitionRefs.some(ref=>!ref||typeof ref.definitionId!=='string'||!ref.definitionId||typeof ref.authorId!=='string'||!['definition','standard'].includes(ref.type)||!Number.isSafeInteger(ref.version)||ref.version<1||typeof ref.title!=='string'||ref.title.length>200||typeof ref.body!=='string'||ref.body.length>10000)))throw Error('Invalid referenced definitions.');
    if(r.kind==='reply'&&(r.target.type!=='entry'||!['map','inquiries','arguments'].includes(r.layer)))throw Error('Invalid reply.');
    if(!validReference(r.referenceUrl))throw Error('Use an http or https reference URL.');
    for(const value of [r.sourceSnapshots,r.reviewedSources])if(value!==undefined&&(!Array.isArray(value)||value.length!==(r.other?2:1)||value.some((s,i)=>!s||!discussionEqual(s.target,i?r.other:r.target)||typeof s.label!=='string'||!s.wording||!Array.isArray(s.definitions))))throw Error('Invalid source history.');
    for(const [i,v]of [...r.history,r].entries())if(v.version!==i+1||discussionIdentity.some(k=>!discussionEqual(v[k],r[k])))throw Error('Contribution history must preserve its identity.');
  }
  // Entry targets form a directed forest. Check iteratively so imported chains
  // cannot overflow the stack or create conversations with no source anchor.
  const byId=new Map(ws.discussions.map(r=>[r.id,r])),checked=new Set();
  for(const start of ws.discussions){
    const path=new Set();let current=start;
    while(current&&!checked.has(current.id)){
      if(path.has(current.id))throw Error('Conversation targets cannot form a cycle.');
      path.add(current.id);
      if(current.target.type!=='entry')break;
      const parent=byId.get(current.target.entryId);
      if(!parent||parent.comparisonId!==current.comparisonId)throw Error('Conversation target must belong to the same comparison.');
      current=parent;
    }
    for(const id of path)checked.add(id);
  }
  return ws;
}
export function validateDiscussionEdit(ws,old,r,actor){
  if(r.authorId!==actor)throw Error('Only the author can change this contribution.');
  if(old){
    if(discussionIdentity.some(k=>!discussionEqual(old[k],r[k]))||r.history.length<=old.history.length||!discussionEqual(r.history.slice(0,old.version),[...old.history,(({history,...rest})=>rest)(old)]))throw Error('Earlier contributions must remain in history.');
  }else if(r.version!==1||r.history.length)throw Error('Invalid new contribution.');
  validateDefinitionReferences(ws,old,r,actor);
  if(old&&r.kind==='reply'&&r.action!==old.action)throw Error('Add a new response to preserve the outcome history.');
  const current=discussionSnapshots(ws,r);
  if(old){
    if(!discussionEqual(r.sourceSnapshots,old.sourceSnapshots))throw Error('Original source wording must remain unchanged.');
    if(!discussionEqual(r.reviewedSources,old.reviewedSources)&&(!discussionEqual(r.reviewedSources,current)||current.some(s=>!s||s.wording.status==='withdrawn')))throw Error('Review the current sources before recording them.');
  }else if(!discussionEqual(r.sourceSnapshots,current)||current.some(s=>!s))throw Error('The source changed. Reopen it before saving.');
  const thread=ws.comparisonThreads.find(t=>t.id===r.comparisonId);
  if(r.kind!=='context'&&(!thread?.participants.includes(actor)||![thread.aMapId,thread.bMapId].every(id=>ws.maps.some(m=>m.id===id&&!m.unavailable&&(m.ownerId===actor||m.visibility==='shared')))))throw Error('Both comparison maps must be available.');
  for(const target of [r.target,r.other].filter(Boolean)){
    if(target.type==='entry'){
      const parent=ws.discussions.find(p=>p.id===target.entryId);
      if(!parent||parent.id===r.id||parent.comparisonId!==r.comparisonId||parent.status!=='active')throw Error('Choose an available contribution in this comparison.');
      if(r.kind==='reply'&&r.action!=='reply'){
        if(counterpartResponseActions.includes(r.action)){
          if(parent.kind!=='counterpart')throw Error('Choose a counterpart request.');
          const source=discussionSource(ws,parent.target),recipient=ws.maps.find(m=>[thread.aMapId,thread.bMapId].includes(m.id)&&m.id!==parent.target.mapId);
          if(['close_request','reopen_request'].includes(r.action)?source?.map.ownerId!==actor:recipient?.ownerId!==actor)throw Error('Only the request author can close it, and only the recipient can give their position.');
        }else {if(parent.kind!=='argument')throw Error('Choose a challenge before recording an outcome.');
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
      if(r.kind==='inquiry'&&target.type==='node'&&source.map.ownerId===actor)throw Error('Choose the other person’s node to inquire.');
    }
  }
  if(!old&&r.kind==='counterpart'&&counterpartLinks(ws,r.comparisonId).some(link=>sameCounterpartSource(link.target,r.target)||sameCounterpartSource(link.other,r.target)))throw Error('A counterpart is already linked to this node.');
  if(r.kind==='correspondence'&&![r.target,r.other].some(t=>discussionSource(ws,t)?.map.ownerId===actor))throw Error('Link a counterpart from your own map.');
  if(r.kind==='correspondence'&&[r.target,r.other].some(t=>discussionSource(ws,t)?.item.parent===null))throw Error('Choose ordinary nodes; frame headings already correspond.');
  if(r.kind==='correspondence'&&ws.discussions.some(e=>e.id!==r.id&&e.kind==='correspondence'&&e.status==='active'&&e.comparisonId===r.comparisonId&&[stableJSON(e.target),stableJSON(e.other)].sort().join('|')===[stableJSON(r.target),stableJSON(r.other)].sort().join('|')))throw Error('These counterparts are already linked.');
  if(!['relationship','correspondence','counterpart','adoption'].includes(r.kind)&&!r.body.trim()&&r.status==='active')throw Error('Write your contribution before saving.');
  if(r.kind==='relationship'&&ws.discussions.some(e=>e.id!==r.id&&e.kind==='relationship'&&e.status==='active'&&e.authorId===actor&&e.comparisonId===r.comparisonId&&[stableJSON(e.target),stableJSON(e.other)].sort().join('|')===[stableJSON(r.target),stableJSON(r.other)].sort().join('|')))throw Error('You already recorded this pair. Open its connection to edit it.');
}
export function makeDiscussion(ws,input,actor,old=null){
  const now=new Date().toISOString(),{history,...prior}=old||{};
  const r={id:old?.id||`discussion-${crypto.randomUUID()}`,authorId:actor,comparisonId:input.kind==='context'?null:input.comparisonId,kind:input.kind,action:input.action,target:input.target,other:input.other||null,body:input.body?.trim()||'',targetLabel:old?.targetLabel||discussionTargetLabel(ws,input.target),layer:input.layer||null,status:input.status||'active',createdAt:old?.createdAt||now,updatedAt:now,version:(old?.version||0)+1,history:old?[...history,prior]:[]};
  if(input.definitionRefs!==undefined)r.definitionRefs=structuredClone(input.definitionRefs);
  else if(old?.definitionRefs)r.definitionRefs=structuredClone(old.definitionRefs);
  if(old?.sourceSnapshots)r.sourceSnapshots=old.sourceSnapshots;
  else if(!old)r.sourceSnapshots=discussionSnapshots(ws,r);
  if(old?.reviewedSources)r.reviewedSources=old.reviewedSources;
  if(input.reviewSources)r.reviewedSources=discussionSnapshots(ws,r);
  if(input.referenceUrl)r.referenceUrl=input.referenceUrl.trim();
  if(!old&&r.sourceSnapshots.some(s=>!s))throw Error('The source changed. Reopen it before saving.');
  const candidate={...ws,discussions:[...(ws.discussions||[]).filter(e=>e.id!==r.id),r]};validateDiscussions(candidate);validateDiscussionEdit(candidate,old,r,actor);return r;
}
