import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {exerciseAccounts,alice,bob} from './accounts.test.mjs';
import {AccountError} from '../worker/account-policy.mjs';

const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); insert into auth.users(id) values('${alice.id}'),('${bob.id}');`);
await db.exec(await readFile('supabase/migrations/20260908233252_harmonious_accounts.sql','utf8'));
assert((await db.query("select prosecdef from pg_proc where proname in ('harmonious_snapshot','harmonious_commit')")).rows.every(row=>!row.prosecdef),'Application RPCs must not elevate the caller\'s privileges');
await db.exec('set role service_role');
const store={
  async snapshot(){return (await db.query('select public.harmonious_snapshot() as data')).rows[0].data;},
  async commit(actor,generation,changes){try{return (await db.query('select public.harmonious_commit($1::uuid,$2::bigint,$3::jsonb) as data',[actor,generation,JSON.stringify(changes)])).rows[0].data;}catch(e){const error=new AccountError(e.message,e.code==='PT409'?409:e.code==='PT403'?403:400);error.snapshotChanged=e.message==='snapshot_changed';throw error;}}
};
await exerciseAccounts(store);
const before=await store.snapshot(),owned=before.records.find(r=>r.kind==='map'&&r.ownerId===alice.id),other=before.records.find(r=>r.kind==='map'&&r.ownerId===bob.id);
await assert.rejects(()=>store.commit(alice.id,before.revision,[{kind:'map',id:owned.id,expectedRevision:owned.revision,value:{...owned.value,name:'Must roll back'}},{kind:'map',id:other.id,expectedRevision:other.revision,value:{...other.value,name:'Forbidden'}}]),e=>e.status===403);
assert.deepEqual(await store.snapshot(),before,'Partial batches must roll back');
await assert.rejects(()=>store.commit(alice.id,before.revision-1,[{kind:'map',id:owned.id,expectedRevision:owned.revision,value:owned.value}]),e=>e.snapshotChanged);
for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);
  await assert.rejects(()=>db.query('select * from public.harmonious_records'),e=>e.code==='42501');
  await assert.rejects(()=>db.query('select public.harmonious_snapshot()'),e=>e.code==='42501');
  await assert.rejects(()=>db.query('select public.harmonious_commit($1::uuid,0,\'[]\'::jsonb)',[alice.id]),e=>e.code==='42501');
  await db.exec('reset role');
}
await db.exec('set role service_role');assert((await store.snapshot()).records.length>0);await db.exec('reset role');
await db.close();console.log('PostgreSQL migration, two-account persistence, atomic rollback, revision conflicts, and database access boundaries passed.');
