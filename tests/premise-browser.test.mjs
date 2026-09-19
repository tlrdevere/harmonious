import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {accountWorkspace,saveAccountChanges,startAccountComparison} from '../worker/account-api.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {makeDefinition,definitionReference,definitionReferenceText} from '../dist/definitions.mjs';
import {synchronizeIdeas} from '../dist/adoption.mjs';

// Both disposable browser accounts use the production account API boundary.
// Tests deliberately lose acknowledgments and edit sources while forms are open.
const playwright=process.env.HARMONIOUS_PLAYWRIGHT;
if(!playwright)throw Error('Set HARMONIOUS_PLAYWRIGHT to the installed playwright entry point.');
const {chromium}=await import(pathToFileURL(playwright));
const store=memoryStore(),ids={};let definition;
for(const actor of [alice,bob]){
  await seedActor(store,actor);await edit(store,actor,ws=>{
    const map=ws.maps.find(m=>m.ownerId===actor.id);map.name=actor.name+' positions';map.visibility='shared';
    const titles=actor===alice?['First conclusion','Second conclusion','Retry conclusion','Reviewed supporting position','Wrong frame','Not a position',...Array.from({length:32},(_,i)=>'Other position '+String(i).padStart(2,'0'))]:['Bob conclusion','Bob supporting position'];
    for(const title of titles){const node=addNode(ws,actor,title);node.kind=title==='Not a position'?'question':'position';node.parent=title==='Wrong frame'?'goal':'status';node.summary='Original explanation: '+title;node.details='Detailed source wording: '+title;ids[title]=node.id;if(title==='Reviewed supporting position'){node.sourceTitle='Original source notes';node.sourceUrl='https://example.org/source-notes';}}
    synchronizeIdeas(ws,map);
    if(actor===alice){definition=makeDefinition(ws,{type:'definition',title:'Reviewed meaning',body:'Exact invoked meaning, version one.'},actor.id);ws.definitions.push(definition);const refs=[definitionReference(definition)];ws.discussions.push(makeDiscussion(ws,{kind:'context',action:'context',target:{type:'node',mapId:map.id,nodeId:ids['Reviewed supporting position']},body:definitionReferenceText(refs),definitionRefs:refs},actor.id));}
  });
}
let initial=(await view(store,alice)).workspace;
const aMap=initial.maps.find(m=>m.ownerId===alice.id),bMap=initial.maps.find(m=>m.ownerId===bob.id);
const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:aMap.id,bMapId:bMap.id});
await edit(store,alice,ws=>{const old=ws.definitions.find(d=>d.id===definition.id);ws.definitions=ws.definitions.map(d=>d.id===old.id?makeDefinition(ws,{body:'PRIVATE UNINVOKED LIBRARY REVISION'},alice.id,old):d);});
let loseNext=false;const writes=[],errors=[];
const respond=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'),actor=req.headers['x-test-actor']==='bob'?bob:alice;
    if(url.pathname.startsWith('/api/')){
      let body='';for await(const chunk of req)body+=chunk;const input=body?JSON.parse(body):null;
      if(url.pathname==='/api/session'){respond(res,200,{configured:true,actor,signup:{mode:'public'}});return;}
      if(url.pathname==='/api/comparisons'){respond(res,200,await startAccountComparison(store,actor.id,input));return;}
      if(url.pathname==='/api/workspace'&&req.method==='PUT'){
        const result=await saveAccountChanges(store,actor.id,input.changes);writes.push(input.changes);
        if(loseNext&&input.changes.some(c=>c.kind==='discussion'&&c.value.premise)){loseNext=false;respond(res,503,{error:'The save response was lost after committing.'});return;}
        respond(res,200,result);return;
      }
      respond(res,200,await accountWorkspace(store,actor));return;
    }
    const name=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!/^[a-z0-9.-]+$/.test(name)){res.writeHead(404);res.end();return;}
    let content=await readFile(resolve('dist',name),'utf8');if(name==='index.html')content=content.replace('src="./app.mjs"','src="./beta-boot.mjs"').replace('</head>','<link rel="stylesheet" href="./accounts.css"></head>');
    res.setHeader('content-type',name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'text/javascript');res.end(content);
  }catch(error){respond(res,error.status||500,{error:error.message});}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:process.env.HARMONIOUS_BROWSER||'msedge'});
try{
  await mkdir('build/design-review',{recursive:true});
  const pages=[];for(const actor of ['alice','bob']){const context=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{'x-test-actor':actor}});const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());pages.push(page);}
  const [a,b]=pages,pop=p=>p.locator('.discussion-popover'),action=(p,name)=>pop(p).getByRole('button',{name,exact:true}).click();
  const actionExists=async(p,name)=>await pop(p).getByRole('button',{name,exact:true}).count()>0;
  const saved=p=>p.waitForFunction(()=>document.getElementById('storage-status')?.textContent.includes('All changes saved'));
  const close=async p=>{if(await pop(p).isVisible())await action(p,'Close');};
  const expand=async p=>{await p.locator('.comparison-view-options>summary').click();for(const side of ['a','b'])await p.locator('#compare-all-'+side).click();await p.locator('.comparison-view-options>summary').click();};
  const node=async(p,title)=>{await close(p);const n=p.locator('#compare-canvas .node-main').filter({has:p.getByText(title,{exact:true})}).first();if(await n.getAttribute('aria-pressed')==='true'){await n.focus();await p.keyboard.press('Enter');}await n.focus();await p.keyboard.press('Enter');};
  const start=async(p,title)=>{await node(p,title);await p.locator('#reasoning-argument-mode').click();await action(p,'Explain my reasoning');await action(p,'Use one of my nodes');};
  const choose=async(p,title)=>{await pop(p).getByRole('searchbox',{name:'Find one of my nodes'}).fill(title);await pop(p).locator('.premise-choice').filter({has:p.getByText(title,{exact:true})}).click();};
  const records=async()=>((await view(store,alice)).workspace.discussions),reasonFor=async title=>(await records()).find(r=>r.premise&&r.target.nodeId===ids[title]);
  const openReason=async(p,id)=>{await close(p);const card=p.locator(`.reasoning-card[data-entry="${id}"] .reasoning-main`);await card.focus();await p.keyboard.press('Enter');};
  let loadId=0;const load=async p=>{await p.goto(origin+'/?load='+(++loadId)+'#comparison='+thread.id);await expand(p);};
  const openFromSource=async(p,title,id)=>{await node(p,title);await p.locator('#reasoning-argument-mode').click();await close(p);const rail=p.getByRole('button',{name:new RegExp('reasons attached to '+title)}).first();if(await rail.count())await rail.click();await openReason(p,id);};
  const updateSource=async values=>edit(store,alice,ws=>{const map=ws.maps.find(m=>m.id===aMap.id);Object.assign(map.nodes.find(n=>n.id===ids['Reviewed supporting position']),values);map.revision++;synchronizeIdeas(ws,map);});
  await load(a);await start(a,'First conclusion');
  assert.equal(await pop(a).locator('.premise-choice').count(),30,'The picker bounds its initial result list');
  assert.match(await pop(a).innerText(),/Showing 30 of/);assert.match(await pop(a).innerText(),/Alice positions · Status Quo/);
  for(const excluded of ['First conclusion','Wrong frame','Not a position','Bob supporting position']){await pop(a).getByRole('searchbox').fill(excluded);assert.equal(await pop(a).locator('.premise-choice').count(),0,excluded+' is not eligible');}
  await choose(a,'Reviewed supporting position');assert.match(await pop(a).innerText(),/Supports this conclusion\s+First conclusion/);
  assert.equal(await pop(a).getByRole('textbox',{name:'Your reason',exact:true}).count(),0,'A used-node form has no separate explanation');
  await pop(a).getByText('Definitions & standards used by this node',{exact:true}).click();assert.match(await pop(a).innerText(),/Exact invoked meaning, version one/);assert(!(await pop(a).innerText()).includes('PRIVATE UNINVOKED'));
  assert.equal(await pop(a).getByRole('link',{name:'Original source notes'}).getAttribute('href'),'https://example.org/source-notes');
  await a.locator('#reasoning-compare-mode').click();assert.equal(await pop(a).isVisible(),false);await a.locator('#reasoning-argument-mode').click();assert.equal(await pop(a).locator('.premise-choice[aria-pressed=true]').count(),1,'Switching modes parks the node selection');
  await action(a,'Write a reason');await a.locator('#discussion-body').fill('A written draft remains available.');await action(a,'Use one of my nodes');await action(a,'Write a reason');assert.equal(await a.locator('#discussion-body').inputValue(),'A written draft remains available.');await action(a,'Use one of my nodes');
  await a.screenshot({path:'build/design-review/premise-picker-desktop.png',fullPage:true});await a.setViewportSize({width:390,height:844});await a.waitForFunction(()=>{const r=document.querySelector('.discussion-popover').getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth&&r.left>=0&&r.right<=innerWidth+1;});await a.screenshot({path:'build/design-review/premise-picker-mobile.png',fullPage:true});await a.setViewportSize({width:1440,height:1000});
  const untouchedMaps=structuredClone((await view(store,alice)).workspace.maps);
  await action(a,'Use selected node');await pop(a).getByRole('button',{name:'Review used node',exact:true}).waitFor();const first=await reasonFor('First conclusion');assert(first);assert.equal(first.body,'Reviewed supporting position');assert.equal(first.premise.nodeId,ids['Reviewed supporting position']);assert.equal(first.premise.mapId,aMap.id);assert.equal(first.premise.contexts[0].definitionRefs[0].version,1);assert.deepEqual((await view(store,alice)).workspace.maps,untouchedMaps,'Using a node leaves both source maps unchanged');
  await action(a,'Add supporting reason');await action(a,'Use one of my nodes');await pop(a).getByRole('searchbox').fill('Reviewed supporting position');assert.equal(await pop(a).locator('.premise-choice').count(),0,'An ancestor position cannot recur in its support chain');await action(a,'Close');
  await start(a,'First conclusion');await pop(a).getByRole('searchbox').fill('Reviewed supporting position');assert.equal(await pop(a).locator('.premise-choice').count(),0,'A position cannot duplicate support for the same target');await action(a,'Close');
  await start(a,'Second conclusion');await choose(a,'Reviewed supporting position');await action(a,'Use selected node');await pop(a).getByRole('button',{name:'Review used node',exact:true}).waitFor();const second=await reasonFor('Second conclusion');assert(second);assert.notEqual(first.id,second.id);assert.equal(first.premise.nodeId,second.premise.nodeId,'One position may support distinct conclusions');

  // The other participant can distinguish the statement from its Supports link.
  await load(b);await openFromSource(b,'First conclusion',first.id);assert.equal(await pop(b).getByRole('button',{name:'Review used node',exact:true}).count(),0);assert.equal(await pop(b).getByRole('button',{name:'Add supporting reason',exact:true}).count(),0);
  await close(b);const definitionsIcon=b.locator(`.reasoning-card[data-entry="${first.id}"] .reasoning-definitions`);assert.equal(await definitionsIcon.count(),1,'A reason using a node exposes its pinned definitions');await definitionsIcon.focus();await b.keyboard.press('Enter');assert.match(await pop(b).innerText(),/Exact invoked meaning, version one/);assert(!(await pop(b).innerText()).includes('PRIVATE UNINVOKED'));assert.equal(await pop(b).getByText('Exact invoked meaning, version one.',{exact:true}).count(),1);await action(b,'Back to contribution');
  await action(b,'Challenge reason');await b.locator('#discussion-body').fill('I dispute the used position itself.');await action(b,'Add challenge');await saved(b);const statementChallenge=(await records()).find(r=>r.body==='I dispute the used position itself.');assert.deepEqual(statementChallenge.target,{type:'entry',entryId:first.id});
  await openReason(b,first.id);await action(b,'Inspect reasoning connection');await action(b,'Challenge reasoning');await b.locator('#discussion-body').fill('This position does not establish the conclusion.');await action(b,'Add challenge');await saved(b);const inferenceChallenge=(await records()).find(r=>r.body==='This position does not establish the conclusion.');assert.deepEqual(inferenceChallenge.target,{type:'inference',entryId:first.id});
  await pop(b).locator('.discussion-source-history>summary').click();assert.match(await pop(b).innerText(),/Original explanation: Reviewed supporting position/,'The challenge retains the reviewed source details');
  await start(b,'Bob conclusion');await choose(b,'Bob supporting position');await action(b,'Use selected node');await pop(b).getByRole('button',{name:'Review used node',exact:true}).waitFor();const bobReason=await reasonFor('Bob conclusion');assert.equal(bobReason.authorId,bob.id);assert.equal(bobReason.premise.mapId,bMap.id);

  // A source changes while the picker is open: explicit review, without losing selection.
  await start(a,'Retry conclusion');await choose(a,'Reviewed supporting position');await updateSource({summary:'Updated after the picker was opened.'});
  await action(a,'Use selected node');await pop(a).getByRole('button',{name:'I reviewed the updated wording',exact:true}).waitFor();assert.equal(await reasonFor('Retry conclusion'),undefined);assert.equal(await pop(a).locator('.premise-choice[aria-pressed=true]').count(),1);
  await action(a,'I reviewed the updated wording');assert.match(await pop(a).locator('.premise-preview').innerText(),/Updated after the picker was opened/);
  // The save commits but its acknowledgment is lost; source then changes again.
  loseNext=true;await action(a,'Use selected node');await pop(a).getByRole('alert').filter({hasText:'save response was lost'}).waitFor();const retry=await reasonFor('Retry conclusion');assert(retry);const writtenBeforeRetry=writes.length;await updateSource({summary:'Changed after the lost response.'});await action(a,'Use selected node');await pop(a).getByRole('button',{name:'Review used node',exact:true}).waitFor();assert.equal(writes.length,writtenBeforeRetry,'A committed pending ID is recovered before changed-source validation');assert.equal((await records()).filter(r=>r.premise&&r.target.nodeId===ids['Retry conclusion']).length,1);assert.equal((await reasonFor('Retry conclusion')).premise.wording.summary,'Updated after the picker was opened.');

  // Refresh is a new reason version, with earlier node wording and challenges intact.
  await load(a);await openFromSource(a,'First conclusion',first.id);assert.match(await pop(a).innerText(),/Source.*changed/);await action(a,'Review used node');assert.match(await pop(a).innerText(),/Original explanation: Reviewed supporting position/);assert.match(await pop(a).innerText(),/Changed after the lost response/);
  await a.screenshot({path:'build/design-review/premise-review.png',fullPage:true});await action(a,'Use this reviewed wording');await pop(a).getByRole('button',{name:'Review used node',exact:true}).waitFor();const reviewed=await reasonFor('First conclusion');assert.equal(reviewed.version,2);assert.equal(reviewed.history[0].premise.wording.summary,first.premise.wording.summary);assert.equal(reviewed.premise.wording.summary,'Changed after the lost response.');assert.equal(reviewed.premise.nodeId,first.premise.nodeId);assert.deepEqual((await records()).find(r=>r.id===statementChallenge.id),statementChallenge);assert.deepEqual((await records()).find(r=>r.id===inferenceChallenge.id),inferenceChallenge);
  await load(b);await openFromSource(b,'First conclusion',first.id);assert.match(await pop(b).innerText(),/Changed after the lost response/);await pop(b).getByText('Earlier used-node wording',{exact:true}).click();assert.match(await pop(b).innerText(),/Original explanation: Reviewed supporting position/);
  // Eligibility is rechecked while either form is open, before accepting new wording.
  await load(a);await start(a,'Other position 00');await choose(a,'Reviewed supporting position');await updateSource({parent:'goal'});await action(a,'Use selected node');await pop(a).getByRole('alert').filter({hasText:'no longer available for this conclusion'}).waitFor();assert.equal(await actionExists(a,'I reviewed the updated wording'),false);assert.equal(await pop(a).getByRole('button',{name:'Use selected node',exact:true}).isDisabled(),true);assert.equal(await reasonFor('Other position 00'),undefined);await choose(a,'Other position 01');assert.equal(await pop(a).getByRole('button',{name:'Use selected node',exact:true}).isDisabled(),false,'Choosing another eligible source recovers the parked form');await close(a);
  await updateSource({parent:'status'});await load(a);await start(a,'Other position 00');await choose(a,'Reviewed supporting position');await edit(store,alice,ws=>{const map=ws.maps.find(m=>m.id===aMap.id);map.nodes.find(n=>n.id===ids['Other position 00']).parent='goal';map.revision++;synchronizeIdeas(ws,map);});await action(a,'Use selected node');await pop(a).getByRole('alert').filter({hasText:'no longer available for this conclusion'}).waitFor();assert.equal(await actionExists(a,'I reviewed the updated wording'),false);assert.equal(await pop(a).getByRole('button',{name:'Use selected node',exact:true}).isDisabled(),true);assert.match(await pop(a).innerText(),/Alice positions · Goal State/);await choose(a,'Wrong frame');await action(a,'Use selected node');await pop(a).getByRole('button',{name:'Review used node',exact:true}).waitFor();assert.equal((await reasonFor('Other position 00')).premise.nodeId,ids['Wrong frame'],'Fresh choices follow the conclusion’s new frame');
  await load(a);await openFromSource(a,'First conclusion',first.id);await action(a,'Review used node');await updateSource({parent:'goal'});await action(a,'Use this reviewed wording');await pop(a).getByRole('alert').filter({hasText:'no longer available for this conclusion'}).waitFor();assert.equal(await pop(a).getByRole('button',{name:'Use this reviewed wording',exact:true}).isDisabled(),true);assert.equal(await actionExists(a,'I reviewed the updated wording'),false);assert.equal((await reasonFor('First conclusion')).version,2,'Moving a source while review is open cannot create a new reason version');
  await load(a);await openFromSource(a,'First conclusion',first.id);await action(a,'Review used node');assert.equal(await pop(a).getByRole('button',{name:'Use this reviewed wording',exact:true}).isDisabled(),true,'An out-of-frame source cannot be reviewed back into active support');assert.match(await pop(a).innerText(),/unavailable in this frame/);
  assert.deepEqual(errors,[]);console.log('Existing-node reasons: eligibility, pinned details, parked selection, two actors, source review, lost acknowledgments, and unchanged maps passed.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
