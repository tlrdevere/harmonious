import assert from 'node:assert/strict';
import {initialWorkspace,recordComparison,comparisonHealth,comparisonConsensus,validateWorkspace} from '../dist/workspace.mjs';
import {setNodeConfidence,validConfidence} from '../dist/confidence.mjs';
import {synchronizeIdeas} from '../dist/adoption.mjs';
import {discussionSourceSnapshot} from '../dist/discussion.mjs';
import {stableJSON} from '../dist/account-model.mjs';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {validateAccountChanges} from '../worker/account-policy.mjs';

const ws=initialWorkspace(),[a,b]=ws.maps,node=a.nodes.find(n=>n.kind==='position'),other=b.nodes.find(n=>n.kind==='position'),target={type:'node',mapId:a.id,nodeId:node.id};
const input={aMapId:a.id,bMapId:b.id,aNodeId:node.id,bNodeId:other.id,questionStatus:'matched',question:'Do these positions align?',answerStatus:'aligned',notes:''};
const first=recordComparison(ws,input,null,a.ownerId),record=recordComparison(ws,input,first,b.ownerId);ws.comparisons.push(record);
const original=stableJSON(record),ideas=stableJSON(ws.ideas),discussion=stableJSON(discussionSourceSnapshot(ws,target)),version=node.ideaVersion;
for(const score of [0,73,73.5,100,null]){
  const revision=a.revision;setNodeConfidence(ws,target,a.ownerId,score);assert.equal(node.confidence,score);assert.equal(a.revision,revision+1);synchronizeIdeas(ws,a);validateWorkspace(ws);
  assert.equal(node.ideaVersion,version);assert.equal(stableJSON(ws.ideas),ideas,'Confidence does not revise or detach shared wording');
  assert.equal(comparisonHealth(ws,record).needsReview,false);assert.equal(comparisonConsensus(ws,record).state,'agreed');assert.equal(stableJSON(record),original,'Health checks preserve exact saved history');
  assert.equal(stableJSON(discussionSourceSnapshot(ws,target)),discussion,'Confidence does not stale present-day discussion or reason sources');
}
const revision=a.revision;setNodeConfidence(ws,target,a.ownerId,null);assert.equal(a.revision,revision,'Setting an unchanged score creates no map revision');
for(const invalid of [-1,101,Infinity,NaN,'75',undefined]){assert.equal(validConfidence(invalid),false);assert.throws(()=>setNodeConfidence(ws,target,a.ownerId,invalid),/0 to 100/);}
assert.throws(()=>setNodeConfidence(ws,target,b.ownerId,75),/own map/);
assert.throws(()=>setNodeConfidence(ws,{...target,nodeId:'status'},a.ownerId,75),/Choose a position/);
const adjacent=a.nodes.find(n=>n.parent===node.id&&n.kind==='position');assert(adjacent);setNodeConfidence(ws,{...target,nodeId:adjacent.id},a.ownerId,51);assert.equal(comparisonHealth(ws,record).needsReview,false,'Confidence on a linked neighbour is also personal');
node.summary+=' A changed claim.';assert.equal(comparisonHealth(ws,record).needsReview,true,'Substantive source changes still require review');

const store=memoryStore();for(const actor of [alice,bob])await seedActor(store,actor);let ownTarget;
await edit(store,alice,w=>{const n=addNode(w,alice,'My claim'),m=w.maps.find(m=>m.ownerId===alice.id);n.kind='position';synchronizeIdeas(w,m);m.visibility='shared';ownTarget={type:'node',mapId:m.id,nodeId:n.id};});
await edit(store,alice,w=>setNodeConfidence(w,ownTarget,alice.id,73));
let foreign=(await view(store,bob)).workspace.maps.find(m=>m.id===ownTarget.mapId);assert.equal(foreign.nodes.find(n=>n.id===ownTarget.nodeId).confidence,73);
foreign=structuredClone(foreign);foreign.nodes.find(n=>n.id===ownTarget.nodeId).confidence=100;const snapshot=await store.snapshot(),stored=snapshot.records.find(r=>r.kind==='map'&&r.id===foreign.id);
assert.throws(()=>validateAccountChanges(snapshot,bob.id,[{kind:'map',id:foreign.id,value:foreign,expectedRevision:stored.revision}]),error=>error.status===403,'Direct API attempts cannot change another owner’s confidence');
console.log('Confidence checks passed: valid scores, personal ownership, independent wording, retained snapshots and meaningful source review.');
