import assert from 'node:assert/strict';
import {alice,bob,memoryStore,seedActor,edit,addNode,view} from './accounts.test.mjs';
import {startAccountComparison} from '../worker/account-api.mjs';
import {makeDiscussion,discussionSnapshots} from '../dist/discussion.mjs';
import {counterpartUnlinkInput} from '../dist/counterparts.mjs';
import {nodeAssessment,counterpartAssessment,counterpartDisplay} from '../dist/interaction-presentation.mjs';

const store=memoryStore();
for(const actor of [alice,bob]){await seedActor(store,actor);await edit(store,actor,ws=>{ws.maps.find(m=>m.ownerId===actor.id).visibility='shared';addNode(ws,actor,actor.name+' assessment');addNode(ws,actor,actor.name+' alternative');});}
let base=(await view(store,alice)).workspace;
const am=base.maps.find(m=>m.ownerId===alice.id),bm=base.maps.find(m=>m.ownerId===bob.id);
const {comparisonThread:thread}=await startAccountComparison(store,alice.id,{aMapId:am.id,bMapId:bm.id});base=(await view(store,alice)).workspace;
const target=map=>({type:'node',mapId:map.id,nodeId:map.nodes.find(n=>n.title.endsWith('assessment')).id}),a=target(am),b=target(bm);
const when=n=>new Date(Date.UTC(2026,0,1,0,0,n)).toISOString();let sequence=0;
const record=(ws,actor,input)=>{const r=makeDiscussion(ws,{comparisonId:thread.id,...input},actor.id);r.createdAt=r.updatedAt=when(++sequence);ws.discussions.push(r);return r;};
const stance=(ws,actor,target,action)=>record(ws,actor,{kind:'interaction',mode:'compare',action,target});
const linked=()=>{const ws=structuredClone(base);record(ws,alice,{kind:'correspondence',action:'counterpart_link',target:a,other:b});return ws;};
const assess=(ws,target=a,actor=bob)=>nodeAssessment(ws,thread.id,target,actor.id);
const mutual=(ws,target=a)=>counterpartAssessment(ws,thread.id,target);

assert.equal(assess(base).state,'unassessed');assert.equal(mutual(base),null);
for(const [left,right,expected] of [['endorse','endorse','agree'],['disagree','disagree','disagree'],['endorse','disagree',null],['disagree','endorse',null],['decline','decline',null],['decline','endorse',null]]){
  const ws=linked();stance(ws,bob,a,left);stance(ws,alice,b,right);const unchanged=JSON.stringify(ws);
  assert.equal(mutual(ws)?.state||null,expected,`${left}/${right} has only its supported mutual status`);
  assert.equal(mutual(ws,b)?.state||null,expected,'The same pair status applies from either endpoint');
  const reversed=structuredClone(ws),t=reversed.comparisonThreads.find(t=>t.id===thread.id);[t.aMapId,t.bMapId]=[t.bMapId,t.aMapId];assert.equal(mutual(reversed,b)?.state||null,expected,'Comparison side order cannot change assessment meaning');
  assert.equal(JSON.stringify(ws),unchanged,'Assessment projection never writes maps or records');
}
{
  const ws=linked();stance(ws,bob,a,'endorse');assert.equal(mutual(ws),null,'One person agreeing does not imply mutual agreement');
  const unlinked=structuredClone(base);stance(unlinked,bob,a,'endorse');stance(unlinked,alice,b,'endorse');assert.equal(assess(unlinked).state,'agree');assert.equal(mutual(unlinked),null,'Matching personal assessments do not fabricate a counterpart');
}
{
  const ws=linked(),older=stance(ws,bob,a,'endorse'),newer=stance(ws,bob,a,'disagree');
  assert.equal(assess(ws).record.id,newer.id);
  older.updatedAt=when(++sequence);older.body='Later clarification of the earlier explanation';assert.equal(assess(ws).record.id,newer.id,'Editing an old explanation does not replace a newer stance');
  older.status='withdrawn';older.updatedAt=when(++sequence);assert.equal(assess(ws).state,'disagree','Withdrawing an older assessment does not clear the newer active stance');
  newer.status='withdrawn';newer.updatedAt=when(++sequence);assert.equal(assess(ws).state,'unassessed','Withdrawing the latest stance does not resurrect an older stance');
  older.status='active';assert.equal(assess(ws).state,'unassessed','An earlier active stance remains history after the latest is withdrawn');
  const latest=stance(ws,bob,a,'decline');assert.equal(assess(ws).state,'no-position');assert.equal(assess(ws).record.id,latest.id);
  const tie={...latest,id:latest.id+'z',action:'endorse'};ws.discussions.push(tie);assert.equal(assess(ws).record.id,tie.id);ws.discussions.reverse();assert.equal(assess(ws).record.id,tie.id,'Same-time records resolve deterministically regardless of array order');
}
{
  const ws=linked(),bobRecord=stance(ws,bob,a,'endorse');stance(ws,alice,b,'endorse');
  ws.maps.find(m=>m.id===a.mapId).nodes.find(n=>n.id===a.nodeId).summary+=' Changed source';assert.equal(assess(ws).needsReview,true);assert.equal(mutual(ws),null,'Changed source wording prevents an unqualified mutual claim');
  bobRecord.reviewedSources=discussionSnapshots(ws,bobRecord);assert.equal(assess(ws).needsReview,false);assert.equal(mutual(ws).state,'agree','Explicitly reviewed current wording can support a mutual status again');
  ws.discussions.push(makeDiscussion(ws,counterpartUnlinkInput(ws,thread.id,a,b),bob.id));assert.equal(mutual(ws),null,'Unlinking suppresses mutual status');assert.equal(assess(ws).state,'agree','Unlinking preserves personal assessments');assert.equal(assess(ws,b,alice).state,'agree');
}
{
  const ws=linked();const own=stance(ws,bob,a,'endorse');stance(ws,alice,b,'endorse');
  ws.discussions.push({...own,id:own.id+'other-thread',comparisonId:'other-comparison',action:'disagree',createdAt:when(++sequence),updatedAt:when(sequence)});
  assert.equal(assess(ws).state,'agree','A newer stance in another comparison cannot bleed into this one');assert.equal(assess(ws,a,alice).state,'unassessed','A map owner is not an assessor of their own node');
  assert.equal(nodeAssessment(ws,thread.id,a,'unknown-person').state,'unassessed');assert.equal(nodeAssessment(ws,'missing-comparison',a,bob.id).state,'unassessed');
  const unavailable=structuredClone(ws);unavailable.maps.find(m=>m.id===a.mapId).unavailable=true;assert.equal(assess(unavailable).state,'unassessed');assert.equal(mutual(unavailable),null);
  ws.maps.find(m=>m.id===b.mapId).nodes=ws.maps.find(m=>m.id===b.mapId).nodes.filter(n=>n.id!==b.nodeId);assert.equal(mutual(ws),null,'A missing counterpart cannot carry a mutual assessment');
}
{
  const ws=structuredClone(base);const earlier=record(ws,alice,{kind:'relationship',action:'agreement',target:a,other:b});assert.equal(assess(ws).state,'unassessed');assert.equal(mutual(ws),null,'An earlier pair judgment is not either person’s individual assessment');
  stance(ws,bob,a,'endorse');stance(ws,alice,b,'endorse');assert.equal(mutual(ws).state,'agree','A single historical pair can support new, explicit individual assessments');
  const extra={...b,nodeId:bm.nodes.find(n=>n.title.endsWith('alternative')).id};ws.discussions.push({...earlier,id:earlier.id+'legacy-second',other:extra});assert.equal(mutual(ws),null,'Legacy multiple counterpart choices suppress an ambiguous mutual status');assert.equal(mutual(ws,b),null,'The opposite endpoint also checks for ambiguous reverse linking');
}
{
  const states=[['endorse','agree'],['disagree','disagree'],['decline','no-position'],[null,'unassessed']];
  for(const [left,l]of states)for(const [right,r]of states){
    const ws=linked();if(left)stance(ws,bob,a,left);if(right)stance(ws,alice,b,right);
    const expected=[l,r].includes('unassessed')?'unassessed':l===r?l:'mixed',before=JSON.stringify(ws);
    const display=counterpartDisplay(ws,thread.id,a),reverse=counterpartDisplay(ws,thread.id,b);
    assert.equal(display.state,expected);assert.equal(reverse.state,expected);
    assert.deepEqual(display.assessments.map(s=>s.state),[l,r]);
    assert.deepEqual(reverse.assessments.map(s=>s.state),[r,l]);
    assert.equal(JSON.stringify(ws),before,'Complete overview projection preserves both source maps and histories');
  }
  const ws=linked();stance(ws,bob,a,'endorse');stance(ws,alice,b,'decline');
  ws.maps.find(m=>m.id===a.mapId).nodes.find(n=>n.id===a.nodeId).summary+=' Changed';
  assert.equal(counterpartDisplay(ws,thread.id,a).state,'review','Review takes precedence over mixed or incomplete assessments');
  ws.discussions.at(-1).status='withdrawn';assert.equal(counterpartDisplay(ws,thread.id,a).state,'review');
  ws.discussions.push(makeDiscussion(ws,counterpartUnlinkInput(ws,thread.id,a,b),bob.id));
  assert.equal(counterpartDisplay(ws,thread.id,a),null,'Unlinking removes the complete pair display too');
}
console.log('Comparison assessment model passed: latest explicit stance, withdrawal without resurrection, all 16 overview combinations, symmetric mutual status, stale-source review, scoped ownership, unlink preservation, missing and legacy-multiple counterparts.');
