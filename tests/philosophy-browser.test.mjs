import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {accountWorkspace,saveAccountChanges,startAccountComparison} from '../worker/account-api.mjs';
import {makeDefinition,definitionReference,definitionReferenceText} from '../dist/definitions.mjs';
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
 await mkdir('build/design-review',{recursive:true});const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const dialog=page.locator('.definitions-dialog'),saved=async()=>{await page.waitForFunction(()=>document.querySelector('#storage-status')?.textContent.includes('All changes saved'));};
 const choose=async(title)=>{await page.goto(origin+'/#map='+aMap.id);if(await page.locator('#all').isEnabled())await page.locator('#all').click();const n=page.locator('#world .node[data-id="'+ids.Alice[title]+'"] .node-main');await n.focus();await page.keyboard.press('Enter');await page.locator('.on-map-actions').getByRole('button',{name:'Philosophy',exact:true}).click();};
 await choose('Low union density');
 assert.deepEqual(await dialog.locator('#philosophy-new-type option').allTextContents(),['Definition','Standard','Principle','Belief','Other']);
 await dialog.locator('#philosophy-new-title').fill('Invalid draft');await dialog.getByRole('button',{name:'Save philosophy',exact:true}).click();assert(await dialog.locator('[role=alert]').isVisible());assert.equal((await view(store,alice)).workspace.definitions.length,0);
 await dialog.getByRole('button',{name:'Close',exact:true}).click();
 for(const type of ['definition','standard','principle','belief','other']){
  await choose('Low union density');if(type!=='definition')await dialog.getByText('Create a new idea',{exact:true}).click();await dialog.locator('#philosophy-new-type').selectOption(type);await dialog.locator('#philosophy-new-title').fill('Saved '+type);await dialog.locator('#philosophy-new-body').fill('The full foundation for '+type+'.');await dialog.getByRole('button',{name:'Save philosophy',exact:true}).click();await saved();
 }
 let ws=(await view(store,alice)).workspace,uses=()=>ws.discussions.filter(r=>r.kind==='context'&&r.status==='active'),first=uses().find(r=>r.target.nodeId===ids.Alice['Low union density']);assert.equal(first.definitionRefs.length,5);assert.equal(ws.definitions.length,5);
 await choose('Housing action');await dialog.getByRole('checkbox',{name:'Saved belief',exact:true}).check();await dialog.getByRole('button',{name:'Save philosophy',exact:true}).click();await saved();
 await page.getByRole('button',{name:'Map Library',exact:true}).click();await page.locator('.library-section-definitions').click();const bankCard=page.locator('.library-card').filter({has:page.getByRole('heading',{name:'Saved belief',exact:true})});await bankCard.getByRole('button',{name:'View entry',exact:true}).click();await dialog.getByRole('button',{name:'Edit entry',exact:true}).click();await dialog.locator('#definition-body').fill('Revised belief, requiring review at each use.');await dialog.getByRole('button',{name:'Save library entry',exact:true}).click();await saved();await dialog.getByRole('button',{name:'Close',exact:true}).click();
 await choose('Low union density');const belief=dialog.locator('.definition-choice').filter({has:page.getByRole('checkbox',{name:'Saved belief',exact:true})});assert.equal(await belief.locator('select').inputValue(),'1');await belief.locator('select').selectOption('2');await dialog.getByRole('button',{name:'Save philosophy',exact:true}).click();await saved();
 ws=(await view(store,alice)).workspace;assert.equal(uses().find(r=>r.target.nodeId===ids.Alice['Housing action']).definitionRefs[0].version,1);assert.equal(uses().find(r=>r.target.nodeId===ids.Alice['Low union density']).definitionRefs.find(r=>r.type==='belief').version,2);
 await choose('Low union density');await dialog.getByRole('searchbox').fill('principle');await dialog.getByRole('checkbox',{name:'Saved principle',exact:true}).uncheck();await dialog.getByRole('button',{name:'Save philosophy',exact:true}).click();await saved();ws=(await view(store,alice)).workspace;assert.equal(uses().find(r=>r.target.nodeId===ids.Alice['Low union density']).definitionRefs.length,4,'Filtering preserves other checked references');assert.equal(ws.definitions.length,5,'Unlinking retains the bank');
 await choose('Low union density');await page.screenshot({path:'build/design-review/philosophy-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await dialog.getByText('Create a new idea',{exact:true}).click();const bounds=await dialog.boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=390);await page.screenshot({path:'build/design-review/philosophy-mobile.png',fullPage:true});await dialog.getByRole('button',{name:'Close',exact:true}).click();
 await edit(store,bob,w=>{const idea=makeDefinition(w,{type:'belief',title:'Human nature',body:'Fundamentally good, though not incorruptible.'},bob.id),privateIdea=makeDefinition(w,{type:'other',title:'PRIVATE UNUSED',body:'Never invoked.'},bob.id);w.definitions.push(idea,privateIdea);const refs=[definitionReference(idea)];w.discussions.push(makeDiscussion(w,{kind:'context',action:'context',target:{type:'node',mapId:bMap.id,nodeId:ids.Bob['Low union density']},definitionRefs:refs,body:definitionReferenceText(refs)},bob.id));});
 await page.goto(origin+'/#source='+bMap.id);await page.reload();await page.locator('#reference-all').click();const node=page.locator('#reference-canvas .node[data-node-id="'+ids.Bob['Low union density']+'"] .node-main');await node.focus();await page.keyboard.press('Enter');await page.locator('#reference-detail').getByRole('button',{name:'Philosophy',exact:true}).click();assert((await dialog.innerText()).includes('Fundamentally good'));assert(!(await dialog.innerText()).includes('PRIVATE UNUSED'));assert.equal(await dialog.getByRole('button',{name:'Save philosophy',exact:true}).count(),0);await dialog.getByRole('button',{name:'Close',exact:true}).click();
 await page.setViewportSize({width:1280,height:900});await page.goto(origin+'/#comparison='+thread.id);await page.locator('.comparison-view-options>summary').click();for(const side of ['a','b'])await page.locator('#compare-all-'+side).click();const own=page.locator('#compare-canvas .node[data-node-id="'+ids.Alice['Low union density']+'"] .node-main');await own.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.discussion-popover').getByRole('button',{name:'Philosophy',exact:true}).count(),1);await page.locator('.discussion-popover').getByRole('button',{name:'Philosophy',exact:true}).click();assert.equal(await dialog.getByRole('checkbox',{checked:true}).count(),4);await dialog.getByRole('button',{name:'Close',exact:true}).click();assert.deepEqual(errors,[]);
 await context.close();console.log('Philosophy browser passed: five types, create-and-attach, reuse, pinned versions, filtered selections, removal, privacy, shared views, validation, cancellation and narrow layout.');
}finally{await browser.close();server.close();}
