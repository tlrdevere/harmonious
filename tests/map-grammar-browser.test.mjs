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
  assert.equal(await page.locator('#relation-view').inputValue(),'all','Additional connections are visible by default');
  assert.equal(await page.locator('#cards .node-meta').count(),0,'Own-map cards have no redundant kind or author footer');
  assert.equal(await page.locator('#inspector').isVisible(),false,'Selection opens the on-map menu without automatically opening the panel');
  await mkdir('build/design-review',{recursive:true});await page.screenshot({path:'build/design-review/node-menu-desktop.png',fullPage:true});
  const disclosure=page.locator('.on-map-actions .node-action-disclosure');await disclosure.focus();await page.keyboard.press('Enter');
  assert.equal(await disclosure.getAttribute('aria-expanded'),'true');assert(await disclosure.evaluate(el=>el===document.activeElement),'Expanding More actions preserves keyboard focus on the disclosure');
  assert(await page.locator('.on-map-actions').getByRole('button',{name:'Delete branch',exact:true}).isVisible());await page.keyboard.press('Enter');assert.equal(await disclosure.getAttribute('aria-expanded'),'false');assert(await disclosure.evaluate(el=>el===document.activeElement));
  await page.locator('.on-map-actions').getByRole('button',{name:'Inspect details',exact:true}).click();
  assert(await page.locator('#node-reading').isVisible());assert(await page.locator('#node-meaning').isVisible());assert.equal(await page.locator('#edit-form').isVisible(),false,'Inspection reads saved wording without starting an edit form');assert.match(await page.locator('#node-reading').innerText(),/Alice claim/);
  await page.screenshot({path:'build/design-review/node-inspector-desktop.png',fullPage:true});
  await choose(claim.id);await page.locator('.on-map-actions').getByRole('button',{name:'Edit',exact:true}).click();
  const face=page.locator('#node-face-editor'),done=face.locator('.node-face-done');
  assert(await face.isVisible());assert.equal(await page.locator('#inspector').isVisible(),false,'Edit expands the node face and keeps the optional reading panel closed');
  assert(await face.locator('#edit-form').isVisible());assert(await page.locator('#title').evaluate(el=>el===document.activeElement),'Editing focuses the title immediately');
  assert.equal(await face.locator('details').evaluate(el=>el.open),false,'Supporting details start collapsed');
  await page.locator('#summary').fill('Edited directly on the node face.');await page.locator('#edit-form').getByRole('button',{name:'Save changes',exact:true}).click();await saved();
  assert(await face.isVisible(),'Explicit Save changes retains the on-map editor');assert.equal((await data()).nodes.find(n=>n.id===claim.id).summary,'Edited directly on the node face.');
  await face.locator('details>summary').click();await page.locator('#details').fill('Reasoning entered without losing the active editor.');
  await page.locator('#details').evaluate(el=>{el.focus();el.setSelectionRange(9,9);globalThis.faceInput=el;globalThis.faceForm=el.form;});
  await page.waitForTimeout(1500);await saved();
  assert(await page.locator('#details').evaluate(el=>el===globalThis.faceInput&&el.form===globalThis.faceForm&&el===document.activeElement&&el.selectionStart===9&&el.selectionEnd===9),'Autosave retains the form, focused field, and caret');
  assert(await face.locator('details').evaluate(el=>el.open),'Autosave preserves expanded Details');assert.equal((await data()).nodes.find(n=>n.id===claim.id).details,'Reasoning entered without losing the active editor.');
  const faceZoom=await page.locator('#zoom').innerText();await page.locator('#details').hover();await page.mouse.wheel(0,320);await page.waitForTimeout(100);assert.equal(await page.locator('#zoom').innerText(),faceZoom,'Scrolling the node editor does not zoom the map');
  await page.screenshot({path:'build/design-review/node-face-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await face.evaluate(el=>el.scrollTop=0);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const faceBox=await face.boundingBox(),viewportBox=await page.locator('#viewport').boundingBox();assert(faceBox.x>=0&&faceBox.x+faceBox.width<=390&&faceBox.y>=viewportBox.y&&faceBox.y+faceBox.height<=viewportBox.y+viewportBox.height,'Expanded node editing remains within the narrow canvas');
  await page.screenshot({path:'build/design-review/node-face-mobile.png',fullPage:true});await page.locator('#details').scrollIntoViewIfNeeded();await page.screenshot({path:'build/design-review/node-face-details-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});await face.locator('details>summary').click();await done.click();await choose(claim.id);
  assert.equal(await page.locator('.on-map-actions').getByRole('button',{name:'Add child node',exact:true}).count(),1);
  assert.equal(await page.locator('.on-map-actions').getByRole('button',{name:/^(Create reason|Connect|Definitions & standards|Compare|My confidence)$/}).count(),0);
  assert.equal(await page.locator('.on-map-actions .node-action-group').count(),4);
  assert.equal(await page.locator('.on-map-actions').getByRole('group',{name:'Foundations',exact:true}).getByRole('button',{name:'Philosophy',exact:true}).count(),1);
  await page.locator(`#cards .node[data-id="${claim.id}"] .node-confidence`).click();
  assert(await page.locator('.on-map-actions .confidence-form input[type="range"]').evaluate(el=>el===document.activeElement),'Opening Confidence focuses its scale for immediate keyboard entry');
  await page.keyboard.press('Escape');assert.equal(await page.locator('.on-map-actions').isVisible(),false);assert(await page.locator(`#cards .node[data-id="${claim.id}"] .node-confidence`).evaluate(el=>el===document.activeElement),'Confidence Escape returns focus to the node value');
  await page.locator(`#cards .node[data-id="${claim.id}"] .node-confidence`).click();
  await page.locator('.on-map-actions .confidence-form').getByRole('spinbutton').fill('61');await page.locator('.on-map-actions').getByRole('button',{name:'Save confidence',exact:true}).click();await saved();
  assert.equal(await page.locator('#inspector').isVisible(),false,'Saving confidence on the map does not force open the optional panel');
  for(const id of ['kind-group','structural-group','time-group'])assert.equal(await page.locator('#'+id).isVisible(),false);
  assert.equal(await page.locator('#add-example,#child-kind,#on-map-child-kind').count(),0);
  // Native buttons remain keyboard-operable, and a reason is an explicit child→claim connection.
  await choose(claim.id);const create=page.locator('.on-map-actions').getByRole('button',{name:'Add child node',exact:true});await create.focus();await page.keyboard.press('Enter');
  assert(await page.locator('#child-form').isVisible());assert.equal(await page.locator('#child-relationship').inputValue(),'organization');
  assert(await face.isVisible());assert.equal(await page.locator('#inspector').isVisible(),false);assert(await page.locator('#child-title').evaluate(el=>el===document.activeElement),'Add child opens its title directly on the map');
  assert.equal(await page.locator('#cards .node[data-draft]').count(),1,'An unsaved child has one immediate provisional card');assert.equal(await face.getAttribute('data-node-id'),await page.locator('#cards .node[data-draft]').getAttribute('data-id'));
  const pendingId=await face.getAttribute('data-node-id');assert.equal(await page.locator(`#world .map-edge-hit[data-node-pair*="${pendingId}"]`).count(),0,'The provisional branch has no inspectable saved-connection control');
  const beforeChild=JSON.stringify(await data());await page.locator('#child-title').fill('A pending child');await page.waitForTimeout(1500);
  assert.equal(JSON.stringify(await data()),beforeChild,'A valid child draft does not autosave a placeholder');assert.match(await page.locator('#storage-status').innerText(),/Child node draft/);
  await page.locator('.account-controls>summary').click();await page.locator('#save-workspace').click();assert.match(await page.locator('#workspace-message').innerText(),/Finish or cancel the child node/);
  await page.locator('.account-controls>summary').click();await page.locator('#download-workspace').click();assert.match(await page.locator('#workspace-message').innerText(),/Finish or cancel the child node/);assert.equal(await page.locator('#child-title').inputValue(),'A pending child');
  page.once('dialog',d=>d.dismiss());await choose(goal.id);assert.equal(await page.locator('#child-title').inputValue(),'A pending child','Cancelled discard preserves the form');
  await page.locator('#cancel-child').click();assert.equal(JSON.stringify(await data()),beforeChild,'Cancel adds neither a node nor a reason');assert.equal(await page.locator('#cards .node[data-draft]').count(),0,'Cancel removes the provisional card');assert.equal(await face.isVisible(),false);
  // Settings may be cancelled after accepting child-draft discard. Restore the
  // preceding inspector state rather than leaving a blank child panel behind.
  for(const inspected of [false,true]){
    await choose(claim.id);if(inspected){await page.locator('.on-map-actions').getByRole('button',{name:'Inspect details',exact:true}).click();await choose(claim.id);}
    await page.locator('.on-map-actions').getByRole('button',{name:'Add child node',exact:true}).click();await page.locator('#child-title').fill('Discard through map settings');
    page.once('dialog',d=>d.accept());await page.locator('#map-settings').click();await page.locator('#close-map-dialog').click();
    assert.equal(await page.locator('#child-form').isVisible(),false);assert.equal(await page.locator('#inspector').isVisible(),inspected,'Discard restores whether the optional inspector was open');
    if(inspected){assert(await page.locator('#node-reading').isVisible());assert(await page.locator('#node-meaning').isVisible());await page.locator('#close').click();}
    assert.equal(JSON.stringify(await data()),beforeChild,'Accepted draft discard adds no saved records');
  }
  await page.locator(`#cards .node[data-id="${claim.id}"] .node-add-child`).click();assert(await page.locator('#child-form').isVisible());
  const reasonDraftId=await page.locator('#cards .node[data-draft]').getAttribute('data-id');assert(await page.locator('#child-title').evaluate(el=>el===document.activeElement),'The plus control uses the same direct child editor');
  await page.locator('#child-title').fill('A verifiable reason');await page.locator('#child-form details>summary').click();await page.locator('#child-source-title').fill('Reference citation');await page.locator('#child-source-url').fill('https://example.org/source');await page.locator('#child-relationship').selectOption('reason');await page.locator('#child-confidence').fill('0');await page.locator('#child-submit').click();await saved();
  assert.equal(await page.locator('#saved').innerText(),'Node added.','Creation explicitly adds the completed node');
  let current=await data();const reason=current.nodes.find(n=>n.title==='A verifiable reason'),edge=current.relations.find(e=>e.from===reason.id&&e.to===claim.id);
  assert.equal(reason.id,reasonDraftId,'Submission commits the visible draft rather than inserting a replacement node');assert.equal(await page.locator('#cards .node[data-draft]').count(),0);assert.equal(await face.getAttribute('data-node-id'),reason.id);assert(await face.locator('#edit-form').isVisible(),'The committed child remains editable on its face');
  assert.equal(reason.kind,'position');assert.equal(reason.structuralType,'nesting');assert.equal(reason.parent,claim.id);assert.equal(edge.type,'reason');assert.equal(reason.sourceUrl,'https://example.org/source');assert.equal(reason.confidence,0);
  assert.equal(await page.locator('#relationships .semantic-edge').count(),1);
  assert.equal(await page.locator('#connections .edge:not(.spine)').count(),2,'Semantic reason replaces its duplicate parent line; only the two frame→claim structural lines remain');
  await done.click();const edgeHit=page.locator('#relationships .map-edge-hit');await edgeHit.focus();await page.keyboard.press('Enter');
  const edgeMenu=page.locator('#viewport .map-connection-menu');assert(await edgeMenu.isVisible());assert.match(await edgeMenu.innerText(),/A verifiable reason → Alice claim/);assert.match(await edgeMenu.innerText(),/Branch organization/);assert.equal(await page.locator('#inspector').isVisible(),false,'Inspecting an edge is on-map');
  await page.evaluate(()=>{globalThis.edgeGeometryWrites=0;globalThis.edgeObserver=new MutationObserver(records=>globalThis.edgeGeometryWrites+=records.length);globalThis.edgeObserver.observe(document.getElementById('relationships'),{attributes:true,subtree:true,attributeFilter:['d']});});
  await page.locator('#plus').click();await page.locator('#minus').click();await page.locator('#viewport').focus();await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(()=>{edgeObserver.disconnect();return edgeGeometryWrites;}),0,'Camera-only movement reuses completed edge geometry without rerouting or rewriting it');
  const mapZoom=await page.locator('#zoom').innerText();await edgeMenu.getByRole('button',{name:'Show connected nodes',exact:true}).click();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(await page.locator('#zoom').innerText(),mapZoom);
  const centered=await page.evaluate(ids=>{const [a,b]=ids.map(id=>document.querySelector(`#cards .node[data-id="${id}"]`).getBoundingClientRect()),v=document.getElementById('viewport').getBoundingClientRect();return {x:(a.x+a.width/2+b.x+b.width/2)/2-v.x-v.width/2,y:(a.y+a.height/2+b.y+b.height/2)/2-v.y-v.height/2};},[reason.id,claim.id]);assert(Math.abs(centered.x)<1&&Math.abs(centered.y)<1,'Revealing a connection keeps its final centered camera after animation');
  await edgeMenu.getByRole('button',{name:'Edit',exact:true}).click();await page.locator('#connection-note-input').fill('The cited source supports this claim.');await page.locator('#connection-submit').click();await saved();assert.equal((await data()).relations.find(e=>e.id===edge.id).note,'The cited source supports this claim.');
  await page.locator('#close').click();await page.locator('.map-view-options>summary').click();await page.locator('#relation-view').selectOption('none');assert.equal(await page.locator('#relationships .semantic-edge').count(),0);assert.equal(await page.locator('#connections .edge:not(.spine)').count(),2,'Hiding a semantic edge does not substitute a misleading parent edge');await page.locator('#relation-view').selectOption('all');await page.locator('.map-view-options>summary').click();
  await edgeHit.focus();await page.keyboard.press('Enter');await edgeMenu.getByRole('button',{name:'Close',exact:true}).click();assert(await edgeHit.evaluate(el=>document.activeElement===el),'Closing connection detail returns focus to its edge');
  const branchHit=page.getByRole('button',{name:'Inspect connection: Status Quo to Alice claim',exact:true});await branchHit.focus();await page.keyboard.press('Enter');
  await page.locator('#cards .node[data-id="status"] .toggle').click();assert.equal(await edgeMenu.isVisible(),false,'Folding an inspected connection closes its stale menu even if its selected parent stays visible');await page.locator('#all').click();
  await choose(reason.id);await page.locator('.on-map-actions').getByRole('button',{name:'Add child node',exact:true}).click();assert.equal(await page.locator('#child-title').inputValue(),'');await page.locator('#child-title').fill('An ordinary nested statement');await page.locator('#child-submit').click();await saved();
  current=await data();const nested=current.nodes.find(n=>n.title==='An ordinary nested statement');assert.equal(nested.kind,'position');assert.equal(nested.structuralType,'nesting');assert.equal(current.relations.some(e=>e.from===nested.id||e.to===nested.id),false,'Plain nesting adds no semantic claim');
  await done.click();await choose(nested.id);await page.locator('.on-map-actions').getByRole('button',{name:'Inspect details',exact:true}).click();await page.locator('#connect').click();assert.equal(await page.locator('#connection-target option[value="goal"]').count(),0);await page.locator('#connection-target').selectOption(goal.id);assert.deepEqual(await page.locator('#connection-type option').evaluateAll(options=>options.map(o=>o.value)),['reason','cause']);
  page.once('dialog',d=>d.accept());await page.locator('#cancel-connect').click();await page.locator('#close').click();if(await page.locator('#all').isEnabled())await page.locator('#all').click();await choose('status');assert.equal(await page.locator('.on-map-actions').getByRole('button',{name:'Create reason',exact:true}).count(),0,'Frames are containers, not claims to justify');assert.equal(await page.locator('.on-map-actions').getByRole('button',{name:'Connect',exact:true}).count(),0);
  await page.locator('.on-map-actions').getByRole('button',{name:'Add child node',exact:true}).click();assert.equal(await page.locator('#child-relationship-group').isVisible(),false);await page.locator('#cancel-child').click();
  await page.locator('.on-map-actions').getByRole('button',{name:'Edit frame details',exact:true}).click();assert(await page.locator('#title').isDisabled());assert(await face.isVisible());assert(await page.locator('#summary').evaluate(el=>el===document.activeElement));await done.click();await choose('status');
  await page.locator('.on-map-actions').getByRole('button',{name:'Close',exact:true}).click();assert.equal(await page.locator('#cards .node[data-id="status"] .node-main').evaluate(el=>el===document.activeElement),true,'Closing the on-map menu returns focus to its node');await page.setViewportSize({width:390,height:844});await page.locator('#fit').click();await choose(reason.id);const bounds=await page.locator('.on-map-actions').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=390);assert.equal(await page.locator('#inspector').isVisible(),false);
  await mkdir('build/design-review',{recursive:true});await page.screenshot({path:'build/design-review/map-grammar-mobile.png',fullPage:true});
  const parentBefore=await page.locator(`#cards .node[data-id="${reason.id}"]`).boundingBox(),narrowZoom=await page.locator('#zoom').innerText();
  await page.locator('.on-map-actions').getByRole('button',{name:'Add child node',exact:true}).click();await page.locator('#child-title').fill('Cancelled mobile preview');await page.locator('#cancel-child').click();
  const parentAfter=await page.locator(`#cards .node[data-id="${reason.id}"]`).boundingBox(),narrowViewport=await page.locator('#viewport').boundingBox();
  assert.equal(await page.locator('#zoom').innerText(),narrowZoom);assert(Math.abs(parentAfter.x-parentBefore.x)<1&&Math.abs(parentAfter.y-parentBefore.y)<1,'Cancel restores the parent’s previous on-screen position');
  assert(parentAfter.x>=narrowViewport.x&&parentAfter.x+parentAfter.width<=narrowViewport.x+narrowViewport.width&&parentAfter.y>=narrowViewport.y&&parentAfter.y+parentAfter.height<=narrowViewport.y+narrowViewport.height,'The parent remains visible after cancelling a narrow child editor');
  await page.locator('.on-map-actions').getByRole('button',{name:'Close',exact:true}).click();await edgeHit.focus();await page.keyboard.press('Enter');const edgeBounds=await edgeMenu.boundingBox();assert(edgeBounds.x>=0&&edgeBounds.x+edgeBounds.width<=390&&edgeBounds.y>=0&&edgeBounds.y+edgeBounds.height<=844);await page.screenshot({path:'build/design-review/map-edge-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});await edgeMenu.getByRole('button',{name:'Edit',exact:true}).click();await page.locator('#connection-note-input').fill('An unsaved connection draft');await page.locator('#connection-target').selectOption('');
  let dialogCount=0;const reject=async dialog=>{dialogCount++;await dialog.dismiss();};page.once('dialog',reject);await page.locator('#connection-list .delete-connection').click();assert.equal(dialogCount,1);assert((await data()).relations.some(e=>e.id===edge.id),'Cancelling draft discard must leave the connection saved');
  const accept=async dialog=>{dialogCount++;await dialog.accept();};page.on('dialog',accept);await page.locator('#connection-list .delete-connection').click();await saved();page.off('dialog',accept);assert.equal(dialogCount,2,'Removing after discarding a draft asks exactly once');
  assert.equal((await data()).relations.some(e=>e.id===edge.id),false);assert.equal((await data()).nodes.find(n=>n.id===reason.id).title,'A verifiable reason','Discarding a connection draft leaves node wording unchanged');assert.equal(await page.locator('#relationships .semantic-edge').count(),0);assert.match(await edgeMenu.innerText(),/Branch organization/,'Removing a reason retains its real nesting relationship');await page.reload();await page.locator('#editor-main').waitFor();current=await data();assert.equal(current.relations.some(e=>e.id===edge.id),false);assert.deepEqual(errors,[]);
  // The optional panel and the on-map menu share the successful deletion cleanup.
  await page.locator('#all').click();await choose(nested.id);await page.locator('.on-map-actions').getByRole('button',{name:'Inspect details',exact:true}).click();await choose(nested.id);await page.locator('.on-map-actions .node-action-disclosure').click();
  const remove=page.locator('.on-map-actions').getByRole('button',{name:'Delete branch',exact:true});page.once('dialog',d=>d.dismiss());await remove.click();assert(await page.locator('.on-map-actions').isVisible());assert(await page.locator(`#cards .node[data-id="${nested.id}"]`).count());assert(await page.locator('#inspector').isVisible());
  page.once('dialog',d=>d.accept());await remove.click();await saved();assert.equal(await page.locator(`#cards .node[data-id="${nested.id}"]`).count(),0);assert.equal(await page.locator('.on-map-actions').isVisible(),false,'Deletion closes the menu for the deleted node');assert.equal(await page.locator('#inspector').isVisible(),false);assert.equal(await page.locator('#connection-form').isVisible(),false);assert(await page.locator(`#cards .node[data-id="${reason.id}"] .node-main`).evaluate(el=>el===document.activeElement),'Deletion returns keyboard focus to the surviving parent');

  // A shared source view must preserve the editor's saved edge meanings, even
  // for cross-frame pairs, opposing directions and a redundant parent branch.
  await edit(store,alice,ws=>{const owned=ws.maps.find(m=>m.id===map.id);owned.relations.push(
    {id:'audit-reason',from:reason.id,to:claim.id,type:'reason',note:'Supports the conclusion.'},
    {id:'audit-opposite',from:claim.id,to:reason.id,type:'cause',note:'An independently recorded reverse meaning.'},
    {id:'audit-cross-frame',from:reason.id,to:goal.id,type:'cause',note:'A cross-frame cause.'}
  );});
  const sourceSnapshot=JSON.stringify(await data());await page.reload();await page.locator('#editor-main').waitFor();await page.locator('#all').click();assert.equal(await page.locator('#relationships .semantic-edge').count(),2,'Editor groups the three semantic records into two actual pairs');
  await page.goto(origin+'/#source='+map.id);await page.locator('#discover-workspace').waitFor();await page.locator('#reference-all').click();
  const sourceCanvas=page.locator('#reference-canvas'),sourceMenu=sourceCanvas.locator('.map-connection-menu'),sourcePair=sourceCanvas.getByRole('button',{name:'Inspect connection: Alice claim to A verifiable reason',exact:true});
  assert.equal(await sourceCanvas.locator('.semantic-edge').count(),2,'Source browsing includes the same semantic pairs as the editor');assert.equal(await sourceCanvas.locator('.map-edge-group').count(),4,'A semantic parent pair has one route, with its structural meaning retained');
  const pairedPath=sourcePair.locator('..').locator('.semantic-edge');assert(await pairedPath.getAttribute('marker-start'));assert(await pairedPath.getAttribute('marker-end'),'Opposing directions have arrows at both ends');
  await sourcePair.focus();await page.keyboard.press('Enter');assert(await sourceMenu.isVisible());assert.match(await sourceMenu.innerText(),/Alice claim → A verifiable reason/);assert.match(await sourceMenu.innerText(),/A verifiable reason → Alice claim/);assert.match(await sourceMenu.innerText(),/Branch organization/);assert.match(await sourceMenu.innerText(),/Supports the conclusion/);assert.equal(await sourceMenu.getByRole('button',{name:/^(Edit|Remove)$/}).count(),0,'Source inspection is read-only');
  const sourceZoom=await sourceCanvas.locator('.comparison-zoom').innerText();await sourceMenu.getByRole('button',{name:'Show connected nodes',exact:true}).click();assert.equal(await sourceCanvas.locator('.comparison-zoom').innerText(),sourceZoom);await page.screenshot({path:'build/design-review/source-connections-desktop.png',fullPage:true});
  await page.keyboard.press('Escape');assert.equal(await sourceMenu.isVisible(),false);assert(await sourcePair.evaluate(el=>el===document.activeElement),'Source connection Escape returns focus to the edge');
  const crossPair=sourceCanvas.getByRole('button',{name:'Inspect connection: A verifiable reason to Alice goal',exact:true});await crossPair.focus();await page.keyboard.press('Enter');assert.match(await sourceMenu.innerText(),/A cross-frame cause/);
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const sourceBounds=await sourceMenu.boundingBox(),surfaceBounds=await sourceCanvas.locator('.comparison-canvas').boundingBox();assert(sourceBounds.x>=0&&sourceBounds.x+sourceBounds.width<=390&&sourceBounds.y>=surfaceBounds.y&&sourceBounds.y+sourceBounds.height<=surfaceBounds.y+surfaceBounds.height,'Read-only source details remain inside the narrow canvas: '+JSON.stringify({sourceBounds,surfaceBounds}));await page.screenshot({path:'build/design-review/source-connections-mobile.png',fullPage:true});
  await sourceMenu.getByRole('button',{name:'Close',exact:true}).click();await sourcePair.focus();await page.keyboard.press('Enter');await sourceCanvas.getByRole('button',{name:'Collapse Status Quo in map A',exact:true}).focus();await page.keyboard.press('Enter');assert.equal(await sourceMenu.isVisible(),false,'Folding source endpoints closes their detail');assert.equal(await sourceCanvas.locator('.semantic-edge').count(),0,'Hidden source endpoints do not acquire ancestor substitute edges');assert.equal(JSON.stringify(await data()),sourceSnapshot,'Source browsing does not change the saved graph');assert.deepEqual(errors,[]);
  console.log('Map grammar browser checks passed: node-face editing, autosave focus/caret and Details preservation, wheel isolation, provisional child identity and cancellation, save/download guards, creation and deletion, grouped on-map and read-only source connection inspection, preserved directions, stable reveal, fold cleanup, citations, cross-frame types, reload and narrow layout.');
}catch(error){for(const context of browser.contexts())for(const page of context.pages()){await page.screenshot({path:'build/design-review/map-grammar-failure.png',fullPage:true});console.error((await page.locator('body').innerText()).slice(-6000));}throw error;}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
