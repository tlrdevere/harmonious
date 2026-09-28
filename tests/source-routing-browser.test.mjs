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
    for(const title of ['DSA','State','Low union density','Socialists','Dems','Evidence','Membership survey','Deep evidence']){
      const n=addNode(ws,actor,title);n.parent=title==='Evidence'?ids[actor.name]['Low union density']:title==='Membership survey'?ids[actor.name].Socialists:title==='Deep evidence'?ids[actor.name].Evidence:'status';
      n.kind='position';n.summary='Saved source wording: '+title;ids[actor.name][title]=n.id;
    }
    const own=ids[actor.name];map.relations=[
      {id:actor.name+'-a-reason',from:own.Evidence,to:own['Low union density'],type:'reason',note:'The evidence supports the parent.'},
      {id:actor.name+'-b-reverse',from:own['Low union density'],to:own.Evidence,type:'cause',note:'An independently saved reverse meaning.'},
      {id:actor.name+'-survey-reason',from:own['Membership survey'],to:own.Socialists,type:'reason',note:'Child-to-parent direction.'}
    ];synchronizeIdeas(ws,map);
  });
}
const initial=(await view(store,alice)).workspace,aMap=initial.maps.find(m=>m.ownerId===alice.id),bMap=initial.maps.find(m=>m.ownerId===bob.id);
const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:aMap.id,bMapId:bMap.id});
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
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  const pop=page.locator('.discussion-popover'),canvas=page.locator('#compare-canvas');
  const close=async()=>{if(await pop.isVisible())await pop.getByRole('button',{name:'Close',exact:true}).click();};
  const choose=async(title,side)=>{await close();const node=canvas.locator(`.node[data-side="${side}"] .node-main`).filter({has:page.getByText(title,{exact:true})});await node.focus();await page.keyboard.press('Enter');};
  const options=async action=>{await page.locator('.comparison-view-options>summary').click();await action();await page.locator('.comparison-view-options>summary').click();};
  const expand=async()=>options(async()=>{for(const side of ['a','b'])await page.locator('#compare-all-'+side).click();});
  const zoomTo=async(surface,world,zoom)=>{const change=await world.evaluate((el,z)=>{const m=new DOMMatrix(el.style.transform);return -Math.log(z/m.a)/.0015;},zoom),bounds=await surface.boundingBox();await surface.dispatchEvent('wheel',{deltaY:change,clientX:bounds.x+bounds.width/2,clientY:bounds.y+bounds.height/2});};
  const geometry=()=>canvas.locator('.comparison-world').evaluate(world=>({camera:world.style.transform,nodes:[...world.querySelectorAll('article.node')].map(n=>[n.dataset.side,n.querySelector('.node-title').textContent,n.style.transform]).sort(),ghosts:[...world.querySelectorAll('.counterpart-placeholder')].map(n=>[n.dataset.sourceMap,n.dataset.sourceNode,n.dataset.state,n.style.transform,n.offsetWidth,n.offsetHeight]).sort(),paths:[...world.querySelectorAll('.source-connection-path')].map(p=>[p.dataset.nodePair,p.getAttribute('d')]).sort()}));
  const inspectPaths=async host=>{await host.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));return host.evaluate(host=>{
    const cards=[...host.querySelectorAll('article.node,.counterpart-placeholder')].map(el=>{const m=new DOMMatrix(el.style.transform);return {el,x:m.e,y:m.f,w:el.offsetWidth,h:el.offsetHeight};}),problems=[];
    for(let i=0;i<cards.length;i++)for(const other of cards.slice(i+1)){const a=cards[i];if(a.x<other.x+other.w-.1&&a.x+a.w>other.x+.1&&a.y<other.y+other.h-.1&&a.y+a.h>other.y+.1)problems.push('overlapping real card or ghost');}
    for(const card of cards.filter(c=>c.el.classList.contains('counterpart-placeholder')))if(card.w!==144||card.h!==88)problems.push('incorrect compact ghost footprint');
    const seen=new Set();
    for(const path of host.querySelectorAll('.source-connection-path')){
      const key=path.dataset.nodePair;if(!key)continue;
      if(seen.has(key))problems.push('duplicate '+key);seen.add(key);
      const hit=[...host.querySelectorAll('.map-edge-hit,.discussion-edge-hit')].find(el=>el.dataset.sourcePair===key);
      if(!path.getAttribute('d')||hit?.getAttribute('d')!==path.getAttribute('d'))problems.push('missing or unequal hit '+key);
      if(!path.getAttribute('d'))continue;
      if(getComputedStyle(path).strokeDasharray!=='none')problems.push('dashed source '+key);
      const length=path.getTotalLength();
      for(let d=0;d<=length;d+=3){const p=path.getPointAtLength(d);if(cards.some(r=>p.x>r.x+.1&&p.x<r.x+r.w-.1&&p.y>r.y+.1&&p.y<r.y+r.h-.1)){problems.push('card intersection '+key);break;}}
    }
    return {problems,count:seen.size};
  });};
  const highlight=async(host,from,to)=>{
    const hit=host.locator('[data-source-pair][role="button"]');
    const index=await hit.evaluateAll((els,{from,to})=>els.findIndex(el=>el.dataset.sourcePair.includes(from)&&el.dataset.sourcePair.includes(to)),{from,to});assert(index>=0);
    const target=hit.nth(index),key=await target.getAttribute('data-source-pair');
    await target.dispatchEvent('pointerenter');assert.equal(await host.locator('.node.source-endpoint-highlight').count(),2,'Hover identifies exactly the two actual endpoint cards');
    await target.dispatchEvent('pointerleave');await target.focus();assert.equal(await host.locator('.node.source-endpoint-highlight').count(),2,'Keyboard focus identifies the same endpoint cards');
    await page.keyboard.press('Enter');assert.equal(await host.locator('.node.source-endpoint-highlight').count(),2,'Selecting a connection retains endpoint identity while inspecting it');
    await page.evaluate(()=>document.activeElement?.blur());await target.dispatchEvent('pointerleave');assert.equal(await host.locator('.node.source-endpoint-highlight').count(),2,'Inspection highlight remains after focus and hover leave, including touch selection');
    const paths=host.locator('.source-connection-path.source-connection-highlight');assert.equal(await paths.count(),1);assert.equal(await paths.getAttribute('data-source-pair'),key);
  };
  const arrows=async(host,owner)=>{
    const result=await host.evaluate((host,own)=>{
      const paths=[...host.querySelectorAll('.source-connection-path')],pair=(a,b)=>paths.find(p=>p.dataset.nodePair?.includes(a)&&p.dataset.nodePair?.includes(b));
      const bidirectional=pair(own.Evidence,own['Low union density']),directed=pair(own['Membership survey'],own.Socialists),length=directed.getTotalLength(),start=directed.getPointAtLength(0),end=directed.getPointAtLength(length);
      const card=title=>[...host.querySelectorAll('.node')].find(n=>n.querySelector('.node-title').textContent===title&&(!n.dataset.side||n.dataset.side===(ownerSide())));
      function ownerSide(){const keys=JSON.parse(directed.dataset.nodePair);try{return JSON.parse(keys[0])[0];}catch{return undefined;}}
      const distance=(p,title)=>{const n=card(title),m=new DOMMatrix(n.style.transform);return Math.max(Math.abs(p.x-m.e-n.offsetWidth/2)-n.offsetWidth/2,Math.abs(p.y-m.f-n.offsetHeight/2)-n.offsetHeight/2);};
      return {both:!!bidirectional.getAttribute('marker-start')&&!!bidirectional.getAttribute('marker-end'),start:directed.getAttribute('marker-start'),end:directed.getAttribute('marker-end'),fromDistance:distance(start,'Membership survey'),toDistance:distance(end,'Socialists')};
    },ids[owner]);
    assert(result.both,'Opposite directed meanings share one path with both arrows');assert(!result.start&&result.end,'A single child-to-parent meaning has only a destination arrow');assert(Math.abs(result.fromDistance)<.1&&Math.abs(result.toDistance)<.1,'The reused organizational path follows semantic child-to-parent direction');
  };
  await page.goto(origin+'/#comparison='+thread.id);await canvas.locator('.node').first().waitFor();
  assert.equal(await canvas.locator('.comparison-tree-edge').count(),0,'Collapsed frame headings have no decorative connectors');
  await page.screenshot({path:'build/design-review/connections-collapsed-desktop.png',fullPage:true});
  for(const side of ['A','B']){await canvas.getByRole('button',{name:'Expand Status Quo in map '+side,exact:true}).focus();await page.keyboard.press('Enter');if(side==='A'){assert.equal(await canvas.locator('.counterpart-placeholder').count(),5);assert.deepEqual((await inspectPaths(canvas)).problems,[]);await page.screenshot({path:'build/design-review/positioning-five-vs-collapsed-desktop.png',fullPage:true});}}
  await canvas.getByRole('button',{name:'Fit both maps',exact:true}).click();
  const initialGeometry=await geometry();assert.equal((await inspectPaths(canvas)).count,10);assert.deepEqual((await inspectPaths(canvas)).problems,[]);
  for(const side of ['a','b','a','b']){await choose('Low union density',side);assert.deepEqual(await geometry(),initialGeometry,'Selection does not move siblings, route geometry or the camera');}
  await close();await page.screenshot({path:'build/design-review/connections-five-siblings-desktop.png',fullPage:true});
  for(const selectedMode of ['inquiry','argument','compare','inquiry','compare']){await page.locator('#reasoning-'+selectedMode+'-mode').click();assert.deepEqual(await geometry(),initialGeometry,'Mode switches do not reroute source edges');}
  const ghost=canvas.locator('.counterpart-placeholder').first(),beforeGhostDrag=await geometry();await ghost.dispatchEvent('pointerdown',{pointerId:81,button:0,clientX:200,clientY:200});await canvas.locator('.comparison-canvas').dispatchEvent('pointermove',{pointerId:81,clientX:260,clientY:240});await canvas.locator('.comparison-canvas').dispatchEvent('pointerup',{pointerId:81});assert.deepEqual(await geometry(),beforeGhostDrag,'Ghost background drags cannot initiate canvas panning');
  await options(async()=>{await page.locator('.comparison-view-options .comparison-layer-controls [data-layer="a"]').click();await page.waitForTimeout(180);const opacity=await canvas.locator('.source-connection-path').evaluateAll(paths=>paths.map(p=>[p.dataset.side,Number(getComputedStyle(p).opacity)]));assert(opacity.every(([side,value])=>side==='a'?value>.5:value<.2),'Emphasizing a map dims its opposite source paths with its cards');await page.locator('.comparison-view-options .comparison-layer-controls [data-layer="both"]').click();});
  await highlight(canvas,'status',ids.Alice['Low union density']);await close();
  await expand();assert.deepEqual((await inspectPaths(canvas)).problems,[]);await arrows(canvas,'Alice');await arrows(canvas,'Bob');
  const deepGeometry=await geometry();await highlight(canvas,ids.Bob.Socialists,ids.Bob['Membership survey']);await close();assert.deepEqual(await geometry(),deepGeometry,'Inspecting a directed edge cannot overwrite its shared route');
  await page.screenshot({path:'build/design-review/connections-deep-desktop.png',fullPage:true});
  for(const side of ['a','b']){await options(()=>page.locator('#compare-collapse-'+side).click());assert.deepEqual((await inspectPaths(canvas)).problems,[]);await page.screenshot({path:`build/design-review/connections-${side}-collapsed.png`,fullPage:true});await expand();}
  await page.reload();await canvas.locator('.node').first().waitFor();await expand();assert.deepEqual((await inspectPaths(canvas)).problems,[]);assert.deepEqual((await geometry()).paths,deepGeometry.paths,'Cold reload restores the same world-coordinate routes');
  await page.setViewportSize({width:390,height:844});await canvas.getByRole('button',{name:'Fit both maps',exact:true}).click();await page.screenshot({path:'build/design-review/connections-five-siblings-mobile.png',fullPage:true});await highlight(canvas,ids.Alice.Socialists,ids.Alice['Membership survey']);
  const bounds=await pop.boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=390,'Connection inspection remains inside the narrow screen');await close();
  await page.setViewportSize({width:1440,height:1000});
  await options(async()=>{await page.locator('.connection-key>summary').click();assert.match(await page.locator('.connection-key').innerText(),/without agreement/);});
  // A request changes the existing compact control's meaning, not its geometry.
  await edit(store,alice,ws=>{ws.discussions.push(makeDiscussion(ws,{comparisonId:thread.id,kind:'counterpart',action:'counterpart',target:{type:'node',mapId:aMap.id,nodeId:ids.Alice['Low union density']},body:'Please provide a counterpart.'},alice.id));});
  await page.reload();await canvas.locator('.node').first().waitFor();await expand();assert.equal(await canvas.locator('.counterpart-placeholder').count(),16);assert.equal(await canvas.locator('.counterpart-placeholder[data-state="requested"]').count(),1);assert.deepEqual((await inspectPaths(canvas)).problems,[]);assert.deepEqual((await geometry()).nodes,deepGeometry.nodes,'Sending a request does not add another layout slot');await page.screenshot({path:'build/design-review/connections-request-slot-desktop.png',fullPage:true});
  // Map/Create and source browsing both reuse one route for a parent pair's
  // organizational, forward and reverse meanings, with the same solid style.
  for(const kind of ['map','source']){
    await page.goto(origin+'/#'+kind+'='+aMap.id);const host=page.locator(kind==='map'?'#world':'#reference-canvas');await page.locator(kind==='map'?'#all':'#reference-all').click();
    assert.deepEqual((await inspectPaths(host)).problems,[]);assert.equal(await host.locator('.counterpart-placeholder').count(),0,'Map/Create and ordinary source browsing do not acquire comparison ghosts');await arrows(host,'Alice');await highlight(host,ids.Alice.Socialists,ids.Alice['Membership survey']);await page.screenshot({path:`build/design-review/connections-${kind}-desktop.png`,fullPage:true});
  }
  // Additional branches stress the bounded fallback while retaining every
  // actual connection and leaving all saved source content untouched.
  await edit(store,bob,ws=>{const map=ws.maps.find(m=>m.id===bMap.id);for(let i=0;i<15;i++){const n=addNode(ws,bob,'Dense branch '+i);n.parent=i<9?'action':'goal';}synchronizeIdeas(ws,map);});
  await page.goto(origin+'/?dense=1#comparison='+thread.id);await canvas.locator('.node').first().waitFor();await expand();const dense=await inspectPaths(canvas);assert.equal(dense.count,31);assert.deepEqual(dense.problems,[]);await page.screenshot({path:'build/design-review/connections-dense-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await canvas.getByRole('button',{name:'Fit both maps',exact:true}).click();await page.screenshot({path:'build/design-review/connections-dense-mobile.png',fullPage:true});assert.deepEqual((await inspectPaths(canvas)).problems,[]);
  // Equal child counts and similar labels remain independent. Empty-map and
  // four-child TA fixtures exercise actual occupied group bounds at both sizes.
  for(const [label,aCount,bCount,frame]of [['five-vs-zero',5,0,'status'],['eight-vs-zero',8,0,'status'],['five-vs-eight',5,8,'status'],['four-vs-four-ta',4,4,'action']]){
    const maps=[];for(const [actor,count]of [[alice,aCount],[bob,bCount]])await edit(store,actor,ws=>{const map=createOwnedMap(ws,{name:actor.name+' '+label,ownerId:actor.id});map.visibility='shared';for(let i=0;i<count;i++)map.nodes.push({id:actor.name+'-'+label+'-'+i,parent:frame,title:'Independent statement '+(i+1),summary:'A separately authored position.',details:'',confidence:null,kind:'position',structuralType:'nesting',timeScope:'present',sourceTitle:'',sourceUrl:''});synchronizeIdeas(ws,map);maps.push(map);});
    const {comparisonThread:fixture}=await startAccountComparison(store,alice.id,{aMapId:maps[0].id,bMapId:maps[1].id});
    await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/?fixture='+label+'#comparison='+fixture.id);await canvas.locator('.node').first().waitFor();await expand();assert.equal(await canvas.locator('article.node:not(.root)').count(),aCount+bCount);assert.equal(await canvas.locator('.counterpart-placeholder').count(),aCount+bCount);assert.deepEqual((await inspectPaths(canvas)).problems,[]);
    await page.screenshot({path:`build/design-review/positioning-${label}-desktop.png`,fullPage:true});
    if(label==='five-vs-zero'){await options(async()=>{for(const side of ['a','b'])await page.locator('#compare-frame-'+side).selectOption('status');});await canvas.getByRole('button',{name:'Fit both maps',exact:true}).click();await zoomTo(canvas.locator('.comparison-canvas'),canvas.locator('.comparison-world'),1);await page.screenshot({path:'build/design-review/positioning-five-vs-zero-100pct-status-desktop.png',fullPage:true});}
    await page.setViewportSize({width:390,height:844});await canvas.getByRole('button',{name:'Fit both maps',exact:true}).click();await page.screenshot({path:`build/design-review/positioning-${label}-mobile.png`,fullPage:true});assert.deepEqual((await inspectPaths(canvas)).problems,[]);
    if(label==='five-vs-zero'){const initiating=canvas.locator('.counterpart-placeholder').first();await zoomTo(canvas.locator('.comparison-canvas'),canvas.locator('.comparison-world'),1);await initiating.getByRole('button',{name:'Link counterpart',exact:true}).focus();await page.keyboard.press('Enter');assert(await page.locator('#counterpart-node').isVisible());await page.screenshot({path:'build/design-review/positioning-ghost-inspected-100pct-mobile.png',fullPage:true});await close();
      await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/#map='+maps[0].id);await page.locator('#all').click();await zoomTo(page.locator('#viewport'),page.locator('#world'),1);await page.screenshot({path:'build/design-review/positioning-create-five-100pct-desktop.png',fullPage:true});}
    if(bCount){await edit(store,alice,ws=>ws.discussions.push(makeDiscussion(ws,{comparisonId:fixture.id,kind:'correspondence',action:'counterpart_link',target:{type:'node',mapId:maps[0].id,nodeId:maps[0].nodes.find(n=>n.parent!==null).id},other:{type:'node',mapId:maps[1].id,nodeId:maps[1].nodes.find(n=>n.parent!==null).id}},alice.id)));await page.reload();await canvas.locator('.node').first().waitFor();await expand();assert.equal(await canvas.locator('.counterpart-placeholder').count(),aCount+bCount-2);assert.deepEqual((await inspectPaths(canvas)).problems,[]);await page.screenshot({path:'build/design-review/positioning-linked-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});await canvas.getByRole('button',{name:'Fit both maps',exact:true}).click();await page.screenshot({path:'build/design-review/positioning-linked-desktop.png',fullPage:true});}
  }
  const final=(await view(store,alice)).workspace;assert.deepEqual(final.maps.find(m=>m.id===aMap.id),aMap,'All canvas inspections leave the owned source unchanged');assert.deepEqual(errors,[]);
  console.log('Source routing browser checks passed: screenshot siblings, stable camera/selection/modes, collapsed frames, one visible path and hit per pair, semantic direction on reused parent branches, opposite arrows, card avoidance, endpoint hover/focus/selection, saved request slot, deep/dense fixtures, reload and narrow screens across comparison, editor and source browsing.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
