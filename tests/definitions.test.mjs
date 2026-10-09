import {synchronizeIdeas} from '../dist/adoption.mjs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {alice,bob,memoryStore,seedActor,edit,view,addNode} from './accounts.test.mjs';
import {makeDefinition,definitionReference,definitionReferenceText} from '../dist/definitions.mjs';
import {makeDiscussion,discussionHealth} from '../dist/discussion.mjs';
import {startAccountComparison,accountWorkspace,saveAccountChanges,requiresPhilosophyCapability} from '../worker/account-api.mjs';
import {challengeState,conversationGroups} from '../dist/conversation-tree.mjs';
import {validateAccountChanges} from '../worker/account-policy.mjs';
export async function exerciseDefinitions(store){
  let d,context,challenge,threadId,target;
  for(const actor of [alice,bob])await edit(store,actor,w=>{const map=w.maps.find(m=>m.ownerId===actor.id);map.visibility='shared';addNode(w,actor,'Library test position');});
  await edit(store,alice,w=>{d=makeDefinition(w,{type:'definition',title:'Fairness',body:'Equal opportunity for participation.'},alice.id);w.definitions.push(d);});
  assert(!(await view(store,bob)).workspace.definitions.some(x=>x.id===d.id),'Uninvoked library entries stay private');
  await edit(store,alice,w=>{const map=w.maps.find(m=>m.ownerId===alice.id);target={type:'node',mapId:map.id,nodeId:map.nodes.at(-1).id};const refs=[definitionReference(d)];context=makeDiscussion(w,{kind:'context',action:'context',target,definitionRefs:refs,body:definitionReferenceText(refs)},alice.id);w.discussions.push(context);});
  await edit(store,alice,w=>{const refs=[definitionReference(d)];w.discussions.push(makeDiscussion(w,{kind:'context',action:'context',target:{type:'edge',mapId:target.mapId,edgeId:`structure:${target.nodeId}`},definitionRefs:refs,body:definitionReferenceText(refs)},alice.id));});
  let bw=(await view(store,bob)).workspace;assert(bw.discussions.find(r=>r.id===context.id).body.includes('Equal opportunity'));assert(!bw.definitions.length,'Readers get only pinned source wording');
  const other=bw.maps.find(m=>m.ownerId===bob.id);threadId=(await startAccountComparison(store,bob.id,{aMapId:target.mapId,bMapId:other.id})).comparisonThread.id;
  await edit(store,bob,w=>{challenge=makeDiscussion(w,{comparisonId:threadId,kind:'argument',action:'challenge',target,body:'Equal opportunity needs a clearer scope.'},bob.id);w.discussions.push(challenge);});
  await edit(store,alice,w=>{const old=w.definitions.find(x=>x.id===d.id);d=makeDefinition(w,{title:'Fairness',body:'PRIVATE NEW VERSION: equal access to speaking time.'},alice.id,old);w.definitions=w.definitions.map(x=>x.id===d.id?d:x);});
  bw=(await view(store,bob)).workspace;assert(!JSON.stringify(bw).includes('PRIVATE NEW VERSION'));assert.equal(discussionHealth(bw,challenge).state,'current','Editing library wording does not silently change its uses');
  const snap=await store.snapshot(),record=snap.records.find(r=>r.id===d.id);assert.throws(()=>validateAccountChanges(snap,bob.id,[{kind:'definition',id:d.id,value:d,expectedRevision:record.revision}]),/own/);
  await assert.rejects(()=>edit(store,alice,w=>{w.definitions.find(x=>x.id===d.id).versions[0].body='Rewritten history';}),/Earlier definition/);
  await assert.rejects(()=>edit(store,alice,w=>{const old=w.discussions.find(x=>x.id===context.id);const ref={...definitionReference(d),body:'Forged definition'};w.discussions=w.discussions.map(x=>x.id===old.id?makeDiscussion(w,{...old,definitionRefs:[ref],body:definitionReferenceText([ref])},alice.id,old):x);}),/available version/);
  await edit(store,alice,w=>{const old=w.discussions.find(x=>x.id===context.id),refs=[definitionReference(d)];w.discussions=w.discussions.map(x=>x.id===old.id?makeDiscussion(w,{...old,definitionRefs:refs,body:definitionReferenceText(refs)},alice.id,old):x);});
  bw=(await view(store,bob)).workspace;assert.equal(discussionHealth(bw,challenge).state,'changed');
  assert.equal(bw.discussions.find(r=>r.kind==='context'&&r.target.type==='edge'&&r.target.mapId===target.mapId).definitionRefs[0].version,1,'Updating one invocation leaves the other on its chosen version');
  const respond=async(actor,action,body)=>edit(store,actor,w=>w.discussions.push(makeDiscussion(w,{comparisonId:threadId,kind:'reply',action,target:{type:'entry',entryId:challenge.id},layer:'arguments',body},actor.id)));
  await assert.rejects(()=>respond(alice,'resolve','I resolved your objection.'),/own response or resolution/);
  await respond(alice,'accept','I accept the issue and clarified my wording.');assert.equal(challengeState((await view(store,bob)).workspace.discussions,challenge),'Open','Accepting does not claim the challenger is satisfied');
  await respond(bob,'resolve','The clarification addresses my objection.');assert.equal(challengeState((await view(store,alice)).workspace.discussions,challenge),'Resolved by challenger');
  await new Promise(r=>setTimeout(r,2));await respond(bob,'reopen','A related ambiguity remains.');assert.equal(challengeState((await view(store,alice)).workspace.discussions,challenge),'Open');
  const groups=conversationGroups((await view(store,alice)).workspace.discussions);assert(groups.some(g=>g.target.nodeId===target.nodeId&&g.openChallenges===1));
  await edit(store,alice,w=>{w.maps.find(m=>m.id===target.mapId).visibility='private';});bw=(await view(store,bob)).workspace;assert(!bw.discussions.some(r=>r.id===context.id||r.id===challenge.id));assert(!JSON.stringify(bw).includes('PRIVATE NEW VERSION'));
  await edit(store,alice,w=>{w.maps.find(m=>m.id===target.mapId).visibility='shared';});
  console.log('Definitions privacy, reuse, pinned versions, immutable history, invocation validation and authored challenge outcomes passed.');
}
export async function exercisePhilosophy(store){
  for(const type of ['standard','principle','belief','other']){
    let idea,use;
    await edit(store,alice,w=>{const node=addNode(w,alice,'Foundation '+type),map=w.maps.find(m=>m.ownerId===alice.id);node.kind='position';synchronizeIdeas(w,map);idea=makeDefinition(w,{type,title:'Idea '+type,body:'Exact foundation '+type},alice.id);w.definitions.push(idea);const refs=[definitionReference(idea)];use=makeDiscussion(w,{kind:'context',action:'context',target:{type:'node',mapId:map.id,nodeId:node.id},definitionRefs:refs,body:definitionReferenceText(refs)},alice.id);w.discussions.push(use);});
    const seen=(await view(store,bob)).workspace;assert.equal(seen.discussions.find(r=>r.id===use.id).definitionRefs[0].type,type);assert(!seen.definitions.some(d=>d.id===idea.id),'Readers see the invoked version, not the private bank');
    await edit(store,alice,w=>{w.definitions=w.definitions.map(d=>d.id===idea.id?makeDefinition(w,{title:idea.versions[0].title,body:'PRIVATE revised '+type},alice.id,d):d);});
    assert.equal((await view(store,bob)).workspace.discussions.find(r=>r.id===use.id).definitionRefs[0].version,1);
    await edit(store,alice,w=>{const old=w.discussions.find(r=>r.id===use.id);w.discussions=w.discussions.map(r=>r.id===use.id?makeDiscussion(w,{...old,definitionRefs:[],body:'',status:'withdrawn'},alice.id,old):r);});
    assert((await view(store,alice)).workspace.definitions.some(d=>d.id===idea.id),'Removing a node use keeps the banked idea');
  }
  const newWorkspace=(await view(store,alice)).workspace;assert(requiresPhilosophyCapability(newWorkspace));
  await assert.rejects(()=>accountWorkspace(store,alice,{philosophyCapable:false}),e=>e.code==='CLIENT_UPDATE_REQUIRED');
  await assert.rejects(()=>saveAccountChanges(store,alice.id,[],{philosophyCapable:false}),e=>e.code==='CLIENT_UPDATE_REQUIRED');
  const belief=newWorkspace.definitions.find(d=>d.type==='belief');assert.throws(()=>makeDefinition(newWorkspace,{type:'unsupported',title:'Invalid',body:'Invalid'},alice.id),/Invalid library/);
  assert.throws(()=>makeDefinition(newWorkspace,{title:'Someone else',body:'Changed'},bob.id,belief),/author|attribution/);
  assert(requiresPhilosophyCapability({discussions:[{history:[{definitionRefs:[definitionReference(belief,1)]}]}]}),'Historical philosophy references also require a compatible client');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const store=memoryStore();for(const actor of [alice,bob])await seedActor(store,actor);await exerciseDefinitions(store);await exercisePhilosophy(store);}
