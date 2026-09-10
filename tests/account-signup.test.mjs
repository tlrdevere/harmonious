import assert from 'node:assert/strict';
import {AccountAuth,accountConfiguration} from '../worker/account-auth.mjs';
import {handleAccountAPI} from '../worker/account-api.mjs';
import {AccountChallenge} from '../dist/account-challenge.mjs';
import {SupabaseStore} from '../worker/supabase-store.mjs';
const env={APP_ORIGIN:'https://harmonious.example',SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'publishable-test',SUPABASE_SECRET_KEY:'sb_secret_test',SIGNUP_MODE:'public'};
assert(accountConfiguration(env));
for(const changes of [{SUPABASE_SECRET_KEY:''},{SIGNUP_MODE:'typo'},{SIGNUP_MODE:'invite'},{SIGNUP_MODE:''}])assert(!accountConfiguration({...env,...changes}));
let calls=[],providerError=null;
const user={id:'new-person',email:'new@example.test',email_confirmed_at:'2026-09-09',user_metadata:{display_name:'New person'}};
const auth=new AccountAuth(env,async(url,options)=>{const body=typeof options.body==='string'&&options.headers?.['content-type']==='application/json'?JSON.parse(options.body||'{}'):options.body;calls.push({url,body});if(url.includes('siteverify'))return Response.json({success:String(options.body).includes('valid-token')||String(options.body).includes('fresh-token'),hostname:'harmonious.example',action:'signup'});if(providerError)return Response.json(providerError,{status:providerError.status||400});return Response.json(url.endsWith('/verify')?{user,access_token:'access',refresh_token:'refresh'}:{});});
await auth.requestCode({email:user.email,name:'New person'});
assert.equal(calls.length,1,'Public signup sends the code request');
assert(calls.at(-1).url.endsWith('/otp'));assert.equal(calls.at(-1).body.create_user,true);
providerError={status:429};await assert.rejects(()=>auth.requestCode({email:user.email,name:'New person'}),e=>e.status===429);
providerError=null;assert.equal((await auth.verifyCode({email:user.email,code:'123456'})).actor.id,user.id);
assert.throws(()=>auth.actor({...user,email_confirmed_at:null}),e=>e.status===403);
const res=await handleAccountAPI(new Request(env.APP_ORIGIN+'/api/session'),env,{auth:{identify:async()=>({actor:null,cookies:[]})}});
const session=await res.json();assert.equal(session.signup.mode,'public');assert(!JSON.stringify(session).includes('sb_secret_test'));
let callbacks,resets=0;globalThis.window={turnstile:{render:(element,options)=>{callbacks=options;return 'widget';},reset:()=>{resets++;}}};
const challenge=new AccountChallenge({},()=>{});await challenge.mount({siteKey:'site-test',action:'signup'});callbacks.callback('token');assert.equal(challenge.token,'token');callbacks['expired-callback']();assert.equal(challenge.token,'');callbacks.callback('token2');challenge.reset();assert.equal(challenge.token,'');assert.equal(resets,1);callbacks['error-callback']();assert.equal(challenge.token,'');
console.log('Public signup, native CAPTCHA forwarding, fail-closed settings, provider errors, and challenge expiry passed.');
const originalFetch=globalThis.fetch;
try{
  globalThis.fetch=function(){assert(this===undefined||this===globalThis,'Runtime fetch must not receive a class instance as its receiver');return Promise.resolve(Response.json({}));};
  await new AccountAuth(env).call('user');
  await new SupabaseStore(env).snapshot();
}finally{globalThis.fetch=originalFetch;}

