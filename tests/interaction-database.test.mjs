import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {alice,bob,seedActor,view} from './accounts.test.mjs';
import {AccountError} from '../worker/account-policy.mjs';
import {exerciseInteractionGrammar} from './interaction-grammar.test.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {optionsForClassification} from '../dist/interaction-grammar.mjs';

const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); insert into auth.users(id) values('${alice.id}'),('${bob.id}');`);
for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
const privileges=(await db.query("select proname,prosecdef,has_function_privilege('authenticated',oid,'execute') exposed from pg_proc where proname like 'harmonious_interaction_%' or proname='harmonious_check_interaction'")).rows;
assert.equal(privileges.length,5);assert(privileges.every(p=>!p.prosecdef&&!p.exposed),'Grammar functions cannot elevate callers or become authenticated RPCs');
await db.exec('set role service_role');
for(const [type,keys] of [['node',['status','action','goal']],['edge',['reason','cause','addresses','enables','nesting','illustrative','related']]])for(const key of keys)for(const hasSource of [false,true]){
 const c={targetType:type,frame:type==='node'?key:null,edgeType:type==='edge'?key:null,hasSource,parentAction:null};
 const actual=(await db.query('select public.harmonious_interaction_options($1::jsonb,$2) options',[JSON.stringify(c),'dispute'])).rows[0].options;
 const idsAndSignals=options=>options.map(o=>({id:o.id,signal:o.signal||null}));
 assert.deepEqual(idsAndSignals(actual),idsAndSignals(optionsForClassification(c,'dispute')),'Every SQL menu and hidden tag agrees with the client grammar');
}
const store={async snapshot(){return (await db.query('select public.harmonious_snapshot() as data')).rows[0].data;},async commit(actor,generation,changes){try{return (await db.query('select public.harmonious_commit($1::uuid,$2::bigint,$3::jsonb) as data',[actor,generation,JSON.stringify(changes)])).rows[0].data;}catch(e){throw new AccountError(e.message,e.code==='PT409'?409:e.code==='PT403'?403:400);}}};
try{
 await seedActor(store,alice);await seedActor(store,bob);
 const fixtures=await exerciseInteractionGrammar(store,{database:true}),snapshot=await store.snapshot();
 const ws=(await view(store,alice)).workspace,fresh=makeDiscussion(ws,{kind:'interaction',action:'dispute',comparisonId:fixtures.thread.id,target:fixtures.refs.Bob,interaction:{mode:'argument',options:['false']}},alice.id);
 const direct=async(value,actor=alice.id)=>store.commit(actor,snapshot.revision,[{kind:'discussion',id:value.id,expectedRevision:0,value}]);
 const fork=patch=>({...structuredClone(fresh),id:crypto.randomUUID(),...patch});
 const signal=fork();signal.interaction.signals[0].tag='Logical';await assert.rejects(()=>direct(signal),/signals/);
 const wrongOption=fork();wrongOption.interaction.options=['unachievable'];wrongOption.interaction.signals=[{optionId:'unachievable',tag:'Factual'}];await assert.rejects(()=>direct(wrongOption),/options/);
 const wrongFrame=fork();wrongFrame.interaction.classification.frame='goal';wrongFrame.interaction.options=['unachievable'];wrongFrame.interaction.signals=[{optionId:'unachievable',tag:'Factual'}];await assert.rejects(()=>direct(wrongFrame),/classification/);
 const foreign=fork();foreign.interaction.recipientId=alice.id;await assert.rejects(()=>direct(foreign),/recipient/);
 await assert.rejects(()=>direct(fixtures.stale),/wording changed/);
 await assert.rejects(()=>direct(fixtures.staleEdge),/wording changed/);
 const response=structuredClone(fixtures.response);response.id=crypto.randomUUID();response.authorId=alice.id;response.interaction.recipientId=bob.id;await assert.rejects(()=>direct(response),/intended recipient/);
 const cited=structuredClone(fixtures.cited);cited.id=crypto.randomUUID();cited.interaction.reference.snapshot.wording.title='FORGED';await assert.rejects(()=>direct(cited),/snapshot changed/);
 assert.deepEqual(await store.snapshot(),snapshot,'Rejected direct writes must leave all records and revisions unchanged');
 await direct(fresh);
 const withdrawn=makeDiscussion((await view(store,alice)).workspace,{...fresh,status:'withdrawn'},alice.id,fresh),after=await store.snapshot();
 await store.commit(alice.id,after.revision,[{kind:'discussion',id:fresh.id,expectedRevision:1,value:withdrawn}]);
 console.log('Interaction database parity, restricted functions, hidden signals, recipients, type filtering, reference snapshots, and rejected-write atomicity passed.');
}finally{await db.close();}
