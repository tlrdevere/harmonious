import assert from 'node:assert/strict';
import {alice,bob,memoryStore,seedActor,edit,view,addNode} from './accounts.test.mjs';
import {handleAccountAPI,startAccountComparison,REASONING_CAPABILITY,ADOPTION_CAPABILITY,PREMISE_CAPABILITY,REFLECTION_CAPABILITY,requiresReflectionCapability} from '../worker/account-api.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {validateWorkspace} from '../dist/workspace.mjs';

const env={APP_ORIGIN:'https://harmonious.example',SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test',SUPABASE_SECRET_KEY:'server-test',SIGNUP_MODE:'public'};
const store=memoryStore(),targets={};
for(const actor of [alice,bob]){await seedActor(store,actor);await edit(store,actor,ws=>{const map=ws.maps.find(m=>m.ownerId===actor.id);map.visibility='shared';const node=addNode(ws,actor,actor.name+' position');targets[actor.id]={type:'node',mapId:map.id,nodeId:node.id};});}
const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:targets[alice.id].mapId,bMapId:targets[bob.id].mapId});
const previousCapabilities=[REASONING_CAPABILITY,ADOPTION_CAPABILITY,PREMISE_CAPABILITY].join(', '),currentCapabilities=previousCapabilities+', '+REFLECTION_CAPABILITY;
const request=(actor,capabilities=currentCapabilities,input,path='/api/workspace')=>handleAccountAPI(new Request(env.APP_ORIGIN+path,{method:input?path==='/api/comparisons'?'POST':'PUT':'GET',headers:{origin:env.APP_ORIGIN,'X-Harmonious-Capabilities':capabilities,...(input?{'content-type':'application/json'}:{})},...(input?{body:JSON.stringify(input)}:{})}),env,{store,auth:{identify:async()=>({actor,cookies:[]})}});
const put=(actor,record,revision=0,capabilities=currentCapabilities)=>request(actor,capabilities,{changes:[{kind:'discussion',id:record.id,expectedRevision:revision,value:record}]});
const workspace=async actor=>(await view(store,actor)).workspace;
let response=await request(alice,previousCapabilities);assert.equal(response.status,200);assert.equal((await response.json()).workspace.schemaVersion,5,'Unaffected previous clients retain schema 5');
const sourceMaps=structuredClone((await workspace(alice)).maps);
const point=makeDiscussion(await workspace(alice),{comparisonId:thread.id,kind:'reflection',action:'disagreement_point',layer:'arguments',target:targets[bob.id],body:'We differ about what this evidence establishes.',reflection:{category:'reasoning'}},alice.id);
let before=await store.snapshot();response=await put(alice,point,0,previousCapabilities);assert.equal(response.status,409);let error=await response.json();assert.equal(error.code,'CLIENT_UPDATE_REQUIRED');assert.equal(error.requiredCapability,REFLECTION_CAPABILITY);assert.match(error.error,/drafts have not been discarded/);assert.deepEqual(await store.snapshot(),before);
response=await put(alice,point);assert.equal(response.status,200);before=await store.snapshot();response=await put(alice,point);assert.equal(response.status,200);assert.equal((await response.json()).replayed,true);assert.deepEqual(await store.snapshot(),before,'Lost response retries must not duplicate a point');
for(const actor of [alice,bob]){response=await request(actor,previousCapabilities);assert.equal(response.status,409);assert.equal((await response.json()).requiredCapability,REFLECTION_CAPABILITY);}
response=await request(bob,previousCapabilities,{aMapId:targets[alice.id].mapId,bMapId:targets[bob.id].mapId},'/api/comparisons');assert.equal(response.status,409,'Starting a comparison cannot bypass the capability guard');
response=await request(bob);assert.equal(response.status,200);const shared=(await response.json()).workspace;assert.equal(shared.schemaVersion,6);assert.deepEqual(shared.discussions.find(r=>r.id===point.id),point);

const outcome=async(actor,body,result)=>makeDiscussion(await workspace(actor),{comparisonId:thread.id,kind:'reflection',action:'outcome',layer:'arguments',target:{type:'entry',entryId:point.id},body,reflection:{result,nextStep:'Compare the underlying observations.'}},actor.id);
const a=await outcome(alice,'I need more evidence.','more_work'),b=await outcome(bob,'I understand the difference but retain my position.','difference_understood');
const responses=await Promise.all([put(alice,a),put(bob,b)]);assert.deepEqual(responses.map(r=>r.status),[200,200],'Both participants may independently save their assessments');
let ws=await workspace(alice);assert.deepEqual(ws.maps,sourceMaps,'Reflection records do not change either source map');assert.equal(ws.discussions.filter(r=>r.action==='outcome').length,2);assert.deepEqual(ws.discussions.find(r=>r.id===b.id),b);
const duplicate={...structuredClone(a),id:'duplicate-outcome',body:'A second current assessment.',reflection:{result:'changed_position',nextStep:''}};before=await store.snapshot();response=await put(alice,duplicate);assert.equal(response.status,409);assert.match((await response.json()).error,/existing assessment/);assert.deepEqual(await store.snapshot(),before,'One author cannot accumulate conflicting current outcomes');
const revised=makeDiscussion(ws,{...a,body:'My view changed after reviewing the observations.',reflection:{result:'changed_position',nextStep:''}},alice.id,a);
response=await put(bob,revised,1);assert.equal(response.status,403,'A participant cannot revise someone else’s outcome');response=await put(alice,revised,1);assert.equal(response.status,200);
ws=await workspace(bob);assert.deepEqual(ws.discussions.find(r=>r.id===a.id).history[0].reflection,a.reflection);assert.deepEqual(ws.discussions.find(r=>r.id===b.id),b);
for(const version of [2,3,4,5,6]){const portable=structuredClone(ws),authored=structuredClone(portable.discussions);portable.schemaVersion=version;validateWorkspace(portable);assert.equal(portable.schemaVersion,6);assert.deepEqual(portable.discussions,authored,'Portable upgrades retain authored annotations and history');}
assert(requiresReflectionCapability([{history:[{kind:'reflection',reflection:{category:'facts'}}]}]));assert(!requiresReflectionCapability([{kind:'inquiry',action:'question',history:[]}]),'The inquiry preset needs no new record kind');

await edit(store,alice,w=>{w.maps.find(m=>m.id===targets[alice.id].mapId).visibility='private';});
response=await request(bob,previousCapabilities);assert.equal(response.status,200);const hidden=(await response.json()).workspace;assert.equal(hidden.schemaVersion,5);assert(!hidden.discussions.some(r=>[point.id,a.id,b.id].includes(r.id)),'Private comparisons hide annotations, including the recipient’s own outcome');
console.log('Reflection API checks passed: capability recovery, schema compatibility, two-author outcomes, safe replay, authored history, unchanged maps and private projection.');
