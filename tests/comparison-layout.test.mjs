import assert from 'node:assert/strict';
import {initialWorkspace,recordComparison,validateWorkspace} from '../dist/workspace.mjs';
import {roots} from '../dist/data.mjs';
import {CARD_W,CARD_H} from '../dist/layout.mjs';
import {comparisonNodeKey,layoutComparison,visibleComparisonEndpoint,comparisonRecordEnds} from '../dist/comparison-layout.mjs';

const workspace=initialWorkspace(),[a,b]=workspace.maps;
const states={a:{map:a,frame:'all',expanded:new Set()},b:{map:b,frame:'all',expanded:new Set()}};
const original=JSON.stringify(workspace);
function check(){
  const result=layoutComparison(states,roots),points=[...result.positions.values()];
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
    const p=points[i],q=points[j];assert(!(p.x<q.x+CARD_W&&p.x+CARD_W>q.x&&p.y<q.y+CARD_H&&p.y+CARD_H>q.y),'Cards in the shared world must not overlap');
  }
  for(const root of roots){const p=result.maps.a?.positions.get(root),q=result.maps.b?.positions.get(root);if(p&&q){assert.equal(p.y,q.y,'Both maps occupy the same frame centerline');assert(Math.abs(q.x-p.x-CARD_W-16)<1e-8,'Paired frame cards remain independently readable');}}
  for(const side of ['a','b']){
    const view=result.maps[side];if(!view)continue;const lane=result.bounds,byId=new Map(states[side].map.nodes.map(n=>[n.id,n]));
    for(const [id,p]of view.positions){assert(p.x>=lane.x&&p.x+CARD_W<=lane.x+lane.width+1e-8);assert(p.y>=lane.y&&p.y+CARD_H<=lane.y+lane.height+1e-8);let node=byId.get(id);while(node.parent){assert(states[side].expanded.has(node.parent),'Only expanded branches reveal descendants');node=byId.get(node.parent);}if(states[side].frame!=='all')assert.equal(node.id,states[side].frame);}
  }
  return result;
}
const collapsed=check();assert.equal(collapsed.positions.size,6,'Shared node IDs do not merge the two maps');
assert.notEqual(comparisonNodeKey('a','status'),comparisonNodeKey('b','status'));
states.a.expanded=new Set(a.nodes.map(n=>n.id));const asymmetric=check();assert.equal(asymmetric.maps.a.positions.size,a.nodes.length);assert.equal(asymmetric.maps.b.positions.size,3);assert.equal(asymmetric.lanes.length,1,'Expansion stays within a common overlay instead of moving B into another lane');
let seed=2026;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
for(let i=0;i<100;i++){for(const side of ['a','b']){states[side].expanded=new Set(states[side].map.nodes.filter(()=>random()>.4).map(n=>n.id));states[side].frame=i%5===0?roots[i%3]:'all';}check();}
states.a.frame='all';states.b.frame='all';states.a.expanded.clear();states.b.expanded.clear();
let result=check();const proxy=visibleComparisonEndpoint(result,'a','a211');assert.equal(proxy.visibleId,'action');assert.equal(proxy.nodeId,'a211');assert(proxy.proxy);
assert.equal(visibleComparisonEndpoint(result,'a','deleted-node'),null,'Deleted nodes must not be replaced with a different source');
states.a.frame='status';result=check();assert.equal(visibleComparisonEndpoint(result,'a','a211'),null,'Frame filtering must not redirect a correspondence into another frame');
states.a.frame='all';states.a.expanded=new Set(['action','a2','a21']);result=check();assert.equal(visibleComparisonEndpoint(result,'a','a211').proxy,false);
assert.equal(JSON.stringify(workspace),original,'Layout and proxy display leave both original maps intact');
const record=recordComparison(workspace,{aMapId:a.id,bMapId:b.id,aNodeId:'a211',bNodeId:'a1',questionStatus:'matched',question:'Which part of the process should come first?',answerStatus:'divergent',notes:''});workspace.comparisons.push(record);
assert.deepEqual(comparisonRecordEnds(record,states),{a:'a211',b:'a1'});
assert.deepEqual(comparisonRecordEnds(record,{a:states.b,b:states.a}),{a:'a1',b:'a211'},'Swapping displayed maps retains source identity');
const reopened=validateWorkspace(JSON.parse(JSON.stringify(workspace)));assert.deepEqual(reopened.comparisons,[record]);assert.equal(reopened.comparisons[0].aNodeId,'a211');
const single=layoutComparison({a:states.a,b:{map:null}},roots);assert.equal(single.lanes.length,1);assert(Number.isFinite(single.bounds.height));
// Unrelated IDs and extra branches must not be merged or treated as counterparts.
const distinct=structuredClone(b);distinct.id='different';const rename=id=>roots.includes(id)?id:`other-${id}`;distinct.nodes=distinct.nodes.map(n=>({...n,id:rename(n.id),parent:n.parent===null?null:rename(n.parent)}));distinct.nodes.push({...distinct.nodes.find(n=>n.parent!==null),id:'extra',parent:'status'});
const unequal=layoutComparison({a:{map:a,frame:'all',expanded:new Set(a.nodes.map(n=>n.id))},b:{map:distinct,frame:'all',expanded:new Set(distinct.nodes.map(n=>n.id))}},roots);
assert.equal(unequal.positions.size,a.nodes.length+distinct.nodes.length);assert(unequal.maps.b.positions.has('extra'));assert(unequal.maps.a.positions.has('a211'));assert(unequal.maps.b.positions.has('other-a211'));
for(const [side,view]of Object.entries(unequal.maps))for(const edge of view.layout.edges){assert(unequal.positions.has(comparisonNodeKey(side,edge.from)));assert(unequal.positions.has(comparisonNodeKey(side,edge.to)));}
console.log('PASS: overlaid frames, independent identities, unequal trees, 100 expansion/filter patterns, readable cards, collapsed-source proxies, swapped sources, single-map layout, and portable records.');
