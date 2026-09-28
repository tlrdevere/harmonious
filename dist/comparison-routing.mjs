import {routeReasoningConnection,routeStraightConnection} from './reasoning-layout.mjs';

const overlaps=(a,b,gap=8)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+gap&&Math.abs(a.y-b.y)<(a.h+b.h)/2+gap;

function labelOnRoute(route,size,obstacles){
  if(!route.midpoint)return null;
  if(!size.w&&!size.h)return {...route.midpoint,...size};
  const candidates=[route.midpoint];
  // Prefer the actual halfway point, then nearby points on straight segments.
  // A label stays attached to its edge rather than floating above another card.
  for(const segment of route.segments){
    if(segment.control)continue;
    const distance=Math.hypot(segment.to.x-segment.from.x,segment.to.y-segment.from.y);
    const steps=Math.min(256,Math.max(2,Math.ceil(distance/24)));
    for(let i=1;i<steps;i++)candidates.push({x:segment.from.x+(segment.to.x-segment.from.x)*i/steps,y:segment.from.y+(segment.to.y-segment.from.y)*i/steps});
  }
  candidates.sort((a,b)=>Math.hypot(a.x-route.midpoint.x,a.y-route.midpoint.y)-Math.hypot(b.x-route.midpoint.x,b.y-route.midpoint.y));
  const point=candidates.find(p=>!obstacles.some(r=>overlaps({...p,...size},r)));
  return point?{...point,...size}:null;
}

/** Route between actual visible card boundaries. Callers must not substitute
 * a collapsed ancestor for a hidden endpoint.
 * Cards and previously placed labels use center coordinates. Node positions
 * never change. A relationship label is centered on an unobstructed part of
 * its actual route; a larger outside corridor is used only when needed.
 */
export function routeComparisonConnection(from,to,obstacles=[],labelSize={w:0,h:0}){
  const size={w:labelSize.w||0,h:labelSize.h||0};
  const clearances=[undefined,...new Set([Math.min(256,Math.max(12,size.h/2+12)),Math.min(256,Math.max(12,size.w/2+12))])];
  let fallback=null;
  for(const clearance of clearances){
    const route=routeReasoningConnection(from,to,obstacles,clearance===undefined?{}:{clearance,direct:false});
    if(route.blocked)continue;
    fallback??=route;
    const label=labelOnRoute(route,size,[from,to,...obstacles]);
    if(label)return {...route,label};
  }
  // Enclosed cards have no honest connection to draw. Keep the saved record in
  // the conversation list instead of drawing a path through a node's face.
  return {...(fallback||routeReasoningConnection(from,to,obstacles)),label:null};
}

/** Bounded cache of world-coordinate geometry. Pan/zoom never belongs in the
 * key; source geometry, obstacles and label dimensions do. Clear at teardown.
 */
export function createConnectionRouter({limit=512}={}){
  const capacity=Math.max(1,Math.min(4096,Math.floor(limit)||512)),cache=new Map();
  const rect=r=>[r.x,r.y,r.w??0,r.h??0];
  const route=(from,to,obstacles=[],labelSize={w:0,h:0})=>{
    const key=JSON.stringify([rect(from),rect(to),obstacles.map(rect),labelSize.w||0,labelSize.h||0]);
    if(cache.has(key)){const found=cache.get(key);cache.delete(key);cache.set(key,found);return found;}
    const result=routeComparisonConnection(from,to,obstacles,labelSize);cache.set(key,result);
    if(cache.size>capacity)cache.delete(cache.keys().next().value);return result;
  };
  route.clear=()=>cache.clear();Object.defineProperty(route,'size',{get:()=>cache.size});return route;
}

/** Place an inspection label on the already chosen source route. Never reroute
 * its visible stroke to accommodate a label. Include endpoint cards in obstacles.
 */
export function labelSourceRoute(route,size={w:0,h:0},obstacles=[]){
  return route&&!route.blocked?labelOnRoute(route,{w:size.w||0,h:size.h||0},obstacles):null;
}

const SOURCE_ROUTE_POLICY=1,SOURCE_ALTERNATIVE_LIMIT=128,SOURCE_PEER_LIMIT=384,SOURCE_EPS=1e-7;
const sourceRectKey=r=>JSON.stringify([r.x,r.y,r.w,r.h]);
const sourceOrder=(a,b)=>a<b?-1:a>b?1:0;
function sourceRect(value){
  const r={x:value?.x,y:value?.y,w:value?.w??0,h:value?.h??0};
  if(!Object.values(r).every(Number.isFinite)||r.w<0||r.h<0)throw Error('Source routes need finite card rectangles.');
  return r;
}
function sourceScene(requests,obstacles){
  const cards=new Map(),pairs=new Map();
  const card=value=>{const r=sourceRect(value),key=sourceRectKey(r);cards.set(key,r);return {r,key};};
  for(const value of obstacles)card(value);
  for(const request of requests){
    if(typeof request.key!=='string'||!request.key)throw Error('Source connections need a stable actual-pair key.');
    const a=card(request.from),b=card(request.to),reversed=sourceOrder(a.key,b.key)>0;
    const edge={key:request.key,from:reversed?b.r:a.r,to:reversed?a.r:b.r,fromKey:reversed?b.key:a.key,toKey:reversed?a.key:b.key,reversed};
    const previous=pairs.get(edge.key);
    if(previous&&(previous.fromKey!==edge.fromKey||previous.toKey!==edge.toKey||previous.reversed!==edge.reversed))throw Error('Group each source pair once before routing it.');
    pairs.set(edge.key,edge);
  }
  const edges=[...pairs.values()].sort((a,b)=>sourceOrder(a.key,b.key)),rects=[...cards].sort(([a],[b])=>sourceOrder(a,b)).map(([,r])=>r);
  return {edges,rects,key:JSON.stringify([SOURCE_ROUTE_POLICY,edges.map(e=>[e.key,e.fromKey,e.toKey,e.reversed]),rects])};
}
function sourceSegments(route){return route.points.slice(1).map((to,index)=>({from:route.points[index],to}));}
function sourceBox(points,pad=0){return {left:Math.min(...points.map(p=>p.x))-pad,right:Math.max(...points.map(p=>p.x))+pad,top:Math.min(...points.map(p=>p.y))-pad,bottom:Math.max(...points.map(p=>p.y))+pad};}
const sourceBoxesOverlap=(a,b)=>a.left<=b.right&&a.right>=b.left&&a.top<=b.bottom&&a.bottom>=b.top;
const sourceCross=(a,b)=>a.x*b.y-a.y*b.x;
function sourceSegmentConflict(a,b,c,d){
  const v={x:b.x-a.x,y:b.y-a.y},w={x:d.x-c.x,y:d.y-c.y},vLength=Math.hypot(v.x,v.y),wLength=Math.hypot(w.x,w.y);
  if(vLength<SOURCE_EPS||wLength<SOURCE_EPS)return 0;
  const offset={x:c.x-a.x,y:c.y-a.y},denominator=sourceCross(v,w);
  if(Math.abs(denominator)<=vLength*wLength*.002){
    const separation=Math.abs(sourceCross(offset,v))/vLength;if(separation>=6)return 0;
    const first=(offset.x*v.x+offset.y*v.y)/vLength,last=((d.x-a.x)*v.x+(d.y-a.y)*v.y)/vLength;
    const shared=Math.min(vLength,Math.max(first,last))-Math.max(0,Math.min(first,last));
    // A tiny common departure is harmless; a long coincident stem reads as a junction.
    return Math.max(0,shared-8)*8*(1-separation/6);
  }
  const t=sourceCross(offset,w)/denominator,u=sourceCross(offset,v)/denominator;
  if(t<-SOURCE_EPS||t>1+SOURCE_EPS||u<-SOURCE_EPS||u>1+SOURCE_EPS)return 0;
  const aEnd=t<SOURCE_EPS||t>1-SOURCE_EPS,bEnd=u<SOURCE_EPS||u>1-SOURCE_EPS;
  return aEnd&&bEnd?0:aEnd||bEnd?72:12;
}
function sourcePenalty(peers){
  return (a,b)=>{
    const box=sourceBox([a,b],6);let score=0;
    for(const peer of peers)if(sourceBoxesOverlap(box,peer.box))score+=sourceSegmentConflict(a,b,peer.from,peer.to);
    return score;
  };
}
function sourceCost(route,penalty){
  return sourceSegments(route).reduce((score,s)=>score+Math.hypot(s.to.x-s.from.x,s.to.y-s.from.y)+penalty(s.from,s.to),Math.max(0,route.points.length-2)*16);
}
function sourcePorts(edges){
  const incident=new Map();
  for(const edge of edges)for(const [own,other]of [['from','to'],['to','from']]){
    const key=edge[own+'Key'],entries=incident.get(key)||[];entries.push({edge,other:edge[other]});incident.set(key,entries);
  }
  const ports=new Map();
  for(const [key,entries]of incident){
    const rect=entries[0].edge.fromKey===key?entries[0].edge.from:entries[0].edge.to,result=new Map(entries.map(({edge})=>[edge.key,[]]));
    for(const side of ['top','right','bottom','left']){
      const horizontal=side==='top'||side==='bottom',axis=horizontal?'x':'y',available=Math.max(0,(horizontal?rect.w:rect.h)-32),spacing=entries.length>1?Math.min(18,available/(entries.length-1)):0;
      const ordered=[...entries].sort((a,b)=>a.other[axis]-b.other[axis]||sourceOrder(a.edge.key,b.edge.key));
      ordered.forEach(({edge},index)=>result.get(edge.key).push({side,offset:(index-(entries.length-1)/2)*spacing}));
    }
    ports.set(key,result);
  }
  return ports;
}
function reverseSourceRoute(route){
  if(route.blocked)return route;
  const point=p=>`${Number(p.x.toFixed(4))} ${Number(p.y.toFixed(4))}`,segments=route.segments.slice().reverse().map(s=>({from:s.to,to:s.from,...(s.control?{control:s.control}:{})})),points=route.points.slice().reverse();
  const d=['M '+point(points[0]),...segments.map(s=>s.control?`Q ${point(s.control)} ${point(s.to)}`:'L '+point(s.to))].join(' ');
  return {...route,d,points,segments};
}
function sourceBatch({edges,rects},preferStraight){
  const chosen=new Map(edges.map(edge=>{
    const direct=preferStraight&&routeStraightConnection(edge.from,edge.to,rects);
    return [edge.key,direct&&!direct.blocked?{...direct,label:{...direct.midpoint,w:0,h:0}}:routeComparisonConnection(edge.from,edge.to,rects)];
  })),ports=sourcePorts(edges);
  let alternatives=0;
  for(const edge of edges){
    const original=chosen.get(edge.key);if(original.blocked||preferStraight&&original.points.length===2||alternatives>=SOURCE_ALTERNATIVE_LIMIT)continue;
    const region=sourceBox(original.points,256),peers=[];
    for(const other of edges){if(other.key===edge.key)continue;for(const segment of sourceSegments(chosen.get(other.key))){const box=sourceBox([segment.from,segment.to],6);if(sourceBoxesOverlap(region,box))peers.push({...segment,box});}}
    // Bound the extra work independently of the existing card-avoidance solver.
    // Overflow keeps a valid original route rather than dropping a saved connection.
    if(!peers.length||peers.length>SOURCE_PEER_LIMIT)continue;
    const penalty=sourcePenalty(peers),conflict=sourceSegments(original).reduce((score,s)=>score+penalty(s.from,s.to),0);if(conflict<1)continue;
    alternatives++;
    const candidate=routeReasoningConnection(edge.from,edge.to,rects,{direct:false,fromPorts:ports.get(edge.fromKey).get(edge.key),toPorts:ports.get(edge.toKey).get(edge.key),segmentPenalty:penalty});
    if(!candidate.blocked&&sourceCost(candidate,penalty)<sourceCost(original,penalty)-SOURCE_EPS)chosen.set(edge.key,{...candidate,label:candidate.midpoint?{...candidate.midpoint,w:0,h:0}:null});
  }
  return new Map(edges.map(edge=>[edge.key,edge.reversed?reverseSourceRoute(chosen.get(edge.key)):chosen.get(edge.key)]));
}

/** Deterministic source routes for grouped actual pairs. Requests contain
 * {key,from,to}, with center-coordinate rectangles. Returned paths follow each
 * request's from→to direction. Reordering inputs, selection and camera changes
 * cannot alter geometry. The complete peer set participates in cache identity.
 */
export function createSourceConnectionRouter({limit=2,preferStraight=false}={}){
  const capacity=Math.max(1,Math.min(8,Math.floor(limit)||2)),cache=new Map();
  const route=(requests,obstacles=[])=>{
    const scene=sourceScene(requests,obstacles);
    if(cache.has(scene.key)){const found=cache.get(scene.key);cache.delete(scene.key);cache.set(scene.key,found);return found;}
    const result=sourceBatch(scene,preferStraight);cache.set(scene.key,result);if(cache.size>capacity)cache.delete(cache.keys().next().value);return result;
  };
  route.clear=()=>cache.clear();Object.defineProperty(route,'size',{get:()=>cache.size});return route;
}
