import {makeInteraction} from '../dist/interaction-grammar.mjs';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {accountWorkspace,saveAccountChanges,startAccountComparison} from '../worker/account-api.mjs';
import {makeDiscussion,discussionSnapshots,discussionTargetLabel} from '../dist/discussion.mjs';
import {synchronizeIdeas} from '../dist/adoption.mjs';
import {capturePremise} from '../dist/premise.mjs';

// Exercise the same account projection and write authorization as the live beta.
// The fixture intentionally mixes earlier records with minimal v4 interactions.
const playwright=process.env.HARMONIOUS_PLAYWRIGHT;
if(!playwright)throw Error('Set HARMONIOUS_PLAYWRIGHT.');
const {chromium}=await import(pathToFileURL(playwright));
const store=memoryStore(),ids={},errors=[];
for(const actor of [alice,bob]){
  await seedActor(store,actor);
  await edit(store,actor,ws=>{
    const map=ws.maps.find(m=>m.ownerId===actor.id);
    map.visibility='shared';map.name=actor.name+' consistency map';
    for(const title of actor===alice?['Evening meeting','Nested source','Earlier conclusion']:['Daytime meeting','Survey results']){
      const n=addNode(ws,actor,title);n.kind='position';
      n.parent=title==='Nested source'?ids['Evening meeting']:'status';
      n.summary='Source explanation for '+title;ids[title]=n.id;
      if(title==='Daytime meeting')n.sourceUrl='https://example.org/survey';
    }
    if(actor===bob)map.relations=[{id:'survey-reason',from:ids['Survey results'],to:ids['Daytime meeting'],type:'reason',note:'Survey results support the meeting time.'}];
    synchronizeIdeas(ws,map);
  });
}
const initial=(await view(store,alice)).workspace;
const aMap=initial.maps.find(m=>m.ownerId===alice.id),bMap=initial.maps.find(m=>m.ownerId===bob.id);
const aSource={type:'node',mapId:aMap.id,nodeId:ids['Evening meeting']};
const bSource={type:'node',mapId:bMap.id,nodeId:ids['Daytime meeting']};
const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:aMap.id,bMapId:bMap.id});
const seed=async(actor,input)=>{
  let record;
  // Seed genuine historical grounds directly, before exercising current UI writes.
  if(input.kind==='interaction'&&input.action==='dispute'){const ws=(await view(store,actor)).workspace,snapshot=await store.snapshot();record=makeDiscussion(ws,{comparisonId:thread.id,...input,interaction:{...input.interaction,options:['reasoning'],otherText:''}},actor.id);record.interaction=makeInteraction(ws,{comparisonId:thread.id,...input,...input.interaction},actor.id,4);await store.commit(actor.id,snapshot.revision,[{kind:'discussion',id:record.id,expectedRevision:0,value:record}]);return record;}
  await edit(store,actor,ws=>{record=makeDiscussion(ws,{comparisonId:thread.id,...input},actor.id);ws.discussions.push(record);});
  return record;
};
const earlierReason=await seed(alice,{kind:'argument',action:'reason',target:aSource,body:'Earlier supporting reason.'});
const earlierChallenge=await seed(bob,{kind:'argument',action:'challenge',target:aSource,body:'Earlier challenge.'});
const mixedDispute=await seed(bob,{kind:'interaction',action:'dispute',target:aSource,body:'',interaction:{mode:'argument',options:['overstated']}});
const nestedDispute=await seed(bob,{kind:'interaction',action:'dispute',target:{type:'node',mapId:aMap.id,nodeId:ids['Nested source']},body:'',interaction:{mode:'argument',options:['other'],otherText:'Nested ambiguity to investigate.'}});
const position=await seed(alice,{kind:'interaction',action:'endorse',target:bSource,body:'',interaction:{mode:'compare',options:['already_hold']}});
const request=await seed(alice,{kind:'interaction',action:'request_explanation',target:bSource,body:'',interaction:{mode:'inquiry',options:['scope']}});
const answer=await seed(bob,{kind:'interaction',action:'respond',target:{type:'entry',entryId:request.id},body:'',interaction:{mode:'inquiry',options:['dont_know']}});
const dispute=await seed(alice,{kind:'interaction',action:'dispute',target:bSource,body:'',interaction:{mode:'argument',options:['false','data_outdated','other'],otherText:'The attendance estimate omits remote participants.',reference:aSource}});
const response=await seed(bob,{kind:'interaction',action:'respond',target:{type:'entry',entryId:dispute.id},body:'',interaction:{mode:'argument',options:['partly_accept']}});
const edgeDispute=await seed(alice,{kind:'interaction',action:'dispute',target:{type:'edge',mapId:bMap.id,edgeId:'survey-reason'},body:'',interaction:{mode:'argument',options:['circular']}});
const withdrawn=await seed(alice,{kind:'interaction',action:'dispute',target:{type:'node',mapId:bMap.id,nodeId:ids['Survey results']},body:'Earlier withdrawn interaction.',interaction:{mode:'argument',options:['omission']}});
const historicalResponse=await seed(bob,{kind:'interaction',action:'respond',target:{type:'entry',entryId:withdrawn.id},body:'A response that remains available.',interaction:{mode:'argument',options:['accept']}});
await edit(store,alice,ws=>{const old=ws.discussions.find(r=>r.id===withdrawn.id);ws.discussions=ws.discussions.map(r=>r.id===old.id?makeDiscussion(ws,{...old,status:'withdrawn'},alice.id,old):r);});
const modernOnEarlier=await seed(bob,{kind:'interaction',action:'request_reason',target:{type:'entry',entryId:earlierReason.id},body:'',interaction:{mode:'inquiry',options:['reason']}});
const earlierReply=await seed(bob,{kind:'reply',action:'reply',target:{type:'entry',entryId:earlierReason.id},layer:'arguments',body:'Withdrawn earlier response remains readable.'});
const premise=capturePremise((await view(store,alice)).workspace,{mapId:aMap.id,nodeId:ids['Nested source']});
const earlierPremise=await seed(alice,{kind:'argument',action:'reason',target:{type:'node',mapId:aMap.id,nodeId:ids['Earlier conclusion']},premise,body:premise.wording.title});
const earlierPoint=await seed(alice,{kind:'reflection',action:'disagreement_point',target:{type:'entry',entryId:earlierReason.id},layer:'arguments',body:'An earlier point of disagreement.',reflection:{category:'facts'}});
const earlierOutcome=await seed(bob,{kind:'reflection',action:'outcome',target:{type:'entry',entryId:earlierPoint.id},layer:'arguments',body:'A withdrawn individual outcome remains readable.',reflection:{result:'more_work',nextStep:''}});
for(const record of [earlierReply,earlierOutcome])await edit(store,bob,ws=>{const old=ws.discussions.find(r=>r.id===record.id);ws.discussions=ws.discussions.map(r=>r.id===old.id?makeDiscussion(ws,{...old,status:'withdrawn'},bob.id,old):r);});
await edit(store,alice,ws=>{const map=ws.maps.find(m=>m.id===aMap.id);for(const title of ['Evening meeting','Earlier conclusion'])map.nodes.find(n=>n.id===ids[title]).summary='Changed source wording after its earlier reason.';synchronizeIdeas(ws,map);});

const json=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'),actor=req.headers['x-test-actor']==='bob'?bob:alice;
    if(url.pathname.startsWith('/api/')){
      let raw='';for await(const chunk of req)raw+=chunk;const input=raw?JSON.parse(raw):null;
      if(url.pathname==='/api/session'){json(res,200,{configured:true,actor,signup:{mode:'public'}});return;}
      if(url.pathname==='/api/comparisons'){json(res,200,await startAccountComparison(store,actor.id,input));return;}
      if(url.pathname==='/api/workspace'&&req.method==='PUT'){json(res,200,await saveAccountChanges(store,actor.id,input.changes));return;}
      json(res,200,await accountWorkspace(store,actor));return;
    }
    const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
    if(!/^[a-z0-9.-]+$/.test(name)){res.writeHead(404);res.end();return;}
    let content=await readFile(resolve('dist',name),'utf8');
    if(name==='index.html')content=content.replace('src="./app.mjs"','src="./beta-boot.mjs"').replace('</head>','<link rel="stylesheet" href="./accounts.css"></head>');
    res.setHeader('content-type',name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'text/javascript');res.end(content);
  }catch(e){json(res,e.status||500,{error:e.message});}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:process.env.HARMONIOUS_BROWSER||'msedge'});
try{
  await mkdir('build/design-review',{recursive:true});
  const pages=[];
  for(const actor of ['alice','bob']){
    const ctx=await browser.newContext({reducedMotion:'reduce',viewport:{width:1440,height:1000},extraHTTPHeaders:{'x-test-actor':actor}});
    const page=await ctx.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));pages.push(page);
  }
  const [a,b]=pages,pop=p=>p.locator('.discussion-popover');
  const button=(p,label)=>pop(p).getByRole('button',{name:label,exact:true});
  const click=(p,label)=>button(p,label).click();
  const close=async p=>{if(await pop(p).isVisible())await click(p,'Close');};
  const mode=(p,name)=>p.locator('#reasoning-'+name+'-mode').click();
  let navigation=0;
  const load=async p=>{
    await p.goto(origin+'/?load='+(++navigation)+'#comparison='+thread.id);
    await p.locator('.comparison-view-options>summary').click();
    for(const side of ['a','b'])await p.locator('#compare-all-'+side).click();
    await p.locator('.comparison-view-options>summary').click();
    await p.getByRole('button',{name:'Fit both maps',exact:true}).click();
  };
  const node=async(p,title)=>{
    await close(p);
    const n=p.locator('#compare-canvas .node-main').filter({has:p.getByText(title,{exact:true})}).first();
    await n.focus();await p.keyboard.press('Enter');
  };
  const conversations=async(p,which)=>{
    await close(p);await mode(p,which);await p.getByRole('button',{name:'Conversations',exact:true}).click();
  };
  const open=async(p,id,which)=>{await conversations(p,which);await pop(p).locator(`[data-entry="${id}"]`).click();};
  const search=p=>p.locator('[aria-label="Find interactions"]');
  const find=async(p,query)=>{
    await close(p);
    if(!await search(p).isVisible())await p.getByRole('button',{name:'Find',exact:true}).click();
    await search(p).getByRole('searchbox',{name:'Search interactions',exact:true}).fill(query);
  };
  const result=(p,id)=>search(p).locator(`.interaction-search-result[data-entry="${id}"]`);
  const reveal=async(p,id)=>result(p,id).getByRole('button',{name:'Show on map',exact:true}).click();
  const detail=async p=>({
    heading:await pop(p).locator('header>strong').first().innerText(),
    choices:await pop(p).locator('.interaction-selected').allTextContents(),
    bodies:await pop(p).locator('.discussion-body').allTextContents()
  });
  const geometry=p=>p.locator('#compare-canvas .comparison-world').evaluate(world=>({
    camera:world.style.transform,
    nodes:[...world.querySelectorAll('article.node')].map(n=>[n.querySelector('.node-main')?.getAttribute('aria-label'),n.style.transform,n.querySelector('.node-main')?.getAttribute('aria-pressed')]).sort(),
    ghosts:[...world.querySelectorAll('.counterpart-placeholder')].map(n=>[n.dataset.sourceMap,n.dataset.sourceNode,n.dataset.state,n.style.transform,n.offsetWidth,n.offsetHeight]).sort(),
    branches:[...world.querySelectorAll('.toggle')].map(n=>[n.getAttribute('aria-label'),n.getAttribute('aria-expanded')]).sort()
  }));
  const noRetiredActions=async p=>{
    for(const label of ['Reply','Challenge','Add supporting reason','Challenge this reason','Mark resolved','Reopen','Record outcome','Reflect','Support','Add evidence']){
      assert.equal(await button(p,label).count(),0,`Retired authoring action ${label} is absent`);
    }
  };

  // Real entry path: essential map selection must not depend on View options,
  // nor disappear when the passive source identity labels are clicked.
  const activeTop=async id=>{
    assert.deepEqual(await a.locator('.mode-tabs button.active').evaluateAll(buttons=>buttons.map(b=>b.id)),[id]);
    assert.deepEqual(await a.locator('.mode-tabs button[aria-current="page"]').evaluateAll(buttons=>buttons.map(b=>b.id)),[id]);
  };
  await a.goto(origin+'/?navigation');await a.locator('#library-workspace').waitFor();await activeTop('discover-mode');
  for(const id of ['comparison-mode','pods-mode','individual-mode','discover-mode']){await a.locator('#'+id).click();await activeTop(id);}
  await a.reload();await a.locator('#library-workspace').waitFor();await activeTop('discover-mode');
  for(const [section,id]of [['maps','individual-mode'],['comparisons','comparison-mode'],['pods','pods-mode'],['definitions','discover-mode']]){await a.locator('.library-section-'+section).click();await activeTop(id);}
  await a.locator('#comparison-mode').click();await a.reload();await a.locator('#library-workspace').waitFor();await activeTop('comparison-mode');
  await a.setViewportSize({width:390,height:844});await a.locator('#pods-mode').focus();await a.keyboard.press('Enter');await activeTop('pods-mode');await a.locator('#comparison-mode').click();await activeTop('comparison-mode');
  await a.screenshot({path:'build/design-review/top-navigation-narrow.png',fullPage:true});await a.setViewportSize({width:1440,height:1000});await a.screenshot({path:'build/design-review/top-navigation-desktop.png',fullPage:true});
  const pairCount=(await view(store,alice)).workspace.comparisonThreads.length;
  await a.goto(origin+'/#library=comparisons');await a.getByRole('button',{name:'Choose maps',exact:true}).click();
  const setup=a.getByRole('region',{name:'Choose comparison maps',exact:true}),start=a.locator('#start-comparison');
  assert(await setup.isVisible());assert.equal(await a.locator('.comparison-view-options').evaluate(e=>e.open),false);
  assert(await start.isDisabled());assert.equal(await a.locator('#compare-map-a').evaluate(e=>e===document.activeElement),true);
  await a.keyboard.press('Tab');assert.equal(await a.locator('#compare-map-b').evaluate(e=>e===document.activeElement),true,'Both source choices are reachable in normal keyboard order');
  for(const side of ['a','b']){await a.locator('#comparison-identity-'+side).click();assert(await a.locator('#compare-map-'+side).isVisible());}
  assert.match(await a.locator('#compare-map-a').innerText(),/Alice consistency map · Alice/);assert.match(await a.locator('#compare-map-b').innerText(),/Bob consistency map · Bob/);
  await a.locator('#compare-map-a').selectOption(aMap.id);assert(await start.isDisabled(),'The missing second choice stays explicit');
  await a.locator('#compare-map-b').selectOption(aMap.id);assert(await start.isDisabled());assert.match(await a.locator('#comparison-map-help').innerText(),/two different maps/);
  await a.locator('#compare-map-b').selectOption(bMap.id);assert(await start.isEnabled());
  await a.screenshot({path:'build/design-review/comparison-map-setup-desktop.png',fullPage:true});
  await a.setViewportSize({width:390,height:844});
  for(const id of ['compare-map-a','compare-map-b','start-comparison']){const box=await a.locator('#'+id).boundingBox();assert(box.x>=0&&box.x+box.width<=390,`${id} fits a narrow screen`);}
  await a.locator('.comparison-view-options>summary').click();await a.locator('#comparison-identity-a').click();assert(await setup.isVisible(),'Closing View options leaves source choices visible');
  await a.screenshot({path:'build/design-review/comparison-map-setup-mobile.png',fullPage:true});
  await start.click();await a.waitForURL('**/#comparison='+thread.id);assert.equal(await setup.isVisible(),false);assert(await a.getByRole('button',{name:'Change maps',exact:true}).isVisible());
  assert.equal((await view(store,alice)).workspace.comparisonThreads.length,pairCount,'Opening the existing pair does not create another comparison');
  await a.reload();await a.getByRole('button',{name:'Change maps',exact:true}).click();assert(await setup.isVisible());assert.deepEqual((await Promise.all(['a','b'].map(side=>a.locator('#compare-map-'+side).inputValue()))).sort(),[aMap.id,bMap.id].sort());
  await a.locator('#comparison-library').click();await a.getByRole('button',{name:'Find a shared map',exact:true}).click();await a.getByRole('button',{name:'Compare with my map',exact:true}).click();
  assert.equal(await a.locator('#compare-map-a').inputValue(),'');assert.equal(await a.locator('#compare-map-b').inputValue(),bMap.id);assert(await start.isDisabled(),'A preselected shared source still requires choosing an owned map');
  await a.locator('#compare-map-a').selectOption(aMap.id);await start.click();await a.waitForURL('**/#comparison='+thread.id);
  assert.deepEqual((await view(store,alice)).workspace.maps.filter(m=>[aMap.id,bMap.id].includes(m.id)).map(m=>m.visibility),['shared','shared'],'Choosing maps never changes their sharing');
  await a.setViewportSize({width:1440,height:1000});
  await load(a);await load(b);
  assert.deepEqual(await a.locator('[aria-label="Conversation mode"] button:visible').allTextContents(),['Inquiry','Compare','Argument'],'Shared mode buttons follow the intended Inquiry, Compare, Argument order');
  const ghostGeometry=await geometry(a),beforeGhostChoice=JSON.stringify((await view(store,alice)).workspace),ghost=()=>a.locator('.counterpart-placeholder[data-state="unlinked"]').first();
  assert(await ghost().getByRole('button',{name:'Link counterpart',exact:true}).isVisible());
  for(const selectedMode of ['inquiry','argument','compare']){await mode(a,selectedMode);assert.deepEqual(await geometry(a),ghostGeometry,'Full-size source/status geometry is identical in all three modes');if(selectedMode!=='compare')assert.equal(await a.locator('.counterpart-placeholder button').count(),0,'Other modes keep neutral counterpart status without authoring controls');}
  await ghost().getByRole('button',{name:'Link counterpart',exact:true}).focus();await a.keyboard.press('Enter');assert.equal(await a.locator('#counterpart-node').inputValue(),'');
  const explicitChoice=await a.locator('#counterpart-node option').evaluateAll(options=>options.find(o=>o.value)?.value);assert(explicitChoice);await a.locator('#counterpart-node').selectOption(explicitChoice);
  for(const selectedMode of ['inquiry','argument']){await mode(a,selectedMode);assert(await pop(a).isHidden(),'A counterpart draft parks outside Compare');assert.deepEqual(await geometry(a),ghostGeometry);}
  await mode(a,'compare');assert.equal(await a.locator('#counterpart-node').inputValue(),explicitChoice);a.once('dialog',dialog=>dialog.dismiss());await click(a,'Cancel');assert.equal(await a.locator('#counterpart-node').inputValue(),explicitChoice,'Declining discard retains the explicit ghost choice');a.once('dialog',dialog=>dialog.accept());await click(a,'Cancel');assert.deepEqual(await geometry(a),ghostGeometry);assert(await a.locator('.counterpart-placeholder button:focus').count(),'Cancelled ghost chooser returns focus to its rebuilt initiating control');assert.equal(JSON.stringify((await view(store,alice)).workspace),beforeGhostChoice,'Opening, parking and cancelling a ghost creates no saved record');
  await mode(a,'argument');await node(a,'Daytime meeting');
  assert(await pop(a).getByRole('heading',{name:'Disputes (1)',exact:true}).isVisible(),'A response does not inflate the dispute count');
  assert.deepEqual(await pop(a).locator('[data-dispute]').evaluateAll(rows=>rows.map(r=>r.dataset.dispute)),[dispute.id]);
  const disputeRow=pop(a).locator(`[data-dispute="${dispute.id}"]>summary`);
  assert.match(await disputeRow.innerText(),/It's false/);assert.match(await disputeRow.innerText(),/The data is outdated/);
  assert.match(await disputeRow.innerText(),/1 response · Latest: Bob — Partly accept/);
  await disputeRow.click();
  assert(await pop(a).locator(`[data-response="${response.id}"]`).isVisible(),'Full responses appear within the expanded dispute');
  await click(a,'Manage dispute');
  const direct=await detail(a);
  assert(direct.choices.includes("It's false"));assert(direct.choices.includes('The data is outdated'));
  assert(direct.bodies.includes('The attendance estimate omits remote participants.'));
  assert.match(await pop(a).locator(`[data-entry="${response.id}"]`).innerText(),/Partly accept/);
  assert.equal(await button(a,'Respond').count(),0,'The initiator does not choose an initial response outcome');assert(await button(a,'Reply').isVisible(),'Either dispute participant can continue replying');
  assert.equal(await pop(a).getByText('Factual',{exact:true}).count(),0,'Internal Signals stay hidden');
  await open(b,dispute.id,'argument');assert(await button(b,'Reply').isVisible(),'The recipient can continue after an earlier response');

  // Every entry point opens the same detail, never a legacy generic Context card.
  await open(a,dispute.id,'argument');assert.deepEqual(await detail(a),direct);
  for(const query of ["It's false",'outdated','omits remote participants','Evening meeting']){
    await find(a,query);assert(await result(a,dispute.id).isVisible(),`Dispute is searchable by ${query}`);
  }
  await reveal(a,dispute.id);assert.deepEqual(await detail(a),direct);
  assert.equal(await a.locator(`.reasoning-card[data-entry="${dispute.id}"]`).count(),0,'Search must not project a modern dispute as Context');
  await find(a,'Partly accept');assert(await result(a,response.id).isVisible(),'Responses are searchable by outcome');
  await reveal(a,response.id);assert.match(await pop(a).innerText(),/Partly accept/);
  assert.match(await pop(a).innerText(),/It's false/,'A matching response opens within its initiating dispute');
  await find(a,'Factual');assert.equal(await search(a).locator('.interaction-search-result').count(),0,'Search never indexes hidden Signals');
  assert.equal(await search(a).getByRole('button',{name:'Open challenges',exact:true}).count(),0);
  await search(a).getByRole('button',{name:'Disputes',exact:true}).click();
  await search(a).getByRole('searchbox',{name:'Search interactions',exact:true}).fill('');
  assert(await result(a,dispute.id).isVisible());assert.equal(await result(a,response.id).count(),0);
  await search(a).getByRole('button',{name:'All',exact:true}).click();
  await search(a).getByRole('button',{name:'Close',exact:true}).click();

  // Common search has mode-local queries and keyboard focus, with the grammar's action boundaries.
  for(const [which,query,id] of [['compare','I already hold this',position.id],['inquiry',"I don't know",answer.id],['argument','The reason assumes the conclusion',edgeDispute.id]]){
    await mode(a,which);await find(a,query);assert(await result(a,id).isVisible());
    assert.equal(await a.locator(`#reasoning-${which}-mode`).getAttribute('aria-pressed'),'true');
    await a.keyboard.press('Escape');assert.equal(await search(a).isVisible(),false);
    assert.equal(await a.getByRole('button',{name:'Find',exact:true}).evaluate(el=>document.activeElement===el),true);
  }
  await mode(a,'compare');await a.getByRole('button',{name:'Find',exact:true}).click();
  assert.equal(await search(a).getByRole('searchbox',{name:'Search interactions',exact:true}).inputValue(),'I already hold this');
  assert.equal(await result(a,dispute.id).count(),0,'Compare search stays scoped to Compare');
  await search(a).getByRole('button',{name:'Close',exact:true}).click();
  await open(a,request.id,'inquiry');assert.match(await pop(a).locator(`[data-entry="${answer.id}"]`).innerText(),/I don't know/);

  // A modern dispute sharing a source must not hijack its earlier reason badge.
  await close(a);await mode(a,'argument');
  const reasons=a.locator('.discussion-rail .reasons[aria-label="1 reasons attached to Evening meeting"]');
  await reasons.focus();await a.keyboard.press('Enter');
  assert(await pop(a).locator(`[data-entry="${earlierReason.id}"]`).isVisible());
  assert.equal(await pop(a).locator(`[data-entry="${mixedDispute.id}"]`).count(),0);
  assert.equal(await reasons.getAttribute('aria-expanded'),'true');
  await pop(a).locator(`[data-entry="${earlierReason.id}"]`).click();await noRetiredActions(a);
  assert.match(await pop(a).innerText(),/Earlier supporting reason/);
  assert.match(await pop(a).locator(`[data-entry="${earlierReply.id}"]`).innerText(),/Withdrawn/,'Earlier withdrawn replies remain nested under their parent');
  await pop(a).getByText('Source wording & history',{exact:true}).click();
  assert.match(await pop(a).locator('.discussion-source-history').innerText(),/Changed source wording after its earlier reason/);
  assert.equal(await button(a,'Confirm current source wording').count(),0,'Earlier reasons cannot revive retired source-review authoring');
  await pop(a).locator(`[data-entry="${earlierReply.id}"]`).click();
  assert.match(await pop(a).innerText(),/Withdrawn earlier response remains readable/);
  assert(await pop(a).getByText('Withdrawn',{exact:true}).isVisible());
  await noRetiredActions(a);
  await close(a);
  const challenges=a.locator('.discussion-rail .challenges').filter({hasText:'2'}).first();
  await challenges.focus();await a.keyboard.press('Enter');
  assert(await pop(a).locator(`[data-entry="${mixedDispute.id}"]`).isVisible());
  assert(await pop(a).locator(`[data-entry="${earlierChallenge.id}"]`).isVisible());
  assert.equal(await pop(a).locator(`[data-entry="${earlierReason.id}"]`).count(),0);
  await pop(a).locator(`[data-entry="${earlierChallenge.id}"]`).click();await noRetiredActions(a);
  await open(a,earlierPremise.id,'argument');
  await pop(a).getByText('Source wording & history',{exact:true}).click();
  assert.match(await pop(a).locator('.discussion-source-history').innerText(),/Changed source wording after its earlier reason/);
  assert.equal(await button(a,'Confirm current conclusion wording').count(),0,'Earlier premise reasons cannot revive retired conclusion-review authoring');
  await open(a,earlierPoint.id,'argument');
  assert.match(await pop(a).locator(`[data-entry="${earlierOutcome.id}"]`).innerText(),/Withdrawn/,'Earlier points retain withdrawn individual outcomes');
  await pop(a).locator(`[data-entry="${earlierOutcome.id}"]`).click();
  assert.match(await pop(a).innerText(),/A withdrawn individual outcome remains readable/);await noRetiredActions(a);
  await open(a,modernOnEarlier.id,'inquiry');
  assert.equal(await button(a,'Back to Interaction').count(),0,'A modern request names its actual earlier parent');
  await click(a,'Back to Reason');
  assert.match(await pop(a).innerText(),/Earlier supporting reason/);
  assert.equal(await a.locator('#reasoning-argument-mode').getAttribute('aria-pressed'),'true','Returning to an earlier reason uses its originating mode');
  await conversations(a,'argument');
  assert.equal(await pop(a).locator(`[data-entry="${withdrawn.id}"]`).count(),0,'Withdrawn initiators are absent from active conversation rows');
  await pop(a).getByText('Withdrawn interactions',{exact:true}).click();
  await pop(a).locator(`[data-entry="${withdrawn.id}"]`).click();
  assert(await pop(a).locator(`[data-entry="${historicalResponse.id}"]`).isVisible(),'A withdrawn initiator retains its active response');
  assert.equal(await button(a,'Respond').count(),0,'Withdrawn history cannot receive new responses');

  // Modes share one source geometry, camera, selections, and expansion state.
  await close(a);await node(a,'Daytime meeting');await close(a);await mode(a,'compare');
  const before=await geometry(a);
  for(const which of ['inquiry','argument','compare']){await mode(a,which);assert.deepEqual(await geometry(a),before,`${which} preserves radial coordinates and camera`);}
  await mode(a,'inquiry');await node(a,'Daytime meeting');await click(a,'Request reason');
  await a.locator('#interaction-comment').fill('A parked inquiry draft');
  a.once('dialog',d=>d.dismiss());await a.getByRole('button',{name:'Change maps',exact:true}).click();
  assert.equal(await a.locator('#interaction-comment').inputValue(),'A parked inquiry draft');assert.equal(await setup.isVisible(),false,'Canceling Change maps preserves the current pair and unfinished interaction');
  await mode(a,'compare');assert.equal(await pop(a).isVisible(),false);
  await mode(a,'argument');assert.equal(await pop(a).isVisible(),false);
  await mode(a,'inquiry');assert.equal(await a.locator('#interaction-comment').inputValue(),'A parked inquiry draft');
  await a.locator('#interaction-comment').fill('');await click(a,'Send request');
  await a.waitForFunction(()=>document.getElementById('storage-status')?.textContent.includes('All changes saved'));
  await button(a,'Edit').waitFor();
  const savedRequest=(await view(store,alice)).workspace.discussions.filter(r=>r.kind==='interaction'&&r.action==='request_reason').at(-1);
  assert(savedRequest);await load(a);await open(a,savedRequest.id,'inquiry');
  assert.match(await pop(a).innerText(),/Request reason/,'New interactions remain accessible after reload');
  await close(a);await mode(a,'argument');
  const sourceSide=await a.locator('#compare-map-a').inputValue()===aMap.id?'a':'b';
  assert.equal(await a.locator('#compare-map-'+sourceSide).inputValue(),aMap.id,'Resolve the source map side after reload');
  await a.locator('.comparison-view-options>summary').click();
  await a.locator('#compare-collapse-'+sourceSide).click();
  await a.locator('.comparison-view-options>summary').click();
  assert.equal(await a.locator('#compare-canvas .node-main').filter({has:a.getByText('Nested source',{exact:true})}).count(),0);
  await find(a,'Nested ambiguity');await reveal(a,nestedDispute.id);
  assert.match(await pop(a).innerText(),/Nested ambiguity to investigate/);
  assert.equal(await a.locator('#compare-canvas .node-main').filter({has:a.getByText('Nested source',{exact:true})}).count(),1,'Find reveals the real source inside a collapsed branch');

  // Node and edge interactions use the same detail on a narrow viewport.
  await close(a);await a.setViewportSize({width:390,height:844});await mode(a,'argument');
  await find(a,'The reason assumes the conclusion');await reveal(a,edgeDispute.id);
  assert.match(await pop(a).innerText(),/The reason assumes the conclusion/);
  await a.waitForFunction(()=>{const p=document.querySelector('.discussion-popover').getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth&&p.left>=0&&p.right<=innerWidth;});
  assert.equal(await a.locator(`.reasoning-card[data-entry="${edgeDispute.id}"]`).count(),0);
  await a.screenshot({path:'build/design-review/mode-consistency-mobile.png',fullPage:true});
  await close(a);await find(a,'outdated');
  const searchBounds=await search(a).boundingBox();assert(searchBounds.x>=0&&searchBounds.x+searchBounds.width<=390,'Find fits the narrow viewport');
  await search(a).getByRole('button',{name:'Close',exact:true}).click();await a.setViewportSize({width:1440,height:1000});
  // The screenshot regression: two different real pairs must never become an
  // apparent connection from their shared collapsed ancestor to another node.
  const nested={type:'node',mapId:aMap.id,nodeId:ids['Nested source']},conclusion={type:'node',mapId:aMap.id,nodeId:ids['Earlier conclusion']},survey={type:'node',mapId:bMap.id,nodeId:ids['Survey results']};
  const agreement=await seed(alice,{kind:'relationship',action:'agreement',target:nested,other:bSource,body:''});
  const linked=await seed(alice,{kind:'correspondence',action:'counterpart_link',target:conclusion,other:survey,body:'Comparable material, without an agreement judgment.'});
  const withdrawnJudgment=await seed(bob,{kind:'relationship',action:'disagreement',target:bSource,other:nested,body:'An earlier judgment kept in history.'});
  await edit(store,bob,ws=>{const old=ws.discussions.find(r=>r.id===withdrawnJudgment.id);ws.discussions=ws.discussions.map(r=>r.id===old.id?makeDiscussion(ws,{...old,status:'withdrawn'},bob.id,old):r);const map=ws.maps.find(m=>m.id===bMap.id),node=addNode(ws,bob,'Survey detail');node.kind='position';node.parent=ids['Survey results'];synchronizeIdeas(ws,map);});
  // Earlier releases allowed frame-head relationships. Keep this stored-history
  // fixture without routing it through today's ordinary-node linking rules.
  const historicalWorkspace=(await view(store,alice)).workspace;
  const frameAgreement={...structuredClone(agreement),id:`discussion-${crypto.randomUUID()}`,target:{type:'node',mapId:aMap.id,nodeId:'status'},other:{type:'node',mapId:bMap.id,nodeId:'status'},body:'A genuine frame-level connection.'};
  frameAgreement.targetLabel=discussionTargetLabel(historicalWorkspace,frameAgreement.target);
  frameAgreement.sourceSnapshots=discussionSnapshots(historicalWorkspace,frameAgreement);
  await store.commit(alice.id,(await store.snapshot()).revision,[{kind:'discussion',id:frameAgreement.id,expectedRevision:0,value:frameAgreement}]);
  const connectionReply=await seed(bob,{kind:'reply',action:'reply',target:{type:'entry',entryId:agreement.id},layer:'map',body:'Earlier discussion attached to the actual pair.'});
  const {recordComparison}=await import('../dist/workspace.mjs');let earlierPair;
  await edit(store,alice,ws=>{earlierPair=recordComparison(ws,{aMapId:aMap.id,bMapId:bMap.id,aNodeId:nested.nodeId,bNodeId:bSource.nodeId,questionStatus:'matched',question:'Earlier pair wording',answerStatus:'aligned',notes:''},null,alice.id);ws.comparisons.push(earlierPair);});
  const unchanged=JSON.stringify((await view(store,alice)).workspace);
  await load(a);await mode(a,'compare');
  const bobSide=await a.locator('#compare-map-a').inputValue()===bMap.id?'a':'b',aliceSide=bobSide==='a'?'b':'a';
  await a.getByRole('button',{name:`Collapse Survey results in map ${bobSide.toUpperCase()}`,exact:true}).click();
  const options=async()=>a.locator('.comparison-view-options>summary').click();
  await options();await a.locator('#compare-collapse-'+bobSide).click();await options();
  assert.equal(await a.locator('.discussion-relationship').count(),1,'A real visible pair keeps its own edge while hidden pairs have no ancestor edge');
  const hiddenBadge=()=>a.locator(`.node[data-side="${bobSide}"] .collapsed-connection-badge`);
  assert.equal(await hiddenBadge().getAttribute('aria-label'),'2 connections inside this branch','Multiple meanings on one pair do not inflate branch counts');
  await hiddenBadge().focus();await a.keyboard.press('Enter');
  assert.equal(await pop(a).locator('.collapsed-connection-pair').count(),2);
  for(const r of [agreement,linked,earlierPair,withdrawnJudgment])assert(await pop(a).locator(`[data-entry="${r.id}"]`).isVisible());
  assert.match(await pop(a).locator(`[data-entry="${withdrawnJudgment.id}"]`).innerText(),/Withdrawn/);
  assert.match(await pop(a).innerText(),/Alice · Status Quo › Evening meeting › Nested source/);
  assert.match(await pop(a).innerText(),/Bob · Status Quo › Daytime meeting/);
  await a.screenshot({path:'build/design-review/collapsed-connections.png',fullPage:true});
  const zoomBefore=await a.locator('#compare-canvas .comparison-zoom').innerText();
  await close(a);assert(await hiddenBadge().evaluate(el=>document.activeElement===el),'Closing a branch list restores keyboard focus to its rebuilt badge');
  await mode(a,'inquiry');
  await a.getByRole('button',{name:`Expand Status Quo in map ${bobSide.toUpperCase()}`,exact:true}).click();
  await node(a,'Daytime meeting');await click(a,'Request reason');
  await a.locator('#interaction-comment').fill('Keep this inquiry draft');
  await a.getByRole('button',{name:`Collapse Status Quo in map ${bobSide.toUpperCase()}`,exact:true}).focus();await a.keyboard.press('Enter');
  a.once('dialog',dialog=>dialog.dismiss());await hiddenBadge().focus();await a.keyboard.press('Enter');
  assert.equal(await a.locator('#interaction-comment').inputValue(),'Keep this inquiry draft','Opening collapsed pair details honors the existing draft safeguard');
  a.once('dialog',dialog=>dialog.accept());await close(a);await mode(a,'compare');
  await hiddenBadge().focus();await a.keyboard.press('Enter');
  await pop(a).locator('.collapsed-connection-pair').filter({has:a.locator(`[data-entry="${agreement.id}"]`)}).getByRole('button',{name:'Show connected nodes',exact:true}).click();
  assert.equal(await a.locator('#compare-canvas .comparison-zoom').innerText(),zoomBefore,'Revealing both actual endpoints preserves zoom');
  for(const title of ['Nested source','Daytime meeting'])assert(await a.locator('#compare-canvas .node-main').filter({has:a.getByText(title,{exact:true})}).isVisible());
  assert.equal(await a.getByRole('button',{name:`Expand Survey results in map ${bobSide.toUpperCase()}`,exact:true}).getAttribute('aria-expanded'),'false','Unrelated branches stay folded');
  assert.equal(await a.locator('.discussion-relationship').count(),3,'Revealed true pairs draw independently');
  await close(a);assert(await a.locator('.discussion-relationship-hit:focus,.node-main:focus').count(),'Removed ancestor badge yields focus to a real connection or source');
  await node(a,'Nested source');assert.equal(await button(a,'Request counterpart').count(),0,'Collapsed presentation never changes counterpart state');await close(a);
  await options();for(const side of ['a','b'])await a.locator('#compare-collapse-'+side).click();await options();
  assert.equal(await a.locator('.collapsed-connection-badge').count(),2,'Both collapsed branches provide access without drawing a proxy line');
  assert.deepEqual(await a.locator('.collapsed-connection-badge').evaluateAll(bs=>bs.map(b=>b.getAttribute('aria-label'))),['2 connections inside this branch','2 connections inside this branch']);
  await options();await a.locator('#compare-frame-'+aliceSide).selectOption('goal');await options();
  assert.equal(await a.locator('.collapsed-connection-badge').count(),0,'A filtered endpoint is not represented as a collapsed connection');
  await open(a,agreement.id,'compare');
  // Opening a conversation already reveals its sources. Reapply the filter
  // while its detail stays open to exercise the explicit pair-reveal action.
  await options();await a.locator('#compare-frame-'+aliceSide).selectOption('goal');await options();
  await click(a,'Show connected nodes');
  assert.match(await pop(a).innerText(),/frame filter was cleared/);assert.equal(await a.locator('#compare-frame-'+aliceSide).inputValue(),'all');
  await pop(a).locator(`[data-entry="${agreement.id}"]`).click();
  assert(await pop(a).locator(`[data-entry="${connectionReply.id}"]`).isVisible(),'The real pair retains its earlier follow-ups');
  await pop(a).locator(`[data-entry="${connectionReply.id}"]`).click();assert.match(await pop(a).innerText(),/Earlier discussion attached to the actual pair/);
  assert.equal(JSON.stringify((await view(store,alice)).workspace),unchanged,'Connection projection and reveal never rewrite saved maps or relationships');

  // Editing after a frame, citation, or edge-type change must never retain
  // invisible selected options. Reconcile them explicitly and preserve history.
  await edit(store,bob,ws=>{const map=ws.maps.find(m=>m.id===bMap.id),source=map.nodes.find(n=>n.id===bSource.nodeId);source.parent='goal';source.sourceTitle='';source.sourceUrl='';map.relations.find(edge=>edge.id==='survey-reason').type='cause';synchronizeIdeas(ws,map);});
  await load(a);await open(a,dispute.id,'argument');await click(a,'Edit');
  assert.match(await pop(a).innerText(),/earlier dispute choices/);
  assert.match(await pop(a).innerText(),/It's false/);assert.match(await pop(a).innerText(),/The data is outdated/);
  assert.equal(await pop(a).locator('input[name="interaction-option"]').count(),4);
  assert.equal(await pop(a).locator('input[name="interaction-option"]:checked').count(),0,'Legacy choices do not silently map to broad categories');
  assert.equal(await a.locator('#interaction-comment').inputValue(),dispute.interaction.otherText,'Earlier Other wording remains visible in the draft');
  await click(a,'Save changes');assert.match(await pop(a).getByRole('alert').innerText(),/at least one/);
  assert.deepEqual((await view(store,alice)).workspace.discussions.find(r=>r.id===dispute.id),dispute,'An unsuccessful conversion preserves the original');
  a.once('dialog',d=>d.accept());await close(a);await open(a,dispute.id,'argument');await click(a,'Edit');
  await pop(a).locator('input[value="feasibility"]').check();await a.locator('#interaction-comment').fill('Updated after reviewing the changed source.');await click(a,'Save changes');await button(a,'Edit').waitFor();
  const revisedDispute=(await view(store,alice)).workspace.discussions.find(r=>r.id===dispute.id);
  assert.deepEqual(revisedDispute.interaction.options,['feasibility']);assert.equal(revisedDispute.interaction.version,5);assert.equal(revisedDispute.interaction.classification.frame,'goal');
  assert.deepEqual(revisedDispute.history.at(-1).interaction,dispute.interaction);
  await pop(a).getByText('Earlier versions',{exact:true}).click();assert.match(await pop(a).locator('.interaction-history').innerText(),/It's false/);assert.match(await pop(a).locator('.interaction-history').innerText(),/The attendance estimate omits remote participants/);
  await open(a,edgeDispute.id,'argument');await click(a,'Edit');assert.match(await pop(a).innerText(),/The reason assumes the conclusion/);
  await pop(a).locator('input[value="reasoning"]').check();await click(a,'Save changes');await button(a,'Edit').waitFor();
  const revisedEdge=(await view(store,alice)).workspace.discussions.find(r=>r.id===edgeDispute.id);
  assert.deepEqual(revisedEdge.interaction.options,['reasoning']);assert.equal(revisedEdge.interaction.classification.edgeType,'cause');assert.deepEqual(revisedEdge.history.at(-1).interaction,edgeDispute.interaction);
  await edit(store,bob,ws=>{const map=ws.maps.find(m=>m.id===bMap.id);map.relations=map.relations.filter(edge=>edge.id!=='survey-reason');});
  await load(a);await open(a,edgeDispute.id,'argument');await click(a,'Edit');
  assert.match(await pop(a).innerText(),/This source no longer offers dispute choices/);assert.equal(await button(a,'Save changes').count(),0,'A removed connection does not offer an impossible edit');
  await click(a,'Back to interaction');assert(await button(a,'Withdraw').isVisible(),'The saved interaction remains readable and withdrawable');
  assert.deepEqual((await view(store,alice)).workspace.discussions.find(r=>r.id===edgeDispute.id),revisedEdge,'Opening an unavailable edit does not rewrite history');

  // Legacy non-position nodes stay readable without advertising a confidence
  // action the model does not support, consistently with Map/Create.
  const legacyTitles=['topic','question','explainer'].map(kind=>'Legacy '+kind);
  await edit(store,alice,ws=>{const map=ws.maps.find(m=>m.id===aMap.id);for(const kind of ['topic','question','explainer']){const n=addNode(ws,alice,'Legacy '+kind);n.kind=kind;n.parent='status';n.confidence=null;}synchronizeIdeas(ws,map);});
  await load(a);
  for(const which of ['inquiry','compare','argument']){
    await mode(a,which);
    for(const title of legacyTitles){await node(a,title);const card=a.locator('#compare-canvas .node').filter({has:a.getByText(title,{exact:true})});assert.equal(await card.locator('.node-confidence').count(),0,`${which} omits unsupported confidence for ${title}`);assert(await button(a,'Edit in my map').isVisible());}
    await node(a,'Evening meeting');assert.equal(await button(a,'My confidence').count(),0,'Confidence is not duplicated in the source actions');await close(a);
    await a.locator('#compare-canvas .node').filter({has:a.getByText('Evening meeting',{exact:true})}).locator('button.node-confidence').click();assert(await pop(a).locator('.confidence-form').isVisible(),`${which} retains direct confidence for an owned position`);await close(a);
  }
  await a.goto(origin+'/#map='+aMap.id);await a.locator('#editor-main').waitFor();await a.locator('#all').click();
  for(const title of [...legacyTitles,'Evening meeting']){
    const card=a.locator('#cards .node-main').filter({has:a.getByText(title,{exact:true})});await card.focus();await a.keyboard.press('Enter');
    assert.equal(await card.locator('..').locator('.node-confidence').count(),title==='Evening meeting'?1:0,`Map/Create has the same confidence eligibility for ${title}`);
    assert.equal(await a.locator('.on-map-actions').getByRole('button',{name:'My confidence',exact:true}).count(),0,'Map/Create uses the direct confidence slot');
  }
  // An inaccessible former source remains history, never a selectable map.
  await edit(store,bob,ws=>{ws.maps.find(m=>m.id===bMap.id).visibility='private';});
  await a.goto(origin+'/?unavailable-picker#library=comparisons');await a.getByRole('button',{name:'Choose maps',exact:true}).click();
  assert.equal(await a.locator(`#compare-map-b option[value="${bMap.id}"]`).count(),0);assert(await start.isDisabled());
  assert.match(await a.locator('#comparison-map-help').innerText(),/needs two different maps/,'The setup explains why no second accessible choice is available');
  assert.deepEqual(errors,[]);
  console.log('Mode consistency browser: visible comparison setup, keyboard and narrow source selection, preselection, existing-pair reopening, unavailable sources, shared lists/counts, dispute and response search, exact attachment categories, one detail path, recipients, retired controls, mode-local drafts/search, stable radial geometry, persistence, source-change edits with preserved history, keyboard and narrow screens passed.');
}catch(error){
  for(const [i,ctx]of browser.contexts().entries())for(const p of ctx.pages()){
    await p.screenshot({path:`build/design-review/mode-consistency-failure-${i}.png`,fullPage:true});
    console.error((await p.locator('body').innerText()).slice(-6000));
  }
  console.error(errors);throw error;
}finally{
  await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));
}
