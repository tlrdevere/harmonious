import assert from 'node:assert/strict';
import {routeComparisonConnection} from '../dist/comparison-routing.mjs';

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
// Screenshot regression: a descendant is visible on one map while the other
// map shows its collapsed ancestor. A top-to-top arch crossed the ancestor.
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
console.log('Comparison routing passed: asymmetric collapsed endpoints, facing card boundaries, intermediate obstacles, attached readable labels, deterministic geometry and enclosed endpoints.');
