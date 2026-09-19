import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {validateAccountChanges} from '../worker/account-policy.mjs';
import {recordComparison} from '../dist/workspace.mjs';
import {startAccountComparison} from '../worker/account-api.mjs';

// Real browser interactions against the real account projection and write policy,
// using two isolated browser contexts and an in-memory database, never live data.
const playwright=process.env.HARMONIOUS_PLAYWRIGHT;
if(!playwright)throw Error('Set HARMONIOUS_PLAYWRIGHT to the installed playwright entry point.');
const {chromium}=await import(pathToFileURL(playwright));
const store=memoryStore();for(const actor of [alice,bob]){await seedActor(store,actor);await edit(store,actor,ws=>{const map=ws.maps.find(m=>m.ownerId===actor.id);map.name=actor.name+' worldview';map.visibility='shared';addNode(ws,actor,actor.name+' position');});}
const aData=await view(store,alice),aMap=aData.workspace.maps.find(m=>m.ownerId===alice.id),bMap=aData.workspace.maps.find(m=>m.ownerId===bob.id);
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'),actor=req.headers['x-test-actor']==='bob'?bob:alice;
    if(url.pathname.startsWith('/api/')){
      res.setHeader('content-type','application/json');let result;let body='';for await(const chunk of req)body+=chunk;const input=body?JSON.parse(body):null;
      if(url.pathname==='/api/session')result={configured:true,actor,signup:{mode:'public'}};
      else if(url.pathname==='/api/comparisons')result=await startAccountComparison(store,actor.id,input);
      else if(url.pathname==='/api/workspace'&&req.method==='PUT'){const snapshot=await store.snapshot(),accepted=validateAccountChanges(snapshot,actor.id,input.changes);result=await store.commit(actor.id,snapshot.revision,accepted);}
      else result={...await view(store,actor),actor};
      res.end(JSON.stringify(result));return;
    }
    const name=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!/^[a-z0-9.-]+$/.test(name)){res.writeHead(404);res.end();return;}
    let content=await readFile(resolve('dist',name),'utf8');if(name==='index.html')content=content.replace('src="./app.mjs"','src="./beta-boot.mjs"').replace('</head>','<link rel="stylesheet" href="./accounts.css"></head>');
    res.setHeader('content-type',name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'text/javascript');res.end(content);
  }catch(error){res.writeHead(error.status||500,{'content-type':'application/json'});res.end(JSON.stringify({error:error.message}));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:process.env.HARMONIOUS_BROWSER||'msedge'});const errors=[];
try{
  const aContext=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{'x-test-actor':'alice'}}),bContext=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{'x-test-actor':'bob'}});
  const a=await aContext.newPage(),b=await bContext.newPage();for(const page of [a,b])page.on('pageerror',e=>errors.push(e.message));
  const visible=async(page,id)=>assert(await page.locator('#'+id).isVisible(),id+' should be visible');
  const saved=page=>page.waitForFunction(()=>document.getElementById('storage-status')?.textContent.includes('All changes saved'));
  await a.goto(origin);await a.locator('#library-results .library-card').first().waitFor();await visible(a,'library-workspace');assert(!(await a.locator('#editor-main').isVisible()));
  assert.deepEqual(await a.locator('.topbar .mode-tabs button').allTextContents(),['Map Library','Maps','Comparisons','Pods']);
  assert.equal(await a.locator('#library-results .library-card h2').allTextContents().then(x=>x.join()),'Alice worldview');
  await a.locator('#individual-mode').click();await visible(a,'library-workspace');
  await mkdir('build/design-review',{recursive:true});await a.screenshot({path:'build/design-review/library.png',fullPage:true});
  await a.getByRole('button',{name:'Open map',exact:true}).click();await visible(a,'editor-main');assert.equal(await a.locator('#map-heading').textContent(),'Alice worldview');
  await a.locator('.node-add-child').first().click();await a.locator('#on-map-child-kind').selectOption('question');await a.getByRole('button',{name:'Create child',exact:true}).click();await a.locator('#title').fill('An inline child question');await a.locator('#edit-form button[type=submit]').click();await saved(a);
  await a.locator('#close').click();if(await a.locator('#all').isEnabled())await a.locator('#all').click();await a.locator('.node-main').filter({hasText:'An inline child question'}).click();await a.screenshot({path:'build/design-review/node-actions.png',fullPage:true});
  await a.locator('#comparison-mode').click();await a.locator('#library-results').getByRole('button',{name:'Choose maps'}).click();
  await a.locator('#compare-map-a').selectOption(aMap.id);await a.locator('#compare-map-b').selectOption(bMap.id);await a.locator('#start-comparison').click();await a.locator('#workspace-message').filter({hasText:'Comparison saved'}).waitFor();
  await edit(store,alice,ws=>{const r=recordComparison(ws,{aMapId:aMap.id,bMapId:bMap.id,aNodeId:aMap.nodes.find(n=>n.parent!==null).id,bNodeId:bMap.nodes.find(n=>n.parent!==null).id,questionStatus:'matched',question:'What should we do together?',answerStatus:'aligned',notes:''},null,alice.id);ws.comparisons.push(r);});
  await a.reload();await a.locator('.comparison-view-options>summary').click();await a.getByRole('button',{name:'Earlier records',exact:true}).click();await a.locator('#comparison-records .comparison-record').first().click();
  await a.screenshot({path:'build/design-review/compare.png',fullPage:true});const compareURL=a.url();
  assert.equal(await a.locator('#workspace-nav').isVisible(),false,'Comparison should not reserve a separate global navigation row');
  assert.equal(await a.locator('#comparison-commandbar').evaluate(el=>el.parentElement?.id),'comparison-context','Comparison controls share the context row');
  const identities=await a.locator('.comparison-identity').evaluateAll(nodes=>nodes.map(n=>({map:n.querySelector('strong').textContent,owner:n.querySelector('small').textContent,tone:n.dataset.identity})));assert.deepEqual(identities.map(({map,owner})=>({map,owner})),[{map:'Alice worldview',owner:'Alice'},{map:'Bob worldview',owner:'Bob'}]);assert.equal(new Set(identities.map(x=>x.tone)).size,2,'Comparison identities use distinct stable tones');
  assert.deepEqual(new Set(await a.locator('#compare-canvas .node').evaluateAll(nodes=>nodes.map(n=>n.dataset.identity))).size,2,'Both maps use distinct ownership accents');
  assert(await a.locator('#compare-canvas .node-meta').filter({hasText:'Alice'}).count()>0&&await a.locator('#compare-canvas .node-meta').filter({hasText:'Bob'}).count()>0,'Nodes name their map owners');
  await a.getByRole('button',{name:'Close records',exact:true}).click();await a.locator('.comparison-view-options>summary').click();await a.locator('#argument-mode').click();await visible(a,'argument-workspace');assert(await a.locator('#comparison-mode').evaluate(el=>el.closest('.mode-tabs')!==null));
  await a.locator('#argument-title').fill('A shared starting point');await a.locator('#argument-body').fill('We both need a clear question.');await a.locator('#argument-attach').selectOption('source:a');await a.locator('#argument-node-form button[type=submit]').click();await saved(a);
  await a.locator('#argument-new').click();await a.locator('#argument-title').fill('Draft preserved between modes');await a.locator('#compare-view-mode').click();await a.locator('.comparison-view-options>summary').click();await a.locator('#argument-mode').click();assert.equal(await a.locator('#argument-title').inputValue(),'Draft preserved between modes');
  a.once('dialog',d=>d.dismiss());await a.locator('#comparison-library').click();await visible(a,'argument-workspace');assert.equal(await a.locator('#argument-title').inputValue(),'Draft preserved between modes');
  a.once('dialog',d=>d.accept());await a.locator('#argument-new').click();await a.screenshot({path:'build/design-review/argument.png',fullPage:true});const argumentURL=a.url();
  await b.goto(origin);await b.locator('#library-results .library-card').first().waitFor();await b.locator('#comparison-mode').click();assert.equal(await b.locator('#library-results .library-card').count(),2,'Both owners see the same overall comparison');
  await b.locator('#library-search').fill('no matching worldview here');assert.match(await b.locator('#library-results .library-empty').innerText(),/No matching work/);assert.equal(await b.locator('#library-results').getByRole('button',{name:'Choose maps',exact:true}).count(),0,'The creation card is not a false search match');
  await b.locator('#library-search').fill('');assert.equal(await b.locator('#library-results .library-card').count(),2);await b.locator('#library-results').getByRole('button',{name:'Choose maps',exact:true}).isVisible().then(assert);await b.getByRole('button',{name:'Open comparison',exact:true}).click();
  await b.locator('.comparison-view-options>summary').click();await b.getByRole('button',{name:'Earlier records',exact:true}).click();await b.locator('#comparison-records .comparison-record').first().click();await b.locator('#question-status').selectOption('matched');await b.locator('#answer-status').selectOption('aligned');await b.locator('#record-comparison').click();await saved(b);assert.match(await b.locator('#comparison-context-state').textContent(),/agree/i);
  await b.goto(argumentURL);await b.locator('#argument-records .comparison-record').first().waitFor();await b.locator('#argument-records .comparison-record').first().click();assert(await b.locator('#argument-title').isDisabled(),'Cannot edit another author’s reason');await b.locator('#argument-new').click();await b.locator('#argument-kind').selectOption('value');await b.locator('#argument-title').fill('A second perspective');await b.locator('#argument-node-form button[type=submit]').click();await saved(b);
  await a.goto(argumentURL);await a.locator('#argument-records .comparison-record').filter({hasText:'A second perspective'}).waitFor();
  await a.goto(origin+'/#map='+aMap.id);await visible(a,'editor-main');await a.locator('#map-heading').filter({hasText:'Alice worldview'}).waitFor();
  await a.goto(origin+'/#map=missing');await visible(a,'library-workspace');await a.locator('#workspace-message').filter({hasText:'unavailable'}).waitFor();
  await a.goto(compareURL);await a.locator('#comparison-context').waitFor();const foreignSide=(await a.locator('#compare-map-a').inputValue())===bMap.id?'a':'b';await a.locator('#edit-source-'+foreignSide).isDisabled().then(assert);
  await a.locator('#source-summary-'+foreignSide+' button').filter({hasText:'Copy & adapt'}).click();await a.locator('#adoption-dialog').waitFor();await a.locator('#close-adoption').click();
  await a.locator('#edit-source-'+foreignSide).locator('..').getByRole('button',{name:'View source map'}).click();await visible(a,'discover-workspace');assert(!(await a.locator('.discovery-catalog').isVisible()));await a.locator('#my-endorsements').click();await visible(a,'endorsement-history');await a.locator('#browse-endorsements').click();
  await a.locator('#pods-mode').click();await a.getByRole('button',{name:'Inspect derived pod'}).first().click();await visible(a,'pods-workspace');
  await a.setViewportSize({width:390,height:844});await a.locator('#discover-mode').click();await visible(a,'library-workspace');await a.screenshot({path:'build/design-review/library-mobile.png',fullPage:true});
  assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Mobile layout must not overflow horizontally');
  const navBounds=await a.locator('.topbar .mode-tabs').boundingBox();assert(navBounds&&navBounds.y>=0&&navBounds.height>0,'Main navigation remains visible on mobile');
  await a.goto(compareURL);await a.locator('#comparison-context').waitFor();await a.screenshot({path:'build/design-review/compare-mobile.png',fullPage:true});await a.locator('.comparison-view-options>summary').click();await a.locator('#argument-mode').click();await a.screenshot({path:'build/design-review/argument-mobile.png',fullPage:true});
  await a.goto(origin+'/#map='+aMap.id);await a.locator('.node-main').first().waitFor();await a.locator('.node-main').first().focus();await a.keyboard.press('Enter');assert(await a.locator('.on-map-actions').isVisible());assert(!(await a.locator('#inspector').isVisible()));await a.locator('.on-map-actions').getByRole('button',{name:'Edit',exact:true}).click();await visible(a,'inspector');
  await a.goto(origin);await a.locator('#library-workspace').waitFor();await a.getByRole('button',{name:'Create map',exact:true}).click();await a.locator('#map-name-input').fill('A new private map');await a.locator('#confirm-map').click();await saved(a);assert.equal(await a.locator('#map-heading').textContent(),'A new private map');assert.equal((await view(store,bob)).workspace.maps.some(m=>m.name==='A new private map'),false,'New map defaults to private');
  assert.deepEqual(errors,[]);console.log('Browser checks passed: Library, explicit selection, inline child, shared comparisons, mode drafts, bilateral judgments, authored reasoning, reload, routes, copy access, pods and mobile.');
  const portable=await browser.newPage();portable.on('pageerror',e=>errors.push(e.message));await portable.goto(pathToFileURL(resolve('review/Harmonious-radial.html')).href);await portable.locator('#library-results .library-card').first().waitFor();assert(!(await portable.locator('#editor-main').isVisible()));await portable.getByRole('button',{name:'Open map',exact:true}).first().click();await portable.locator('#editor-main').waitFor();assert.deepEqual(errors,[]);console.log('Portable export also opens in Library and requires map selection.');
}catch(error){for(const [index,context]of browser.contexts().entries())for(const page of context.pages()){await page.screenshot({path:`build/design-review/failure-${index}.png`,fullPage:true});console.error((await page.locator('body').innerText()).slice(-5000));}console.error('Browser errors:',errors);throw error;}finally{await browser.close();await new Promise(r=>server.close(r));}
