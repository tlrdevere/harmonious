import assert from 'node:assert/strict';
import {alice,bob,memoryStore,seedActor,edit,view,addNode} from './accounts.test.mjs';
import {startAccountComparison} from '../worker/account-api.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {synchronizeIdeas} from '../dist/adoption.mjs';
import {interactionApplicationPreview,applyInteractionToMap} from '../dist/interaction-application.mjs';

const store=memoryStore(),refs={};for(const actor of [alice,bob]){await seedActor(store,actor);await edit(store,actor,ws=>{const m=ws.maps.find(m=>m.ownerId===actor.id);m.visibility='shared';const n=addNode(ws,actor,actor.name+' statement');n.kind='position';n.parent='status';synchronizeIdeas(ws,m);refs[actor.name]={type:'node',mapId:m.id,nodeId:n.id};});}
const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:refs.Alice.mapId,bMapId:refs.Bob.mapId});
let ws=(await view(store,alice)).workspace;
const add=(actor,action,mode,target,options=[],body='',reference=null)=>{const r=makeDiscussion(ws,{kind:'interaction',action,comparisonId:thread.id,target,body,interaction:{mode,options,reference}},actor.id);ws.discussions.push(r);return r;};
const endorsement=add(alice,'endorse','compare',refs.Bob,['own_reason'],'',refs.Alice),preview=interactionApplicationPreview(ws,endorsement.id,alice.id),original=structuredClone(ws);
const input={recordId:endorsement.id,operationId:'application-unit-copy',reviewed:preview.reviewed,parentId:'status',title:'Independent statement',summary:'',details:'',linkCounterpart:true};
const applied=applyInteractionToMap(ws,input,alice.id),own=applied.workspace.maps.find(m=>m.ownerId===alice.id),copy=own.nodes.find(n=>n.title==='Independent statement');
assert(copy);assert(own.relations.some(e=>e.type==='reason'&&e.from===refs.Alice.nodeId&&e.to===copy.id));assert.equal(applied.workspace.discussions.filter(r=>r.kind==='correspondence').length,1);assert.deepEqual(ws,original,'Preview/application does not mutate the input workspace');assert.deepEqual(applied.workspace.maps.find(m=>m.ownerId===bob.id),original.maps.find(m=>m.ownerId===bob.id));
assert.deepEqual(applyInteractionToMap(applied.workspace,input,alice.id).workspace,applied.workspace,'A repeated application is idempotent');assert.throws(()=>applyInteractionToMap(ws,input,bob.id),/no map change/);
const changed=structuredClone(ws);changed.maps.find(m=>m.id===refs.Bob.mapId).nodes.find(n=>n.id===refs.Bob.nodeId).title='Changed after preview';assert.throws(()=>applyInteractionToMap(changed,input,alice.id),/source changed/);
const proposal=add(alice,'propose_alternative','inquiry',refs.Bob,[],'A revised statement'),response=add(bob,'respond','inquiry',{type:'entry',entryId:proposal.id},['accept']);
const before=structuredClone(ws.maps),revision=interactionApplicationPreview(ws,response.id,bob.id);assert.deepEqual(ws.maps,before,'Accept does not edit maps');
const revised=applyInteractionToMap(ws,{recordId:response.id,operationId:'application-unit-revise',reviewed:revision.reviewed,title:'Bob reviewed wording',summary:'Bob’s explanation',details:''},bob.id);
assert.equal(revised.workspace.maps.find(m=>m.ownerId===bob.id).nodes.find(n=>n.id===refs.Bob.nodeId).title,'Bob reviewed wording');assert.deepEqual(revised.workspace.maps.find(m=>m.ownerId===alice.id),ws.maps.find(m=>m.ownerId===alice.id));
const unknown=add(bob,'respond','inquiry',{type:'entry',entryId:proposal.id},['reject']);assert.throws(()=>interactionApplicationPreview(ws,unknown.id,bob.id),/no map change/);
const nesting=add(alice,'endorse','compare',{type:'edge',mapId:refs.Bob.mapId,edgeId:'structure:'+refs.Bob.nodeId});assert.throws(()=>interactionApplicationPreview(ws,nesting.id,alice.id),/no map change/,'Organizational links cannot offer a typed-edge map copy');
const nestingProposal=add(alice,'propose_alternative','inquiry',nesting.target,[],'Change this grouping'),nestingAccept=add(bob,'respond','inquiry',{type:'entry',entryId:nestingProposal.id},['accept']);assert.throws(()=>interactionApplicationPreview(ws,nestingAccept.id,bob.id),/no map change/,'Organizational grouping has no connection wording to revise');
const request=add(alice,'request_reason','inquiry',refs.Bob),answer=add(bob,'respond','inquiry',{type:'entry',entryId:request.id},['answer'],'My reason');
const answerPreview=interactionApplicationPreview(ws,answer.id,bob.id),answered=applyInteractionToMap(ws,{recordId:answer.id,operationId:'application-unit-answer',reviewed:answerPreview.reviewed,parentId:'status',title:'My reason',summary:'',details:''},bob.id),bm=answered.workspace.maps.find(m=>m.ownerId===bob.id);
assert(bm.relations.some(e=>e.type==='reason'&&e.to===refs.Bob.nodeId&&e.from==='application-unit-answer-reason'));
console.log('Reviewed map application: independent copies, existing own reason, counterpart separation, owner-only revisions, unchanged source maps, optional answer application, stale-source rejection and retry identity passed.');
