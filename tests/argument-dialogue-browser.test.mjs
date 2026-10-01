import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {accountWorkspace,saveAccountChanges,startAccountComparison} from '../worker/account-api.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {synchronizeIdeas} from '../dist/adoption.mjs';

// Two disposable accounts exercise the mode-specific grammar and explicit map edits.
const playwright=process.env.HARMONIOUS_PLAYWRIGHT;if(!playwright)throw Error('Set HARMONIOUS_PLAYWRIGHT.');
const {chromium}=await import(pathToFileURL(playwright)),store=memoryStore(),ids={};
for(const actor of [alice,bob]){await seedActor(store,actor);await edit(store,actor,ws=>{const map=ws.maps.find(m=>m.ownerId===actor.id);map.visibility='shared';map.name=actor.name+' reflection map';for(const title of actor===alice?['Evening meeting','Quiet source without reasons','Nested source']:['Daytime meeting']){const n=addNode(ws,actor,title);n.kind='position';n.parent=title==='Nested source'?ids['Evening meeting']:'status';n.summary='Original source explanation for '+title;ids[title]=n.id;}synchronizeIdeas(ws,map);});}
await edit(store,bob,ws=>{const m=ws.maps.find(m=>m.ownerId===bob.id);m.nodes.find(n=>n.id===ids['Daytime meeting']).sourceUrl='https://example.org/survey';for(const [title,frame]of [['Bob reason','status'],['Bob action','action'],['Bob goal','goal']]){const n=addNode(ws,bob,title);n.kind='position';n.parent=frame;ids[title]=n.id;}m.relations=[{id:'bob-reason-edge',from:ids['Bob reason'],to:ids['Daytime meeting'],type:'reason',note:''},{id:'bob-cause-edge',from:ids['Daytime meeting'],to:ids['Bob reason'],type:'cause',note:''},{id:'bob-addresses-edge',from:ids['Daytime meeting'],to:ids['Bob action'],type:'addresses',note:''},{id:'bob-enables-edge',from:ids['Bob action'],to:ids['Bob goal'],type:'enables',note:''}];synchronizeIdeas(ws,m);});
const initial=(await view(store,alice)).workspace,aMap=initial.maps.find(m=>m.ownerId===alice.id),bMap=initial.maps.find(m=>m.ownerId===bob.id),at={type:'node',mapId:aMap.id,nodeId:ids['Evening meeting']};
const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:aMap.id,bMapId:bMap.id});
const seed=async(actor,input)=>{let result;await edit(store,actor,ws=>{result=makeDiscussion(ws,{comparisonId:thread.id,...input},actor.id);ws.discussions.push(result);});return result;};
const reason=await seed(alice,{kind:'argument',action:'reason',target:at,body:'Most respondents prefer evening.'}),child=await seed(alice,{kind:'argument',action:'reason',target:{type:'entry',entryId:reason.id},body:'Eighteen replies chose the evening slot.'}),challenge=await seed(bob,{kind:'argument',action:'challenge',target:{type:'inference',entryId:reason.id},body:'Respondents may not represent all members.'});
const foldedPosition=await seed(bob,{kind:'interaction',action:'endorse',target:at,body:'',interaction:{mode:'compare',options:[]}}),foldedRequest=await seed(alice,{kind:'counterpart',action:'counterpart',target:{type:'node',mapId:aMap.id,nodeId:ids['Nested source']},body:''});
const writes=[],errors=[];
const json=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),actor=req.headers['x-test-actor']==='bob'?bob:alice;if(url.pathname.startsWith('/api/')){let raw='';for await(const chunk of req)raw+=chunk;const input=raw?JSON.parse(raw):null;if(url.pathname==='/api/session'){json(res,200,{configured:true,actor,signup:{mode:'public'}});return;}if(url.pathname==='/api/comparisons'){json(res,200,await startAccountComparison(store,actor.id,input));return;}if(url.pathname==='/api/workspace'&&req.method==='PUT'){const result=await saveAccountChanges(store,actor.id,input.changes);writes.push(input.changes);json(res,200,result);return;}json(res,200,await accountWorkspace(store,actor));return;}const name=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!/^[a-z0-9.-]+$/.test(name)){res.writeHead(404);res.end();return;}let content=await readFile(resolve('dist',name),'utf8');if(name==='index.html')content=content.replace('src="./app.mjs"','src="./beta-boot.mjs"').replace('</head>','<link rel="stylesheet" href="./accounts.css"></head>');res.setHeader('content-type',name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'text/javascript');res.end(content);}catch(e){json(res,e.status||500,{error:e.message});}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true,channel:process.env.HARMONIOUS_BROWSER||'msedge'});
try{
 await mkdir('build/design-review',{recursive:true});
 const pages=[];for(const actor of ['alice','bob']){const ctx=await browser.newContext({reducedMotion:'reduce',viewport:{width:1440,height:1000},extraHTTPHeaders:{'x-test-actor':actor}});const p=await ctx.newPage();p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.message));pages.push(p);}const [a,b]=pages;
 const url=origin+'/#'+new URLSearchParams({comparison:thread.id,view:'dialogue',map:bMap.id,node:ids['Daytime meeting']});
 const pop=p=>p.locator('.discussion-popover'),card=(p,id)=>p.locator('[data-dialogue-entry="'+id+'"]'),click=(p,label)=>pop(p).getByRole('button',{name:label,exact:true}).click();
 const close=async p=>{if(await pop(p).isVisible())await click(p,'Close');};
 const focusClick=async locator=>{await locator.focus();await locator.press('Enter');};
 const records=async()=>((await view(store,alice)).workspace.discussions.filter(r=>r.kind==='interaction'&&r.interaction.mode==='argument').sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)));
 const saved=async p=>{await p.waitForFunction(()=>document.getElementById('storage-status').textContent==='All changes saved');await pop(p).getByRole('button',{name:'Edit',exact:true}).waitFor();};
 let visit=0;const load=async p=>{await p.goto(url.replace('/#','/?visit='+(++visit)+'#'));await p.locator('.argument-dialogue').waitFor({state:'visible'});};
 await load(a);await card(a,'claim').getByRole('button',{name:'Dispute reasoning',exact:true}).click();
 await a.locator('input[value="reasoning"]').check();await a.locator('#interaction-comment').fill('The survey may omit people who work nights.');await click(a,'Send dispute');await saved(a);const dispute=(await records()).at(-1);
 await load(b);await focusClick(card(b,dispute.id).getByRole('button',{name:'Respond',exact:true}));await b.locator('input[value="partly_accept"]').check();await b.locator('#interaction-comment').fill('That is possible; we asked people at a daytime event.');await click(b,'Send response');await saved(b);const first=(await records()).at(-1);
 await load(a);await focusClick(card(a,first.id).getByRole('button',{name:'Reply',exact:true}));assert.match(await pop(a).innerText(),/Replying to Bob/);assert.equal(await a.locator('#interaction-comment').evaluate(e=>e===document.activeElement),true);
 await a.locator('#interaction-comment').fill('Could we ask the night shift separately?');await click(a,'Send reply');await saved(a);const follow=(await records()).at(-1);assert.equal(follow.interaction.replyTo.entryId,first.id);
 await close(a);await a.getByRole('button',{name:'Chronological log',exact:true}).click();await pop(a).locator('[data-dispute="'+dispute.id+'"] summary').click();assert.match(await pop(a).innerText(),/Could we ask the night shift/);await close(a);
 await focusClick(card(a,first.id).getByRole('button',{name:'Reply',exact:true}));await a.locator('#interaction-comment').fill('Another question: how many people attended?');await click(a,'Send reply');await saved(a);const sibling=(await records()).at(-1);assert.equal(sibling.interaction.replyTo.entryId,first.id);
 await load(b);await focusClick(card(b,follow.id).getByRole('button',{name:'Reply',exact:true}));await b.locator('#interaction-comment').fill('Yes, we can do a separate survey.');await click(b,'Send reply');await saved(b);const nested=(await records()).at(-1);assert.equal(nested.interaction.replyTo.entryId,follow.id);
 // Placement is shared, remains attached to the selected response and is visible in the log.
 for(const [side,actorPage]of [['above',a],['below',b]]){
  await load(actorPage);await focusClick(card(actorPage,first.id).getByRole('button',{name:'Reply '+side,exact:true}));
  assert.match(await pop(actorPage).innerText(),/Placement does not change/);
  await actorPage.locator('#interaction-comment').fill('Placed '+side+' the first response');await click(actorPage,'Send reply');await saved(actorPage);
  const r=(await records()).at(-1);assert.equal(r.interaction.placement,side);assert.equal(r.interaction.replyTo.entryId,first.id);ids[side]=r.id;
 }
 await load(b);
 const geometry=await b.locator('.dialogue-card').evaluateAll(els=>els.map(e=>{const m=new DOMMatrix(e.style.transform);return {id:e.dataset.dialogueEntry,x:m.e,y:m.f,w:e.offsetWidth,h:e.offsetHeight};}));
 const parent=geometry.find(r=>r.id===first.id),up=geometry.find(r=>r.id===ids.above),down=geometry.find(r=>r.id===ids.below);
 assert(up.y+up.h<parent.y);assert(down.y>parent.y+parent.h);
 for(const p of geometry)for(const q of geometry)if(p.id!==q.id)assert(!(p.x<q.x+q.w&&p.x+p.w>q.x&&p.y<q.y+q.h&&p.y+p.h>q.y));
 await focusClick(card(b,ids.below).getByRole('button',{name:'Details',exact:true}));await click(b,'Edit');await b.locator('#interaction-comment').fill('Edited reply still below');await click(b,'Save changes');await saved(b);assert.equal((await records()).find(r=>r.id===ids.below).interaction.placement,'below');
 await close(b);await b.locator('.dialogue-canvas').getByRole('button',{name:'Fit dialogue',exact:true}).click();
 await b.screenshot({path:'build/design-review/argument-dialogue-desktop.png'});
 const rectangles=await b.locator('.dialogue-card').evaluateAll(els=>els.map(e=>({id:e.dataset.dialogueEntry,x:e.offsetLeft,y:e.offsetTop,transform:e.style.transform,w:e.offsetWidth,h:e.offsetHeight})));assert(rectangles.length>=6);
 // Same saved records through refresh/reload and deep links.
 await load(a);assert(await card(a,nested.id).count());await focusClick(card(a,nested.id).getByRole('button',{name:'Details',exact:true}));assert.match(a.url(),/entry=/);
 await close(a);await a.getByRole('button',{name:'Back to comparison',exact:true}).click();assert.equal(await a.locator('.argument-dialogue').isVisible(),false);await pop(a).getByRole('button',{name:'Open argument canvas',exact:true}).click();assert(await a.locator('.argument-dialogue').isVisible());

 // Refresh a changed contribution without leaving the dialogue.
 await close(a);await a.getByRole('button',{name:'Refresh',exact:true}).click();await card(a,nested.id).waitFor();
 await focusClick(card(a,first.id).getByRole('button',{name:/Collapse/}));assert.equal(await card(a,nested.id).count(),0);
 await a.getByRole('button',{name:'Find',exact:true}).click();await a.getByRole('searchbox',{name:'Search interactions'}).fill('separate survey');
 await a.locator('.interaction-search-result').filter({hasText:'separate survey'}).getByRole('button',{name:'Show on map',exact:true}).click();assert(await card(a,nested.id).count());assert(await a.locator('.argument-dialogue').isVisible());await close(a);
 // A real source-node entrance preserves comparison geometry and camera on return.
 await a.getByRole('button',{name:'Back to comparison',exact:true}).click();const compareCamera=await a.locator('#compare-canvas .comparison-world').evaluate(e=>e.style.transform);
 await click(a,'Open argument canvas');await a.getByRole('button',{name:'Back to comparison',exact:true}).click();assert.equal(await a.locator('#compare-canvas .comparison-world').evaluate(e=>e.style.transform),compareCamera);
 await click(a,'Open argument canvas');await a.goBack();await a.locator('.argument-dialogue').waitFor({state:'hidden'});await a.goForward();await a.locator('.argument-dialogue').waitFor({state:'visible'});
 // Portable authoring uses the same modules and reply-target validation.
 const portable=await browser.newPage();portable.on('pageerror',e=>errors.push(e.message));await portable.goto(pathToFileURL(resolve('review/Harmonious-interactions-preview.html')).href);
 await portable.locator('#reasoning-inquiry-mode[aria-pressed="true"]').waitFor();await portable.locator('#reasoning-argument-mode').click();
 const sourceButton=portable.locator('#compare-canvas .node-main').filter({has:portable.getByText('Daytime meetings work for many members',{exact:true})}).first();await focusClick(sourceButton);await click(portable,'Open argument canvas');
 await card(portable,'claim').getByRole('button',{name:'Dispute reasoning',exact:true}).click();await portable.locator('input[value="feasibility"]').check();await click(portable,'Send dispute');await pop(portable).getByRole('button',{name:'Edit',exact:true}).waitFor();await click(portable,'Reply');await portable.locator('#interaction-comment').fill('Portable targeted follow-up');await click(portable,'Send reply');await pop(portable).getByRole('button',{name:'Edit',exact:true}).waitFor();assert.match(await portable.locator('.argument-dialogue').innerText(),/Portable targeted follow-up/);
 // Explicit discard protection when leaving a reply.
 await focusClick(card(a,nested.id).getByRole('button',{name:'Reply',exact:true}));await a.locator('#interaction-comment').fill('Keep this unfinished draft');a.once('dialog',dialog=>dialog.dismiss());await a.getByRole('button',{name:'Back to comparison',exact:true}).click();assert.equal(await a.locator('#interaction-comment').inputValue(),'Keep this unfinished draft');
 a.once('dialog',dialog=>dialog.accept());await click(a,'Close');
 // Source text remains selectable and ordinary panning does not select page text.
 await a.locator('.dialogue-canvas').getByRole('button',{name:'Fit dialogue',exact:true}).click();const surface=a.locator('.dialogue-canvas'),bounds=await surface.boundingBox();await a.mouse.move(bounds.x+20,bounds.y+30);await a.mouse.down();await a.mouse.move(bounds.x+120,bounds.y+55,{steps:5});await a.mouse.up();assert.equal(await a.evaluate(()=>getSelection().toString()),'');
 await a.setViewportSize({width:430,height:900});await a.screenshot({path:'build/design-review/argument-dialogue-narrow.png'});assert(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await a.reload();await a.locator('.argument-dialogue').waitFor({state:'visible'});
 assert.deepEqual(errors,[]);console.log('Two-account node dialogue, targeted branching replies, log parity, return navigation, drafts, reload, pan and narrow layout passed.');
}catch(e){console.log('Browser failure:',e.message);for(const p of browser.contexts().flatMap(c=>c.pages()))console.log((await p.locator('.argument-dialogue').innerText()).slice(-5000));throw e;}finally{await browser.close();await new Promise(r=>server.close(r));}
