import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {accountWorkspace,saveAccountChanges,startAccountComparison} from '../worker/account-api.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';

const playwright=process.env.HARMONIOUS_PLAYWRIGHT;if(!playwright)throw Error('Set HARMONIOUS_PLAYWRIGHT.');
const {chromium}=await import(pathToFileURL(playwright)),store=memoryStore();
for(const actor of [alice,bob]){await seedActor(store,actor);await edit(store,actor,ws=>{ws.maps.find(m=>m.ownerId===actor.id).visibility='shared';addNode(ws,actor,actor.name+' source');});}
const initial=(await view(store,alice)).workspace,a=initial.maps.find(m=>m.ownerId===alice.id),b=initial.maps.find(m=>m.ownerId===bob.id),target={type:'node',mapId:b.id,nodeId:b.nodes.find(n=>n.parent!==null).id};
const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:a.id,bMapId:b.id});let interaction;
await edit(store,alice,ws=>{interaction=makeDiscussion(ws,{comparisonId:thread.id,kind:'interaction',action:'request_reason',target,body:'Original question',interaction:{mode:'inquiry',options:['reason']}},alice.id);ws.discussions.push(interaction);});
let loseNextAcknowledgement=false,putCount=0;const errors=[];
const json=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/')){
  let raw='';for await(const chunk of req)raw+=chunk;const input=raw?JSON.parse(raw):null;
  if(url.pathname==='/api/session'){json(res,200,{configured:true,actor:alice,signup:{mode:'public'}});return;}
  if(url.pathname==='/api/comparisons'){json(res,200,await startAccountComparison(store,alice.id,input));return;}
  if(url.pathname==='/api/workspace'&&req.method==='PUT'){
   const result=await saveAccountChanges(store,alice.id,input.changes);putCount++;
   if(loseNextAcknowledgement&&input.changes.some(c=>c.id===interaction.id)){loseNextAcknowledgement=false;json(res,503,{error:'The saved edit acknowledgement was lost. Retry this save.'});return;}
   json(res,200,result);return;
  }
  json(res,200,await accountWorkspace(store,alice));return;
 }
 const name=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!/^[a-z0-9.-]+$/.test(name)){res.writeHead(404);res.end();return;}
 let content=await readFile(resolve('dist',name),'utf8');if(name==='index.html')content=content.replace('src="./app.mjs"','src="./beta-boot.mjs"').replace('</head>','<link rel="stylesheet" href="./accounts.css"></head>');res.setHeader('content-type',name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'text/javascript');res.end(content);
}catch(e){json(res,e.status||500,{error:e.message});}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true,channel:process.env.HARMONIOUS_BROWSER||'msedge'});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
 const pop=page.locator('.discussion-popover'),click=label=>pop.getByRole('button',{name:label,exact:true}).click(),saved=async()=>pop.getByRole('button',{name:'Edit',exact:true}).waitFor(),record=async()=>(await view(store,alice)).workspace.discussions.find(r=>r.id===interaction.id);
 await page.goto(origin+'/#comparison='+thread.id);await page.locator('#reasoning-inquiry-mode').click();await page.getByRole('button',{name:'Conversations',exact:true}).click();await pop.locator(`[data-entry="${interaction.id}"]`).click();
 await click('Edit');await page.locator('#interaction-comment').fill('Saved despite a lost acknowledgement');loseNextAcknowledgement=true;await click('Save changes');await pop.getByRole('alert').filter({hasText:'acknowledgement was lost'}).waitFor();
 assert.equal((await record()).version,2);assert.equal((await record()).body,'Saved despite a lost acknowledgement');const committed=putCount;
 await click('Save changes');await saved();assert.equal(putCount,committed,'Retry acknowledges the exact saved edit without a duplicate revision');assert.equal((await record()).version,2);
 await click('Edit');await page.locator('#interaction-comment').fill('My concurrent draft');await edit(store,alice,ws=>{const old=ws.discussions.find(r=>r.id===interaction.id);const revised=makeDiscussion(ws,{...old,body:'A different session updated this interaction'},alice.id,old);ws.discussions=ws.discussions.map(r=>r.id===revised.id?revised:r);});
 await click('Save changes');await pop.getByRole('alert').filter({hasText:'edited in another session'}).waitFor();assert.equal(await page.locator('#interaction-comment').inputValue(),'My concurrent draft');assert.equal((await record()).body,'A different session updated this interaction');assert.equal(putCount,committed,'Concurrent edits are detected before sending another write');
 page.once('dialog',d=>d.accept());await click('Close');await page.getByRole('button',{name:'Conversations',exact:true}).click();await pop.locator(`[data-entry="${interaction.id}"]`).click();await click('Edit');
 await page.locator('#interaction-comment').fill('Another saved edit');loseNextAcknowledgement=true;await click('Save changes');await pop.getByRole('alert').filter({hasText:'acknowledgement was lost'}).waitFor();
 await page.locator('#interaction-comment').fill('Further typing after the lost acknowledgement');await click('Save changes');await pop.getByRole('alert').filter({hasText:'draft has further changes'}).waitFor();
 assert.equal(await page.locator('#interaction-comment').inputValue(),'Further typing after the lost acknowledgement');assert.equal((await record()).body,'Another saved edit');assert.deepEqual(errors,[]);
 console.log('Edited interaction retries acknowledge lost saves, preserve concurrent drafts, and never discard further typing or duplicate revisions.');
}catch(error){await mkdir('build/design-review',{recursive:true});for(const page of browser.contexts().flatMap(c=>c.pages())){await page.screenshot({path:'build/design-review/interaction-retry-failure.png',fullPage:true});console.error((await page.locator('body').innerText()).slice(-4000));}throw error;}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
