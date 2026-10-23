import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {handleAccountAPI} from '../worker/account-api.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {standstillProposalMetadata} from '../dist/standstill.mjs';
import {synchronizeIdeas} from '../dist/adoption.mjs';

const {chromium}=await import(process.env.HARMONIOUS_PLAYWRIGHT?pathToFileURL(process.env.HARMONIOUS_PLAYWRIGHT).href:pathToFileURL(resolve('node_modules/playwright/index.mjs')).href);
const store=memoryStore(),refs={},errors=[],requests=[];let origin,holdOpen=false,openRelease,openWaiting=false;
const capabilities='comparison-reasoning-v1,comparison-adoption-v1,comparison-premise-v1,comparison-reflection-v1,interaction-grammar-v4,counterpart-integrity-v1,argument-categories-v1,argument-replies-v1,argument-dialogue-v1,argument-placement-v1,argument-standstill-v1,facilitation-v1,philosophy-v1';
for(const actor of [alice,bob]){
 await seedActor(store,actor);await edit(store,actor,ws=>{const map=ws.maps.find(m=>m.ownerId===actor.id);map.visibility='shared';map.name=actor.name+' Activity map';const position=addNode(ws,actor,actor.name+' community claim'),action=addNode(ws,actor,actor.name+' proposed action');position.parent='status';action.parent='action';position.summary='The complete wording of the claim.';action.summary='The complete action to discuss.';map.relations=[{id:actor.name+'-connection',from:position.id,to:action.id,type:'addresses',note:'Action addresses the claim.'}];refs[actor.name]={mapId:map.id,nodeId:position.id,actionId:action.id,edgeId:actor.name+'-connection'};synchronizeIdeas(ws,map);});
}
const env={APP_ORIGIN:'',SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'fixture-public',SUPABASE_SECRET_KEY:'fixture-server',SIGNUP_MODE:'public'};
const auth={env,identify:async request=>({actor:request.headers.get('cookie')?.includes('test-actor=bob')?bob:alice,cookies:[]})};
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,origin||'http://localhost');if(url.pathname.startsWith('/api/')){
  let raw='';for await(const chunk of req)raw+=chunk;requests.push({path:url.pathname,body:raw?JSON.parse(raw):null,cookie:req.headers.cookie});
  const request=new Request(url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:raw}),result=await handleAccountAPI(request,env,{store,auth});
  if(url.pathname==='/api/activity/open'&&holdOpen){openWaiting=true;await new Promise(r=>openRelease=r);openWaiting=false;}
  res.writeHead(result.status,Object.fromEntries(result.headers));res.end(await result.text());return;
 }
 const name=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!/^[a-z0-9.-]+$/.test(name)){res.writeHead(404);res.end();return;}
 let content=await readFile(resolve('dist',name),'utf8');if(name==='index.html')content=content.replace('src="./app.mjs"','src="./beta-boot.mjs"').replace('</head>','<link rel="stylesheet" href="./accounts.css"><link rel="stylesheet" href="./activity.css"></head>');
 // A read-only test handle lets this fixture observe the actual account
 // controller and simulate an edit arriving while a network reply is held.
 if(name==='app.mjs')content+='\nglobalThis.activityTestController=workspaceController;';
 res.setHeader('content-type',name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'text/javascript');res.end(content);
 }catch(error){res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:error.message}));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;env.APP_ORIGIN=origin;
const browser=await chromium.launch({headless:true,channel:process.env.HARMONIOUS_BROWSER||'msedge'});
try{
 const context=async actor=>{const c=await browser.newContext({viewport:{width:1400,height:960},reducedMotion:'reduce'});await c.addCookies([{name:'test-actor',value:actor,url:origin}]);return c;},a=await context('alice'),b=await context('bob');
 const api=async(context,path,body,method='POST')=>{const r=await context.request.fetch(origin+path,{method:body===undefined?'GET':method,headers:{origin,'X-Harmonious-Capabilities':capabilities,...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{data:body})});const data=await r.json();assert.equal(r.status(),200,path+': '+JSON.stringify(data));return data;};
 const {comparisonThread:thread}=await api(a,'/api/comparisons',{aMapId:refs.Alice.mapId,bMapId:refs.Bob.mapId});
 const publish=async(context,actor,input)=>{const {workspace}=await api(context,'/api/workspace'),record=makeDiscussion(workspace,{comparisonId:thread.id,...input},actor.id);await api(context,'/api/workspace',{changes:[{kind:'discussion',id:record.id,expectedRevision:0,value:record}]},'PUT');return record;};
 const dispute=await publish(a,alice,{kind:'interaction',action:'dispute',target:{type:'node',mapId:refs.Bob.mapId,nodeId:refs.Bob.nodeId},body:'The sample excludes people who work at night.',interaction:{mode:'argument',options:['factual_basis']}});
 const reply=await publish(b,bob,{kind:'interaction',action:'respond',target:{type:'entry',entryId:dispute.id},body:'We can include night workers in the next survey.',interaction:{mode:'argument',options:['reply'],replyTo:{entryId:dispute.id,version:dispute.version}}});
 const edgeDispute=await publish(b,bob,{kind:'interaction',action:'dispute',target:{type:'edge',mapId:refs.Alice.mapId,edgeId:refs.Alice.edgeId},body:'This action may not address the actual cause.',interaction:{mode:'argument',options:['reasoning']}});
 const sw=(await api(b,'/api/workspace')).workspace,standstill=await publish(b,bob,{kind:'standstill',action:'propose_standstill',target:{type:'node',mapId:refs.Bob.mapId,nodeId:refs.Bob.nodeId},body:'We disagree on the threshold for adequate evidence.',standstill:standstillProposalMetadata(sw,thread.id,reply.id)});
 const incoming=await api(a,'/api/activity'),replyEvent=incoming.items.find(e=>e.recordId===reply.id),edgeEvent=incoming.items.find(e=>e.recordId===edgeDispute.id),standstillEvent=incoming.items.find(e=>e.recordId===standstill.id);assert(replyEvent&&edgeEvent&&standstillEvent);assert.equal(incoming.unreadCount,3);assert.equal((await api(b,'/api/activity')).items.some(e=>e.recordId===dispute.id),true,'The other account receives the original dispute through the public API.');
 const page=await a.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.stack||error.message));
 const activity=page.locator('#activity-dialog'),card=id=>activity.locator('[data-activity-id="'+id+'"]'),idle=()=>page.waitForFunction(()=>globalThis.activityTestController&&!activityTestController.account.activity.inflight&&!activityTestController.account.activity.mutating&&!activityTestController.account.loading),openInbox=async()=>{await page.locator('#activity-open').click();await idle();await activity.locator('.activity-group').evaluateAll(groups=>groups.forEach(g=>g.open=true));},readState=async id=>(await api(a,'/api/activity')).items.find(e=>e.id===id)?.read;
 const mapURL=layout=>origin+'/#'+new URLSearchParams({map:refs.Alice.mapId,layout});
 await page.goto(mapURL('outline'));await page.locator('#outline-map').waitFor();await page.locator('#activity-open[data-unread="3"]').waitFor();
 // A genuine unsaved child cannot be discarded by a notification destination.
 const addChild=async()=>{await page.locator('#outline-map [data-outline-node="'+refs.Alice.nodeId+'"]').getByRole('button',{name:'Open node',exact:true}).click();await page.locator('#outline-map-detail').getByRole('button',{name:'Add child node',exact:true}).click();await page.locator('#child-title').fill('Keep this unfinished child');};
 await addChild();await openInbox();const beforeOpen=requests.filter(r=>r.path==='/api/activity/open').length;await card(replyEvent.id).getByRole('button',{name:'Open activity',exact:true}).click();await idle();assert.equal(await readState(replyEvent.id),false);assert.equal(requests.filter(r=>r.path==='/api/activity/open').length,beforeOpen,'The dirty guard runs before fetching a navigation snapshot.');assert.match(await activity.innerText(),/Finish saving or cancel/);await activity.getByRole('button',{name:'Close',exact:true}).click();assert.equal(await page.locator('#child-title').inputValue(),'Keep this unfinished child');await page.locator('#cancel-child').click();
 // Real account navigation opens the exact response in both presentations.
 for(const layout of ['outline','canvas']){
  await page.goto(mapURL(layout));await page.locator('body[data-presentation="'+layout+'"]').waitFor();await page.locator('#activity-open').waitFor();await openInbox();await card(replyEvent.id).getByRole('button',{name:'Open activity',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('activity-dialog').open);await idle();const route=new URLSearchParams(new URL(page.url()).hash.slice(1));assert.equal(route.get('entry'),reply.id);assert.equal(route.get('node'),refs.Bob.nodeId);assert.equal(route.get('view'),'dialogue');assert.equal(route.get('layout'),layout);assert.match(await page.locator('.discussion-popover').innerText(),/include night workers/);assert.equal(await readState(replyEvent.id),true);
 }
 // A connection dispute stays attached to the connection, outside node dialogue.
 await openInbox();await card(edgeEvent.id).getByRole('button',{name:'Open activity',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('activity-dialog').open);await idle();let route=new URLSearchParams(new URL(page.url()).hash.slice(1));assert.equal(route.get('entry'),edgeDispute.id);assert.equal(route.get('view'),'argument');assert.equal(route.get('layout'),'canvas');assert.match(await page.locator('.discussion-popover').innerText(),/actual cause/);assert.equal(await page.evaluate(()=>activityTestController.discussion.dialogue.active),false);assert.equal(await readState(edgeEvent.id),true);
 // Standstill opens its exact point and explanation, retaining the chosen view.
 await openInbox();await card(standstillEvent.id).getByRole('button',{name:'Open activity',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('activity-dialog').open);await idle();route=new URLSearchParams(new URL(page.url()).hash.slice(1));assert.equal(route.get('entry'),standstill.id);assert.equal(route.get('view'),'dialogue');assert.match(await page.locator('.discussion-popover').innerText(),/threshold for adequate evidence/);assert.equal(await readState(standstillEvent.id),true);
 // A draft started after Open was sent must still win over its held response.
 await api(a,'/api/activity/read',{ids:[replyEvent.id],read:false});await page.goto(mapURL('outline'));await page.locator('#outline-map').waitFor();await openInbox();holdOpen=true;await card(replyEvent.id).getByRole('button',{name:'Open activity',exact:true}).click();for(let n=0;n<100&&!openWaiting;n++)await new Promise(r=>setTimeout(r,20));assert(openWaiting);await activity.getByRole('button',{name:'Close',exact:true}).click();await addChild();holdOpen=false;openRelease();await idle();assert.equal(await page.locator('#child-title').inputValue(),'Keep this unfinished child');assert.equal(await readState(replyEvent.id),false);assert.equal(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('map'),refs.Alice.mapId);await page.locator('#cancel-child').click();
 // The list was authorized for Alice; replacing the cookie with Bob before Open
 // must not import Bob's workspace or mark Alice's item read under a new session.
 await openInbox();await a.addCookies([{name:'test-actor',value:'bob',url:origin}]);await card(replyEvent.id).getByRole('button',{name:'Open activity',exact:true}).click();await idle();assert.equal(await activity.locator('.activity-item').count(),0);assert.match(await activity.innerText(),/account changed|no longer available/);assert.equal(await page.locator('#activity-open').getAttribute('data-unread'),'0');assert.equal(await page.evaluate(()=>activityTestController.account.actor.id),alice.id);
 await a.addCookies([{name:'test-actor',value:'alice',url:origin}]);assert.equal(await readState(replyEvent.id),false);
  await page.goto(mapURL('outline'));await page.reload();await page.locator('#outline-map').waitFor();await openInbox();await page.setViewportSize({width:390,height:800});await mkdir('build/design-review',{recursive:true});await page.screenshot({path:'build/design-review/activity-integrated-390.png'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('Integrated Activity browser checks passed: real two-account publication, node/connection/standstill destinations, both presentations, dirty/in-flight guards, and cookie changes.');
}finally{holdOpen=false;openRelease?.();await browser.close();server.close();}
