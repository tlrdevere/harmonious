import {frameOf,graphEdges} from './model.mjs';
import {stableJSON} from './account-model.mjs';

// CSV grammar v4, with the subsequently agreed prototype decisions. IDs and
// hidden signals are storage vocabulary; labels/helpers are presentation only.
export const INTERACTION_ACTIONS={compare:[['endorse','Agree'],['disagree','Disagree'],['decline','No position']],inquiry:[['request_reason','Request reason'],['request_explanation','Request explanation'],['propose_alternative','Propose alternative'],['offer_reason','Offer reason']],argument:[['dispute','Dispute reasoning']]};
const option=(id,label,helper='',signal=null,group='About the claim')=>({id,label,helper,group,...(signal?{signal}:{})});
const base=(id,label,signal,helper='')=>option(id,label,helper,signal);
export const INTERACTION_DISPUTES={
 status:[base('false',"It's false",'Factual'),base('overstated',"It's overstated",'Factual','True only in some cases (hasty generalization)'),base('omission','It leaves out something important','Factual','True but misleading by omission'),base('value_as_fact',"It's a value judgment presented as fact",'Values'),base('conflicting_claim','It conflicts with another claim','Logical','Point to the other claim on any map you both can access'),base('double_standard','It uses a standard not applied elsewhere','Logical','Double standard')],
 goal:[base('conflicting_goal','It conflicts with another goal','Logical'),base('unachievable',"It isn't achievable",'Factual'),base('different_value','It serves a value I weigh differently','Values'),base('double_standard','It uses a standard not applied elsewhere','Logical','Double standard')],
 action:[base('side_effects','It has harmful side effects','Factual'),base('better_alternative',"There's a better alternative",'Mixed','False dilemma, if only two options were considered'),base('infeasible',"It isn't practically or politically feasible",'Factual'),base('cost',"It costs more than it's worth",'Mixed'),base('conflicts_goal','It conflicts with a goal','Logical')],
 source:[base('data_inaccurate','The data is inaccurate or misreported','Factual'),base('data_outdated','The data is outdated','Factual'),base('unrepresentative',"It's unrepresentative or cherry-picked",'Factual','Including a single anecdote'),base('source_expertise',"The source isn't credible or lacks relevant expertise",'Factual','Appeal to authority'),base('source_conflict','The source has a conflict of interest','Factual'),base('sources_disagree','Other sources disagree','Factual')].map(o=>({...o,group:'About the source'})),
 reason:[base('irrelevant','Not relevant','Logical','Including attacking the person rather than the claim (ad hominem)'),base('insufficient','Not enough on its own','Logical','Hasty generalization'),base('hidden_assumption','Relies on a hidden assumption','Logical','State the assumption'),base('false_analogy','The cases differ in an important way','Logical',"False analogy (e.g., 'it worked in another city')"),base('circular','The reason assumes the conclusion','Logical','Circular reasoning'),base('equivocation','A key term shifts meaning','Logical','Equivocation'),base('exception',"There's an exception",'Logical','Usually true, but not in this case')],
 cause:[base('correlation',"It's correlation, not cause",'Factual','False cause'),base('third_factor','Something else explains it','Factual','A third factor drives both'),base('mechanism',"The mechanism doesn't work",'Factual'),base('exception',"There's an exception",'Factual')],
 addresses:[base('ineffective',"It won't address the problem",'Factual'),base('symptom',"It treats a symptom, not the cause",'Factual'),base('unstated_conditions','It only works under conditions not stated','Factual')],
 enables:[base('ineffective',"It won't achieve the goal",'Factual'),base('symptom',"It treats a symptom, not the cause",'Factual'),base('unstated_conditions','It only works under conditions not stated','Factual')]
};
const other=()=>option('other','Other','','','Other'),choices=rows=>rows.map(([id,label])=>option(id,label,'',null,'Choices'));
export const INTERACTION_CHOICES={
 endorse:choices([['already_hold','I already hold this'],['own_reason','For my own reason']]),
 decline:choices([['dont_know',"I don't know"],['need_information','I need more information'],['not_considered',"I haven't considered this"]]),
 request_reason:choices([['reason','A reason'],['source','Evidence or a source']]),
 request_explanation:choices([['term','A word or term'],['scope','How broadly it applies']]),
 propose_alternative:choices([['narrower','Narrower'],['clearer','Clearer wording'],['neutral','More neutral wording']]),
 propose_edge:choices([['condition','Only under a condition'],['weaker','A weaker connection']]),
 respond_request:choices([['answer','Answer'],['dont_know',"I don't know"]]),
 respond_dispute:choices([['accept','Accept'],['partly_accept','Partly accept'],['reject','Reject'],['misrepresented',"You've misrepresented my claim"]]),
 respond_proposal:choices([['accept','Accept'],['reject','Reject']])
};
const eq=(a,b)=>stableJSON(a)===stableJSON(b),check=(ok,message)=>{if(!ok)throw Error(message);};
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
export const interactionActions=mode=>(INTERACTION_ACTIONS[mode]||[]).map(([id,label])=>({id,label}));
export const interactionLabel=value=>value?.interaction?.version===6?'Reply':value==='respond'||value?.action==='respond'?'Respond':Object.values(INTERACTION_ACTIONS).flat().find(([id])=>id===(typeof value==='string'?value:value?.action))?.[1]||'Interaction';
export const interactionMode=record=>record?.kind==='interaction'?record.interaction?.mode:null;
export const interactionSource=(ws,target)=>{const map=ws.maps.find(m=>m.id===target?.mapId&&!m.unavailable);const item=target?.type==='node'?map?.nodes.find(n=>n.id===target.nodeId):target?.type==='edge'&&map?graphEdges(map.nodes,map.relations).find(e=>e.id===target.edgeId):null;return item?{map,item}:null;};
export function interactionClassification(ws,target){
 const parent=['entry','inference'].includes(target?.type)?ws.discussions?.find(r=>r.id===target.entryId):null;
 if(parent)return {targetType:target.type,frame:null,edgeType:target.type==='inference'?'reason':null,hasSource:false,parentAction:parent.action};
 const source=interactionSource(ws,target);if(!source)return null;
 const {map,item}=source;
 return {targetType:target.type,frame:target.type==='node'?frameOf(map.nodes,item.id):null,edgeType:target.type==='edge'?({causal:'cause',motivates:'addresses',aims_for:'enables'}[item.type]||item.type):null,hasSource:target.type==='node'&&!!(item.sourceTitle?.trim()||item.sourceUrl?.trim()),parentAction:null};
}
export const ARGUMENT_CATEGORIES=[
 option('factual_basis','Factual basis','Is the claim accurate and supported by evidence?',null,'What do you dispute?'),
 option('reasoning','Reasoning','Does the conclusion follow from the reasons and assumptions?',null,'What do you dispute?'),
 option('consequences','Consequences','What results or side effects would follow?',null,'What do you dispute?'),
 option('feasibility','Feasibility','Can the proposed action or goal realistically be achieved?',null,'What do you dispute?')
];
// Version 4 remains the historical catalog. Authoring explicitly uses version 5.
export function optionsForClassification(c,action,version=4){
 if(!c)return [];
 if(version===6)return action==='respond'&&c.targetType==='entry'&&c.parentAction==='dispute'?choices([['reply','Reply']]):[];
 const node=c.targetType==='node',edge=c.targetType==='edge'||c.targetType==='inference';
 let rows=[];
 if(action==='dispute'){
  if(version===5)return (node&&['status','action','goal'].includes(c.frame)||edge&&['reason','cause','addresses','enables'].includes(c.edgeType))?ARGUMENT_CATEGORIES.map(o=>({...o})):[];
  rows=node?[...(INTERACTION_DISPUTES[c.frame]||[]),...(c.hasSource?INTERACTION_DISPUTES.source:[])]:edge?INTERACTION_DISPUTES[c.edgeType]||[]:[];
  if(!rows.length)return [];
 }else if(action==='respond'){
  const key=['request_reason','request_explanation'].includes(c.parentAction)?'respond_request':['propose_alternative','offer_reason'].includes(c.parentAction)?'respond_proposal':c.parentAction==='dispute'?'respond_dispute':null;
  if(!key)return [];rows=INTERACTION_CHOICES[key];
 }else if(action==='endorse')rows=node?INTERACTION_CHOICES.endorse:[];
 else if(action==='request_explanation')rows=node?INTERACTION_CHOICES.request_explanation:[];
 else if(action==='propose_alternative')rows=node?INTERACTION_CHOICES.propose_alternative:INTERACTION_CHOICES.propose_edge;
 else rows=INTERACTION_CHOICES[action]||[];
 return [...rows,...(rows.length||action==='endorse'?[other()]:[])].map(o=>({...o,...(edge&&action==='dispute'?{group:'About the connection'}:{})}));
}
export const interactionOptions=(ws,target,action)=>optionsForClassification(interactionClassification(ws,target),action,action==='dispute'?5:4);
export function interactionRecipient(ws,target,action,actor=null,version=4){const parent=ws.discussions?.find(r=>r.id===target?.entryId);return parent?version===6&&parent.authorId===actor?parent.interaction?.recipientId:parent.authorId:interactionSource(ws,target)?.map.ownerId||null;}
export const canRespondInteraction=(r,actor)=>r?.kind==='interaction'&&r.status==='active'&&r.interaction?.recipientId===actor&&['request_reason','request_explanation','propose_alternative','offer_reason','dispute'].includes(r.action);
export const canReplyArgument=(r,actor)=>r?.kind==='interaction'&&r.action==='dispute'&&r.status==='active'&&r.interaction?.mode==='argument'&&[r.authorId,r.interaction.recipientId].includes(actor);
export function interactionReferenceChoices(ws,comparisonId){
 const thread=ws.comparisonThreads?.find(t=>t.id===comparisonId);if(!thread)return [];
 return ws.maps.filter(m=>!m.unavailable&&thread.participants.every(actor=>m.ownerId===actor||m.visibility==='shared')).flatMap(map=>map.nodes.filter(n=>n.parent!==null).map(n=>({target:{type:'node',mapId:map.id,nodeId:n.id},label:n.title,mapId:map.id,mapName:map.name,ownerId:map.ownerId})));
}
export function interactionReference(ws,comparisonId,target){
 if(!target)return null;target=target.target||target;
 check(exact(target,['type','mapId','nodeId'])&&interactionReferenceChoices(ws,comparisonId).some(c=>eq(c.target,target)),'Point to one node on a map both participants can access.');
 const {map,item}=interactionSource(ws,target);
 return {target:structuredClone(target),snapshot:{label:item.title,frame:frameOf(map.nodes,item.id),wording:Object.fromEntries(['title','summary','details','kind','sourceTitle','sourceUrl'].map(key=>[key,item[key]||'']))}};
}
export function interactionHealth(ws,r){
 if(r.kind!=='interaction')return {state:'current'};
 const classification=interactionClassification(ws,r.target);if(!classification)return {state:'unavailable'};
 let changed=!eq(classification,r.interaction.classification);
 if(r.interaction.reference){try{changed=!eq(interactionReference(ws,r.comparisonId,r.interaction.reference.target),r.interaction.reference)||changed;}catch{return {state:'unavailable'};}}
 return {state:changed?'changed':'current'};
}
export function makeInteraction(ws,input,actor,version=input.action==='dispute'?5:input.action==='respond'&&input.options?.includes('reply')?6:4){
 const classification=interactionClassification(ws,input.target),parent=ws.discussions?.find(r=>r.id===input.target?.entryId),allowed=optionsForClassification(classification,input.action,version),selected=input.options||[];
 check(Array.isArray(selected)&&selected.every(id=>allowed.some(o=>o.id===id))&&new Set(selected).size===selected.length,'Choose options that apply to this source.');
 const options=allowed.filter(o=>selected.includes(o.id)).map(o=>o.id),mode=input.action==='respond'?parent?.interaction?.mode:input.mode;
 return {version,mode,options,otherText:options.includes('other')?(input.otherText||'').trim():'',reference:interactionReference(ws,input.comparisonId,input.reference),recipientId:interactionRecipient(ws,input.target,input.action,actor,version),classification,signals:allowed.filter(o=>selected.includes(o.id)&&o.signal).map(o=>({optionId:o.id,tag:o.signal}))};
}
export function validateInteractionRecord(r){
 if(r.kind!=='interaction'){check(!r.interaction,'Interaction metadata belongs only to a grammar interaction.');return;}
 const m=r.interaction,c=m?.classification;
 check(exact(m,['version','mode','options','otherText','reference','recipientId','classification','signals'])&&(m.version===4||m.version===5&&r.action==='dispute'||m.version===6&&r.action==='respond'&&m.mode==='argument')&&Object.hasOwn(INTERACTION_ACTIONS,m.mode),'Invalid interaction metadata.');
 if(m.version===6)check(typeof r.body==='string'&&r.body.trim().length>0,'Write a reply before sending.');
 check(exact(c,['targetType','frame','edgeType','hasSource','parentAction'])&&c.targetType===r.target.type&&typeof c.hasSource==='boolean','Invalid interaction source classification.');
 check(r.action==='respond'||interactionActions(m.mode).some(a=>a.id===r.action),'Choose an interaction for this mode.');
 const allowed=optionsForClassification(c,r.action,m.version),selected=m.options;
 check(Array.isArray(selected)&&eq(selected,allowed.filter(o=>selected.includes(o.id)).map(o=>o.id)),'Choose options that apply to this source.');
 check(r.action!=='respond'||selected.length===1,'Choose one response outcome.');
 check(r.action!=='dispute'||selected.length>0,'Choose at least one dispute option.');
 check(typeof m.otherText==='string'&&m.otherText.length<=10000&&(selected.includes('other')||m.otherText===''),'Invalid free-form interaction text.');
 check(typeof m.recipientId==='string'&&m.recipientId!==r.authorId,'Direct this interaction to the other person.');
 check(eq(m.signals,allowed.filter(o=>selected.includes(o.id)&&o.signal).map(o=>({optionId:o.id,tag:o.signal}))),'Interaction signals must match the selected options.');
 if(m.reference!==null){const ref=m.reference;check(exact(ref,['target','snapshot'])&&exact(ref.target,['type','mapId','nodeId'])&&ref.target.type==='node'&&typeof ref.target.mapId==='string'&&typeof ref.target.nodeId==='string'&&exact(ref.snapshot,['label','frame','wording'])&&typeof ref.snapshot.label==='string'&&ref.snapshot.label.length<=2000&&['status','action','goal'].includes(ref.snapshot.frame)&&exact(ref.snapshot.wording,['title','summary','details','kind','sourceTitle','sourceUrl'])&&Object.values(ref.snapshot.wording).every(v=>typeof v==='string'&&v.length<=10000),'Invalid referenced node snapshot.');}
 check(!r.premise&&!r.adoption&&!r.reflection&&!r.definitionRefs&&!r.referenceUrl,'Use the interaction fields for this contribution.');
}
export function validateInteractionEdit(ws,old,r,actor){
 if(r.kind!=='interaction'){check(!r.interaction,'Interaction metadata belongs only to a grammar interaction.');return;}
 for(const v of [...r.history,r]){validateInteractionRecord(v);check(v.action===r.action&&v.interaction.mode===r.interaction.mode&&v.interaction.recipientId===r.interaction.recipientId,'An interaction keeps its action, mode, and recipient.');}
 if(old)check(old.action===r.action&&old.interaction.mode===r.interaction.mode&&old.interaction.recipientId===r.interaction.recipientId,'An interaction keeps its action, mode, and recipient.');
 if(old)check((old.interaction.version===6)===(r.interaction.version===6),'A reply keeps its original type.');
 check(r.action!=='dispute'||r.interaction.version===5,'Refresh Harmonious and choose the current dispute categories.');
 const parent=ws.discussions.find(e=>e.id===r.target.entryId),source=interactionSource(ws,r.target);
 if(r.action==='respond')check(r.target.type==='entry'&&(r.interaction.version===6?canReplyArgument(parent,actor):canRespondInteraction(parent,actor)),'Only the intended recipient can respond, or either dispute participant can reply.');
 else check((source&&source.map.ownerId!==actor&&(r.target.type!=='node'||source.item.parent!==null))||(['entry','inference'].includes(r.target.type)&&parent?.authorId!==actor&&parent?.kind==='argument'&&parent.action==='reason'),'Select the other person’s ordinary node or connection.');
 const expected=makeInteraction(ws,{...r,...r.interaction},actor);
 check(eq(expected,r.interaction),'The interaction source or referenced node changed. Reopen it before saving.');
}
