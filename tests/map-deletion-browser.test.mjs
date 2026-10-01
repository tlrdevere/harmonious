import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {alice,bob,memoryStore,seedActor,view,edit} from './accounts.test.mjs';
import {deleteAccountMap,saveAccountChanges} from '../worker/account-api.mjs';
const {chromium}=await import(pathToFileURL(process.env.HARMONIOUS_PLAYWRIGHT));
const store=memoryStore(),errors=[];let dropDelete=false;
for(const actor of [alice,bob])await seedActor(store,actor);
const id=(await view(store,alice)).workspace.maps[0].id;
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost'),actor=alice;
 if(url.pathname.startsWith('/api/')){
  res.setHeader('content-type','application/json');let raw='';for await(const chunk of req)raw+=chunk;const input=raw?JSON.parse(raw):null;let result;
  if(url.pathname==='/api/session')result={configured:true,actor,signup:{mode:'public'}};
  else if(url.pathname==='/api/workspace'&&req.method==='PUT')result=await saveAccountChanges(store,actor.id,input.changes);
  else if(url.pathname==='/api/maps/delete'){result=await deleteAccountMap(store,actor,input);if(dropDelete){dropDelete=false;res.statusCode=503;res.end(JSON.stringify({error:'Connection interrupted. Please retry.'}));return;}}
  else result={...await view(store,actor),actor};res.end(JSON.stringify(result));return;
 }
 const name=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!/^[a-z0-9.-]+$/.test(name)){res.writeHead(404);res.end();return;}
 let content=await readFile(resolve('dist',name),'utf8');if(name==='index.html')content=content.replace('src="./app.mjs"','src="./beta-boot.mjs"').replace('</head>','<link rel="stylesheet" href="./accounts.css"></head>');
 res.setHeader('content-type',name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'text/javascript');res.end(content);
}catch(error){res.writeHead(error.status||500,{'content-type':'application/json'});res.end(JSON.stringify({error:error.message}));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:process.env.HARMONIOUS_BROWSER||'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/#library=maps');
 const action=()=>page.locator('#library-results').getByRole('button',{name:'Delete map',exact:true});
 await action().waitFor();assert.equal(await action().count(),1);
 const before=await store.snapshot();
 await action().focus();await page.keyboard.press('Enter');await page.locator('#delete-map-dialog').waitFor();
 assert.equal(await page.locator('#delete-map-name').innerText(),'My worldview');
 assert(await page.locator('#delete-map-cancel').evaluate(e=>e===document.activeElement));
 await page.keyboard.press('Escape');assert.deepEqual(await store.snapshot(),before,'Cancel never changes records');
 await action().click();await edit(store,alice,w=>{w.maps[0].name='Changed elsewhere';});
 await page.locator('#delete-map-confirm').click();await page.locator('#delete-map-error').filter({hasText:'changed in another session'}).waitFor();
 assert(!(await store.snapshot()).records.find(r=>r.id===id).value.deletedAt);
 await page.locator('#delete-map-cancel').click();await page.reload();await action().click();
 await mkdir('build/design-review',{recursive:true});await page.screenshot({path:'build/design-review/map-deletion-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'build/design-review/map-deletion-narrow.png'});
 dropDelete=true;await page.locator('#delete-map-confirm').click();await page.locator('#delete-map-error').filter({hasText:/Connection interrupted/i}).waitFor();
 const committed=await store.snapshot();
 await page.locator('#delete-map-confirm').click();await page.locator('#delete-map-dialog').waitFor({state:'hidden'});
 assert.deepEqual(await store.snapshot(),committed,'Retry after lost response does not write twice');
 assert.equal(await action().count(),0);await page.reload();
 await page.locator('#library-results .library-empty').waitFor();assert.equal(await action().count(),0);
 await page.locator('#library-create').getByRole('button',{name:'Create map',exact:true}).click();await page.locator('#map-name-input').fill('After deletion');await page.locator('#confirm-map').click();
 await page.waitForFunction(()=>document.getElementById('storage-status')?.textContent.includes('All changes saved'));
 assert((await view(store,alice)).workspace.maps.some(m=>m.name==='After deletion'));
 assert.deepEqual(errors,[]);
 console.log('Map deletion browser: confirmation, cancel, conflict, lost response, empty library and creating another map passed.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
