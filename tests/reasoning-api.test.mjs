import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {alice,bob,memoryStore,seedActor,edit,view,addNode} from './accounts.test.mjs';
import {handleAccountAPI,startAccountComparison,saveAccountChanges,REASONING_CAPABILITY} from '../worker/account-api.mjs';
import {orderAccountChanges} from '../worker/account-policy.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {accountKey} from '../dist/account-model.mjs';
import {validateWorkspace} from '../dist/workspace.mjs';
import {AccountWorkspace} from '../dist/account-ui.mjs';
import {createOwnedMap} from '../dist/adoption.mjs';
import {makeDefinition,definitionReference} from '../dist/definitions.mjs';

async function prepareChain(store){
  for(const actor of [alice,bob])await edit(store,actor,ws=>{ws.maps.find(m=>m.ownerId===actor.id).visibility='shared';addNode(ws,actor,'Reasoning boundary claim');});
  const ws=(await view(store,alice)).workspace,a=ws.maps.find(m=>m.ownerId===alice.id),b=ws.maps.find(m=>m.ownerId===bob.id);
  const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:a.id,bMapId:b.id});
  ws.comparisonThreads=[...ws.comparisonThreads.filter(t=>t.id!==thread.id),thread];
  const parent=makeDiscussion(ws,{comparisonId:thread.id,kind:'argument',action:'reason',target:{type:'node',mapId:a.id,nodeId:a.nodes.at(-1).id},body:'First reason.'},alice.id);ws.discussions.push(parent);
  const child=makeDiscussion(ws,{comparisonId:thread.id,kind:'argument',action:'reason',target:{type:'entry',entryId:parent.id},body:'Reason supporting the first reason.'},alice.id);ws.discussions.push(child);
  const change=r=>({kind:'discussion',id:r.id,expectedRevision:0,value:r});
  return {ws,a,b,thread,parent,child,reversed:[change(child),change(parent)]};
}

export async function exerciseReasoningDatabaseBoundary(store){
  const {parent,child,thread,reversed,b}=await prepareChain(store),snapshot=await store.snapshot();
  await assert.rejects(()=>store.commit(alice.id,snapshot.revision,reversed),/target unavailable/,'A direct child-first SQL batch is rejected atomically');
  assert.deepEqual(await store.snapshot(),snapshot);
  await saveAccountChanges(store,alice.id,reversed);
  const fresh=await store.snapshot();assert(fresh.records.some(r=>r.id===child.id));
  let working=(await view(store,bob)).workspace;
  const challenge=makeDiscussion(working,{comparisonId:thread.id,kind:'argument',action:'inference',target:{type:'inference',entryId:child.id},body:'This reason does not establish that conclusion.'},bob.id);
  await saveAccountChanges(store,bob.id,[{kind:'discussion',id:challenge.id,expectedRevision:0,value:challenge}]);
  working=(await view(store,alice)).workspace;const ownChallenge=makeDiscussion(working,{comparisonId:thread.id,kind:'argument',action:'challenge',target:parent.target,body:'Questioning this own claim.'},alice.id);
  await saveAccountChanges(store,alice.id,[{kind:'discussion',id:ownChallenge.id,expectedRevision:0,value:ownChallenge}]);
  let otherMap,definition;await edit(store,alice,ws=>{otherMap=createOwnedMap(ws,{name:'Other reasoning sources',ownerId:alice.id});otherMap.visibility='shared';definition=makeDefinition(ws,{type:'definition',title:'Direct test meaning',body:'Original exact wording'},alice.id);ws.definitions.push(definition);});
  const {comparisonThread:foreignThread}=await startAccountComparison(store,alice.id,{aMapId:otherMap.id,bMapId:b.id});
  const before=await store.snapshot(),direct=async(actor,value,expectedRevision=0)=>store.commit(actor,before.revision,[{kind:'discussion',id:value.id,expectedRevision,value}]);
  await assert.rejects(()=>direct(bob.id,{...challenge,id:'sql-invalid-inference',target:{type:'inference',entryId:challenge.id}}),/active reason/);
  await assert.rejects(()=>direct(bob.id,{...parent,id:'sql-foreign-reason',authorId:bob.id}),/own ordinary node/);
  await assert.rejects(()=>direct(bob.id,{...child,id:'sql-foreign-reason-entry',authorId:bob.id}),/own reason/);
  await assert.rejects(()=>direct(alice.id,{...parent,id:'sql-reason-on-edge',target:{type:'edge',mapId:parent.target.mapId,edgeId:`structure:${parent.target.nodeId}`}}),/own position/);
  await assert.rejects(()=>direct(alice.id,{...parent,id:'sql-reason-on-inference',target:{type:'inference',entryId:child.id}}),/own position/);
  await assert.rejects(()=>direct(alice.id,{...parent,action:'challenge'},1),/reason role cannot change/);
  await assert.rejects(()=>direct(alice.id,{...ownChallenge,action:'reason'},1),/reason role cannot change/);
  const response={...challenge,id:'sql-outcome-for-reason',authorId:alice.id,kind:'reply',action:'resolve',layer:'arguments',target:{type:'entry',entryId:child.id}};
  await assert.rejects(()=>direct(alice.id,response),/Choose a challenge/);
  await assert.rejects(()=>direct(alice.id,{...response,id:'sql-other-challenger-resolution',target:{type:'entry',entryId:challenge.id}}),/own response or resolution/);
  await assert.rejects(()=>direct(bob.id,{...response,id:'sql-self-acceptance',authorId:bob.id,action:'accept',target:{type:'entry',entryId:challenge.id}}),/own response or resolution/);
  await assert.rejects(()=>direct(alice.id,{...parent,id:'sql-forged-definition',definitionRefs:[{...definitionReference(definition),body:'Unpublished forged wording'}]}),/definitions library|wording must match/);
  await assert.rejects(()=>direct(alice.id,{...child,id:'sql-cross-thread',comparisonId:foreignThread.id}),/target unavailable/);
  assert.deepEqual(await store.snapshot(),before,'Direct trigger rejections preserve all records and revisions');
  const invalidCycle=[{kind:'discussion',id:'cycle-a',value:{target:{type:'entry',entryId:'cycle-b'}}},{kind:'discussion',id:'cycle-b',value:{target:{type:'inference',entryId:'cycle-a'}}}];
  assert.throws(()=>orderAccountChanges(invalidCycle),/cycle/);
  working=(await view(store,alice)).workspace;const withdrawn=makeDiscussion(working,{...parent,status:'withdrawn'},alice.id,parent);await saveAccountChanges(store,alice.id,[{kind:'discussion',id:parent.id,expectedRevision:1,value:withdrawn}]);
  const withdrawnSnapshot=await store.snapshot();await assert.rejects(()=>store.commit(bob.id,withdrawnSnapshot.revision,[{kind:'discussion',id:'sql-withdrawn-inference',expectedRevision:0,value:{...challenge,id:'sql-withdrawn-inference',target:{type:'inference',entryId:parent.id}}}]),/target unavailable/);assert.deepEqual(await store.snapshot(),withdrawnSnapshot);
  const withdrawalOf=record=>{const {history,...previous}=record;return {...record,status:'withdrawn',version:record.version+1,updatedAt:new Date().toISOString(),history:[...history,previous]};};
  const withdrawnChild=withdrawalOf(child);
  await store.commit(alice.id,withdrawnSnapshot.revision,[{kind:'discussion',id:child.id,expectedRevision:1,value:withdrawnChild}]);
  const afterChild=await store.snapshot(),withdrawnChallenge=withdrawalOf(challenge);
  await assert.rejects(()=>store.commit(bob.id,afterChild.revision,[{kind:'discussion',id:challenge.id,expectedRevision:1,value:{...withdrawnChallenge,body:'A hidden edit disguised as withdrawal'}}]),/target unavailable/);
  await assert.rejects(()=>store.commit(bob.id,afterChild.revision,[{kind:'discussion',id:challenge.id,expectedRevision:1,value:{...withdrawnChallenge,history:[]}}]),/target unavailable/);
  await assert.rejects(()=>store.commit(bob.id,afterChild.revision,[{kind:'discussion',id:'sql-new-after-withdrawal',expectedRevision:0,value:{...challenge,id:'sql-new-after-withdrawal'}}]),/target unavailable/);
  assert.deepEqual(await store.snapshot(),afterChild,'A withdrawal exception must not permit new work or hidden content/history edits');
  await store.commit(bob.id,afterChild.revision,[{kind:'discussion',id:challenge.id,expectedRevision:1,value:withdrawnChallenge}]);
  const final=await store.snapshot();assert.equal(final.records.find(r=>r.id===challenge.id).value.status,'withdrawn');assert.equal(final.records.find(r=>r.id===challenge.id).value.body,challenge.body,'The challenge author can withdraw it after the targeted reason was withdrawn');
  console.log('Direct PostgreSQL reasoning targets, immutable role, author outcomes and parent-first atomic writes passed.');
}

async function exerciseReasoningAPI(){
  const env={APP_ORIGIN:'https://harmonious.example',SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test',SUPABASE_SECRET_KEY:'server-test',BETA_INVITE_EMAILS:'alice@example.test,bob@example.test'};
  const store=memoryStore();for(const actor of [alice,bob])await seedActor(store,actor);
  const {parent,child,reversed,a}=await prepareChain(store);
  const request=(body,capable=false,actor=alice)=>handleAccountAPI(new Request(env.APP_ORIGIN+'/api/workspace',{method:body?'PUT':'GET',headers:{origin:env.APP_ORIGIN,...(body?{'content-type':'application/json'}:{}),...(capable?{'X-Harmonious-Capabilities':REASONING_CAPABILITY}:{})},...(body?{body:JSON.stringify(body)}:{})}),env,{store,auth:{identify:async()=>({actor,cookies:[]})}});
  let response=await request();assert.equal(response.status,200);assert.equal((await response.json()).workspace.schemaVersion,2,'Older clients can open unaffected workspaces');
  const before=await store.snapshot();response=await request({changes:reversed});assert.equal(response.status,409);assert.equal((await response.json()).code,'CLIENT_UPDATE_REQUIRED');assert.deepEqual(await store.snapshot(),before,'New writes require the explicit capability');
  let written;const commit=store.commit;store.commit=(actor,generation,changes)=>{written=changes;return commit(actor,generation,changes);};
  response=await request({changes:reversed},true);assert.equal(response.status,200);assert.deepEqual(written.filter(c=>c.kind==='discussion').map(c=>c.id),[parent.id,child.id]);
  response=await request(undefined,true);assert.equal(response.status,200);const data=await response.json();assert.equal(data.workspace.schemaVersion,3);assert(data.workspace.discussions.some(r=>r.id===child.id));
  const portable=structuredClone(data.workspace);portable.schemaVersion=2;const authored=structuredClone(portable.discussions);validateWorkspace(portable);assert.equal(portable.schemaVersion,4);assert.deepEqual(portable.discussions,authored,'Upgrading the envelope does not rewrite authored records');
  response=await request();assert.equal(response.status,409);const error=await response.json();assert.equal(error.code,'CLIENT_UPDATE_REQUIRED');assert(!JSON.stringify(error).includes(parent.body));
  const snapshot=await store.snapshot();response=await request({changes:[{kind:'map',id:a.id,expectedRevision:data.revisions[accountKey('map',a.id)],value:{...data.workspace.maps.find(m=>m.id===a.id),name:'Stale edit'}}]});assert.equal(response.status,409);assert.deepEqual(await store.snapshot(),snapshot);
  const bobBefore=(await view(store,bob)).workspace;
  await edit(store,alice,ws=>{ws.maps.find(m=>m.id===a.id).visibility='private';});
  response=await request(undefined,false,bob);assert.equal(response.status,200,'Hidden reasoning does not reveal itself through a capability error');const hidden=await response.json();assert(!hidden.workspace.discussions.some(r=>r.id===parent.id));assert(!JSON.stringify(hidden).includes(parent.body));
  const originalFetch=globalThis.fetch;let sent;globalThis.fetch=async(path,options)=>{sent=options;return Response.json(error,{status:409});};
  const draft={body:'Keep this unsaved explanation'},controller={workspace:{maps:[]},discussion:{pending:draft},message(value){this.lastMessage=value;}},state={controller,blocked:false,status(value){this.lastStatus=value;}};
  try{await assert.rejects(()=>AccountWorkspace.prototype.request.call(state,'/api/workspace'),e=>e.code==='CLIENT_UPDATE_REQUIRED');assert(sent.headers['X-Harmonious-Capabilities'].includes(REASONING_CAPABILITY));assert(state.blocked);assert.equal(controller.discussion.pending,draft);assert.equal(draft.body,'Keep this unsaved explanation');assert(controller.lastMessage.includes('drafts have not been discarded'));}finally{globalThis.fetch=originalFetch;}
  const driftState={actor:alice,controller:{...controller,discussion:{dirty:true,pending:draft}},status(){}};
  assert.equal(AccountWorkspace.prototype.accept.call(driftState,{actor:bob},true),false);assert.equal(driftState.actor,alice);assert.equal(driftState.controller.discussion.pending,draft);assert(driftState.blocked,'An account change cannot replace unfinished work');
  const originalDocument=globalThis.document;let cleared=false,resets=0;
  globalThis.document={body:{classList:{remove(){}}}};
  const privacyController={workspace:bobBefore,activeMap:()=>null,mode:'library',populateMaps(){},participation:{refresh(){}},discussion:{target:{type:'inference',entryId:child.id},host:{hidden:false,replaceChildren(){cleared=true;}},reasoning:{reset(){resets++;}}}};
  try{assert.equal(AccountWorkspace.prototype.accept.call({actor:bob,controller:privacyController},hidden),true);assert(privacyController.discussion.host.hidden);assert(cleared);assert.equal(resets,1);assert.equal(privacyController.discussion.target,null);}finally{globalThis.document=originalDocument;}
  console.log('Reasoning capability negotiation, stale-client rejection, draft preservation, private projection and schema3 round trips passed.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await exerciseReasoningAPI();
