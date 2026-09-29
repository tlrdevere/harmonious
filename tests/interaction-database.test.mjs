import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {alice,bob,seedActor,view,edit} from './accounts.test.mjs';
import {AccountError} from '../worker/account-policy.mjs';
import {exerciseInteractionGrammar,exerciseArgumentReplies} from './interaction-grammar.test.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {optionsForClassification,makeInteraction} from '../dist/interaction-grammar.mjs';

const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); insert into auth.users(id) values('${alice.id}'),('${bob.id}');`);
for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
const privileges=(await db.query("select proname,prosecdef,has_function_privilege('authenticated',oid,'execute') or has_function_privilege('anon',oid,'execute') exposed from pg_proc where proname like 'harmonious_interaction_%' or proname in ('harmonious_check_interaction','harmonious_argument_options')")).rows;
assert.equal(privileges.length,6);assert(privileges.every(p=>!p.prosecdef&&!p.exposed),'Grammar functions cannot elevate callers or become authenticated RPCs');
await db.exec('set role service_role');
for(const [type,keys] of [['node',['status','action','goal']],['edge',['reason','cause','addresses','enables','nesting','illustrative','related']]])for(const key of keys)for(const hasSource of [false,true]){
 const c={targetType:type,frame:type==='node'?key:null,edgeType:type==='edge'?key:null,hasSource,parentAction:null};
 const actual=(await db.query('select public.harmonious_interaction_options($1::jsonb,$2) options',[JSON.stringify(c),'dispute'])).rows[0].options;
 const idsAndSignals=options=>options.map(o=>({id:o.id,signal:o.signal||null}));
 assert.deepEqual(idsAndSignals(actual),idsAndSignals(optionsForClassification(c,'dispute')),'Every SQL menu and hidden tag agrees with the client grammar');
 const current=(await db.query('select public.harmonious_argument_options($1::jsonb,$2,$3::jsonb) options',[JSON.stringify(c),'dispute','5'])).rows[0].options;
 assert.deepEqual(current,optionsForClassification(c,'dispute',5),'The four-category SQL and client catalogs match exactly');
}
const store={async snapshot(){return (await db.query('select public.harmonious_snapshot() as data')).rows[0].data;},async commit(actor,generation,changes){try{return (await db.query('select public.harmonious_commit($1::uuid,$2::bigint,$3::jsonb) as data',[actor,generation,JSON.stringify(changes)])).rows[0].data;}catch(e){throw new AccountError(e.message,e.code==='PT409'?409:e.code==='PT403'?403:400);}}};
try{
 await seedActor(store,alice);await seedActor(store,bob);
 const fixtures=await exerciseInteractionGrammar(store,{database:true});const replies=await exerciseArgumentReplies(store,fixtures),snapshot=await store.snapshot();
 const ws=(await view(store,alice)).workspace,fresh=makeDiscussion(ws,{kind:'interaction',action:'dispute',comparisonId:fixtures.thread.id,target:fixtures.refs.Bob,interaction:{mode:'argument',options:['factual_basis']}},alice.id);
 const direct=async(value,actor=alice.id)=>store.commit(actor,snapshot.revision,[{kind:'discussion',id:value.id,expectedRevision:0,value}]);
 const fork=patch=>({...structuredClone(fresh),id:crypto.randomUUID(),...patch});
 const signal=fork();signal.interaction.signals=[{optionId:'factual_basis',tag:'Logical'}];await assert.rejects(()=>direct(signal),/signals/);
 const wrongOption=fork();wrongOption.interaction.options=['unachievable'];wrongOption.interaction.signals=[{optionId:'unachievable',tag:'Factual'}];await assert.rejects(()=>direct(wrongOption),/options/);
 const wrongFrame=fork();wrongFrame.interaction.classification.frame='goal';await assert.rejects(()=>direct(wrongFrame),/classification/);
 const foreign=fork();foreign.interaction.recipientId=alice.id;await assert.rejects(()=>direct(foreign),/recipient/);
 const validReply=makeDiscussion((await view(store,alice)).workspace,{kind:'interaction',action:'respond',target:{type:'entry',entryId:fixtures.dispute.id},comparisonId:fixtures.thread.id,body:'A valid follow-up',interaction:{mode:'argument',options:['reply']}},alice.id);
 for(const body of ['', ' \t\n ']){const empty={...structuredClone(validReply),id:crypto.randomUUID(),body};await assert.rejects(()=>direct(empty),/Write a reply/);}
 const recipient=structuredClone(validReply);recipient.id=crypto.randomUUID();recipient.interaction.recipientId=alice.id;await assert.rejects(()=>direct(recipient),/recipient/);
 const inquiry=structuredClone(validReply);inquiry.id=crypto.randomUUID();inquiry.target.entryId=fixtures.request.id;await assert.rejects(()=>direct(inquiry),/classification|participants/);
 const nested=structuredClone(validReply);nested.id=crypto.randomUUID();nested.target.entryId=replies[2].id;await assert.rejects(()=>direct(nested),/classification|participants/);
 await assert.rejects(()=>direct(fixtures.stale),/wording changed/);
 await assert.rejects(()=>direct(fixtures.staleEdge),/wording changed/);
 const response=structuredClone(fixtures.response);response.id=crypto.randomUUID();response.authorId=alice.id;response.interaction.recipientId=bob.id;await assert.rejects(()=>direct(response),/intended recipient/);
 const cited=structuredClone(fixtures.cited);cited.id=crypto.randomUUID();cited.interaction.reference.snapshot.wording.title='FORGED';await assert.rejects(()=>direct(cited),/snapshot changed/);
 assert.deepEqual(await store.snapshot(),snapshot,'Rejected direct writes must leave all records and revisions unchanged');
 await direct(fresh);
 const withdrawn=makeDiscussion((await view(store,alice)).workspace,{...fresh,status:'withdrawn'},alice.id,fresh),after=await store.snapshot();
 await store.commit(alice.id,after.revision,[{kind:'discussion',id:fresh.id,expectedRevision:1,value:withdrawn}]);
 // Insert v4 fixtures as historical persisted data, then use current authoring.
 for(const convert of [false,true]){
  const w=(await view(store,alice)).workspace,legacy=makeDiscussion(w,{kind:'interaction',action:'dispute',comparisonId:fixtures.thread.id,target:fixtures.refs.Bob,body:'Original explanation',interaction:{mode:'argument',options:['reasoning']}},alice.id);
  legacy.interaction=makeInteraction(w,{...legacy,mode:'argument',options:['false','other'],otherText:'Original other concern'},alice.id,4);
  let snapshot=await store.snapshot();await store.commit(alice.id,snapshot.revision,[{kind:'discussion',id:legacy.id,expectedRevision:0,value:legacy}]);
  await edit(store,bob,ws=>ws.discussions.push(makeDiscussion(ws,{kind:'interaction',action:'respond',target:{type:'entry',entryId:legacy.id},comparisonId:fixtures.thread.id,interaction:{mode:'argument',options:['partly_accept']}},bob.id)));
  await edit(store,alice,ws=>{const old=ws.discussions.find(r=>r.id===legacy.id);const next=convert?makeDiscussion(ws,{...old,interaction:{...old.interaction,options:['consequences','feasibility']}},alice.id,old):makeDiscussion(ws,{...old,status:'withdrawn'},alice.id,old);ws.discussions=ws.discussions.map(r=>r.id===old.id?next:r);});
  const saved=(await view(store,alice)).workspace.discussions.find(r=>r.id===legacy.id);assert.deepEqual(saved.history.at(-1).interaction,legacy.interaction);assert.equal(saved.interaction.version,convert?5:4);
  if(convert){assert.deepEqual(saved.interaction.options,['consequences','feasibility']);assert.equal(saved.status,'active','A recipient response does not resolve the dispute');}
 }
 console.log('Interaction database parity, restricted functions, hidden signals, recipients, type filtering, reference snapshots, and rejected-write atomicity passed.');
}finally{await db.close();}
