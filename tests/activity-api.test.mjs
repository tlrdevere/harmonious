import assert from 'node:assert/strict';
import {alice,bob,memoryStore,seedActor,edit,view,addNode} from './accounts.test.mjs';
import {handleAccountAPI,saveAccountChanges,startAccountComparison} from '../worker/account-api.mjs';
import {handleActivity,projectActivity} from '../worker/activity-api.mjs';
import {AccountError} from '../worker/account-policy.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {standstillProposalMetadata,standstillEventMetadata} from '../dist/standstill.mjs';
import {createOwnedMap,synchronizeIdeas,endorseNodes} from '../dist/adoption.mjs';

const store=memoryStore(),refs={},outsider={id:'33333333-3333-4333-8333-333333333333',name:'Outside participant'};
for(const actor of [alice,bob,outsider])await seedActor(store,actor);
for(const actor of [alice,bob])await edit(store,actor,w=>{
 const map=w.maps.find(m=>m.ownerId===actor.id);map.visibility='shared';map.name=actor.name+' source map';const n=addNode(w,actor,actor.name+' source claim');n.parent='status';n.kind='position';refs[actor.name]={type:'node',mapId:map.id,nodeId:n.id};
 if(actor===bob){const other=addNode(w,actor,'Resulting effect');other.parent='status';map.relations.push({id:'bob-cause',type:'cause',from:n.id,to:other.id,note:'Specific causal mechanism'});refs.Edge={type:'edge',mapId:map.id,edgeId:'bob-cause'};}synchronizeIdeas(w,map);
});
const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:refs.Alice.mapId,bMapId:refs.Bob.mapId});
const put=async(actor,input,old=null)=>{const ws=(await view(store,actor)).workspace,record=makeDiscussion(ws,{comparisonId:thread.id,...input},actor.id,old),change={kind:'discussion',id:record.id,expectedRevision:(await store.snapshot()).records.find(r=>r.kind==='discussion'&&r.id===record.id)?.revision||0,value:record};await saveAccountChanges(store,actor.id,[change]);return {record,change};};
const interaction=(action,mode,target=refs.Bob,options=[],body='')=>({kind:'interaction',action,target,body,interaction:{mode,options}});
const list=(actor,input={})=>handleActivity(store,actor,'list',input);
const eventFor=(items,id)=>items.find(e=>e.recordId===id);
const env={APP_ORIGIN:'https://harmonious.example',SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test',SUPABASE_SECRET_KEY:'sb_secret_server_only',SIGNUP_MODE:'public'};
const request=(path,body,headers={})=>new Request(env.APP_ORIGIN+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{origin:env.APP_ORIGIN,'content-type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
const api=(actor,path,body,headers={})=>handleAccountAPI(request(path,body,headers),env,{store,auth:{identify:async()=>({actor,cookies:actor?['session=refreshed; HttpOnly']:[]})}});

assert.equal((await list(alice)).unreadCount,0);assert.equal((await list(bob)).items.length,0,'Account bootstrap and ordinary map changes are silent');
const agree=await put(alice,interaction('endorse','compare',refs.Bob,[],'I agree with this claim.'));let inbox=await list(bob),first=eventFor(inbox.items,agree.record.id);assert(first);assert.equal(first.eventType,'agree');assert.equal(first.actorName,'Alice');assert.equal(first.target.nodeId,refs.Bob.nodeId);assert.deepEqual(first.route,{comparison:thread.id,view:'compare',entry:agree.record.id});assert.equal((await list(alice)).items.length,0,'The represented author receives no self-alert');assert.equal((await list(outsider)).items.length,0);
assert.equal((await saveAccountChanges(store,alice.id,[agree.change])).replayed,true);assert.equal((await list(bob)).items.length,1,'A lost save acknowledgement does not duplicate activity');
const equivalent=await put(alice,{...agree.record},agree.record);assert.equal((await list(bob)).items.length,1,'A version bump alone creates no new event');
const changed=await put(alice,{...equivalent.record,body:'Clarified reason for agreement.'},equivalent.record);inbox=await list(bob);assert.equal(inbox.items.length,2);assert.equal(inbox.items[0].eventType,'interaction_changed');assert(inbox.items.every(e=>e.body==='Clarified reason for agreement.'),'Previews use the accessible current record, not saved snapshots');
await put(alice,{...changed.record,status:'withdrawn'},changed.record);assert.equal((await list(bob)).items[0].eventType,'interaction_withdrawn');
const dispute=await put(alice,interaction('dispute','argument',refs.Bob,['factual_basis'],'Why this evidence is insufficient.'));
const reply=await put(bob,{...interaction('respond','argument',{type:'entry',entryId:dispute.record.id},['reply'],'My reply to the dispute.'),interaction:{mode:'argument',options:['reply'],replyTo:{entryId:dispute.record.id,version:1},placement:'above'}});
const followup=await put(alice,{...interaction('respond','argument',{type:'entry',entryId:dispute.record.id},['reply'],'A reply to that specific response.'),interaction:{mode:'argument',options:['reply'],replyTo:{entryId:reply.record.id,version:1},placement:'below'}});
let replyItem=eventFor((await list(alice)).items,reply.record.id);assert.deepEqual(replyItem.route,{comparison:thread.id,view:'dialogue',entry:reply.record.id,map:refs.Bob.mapId,node:refs.Bob.nodeId});
let opened=await handleActivity(store,bob,'open',{id:eventFor((await list(bob)).items,followup.record.id).id});assert.equal(opened.item.route.entry,followup.record.id);assert.equal(opened.workspaceEnvelope.workspace.discussions.find(r=>r.id===followup.record.id).interaction.replyTo.entryId,reply.record.id,'Opening retains the exact recorded reply target');assert.equal(opened.item.read,false,'Resolving a navigation does not mark it read');
const edgeDispute=await put(alice,interaction('dispute','argument',refs.Edge,['consequences'],'Question this causal connection.'));assert.deepEqual(eventFor((await list(bob)).items,edgeDispute.record.id).route,{comparison:thread.id,view:'argument',entry:edgeDispute.record.id});assert.deepEqual(eventFor((await list(bob)).items,edgeDispute.record.id).target,refs.Edge);
const proposal=await put(alice,{kind:'standstill',action:'propose_standstill',target:refs.Bob,body:'We use different standards of sufficient evidence.',standstill:standstillProposalMetadata((await view(store,alice)).workspace,thread.id,reply.record.id)});
const confirmation=await put(bob,{kind:'standstill',action:'confirm_standstill',target:{type:'entry',entryId:proposal.record.id},standstill:standstillEventMetadata((await view(store,bob)).workspace,proposal.record)});
const confirmationItem=eventFor((await list(alice)).items,confirmation.record.id);assert.equal(confirmationItem.route.entry,confirmation.record.id);assert.equal(confirmationItem.route.view,'dialogue');assert.equal(confirmationItem.route.node,refs.Bob.nodeId);assert.equal(confirmationItem.groupKey,replyItem.groupKey);

// Each API operation uses the signed-in identity and its current projection.
let response=await api(null,'/api/activity');assert.equal(response.status,401);
response=await api(bob,'/api/activity');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert(response.headers.get('set-cookie').includes('session=refreshed'));assert(!JSON.stringify(await response.json()).includes('sb_secret'));
response=await api(alice,'/api/activity?actorId='+bob.id);assert.equal((await response.json()).actorId,alice.id);
for(const path of ['/api/activity/open','/api/activity/read']){response=await api(alice,path,{id:first.id,ids:[first.id],read:true,actorId:bob.id});assert.equal(response.status,404,'A body cannot switch inbox ownership');}
response=await api(outsider,'/api/activity/mute',{comparisonId:thread.id,muted:true});assert.equal(response.status,404);
response=await api(bob,'/api/activity/read',{ids:[first.id],read:true},{origin:'https://other.example'});assert.equal(response.status,403);
response=await api(bob,'/api/activity/read',{ids:[first.id],read:true},{'content-type':'text/plain'});assert.equal(response.status,415);
response=await api(bob,'/api/activity',undefined,{'X-Harmonious-Participant':alice.id,'X-Harmonious-Grant-Version':'1','X-Harmonious-Capabilities':'facilitation-v1'});assert.equal(response.status,403,'Facilitation cannot expose the represented participant inbox');
for(const input of [null,[],42,'invalid']){response=await api(bob,'/api/activity/read',input);assert.equal(response.status,400,'Malformed command payloads are client errors');}
for(const input of [{ids:[],read:true},{ids:[first.id,first.id],read:true},{ids:[1],read:true},{ids:['0'],read:true},{ids:[first.id],read:'yes'},{ids:Array(201).fill(first.id),read:true}]){response=await api(bob,'/api/activity/read',input);assert.equal(response.status,400);}
for(const query of ['?filter=invalid','?cursor=bad','?cursor='+encodeURIComponent(btoa(JSON.stringify({actorId:alice.id,filter:'all',before:first.id})))]){response=await api(bob,'/api/activity'+query);assert.equal(response.status,400);}

// Exact bounded lists bind bulk read actions. New arrivals stay unread even
// when publication races the read transaction and forces a generation retry.
inbox=await list(bob);const beforeRead=await store.snapshot(),ids=inbox.items.map(e=>e.id);
await assert.rejects(()=>handleActivity(store,bob,'read',{ids,read:true,snapshotToken:'wrong'}),e=>e.status===409);
await handleActivity(store,bob,'read',{ids,read:true,snapshotToken:inbox.snapshotToken});await handleActivity(store,bob,'read',{ids,read:true,snapshotToken:inbox.snapshotToken});assert.deepEqual(await store.snapshot(),beforeRead,'Read state never changes workspace generation');assert.equal((await list(bob,{filter:'unread'})).items.length,0);
await handleActivity(store,bob,'read',{ids:[first.id],read:false});assert.equal((await list(bob)).unreadCount,1);
let retries=0,arrival;const racing={...store,activity:async(actor,command,input)=>{if(command==='read'&&!retries++){arrival=await put(alice,interaction('request_reason','inquiry',refs.Bob,['reason'],'Arrived during mark-read.'));}return store.activity(actor,command,input);}};
await handleActivity(racing,bob,'read',{ids,read:true,snapshotToken:inbox.snapshotToken});assert.equal(retries,2);assert.equal((await list(bob)).unreadCount,1);assert.equal(eventFor((await list(bob)).items,arrival.record.id).read,false);
const blocked={...store,activity:async(actor,command,input)=>{if(command!=='snapshot'){const error=new AccountError('snapshot_changed',409);error.snapshotChanged=true;throw error;}return store.activity(actor,command,input);}};await assert.rejects(()=>handleActivity(blocked,bob,'read',{ids:[first.id],read:true}),e=>e.status===409&&/activity changed/.test(e.message));
const revision=(await store.snapshot()).revision;await handleActivity(store,bob,'mute',{comparisonId:thread.id,muted:true});assert.equal((await store.snapshot()).revision,revision);assert.equal((await list(bob)).unreadCount,1,'Muting leaves previously unread activity alone');
const muted=await put(alice,interaction('request_explanation','inquiry',refs.Bob,['scope'],'Suppressed future alert.'));let mutedItem=eventFor((await list(bob)).items,muted.record.id);assert(mutedItem.suppressed);assert.equal((await list(bob)).unreadCount,1);assert(!(await list(bob,{filter:'unread'})).items.some(e=>e.id===mutedItem.id));
await handleActivity(store,bob,'mute',{comparisonId:thread.id,muted:false});assert(eventFor((await list(bob)).items,muted.record.id).suppressed);await handleActivity(store,bob,'read',{ids:[mutedItem.id],read:false});assert.equal((await list(bob)).unreadCount,2,'Explicit mark-unread opts the suppressed item back into unread');

// Current-access checks cover references outside the comparison, descendant
// replies, assessment groups and standstill dependencies as well as source maps.
let citedRef;await edit(store,alice,w=>{const source=createOwnedMap(w,{name:'External shared reference',ownerId:alice.id});source.visibility='shared';const original=w.maps.find(m=>m.id===refs.Alice.mapId).nodes.find(n=>n.id===refs.Alice.nodeId),node={...structuredClone(original),id:crypto.randomUUID(),title:'PRIVATE REFERENCE WORDING'};delete node.ideaId;delete node.ideaVersion;source.nodes.push(node);synchronizeIdeas(w,source);citedRef={type:'node',mapId:source.id,nodeId:node.id};});
const cited=await put(alice,{...interaction('offer_reason','inquiry',refs.Bob,[],'Reference-dependent contribution.'),interaction:{mode:'inquiry',options:[],reference:citedRef}});
const citedReply=await put(bob,interaction('respond','inquiry',{type:'entry',entryId:cited.record.id},['accept'],'Reference-dependent response.'));
const citedId=eventFor((await list(bob)).items,cited.record.id).id,citedReplyId=eventFor((await list(alice)).items,citedReply.record.id).id,counts=[(await list(alice)).unreadCount,(await list(bob)).unreadCount];
await edit(store,alice,w=>{w.maps.find(m=>m.id===citedRef.mapId).visibility='private';});assert(!eventFor((await list(bob)).items,cited.record.id));assert(!eventFor((await list(alice)).items,citedReply.record.id));assert.equal((await list(alice)).unreadCount,counts[0]-1);assert.equal((await list(bob)).unreadCount,counts[1]-1);assert(!JSON.stringify(await list(bob)).includes('PRIVATE REFERENCE WORDING'));
for(const [actor,id]of [[bob,citedId],[alice,citedReplyId]]){await assert.rejects(()=>handleActivity(store,actor,'open',{id}),e=>e.status===404);await assert.rejects(()=>handleActivity(store,actor,'read',{ids:[id],read:true}),e=>e.status===404);}
await edit(store,alice,w=>{w.maps.find(m=>m.id===citedRef.mapId).visibility='shared';});assert.equal(eventFor((await list(bob)).items,cited.record.id).id,citedId,'Re-sharing restores the same event and read state');
const hiddenFamily=await store.activity(alice.id,'snapshot',{}),hiddenAnchor=hiddenFamily.records.find(r=>r.kind==='discussion'&&r.id===reply.record.id);hiddenAnchor.value.interaction.reference={target:{type:'node',mapId:(await view(store,outsider)).workspace.maps.find(m=>m.ownerId===outsider.id).id,nodeId:'status'},snapshot:{label:'HIDDEN DEPENDENCY'}};assert(!projectActivity(hiddenFamily,alice.id).items.some(e=>e.recordId===confirmation.record.id||e.recordId===reply.record.id));assert(!JSON.stringify(projectActivity(hiddenFamily,alice.id)).includes('HIDDEN DEPENDENCY'));
const hiddenAssessments=await store.activity(bob.id,'snapshot',{}),latest=hiddenAssessments.records.find(r=>r.kind==='discussion'&&r.id===agree.record.id);latest.value.history.push({interaction:{reference:{target:{type:'node',mapId:'unavailable-reference',nodeId:'hidden'}}}});assert(!projectActivity(hiddenAssessments,bob.id).items.some(e=>e.recordId===agree.record.id),'Unavailable historical references hide all notification revisions of the assessment');
const earlierStance=await put(alice,interaction('disagree','compare',refs.Bob,[],'An earlier stance.'));await new Promise(resolve=>setTimeout(resolve,2));
const newestStance=await put(alice,{...interaction('endorse','compare',refs.Bob,['own_reason'],'A newer stance citing shared material.'),interaction:{mode:'compare',options:['own_reason'],reference:citedRef}});
await edit(store,alice,w=>{w.maps.find(m=>m.id===citedRef.mapId).visibility='private';});assert(!(await list(bob)).items.some(e=>[agree.record.id,earlierStance.record.id,newestStance.record.id].includes(e.recordId)),'Hiding the latest stance must not expose earlier assessment events as a fallback');
await edit(store,alice,w=>{w.maps.find(m=>m.id===citedRef.mapId).visibility='shared';});
const beforePrivate=await list(bob);await edit(store,alice,w=>{w.maps.find(m=>m.id===refs.Alice.mapId).visibility='private';});assert.equal((await list(bob)).items.length,0);assert.equal((await list(bob)).unreadCount,0);assert.equal((await list(bob)).mutedComparisons.length,0);assert(!JSON.stringify(await list(bob)).includes('Alice source claim'));await assert.rejects(()=>handleActivity(store,bob,'open',{id:first.id}),e=>e.status===404);await assert.rejects(()=>handleActivity(store,bob,'mute',{comparisonId:thread.id,muted:true}),e=>e.status===404);
await edit(store,alice,w=>{w.maps.find(m=>m.id===refs.Alice.mapId).visibility='shared';});assert.deepEqual((await list(bob)).items,beforePrivate.items,'Sharing changes never create activity or reset reads');
const deleted=await store.activity(bob.id,'snapshot',{});deleted.records.find(r=>r.kind==='map'&&r.id===refs.Alice.mapId).value.deletedAt='2026-10-23T00:00:00Z';assert.equal(projectActivity(deleted,bob.id).items.length,0,'Deleted source maps contribute no cards or counts');

let cosign;await edit(store,bob,w=>{cosign=endorseNodes(w,{participantId:bob.id,sourceMapId:refs.Alice.mapId,nodeIds:[refs.Alice.nodeId],scope:'section',anchorId:refs.Alice.nodeId});cosign.method='authenticated';});const co=eventFor((await list(alice)).items,cosign.id);assert.equal(co.eventType,'cosigned');assert.deepEqual(co.route,{source:refs.Alice.mapId,node:refs.Alice.nodeId});assert.equal((await list(bob)).items.some(e=>e.recordId===cosign.id),false);
await edit(store,alice,w=>{w.participants.find(p=>p.id===alice.id).name='Alice renamed';});assert.equal((await list(bob)).items[0].actorName,'Alice renamed','Activity uses current authorized profile names');

// Stable server IDs, not timestamp order, paginate bounded lists. A new first
// page event cannot displace or repeat a row on a captured next-page cursor.
for(let i=0;i<55;i++)await put(alice,interaction('request_reason','inquiry',refs.Bob,['reason'],'Page event '+i));
const page1=await list(bob);assert.equal(page1.items.length,50);assert(page1.nextCursor);const newest=await put(alice,interaction('request_reason','inquiry',refs.Bob,['reason'],'Arrived after first page'));
const page2=await list(bob,{cursor:page1.nextCursor});assert(page2.items.length>0);assert(!page2.items.some(e=>page1.items.some(p=>p.id===e.id)));assert(!page2.items.some(e=>e.recordId===newest.record.id));assert(page2.items.every(e=>BigInt(e.id)<BigInt(page1.items.at(-1).id)));
await assert.rejects(()=>list(alice,{cursor:page1.nextCursor}),e=>e.status===400);await assert.rejects(()=>list(bob,{cursor:page1.nextCursor,filter:'unread'}),e=>e.status===400);
await handleActivity(store,bob,'read',{ids:page1.items.map(e=>e.id),read:true,snapshotToken:page1.snapshotToken});assert.equal(eventFor((await list(bob)).items,newest.record.id).read,false);
console.log('Activity API recipients, replay/revisions, exact destinations, current-access privacy, dependent records, bounded cursors, read/mute races, session/origin boundaries and generation isolation passed.');
