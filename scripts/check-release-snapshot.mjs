import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {projectAccountWorkspace} from '../worker/account-policy.mjs';

const snapshot=JSON.parse(await readFile(process.argv[2],'utf8'));
const db=new PGlite();
try{
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);');
  for(const id of new Set(snapshot.records.map(r=>r.ownerId)))await db.query('insert into auth.users(id) values($1::uuid)',[id]);
  for(const name of ['20260908233252_harmonious_accounts','20260910043435_allow_shared_comparison_judgments'])await db.exec(await readFile(`supabase/migrations/${name}.sql`,'utf8'));
  for(const r of snapshot.records)await db.query('insert into public.harmonious_records(kind,id,owner_id,revision,content) values($1,$2,$3::uuid,$4,$5::jsonb)',[r.kind,r.id,r.ownerId,r.revision,JSON.stringify(r.value)]);
  await db.query('update public.harmonious_generation set revision=$1 where id',[snapshot.revision]);
  for(const name of ['20260910212254_overall_comparisons','20260910212326_argument_records'])await db.exec(await readFile(`supabase/migrations/${name}.sql`,'utf8'));
  const after=(await db.query('select public.harmonious_snapshot() as snapshot')).rows[0].snapshot;
  for(const before of snapshot.records){const current=after.records.find(r=>r.kind===before.kind&&r.id===before.id);assert(current);const value=structuredClone(current.value);if(before.kind==='comparison')delete value.comparisonId;assert.deepEqual(value,before.value,'Migration must preserve all original content');}
  for(const r of snapshot.records.filter(r=>r.kind==='profile'))projectAccountWorkspace(after,r.id);
  console.log(`Release migrations preserve ${snapshot.records.length} existing records and load both account workspaces successfully.`);
}finally{await db.close();}
