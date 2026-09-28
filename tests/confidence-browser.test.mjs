import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {validateAccountChanges} from '../worker/account-policy.mjs';
import {startAccountComparison} from '../worker/account-api.mjs';
import {synchronizeIdeas} from '../dist/adoption.mjs';

if(!process.env.HARMONIOUS_PLAYWRIGHT)throw Error('Set HARMONIOUS_PLAYWRIGHT to the installed playwright entry point.');
const {chromium}=await import(pathToFileURL(process.env.HARMONIOUS_PLAYWRIGHT));
const store=memoryStore();
for(const actor of [alice,bob]){await seedActor(store,actor);await edit(store,actor,ws=>{const map=ws.maps.find(m=>m.ownerId===actor.id);map.name=actor.name+' worldview';map.visibility='shared';const n=addNode(ws,actor,actor.name+' position');n.kind='position';n.confidence=actor===alice?73:0;synchronizeIdeas(ws,map);});}
const ws=(await view(store,alice)).workspace,aMap=ws.maps.find(m=>m.ownerId===alice.id),bMap=ws.maps.find(m=>m.ownerId===bob.id),aNode=aMap.nodes.find(n=>n.kind==='position');
const {comparisonThread}=await startAccountComparison(store,alice.id,{aMapId:aMap.id,bMapId:bMap.id});
const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost'),actor=req.headers['x-test-actor']==='bob'?bob:alice;
  if(url.pathname.startsWith('/api/')){res.setHeader('content-type','application/json');let text='';for await(const chunk of req)text+=chunk;const input=text?JSON.parse(text):null;let result;
    if(url.pathname==='/api/session')result={configured:true,actor,signup:{mode:'public'}};
    else if(url.pathname==='/api/workspace'&&req.method==='PUT'){const snapshot=await store.snapshot();result=await store.commit(actor.id,snapshot.revision,validateAccountChanges(snapshot,actor.id,input.changes));}
    else result={...await view(store,actor),actor};res.end(JSON.stringify(result));return;
  }
  const name=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!/^[a-z0-9.-]+$/.test(name)){res.writeHead(404);res.end();return;}
  let content=await readFile(resolve('dist',name),'utf8');if(name==='index.html')content=content.replace('src="./app.mjs"','src="./beta-boot.mjs"').replace('</head>','<link rel="stylesheet" href="./accounts.css"></head>');
  res.setHeader('content-type',name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'text/javascript');res.end(content);
}catch(error){res.writeHead(error.status||500,{'content-type':'application/json'});res.end(JSON.stringify({error:error.message}));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,comparisonURL=origin+'/#comparison='+comparisonThread.id;
const browser=await chromium.launch({headless:true,channel:process.env.HARMONIOUS_BROWSER||'msedge'}),errors=[];
try{
  await mkdir('build/design-review',{recursive:true});const ac=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{'x-test-actor':'alice'}}),bc=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{'x-test-actor':'bob'}});
  const a=await ac.newPage(),b=await bc.newPage();for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
  const saved=p=>p.waitForFunction(()=>document.getElementById('storage-status')?.textContent.includes('All changes saved'));
  const score=async()=>((await view(store,alice)).workspace.maps.find(m=>m.id===aMap.id).nodes.find(n=>n.id===aNode.id).confidence);
  const expand=async p=>{await p.locator('.comparison-view-options>summary').click();for(const side of ['a','b'])await p.locator('#compare-all-'+side).click();await p.locator('.comparison-view-options>summary').click();};
  const ownCard=p=>p.locator('#compare-canvas .node').filter({has:p.locator('.node-title').filter({hasText:'Alice position'})});
  const editorCard=a.locator(`#cards .node[data-id="${aNode.id}"]`);
  const confidenceLabel=(value,owner='Alice',editable=true)=>`Confidence: ${value} — ${owner}${editable?'; edit confidence':''}`;
  const editConfidence=async(p,host='.on-map-actions')=>{const form=p.locator(host+' .confidence-form');await form.waitFor();assert.equal(await form.getAttribute('aria-label'),'Confidence');return form;};
  await a.goto(origin+'/#map='+aMap.id);await a.locator('#editor-main').waitFor();await a.locator('#all').click();await a.locator('#cards .node-main').filter({hasText:'Alice position'}).click();
  await a.locator('.on-map-actions').getByRole('button',{name:'Edit',exact:true}).click();
  assert.equal(await a.locator('#confidence').inputValue(),'73','An arbitrary valid imported score survives editor loading');
  await a.locator('#summary').fill('More detail without changing confidence.');await a.locator('#edit-form button[type=submit]').click();await saved(a);assert.equal(await score(),73);
  await a.locator('#close').click();await editorCard.locator('button.node-confidence').click();let form=await editConfidence(a);
  assert(await a.locator('#inspector').isHidden(),'Direct confidence does not force open node details');
  await form.getByRole('spinbutton').fill('101');await form.getByRole('button',{name:'Save confidence',exact:true}).click();assert.equal(await form.getByRole('spinbutton').evaluate(e=>e.checkValidity()),false);assert.equal(await score(),73);
  await form.getByRole('spinbutton').fill('-1');await form.getByRole('button',{name:'Save confidence',exact:true}).click();assert.equal(await form.getByRole('spinbutton').evaluate(e=>e.checkValidity()),false);assert.equal(await score(),73);
  await form.getByRole('spinbutton').fill('64.5');await form.getByRole('button',{name:'Save confidence',exact:true}).click();await saved(a);assert.equal(await score(),64.5);
  assert.equal(await editorCard.locator('button.node-confidence').evaluate(e=>e===document.activeElement),true,'Saving returns focus to the current confidence button');
  await editorCard.locator('.node-main').click();await a.locator('.on-map-actions').getByRole('button',{name:'Edit',exact:true}).click();
  await a.getByRole('button',{name:confidenceLabel('64.5%'),exact:true}).click();form=await editConfidence(a);await form.getByRole('spinbutton').fill('12');
  await a.locator('#summary').fill('An unrelated inspector draft must survive Back.');await form.getByRole('button',{name:'Back',exact:true}).click();assert.equal(await score(),64.5,'Cancelling a confidence draft preserves the saved score');
  assert.equal(await a.locator('#summary').inputValue(),'An unrelated inspector draft must survive Back.');await a.locator('#edit-form button[type=submit]').click();await saved(a);assert.equal(await score(),64.5,'Saving the retained wording draft does not save the cancelled confidence');
  await a.locator('#close').click();await editorCard.locator('.node-main').click();await a.locator('.on-map-actions').getByRole('button',{name:'Add child node',exact:true}).click();
  assert.equal(await a.locator('#child-confidence').inputValue(),'','New children start unassessed');await a.locator('#child-title').fill('Child assessed at creation');await a.locator('#child-confidence').fill('100');await a.locator('#child-submit').click();await saved(a);
  const created=(await view(store,alice)).workspace.maps.find(m=>m.id===aMap.id).nodes.filter(n=>n.title==='Child assessed at creation');assert.equal(created.length,1);assert.equal(created[0].confidence,100);assert.equal(created[0].parent,aNode.id);
  assert.equal(await a.locator('#cards .node.root .node-confidence').count(),0,'Frame containers do not display confidence');
  assert.deepEqual(await a.evaluate(async()=>{const {confidenceBadge}=await import('/confidence-ui.mjs');return ['topic','question','explainer'].map(kind=>confidenceBadge({id:'legacy',kind,parent:'status',confidence:null},'Alice')).concat(confidenceBadge({id:'frame',kind:'position',parent:null,confidence:null},'Alice'));}),[null,null,null,null],'Legacy nodes and frame containers are explicitly ineligible');
  await a.locator('#comparison-mode').click();await a.getByRole('button',{name:'Open comparison',exact:true}).click();await a.locator('#comparison-context').waitFor();await expand(a);
  const refresh=a.waitForResponse(r=>r.url().endsWith('/api/workspace')&&r.request().method()==='GET');await a.getByRole('button',{name:'Refresh',exact:true}).click();await refresh;
  await ownCard(a).getByRole('button',{name:confidenceLabel('64.5%'),exact:true}).click();
  form=a.locator('.discussion-popover .confidence-form');await form.getByRole('spinbutton').fill('82');await form.getByRole('button',{name:'Save confidence',exact:true}).click();await saved(a);assert.equal(await score(),82);
  assert.equal(await a.locator('#compare-canvas span.node-confidence').filter({hasText:'Confidence 0%'}).count(),1,'Another author’s zero confidence remains visible and read-only');
  assert.equal(await ownCard(a).locator('button.node-confidence').evaluate(e=>e===document.activeElement),true,'Shared-view save returns focus to the rebuilt confidence slot');await a.screenshot({path:'build/design-review/confidence-compare.png',fullPage:true});
  await b.goto(comparisonURL);await b.locator('#comparison-context').waitFor();await expand(b);assert.equal(await ownCard(b).locator('span.node-confidence').textContent(),'Confidence 82%');assert.equal(await ownCard(b).locator('button.node-confidence').count(),0);
  await ownCard(b).locator('.node-main').click();assert.equal(await b.locator('.discussion-popover').getByRole('button',{name:'My confidence',exact:true}).count(),0,'Other participants cannot edit confidence from the menu');
  await a.setViewportSize({width:390,height:844});await a.getByRole('button',{name:'Fit both maps',exact:true}).click();await ownCard(a).getByRole('button',{name:confidenceLabel('82%'),exact:true}).click();form=a.locator('.discussion-popover .confidence-form');
  await a.screenshot({path:'build/design-review/confidence-mobile.png',fullPage:true});const bounds=await form.boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=390,'On-map confidence form fits a narrow viewport');
  await form.getByRole('button',{name:'Not assessed',exact:true}).click();await form.getByRole('button',{name:'Save confidence',exact:true}).click();await saved(a);assert.equal(await score(),null);assert.equal(await ownCard(a).locator('.node-confidence').textContent(),'Confidence —');
  await a.reload();await a.locator('#comparison-context').waitFor();await expand(a);await ownCard(a).getByRole('button',{name:confidenceLabel('not assessed'),exact:true}).focus();await a.keyboard.press('Enter');form=await editConfidence(a,'.discussion-popover');assert.equal(await form.getByRole('spinbutton').inputValue(),'');
  await form.getByRole('spinbutton').fill('0');await form.getByRole('button',{name:'Save confidence',exact:true}).click();await saved(a);assert.equal(await score(),0);assert.equal(await ownCard(a).locator('.node-confidence').textContent(),'Confidence 0%');
  await ownCard(a).locator('button.node-confidence').click();form=await editConfidence(a,'.discussion-popover');await form.getByRole('button',{name:'Not assessed',exact:true}).click();await form.getByRole('button',{name:'Save confidence',exact:true}).click();await saved(a);
  await a.goto(origin+'/#source='+aMap.id+'&node='+aNode.id);await a.locator('#reference-canvas').waitFor();const sourceCard=a.locator('#reference-canvas .node').filter({has:a.getByText('Alice position',{exact:true})});assert.equal(await sourceCard.locator('span.node-confidence').textContent(),'Confidence —');assert.equal(await sourceCard.locator('button.node-confidence').count(),0,'Source browsing stays read-only even for an owned map');
  assert.deepEqual(errors,[]);console.log('Confidence browser checks passed: persistent empty slots, 0/100/decimal values, create/edit/direct access, validation, cancellation and focus, root/legacy eligibility, ownership, clearing, reload, source reading and narrow layout.');
}catch(error){for(const [index,context]of browser.contexts().entries())for(const page of context.pages())await page.screenshot({path:`build/design-review/confidence-failure-${index}.png`,fullPage:true});console.error('Browser errors:',errors);throw error;}finally{await browser.close();await new Promise(r=>server.close(r));}
