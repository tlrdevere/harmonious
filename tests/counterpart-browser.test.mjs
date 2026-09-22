import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {validateAccountChanges} from '../worker/account-policy.mjs';
import {startAccountComparison} from '../worker/account-api.mjs';
import {synchronizeIdeas} from '../dist/adoption.mjs';

// Real browser interactions against the real account projection and write policy,
// using two isolated browser contexts and an in-memory database, never live data.
const playwright=process.env.HARMONIOUS_PLAYWRIGHT;
if(!playwright)throw Error('Set HARMONIOUS_PLAYWRIGHT to the installed playwright entry point.');
const {chromium}=await import(pathToFileURL(playwright));
const store=memoryStore();for(const actor of [alice,bob]){await seedActor(store,actor);await edit(store,actor,ws=>{const map=ws.maps.find(m=>m.ownerId===actor.id);map.name=actor.name+' worldview';map.visibility='shared';const n=addNode(ws,actor,actor.name+' position');map.relations.push({id:'illustration-'+actor.name,from:n.id,to:n.parent,type:'illustrative',note:''});if(actor===alice)addNode(ws,actor,'Alice extra');});}
const aData=await view(store,alice),aMap=aData.workspace.maps.find(m=>m.ownerId===alice.id),bMap=aData.workspace.maps.find(m=>m.ownerId===bob.id);
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'),actor=req.headers['x-test-actor']==='bob'?bob:alice;
    if(url.pathname.startsWith('/api/')){
      res.setHeader('content-type','application/json');let result;let body='';for await(const chunk of req)body+=chunk;const input=body?JSON.parse(body):null;
      if(url.pathname==='/api/session')result={configured:true,actor,signup:{mode:'public'}};
      else if(url.pathname==='/api/comparisons')result=await startAccountComparison(store,actor.id,input);
      else if(url.pathname==='/api/workspace'&&req.method==='PUT'){const snapshot=await store.snapshot(),accepted=validateAccountChanges(snapshot,actor.id,input.changes);result=await store.commit(actor.id,snapshot.revision,accepted);}
      else result={...await view(store,actor),actor};
      res.end(JSON.stringify(result));return;
    }
    const name=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!/^[a-z0-9.-]+$/.test(name)){res.writeHead(404);res.end();return;}
    let content=await readFile(resolve('dist',name),'utf8');if(name==='index.html')content=content.replace('src="./app.mjs"','src="./beta-boot.mjs"').replace('</head>','<link rel="stylesheet" href="./accounts.css"></head>');
    res.setHeader('content-type',name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'text/javascript');res.end(content);
  }catch(error){res.writeHead(error.status||500,{'content-type':'application/json'});res.end(JSON.stringify({error:error.message}));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:process.env.HARMONIOUS_BROWSER||'msedge'});const errors=[];
try{
  await mkdir('build/design-review',{recursive:true});
  const ac=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',extraHTTPHeaders:{'x-test-actor':'alice'}}),bc=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',extraHTTPHeaders:{'x-test-actor':'bob'}});
  const a=await ac.newPage(),b=await bc.newPage();for(const page of [a,b])page.on('pageerror',e=>errors.push(e.message));
  const saved=p=>p.waitForFunction(()=>document.getElementById('storage-status')?.textContent.includes('All changes saved'));
  const pop=p=>p.locator('.discussion-popover'),action=(p,name)=>pop(p).getByRole('button',{name,exact:true}).click();
  const expand=async p=>{await p.locator('.comparison-view-options>summary').click();await p.locator('#compare-all-a').click();await p.locator('#compare-all-b').click();await p.locator('.comparison-view-options>summary').click();await p.getByRole('button',{name:'Fit both maps',exact:true}).click();};
  const node=(p,name)=>p.locator('#compare-canvas .node-main').filter({has:p.getByText(name,{exact:true})}).click();
  const cp=(p,name)=>p.locator(`.counterpart-placeholder[aria-label="Counterpart spot for ${name}"]`);
  await a.goto(origin);await a.getByRole('button',{name:'Create comparison',exact:true}).click();await a.locator('#compare-map-a').selectOption(aMap.id);await a.locator('#compare-map-b').selectOption(bMap.id);await a.locator('#start-comparison').click();await a.locator('#workspace-message').filter({hasText:'Comparison saved'}).waitFor();const url=a.url();await expand(a);
  const aliceBefore=structuredClone((await view(store,alice)).workspace.maps.find(m=>m.id===aMap.id));
  await node(a,'Alice position');assert.equal(await cp(a,'Alice position').count(),1);await action(a,'Close');await a.getByRole('button',{name:'Fit both maps',exact:true}).click();
  await a.screenshot({path:'build/design-review/counterpart-empty.png',fullPage:true});
  await cp(a,'Alice position').getByRole('button',{name:'Request counterpart',exact:true}).click();await action(a,'Request counterpart');await action(a,'Send request');await saved(a);await action(a,'Close');
  await b.goto(url);await expand(b);assert.equal(await cp(b,'Alice position').count(),1,'Saved request retains its spot for the second account');
  await cp(b,'Alice position').getByRole('button',{name:'Add your counterpart',exact:true}).click();await action(b,'Create counterpart');await b.locator('#counterpart-node').selectOption('status');await b.locator('#counterpart-title').fill('Bob response');await b.locator('#counterpart-summary').fill('My independently authored counterpart.');
  b.once('dialog',d=>d.dismiss());await action(b,'Close');assert.equal(await b.locator('#counterpart-title').inputValue(),'Bob response','Declining discard preserves counterpart draft');
  await action(b,'Create and link counterpart');await saved(b);assert.match(await pop(b).innerText(),/Agreement has not been judged/);await action(b,'Close');
  let ws=(await view(store,bob)).workspace;const created=ws.maps.find(m=>m.id===bMap.id).nodes.find(n=>n.title==='Bob response');assert(created);assert.equal(created.parent,'status');assert.deepEqual(ws.maps.find(m=>m.id===aMap.id),aliceBefore);assert.equal(ws.discussions.filter(r=>r.kind==='relationship').length,0);
  await a.reload();await expand(a);assert.equal(await cp(a,'Alice position').count(),0);const box=async name=>a.locator('#compare-canvas .node').filter({has:a.getByText(name,{exact:true})}).boundingBox();const ab=await box('Alice position'),bb=await box('Bob response');assert(Math.abs(ab.y-bb.y)<1,'Explicit counterparts share a display row');
  await a.screenshot({path:'build/design-review/counterpart-linked.png',fullPage:true});
  await node(a,'Alice position');assert.equal(await pop(a).getByRole('button',{name:'Request counterpart',exact:true}).count(),0,'A linked node has no request action');await action(a,'Find or view counterpart');assert.equal(await pop(a).getByRole('button',{name:'Request counterpart',exact:true}).count(),0,'Counterpart chooser also hides the request');await action(a,'Close');
  // The illustrative connection and parent connection have one visible route.
  const checkEdges=async page=>{
    const pairs=await page.locator('path[data-node-pair]').evaluateAll(paths=>paths.filter(p=>getComputedStyle(p).display!=='none'&&getComputedStyle(p).visibility!=='hidden').map(p=>p.dataset.nodePair));assert.equal(new Set(pairs).size,pairs.length,'Exactly one visible edge per displayed node pair');assert.equal(await page.locator('.comparison-link,.comparison-link-hit').count(),0,'Older and selected-pair paths do not leak through the combined layer');
    const geometry=await page.locator('#compare-canvas').evaluate(canvas=>{
      const cards=[...canvas.querySelectorAll('.node,.counterpart-placeholder')].filter(el=>!el.hidden).map(el=>el.getBoundingClientRect()),paths=[...canvas.querySelectorAll('.discussion-relationship')].filter(p=>p.getAttribute('d')),badges=[...canvas.querySelectorAll('.discussion-badge')].filter(el=>!el.hidden),failures=[];
      const samples=paths.map(path=>{const points=[],length=path.getTotalLength(),matrix=path.getScreenCTM();for(let at=0;at<=length;at+=1){const p=path.getPointAtLength(at),screen=new DOMPoint(p.x,p.y).matrixTransform(matrix);points.push(screen);for(const r of cards)if(screen.x>r.left+.5&&screen.x<r.right-.5&&screen.y>r.top+.5&&screen.y<r.bottom-.5)failures.push('Relationship enters a visible card.');}return points;});
      for(const badge of badges){const r=badge.getBoundingClientRect(),cx=r.x+r.width/2,cy=r.y+r.height/2;for(const card of cards)if(r.left<card.right-.5&&r.right>card.left+.5&&r.top<card.bottom-.5&&r.bottom>card.top+.5)failures.push('Relationship label covers a visible card.');if(!samples.some(points=>points.some(p=>Math.hypot(p.x-cx,p.y-cy)<1.5)))failures.push('Relationship label floats away from its route.');}
      const hits=[...canvas.querySelectorAll('.discussion-relationship-hit')];if(hits.length!==paths.length||hits.some((hit,i)=>hit.getAttribute('d')!==paths[i].getAttribute('d')))failures.push('Every relationship needs its matching keyboard/click target.');
      return [...new Set(failures)];
    });assert.deepEqual(geometry,[]);
  };
  // A stance belongs to the selected statement; it does not create or remove its counterpart link.
  await checkEdges(a);await node(b,'Alice position');await action(b,'Endorse');await action(b,'Record position');await pop(b).getByRole('button',{name:'Edit',exact:true}).waitFor();await saved(b);await action(b,'Close');
  await a.reload();await expand(a);await checkEdges(a);assert.equal(await a.locator('.discussion-relationship').count(),1,'Counterpart plus endorsement retain one counterpart edge');
  const endorsed=((await view(store,alice)).workspace.discussions).find(r=>r.kind==='interaction'&&r.action==='endorse');assert.equal(endorsed.authorId,bob.id);await a.getByRole('button',{name:'Conversations',exact:true}).click();await pop(a).locator(`[data-entry="${endorsed.id}"]`).click();assert.match(await pop(a).innerText(),/Endorse[\s\S]*Bob/);await action(a,'Close');
  const beforeStanceMaps=structuredClone((await view(store,alice)).workspace.maps);
  for(const stance of ['Disagree','No position']){await node(a,'Bob response');await action(a,stance);await action(a,'Record position');await pop(a).getByRole('button',{name:'Edit',exact:true}).waitFor();await saved(a);await action(a,'Close');await checkEdges(a);assert.equal(await a.locator('.discussion-relationship').count(),1);assert.equal(await cp(a,'Alice position').count(),0,'A new stance does not remove the counterpart');}
  ws=(await view(store,alice)).workspace;assert.deepEqual(ws.maps,beforeStanceMaps,'Minimal stances do not adopt, revise or delete either map');assert.deepEqual(ws.discussions.filter(r=>r.kind==='interaction').map(r=>r.action).sort(),['decline','disagree','endorse']);assert.equal(ws.discussions.filter(r=>r.kind==='relationship').length,0,'Compare stances do not recreate retired paired judgments');assert.equal(ws.discussions.filter(r=>r.kind==='correspondence').length,1);await a.getByRole('button',{name:'Fit both maps',exact:true}).click();await a.screenshot({path:'build/design-review/single-edge-comparison.png',fullPage:true});

  await node(a,'Alice extra');await action(a,'Request counterpart');await action(a,'Send request');await saved(a);await action(a,'Close');
  await b.reload();await expand(b);await cp(b,'Alice extra').getByRole('button',{name:'Add your counterpart',exact:true}).click();await action(b,'Open request');await action(b,'No position yet');await b.locator('#discussion-body').fill('I have not formed a position on this yet.');await action(b,'No position yet');await saved(b);await action(b,'Close');
  await a.reload();await expand(a);assert.equal(await cp(a,'Alice extra').count(),0);await a.getByRole('button',{name:'No position yet',exact:true}).click();await action(a,'Reopen request');await a.locator('#discussion-body').fill('You mentioned an existing node that might fit.');await action(a,'Reopen request');await saved(a);await action(a,'Close');
  await b.reload();await expand(b);await cp(b,'Alice extra').getByRole('button',{name:'Add your counterpart',exact:true}).click();await action(b,'Choose existing node');const existing=bMap.nodes.find(n=>n.title==='Bob position');await b.locator('#counterpart-node').selectOption(existing.id);await action(b,'Link counterpart');await saved(b);await action(b,'Close');
  ws=(await view(store,alice)).workspace;assert.equal(ws.discussions.filter(r=>r.kind==='correspondence').length,2);assert.equal(ws.maps.find(m=>m.id===bMap.id).nodes.filter(n=>n.parent!==null).length,2,'Choosing a node does not create a duplicate');
  await b.setViewportSize({width:390,height:844});await node(b,'Alice extra');await action(b,'Find or view counterpart');await action(b,'Create counterpart');await b.locator('#counterpart-title').fill('Mobile draft');assert(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const rect=await pop(b).boundingBox();assert(rect.x>=0&&rect.x+rect.width<=390);await b.screenshot({path:'build/design-review/counterpart-mobile.png',fullPage:true});b.once('dialog',d=>d.accept());await action(b,'Close');
  await b.setViewportSize({width:1440,height:1000});await b.reload();await expand(b);await b.locator('.comparison-view-options>summary').click();await b.locator('#compare-collapse-b').click();await b.locator('.comparison-view-options>summary').click();await b.getByRole('button',{name:'Fit both maps',exact:true}).click();await checkEdges(b);
  await b.screenshot({path:'build/design-review/comparison-asymmetric-collapse.png',fullPage:true});
  const relationshipHit=b.locator('.discussion-relationship-hit').first();await relationshipHit.focus();await b.keyboard.press('Enter');assert(await pop(b).isVisible(),'A routed relationship is still keyboard accessible');await action(b,'Close');
  const mousePoint=await relationshipHit.evaluate(path=>{const matrix=path.getScreenCTM();for(let i=1;i<100;i++){const p=path.getPointAtLength(path.getTotalLength()*i/100),screen=new DOMPoint(p.x,p.y).matrixTransform(matrix);if(document.elementFromPoint(screen.x,screen.y)===path)return {x:screen.x,y:screen.y};}return null;});assert(mousePoint,'A relationship has a clickable segment outside its cards and label');await b.mouse.click(mousePoint.x,mousePoint.y);assert(await pop(b).isVisible());await action(b,'Close');
  await b.setViewportSize({width:390,height:844});await b.getByRole('button',{name:'Fit both maps',exact:true}).click();await checkEdges(b);await b.screenshot({path:'build/design-review/comparison-asymmetric-collapse-mobile.png',fullPage:true});
  await b.setViewportSize({width:1440,height:1000});await b.locator('.comparison-view-options>summary').click();await b.locator('#compare-collapse-a').click();await b.locator('.comparison-view-options>summary').click();await b.getByRole('button',{name:'Fit both maps',exact:true}).click();await checkEdges(b);assert.equal(await b.locator('.discussion-relationship').count(),1,'Collapsed pairs consolidate onto one visible frame-to-frame connection');
  assert.deepEqual(errors,[]);console.log('Counterpart browser checks passed: persistent empty spots, create in own map, choose existing, no implied agreement, independent Endorse/Disagree/No position stances, decline/reopen, counterpart geometry, draft protection and mobile.');
}catch(error){for(const [i,context]of browser.contexts().entries())for(const page of context.pages()){await page.screenshot({path:`build/design-review/counterpart-failure-${i}.png`,fullPage:true});console.error((await page.locator('body').innerText()).slice(-3500));}console.error(errors);throw error;}finally{await browser.close();await new Promise(r=>server.close(r));}
