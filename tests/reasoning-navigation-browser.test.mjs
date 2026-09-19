import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {validateAccountChanges} from '../worker/account-policy.mjs';
import {startAccountComparison} from '../worker/account-api.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {makeDefinition} from '../dist/definitions.mjs';

const playwright=process.env.HARMONIOUS_PLAYWRIGHT;
if(!playwright)throw Error('Set HARMONIOUS_PLAYWRIGHT to the installed playwright entry point.');
const {chromium}=await import(pathToFileURL(playwright));
const store=memoryStore(),sourceIds={};
for(const actor of [alice,bob]){
  await seedActor(store,actor);await edit(store,actor,ws=>{
    const map=ws.maps.find(m=>m.ownerId===actor.id);map.visibility='shared';map.name=actor.name+' navigation map';
    for(const title of actor===alice?['Evening meeting','Deep reasoning source','Broad discussion source']:['Daytime options'])sourceIds[title]=addNode(ws,actor,title).id;
    if(actor===alice)ws.definitions.push(makeDefinition(ws,{type:'standard',title:'Participation standard',body:'Account for members who have not replied.'},alice.id));
  });
}
const initial=(await view(store,alice)).workspace,aMap=initial.maps.find(m=>m.ownerId===alice.id),bMap=initial.maps.find(m=>m.ownerId===bob.id);
const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:aMap.id,bMapId:bMap.id});
const source=title=>({type:'node',mapId:aMap.id,nodeId:sourceIds[title]}),entry=r=>({type:'entry',entryId:r.id}),inference=r=>({type:'inference',entryId:r.id});
const add=(ws,actor,input)=>{const r=makeDiscussion(ws,{comparisonId:thread.id,...input},actor.id);ws.discussions.push(r);return r;};
const save=async(actor,input)=>{let r;await edit(store,actor,ws=>{r=add(ws,actor,input);});return r;};
let reason,child;const deep=[],wide=[];
await edit(store,alice,ws=>{
  reason=add(ws,alice,{kind:'argument',action:'reason',target:source('Evening meeting'),body:'Most replies favor evenings.'});
  child=add(ws,alice,{kind:'argument',action:'reason',target:entry(reason),body:'Eighteen respondents chose the evening slot.'});
  for(let i=0;i<80;i++)deep.push(add(ws,alice,{kind:'argument',action:'reason',target:i?entry(deep.at(-1)):source('Deep reasoning source'),body:`Deep reason ${String(i+1).padStart(2,'0')}: a supporting step.`}));
  for(let i=0;i<200;i++)wide.push(add(ws,alice,{kind:'argument',action:'reason',target:source('Broad discussion source'),body:`Wide sibling ${String(i+1).padStart(3,'0')}: an independent reason.`}));
});
const statement=await save(bob,{kind:'argument',action:'challenge',target:entry(reason),body:'Statement challenge: some responses may be missing.'});
const inferChallenge=await save(bob,{kind:'argument',action:'inference',target:inference(reason),body:'Inference challenge: replies may not represent all members.'});
const response=await save(alice,{kind:'reply',action:'reply',layer:'arguments',target:entry(inferChallenge),body:'We will ask members who have not replied.'});
const deepChallenge=await save(bob,{kind:'argument',action:'challenge',target:entry(deep.at(-1)),body:'Deep challenge: explain the final step.'});
const deepResponse=await save(alice,{kind:'reply',action:'reply',layer:'arguments',target:entry(deepChallenge),body:'Deep response visibility target: here is the final explanation.'});
const boundaryChallenge=await save(bob,{kind:'argument',action:'inference',target:inference(deep[78]),body:'Boundary inference target: why does step 79 support step 78?'});
const originalMaps=JSON.stringify((await view(store,alice)).workspace.maps);
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'),actor=req.headers['x-test-actor']==='bob'?bob:alice;
    if(url.pathname.startsWith('/api/')){
      let body='';for await(const chunk of req)body+=chunk;const input=body?JSON.parse(body):null;let result;
      if(url.pathname==='/api/session')result={configured:true,actor,signup:{mode:'public'}};
      else if(url.pathname==='/api/comparisons')result=await startAccountComparison(store,actor.id,input);
      else if(url.pathname==='/api/workspace'&&req.method==='PUT'){const snapshot=await store.snapshot(),accepted=validateAccountChanges(snapshot,actor.id,input.changes);result=await store.commit(actor.id,snapshot.revision,accepted);}
      else result={...await view(store,actor),actor};
      res.setHeader('content-type','application/json');res.end(JSON.stringify(result));return;
    }
    const name=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!/^[a-z0-9.-]+$/.test(name)){res.writeHead(404);res.end();return;}
    let content=await readFile(resolve('dist',name),'utf8');if(name==='index.html')content=content.replace('src="./app.mjs"','src="./beta-boot.mjs"').replace('</head>','<link rel="stylesheet" href="./accounts.css"></head>');
    res.setHeader('content-type',name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'text/javascript');res.end(content);
  }catch(error){res.writeHead(error.status||500,{'content-type':'application/json'});res.end(JSON.stringify({error:error.message}));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:process.env.HARMONIOUS_BROWSER||'msedge'}),errors=[];
try{
  await mkdir('build/design-review',{recursive:true});
  const a=await (await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{'x-test-actor':'alice'}})).newPage();
  const b=await (await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{'x-test-actor':'bob'}})).newPage();
  for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);}
  const pop=p=>p.locator('.discussion-popover'),search=p=>p.locator('.reasoning-search'),card=(p,r)=>p.locator(`.reasoning-card[data-entry="${r.id}"]`);
  const close=async p=>{if(await pop(p).isVisible())await pop(p).getByRole('button',{name:'Close',exact:true}).click();};
  const fold=(p,r,type='contribution')=>p.getByRole('button',{name:new RegExp(`^(Hide|Show) follow-ups to ${type}: ${r.body.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`)});
  const zoom=p=>p.locator('#compare-canvas .comparison-world').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).a);
  const expand=async p=>{await p.locator('.comparison-view-options>summary').click();for(const side of ['a','b'])await p.locator('#compare-all-'+side).click();await p.locator('.comparison-view-options>summary').click();};
  const show=async(p,query)=>{
    await close(p);await p.getByRole('button',{name:'Find in argument',exact:true}).click();
    await search(p).getByRole('button',{name:'All',exact:true}).click();await search(p).getByRole('searchbox',{name:'Search argument'}).fill(query);
    const row=search(p).locator('.reasoning-search-result').filter({hasText:query});assert.equal(await row.count(),1,'A precise search selects one contribution.');
    await row.getByRole('button',{name:'Show on map',exact:true}).click();
  };
  await a.goto(origin);await a.getByRole('button',{name:'Comparisons',exact:true}).click();await a.getByRole('button',{name:'Open comparison',exact:true}).click();
  const comparisonURL=a.url();await expand(a);await a.locator('#reasoning-argument-mode').click();await close(a);await show(a,reason.body);
  await a.getByRole('button',{name:'Fit argument',exact:true}).click();
  assert(await card(a,child).count());assert(await card(a,statement).count());assert(await card(a,inferChallenge).count());
  const before=await card(a,reason).boundingBox(),beforeZoom=await zoom(a);
  await fold(a,reason).click();
  assert.equal(await card(a,child).count(),0);assert.equal(await card(a,statement).count(),0);assert.equal(await card(a,inferChallenge).count(),1,'Folding a statement does not fold its inference discussion.');
  assert.match(await fold(a,reason).innerText(),/2 follow-ups.*1 open challenges/);
  const after=await card(a,reason).boundingBox();assert(Math.abs(before.x-after.x)<1&&Math.abs(before.y-after.y)<1,'Folding keeps the clicked card at its screen location.');assert.equal(await zoom(a),beforeZoom);
  await fold(a,reason,'reasoning connection').click();assert.equal(await card(a,inferChallenge).count(),0);assert.equal(await card(a,response).count(),0);assert.match(await fold(a,reason,'reasoning connection').innerText(),/2 follow-ups.*1 open challenges/);
  await b.goto(comparisonURL);await expand(b);await b.locator('#reasoning-argument-mode').click();await close(b);await show(b,reason.body);
  assert.equal(await card(b,child).count(),1,'The second account has its own unfolding state.');assert.equal(await card(b,inferChallenge).count(),1);
  const newResponse=await save(bob,{kind:'reply',action:'reply',layer:'arguments',target:entry(statement),body:'New while folded: please include late responses.'});
  await a.getByRole('button',{name:'Refresh',exact:true}).click();
  await fold(a,reason).filter({hasText:/3 follow-ups/}).waitFor();
  assert.equal(await card(a,newResponse).count(),0,'Refresh does not silently reopen a folded exchange.');
  assert.match(await fold(a,reason).innerText(),/3 follow-ups.*1 open challenges/);
  await a.locator('#reasoning-compare-mode').click();await a.locator('#reasoning-argument-mode').click();assert.equal(await fold(a,reason).getAttribute('aria-expanded'),'false');
  await a.locator('#comparison-library').click();await a.getByRole('button',{name:'Open comparison',exact:true}).click();
  await a.locator('#reasoning-argument-mode').click();await close(a);assert.equal(await fold(a,reason).getAttribute('aria-expanded'),'false','Reopening the same comparison preserves personal folds for this session.');

  // A focused search unfolds only the required path, retaining the other fold.
  await show(a,response.body);assert.equal(await card(a,response).count(),1);assert.equal(await fold(a,reason).getAttribute('aria-expanded'),'false');
  await card(a,response).locator('.reasoning-main').click();await pop(a).getByRole('button',{name:'Add supporting reason',exact:true}).click();
  await a.locator('#discussion-body').fill('A private unfinished explanation.');await a.locator('#discussion-reference').fill('https://example.org/draft');
  await pop(a).getByText('Definitions & standards (optional)',{exact:true}).click();await pop(a).locator('.definition-choice input[type=checkbox]').check();
  await fold(a,reason,'reasoning connection').press('Enter');
  assert.equal(await card(a,response).count(),1,'A fold cannot hide the required context of an unfinished composer.');
  await a.getByRole('button',{name:'Find in argument',exact:true}).click();await search(a).getByRole('searchbox',{name:'Search argument'}).fill('Deep response visibility target');
  assert.equal(await a.locator('#discussion-body').inputValue(),'A private unfinished explanation.','Typing in search preserves the current composer.');
  a.once('dialog',d=>d.dismiss());await search(a).getByRole('button',{name:'Show on map',exact:true}).click();
  assert.equal(await a.locator('#discussion-body').inputValue(),'A private unfinished explanation.','Cancelling replacement keeps the draft.');
  await search(a).getByRole('button',{name:'Close',exact:true}).click();await a.locator('#reasoning-compare-mode').click();await a.locator('#reasoning-argument-mode').click();
  assert.equal(await a.locator('#discussion-reference').inputValue(),'https://example.org/draft');assert.equal(await pop(a).locator('.definition-choice input[type=checkbox]').isChecked(),true);
  a.once('dialog',d=>d.accept());await close(a);

  const searchZoom=await zoom(a);await show(a,'Deep response visibility target');
  assert.equal(await zoom(a),searchZoom,'Finding a deep contribution pans without shrinking text.');
  assert.equal(await card(a,deepResponse).count(),1,'A response beyond 80 reasoning steps is reachable.');assert((await a.locator('.reasoning-card').count())<=40);
  const earlier=a.getByRole('button',{name:/^Earlier steps/});assert.equal(await earlier.count(),1);
  const visibleIds=await a.locator('.reasoning-card').evaluateAll(cards=>cards.map(c=>c.dataset.entry)),all=(await view(store,alice)).workspace.discussions;
  for(const id of visibleIds){const r=all.find(r=>r.id===id);if(r.target.type==='entry'&&!visibleIds.includes(r.target.entryId)){const line=a.locator(`.reasoning-edge[data-entry="${id}"]`);assert(!(await line.count())||!(await line.getAttribute('d')),'Omitted ancestors must not create a false connection to the worldview.');}}
  await earlier.press('Enter');await a.getByRole('button',{name:'Back to selected contribution',exact:true}).click();assert.equal(await card(a,deepResponse).count(),1);
  await show(a,'Boundary inference target');
  for(const r of [boundaryChallenge,deep[78],deep[77]])assert.equal(await card(a,r).count(),1,'An inference challenge shows its actual reason and conclusion.');
  assert.equal(await a.locator(`.reasoning-inference[data-reason="${deep[78].id}"]`).count(),1);assert((await a.locator('.reasoning-card').count())<=40);

  await a.getByRole('button',{name:'Find in argument',exact:true}).click();await search(a).getByRole('searchbox',{name:'Search argument'}).fill('Wide sibling');
  assert.match(await search(a).innerText(),/200 matching contributions/);assert.equal(await search(a).locator('.reasoning-search-result').count(),50);
  await search(a).getByRole('button',{name:'More results',exact:true}).click();assert.equal(await search(a).locator('.reasoning-search-result').count(),100);
  await search(a).getByRole('searchbox',{name:'Search argument'}).fill('Wide sibling 200');await search(a).getByRole('button',{name:'Show on map',exact:true}).click();
  assert.equal(await card(a,wide[199]).count(),1);assert((await a.locator('.reasoning-card').count())<=40);assert(await a.getByRole('button',{name:/^Browse all.*contributions/}).count(),'A capped branch offers an accurately labeled complete list.');
  await a.screenshot({path:'build/design-review/reasoning-find-wide.png',fullPage:true});
  await a.getByRole('button',{name:'Find in argument',exact:true}).click();await search(a).getByRole('searchbox',{name:'Search argument'}).fill('');await search(a).getByRole('button',{name:'Open challenges',exact:true}).click();
  assert.equal(await search(a).locator('.reasoning-search-result').count(),4,'Open-challenge filtering works across source groups.');
  await a.setViewportSize({width:390,height:844});assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const box=await search(a).boundingBox();assert(box.x>=0&&box.x+box.width<=391);
  await a.screenshot({path:'build/design-review/reasoning-find-mobile.png',fullPage:true});await search(a).getByRole('button',{name:'Close',exact:true}).click();
  assert.equal(JSON.stringify((await view(store,alice)).workspace.maps),originalMaps,'Display navigation never edits the source maps.');
  await edit(store,alice,ws=>{ws.maps.find(m=>m.id===aMap.id).visibility='private';});
  await b.getByRole('button',{name:'Refresh',exact:true}).click();await b.waitForFunction(()=>document.querySelectorAll('.reasoning-card').length===0);assert.equal(await search(b).isVisible(),false);assert.equal((await view(store,bob)).workspace.discussions.length,0,'Access loss removes the full searchable reasoning corpus.');
  assert.deepEqual(errors,[]);console.log('Argument navigation browser checks passed: independent typed folds, updated hidden counts, protected drafts, personal session state, 80-step/200-sibling search, real inference context, capped rendering and access removal.');
}catch(error){
  for(const [i,context]of browser.contexts().entries())for(const p of context.pages()){await p.screenshot({path:`build/design-review/reasoning-navigation-failure-${i}.png`,fullPage:true});console.error((await p.locator('body').innerText()).slice(-5000));}
  console.error(errors);throw error;
}finally{await browser.close();await new Promise(r=>server.close(r));}
