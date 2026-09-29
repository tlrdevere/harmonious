import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {alice,bob,memoryStore,seedActor,edit,view,addNode} from './accounts.test.mjs';
import {startAccountComparison,handleAccountAPI,INTERACTION_CAPABILITY,ARGUMENT_CAPABILITY,REPLIES_CAPABILITY} from '../worker/account-api.mjs';
import {validateAccountChanges,projectAccountWorkspace} from '../worker/account-policy.mjs';
import {makeDiscussion,discussionHealth} from '../dist/discussion.mjs';
import {createOwnedMap,synchronizeIdeas} from '../dist/adoption.mjs';
import {interactionOptions,interactionReferenceChoices,canRespondInteraction,ARGUMENT_CATEGORIES} from '../dist/interaction-grammar.mjs';

export async function exerciseInteractionGrammar(store,{database=false}={}){
 const refs={};
 for(const actor of [alice,bob])await edit(store,actor,ws=>{const map=ws.maps.find(m=>m.ownerId===actor.id);map.visibility='shared';const n=addNode(ws,actor,actor.name+' grammar source');n.parent='status';n.sourceTitle=actor===bob?'Reference citation':'';if(actor===bob){const next=addNode(ws,actor,'Effect claim');next.parent='status';const edge={id:crypto.randomUUID(),from:n.id,to:next.id,type:'cause',note:'Original mechanism'};map.relations.push(edge);refs.Edge={type:'edge',mapId:map.id,edgeId:edge.id};}synchronizeIdeas(ws,map);refs[actor.name]={type:'node',mapId:map.id,nodeId:n.id};});
 const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:refs.Alice.mapId,bMapId:refs.Bob.mapId});
 let ws=(await view(store,alice)).workspace;
 const save=async(actor,action,mode,options=[],target=refs.Bob,extra={})=>{let result;await edit(store,actor,w=>{result=makeDiscussion(w,{kind:'interaction',action,comparisonId:thread.id,target,interaction:{mode,options,...extra}},actor.id);w.discussions.push(result);});return result;};
 const allowed=interactionOptions(ws,refs.Bob,'dispute');
 assert.deepEqual(allowed,ARGUMENT_CATEGORIES,'Exactly four categories, even with citations');
 assert(!allowed.some(o=>o.id==='unlikely'),'Prediction add-on is deferred');
 const source=ws.maps.find(m=>m.id===refs.Bob.mapId),node=source.nodes.find(n=>n.id===refs.Bob.nodeId);
 for(const frame of ['status','action','goal']){node.parent=frame;assert.deepEqual(interactionOptions(ws,refs.Bob,'dispute'),ARGUMENT_CATEGORIES);}
 node.parent='status';
 for(const type of ['reason','cause','addresses','enables','nesting','related','illustrative']){
  source.relations.push({id:'grammar-test-edge',from:'status',to:node.id,type});
  const choices=interactionOptions(ws,{type:'edge',mapId:source.id,edgeId:'grammar-test-edge'},'dispute');
  assert.equal(choices.length,['reason','cause','addresses','enables'].includes(type)?4:0);source.relations.pop();
 }
 const before=structuredClone(ws.maps);
 const edgeDispute=await save(alice,'dispute','argument',['reasoning'],refs.Edge);assert.equal(edgeDispute.sourceSnapshots[0].wording.note,'Original mechanism');
 const dispute=await save(alice,'dispute','argument',['factual_basis','reasoning','consequences']);
 assert.equal(dispute.body,'');assert.equal(dispute.interaction.reference,null,'Every formerly required reference is optional');
 assert.deepEqual(dispute.interaction.signals,[]);
 assert.deepEqual((await view(store,alice)).workspace.maps,before,'A stance or dispute never changes a map');
 await save(alice,'dispute','argument',['feasibility']);
 for(let mask=1;mask<16;mask++){const chosen=ARGUMENT_CATEGORIES.filter((_,i)=>mask&(1<<i)).map(o=>o.id);const r=await save(alice,'dispute','argument',chosen);assert.deepEqual(r.interaction.options,chosen);assert.equal(r.interaction.version,5);assert.deepEqual(r.interaction.signals,[]);}
 for(const invalid of [['other'],['reasoning','reasoning'],['factual_basis','false']])await assert.rejects(()=>save(alice,'dispute','argument',invalid),/apply to this source/);
 const endorsement=await save(alice,'endorse','compare',['other']);assert.deepEqual(endorsement.interaction.signals,[]);
 await save(alice,'disagree','compare');await save(alice,'decline','compare',['need_information']);
 const request=await save(alice,'request_reason','inquiry',['source'],refs.Bob,{reference:refs.Alice});
 assert(canRespondInteraction(request,bob.id));assert(!canRespondInteraction(request,alice.id));
 const response=await save(bob,'respond','inquiry',['answer'],{type:'entry',entryId:request.id});
 assert.equal(response.interaction.recipientId,alice.id);
 await assert.rejects(()=>save(alice,'respond','inquiry',['answer'],{type:'entry',entryId:request.id}),/other person|intended recipient/);
 await assert.rejects(()=>save(bob,'respond','argument',['accept','reject'],{type:'entry',entryId:dispute.id}),/one response/);
 await assert.rejects(()=>save(alice,'dispute','argument',['unachievable']),/apply to this source/);
 await assert.rejects(()=>save(alice,'dispute','argument',[],refs.Bob),/at least one/);
 await assert.rejects(()=>save(alice,'endorse','compare',[],refs.Alice),/other person/);
 await assert.rejects(()=>save(alice,'endorse','compare',[],{...refs.Bob,nodeId:'status'}),/ordinary node/);
 let privateRef,thirdRef;
 await edit(store,alice,w=>{for(const visibility of ['private','shared']){const map=createOwnedMap(w,{name:visibility+' reference',ownerId:alice.id});map.visibility=visibility;const n={...w.maps.find(m=>m.id===refs.Alice.mapId).nodes.find(n=>n.id===refs.Alice.nodeId),id:crypto.randomUUID(),title:visibility+' wording'};delete n.ideaId;delete n.ideaVersion;map.nodes.push(n);synchronizeIdeas(w,map);const ref={type:'node',mapId:map.id,nodeId:n.id};if(visibility==='private')privateRef=ref;else thirdRef=ref;}});
 ws=(await view(store,alice)).workspace;assert(!interactionReferenceChoices(ws,thread.id).some(c=>c.mapId===privateRef.mapId));
 await assert.rejects(()=>save(alice,'offer_reason','inquiry',[],refs.Bob,{reference:privateRef}),/both participants/);
 const cited=await save(alice,'offer_reason','inquiry',[],refs.Bob,{reference:thirdRef});
 const citedReply=await save(bob,'respond','inquiry',['accept'],{type:'entry',entryId:cited.id});
 const snap=await store.snapshot(),raw=structuredClone(cited);raw.id=crypto.randomUUID();raw.interaction.reference.snapshot.label='Forged wording';
 assert.throws(()=>validateAccountChanges(snap,alice.id,[{kind:'discussion',id:raw.id,expectedRevision:0,value:raw}]),/changed/);
 const forged=structuredClone(dispute);forged.id=crypto.randomUUID();forged.interaction.signals=[{optionId:'factual_basis',tag:'Values'}];
 assert.throws(()=>validateAccountChanges(snap,alice.id,[{kind:'discussion',id:forged.id,expectedRevision:0,value:forged}]),/signals/);
 const recipient=structuredClone(request);recipient.id=crypto.randomUUID();recipient.interaction.recipientId='33333333-3333-4333-8333-333333333333';
 assert.throws(()=>validateAccountChanges(snap,alice.id,[{kind:'discussion',id:recipient.id,expectedRevision:0,value:recipient}]),/changed/);
 const privateSnapshot=structuredClone(snap);privateSnapshot.records.find(r=>r.kind==='map'&&r.id===thirdRef.mapId).value.visibility='private';
 const projected=projectAccountWorkspace(privateSnapshot,bob.id).workspace;
 assert(!projected.discussions.some(r=>[cited.id,citedReply.id].includes(r.id)),'Revoked sharing must hide direct and descendant reference snapshots');
 ws=(await view(store,alice)).workspace;
 const revisedReference=structuredClone(ws),citedMap=revisedReference.maps.find(m=>m.id===thirdRef.mapId),citedNode=citedMap.nodes.find(n=>n.id===thirdRef.nodeId);citedNode.title='Revised reference wording';
 assert.equal(discussionHealth(revisedReference,cited).state,'changed','Reference changes must remain visible even when the target claim is unchanged');
 assert.equal(discussionHealth(revisedReference,citedReply).state,'changed','Reference changes propagate to contextual responses');
 citedMap.nodes=citedMap.nodes.filter(n=>n.id!==thirdRef.nodeId);
 assert.equal(discussionHealth(revisedReference,cited).state,'unavailable');
 const withdrawn=makeDiscussion(revisedReference,{...cited,status:'withdrawn'},alice.id,cited);assert.deepEqual(withdrawn.interaction,cited.interaction,'Withdrawing after a reference deletion preserves the saved source');
 assert.throws(()=>makeDiscussion(revisedReference,{...cited,status:'withdrawn',body:'Smuggled edit'},alice.id,cited),/both participants|unavailable/,'The withdrawal exception cannot carry a text change');
 const stale=makeDiscussion(ws,{kind:'interaction',action:'dispute',comparisonId:thread.id,target:refs.Bob,interaction:{mode:'argument',options:['factual_basis']}},alice.id);
 const staleEdge=makeDiscussion(ws,{kind:'interaction',action:'dispute',comparisonId:thread.id,target:refs.Edge,interaction:{mode:'argument',options:['consequences']}},alice.id);
 await edit(store,bob,w=>{const m=w.maps.find(m=>m.id===refs.Bob.mapId);m.relations.find(e=>e.id===refs.Edge.edgeId).note='Changed connection wording';});
 const afterEdge=await store.snapshot();assert.throws(()=>validateAccountChanges(afterEdge,alice.id,[{kind:'discussion',id:staleEdge.id,expectedRevision:0,value:staleEdge}]),/changed/,'Concurrent connection wording changes must block stale submissions');assert.equal(discussionHealth((await view(store,alice)).workspace,edgeDispute).state,'changed');
 if(database){await assert.rejects(()=>store.commit(alice.id,afterEdge.revision,[{kind:'discussion',id:staleEdge.id,expectedRevision:0,value:staleEdge}]),/wording changed/,'Direct SQL must notice connection wording without any endpoint changing');assert.deepEqual(await store.snapshot(),afterEdge);}
 await edit(store,bob,w=>{const m=w.maps.find(m=>m.id===refs.Bob.mapId);m.nodes.find(n=>n.id===refs.Bob.nodeId).title='Changed source wording';synchronizeIdeas(w,m);});
 return {thread,refs,dispute,request,response,cited,citedReply,stale,staleEdge};
}
export async function exerciseArgumentReplies(store,{thread,dispute,request,response}){
 const before=(await view(store,alice)).workspace.maps,replies=[];
 const reply=async(actor,target=dispute.id,body='A continuing reply')=>{let result;await edit(store,actor,ws=>{result=makeDiscussion(ws,{kind:'interaction',action:'respond',comparisonId:thread.id,target:{type:'entry',entryId:target},body,interaction:{mode:'argument',options:['reply']}},actor.id);ws.discussions.push(result);});return result;};
 for(let i=0;i<14;i++){const actor=i%2?bob:alice,r=await reply(actor,dispute.id,'Exchange '+i);assert.equal(r.interaction.version,6);assert.equal(r.interaction.recipientId,actor===alice?bob.id:alice.id);assert.equal(r.target.entryId,dispute.id);replies.push(r);}
 await reply(bob,dispute.id,'Another thought without waiting for a turn');
 await assert.rejects(()=>reply(alice,request.id),/apply to this source/);
 await assert.rejects(()=>reply(alice,response.id),/apply to this source/);
 await assert.rejects(()=>reply(alice,replies[1].id),/apply to this source/);
 await assert.rejects(()=>reply(alice,dispute.id,' \n\t '),/Write a reply/);
 await edit(store,alice,ws=>{const old=ws.discussions.find(r=>r.id===replies[0].id),next=makeDiscussion(ws,{...old,body:'Edited follow-up'},alice.id,old);assert.equal(next.history[0].body,'Exchange 0');ws.discussions=ws.discussions.map(r=>r.id===old.id?next:r);});
 await edit(store,bob,ws=>{const old=ws.discussions.find(r=>r.id===replies[1].id);ws.discussions=ws.discussions.map(r=>r.id===old.id?makeDiscussion(ws,{...old,status:'withdrawn'},bob.id,old):r);});
 const ws=(await view(store,bob)).workspace;
 assert(replies.every(reply=>ws.discussions.some(r=>r.id===reply.id)),'Both participants retain the exchange including withdrawn history');
 assert.equal(ws.discussions.find(r=>r.id===dispute.id).status,'active','Replies never resolve the dispute');
 assert.deepEqual((await view(store,alice)).workspace.maps,before,'Replies never edit source maps');
 return replies;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const store=memoryStore();await seedActor(store,alice);await seedActor(store,bob);const result=await exerciseInteractionGrammar(store);await exerciseArgumentReplies(store,result);const snap=await store.snapshot();
 assert.throws(()=>validateAccountChanges(snap,alice.id,[{kind:'discussion',id:result.stale.id,expectedRevision:0,value:result.stale}]),/changed/);
 assert.equal(discussionHealth((await view(store,alice)).workspace,result.dispute).state,'changed');
 const env={APP_ORIGIN:'https://harmonious.example',SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test',SUPABASE_SECRET_KEY:'server-test',SIGNUP_MODE:'public'};
 const request=async(capabilities='',body,selectedStore=store)=>handleAccountAPI(new Request(env.APP_ORIGIN+'/api/workspace',{method:body?'PUT':'GET',headers:{origin:env.APP_ORIGIN,'X-Harmonious-Capabilities':capabilities,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),env,{store:selectedStore,auth:{identify:async()=>({actor:alice,cookies:[]})}});
 for(const body of [undefined,{changes:[]}]){const response=await request('',body);assert.equal(response.status,409);assert.equal((await response.json()).requiredCapability,INTERACTION_CAPABILITY);}
 const oldClient=await request(INTERACTION_CAPABILITY);assert.equal(oldClient.status,409);assert.equal((await oldClient.json()).requiredCapability,ARGUMENT_CAPABILITY);
 const oldArguments=await request(INTERACTION_CAPABILITY+','+ARGUMENT_CAPABILITY);assert.equal(oldArguments.status,409);assert.equal((await oldArguments.json()).requiredCapability,REPLIES_CAPABILITY);
 assert.equal((await request([INTERACTION_CAPABILITY,ARGUMENT_CAPABILITY,REPLIES_CAPABILITY].join(','))).status,200);
 const noArguments={snapshot:async()=>({...structuredClone(snap),records:structuredClone(snap.records.filter(r=>r.kind!=='discussion'))}),commit:async()=>{throw Error('An obsolete client must not reach commit');}};
 assert.equal((await request(INTERACTION_CAPABILITY,undefined,noArguments)).status,200,'Unaffected old tabs can still read');
 const obsolete=structuredClone(result.dispute);obsolete.interaction.version=4;obsolete.interaction.options=['false'];obsolete.interaction.signals=[{optionId:'false',tag:'Factual'}];
 const blocked=await request(INTERACTION_CAPABILITY,{changes:[{kind:'discussion',id:obsolete.id,expectedRevision:0,value:obsolete}]},noArguments);assert.equal(blocked.status,409);assert.equal((await blocked.json()).requiredCapability,ARGUMENT_CAPABILITY,'Old dispute forms must refresh even before any new-format record exists');
 assert.deepEqual(await store.snapshot(),snap,'Compatibility rejections do not mutate data');
 console.log('Interaction grammar filtering, minimal input, signals, recipients, shared references, freshness, and client compatibility passed.');
}
