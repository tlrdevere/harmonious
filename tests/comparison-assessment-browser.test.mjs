import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {validateAccountChanges} from '../worker/account-policy.mjs';
import {startAccountComparison} from '../worker/account-api.mjs';
import {synchronizeIdeas} from '../dist/adoption.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';

if(!process.env.HARMONIOUS_PLAYWRIGHT)throw Error('Set HARMONIOUS_PLAYWRIGHT.');
const {chromium}=await import(pathToFileURL(process.env.HARMONIOUS_PLAYWRIGHT)),store=memoryStore(),errors=[];
for(const actor of [alice,bob]){await seedActor(store,actor);await edit(store,actor,ws=>{const map=ws.maps.find(m=>m.ownerId===actor.id);map.visibility='shared';map.name=actor.name+' assessment map';const n=addNode(ws,actor,actor.name+' position about participation in local decisions');Object.assign(n,{kind:'position',summary:'People need reliable information and meaningful opportunities to shape decisions in their community.',confidence:65});synchronizeIdeas(ws,map);});}
let ws=(await view(store,alice)).workspace;const am=ws.maps.find(m=>m.ownerId===alice.id),bm=ws.maps.find(m=>m.ownerId===bob.id),an=am.nodes.find(n=>n.parent!==null),bn=bm.nodes.find(n=>n.parent!==null),at={type:'node',mapId:am.id,nodeId:an.id},bt={type:'node',mapId:bm.id,nodeId:bn.id};
const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:am.id,bMapId:bm.id});
await edit(store,alice,ws=>ws.discussions.push(makeDiscussion(ws,{comparisonId:thread.id,kind:'correspondence',action:'counterpart_link',target:at,other:bt},alice.id)));
const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost'),actor=req.headers['x-test-actor']==='bob'?bob:alice;
  if(url.pathname.startsWith('/api/')){let raw='';for await(const part of req)raw+=part;const input=raw?JSON.parse(raw):null;let value;
    if(url.pathname==='/api/session')value={configured:true,actor,signup:{mode:'public'}};
    else if(url.pathname==='/api/comparisons')value=await startAccountComparison(store,actor.id,input);
    else if(url.pathname==='/api/workspace'&&req.method==='PUT'){const snapshot=await store.snapshot();value=await store.commit(actor.id,snapshot.revision,validateAccountChanges(snapshot,actor.id,input.changes));}
    else value={...await view(store,actor),actor};res.setHeader('content-type','application/json');res.end(JSON.stringify(value));return;
  }
  const name=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!/^[a-z0-9.-]+$/.test(name)){res.writeHead(404);res.end();return;}
  let content=await readFile(resolve('dist',name),'utf8');if(name==='index.html')content=content.replace('src="./app.mjs"','src="./beta-boot.mjs"').replace('</head>','<link rel="stylesheet" href="./accounts.css"></head>');res.setHeader('content-type',name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'text/javascript');res.end(content);
}catch(error){res.writeHead(error.status||500,{'content-type':'application/json'});res.end(JSON.stringify({error:error.message}));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true,channel:process.env.HARMONIOUS_BROWSER||'msedge'});
try{
  await mkdir('build/design-review',{recursive:true});
  const ac=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',extraHTTPHeaders:{'x-test-actor':'alice'}}),bc=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',extraHTTPHeaders:{'x-test-actor':'bob'}}),a=await ac.newPage(),b=await bc.newPage();for(const page of [a,b]){page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);}
  const card=(p,id)=>p.locator(`#compare-canvas .node[data-node-id="${id}"]`),badge=(p,id)=>card(p,id).locator('.node-assessment'),pop=p=>p.locator('.discussion-popover');
  const close=async p=>{if(await pop(p).isVisible())await pop(p).getByRole('button',{name:'Close',exact:true}).click();};
  const activate=async(p,locator)=>{await locator.focus();await p.keyboard.press('Enter');};
  let visits=0;const load=async p=>{await p.goto(origin+'/?visit='+(++visits)+'#comparison='+thread.id);await p.locator('.comparison-view-options>summary').click();for(const side of ['a','b'])await p.locator('#compare-all-'+side).click();await p.locator('.comparison-view-options>summary').click();await p.getByRole('button',{name:'Fit both maps',exact:true}).click();};
  const record=async(p,id,label)=>{await close(p);await p.locator('#reasoning-compare-mode').click();await activate(p,card(p,id).locator('.node-main'));await pop(p).getByRole('button',{name:label,exact:true}).click();await pop(p).getByRole('button',{name:'Record position',exact:true}).click();await pop(p).getByRole('button',{name:'Edit',exact:true}).waitFor();await p.waitForFunction(()=>document.getElementById('storage-status').textContent.includes('All changes saved'));await close(p);};
  const checks=async p=>{const issues=await p.locator('#compare-canvas').evaluate(host=>{const issues=[];for(const card of host.querySelectorAll('.node.has-assessment')){const r=card.getBoundingClientRect();if(card.offsetWidth!==252||card.offsetHeight!==166)issues.push('Assessment changed the real card size');for(const child of card.querySelectorAll('.node-assessments,.node-assessment,.pair-assessment,.node-bottom button')){const c=child.getBoundingClientRect();if(c.left<r.left-.5||c.right>r.right+.5||c.top<r.top-.5||c.bottom>r.bottom+.5)issues.push('Assessment or card control clips outside its card');}const main=card.querySelector('.node-main').getBoundingClientRect(),row=card.querySelector('.node-assessments').getBoundingClientRect(),bottom=card.querySelector('.node-bottom').getBoundingClientRect();if(main.bottom>row.top+.5||row.bottom>bottom.top+.5)issues.push('The assessment row overlaps wording or confidence');}return issues;});assert.deepEqual(issues,[]);};
  const centerPair=async(p,zoom=1,only=null)=>{const surface=p.locator('#compare-canvas .comparison-canvas'),world=p.locator('#compare-canvas .comparison-world'),rect=await surface.boundingBox(),delta=await world.evaluate((el,z)=>-Math.log(z/new DOMMatrix(el.style.transform).a)/.0015,zoom);await surface.dispatchEvent('wheel',{deltaY:delta,clientX:rect.x+rect.width/2,clientY:rect.y+rect.height/2});const boxes=await Promise.all((only?[only]:[an.id,bn.id]).map(id=>card(p,id).boundingBox())),dx=boxes.reduce((sum,r)=>sum+r.x+r.width/2,0)/boxes.length-rect.x-rect.width/2,dy=boxes.reduce((sum,r)=>sum+r.y+r.height/2,0)/boxes.length-rect.y-rect.height/2;await surface.focus();for(const [d,negative,positive]of [[dx,'ArrowLeft','ArrowRight'],[dy,'ArrowUp','ArrowDown']])for(let i=0;i<Math.round(Math.abs(d)/60);i++)await p.keyboard.press(d<0?negative:positive);};
  await load(a);await load(b);assert.equal(await a.locator('.node-assessment[data-assessment="unassessed"]').count(),2);assert.equal(await a.locator('.pair-assessment').count(),0);assert.match(await badge(a,an.id).innerText(),/Bob: Not assessed/);assert.match(await badge(a,bn.id).innerText(),/You: Not assessed/);
  await activate(a,badge(a,bn.id));assert(await pop(a).getByRole('button',{name:'Agree',exact:true}).isVisible(),'An unassessed personal badge opens the assessment actions');await close(a);
  await record(a,bn.id,'Agree');assert.equal(await badge(a,bn.id).getAttribute('data-assessment'),'agree');assert.equal(await a.locator('.pair-assessment').count(),0,'One personal agreement is not a mutual agreement');
  await load(b);await record(b,an.id,'Agree');await load(a);assert.equal(await a.locator('.pair-assessment[data-pair-assessment="agree"]').count(),2);assert.equal(await a.locator('.discussion-relationship[data-pair-assessment="agree"]').count(),1);assert.match(await badge(a,an.id).innerText(),/Bob: Agree/);await checks(a);
  await centerPair(a);await a.screenshot({path:'build/design-review/assessment-mutual-agree-100pct-desktop.png',fullPage:true});
  const pair=a.locator('.agreement-pair'),marker=a.locator('.agreement-marker');
  assert.equal(await pair.getAttribute('data-state'),'agree','Mutual agreement creates one joined display');
  assert.equal(await a.locator('.node.agreement-half-a,.node.agreement-half-b').count(),2);
  const originalPositions=await a.locator('#compare-canvas .node').evaluateAll(cards=>cards.map(c=>[c.dataset.nodeId,c.style.transform]));
  await pair.locator('.agreement-band').click();await pop(a).waitFor();assert.match(await pop(a).innerText(),/Both agree/);await a.keyboard.press('Escape');
  assert(await pair.locator('.agreement-band').evaluate(el=>el===document.activeElement),'Pair detail closes to its visible band');
  for(const zoom of [1,.75,.5,.25,.1,.02,.5,.6]){
    await centerPair(a,zoom);
    assert.deepEqual(await a.locator('#compare-canvas .node').evaluateAll(cards=>cards.map(c=>[c.dataset.nodeId,c.style.transform])),originalPositions,'Zoom never changes source coordinates');
    const overview=await a.locator('#compare-canvas .comparison-canvas').evaluate(el=>el.classList.contains('agreement-overview'));
    if(zoom<=.25)assert(overview);if(zoom>=.6)assert(!overview);
    if(overview){
      if(zoom===.25)assert(await marker.isVisible(),'A centered pair has a readable overview marker at 25%');
      if(await marker.isVisible())for(const button of await marker.locator('.agreement-marker-node').all()){const r=await button.boundingBox();assert(r.width>=44&&r.height>=44,'Overview node targets keep a minimum screen size');assert(await button.getAttribute('aria-label'));}
      else assert(await a.locator('.agreement-overflow').isVisible(),'Pairs too close to other nodes remain available without overlapping targets');
    }
    if([.5,.25,.1].includes(zoom))await a.screenshot({path:`build/design-review/agreement-overview-${Math.round(zoom*100)}.png`,fullPage:true});
  }
  await centerPair(a,.25);
  const half=marker.locator('.agreement-marker-node').first(),label=await half.getAttribute('aria-label');
  await half.click();await pop(a).waitFor();assert(label.includes(await pop(a).locator('header strong').innerText()),'Each overview half opens its original node');await a.keyboard.press('Escape');
  assert(await marker.locator('.agreement-marker-node').first().evaluate(el=>el===document.activeElement),'Overview node focus returns after inspection');
  await marker.locator('.agreement-marker-label').click();await pop(a).waitFor();await a.keyboard.press('Escape');assert(await marker.locator('.agreement-marker-label').evaluate(el=>el===document.activeElement));
  await centerPair(a);
  await activate(a,badge(a,an.id));assert.match(await pop(a).innerText(),/Agree[\s\S]*Bob/);assert.equal(await pop(a).getByRole('button',{name:'Edit',exact:true}).count(),0,'A partner assessment opens their record without edit permission');await a.keyboard.press('Escape');assert(await badge(a,an.id).evaluate(el=>el===document.activeElement),'Closing keyboard inspection returns to the assessment badge');
  for(const mode of ['inquiry','argument','compare']){await a.locator('#reasoning-'+mode+'-mode').click();assert.equal(await a.locator('.pair-assessment[data-pair-assessment="agree"]').count(),2);await checks(a);}
  await a.setViewportSize({width:390,height:844});await centerPair(a,.6);await checks(a);assert(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await a.screenshot({path:'build/design-review/assessment-mutual-agree-mobile.png',fullPage:true});await centerPair(a,1,bn.id);await checks(a);await a.screenshot({path:'build/design-review/assessment-own-100pct-mobile.png',fullPage:true});await badge(a,bn.id).click();const detail=await pop(a).boundingBox();assert(detail.x>=0&&detail.x+detail.width<=391,'Badge inspection remains inside a narrow viewport');await a.screenshot({path:'build/design-review/assessment-detail-mobile.png',fullPage:true});await close(a);await a.setViewportSize({width:1440,height:1000});
  await record(a,bn.id,'Disagree');assert.equal(await a.locator('.pair-assessment').count(),0,'Asymmetric stances remove mutual status');await load(b);await record(b,an.id,'Disagree');await load(a);assert.equal(await a.locator('.pair-assessment[data-pair-assessment="disagree"]').count(),2);assert.equal(await a.locator('.discussion-relationship[data-pair-assessment="disagree"]').count(),1);await centerPair(a);await a.screenshot({path:'build/design-review/assessment-mutual-disagree-desktop.png',fullPage:true});
  await record(a,bn.id,'No position');assert.equal(await badge(a,bn.id).getAttribute('data-assessment'),'no-position');assert.equal(await a.locator('.pair-assessment').count(),0);await activate(a,badge(a,bn.id));a.once('dialog',dialog=>dialog.accept());await pop(a).getByRole('button',{name:'Withdraw',exact:true}).click();await badge(a,bn.id).filter({hasText:'Not assessed'}).waitFor();assert.equal(await badge(a,bn.id).getAttribute('data-assessment'),'unassessed','Withdrawing latest No position does not resurrect earlier Disagree/Agree');
  await record(a,bn.id,'Disagree');await edit(store,bob,workspace=>{const map=workspace.maps.find(m=>m.id===bm.id);map.nodes.find(n=>n.id===bn.id).summary+=' Revised wording.';synchronizeIdeas(workspace,map);});await load(a);assert(await badge(a,bn.id).evaluate(el=>el.classList.contains('needs-review')));assert.match(await badge(a,bn.id).getAttribute('aria-label'),/review needed/);assert.equal(await a.locator('.pair-assessment').count(),0,'Stale source wording suppresses mutual status');await activate(a,badge(a,bn.id));assert.match(await pop(a).innerText(),/Source changed/);await close(a);await record(a,bn.id,'Disagree');assert.equal(await a.locator('.pair-assessment[data-pair-assessment="disagree"]').count(),2);
  await activate(a,card(a,an.id).locator('.node-main'));a.once('dialog',dialog=>dialog.accept());await pop(a).getByRole('button',{name:'Unlink counterpart',exact:true}).click();await a.locator('.counterpart-placeholder').first().waitFor();assert.equal(await a.locator('.pair-assessment').count(),0);assert.equal(await a.locator('.node-assessment[data-assessment="disagree"]').count(),2,'Unlinking retains both personal assessments');assert.equal(await a.locator('.discussion-relationship[data-pair-assessment]').count(),0);await checks(a);
  await load(b);assert.equal(await b.locator('.pair-assessment').count(),0);assert.equal(await b.locator('.node-assessment[data-assessment="disagree"]').count(),2,'The other account sees the same independent assessments after unlink');assert.deepEqual(errors,[]);
  // Dense, mixed-status map: derived displays may not change any source record.
  const nodes={alice:[],bob:[]},actions=[['endorse','endorse'],['disagree','disagree'],['endorse','disagree'],['decline','decline'],['endorse',null],['decline','endorse']];
  for(const actor of [alice,bob])await edit(store,actor,workspace=>{
    for(let i=0;i<24;i++){const node=addNode(workspace,actor,`Overview ${i} by ${actor.name}`);node.kind='position';node.summary=`${actor.name}'s distinct wording for overview pair ${i}.`;node.confidence=actor===alice?35:80;nodes[actor===alice?'alice':'bob'].push(node.id);}
    synchronizeIdeas(workspace,workspace.maps.find(m=>m.ownerId===actor.id));
  });
  await edit(store,alice,workspace=>{for(let i=0;i<24;i++){
    const left={type:'node',mapId:am.id,nodeId:nodes.alice[i]},right={type:'node',mapId:bm.id,nodeId:nodes.bob[i]};
    workspace.discussions.push(makeDiscussion(workspace,{comparisonId:thread.id,kind:'correspondence',action:'counterpart_link',target:left,other:right},alice.id));
    if(actions[i%6][0])workspace.discussions.push(makeDiscussion(workspace,{comparisonId:thread.id,kind:'interaction',mode:'compare',action:actions[i%6][0],target:right},alice.id));
  }});
  await edit(store,bob,workspace=>{for(let i=0;i<24;i++)if(actions[i%6][1])workspace.discussions.push(makeDiscussion(workspace,{comparisonId:thread.id,kind:'interaction',mode:'compare',action:actions[i%6][1],target:{type:'node',mapId:am.id,nodeId:nodes.alice[i]}},bob.id));});
  await edit(store,bob,workspace=>{const map=workspace.maps.find(m=>m.id===bm.id);map.nodes.find(n=>n.id===nodes.bob[23]).summary+=' Later revision.';synchronizeIdeas(workspace,map);});
  const sourceBefore=JSON.stringify((await view(store,alice)).workspace.maps);
  await load(a);
  for(const [state,count]of [['agree',4],['disagree',4],['mixed',7],['no-position',4],['unassessed',4],['review',1]])assert.equal(await a.locator(`.agreement-pair[data-state="${state}"]`).count(),count);
  for(const mode of ['inquiry','argument','compare']){await a.locator('#reasoning-'+mode+'-mode').click();assert.equal(await a.locator('.agreement-pair').count(),24);}
  await a.getByRole('button',{name:'Fit both maps',exact:true}).click();
  const markers=a.locator('.agreement-marker:visible'),rects=await markers.evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
  for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const p=rects[i],q=rects[j];assert(!(p.x<q.x+q.w&&p.x+p.w>q.x&&p.y<q.y+q.h&&p.y+p.h>q.y),'Readable pair targets do not overlap');}
  assert(await a.locator('.agreement-overflow').isVisible(),'Crowded markers have an explicit individual-pair fallback');
  await a.screenshot({path:'build/design-review/agreement-overview-dense.png',fullPage:true});
  await a.locator('.agreement-overflow summary').click();await a.locator('.agreement-overflow-list button:visible').first().click();
  assert(!(await a.locator('#compare-canvas .comparison-canvas').evaluate(el=>el.classList.contains('agreement-overview'))),'A crowded-pair choice zooms to readable original faces');
  await a.locator('.comparison-view-options>summary').click();await a.locator('#compare-collapse-a').click();assert.equal(await a.locator('.agreement-pair').count(),0,'Collapsed counterparts are not fabricated into merged cards');
  await a.locator('#compare-all-a').click();assert.equal(await a.locator('.agreement-pair').count(),24);await a.locator('#compare-frame-a').selectOption('goal');assert.equal(await a.locator('.agreement-pair').count(),0,'Filtered counterparts are not merged');await a.locator('#compare-frame-a').selectOption('all');await a.locator('.comparison-view-options>summary').click();
  const touchContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce',extraHTTPHeaders:{'x-test-actor':'alice'}}),touch=await touchContext.newPage();touch.on('pageerror',e=>errors.push(e.message));await load(touch);
  assert(await touch.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  for(const r of await touch.locator('.agreement-marker:visible button').evaluateAll(els=>els.map(el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height}))))assert(r.w>=44&&r.h>=44,'Touch targets remain usable in overview');
  await touch.screenshot({path:'build/design-review/agreement-overview-touch.png',fullPage:true});
  assert.equal(JSON.stringify((await view(store,alice)).workspace.maps),sourceBefore,'Overview, modes, filtering and navigation never modify original wording, confidence or source connections');
  const portable=await browser.newPage({viewport:{width:1200,height:900}});portable.on('pageerror',e=>errors.push(e.message));await portable.goto(pathToFileURL(resolve('review/Harmonious-radial.html')).href);
  await portable.locator('#workspace-file').setInputFiles({name:'agreement-overview.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify((await view(store,alice)).workspace))});
  await portable.waitForFunction(()=>document.getElementById('storage-status').textContent.includes('Workspace file opened'));
  await portable.evaluate(id=>location.hash='comparison='+id,thread.id);
  await portable.locator('.comparison-view-options>summary').click();for(const side of ['a','b'])await portable.locator('#compare-all-'+side).click();await portable.locator('.comparison-view-options>summary').click();
  assert.equal(await portable.locator('.agreement-pair').count(),24,'Portable comparisons preserve the same pair display states');
  assert.deepEqual(errors,[]);
  console.log('Comparison assessment browser passed: joined original faces, complete overview states, dense-map collision handling, 2–100% zoom without layout movement, pair/node inspection and focus, two accounts, collapsed/filtered endpoints, touch targets, mode consistency, source immutability and existing assessment regressions.');
}catch(error){let index=0;for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:`build/design-review/assessment-failure-${index++}.png`,fullPage:true});if(errors.length)console.error(errors);throw error;}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
