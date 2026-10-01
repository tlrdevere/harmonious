import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {alice,bob,seedActor} from './accounts.test.mjs';
import {AccountError,projectAccountWorkspace} from '../worker/account-policy.mjs';
import {FacilitationAPI} from '../worker/facilitation-api.mjs';
import {accountKey,ownedAccountRecords,accountChanges} from '../dist/account-model.mjs';
import {synchronizeIdeas} from '../dist/adoption.mjs';
export {alice,bob};
export const organizer={id:'33333333-3333-4333-8333-333333333333',name:'Taylor'},outsider={id:'44444444-4444-4444-8444-444444444444',name:'Outside'};
export const caps='comparison-reasoning-v1,comparison-adoption-v1,comparison-premise-v1,comparison-reflection-v1,interaction-grammar-v4,counterpart-integrity-v1,argument-categories-v1,argument-replies-v1,argument-dialogue-v1,argument-standstill-v1,facilitation-v1';
export async function fixture(){
 const db=new PGlite(),env={APP_ORIGIN:'https://harmonious.example',SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test',SUPABASE_SECRET_KEY:'server-test',TEST_ACCOUNT_ADMIN_ID:organizer.id,SIGNUP_MODE:'public'};
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);');
 for(const a of [alice,bob,organizer,outsider])await db.query('insert into auth.users values($1)',[a.id]);
 for(const f of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+f,'utf8'));
 await db.exec('set role service_role');
 const call=async(sql,args=[])=>{try{return(await db.query(sql,args)).rows[0].data;}catch(e){const error=new AccountError(e.message,e.code==='PT403'?403:e.code==='PT409'?409:400);error.snapshotChanged=e.message==='snapshot_changed';throw error;}};
 const store={snapshot:()=>call('select harmonious_snapshot() data'),commit:(a,g,c)=>call('select harmonious_commit($1,$2,$3) data',[a,g,JSON.stringify(c)]),facilitate:(a,m,g,c,i)=>call('select harmonious_facilitate($1,$2,$3,$4,$5) data',[a,m,g,c,JSON.stringify(i)])};
 for(const a of [alice,bob,organizer,outsider])await seedActor(store,a);
 const users=[alice,bob].map(a=>({id:a.id,email:a.name.toLowerCase()+'@test-accounts.harmonious.invalid',app_metadata:{harmonious_test_account:true,test_username:a.name.toLowerCase(),created_by:organizer.id},user_metadata:{display_name:a.name},created_at:new Date().toISOString()}));
 const auth=actor=>({env,identify:async()=>({actor,cookies:[]}),fetcher:async url=>{const id=new URL(url).pathname.split('/').at(-1);return Response.json(id==='users'?{users}:users.find(u=>u.id===id)||{id});}});
 const api=actor=>new FacilitationAPI(store,auth(actor),env,actor),command=(actor,command,input)=>api(actor).command(command,{operationId:crypto.randomUUID(),...input});
 const changes=async(actor,mutate)=>{const snapshot=await store.snapshot(),view=projectAccountWorkspace(snapshot,actor.id),before=new Map(ownedAccountRecords(view.workspace,actor.id,view.ownedKeys).map(r=>[accountKey(r.kind,r.id),r.value]));mutate(view.workspace);for(const m of view.workspace.maps.filter(m=>m.ownerId===actor.id))synchronizeIdeas(view.workspace,m);return accountChanges(ownedAccountRecords(view.workspace,actor.id,view.ownedKeys),before,view.revisions);};
 return {db,store,env,auth,api,command,changes,users};
}
