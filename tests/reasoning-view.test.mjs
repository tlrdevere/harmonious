import assert from 'node:assert/strict';
import {buildReasoningIndex,projectReasoning,reasoningTargetKey,searchReasoning,ReasoningViewState} from '../dist/reasoning-view.mjs';

const anchor={type:'node',mapId:'map-a',nodeId:'position'},otherAnchor={type:'node',mapId:'map-b',nodeId:'other-position'},entry=id=>({type:'entry',entryId:id}),inference=id=>({type:'inference',entryId:id});
let sequence=0;
const record=(id,kind,action,target,extra={})=>({id,comparisonId:'comparison',kind,action,target,other:null,authorId:kind==='argument'&&action!=='reason'?'bob':'alice',status:'active',createdAt:new Date(1700000000000+sequence++).toISOString(),body:id+' wording',targetLabel:'Position',layer:kind==='reply'?'arguments':null,...extra});
const records=[record('r','argument','reason',anchor),record('nested','argument','reason',entry('r')),record('statement','argument','challenge',entry('r')),record('answer','reply','reply',entry('statement')),record('inference','argument','inference',inference('r')),record('inference-answer','reply','reply',entry('inference')),record('resolved','reply','resolve',entry('statement'),{authorId:'bob'}),record('withdrawn-child','argument','challenge',entry('r'),{status:'withdrawn'}),record('other','argument','reason',otherAnchor)];
const index=buildReasoningIndex([...records].reverse());
assert(index.openChallenges.has('inference'));assert(!index.openChallenges.has('statement'));
assert.notEqual(reasoningTargetKey(entry('r')),reasoningTargetKey(inference('r')));
const full=projectReasoning(index,{anchor});assert.deepEqual(new Set(full.entries.map(r=>r.id)),new Set(['r','nested','statement','answer','inference','inference-answer']));
assert.equal(full.folds.get(reasoningTargetKey(entry('r'))).total,3,'Statement fold excludes its inference discussion and outcome/withdrawn records');
assert.equal(full.folds.get(reasoningTargetKey(inference('r'))).total,2);
assert.equal(full.folds.get(reasoningTargetKey(inference('r'))).directChallenges,1);assert.equal(full.folds.get(reasoningTargetKey(inference('r'))).totalOpenChallenges,1);
const folded=projectReasoning(index,{anchor,collapsed:new Set([reasoningTargetKey(entry('r'))])});
assert.deepEqual(new Set(folded.entries.map(r=>r.id)),new Set(['r','inference','inference-answer']));assert.equal(folded.hiddenByFold,3);assert.equal(folded.overflowCount,0);
assert.equal(folded.folds.get(reasoningTargetKey(entry('r'))).hidden,3);assert.equal(folded.folds.get(reasoningTargetKey(entry('r'))).openChallenges,0,'Resolved challenge remains in total, not open count');
const inferenceFold=projectReasoning(index,{anchor,collapsed:new Set([reasoningTargetKey(inference('r'))])});assert(!inferenceFold.entries.some(r=>r.id==='inference'));assert(inferenceFold.entries.some(r=>r.id==='statement'));assert.equal(inferenceFold.folds.get(reasoningTargetKey(inference('r'))).openChallenges,1);
const nestedFolds=new Set([reasoningTargetKey(anchor),reasoningTargetKey(entry('r'))]);
const entirelyFolded=projectReasoning(index,{anchor,collapsed:nestedFolds});assert.equal(entirelyFolded.entries.length,0);assert.equal(entirelyFolded.hiddenByFold,6);
nestedFolds.delete(reasoningTargetKey(anchor));assert(!projectReasoning(index,{anchor,collapsed:nestedFolds}).entries.some(r=>r.id==='statement'),'Restoring the ancestor does not reset its internal folds');
const pinned=projectReasoning(index,{anchor,collapsed:nestedFolds,pinnedIds:['answer']});assert(pinned.entries.some(r=>r.id==='answer'));assert(pinned.entries.some(r=>r.id==='statement'));assert(!pinned.entries.some(r=>r.id==='nested'));assert.equal(pinned.hiddenByFold,1,'A draft path remains visible while its siblings are folded');
const revealed=projectReasoning(index,{anchor,collapsed:nestedFolds,focusId:'answer',revealFocus:true});assert(revealed.entries.some(r=>r.id==='answer'));assert.deepEqual(revealed.revealedFoldKeys,[reasoningTargetKey(entry('r'))]);assert(nestedFolds.has(reasoningTargetKey(entry('r'))),'Projection does not mutate personal view state');

const historical=records.map(r=>r.id==='r'?{...r,status:'withdrawn'}:r),historicalView=projectReasoning(buildReasoningIndex(historical),{anchor});
assert(historicalView.entries.some(r=>r.id==='r'&&r.status==='withdrawn'));assert.equal(historicalView.folds.get(reasoningTargetKey(anchor)).total,5,'Historical context cards do not increase contribution counts');

const deep=[];for(let i=0;i<90;i++)deep.push(record('deep-'+i,'argument','reason',i?entry('deep-'+(i-1)):anchor));
deep.push(record('deep-inference','argument','inference',inference('deep-80')));
const deepIndex=buildReasoningIndex([...deep].reverse()),deepView=projectReasoning(deepIndex,{anchor,focusId:'deep-80'}),shown=new Set(deepView.entries.map(r=>r.id));
assert(shown.has('deep-80'));assert(deepView.entries.length<=40);assert(deepView.earlierSteps.length>0);assert(deepView.earlierSteps[0].count>40);assert.equal(deepView.focusHidden,false);
for(const link of deepView.links)if(link.target.type==='entry')assert(shown.has(link.target.entryId),'No line jumps across omitted ancestors');
const boundary=deepView.earlierSteps[0];assert(!deepView.links.some(link=>link.entryId===boundary.entryId));
const previousPart=projectReasoning(deepIndex,{anchor,focusId:boundary.firstOmittedId});assert(previousPart.entries.some(r=>r.id===boundary.firstOmittedId),'Earlier steps navigate to an actual contribution');
const inferred=projectReasoning(deepIndex,{anchor,focusId:'deep-inference',budget:3}),inferredIds=new Set(inferred.entries.map(r=>r.id));assert.deepEqual(inferredIds,new Set(['deep-inference','deep-80','deep-79']));assert(inferred.links.some(l=>l.entryId==='deep-inference'&&l.target.type==='inference'));

const wide=[record('wide-root','argument','reason',anchor),...Array.from({length:200},(_,i)=>record('sibling-'+i,'argument','challenge',entry('wide-root')))];
const wideIndex=buildReasoningIndex(wide),wideView=projectReasoning(wideIndex,{anchor});assert.equal(wideView.entries.length,40);assert.equal(wideView.hiddenByFold,0);assert.equal(wideView.overflowCount,161);
const targetView=projectReasoning(wideIndex,{anchor,focusId:'sibling-199'});assert(targetView.entries.some(r=>r.id==='sibling-199'));assert(targetView.entries.some(r=>r.id==='wide-root'));
assert.equal(searchReasoning(wideIndex,{query:'sibling-199'}).results[0].entry.id,'sibling-199','Search reaches records outside the rendered budget');
assert.equal(searchReasoning(index,{filter:'open'}).results.length,1);
assert.equal(searchReasoning(index,{query:'BOB reasoning connection',authorName:id=>id==='bob'?'Bob':'Alice'}).results[0].entry.id,'inference');
const classified=searchReasoning(index,{query:'statement'}).results.find(r=>r.entry.id==='statement');assert.equal(classified.targetType,'Reason node');
assert(searchReasoning(index,{query:'other'}).results.some(r=>r.anchor.nodeId==='other-position'),'Search spans all source groups in the current Comparison');
const question=record('question','inquiry','question',anchor),questionView=projectReasoning(buildReasoningIndex([question]),{anchor,focusId:'question'});assert.equal(questionView.entries[0].id,'question','Contextual search results can be shown without pretending they are arguments');
const questionDraft=projectReasoning(buildReasoningIndex([question]),{anchor,pinnedIds:['question'],collapsed:new Set([reasoningTargetKey(anchor)])});assert.equal(questionDraft.entries[0].id,'question','An unfinished contextual draft pins its target even when it is not an ordinary argument or focused result');assert.equal(questionDraft.hiddenByFold,0);
const foreignDraft=projectReasoning(buildReasoningIndex([question]),{anchor:otherAnchor,pinnedIds:['question']});assert.equal(foreignDraft.entries.length,0,'Draft pinning never moves a contribution into an unrelated source group');
const relation=record('relation','relationship','agreement',anchor,{other:otherAnchor}),relationView=projectReasoning(buildReasoningIndex([relation]),{anchor:entry('relation'),focusId:'relation'});assert.equal(relationView.focusHidden,false,'A relationship search result focuses its existing source connection');

const point=record('difference-note','reflection','disagreement_point',inference('r'),{layer:'arguments',reflection:{category:'values'}}),outcome=record('personal-outcome','reflection','outcome',entry(point.id),{layer:'arguments',reflection:{result:'more_work',nextStep:'Revisit the tradeoff after the next study.'}}),annotatedIndex=buildReasoningIndex([...records,point,outcome]);
for(const id of [point.id,outcome.id]){
  const view=projectReasoning(annotatedIndex,{anchor,focusId:id,pinnedIds:[point.id,outcome.id],revealFocus:true});assert.deepEqual(view.entries.map(r=>r.id),full.entries.map(r=>r.id),'Even focused and pinned annotations stay off the graph');assert.deepEqual(view.links,full.links);assert.deepEqual(view.folds,full.folds,'Annotations do not increase reason/challenge follow-up counts');
}
assert.equal(projectReasoning(buildReasoningIndex([point,outcome]),{anchor,focusId:point.id,pinnedIds:[outcome.id]}).entries.length,0);
assert.equal(searchReasoning(annotatedIndex,{query:'values'}).results[0].entry.id,point.id);assert.equal(searchReasoning(annotatedIndex,{query:'tradeoff'}).results[0].entry.id,outcome.id);
assert.equal(searchReasoning(annotatedIndex,{query:'difference-note'}).results[0].type,'Point of disagreement');assert.equal(searchReasoning(annotatedIndex,{query:'personal-outcome'}).results[0].targetType,'Point of disagreement');
assert.equal(searchReasoning(annotatedIndex,{filter:'open'}).results.length,searchReasoning(index,{filter:'open'}).results.length,'Personal reflection never opens or resolves a challenge');

const states=new ReasoningViewState(),state=states.get('alice','comparison',anchor);state.collapsed.add(reasoningTargetKey(entry('r')));state.focusId='r';state.camera={x:12,y:20,z:.8};
assert.equal(states.get('alice','comparison',anchor),state);const another=states.get('alice','another-comparison',otherAnchor);another.focusId='other';
states.prune('alice','comparison',new Set(['r']));assert.equal(states.get('alice','another-comparison',otherAnchor),another,'Revisiting another comparison preserves its personal view');
states.prune('alice','comparison',new Set());assert.equal(state.focusId,null);assert.equal(state.collapsed.size,0);
states.prune('bob','comparison',new Set());assert([...states.scopes.values()].every(value=>value.actorId==='bob'));
states.get('bob','comparison',anchor);states.clearThread('bob','comparison');assert.equal(states.scopes.size,0);states.get('alice','comparison',anchor);states.reset();assert.equal(states.scopes.size,0);
assert.equal(records[0].status,'active','Projection does not edit saved contributions');
const maximumChain=Array.from({length:10000},(_,i)=>record('limit-'+i,'argument','reason',i?entry('limit-'+(i-1)):anchor)),maximumIndex=buildReasoningIndex(maximumChain),maximumView=projectReasoning(maximumIndex,{anchor,focusId:'limit-9900'});
assert(maximumView.entries.some(r=>r.id==='limit-9900'));assert.equal(maximumView.entries.length,40);assert(maximumView.earlierSteps[0].count>9000,'The supported record limit is traversed iteratively');
console.log('Typed argument folds, exact counts, draft paths, deep bounded sections, inference groups, search and private view state passed.');

const pinnedWording=record('pinned','argument','reason',anchor,{premise:{wording:{title:'Saved title',summary:'Distinct summary phrase',details:'Pinned detail phrase'}}});
for(const query of ['distinct summary','pinned detail','saved title'])assert.equal(searchReasoning(buildReasoningIndex([pinnedWording]),{query}).results[0].entry.id,'pinned');
assert.equal(searchReasoning(buildReasoningIndex([pinnedWording]),{query:'unreviewed changes'}).total,0);

// Modern interactions stay attached to their source even if an old navigation
// caller passes one as a focused or pinned historical graph contribution.
const modern=record('modern-dispute','interaction','dispute',anchor,{interaction:{mode:'argument'}});
const modernIndex=buildReasoningIndex([...records,modern]);
for(const opts of [{focusId:modern.id,revealFocus:true},{pinnedIds:[modern.id]}]){
  const projection=projectReasoning(modernIndex,{anchor,...opts});
  assert(!projection.entries.some(r=>r.id===modern.id));
  assert(!projection.links.some(r=>r.entryId===modern.id));
}
