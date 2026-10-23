import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {clientAssets} from '../scripts/client-assets.mjs';
import {AccountAuth} from '../worker/account-auth.mjs';
import {handleAccountAPI,accountWorkspace} from '../worker/account-api.mjs';
import {memoryStore,edit} from './accounts.test.mjs';

// A local Auth double exercises the real Worker and account projection. It
// cannot send mail or create hosted identities.
const existing={id:'11111111-1111-4111-8111-111111111111',email:'returning@example.test',email_confirmed_at:'2026-10-23',user_metadata:{display_name:'Original name'}},pending={id:'22222222-2222-4222-8222-222222222222',email:'pending@example.test',email_confirmed_at:null,user_metadata:{display_name:'First pending name'}};
const users=new Map([[existing.email,existing],[pending.email,pending]]),sessions=new Map(),store=memoryStore(),errors=[],sends=[],verifies=[],failSend=new Map(),failVerify=new Map(),holdSend=new Map(),holdVerify=new Map();let env;
await accountWorkspace(store,{id:existing.id,name:'Saved display name'});
await edit(store,{id:existing.id},w=>{w.maps[0].name='Returning map';});
const initial=(await accountWorkspace(store,{id:existing.id})).workspace,map=initial.maps[0];
const authFetch=async(url,options)=>{
 const path=new URL(url).pathname.replace('/auth/v1/',''),body=options.body?JSON.parse(options.body):null;
 if(path==='otp'){
  sends.push(body);if(holdSend.has(body.email))await holdSend.get(body.email);
  if(failSend.has(body.email))return Response.json({code:'temporary_error'},{status:failSend.get(body.email)});
  let user=users.get(body.email);if(!user&&!body.create_user)return Response.json({code:'otp_disabled'},{status:422});
  if(!user){user={id:crypto.randomUUID(),email:body.email,email_confirmed_at:null,user_metadata:body.data||{}};users.set(user.email,user);}
  else if(!user.email_confirmed_at&&body.data)user.user_metadata={...user.user_metadata,...body.data};
  return Response.json({});
 }
 if(path==='verify'){
  verifies.push(body);if(holdVerify.has(body.email))await holdVerify.get(body.email);
  if(failVerify.has(body.email))return Response.json({},{status:failVerify.get(body.email)});
  const user=users.get(body.email);if(!user||body.token!=='123456')return Response.json({code:'otp_expired'},{status:403});
  user.email_confirmed_at||='2026-10-23';const token=crypto.randomUUID();sessions.set(token,user);return Response.json({user,access_token:token,refresh_token:token,expires_in:3600});
 }
 if(path==='user'){const user=sessions.get(options.headers.authorization?.replace('Bearer ',''));return Response.json(user||{},{status:user?200:401});}
 if(path==='logout'){sessions.delete(options.headers.authorization?.replace('Bearer ',''));return Response.json({});}
 if(path==='token'){const user=sessions.get(body.refresh_token);return user?Response.json({user,access_token:body.refresh_token,refresh_token:body.refresh_token,expires_in:3600}):Response.json({},{status:400});}
 throw Error('Unexpected Auth request '+path);
};
const assets=await clientAssets(),server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,env.APP_ORIGIN);
 if(url.pathname.startsWith('/api/')){let raw='';for await(const chunk of req)raw+=chunk;const response=await handleAccountAPI(new Request(url,{method:req.method,headers:req.headers,...(raw?{body:raw}:{})}),env,{auth:new AccountAuth(env,authFetch),store});res.writeHead(response.status,{...Object.fromEntries(response.headers),'set-cookie':response.headers.getSetCookie()});res.end(await response.text());return;}
 const asset=assets[url.pathname];res.writeHead(asset?200:404,{'content-type':asset?.type||'text/plain'});res.end(asset?.body||'Not found');
}catch(error){errors.push(error.message);res.writeHead(500);res.end('Test server error');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;env={APP_ORIGIN:origin,SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'test-public',SUPABASE_SECRET_KEY:'sb_secret_test',SIGNUP_MODE:'public'};
const {chromium}=await import(pathToFileURL(process.env.HARMONIOUS_PLAYWRIGHT)),browser=await chromium.launch({headless:true,channel:process.env.HARMONIOUS_BROWSER||'msedge'});
try{
 await mkdir('build/design-review',{recursive:true});
 const makePage=async(width=1400)=>{const page=await browser.newPage({viewport:{width,height:950}});page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));await page.clock.install();return page;};
 const ready=page=>page.getByText('Enter your email to sign in, or choose Create account.',{exact:true}).waitFor();
 const send=async(page,email)=>{await page.locator('#account-email').fill(email);await page.locator('#account-send').click();await page.locator('#account-code').waitFor({state:'visible'});};
 const verify=async(page,code='123456')=>{await page.locator('#account-code').fill(code);await page.locator('#account-verify').click();};
 const signout=async page=>{await page.locator('.account-menu > summary').click();await page.getByRole('button',{name:'Sign out',exact:true}).click();await ready(page);};
 const noOverflow=async page=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'The authentication gate must fit the viewport.');

 const page=await makePage();await page.goto(origin+'/#map='+map.id+'&node=status&layout=outline');await ready(page);
 assert.equal(await page.locator('#account-name').isVisible(),false);assert.equal(await page.locator('#account-name').getAttribute('required'),null);
 await send(page,' RETURNING@example.test ');assert.deepEqual(sends.at(-1),{email:existing.email,create_user:false});
 assert.match(await page.locator('#account-code-destination').textContent(),/returning@example.test/);assert(await page.locator('#account-resend').isDisabled());assert.equal(await page.locator('#account-code').getAttribute('autocomplete'),'one-time-code');
 await verify(page,'000000');await page.getByText('This code is invalid or expired. Request another code.',{exact:true}).waitFor();assert.equal(await page.locator('#account-code').inputValue(),'000000');
 failVerify.set(existing.email,503);await verify(page);await page.getByText('Sign-in is temporarily unavailable. Please try again.',{exact:true}).waitFor();failVerify.delete(existing.email);
 let releaseVerify;holdVerify.set(existing.email,new Promise(r=>{releaseVerify=r;}));const beforeVerify=verifies.length;
 await page.locator('#account-code').fill('123456');await page.locator('#account-code-form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
 await page.waitForFunction(()=>document.getElementById('account-verify').disabled);assert(await page.locator('#account-change-email').isDisabled());assert(await page.locator('#account-intent-signup').isDisabled());assert(await page.getByRole('button',{name:'Use a test account',exact:true}).isDisabled());
 releaseVerify();holdVerify.delete(existing.email);await page.locator('#account-display').getByText('Saved display name',{exact:true}).waitFor();assert.equal(verifies.length,beforeVerify+1,'Double verification sends one request');
 await page.locator('body[data-presentation=outline]').waitFor();await page.locator('#map-heading').getByText('Returning map',{exact:true}).waitFor();assert.equal(new URL(page.url()).hash.includes('node=status'),true,'Sign-in keeps the selected node and presentation');
 await signout(page);await page.locator('#account-intent-signup').click();await page.locator('#account-name').fill('Unexpected replacement');await send(page,existing.email);await verify(page);await page.locator('#account-display').getByText('Saved display name',{exact:true}).waitFor();assert.equal((await store.snapshot()).records.filter(r=>r.kind==='map'&&r.ownerId===existing.id).length,1,'Duplicate signup reuses the private map');
 await page.reload();await page.locator('#account-display').getByText('Saved display name',{exact:true}).waitFor();

 const unknown=await makePage(390);await unknown.goto(origin+'/#comparison=not-visible&layout=outline');await ready(unknown);const beforeUnknown=await store.snapshot(),userCount=users.size;
 await send(unknown,'unknown@example.test');assert.match(await unknown.locator('#account-feedback').textContent(),/If this address can sign in/);assert.equal(users.size,userCount);assert.deepEqual(await store.snapshot(),beforeUnknown);assert(await unknown.locator('#account-intent-signup').isVisible());
 await verify(unknown);await unknown.getByText('This code is invalid or expired. Request another code.',{exact:true}).waitFor();await unknown.locator('#account-change-email').click();assert.equal(await unknown.locator('#account-code').inputValue(),'');
 await send(unknown,existing.email);await verify(unknown);await unknown.getByText('This comparison is unavailable to this account. Its source maps may no longer be shared.',{exact:true}).waitFor();

 const signup=await makePage(320);await signup.goto(origin);await ready(signup);await signup.locator('#account-intent-signup').click();await signup.locator('#account-name').fill('Pending participant');await send(signup,pending.email);assert.deepEqual(sends.at(-1),{email:pending.email,create_user:true,data:{display_name:'Pending participant'}});
 await signup.locator('#account-code').fill('456789');await signup.clock.fastForward(61000);await signup.locator('#account-resend').waitFor({state:'visible'});assert.equal(await signup.locator('#account-resend').isDisabled(),false);
 // Even if hidden fields change, resend and verification use the frozen attempt.
 await signup.locator('#account-email').evaluate(input=>{input.value='wrong@example.test';});await signup.locator('#account-name').evaluate(input=>{input.value='Wrong name';});await signup.locator('#account-resend').click();await signup.getByText('If this address can sign in, a code will arrive shortly.',{exact:true}).waitFor();assert.deepEqual(sends.at(-1),{email:pending.email,create_user:true,data:{display_name:'Pending participant'}});assert.equal(await signup.locator('#account-code').inputValue(),'');
 await noOverflow(signup);await signup.evaluate(()=>document.documentElement.style.fontSize='20px');await noOverflow(signup);await signup.screenshot({path:'build/design-review/auth-code-320.png'});
 await verify(signup);await signup.locator('#account-display').getByText('Pending participant',{exact:true}).waitFor();assert.equal((await store.snapshot()).records.filter(r=>r.kind==='map'&&r.ownerId===pending.id).length,1);

 const race=await makePage(390);await race.goto(origin);await ready(race);let releaseSend;holdSend.set('slow@example.test',new Promise(r=>{releaseSend=r;}));await race.locator('#account-email').fill('slow@example.test');const beforeSends=sends.length;
 await race.locator('#account-email-form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});await race.locator('#account-intent-signup').click();releaseSend();holdSend.delete('slow@example.test');await race.waitForFunction(()=>!document.getElementById('account-email').disabled);assert.equal(sends.length,beforeSends+1);assert.equal(await race.locator('#account-code-form').isVisible(),false,'A stale send cannot reopen the code stage after intent changed');assert(await race.locator('#account-name').isVisible());
 await race.locator('#account-name').fill('New participant');failSend.set('new@example.test',429);await race.locator('#account-email').fill('new@example.test');await race.locator('#account-send').click();await race.getByText('Please wait before requesting another code.',{exact:true}).waitFor();assert(await race.locator('#account-send').isDisabled());assert.equal(await race.locator('#account-name').inputValue(),'New participant');
 await race.clock.fastForward(61000);failSend.set('new@example.test',503);await race.locator('#account-send').click();await race.getByText('The sign-in email could not be sent. Please try again later.',{exact:true}).waitFor();assert.equal(await race.locator('#account-send').isDisabled(),false);failSend.delete('new@example.test');await race.locator('#account-send').click();await race.locator('#account-code').waitFor({state:'visible'});
 await race.locator('#account-change-email').click();assert.equal(await race.locator('#account-name').inputValue(),'New participant');assert.equal(await race.locator('#account-code').inputValue(),'');await race.getByRole('button',{name:'Use a test account',exact:true}).click();await race.locator('#test-password').fill('discard-me');await race.getByRole('button',{name:'Use email sign-in',exact:true}).click();assert.equal(await race.locator('#test-password').inputValue(),'');assert(await race.locator('#account-name').isVisible());
 await race.locator('#account-intent-signin').click();await noOverflow(race);await race.screenshot({path:'build/design-review/auth-signin-390.png'});await race.locator('#account-intent-signup').click();await noOverflow(race);await race.screenshot({path:'build/design-review/auth-signup-390.png'});
 const pendingCount=users.size;assert(users.has('new@example.test'));assert.equal((await store.snapshot()).records.some(r=>r.kind==='profile'&&r.id===users.get('new@example.test').id),false,'Sending a signup email does not open a profile before verification');
 await race.clock.fastForward(61000);await send(race,'new@example.test');await verify(race);await race.locator('#account-display').getByText('New participant',{exact:true}).waitFor();assert.equal(users.size,pendingCount);assert.equal((await store.snapshot()).records.filter(r=>r.kind==='map'&&r.ownerId===users.get('new@example.test').id).length,1);
 assert.deepEqual(errors,[]);console.log('Authentication browser: email-only sign-in, explicit signup, canonical names, immutable resend/verify, cooldown/errors, stale sends, duplicate submissions, test-flow switching, destination restoration, unknown-account protection and mobile layouts passed.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
