import assert from 'node:assert/strict';
import {roots} from '../dist/data.mjs';
import {CARD_W,CARD_H,layoutTemporalForest} from '../dist/layout.mjs';
import {projectTemporalMap,temporalRoots,temporalViewForNode} from '../dist/temporal-frames.mjs';
import {layoutComparison,comparisonEndpoint,comparisonDisplayRects} from '../dist/comparison-layout.mjs';
import {revealPath} from '../dist/model.mjs';

const node=(id,parent,timeScope)=>({id,parent,timeScope,title:id,summary:'',kind:parent===null?'frame':'position'});
const map={id:'left',nodes:[
  ...roots.map(id=>node(id,null)),node('legacy','status'),node('past','legacy','history'),
  node('pastChild','past','history'),node('now','pastChild','present'),
  node('forecast','now','likely_future'),node('~history','action','history'),
  ...Array.from({length:16},(_,i)=>node('f'+i,'forecast','likely_future'))
],relations:[{id:'causal',from:'past',to:'forecast',type:'causal'},{id:'reform',from:'~history',to:'now',type:'support'}]};
const right={id:'right',nodes:[...roots.map(id=>node(id,null)),node('claim','status')],relations:[]};
const snapshot=JSON.stringify(map),main=projectTemporalMap(map),timeline=projectTemporalMap(map,'timeline');
assert.deepEqual(main.roots,roots);
assert.deepEqual(main.nodes.map(n=>n.id),[...roots,'legacy','now','~history']);
assert.equal(main.byId.get('now').parent,'status');
assert.equal(main.sourceById.get('now').parent,'pastChild');
assert.deepEqual(main.relations.map(e=>e.id),['reform']);
assert.equal(temporalViewForNode(map,'~history','timeline'),'main','Ignore stray timeScope on an Action claim');
assert.equal(temporalViewForNode(map,'past','main'),'timeline');
assert.equal(temporalViewForNode(map,'legacy','timeline'),'timeline');
assert.equal(temporalViewForNode(map,'absent','main'),'main');
assert.deepEqual(timeline.roots,['~~history','status','~likely_future']);
assert.deepEqual(timeline.roots.map(id=>timeline.byId.get(id).title),['History','Status Quo · Present','Likely Future']);
assert(!timeline.byId.has('~history'));assert(!timeline.byId.has('action'));assert(!timeline.byId.has('goal'));
assert.equal(timeline.byId.get('past').parent,timeline.roots[0]);
assert.equal(timeline.byId.get('pastChild').parent,'past');
assert.deepEqual([...revealPath(timeline.nodes,'pastChild',new Set())],['past',timeline.roots[0]]);
assert.deepEqual(timeline.relations.map(e=>e.id),['causal']);

function disjoint(rects){
  for(const [i,a] of rects.entries())for(const b of rects.slice(i+1))
    assert(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y),'Cards or counterpart placeholders overlap');
}
const expanded=new Set(timeline.byId.keys());
const full=layoutTemporalForest(timeline,expanded),folded=layoutTemporalForest(timeline,new Set());
const narrow=projectTemporalMap({nodes:[...roots.map(id=>node(id,null)),node('past','status','history'),node('earlier','past','history')]},'timeline');
const chain=layoutTemporalForest(narrow,new Set(narrow.byId.keys()));
assert(chain.height<2*CARD_H,'A single temporal chain uses the available horizontal space');
assert(chain.positions.get('earlier').x>chain.positions.get('past').x+CARD_W);
assert.deepEqual([...folded.positions.keys()],timeline.roots);
assert.deepEqual(folded.edges,[],'Time order alone never creates an edge');
assert(!full.edges.some(e=>timeline.syntheticIds.has(e.from)||timeline.syntheticIds.has(e.to)));
assert(full.edges.some(e=>e.from==='pastChild'&&e.to==='now'),'Cross-period structural links retain their real parent');
assert(full.edges.some(e=>e.from==='now'&&e.to==='forecast'));
assert(!layoutTemporalForest(main,new Set(main.byId.keys())).edges.some(e=>e.from==='status'&&e.to==='now'));
disjoint([...full.positions.values()].map(p=>({...p,w:CARD_W,h:CARD_H})));
for(let index=1;index<3;index++){
  const a=full.positions.get(timeline.roots[index-1]),b=full.positions.get(timeline.roots[index]);
  assert(a.x+CARD_W<b.x);assert.equal(a.y,b.y);
}
const states={a:{map,expanded,frame:'all'},b:{map:right,expanded:new Set(['status']),frame:'all'}};
const record={id:'manual',kind:'correspondence',status:'active',target:{mapId:map.id,nodeId:'past'},other:{mapId:right.id,nodeId:'claim'}};
const compare=view=>layoutComparison(states,roots,{frameView:view,links:[record]});
const inMain=compare('main'),inTime=compare('timeline');
assert.equal(comparisonEndpoint(inMain,'a','past').status,'filtered');
assert.equal(comparisonEndpoint(inMain,'b','claim').status,'visible');
assert.equal(comparisonEndpoint(inTime,'a','~history').status,'filtered','A real ID colliding with the usual heading stays distinct');
assert.equal(comparisonEndpoint(inTime,'a','past').status,'visible');
assert.equal(comparisonEndpoint(inTime,'b','claim').status,'visible');
assert.equal(comparisonEndpoint(inTime,'a','missing').status,'missing');
assert.equal(inTime.maps.b.positions.size,4,'An empty temporal section still has a heading');
assert(inTime.maps.b.positions.has('~~history'),'Both participants use the same display roots');
disjoint(comparisonDisplayRects(inTime));
assert.deepEqual(temporalRoots('timeline',[right,map]),timeline.roots);
const unavailable=projectTemporalMap({...map,unavailable:true},'timeline');
assert.equal(unavailable.byId.size,0);assert.equal(unavailable.sourceById.size,0);
assert.equal(JSON.stringify(map),snapshot,'Layout and frame switching never rewrite saved records');
console.log('Temporal Canvas checks passed: exclusive sections, mixed parent paths, stable targets, dense layouts and asymmetric comparisons.');
