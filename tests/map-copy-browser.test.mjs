import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {validateAccountChanges} from '../worker/account-policy.mjs';
import {startAccountComparison} from '../worker/account-api.mjs';
import {synchronizeIdeas} from '../dist/adoption.mjs';

// Use the beta's real account projection and save policy with disposable data.
if(!process.env.HARMONIOUS_PLAYWRIGHT)throw Error('Set HARMONIOUS_PLAYWRIGHT.');
const {chromium}=await import(pathToFileURL(process.env.HARMONIOUS_PLAYWRIGHT));
const store=memoryStore(),errors=[];
for(const actor of [alice,bob]){
  await seedActor(store,actor);await edit(store,actor,ws=>{
    const map=ws.maps.find(m=>m.ownerId===actor.id);map.name=actor.name+' source';map.visibility='shared';map.mapType='reference';
    for(const frame of map.nodes.filter(n=>n.parent===null))Object.assign(frame,{summary:`${actor.name} ${frame.id} frame context`,details:`${actor.name} ${frame.id} detailed frame reasoning`,sourceTitle:`${actor.name} ${frame.id} citation`,sourceUrl:`https://example.org/${actor.name.toLowerCase()}/${frame.id}`});
    const claim=addNode(ws,actor,actor.name+' claim');claim.confidence=73;claim.sourceTitle='A source';claim.sourceUrl='https://example.org/source';
    const child=addNode(ws,actor,actor.name+' reason');child.parent=claim.id;child.confidence=0;child.structuralType='nesting';
    map.relations.push({id:actor.name+'-reason',from:child.id,to:claim.id,type:'reason',note:'Source reasoning'});synchronizeIdeas(ws,map);
  });
}
const initial=(await view(store,alice)).workspace,aMap=initial.maps.find(m=>m.ownerId===alice.id),bMap=initial.maps.find(m=>m.ownerId===bob.id);
await startAccountComparison(store,alice.id,{aMapId:aMap.id,bMapId:bMap.id});
const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost'),actor=req.headers['x-test-actor']==='bob'?bob:alice;
  if(url.pathname.startsWith('/api/')){
    res.setHeader('content-type','application/json');let raw='';for await(const chunk of req)raw+=chunk;const input=raw?JSON.parse(raw):null;let result;
    if(url.pathname==='/api/session')result={configured:true,actor,signup:{mode:'public'}};
    else if(url.pathname==='/api/workspace'&&req.method==='PUT'){const snapshot=await store.snapshot();result=await store.commit(actor.id,snapshot.revision,validateAccountChanges(snapshot,actor.id,input.changes));}
    else result={...await view(store,actor),actor};res.end(JSON.stringify(result));return;
  }
  const name=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!/^[a-z0-9.-]+$/.test(name)){res.writeHead(404);res.end();return;}
  let content=await readFile(resolve('dist',name),'utf8');if(name==='index.html')content=content.replace('src="./app.mjs"','src="./beta-boot.mjs"').replace('</head>','<link rel="stylesheet" href="./accounts.css"></head>');
  res.setHeader('content-type',name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'text/javascript');res.end(content);
}catch(error){res.writeHead(error.status||500,{'content-type':'application/json'});res.end(JSON.stringify({error:error.message}));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:process.env.HARMONIOUS_BROWSER||'msedge'});
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
  const saved=()=>page.waitForFunction(()=>document.getElementById('storage-status')?.textContent.includes('All changes saved'));
  const workspace=async()=>(await view(store,alice)).workspace;
  let navigation=0;const library=async()=>{await page.goto(origin+'/?copy-check='+(++navigation)+'#library=maps');await page.locator('#library-results .library-card').first().waitFor();};
  const copyAction=id=>page.locator(`#library-results .library-card[data-map="${id}"]`).getByRole('button',{name:'Copy map',exact:true});
  const frameFields=[['summary','summary'],['details','details'],['source-title','sourceTitle'],['source-url','sourceUrl']];
  const openFrame=async(p,id)=>{await p.locator(`#cards .node[data-id="${id}"] .node-main`).focus();await p.keyboard.press('Enter');await p.locator('.on-map-actions').getByRole('button',{name:'Edit frame details',exact:true}).click();await p.locator('#node-face-editor').waitFor();};
  const editFrames=async(p,map,prefix)=>{
    for(const frame of map.nodes.filter(n=>n.parent===null)){
      await openFrame(p,frame.id);await p.locator('#summary').fill(`${prefix} ${frame.id} summary`);
      if(!await p.locator('#edit-form details').evaluate(el=>el.open))await p.locator('#edit-form details>summary').click();
      await p.locator('#details').fill(`${prefix} ${frame.id} detailed reasoning`);await p.locator('#source-title').fill(`${prefix} ${frame.id} citation`);await p.locator('#source-url').fill(`https://example.org/fresh/${map.ownerId}/${frame.id}`);
      await p.locator('#node-face-editor .node-face-done').click();await p.waitForFunction(()=>document.getElementById('storage-status')?.textContent.includes('All changes saved'));
    }
  };
  const createFromPicker=async(sourceId,name)=>{
    await page.getByRole('button',{name:'Create map',exact:true}).click();assert.equal(await page.locator('#map-start-input').inputValue(),'','Create map starts with empty frames before a source is selected');
    await page.locator('#map-name-input').fill(name);await page.locator('#map-start-input').selectOption(sourceId);assert.equal(await page.locator('#map-start-input').inputValue(),sourceId);await page.locator('#confirm-map').click();await saved();
    return (await workspace()).maps.find(m=>m.name===name);
  };
  const verifyCopiedFrames=async(copy,source,label)=>{
    const frames=source.nodes.filter(n=>n.parent===null);assert.deepEqual(copy.nodes.filter(n=>n.parent===null),frames,`${label}: all three saved frame records are preserved`);
    await page.reload();await page.locator('#map-heading').filter({hasText:copy.name}).waitFor();
    const reopened=(await workspace()).maps.find(m=>m.id===copy.id);assert.deepEqual(reopened.nodes.filter(n=>n.parent===null),frames,`${label}: saved frame records survive reload`);
    for(const frame of frames){
      assert.equal(await page.locator(`#cards .node[data-id="${frame.id}"] .node-summary`).innerText(),frame.summary,`${label}: ${frame.id} map face shows the copied summary`);
      await openFrame(page,frame.id);for(const [field,key]of frameFields)assert.equal(await page.locator('#'+field).inputValue(),frame[key],`${label}: ${frame.id} ${key} reopens unchanged`);await page.locator('#node-face-editor .node-face-done').click();
    }
    assert.deepEqual((await workspace()).maps.find(m=>m.id===source.id),source,`${label}: the source stays unchanged`);
    console.log(`Frame-copy regression passed: ${label}; 3 frames × summary/details/citation title/URL, saved and reopened after reload.`);
  };
  await library();assert.equal(await page.locator('#library-results .library-card').count(),1,'Only own maps offer the direct duplication action');
  const beforeCancel=await store.snapshot();await copyAction(aMap.id).focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#map-dialog-title').innerText(),'Copy a map');assert.equal(await page.locator('#map-name-input').inputValue(),'Alice source (copy)');assert.equal(await page.locator('#map-start-input').inputValue(),aMap.id);assert.equal(await page.locator('#map-type-input').inputValue(),'reference');assert.equal(await page.locator('#map-visibility').inputValue(),'private');assert(await page.locator('#map-name-input').evaluate(el=>el===document.activeElement));
  await page.locator('#close-map-dialog').click();assert.deepEqual(await store.snapshot(),beforeCancel,'Cancelling creates no map or account writes');
  await copyAction(aMap.id).click();await page.locator('#map-name-input').fill('My independent copy');await page.locator('#confirm-map').click();await saved();
  let ws=await workspace();const duplicate=ws.maps.find(m=>m.name==='My independent copy');assert(duplicate);assert.equal(duplicate.ownerId,alice.id);assert.equal(duplicate.visibility,'private');assert.equal(duplicate.mapType,'reference');assert.notEqual(duplicate.id,aMap.id);assert.equal(duplicate.nodes.length,aMap.nodes.length);assert.deepEqual(duplicate.nodes.filter(n=>n.parent===null),aMap.nodes.filter(n=>n.parent===null));
  const copies=new Map(duplicate.nodes.filter(n=>n.parent!==null).map(n=>[n.copiedFrom.nodeId,n]));
  for(const original of aMap.nodes.filter(n=>n.parent!==null)){const copy=copies.get(original.id);assert.notEqual(copy.id,original.id);assert.notEqual(copy.ideaId,original.ideaId);assert.equal(copy.confidence,original.confidence);assert.equal(copy.parent,copies.get(original.parent)?.id||original.parent);assert.equal(copy.sourceUrl,original.sourceUrl);}
  const originalEdge=aMap.relations[0];assert(duplicate.relations.some(e=>e.from===copies.get(originalEdge.from).id&&e.to===copies.get(originalEdge.to).id&&e.type===originalEdge.type&&e.note===originalEdge.note));assert.deepEqual(ws.maps.find(m=>m.id===aMap.id),aMap,'The saved source map is unchanged');assert(!(await view(store,bob)).workspace.maps.some(m=>m.id===duplicate.id),'Private duplicate is not exposed to another participant');
  assert.equal(ws.endorsements.length,0);assert.equal(ws.discussions.length,0);assert.equal(ws.comparisonThreads.length,1,'Copying creates no comparison');
  await page.reload();await page.locator('#map-heading').filter({hasText:'My independent copy'}).waitFor();

  // Reproduce Create map → Start with → Copy directly, rather than relying on
  // the Library shortcut. Exercise every editable frame field for both owners.
  await library();const pickerOwned=await createFromPicker(aMap.id,'Picker copy of preloaded own map');await verifyCopiedFrames(pickerOwned,aMap,'owned source, preloaded');
  await library();const sharedCopy=await createFromPicker(bMap.id,'Adapted shared copy');assert(sharedCopy.nodes.filter(n=>n.parent!==null).every(n=>n.confidence===null&&n.copiedFrom.mapId===bMap.id));assert.equal(sharedCopy.visibility,'private');await verifyCopiedFrames(sharedCopy,bMap,'shared source, preloaded');

  // Immediately copy a source whose frames were edited on their faces in this
  // same browser session; do not reload away a possible stale editor snapshot.
  await library();await page.locator(`#library-results .library-card[data-map="${aMap.id}"]`).getByRole('button',{name:'Open map',exact:true}).click();await editFrames(page,aMap,'Own newly edited');
  const freshOwn=(await workspace()).maps.find(m=>m.id===aMap.id);assert.notDeepEqual(freshOwn.nodes.filter(n=>n.parent===null),aMap.nodes.filter(n=>n.parent===null));
  await page.locator('#discover-mode').click();const freshOwnedCopy=await createFromPicker(aMap.id,'Picker copy of freshly edited own map');await verifyCopiedFrames(freshOwnedCopy,freshOwn,'owned source, freshly edited in the same tab');

  // The other author also changes all three frame records through their actual
  // editor. Refresh the accessible source, select it in Start with, and copy.
  const bobContext=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',extraHTTPHeaders:{'x-test-actor':'bob'}}),bobPage=await bobContext.newPage();bobPage.on('pageerror',error=>errors.push(error.message));bobPage.setDefaultTimeout(15000);
  await bobPage.goto(origin+'/#map='+bMap.id);await bobPage.locator('#map-heading').filter({hasText:bMap.name}).waitFor();await editFrames(bobPage,bMap,'Shared newly edited');
  const freshShared=(await workspace()).maps.find(m=>m.id===bMap.id);assert.notDeepEqual(freshShared.nodes.filter(n=>n.parent===null),bMap.nodes.filter(n=>n.parent===null));
  await library();const freshSharedCopy=await createFromPicker(bMap.id,'Picker copy of freshly edited shared map');await verifyCopiedFrames(freshSharedCopy,freshShared,'shared source, freshly edited by its author');await bobContext.close();

  // Copy an empty map, including frame details, without a partial failure.
  await library();await page.getByRole('button',{name:'Create map',exact:true}).click();await page.locator('#map-name-input').fill('Empty source');await page.locator('#confirm-map').click();await saved();
  const empty=(await workspace()).maps.find(m=>m.name==='Empty source');await library();await page.setViewportSize({width:390,height:844});await copyAction(empty.id).click();assert.equal(await page.locator('#map-name-input').inputValue(),'Empty source (copy)');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator('#confirm-map').click();await saved();
  const emptyCopy=(await workspace()).maps.find(m=>m.name==='Empty source (copy)');assert(emptyCopy);assert.deepEqual(emptyCopy.nodes,empty.nodes);assert.deepEqual(emptyCopy.relations,[]);await library();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await mkdir('build/design-review',{recursive:true});await page.screenshot({path:'build/design-review/map-copy-library-mobile.png',fullPage:true});
  await edit(store,bob,workspace=>{workspace.maps.find(m=>m.id===bMap.id).visibility='private';});await library();assert((await workspace()).maps.some(m=>m.id===bMap.id&&m.unavailable),'Fixture retains an unavailable source placeholder');await page.getByRole('button',{name:'Create map',exact:true}).click();assert.equal(await page.locator(`#map-start-input option[value="${bMap.id}"]`).count(),0,'Unavailable sources are excluded from copying');await page.locator('#close-map-dialog').click();
  assert.deepEqual(errors,[]);console.log('Map-copy browser checks passed: direct Library action, keyboard, cancel, private independent copies, preserved hierarchy/connections/authored confidence, shared-source reset, empty maps, reload and narrow-screen access.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
