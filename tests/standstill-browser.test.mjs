import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {accountWorkspace,saveAccountChanges,startAccountComparison} from '../worker/account-api.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {synchronizeIdeas} from '../dist/adoption.mjs';
import {standstillState} from '../dist/standstill.mjs';

const store=memoryStore(),ids={},errors=[],writes=[];
for(const actor of [alice,bob]){
 await seedActor(store,actor);
 await edit(store,actor,ws=>{const map=ws.maps.find(m=>m.ownerId===actor.id);map.visibility='shared';map.name=actor.name+' map';const node=addNode(ws,actor,actor===bob?'Daytime meetings work':'Evening meetings work');node.parent='status';node.kind='position';node.summary='Full source description including the evidence and scope of the meeting proposal.';ids[actor.name]=node.id;synchronizeIdeas(ws,map);});
}
const initial=(await view(store,alice)).workspace,aMap=initial.maps.find(m=>m.ownerId===alice.id),bMap=initial.maps.find(m=>m.ownerId===bob.id),target={type:'node',mapId:bMap.id,nodeId:ids.Bob};
const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:aMap.id,bMapId:bMap.id});
const seed=async(actor,input)=>{let result;await edit(store,actor,ws=>{result=makeDiscussion(ws,{comparisonId:thread.id,...input},actor.id);ws.discussions.push(result);});return result;};
const dispute=await seed(alice,{kind:'interaction',action:'dispute',target,body:'The survey omitted night workers.',interaction:{mode:'argument',options:['factual_basis']}});
const reply=await seed(bob,{kind:'interaction',action:'respond',target:{type:'entry',entryId:dispute.id},body:'We disagree about how representative the survey must be.',interaction:{mode:'argument',options:['partly_accept']}});
const sibling=await seed(alice,{kind:'interaction',action:'dispute',target,body:'A separate feasibility question remains open.',interaction:{mode:'argument',options:['feasibility']}});
const beforeMaps=structuredClone((await view(store,alice)).workspace.maps);
const json=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost'),actor=req.headers['x-test-actor']==='bob'?bob:alice;
 if(url.pathname.startsWith('/api/')){let raw='';for await(const chunk of req)raw+=chunk;const input=raw?JSON.parse(raw):null;
  if(url.pathname==='/api/session')return json(res,200,{configured:true,actor,signup:{mode:'public'}});
  if(url.pathname==='/api/comparisons')return json(res,200,await startAccountComparison(store,actor.id,input));
  if(url.pathname==='/api/workspace'&&req.method==='PUT'){const result=await saveAccountChanges(store,actor.id,input.changes);writes.push(input.changes);return json(res,200,result);}
  return json(res,200,await accountWorkspace(store,actor));
 }
 const name=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!/^[a-z0-9.-]+$/.test(name)){res.writeHead(404);res.end();return;}
 let body=await readFile(resolve('dist',name),'utf8');if(name==='index.html')body=body.replace('src="./app.mjs"','src="./beta-boot.mjs"').replace('</head>','<link rel="stylesheet" href="./accounts.css"></head>');
 res.setHeader('content-type',name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'text/javascript');res.end(body);
 }catch(error){json(res,error.status||500,{error:error.message});}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const {chromium}=await import(pathToFileURL(process.env.HARMONIOUS_PLAYWRIGHT)),browser=await chromium.launch({headless:true,channel:process.env.HARMONIOUS_BROWSER||'msedge'});
try{
 await mkdir('build/design-review',{recursive:true});
 const pages=[];for(const actor of ['alice','bob']){const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:1440,height:1000},extraHTTPHeaders:{'x-test-actor':actor}});const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));pages.push(page);}const[a,b]=pages;
 const pop=p=>p.locator('.discussion-popover'),card=(p,id)=>p.locator('[data-dialogue-entry="'+id+'"]');
 const press=async locator=>{await locator.focus();await locator.press('Enter');};
 const click=(p,label)=>press(pop(p).getByRole('button',{name:label,exact:true}));
 const close=async p=>{if(await pop(p).isVisible())await click(p,'Close');};
 let visit=0;const load=async(p,entry=null)=>{const query=new URLSearchParams({comparison:thread.id,view:'dialogue',map:bMap.id,node:ids.Bob,...(entry?{entry}:{})});await p.goto(origin+'/?visit='+(++visit)+'#'+query);await p.locator('.argument-dialogue').waitFor({state:'visible'});};
 const workspace=async()=>((await view(store,alice)).workspace);
 const proposals=async()=>(await workspace()).discussions.filter(r=>r.kind==='standstill'&&r.action==='propose_standstill');
 const saved=async p=>{await p.waitForFunction(()=>document.getElementById('storage-status').textContent==='All changes saved');await p.locator('#standstill-explanation').waitFor({state:'hidden'});};
 const open=async(p,proposal)=>{await load(p,proposal.id);await pop(p).waitFor({state:'visible'});};
 await load(a);await press(card(a,reply.id).getByRole('button',{name:'Propose standstill',exact:true}));
 assert.match(await pop(a).innerText(),/Daytime meetings work/);
 await a.locator('#standstill-explanation').fill('   ');await click(a,'Propose standstill');assert.equal((await proposals()).length,0);
 await a.locator('#standstill-explanation').fill('We cannot proceed because our standards for representative evidence differ.');
 // Lose an acknowledgement after the real server committed; retry must recover one proposal.
 let lostAcknowledgement=false;await a.route('**/api/workspace',async route=>{if(!lostAcknowledgement&&route.request().method()==='PUT'){lostAcknowledgement=true;await route.fetch();return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Simulated lost acknowledgement'})});}return route.continue();});
 await click(a,'Propose standstill');await pop(a).getByText('Simulated lost acknowledgement',{exact:true}).waitFor();
 assert.match(await a.locator('#standstill-explanation').inputValue(),/standards for representative evidence/);
 await click(a,'Propose standstill');await saved(a);let proposal=(await proposals())[0];assert.equal((await proposals()).length,1);
 assert.equal(standstillState(await workspace(),proposal).state,'proposed');
 await open(b,proposal);await click(b,'Suggest changes');await b.locator('#standstill-suggestion').fill('We need a larger night-shift sample before either conclusion is warranted.');await click(b,'Suggest changes');await b.locator('#standstill-suggestion').waitFor({state:'hidden'});
 await open(a,proposal);assert.match(await pop(a).innerText(),/larger night-shift sample/);await click(a,'Revise explanation');
 await a.locator('#standstill-explanation').fill('We need a larger night-shift sample before either conclusion is warranted.');await click(a,'Save revised proposal');await saved(a);proposal=(await proposals())[0];assert.equal(proposal.version,2);
 await open(b,proposal);await click(b,'Confirm standstill');await click(b,'Confirm standstill');await pop(b).locator('.standstill-status').filter({hasText:'Standstill confirmed'}).waitFor();assert.equal(standstillState(await workspace(),(await proposals())[0]).state,'confirmed');
 await open(a,proposal);await pop(a).getByText('Standstill confirmed',{exact:true}).first().waitFor();await close(a);
 assert.equal(await card(a,sibling.id).getByRole('button',{name:'Propose standstill',exact:true}).count(),1,'Sibling discussion stays active');
 await a.locator('.dialogue-canvas').getByRole('button',{name:'Fit dialogue',exact:true}).click();await a.screenshot({path:'build/design-review/standstill-desktop.png'});
 await a.getByRole('button',{name:'Chronological log',exact:true}).click();assert.match(await pop(a).innerText(),/Disputes \(2\)/);await click(a,'Standstills · 1 confirmed');assert.match(await pop(a).innerText(),/Standstill confirmed/);await close(a);
 await press(card(a,dispute.id).getByRole('button',{name:/Collapse/}));assert.equal(await card(a,reply.id).count(),0);
 await a.getByRole('button',{name:'Find',exact:true}).click();await a.getByRole('searchbox',{name:'Search interactions'}).fill('larger night-shift sample');await a.locator('.interaction-search-result').filter({hasText:'larger night-shift sample'}).first().getByRole('button',{name:'Show on map',exact:true}).click();await card(a,reply.id).waitFor();assert.match(await pop(a).innerText(),/larger night-shift sample/);
 await open(a,proposal);await click(a,'Resume discussion');await click(a,'Resume discussion');await pop(a).locator('.standstill-status').filter({hasText:'Discussion resumed'}).waitFor();assert.equal(standstillState(await workspace(),(await proposals())[0]).state,'resumed');
 await open(b,proposal);await pop(b).getByText('Discussion resumed',{exact:true}).first().waitFor();await close(b);
 await press(card(b,reply.id).getByRole('button',{name:'Propose standstill',exact:true}));await b.locator('#standstill-explanation').fill('A new impasse about the timing of new evidence.');await click(b,'Propose standstill');await saved(b);assert.equal((await proposals()).length,2);
 let renewed=(await proposals()).find(r=>r.id!==proposal.id);await open(a,renewed);await click(a,'Confirm standstill');await click(a,'Confirm standstill');await pop(a).locator('.standstill-status').filter({hasText:'Standstill confirmed'}).waitFor();await click(a,'Resume discussion');await click(a,'Resume discussion');await pop(a).locator('.standstill-status').filter({hasText:'Discussion resumed'}).waitFor();
 // Source-node entry requires the user to identify the precise dispute/reply.
 await close(a);await press(card(a,'claim').getByRole('button',{name:'Propose standstill',exact:true}));await click(a,'Continue');assert.equal(await a.locator('#standstill-explanation').count(),0);await a.locator('#standstill-anchor').selectOption(sibling.id);await click(a,'Continue');await a.locator('#standstill-explanation').fill('We cannot agree on the resources required.');await click(a,'Propose standstill');await saved(a);
 const third=(await proposals()).find(r=>![proposal.id,renewed.id].includes(r.id));await open(b,third);await click(b,'Confirm standstill');await click(b,'Confirm standstill');await pop(b).locator('.standstill-status').filter({hasText:'Standstill confirmed'}).waitFor();
 await edit(store,alice,ws=>{const old=ws.discussions.find(r=>r.id===sibling.id);ws.discussions=ws.discussions.map(r=>r.id===old.id?makeDiscussion(ws,{...old,body:'The resource requirement has now changed.'},alice.id,old):r);});
 await open(b,third);await pop(b).locator('.standstill-status').filter({hasText:'Needs review'}).waitFor();assert.equal(await pop(b).getByRole('button',{name:'Confirm standstill',exact:true}).count(),0);await click(b,'Resume discussion');await click(b,'Cancel');assert.equal(standstillState(await workspace(),third.id).state,'needs_review');await click(b,'Resume discussion');await click(b,'Resume discussion');await pop(b).locator('.standstill-status').filter({hasText:'Discussion resumed'}).waitFor();
 // Withdrawing one's own proposal is terminal and remains available as history.
 await close(b);await press(card(b,reply.id).getByRole('button',{name:'Propose standstill',exact:true}));await b.locator('#standstill-explanation').fill('A proposal that I subsequently withdraw.');await click(b,'Propose standstill');await saved(b);const fourth=(await proposals()).find(r=>![proposal.id,renewed.id,third.id].includes(r.id));await click(b,'Withdraw proposal');await click(b,'Withdraw proposal');await pop(b).locator('.standstill-status').filter({hasText:'Proposal withdrawn'}).waitFor();await open(a,fourth);assert.equal(await pop(a).getByRole('button',{name:'Confirm standstill',exact:true}).count(),0);
 // Closing a typed proposal requires explicit discard; declining preserves the draft.
 await close(a);await press(card(a,sibling.id).getByRole('button',{name:'Propose standstill',exact:true}));await a.locator('#standstill-explanation').fill('Keep this standstill draft');a.once('dialog',d=>d.dismiss());await a.getByRole('button',{name:'Back to comparison',exact:true}).click();assert.equal(await a.locator('#standstill-explanation').inputValue(),'Keep this standstill draft');
 a.once('dialog',d=>d.accept());await click(a,'Close');assert.equal((await proposals()).length,4);
 await open(b,renewed);await b.setViewportSize({width:430,height:900});await b.screenshot({path:'build/design-review/standstill-narrow.png'});assert(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 // The portable application preserves standstills through explicit backup and import.
 const portable=await browser.newPage();portable.setDefaultTimeout(12000);portable.on('pageerror',e=>errors.push(e.message));await portable.goto(pathToFileURL(resolve('review/Harmonious-interactions-preview.html')).href);await portable.locator('#reasoning-inquiry-mode[aria-pressed="true"]').waitFor();await portable.locator('#reasoning-argument-mode').click();await press(portable.locator('#compare-canvas .node-main').filter({has:portable.getByText('Daytime meetings work for many members',{exact:true})}).first());await click(portable,'Open argument canvas');await press(card(portable,'claim').getByRole('button',{name:'Propose standstill',exact:true}));assert.match(await pop(portable).innerText(),/Record a dispute on this node first/);await close(portable);await press(card(portable,'claim').getByRole('button',{name:'Dispute reasoning',exact:true}));await portable.locator('input[value="feasibility"]').check();await click(portable,'Send dispute');await pop(portable).getByRole('button',{name:'Edit',exact:true}).waitFor();await click(portable,'Propose standstill');await portable.locator('#standstill-explanation').fill('Portable standstill explanation');await click(portable,'Propose standstill');await pop(portable).locator('.standstill-status').filter({hasText:'Standstill proposed'}).waitFor();const downloaded=portable.waitForEvent('download');await close(portable);await portable.locator('#download-workspace').click();const backup=await downloaded,backupBytes=await readFile(await backup.path());assert.equal(JSON.parse(backupBytes).discussions.filter(r=>r.kind==='standstill').length,1);await portable.reload();await portable.locator('#workspace-file').setInputFiles({name:'standstill-backup.json',mimeType:'application/json',buffer:backupBytes});await portable.waitForFunction(()=>document.getElementById('storage-status').textContent==='Workspace file opened');await portable.locator('#reasoning-argument-mode').click();await press(portable.getByRole('button',{name:'Standstills inside: 1 proposed',exact:true}));assert.match(await pop(portable).innerText(),/Standstill proposed/);assert.match(await pop(portable).innerText(),/Portable standstill explanation/);
 assert.deepEqual((await workspace()).maps,beforeMaps);assert.deepEqual(errors,[]);assert(writes.length>=12);
 console.log('Standstill browser: node attachment, required explanation, exact two-person confirmation, suggestions/revision, lost acknowledgement, history, resume/new proposals, scoped markers, log/search, drafts and narrow layout passed.');
}catch(error){for(const page of browser.contexts().flatMap(c=>c.pages()))console.log((await page.locator('body').innerText()).slice(-4500));throw error;}
finally{await browser.close();await new Promise(r=>server.close(r));}
