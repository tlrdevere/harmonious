import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {accountWorkspace,saveAccountChanges,startAccountComparison} from '../worker/account-api.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {synchronizeIdeas,createOwnedMap} from '../dist/adoption.mjs';

// Real SVG regression: the screenshot's five siblings, then deep and dense
// branches, use the same grouped source route in every available canvas.
if(!process.env.HARMONIOUS_PLAYWRIGHT)throw Error('Set HARMONIOUS_PLAYWRIGHT.');
const {chromium}=await import(pathToFileURL(process.env.HARMONIOUS_PLAYWRIGHT));
const store=memoryStore(),ids={},errors=[];
for(const actor of [alice,bob]){
  await seedActor(store,actor);ids[actor.name]={};
  await edit(store,actor,ws=>{
    const map=ws.maps.find(m=>m.ownerId===actor.id);map.visibility='shared';map.name=actor.name+' source routes';
    for(const title of ['DSA','State','Low union density','Socialists','Dems','Evidence','Membership survey','Deep evidence','Housing action','Housing goal','Action detail','Goal detail']){
      const n=addNode(ws,actor,title);n.parent=title==='Evidence'?ids[actor.name]['Low union density']:title==='Membership survey'?ids[actor.name].Socialists:title==='Deep evidence'?ids[actor.name].Evidence:'status';
      if(title==='Housing action')n.parent='action';if(title==='Housing goal')n.parent='goal';if(title==='Action detail')n.parent=ids[actor.name]['Housing action'];if(title==='Goal detail')n.parent=ids[actor.name]['Housing goal'];n.kind='position';n.summary='Saved source wording: '+title;ids[actor.name][title]=n.id;
    }
    const own=ids[actor.name];map.relations=[{id:actor.name+'-cross-a',from:own['Low union density'],to:own['Housing action'],type:'addresses'},{id:actor.name+'-cross-g',from:own['Housing action'],to:own['Housing goal'],type:'enables'},
      {id:actor.name+'-a-reason',from:own.Evidence,to:own['Low union density'],type:'reason',note:'The evidence supports the parent.'},
      {id:actor.name+'-b-reverse',from:own['Low union density'],to:own.Evidence,type:'cause',note:'An independently saved reverse meaning.'},
      {id:actor.name+'-survey-reason',from:own['Membership survey'],to:own.Socialists,type:'reason',note:'Child-to-parent direction.'}
    ];synchronizeIdeas(ws,map);
  });
}
const initial=(await view(store,alice)).workspace,aMap=initial.maps.find(m=>m.ownerId===alice.id),bMap=initial.maps.find(m=>m.ownerId===bob.id);
const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:aMap.id,bMapId:bMap.id});
const at={type:'node',mapId:aMap.id,nodeId:ids.Alice['Low union density']},bt={type:'node',mapId:bMap.id,nodeId:ids.Bob['Low union density']};
await edit(store,alice,ws=>{ws.discussions.push(makeDiscussion(ws,{comparisonId:thread.id,kind:'correspondence',action:'counterpart_link',target:at,other:bt},alice.id));ws.discussions.push(makeDiscussion(ws,{comparisonId:thread.id,kind:'interaction',mode:'compare',action:'endorse',target:bt},alice.id));});
await edit(store,bob,ws=>ws.discussions.push(makeDiscussion(ws,{comparisonId:thread.id,kind:'interaction',mode:'compare',action:'endorse',target:at},bob.id)));
const json=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){
    let raw='';for await(const chunk of req)raw+=chunk;const input=raw?JSON.parse(raw):null;
    if(url.pathname==='/api/session'){json(res,200,{configured:true,actor:alice,signup:{mode:'public'}});return;}
    if(url.pathname==='/api/comparisons'){json(res,200,await startAccountComparison(store,alice.id,input));return;}
    if(url.pathname==='/api/workspace'&&req.method==='PUT'){json(res,200,await saveAccountChanges(store,alice.id,input.changes));return;}
    json(res,200,await accountWorkspace(store,alice));return;
  }
  const name=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!/^[a-z0-9.-]+$/.test(name)){res.writeHead(404);res.end();return;}
  let content=await readFile(resolve('dist',name),'utf8');if(name==='index.html')content=content.replace('src="./app.mjs"','src="./beta-boot.mjs"').replace('</head>','<link rel="stylesheet" href="./accounts.css"></head>');
  res.setHeader('content-type',name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'text/javascript');res.end(content);
}catch(error){json(res,error.status||500,{error:error.message});}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:process.env.HARMONIOUS_BROWSER||'msedge'});
try{
  await mkdir('build/design-review',{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  const enter=async locator=>{await locator.focus();await page.keyboard.press('Enter');};
  const geometry=host=>host.locator('.node').evaluateAll(cards=>cards.map(el=>[el.dataset.id||el.dataset.nodeId,el.dataset.mapId,el.style.transform]));
  const dialog=page.getByRole('dialog',{name:'Choose topic branches'});
  await page.goto(origin+'/#map='+aMap.id);await page.locator('#all').click();
  const editor=page.locator('#world'),editorOptions=page.locator('.map-view-options');
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await settle();
  const angles=()=>editor.locator('.node').evaluateAll((cards,ids)=>{const point=id=>{const el=cards.find(c=>c.dataset.id===id),m=new DOMMatrix(el.style.transform);return {x:m.e,y:m.f};};return [['status',ids['Low union density']],['action',ids['Housing action']],['goal',ids['Housing goal']]].map(([root,id])=>{const a=point(root),b=point(id);return Math.atan2(b.y-a.y,b.x-a.x);});},ids.Alice);
  let aligned=await angles();assert(Math.abs(aligned[0]-aligned[1])<.0001,JSON.stringify(aligned));
  await enter(editor.locator('[data-id="'+ids.Alice['Low union density']+'"] .node-main'));await page.getByRole('button',{name:'Inspect details',exact:true}).click();
  await page.getByRole('button',{name:'Remove connection: Low union density is addressed by Housing action',exact:true}).click();await settle();
  const removed=await angles();assert(Math.abs(removed[0]-removed[1])>.01,'Removing a connection recomputes alignment');
  await page.locator('#connect').click();await page.locator('#connection-target').selectOption(ids.Alice['Housing action']);await page.locator('#connection-type').selectOption('addresses');await page.locator('#connection-submit').click();await settle();
  aligned=await angles();assert(Math.abs(aligned[0]-aligned[1])<.0001,'Creating a connection immediately aligns its topics');await page.locator('#close').click();
  const before=await geometry(editor);
  await editorOptions.locator('summary').click();await editorOptions.getByRole('button',{name:'Focus selection',exact:true}).click();
  await dialog.getByRole('checkbox',{name:'Low union density',exact:true}).check();await dialog.getByRole('checkbox',{name:'Housing action',exact:true}).check();await dialog.getByRole('button',{name:'Apply focus'}).click();
  assert.deepEqual(await geometry(editor),before,'Focusing does not change layout');
  const card=title=>editor.locator(`[data-id="${ids.Alice[title]}"]`);
  assert(!(await card('Evidence').getAttribute('class')).includes('topic-faded'),'Descendants remain prominent');
  assert((await card('DSA').getAttribute('class')).includes('topic-faded'));
  assert(!(await card('Housing action').getAttribute('class')).includes('topic-faded'));
  assert((await card('Housing goal').getAttribute('class')).includes('topic-faded'),'Connected branches are not implicitly selected');
  assert.equal(await editor.locator('.root.topic-faded').count(),0);
  await editorOptions.locator('summary').click();await page.locator('#fit').click();await page.screenshot({path:'build/design-review/topic-focus-create-desktop.png',fullPage:true});
  await page.locator('#collapse').click();await page.locator('#all').click();assert((await card('DSA').getAttribute('class')).includes('topic-faded'),'Focus survives folds');
  await page.reload();await page.locator('#all').click();assert((await card('DSA').getAttribute('class')).includes('topic-faded'),'Focus survives reload in this browser tab');
  await editorOptions.locator('summary').click();await editorOptions.getByRole('button',{name:'Clear focus',exact:true}).click();assert.equal(await editor.locator('.topic-faded').count(),0);
  await editorOptions.locator('summary').click();await enter(card('Housing goal').locator('.node-main'));await page.getByRole('button',{name:'Focus this branch',exact:true}).click();
  for(const title of ['Housing goal','Housing action','Low union density','Evidence','Action detail','Goal detail'])assert(!(await card(title).getAttribute('class')).includes('topic-faded'),title+' belongs to the connected topic');
  assert((await card('DSA').getAttribute('class')).includes('topic-faded'));
  const reset=page.locator('#viewport>.topic-focus-reset');assert(await reset.isVisible(),'Clear focus is visible with View options closed');
  await page.screenshot({path:'build/design-review/topic-focus-connected-desktop.png',fullPage:true});
  const focusedGeometry=await geometry(editor);await reset.click();assert.deepEqual(await geometry(editor),focusedGeometry);assert.equal(await editor.locator('.topic-faded').count(),0);assert(!(await reset.isVisible()));
  await page.goto(origin+'/#source='+bMap.id);await page.locator('#reference-all').click();
  const source=page.locator('#reference-canvas'),sourceOptions=page.locator('.topic-source-options').filter({visible:true});
  await sourceOptions.locator('summary').click();await sourceOptions.getByRole('button',{name:'Focus selection',exact:true}).click();await dialog.getByRole('checkbox',{name:'Low union density',exact:true}).check();await dialog.getByRole('button',{name:'Apply focus'}).click();
  assert(await source.locator('.node.topic-faded').count()>0,'Read-only source browsing supports focus');assert.equal(await source.locator('.node[data-node-id="'+ids.Bob.Evidence+'"].topic-faded').count(),0);
  await page.goto(origin+'/#comparison='+thread.id);const canvas=page.locator('#compare-canvas');await canvas.locator('.node').first().waitFor();
  const opts=page.locator('.comparison-view-options');await opts.locator(':scope>summary').click();for(const side of ['a','b'])await page.locator('#compare-all-'+side).click();
  const combined=await geometry(canvas);await opts.getByRole('button',{name:'Focus selection',exact:true}).click();
  await dialog.getByRole('checkbox',{name:'Low union density',exact:true}).first().check();await dialog.getByRole('checkbox',{name:'Housing action',exact:true}).first().check();await dialog.getByRole('button',{name:'Apply focus'}).click();
  assert.deepEqual(await geometry(canvas),combined);assert(await canvas.locator('.node[data-side="b"].topic-faded').count()>0,'Other map is not implicitly selected');
  assert.equal(await canvas.locator('.agreement-marker-node.topic-faded').count(),1,'Only the unselected counterpart half fades');assert.equal(await canvas.locator('.agreement-pair.topic-faded').count(),0,'Shared pair remains identifiable when one half is focused');
  assert(await canvas.locator('.counterpart-placeholder.topic-faded').count()>0,'Ghosts follow their own topic');
  assert(await canvas.locator('.discussion-source-edge.topic-faded').count()>0,'Outside connections fade');
  await canvas.getByRole('button',{name:'Fit both maps',exact:true}).click();await page.screenshot({path:'build/design-review/topic-focus-comparison-desktop.png',fullPage:true});
  await enter(canvas.locator('.node[data-map-id="'+aMap.id+'"][data-node-id="'+ids.Alice['Housing goal']+'"] .node-main'));await page.locator('.discussion-popover').getByRole('button',{name:'Focus this branch',exact:true}).click();
  for(const title of ['Low union density','Housing action','Housing goal','Action detail','Goal detail'])assert.equal(await canvas.locator('.node[data-node-id="'+ids.Alice[title]+'"].topic-faded').count(),0);
  assert(await canvas.locator('.node[data-map-id="'+bMap.id+'"].topic-faded').count()>0,'Cross-frame shortcut does not implicitly select a different person’s map');
  await page.locator('#reasoning-argument-mode').click();assert(await canvas.locator('.node.topic-faded').count()>0,'Outer Argument preserves focus');
  await page.setViewportSize({width:390,height:844});await opts.locator(':scope>summary').click();await opts.getByRole('button',{name:'Change selection',exact:true}).click();const box=await dialog.boundingBox();assert(box.x>=0&&box.x+box.width<=391);await page.screenshot({path:'build/design-review/topic-focus-mobile-chooser.png',fullPage:true});await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  const sharedReset=canvas.locator('.topic-focus-reset');assert(await sharedReset.isVisible());const resetBox=await sharedReset.boundingBox();assert(resetBox.x>=0&&resetBox.x+resetBox.width<=390);
  await page.screenshot({path:'build/design-review/topic-focus-clear-mobile.png',fullPage:true});await sharedReset.click();assert.equal(await canvas.locator('.topic-faded').count(),0);
  assert.deepEqual(errors,[]);await context.close();
  console.log('PASS: Create and shared branch focus, explicit selections, descendants, ghosts, connections, reload, folds, unchanged geometry, Argument mode and narrow chooser.');
}finally{await browser.close();server.close();}



