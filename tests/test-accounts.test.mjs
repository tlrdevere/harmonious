import assert from 'node:assert/strict';
import {AccountAuth} from '../worker/account-auth.mjs';
import {TestAccounts,testEmail,isTestUser,canManageTestAccounts} from '../worker/test-accounts.mjs';
import {handleAccountAPI} from '../worker/account-api.mjs';
import {memoryStore} from './accounts.test.mjs';

const ownerId='11111111-1111-4111-8111-111111111111',normalId='22222222-2222-4222-8222-222222222222';
const env={APP_ORIGIN:'https://harmonious.example',SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-key',SUPABASE_SECRET_KEY:'sb_secret_private',SIGNUP_MODE:'public',TEST_ACCOUNT_ADMIN_ID:ownerId};
const owner={id:ownerId,email:'owner@example.com',email_confirmed_at:'2026-09-29',user_metadata:{display_name:'Owner'}},normal={...owner,id:normalId,email:'normal@example.com',user_metadata:{display_name:'Normal',harmonious_test_account:true}};
const users=new Map([[owner.id,owner],[normal.id,normal]]),passwords=new Map(),sessions=new Map([['owner',owner],['normal',normal]]),calls=[];let limited=false;
const fetcher=async(url,options)=>{
 calls.push({url,options});const path=new URL(url).pathname.replace('/auth/v1/',''),body=options.body?JSON.parse(options.body):null;
 if(limited)return Response.json({}, {status:429});
 if(path.startsWith('admin/')){assert.equal(options.headers.apikey,env.SUPABASE_SECRET_KEY);assert(!options.headers.authorization);}
 if(path==='admin/users'&&options.method==='POST'){if([...users.values()].some(u=>u.email===body.email))return Response.json({code:'email_exists'},{status:422});const u={...body,id:crypto.randomUUID(),email_confirmed_at:body.email_confirm?'2026-09-29':null,created_at:'2026-09-29'};delete u.password;users.set(u.id,u);passwords.set(u.id,body.password);return Response.json(u);}
 if(path==='admin/users')return Response.json({users:[...users.values()]});
 if(path.startsWith('admin/users/')){const u=users.get(path.split('/').at(-1));if(options.method==='PUT')passwords.set(u.id,body.password);return Response.json(u);}
 if(path==='token'){const u=[...users.values()].find(u=>u.email===body?.email);if(!u||passwords.get(u.id)!==body.password)return Response.json({},{status:400});sessions.set('test-access',u);return Response.json({user:u,access_token:'test-access',refresh_token:'test-refresh',expires_in:3600});}
 if(path==='user'){const user=sessions.get(options.headers.authorization?.replace('Bearer ',''));return Response.json(user||{},{status:user?200:401});}
 return Response.json({});
};
const auth=new AccountAuth(env,fetcher),manager=new TestAccounts(auth),actor=auth.actor(owner),password='HT-'+'ab'.repeat(16);
assert(canManageTestAccounts(env,actor));assert(!canManageTestAccounts({},actor));assert(!canManageTestAccounts(env,{...actor,testAccount:true}));
await assert.rejects(()=>manager.create(auth.actor(normal),{}),e=>e.status===403);assert.equal(calls.length,0);
const {account}=await manager.create(actor,{username:' Tester01 ',name:'Test participant 1',password});assert.equal(account.username,'tester01');assert(!JSON.stringify(account).includes(password));
const user=users.get(account.id);assert(isTestUser(user));assert.equal(user.email,testEmail('tester01'));assert.equal(user.app_metadata.created_by,ownerId);
await assert.rejects(()=>manager.create(actor,{username:'tester01',name:'Other',password}),e=>e.status===409);assert.equal(users.size,3);
await assert.rejects(()=>manager.create(actor,{username:'tester02',name:'Other',password:'weak'}));
assert.deepEqual((await manager.list(actor)).accounts.map(u=>u.id),[account.id]);assert(!(JSON.stringify(await manager.list(actor))).includes('@'));
assert.throws(()=>auth.actor({...user,app_metadata:{},user_metadata:{...user.app_metadata}}),e=>e.status===403);
assert.throws(()=>auth.actor({...user,email_confirmed_at:null}),e=>e.status===403);
await assert.rejects(()=>auth.requestCode({email:user.email,name:'Tester'}),e=>e.status===403);
await assert.rejects(()=>auth.verifyCode({email:user.email,code:'123456'}),e=>e.status===403);
await assert.rejects(()=>auth.signInTest({username:'tester01',password:'wrong'}),e=>e.status===400);
const signed=await auth.signInTest({username:'TESTER01',password});assert.equal(signed.actor.id,account.id);assert(signed.actor.testAccount);for(const cookie of signed.cookies)assert(cookie.includes('HttpOnly')&&cookie.includes('Secure')&&cookie.includes('SameSite=Lax'));
const inviteAuth=new AccountAuth({...env,SIGNUP_MODE:'invite',BETA_INVITE_EMAILS:'owner@example.com'},fetcher);assert.equal(inviteAuth.actor(user).id,user.id);
await assert.rejects(()=>manager.reset(actor,{id:normal.id,password}),e=>e.status===403);const replacement='HT-'+'cd'.repeat(16);await manager.reset(actor,{id:account.id,password:replacement});await assert.rejects(()=>auth.signInTest({username:'tester01',password}),e=>e.status===400);assert.equal((await auth.signInTest({username:'tester01',password:replacement})).actor.id,account.id);
limited=true;await assert.rejects(()=>auth.signInTest({username:'tester01',password}),e=>e.status===429);limited=false;
const store=memoryStore(),request=(path,token='',body,origin=env.APP_ORIGIN)=>new Request(env.APP_ORIGIN+path,{method:body===undefined?'GET':'POST',headers:{...(token?{cookie:'__Host-harmonious-access='+token}:{}),...(body===undefined?{}:{origin,'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
for(const token of ['', 'normal','test-access']){const response=await handleAccountAPI(request('/api/admin/test-accounts',token),env,{auth,store});assert.equal(response.status,token?403:401);}
let response=await handleAccountAPI(request('/api/session','owner'),env,{auth,store});assert.equal((await response.json()).canManageTestAccounts,true);
response=await handleAccountAPI(request('/api/auth/test-login','',{username:'tester01',password:replacement}),env,{auth,store});assert.equal(response.status,200);assert.deepEqual(await response.json(),{signedIn:true});assert(response.headers.get('set-cookie').includes('HttpOnly'));
response=await handleAccountAPI(request('/api/admin/test-accounts','owner',{username:'tester03',name:'Three',password},'https://evil.example'),env,{auth,store});assert.equal(response.status,403);
response=await handleAccountAPI(request('/api/workspace','test-access'),env,{auth,store});assert.equal(response.status,200);const workspace=await response.json();assert.equal(workspace.actor.id,account.id);assert.equal(workspace.workspace.maps.length,1);assert.equal(workspace.workspace.maps[0].visibility,'private');assert(!JSON.stringify(workspace).includes(env.SUPABASE_SECRET_KEY));
console.log('Test-account creation, reserved identities, owner-only administration, password login/reset, secure cookies, rate limits, email boundaries and private workspaces passed.');
