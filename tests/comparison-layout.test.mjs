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
  for(const root of roots){const p=result.maps.a?.positions.get(root),q=result.maps.b?.positions.get(root);if(p&&q)assert.equal(p.x,q.x,'Corresponding frames share a column');}
  for(const side of ['a','b']){
    const view=result.maps[side];if(!view)continue;const lane=result.lanes.find(l=>l.side===side),byId=new Map(states[side].map.nodes.map(n=>[n.id,n]));
    for(const [id,p]of view.positions){assert(p.x>=lane.x&&p.x+CARD_W<=lane.x+lane.width+1e-8);assert(p.y>=lane.y&&p.y+CARD_H<=lane.y+lane.height+1e-8);let node=byId.get(id);while(node.parent){assert(states[side].expanded.has(node.parent),'Only expanded branches reveal descendants');node=byId.get(node.parent);}if(states[side].frame!=='all')assert.equal(node.id,states[side].frame);}
  }
  return result;
}
const collapsed=check();assert.equal(collapsed.positions.size,6,'Shared node IDs do not merge the two maps');
assert.notEqual(comparisonNodeKey('a','status'),comparisonNodeKey('b','status'));
states.a.expanded=new Set(a.nodes.map(n=>n.id));const asymmetric=check();assert.equal(asymmetric.maps.a.positions.size,a.nodes.length);assert.equal(asymmetric.maps.b.positions.size,3);assert(asymmetric.lanes[1].y>collapsed.lanes[1].y,'Map B makes room for an expanded map A');
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
console.log('PASS: shared world identity, aligned frame columns, 100 asymmetric expansion/filter patterns, no overlapping cards, collapsed-source proxies, swapped map references, and portable comparison records.');
