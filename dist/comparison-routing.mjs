import {routeReasoningConnection} from './reasoning-layout.mjs';

const overlaps=(a,b,gap=8)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+gap&&Math.abs(a.y-b.y)<(a.h+b.h)/2+gap;

function labelOnRoute(route,size,obstacles){
  if(!route.midpoint)return null;
  const candidates=[route.midpoint];
  // Prefer the actual halfway point, then nearby points on straight segments.
  // A label stays attached to its edge rather than floating above another card.
  for(const segment of route.segments){
    if(segment.control)continue;
    const distance=Math.hypot(segment.to.x-segment.from.x,segment.to.y-segment.from.y);
    const steps=Math.max(2,Math.ceil(distance/24));
    for(let i=1;i<steps;i++)candidates.push({x:segment.from.x+(segment.to.x-segment.from.x)*i/steps,y:segment.from.y+(segment.to.y-segment.from.y)*i/steps});
  }
  candidates.sort((a,b)=>Math.hypot(a.x-route.midpoint.x,a.y-route.midpoint.y)-Math.hypot(b.x-route.midpoint.x,b.y-route.midpoint.y));
  const point=candidates.find(p=>!obstacles.some(r=>overlaps({...p,...size},r)));
  return point?{...point,...size}:null;
}

/** Route between the displayed card boundaries, including collapsed ancestors.
 * Cards and previously placed labels use center coordinates. Node positions
 * never change. A relationship label is centered on an unobstructed part of
 * its actual route; a larger outside corridor is used only when needed.
 */
export function routeComparisonConnection(from,to,obstacles=[],labelSize={w:0,h:0}){
  const size={w:labelSize.w||0,h:labelSize.h||0};
  const clearances=[undefined,...new Set([Math.min(256,Math.max(12,size.h/2+12)),Math.min(256,Math.max(12,size.w/2+12))])];
  let fallback=null;
  for(const clearance of clearances){
    const route=routeReasoningConnection(from,to,obstacles,clearance===undefined?{}:{clearance});
    if(route.blocked)continue;
    fallback??=route;
    const label=labelOnRoute(route,size,[from,to,...obstacles]);
    if(label)return {...route,label};
  }
  // Enclosed cards have no honest connection to draw. Keep the saved record in
  // the conversation list instead of drawing a path through a node's face.
  return {...(fallback||routeReasoningConnection(from,to,obstacles)),label:null};
}
