import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {accountWorkspace,saveAccountChanges,startAccountComparison} from '../worker/account-api.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {synchronizeIdeas} from '../dist/adoption.mjs';
import {isReflection,isDisagreementPoint,isReflectionOutcome} from '../dist/reflection.mjs';
import {challengeState} from '../dist/conversation-tree.mjs';

// Disposable two-account UI exercising the real read/save API, including lost ACKs.
const playwright=process.env.HARMONIOUS_PLAYWRIGHT;if(!playwright)throw Error('Set HARMONIOUS_PLAYWRIGHT.');
const {chromium}=await import(pathToFileURL(playwright)),store=memoryStore(),ids={};
for(const actor of [alice,bob]){await seedActor(store,actor);await edit(store,actor,ws=>{const map=ws.maps.find(m=>m.ownerId===actor.id);map.visibility='shared';map.name=actor.name+' reflection map';for(const title of actor===alice?['Evening meeting','Quiet source without reasons','Nested source']:['Daytime meeting']){const n=addNode(ws,actor,title);n.kind='position';n.parent=title==='Nested source'?ids['Evening meeting']:'status';n.summary='Original source explanation for '+title;ids[title]=n.id;}synchronizeIdeas(ws,map);});}
const initial=(await view(store,alice)).workspace,aMap=initial.maps.find(m=>m.ownerId===alice.id),bMap=initial.maps.find(m=>m.ownerId===bob.id),at={type:'node',mapId:aMap.id,nodeId:ids['Evening meeting']};
const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:aMap.id,bMapId:bMap.id});
const seed=async(actor,input)=>{let result;await edit(store,actor,ws=>{result=makeDiscussion(ws,{comparisonId:thread.id,...input},actor.id);ws.discussions.push(result);});return result;};
const reason=await seed(alice,{kind:'argument',action:'reason',target:at,body:'Most respondents prefer evening.'}),child=await seed(alice,{kind:'argument',action:'reason',target:{type:'entry',entryId:reason.id},body:'Eighteen replies chose the evening slot.'}),challenge=await seed(bob,{kind:'argument',action:'challenge',target:{type:'inference',entryId:reason.id},body:'Respondents may not represent all members.'});
const originalMaps=structuredClone((await view(store,alice)).workspace.maps);let loseNext=false,failBeforeNext=false,raceNextOutcome=false;const writes=[],errors=[],uncertain=[];
const json=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),actor=req.headers['x-test-actor']==='bob'?bob:alice;if(url.pathname.startsWith('/api/')){let raw='';for await(const chunk of req)raw+=chunk;const input=raw?JSON.parse(raw):null;if(url.pathname==='/api/session'){json(res,200,{configured:true,actor,signup:{mode:'public'}});return;}if(url.pathname==='/api/comparisons'){json(res,200,await startAccountComparison(store,actor.id,input));return;}if(url.pathname==='/api/workspace'&&req.method==='PUT'){if(failBeforeNext&&input.changes.some(c=>c.kind==='discussion'&&isReflection(c.value))){failBeforeNext=false;uncertain.push(input.changes);json(res,503,{error:'The write has not been acknowledged.'});return;}if(raceNextOutcome){const outcome=input.changes.find(c=>c.kind==='discussion'&&isReflectionOutcome(c.value))?.value;if(outcome){raceNextOutcome=false;await seed(actor,{kind:'reflection',action:'outcome',layer:'arguments',target:outcome.target,body:'Another window already saved my assessment.',reflection:{result:'more_work',nextStep:''}});}}const result=await saveAccountChanges(store,actor.id,input.changes);writes.push(input.changes);if(loseNext&&input.changes.some(c=>c.kind==='discussion'&&isReflection(c.value))){loseNext=false;json(res,503,{error:'The annotation acknowledgment was lost.'});return;}json(res,200,result);return;}json(res,200,await accountWorkspace(store,actor));return;}const name=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!/^[a-z0-9.-]+$/.test(name)){res.writeHead(404);res.end();return;}let content=await readFile(resolve('dist',name),'utf8');if(name==='index.html')content=content.replace('src="./app.mjs"','src="./beta-boot.mjs"').replace('</head>','<link rel="stylesheet" href="./accounts.css"></head>');res.setHeader('content-type',name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'text/javascript');res.end(content);}catch(e){json(res,e.status||500,{error:e.message});}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true,channel:process.env.HARMONIOUS_BROWSER||'msedge'});
try{
  await mkdir('build/design-review',{recursive:true});const pages=[];for(const actor of ['alice','bob']){const ctx=await browser.newContext({reducedMotion:'reduce',viewport:{width:1440,height:1000},extraHTTPHeaders:{'x-test-actor':actor}}),page=await ctx.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));pages.push(page);}const [a,b]=pages,pop=p=>p.locator('.discussion-popover'),action=(p,name)=>pop(p).getByRole('button',{name,exact:true}).click(),close=async p=>{if(await pop(p).isVisible())await action(p,'Close');},saved=p=>p.waitForFunction(()=>document.getElementById('storage-status')?.textContent.includes('All changes saved'));
  const records=async()=>((await view(store,alice)).workspace.discussions),byBody=async body=>(await records()).find(r=>r.body===body);
  let nav=0;const expand=async p=>{await p.locator('.comparison-view-options>summary').click();for(const side of ['a','b'])await p.locator('#compare-all-'+side).click();await p.locator('.comparison-view-options>summary').click();};const load=async p=>{await p.goto(origin+'/?load='+(++nav)+'#comparison='+thread.id);await expand(p);};
  const node=async(p,title)=>{await close(p);const button=p.locator('#compare-canvas .node-main').filter({has:p.getByText(title,{exact:true})}).first();await button.focus();await p.keyboard.press('Enter');};
  const card=async(p,id)=>{await close(p);const button=p.locator(`.reasoning-card[data-entry="${id}"] .reasoning-main`);await button.focus();await p.keyboard.press('Enter');};
  const follow=async p=>{await node(p,'Evening meeting');await p.locator('#reasoning-argument-mode').click();await close(p);const counter=p.getByRole('button',{name:/reasons attached to Evening meeting/}).first();await counter.click();};
  const find=async(p,query)=>{await close(p);await p.getByRole('button',{name:'Find in argument',exact:true}).click();const search=p.locator('.reasoning-search');await search.getByRole('searchbox',{name:'Search argument'}).fill(query);await search.getByRole('button',{name:'Show on map',exact:true}).click();};
  const submitPoint=async(p,body,{category='',retry=false}={})=>{await action(p,'Mark point of disagreement');await p.locator('#reflection-body').fill(body);if(category){await pop(p).getByText('Type of disagreement (optional)',{exact:true}).click();await p.locator('#reflection-category').selectOption(category);}if(retry)loseNext=true;await action(p,'Save point');if(!retry)await pop(p).getByRole('button',{name:'Record my outcome',exact:true}).waitFor();return byBody(body);};
  const noAnnotationCards=async p=>{const annotations=(await records()).filter(isReflection);for(const r of annotations)assert.equal(await p.locator(`.reasoning-card[data-entry="${r.id}"]`).count(),0,'Annotations never become graph cards');};


  await load(a);await follow(a);await card(a,child.id);
  const savedPoint=await submitPoint(a,'Review reproduction saved point.');
  await card(a,child.id);await action(a,'Mark point of disagreement');await a.locator('#reflection-body').fill('Review reproduction draft.');
  await edit(store,alice,ws=>{const old=ws.discussions.find(r=>r.id===child.id);const next=makeDiscussion(ws,{...old,referenceUrl:'https://example.org/new-evidence-reference'},alice.id,old);ws.discussions=ws.discussions.map(r=>r.id===old.id?next:r);});
  await action(a,'Save point');await pop(a).getByRole('button',{name:'I reviewed the updated source',exact:true}).waitFor();
  const reviewText=await pop(a).locator('.reflection-source-review').innerText();
  assert(reviewText.includes('https://example.org/new-evidence-reference'));assert.equal(await pop(a).locator('.reflection-source-review a').getAttribute('href'),'https://example.org/new-evidence-reference');
  console.log('Reference-only change is visible:',reviewText);
  await a.screenshot({path:'build/design-review/reflection-review-hidden-reference.png',fullPage:true});
  a.once('dialog',d=>d.accept());await close(a);
  await find(a,savedPoint.body);loseNext=true;a.once('dialog',d=>d.accept());await action(a,'Withdraw');
  await pop(a).getByRole('alert').filter({hasText:'acknowledgment was lost'}).waitFor();
  assert.equal((await byBody(savedPoint.body)).status,'withdrawn');
  a.once('dialog',d=>d.accept());await action(a,'Withdraw');
  await pop(a).getByText('Recorded by Alice · Withdrawn',{exact:true}).waitFor();
  assert.equal(await pop(a).getByRole('button',{name:'Withdraw',exact:true}).count(),0);assert.equal((await byBody(savedPoint.body)).history.length,1);
  console.log('Lost withdrawal acknowledgment recovered.');
  await a.screenshot({path:'build/design-review/reflection-review-withdraw-retry.png',fullPage:true});
  await close(a);
  await load(a);await a.locator('#reasoning-argument-mode').click();await close(a);
  const edge=a.locator('.discussion-edge-hit:not(.discussion-relationship-hit)').first();await edge.focus();await a.keyboard.press('Enter');
  const edgePoint=await submitPoint(a,'Review reproduction collapsed edge.');
  const sourceMap=(await view(store,alice)).workspace.maps.find(m=>m.id===edgePoint.target.mapId);
  const sourceNode=sourceMap.nodes.find(n=>'structure:'+n.id===edgePoint.target.edgeId);
  assert(sourceNode&&sourceNode.parent!==null);
  await close(a);await a.locator('.comparison-view-options>summary').click();for(const side of ['a','b'])await a.locator('#compare-collapse-'+side).click();await a.locator('.comparison-view-options>summary').click();
  await find(a,edgePoint.body);
  const visibleSource=a.locator('#compare-canvas .node-main').filter({has:a.getByText(sourceNode.title,{exact:true})});
  console.log('EDGE SHOW ON MAP',JSON.stringify({target:edgePoint.target,sourceTitle:sourceNode.title,visibleCards:await visibleSource.count(),popover:await pop(a).innerText()}));
  assert.equal(await visibleSource.count(),1);
  await a.screenshot({path:'build/design-review/reflection-review-collapsed-edge.png',fullPage:true});
  // Reduced motion fixes the initial camera at the completed collapse position.
  // Explicit map connections reveal both endpoints at that current zoom.
  await edit(store,alice,ws=>{const map=ws.maps.find(m=>m.id===aMap.id);map.relations.push({id:'review-explicit-edge',from:ids['Nested source'],to:ids['Quiet source without reasons'],type:'related',note:''});map.revision++;});
  const explicitPoint=await seed(alice,{kind:'reflection',action:'disagreement_point',layer:'arguments',target:{type:'edge',mapId:aMap.id,edgeId:'review-explicit-edge'},body:'An explicit connection to inspect',reflection:{category:'reasoning'}});
  await load(a);await a.locator('#reasoning-argument-mode').click();await close(a);await a.locator('.comparison-view-options>summary').click();for(const side of ['a','b'])await a.locator('#compare-collapse-'+side).click();await a.locator('.comparison-view-options>summary').click();const scale=()=>a.locator('#compare-canvas .comparison-world').evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).a);const priorScale=await scale();await find(a,explicitPoint.body);for(const title of ['Nested source','Quiet source without reasons'])assert.equal(await a.locator('#compare-canvas .node-main').filter({has:a.getByText(title,{exact:true})}).count(),1);assert.equal(await scale(),priorScale);
  await node(a,'Nested source');await action(a,'Mark point of disagreement');await a.locator('#reflection-body').fill('Review a node reference');await edit(store,alice,ws=>{const map=ws.maps.find(m=>m.id===aMap.id);const n=map.nodes.find(n=>n.id===ids['Nested source']);n.sourceTitle='Attendance register';n.sourceUrl='https://example.org/attendance';map.revision++;synchronizeIdeas(ws,map);});await action(a,'Save point');await pop(a).getByRole('button',{name:'I reviewed the updated source',exact:true}).waitFor();assert.match(await pop(a).locator('.reflection-source-review').innerText(),/Attendance register[\s\S]*https:\/\/example.org\/attendance/);assert.equal(await a.locator('#reflection-body').inputValue(),'Review a node reference');a.once('dialog',d=>d.accept());await close(a);
  // Outcome withdrawals share the same retry identity; genuine edits still conflict.
  const outcome=await seed(alice,{kind:'reflection',action:'outcome',layer:'arguments',target:{type:'entry',entryId:edgePoint.id},body:'My retryable outcome',reflection:{result:'more_work',nextStep:'Inspect the assumption'}});
  await load(a);await a.locator('#reasoning-argument-mode').click();await find(a,outcome.body);loseNext=true;a.once('dialog',d=>d.accept());await action(a,'Withdraw');await pop(a).getByRole('alert').filter({hasText:'acknowledgment was lost'}).waitFor();a.once('dialog',d=>d.accept());await action(a,'Withdraw');await pop(a).getByText('Recorded by Alice · Withdrawn',{exact:true}).waitFor();assert.equal((await byBody(outcome.body)).history.length,1);
  await find(a,edgePoint.body);await edit(store,alice,ws=>{const old=ws.discussions.find(r=>r.id===edgePoint.id);ws.discussions=ws.discussions.map(r=>r.id===old.id?makeDiscussion(ws,{...old,body:'Concurrent revised point'},alice.id,old):r);});a.once('dialog',d=>d.accept());await action(a,'Withdraw');await pop(a).getByRole('alert').filter({hasText:'changed in another window'}).waitFor();assert.equal((await byBody('Concurrent revised point')).status,'active');a.once('dialog',d=>d.accept());await close(a);
  // Discovery stays inside Comparisons and never chooses the user's map for them.
  await a.goto(origin+'/?discovery#library=comparisons');await a.getByRole('button',{name:'Find a shared map',exact:true}).click();assert.equal(await a.locator('#library-results .library-card').count(),1);await a.locator('#library-search').fill('Bob');assert.equal(await a.locator('#library-results .library-card').count(),1);await a.locator('#library-search').fill('No such person');assert.equal(await a.locator('#library-results .library-card').count(),0);await a.locator('#library-search').fill('Bob');await a.getByRole('button',{name:'Compare with my map',exact:true}).click();assert.equal(await a.locator('#compare-map-b').inputValue(),bMap.id);assert.equal(await a.locator('#compare-map-a').inputValue(),'');
  await a.goto(origin+'/?discovery-mobile#library=comparisons');await a.getByRole('button',{name:'Find a shared map',exact:true}).click();await a.setViewportSize({width:390,height:844});assert(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await a.screenshot({path:'build/design-review/discovery-mobile.png',fullPage:true});await a.setViewportSize({width:1440,height:1000});await a.screenshot({path:'build/design-review/discovery-desktop.png',fullPage:true});
  await edit(store,bob,ws=>{ws.maps.find(m=>m.id===bMap.id).visibility='private';});await a.reload();await a.getByRole('button',{name:'Find a shared map',exact:true}).click();assert.equal(await a.locator('#library-results .library-card').count(),0);assert.deepEqual(errors,[]);
  console.log('Stabilization regressions passed: visible source references, withdrawal retries and conflict, collapsed edge reveal, shared-map discovery, mobile and privacy.');
}catch(error){for(const [i,ctx]of browser.contexts().entries())for(const p of ctx.pages()){await p.screenshot({path:`build/design-review/reflection-failure-${i}.png`,fullPage:true});console.error((await p.locator('body').innerText()).slice(-6500));}console.error(errors);throw error;}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}


