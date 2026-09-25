import assert from 'node:assert/strict';
import {routeComparisonConnection,createConnectionRouter} from '../dist/comparison-routing.mjs';
import {ComparisonCanvas} from '../dist/compare-canvas.mjs';
import {ReasoningUI} from '../dist/reasoning-ui.mjs';
import {CARD_W,CARD_H,layoutForest} from '../dist/layout.mjs';
import {comparisonNodeKey} from '../dist/comparison-layout.mjs';

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
const canvas=Object.assign(Object.create(ComparisonCanvas.prototype),{positions,cards:new Map([...positions.keys()].map(key=>[key,{style:{}}])),layout:{lanes:[],placeholders:[]},branches:radial.edges.map(edge=>({edge,side:'a',path:mockPath()})),links:[],routeConnection:createConnectionRouter(),options:{}});
const original=structuredClone(positions);canvas.drawGeometry();const routes=canvas.branches.map(branch=>branch.route);
for(const branch of canvas.branches){assert(!branch.route.blocked);const from=positions.get(comparisonNodeKey('a',branch.edge.from)),to=positions.get(comparisonNodeKey('a',branch.edge.to)),rect=p=>({x:p.x+CARD_W/2,y:p.y+CARD_H/2,w:CARD_W,h:CARD_H});assert.deepEqual(branch.route,routeComparisonConnection(rect(from),rect(to),[...positions.values()].map(rect)));}
canvas.camera={x:300,y:-400,z:.35};canvas.drawGeometry();assert.deepEqual(positions,original);canvas.branches.forEach((branch,i)=>assert.equal(branch.route,routes[i]));

// Historical inference challenges end at the Supports control itself. Its
// folded-follow-up control is an obstacle, not an enclosing phantom endpoint.
const badge={offsetWidth:100,offsetHeight:28,offsetLeft:40,offsetTop:0},fold={offsetWidth:180,offsetHeight:26,offsetLeft:0,offsetTop:32};
const marker={offsetWidth:180,offsetHeight:58,style:{},children:[badge,fold]},reason={id:'reason',target:{type:'node',nodeId:'source'}},challenge={id:'challenge',target:{type:'inference',entryId:'reason'}};
const source={x:0,y:0,w:CARD_W,h:CARD_H},reasoningCanvas={positions:new Map([['a:source',{x:-CARD_W/2,y:-CARD_H/2}]]),layout:{placeholders:[],bounds:{x:-CARD_W/2,y:-CARD_H/2,width:CARD_W,height:CARD_H}},surface:{clientWidth:1000}};
const reasoning=Object.assign(Object.create(ReasoningUI.prototype),{d:{canvas:reasoningCanvas,point:()=>source},anchor:{type:'node',nodeId:'source'},cards:[reason,challenge].map(r=>({r,article:{offsetHeight:120,style:{}}})),positions:new Map(),inferences:new Map(),links:[{r:reason,path:mockPath(),badge,marker},{r:challenge,path:mockPath()}],routeConnection:createConnectionRouter()});
reasoning.position();const support=reasoning.links[0].route,target=reasoning.inferences.get(reason.id),attack=reasoning.links[1].route;
assert(!marker.hidden&&support.label);assert.equal(target.y,support.label.y-support.label.h/2+badge.offsetHeight/2);assert(!attack.blocked);assert(onBoundary(attack.points.at(-1),target),'Inference critique connects to Supports, not its fold button or source card');
reasoning.position();assert.equal(reasoning.links[0].route,support);assert.equal(reasoning.links[1].route,attack);
console.log('Comparison routing passed: direct diagonal boundaries, robust obstacle intersection, modest detours, clear labels, bounded cache, unchanged radial geometry, renderer reuse and exact inference targets.');
