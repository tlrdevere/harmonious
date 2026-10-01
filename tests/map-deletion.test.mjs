import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {alice,bob,memoryStore,seedActor,edit,view,addNode} from './accounts.test.mjs';
import {deleteAccountMap,saveAccountChanges,startAccountComparison,accountWorkspace,handleAccountAPI} from '../worker/account-api.mjs';
import {AccountError,validateAccountChanges} from '../worker/account-policy.mjs';
import {validateWorkspace} from '../dist/workspace.mjs';
import {accountKey} from '../dist/account-model.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {createOwnedMap} from '../dist/adoption.mjs';

async function exercise(store,direct=false){
 for(const actor of [alice,bob])await seedActor(store,actor);
 let source,node;
 await edit(store,alice,w=>{source=w.maps[0];source.visibility='shared';node=addNode(w,alice,'Original source claim');});
 const b=(await view(store,bob)).workspace.maps.find(m=>m.ownerId===bob.id);
 let copyId;
 await edit(store,bob,w=>{const copy=createOwnedMap(w,{name:'Independent copy',ownerId:bob.id,personName:bob.name,fromMapId:source.id});copy.visibility='private';copyId=copy.id;});
 const {comparisonThread:thread}=await startAccountComparison(store,bob.id,{aMapId:source.id,bMapId:b.id});
 let snapshot=await store.snapshot(),record=snapshot.records.find(r=>r.id===source.id);
 const input={id:source.id,expectedRevision:record.revision};
 const env={APP_ORIGIN:'https://harmonious.example',SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test',SUPABASE_SECRET_KEY:'server-test',SIGNUP_MODE:'public'};
 const api=(actor,path,body,extra={})=>handleAccountAPI(new Request(env.APP_ORIGIN+path,{method:body?'POST':'GET',headers:{origin:env.APP_ORIGIN,'content-type':'application/json',...extra},...(body?{body:JSON.stringify(body)}:{})}),env,{store,auth:{identify:async()=>({actor,cookies:[]})}});
 assert.equal((await api(null,'/api/maps/delete',input)).status,401);
 assert.equal((await api(bob,'/api/maps/delete',input)).status,403);
 assert.equal((await api(alice,'/api/maps/delete',input,{'X-Harmonious-Participant':bob.id,'X-Harmonious-Capabilities':'facilitation-v1'})).status,403);
 assert.equal((await api(alice,'/api/maps/delete',input,{origin:'https://foreign.example'})).status,403);
 await assert.rejects(()=>deleteAccountMap(store,bob,input),e=>e.status===403);
 await assert.rejects(()=>deleteAccountMap(store,alice,{...input,expectedRevision:record.revision-1}),e=>e.status===409);
 const tombstone={...record.value,visibility:'private',deletedAt:new Date().toISOString()};
 assert.throws(()=>validateAccountChanges(snapshot,alice.id,[{kind:'map',id:source.id,expectedRevision:record.revision,value:tombstone}]),/Delete map/);
 const dispute=makeDiscussion((await view(store,bob)).workspace,{kind:'interaction',action:'dispute',comparisonId:thread.id,target:{type:'node',mapId:source.id,nodeId:node.id},body:'Earlier factual question',interaction:{mode:'argument',options:['factual_basis']}},bob.id);
 await saveAccountChanges(store,bob.id,[{kind:'discussion',id:dispute.id,expectedRevision:0,value:dispute}]);
 snapshot=await store.snapshot();
 const result=await deleteAccountMap(store,alice,input);
 assert.equal(result.workspace.maps.length,0,'Deleting the last owned map leaves an empty library');
 validateWorkspace(result.workspace);
 assert.equal((await accountWorkspace(store,alice)).workspace.maps.length,0,'Opening the account does not recreate a default map');
 const after=await store.snapshot(),deleted=after.records.find(r=>r.id===source.id);
 assert.equal((await api(alice,'/api/workspace')).status,409,'Older clients receive an update message for an empty library');
 assert.equal((await api(alice,'/api/workspace',null,{'X-Harmonious-Capabilities':'map-deletion-v1'})).status,200);
 assert(deleted.value.deletedAt);assert.equal(deleted.value.visibility,'private');
 assert.deepEqual(after.records.filter(r=>r.id!==source.id),snapshot.records.filter(r=>r.id!==source.id),'Others’ records and saved history remain unchanged');
 await deleteAccountMap(store,alice,input);assert.deepEqual(await store.snapshot(),after,'Retrying a successful delete is idempotent');
 const bv=await view(store,bob),stub=bv.workspace.maps.find(m=>m.id===source.id);
 assert(stub.unavailable);assert.equal(stub.name,'Unavailable source map');
 assert(!JSON.stringify(stub).includes('Original source claim'),'The deleted source is redacted even when an independent copy survives');
 assert(!bv.workspace.discussions.some(d=>d.id===dispute.id));
 assert(bv.workspace.maps.find(m=>m.id===copyId).nodes.some(n=>n.title==='Original source claim'),'An independent copy survives');
 await edit(store,bob,w=>{w.maps.find(m=>m.id===copyId).name='Copy still editable';});
 await assert.rejects(()=>startAccountComparison(store,alice.id,{aMapId:source.id,bMapId:b.id}),e=>e.status===403);
 for(const expectedRevision of [record.revision,deleted.revision])await assert.rejects(()=>saveAccountChanges(store,alice.id,[{kind:'map',id:source.id,expectedRevision,value:record.value}]),e=>e.status===409);
 await assert.rejects(()=>saveAccountChanges(store,bob.id,[{kind:'discussion',id:'later-dispute',expectedRevision:0,value:{...dispute,id:'later-dispute'}}]),/deleted/);
 if(direct){
  const generation=(await store.snapshot()).revision;
  await assert.rejects(()=>store.commit(alice.id,generation,[{kind:'map',id:source.id,expectedRevision:deleted.revision,value:record.value}]),/deleted/);
  await assert.rejects(()=>store.commit(bob.id,generation,[{kind:'discussion',id:'direct-dispute',expectedRevision:0,value:{...dispute,id:'direct-dispute'}}]),/deleted|available/);
  const other=after.records.find(r=>r.id===b.id),forged={...other.value,visibility:'private',deletedAt:new Date().toISOString()};
  await assert.rejects(()=>store.commit(alice.id,generation,[{kind:'map',id:b.id,expectedRevision:other.revision,value:forged}]),e=>e.status===403);
 }
 await edit(store,alice,w=>{const map=createOwnedMap(w,{name:'New start',ownerId:alice.id,personName:alice.name,mapType:'personal'});map.visibility='private';});
 assert((await view(store,alice)).workspace.maps.some(m=>m.name==='New start'),'Creating a map after deleting the last map works');
}
await exercise(memoryStore());
const db=new PGlite();
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${alice.id}'),('${bob.id}');`);
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 await db.exec('set role service_role');
 const store={
  async snapshot(){return (await db.query('select public.harmonious_snapshot() as data')).rows[0].data;},
  async commit(actor,generation,changes){try{return (await db.query('select public.harmonious_commit($1::uuid,$2::bigint,$3::jsonb) as data',[actor,generation,JSON.stringify(changes)])).rows[0].data;}catch(e){const error=new AccountError(e.message,e.code==='PT409'?409:e.code==='PT403'?403:400);error.snapshotChanged=e.message==='snapshot_changed';throw error;}}
 };
 await exercise(store,true);
 const permissions=(await db.query("select prosecdef,proconfig,has_function_privilege('anon',oid,'execute') as anon,has_function_privilege('authenticated',oid,'execute') as authenticated from pg_proc where proname='harmonious_check_map_deletion'")).rows[0];
 assert(!permissions.prosecdef&&!permissions.anon&&!permissions.authenticated);
}finally{await db.close();}
console.log('Map deletion: ownership, history, last map, stale saves, retries and database enforcement passed.');
