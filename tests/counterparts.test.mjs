import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {startAccountComparison} from '../worker/account-api.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {counterpartLinks,counterpartRequestState,comparisonCounterparts} from '../dist/counterparts.mjs';
import {validateWorkspace} from '../dist/workspace.mjs';

export async function exerciseCounterparts(store){
  let an,bn;
  for(const actor of [alice,bob])await edit(store,actor,ws=>{const map=ws.maps.find(m=>m.ownerId===actor.id);map.visibility='shared';const n=addNode(ws,actor,actor.name+' counterpart exercise');if(actor===alice)an=n.id;else bn=n.id;});
  let ws=(await view(store,alice)).workspace;const am=ws.maps.find(m=>m.ownerId===alice.id),bm=ws.maps.find(m=>m.ownerId===bob.id);
  const result=await startAccountComparison(store,alice.id,{aMapId:am.id,bMapId:bm.id}),thread=result.comparisonThread;
  const target={type:'node',mapId:am.id,nodeId:an},other={type:'node',mapId:bm.id,nodeId:bn};
  async function save(actor,input,oldId=null){let r;await edit(store,actor,w=>{const old=w.discussions.find(r=>r.id===oldId);r=makeDiscussion(w,{...input,comparisonId:thread.id},actor.id,old);w.discussions=[...w.discussions.filter(e=>e.id!==r.id),r];});return r;}
  const request=await save(alice,{kind:'counterpart',action:'counterpart',target,body:'What is your position?'});
  const reply=(action)=>({kind:'reply',action,target:{type:'entry',entryId:request.id},layer:'inquiries',body:'My explanation'});
  await assert.rejects(()=>save(alice,reply('no_position')),/recipient/);
  await assert.rejects(()=>save(bob,reply('close_request')),/author/);
  await save(bob,reply('no_position'));ws=(await view(store,alice)).workspace;assert.equal(counterpartRequestState(ws,request),'No position yet');
  await save(alice,reply('reopen_request'));ws=(await view(store,alice)).workspace;assert.equal(counterpartRequestState(ws,request),'Awaiting counterpart');
  const states={a:{map:ws.maps.find(m=>m.id===am.id)},b:{map:ws.maps.find(m=>m.id===bm.id)}};assert(comparisonCounterparts(ws,states).reserved.some(t=>t.nodeId===an));
  const originalMap=structuredClone(ws.maps.find(m=>m.id===am.id));
  const link=await save(bob,{kind:'correspondence',action:'counterpart_link',target,other});
  ws=(await view(store,alice)).workspace;assert.equal(counterpartRequestState(ws,request),'Counterpart linked');assert(counterpartLinks(ws,thread.id).some(r=>r.id===link.id));
  assert.deepEqual(ws.maps.find(m=>m.id===am.id),originalMap,'Linking an existing counterpart does not edit the other map');
  assert(!ws.discussions.some(r=>r.kind==='relationship'&&r.target.nodeId===an),'A counterpart link does not imply agreement');
  assert(!comparisonCounterparts(ws,states).reserved.some(t=>t.nodeId===an));
  assert.deepEqual(validateWorkspace(JSON.parse(JSON.stringify(ws))),ws);
  await assert.rejects(()=>save(alice,{kind:'correspondence',action:'counterpart_link',target:other,other:target}),/already linked/);
  await save(bob,{...link,status:'withdrawn'},link.id);ws=(await view(store,alice)).workspace;assert.equal(counterpartRequestState(ws,request),'Awaiting counterpart');
  await save(alice,reply('close_request'));ws=(await view(store,bob)).workspace;assert.equal(counterpartRequestState(ws,request),'Request closed');
  let createdId,createdLink;
  await edit(store,bob,w=>{const n=addNode(w,bob,'Created and linked in one save');createdId=n.id;createdLink=makeDiscussion(w,{kind:'correspondence',action:'counterpart_link',comparisonId:thread.id,target,other:{type:'node',mapId:bm.id,nodeId:n.id}},bob.id);w.discussions.push(createdLink);});
  ws=(await view(store,alice)).workspace;assert(ws.maps.find(m=>m.id===bm.id).nodes.some(n=>n.id===createdId));assert(ws.discussions.some(r=>r.id===createdLink.id));assert.equal(counterpartRequestState(ws,request),'Counterpart linked','A map addition and its link persist together');
  await edit(store,bob,w=>{w.maps.find(m=>m.id===bm.id).visibility='private';});
  assert(!(await view(store,alice)).workspace.discussions.some(r=>r.id===link.id),'Private source hides shared counterpart records');
  await edit(store,bob,w=>{w.maps.find(m=>m.id===bm.id).visibility='shared';});
  console.log('Counterpart linking, no implied agreement, request outcomes, authorship, withdrawal, privacy and portable history passed.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const store=memoryStore();for(const actor of [alice,bob])await seedActor(store,actor);await exerciseCounterparts(store);}
