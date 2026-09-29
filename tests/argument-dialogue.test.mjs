import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {alice,bob,memoryStore,seedActor,edit,view} from './accounts.test.mjs';
import {exerciseInteractionGrammar,exerciseArgumentReplies} from './interaction-grammar.test.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {dialogueRecords,dialogueTree,layoutDialogue,validateDialogueTargets} from '../dist/argument-dialogue.mjs';
import {handleAccountAPI} from '../worker/account-api.mjs';
async function exercise(store,direct=false){
 await seedActor(store,alice);await seedActor(store,bob);
 const fixture=await exerciseInteractionGrammar(store),earlier=await exerciseArgumentReplies(store,fixture),{thread,dispute}=fixture;
 let first,last;const maps=structuredClone((await view(store,alice)).workspace.maps);
 const reply=async(actor,to,body='A targeted reply')=>{let r;await edit(store,actor,ws=>{r=makeDiscussion(ws,{kind:'interaction',action:'respond',comparisonId:thread.id,target:{type:'entry',entryId:dispute.id},body,interaction:{mode:'argument',options:['reply'],replyTo:{entryId:to.id,version:to.version}}},actor.id);ws.discussions.push(r);});return r;};
 first=last=await reply(alice,earlier[2]);
 for(let i=0;i<20;i++)last=await reply(i%2?alice:bob,last,'Deep exchange '+i);
 const sibling=await reply(alice,first,'Another branch'),self=await reply(alice,sibling,'Another thought');
 assert.equal(self.interaction.recipientId,bob.id);assert.equal(first.interaction.version,7);
 const ws=(await view(store,alice)).workspace,records=dialogueRecords(ws,thread.id,dispute.target),tree=dialogueTree(records),sizes=new Map(tree.visible.map(id=>[id,{w:300,h:180+(id===first.id?170:0)}])),layout=layoutDialogue(tree,sizes);
 assert.equal(tree.nodes.get(first.id).parent,earlier[2].id);assert.equal(tree.nodes.get(earlier[2].id).parent,dispute.id);assert(layout.bounds.width>8000);
 for(const [a,p]of layout.positions)for(const [b,q]of layout.positions)if(a!==b)assert(!(p.x<q.x+q.w&&p.x+p.w>q.x&&p.y<q.y+q.h&&p.y+p.h>q.y),'Cards must not overlap');
 const folded=dialogueTree(records,new Set([first.id]));assert(!folded.visible.includes(self.id));assert(tree.nodes.get(first.id).count===22);
 await assert.rejects(()=>reply(alice,{...first,version:900}),/changed|withdrawn|target/);
 await assert.rejects(()=>reply(alice,fixture.request),/this dispute/);
 await assert.rejects(()=>reply(alice,earlier[1]),/changed|withdrawn|target/);
 await assert.rejects(()=>reply(alice,last,' \n '),/Write a reply/);
 const forged=structuredClone(first);forged.interaction.replyTo={entryId:forged.id,version:1};assert.throws(()=>validateDialogueTargets({...ws,discussions:[...ws.discussions.filter(r=>r.id!==forged.id),forged]}),/target|cycle/);
 const oldCopy=structuredClone(first);
 await edit(store,alice,w=>{const old=w.discussions.find(r=>r.id===first.id),next=makeDiscussion(w,{...old,body:'Edited without reparenting'},alice.id,old);w.discussions=w.discussions.map(r=>r.id===old.id?next:r);});
 await assert.rejects(()=>reply(bob,oldCopy),/changed|withdrawn|target/);
 await edit(store,alice,w=>{const old=w.discussions.find(r=>r.id===sibling.id);w.discussions=w.discussions.map(r=>r.id===old.id?makeDiscussion(w,{...old,status:'withdrawn'},alice.id,old):r);});
 const final=(await view(store,bob)).workspace;assert.equal(final.discussions.find(r=>r.id===self.id).status,'active');assert.deepEqual((await view(store,alice)).workspace.maps,maps);
 const caps='interaction-grammar-v4,argument-categories-v1,argument-replies-v1';
 const env={APP_ORIGIN:'https://harmonious.example',SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test',SUPABASE_SECRET_KEY:'server-test',SIGNUP_MODE:'public'};
 for(const suffix of ['',',argument-dialogue-v1']){
  const res=await handleAccountAPI(new Request(env.APP_ORIGIN+'/api/workspace',{headers:{'X-Harmonious-Capabilities':caps+suffix}}),env,{store,auth:{identify:async()=>({actor:alice,cookies:[]})}});
  assert.equal(res.status,suffix?200:409);if(!suffix)assert.equal((await res.json()).requiredCapability,'argument-dialogue-v1');
 }
 if(direct){
  const snapshot=await store.snapshot(),fresh=makeDiscussion(final,{kind:'interaction',action:'respond',comparisonId:thread.id,target:{type:'entry',entryId:dispute.id},body:'SQL target check',interaction:{mode:'argument',options:['reply'],replyTo:{entryId:last.id,version:last.version}}},bob.id);
  for(const ref of [{entryId:fixture.request.id,version:1},{entryId:last.id,version:300},{entryId:fresh.id,version:1},{entryId:'missing',version:1}]){
   const value=structuredClone(fresh);value.interaction.replyTo=ref;
   await assert.rejects(()=>store.commit(bob.id,snapshot.revision,[{kind:'discussion',id:value.id,expectedRevision:0,value}]),/target|dispute/);
  }
  assert.deepEqual(await store.snapshot(),snapshot);
 }
}
await exercise(memoryStore());
const db=new PGlite();
try{
 await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);");
 await db.query('insert into auth.users(id) values($1),($2)',[alice.id,bob.id]);
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 await db.exec('set role service_role');
 const store={async snapshot(){return (await db.query('select public.harmonious_snapshot() as data')).rows[0].data;},async commit(actor,generation,changes){return (await db.query('select public.harmonious_commit($1::uuid,$2::bigint,$3::jsonb) as data',[actor,generation,JSON.stringify(changes)])).rows[0].data;}};
 await exercise(store,true);
}finally{await db.close();}
console.log('Targeted dialogue replies, historical projection, branching layout, permissions, capability and PostgreSQL parity passed.');

