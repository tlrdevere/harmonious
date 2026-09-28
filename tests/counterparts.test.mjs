import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {startAccountComparison} from '../worker/account-api.mjs';
import {makeDiscussion,validateDiscussionEdit} from '../dist/discussion.mjs';
import {counterpartLinks,counterpartPairs,counterpartRecords,counterpartState,counterpartRequestState,comparisonCounterparts,sameCounterpartSource} from '../dist/counterparts.mjs';
import {validateWorkspace} from '../dist/workspace.mjs';

export async function exerciseCounterparts(store){
  let an,bn;
  for(const actor of [alice,bob])await edit(store,actor,ws=>{const map=ws.maps.find(m=>m.ownerId===actor.id);map.visibility='shared';const n=addNode(ws,actor,actor.name+' counterpart exercise');if(actor===alice)an=n.id;else bn=n.id;});
  let ws=(await view(store,alice)).workspace;const am=ws.maps.find(m=>m.ownerId===alice.id),bm=ws.maps.find(m=>m.ownerId===bob.id);
  const result=await startAccountComparison(store,alice.id,{aMapId:am.id,bMapId:bm.id}),thread=result.comparisonThread;
  const target={type:'node',mapId:am.id,nodeId:an},other={type:'node',mapId:bm.id,nodeId:bn};
  assert.deepEqual(comparisonCounterparts(ws,{a:{map:am,selected:an},b:{map:bm,selected:bn}}).reserved,[],'Selecting ordinary nodes does not reserve or imply a counterpart');
  // These outcomes are deliberately sequential. A fast memory store can create
  // both in the same millisecond, which would test the ID tie-break instead.
  let outcomeClock=Date.parse('2026-01-01T00:00:00Z');
  async function save(actor,input,oldId=null){let r;await edit(store,actor,w=>{const old=w.discussions.find(r=>r.id===oldId);r=makeDiscussion(w,{...input,comparisonId:thread.id},actor.id,old);const time=new Date(outcomeClock+=1000).toISOString();r.createdAt=old?.createdAt||time;r.updatedAt=time;w.discussions=[...w.discussions.filter(e=>e.id!==r.id),r];});return r;}
  const request=await save(alice,{kind:'counterpart',action:'counterpart',target,body:'What is your position?'});
  const reply=(action)=>({kind:'reply',action,target:{type:'entry',entryId:request.id},layer:'inquiries',body:'My explanation'});
  await assert.rejects(()=>save(alice,reply('no_position')),/recipient/);
  await assert.rejects(()=>save(bob,reply('close_request')),/author/);
  await save(bob,reply('no_position'));ws=(await view(store,alice)).workspace;assert.equal(counterpartRequestState(ws,request),'No position yet');
  assert.equal(counterpartState(ws,thread.id,target).label,'No position yet','A replied request is not shown as an unanswered request or an unlinked ghost');
  await save(alice,reply('reopen_request'));ws=(await view(store,alice)).workspace;assert.equal(counterpartRequestState(ws,request),'Awaiting counterpart');
  const states={a:{map:ws.maps.find(m=>m.id===am.id)},b:{map:ws.maps.find(m=>m.id===bm.id)}};assert(comparisonCounterparts(ws,states).reserved.some(t=>t.nodeId===an));
  const originalMap=structuredClone(ws.maps.find(m=>m.id===am.id));
  const link=await save(bob,{kind:'correspondence',action:'counterpart_link',target,other});
  ws=(await view(store,alice)).workspace;assert.equal(counterpartRequestState(ws,request),'Counterpart linked');assert(counterpartLinks(ws,thread.id).some(r=>r.id===link.id));
  assert.deepEqual(ws.maps.find(m=>m.id===am.id),originalMap,'Linking an existing counterpart does not edit the other map');
  assert(!ws.discussions.some(r=>r.kind==='relationship'&&r.target.nodeId===an),'A counterpart link does not imply agreement');
  assert(!comparisonCounterparts(ws,states).reserved.some(t=>t.nodeId===an));
  const grouped=structuredClone(ws);grouped.discussions.push(makeDiscussion(grouped,{kind:'relationship',action:'agreement',comparisonId:thread.id,target,other},alice.id));
  // A reused comparison can already contain unrelated pairs. Exercise that
  // deterministically, without relying on the database suite's random map IDs
  // to select the map pair populated by an earlier exercise.
  const unrelatedA=addNode(grouped,alice,'Unrelated Alice projection source'),unrelatedB=addNode(grouped,bob,'Unrelated Bob projection source');
  const unrelated=makeDiscussion(grouped,{kind:'relationship',action:'disagreement',comparisonId:thread.id,target:{...target,nodeId:unrelatedA.id},other:{...other,nodeId:unrelatedB.id}},alice.id);grouped.discussions.push(unrelated);
  const involvesTarget=record=>sameCounterpartSource(record.target,target)||sameCounterpartSource(record.other,target),unrelatedLinks=counterpartLinks(grouped,thread.id).filter(record=>!involvesTarget(record));assert(unrelatedLinks.some(record=>record.id===unrelated.id));
  assert.equal(counterpartPairs(grouped,thread.id,target).length,1,'A counterpart and historical judgment share one pair');assert.equal(counterpartPairs(grouped,thread.id,target)[0].records.length,2,'Distinct recorded meanings remain inspectable');
  const beforeProjection=JSON.stringify(grouped),projection=counterpartState(grouped,thread.id,target);
  assert.equal(projection.count,1);assert.equal(projection.pairs[0].records.length,2);assert.equal(projection.kind,'linked');assert.equal(projection.request.id,request.id,'A saved pair takes precedence without discarding the request');
  assert.equal(counterpartState(grouped,thread.id,target,{adjacent:()=>true}).label,'Counterpart linked');
  for(const status of ['collapsed','filtered','missing','unavailable']){const p=counterpartState(grouped,thread.id,target,{endpoint:()=>({status})});assert.equal(p.pairs[0].status,status);assert.equal(p.count,1);assert.equal(p.kind,['missing','unavailable'].includes(status)?'unavailable':'linked');}
  assert.equal(counterpartState(grouped,thread.id,{...target,nodeId:'status'}).count,0,'A hidden child link does not transfer identity to its ancestor');
  const missing=structuredClone(grouped);missing.maps.find(m=>m.id===bm.id).nodes=missing.maps.find(m=>m.id===bm.id).nodes.filter(n=>n.id!==bn);
  assert.equal(counterpartLinks(missing,thread.id).filter(involvesTarget).length,0,'Existing workflow eligibility still requires both endpoints of the affected pair');assert.deepEqual(counterpartLinks(missing,thread.id),unrelatedLinks,'Deleting this endpoint leaves unrelated valid pairs eligible');assert.equal(counterpartRecords(missing,thread.id).filter(involvesTarget).length,2,'Both recorded meanings remain semantically linked after their endpoint disappears');assert.deepEqual(counterpartRecords(missing,thread.id),counterpartRecords(grouped,thread.id),'All permitted pair history survives the missing endpoint');assert.equal(comparisonCounterparts(missing,states).links.filter(involvesTarget).length,2);assert.equal(counterpartState(missing,thread.id,target).label,'Counterpart unavailable');
  const inaccessible=structuredClone(grouped);Object.assign(inaccessible.maps.find(m=>m.id===bm.id),{unavailable:true,nodes:[]});assert.equal(counterpartState(inaccessible,thread.id,target).kind,'unavailable');
  const crossFrame=structuredClone(grouped);crossFrame.maps.find(m=>m.id===bm.id).nodes.find(n=>n.id===bn).parent='goal';assert.equal(counterpartState(crossFrame,thread.id,target).pairs[0].status,'cross-frame');
  const multiple=structuredClone(grouped),otherTarget={...other,nodeId:'another-permitted-endpoint'};multiple.discussions.push({...link,id:link.id+'-other',other:otherTarget});const multipleState=counterpartState(multiple,thread.id,target);assert.equal(multipleState.count,2);assert.equal(multipleState.label,'Linked counterparts (2)');assert.deepEqual(multipleState.pairs.map(p=>p.status),['visible','missing'],'A mixed set keeps distinct visibility states rather than labelling the whole set unavailable');
  const irrelevant=structuredClone(grouped);irrelevant.discussions=irrelevant.discussions.filter(r=>r.kind==='counterpart');irrelevant.comparisons.push({aMapId:am.id,aNodeId:an,bMapId:bm.id,bNodeId:bn});assert.equal(counterpartState(irrelevant,thread.id,target).kind,'requested','Earlier workspace comparisons do not become semantic counterpart pairs');irrelevant.discussions=[];assert.equal(counterpartState(irrelevant,thread.id,target).kind,'unlinked');
  assert.equal(JSON.stringify(grouped),beforeProjection,'Semantic and visibility projection does not mutate maps, records, requests or history');
  assert.deepEqual(validateWorkspace(JSON.parse(JSON.stringify(ws))),ws);
  await assert.rejects(()=>save(alice,{kind:'correspondence',action:'counterpart_link',target:other,other:target}),/already linked/);
  assert.throws(()=>validateDiscussionEdit(ws,link,makeDiscussion(ws,{...link,status:'withdrawn'},bob.id,link),alice.id),/Only the author/,'Only the link author may withdraw its record');
  await save(bob,{...link,status:'withdrawn'},link.id);ws=(await view(store,alice)).workspace;assert.equal(counterpartRequestState(ws,request),'Awaiting counterpart');assert(comparisonCounterparts(ws,states).reserved.some(t=>t.nodeId===an),'An unanswered request regains its spot after the last link is withdrawn');
  await save(alice,reply('close_request'));ws=(await view(store,bob)).workspace;assert.equal(counterpartRequestState(ws,request),'Request closed');
  assert.equal(counterpartState(ws,thread.id,target).kind,'request-state');assert.equal(counterpartState(ws,thread.id,target).label,'Request closed');
  const ownFirst=await save(alice,{kind:'correspondence',action:'counterpart_link',target,other});assert.equal(ownFirst.authorId,alice.id,'Either endpoint owner can link starting with their own node');
  await save(alice,{...ownFirst,status:'withdrawn'},ownFirst.id);ws=(await view(store,alice)).workspace;assert.equal(counterpartRequestState(ws,request),'Request closed','Withdrawing the last link preserves a closed request');
  const unavailable=structuredClone(ws);unavailable.maps.find(m=>m.id===bm.id).unavailable=true;assert.deepEqual(comparisonCounterparts(unavailable,{a:{map:unavailable.maps.find(m=>m.id===am.id),selected:an},b:{map:unavailable.maps.find(m=>m.id===bm.id)}}).reserved,[],'Unavailable maps do not manufacture replacement spots');
  let createdId,createdLink;
  await edit(store,bob,w=>{const n=addNode(w,bob,'Created and linked in one save');createdId=n.id;createdLink=makeDiscussion(w,{kind:'correspondence',action:'counterpart_link',comparisonId:thread.id,target,other:{type:'node',mapId:bm.id,nodeId:n.id}},bob.id);w.discussions.push(createdLink);});
  ws=(await view(store,alice)).workspace;assert(ws.maps.find(m=>m.id===bm.id).nodes.some(n=>n.id===createdId));assert(ws.discussions.some(r=>r.id===createdLink.id));assert.equal(counterpartRequestState(ws,request),'Counterpart linked','A map addition and its link persist together');
  await edit(store,bob,w=>{w.maps.find(m=>m.id===bm.id).visibility='private';});
  assert(!(await view(store,alice)).workspace.discussions.some(r=>r.id===link.id),'Private source hides shared counterpart records');
  await edit(store,bob,w=>{w.maps.find(m=>m.id===bm.id).visibility='shared';});
  console.log('Counterpart linking, no implied agreement, request outcomes, authorship, withdrawal, privacy and portable history passed.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const store=memoryStore();for(const actor of [alice,bob])await seedActor(store,actor);await exerciseCounterparts(store);}
