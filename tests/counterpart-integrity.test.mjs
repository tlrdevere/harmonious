import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {accountWorkspace,saveAccountChanges,startAccountComparison,COUNTERPART_CAPABILITY} from '../worker/account-api.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {counterpartRecords,counterpartLinkProblem,counterpartUnlinkInput,counterpartState} from '../dist/counterparts.mjs';
import {validateWorkspace} from '../dist/workspace.mjs';
import {synchronizeIdeas,createOwnedMap} from '../dist/adoption.mjs';
import {nodeAssessment,counterpartAssessment} from '../dist/interaction-presentation.mjs';

export async function counterpartIntegrityFixture(store){
 const refs={};
 for(const actor of [alice,bob])await edit(store,actor,w=>{
  const map=w.maps.find(m=>m.ownerId===actor.id);map.visibility='shared';refs[actor.name]=[];
  for(let i=0;i<4;i++){const n=addNode(w,actor,`${actor.name} integrity ${i}`);if(i===3)n.parent='goal';refs[actor.name].push({type:'node',mapId:map.id,nodeId:n.id});}
  synchronizeIdeas(w,map);
 });
 const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:refs.Alice[0].mapId,bMapId:refs.Bob[0].mapId});
 return {thread,refs};
}
export async function exerciseCounterpartIntegrity(store){
 const {thread,refs}=await counterpartIntegrityFixture(store),[a,a2,a3,ag]=refs.Alice,[b,b2,b3,bg]=refs.Bob;
 const input=(target=a,other=b,kind='correspondence')=>({kind,action:kind==='relationship'?'agreement':'counterpart_link',comparisonId:thread.id,target,other});
 async function save(actor,data,oldId){const v=await view(store,actor),old=v.workspace.discussions.find(r=>r.id===oldId),r=makeDiscussion(v.workspace,data,actor.id,old);await saveAccountChanges(store,actor.id,[{kind:'discussion',id:r.id,expectedRevision:old?v.revisions[JSON.stringify(['discussion',r.id])]:0,value:r}]);return r;}
 await assert.rejects(()=>save(alice,input(a,bg)),/same frame/);
 await assert.rejects(()=>save(bob,input(bg,a)),/same frame/);
 const link=await save(bob,input()),assessment=await save(alice,input(a,b,'relationship'));
 await assert.rejects(()=>save(alice,input(a,b2)),/already has a counterpart/);
 await assert.rejects(()=>save(bob,input(b,a2)),/already has a counterpart/);
 await assert.rejects(()=>save(alice,input(a2,b)),/already has a counterpart/);
 await assert.rejects(()=>save(alice,input(a,b2,'relationship')),/already has a counterpart/);
 let w=(await view(store,alice)).workspace;
 assert.equal(counterpartState(w,thread.id,a).count,1,'Two meanings about the same pair are one counterpart');
 assert.equal(counterpartLinkProblem(w,thread.id,a2,b2),'');
 const historical=structuredClone(w);historical.discussions.push({...link,id:link.id+'-legacy',other:b2,sourceSnapshots:[link.sourceSnapshots[0],{...link.sourceSnapshots[1],target:b2}]});historical.maps.find(m=>m.id===b.mapId).nodes.find(n=>n.id===b.nodeId).parent='goal';synchronizeIdeas(historical,historical.maps.find(m=>m.id===b.mapId));
 const preserved=JSON.stringify(historical);validateWorkspace(historical);assert.equal(JSON.stringify(historical),preserved,'Historical cross-frame/multiple links remain readable without repair or deletion');
 const unlink=await save(alice,counterpartUnlinkInput(w,thread.id,a,b));
 assert.deepEqual(unlink.unlinkedRecordIds,[link.id,assessment.id].sort());
 w=(await view(store,bob)).workspace;assert(!counterpartRecords(w,thread.id).some(r=>unlink.unlinkedRecordIds.includes(r.id)));
 assert.deepEqual(w.discussions.find(r=>r.id===link.id),link,'Unlinking does not change the other author’s linking record');
 assert.deepEqual(w.discussions.find(r=>r.id===assessment.id),assessment,'Unlinking preserves the earlier assessment');
 await assert.rejects(()=>save(alice,{...unlink,status:'withdrawn'},unlink.id),/unlink receipt/i);
 await assert.rejects(()=>accountWorkspace(store,alice,{counterpartCapable:false}),e=>e.code==='CLIENT_UPDATE_REQUIRED'&&e.requiredCapability===COUNTERPART_CAPABILITY);
 const replay=[{kind:'discussion',id:unlink.id,expectedRevision:0,value:unlink}],before=await store.snapshot();
 assert.equal((await saveAccountChanges(store,alice.id,replay)).replayed,true);assert.deepEqual(await store.snapshot(),before,'Lost unlink acknowledgement replays without another receipt');
 const relink=await save(alice,input());w=(await view(store,bob)).workspace;
 assert.deepEqual(counterpartRecords(w,thread.id).filter(r=>r.target.nodeId===a.nodeId||r.other.nodeId===a.nodeId).map(r=>r.id),[relink.id],'Relinking creates a new ID and does not revive the old assessment');
 const second=await save(bob,counterpartUnlinkInput(w,thread.id,a,b));assert.equal(second.authorId,bob.id,'The other participant can unlink the new pair');
 const privateView=await view(store,alice),privateAssessment=makeDiscussion(privateView.workspace,{...assessment},alice.id,assessment);
 privateAssessment.extra={interaction:{reference:{target:{type:'node',mapId:'not-shared',nodeId:'hidden'}}}};
 await saveAccountChanges(store,alice.id,[{kind:'discussion',id:privateAssessment.id,expectedRevision:privateView.revisions[JSON.stringify(['discussion',privateAssessment.id])],value:privateAssessment}]);
 const projected=(await view(store,bob)).workspace;assert(!projected.discussions.some(r=>r.id===assessment.id),'An unavailable external reference still hides its original record');
 assert(projected.discussions.some(r=>r.id===unlink.id),'The snapshot-free unlink receipt remains visible');
 assert(!counterpartRecords(projected,thread.id).some(r=>r.id===link.id),'Hiding one original must not revive another visible original named by the same receipt');
 const withdrawn=await save(bob,{...link,status:'withdrawn'},link.id);await assert.rejects(()=>save(bob,{...withdrawn,status:'active'},link.id),/unlinked/);
 // An unlink can clear historical missing nodes, retaining the original identities.
 const missingLink=await save(alice,input(a2,b2));
 await edit(store,bob,ws=>{const m=ws.maps.find(m=>m.id===b2.mapId);m.nodes=m.nodes.filter(n=>n.id!==b2.nodeId);});
 w=(await view(store,bob)).workspace;assert.equal(counterpartState(w,thread.id,a2).kind,'unavailable');
 const missingReceipt=await save(bob,counterpartUnlinkInput(w,thread.id,a2,b2));assert.deepEqual(missingReceipt.unlinkedRecordIds,[missingLink.id]);
 // The same final batch works even when the new link precedes the unlink receipt.
 const old=await save(alice,input(a3,b3));w=(await view(store,bob)).workspace;
 const receipt=makeDiscussion(w,counterpartUnlinkInput(w,thread.id,a3,b3),bob.id);w.discussions.push(receipt);
 const replacement=makeDiscussion(w,input(a3,b3),bob.id);
 await saveAccountChanges(store,bob.id,[replacement,receipt].map(value=>({kind:'discussion',id:value.id,expectedRevision:0,value})));
 w=(await view(store,alice)).workspace;assert(counterpartRecords(w,thread.id).some(r=>r.id===replacement.id));assert(!counterpartRecords(w,thread.id).some(r=>r.id===old.id));
 let privateReference;
 await edit(store,alice,ws=>{const map=createOwnedMap(ws,{name:'Shared stance reference',ownerId:alice.id});map.visibility='shared';const n={...ws.maps.find(m=>m.id===a.mapId).nodes.find(n=>n.id===a.nodeId),id:crypto.randomUUID(),title:'PRIVATE STANCE REFERENCE'};delete n.ideaId;delete n.ideaVersion;map.nodes.push(n);synchronizeIdeas(ws,map);privateReference={type:'node',mapId:map.id,nodeId:n.id};});
 let stanceClock=Date.now();
 async function stance(actor,action,target,reference){const v=await view(store,actor),r=makeDiscussion(v.workspace,{kind:'interaction',action,comparisonId:thread.id,target,interaction:{mode:'compare',options:[],...(reference?{reference}:{})}},actor.id);r.createdAt=r.updatedAt=new Date(stanceClock+=1000).toISOString();await saveAccountChanges(store,actor.id,[{kind:'discussion',id:r.id,expectedRevision:0,value:r}]);return r;}
 const earlier=await stance(alice,'endorse',b3);await stance(bob,'endorse',a3);w=(await view(store,bob)).workspace;assert.equal(counterpartAssessment(w,thread.id,a3)?.label,'Both agree');
 const latest=await stance(alice,'disagree',b3,privateReference);
 await edit(store,alice,ws=>{ws.maps.find(m=>m.id===privateReference.mapId).visibility='private';});
 w=(await view(store,bob)).workspace;assert(!w.discussions.some(r=>[earlier.id,latest.id].includes(r.id)),'A hidden latest stance must not promote an older stance to current');assert.equal(nodeAssessment(w,thread.id,b3,alice.id).state,'unassessed');assert.equal(counterpartAssessment(w,thread.id,a3),null,'Withholding a private latest stance cannot manufacture Both agree');assert(!JSON.stringify(w).includes('PRIVATE STANCE REFERENCE'));
 const preservedStances=await store.snapshot();assert([earlier.id,latest.id].every(id=>preservedStances.records.some(r=>r.id===id)),'Both stance records remain in account history');
 await edit(store,alice,ws=>{ws.maps.find(m=>m.id===privateReference.mapId).visibility='shared';});w=(await view(store,bob)).workspace;assert.equal(nodeAssessment(w,thread.id,b3,alice.id).state,'disagree','Restoring sharing restores the latest actual stance');
 // Competing first links must revalidate after the generation race, not both win.
 const races=[makeDiscussion(w,input(ag,bg),alice.id)];
 // Use a second same-frame candidate for the race without changing existing nodes.
 await edit(store,bob,ws=>{const n=addNode(ws,bob,'Competing goal counterpart');n.parent='goal';synchronizeIdeas(ws,ws.maps.find(m=>m.ownerId===bob.id));refs.race={type:'node',mapId:b.mapId,nodeId:n.id};});
 w=(await view(store,bob)).workspace;races[1]=makeDiscussion(w,input(ag,refs.race),bob.id);
 const outcomes=await Promise.allSettled(races.map((value,i)=>saveAccountChanges(store,[alice,bob][i].id,[{kind:'discussion',id:value.id,expectedRevision:0,value}])));
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.match(outcomes.find(r=>r.status==='rejected').reason.message,/counterpart/);
 console.log('Counterpart integrity, either-owner unlink receipts, preserved legacy meaning, missing sources, batch ordering, idempotence, and competing saves passed.');
 return {thread,refs,link,assessment,unlink,relink,second,missingLink,missingReceipt,replacement};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const store=memoryStore();for(const actor of [alice,bob])await seedActor(store,actor);await exerciseCounterpartIntegrity(store);}
