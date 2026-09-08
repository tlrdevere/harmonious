import assert from 'node:assert/strict';
import {exampleMap} from '../dist/data.mjs';
import {validateWorkspace,recordComparison,comparisonHealth,newId} from '../dist/workspace.mjs';
import {synchronizeIdeas,endorseNodes,endorsementIndex,nodeEndorsements,withdrawEndorsement,transferNodes} from '../dist/adoption.mjs';
import {accountKey,accountClone,ownedAccountRecords,accountChanges,stableJSON} from '../dist/account-model.mjs';
import {initialAccountChanges,projectAccountWorkspace,validateAccountChanges} from '../worker/account-policy.mjs';

export const alice={id:'11111111-1111-4111-8111-111111111111',name:'Alice'};
export const bob={id:'22222222-2222-4222-8222-222222222222',name:'Bob'};
export function memoryStore(){let snapshot={revision:0,records:[]};return {async snapshot(){return accountClone(snapshot);},async commit(actor,generation,changes){assert.equal(generation,snapshot.revision);const revisions={};for(const c of changes){const key=accountKey(c.kind,c.id),old=snapshot.records.find(r=>r.kind===c.kind&&r.id===c.id);const r={kind:c.kind,id:c.id,ownerId:actor,revision:(old?.revision||0)+1,value:accountClone(c.value)};if(old)snapshot.records[snapshot.records.indexOf(old)]=r;else snapshot.records.push(r);revisions[key]=r.revision;}snapshot.revision++;return {revisions,revision:snapshot.revision};}};}
export async function seedActor(store,actor){const snapshot=await store.snapshot(),changes=initialAccountChanges(actor);validateAccountChanges(snapshot,actor.id,changes);await store.commit(actor.id,snapshot.revision,changes);}
export async function view(store,actor){return projectAccountWorkspace(await store.snapshot(),actor.id);}
export async function edit(store,actor,fn){const data=await view(store,actor),base=new Map(ownedAccountRecords(data.workspace,actor.id,data.ownedKeys).map(r=>[accountKey(r.kind,r.id),accountClone(r.value)]));await fn(data.workspace);const changes=accountChanges(ownedAccountRecords(data.workspace,actor.id,data.ownedKeys),base,data.revisions);if(changes.length){const snapshot=await store.snapshot();validateAccountChanges(snapshot,actor.id,changes);await store.commit(actor.id,snapshot.revision,changes);}return changes;}
export function addNode(workspace,actor,title='A shared idea'){const map=workspace.maps.find(m=>m.ownerId===actor.id),node={...exampleMap().find(n=>n.parent!==null),id:newId('node'),title};map.nodes.push(node);synchronizeIdeas(workspace,map);return node;}

export async function exerciseAccounts(store){
  await seedActor(store,alice);await seedActor(store,bob);
  assert.equal((await view(store,alice)).workspace.maps.length,1);
  let nodeId,aliceMapId;
  await edit(store,alice,w=>{const node=addNode(w,alice,'UNPUBLISHED DRAFT');nodeId=node.id;aliceMapId=w.maps.find(m=>m.ownerId===alice.id).id;});
  assert(!JSON.stringify(await view(store,bob)).includes('UNPUBLISHED DRAFT'));
  await edit(store,alice,w=>{const m=w.maps.find(m=>m.id===aliceMapId);m.nodes.find(n=>n.id===nodeId).title='A shared idea';synchronizeIdeas(w,m);m.visibility='shared';});
  let b=await view(store,bob);assert.equal(b.workspace.maps.length,2);assert(!JSON.stringify(b).includes('UNPUBLISHED DRAFT'));assert(b.workspace.ideas[0].versions[0].redacted);
  const source=b.workspace.maps.find(m=>m.id===aliceMapId),sourceIdea=source.nodes.find(n=>n.id===nodeId).ideaId;
  const snap=await store.snapshot(),foreign=accountClone(source);foreign.name='Stolen';
  assert.throws(()=>validateAccountChanges(snap,bob.id,[{kind:'map',id:foreign.id,expectedRevision:1,value:foreign}]),e=>e.status===403);
  const stolenIdea=accountClone(b.workspace.ideas.find(i=>i.id===sourceIdea));
  assert.throws(()=>validateAccountChanges(snap,bob.id,[{kind:'idea',id:stolenIdea.id,expectedRevision:2,value:stolenIdea}]),e=>e.status===403);
  let bRecord;
  await edit(store,bob,w=>{const target=w.maps.find(m=>m.ownerId===bob.id);target.name='BOB PRIVATE MAP';const e=endorseNodes(w,{participantId:bob.id,sourceMapId:aliceMapId,nodeIds:[nodeId],scope:'node',anchorId:nodeId,targetMapId:target.id});e.method='authenticated';bRecord=e.id;});
  await edit(store,alice,w=>{const e=endorseNodes(w,{participantId:alice.id,sourceMapId:aliceMapId,nodeIds:[nodeId],scope:'node',anchorId:nodeId});e.method='authenticated';});
  let a=await view(store,alice),node=a.workspace.maps.find(m=>m.id===aliceMapId).nodes.find(n=>n.id===nodeId);
  assert.equal(nodeEndorsements(endorsementIndex(a.workspace),node).current.size,2);
  assert(!JSON.stringify(a).includes('BOB PRIVATE MAP'));
  assert(a.workspace.endorsements.filter(e=>e.participantId===bob.id).every(e=>e.entries.every(n=>n.targetMapId===null&&n.targetNodeId===null)));
  b=await view(store,bob);const fake=accountClone(b.workspace.endorsements.find(e=>e.id===bRecord));fake.id=newId('endorsement');fake.participantId=alice.id;
  assert.throws(()=>validateAccountChanges(snap,bob.id,[{kind:'endorsement',id:fake.id,expectedRevision:0,value:fake}]),e=>e.status===403);
  await edit(store,bob,w=>{const own=w.maps.find(m=>m.ownerId===bob.id),copy=own.nodes.find(n=>n.parent!==null);w.comparisons.push(recordComparison(w,{aMapId:aliceMapId,bMapId:own.id,aNodeId:nodeId,bNodeId:copy.id,questionStatus:'matched',question:'What do we share?',answerStatus:'aligned',notes:'BOB PRIVATE COMPARISON'}));});
  assert(!JSON.stringify(await view(store,alice)).includes('BOB PRIVATE COMPARISON'));
  b=await view(store,bob);assert.equal(comparisonHealth(b.workspace,b.workspace.comparisons[0]).needsReview,false);
  // JSONB may reorder object keys. Opening it must not create new idea versions
  // or flag unchanged comparison snapshots as changed.
  const reordered=JSON.parse(stableJSON(b.workspace));validateWorkspace(reordered);const count=reordered.ideas.reduce((n,i)=>n+i.versions.length,0);for(const m of reordered.maps)synchronizeIdeas(reordered,m);assert.equal(reordered.ideas.reduce((n,i)=>n+i.versions.length,0),count);assert.equal(comparisonHealth(reordered,reordered.comparisons[0]).needsReview,false);
  const stale=await view(store,bob),staleMap=accountClone(stale.workspace.maps.find(m=>m.ownerId===bob.id));
  await edit(store,bob,w=>{w.maps.find(m=>m.ownerId===bob.id).name='Bob updated';});staleMap.name='Old browser overwrite';
  let current=await store.snapshot();
  assert.throws(()=>validateAccountChanges(current,bob.id,[{kind:'map',id:staleMap.id,expectedRevision:stale.revisions[accountKey('map',staleMap.id)],value:staleMap}]),e=>e.status===409);
  // An unrelated user's write does not invalidate Alice's record revision.
  a=await view(store,alice);const next=accountClone(a.workspace.maps.find(m=>m.id===aliceMapId));next.name='Shared guide';
  await edit(store,bob,w=>{w.maps.find(m=>m.ownerId===bob.id).name='Another Bob edit';});current=await store.snapshot();
  const independent=[{kind:'map',id:next.id,expectedRevision:a.revisions[accountKey('map',next.id)],value:next}];validateAccountChanges(current,alice.id,independent);await store.commit(alice.id,current.revision,independent);
  // Private edits to an adopted node affect health, without revealing the edit.
  await edit(store,bob,w=>{const map=w.maps.find(m=>m.ownerId===bob.id);map.nodes.find(n=>n.parent!==null).title='BOB PRIVATE ADAPTATION';synchronizeIdeas(w,map);});
  a=await view(store,alice);assert(!JSON.stringify(a).includes('BOB PRIVATE ADAPTATION'));node=a.workspace.maps.find(m=>m.id===aliceMapId).nodes.find(n=>n.id===nodeId);assert.equal(nodeEndorsements(endorsementIndex(a.workspace),node).current.size,1);assert.equal(nodeEndorsements(endorsementIndex(a.workspace),node).review.size,1);
  await edit(store,bob,w=>{withdrawEndorsement(w,bRecord,bob.id);});
  await edit(store,alice,w=>{const m=w.maps.find(m=>m.id===aliceMapId);m.visibility='private';m.name='ALICE PRIVATE TITLE';m.nodes.find(n=>n.id===nodeId).title='ALICE NEW PRIVATE WORDING';synchronizeIdeas(w,m);});
  b=await view(store,bob);const text=JSON.stringify(b);assert(!text.includes('ALICE PRIVATE TITLE'));assert(!text.includes('ALICE NEW PRIVATE WORDING'));assert(!text.includes('UNPUBLISHED DRAFT'));assert(b.workspace.maps.some(m=>m.unavailable));assert.equal(b.workspace.comparisons[0].notes,'BOB PRIVATE COMPARISON');validateWorkspace(b.workspace);
  a=await view(store,alice);const oldIdea=accountClone(a.workspace.ideas.find(i=>i.id===sourceIdea));oldIdea.versions[0].content.title='Rewritten past';current=await store.snapshot();
  assert.throws(()=>validateAccountChanges(current,alice.id,[{kind:'idea',id:oldIdea.id,expectedRevision:a.revisions[accountKey('idea',oldIdea.id)],value:oldIdea}]),/Earlier wording/);
  return {aliceMapId,nodeId};
}

// Keep reusable helpers importable by the database and API suites.
if(import.meta.url===new URL(process.argv[1],'file:').href){
  const store=memoryStore();
  await exerciseAccounts(store);
  const copies=memoryStore();await seedActor(copies,alice);await seedActor(copies,bob);let sourceId,sourceNode;
  await edit(copies,alice,w=>{sourceNode=addNode(w,alice).id;const m=w.maps.find(m=>m.ownerId===alice.id);sourceId=m.id;m.visibility='shared';});
  await edit(copies,bob,w=>{const target=w.maps.find(m=>m.ownerId===bob.id);transferNodes(w,{sourceMapId:sourceId,targetMapId:target.id,nodeIds:[sourceNode],mode:'linked'});target.visibility='shared';});
  await edit(copies,alice,w=>{const m=w.maps.find(m=>m.id===sourceId);m.visibility='private';m.nodes.find(n=>n.id===sourceNode).title='LATER PRIVATE DRAFT';synchronizeIdeas(w,m);});
  await edit(copies,bob,w=>{assert(!JSON.stringify(w).includes('LATER PRIVATE DRAFT'));const m=w.maps.find(m=>m.ownerId===bob.id),n=m.nodes.find(n=>n.parent!==null);const e=endorseNodes(w,{participantId:bob.id,sourceMapId:m.id,nodeIds:[n.id],anchorId:n.id});e.method='authenticated';});
  const shared=(await view(copies,alice)).workspace,guide=shared.maps.find(m=>m.ownerId===bob.id);assert.equal(nodeEndorsements(endorsementIndex(shared),guide.nodes.find(n=>n.parent!==null)).current.size,1);
  console.log('Account isolation, co-sign identity, private projections, history, and concurrent changes passed.');
}
