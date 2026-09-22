import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {validateAccountChanges} from '../worker/account-policy.mjs';
import {synchronizeIdeas} from '../dist/adoption.mjs';

// Exercise the actual editor and account write policy with disposable maps.
if(!process.env.HARMONIOUS_PLAYWRIGHT)throw Error('Set HARMONIOUS_PLAYWRIGHT.');
const {chromium}=await import(pathToFileURL(process.env.HARMONIOUS_PLAYWRIGHT));
const store=memoryStore();
for(const actor of [alice,bob]){await seedActor(store,actor);await edit(store,actor,ws=>{const map=ws.maps.find(m=>m.ownerId===actor.id);map.visibility='shared';const n=addNode(ws,actor,actor.name+' claim');n.kind='position';const goal=addNode(ws,actor,actor.name+' goal');goal.kind='position';goal.parent='goal';synchronizeIdeas(ws,map);});}
const initial=(await view(store,alice)).workspace,map=initial.maps.find(m=>m.ownerId===alice.id),claim=map.nodes.find(n=>n.title==='Alice claim'),goal=map.nodes.find(n=>n.title==='Alice goal');
const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){
    res.setHeader('content-type','application/json');let raw='';for await(const chunk of req)raw+=chunk;const input=raw?JSON.parse(raw):null;let result;
    if(url.pathname==='/api/session')result={configured:true,actor:alice,signup:{mode:'public'}};
    else if(url.pathname==='/api/workspace'&&req.method==='PUT'){const snapshot=await store.snapshot();result=await store.commit(alice.id,snapshot.revision,validateAccountChanges(snapshot,alice.id,input.changes));}
    else result={...await view(store,alice),actor:alice};res.end(JSON.stringify(result));return;
  }
  const name=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!/^[a-z0-9.-]+$/.test(name)){res.writeHead(404);res.end();return;}
  let content=await readFile(resolve('dist',name),'utf8');if(name==='index.html')content=content.replace('src="./app.mjs"','src="./beta-boot.mjs"').replace('</head>','<link rel="stylesheet" href="./accounts.css"></head>');
  res.setHeader('content-type',name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'text/javascript');res.end(content);
}catch(error){res.writeHead(error.status||500,{'content-type':'application/json'});res.end(JSON.stringify({error:error.message}));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:process.env.HARMONIOUS_BROWSER||'msedge'}),errors=[];
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
  const saved=()=>page.waitForFunction(()=>document.getElementById('storage-status')?.textContent.includes('All changes saved'));
  const data=async()=>((await view(store,alice)).workspace.maps.find(m=>m.id===map.id));
  const choose=async id=>{const button=page.locator(`#cards .node[data-id="${id}"] .node-main`);await button.focus();await page.keyboard.press('Enter');};
  await page.goto(origin+'/#map='+map.id);await page.locator('#editor-main').waitFor();await page.locator('#all').click();await choose(claim.id);
  for(const id of ['kind-group','structural-group','time-group'])assert.equal(await page.locator('#'+id).isVisible(),false);
  assert.equal(await page.locator('#add-example,#child-kind,#on-map-child-kind').count(),0);
  // Native buttons remain keyboard-operable, and a reason is an explicit child→claim connection.
  const create=page.locator('.on-map-actions').getByRole('button',{name:'Create reason',exact:true});await create.focus();await page.keyboard.press('Enter');
  await page.locator('#title').fill('A verifiable reason');await page.locator('#source-title').fill('Reference citation');await page.locator('#source-url').fill('https://example.org/source');await page.locator('#edit-form button[type=submit]').click();await saved();
  let current=await data();const reason=current.nodes.find(n=>n.title==='A verifiable reason'),edge=current.relations.find(e=>e.from===reason.id&&e.to===claim.id);
  assert.equal(reason.kind,'position');assert.equal(reason.structuralType,'nesting');assert.equal(reason.parent,claim.id);assert.equal(edge.type,'reason');assert.equal(reason.sourceUrl,'https://example.org/source');
  assert.equal(await page.locator('#relationships .semantic-edge').count(),1);
  assert.equal(await page.locator('#connections .edge:not(.spine)').count(),2,'Semantic reason replaces its duplicate parent line; only the two frame→claim structural lines remain');
  await page.locator('#add-child').click();await page.locator('#title').fill('An ordinary nested statement');await page.locator('#edit-form button[type=submit]').click();await saved();
  current=await data();const nested=current.nodes.find(n=>n.title==='An ordinary nested statement');assert.equal(nested.kind,'position');assert.equal(nested.structuralType,'nesting');assert.equal(current.relations.some(e=>e.from===nested.id||e.to===nested.id),false,'Plain nesting adds no semantic claim');
  await page.locator('#connect').click();assert.equal(await page.locator('#connection-target option[value="goal"]').count(),0);await page.locator('#connection-target').selectOption(goal.id);assert.deepEqual(await page.locator('#connection-type option').evaluateAll(options=>options.map(o=>o.value)),['reason','cause']);
  page.once('dialog',d=>d.accept());await page.locator('#cancel-connect').click();await page.locator('#close').click();if(await page.locator('#all').isEnabled())await page.locator('#all').click();await choose('status');assert.equal(await page.locator('.on-map-actions').getByRole('button',{name:'Create reason',exact:true}).count(),0,'Frames are containers, not claims to justify');assert.equal(await page.locator('.on-map-actions').getByRole('button',{name:'Connect',exact:true}).count(),0);
  await page.locator('#close').click();await page.setViewportSize({width:390,height:844});await page.locator('#fit').click();await choose(reason.id);const bounds=await page.locator('.on-map-actions').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=390);
  await mkdir('build/design-review',{recursive:true});await page.screenshot({path:'build/design-review/map-grammar-mobile.png',fullPage:true});await page.reload();await page.locator('#editor-main').waitFor();current=await data();assert.equal(current.relations.find(e=>e.id===edge.id).type,'reason');assert.deepEqual(errors,[]);
  console.log('Map grammar browser checks passed: simple statement creation, keyboard-created directed reasons, one visible edge per pair, preserved citations, cross-frame types, frame containers, reload and narrow layout.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
