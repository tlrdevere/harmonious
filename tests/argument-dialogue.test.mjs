import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {alice,bob,memoryStore,seedActor,edit,view} from './accounts.test.mjs';
import {exerciseInteractionGrammar,exerciseArgumentReplies} from './interaction-grammar.test.mjs';
import {validateWorkspace} from '../dist/workspace.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {dialogueRecords,dialogueTree,layoutDialogue,dialogueLine,validateDialogueTargets} from '../dist/argument-dialogue.mjs';
import {handleAccountAPI} from '../worker/account-api.mjs';
// Mixed directions, reversals, crowded siblings and measured/expanded text.
for(const shape of ['chain','wide','mixed']){
 const records=[{id:'root',action:'dispute',interaction:{}}];
 for(let i=0;i<48;i++)records.push({id:'r'+i,action:'respond',target:{entryId:'root'},interaction:{replyTo:{entryId:shape==='chain'&&i?'r'+(i-1):shape==='mixed'&&i>3?'r'+Math.floor((i-1)/3):'root'},placement:['right','above','below'][i%3]}});
 const tree=dialogueTree(records),sizes=new Map(tree.visible.map((id,i)=>[id,{w:300+(i%4)*30,h:160+(i%5)*65}])),layout=layoutDialogue(tree,sizes);
 assert.deepEqual(layoutDialogue(tree,sizes),layout,'Layout is deterministic');
 for(const [id,p]of layout.positions){
  for(const [other,q]of layout.positions)if(id!==other)assert(!(p.x<q.x+q.w&&p.x+p.w>q.x&&p.y<q.y+q.h&&p.y+p.h>q.y),'Mixed cards overlap');
  const node=tree.nodes.get(id),a=layout.positions.get(node.parent);if(!a)continue;
  if(node.record?.interaction.placement==='above')assert(p.y+p.h<a.y);
  if(node.record?.interaction.placement==='below')assert(p.y>a.y+a.h);
  const l=dialogueLine(a,p),cross=(ax,ay,bx,by,cx,cy)=>(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
  for(const [other,q]of layout.positions)if(other!==id&&other!==node.parent){
   for(const [x1,y1,x2,y2]of [[q.x,q.y,q.x+q.w,q.y],[q.x+q.w,q.y,q.x+q.w,q.y+q.h],[q.x,q.y+q.h,q.x+q.w,q.y+q.h],[q.x,q.y,q.x,q.y+q.h]])assert(!(cross(l.x1,l.y1,l.x2,l.y2,x1,y1)*cross(l.x1,l.y1,l.x2,l.y2,x2,y2)<0&&cross(x1,y1,x2,y2,l.x1,l.y1)*cross(x1,y1,x2,y2,l.x2,l.y2)<0),'Connection crosses another card');
  }
 }
 const folded=layoutDialogue(dialogueTree(records,new Set(['root'])),sizes);assert.equal(folded.positions.size,2);
 assert(layout.bounds.width<1e7&&layout.bounds.height<1e7,'Crowded branches must not cause runaway expansion');
}
async function exercise(store,direct=false){
 await seedActor(store,alice);await seedActor(store,bob);
 const fixture=await exerciseInteractionGrammar(store),earlier=await exerciseArgumentReplies(store,fixture),{thread,dispute}=fixture;
 let first,last;const maps=structuredClone((await view(store,alice)).workspace.maps);
 const reply=async(actor,to,body='A targeted reply',placement=undefined)=>{let r;await edit(store,actor,ws=>{r=makeDiscussion(ws,{kind:'interaction',action:'respond',comparisonId:thread.id,target:{type:'entry',entryId:dispute.id},body,interaction:{mode:'argument',options:['reply'],...(placement!==undefined?{placement}:{}),replyTo:{entryId:to.id,version:to.version}}},actor.id);ws.discussions.push(r);});return r;};
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
 const above=await reply(alice,last,'A reply above','above'),below=await reply(bob,last,'A reply below','below');
 const placed=(await view(store,bob)).workspace;validateWorkspace(JSON.parse(JSON.stringify(placed)));
 for(const r of [above,below])assert.equal(placed.discussions.find(e=>e.id===r.id).interaction.placement,r.interaction.placement);
 await edit(store,alice,w=>{const old=w.discussions.find(r=>r.id===above.id);w.discussions=w.discussions.map(r=>r.id===old.id?makeDiscussion(w,{...old,body:'Edited above'},alice.id,old):r);});
 for(const placement of ['below',undefined])await assert.rejects(()=>edit(store,alice,w=>{const old=w.discussions.find(r=>r.id===above.id),input=structuredClone(old);delete input.interaction.placement;if(placement)input.interaction.placement=placement;w.discussions=w.discussions.map(r=>r.id===old.id?makeDiscussion(w,input,alice.id,old):r);}),/placement/);
 for(const placement of ['left','',null,3,{}])await assert.rejects(()=>reply(alice,last,'Invalid direction',placement),/placement/);
 for(const suffix of ['',',argument-placement-v1']){const response=await handleAccountAPI(new Request(env.APP_ORIGIN+'/api/workspace',{headers:{'X-Harmonious-Capabilities':caps+',argument-dialogue-v1'+suffix}}),env,{store,auth:{identify:async()=>({actor:alice,cookies:[]})}});assert.equal(response.status,suffix?200:409);if(!suffix)assert.equal((await response.json()).requiredCapability,'argument-placement-v1');}
 if(direct){
  const snapshot=await store.snapshot(),fresh=makeDiscussion(final,{kind:'interaction',action:'respond',comparisonId:thread.id,target:{type:'entry',entryId:dispute.id},body:'SQL target check',interaction:{mode:'argument',options:['reply'],replyTo:{entryId:last.id,version:last.version}}},bob.id);
  for(const ref of [{entryId:fixture.request.id,version:1},{entryId:last.id,version:300},{entryId:fresh.id,version:1},{entryId:'missing',version:1}]){
   const value=structuredClone(fresh);value.interaction.replyTo=ref;
   await assert.rejects(()=>store.commit(bob.id,snapshot.revision,[{kind:'discussion',id:value.id,expectedRevision:0,value}]),/target|dispute/);
  }
  for(const placement of ['left',null,3]){const value=structuredClone(fresh);value.interaction.placement=placement;await assert.rejects(()=>store.commit(bob.id,snapshot.revision,[{kind:'discussion',id:value.id,expectedRevision:0,value}]),/placement/);}
  const current=(await view(store,alice)).workspace,old=current.discussions.find(r=>r.id===above.id),changed=makeDiscussion(current,{...old,body:'SQL edit'},alice.id,old),revision=snapshot.records.find(r=>r.id===old.id).revision;
  for(const placement of [undefined,'below']){const value=structuredClone(changed);delete value.interaction.placement;if(placement)value.interaction.placement=placement;await assert.rejects(()=>store.commit(alice.id,snapshot.revision,[{kind:'discussion',id:value.id,expectedRevision:revision,value}]),/placement/);}
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

