import assert from 'node:assert/strict';
import {alice,bob,memoryStore,seedActor,edit,view,addNode} from './accounts.test.mjs';
import {handleAccountAPI,startAccountComparison,REASONING_CAPABILITY,ADOPTION_CAPABILITY,PREMISE_CAPABILITY,requiresPremiseCapability} from '../worker/account-api.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {nodeWording,synchronizeIdeas} from '../dist/adoption.mjs';
import {validateWorkspace} from '../dist/workspace.mjs';

const env={APP_ORIGIN:'https://harmonious.example',SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test',SUPABASE_SECRET_KEY:'server-test',SIGNUP_MODE:'public'};
const store=memoryStore(),ids={};
for(const actor of [alice,bob]){await seedActor(store,actor);await edit(store,actor,ws=>{const map=ws.maps.find(m=>m.ownerId===actor.id);map.visibility='shared';const nodes=[addNode(ws,actor,'Main position'),addNode(ws,actor,'An existing supporting position')];for(const node of nodes)node.kind='position';ids[actor.id]=nodes.map(n=>n.id);synchronizeIdeas(ws,map);});}
let ws=(await view(store,alice)).workspace;
const a=ws.maps.find(m=>m.ownerId===alice.id),b=ws.maps.find(m=>m.ownerId===bob.id);
const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:a.id,bMapId:b.id});
ws=(await view(store,alice)).workspace;
const map=ws.maps.find(m=>m.id===a.id),node=map.nodes.find(n=>n.id===ids[alice.id][1]);
const premise={mapId:map.id,nodeId:node.id,ideaId:node.ideaId,ideaVersion:node.ideaVersion,wording:nodeWording(map,node),contexts:[]};
const reason=makeDiscussion(ws,{comparisonId:thread.id,kind:'argument',action:'reason',target:{type:'node',mapId:a.id,nodeId:ids[alice.id][0]},body:node.title,premise},alice.id);
assert.deepEqual(reason.premise,premise);
const oldCapabilities=[REASONING_CAPABILITY,ADOPTION_CAPABILITY].join(', '),allCapabilities=[oldCapabilities,PREMISE_CAPABILITY].join(', ');
const request=(capabilities,changes,actor=alice,path='/api/workspace')=>handleAccountAPI(new Request(env.APP_ORIGIN+path,{method:changes?'PUT':'GET',headers:{origin:env.APP_ORIGIN,'X-Harmonious-Capabilities':capabilities,...(changes?{'content-type':'application/json'}:{})},...(changes?{body:JSON.stringify({changes})}:{})}),env,{store,auth:{identify:async()=>({actor,cookies:[]})}});
let response=await request(oldCapabilities);assert.equal(response.status,200);assert.equal((await response.json()).workspace.schemaVersion,4,'Unaffected older clients retain their understood envelope');
const changes=[{kind:'discussion',id:reason.id,expectedRevision:0,value:reason}],before=await store.snapshot();
response=await request(oldCapabilities,changes);assert.equal(response.status,409);let error=await response.json();assert.equal(error.requiredCapability,PREMISE_CAPABILITY);assert.equal(error.code,'CLIENT_UPDATE_REQUIRED');assert.match(error.error,/drafts have not been discarded/);assert.deepEqual(await store.snapshot(),before,'An older client cannot introduce a reference it does not understand');
response=await request(allCapabilities,changes);assert.equal(response.status,200);
const persisted=await store.snapshot();response=await request(allCapabilities,changes);assert.equal(response.status,200);assert.equal((await response.json()).replayed,true);assert.deepEqual(await store.snapshot(),persisted,'A lost response retry does not create another use of the position');
for(const actor of [alice,bob]){response=await request(oldCapabilities,undefined,actor);assert.equal(response.status,409);assert.equal((await response.json()).requiredCapability,PREMISE_CAPABILITY);}
response=await request(allCapabilities,undefined,bob);assert.equal(response.status,200);const shared=(await response.json()).workspace;assert.equal(shared.schemaVersion,5);assert.deepEqual(shared.discussions.find(r=>r.id===reason.id).premise,premise,'The other participant receives the exact reviewed reference');
for(const version of [2,3,4,5]){
  const portable=structuredClone(shared),authored=structuredClone(portable.discussions);portable.schemaVersion=version;validateWorkspace(portable);assert.equal(portable.schemaVersion,5);assert.deepEqual(portable.discussions,authored,'Envelope upgrade retains referenced wording and history');
}
assert(requiresPremiseCapability([{history:[{premise:{mapId:'older-map'}}]}]),'Older reference history still requires the new reader');
assert(!requiresPremiseCapability([{kind:'argument',action:'reason',body:'Written reason',history:[]}]),'Written reasons retain their previous compatibility');
await edit(store,alice,w=>{w.maps.find(m=>m.id===a.id).visibility='private';});
response=await request(oldCapabilities,undefined,bob);assert.equal(response.status,200);const privateView=(await response.json()).workspace;assert.equal(privateView.schemaVersion,4);assert(!privateView.discussions.some(r=>r.id===reason.id),'Inaccessible references neither leak nor block an unaffected old client');
console.log('Premise API checks passed: capability negotiation, backward-compatible envelopes, two-account references, safe retry, portable upgrades, historical capability and privacy.');
