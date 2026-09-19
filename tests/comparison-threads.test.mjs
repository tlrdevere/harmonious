import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {initialWorkspace,startComparisonThread,recordComparison,validateWorkspace} from '../dist/workspace.mjs';
import {createOwnedMap} from '../dist/adoption.mjs';
import {startAccountComparison} from '../worker/account-api.mjs';
import {validateAccountChanges} from '../worker/account-policy.mjs';
import {alice,bob,seedActor,edit,view,memoryStore} from './accounts.test.mjs';

export async function exerciseComparisonThreads(store){
  let a,b;
  await edit(store,alice,w=>{a=createOwnedMap(w,{name:'New Alice worldview',ownerId:alice.id,mapType:'personal'});a.visibility='shared';});
  await edit(store,bob,w=>{b=createOwnedMap(w,{name:'New Bob worldview',ownerId:bob.id,mapType:'personal'});b.visibility='shared';});
  // Both calls read the same initial generation; the losing commit must retry
  // and open the winner's parent, including when map order is reversed.
  const [first,second]=await Promise.all([startAccountComparison(store,alice.id,{aMapId:a.id,bMapId:b.id}),startAccountComparison(store,bob.id,{aMapId:b.id,bMapId:a.id})]);
  assert.equal(first.comparisonThread.id,second.comparisonThread.id);
  const id=first.comparisonThread.id;
  for(const actor of [alice,bob]){
    const saved=await view(store,actor);
    assert(saved.workspace.comparisonThreads.some(thread=>thread.id===id));
    assert.equal(saved.workspace.comparisons.filter(proposal=>proposal.comparisonId===id).length,0);
  }
  const snapshot=await store.snapshot();
  const forged={...first.comparisonThread,id:'forged-parent',participants:[alice.id]};
  assert.throws(()=>validateAccountChanges(snapshot,alice.id,[{kind:'comparison_thread',id:forged.id,value:forged,expectedRevision:0}]),/already exists/);
  await assert.rejects(()=>startAccountComparison(store,'unrelated-account',{aMapId:a.id,bMapId:b.id}),e=>e.status===403);
  await edit(store,bob,w=>{w.maps.find(map=>map.id===b.id).visibility='private';});
  await assert.rejects(()=>startAccountComparison(store,alice.id,{aMapId:a.id,bMapId:b.id}),e=>e.status===403);
  const retained=await view(store,alice);
  assert(!retained.workspace.maps.find(map=>map.id===b.id)||retained.workspace.maps.find(map=>map.id===b.id).unavailable);
  return {thread:first.comparisonThread,a,b};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const w=initialWorkspace(),[a,b]=w.maps,thread=startComparisonThread(w,a.id,b.id,a.ownerId);
  assert.equal(startComparisonThread(w,b.id,a.id,b.ownerId).id,thread.id);
  assert.equal(validateWorkspace(structuredClone(w)).comparisonThreads.length,1,'Empty comparisons survive a portable round trip');
  const proposal=recordComparison(w,{aMapId:a.id,bMapId:b.id,aNodeId:'a1',bNodeId:'a1',questionStatus:'matched',question:'Which starting point?',answerStatus:'partial'});
  assert.equal(proposal.comparisonId,thread.id);w.comparisons.push(proposal);
  const legacy=structuredClone(w);delete legacy.comparisonThreads;delete legacy.comparisons[0].comparisonId;
  const upgraded=validateWorkspace(legacy);assert.equal(upgraded.comparisonThreads[0].id,proposal.id);
  assert.equal(upgraded.comparisons[0].id,proposal.id);assert.deepEqual(upgraded.comparisons[0].judgments,proposal.judgments);
  const invalid=structuredClone(w);invalid.comparisons[0].comparisonId='unrelated-parent';
  assert.throws(()=>validateWorkspace(invalid),/overall comparison/);
  const store=memoryStore();await seedActor(store,alice);await seedActor(store,bob);await exerciseComparisonThreads(store);
  console.log('Empty shared comparisons, reversed concurrent creation, visibility, parent references and portable upgrade passed.');
}
