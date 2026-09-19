import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {validateAccountChanges} from '../worker/account-policy.mjs';
import {startAccountComparison} from '../worker/account-api.mjs';
import {makeDefinition} from '../dist/definitions.mjs';

// This walkthrough uses the actual browser UI and account write/projection policy
// with disposable in-memory accounts. It never contacts the deployed application.
const playwright=process.env.HARMONIOUS_PLAYWRIGHT;
if(!playwright)throw Error('Set HARMONIOUS_PLAYWRIGHT to the installed playwright entry point.');
const {chromium}=await import(pathToFileURL(playwright));
const store=memoryStore();
const claim='Hold next month’s meeting in the evening';
const reasonText='Evening is when most invited members can attend.';
const furtherText='The responses collected so far favor evening.';
const challengeText='Availability for a majority does not establish that evening is suitable for everyone invited. How are the others included?';
const responseText='I mean a one-month trial with a remote option, rather than a permanent schedule.';
const standardText='Offer a way to participate for invitees who cannot attend the main session.';
for(const actor of [alice,bob]){
  await seedActor(store,actor);
  await edit(store,actor,ws=>{
    const map=ws.maps.find(m=>m.ownerId===actor.id);map.name=actor.name+' meeting map';map.visibility='shared';
    addNode(ws,actor,actor===alice?claim:'Offer flexible ways to attend the meeting');
    if(actor===alice){
      ws.definitions.push(makeDefinition(ws,{type:'standard',title:'Inclusive scheduling',body:standardText},actor.id));
      ws.definitions.push(makeDefinition(ws,{type:'definition',title:'Unused private definition',body:'Private library wording not invoked in the argument.'},actor.id));
    }
  });
}
const initial=(await view(store,alice)).workspace;
const aMap=initial.maps.find(m=>m.ownerId===alice.id),bMap=initial.maps.find(m=>m.ownerId===bob.id);
const originalMaps=JSON.stringify(initial.maps);
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'),actor=req.headers['x-test-actor']==='bob'?bob:alice;
    if(url.pathname.startsWith('/api/')){
      res.setHeader('content-type','application/json');let result,body='';
      for await(const chunk of req)body+=chunk;const input=body?JSON.parse(body):null;
      if(url.pathname==='/api/session')result={configured:true,actor,signup:{mode:'public'}};
      else if(url.pathname==='/api/comparisons')result=await startAccountComparison(store,actor.id,input);
      else if(url.pathname==='/api/workspace'&&req.method==='PUT'){
        const snapshot=await store.snapshot(),accepted=validateAccountChanges(snapshot,actor.id,input.changes);
        result=await store.commit(actor.id,snapshot.revision,accepted);
      }else result={...await view(store,actor),actor};
      res.end(JSON.stringify(result));return;
    }
    const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
    if(!/^[a-z0-9.-]+$/.test(name)){res.writeHead(404);res.end();return;}
    let content=await readFile(resolve('dist',name),'utf8');
    if(name==='index.html')content=content.replace('src="./app.mjs"','src="./beta-boot.mjs"').replace('</head>','<link rel="stylesheet" href="./accounts.css"></head>');
    res.setHeader('content-type',name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'text/javascript');res.end(content);
  }catch(error){res.writeHead(error.status||500,{'content-type':'application/json'});res.end(JSON.stringify({error:error.message}));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:process.env.HARMONIOUS_BROWSER||'msedge'}),errors=[];
try{
  await mkdir('build/design-review',{recursive:true});
  const ac=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{'x-test-actor':'alice'}});
  const bc=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{'x-test-actor':'bob'}});
  const a=await ac.newPage(),b=await bc.newPage();
  for(const page of [a,b]){page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);}
  const saved=p=>p.waitForFunction(()=>document.getElementById('storage-status')?.textContent.includes('All changes saved'));
  const pop=p=>p.locator('.discussion-popover');
  const action=(p,name)=>pop(p).getByRole('button',{name,exact:true}).click();
  const expand=async p=>{
    await p.locator('.comparison-view-options>summary').click();
    for(const side of ['a','b'])await p.locator('#compare-all-'+side).click();
    await p.locator('.comparison-view-options>summary').click();
  };
  const node=async(p,title)=>{
    await p.getByRole('button',{name:'Fit both maps',exact:true}).click();
    await p.locator('#compare-canvas .node-main').filter({hasText:title}).click();
  };
  const records=async()=>((await view(store,alice)).workspace.discussions);
  const record=async body=>(await records()).find(r=>r.body===body);
  const camera=p=>p.locator('#compare-canvas .comparison-world').evaluate(world=>{
    const surface=world.closest('.comparison-canvas'),matrix=new DOMMatrix(getComputedStyle(world).transform);
    return {width:surface.clientWidth,height:surface.clientHeight,x:matrix.e,y:matrix.f,z:matrix.a};
  });
  const close=async p=>{if(await pop(p).isVisible())await action(p,'Close');};
  const openCard=async(p,id)=>{
    await close(p);await p.getByRole('button',{name:'Fit argument',exact:true}).click();
    await p.locator(`.reasoning-card[data-entry="${id}"] .reasoning-main`).click();
  };
  const follow=async p=>{
    await p.locator('#reasoning-argument-mode').click();
    await close(p);
    const counter=p.getByRole('button',{name:/reasons attached to/}).first();
    if(await counter.count())await counter.click();
    await p.getByRole('button',{name:'Fit argument',exact:true}).click();
  };
  const checkRoutes=async p=>{
    const geometry=await p.locator('#compare-canvas .comparison-world').evaluate(world=>{
      const cards=[...world.querySelectorAll('.node,.reasoning-card')].map(el=>({label:el.textContent.slice(0,110),...Object.fromEntries(['left','right','top','bottom'].map(key=>[key,el.getBoundingClientRect()[key]]))}));
      const collisions=[],midpoints=[],badgeOverlaps=[];
      for(const path of world.querySelectorAll('.reasoning-edge')){
        if(!path.getAttribute('d')){collisions.push({entry:path.dataset.entry,problem:'Missing visible connection'});continue;}
        const total=path.getTotalLength(),matrix=path.getScreenCTM(),scale=Math.hypot(matrix.a,matrix.b),steps=Math.max(2,Math.ceil(total*scale/4));
        const screenAt=distance=>{const point=path.getPointAtLength(distance);return new DOMPoint(point.x,point.y).matrixTransform(matrix);};
        for(let i=0;i<=steps;i++){
          const point=screenAt(total*i/steps),card=cards.find(r=>point.x>r.left+1&&point.x<r.right-1&&point.y>r.top+1&&point.y<r.bottom-1);
          if(card){collisions.push({entry:path.dataset.entry,card:card.label,point:{x:point.x,y:point.y}});break;}
        }
        const badge=world.querySelector(`.reasoning-inference[data-reason="${path.dataset.entry}"]`);
        if(badge&&!badge.hidden){
          const rect=badge.getBoundingClientRect(),mid=screenAt(total/2),x=(rect.left+rect.right)/2,y=(rect.top+rect.bottom)/2;
          midpoints.push({entry:path.dataset.entry,distance:Math.hypot(x-mid.x,y-mid.y)});
          for(const card of cards)if(rect.left<card.right-1&&rect.right>card.left+1&&rect.top<card.bottom-1&&rect.bottom>card.top+1)badgeOverlaps.push({entry:path.dataset.entry,card:card.label});
        }
      }
      return {paths:world.querySelectorAll('.reasoning-edge').length,collisions,midpoints,badgeOverlaps};
    });
    assert(geometry.paths>=2,'The expanded argument contains visible reasoning routes.');
    assert.deepEqual(geometry.collisions,[],'Rendered support and challenge routes must avoid source and reasoning cards.');
    assert(geometry.midpoints.length>=2,'Each reason exposes a selectable inference badge.');
    for(const item of geometry.midpoints)assert(item.distance<1,`Inference badge follows its actual support route: ${JSON.stringify(item)}`);
    assert.deepEqual(geometry.badgeOverlaps,[],'Inference controls must not cover another card.');
  };
  await a.goto(origin);
  await a.getByRole('button',{name:'Create comparison',exact:true}).click();
  await a.locator('#compare-map-a').selectOption(aMap.id);await a.locator('#compare-map-b').selectOption(bMap.id);
  await a.locator('#start-comparison').click();await a.locator('#workspace-message').filter({hasText:'Comparison saved'}).waitFor();
  const comparisonURL=a.url();await expand(a);
  assert.equal((await view(store,alice)).workspace.comparisons.length,0,'Reasoning needs no earlier proposal or relationship.');
  await node(a,claim);assert.equal(await pop(a).getByRole('button',{name:'Explain my reasoning',exact:true}).count(),0,'Compare has no reason composer');await a.locator('#reasoning-argument-mode').click();assert.equal(await pop(a).getByRole('button',{name:'Ask',exact:true}).count(),0);assert.equal(await a.locator('.counterpart-placeholder button,.counterpart-status').count(),0,'Argument retains neutral counterpart geometry without request controls');await action(a,'Explain my reasoning');
  await a.locator('#discussion-body').fill(reasonText);
  await a.locator('#discussion-reference').fill('https://example.org/meeting-notes');
  await pop(a).getByText('Definitions & standards (optional)',{exact:true}).click();
  await pop(a).locator('.definition-choice').filter({hasText:'Inclusive scheduling'}).locator('input[type=checkbox]').check();
  const beforeSave=await a.locator('#compare-canvas .comparison-world').getAttribute('style');
  const beforeCamera=await camera(a);
  await a.locator('#reasoning-compare-mode').click();assert.equal(await pop(a).isVisible(),false,'A parked reason form is not rendered in Compare');assert.equal(await a.locator('.reasoning-card,.discussion-rail .reasons,.discussion-rail .challenges').count(),0);await a.locator('#reasoning-argument-mode').click();
  assert.equal(await a.locator('#discussion-body').inputValue(),reasonText,'Changing focus mode preserves an unfinished reason.');
  assert.equal(await a.locator('#discussion-reference').inputValue(),'https://example.org/meeting-notes');
  assert.equal(await pop(a).locator('.definition-choice').filter({hasText:'Inclusive scheduling'}).locator('input[type=checkbox]').isChecked(),true);
  assert.equal(await a.locator('#compare-canvas .comparison-world').getAttribute('style'),beforeSave,'Changing focus mode preserves the camera.');
  await action(a,'Add reason');await saved(a);
  const reason=await record(reasonText);assert(reason);assert.equal(reason.action,'reason');assert.equal(reason.authorId,alice.id);
  assert.equal(reason.definitionRefs.length,1);assert.equal(reason.definitionRefs[0].body,standardText);
  const afterCamera=await camera(a);
  assert.equal(afterCamera.z,beforeCamera.z,'Saving keeps the zoom.');
  // Clearing the initial "Comparison saved" notice can resize the canvas. The
  // camera may recenter by half that size change, but must keep the world point
  // under the viewport center unchanged rather than fitting the enlarged graph.
  for(const [position,size]of [['x','width'],['y','height']])assert(Math.abs((afterCamera[position]-beforeCamera[position])-(afterCamera[size]-beforeCamera[size])/2)<0.01,`Saving preserves the viewed center: ${JSON.stringify({beforeCamera,afterCamera})}`);
  assert.equal(await pop(a).getByRole('button',{name:'Mark resolved',exact:true}).count(),0,'Reasons cannot be resolved as challenges.');
  assert.equal(JSON.stringify((await view(store,alice)).workspace.maps),originalMaps,'Adding reasoning does not edit either source map.');
  await action(a,'Add supporting reason');await a.locator('#discussion-body').fill(furtherText);await action(a,'Add reason');await saved(a);
  const further=await record(furtherText);assert.deepEqual(further.target,{type:'entry',entryId:reason.id});
  await action(a,'Close');
  await a.getByRole('button',{name:'Fit argument',exact:true}).click();
  assert.equal(await a.locator('.reasoning-card').count(),2,'The argument displays both levels of reasoning.');
  assert.equal(await a.locator('.reasoning-inference').count(),2,'Each saved reason has one selectable support connection.');
  await a.screenshot({path:'build/design-review/reasoning-initial.png',fullPage:true});
  await b.goto(comparisonURL);await expand(b);
  await follow(b);
  await openCard(b,reason.id);
  assert.equal(await pop(b).getByRole('button',{name:'Edit',exact:true}).count(),0,'The other participant cannot edit a reason.');
  assert.equal(await pop(b).getByRole('button',{name:'Add supporting reason',exact:true}).count(),0,'No general support action appears on the other author’s reason.');
  await close(b);await b.locator(`.reasoning-card[data-entry="${reason.id}"] .reasoning-definitions`).click();
  assert.match(await pop(b).innerText(),/Inclusive scheduling/);
  assert.match(await pop(b).innerText(),/Offer a way to participate/);
  await action(b,'Back to contribution');
  await close(b);
  const inference=b.locator(`.reasoning-inference[data-reason="${reason.id}"]`);
  await inference.focus();await b.keyboard.press('Enter');
  assert.match(await pop(b).innerText(),/Reasoning connection/);
  assert((await pop(b).innerText()).includes(reasonText));assert((await pop(b).innerText()).includes(claim));
  await action(b,'Challenge reasoning');await b.locator('#discussion-body').fill(challengeText);await action(b,'Add challenge');await saved(b);
  const challenge=await record(challengeText);assert.deepEqual(challenge.target,{type:'inference',entryId:reason.id});
  assert.equal(challenge.authorId,bob.id);await close(b);
  await a.reload();await expand(a);await follow(a);await openCard(a,challenge.id);
  assert.match(await pop(a).innerText(),/Open/);
  assert.equal(await pop(a).getByRole('button',{name:'Mark resolved',exact:true}).count(),0,'The responding participant cannot resolve someone else’s challenge.');
  await action(a,'Respond');await a.locator('#discussion-body').fill(responseText);
  await a.locator('#discussion-reference').fill('https://example.org/meeting-notes');
  await action(a,'Post response');await saved(a);
  const response=await record(responseText);assert.deepEqual(response.target,{type:'entry',entryId:challenge.id});
  assert.equal(response.referenceUrl,'https://example.org/meeting-notes');
  await openCard(a,challenge.id);await action(a,'Maintain position');await a.locator('#discussion-body').fill('I maintain the position as a one-month trial.');await action(a,'Maintain position');await saved(a);
  await b.reload();await expand(b);await follow(b);await openCard(b,challenge.id);
  assert.match(await pop(b).innerText(),/Open/,'Maintaining a position does not resolve a challenge.');
  assert.match(await pop(b).innerText(),/one-month trial/);
  await action(b,'Mark resolved');await b.locator('#discussion-body').fill('The trial and remote option address my concern.');await action(b,'Resolved by challenger');await saved(b);
  await openCard(b,challenge.id);assert.match(await pop(b).innerText(),/Resolved/);
  await action(b,'Reopen challenge');await b.locator('#discussion-body').fill('We still need to establish the remote arrangements.');await action(b,'Reopened by challenger');await saved(b);
  await openCard(b,challenge.id);assert.match(await pop(b).innerText(),/Open/);assert.match(await pop(b).innerText(),/remote arrangements/);
  // These targets must remain distinct after browser saves and reopening.
  await openCard(b,reason.id);await action(b,'Challenge reason');await b.locator('#discussion-body').fill('I dispute that most people can attend.');await action(b,'Add challenge');await saved(b);
  const statementChallenge=await record('I dispute that most people can attend.');assert.deepEqual(statementChallenge.target,{type:'entry',entryId:reason.id});
  await close(b);await node(b,claim);await action(b,'Challenge');await b.locator('#discussion-body').fill('I disagree with holding the meeting in the evening.');await action(b,'Add challenge');await saved(b);
  const sourceChallenge=await record('I disagree with holding the meeting in the evening.');assert.equal(sourceChallenge.target.type,'node');assert.equal(sourceChallenge.target.nodeId,reason.target.nodeId);
  await close(b);await follow(b);await checkRoutes(b);await b.screenshot({path:'build/design-review/reasoning-chain.png',fullPage:true});
  await b.getByRole('button',{name:'Collapse argument',exact:true}).click();
  assert.equal(await b.locator('.reasoning-card').count(),0,'Collapsing clears expanded cards.');
  assert(await b.getByRole('button',{name:/reasons attached to/}).count(),'Collapsed arguments keep their source indicator.');
  await a.reload();await expand(a);await follow(a);await openCard(a,response.id);await action(a,'Add supporting reason');
  await a.locator('#discussion-body').fill('A draft supporting the response.');
  await a.locator('#discussion-reference').fill('https://example.org/draft-reference');
  await a.locator('#reasoning-compare-mode').click();await a.locator('#reasoning-argument-mode').click();
  assert.equal(await a.locator('#discussion-body').inputValue(),'A draft supporting the response.');
  a.once('dialog',d=>d.dismiss());await a.locator('#comparison-library').click();
  assert.equal(await a.locator('#discussion-body').inputValue(),'A draft supporting the response.','Cancelling navigation keeps the draft.');
  await a.setViewportSize({width:390,height:844});
  await a.getByRole('button',{name:'Full canvas',exact:true}).click();
  assert.equal(await a.locator('#discussion-body').inputValue(),'A draft supporting the response.');
  assert.equal(await a.locator('#discussion-reference').inputValue(),'https://example.org/draft-reference');
  await a.getByRole('button',{name:'Exit full canvas',exact:true}).click();
  assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'The narrow layout stays within the viewport.');
  const narrow=await pop(a).boundingBox();assert(narrow.x>=0&&narrow.x+narrow.width<=391,'The composer is contained on a narrow screen.');
  await a.screenshot({path:'build/design-review/reasoning-mobile.png',fullPage:true});
  a.once('dialog',d=>d.accept());await action(a,'Close');
  await a.setViewportSize({width:1440,height:1000});await a.reload();await expand(a);await follow(a);
  assert.equal((await records()).length,9,'Only saved contributions survive; cancelled drafts create no record.');
  assert.equal(JSON.stringify((await view(store,alice)).workspace.maps),originalMaps,'The complete argument still leaves source maps unchanged.');
  assert.deepEqual((await view(store,alice)).workspace.discussions.map(r=>r.id),(await view(store,bob)).workspace.discussions.map(r=>r.id),'Both participants retain the same shared record identities.');
  await openCard(a,reason.id);await action(a,'Edit');
  const revisedReason='Evening is when most invited members who have responded can attend.';
  await a.locator('#discussion-body').fill(revisedReason);await action(a,'Save changes');await saved(a);
  const revised=await record(revisedReason);assert.equal(revised.id,reason.id);assert.equal(revised.version,2);
  assert.equal(revised.definitionRefs[0].body,standardText,'Editing a reason retains its explicit definition invocation.');
  assert.equal(revised.history[0].body,reasonText,'The earlier reason remains in history.');
  await b.reload();await expand(b);await follow(b);await openCard(b,challenge.id);
  assert.match(await pop(b).innerText(),/Source changed/,'An inference challenge detects changed reason wording.');
  await pop(b).getByText('Source wording & history',{exact:true}).click();
  assert((await pop(b).innerText()).includes(reasonText),'The inference retains the original reason wording.');
  assert((await pop(b).innerText()).includes(revisedReason),'The changed reason can be compared with the original.');
  const bobWorkspace=JSON.stringify((await view(store,bob)).workspace);
  assert(bobWorkspace.includes(reasonText),'The second participant receives the same reason.');
  assert(!bobWorkspace.includes('Private library wording not invoked'),'Unused library entries remain private.');
  await edit(store,alice,ws=>{const map=ws.maps.find(m=>m.id===aMap.id);map.visibility='private';});
  const afterPrivacy=(await view(store,bob)).workspace;
  assert.equal(afterPrivacy.discussions.length,0,'Losing source access removes the entire reasoning chain from the account projection.');
  assert(!JSON.stringify(afterPrivacy).includes(standardText),'Invoked private wording is not leaked through an unavailable reasoning chain.');
  await b.reload();await b.locator('#storage-status').waitFor();
  assert.equal(await b.locator('.reasoning-card').count(),0,'An old browser route cannot display an inaccessible chain after refresh.');
  assert.deepEqual(errors,[]);
  console.log('Current Argument browser checks passed: two-account reason chains, inference/statement/source challenges, responses, attributed outcomes, source-map invariance, private definitions, mode/draft preservation, collapse indicators and narrow layout.');
}catch(error){
  for(const [i,context]of browser.contexts().entries())for(const page of context.pages()){
    await page.screenshot({path:`build/design-review/reasoning-failure-${i}.png`,fullPage:true});
    console.error((await page.locator('body').innerText()).slice(-7000));
  }
  console.error(errors);throw error;
}finally{await browser.close();await new Promise(r=>server.close(r));}
