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
const store=memoryStore();for(const actor of [alice,bob]){await seedActor(store,actor);await edit(store,actor,ws=>{const map=ws.maps.find(m=>m.ownerId===actor.id);map.name=actor.name+' worldview';map.visibility='shared';addNode(ws,actor,actor.name+' position');});}
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
  const ac=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{'x-test-actor':'alice'}}),bc=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{'x-test-actor':'bob'}});
  const a=await ac.newPage(),b=await bc.newPage();for(const page of [a,b])page.on('pageerror',e=>errors.push(e.message));
  const saved=p=>p.waitForFunction(()=>document.getElementById('storage-status')?.textContent.includes('All changes saved'));
  const pop=p=>p.locator('.discussion-popover');const action=(p,name)=>pop(p).getByRole('button',{name,exact:true}).click();
  await a.goto(origin);
  await a.getByRole('button',{name:'Definitions & standards',exact:true}).click();await a.getByRole('button',{name:'Create definition or standard',exact:true}).click();
  await a.locator('#definition-title').fill('Fairness');await a.locator('#definition-body').fill('Equal opportunity to participate.');await a.getByRole('button',{name:'Save library entry',exact:true}).click();await saved(a);await a.locator('.definitions-dialog').getByRole('button',{name:'Close',exact:true}).click();
  await a.getByRole('button',{name:'Create comparison',exact:true}).click();
  await a.locator('#compare-map-a').selectOption(aMap.id);await a.locator('#compare-map-b').selectOption(bMap.id);await a.locator('#start-comparison').click();await a.locator('#workspace-message').filter({hasText:'Comparison saved'}).waitFor();
  const comparisonURL=a.url();assert.equal(await a.locator('.comparison-panel').isVisible(),false);
  const checkCanvas=async page=>{
    const bounds=await page.locator('#compare-canvas').boundingBox(),surface=await page.locator('#compare-canvas .comparison-canvas').boundingBox();
    assert(surface.height>=240,'Canvas retains usable height');
    assert(surface.y+surface.height<=bounds.y+bounds.height+1,'Layer controls must not push the canvas outside its container');
  };
  const checkRecords=async page=>{
    const width=(await page.locator('#compare-canvas').boundingBox()).width;
    await page.locator('.comparison-view-options>summary').click();
    await page.getByRole('button',{name:'Earlier records',exact:true}).click();
    assert.equal(await page.locator('[aria-controls="comparison-panel"]').getAttribute('aria-expanded'),'true');
    await page.keyboard.press('Escape');assert.equal(await page.locator('.comparison-panel').isVisible(),false);
    assert.equal(await page.locator('.comparison-view-options>summary').evaluate(el=>document.activeElement===el),true,'Closing the drawer restores keyboard focus');
    await page.locator('.comparison-view-options>summary').click();await page.getByRole('button',{name:'Earlier records',exact:true}).click();await page.getByRole('button',{name:'Close records',exact:true}).click();
    assert.equal((await page.locator('#compare-canvas').boundingBox()).width,width,'Records overlay must not squeeze the map');
  };
  await checkCanvas(a);await checkRecords(a);
  const expand=async p=>{await p.locator('.comparison-view-options>summary').click();for(const side of ['a','b'])await p.locator('#compare-all-'+side).click();await p.locator('.comparison-view-options>summary').click();};
  const node=async(p,title)=>{
    const button=p.locator('#compare-canvas .node-main').filter({hasText:title}),r=await button.boundingBox(),s=await p.locator('#compare-canvas .comparison-canvas').boundingBox();
    if(r.x<s.x||r.y<s.y||r.x+r.width>s.x+s.width||r.y+r.height>s.y+s.height)await p.getByRole('button',{name:'Fit both maps',exact:true}).click();
    await button.click();
  };
  await expand(a);await node(a,'Alice position');await action(a,'Use definitions & standards');await a.locator('.definition-choice input[type=checkbox]').check();await a.getByRole('button',{name:'Save references',exact:true}).click();await saved(a);await action(a,'Close');
  await node(a,'Alice position');await action(a,'Request counterpart');await a.locator('#discussion-body').fill('Do you have a corresponding position?');await action(a,'Send request');await saved(a);await action(a,'Close');
  await node(a,'Bob position');
  const beforeSave=await a.locator('#compare-canvas .comparison-world').getAttribute('style');
  await action(a,'Agreement');await saved(a);assert.match(await pop(a).innerText(),/Agreement/);assert.equal((await view(store,alice)).workspace.comparisons.length,0,'No question or proposal needed');
  assert.equal(await a.locator('#compare-canvas .comparison-world').getAttribute('style'),beforeSave,'Saving a contribution preserves the camera');
  assert.equal(await a.locator('#compare-canvas .comparison-canvas').evaluate(el=>el.scrollTop+el.scrollLeft),0,'Focus must not scroll the transformed map independently of its camera');
  const badge=await a.locator('.discussion-badge.agreement').boundingBox();
  const cards=await a.locator('#compare-canvas .node').all();assert(cards.length>0);
  for(const card of cards){const r=await card.boundingBox();if(r)assert(!(badge.x<r.x+r.width&&badge.x+badge.width>r.x&&badge.y<r.y+r.height&&badge.y+badge.height>r.y),'Relationship labels must not cover map nodes');}
  await action(a,'Edit');await a.locator('#discussion-body').fill('Both positions call for a common starting point.');await action(a,'Save changes');await saved(a);await action(a,'Close');
  await node(a,'Bob position');await action(a,'Ask');await a.locator('#reasoning-argument-mode').click();assert.equal(await pop(a).isVisible(),false,'Untouched inquiry form is parked too');await a.locator('#reasoning-compare-mode').click();assert.equal(await a.locator('#discussion-body').inputValue(),'');await a.locator('#discussion-action').selectOption('evidence');assert.equal(await a.locator('#discussion-body').inputValue(),'What evidence supports this?');await a.locator('#reasoning-argument-mode').click();assert.equal(await pop(a).isVisible(),false,'Inquiry form is parked in Argument');await a.locator('#reasoning-compare-mode').click();assert.equal(await a.locator('#discussion-body').inputValue(),'What evidence supports this?');await action(a,'Send question');await saved(a);await action(a,'Close');
  const edge=a.getByRole('button',{name:/Select connection.*Bob position/}).first();await a.getByRole('button',{name:'Fit both maps',exact:true}).click();
  const hit=await edge.evaluate(path=>{const matrix=path.getScreenCTM();for(let step=1;step<20;step++){const point=path.getPointAtLength(path.getTotalLength()*step/20),screen=new DOMPoint(point.x,point.y).matrixTransform(matrix);if(document.elementFromPoint(screen.x,screen.y)===path)return {x:screen.x,y:screen.y};}return null;});assert(hit,'An edge has a mouse-accessible segment');await a.mouse.click(hit.x,hit.y);assert.equal(await pop(a).getByRole('button',{name:'Challenge',exact:true}).count(),0);await a.locator('#reasoning-argument-mode').click();assert.equal(await pop(a).getByRole('button',{name:'Ask',exact:true}).count(),0);await action(a,'Challenge');assert.equal(await a.locator('.challenge-type').getAttribute('open'),null,'Classification is optional and collapsed');await a.screenshot({path:'build/design-review/challenge-optional-type.png',fullPage:true});await pop(a).getByText('Type of challenge (optional)',{exact:true}).click();assert.deepEqual(await a.locator('#discussion-action option').allTextContents(),['General challenge','Reasoning does not follow','Counterexample','Logical fallacy or reasoning error']);await a.locator('#discussion-action').selectOption('inference');await a.locator('#discussion-body').fill('How does this conclusion follow from its parent?');await action(a,'Add challenge');await saved(a);await action(a,'Close');
  await a.locator('#reasoning-compare-mode').click();await node(a,'Alice position');assert.equal(await pop(a).getByRole('button',{name:'Define terms / standards',exact:true}).count(),0,'Definitions are no longer created separately on each node');await action(a,'Suggest adoption');await a.locator('#discussion-body').fill('This position may also belong in your map.');await action(a,'Send suggestion');await saved(a);await action(a,'Close');
  assert.equal(await a.locator('.discussion-card').count(),0,'Conversations no longer scatter cards around the map');
  await a.getByRole('button',{name:/2 questions attached to Alice position/}).click();assert.match(await pop(a).innerText(),/Request counterpart/);assert.match(await pop(a).innerText(),/Suggest adoption/);await a.screenshot({path:'build/design-review/attached-conversations.png',fullPage:true});await action(a,'Close');
  await a.screenshot({path:'build/design-review/conversation-map.png',fullPage:true});
  await b.goto(comparisonURL);await expand(b);assert.equal(await b.locator('.discussion-badge.agreement').count(),1,'One userâ€™s relationship appears for both');
  await b.getByRole('button',{name:'Definitions and standards for Alice position',exact:true}).click();assert.match(await pop(b).innerText(),/Equal opportunity to participate/);assert.equal(await pop(b).getByRole('button',{name:'Choose library references',exact:true}).count(),0);await action(b,'Close');
  await b.locator('.discussion-badge.agreement').click();assert.match(await pop(b).innerText(),/Recorded by Alice/);assert.equal(await pop(b).getByRole('button',{name:'Reply',exact:true}).count(),0);assert.equal(await pop(b).getByRole('button',{name:'Support',exact:true}).count(),0);assert.equal(await pop(b).getByRole('button',{name:'Add evidence',exact:true}).count(),0);assert.equal(await pop(b).getByRole('button',{name:'Contest agreement',exact:true}).count(),0);await b.locator('#reasoning-argument-mode').click();await action(b,'Contest agreement');await b.locator('#discussion-body').fill('These positions differ in an important respect.');await action(b,'Add challenge');await saved(b);await action(b,'Close');
  await b.locator('#reasoning-compare-mode').click();await b.getByRole('button',{name:/1 questions attached to Bob position/}).click();await pop(b).locator('.discussion-list-item').filter({hasText:'Ask for evidence'}).click();assert.equal(await pop(b).getByRole('button',{name:'Edit',exact:true}).count(),0);await action(b,'Answer');await b.locator('#discussion-body').fill('Here is an example from our previous project.');await action(b,'Post response');await saved(b);await action(b,'Close');
  await a.reload();await expand(a);await a.getByRole('button',{name:/1 questions attached to Bob position/}).click();await pop(a).locator('.discussion-list-item').filter({hasText:'Ask for evidence'}).click();assert.match(await pop(a).innerText(),/previous project/);await action(a,'Close');
  assert.equal(await a.locator('.discussion-card').count(),0,'Closing leaves source counters only');
  await a.getByRole('button',{name:'Argument',exact:true}).click();await pop(a).locator('.discussion-list-item').filter({hasText:'These positions differ'}).click();assert.match(await pop(a).innerText(),/Open parent in Compare/);await action(a,'Accept challenge');await a.locator('#discussion-body').fill('I accept your distinction.');await action(a,'Accept challenge');await saved(a);await action(a,'Close');
  await b.reload();await expand(b);await b.getByRole('button',{name:'Argument',exact:true}).click();await pop(b).locator('.discussion-list-item').filter({hasText:'These positions differ'}).click();assert.match(await pop(b).innerText(),/I accept your distinction/);assert.match(await pop(b).innerText(),/Open/);await action(b,'Mark resolved');await b.locator('#discussion-body').fill('That addresses my challenge.');await action(b,'Resolved by challenger');await saved(b);await action(b,'Close');
  await a.reload();await expand(a);await a.getByRole('button',{name:'Argument',exact:true}).click();assert.match(await pop(a).innerText(),/1 resolved by their authors/);await a.screenshot({path:'build/design-review/argument-conversations.png',fullPage:true});await action(a,'Close');
  await edit(store,bob,w=>{const map=w.maps.find(m=>m.id===bMap.id);map.nodes.find(n=>n.parent!==null).details='Updated explanation from Bob.';synchronizeIdeas(w,map);});
  await a.reload();await expand(a);await a.locator('.discussion-badge.agreement').click();assert.match(await pop(a).innerText(),/Source changed/);await pop(a).getByText('Source wording & history',{exact:true}).click();assert.match(await pop(a).innerText(),/Originally discussed/);assert.match(await pop(a).innerText(),/Updated explanation from Bob/);await action(a,'Confirm current source wording');await saved(a);assert(!await pop(a).innerText().then(t=>t.includes('Source changed')));await action(a,'Close');
  const inquiries=a.locator('.discussion-layers').getByRole('button',{name:'Inquiries',exact:true});if(await inquiries.getAttribute('aria-pressed')==='true')await inquiries.click();assert(await a.getByRole('button',{name:/questions attached to/}).count(),'Collapsed inquiry layer retains source indicators');await a.getByRole('button',{name:/1 questions attached to Bob position/}).click();assert.match(await pop(a).innerText(),/Ask for evidence/);await action(a,'Close');await inquiries.click();
  await node(a,'Bob position');await action(a,'Ask');await a.locator('#discussion-body').fill('Draft to preserve');a.once('dialog',d=>d.dismiss());await a.locator('#comparison-library').click();assert.equal(await a.locator('#discussion-body').inputValue(),'Draft to preserve');a.once('dialog',d=>d.accept());await action(a,'Close');
  await a.setViewportSize({width:390,height:844});await checkCanvas(a);await checkRecords(a);for(const button of await a.locator('.comparison-context>.discussion-layers>button:visible').all()){const r=await button.boundingBox();assert(r.x>=0&&r.x+r.width<=390,'Every primary comparison control remains visible on a narrow screen');}await a.getByRole('button',{name:'Fit both maps',exact:true}).click();await node(a,'Bob position');await action(a,'Ask');assert.equal(await pop(a).getByRole('button',{name:'Use panel',exact:true}).count(),0);assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const rect=await pop(a).boundingBox(),surface=await a.locator('#compare-canvas .comparison-canvas').boundingBox();assert(rect.x>=0&&rect.x+rect.width<=390);assert(rect.y>=surface.y&&rect.y+rect.height<=surface.y+surface.height+1,'Composer stays inside the canvas');await a.screenshot({path:'build/design-review/conversation-mobile.png',fullPage:true});
  await a.locator('#discussion-body').fill('Keep this draft in full canvas');await a.getByRole('button',{name:'Full canvas',exact:true}).click();assert.equal(await a.locator('#discussion-body').inputValue(),'Keep this draft in full canvas');await a.waitForFunction(()=>document.querySelector('#compare-canvas .comparison-canvas').clientHeight>650);await a.getByRole('button',{name:'Exit full canvas',exact:true}).click();assert.equal(await a.locator('#discussion-body').inputValue(),'Keep this draft in full canvas');
  a.once('dialog',d=>d.accept());await action(a,'Close');await a.setViewportSize({width:1440,height:1000});
  await a.getByRole('button',{name:'Map Library',exact:true}).click();await a.getByRole('button',{name:'Definitions & standards',exact:true}).click();await a.getByRole('button',{name:'View entry',exact:true}).click();await a.getByRole('button',{name:'Edit entry',exact:true}).click();await a.locator('#definition-body').fill('Equal speaking time in this decision.');await a.getByRole('button',{name:'Save library entry',exact:true}).click();await saved(a);await a.screenshot({path:'build/design-review/definitions-library.png',fullPage:true});await a.locator('.definitions-dialog').getByRole('button',{name:'Close',exact:true}).click();
  await b.reload();await expand(b);await b.getByRole('button',{name:'Definitions and standards for Alice position',exact:true}).click();assert.match(await pop(b).innerText(),/Equal opportunity to participate/);assert(!await pop(b).innerText().then(t=>t.includes('Equal speaking time')));await action(b,'Close');
  await a.goto(comparisonURL);await expand(a);await node(a,'Alice position');await action(a,'Use definitions & standards');assert.equal(await a.locator('.definition-choice select').inputValue(),'1');await a.locator('.definition-choice select').selectOption('2');await a.getByRole('button',{name:'Save references',exact:true}).click();await saved(a);await action(a,'Close');
  await b.reload();await expand(b);await b.getByRole('button',{name:'Definitions and standards for Alice position',exact:true}).click();assert.match(await pop(b).innerText(),/Equal speaking time/);assert.match(await pop(b).innerText(),/Version 2/);await action(b,'Close');
  await b.locator('.comparison-view-options>summary').click();for(const side of ['a','b'])await b.locator('#compare-collapse-'+side).click();await b.locator('.comparison-view-options>summary').click();assert(await b.getByRole('button',{name:/questions attached to/}).count(),'Collapsed source branches retain conversation indicators');
  assert.deepEqual(errors,[]);console.log('On-map browser checks passed: source appendages, library reuse and explicit version updates, shared challenge responses/resolution, collapsed branches, draft protection and mobile.');
}catch(error){for(const [i,context]of browser.contexts().entries())for(const page of context.pages()){await page.screenshot({path:`build/design-review/discussion-failure-${i}.png`,fullPage:true});console.error((await page.locator('body').innerText()).slice(-5000));}console.error(errors);throw error;}finally{await browser.close();await new Promise(r=>server.close(r));}
