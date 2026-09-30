import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {alice,bob,memoryStore,seedActor,edit,view,addNode} from './accounts.test.mjs';
import {startAccountComparison} from '../worker/account-api.mjs';
import {validateAccountChanges} from '../worker/account-policy.mjs';
import {makeDiscussion,discussionHealth,validateDiscussions} from '../dist/discussion.mjs';
import {standstillContext,standstillState,standstillCounts,standstillProposalMetadata,standstillEventMetadata,standstillProposals,validateStandstills} from '../dist/standstill.mjs';
import {dialogueRecords} from '../dist/argument-dialogue.mjs';
import {synchronizeIdeas} from '../dist/adoption.mjs';
import {conversationGroups,reasoningBranch} from '../dist/conversation-tree.mjs';
import {buildReasoningIndex,projectReasoning} from '../dist/reasoning-view.mjs';
import {libraryComparisonSummary} from '../dist/library-summary.mjs';

export async function standstillFixture(store){
 await seedActor(store,alice);await seedActor(store,bob);const refs={};
 for(const actor of [alice,bob])await edit(store,actor,ws=>{const map=ws.maps.find(m=>m.ownerId===actor.id);map.visibility='shared';const node=addNode(ws,actor,actor.name+' source');refs[actor.name]={type:'node',mapId:map.id,nodeId:node.id};});
 const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:refs.Alice.mapId,bMapId:refs.Bob.mapId});let dispute,reply;
 await edit(store,alice,ws=>{dispute=makeDiscussion(ws,{kind:'interaction',action:'dispute',comparisonId:thread.id,target:refs.Bob,body:'The evidence is too uncertain.',interaction:{mode:'argument',options:['factual_basis']}},alice.id);ws.discussions.push(dispute);});
 await edit(store,bob,ws=>{reply=makeDiscussion(ws,{kind:'interaction',action:'respond',comparisonId:thread.id,target:{type:'entry',entryId:dispute.id},body:'I regard these studies as sufficient.',interaction:{mode:'argument',options:['reply'],replyTo:{entryId:dispute.id,version:dispute.version}}},bob.id);ws.discussions.push(reply);});
 return {thread,refs,dispute,reply};
}

export async function exerciseStandstills(store){
 const f=await standstillFixture(store),{thread,refs,dispute,reply}=f;
 const workspace=async actor=>(await view(store,actor)).workspace;
 const put=async(actor,fn)=>{let record;await edit(store,actor,ws=>{record=fn(ws);ws.discussions=[...ws.discussions.filter(r=>r.id!==record.id),record];});return record;};
 const propose=async(actor,anchor=reply,body='We differ about how much evidence is sufficient.')=>put(actor,ws=>makeDiscussion(ws,{id:'standstill-'+crypto.randomUUID(),kind:'standstill',action:'propose_standstill',comparisonId:thread.id,target:refs.Bob,body,standstill:standstillProposalMetadata(ws,thread.id,anchor.id)},actor.id));
 const event=async(actor,proposal,action,body='')=>put(actor,ws=>{const p=ws.discussions.find(r=>r.id===proposal.id);return makeDiscussion(ws,{id:'standstill-'+crypto.randomUUID(),kind:'standstill',action,comparisonId:thread.id,target:{type:'entry',entryId:p.id},body,standstill:standstillEventMetadata(ws,p)},actor.id);});
 const revise=async(actor,proposal,body,extra={})=>put(actor,ws=>{const old=ws.discussions.find(r=>r.id===proposal.id);return makeDiscussion(ws,{...old,body,standstill:standstillProposalMetadata(ws,thread.id,old.standstill.anchor.entryId,old),reviewSources:true,...extra},actor.id,old);});
 const state=async p=>standstillState(await workspace(alice),p.id);
 let ws=await workspace(alice);const originalMaps=structuredClone(ws.maps),originalReplies=dialogueRecords(ws,thread.id,refs.Bob).length,originalLibrary=libraryComparisonSummary(ws,thread).counts,originalGroups=conversationGroups(ws.discussions);
 assert(standstillContext(ws,thread.id,reply.id).available);
 await assert.rejects(()=>propose(alice,reply,' \n '),/Explain/);
 await assert.rejects(()=>propose(alice,reply,'x'.repeat(10001)),/Invalid comparison contribution|Explain/);
 assert.throws(()=>standstillProposalMetadata(ws,thread.id,'missing'),/available/);
 const p=await propose(alice);assert.equal((await state(p)).state,'proposed');assert.equal(p.target.type,'node');assert.equal(p.standstill.anchor.entryId,reply.id);
 assert.equal(p.standstill.anchor.version,1);assert.equal(p.body,'We differ about how much evidence is sufficient.');
 await assert.rejects(()=>propose(alice),/already proposed/);
 await assert.rejects(()=>event(alice,p,'confirm_standstill'),/other participant/);
 await assert.rejects(()=>event(alice,p,'suggest_standstill','My own suggestion'),/other participant/);
 await assert.rejects(()=>event(bob,p,'suggest_standstill','  '),/Explain/);
 const suggestion=await event(bob,p,'suggest_standstill','Clarify that we agree on the study findings.');assert.equal((await state(p)).suggestion.id,suggestion.id);
 const confirmation=await event(bob,p,'confirm_standstill');assert.equal((await state(p)).state,'confirmed');
 const questioned=await event(bob,p,'suggest_standstill','I no longer think this summary captures the issue.');assert.equal((await state(p)).state,'proposed');
 const revised=await revise(alice,p,'We agree on the findings but differ on what evidence warrants action.');assert.equal(revised.version,2);assert.equal(revised.history[0].body,p.body);assert.equal(revised.standstill.previous.entryId,questioned.id);assert.equal((await state(p)).state,'proposed');
 const newerConfirmation=await event(bob,p,'confirm_standstill');assert.equal(newerConfirmation.standstill.proposalVersion,2);assert.equal((await state(p)).state,'confirmed');
 ws=await workspace(alice);assert.deepEqual(standstillCounts(ws,thread.id,refs.Bob),{proposed:0,confirmed:1,needsReview:0,total:1});
 assert.equal(dialogueRecords(ws,thread.id,refs.Bob).length,originalReplies,'Annotations do not become dialogue cards or reply counts');
 assert.deepEqual(conversationGroups(ws.discussions),originalGroups,'Annotations do not become questions or contributions in legacy groups');
 assert.deepEqual(libraryComparisonSummary(ws,thread).counts,originalLibrary,'Annotations do not inflate disputes or earlier conversation counts');
 assert.equal(reasoningBranch(ws.discussions,refs.Bob).entries.length,0);
 for(const r of ws.discussions.filter(r=>r.kind==='standstill')){const projection=projectReasoning(buildReasoningIndex(ws.discussions),{anchor:refs.Bob,focusId:r.id,pinnedIds:[r.id]});assert.equal(projection.entries.length,0);assert.equal(projection.links.length,0);}
 // The global head, not a timestamp, determines whether a later suggestion
 // supersedes confirmation. Fabricated clocks never restore agreement.
 const clocks=structuredClone(ws);for(const r of clocks.discussions.filter(r=>r.kind==='standstill'))r.createdAt='2000-01-01T00:00:00.000Z';assert.equal(standstillState(clocks,p.id).state,'confirmed');
 await put(alice,w=>makeDiscussion(w,{kind:'interaction',action:'respond',comparisonId:thread.id,target:{type:'entry',entryId:dispute.id},body:'A sibling branch continues.',interaction:{mode:'argument',options:['reply'],replyTo:{entryId:dispute.id,version:dispute.version}}},alice.id));assert.equal((await state(p)).state,'confirmed');
 // Capture a confirmation against an observed head, then race a suggestion.
 ws=await workspace(bob);const current=ws.discussions.find(r=>r.id===p.id),stale=makeDiscussion(ws,{kind:'standstill',action:'confirm_standstill',comparisonId:thread.id,target:{type:'entry',entryId:p.id},standstill:standstillEventMetadata(ws,current)},bob.id);
 await event(bob,p,'suggest_standstill','A concurrent correction');
 const snapshot=await store.snapshot();assert.throws(()=>validateAccountChanges(snapshot,bob.id,[{kind:'discussion',id:stale.id,expectedRevision:0,value:stale}]),/sequence|changed/);
 // Events stay immutable, including an attempt to withdraw a confirmation.
 ws=await workspace(bob);assert.throws(()=>makeDiscussion(ws,{...confirmation,status:'withdrawn'},bob.id,confirmation),/cannot be edited|cannot be withdrawn/);
 const resumed=await event(alice,p,'resume_standstill');assert.equal((await state(p)).state,'resumed');
 await assert.rejects(()=>revise(alice,p,'Trying to revive old agreement'),/ended|sequence/);
 await assert.rejects(()=>event(bob,p,'confirm_standstill'),/ended|sequence/);
 ws=await workspace(alice);assert.equal(standstillCounts(ws,thread.id,refs.Bob).total,0);assert.equal(ws.discussions.find(r=>r.id===resumed.id).authorId,alice.id);
 const second=await propose(alice);assert.notEqual(second.id,p.id);assert.equal((await state(second)).state,'proposed');
 await event(bob,second,'confirm_standstill');
 // Changes at the addressed point need review; a reply elsewhere did not.
 await put(bob,w=>{const old=w.discussions.find(r=>r.id===reply.id);return makeDiscussion(w,{...old,body:'Revised evidence explanation.'},bob.id,old);});
 assert.equal((await state(second)).state,'needs_review');await assert.rejects(()=>event(bob,second,'confirm_standstill'),/review it first/);
 const renewed=await revise(alice,second,'We still differ about sufficient evidence.');assert.equal(renewed.standstill.anchor.version,1);assert.equal(renewed.standstill.reviewedAnchorVersion,2);assert.equal((await state(second)).state,'proposed');
 await event(bob,second,'confirm_standstill');
 // Source edits can be resumed directly after loading their latest state.
 ws=await workspace(bob);const sourceRace=makeDiscussion(ws,{kind:'standstill',action:'resume_standstill',comparisonId:thread.id,target:{type:'entry',entryId:second.id},standstill:standstillEventMetadata(ws,ws.discussions.find(r=>r.id===second.id))},bob.id);
 assert.deepEqual((await workspace(alice)).maps,originalMaps,'Standstill actions never change maps');
 await edit(store,bob,w=>{const map=w.maps.find(m=>m.id===refs.Bob.mapId);map.nodes.find(n=>n.id===refs.Bob.nodeId).summary='A changed source claim.';synchronizeIdeas(w,map);});assert.equal((await state(second)).state,'needs_review');
 const sourceSnapshot=await store.snapshot();assert.throws(()=>validateAccountChanges(sourceSnapshot,bob.id,[{kind:'discussion',id:sourceRace.id,expectedRevision:0,value:sourceRace}]),/source or addressed contribution changed/);
 const editedMaps=structuredClone((await workspace(alice)).maps);
 await event(bob,second,'resume_standstill');assert.equal((await state(second)).state,'resumed');
 const third=await propose(alice);await event(bob,third,'confirm_standstill');
 await put(alice,w=>{const old=w.discussions.find(r=>r.id===dispute.id);return makeDiscussion(w,{...old,status:'withdrawn'},alice.id,old);});
 assert.equal((await state(third)).state,'unavailable');await assert.rejects(()=>event(bob,third,'confirm_standstill'),/available/);
 await put(alice,w=>{const old=w.discussions.find(r=>r.id===third.id);return makeDiscussion(w,{...old,status:'withdrawn',standstill:standstillProposalMetadata(w,thread.id,reply.id,old,{withdraw:true})},alice.id,old);});assert.equal((await state(third)).state,'withdrawn');
 // Removing a causal dependency may never fall back to an older confirmation.
 ws=await workspace(alice);const hidden=structuredClone(ws);hidden.discussions=hidden.discussions.filter(r=>r.id!==questioned.id);assert.equal(standstillState(hidden,p.id).state,'unavailable');
 const invalid=structuredClone(ws);invalid.discussions.find(r=>r.id===second.id).standstill.anchor.entryId='missing';assert.throws(()=>validateDiscussions(invalid),/original source|addressed contribution|sequence/);
 assert.equal(standstillProposals(ws,thread.id).length,3);assert.equal(discussionHealth(ws,ws.discussions.find(r=>r.id===third.id)).state,'unavailable');
 assert.deepEqual(ws.maps,editedMaps,'Resumption and withdrawal never change maps');
 validateStandstills(ws);return {...f,proposals:[p,second,third],records:ws.discussions.filter(r=>r.kind==='standstill')};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){await exerciseStandstills(memoryStore());console.log('Standstill proposal, causal confirmation, revision, resumption, history, freshness and account boundary checks passed.');}
