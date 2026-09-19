import assert from 'node:assert/strict';
import {routeReasoningConnection} from '../dist/reasoning-layout.mjs';

const pointInside=(point,r)=>point.x>r.x-r.w/2+0.001&&point.x<r.x+r.w/2-0.001&&point.y>r.y-r.h/2+0.001&&point.y<r.y+r.h/2-0.001;
const boundary=(point,r)=>Math.abs(Math.abs(point.x-r.x)-r.w/2)<0.001&&Math.abs(point.y-r.y)<=r.h/2+0.001||Math.abs(Math.abs(point.y-r.y)-r.h/2)<0.001&&Math.abs(point.x-r.x)<=r.w/2+0.001;
function verify(from,to,obstacles,options={}){
  const input=structuredClone({from,to,obstacles}),route=routeReasoningConnection(from,to,obstacles,options);
  assert(!route.blocked,'A route exists around separated rectangles.');assert.match(route.d,/^M /);assert(route.midpoint);assert(boundary(route.points[0],from));assert(boundary(route.points.at(-1),to));
  assert.deepEqual({from,to,obstacles},input,'Routing cannot mutate source or reasoning geometry.');
  assert.deepEqual(routeReasoningConnection(from,to,obstacles,options),route,'The same displayed geometry always yields the same route.');
  for(const point of [route.midpoint,...route.points])for(const obstacle of obstacles)assert(!pointInside(point,obstacle),'Routes and their inference badges avoid unrelated cards.');
  for(const segment of route.segments){
    const controls=[segment.from,segment.to,...(segment.control?[segment.control]:[])];
    const left=Math.min(...controls.map(p=>p.x)),right=Math.max(...controls.map(p=>p.x)),top=Math.min(...controls.map(p=>p.y)),bottom=Math.max(...controls.map(p=>p.y));
    const candidates=[...obstacles,from,to].filter(r=>r.x+r.w/2>=left&&r.x-r.w/2<=right&&r.y+r.h/2>=top&&r.y-r.h/2<=bottom);
    if(!candidates.length)continue;
    const steps=Math.ceil((Math.hypot(segment.to.x-segment.from.x,segment.to.y-segment.from.y)+20)/2);
    for(let i=0;i<=steps;i++){
      const t=i/steps,u=1-t,point=segment.control?{x:u*u*segment.from.x+2*u*t*segment.control.x+t*t*segment.to.x,y:u*u*segment.from.y+2*u*t*segment.control.y+t*t*segment.to.y}:{x:segment.from.x+(segment.to.x-segment.from.x)*t,y:segment.from.y+(segment.to.y-segment.from.y)*t};
      for(const obstacle of candidates)assert(!pointInside(point,obstacle),`The drawn route crosses a card at ${JSON.stringify({point,obstacle})}`);
    }
  }
  return route;
}

// Unobstructed vertical/horizontal support connections attach at the card edge.
verify({x:0,y:300,w:280,h:140},{x:0,y:0,w:280,h:180},[]);
verify({x:-400,y:0,w:280,h:140},{x:0,y:0,w:280,h:180},[]);

// A source frame sits between a response and the challenged reason. The former
// cubic connector crossed the frame; the new route goes around its perimeter.
const frame={x:0,y:300,w:300,h:200};
const aroundFrame=verify({x:0,y:650,w:280,h:150},{x:0,y:0,w:280,h:150},[frame]);
assert(aroundFrame.points.some(p=>Math.abs(p.x)>frame.w/2),'A blocked straight path detours around the source frame.');

// Both a horizontal row of unrelated source frames and another reasoning card
// obstruct the exchange. Enough clearance remains at the outside of the row.
const rows=[-360,0,360].map(x=>({x,y:310,w:310,h:190}));
verify({x:70,y:680,w:280,h:150},{x:130,y:0,w:280,h:150},[...rows,{x:440,y:650,w:280,h:160}]);

// Alternating barriers require several bends, exercising the grid fallback.
verify({x:0,y:100,w:100,h:70},{x:650,y:420,w:100,h:70},[
  {x:180,y:150,w:130,h:300},{x:380,y:380,w:130,h:300},{x:540,y:90,w:100,h:170},
  {x:-90,y:310,w:250,h:100},{x:720,y:180,w:200,h:110}
]);

// Inference targets are the displayed badge rectangle, not either source node.
const inference={x:160,y:140,w:90,h:30};
const toInference=verify({x:500,y:470,w:280,h:150},inference,[{x:160,y:340,w:280,h:150},{x:500,y:140,w:280,h:160}]);
assert(boundary(toInference.points.at(-1),inference));

// Support labels need clearance for their entire control, not only its center.
// A peer challenge occupies the space between two reasoning cards in the row.
const badgeCards=[{x:0,y:0,w:280,h:140},{x:684,y:0,w:280,h:140},{x:342,y:0,w:280,h:140}];
const labeled=verify(badgeCards[0],badgeCards[1],[badgeCards[2]],{clearance:40});
assert.equal(labeled.clearance,40);
const badge={x:labeled.midpoint.x,y:labeled.midpoint.y,w:70,h:30};
for(const card of badgeCards)assert(!(Math.abs(badge.x-card.x)<(badge.w+card.w)/2&&Math.abs(badge.y-card.y)<(badge.h+card.h)/2),'The full support badge must fit outside surrounding cards.');

// Small gaps can require reduced clearance; there must still be no crossing.
const narrowObstacles=[
  {x:0,y:-36,w:80,h:12},{x:0,y:36,w:80,h:12},{x:-36,y:0,w:12,h:50}
];
verify({x:0,y:0,w:50,h:50},{x:180,y:0,w:50,h:50},narrowObstacles);
assert.equal(routeReasoningConnection({x:0,y:0,w:50,h:50},{x:180,y:0,w:50,h:50},narrowObstacles,{clearance:40}).blocked,true,'Explicit badge clearance must never silently shrink.');

// An endpoint buried inside an unrelated rectangle has no honest visible route.
const blocked=routeReasoningConnection({x:0,y:0,w:40,h:40},{x:300,y:0,w:40,h:40},[{x:0,y:0,w:200,h:200}]);
assert.equal(blocked.blocked,true);assert.equal(blocked.d,'');assert.equal(blocked.midpoint,null);
assert.throws(()=>routeReasoningConnection({x:NaN,y:0},{x:0,y:0}),/finite rectangles/);

// Representative dense comparison: repeated map rows plus the active argument.
// Avoid a timing assertion tied to CI hardware, but run the full routing volume.
const dense=Array.from({length:266},(_,i)=>({x:(i%14)*340,y:Math.floor(i/14)*250,w:280,h:170}));
for(let i=0;i<40;i++)verify({x:120+i*37,y:5200,w:200,h:100},{x:160+i*31,y:-250,w:200,h:100},dense);
console.log('Reasoning routes passed: endpoint attachment, card avoidance, inference targets, deterministic detours, blocked endpoints and 40 routes around 266 source cards.');
