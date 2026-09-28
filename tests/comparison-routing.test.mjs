import assert from 'node:assert/strict';
import {routeComparisonConnection,createConnectionRouter,createSourceConnectionRouter,labelSourceRoute} from '../dist/comparison-routing.mjs';
import {ComparisonCanvas} from '../dist/compare-canvas.mjs';
import {ReasoningUI} from '../dist/reasoning-ui.mjs';
import {routeStraightConnection} from '../dist/reasoning-layout.mjs';
import {CARD_W,CARD_H,layoutForest} from '../dist/layout.mjs';
import {comparisonNodeKey,layoutComparison,comparisonDisplayRects,COUNTERPART_W,COUNTERPART_H} from '../dist/comparison-layout.mjs';

const inside=(p,r)=>Math.abs(p.x-r.x)<r.w/2-.001&&Math.abs(p.y-r.y)<r.h/2-.001;
const overlap=(a,b)=>Math.abs(a.x-b.x)<(a.w+b.w)/2&&Math.abs(a.y-b.y)<(a.h+b.h)/2;
const onBoundary=(p,r)=>Math.abs(Math.abs(p.x-r.x)-r.w/2)<.001&&Math.abs(p.y-r.y)<=r.h/2+.001||Math.abs(Math.abs(p.y-r.y)-r.h/2)<.001&&Math.abs(p.x-r.x)<=r.w/2+.001;
function verify(from,to,obstacles=[],size={w:300,h:42}){
  const before=structuredClone({from,to,obstacles}),route=routeComparisonConnection(from,to,obstacles,size);
  assert(!route.blocked);assert(route.label,'A readable label remains on the displayed relationship.');
  assert(onBoundary(route.points[0],from));assert(onBoundary(route.points.at(-1),to));
  assert.deepEqual({from,to,obstacles},before,'Routing does not reposition nodes.');
  assert.deepEqual(route,routeComparisonConnection(from,to,obstacles,size),'Stable geometry avoids edge movement on redraw.');
  for(const rect of [from,to,...obstacles])assert(!overlap(route.label,rect),'The complete label avoids nodes and earlier labels.');
  let labelDistance=Infinity;
  for(const segment of route.segments){
    const steps=Math.max(2,Math.ceil(Math.hypot(segment.to.x-segment.from.x,segment.to.y-segment.from.y)));
    for(let i=0;i<=steps;i++){
      const t=i/steps,u=1-t,p=segment.control?{x:u*u*segment.from.x+2*u*t*segment.control.x+t*t*segment.to.x,y:u*u*segment.from.y+2*u*t*segment.control.y+t*t*segment.to.y}:{x:segment.from.x+(segment.to.x-segment.from.x)*t,y:segment.from.y+(segment.to.y-segment.from.y)*t};
      for(const rect of [from,to,...obstacles])assert(!inside(p,rect),'The drawn curve never enters either endpoint or an intervening card.');
      labelDistance=Math.min(labelDistance,Math.hypot(p.x-route.label.x,p.y-route.label.y));
    }
  }
  assert(labelDistance<1,'The relationship label sits on its actual route, not the midpoint between nodes.');
  return route;
}

const lower={x:160,y:700,w:300,h:200},upper={x:476,y:100,w:300,h:200};
const neighbor={x:160,y:100,w:300,h:200};
// Asymmetric visible endpoints: the former top-to-top arch crossed the upper
// endpoint. Collapsed proxies are now excluded by the caller, not routed here.
verify(lower,upper,[neighbor]);verify(upper,lower,[neighbor]);
verify({...lower,x:476},neighbor,[upper]);
// Same-row paired cards leave a narrow gap. Their label must fit above/below
// both cards while remaining attached to the one visible edge.
verify(neighbor,upper,[],{w:430,h:42});
verify({x:160,y:700,w:300,h:200},neighbor,[],{w:340,h:42});
const middle={x:160,y:400,w:300,h:200};
verify(lower,neighbor,[middle,upper]);
const existingLabel={x:160,y:242,w:380,h:42};
verify(lower,neighbor,[middle,upper,existingLabel]);
const enclosed=routeComparisonConnection(lower,upper,[{...lower,w:500,h:500}],{w:300,h:42});
assert(enclosed.blocked);assert.equal(enclosed.d,'');assert.equal(enclosed.label,null);

const diagonalA={x:0,y:0,w:100,h:80},diagonalB={x:350,y:260,w:120,h:90},noLabel={w:0,h:0};
const diagonal=verify(diagonalA,diagonalB,[],noLabel);
assert.equal(diagonal.points.length,2,'A clear diagonal uses one direct facing-boundary segment');
assert(!/[AQC]/.test(diagonal.d),'No decorative curve on a clear corridor');
assert(Math.abs(diagonal.points[0].x-50)<.001);assert(Math.abs(diagonal.points[0].y-260/7)<.001);
const diagonalObstacle={x:180,y:180*260/350,w:6,h:6};
const detour=verify(diagonalA,diagonalB,[diagonalObstacle],noLabel);
assert(detour.points.length>2,'Even a small obstacle crossing the diagonal corridor requires a detour');
assert.match(detour.d,/Q /,'Detours use small rounded bends');
const clearNeighbor={x:150,y:-10,w:100,h:100};
assert.equal(verify(diagonalA,diagonalB,[clearNeighbor],noLabel).points.length,2,'An unrelated off-corridor card does not force an elbow');
const reverse=verify(diagonalB,diagonalA,[],noLabel);
assert.deepEqual(reverse.points,diagonal.points.slice().reverse(),'Direct paths reverse without changing their attachment points');
assert.deepEqual(routeStraightConnection(diagonalA,diagonalB).points,diagonal.points,'Straight-only routes reuse exact facing-boundary geometry');
assert(routeStraightConnection(diagonalA,diagonalB,[diagonalObstacle]).blocked,'A straight-only attempt reports an obstructed corridor without drawing through a card');
assert.deepEqual(routeStraightConnection(diagonalB,diagonalA).points,diagonal.points.slice().reverse(),'Straight-only geometry retains semantic direction');

const cached=createConnectionRouter({limit:2}),first=cached(diagonalA,diagonalB);
assert.equal(cached({...diagonalA},{...diagonalB}),first,'Identical geometry reuses its route object without rerouting');
const moved=cached(diagonalA,{...diagonalB,y:261});assert.notEqual(moved,first,'Changed world geometry invalidates the route');
const labeledRoute=cached(diagonalA,diagonalB,[],{w:70,h:20});assert.notEqual(labeledRoute,first,'Changed label size has independent geometry');
assert.equal(cached.size,2,'Memoized routes have a bounded lifetime');assert.notEqual(cached(diagonalA,diagonalB),first,'The oldest route is evicted at capacity');
cached.clear();assert.equal(cached.size,0);

// Actual radial positions flow through the shared source renderer unchanged.
// A redraw after camera changes must retain the memoized route, not reroute.
const roots=['status','action','goal'],nodes=[...roots.map(id=>({id,parent:null})),...['A','B','C','D'].map(id=>({id,parent:'status'})),{id:'A1',parent:'A'},{id:'A2',parent:'A'}];
const radial=layoutForest(nodes,roots,new Set(nodes.map(n=>n.id))),positions=new Map([...radial.positions].map(([id,p])=>[comparisonNodeKey('a',id),p]));
const mockPath=()=>({setAttribute(name,value){this[name]=value;}});
const sourcePairs=new Map(radial.edges.filter(edge=>edge.kind!=='spine').map(edge=>[edge.to,{key:edge.to,routeKey:edge.to,fromKey:comparisonNodeKey('a',edge.from),toKey:comparisonNodeKey('a',edge.to)}]));
const canvas=Object.assign(Object.create(ComparisonCanvas.prototype),{positions,cards:new Map([...positions.keys()].map(key=>[key,{style:{}}])),layout:{lanes:[],placeholders:[]},sourcePairs,branches:radial.edges.map(edge=>({key:edge.to,edge,side:'a',path:mockPath()})),links:[],routeConnection:createConnectionRouter(),routeSources:createSourceConnectionRouter(),options:{}});
const original=structuredClone(positions);canvas.drawGeometry();const routes=canvas.branches.map(branch=>branch.route);
for(const branch of canvas.branches){assert(!branch.route.blocked);assert.equal(branch.path.d,branch.route.d);const from=positions.get(comparisonNodeKey('a',branch.edge.from)),to=positions.get(comparisonNodeKey('a',branch.edge.to)),rect=p=>({x:p.x+CARD_W/2,y:p.y+CARD_H/2,w:CARD_W,h:CARD_H});assert(onBoundary(branch.route.points[0],rect(from)));assert(onBoundary(branch.route.points.at(-1),rect(to)));if(branch.edge.kind!=='spine')assert.equal(branch.route,canvas.sourceRoutes.get(branch.key),'Source renderers reuse the batch path instead of routing each branch again');}
canvas.camera={x:300,y:-400,z:.35};canvas.drawGeometry();assert.deepEqual(positions,original);canvas.branches.forEach((branch,i)=>assert.equal(branch.route,routes[i]));

// The screenshot's five SQ children share a parent. The neighboring collapsed
// frame blocks the direct diagonal to Union and formerly produced a false fork
// in the long vertical connection to Socialists.
const sampleMap=id=>({id,nodes:[...roots.map(id=>({id,parent:null})),...['dsa','state','union','socialists','democrats'].map(name=>({id:id+'-'+name,parent:'status'}))],relations:[]});
const leftMap=sampleMap('left'),rightMap=sampleMap('right'),states={a:{map:leftMap,expanded:new Set(['status']),frame:'all'},b:{map:rightMap,expanded:new Set(),frame:'all'}};
const snapshot=structuredClone(states),paired=layoutComparison(states,roots),center=p=>({x:p.x+(p.w||CARD_W)/2,y:p.y+(p.h||CARD_H)/2,w:p.w||CARD_W,h:p.h||CARD_H});
// Keep the reported Worker 47 overlap as fixed geometry even when the display
// layout improves; otherwise its regression test would silently stop testing it.
const legacyPoints=[[587.409,508.685],[148.112,72],[1026.706,72],[1142.818,869.862],[587.409,1048.456],[32,869.862],[1783.618,508.685],[2424.418,508.685],[855.409,508.685],[2051.618,508.685],[2692.418,508.685],[1410.818,869.862]].map(([x,y])=>({x,y}));
const sourceCards=legacyPoints.map(center),requests=['dsa','state','union','socialists','democrats'].map((id,index)=>({key:'left-'+id,from:sourceCards[0],to:sourceCards[index+1]}));
function sharedLength(a,b){
  let total=0;
  for(const first of a.segments)for(const second of b.segments){
    if(first.control||second.control)continue;
    const vertical=Math.abs(first.from.x-first.to.x)<.001&&Math.abs(second.from.x-second.to.x)<.001&&Math.abs(first.from.x-second.from.x)<.001;
    const horizontal=Math.abs(first.from.y-first.to.y)<.001&&Math.abs(second.from.y-second.to.y)<.001&&Math.abs(first.from.y-second.from.y)<.001;
    if(vertical||horizontal){const axis=vertical?'y':'x',a0=Math.min(first.from[axis],first.to[axis]),a1=Math.max(first.from[axis],first.to[axis]),b0=Math.min(second.from[axis],second.to[axis]),b1=Math.max(second.from[axis],second.to[axis]);total+=Math.max(0,Math.min(a1,b1)-Math.max(a0,b0));}
  }
  return total;
}
const unionRequest=requests.find(r=>r.key==='left-union'),socialistsRequest=requests.find(r=>r.key==='left-socialists');
assert(sharedLength(routeComparisonConnection(unionRequest.from,unionRequest.to,sourceCards),routeComparisonConnection(socialistsRequest.from,socialistsRequest.to,sourceCards))>100,'The fixture reproduces the original long coincident sibling stem');
const sourceRouter=createSourceConnectionRouter({limit:2}),grouped=sourceRouter(requests,sourceCards);
assert(sharedLength(grouped.get('left-union'),grouped.get('left-socialists'))<8,'Sibling routes do not look as though one begins on the other edge');
assert(Math.hypot(grouped.get('left-union').points[0].x-grouped.get('left-socialists').points[0].x,grouped.get('left-union').points[0].y-grouped.get('left-socialists').points[0].y)>=8,'The sibling connections leave distinct points on their actual parent');
function verifySourcePath(request,route,cards){
  assert(route&&!route.blocked&&route.d,'Visible source connections survive route preferences');assert(onBoundary(route.points[0],request.from));assert(onBoundary(route.points.at(-1),request.to));
  for(const segment of route.segments)for(let step=0;step<=60;step++){
    const t=step/60,u=1-t,p=segment.control?{x:u*u*segment.from.x+2*u*t*segment.control.x+t*t*segment.to.x,y:u*u*segment.from.y+2*u*t*segment.control.y+t*t*segment.to.y}:{x:segment.from.x+(segment.to.x-segment.from.x)*t,y:segment.from.y+(segment.to.y-segment.from.y)*t};
    for(const card of cards)assert(!inside(p,card),'The full rounded source route avoids card faces, including paired frames and placeholders');
  }
}
for(const request of requests)verifySourcePath(request,grouped.get(request.key),sourceCards);
assert.deepEqual(states,snapshot,'The route batch never changes authored parents or layout inputs');
const displayRects=comparisonDisplayRects(paired),ghosts=displayRects.filter(r=>r.kind==='counterpart');assert.equal(ghosts.length,5);for(const ghost of ghosts)assert.deepEqual([ghost.w,ghost.h],[COUNTERPART_W,COUNTERPART_H]);
const currentCards=displayRects.map(center),currentRequests=paired.maps.a.layout.edges.filter(edge=>edge.kind==='branch').map(edge=>({key:edge.to,from:center(paired.positions.get(comparisonNodeKey('a',edge.from))),to:center(paired.positions.get(comparisonNodeKey('a',edge.to)))})),currentRoutes=createSourceConnectionRouter()(currentRequests,currentCards);
for(const request of currentRequests)verifySourcePath(request,currentRoutes.get(request.key),currentCards);
const moving=new Map([...paired.positions].map(([key,p])=>[key,{...p,x:p.x+19,y:p.y-31}])),movingRects=comparisonDisplayRects(paired,moving);
for(const rect of displayRects){const moved=movingRects.find(r=>r.key===rect.key);assert.deepEqual([moved.x,moved.y,moved.w,moved.h],[rect.x+19,rect.y-31,rect.w,rect.h],'Animated ghosts translate with their real source while retaining their full bounds');}
const oneMoving=new Map(paired.positions),movingKey=comparisonNodeKey('a','left-union');oneMoving.set(movingKey,{...oneMoving.get(movingKey),x:oneMoving.get(movingKey).x+19,y:oneMoving.get(movingKey).y-31});
const oneMovingRects=comparisonDisplayRects(paired,oneMoving),movingCards=oneMovingRects.map(center),movingRequests=currentRequests.map(request=>({...request,from:center(oneMoving.get(comparisonNodeKey('a','status'))),to:center(oneMoving.get(comparisonNodeKey('a',request.key)))})),movingRoutes=createSourceConnectionRouter()(movingRequests,movingCards);
for(const rect of displayRects){const moved=oneMovingRects.find(r=>r.key===rect.key),follows=rect.key===movingKey||rect.sourceKey===movingKey;assert.deepEqual([moved.x,moved.y],[rect.x+(follows?19:0),rect.y+(follows?-31:0)],'Only the initiating real node and its ghost move together during interpolation');}
for(const request of movingRequests)verifySourcePath(request,movingRoutes.get(request.key),movingCards);
const anchored=Object.assign(Object.create(ComparisonCanvas.prototype),{states,positions:new Map(paired.positions),camera:{x:40,y:75,z:.62},animation:null,drawCamera(){}}),anchor=anchored.captureAnchor({mapId:leftMap.id,nodeId:'left-union'});anchored.positions=moving;anchored.restoreAnchor(anchor);assert.deepEqual(anchored.captureAnchor({mapId:leftMap.id,nodeId:'left-union'}),anchor,'Reflow retains the initiating real node screen position and zoom');
assert.equal(sourceRouter(requests.slice().reverse(),sourceCards.slice().reverse()),grouped,'Input enumeration order cannot change the route set or invalidate the cache');
assert.deepEqual([...createSourceConnectionRouter()(requests.slice().reverse(),sourceCards.slice().reverse())],[...grouped],'Fresh routing is deterministic independent of enumeration order');
const reversedRequests=requests.map(request=>({...request,from:request.to,to:request.from})),backward=sourceRouter(reversedRequests,sourceCards);
for(const request of requests){const route=backward.get(request.key);assert.deepEqual(route.points,grouped.get(request.key).points.slice().reverse(),'Semantic reversal retains the physical route while reversing arrow attachment direction');verifySourcePath({...request,from:request.to,to:request.from},route,sourceCards);}
const subset=sourceRouter(requests.filter(r=>r.key!=='left-union'),sourceCards);assert.notEqual(subset,grouped,'Changing only peer connections invalidates the complete batch even with unchanged cards');assert.equal(subset.size,requests.length-1);
const extra=createSourceConnectionRouter()(requests.concat(requests[0]),sourceCards);assert.equal(extra.size,requests.length,'Repeating the same grouped request never adds a second route');
const altered=sourceRouter(requests,sourceCards.map((r,index)=>index? r:{...r,x:r.x+1}));assert.notEqual(altered,grouped,'Changed obstacles invalidate routing');assert.equal(sourceRouter.size,2,'Complete-scene memoization remains bounded');sourceRouter.clear();assert.equal(sourceRouter.size,0);
const labelRoute=grouped.get('left-union'),labelBefore=structuredClone(labelRoute),sourceLabel=labelSourceRoute(labelRoute,{w:80,h:20},sourceCards);assert(sourceLabel);for(const card of sourceCards)assert(!overlap(sourceLabel,card));assert.deepEqual(labelRoute,labelBefore,'Inspection label placement never changes the shared visible route');assert.equal(labelSourceRoute(undefined,{w:40,h:20},sourceCards),null);
const straightSource=createSourceConnectionRouter()([{key:'clear',from:diagonalA,to:diagonalB}],[]).get('clear');assert.equal(straightSource.points.length,2,'Uncontested direct connections remain direct');

// Outward growth can produce long, nearly parallel branches. The comparison
// policy keeps their clear lines straight instead of adding peer-avoidance bends.
const longParent={x:0,y:0,w:100,h:80},longChildren=[{x:100000,y:30000,w:100,h:40},{x:100000,y:30060,w:100,h:40}],longRequests=longChildren.map((to,i)=>({key:'long-'+i,from:longParent,to})),longCards=[longParent,...longChildren];
const oldLong=createSourceConnectionRouter()(longRequests,longCards),directLongRouter=createSourceConnectionRouter({preferStraight:true}),directLong=directLongRouter(longRequests,longCards);
assert([...oldLong.values()].some(route=>route.points.length>2),'The fixture exercises the former peer-avoidance detour');
for(const request of longRequests){const route=directLong.get(request.key);assert.equal(route.points.length,2,'A clear comparison corridor stays straight even near another connection');verifySourcePath(request,route,longCards);}
assert.equal(directLongRouter(longRequests.slice().reverse(),longCards.slice().reverse()),directLong,'Straight routing remains cached and order independent');
const obstructedStraight=createSourceConnectionRouter({preferStraight:true})([{key:'obstructed',from:diagonalA,to:diagonalB}],[diagonalObstacle]).get('obstructed');
assert(obstructedStraight.points.length>2,'Exceptional obstructed geometry retains a visible safe route rather than crossing a card or disappearing');verifySourcePath({from:diagonalA,to:diagonalB},obstructedStraight,[diagonalObstacle]);

// A busy grid bounds the additional peer-avoidance work while keeping every
// unobstructed endpoint pair visible and preserving the original node geometry.
const denseCards=Array.from({length:120},(_,i)=>({x:(i%12)*140,y:Math.floor(i/12)*120,w:80,h:60})),denseRequests=denseCards.slice(1,81).map((to,index)=>({key:'dense-'+String(index).padStart(3,'0'),from:denseCards[0],to})),denseBefore=structuredClone(denseCards),denseRouter=createSourceConnectionRouter(),started=performance.now(),denseRoutes=denseRouter(denseRequests,denseCards);
assert.equal(denseRoutes.size,denseRequests.length);for(const request of denseRequests)verifySourcePath(request,denseRoutes.get(request.key),denseCards);assert.deepEqual(denseCards,denseBefore);assert.equal(denseRouter(denseRequests,denseCards),denseRoutes);assert(performance.now()-started<10000,'Dense routing stays within a bounded interactive budget');
const blockedSource=createSourceConnectionRouter()([{key:'enclosed',from:lower,to:upper}],[{...lower,w:500,h:500}]).get('enclosed');assert(blockedSource.blocked);assert.equal(blockedSource.d,'','Only genuinely enclosed endpoints keep the existing safe blocked result');

// Historical inference challenges end at the Supports control itself. Its
// folded-follow-up control is an obstacle, not an enclosing phantom endpoint.
const badge={offsetWidth:100,offsetHeight:28,offsetLeft:40,offsetTop:0},fold={offsetWidth:180,offsetHeight:26,offsetLeft:0,offsetTop:32};
const marker={offsetWidth:180,offsetHeight:58,style:{},children:[badge,fold]},reason={id:'reason',target:{type:'node',nodeId:'source'}},challenge={id:'challenge',target:{type:'inference',entryId:'reason'}};
const source={x:0,y:0,w:CARD_W,h:CARD_H},reasoningCanvas={positions:new Map([['a:source',{x:-CARD_W/2,y:-CARD_H/2}]]),layout:{placeholders:[],bounds:{x:-CARD_W/2,y:-CARD_H/2,width:CARD_W,height:CARD_H}},surface:{clientWidth:1000}};
const reasoning=Object.assign(Object.create(ReasoningUI.prototype),{d:{canvas:reasoningCanvas,point:()=>source},anchor:{type:'node',nodeId:'source'},cards:[reason,challenge].map(r=>({r,article:{offsetHeight:120,style:{}}})),positions:new Map(),inferences:new Map(),links:[{r:reason,path:mockPath(),badge,marker},{r:challenge,path:mockPath()}],routeConnection:createConnectionRouter()});
reasoning.position();const support=reasoning.links[0].route,target=reasoning.inferences.get(reason.id),attack=reasoning.links[1].route;
assert(!marker.hidden&&support.label);assert.equal(target.y,support.label.y-support.label.h/2+badge.offsetHeight/2);assert(!attack.blocked);assert(onBoundary(attack.points.at(-1),target),'Inference critique connects to Supports, not its fold button or source card');
reasoning.position();assert.equal(reasoning.links[0].route,support);assert.equal(reasoning.links[1].route,attack);
console.log('Comparison routing passed: sibling route separation, card avoidance, stable grouped batches, semantic direction, exact-path labels, peer-set cache invalidation, bounded dense routing, unchanged radial geometry, renderer reuse and inference targets.');
