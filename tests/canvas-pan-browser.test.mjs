import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {validateAccountChanges} from '../worker/account-policy.mjs';
import {startAccountComparison} from '../worker/account-api.mjs';
import {synchronizeIdeas} from '../dist/adoption.mjs';

if(!process.env.HARMONIOUS_PLAYWRIGHT)throw Error('Set HARMONIOUS_PLAYWRIGHT.');
const {chromium}=await import(pathToFileURL(process.env.HARMONIOUS_PLAYWRIGHT));
const store=memoryStore();
for(const actor of [alice,bob]){await seedActor(store,actor);await edit(store,actor,w=>{const m=w.maps.find(m=>m.ownerId===actor.id);m.visibility='shared';m.name=actor.name+' pan map';const n=addNode(w,actor,actor.name+' pan position');n.kind='position';n.parent='status';n.summary='A selectable description for the canvas pan regression.';synchronizeIdeas(w,m);});}
const data=await view(store,alice),aMap=data.workspace.maps.find(m=>m.ownerId===alice.id),bMap=data.workspace.maps.find(m=>m.ownerId===bob.id),claim=aMap.nodes.find(n=>n.title==='Alice pan position');
const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){res.setHeader('content-type','application/json');let raw='';for await(const chunk of req)raw+=chunk;const input=raw?JSON.parse(raw):null;let result;
    if(url.pathname==='/api/session')result={configured:true,actor:alice,signup:{mode:'public'}};
    else if(url.pathname==='/api/comparisons')result=await startAccountComparison(store,alice.id,input);
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
  await mkdir('build/design-review',{recursive:true});
  await page.addInitScript(()=>{window.panEvents=[];for(const type of ['pointerdown','selectstart','dragstart','pointercancel','lostpointercapture'])document.addEventListener(type,e=>window.panEvents.push({type,pointerId:e.pointerId}),true);});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const camera=world=>page.locator(world).evaluate(el=>{const m=new DOMMatrix(el.style.transform);return {x:m.e,y:m.f,z:m.a};});
  const selection=()=>page.evaluate(()=>{const s=getSelection();return {text:s.toString(),anchor:s.anchorOffset,focus:s.focusOffset,ranges:s.rangeCount};});
  const resetEvents=()=>page.evaluate(()=>window.panEvents=[]);
  const blank=surface=>page.locator(surface).evaluate(el=>{const r=el.getBoundingClientRect();for(let y=r.top+25;y<Math.min(innerHeight-70,r.bottom-70);y+=25)for(let x=r.left+25;x<Math.min(innerWidth-70,r.right-70);x+=25){const t=document.elementFromPoint(x,y);if(el.contains(t)&&!t.closest('button,.node,.node-face-editor,.counterpart-placeholder,.comparison-link-hit,.discussion-edge-hit,input,select,textarea,a'))return {x,y};}throw Error('No blank canvas point.');});
  const moved=(before,after,dx,dy,message)=>{assert(Math.abs(after.x-before.x-dx)<1&&Math.abs(after.y-before.y-dy)<1,message+': '+JSON.stringify({before,after,dx,dy}));assert.equal(after.z,before.z,message+' keeps zoom');};
  const resetView=async fit=>{await fit.click();await settle();};
  const drag=async({surface,world,name,fit},selected)=>{
    await resetView(fit);
    // A Range only prepares existing browser selection. The gesture itself uses
    // genuine mouse input: the previous bug produced native dragstart/cancel.
    await page.evaluate(({selected,surface})=>{const s=getSelection();s.removeAllRanges();if(selected){const r=document.createRange(),node=selected==='hint'?document.querySelector(surface).querySelector('.comparison-canvas-hint'):document.querySelector('.brand span');r.selectNodeContents(node);s.addRange(r);}},{selected,surface});
    const start=selected==='hint'?await page.locator(surface+' .comparison-canvas-hint').evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x+30,y:r.y+r.height/2};}):await blank(surface);
    const before=await camera(world),selectionBefore=await selection(),end={x:Math.min(start.x+450,1400),y:45};
    const cardBox=await page.locator(surface+' .node').first().boundingBox();await resetEvents();
    await page.mouse.move(start.x,start.y);await page.mouse.down();
    assert(await page.locator(surface).evaluate(el=>document.activeElement===el),name+' focuses its surface for subsequent keyboard panning');
    // Continue over an on-screen card location, then leave the canvas while held.
    if(cardBox&&cardBox.x>0&&cardBox.y>0&&cardBox.x+cardBox.width<1400&&cardBox.y+cardBox.height<1000){const p={x:cardBox.x+cardBox.width/2,y:cardBox.y+cardBox.height/2};await page.mouse.move(p.x,p.y,{steps:6});moved(before,await camera(world),p.x-start.x,p.y-start.y,name+' follows the mouse across the map');}
    await page.mouse.move(end.x,end.y,{steps:12});await page.mouse.up();
    moved(before,await camera(world),end.x-start.x,end.y-start.y,name+' continues outside the surface without native text dragging');
    assert.deepEqual(await selection(),selectionBefore,name+' does not create, replace, or extend browser text selection');
    assert.deepEqual(await page.evaluate(()=>window.panEvents.filter(e=>['selectstart','dragstart','pointercancel'].includes(e.type))),[],name+' keeps the browser from taking over its mouse gesture');
    const released=await camera(world);await page.mouse.move(end.x+35,end.y+20);assert.deepEqual(await camera(world),released,name+' stops on mouse release outside the surface');
    await page.keyboard.press('ArrowRight');assert.notEqual((await camera(world)).x,released.x,name+' retains keyboard panning after mouse panning');
  };
  const interrupt=async(config,type)=>{
    const {surface,world,name,fit}=config;await resetView(fit);const start=await blank(surface);await page.evaluate(()=>getSelection().removeAllRanges());await resetEvents();await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+20,start.y+20,{steps:3});
    const atInterrupt=await camera(world);
    await page.locator(surface).evaluate((el,type)=>{const pointerId=window.panEvents.findLast(e=>e.type==='pointerdown').pointerId;if(type==='capture')el.releasePointerCapture(pointerId);else if(type==='blur')window.dispatchEvent(new Event('blur'));else el.dispatchEvent(new PointerEvent(type==='cancel'?'pointercancel':'pointermove',{pointerId,pointerType:'mouse',buttons:0,bubbles:true}));},type);
    await page.mouse.move(start.x+90,start.y+75,{steps:6});await page.mouse.up();assert.deepEqual(await camera(world),atInterrupt,name+' stops after '+type);
    await drag(config,false);
  };
  const checkControls=async config=>{await resetView(config.fit);const before=await camera(config.world);await page.locator(config.surface).getByRole('button',{name:'Zoom in',exact:true}).click();assert((await camera(config.world)).z>before.z,config.name+' zoom control still works after panning');await resetView(config.fit);};
  const editor={surface:'#viewport',world:'#world',name:'Create/edit map',fit:page.locator('#fit')};
  await page.goto(origin+'/#map='+aMap.id);await page.locator('#all').click();await drag(editor,false);await drag(editor,'outside');for(const type of ['capture','cancel','blur','buttons'])await interrupt(editor,type);await checkControls(editor);
  // Selecting and replacing text on the node face remains a native editing
  // gesture, and clicking its controls must not move the canvas.
  await page.locator(`#cards .node[data-id="${claim.id}"] .node-main`).click();await page.locator('.on-map-actions').getByRole('button',{name:'Edit',exact:true}).click();
  const input=page.locator('#summary');await input.scrollIntoViewIfNeeded();const editingCamera=await camera('#world'),box=await input.boundingBox();
  await page.mouse.move(box.x+12,box.y+20);await page.mouse.down();await page.mouse.move(box.x+150,box.y+20,{steps:12});await page.mouse.up();
  assert(await input.evaluate(el=>el.selectionEnd>el.selectionStart),'Dragging in the node textarea selects text');assert.deepEqual(await camera('#world'),editingCamera,'Text selection inside a node never pans the canvas');
  await page.keyboard.type('Edited selection ');await page.locator('#edit-form').getByRole('button',{name:'Save changes',exact:true}).click();await page.waitForFunction(()=>document.getElementById('storage-status').textContent.includes('All changes saved'));assert.match((await view(store,alice)).workspace.maps.find(m=>m.id===aMap.id).nodes.find(n=>n.id===claim.id).summary,/Edited selection/);
  await page.locator('#node-face-editor .node-face-done').click();await page.locator('.brand span').dblclick();assert.match((await selection()).text,/Harmonious/,'Ordinary page text remains selectable after a gesture ends');
  const source={surface:'#reference-canvas .comparison-canvas',world:'#reference-canvas .comparison-world',name:'Source reader',fit:page.locator('#reference-canvas').getByRole('button',{name:'Fit map',exact:true})};
  await page.goto(origin+'/#source='+aMap.id);await page.locator('#reference-all').click();for(const selected of [false,'outside','hint'])await drag(source,selected);await interrupt(source,'capture');await checkControls(source);
  // Browser-delivered touch events also retain the existing two-pointer zoom.
  const touch=await context.newCDPSession(page),touchStart=await blank(source.surface),touchBefore=await camera(source.world),point=(id,x)=>({id,x,y:touchStart.y,radiusX:1,radiusY:1,force:1});
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(1,touchStart.x),point(2,touchStart.x+80)]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(1,touchStart.x),point(2,touchStart.x+120)]});
  assert((await camera(source.world)).z>touchBefore.z,'Touch pinch still zooms the canvas');await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();
  await page.goto(origin);await page.getByRole('button',{name:'Create comparison',exact:true}).click();await page.locator('#compare-map-a').selectOption(aMap.id);await page.locator('#compare-map-b').selectOption(bMap.id);await page.locator('#start-comparison').click();await page.locator('#workspace-message').filter({hasText:'Comparison saved'}).waitFor();
  await page.locator('.comparison-view-options>summary').click();for(const side of ['a','b'])await page.locator('#compare-all-'+side).click();await page.locator('.comparison-view-options>summary').click();
  const beforeShared=JSON.stringify((await view(store,alice)).workspace);
  for(const [mode,interruption] of [['inquiry','cancel'],['compare','blur'],['argument','buttons']]){
    await page.locator('#reasoning-'+mode+'-mode').click();const shared={surface:'#compare-canvas .comparison-canvas',world:'#compare-canvas .comparison-world',name:mode,fit:page.getByRole('button',{name:'Fit both maps',exact:true})};
    for(const selected of [false,'outside','hint'])await drag(shared,selected);await interrupt(shared,interruption);await checkControls(shared);
  }
  assert.equal(JSON.stringify((await view(store,alice)).workspace),beforeShared,'Canvas navigation does not write shared map or conversation data');
  await page.goto(pathToFileURL(resolve('review/Harmonious-radial.html')).href);await page.locator('#library-results .library-card').first().waitFor();await page.getByRole('button',{name:'Open map',exact:true}).first().click();await page.locator('#all').click();await drag({...editor,name:'Portable map'},'outside');
  assert.deepEqual(errors,[]);
  console.log('Canvas pan browser checks passed: genuine mouse drags, pre-existing selection/native-drag regression, card crossings and outside release, interruption cleanup, keyboard/zoom controls, textarea editing, touch pinch, all five canvas views, and portable export.');
}catch(error){for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:'build/design-review/canvas-pan-failure.png',fullPage:true});throw error;}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
