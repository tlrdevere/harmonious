import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {recordComparison} from '../dist/workspace.mjs';
import {projectAccountWorkspace} from '../worker/account-policy.mjs';

const memory=memoryStore();await seedActor(memory,alice);await seedActor(memory,bob);
await edit(memory,alice,w=>{addNode(w,alice);w.maps.find(m=>m.ownerId===alice.id).visibility='shared';});
await edit(memory,bob,w=>{addNode(w,bob);w.maps.find(m=>m.ownerId===bob.id).visibility='shared';});
const w=(await view(memory,alice)).workspace,a=w.maps.find(m=>m.ownerId===alice.id),b=w.maps.find(m=>m.ownerId===bob.id);
const input={aMapId:a.id,bMapId:b.id,aNodeId:a.nodes.find(n=>n.parent!==null).id,bNodeId:b.nodes.find(n=>n.parent!==null).id,questionStatus:'matched',question:'What do we share?',answerStatus:'partial',notes:'Keep this history'};
const original=recordComparison(w,input,null,alice.id),revised=recordComparison(w,{...input,notes:'Keep this revision too'},original,alice.id);
const reversed=recordComparison(w,{...input,aMapId:b.id,bMapId:a.id,aNodeId:input.bNodeId,bNodeId:input.aNodeId},null,bob.id);
delete revised.comparisonId;delete reversed.comparisonId;
const before=await memory.snapshot();
before.records.push({kind:'comparison',id:revised.id,ownerId:alice.id,revision:2,value:revised},{kind:'comparison',id:reversed.id,ownerId:bob.id,revision:1,value:reversed});
const db=new PGlite();
try{
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values('${alice.id}'),('${bob.id}');`);
  for(const filename of ['20260908233252_harmonious_accounts.sql','20260910043435_allow_shared_comparison_judgments.sql'])await db.exec(await readFile('supabase/migrations/'+filename,'utf8'));
  for(const record of before.records)await db.query('insert into public.harmonious_records(kind,id,owner_id,revision,content) values($1,$2,$3,$4,$5::jsonb)',[record.kind,record.id,record.ownerId,record.revision,JSON.stringify(record.value)]);
  await db.exec(await readFile('supabase/migrations/20260910212254_overall_comparisons.sql','utf8'));
  const after=(await db.query('select public.harmonious_snapshot() data')).rows[0].data,parents=after.records.filter(r=>r.kind==='comparison_thread');
  assert.equal(parents.length,1,'Reversed old comparisons receive one parent');
  assert.equal(parents[0].id,[revised.id,reversed.id].sort()[0]);
  for(const old of before.records){
    const saved=after.records.find(r=>r.kind===old.kind&&r.id===old.id);
    assert.deepEqual(saved.value,old.kind==='comparison'?{...old.value,comparisonId:parents[0].id}:old.value,'Migration preserves source data, judgments, histories and ownership');
    assert.equal(saved.ownerId,old.ownerId);
  }
  for(const actor of [alice,bob]){
    const projected=projectAccountWorkspace(after,actor.id).workspace;
    assert.equal(projected.comparisonThreads[0].id,parents[0].id);assert.equal(projected.comparisons.length,2);
  }
  console.log('Existing comparison migration preserves all judgments and histories and groups reversed map pairs.');
}finally{await db.close();}
