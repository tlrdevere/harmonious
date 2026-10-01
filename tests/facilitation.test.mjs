import assert from 'node:assert/strict';
import {fixture,alice,bob,organizer,outsider,caps} from './facilitation-fixture.mjs';
import {handleAccountAPI,saveAccountChanges,accountWorkspace} from '../worker/account-api.mjs';
import {validateWorkspace} from '../dist/workspace.mjs';
import {validateFacilitatedBatch,facilitatorLabel,nodeFacilitation} from '../dist/facilitation.mjs';
import {addNode} from './accounts.test.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {counterpartDisplay} from '../dist/interaction-presentation.mjs';
import {standstillProposalMetadata,standstillEventMetadata,standstillState} from '../dist/standstill.mjs';
const f=await fixture();
try{
 const grant={participantId:alice.id,expectedVersion:0,attested:true};
 await assert.rejects(()=>f.command(bob,'grant',grant),/organizer/);await assert.rejects(()=>f.command(organizer,'grant',{...grant,participantId:outsider.id}),/test accounts/);
 await assert.rejects(()=>f.command(organizer,'grant',{...grant,attested:false}),/permission/);
 await f.command(organizer,'grant',grant);const ctx={participantId:alice.id,grantVersion:1};
 const delegated=await f.api(organizer).workspace(alice.id,1);assert(delegated.workspace.maps.every(m=>m.ownerId===alice.id));assert.equal(delegated.actor.id,alice.id);assert.equal(delegated.operator.id,organizer.id);
 await assert.rejects(()=>f.api(bob).workspace(alice.id,1),/permission/);await assert.rejects(()=>f.api(organizer).workspace(alice.id,2),/permission/);
 const changes=await f.changes(alice,ws=>{ws.maps[0].nodes[0].summary='Alice’s proposed exact wording';}),before=await f.store.snapshot();
 const input={...ctx,changes,operationId:crypto.randomUUID()},draft=await f.api(organizer).command('draft',input);assert(draft.savedDraft);assert.deepEqual((await f.store.snapshot()).records,before.records,'Draft creates no canonical contribution');
 assert.equal((await f.api(bob).list()).drafts.length,0);assert.equal((await f.api(alice).list()).drafts.length,1);assert((await f.api(organizer).command('draft',input)).replayed);
 await assert.rejects(()=>f.command(bob,'approve',{...ctx,draftId:draft.draftId,draftVersion:1}),/belongs/);
 await assert.rejects(()=>f.command(organizer,'approve',{...ctx,draftId:draft.draftId,draftVersion:1}),/wording/);
 const approval={...ctx,draftId:draft.draftId,draftVersion:1,operationId:crypto.randomUUID()};await f.api(alice).command('approve',approval);const published=await accountWorkspace(f.store,alice);assert.equal(published.workspace.schemaVersion,7);assert.equal(published.workspace.maps[0].nodes[0].summary,'Alice’s proposed exact wording');
 let receipt=published.workspace.facilitationHistory.at(-1);assert.equal(receipt.operatorId,alice.id);assert.equal(receipt.enteredBy,organizer.id);assert.equal(receipt.method,'direct');assert(facilitatorLabel(published.workspace,[receipt]).includes('Approved by Alice'));assert.equal(receipt.nodes.length,1);validateWorkspace(JSON.parse(JSON.stringify(published.workspace)));
 const after=await f.store.snapshot();assert((await f.api(alice).command('approve',approval)).replayed);assert.deepEqual(await f.store.snapshot(),after,'Approval retry creates no duplicate receipt');
 const second=await f.changes(alice,ws=>{ws.maps[0].nodes[0].summary='Later wording';}),d2=await f.command(organizer,'draft',{...ctx,changes:second});await saveAccountChanges(f.store,alice.id,await f.changes(alice,ws=>{ws.maps[0].nodes[0].summary='Participant edited independently';}));
 await assert.rejects(()=>f.command(alice,'approve',{...ctx,draftId:d2.draftId,draftVersion:1}),/changed|revision|version/i);assert.equal((await f.api(alice).list()).drafts.find(d=>d.id===d2.draftId).state,'pending');
 receipt=(await accountWorkspace(f.store,alice)).workspace.facilitationHistory.at(-1);assert.equal(receipt.operatorId,alice.id);assert.equal(receipt.draftId,null);assert.equal(facilitatorLabel(published.workspace,[published.workspace.facilitationHistory[0],receipt]),'Facilitated history');
 const directed=await f.changes(alice,ws=>{ws.maps[0].nodes[0].confidence=71;});assert.throws(()=>validateFacilitatedBatch(after,alice.id,directed,{draft:true}),/Drafts/);
 await assert.rejects(()=>f.command(organizer,'draft',{...ctx,changes:directed}),/Drafts/);await assert.rejects(()=>f.command(organizer,'record',{...ctx,changes:directed,method:'directed'}),/direction/);
 const record={...ctx,changes:directed,method:'directed',attested:true,operationId:crypto.randomUUID()};await f.api(organizer).command('record',record);assert((await f.api(organizer).command('record',record)).replayed);
 const headers={'X-Harmonious-Capabilities':caps.replace(',facilitation-v1','')};const response=await handleAccountAPI(new Request(f.env.APP_ORIGIN+'/api/workspace',{headers}),f.env,{store:f.store,auth:f.auth(alice)});assert.equal(response.status,409);assert.equal((await response.json()).requiredCapability,'facilitation-v1');
 const snap=await f.store.snapshot();await assert.rejects(()=>f.store.facilitate(outsider.id,organizer.id,snap.revision,'record',record),/facilitator/);assert.deepEqual(await f.store.snapshot(),snap);
 await f.command(alice,'revoke',{participantId:alice.id,expectedVersion:1});await assert.rejects(()=>f.api(organizer).workspace(alice.id,1),/permission/);await assert.rejects(()=>f.api(organizer).command('record',record),/permission/);assert.equal((await f.api(organizer).list()).drafts.length,0);
 await f.command(organizer,'grant',{...grant,expectedVersion:2});await assert.rejects(()=>f.command(alice,'approve',{...ctx,grantVersion:3,draftId:d2.draftId,draftVersion:1}),/changed/);await assert.rejects(()=>f.api(organizer).workspace(alice.id,1),/permission/);
 await f.command(organizer,'grant',{participantId:bob.id,expectedVersion:0,attested:true});const refs={};
 for(const actor of [alice,bob]){const changes=await f.changes(actor,ws=>{const m=ws.maps.find(m=>m.ownerId===actor.id);m.visibility='shared';const n=addNode(ws,actor,actor.name+' participant claim');n.parent='status';refs[actor.name]={type:'node',mapId:m.id,nodeId:n.id};});await f.command(organizer,'record',{participantId:actor.id,grantVersion:actor===alice?3:1,changes,attested:true,method:'directed'});}
 const thread=(await f.command(organizer,'comparison',{participantId:alice.id,grantVersion:3,aMapId:refs.Alice.mapId,bMapId:refs.Bob.mapId})).comparisonThread;
 const contribution=async(actor,input,command='record')=>{const ws=(await accountWorkspace(f.store,actor)).workspace,value=makeDiscussion(ws,{comparisonId:thread.id,...input},actor.id),changes=[{kind:'discussion',id:value.id,expectedRevision:0,value}];const result=await f.command(organizer,command,{participantId:actor.id,grantVersion:actor===alice?3:1,changes,attested:command==='record',method:'directed'});return {value,result};};
 await contribution(alice,{kind:'correspondence',action:'counterpart_link',target:refs.Bob,other:refs.Alice,body:'Comparable nodes linked. Agreement has not been judged.'});
 await contribution(alice,{kind:'interaction',action:'endorse',target:refs.Bob,body:'Agree',interaction:{mode:'compare',options:[]}});
 assert.notEqual(counterpartDisplay((await accountWorkspace(f.store,alice)).workspace,thread.id,refs.Alice).state,'agree','One facilitated decision does not become bilateral agreement');
 await contribution(bob,{kind:'interaction',action:'endorse',target:refs.Alice,body:'Agree',interaction:{mode:'compare',options:[]}});
 assert.equal(counterpartDisplay((await accountWorkspace(f.store,alice)).workspace,thread.id,refs.Alice).state,'agree');
 const activityView=(await accountWorkspace(f.store,alice)).workspace;activityView.facilitationHistory=activityView.facilitationHistory.filter(r=>r.kind!=='map'||r.recordId!==refs.Bob.mapId);assert.equal(nodeFacilitation(activityView,refs.Bob.mapId,refs.Bob.nodeId).label,'Facilitated activity','An assessment is not authorship of its target node');assert.match(nodeFacilitation(activityView,refs.Alice.mapId,refs.Alice.nodeId).label,/Entered by Taylor/);
 const dispute=(await contribution(alice,{kind:'interaction',action:'dispute',target:refs.Bob,body:'We disagree about the evidence',interaction:{mode:'argument',options:['factual_basis']}})).value;
 const reply=(await contribution(bob,{kind:'interaction',action:'respond',target:{type:'entry',entryId:dispute.id},body:'The evidence is inconclusive',interaction:{mode:'argument',options:['reply'],replyTo:{entryId:dispute.id,version:1}}})).value;
 const placedDraft=await contribution(alice,{kind:'interaction',action:'respond',target:{type:'entry',entryId:dispute.id},body:'An assisted reply above',interaction:{mode:'argument',options:['reply'],replyTo:{entryId:reply.id,version:reply.version},placement:'above'}},'draft');
 await f.command(organizer,'approve',{participantId:alice.id,grantVersion:3,draftId:placedDraft.result.draftId,draftVersion:1,attested:true});
 assert.equal((await accountWorkspace(f.store,bob)).workspace.discussions.find(r=>r.id===placedDraft.value.id).interaction.placement,'above');
 const ws=(await accountWorkspace(f.store,alice)).workspace,proposal=(await contribution(alice,{kind:'standstill',action:'propose_standstill',target:refs.Bob,body:'We need different evidence to proceed',standstill:standstillProposalMetadata(ws,thread.id,reply.id)})).value;
 await assert.rejects(()=>contribution(alice,{kind:'standstill',action:'confirm_standstill',target:{type:'entry',entryId:proposal.id},body:'',standstill:standstillEventMetadata((ws.discussions.push(proposal),ws),proposal)}),/other participant/);
 await contribution(bob,{kind:'standstill',action:'confirm_standstill',target:{type:'entry',entryId:proposal.id},body:'',standstill:standstillEventMetadata((await accountWorkspace(f.store,bob)).workspace,proposal)});
 const confirmed=(await accountWorkspace(f.store,alice)).workspace;assert.equal(standstillState(confirmed,proposal.id).state,'confirmed');assert(confirmed.facilitationHistory.filter(r=>r.kind==='discussion').every(r=>r.operatorId===organizer.id));assert(new Set(confirmed.facilitationHistory.filter(r=>r.kind==='discussion').map(r=>r.participantId)).size===2);
 const privateDraft=await contribution(alice,{kind:'interaction',action:'dispute',target:refs.Bob,body:'Private alternative draft',interaction:{mode:'argument',options:['consequences']}},'draft');assert(!(await accountWorkspace(f.store,bob)).workspace.discussions.some(r=>r.id===privateDraft.value.id));
 await f.command(organizer,'approve',{participantId:alice.id,grantVersion:3,draftId:privateDraft.result.draftId,draftVersion:1,attested:true});const verbal=(await accountWorkspace(f.store,bob)).workspace.facilitationHistory.find(r=>r.recordId===privateDraft.value.id);assert.equal(verbal.method,'verbal');assert.equal(verbal.operatorId,organizer.id);
 // The generation lock orders revocation against a delegated write. Either the
 // complete write wins first, or it fails; no post-revocation partial write.
 const raceChanges=await f.changes(bob,w=>{w.maps.find(m=>m.ownerId===bob.id).nodes[0].summary='Racing change';});const race=await Promise.allSettled([f.command(bob,'revoke',{participantId:bob.id,expectedVersion:1}),f.command(organizer,'record',{participantId:bob.id,grantVersion:1,changes:raceChanges,method:'directed',attested:true})]);assert.equal(race[0].status,'fulfilled');await assert.rejects(()=>f.api(organizer).workspace(bob.id,1),/permission/);
 const privileges=(await f.db.query("select proname,has_function_privilege('anon',oid,'execute') or has_function_privilege('authenticated',oid,'execute') exposed from pg_proc where proname='harmonious_facilitate'")).rows;assert(privileges.length&&privileges.every(p=>!p.exposed));
 for(const role of ['anon','authenticated']){await f.db.exec('set role '+role);await assert.rejects(()=>f.db.query('select * from harmonious_facilitation_drafts'));await f.db.exec('reset role');}
}finally{await f.db.close();}
console.log('Facilitation permissions, private drafts, exact approval, actor attribution, direct edits, revoked/stale access, replay and PostgreSQL isolation passed.');
