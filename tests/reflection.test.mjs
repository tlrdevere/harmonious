import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {alice,bob,memoryStore,seedActor,edit,view,addNode} from './accounts.test.mjs';
import {startAccountComparison} from '../worker/account-api.mjs';
import {validateAccountChanges} from '../worker/account-policy.mjs';
import {makeDiscussion,discussionLayer,discussionHealth,discussionSourceSnapshot,isReason,isChallenge} from '../dist/discussion.mjs';
import {isReflection,isDisagreementPoint,isReflectionOutcome,canMarkDisagreement,reflectionOutcomes,validateReflections} from '../dist/reflection.mjs';
import {capturePremise} from '../dist/premise.mjs';
import {synchronizeIdeas,createOwnedMap} from '../dist/adoption.mjs';
import {validateWorkspace} from '../dist/workspace.mjs';
import {buildReasoningIndex,projectReasoning,searchReasoning} from '../dist/reasoning-view.mjs';
import {challengeState} from '../dist/conversation-tree.mjs';

export async function exerciseReflections(store){
  for(const actor of [alice,bob])await edit(store,actor,ws=>{const map=ws.maps.find(m=>m.ownerId===actor.id);map.visibility='shared';for(const title of ['Claim','Supporting position'])addNode(ws,actor,actor.name+' '+title).kind='position';synchronizeIdeas(ws,map);});
  let ws=(await view(store,alice)).workspace;
  const a=ws.maps.find(m=>m.ownerId===alice.id),b=ws.maps.find(m=>m.ownerId===bob.id),at={type:'node',mapId:a.id,nodeId:a.nodes.at(-2).id},bt={type:'node',mapId:b.id,nodeId:b.nodes.at(-2).id},source={mapId:a.id,nodeId:a.nodes.at(-1).id},edge={type:'edge',mapId:a.id,edgeId:'structure:'+at.nodeId};
  const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:a.id,bMapId:b.id});
  const save=async(actor,input,oldId=null)=>{let result;await edit(store,actor,w=>{const old=w.discussions.find(r=>r.id===oldId)||null;result=makeDiscussion(w,{comparisonId:thread.id,...input},actor.id,old);w.discussions=w.discussions.filter(r=>r.id!==result.id);w.discussions.push(result);});return result;};
  const entry=r=>({type:'entry',entryId:r.id}),inference=r=>({type:'inference',entryId:r.id});
  const pointInput=(target,category='')=>({kind:'reflection',action:'disagreement_point',target,layer:'arguments',body:'We differ on what the evidence establishes.',reflection:{category}});
  const outcomeInput=(point,result='')=>({kind:'reflection',action:'outcome',target:entry(point),layer:'arguments',body:'This is my own assessment of the discussion.',reflection:{result,nextStep:''}});
  ws=(await view(store,alice)).workspace;
  const premise=capturePremise(ws,source),reason=await save(alice,{kind:'argument',action:'reason',target:at,premise,body:premise.wording.title});
  const challenge=await save(bob,{kind:'argument',action:'fallacy',target:inference(reason),body:'The premise does not establish the conclusion.'});
  const response=await save(alice,{kind:'reply',action:'reply',target:entry(challenge),layer:'arguments',body:'Here is how I understand that inference.'});
  const question=await save(alice,{kind:'inquiry',action:'question',target:bt,body:'What might change your view?'});
  const relationship=await save(alice,{kind:'relationship',action:'disagreement',target:at,other:bt});
  const original=(await view(store,alice)).workspace,unchanged={maps:structuredClone(original.maps),relationships:structuredClone(original.discussions.filter(r=>r.kind==='relationship')),challenge:structuredClone(challenge)};
  let point=await save(alice,pointInput(at,'facts'));
  const foreignPoint=await save(alice,pointInput(bt)),edgePoint=await save(bob,pointInput(edge,'reasoning')),statementPoint=await save(bob,pointInput(entry(reason),'other')),inferencePoint=await save(alice,pointInput(inference(reason),'reasoning')),responsePoint=await save(bob,pointInput(entry(response),'values'));
  ws=(await view(store,bob)).workspace;
  assert(isReflection(point)&&isDisagreementPoint(point)&&!isReflectionOutcome(point));assert(!isReason(point)&&!isChallenge(point));assert.equal(discussionLayer(point),'arguments');
  assert(ws.discussions.some(r=>r.id===point.id),'The other participant sees the same point');
  for(const target of [at,bt,edge,entry(reason),entry(response),inference(reason)])assert(canMarkDisagreement(ws,target,thread.id));
  for(const target of [{type:'node',mapId:a.id,nodeId:'status'},entry(question),entry(relationship),entry(challenge),entry(point),inference(challenge)]){
    assert(!canMarkDisagreement(ws,target,thread.id));await assert.rejects(()=>save(alice,pointInput(target)),/Mark a source|reasoning connection|source changed|available source/i);
  }
  for(const category of ['unsupported',null,5])await assert.rejects(()=>save(alice,{...pointInput(at),reflection:{category}}),/disagreement category/);
  for(const details of [null,{}, {category:'facts',extra:true},{result:'more_work',nextStep:''}])await assert.rejects(()=>save(alice,{...pointInput(at),reflection:details}),/disagreement category/);
  await assert.rejects(()=>save(alice,{...pointInput(at),body:'   '}),/Write a reflection/);
  await assert.rejects(()=>save(alice,{...pointInput(at),layer:null}),/Write a reflection/);
  for(const extra of [{referenceUrl:'https://example.org/'},{definitionRefs:[]},{premise:null},{adoption:null}])await assert.rejects(()=>save(alice,{...pointInput(at),...extra}),/reflection|premise|adoption|referenced definitions/i);
  await assert.rejects(()=>save(alice,{kind:'inquiry',action:'question',target:bt,body:'Extra metadata',reflection:{category:'facts'}}),/Reflection details/);
  let ownOutcome=await save(alice,outcomeInput(point,'changed_position'));
  const otherOutcome=await save(bob,{...outcomeInput(point,'more_work'),reflection:{result:'more_work',nextStep:'Compare the additional examples.'}});
  ws=(await view(store,alice)).workspace;
  assert(isReflectionOutcome(ownOutcome)&&!isReason(ownOutcome)&&!isChallenge(ownOutcome));assert.equal(reflectionOutcomes(ws,point.id).length,2);
  assert.deepEqual(ws.maps,unchanged.maps);assert.deepEqual(ws.discussions.filter(r=>r.kind==='relationship'),unchanged.relationships);assert.deepEqual(ws.discussions.find(r=>r.id===challenge.id),unchanged.challenge);assert.equal(challengeState(ws.discussions,challenge),'Open','A personal outcome does not resolve an objection');
  await assert.rejects(()=>save(alice,outcomeInput(point)),/already have an outcome/);
  for(const details of [{result:'resolved',nextStep:''},{result:'',nextStep:'a'.repeat(2001)},{result:'more_work'},{result:'',nextStep:'',category:'facts'}])await assert.rejects(()=>save(bob,{...outcomeInput(foreignPoint),reflection:details}),/reflection outcome/);
  await assert.rejects(()=>save(alice,outcomeInput(reason)),/point of disagreement/);
  for(const target of [entry(point),entry(ownOutcome)])for(const [kind,action,layer]of [['reply','reply','arguments'],['argument','challenge',null],['argument','reason',null],['inquiry','question',null]])await assert.rejects(()=>save(alice,{kind,action,target,layer,body:'This must remain an attached annotation.'}),/does not start another conversation|own position/);
  const priorOutcome=structuredClone(ownOutcome);ownOutcome=await save(alice,{...ownOutcome,body:'I now understand the remaining difference.',reflection:{result:'difference_understood',nextStep:'Revisit after more evidence.'}},ownOutcome.id);
  assert.deepEqual(ownOutcome.history[0].reflection,priorOutcome.reflection);assert.equal(ownOutcome.reflection.result,'difference_understood');
  const priorPoint=structuredClone(point);point=await save(alice,{...point,reflection:{category:'values'},body:'We place different weight on these consequences.'},point.id);
  assert.equal(point.history[0].reflection.category,'facts');assert.equal(point.history[0].body,priorPoint.body);
  ws=(await view(store,bob)).workspace;assert.equal(discussionHealth(ws,otherOutcome).state,'changed');assert.equal(otherOutcome.sourceSnapshots[0].wording.reflection.category,'facts');assert.equal(discussionSourceSnapshot(ws,entry(point)).wording.reflection.category,'values');
  assert.deepEqual(validateWorkspace(structuredClone(ws)),ws);
  const malformed=structuredClone(point);malformed.history[0].action='outcome';assert.throws(()=>validateReflections({...ws,discussions:[...ws.discussions.filter(r=>r.id!==point.id),malformed]}),/preserve its role/);
  const snapshot=await store.snapshot(),row=snapshot.records.find(r=>r.id===ownOutcome.id&&r.kind==='discussion');
  const fresh=makeDiscussion(ws,{comparisonId:thread.id,...pointInput(bt)},alice.id);fresh.reviewedSources=structuredClone(fresh.sourceSnapshots);validateAccountChanges(snapshot,alice.id,[{kind:'discussion',id:fresh.id,expectedRevision:0,value:fresh}]);
  fresh.reviewedSources[0].wording.title='FABRICATED REVIEW';assert.throws(()=>validateAccountChanges(snapshot,alice.id,[{kind:'discussion',id:fresh.id,expectedRevision:0,value:fresh}]),/current reflection source/,'A new annotation cannot claim to have reviewed invented source wording');
  const staged=makeDiscussion(ws,{...ownOutcome,body:'First unsaved revision'},alice.id,ownOutcome),stagedWorkspace={...ws,discussions:ws.discussions.map(r=>r.id===ownOutcome.id?staged:r)},twice=makeDiscussion(stagedWorkspace,{...staged,body:'Second unsaved revision'},alice.id,staged);
  validateAccountChanges(snapshot,alice.id,[{kind:'discussion',id:row.id,expectedRevision:row.revision,value:twice}]);
  twice.history.at(-1).sourceSnapshots=structuredClone(twice.history.at(-1).sourceSnapshots);twice.history.at(-1).sourceSnapshots[0].wording.body='FABRICATED INTERMEDIATE SOURCE';assert.throws(()=>validateAccountChanges(snapshot,alice.id,[{kind:'discussion',id:row.id,expectedRevision:row.revision,value:twice}]),/source snapshots must remain unchanged/,'Appended history cannot invent an original source snapshot');
  assert.throws(()=>validateAccountChanges(snapshot,bob.id,[{kind:'discussion',id:row.id,expectedRevision:row.revision,value:{...ownOutcome,reflection:{result:'more_work',nextStep:'Foreign edit'}}}]),e=>e.status===403);
  const changedHistory=structuredClone(ownOutcome);changedHistory.history[0].body='Forged earlier assessment';
  assert.throws(()=>validateAccountChanges(snapshot,alice.id,[{kind:'discussion',id:row.id,expectedRevision:row.revision,value:changedHistory}]),/Earlier contributions/);
  const projected=projectReasoning(buildReasoningIndex(ws.discussions),{anchor:at,focusId:inferencePoint.id,pinnedIds:[point.id,ownOutcome.id]});assert(projected.entries.every(r=>!isReflection(r)));assert(projected.links.every(link=>!ws.discussions.find(r=>r.id===link.entryId&&isReflection(r))));
  assert(searchReasoning(buildReasoningIndex(ws.discussions),{query:'additional examples'}).results.some(r=>r.entry.id===otherOutcome.id));
  assert(!searchReasoning(buildReasoningIndex(ws.discussions),{filter:'open'}).results.some(r=>isReflection(r.entry)));
  ownOutcome=await save(alice,{...ownOutcome,status:'withdrawn'},ownOutcome.id);const replacement=await save(alice,outcomeInput(point));assert.notEqual(replacement.id,ownOutcome.id);assert.equal(reflectionOutcomes((await view(store,alice)).workspace,point.id).length,2);
  // Existing historical generic children may still be read and withdrawn, but
  // cannot be used to start a new graph beneath an annotation.
  const historical=structuredClone(ws),legacy={...response,id:'legacy-note-child',target:entry(point),sourceSnapshots:[discussionSourceSnapshot(ws,entry(point))]};historical.discussions.push(legacy);validateWorkspace(historical);
  assert.throws(()=>makeDiscussion(historical,{...legacy,body:'An edited conversation under a note'},alice.id,legacy),/does not start another conversation/);
  const legacyWithdrawal=makeDiscussion(historical,{...legacy,status:'withdrawn'},alice.id,legacy);assert.equal(legacyWithdrawal.status,'withdrawn');
  let separate;
  await edit(store,alice,w=>{separate=createOwnedMap(w,{name:'Different comparison',ownerId:alice.id});separate.visibility='shared';});
  const another=(await startAccountComparison(store,alice.id,{aMapId:separate.id,bMapId:b.id})).comparisonThread;
  await assert.rejects(()=>save(alice,{...pointInput(entry(reason)),comparisonId:another.id}),/same comparison|Mark a source/);
  await edit(store,alice,w=>{const map=w.maps.find(m=>m.id===source.mapId);map.nodes=map.nodes.filter(n=>n.id!==source.nodeId);});
  ws=(await view(store,bob)).workspace;assert.equal(discussionHealth(ws,inferencePoint).state,'unavailable');assert(!canMarkDisagreement(ws,inference(reason),thread.id));
  await assert.rejects(()=>save(bob,pointInput(entry(reason))),/available/);
  await assert.rejects(()=>save(alice,outcomeInput(inferencePoint,'more_work')),/available/);
  await assert.rejects(()=>save(alice,{...inferencePoint,body:'A hidden edit',status:'withdrawn'},inferencePoint.id),/available/);
  const gone=await save(alice,{...inferencePoint,status:'withdrawn'},inferencePoint.id);assert.equal(gone.status,'withdrawn');assert.deepEqual(gone.sourceSnapshots,inferencePoint.sourceSnapshots);
  point=await save(alice,{...point,status:'withdrawn'},point.id);
  await assert.rejects(()=>save(bob,{...otherOutcome,body:'Edit after point withdrawal'},otherOutcome.id),/active point|available/);
  const withdrawnOutcome=await save(bob,{...otherOutcome,status:'withdrawn'},otherOutcome.id);assert.equal(withdrawnOutcome.status,'withdrawn');assert.deepEqual(withdrawnOutcome.reflection,otherOutcome.reflection);
  await edit(store,alice,w=>{w.maps.find(m=>m.id===a.id).visibility='private';});
  ws=(await view(store,bob)).workspace;assert(!ws.discussions.some(isReflection),'Revoked source access also removes attached reflections');
  console.log('Reflection authorship, scoped targets, independent outcomes, history, source health, attachment-only projection, withdrawal and privacy passed.');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const store=memoryStore();for(const actor of [alice,bob])await seedActor(store,actor);await exerciseReflections(store);}
