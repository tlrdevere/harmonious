import assert from 'node:assert/strict';
import {libraryMapOrder,libraryComparisonSummary,libraryComparisonOrder} from '../dist/library-summary.mjs';
import {initialWorkspace,recordComparison} from '../dist/workspace.mjs';

const maps=[
  {id:'z',name:'Alpha',updatedAt:'2026-09-18T09:00:00-04:00'},
  {id:'a',name:'alpha',updatedAt:'2026-09-18T13:00:00Z'},
  {id:'earlier',name:'First alphabetically',updatedAt:'2026-09-18T12:00:00Z'},
  {id:'newest',name:'Zebra',updatedAt:'2026-09-19T00:00:00Z'},
  {id:'unknown',name:'Undated',updatedAt:'not a timestamp'}
];
const mapBefore=structuredClone(maps),expected=['newest','a','z','earlier','unknown'];
assert.deepEqual(libraryMapOrder(maps).map(m=>m.id),expected);assert.deepEqual(libraryMapOrder([...maps].reverse()).map(m=>m.id),expected);assert.deepEqual(maps,mapBefore,'Sorting does not mutate saved maps');

const thread={id:'thread',aMapId:'a',bMapId:'b',createdAt:'2026-09-01T00:00:00Z'},second={...thread,id:'second',createdAt:'2026-09-17T00:00:00Z'};
const r=(id,kind,action,changes={})=>({id,kind,action,comparisonId:thread.id,status:'active',createdAt:'2026-09-02T00:00:00Z',...changes});
const workspace={maps:[{id:'a',name:'Alice',updatedAt:'2099-01-01T00:00:00Z'},{id:'b',name:'Bob'}],comparisonThreads:[thread,second],comparisons:[],argumentNodes:[r('old-ground','ground',null)],argumentEdges:[r('old-edge','edge',null)],discussions:[
  r('reason','argument','reason'),r('challenge','argument','challenge'),r('fallacy','argument','fallacy'),r('relationship','relationship','agreement'),
  r('question','inquiry','question'),r('counterpart','counterpart','counterpart'),r('adoption','adoption','adoption'),
  r('reply','reply','reply',{updatedAt:'2026-09-19T00:00:00Z'}),r('outcome','reply','resolve'),
  r('withdrawn-reason','argument','reason',{status:'withdrawn'}),r('withdrawn-challenge','argument','challenge',{status:'withdrawn'}),
  r('inaccessible-context','context','context',{comparisonId:null,updatedAt:'2099-01-01T00:00:00Z'}),r('another-thread','argument','reason',{comparisonId:'unrelated',updatedAt:'2099-01-01T00:00:00Z'})
]};
const before=structuredClone(workspace),summary=libraryComparisonSummary(workspace,thread);
assert.deepEqual(summary.counts,{positions:0,relationships:1,inquiries:1,counterparts:1,reasons:1,disputes:0,challenges:2,earlierRecords:1,earlierJudgments:0,earlierReasoning:2,sourceReviews:0,disagreementPoints:0,outcomes:0});
assert.equal(summary.description,'1 inquiry · 1 counterpart request · 1 earlier relationship · 1 earlier reason · 2 earlier challenges · 1 earlier conversation · 2 earlier reasoning items');
assert.equal(summary.activity,Date.parse('2026-09-19T00:00:00Z'),'Replies affect activity; unrelated threads, map edits and personal context do not');
assert.deepEqual(libraryComparisonOrder(workspace).map(s=>s.thread.id),['thread','second'],'A recent response brings an older comparison before a newer empty one');
assert.deepEqual(workspace,before,'Building summaries preserves all source data');

workspace.discussions.find(r=>r.id==='reply').updatedAt='invalid';workspace.discussions.find(r=>r.id==='withdrawn-challenge').updatedAt='2026-09-20T00:00:00Z';
assert.equal(libraryComparisonSummary(workspace,thread).activity,Date.parse('2026-09-20T00:00:00Z'),'A withdrawal is activity but not a current challenge count');
assert.equal(libraryComparisonSummary(workspace,thread).counts.challenges,2);
workspace.discussions.push(r('point','reflection','disagreement_point'),r('alice-outcome','reflection','outcome',{target:{type:'entry',entryId:'point'}}),r('bob-outcome','reflection','outcome',{target:{type:'entry',entryId:'point'}}),r('withdrawn-point','reflection','disagreement_point',{status:'withdrawn'}),r('historical-outcome','reflection','outcome',{target:{type:'entry',entryId:'withdrawn-point'}}));
const reflected=libraryComparisonSummary(workspace,thread);assert.equal(reflected.counts.disagreementPoints,1);assert.equal(reflected.counts.outcomes,2);assert.equal(reflected.counts.inquiries,1);assert.equal(reflected.counts.challenges,2);assert.equal(reflected.counts.earlierRecords,2);assert.match(reflected.description,/2 earlier conversations/);

const modern=(id,action,mode,extra={})=>r(id,'interaction',action,{interaction:{mode},...extra});
const modernOnly={...workspace,argumentNodes:[],argumentEdges:[],discussions:[modern('position','endorse','compare'),modern('no-position','decline','compare'),modern('ask','request_explanation','inquiry'),modern('offer','offer_reason','inquiry'),modern('dispute','dispute','argument'),modern('response','respond','argument',{target:{type:'entry',entryId:'dispute'},updatedAt:'2026-09-24T00:00:00Z'}),modern('withdrawn-position','disagree','compare',{status:'withdrawn'}),modern('withdrawn-question','request_reason','inquiry',{status:'withdrawn'}),modern('withdrawn-dispute','dispute','argument',{status:'withdrawn'}),modern('active-response-to-withdrawn','respond','argument',{target:{type:'entry',entryId:'withdrawn-dispute'},updatedAt:'2026-09-25T00:00:00Z'})]};
const modernSummary=libraryComparisonSummary(modernOnly,thread);
assert.equal(modernSummary.description,'2 positions · 2 inquiries · 1 dispute','Grammar-only comparisons communicate their initiating interactions');
assert.equal(modernSummary.activity,Date.parse('2026-09-25T00:00:00Z'),'An active response to withdrawn history remains meaningful activity');
assert.equal(modernSummary.counts.positions,2);assert.equal(modernSummary.counts.inquiries,2);assert.equal(modernSummary.counts.disputes,1);assert.equal(modernSummary.counts.challenges,0);
const mixed=libraryComparisonSummary({...modernOnly,discussions:[...modernOnly.discussions,...workspace.discussions]},thread);
assert.equal(mixed.counts.positions,2);assert.equal(mixed.counts.relationships,1);assert.equal(mixed.counts.inquiries,3);assert.equal(mixed.counts.counterparts,1);assert.equal(mixed.counts.disputes,1);assert.equal(mixed.counts.challenges,2);assert.equal(mixed.counts.earlierRecords,2);
workspace.discussions=[];workspace.argumentNodes=[];workspace.argumentEdges=[];
assert.equal(libraryComparisonSummary(workspace,thread).description,'No contributions yet');
workspace.discussions=[r('withdrawn-only','argument','reason',{status:'withdrawn'})];assert.equal(libraryComparisonSummary(workspace,thread).description,'Conversation history available');
workspace.discussions=[];workspace.comparisonThreads=[{...thread,id:'z'},{...thread,id:'a'}];assert.deepEqual(libraryComparisonOrder(workspace).map(s=>s.thread.id),['a','z'],'Equal activity and titles use stable ids');
workspace.maps.push({id:'c',name:'Aaron'});workspace.comparisonThreads=[{...thread,id:'z',aMapId:'c'},thread];assert.deepEqual(libraryComparisonOrder(workspace).map(s=>s.thread.id),['z','thread'],'Equal activity uses the displayed title before id');

const legacy=initialWorkspace(),[a,b]=legacy.maps,proposal=recordComparison(legacy,{aMapId:a.id,bMapId:b.id,aNodeId:'a211',bNodeId:'a211',questionStatus:'matched',question:'Which order?',answerStatus:'aligned'},null,a.ownerId);legacy.comparisons.push(proposal);
const legacyThread=legacy.comparisonThreads.find(t=>t.id===proposal.comparisonId);proposal.createdAt='2026-09-01T00:00:00Z';proposal.updatedAt='2026-09-22T00:00:00Z';legacyThread.createdAt='2026-09-01T00:00:00Z';
assert.equal(libraryComparisonSummary(legacy,legacyThread).activity,Date.parse(proposal.updatedAt),'Earlier proposal updates contribute to recency');
assert.equal(libraryComparisonSummary(legacy,legacyThread).description,'1 earlier judgment');a.nodes.find(n=>n.id==='a211').summary+=' Changed wording.';
assert.equal(libraryComparisonSummary(legacy,legacyThread).counts.sourceReviews,1,'Existing source-review information remains available');
console.log('Library summaries passed: distinct reason/challenge counts, earlier work labels, meaningful activity order, timestamp normalization, stable ties and unchanged data.');

assert.match(libraryComparisonSummary(legacy,legacyThread).description,/1 earlier judgment needs source review/);
