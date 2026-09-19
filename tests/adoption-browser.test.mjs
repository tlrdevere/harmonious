import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {accountWorkspace,saveAccountChanges,startAccountComparison} from '../worker/account-api.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {makeDefinition,definitionReference,definitionReferenceText} from '../dist/definitions.mjs';
import {createOwnedMap,synchronizeIdeas} from '../dist/adoption.mjs';
import {isAdoptionReceipt} from '../dist/adoption-fulfillment.mjs';

// Disposable browser accounts use the production read/save boundary, including
// replay detection and optimistic record revisions. No live service is touched.
const playwright=process.env.HARMONIOUS_PLAYWRIGHT;
if(!playwright)throw Error('Set HARMONIOUS_PLAYWRIGHT to the installed playwright entry point.');
const {chromium}=await import(pathToFileURL(playwright));
const store=memoryStore(),sources={},suggestions={};
const titles=['Adopt with definitions','Adopt without definitions','Use existing placement','Reconsider later','Changing source','Retry after lost response','Two browser copies'];
let aliceDefinition,bobDefinition,existingNode,secondAlice;
for(const actor of [alice,bob]){
  await seedActor(store,actor);await edit(store,actor,ws=>{
    const map=ws.maps.find(m=>m.ownerId===actor.id);map.name=actor.name+' adoption map';map.visibility='shared';
    for(const title of actor===alice?titles:['My established position']){
      const n=addNode(ws,actor,title);n.summary=actor.name+' explanation for '+title;n.details='The original detailed wording.';synchronizeIdeas(ws,map);
      if(actor===alice)sources[title]=n.id;else existingNode=n.id;
    }
    const definition=makeDefinition(ws,{type:'definition',title:actor===alice?'Invoked shared meaning':'My established meaning',body:actor===alice?'Only this exact invoked version travels.':'Keep my existing definition unchanged.'},actor.id);ws.definitions.push(definition);
    if(actor===alice){aliceDefinition=definition;secondAlice=createOwnedMap(ws,{name:'Alice second map',ownerId:alice.id});secondAlice.visibility='shared';}
    else bobDefinition=definition;
  });
}
let ws=(await view(store,alice)).workspace;
const aMap=ws.maps.find(m=>m.ownerId===alice.id&&m.id!==secondAlice.id),bMap=ws.maps.find(m=>m.ownerId===bob.id);
const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:aMap.id,bMapId:bMap.id});
const {comparisonThread:selfThread}=await startAccountComparison(store,alice.id,{aMapId:aMap.id,bMapId:secondAlice.id});
const target=title=>({type:'node',mapId:aMap.id,nodeId:sources[title]});
for(const actor of [alice,bob])await edit(store,actor,workspace=>{
  const definition=actor===alice?aliceDefinition:bobDefinition,refs=[definitionReference(definition)];
  const targets=actor===alice?titles.map(target):[{type:'node',mapId:bMap.id,nodeId:existingNode}];
  for(const source of targets)workspace.discussions.push(makeDiscussion(workspace,{kind:'context',action:'context',target:source,body:definitionReferenceText(refs),definitionRefs:refs},actor.id));
  if(actor===alice)for(const title of titles.slice(1)){const r=makeDiscussion(workspace,{comparisonId:thread.id,kind:'adoption',action:'adoption',target:target(title),body:'Consider '+title+'.'},alice.id);workspace.discussions.push(r);suggestions[title]=r;}
});
await edit(store,alice,workspace=>{
  const old=workspace.definitions.find(d=>d.id===aliceDefinition.id);
  workspace.definitions=workspace.definitions.map(d=>d.id===old.id?makeDefinition(workspace,{title:'Private uninvoked revision',body:'PRIVATE LIBRARY WORDING MUST NOT TRAVEL'},alice.id,old):d);
});
let loseResponseFor=null,raceFor=null,raceQueue=[];
const writes=[],errors=[];
const respond=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
const saveRequest=async(actor,input,res)=>{
  const receipt=input.changes?.find(c=>c.kind==='discussion'&&isAdoptionReceipt(c.value))?.value;
  try{
    const result=await saveAccountChanges(store,actor.id,input.changes);writes.push({suggestionId:receipt?.target.entryId,status:200,result});
    if(receipt?.target.entryId===loseResponseFor){loseResponseFor=null;respond(res,503,{error:'The confirmation response was lost after saving.'});return;}
    respond(res,200,result);
  }catch(error){writes.push({suggestionId:receipt?.target.entryId,status:error.status||500});respond(res,error.status||500,{error:error.message});}
};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'),actor=req.headers['x-test-actor']==='bob'?bob:alice;
    if(url.pathname.startsWith('/api/')){
      let body='';for await(const chunk of req)body+=chunk;const input=body?JSON.parse(body):null;
      if(url.pathname==='/api/session'){respond(res,200,{configured:true,actor,signup:{mode:'public'}});return;}
      if(url.pathname==='/api/comparisons'){respond(res,200,await startAccountComparison(store,actor.id,input));return;}
      if(url.pathname==='/api/workspace'&&req.method==='PUT'){
        const receipt=input.changes?.find(c=>c.kind==='discussion'&&isAdoptionReceipt(c.value))?.value;
        if(receipt?.target.entryId===raceFor){raceQueue.push({actor,input,res});if(raceQueue.length===2){raceFor=null;const pending=raceQueue;raceQueue=[];for(const item of pending)await saveRequest(item.actor,item.input,item.res);}return;}
        await saveRequest(actor,input,res);return;
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
  const pages=[];for(const actor of ['alice','bob','bob']){const context=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{'x-test-actor':actor}});const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));pages.push(page);}
  const [a,b,b2]=pages,pop=p=>p.locator('.discussion-popover'),action=(p,name)=>pop(p).getByRole('button',{name,exact:true}).click();
  const saved=p=>p.waitForFunction(()=>document.getElementById('storage-status')?.textContent.includes('All changes saved'));
  const close=async p=>{if(await pop(p).isVisible())await action(p,'Close');};
  const expand=async p=>{await p.locator('.comparison-view-options>summary').click();for(const side of ['a','b'])await p.locator('#compare-all-'+side).click();await p.locator('.comparison-view-options>summary').click();await p.getByRole('button',{name:'Fit both maps',exact:true}).click();};
  const node=async(p,title)=>{await p.getByRole('button',{name:'Fit both maps',exact:true}).click();await p.locator('#compare-canvas .node-main').filter({has:p.getByText(title,{exact:true})}).first().click();};
  const openSuggestion=async(p,title)=>{await close(p);await p.getByRole('button',{name:'Conversations',exact:true}).click();await pop(p).locator('.discussion-list-item').filter({hasText:'Suggest adoption'}).filter({hasText:title}).click();};
  // ResizeObserver repositions the anchored popover on the next layout frame.
  // Wait for that bounded result rather than measuring the old desktop position.
  const resize=async(p,size)=>{
    await p.setViewportSize(size);
    try{await p.waitForFunction(()=>{const r=document.querySelector('.discussion-popover').getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth&&r.left>=0&&r.right<=innerWidth+1;},{},{timeout:3000});}
    catch(error){console.error('Popover after resize:',await pop(p).boundingBox(),'viewport:',size);throw error;}
  };
  const receiptFor=async title=>(await view(store,bob)).workspace.discussions.find(r=>isAdoptionReceipt(r)&&r.target.entryId===suggestions[title].id);
  const copy=async(p,title,newTitle,{definitions=false,link=false,parent='action'}={})=>{await openSuggestion(p,title);await action(p,'Add to my map');await pop(p).getByRole('textbox',{name:'Your node title',exact:true}).fill(newTitle);await p.locator('#adoption-node').selectOption(parent);await p.locator('#adoption-link').setChecked(link);if(definitions){await pop(p).locator('.adoption-definitions>summary').click();await pop(p).locator('[data-definition-key]').first().check();}};
  await a.goto(origin+'/#comparison='+thread.id);await expand(a);
  await node(a,'Status Quo');assert.equal(await pop(a).getByRole('button',{name:'Suggest adoption',exact:true}).count(),0,'Frame headings cannot be suggested.');await close(a);
  await node(a,'My established position');assert.equal(await pop(a).getByRole('button',{name:'Suggest adoption',exact:true}).count(),0,'Only an owner can suggest their node.');await close(a);
  await node(a,titles[0]);await action(a,'Suggest adoption');await a.locator('#discussion-body').fill('Please consider my concrete proposal.');await action(a,'Send suggestion');await saved(a);
  assert.equal(await pop(a).getByRole('button',{name:'Add to my map',exact:true}).count(),0,'The suggesting author cannot fulfill their own suggestion.');
  ws=(await view(store,alice)).workspace;suggestions[titles[0]]=ws.discussions.find(r=>r.kind==='adoption'&&r.target.nodeId===sources[titles[0]]);assert(suggestions[titles[0]]);
  await a.goto(origin+'/#comparison='+selfThread.id);await expand(a);await node(a,titles[0]);assert.equal(await pop(a).getByRole('button',{name:'Suggest adoption',exact:true}).count(),0,'Comparisons between my own maps have no adoption suggestion.');
  const comparisonURL=origin+'/#comparison='+thread.id;await a.goto(comparisonURL);await b.goto(comparisonURL);await expand(b);
  const originalAlice=structuredClone((await view(store,alice)).workspace.maps.find(m=>m.id===aMap.id));
  await copy(b,titles[0],'My edited independent copy',{definitions:true,parent:'goal'});await b.locator('#adoption-summary').fill('My own explanation, adapted from the suggestion.');
  assert.match(await pop(b).innerText(),/Different frame/);assert(!(await pop(b).innerText()).includes('PRIVATE LIBRARY WORDING MUST NOT TRAVEL'));assert.equal(await b.locator('#adoption-link').isChecked(),false);
  b.once('dialog',dialog=>dialog.dismiss());await action(b,'Close');assert.equal(await pop(b).getByRole('textbox',{name:'Your node title',exact:true}).inputValue(),'My edited independent copy','Cancelling discard preserves adoption wording.');
  assert.equal(await pop(b).getByRole('textbox',{name:'Your node title',exact:true}).evaluate(input=>document.querySelectorAll('#'+input.id).length),1,'The copy title field has a unique label target');
  await b.screenshot({path:'build/design-review/adoption-copy-desktop.png',fullPage:true});await resize(b,{width:390,height:844});assert(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const formBox=await pop(b).boundingBox();assert(formBox.x>=0&&formBox.x+formBox.width<=391);await b.screenshot({path:'build/design-review/adoption-copy-mobile.png',fullPage:true});await resize(b,{width:1440,height:1000});
  await action(b,'Create my independent node');await pop(b).locator('.discussion-state').filter({hasText:'Added to my map'}).waitFor();
  let first=await receiptFor(titles[0]);assert(first);const firstReceipt=structuredClone(first),firstWorkspace=(await view(store,bob)).workspace,firstNode=firstWorkspace.maps.find(m=>m.id===bMap.id).nodes.find(n=>n.id===first.adoption.destination.nodeId);
  assert.equal(firstNode.parent,'goal');assert.equal(firstNode.title,'My edited independent copy');assert.notEqual(firstNode.ideaId,originalAlice.nodes.find(n=>n.id===sources[titles[0]]).ideaId);assert.equal(first.adoption.counterpartId,null);assert.equal(first.adoption.importedDefinitions.length,1);
  const imported=firstWorkspace.definitions.find(d=>d.id===first.adoption.importedDefinitions[0].definitionId);assert.equal(imported.authorId,bob.id);assert.equal(imported.copiedFrom.version,1);assert.equal(imported.versions[0].body,'Only this exact invoked version travels.');assert.deepEqual(firstWorkspace.maps.find(m=>m.id===aMap.id),originalAlice);assert.equal(firstWorkspace.endorsements.length,0);assert.equal(firstWorkspace.discussions.filter(r=>r.kind==='relationship').length,0);
  await pop(b).locator('.discussion-reply').filter({hasText:'Added to my map'}).click();assert.equal(await pop(b).getByRole('button',{name:'Edit',exact:true}).count(),0);assert.equal(await pop(b).getByRole('button',{name:'Withdraw',exact:true}).count(),0);await action(b,'Open node');await b.waitForURL(url=>new URLSearchParams(url.hash.slice(1)).get('node')===firstNode.id);assert.equal(new URLSearchParams(new URL(b.url()).hash.slice(1)).get('map'),bMap.id);
  await b.goto(comparisonURL);await expand(b);

  // Optional imports and counterpart links are independent choices.
  const definitionsBefore=structuredClone((await view(store,bob)).workspace.definitions);
  await copy(b,titles[1],'Copy without imported definitions',{link:true});await action(b,'Create my independent node');await pop(b).locator('.discussion-state').filter({hasText:'Added to my map'}).waitFor();
  const noDefinitions=await receiptFor(titles[1]);assert.equal(noDefinitions.adoption.importedDefinitions.length,0);assert(noDefinitions.adoption.counterpartId);assert.deepEqual((await view(store,bob)).workspace.definitions,definitionsBefore);
  const beforeExisting=(await view(store,bob)).workspace,existingMap=structuredClone(beforeExisting.maps.find(m=>m.id===bMap.id)),existingDefinitions=structuredClone(beforeExisting.definitions),existingContexts=structuredClone(beforeExisting.discussions.filter(r=>r.kind==='context'&&r.target.nodeId===existingNode));
  await openSuggestion(b,titles[2]);await action(b,'Use an existing node');assert.equal(await b.locator('#adoption-node option').filter({hasText:/^(Status Quo|Transformative Action|Goal State)$/}).count(),0,'Existing-node selection excludes frame headings');await b.locator('#adoption-node').selectOption(existingNode);assert.equal(await pop(b).locator('[data-definition-key]').count(),0,'Existing node definitions cannot be overwritten by source choices');await b.locator('#adoption-link').check();await action(b,'Use this node');await pop(b).locator('.discussion-state').filter({hasText:'Used an existing node'}).waitFor();
  const afterExisting=(await view(store,bob)).workspace;assert.deepEqual(afterExisting.maps.find(m=>m.id===bMap.id),existingMap);assert.deepEqual(afterExisting.definitions,existingDefinitions);assert.deepEqual(afterExisting.discussions.filter(r=>r.kind==='context'&&r.target.nodeId===existingNode),existingContexts);assert.equal((await receiptFor(titles[2])).adoption.destination.nodeId,existingNode);

  const beforeDefer=structuredClone((await view(store,bob)).workspace.maps);
  await openSuggestion(b,titles[3]);await action(b,'Not now');await b.locator('#adoption-note').fill('I would like to think about this first.');await action(b,'Save response');await pop(b).locator('.discussion-state').filter({hasText:'Not now'}).waitFor();assert.deepEqual((await view(store,bob)).workspace.maps,beforeDefer);assert.equal(await receiptFor(titles[3]),undefined);assert.equal(await pop(b).getByRole('button',{name:'Add to my map',exact:true}).count(),1);
  await copy(b,titles[3],'Reconsidered independent copy',{definitions:true,link:true});await action(b,'Create my independent node');await pop(b).locator('.discussion-state').filter({hasText:'Added to my map'}).waitFor();assert.equal((await receiptFor(titles[3])).adoption.importedDefinitions[0].definitionId,imported.id,'Reconsideration reuses the exact prior definition import');

  // A changed preview must be explicitly reviewed, keeping the author's draft.
  await copy(b,titles[4],'Keep this custom draft title',{definitions:true,link:true,parent:'goal'});await b.locator('#adoption-summary').fill('Keep my custom draft explanation.');
  await edit(store,alice,workspace=>{
    const map=workspace.maps.find(m=>m.id===aMap.id);map.nodes.find(n=>n.id===sources[titles[4]]).summary='Changed while the recipient was reviewing.';map.revision++;synchronizeIdeas(workspace,map);
    const def=makeDefinition(workspace,{type:'standard',title:'Newly invoked standard',body:'New standards require a fresh choice.'},alice.id);workspace.definitions.push(def);const refs=[definitionReference(def)];workspace.discussions.push(makeDiscussion(workspace,{kind:'context',action:'context',target:target(titles[4]),body:definitionReferenceText(refs),definitionRefs:refs},alice.id));
  });
  await action(b,'Create my independent node');await pop(b).getByRole('button',{name:'I reviewed the updated source',exact:true}).waitFor();assert.equal(await pop(b).getByRole('textbox',{name:'Your node title',exact:true}).inputValue(),'Keep this custom draft title');assert.equal(await b.locator('#adoption-summary').inputValue(),'Keep my custom draft explanation.');assert.equal(await b.locator('#adoption-node').inputValue(),'goal');assert.equal(await b.locator('#adoption-link').isChecked(),true);assert.equal(await receiptFor(titles[4]),undefined);
  await action(b,'I reviewed the updated source');assert.equal(await pop(b).locator('[data-definition-key]').count(),2);assert.equal(await pop(b).locator('[data-definition-key]:checked').count(),1,'Newly invoked definitions stay unselected');await action(b,'Create my independent node');await pop(b).locator('.discussion-state').filter({hasText:'Added to my map'}).waitFor();assert.equal((await receiptFor(titles[4])).adoption.destination.wording.title,'Keep this custom draft title');

  // Save succeeds, but its response is lost. Retrying finds the saved receipt.
  await copy(b,titles[5],'Retry creates only one node');loseResponseFor=suggestions[titles[5]].id;await pop(b).getByRole('button',{name:'Create my independent node',exact:true}).dblclick();await pop(b).getByRole('alert').filter({hasText:'confirmation response was lost'}).waitFor();assert.equal(await pop(b).getByRole('textbox',{name:'Your node title',exact:true}).inputValue(),'Retry creates only one node');assert(await receiptFor(titles[5]));await action(b,'Create my independent node');await pop(b).locator('.discussion-state').filter({hasText:'Added to my map'}).waitFor();assert.equal(writes.filter(w=>w.suggestionId===suggestions[titles[5]].id).length,1,'A retry acknowledges the already committed choice without another write');assert.equal((await view(store,bob)).workspace.maps.find(m=>m.id===bMap.id).nodes.filter(n=>n.title==='Retry creates only one node').length,1);

  // Hold both staged writes until each tab reviewed the same account version.
  await b2.goto(comparisonURL);await expand(b2);await copy(b,titles[6],'First tab choice');await copy(b2,titles[6],'Second tab choice');raceFor=suggestions[titles[6]].id;
  await Promise.all([action(b,'Create my independent node'),action(b2,'Create my independent node')]);
  await Promise.all([b,b2].map(p=>p.waitForFunction(()=>document.querySelector('.discussion-popover [role=alert]')||document.querySelector('.discussion-popover .discussion-state')?.textContent.includes('Added to my map'))));
  const loser=await pop(b).getByRole('alert').count()?b:b2;assert.equal(writes.filter(w=>w.suggestionId===suggestions[titles[6]].id&&w.status===200).length,1);assert.equal(writes.filter(w=>w.suggestionId===suggestions[titles[6]].id&&w.status===409).length,1);await action(loser,'Create my independent node');await pop(loser).locator('.discussion-state').filter({hasText:'Added to my map'}).waitFor();assert.equal((await view(store,bob)).workspace.maps.find(m=>m.id===bMap.id).nodes.filter(n=>['First tab choice','Second tab choice'].includes(n.title)).length,1,'Two competing tabs cannot create duplicate placements');

  await b.goto(comparisonURL);await expand(b);await openSuggestion(b,titles[0]);await resize(b,{width:390,height:844});assert(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const box=await pop(b).boundingBox();assert(box.x>=0&&box.x+box.width<=391);await b.screenshot({path:'build/design-review/adoption-receipt-mobile.png',fullPage:true});await resize(b,{width:1440,height:1000});
  await edit(store,bob,workspace=>{const map=workspace.maps.find(m=>m.id===bMap.id);map.nodes.find(n=>n.id===firstNode.id).title='My later independent wording';map.revision++;synchronizeIdeas(workspace,map);});await b.reload();await openSuggestion(b,titles[0]);assert.match(await pop(b).innerText(),/Changed since adding/);assert.deepEqual(await receiptFor(titles[0]),firstReceipt,'Later destination edits do not rewrite the receipt');
  await a.reload();await openSuggestion(a,titles[0]);a.once('dialog',dialog=>dialog.accept());await action(a,'Withdraw');await saved(a);await b.reload();await b.getByRole('button',{name:'Conversations',exact:true}).click();await pop(b).getByText('Withdrawn contributions',{exact:true}).click();await pop(b).getByRole('button',{name:'Suggest adoption · Alice',exact:true}).click();assert.match(await pop(b).innerText(),/Suggestion withdrawn\. The saved copy and this record remain/);assert.equal(await pop(b).getByRole('button',{name:'Open node',exact:true}).count(),1);assert.deepEqual(await receiptFor(titles[0]),firstReceipt);
  await edit(store,alice,workspace=>{const map=workspace.maps.find(m=>m.id===aMap.id);map.visibility='private';map.nodes.find(n=>n.id===sources[titles[0]]).title='PRIVATE SOURCE WORDING AFTER COPYING';map.revision++;synchronizeIdeas(workspace,map);});await close(b);await b.getByRole('button',{name:'Refresh',exact:true}).click();await b.waitForFunction(()=>!document.body.innerText.includes('Adopt with definitions'));assert(!(await b.locator('body').innerText()).includes('PRIVATE SOURCE WORDING AFTER COPYING'));
  ws=(await view(store,bob)).workspace;assert(ws.maps.find(m=>m.id===bMap.id).nodes.some(n=>n.id===firstNode.id));assert.equal(ws.definitions.find(d=>d.id===imported.id).copiedFrom.body,'Only this exact invoked version travels.');assert(!JSON.stringify(ws).includes('PRIVATE LIBRARY WORDING MUST NOT TRAVEL'));assert.equal(ws.endorsements.length,0);assert.equal(ws.discussions.filter(r=>r.kind==='relationship').length,0);
  await b.goto(origin+'/#map='+bMap.id+'&node='+firstNode.id);await b.locator('#title').waitFor();assert.equal(await b.locator('#title').inputValue(),'My later independent wording','Saved personal copy remains editable after source access is lost');
  assert.deepEqual(errors,[]);console.log('Adoption browser checks passed: recipient-only actions, reviewed independent copies, unchanged existing nodes, exact optional definitions, neutral links, defer/reconsider, source-review drafts, retry/race safety, immutable receipts, privacy and mobile.');
}catch(error){
  for(const [i,context]of browser.contexts().entries())for(const page of context.pages()){await page.screenshot({path:`build/design-review/adoption-failure-${i}.png`,fullPage:true});console.error((await page.locator('body').innerText()).slice(-5500));}
  console.error(errors);throw error;
}finally{for(const pending of raceQueue)respond(pending.res,503,{error:'Test ended before the other staged request arrived.'});await browser.close();await new Promise(r=>server.close(r));}
