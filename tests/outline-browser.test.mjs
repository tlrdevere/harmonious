import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {accountWorkspace,saveAccountChanges,startAccountComparison} from '../worker/account-api.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {synchronizeIdeas,createOwnedMap,endorseNodes} from '../dist/adoption.mjs';

// The two presentations use the real account projection and write policy. All
// records are disposable; nothing in this check reads or changes hosted data.
if(!process.env.HARMONIOUS_PLAYWRIGHT)throw Error('Set HARMONIOUS_PLAYWRIGHT.');
const {chromium}=await import(pathToFileURL(process.env.HARMONIOUS_PLAYWRIGHT));
const store=memoryStore(),ids={},writes=[],errors=[];let failNextWrite=false;
for(const actor of [alice,bob]){
  await seedActor(store,actor);ids[actor.name]={};
  await edit(store,actor,ws=>{
    const map=ws.maps.find(m=>m.ownerId===actor.id);map.visibility='shared';map.name=actor.name+' Outline map';
    for(const [title,parent]of [[actor.name+' position','status'],[actor.name+' unmatched','status'],[actor.name+' action','action'],[actor.name+' goal','goal']]){
      const node=addNode(ws,actor,title);node.parent=parent;node.kind='position';node.summary='The full source wording for '+title+' remains available in both presentations.';node.details='Detailed evidence and context for '+title+'.';node.confidence=actor===alice?null:0;ids[actor.name][title]=node.id;
    }
    if(actor===alice){let parent=ids.Alice['Alice position'];for(let depth=1;depth<=8;depth++){const node=addNode(ws,actor,'Deep topic '+depth);node.parent=parent;node.kind='position';node.summary='Nested explanation '+depth;parent=node.id;ids.Alice['Deep topic '+depth]=node.id;}}
    map.relations=[{id:actor.name+'-address',from:ids[actor.name][actor.name+' position'],to:ids[actor.name][actor.name+' action'],type:'addresses',note:'A cross-frame topic connection.'},{id:actor.name+'-enable',from:ids[actor.name][actor.name+' action'],to:ids[actor.name][actor.name+' goal'],type:'enables',note:'An explicitly saved effect.'}];
    synchronizeIdeas(ws,map);
  });
}
let hiddenMapId;
await edit(store,bob,ws=>{const m=createOwnedMap(ws,{name:'PRIVATE OUTLINE SOURCE',ownerId:bob.id});m.visibility='private';hiddenMapId=m.id;m.nodes.find(n=>n.id==='status').summary='SECRET SOURCE WORDING';});
const initial=(await view(store,alice)).workspace,aMap=initial.maps.find(m=>m.ownerId===alice.id),bMap=initial.maps.find(m=>m.ownerId===bob.id),at={type:'node',mapId:aMap.id,nodeId:ids.Alice['Alice position']},bt={type:'node',mapId:bMap.id,nodeId:ids.Bob['Bob position']};
const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:aMap.id,bMapId:bMap.id});
const seed=async(actor,input)=>{let record;await edit(store,actor,ws=>{record=makeDiscussion(ws,{comparisonId:thread.id,...input},actor.id);ws.discussions.push(record);});return record;};
const pair=await seed(alice,{kind:'correspondence',action:'counterpart_link',target:at,other:bt});
await seed(alice,{kind:'interaction',action:'endorse',target:bt,interaction:{mode:'compare',options:[]}});
await seed(bob,{kind:'interaction',action:'endorse',target:at,interaction:{mode:'compare',options:[]}});
const dispute=await seed(alice,{kind:'interaction',action:'dispute',target:bt,body:'The sample may omit people who work nights.',interaction:{mode:'argument',options:['factual_basis']}});
const response=await seed(bob,{kind:'interaction',action:'respond',target:{type:'entry',entryId:dispute.id},body:'The survey ran during the daytime.',interaction:{mode:'argument',options:['partly_accept']}});
for(const actor of [alice,bob])await edit(store,actor,ws=>{endorseNodes(ws,{participantId:actor.id,sourceMapId:bMap.id,nodeIds:[bt.nodeId],scope:'node',anchorId:bt.nodeId}).method='authenticated';});
const json=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost'),actor=req.headers['x-test-actor']==='bob'?bob:alice;
  if(url.pathname.startsWith('/api/')){
    let raw='';for await(const chunk of req)raw+=chunk;const input=raw?JSON.parse(raw):null;
    if(url.pathname==='/api/session')return json(res,200,{configured:true,actor,signup:{mode:'public'}});
    if(url.pathname==='/api/comparisons')return json(res,200,await startAccountComparison(store,actor.id,input));
    if(url.pathname==='/api/workspace'&&req.method==='PUT'){if(failNextWrite){failNextWrite=false;return json(res,503,{error:'Temporary test save failure. Please retry.'});}const result=await saveAccountChanges(store,actor.id,input.changes);writes.push({actor:actor.id,changes:input.changes});return json(res,200,result);}
    return json(res,200,await accountWorkspace(store,actor));
  }
  const name=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!/^[a-z0-9.-]+$/.test(name)){res.writeHead(404);res.end();return;}
  let content=await readFile(resolve('dist',name),'utf8');if(name==='index.html')content=content.replace('src="./app.mjs"','src="./beta-boot.mjs"').replace('</head>','<link rel="stylesheet" href="./accounts.css"></head>');
  res.setHeader('content-type',name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'text/javascript');res.end(content);
}catch(error){json(res,error.status||500,{error:error.message});}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.HARMONIOUS_BROWSER||'msedge'});
try{
  await mkdir('build/design-review',{recursive:true});
  const context=async(actor,width=1440)=>{const c=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce',extraHTTPHeaders:{'x-test-actor':actor}}),p=await c.newPage();p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.stack||e.message));return p;};
  const a=await context('alice'),b=await context('bob'),phone=await context('alice',390);
  const body=p=>p.locator('body'),outline=p=>p.locator('#outline-map'),mapCard=(p,id)=>p.locator('#outline-map [data-outline-node="'+id+'"]');
  const pop=p=>p.locator('.discussion-popover'),button=(p,name)=>pop(p).getByRole('button',{name,exact:true});
  const saved=p=>p.waitForFunction(()=>document.getElementById('storage-status')?.textContent==='All changes saved');
  const workspace=async()=>((await view(store,alice)).workspace),node=async id=>(await workspace()).maps.find(m=>m.id===aMap.id).nodes.find(n=>n.id===id);
  const choose=async(p,name)=>{await p.locator('#presentation-'+name).click();await p.locator('body[data-presentation="'+name+'"]').waitFor();};
  const openNode=async(p,id)=>{await mapCard(p,id).getByRole('button',{name:'Open node',exact:true}).click();};
  const noOverflow=async p=>assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Outline must not require horizontal panning.');

  // Defaults, old links, explicit preference and resize are presentation-only.
  await a.goto(origin+'/#map='+aMap.id);await a.locator('#editor-main').waitFor();
  assert.equal(await body(a).getAttribute('data-presentation'),'canvas','A first desktop visit preserves Canvas.');
  const before=(await store.snapshot()).revision;
  await choose(a,'outline');await outline(a).waitFor();assert.match(a.url(),/layout=outline/);
  await choose(a,'canvas');await choose(a,'outline');assert.equal((await store.snapshot()).revision,before,'Changing presentation never changes records.');
  await a.setViewportSize({width:390,height:844});assert.equal(await body(a).getAttribute('data-presentation'),'outline');await noOverflow(a);
  await a.setViewportSize({width:1440,height:1000});await a.reload();await outline(a).waitFor();assert.equal(await body(a).getAttribute('data-presentation'),'outline');
  await phone.goto(origin+'/#map='+aMap.id);await outline(phone).waitFor();assert.equal(await body(phone).getAttribute('data-presentation'),'outline','A first narrow visit defaults to Outline.');
  await choose(phone,'canvas');await phone.setViewportSize({width:1440,height:1000});await phone.reload();await phone.locator('#editor-main').waitFor();assert.equal(await body(phone).getAttribute('data-presentation'),'canvas','An explicit Canvas choice wins over later device sizing.');

  // One existing form survives a presentation switch; only Save writes it.
  const branchToggle=mapCard(a,at.nodeId).locator('[data-outline-action="children"]');await branchToggle.focus();await branchToggle.press('Enter');assert(await branchToggle.evaluate(el=>el===document.activeElement),'Keyboard focus follows the same branch control after expansion.');await branchToggle.press('Enter');assert(await branchToggle.evaluate(el=>el===document.activeElement),'Keyboard focus survives collapsing the branch.');
  await openNode(a,at.nodeId);await a.locator('#outline-map-detail').getByRole('button',{name:'Edit',exact:true}).click();
  await a.locator('#title').fill('Alice edited from Outline');await a.locator('#confidence').fill('100');await a.locator('#title').focus();await a.locator('#title').evaluate(el=>el.setSelectionRange(6,12));
  const draftWrites=writes.length;await choose(a,'canvas');assert.equal(await a.locator('#title').inputValue(),'Alice edited from Outline');
  await a.goBack();await a.locator('body[data-presentation="outline"]').waitFor();assert.equal(await a.locator('#title').inputValue(),'Alice edited from Outline','Back across a presentation choice preserves the open draft.');
  await a.goForward();await a.locator('body[data-presentation="canvas"]').waitFor();assert.equal(await a.locator('#title').inputValue(),'Alice edited from Outline');await choose(a,'outline');
  assert.equal(await a.locator('#title').inputValue(),'Alice edited from Outline');assert.deepEqual(await a.locator('#title').evaluate(el=>[el.selectionStart,el.selectionEnd]),[6,12]);assert.equal(await a.locator('#edit-form').count(),1);assert.equal(writes.length,draftWrites,'Switching does not autosave an unfinished node.');
  await a.locator('#edit-form button[type=submit]').click();await saved(a);assert.equal((await node(at.nodeId)).title,'Alice edited from Outline');assert.equal((await node(at.nodeId)).confidence,100);
  await a.locator('#confidence').fill('0');await a.locator('#edit-form button[type=submit]').click();await saved(a);assert.equal((await node(at.nodeId)).confidence,0);
  await a.locator('#confidence').fill('');await a.locator('#edit-form button[type=submit]').click();await saved(a);assert.equal((await node(at.nodeId)).confidence,null);
  await a.locator('.node-face-done').click();

  // Adding a child uses the same draft, focuses its title and saves one record.
  await openNode(a,at.nodeId);await a.locator('#outline-map-detail').getByRole('button',{name:'Add child node',exact:true}).click();
  assert(await a.locator('#child-title').evaluate(el=>el===document.activeElement));await a.locator('#child-title').fill('Child authored without a canvas');await a.locator('#child-summary').fill('This is the same saved node in both views.');
  await choose(a,'canvas');await choose(a,'outline');assert.equal(await a.locator('#child-title').inputValue(),'Child authored without a canvas');
  await a.locator('#child-submit').click();await saved(a);const children=(await workspace()).maps.find(m=>m.id===aMap.id).nodes.filter(n=>n.title==='Child authored without a canvas');assert.equal(children.length,1);assert.equal(children[0].parent,at.nodeId);
  await a.locator('.node-face-done').click();await a.screenshot({path:'build/design-review/outline-map-desktop.png',fullPage:true});
  await openNode(a,at.nodeId);await a.locator('#outline-map-detail').getByRole('button',{name:'Inspect details',exact:true}).click();assert.match(await a.locator('#connection-list').innerText(),/Alice action/);assert(await a.locator('#connect').isVisible());await a.locator('#close').click();
  await openNode(a,at.nodeId);await a.locator('#outline-map-detail').getByRole('button',{name:'Philosophy',exact:true}).click();
  const philosophy=a.locator('.definitions-dialog');await philosophy.locator('#philosophy-new-type').selectOption('principle');await philosophy.locator('#philosophy-new-title').fill('Outline foundation');await philosophy.locator('#philosophy-new-body').fill('A principle created through the same Philosophy bank.');await philosophy.getByRole('button',{name:'Save philosophy',exact:true}).click();await saved(a);assert.equal((await workspace()).definitions.filter(d=>d.versions.at(-1).title==='Outline foundation').length,1);
  await openNode(a,at.nodeId);await a.locator('#outline-map-detail').getByRole('button',{name:'Focus this branch',exact:true}).click();await outline(a).getByRole('button',{name:'Clear focus',exact:true}).waitFor();await mapCard(a,ids.Alice['Alice action']).waitFor();assert.equal(await mapCard(a,ids.Alice['Alice unmatched']).count(),0,'Topic focus includes cross-frame linked topics and excludes unrelated branches.');await outline(a).getByRole('button',{name:'Clear focus',exact:true}).click();await mapCard(a,ids.Alice['Alice unmatched']).waitFor();

  // Pair adjacency is based only on the explicit link; unrelated rows stay solo.
  const compareURL=origin+'/#'+new URLSearchParams({comparison:thread.id,view:'compare',layout:'outline'});
  const comparisonCard=(p,mapId,nodeId)=>p.locator('#outline-comparison .outline-node-card[data-map-id="'+mapId+'"][data-node-id="'+nodeId+'"]');
  const actions=async(p,mapId,nodeId)=>{await comparisonCard(p,mapId,nodeId).getByRole('button',{name:/^Actions for /}).click();};
  await a.goto(compareURL);await a.locator('#outline-comparison').waitFor();
  assert.equal(await a.locator('.outline-comparison-group[data-group-kind="pair"]').count(),1);
  assert.equal(await a.locator('.outline-comparison-group[data-group-kind="solo"]').filter({has:a.locator('[data-node-id="'+ids.Alice['Alice unmatched']+'"]')}).count(),1);
  assert.match(await comparisonCard(a,bMap.id,bt.nodeId).innerText(),/The full source wording/);
  const comparisonRevision=(await store.snapshot()).revision;await choose(a,'canvas');await choose(a,'outline');assert.equal((await store.snapshot()).revision,comparisonRevision);
  await actions(a,bMap.id,bt.nodeId);await a.locator('#reasoning-inquiry-mode').click();assert.equal(new URLSearchParams(new URL(a.url()).hash.slice(1)).get('node'),bt.nodeId);await a.reload();await a.locator('#reasoning-inquiry-mode[aria-pressed="true"]').waitFor();assert.match(await pop(a).innerText(),/Bob position/);await button(a,'Close').click();await a.locator('#reasoning-compare-mode').click();
  await a.locator('#outline-comparison-search').fill('Bob unmatched');assert.equal(await comparisonCard(a,bMap.id,ids.Bob['Bob unmatched']).count(),1);assert.equal(await comparisonCard(a,bMap.id,bt.nodeId).count(),0);await a.locator('#outline-comparison-search').fill('');
  await actions(a,aMap.id,ids.Alice['Alice unmatched']);await button(a,'Link counterpart').click();
  const candidates=await a.locator('#counterpart-node option').evaluateAll(options=>options.map(o=>o.value).filter(Boolean));assert(candidates.includes(ids.Bob['Bob unmatched']));assert(!candidates.includes(ids.Bob['Bob action']));assert(!candidates.includes(bt.nodeId),'The same-frame chooser excludes already linked nodes.');
  await a.locator('#counterpart-node').selectOption(ids.Bob['Bob unmatched']);await button(a,'Link counterpart').click();await saved(a);
  assert.equal((await workspace()).discussions.filter(r=>r.kind==='correspondence'&&r.status==='active').length,2);await button(a,'Close').click();
  await actions(a,bMap.id,ids.Bob['Bob unmatched']);await button(a,'Agree').click();await button(a,'Record position').click();await button(a,'Edit').waitFor();await saved(a);await button(a,'Close').click();
  await b.goto(compareURL);await b.locator('#outline-comparison').waitFor();await actions(b,aMap.id,ids.Alice['Alice unmatched']);await button(b,'Agree').click();await button(b,'Record position').click();await button(b,'Edit').waitFor();await saved(b);await button(b,'Close').click();await b.locator('.outline-pair-state[data-pair-assessment="agree"]').waitFor();
  await actions(b,bMap.id,ids.Bob['Bob unmatched']);b.once('dialog',d=>d.accept());await button(b,'Unlink counterpart').click();await saved(b);
  assert.equal((await workspace()).discussions.filter(r=>r.kind==='counterpart_unlink').length,1,'Either participant can unlink from Outline.');

  // Argument mode and its focused page reuse the exact log and reply records.
  await a.goto(origin+'/#'+new URLSearchParams({comparison:thread.id,view:'argument',layout:'outline'}));await a.locator('#outline-comparison').waitFor();
  await actions(a,bMap.id,ids.Bob['Bob unmatched']);await button(a,'Dispute reasoning').click();assert.deepEqual(await a.locator('.interaction-options input').evaluateAll(inputs=>inputs.map(input=>input.value)),['factual_basis','reasoning','consequences','feasibility']);assert.match(await pop(a).locator('.disputed-node-description').innerText(),/The full source wording for Bob unmatched/);await a.locator('input[value="consequences"]').check();await a.locator('#interaction-comment').fill('A separate consequence needs discussion.');await button(a,'Send dispute').click();await button(a,'Edit').waitFor();await saved(a);await button(a,'Close').click();
  await a.locator('[data-outline-connections] > summary').click();await a.locator('.outline-connection').getByRole('button',{name:/Bob position → Bob action/}).click();assert.equal(new URLSearchParams(new URL(a.url()).hash.slice(1)).get('edge'),'Bob-address');await a.reload();await a.locator('#reasoning-argument-mode[aria-pressed="true"]').waitFor();assert.match(await pop(a).innerText(),/Bob position/);await button(a,'Dispute reasoning').click();assert.equal(await a.locator('.interaction-options input').count(),4,'Typed source connections retain the four-category dispute command.');await button(a,'Close').click();
  await actions(a,bMap.id,bt.nodeId);assert.match(await pop(a).innerText(),/Disputes \(1\)/);assert.match(await pop(a).innerText(),/The survey ran during the daytime/);await button(a,'Close').click();
  await comparisonCard(a,bMap.id,bt.nodeId).getByRole('button',{name:'Open dialogue',exact:true}).click();
  const entry=(p,id)=>p.locator('.outline-dialogue-entry[data-dialogue-entry="'+id+'"]');await entry(a,response.id).waitFor();
  await entry(a,response.id).locator('.outline-placement > summary').click();await entry(a,response.id).getByRole('combobox',{name:'Placement in canvas',exact:true}).selectOption('above');
  await entry(a,response.id).getByRole('button',{name:'Reply',exact:true}).click();await a.locator('#interaction-comment').fill('Please include night workers in the next round.');
  const replyWrites=writes.length;await choose(a,'canvas');assert.equal(await a.locator('#interaction-comment').inputValue(),'Please include night workers in the next round.');await choose(a,'outline');assert.equal(writes.length,replyWrites);assert.equal(await a.locator('#interaction-comment').count(),1);
  failNextWrite=true;await button(a,'Send reply').click();await pop(a).getByRole('alert').filter({hasText:'Temporary test save failure'}).waitFor();assert.equal(await a.locator('#interaction-comment').inputValue(),'Please include night workers in the next round.');assert.equal((await workspace()).discussions.filter(r=>r.body==='Please include night workers in the next round.').length,0);
  await button(a,'Send reply').click();await saved(a);await button(a,'Edit').waitFor();const replies=(await workspace()).discussions.filter(r=>r.body==='Please include night workers in the next round.');assert.equal(replies.length,1,'Retry saves exactly one contribution.');const follow=replies[0];assert.equal(follow.interaction.replyTo.entryId,response.id);assert.equal(follow.interaction.placement,'above');assert.equal(new URLSearchParams(new URL(a.url()).hash.slice(1)).get('entry'),follow.id);
  await a.reload();await entry(a,follow.id).waitFor();assert.equal(await entry(a,follow.id).getAttribute('aria-current'),'true','Reload selects the exact saved reply.');await entry(a,follow.id).getByRole('button',{name:'Details',exact:true}).click();assert.match(await pop(a).innerText(),/Please include night workers in the next round/);assert.match(await pop(a).innerText(),/Replying to Bob/);
  await button(a,'Close').click();await entry(a,follow.id).getByRole('button',{name:'Propose standstill',exact:true}).click();await a.locator('#standstill-explanation').fill('We currently disagree about the sampling requirement.');await button(a,'Propose standstill').click();await saved(a);assert.equal((await workspace()).discussions.filter(r=>r.kind==='standstill'&&r.body==='We currently disagree about the sampling requirement.').length,1);
  await button(a,'Close').click();await a.screenshot({path:'build/design-review/outline-dialogue-desktop.png',fullPage:true});
  const dialogueURL=a.url();await a.reload();await entry(a,follow.id).waitFor();assert.match(a.url(),/layout=outline/);
  await a.getByRole('button',{name:'Back to comparison',exact:true}).click();await a.locator('#outline-comparison').waitFor();assert.match(a.url(),/view=argument/);assert.match(a.url(),/layout=outline/);

  // Source and derived-pod controls retain their existing permissions and scope.
  await a.goto(origin+'/#'+new URLSearchParams({source:bMap.id,node:bt.nodeId,layout:'outline'}));await a.locator('#outline-source').waitFor();
  assert.equal(await a.locator('#edit-form:visible').count(),0);assert.match(await a.locator('#reference-detail').innerText(),/Bob position/);assert(await a.locator('#cosign-node').isVisible());assert(await a.locator('#copy-section').isVisible());
  await a.goto(origin+'/#'+new URLSearchParams({pod:bMap.id,layout:'outline'}));await a.locator('#outline-pod').waitFor();assert.match(await a.locator('#pod-result-count').innerText(),/1 nodes meet this threshold among 2 people/);assert(await a.locator('#pod-threshold').isVisible());

  // Mobile scrolling, full content and focused dialogue remain within the page.
  for(const width of [390,320]){
    await a.setViewportSize({width,height:740});await a.goto(dialogueURL);await entry(a,follow.id).waitFor();await noOverflow(a);
    await entry(a,follow.id).getByRole('button',{name:'Details',exact:true}).click();await noOverflow(a);await button(a,'Close').click();
    await a.screenshot({path:'build/design-review/outline-dialogue-'+width+'.png',fullPage:true});
    await a.goto(origin+'/#'+new URLSearchParams({map:aMap.id,node:ids.Alice['Deep topic 8'],layout:'outline'}));await outline(a).waitFor();await noOverflow(a);
  }
  // A source unavailable to this account cannot leak through a direct route.
  await a.goto(origin+'/#'+new URLSearchParams({source:hiddenMapId,layout:'outline'}));await a.locator('#library-workspace').waitFor();assert.doesNotMatch(await body(a).innerText(),/PRIVATE OUTLINE SOURCE|SECRET SOURCE WORDING/);
  assert.deepEqual(errors,[]);
  console.log('Outline browser checks passed: desktop/mobile defaults, routing and data identity, draft handoff, node authoring/confidence, explicit counterparts and unlink, shared argument replies/standstill, source and pod permissions, narrow layout and private-source isolation.');
}catch(error){for(const [index,page]of browser.contexts().flatMap(c=>c.pages()).entries()){await page.screenshot({path:'build/design-review/outline-failure-'+index+'.png',fullPage:true});console.error((await page.locator('body').innerText()).slice(-5000));}console.error('Browser errors:',errors);throw error;}
finally{await browser.close();await new Promise(r=>server.close(r));}
