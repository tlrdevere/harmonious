import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {alice,bob,memoryStore,seedActor,edit,view,addNode} from './accounts.test.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {standstillProposalMetadata,standstillEventMetadata,standstillState,standstillCounts} from '../dist/standstill.mjs';
import {synchronizeIdeas,createOwnedMap} from '../dist/adoption.mjs';
import {saveAccountChanges,startAccountComparison,handleAccountAPI,requiresStandstillCapability} from '../worker/account-api.mjs';
import {AccountError,projectAccountWorkspace,orderAccountChanges} from '../worker/account-policy.mjs';
import {accountKey} from '../dist/account-model.mjs';
const allCaps='comparison-reasoning-v1,comparison-adoption-v1,comparison-premise-v1,comparison-reflection-v1,interaction-grammar-v4,counterpart-integrity-v1,argument-categories-v1,argument-replies-v1,argument-dialogue-v1';
const outsider={id:'33333333-3333-4333-8333-333333333333',name:'Outside'};
const env={APP_ORIGIN:'https://harmonious.example',SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test',SUPABASE_SECRET_KEY:'server-test',SIGNUP_MODE:'public'};
async function exercise(store,direct=false){
 for(const actor of [alice,bob,outsider])await seedActor(store,actor);
 const refs={};
 for(const actor of [alice,bob])await edit(store,actor,ws=>{const m=ws.maps.find(m=>m.ownerId===actor.id);m.visibility='shared';const n=addNode(ws,actor,actor.name+' claim');n.parent='status';synchronizeIdeas(ws,m);refs[actor.name]={type:'node',mapId:m.id,nodeId:n.id};});
 const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:refs.Alice.mapId,bMapId:refs.Bob.mapId});
 const persist=async(actor,value)=>{const snapshot=await store.snapshot(),old=snapshot.records.find(r=>r.kind==='discussion'&&r.id===value.id);return saveAccountChanges(store,actor.id,[{kind:'discussion',id:value.id,expectedRevision:old?.revision||0,value}]);};
 const make=async(actor,input,old=null)=>makeDiscussion((await view(store,actor)).workspace,input,actor.id,old);
 const dispute=await make(alice,{kind:'interaction',action:'dispute',comparisonId:thread.id,target:refs.Bob,body:'The evidence does not settle the claim',interaction:{mode:'argument',options:['factual_basis']}});await persist(alice,dispute);
 const reply=await make(bob,{kind:'interaction',action:'respond',comparisonId:thread.id,target:{type:'entry',entryId:dispute.id},body:'This is the evidence I find persuasive',interaction:{mode:'argument',options:['reply'],replyTo:{entryId:dispute.id,version:dispute.version}}});await persist(bob,reply);
 const propose=async(actor,anchor=reply,old=null,body='Different standards of evidence prevent us moving forward')=>{const ws=(await view(store,actor)).workspace;return makeDiscussion(ws,{kind:'standstill',action:'propose_standstill',comparisonId:thread.id,target:refs.Bob,body,standstill:standstillProposalMetadata(ws,thread.id,anchor.id,old),...(old?{reviewSources:true}:{})},actor.id,old);};
 const event=async(actor,proposal,action,body='')=>{const ws=(await view(store,actor)).workspace;return makeDiscussion(ws,{kind:'standstill',action,comparisonId:thread.id,target:{type:'entry',entryId:proposal.id},body,standstill:standstillEventMetadata(ws,proposal)},actor.id);};
 const state=async p=>standstillState((await view(store,alice)).workspace,p.id);
 const maps=structuredClone((await view(store,alice)).workspace.maps);
 const p=await propose(alice),mirror=await propose(bob);const changes=[{kind:'discussion',id:p.id,expectedRevision:0,value:p}];await Promise.all([saveAccountChanges(store,alice.id,changes),persist(bob,mirror)]);await persist(alice,await event(alice,mirror,'resume_standstill'));const once=await store.snapshot();assert.equal((await saveAccountChanges(store,alice.id,changes)).replayed,true);assert.deepEqual(await store.snapshot(),once,'Lost acknowledgement replay writes nothing');
 assert.equal((await state(p)).state,'proposed');assert(requiresStandstillCapability([{kind:'reply',history:[p]}]));
 await assert.rejects(()=>propose(alice),/already|existing/);await assert.rejects(()=>event(alice,p,'confirm_standstill'),/other participant/);
 const early=await event(bob,p,'confirm_standstill');await persist(bob,early);assert.equal((await state(p)).state,'confirmed');
 const staleConfirm=await event(bob,p,'confirm_standstill'),suggest=await event(bob,p,'suggest_standstill','The relevant difference is how much evidence is enough');await persist(bob,suggest);assert.equal((await state(p)).state,'proposed');await assert.rejects(()=>persist(bob,staleConfirm),/sequence|changed/);
 const revised=await propose(alice,reply,p,'We disagree about how much evidence is enough');await persist(alice,revised);assert.equal((await state(p)).state,'proposed');
 const confirm=await event(bob,revised,'confirm_standstill'),staleEdit=await propose(alice,reply,revised,'Concurrent edited explanation');await persist(bob,confirm);assert.equal((await state(p)).state,'confirmed');await assert.rejects(()=>persist(alice,staleEdit),/sequence|changed/);
 const resume=await event(alice,revised,'resume_standstill'),competing=await event(bob,revised,'confirm_standstill');await persist(alice,resume);assert.equal((await state(p)).state,'resumed');await assert.rejects(()=>persist(bob,competing),/sequence|ended|changed/);
 const p2=await propose(alice);await persist(alice,p2);assert.notEqual(p2.id,p.id);assert.equal((await state(p2)).state,'proposed');const staleResume=await event(bob,p2,'resume_standstill');
 await edit(store,bob,ws=>{const m=ws.maps.find(m=>m.id===refs.Bob.mapId);m.nodes.find(n=>n.id===refs.Bob.nodeId).summary='Source wording has changed';synchronizeIdeas(ws,m);});assert.equal((await state(p2)).state,'needs_review');await assert.rejects(()=>persist(bob,staleResume),/changed|review/);if(direct){const snapshot=await store.snapshot();await assert.rejects(()=>store.commit(bob.id,snapshot.revision,[{kind:'discussion',id:staleResume.id,expectedRevision:0,value:staleResume}]),/context changed/);assert.deepEqual(await store.snapshot(),snapshot);}await assert.rejects(()=>event(bob,p2,'confirm_standstill'),/changed|review/);
 const resumeReview=await event(bob,p2,'resume_standstill');await persist(bob,resumeReview);assert.equal((await state(p2)).state,'resumed');
 const p3=await propose(alice);await persist(alice,p3);const oldReply=structuredClone(reply);await edit(store,bob,ws=>{const old=ws.discussions.find(r=>r.id===reply.id);ws.discussions=ws.discussions.map(r=>r.id===old.id?makeDiscussion(ws,{...old,body:'Clarified evidence'},bob.id,old):r);});assert.equal((await state(p3)).state,'needs_review');
 const renewed=await propose(alice,oldReply,p3,'The clarified evidence still leaves different thresholds');await persist(alice,renewed);assert.equal(renewed.standstill.anchor.version,1);assert.equal(renewed.standstill.reviewedAnchorVersion,2);await persist(bob,await event(bob,renewed,'confirm_standstill'));assert.equal((await state(p3)).state,'confirmed');
 const counts=standstillCounts((await view(store,bob)).workspace,thread.id,refs.Bob);assert.deepEqual(counts,{proposed:0,confirmed:1,needsReview:0,total:1});
 for(const method of ['GET','PUT']){const request=new Request(env.APP_ORIGIN+'/api/workspace',{method,headers:{'X-Harmonious-Capabilities':allCaps,Origin:env.APP_ORIGIN,...(method==='PUT'?{'content-type':'application/json'}:{})},...(method==='PUT'?{body:JSON.stringify({changes})}:{})});const res=await handleAccountAPI(request,env,{store,auth:{identify:async()=>({actor:alice,cookies:[]})}});assert.equal(res.status,409);assert.equal((await res.json()).requiredCapability,'argument-standstill-v1');}
 const capres=await handleAccountAPI(new Request(env.APP_ORIGIN+'/api/workspace',{headers:{'X-Harmonious-Capabilities':allCaps+',argument-standstill-v1'}}),env,{store,auth:{identify:async()=>({actor:alice,cookies:[]})}});assert.equal(capres.status,200);
 if(direct){
  const snapshot=await store.snapshot(),fresh=await propose(bob),send=async(value,actor=bob.id,expectedRevision=0)=>store.commit(actor,snapshot.revision,[{kind:'discussion',id:value.id,expectedRevision,value}]);
  for(const whitespace of ['\u00a0','\u1680','\u2000','\u2028','\u2029','\u202f','\u205f','\u3000','\ufeff'])for(const body of [whitespace,whitespace+'explanation','explanation'+whitespace]){const invalid={...structuredClone(fresh),body};await assert.rejects(()=>send(invalid),/Explain/);}
  for(const mutate of [r=>r.body=' \n ',r=>r.standstill.anchor.version=900,r=>r.standstill.reviewedAnchorVersion=900,r=>r.standstill.disputeId=reply.id,r=>r.target.nodeId='status',r=>r.sourceSnapshots[0].wording.title='FAKE',r=>r.standstill.version=2,r=>r.authorId=alice.id]){const forged=structuredClone(fresh);mutate(forged);await assert.rejects(()=>send(forged));}
  const validConfirmation=await event(bob,renewed,'confirm_standstill');const self=structuredClone(validConfirmation);self.authorId=alice.id;await assert.rejects(()=>send(self,alice.id),/other participant/);
  const missing=structuredClone(validConfirmation);missing.standstill.previous={entryId:'missing',version:1};await assert.rejects(()=>send(missing),/changed/);
  const forged=structuredClone(validConfirmation);forged.sourceSnapshots[0].wording.body='FAKE';await assert.rejects(()=>send(forged),/snapshot/);
  await assert.rejects(()=>send({...fresh,authorId:outsider.id},outsider.id),/participants/);
  const immutable={...structuredClone(confirm),body:'mutated'};await assert.rejects(()=>send(immutable,bob.id,snapshot.records.find(r=>r.id===confirm.id).revision),/receipt|edited/);
  const ownProfile=snapshot.records.find(r=>r.kind==='profile'&&r.id===bob.id);await assert.rejects(()=>store.commit(bob.id,snapshot.revision,[{kind:'profile',id:bob.id,expectedRevision:ownProfile.revision,value:{...ownProfile.value,name:'Must roll back'}},{kind:'discussion',id:forged.id,expectedRevision:0,value:forged}]));
  assert.deepEqual(await store.snapshot(),snapshot,'Rejected direct writes and mixed batches leave every row and generation intact');
 }
 await edit(store,alice,ws=>{const old=ws.discussions.find(r=>r.id===dispute.id);ws.discussions=ws.discussions.map(r=>r.id===old.id?makeDiscussion(ws,{...old,status:'withdrawn'},alice.id,old):r);});assert.equal((await state(p3)).state,'unavailable');await assert.rejects(()=>event(bob,renewed,'resume_standstill'),/available/);
 await edit(store,alice,ws=>{const old=ws.discussions.find(r=>r.id===p3.id);const next=makeDiscussion(ws,{...old,status:'withdrawn',standstill:standstillProposalMetadata(ws,thread.id,reply.id,old,{withdraw:true})},alice.id,old);ws.discussions=ws.discussions.map(r=>r.id===old.id?next:r);});assert.equal((await state(p3)).state,'withdrawn');
 assert.deepEqual((await view(store,alice)).workspace.maps.find(m=>m.id===refs.Alice.mapId),maps.find(m=>m.id===refs.Alice.mapId),'Standstill never alters personal source maps');
 // Closure must suppress every former confirmation if an anchor or its history
 // contains a reference which has become private.
 const hiddenSnapshot=await store.snapshot(),record=hiddenSnapshot.records.find(r=>r.id===reply.id),privateMap=hiddenSnapshot.records.find(r=>r.kind==='map'&&r.ownerId===outsider.id);
 record.value.interaction.reference={target:{type:'node',mapId:privateMap.id,nodeId:'status'},snapshot:{label:'HIDDEN ANCHOR SECRET'}};
 const visible=projectAccountWorkspace(hiddenSnapshot,alice.id).workspace;assert(!visible.discussions.some(r=>r.kind==='standstill'),'No previous confirmed badge survives hidden anchor state');assert(!JSON.stringify(visible).includes('HIDDEN ANCHOR SECRET'));
 const causalSnapshot=await store.snapshot();causalSnapshot.records.find(r=>r.id===suggest.id).value.history=[{interaction:{reference:{target:{type:'node',mapId:privateMap.id,nodeId:'status'}}}}];
 assert(!projectAccountWorkspace(causalSnapshot,alice.id).workspace.discussions.some(r=>r.id===p.id||r.target?.entryId===p.id),'A hidden successor never falls back to earlier confirmation');
 const ordered=orderAccountChanges([{kind:'discussion',id:p.id,value:p},{kind:'discussion',id:reply.id,value:reply},{kind:'discussion',id:dispute.id,value:dispute}]);assert.deepEqual(ordered.map(c=>c.id),[dispute.id,reply.id,p.id]);
}
await exercise(memoryStore());
const db=new PGlite();
try{
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);');
 await db.query('insert into auth.users(id) values($1),($2),($3)',[alice.id,bob.id,outsider.id]);
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 const privileges=(await db.query("select proname,prosecdef,has_function_privilege('authenticated',oid,'execute') or has_function_privilege('anon',oid,'execute') exposed from pg_proc where proname like 'harmonious_standstill_%' or proname='harmonious_check_standstill'")).rows;assert.equal(privileges.length,3);assert(privileges.every(p=>!p.prosecdef&&!p.exposed));
 await db.exec('set role service_role');
 const store={async snapshot(){return (await db.query('select public.harmonious_snapshot() as data')).rows[0].data;},async commit(actor,generation,changes){try{return (await db.query('select public.harmonious_commit($1::uuid,$2::bigint,$3::jsonb) as data',[actor,generation,JSON.stringify(changes)])).rows[0].data;}catch(e){const error=new AccountError(e.message,e.code==='PT409'?409:e.code==='PT403'?403:400);error.snapshotChanged=e.message==='snapshot_changed';throw error;}}};
 await exercise(store,true);
 for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await assert.rejects(()=>db.query('select public.harmonious_standstill_head($1)',['any']),e=>e.code==='42501');await assert.rejects(()=>db.query('select * from public.harmonious_records'),e=>e.code==='42501');await db.exec('reset role');}
}finally{await db.close();}
console.log('Standstill memory/PostgreSQL lifecycle, strict permissions, causal races, source renewal, terminal history, privacy closure, capability and lost-ack replay passed.');
