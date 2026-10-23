import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {fixture,alice,bob,organizer,outsider} from './facilitation-fixture.mjs';
import {seedActor,edit,addNode,view} from './accounts.test.mjs';
import {saveAccountChanges,startAccountComparison} from '../worker/account-api.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {counterpartUnlinkInput} from '../dist/counterparts.mjs';
import {standstillProposalMetadata,standstillEventMetadata} from '../dist/standstill.mjs';
import {endorseNodes,withdrawEndorsement,synchronizeIdeas} from '../dist/adoption.mjs';
import {activityEventForChange} from '../worker/activity-events.mjs';

const migration='20261023223219_activity_notifications.sql';
async function prepare(store){
 const refs={};
 for(const actor of [alice,bob])await edit(store,actor,ws=>{const m=ws.maps.find(m=>m.ownerId===actor.id);m.visibility='shared';const n=addNode(ws,actor,actor.name+' claim');n.parent='status';synchronizeIdeas(ws,m);refs[actor.name]={type:'node',mapId:m.id,nodeId:n.id};});
 const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:refs.Alice.mapId,bMapId:refs.Bob.mapId});
 const build=async(actor,input,old=null)=>makeDiscussion((await view(store,actor)).workspace,{comparisonId:thread.id,...input},actor.id,old);
 const change=async value=>({kind:'discussion',id:value.id,expectedRevision:(await store.snapshot()).records.find(r=>r.kind==='discussion'&&r.id===value.id)?.revision||0,value});
 const persist=async(actor,input,old=null)=>{const value=await build(actor,input,old);await saveAccountChanges(store,actor.id,[await change(value)]);return value;};
 return {refs,thread,build,change,persist};
}

// Existing canonical history stays history: applying the migration itself emits
// no inbox rows. A later deliberate edit of that record can emit one event.
const oldDb=new PGlite();
try{
 await oldDb.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);');
 await oldDb.query('insert into auth.users values($1),($2)',[alice.id,bob.id]);
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&f<migration).sort())await oldDb.exec(await readFile('supabase/migrations/'+file,'utf8'));
 await oldDb.exec('set role service_role');
 const call=async(sql,args=[])=>((await oldDb.query(sql,args)).rows[0].data);
 const store={snapshot:()=>call('select harmonious_snapshot() data'),commit:(a,g,c)=>call('select harmonious_commit($1,$2,$3) data',[a,g,JSON.stringify(c)])};
 await seedActor(store,alice);await seedActor(store,bob);const p=await prepare(store);
 const original=await p.persist(alice,{kind:'interaction',action:'dispute',target:p.refs.Bob,body:'Historical dispute',interaction:{mode:'argument',options:['reasoning']}});
 const before=await store.snapshot();await oldDb.exec('reset role');await oldDb.exec(await readFile('supabase/migrations/'+migration,'utf8'));await oldDb.exec('set role service_role');
 assert.deepEqual(await store.snapshot(),before,'Additive installation never rewrites content or generation');
 assert.equal((await call('select harmonious_activity($1,$2,$3) data',[bob.id,'snapshot','{}'])).events.length,0,'No historical notification backfill');
 await p.persist(alice,{...original,body:'Published clarification after rollout'},original);
 assert.equal((await call('select harmonious_activity($1,$2,$3) data',[bob.id,'snapshot','{}'])).events[0].eventType,'interaction_changed');
}finally{await oldDb.close();}

const f=await fixture();
try{
 const activity=async(actor,command='snapshot',input={})=>(await f.db.query('select harmonious_activity($1,$2,$3) data',[actor.id,command,JSON.stringify(input)])).rows[0].data;
 const state=actor=>activity(actor),events=async actor=>(await state(actor)).events;
 const command=async(actor,type,input)=>activity(actor,type,{generation:(await f.store.snapshot()).revision,...input});
 const allEvents=async()=>{const all=[];for(const actor of [alice,bob,organizer,outsider])all.push(...(await events(actor)).map(e=>({...e,recipientId:actor.id})));return all;};
 const comparable=e=>Object.fromEntries(['recordKind','recordId','revision','eventType','authorId','recipientId','recorderId','comparisonId','sourceMapId'].map(k=>[k,e[k]??null]));
 const ordered=rows=>rows.map(comparable).sort((a,b)=>(a.recordId+'-'+a.revision).localeCompare(b.recordId+'-'+b.revision));
 // Every successful direct/facilitated write below compares the independent SQL
 // trigger with the fixture classifier, including intentionally silent writes.
 for(const method of ['commit','facilitate']){
  const original=f.store[method];f.store[method]=async(...args)=>{
   const before=await f.store.snapshot(),beforeIds=new Set((await allEvents()).map(e=>e.id));
   const result=await original(...args),after=await f.store.snapshot(),expected=[];
   for(const row of after.records){const old=before.records.find(r=>r.kind===row.kind&&r.id===row.id);if(old?.revision===row.revision)continue;
    const receipt=after.facilitationHistory?.find(r=>r.kind===row.kind&&r.recordId===row.id&&r.revision===row.revision);
    const recorderId=receipt?.enteredBy||receipt?.operatorId||null,event=activityEventForChange(after,old,row,{recorderId});if(event)expected.push(event);
   }
   assert.deepEqual(ordered((await allEvents()).filter(e=>!beforeIds.has(e.id))),ordered(expected),'PostgreSQL and memory publication policy agree');return result;
  };
 }
 const p=await prepare(f.store),{refs,thread,persist,build,change}=p;
 assert.equal((await events(alice)).length,0);assert.equal((await events(bob)).length,0);
 const agree=await persist(alice,{kind:'interaction',action:'endorse',target:refs.Bob,body:'Agree',interaction:{mode:'compare',options:[]}});
 let inbox=await state(bob);assert.equal(inbox.events.length,1);assert.equal(inbox.events[0].eventType,'agree');assert.equal(inbox.events[0].authorId,alice.id);assert.equal(inbox.events[0].recorderId,null);assert.equal(inbox.events[0].sourceMapId,refs.Bob.mapId);assert.equal(inbox.events[0].comparisonId,thread.id);assert.equal(inbox.events[0].read,false);assert.equal(inbox.events[0].suppressed,false);assert.equal((await events(alice)).length,0,'No self notification');
 const first=inbox.events[0];assert.match(first.id,/^[1-9][0-9]*$/);assert(!JSON.stringify(first).includes('body'),'Events contain identifiers, never source/body snapshots');
 const replay=[{kind:'discussion',id:agree.id,expectedRevision:0,value:agree}];assert.equal((await saveAccountChanges(f.store,alice.id,replay)).replayed,true);assert.deepEqual((await state(bob)).events,inbox.events,'Lost save acknowledgement cannot duplicate activity');
 const equivalent=await persist(alice,{...agree},agree);assert.equal((await events(bob)).length,1,'History/version/timestamp-only saves create no noise');
 const referenced=await persist(alice,{kind:'interaction',action:'request_reason',target:refs.Bob,body:'Question with a reference',interaction:{mode:'inquiry',options:['source'],reference:refs.Alice}}),referenceCount=(await events(bob)).length;
 await edit(f.store,alice,ws=>{const m=ws.maps.find(m=>m.id===refs.Alice.mapId);m.nodes.find(n=>n.id===refs.Alice.nodeId).summary='Updated reference wording';synchronizeIdeas(ws,m);});
 await persist(alice,{...referenced},referenced);assert.equal((await events(bob)).length,referenceCount,'Refreshing the same reference snapshot creates no activity');
 const changed=await persist(alice,{...equivalent,body:'Agree for a clarified reason'},equivalent);assert.equal((await events(bob))[0].eventType,'interaction_changed');
 await persist(alice,{...changed,status:'withdrawn'},changed);assert.equal((await events(bob))[0].eventType,'interaction_withdrawn');
 for(const [action,eventType,options] of [['disagree','disagree',[]],['decline','no_position',['need_information']],['request_reason','inquiry',['source']]]){const r=await persist(alice,{kind:'interaction',action,target:refs.Bob,body:'Recorded '+action,interaction:{mode:action==='request_reason'?'inquiry':'compare',options}});assert.equal((await events(bob)).find(e=>e.recordId===r.id).eventType,eventType);}
 const dispute=await persist(alice,{kind:'interaction',action:'dispute',target:refs.Bob,body:'Dispute the factual basis',interaction:{mode:'argument',options:['factual_basis']}});
 const reply=await persist(bob,{kind:'interaction',action:'respond',target:{type:'entry',entryId:dispute.id},body:'Evidence supplied in response',interaction:{mode:'argument',options:['reply'],replyTo:{entryId:dispute.id,version:1}}});
 assert.equal((await events(alice)).find(e=>e.recordId===reply.id).eventType,'respond');assert.equal((await events(alice)).find(e=>e.recordId===reply.id).sourceMapId,refs.Bob.mapId);
 const request=await persist(alice,{kind:'counterpart',action:'counterpart',target:refs.Alice});assert.equal((await events(bob)).find(e=>e.recordId===request.id).eventType,'counterpart_requested');
 const link=await persist(alice,{kind:'correspondence',action:'counterpart_link',target:refs.Alice,other:refs.Bob});assert.equal((await events(bob)).find(e=>e.recordId===link.id).eventType,'counterpart_linked');
 const unlink=await persist(bob,counterpartUnlinkInput((await view(f.store,bob)).workspace,thread.id,refs.Alice,refs.Bob));assert.equal((await events(alice)).find(e=>e.recordId===unlink.id).eventType,'counterpart_unlinked');
 const propose=async(body,old=null)=>persist(alice,{kind:'standstill',action:'propose_standstill',target:refs.Bob,body,standstill:standstillProposalMetadata((await view(f.store,alice)).workspace,thread.id,reply.id,old)},old);
 const standstillEvent=async(actor,proposal,action,body='')=>persist(actor,{kind:'standstill',action,target:{type:'entry',entryId:proposal.id},body,standstill:standstillEventMetadata((await view(f.store,actor)).workspace,proposal)});
 let proposal=await propose('Different evidence standards prevent progress');assert.equal((await events(bob)).find(e=>e.recordId===proposal.id).eventType,'standstill_proposed');
 const suggestion=await standstillEvent(bob,proposal,'suggest_standstill','Clarify the standards');assert.equal((await events(alice)).find(e=>e.recordId===suggestion.id).eventType,'standstill_suggested');
 proposal=await propose('Our thresholds for sufficient evidence differ',proposal);assert.equal((await events(bob))[0].eventType,'standstill_changed');
 const confirmation=await standstillEvent(bob,proposal,'confirm_standstill');assert.equal((await events(alice)).find(e=>e.recordId===confirmation.id).eventType,'standstill_confirmed');
 const resumed=await standstillEvent(alice,proposal,'resume_standstill');assert.equal((await events(bob)).find(e=>e.recordId===resumed.id).eventType,'standstill_resumed');
 const secondProposal=await propose('We still need to establish the threshold');await persist(alice,{...secondProposal,status:'withdrawn',standstill:standstillProposalMetadata((await view(f.store,alice)).workspace,thread.id,reply.id,secondProposal,{withdraw:true})},secondProposal);assert.equal((await events(bob))[0].eventType,'standstill_withdrawn');

 // A whole section co-sign remains one event; private destination changes,
 // withdrawal and the source author's own co-sign create no extra notifications.
 let cosign;await edit(f.store,bob,ws=>{cosign=endorseNodes(ws,{participantId:bob.id,sourceMapId:refs.Alice.mapId,nodeIds:[refs.Alice.nodeId],scope:'section',anchorId:refs.Alice.nodeId});cosign.method='authenticated';});
 assert.equal((await events(alice)).filter(e=>e.recordId===cosign.id).length,1);assert.equal((await events(alice))[0].eventType,'cosigned');
 const cosignCount=(await events(alice)).length;await edit(f.store,bob,ws=>withdrawEndorsement(ws,cosign.id,bob.id));await edit(f.store,alice,ws=>{endorseNodes(ws,{participantId:alice.id,sourceMapId:refs.Alice.mapId,nodeIds:[refs.Alice.nodeId],anchorId:refs.Alice.nodeId}).method='authenticated';});assert.equal((await events(alice)).length,cosignCount);

 // Explicit IDs, not a sequence cutoff, make later arrivals and lost-response
 // retries safe. Inbox read and mute state never changes workspace generation.
 const beforeRead=await f.store.snapshot(),oldInbox=await state(bob),oldIds=oldInbox.events.map(e=>e.id);
 await command(bob,'read',{ids:[first.id,first.id],read:true});await command(bob,'read',{ids:[first.id],read:true});assert.equal((await events(bob)).find(e=>e.id===first.id).read,true);assert.deepEqual(await f.store.snapshot(),beforeRead);
 await assert.rejects(()=>command(alice,'read',{ids:[first.id],read:true}),e=>e.code==='PT403');await assert.rejects(()=>command(bob,'read',{ids:[first.id,'999999999'],read:true}),e=>e.code==='PT403');await assert.rejects(()=>command(bob,'read',{ids:Array(201).fill(first.id),read:true}),e=>e.code==='PT400');
 for(const ids of [[1],['0'],['1 OR true'],['9223372036854775808'],[]])await assert.rejects(()=>command(bob,'read',{ids,read:true}),e=>e.code==='PT400');
 const arrival=await persist(alice,{kind:'interaction',action:'request_explanation',target:refs.Bob,body:'Please clarify',interaction:{mode:'inquiry',options:['scope']}});
 await assert.rejects(()=>activity(bob,'read',{generation:oldInbox.revision,ids:oldIds,read:true}),e=>e.code==='PT409');await command(bob,'read',{ids:oldIds,read:true});assert.equal((await events(bob)).find(e=>e.recordId===arrival.id).read,false,'New arrivals remain unread');
 await command(bob,'mute',{comparisonId:thread.id,muted:true});assert.deepEqual((await state(bob)).mutes,[thread.id]);assert.equal((await events(bob)).find(e=>e.recordId===arrival.id).read,false,'Muting does not clear existing unread');
 const muted=await persist(alice,{kind:'interaction',action:'request_reason',target:refs.Bob,body:'A muted request',interaction:{mode:'inquiry',options:['reason']}});let mutedEvent=(await events(bob)).find(e=>e.recordId===muted.id);assert.equal(mutedEvent.suppressed,true);assert.equal(mutedEvent.read,false);
 await command(bob,'mute',{comparisonId:thread.id,muted:false});assert.deepEqual((await state(bob)).mutes,[]);assert.equal((await events(bob)).find(e=>e.id===mutedEvent.id).suppressed,true,'Unmuting does not replay suppressed events');
 await command(bob,'read',{ids:[mutedEvent.id],read:false});mutedEvent=(await events(bob)).find(e=>e.id===mutedEvent.id);assert.equal(mutedEvent.suppressed,false,'An explicit mark-unread overrides suppression');
 await assert.rejects(()=>command(outsider,'mute',{comparisonId:thread.id,muted:true}),e=>e.code==='PT403');

 // Rejecting the tail of a mixed canonical batch rolls its earlier activity and
 // record changes back. Stale generation failures similarly publish nothing.
 const invalid=await build(alice,{kind:'interaction',action:'request_reason',target:refs.Bob,body:'Must never publish',interaction:{mode:'inquiry',options:['reason']}}),invalidSecond=structuredClone(invalid);invalidSecond.id=crypto.randomUUID();invalidSecond.interaction.recipientId=alice.id;
 const beforeFailure=await state(bob),invalidChanges=[await change(invalid),await change(invalidSecond)];await assert.rejects(()=>f.store.commit(alice.id,beforeFailure.revision,invalidChanges));assert.deepEqual(await state(bob),beforeFailure);
 await assert.rejects(()=>f.store.commit(alice.id,beforeFailure.revision-1,[invalidChanges[0]]));assert.deepEqual(await state(bob),beforeFailure);

 // Directed and approved records share the same transactional hook. Validation
 // of private drafts must not leak events, even though it executes the core save.
 await f.command(organizer,'grant',{participantId:alice.id,expectedVersion:0,attested:true});
 const assisted=await build(alice,{kind:'interaction',action:'dispute',target:refs.Bob,body:'Private facilitator draft',interaction:{mode:'argument',options:['feasibility']}}),ctx={participantId:alice.id,grantVersion:1},draftInput={...ctx,changes:[await change(assisted)],operationId:crypto.randomUUID()};
 const draftBefore=await events(bob),draft=await f.api(organizer).command('draft',draftInput);assert.deepEqual(await events(bob),draftBefore,'Rolled-back draft validation produces no events');assert.equal((await events(organizer)).length,0);
 const approved=await f.command(alice,'approve',{...ctx,draftId:draft.draftId,draftVersion:1});assert(approved.saved);let assistedEvent=(await events(bob)).find(e=>e.recordId===assisted.id);assert.equal(assistedEvent.authorId,alice.id);assert.equal(assistedEvent.recorderId,organizer.id,'Participant approval preserves the original recorder');
 const directed=await build(alice,{kind:'interaction',action:'request_reason',target:refs.Bob,body:'Directed contribution',interaction:{mode:'inquiry',options:['reason']}}),directedInput={...ctx,changes:[await change(directed)],attested:true,method:'directed',operationId:crypto.randomUUID()};
 await f.api(organizer).command('record',directedInput);assert((await f.api(organizer).command('record',directedInput)).replayed);assistedEvent=(await events(bob)).filter(e=>e.recordId===directed.id);assert.equal(assistedEvent.length,1);assert.equal(assistedEvent[0].recorderId,organizer.id);assert.equal((await events(organizer)).length,0,'The recorder receives no duplicate participant inbox');
 const abandoned=await build(alice,{kind:'interaction',action:'dispute',target:refs.Bob,body:'Unapproved and then declined',interaction:{mode:'argument',options:['consequences']}}),abandonedDraft=await f.command(organizer,'draft',{...ctx,changes:[await change(abandoned)]});await f.command(alice,'decline',{...ctx,draftId:abandonedDraft.draftId,draftVersion:1});assert(!(await events(bob)).some(e=>e.recordId===abandoned.id));
 const snapshots=[await events(alice),await events(bob)];await edit(f.store,alice,ws=>{ws.maps.find(m=>m.id===refs.Alice.mapId).visibility='private';});await edit(f.store,alice,ws=>{ws.maps.find(m=>m.id===refs.Alice.mapId).visibility='shared';});assert.deepEqual([await events(alice),await events(bob)],snapshots,'Sharing changes create no event and do not reset saved read state');
 const finalEvents=await events(bob);assert(finalEvents.every((e,i)=>i===0||BigInt(finalEvents[i-1].id)>BigInt(e.id)),'Stable server order despite sequence gaps from rollback');
 assert((await f.db.query("select relrowsecurity from pg_class where relname in ('harmonious_activity_events','harmonious_activity_recipients','harmonious_activity_mutes')")).rows.every(r=>r.relrowsecurity));
 const permissions=(await f.db.query("select proname,prosecdef,has_function_privilege('anon',oid,'execute') or has_function_privilege('authenticated',oid,'execute') exposed from pg_proc where proname in ('harmonious_activity','harmonious_record_activity','harmonious_activity_interaction_content')")).rows;assert.equal(permissions.length,3);assert(permissions.every(r=>!r.prosecdef&&!r.exposed));
 for(const role of ['anon','authenticated']){await f.db.exec('set role '+role);await assert.rejects(()=>f.db.query('select harmonious_activity($1,$2,$3)',[alice.id,'snapshot','{}']),e=>e.code==='42501');for(const table of ['harmonious_activity_events','harmonious_activity_recipients','harmonious_activity_mutes'])await assert.rejects(()=>f.db.query('select * from '+table),e=>e.code==='42501');await f.db.exec('reset role');}
}finally{await f.db.close();}
console.log('Activity PostgreSQL migration, transactional publication, recipients, replay, no backfill, facilitator drafts/approval, mute/read state, generation races and service-only privileges passed.');
