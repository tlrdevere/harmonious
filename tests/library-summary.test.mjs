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
assert.deepEqual(summary.counts,{relationships:1,inquiries:3,reasons:1,challenges:2,earlierJudgments:0,earlierReasoning:2,sourceReviews:0});
assert.equal(summary.description,'1 relationship · 3 questions & requests · 1 reason · 2 challenges · 2 earlier reasoning items');
assert.equal(summary.activity,Date.parse('2026-09-19T00:00:00Z'),'Replies affect activity; unrelated threads, map edits and personal context do not');
assert.deepEqual(libraryComparisonOrder(workspace).map(s=>s.thread.id),['thread','second'],'A recent response brings an older comparison before a newer empty one');
assert.deepEqual(workspace,before,'Building summaries preserves all source data');

workspace.discussions.find(r=>r.id==='reply').updatedAt='invalid';workspace.discussions.find(r=>r.id==='withdrawn-challenge').updatedAt='2026-09-20T00:00:00Z';
assert.equal(libraryComparisonSummary(workspace,thread).activity,Date.parse('2026-09-20T00:00:00Z'),'A withdrawal is activity but not a current challenge count');
assert.equal(libraryComparisonSummary(workspace,thread).counts.challenges,2);
workspace.discussions=[];workspace.argumentNodes=[];workspace.argumentEdges=[];
assert.equal(libraryComparisonSummary(workspace,thread).description,'No contributions yet');
workspace.discussions=[r('withdrawn-only','argument','reason',{status:'withdrawn'})];assert.equal(libraryComparisonSummary(workspace,thread).description,'Conversation history available');
workspace.discussions=[];workspace.comparisonThreads=[{...thread,id:'z'},{...thread,id:'a'}];assert.deepEqual(libraryComparisonOrder(workspace).map(s=>s.thread.id),['a','z'],'Equal activity and titles use stable ids');
workspace.maps.push({id:'c',name:'Aaron'});workspace.comparisonThreads=[{...thread,id:'z',aMapId:'c'},thread];assert.deepEqual(libraryComparisonOrder(workspace).map(s=>s.thread.id),['z','thread'],'Equal activity uses the displayed title before id');

const legacy=initialWorkspace(),[a,b]=legacy.maps,proposal=recordComparison(legacy,{aMapId:a.id,bMapId:b.id,aNodeId:'a211',bNodeId:'a211',questionStatus:'matched',question:'Which order?',answerStatus:'aligned'},null,a.ownerId);legacy.comparisons.push(proposal);
const legacyThread=legacy.comparisonThreads.find(t=>t.id===proposal.comparisonId);proposal.updatedAt='2026-09-22T00:00:00Z';legacyThread.createdAt='2026-09-01T00:00:00Z';
assert.equal(libraryComparisonSummary(legacy,legacyThread).activity,Date.parse(proposal.updatedAt),'Earlier proposal updates contribute to recency');
assert.equal(libraryComparisonSummary(legacy,legacyThread).description,'1 earlier judgment');a.nodes.find(n=>n.id==='a211').summary+=' Changed wording.';
assert.equal(libraryComparisonSummary(legacy,legacyThread).counts.sourceReviews,1,'Existing source-review information remains available');
console.log('Library summaries passed: distinct reason/challenge counts, earlier work labels, meaningful activity order, timestamp normalization, stable ties and unchanged data.');
