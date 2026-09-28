import assert from 'node:assert/strict';
import {initialWorkspace,recordComparison,validateWorkspace} from '../dist/workspace.mjs';
import {roots} from '../dist/data.mjs';
import {CARD_W,CARD_H} from '../dist/layout.mjs';
import {routeStraightConnection} from '../dist/reasoning-layout.mjs';
import {comparisonNodeKey,layoutComparison,visibleComparisonEndpoint,comparisonRecordEnds,comparisonDisplayRects,COUNTERPART_W,COUNTERPART_H,COMPARISON_GROUP_GAP} from '../dist/comparison-layout.mjs';

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

// Explicit links override sibling order and empty counterpart spots never hide
// an unrelated node. Both assignments leave the original trees unchanged.
const small=(id)=>({id,nodes:roots.map(id=>({id,parent:null})).concat([{id:'one',parent:'status'},{id:'two',parent:'status'},{id:'three',parent:'one'}]),relations:[]});
const left=small('a-map'),right=small('b-map'),full={a:{map:left,frame:'all',expanded:new Set(left.nodes.map(n=>n.id))},b:{map:right,frame:'all',expanded:new Set(right.nodes.map(n=>n.id))}};
const source={type:'node',mapId:left.id,nodeId:'one'},other={type:'node',mapId:right.id,nodeId:'two'},originalSmall=JSON.stringify(full);
function noOverlap(layout){const ps=comparisonDisplayRects(layout);for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){const p=ps[i],q=ps[j];assert(!(p.x<q.x+q.w-.01&&p.x+p.w>q.x+.01&&p.y<q.y+q.h-.01&&p.y+p.h>q.y+.01),'Nodes and full-size counterpart controls must not overlap');}}
const savedLink={id:'saved',kind:'correspondence',status:'active',createdAt:'2026-09-28',target:source,other};
const linked=layoutComparison(full,roots,{links:[savedLink],reserved:[]});noOverlap(linked);
assert.equal(linked.maps.a.positions.get('one').y,linked.maps.b.positions.get('two').y);assert(Math.abs(linked.maps.b.positions.get('two').x-linked.maps.a.positions.get('one').x-CARD_W-16)<1e-8);
assert.notEqual(linked.maps.b.positions.get('one').x,linked.maps.b.positions.get('two').x,'Unrelated original neighbor is retained elsewhere');
const reserved=layoutComparison(full,roots,{reserved:[source]});noOverlap(reserved);assert.equal(reserved.placeholders.length,6,'Every solo ordinary node has one full-size control, independently of requests');assert.equal(reserved.positions.size,left.nodes.length+right.nodes.length);
const swapped=layoutComparison({a:full.b,b:full.a},roots,{links:[savedLink]});noOverlap(swapped);assert.equal(swapped.maps.a.positions.get('two').y,swapped.maps.b.positions.get('one').y);
for(let i=0;i<50;i++){const targets=[...left.nodes.filter(n=>n.parent),...right.nodes.filter(n=>n.parent)].filter(()=>random()>.5).map((n,index)=>({type:'node',mapId:index%2?right.id:left.id,nodeId:n.id}));noOverlap(layoutComparison(full,roots,{reserved:[...new Map(targets.map(t=>[JSON.stringify(t),t])).values()]}));}
assert.equal(JSON.stringify(full),originalSmall,'Neither counterpart links nor reservations change source data');
console.log('PASS: explicit counterpart placement, empty reservations, unrelated neighbors, swapped sides and source immutability.');

const groupOf=(layout,side,id)=>layout.groups.get(layout.maps[side].positions.get(id)?.groupId);
const paired=(layout,a,b)=>groupOf(layout,'a',a)?.kind==='pair'&&groupOf(layout,'a',a)===groupOf(layout,'b',b);
function checkGroups(layout){
  noOverlap(layout);const claimed=new Set(),groups=[...layout.groups.values()];
  for(const group of groups){
    assert([group.x,group.y,group.w,group.h,group.radius].every(Number.isFinite));
    assert(group.members.length===1||group.members.length===2);
    for(const member of group.members){assert(!claimed.has(member.key),'Every real card belongs to exactly one occupied group');claimed.add(member.key);assert.equal(layout.positions.get(member.key).groupId,group.id);}
    const path=new Set();let current=group;
    while(current.kind!=='frame'){assert(!path.has(current.id),'The display forest is acyclic');path.add(current.id);assert(current.parent,'Every ordinary group has a parent');current=layout.groups.get(current.parent);assert(current,'The parent group is occupied');assert.equal(current.frame,group.frame);}
    if(group.kind==='solo'){const ghosts=layout.placeholders.filter(p=>p.groupId===group.id);assert.equal(ghosts.length,1);assert.equal(ghosts[0].w,COUNTERPART_W);assert.equal(ghosts[0].h,COUNTERPART_H);}
    else assert(!layout.placeholders.some(p=>p.groupId===group.id),'Roots and deliberate pairs do not get empty ghosts');
  }
  assert.equal(claimed.size,layout.positions.size);
  for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
    const a=groups[i],b=groups[j],gap=COMPARISON_GROUP_GAP-.001;
    assert(a.x+a.w+gap<=b.x||b.x+b.w+gap<=a.x||a.y+a.h+gap<=b.y||b.y+b.h+gap<=a.y,'Unrelated occupied group rectangles have visibly greater separation than the real-pair gap');
  }
  for(const rect of comparisonDisplayRects(layout))assert(rect.x>=0&&rect.y>=0&&rect.x+rect.w<=layout.bounds.width+.001&&rect.y+rect.h<=layout.bounds.height+.001,'Fit includes each exact card/control rectangle');
}
function straightParents(layout){
  const rects=comparisonDisplayRects(layout).map(p=>({...p,x:p.x+p.w/2,y:p.y+p.h/2})),byKey=new Map(rects.filter(r=>r.kind==='node').map(r=>[r.key,r]));let count=0;
  for(const [side,view]of Object.entries(layout.maps))for(const node of view.map.nodes){
    const from=byKey.get(comparisonNodeKey(side,node.parent)),to=byKey.get(comparisonNodeKey(side,node.id));if(!from||!to)continue;
    count++;const route=routeStraightConnection(from,to,rects,{clearance:6});assert(!route.blocked,`Straight parent line ${side}:${node.parent} → ${node.id} must clear every real card and full-size ghost`);assert.equal(route.points.length,2);
  }
  assert.equal(layout.straightSource.total,count);assert.equal(layout.straightSource.clear,count);assert.deepEqual(layout.straightSource.blocked,[]);
}
assert.equal(COUNTERPART_W,CARD_W);assert.equal(COUNTERPART_H,CARD_H,'A ghost reserves the same full-size node footprint');
const untouched=layoutComparison(full,roots);checkGroups(untouched);
assert.equal([...untouched.groups.values()].filter(g=>g.kind==='pair').length,0,'Matching IDs, wording and sibling order do not imply counterpart identity');
assert.notEqual(groupOf(untouched,'a','one').id,groupOf(untouched,'b','one').id);
assert.deepEqual(layoutComparison(full,roots,{reserved:[source,source,other]}),untouched,'Reservations never invent or duplicate occupied display groups');
checkGroups(linked);checkGroups(swapped);
const logical=layout=>[...layout.groups.values()].map(g=>({id:g.id,parent:g.parent,x:g.x,y:g.y,w:g.w,h:g.h})).sort((a,b)=>a.id.localeCompare(b.id));
assert.deepEqual(logical(linked),logical(swapped),'Canonical actual identities preserve grouping and group geometry when displayed map sides are swapped');
assert.equal(groupOf(linked,'b','three').parent,groupOf(linked,'b','one').id,'An unpaired descendant follows its own real parent group');
const crossDepth={...savedLink,id:'cross-depth',target:{...source,nodeId:'three'},other:{...other,nodeId:'one'}};
const depthLayout=layoutComparison(full,roots,{links:[crossDepth]});checkGroups(depthLayout);
assert(paired(depthLayout,'three','one'),'Explicit same-frame links may pair different source depths');
assert.equal(groupOf(depthLayout,'a','three').parent,groupOf(depthLayout,'a','one').id,'A pair follows its canonical member’s parent');
assert.equal(groupOf(depthLayout,'b','three').parent,groupOf(depthLayout,'b','one').id,'Descendant group ancestry is rebuilt after cross-depth pairing');
const crossed=layoutComparison(full,roots,{links:[savedLink,crossDepth,{...savedLink,id:'duplicate-meaning',kind:'relationship'}]});checkGroups(crossed);
assert.equal([...crossed.groups.values()].filter(g=>g.kind==='pair').length,2,'Multiple cross-depth links never merge three real cards into one display group');
assert.deepEqual(logical(crossed),logical(layoutComparison(full,roots,{links:[crossDepth,{...savedLink,id:'duplicate-meaning',kind:'relationship'},savedLink]})),'Fetch order does not change adjacency or forest geometry');
for(let attempt=0;attempt<50;attempt++){
  const links=Array.from({length:9},(_,index)=>({...savedLink,id:'random-'+index,createdAt:String(index),kind:random()>.4?'correspondence':'relationship',target:{...source,nodeId:['one','two','three'][Math.floor(random()*3)]},other:{...other,nodeId:['one','two','three'][Math.floor(random()*3)]}}));
  const layout=layoutComparison(full,roots,{links});checkGroups(layout);assert.deepEqual(logical(layout),logical(layoutComparison({a:full.b,b:full.a},roots,{links:links.slice().reverse()})),'Cross-depth conflict chains preserve identity geometry under source/record reversal');
}
const older={...savedLink,id:'older-agreement',kind:'relationship',createdAt:'2020',other:{...other,nodeId:'one'}};
const newer={...savedLink,id:'newer-correspondence',createdAt:'2027'};
assert(paired(layoutComparison(full,roots,{links:[older,newer]}),'one','two'),'Counterpart identity takes placement priority over earlier legacy agreement');
assert(paired(layoutComparison(full,roots,{links:[older]}),'one','one'),'Deliberately saved legacy relationship records retain compatibility placement');
const first={...savedLink,id:'a-first',other:{...other,nodeId:'one'}},second={...savedLink,id:'z-second'};
assert(paired(layoutComparison(full,roots,{links:[second,first]}),'one','one'),'Record ID breaks equal-time ties deterministically');
assert(!paired(layoutComparison(full,roots,{links:[{...savedLink,status:'withdrawn'}]}),'one','two'),'Withdrawn records never determine placement');
assert(!paired(layoutComparison(full,roots,{links:[{...savedLink,kind:'argument'}]}),'one','two'),'Ordinary discussion references never become counterpart placement');
assert.deepEqual(logical(untouched),logical(layoutComparison(full,roots,{links:[{...savedLink,kind:undefined,status:undefined}]})),'Incomplete or old comparison records do not silently manufacture adjacency');
const hiddenState={a:{...full.a,expanded:new Set(['status'])},b:full.b};
const hiddenPair=layoutComparison(hiddenState,roots,{links:[crossDepth]});checkGroups(hiddenPair);
assert(!hiddenPair.maps.a.positions.has('three'));assert.equal(groupOf(hiddenPair,'a','one').kind,'solo','A collapsed linked descendant never transfers its identity to its visible ancestor');
assert.equal(groupOf(hiddenPair,'b','one').kind,'solo');
const crossFrame=layoutComparison(full,roots,{links:[{...savedLink,other:{...other,nodeId:'action'}}]});checkGroups(crossFrame);assert.equal(groupOf(crossFrame,'a','one').kind,'solo');
const filtered=layoutComparison({a:{...full.a,frame:'status'},b:{...full.b,frame:'action'}},roots,{links:[savedLink]});checkGroups(filtered);
assert.equal([...filtered.groups.values()].filter(g=>g.kind==='frame').length,2,'Only independently visible frame headings contribute groups');
assert.equal(groupOf(filtered,'a','one').kind,'solo');assert(![...filtered.groups.values()].some(g=>g.frame===2),'An entirely hidden frame adds no group or bounds');
const empty=layoutComparison({a:{...full.a,frame:'hidden'},b:{...full.b,frame:'hidden'}},roots);assert.equal(empty.groups.size,0);assert.equal(empty.bounds.width,0);assert.equal(empty.bounds.height,0);
const singleEmpty=layoutComparison({a:{...full.a,frame:'hidden'},b:{map:null}},roots);assert(Number.isFinite(singleEmpty.bounds.height));assert.equal(singleEmpty.positions.size,0);
const missing=layoutComparison(full,roots,{links:[{...savedLink,other:{...other,nodeId:'missing'}}]});checkGroups(missing);assert.equal(groupOf(missing,'a','one').kind,'solo');
const inaccessible=layoutComparison({a:full.a,b:{...full.b,map:{...right,unavailable:true}}},roots,{links:[savedLink]});assert.equal(groupOf(inaccessible,'a','one').kind,'solo','An unavailable endpoint never supplies adjacency from stale source data');

const countsMap=(id,count)=>({id,nodes:[...roots.map(id=>({id,parent:null})),...Array.from({length:count},(_,i)=>({id:'node-'+i,parent:'status',title:'Equal title'}))],relations:[]});
let five;
for(const [aCount,bCount]of [[0,0],[1,0],[4,4],[5,0],[5,2],[5,8],[6,6],[8,0]]){
  const A=countsMap('map-a',aCount),B=countsMap('map-b',bCount),state={a:{map:A,frame:'status',expanded:new Set(['status'])},b:{map:B,frame:'status',expanded:new Set(['status'])}},before=JSON.stringify(state);
  for(const collapsedSide of [null,'a','b']){
    const view={a:{...state.a},b:{...state.b}};if(collapsedSide)view[collapsedSide].expanded=new Set();
    const layout=layoutComparison(view,roots);checkGroups(layout);straightParents(layout);assert.equal(layout.positions.size,2+(collapsedSide==='a'?0:aCount)+(collapsedSide==='b'?0:bCount));assert.equal(layout.placeholders.length,layout.positions.size-2);assert.deepEqual(layoutComparison(view,roots),layout,'Selection, mode and camera are absent from geometry inputs');
    if(aCount===5&&bCount===0&&!collapsedSide)five=layout;
  }
  assert.equal(JSON.stringify(state),before);
}
assert(five.bounds.width>1000&&five.bounds.height>1050,'The world grows to fit full-size counterparts and straight parent corridors rather than shrinking cards or preserving compact bounds');
const manyA=countsMap('map-a',5),manyB=countsMap('map-b',8),many={a:{map:manyA,frame:'status',expanded:new Set(['status'])},b:{map:manyB,frame:'status',expanded:new Set(['status'])}},manyBefore=JSON.stringify(many);
const fifth={...savedLink,target:{type:'node',mapId:manyA.id,nodeId:'node-4'},other:{type:'node',mapId:manyB.id,nodeId:'node-0'}},initialMany=layoutComparison(many,roots);
for(let i=0;i<20;i++){
  const together=layoutComparison(many,roots,{links:[fifth]});checkGroups(together);assert(paired(together,'node-4','node-0'));assert.equal(together.groups.size,initialMany.groups.size-1,'Pairing removes both vacated solo groups');
  assert.deepEqual(layoutComparison(many,roots,{links:[{...fifth,status:'withdrawn'}]}),initialMany,'Repeated withdraw/reload cannot accumulate phantom layout area');
}
assert.equal(JSON.stringify(many),manyBefore,'The grouping and radial passes leave source data byte-for-byte unchanged');
const animation=new Map([...untouched.positions].map(([key,p])=>[key,{...p,x:p.x+27,y:p.y-19}]));
const animatedRects=comparisonDisplayRects(untouched,animation),restRects=comparisonDisplayRects(untouched);
for(let i=0;i<animatedRects.length;i++){assert.equal(animatedRects[i].x,restRects[i].x+27);assert.equal(animatedRects[i].y,restRects[i].y-19);assert.equal(animatedRects[i].w,restRects[i].w);assert.equal(animatedRects[i].h,restRects[i].h);}
assert.equal([...animation.keys()].some(k=>k.includes('counterpart')),false,'Ghosts never enter real-node positions or saved selection identities');
assert.equal(comparisonDisplayRects(single).filter(p=>p.kind==='counterpart').length,0,'Single-source browsing does not invent an opposite map');
// Deep and branching source trees keep finite bounded work and exact ancestry.
const denseA=countsMap('dense-a',8),denseB=countsMap('dense-b',8);
for(const map of [denseA,denseB])for(let branch=0;branch<8;branch++)for(let depth=0;depth<5;depth++)map.nodes.push({id:`branch-${branch}-${depth}`,parent:depth?`branch-${branch}-${depth-1}`:`node-${branch}`});
const denseState={a:{map:denseA,frame:'status',expanded:new Set(denseA.nodes.map(n=>n.id))},b:{map:denseB,frame:'status',expanded:new Set(denseB.nodes.map(n=>n.id))}};
const denseStart=performance.now(),denseLayout=layoutComparison(denseState,roots);checkGroups(denseLayout);assert.equal(denseLayout.positions.size,98);assert(performance.now()-denseStart<5000,'The bounded geometry pass finishes on deep, dense comparison fixtures');
straightParents(denseLayout);
const fiveA=countsMap('five-a',5),fiveB=countsMap('five-b',5),fiveStates={a:{map:fiveA,frame:'status',expanded:new Set(['status'])},b:{map:fiveB,frame:'status',expanded:new Set(['status'])}},union={...savedLink,target:{type:'node',mapId:fiveA.id,nodeId:'node-4'},other:{type:'node',mapId:fiveB.id,nodeId:'node-4'}};
const fivePaired=layoutComparison(fiveStates,roots,{links:[union]});checkGroups(fivePaired);straightParents(fivePaired);assert.equal(fivePaired.placeholders.length,8);
const frame=groupOf(fivePaired,'a','status');for(const group of fivePaired.groups.values())if(group.kind!=='frame')assert(group.anchor.mapId===fiveA.id?group.cy<frame.cy:group.cy>frame.cy,'A deliberately linked pair does not spill one owner’s remaining solo into the other owner’s sector');
const chainA=countsMap('chain-a',0),chainB=countsMap('chain-b',0);for(let i=0;i<100;i++)chainA.nodes.push({id:'chain-'+i,parent:i?'chain-'+(i-1):'status'});
const chainStates={a:{map:chainA,frame:'status',expanded:new Set(chainA.nodes.map(n=>n.id))},b:{map:chainB,frame:'status',expanded:new Set()}},chain=layoutComparison(chainStates,roots);checkGroups(chain);straightParents(chain);assert(chain.bounds.height<30000&&chain.bounds.width<1000,'A 100-level skinny chain grows linearly instead of multiplying every ring radius');
const fanA=countsMap('fan-a',40),fanB=countsMap('fan-b',0),fan=layoutComparison({a:{map:fanA,frame:'status',expanded:new Set(['status'])},b:{map:fanB,frame:'status',expanded:new Set()}},roots);checkGroups(fan);straightParents(fan);assert(fan.bounds.width<100000&&fan.bounds.height<100000,'High fan-out has finite practical world dimensions');
const additionalState=structuredClone(fiveStates);additionalState.a.map.relations=[{id:'extra',from:'node-0',to:'node-1',type:'cause'},{id:'reverse-extra',from:'node-1',to:'node-0',type:'reason'},{id:'parent-meaning',from:'node-0',to:'status',type:'reason'},{id:'other-frame',from:'node-0',to:'action',type:'cause'}];additionalState.a.frame='all';
const additional=layoutComparison(additionalState,roots);straightParents(additional);assert.equal(additional.straightSource.additional.total,1,'Additional meanings count once per actual pair and do not recount parent edges');assert.equal(additional.straightSource.additional.crossFrame,1,'Cross-frame semantic links are explicitly outside the per-frame placement guarantee');
console.log('PASS: unpaired defaults, explicit/legacy priority, actual identity grouping, acyclic cross-depth ancestry, hidden/missing endpoints, full-size ghost animation, exact rectangle bounds, straight screenshot/unequal/nested parent routes, owner sectors, 100-level chain and 40-child fan-out.');
