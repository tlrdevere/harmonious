import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {recordComparison,comparisonProposalVersions,comparisonConsensus,comparisonElicitation,validateWorkspace} from '../dist/workspace.mjs';
import {validateAccountChanges} from '../worker/account-policy.mjs';
import {synchronizeIdeas} from '../dist/adoption.mjs';
import {alice,bob,memoryStore,seedActor,edit,view,addNode} from './accounts.test.mjs';

export async function exerciseElicitation(store){
  let a,b,an,bn,id;
  await edit(store,alice,w=>{an=addNode(w,alice,'Alice position').id;a=w.maps.find(m=>m.ownerId===alice.id);a.visibility='shared';});
  await edit(store,bob,w=>{bn=addNode(w,bob,'Bob position').id;b=w.maps.find(m=>m.ownerId===bob.id);b.visibility='shared';});
  const base={aMapId:a.id,bMapId:b.id,aNodeId:an,bNodeId:bn,questionStatus:'matched',answerStatus:'divergent',question:'Which starting point should we choose?'};
  const submit=async(actor,fields={})=>{
    await edit(store,actor,w=>{const prior=w.comparisons.find(p=>p.id===id),input={...base,question:prior?comparisonProposalVersions(prior).at(-1).question:base.question,...fields};const next=recordComparison(w,input,prior,actor.id);id=next.id;if(prior)w.comparisons=w.comparisons.map(p=>p.id===id?next:p);else w.comparisons.push(next);});
    const w=(await view(store,actor)).workspace;return {w,record:w.comparisons.find(p=>p.id===id)};
  };
  await submit(alice,{elicitationResponse:'I understand the choice; I favor mapping first.'});
  await assert.rejects(()=>submit(alice,{divergenceConfirmed:true}),/Both people/);
  let saved=await submit(bob,{elicitationResponse:'I understand the choice; I favor a decision first.'});
  assert.equal(comparisonElicitation(saved.w,saved.record).state,'ready');
  assert.equal(comparisonConsensus(saved.w,saved.record).state,'agreed');
  await submit(alice,{divergenceConfirmed:true});saved=await submit(bob,{divergenceConfirmed:true});
  assert.equal(comparisonElicitation(saved.w,saved.record).state,'confirmed');
  assert.deepEqual(validateWorkspace(structuredClone(saved.w)).comparisons.find(p=>p.id===id),saved.record);
  // Even restoring identical wording is a new response revision, and cannot
  // silently revive the other person's earlier confirmation.
  await submit(alice,{elicitationResponse:'I now need more context.'});
  saved=await submit(alice,{elicitationResponse:'I understand the choice; I favor mapping first.',divergenceConfirmed:true});
  assert.equal(comparisonElicitation(saved.w,saved.record).state,'ready');
  assert.equal(saved.record.judgments.find(j=>j.actorId===alice.id).responseRevision,3);
  saved=await submit(bob,{divergenceConfirmed:true});assert.equal(comparisonElicitation(saved.w,saved.record).state,'confirmed');

  const originalVersion=structuredClone(saved.record.proposalVersions[0]);
  saved=await submit(alice,{question:'Which starting point fits this particular decision?'});
  assert.equal(saved.record.proposalVersions.length,2);assert.deepEqual(saved.record.proposalVersions[0],originalVersion);
  assert.equal(comparisonConsensus(saved.w,saved.record).state,'review');
  assert.equal(comparisonElicitation(saved.w,saved.record).state,'review');
  assert.equal(saved.record.judgments.find(j=>j.actorId===bob.id).proposalRevision,1);
  saved=await submit(bob);assert.equal(comparisonConsensus(saved.w,saved.record).state,'agreed');
  assert.equal(comparisonElicitation(saved.w,saved.record).state,'ready','The new proposal still needs both confirmations');
  const source=await store.snapshot(),stored=source.records.find(r=>r.kind==='comparison'&&r.id===id);
  const honest=recordComparison(saved.w,{...base,question:saved.record.question,elicitationResponse:'Bob adds detail'},saved.record,bob.id);
  const request=value=>[{kind:'comparison',id,expectedRevision:stored.revision,value}];
  const forgedOther=structuredClone(honest);forgedOther.judgments.find(j=>j.actorId===alice.id).elicitationResponse='A forged response';
  assert.throws(()=>validateAccountChanges(source,bob.id,request(forgedOther)),/Another participant/);
  const forgedHistory=structuredClone(honest);forgedHistory.proposalVersions[0].question='Rewritten history';
  assert.throws(()=>validateAccountChanges(source,bob.id,request(forgedHistory)),/Earlier proposal revisions/);
  const forgedConfirmation=structuredClone(honest);const own=forgedConfirmation.judgments.find(j=>j.actorId===bob.id);own.divergenceConfirmed=true;own.reviewedResponses=[];
  assert.throws(()=>validateAccountChanges(source,bob.id,request(forgedConfirmation)),/both current clarification/);
  const forgedRevision=structuredClone(honest);forgedRevision.judgments.find(j=>j.actorId===bob.id).proposalRevision=1;
  assert.throws(()=>validateAccountChanges(source,bob.id,request(forgedRevision)),/current proposal/);
  const batched=recordComparison(saved.w,{...base,question:saved.record.question,elicitationResponse:'Bob adds another detail'},honest,bob.id);
  validateAccountChanges(source,bob.id,request(batched));
  saved=await submit(bob,{question:'A different interpretation of the question'});
  assert.equal(saved.record.proposalVersions.length,2,'A participant’s differing interpretation does not rewrite the proposer’s question');
  assert.equal(comparisonConsensus(saved.w,saved.record).state,'disputed');
  await edit(store,alice,w=>{const map=w.maps.find(m=>m.id===a.id);map.nodes.find(n=>n.id===an).summary='A revised source position';map.revision++;synchronizeIdeas(w,map);});
  const changed=(await view(store,bob)).workspace;assert.equal(comparisonElicitation(changed,changed.comparisons.find(p=>p.id===id)).state,'review');
  saved=await submit(alice);
  assert.equal(saved.record.proposalVersions.length,3,'Reviewing changed source wording creates a new proposal revision');
  assert.equal(saved.record.proposalVersions.at(-1).aSnapshot.node.summary,'A revised source position');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const store=memoryStore();await seedActor(store,alice);await seedActor(store,bob);await exerciseElicitation(store);
  console.log('Proposal revisions, bilateral clarification, stale confirmation invalidation and author boundaries passed.');
}
