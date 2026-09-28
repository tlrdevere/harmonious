// Routes one displayed connection around cards without changing their positions.
// All input rectangles use center coordinates: {x, y, w, h}. The endpoints are
// included as obstacles internally; callers need only supply other visible cards.
const EPS=1e-7,CLEARANCE=12,BEND_COST=16,MAX_GRID_CELLS=262144,MAX_GRID_VISITS=50000;
const samePoint=(a,b)=>Math.abs(a.x-b.x)<EPS&&Math.abs(a.y-b.y)<EPS;
const length=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const sameRect=(a,b)=>a.x===b.x&&a.y===b.y&&a.w===b.w&&a.h===b.h;
function rectangle(value){
  const r={x:value?.x,y:value?.y,w:value?.w??0,h:value?.h??0};
  if(!Object.values(r).every(Number.isFinite)||r.w<0||r.h<0)throw Error('Reasoning routes need finite rectangles with nonnegative dimensions.');
  return r;
}
const bounds=(r,pad=0)=>({left:r.x-r.w/2-pad,right:r.x+r.w/2+pad,top:r.y-r.h/2-pad,bottom:r.y+r.h/2+pad});
const contains=(r,p)=>p.x>r.left+EPS&&p.x<r.right-EPS&&p.y>r.top+EPS&&p.y<r.bottom-EPS;
function crosses(a,b,r){
  // Slab intersection handles diagonal as well as axis-aligned corridors.
  // Touching an expanded boundary is safe; entering its interior is not.
  let low=0,high=1;
  for(const [origin,delta,min,max]of [[a.x,b.x-a.x,r.left+EPS,r.right-EPS],[a.y,b.y-a.y,r.top+EPS,r.bottom-EPS]]){
    if(min>=max)return false;
    if(Math.abs(delta)<EPS){if(origin<=min||origin>=max)return false;continue;}
    const first=(min-origin)/delta,last=(max-origin)/delta;
    low=Math.max(low,Math.min(first,last));high=Math.min(high,Math.max(first,last));
    if(low>=high)return false;
  }
  return high>0&&low<1;
}
const clear=(a,b,obstacles)=>!obstacles.some(r=>crosses(a,b,r));
function directRoute(from,to,others,clearance){
  const dx=to.x-from.x,dy=to.y-from.y;if(Math.abs(dx)<EPS&&Math.abs(dy)<EPS)return null;
  const fraction=r=>Math.min(Math.abs(dx)<EPS?Infinity:r.w/2/Math.abs(dx),Math.abs(dy)<EPS?Infinity:r.h/2/Math.abs(dy));
  const a=fraction(from),b=fraction(to);if(!Number.isFinite(a)||!Number.isFinite(b)||a+b>=1-EPS)return null;
  const start={x:from.x+dx*a,y:from.y+dy*a},end={x:to.x-dx*b,y:to.y-dy*b};
  return clear(start,end,[bounds(from),bounds(to),...others.map(r=>bounds(r,clearance))])?[start,end]:null;
}
function simplify(points){
  const result=[];
  for(const point of points){
    if(result.length&&samePoint(point,result.at(-1)))continue;
    const previous=result.at(-1),before=result.at(-2);
    if(before&&((Math.abs(before.x-previous.x)<EPS&&Math.abs(previous.x-point.x)<EPS)||(Math.abs(before.y-previous.y)<EPS&&Math.abs(previous.y-point.y)<EPS)))result.pop();
    result.push(point);
  }
  return result;
}
function ports(r,pad,others,preferred=null){
  const box=bounds(r),outer=bounds(r,pad),choices=(preferred||['top','right','bottom','left'].map(side=>({side,offset:0}))).map(({side,offset=0})=>{
    if(!['top','right','bottom','left'].includes(side)||!Number.isFinite(offset))throw Error('Invalid connection attachment point.');
    const horizontal=side==='top'||side==='bottom',half=(horizontal?r.w:r.h)/2,at=Math.max(-Math.max(0,half-8),Math.min(Math.max(0,half-8),offset));
    if(side==='top')return {point:{x:r.x+at,y:box.top},exit:{x:r.x+at,y:outer.top}};
    if(side==='right')return {point:{x:box.right,y:r.y+at},exit:{x:outer.right,y:r.y+at}};
    if(side==='bottom')return {point:{x:r.x+at,y:box.bottom},exit:{x:r.x+at,y:outer.bottom}};
    return {point:{x:box.left,y:r.y+at},exit:{x:outer.left,y:r.y+at}};
  });
  return choices.filter(p=>!others.some(o=>contains(o,p.exit))&&clear(p.point,p.exit,others));
}
function simpleRoute(starts,ends,obstacles,penalty=null){
  let best=null,bestCost=Infinity;
  for(const start of starts)for(const end of ends){
    for(const corner of [{x:start.exit.x,y:end.exit.y},{x:end.exit.x,y:start.exit.y}]){
      const middle=simplify([start.exit,corner,end.exit]);
      if(middle.slice(1).some((p,i)=>!clear(middle[i],p,obstacles)))continue;
      const points=simplify([start.point,...middle,end.point]),cost=points.slice(1).reduce((sum,p,i)=>sum+length(points[i],p)+(penalty?.(points[i],p)||0),0)+Math.max(0,points.length-2)*BEND_COST;
      if(cost<bestCost-EPS){best=points;bestCost=cost;}
    }
  }
  return best;
}

// A* over obstacle boundary coordinates. Most connections take the inexpensive
// direct/elbow path above. For obstructed connections, row/column interval caches
// avoid scanning every rectangle for every visited grid edge. The outer boundary
// provides a safe corridor when the space between cards is blocked.
function gridRoute(starts,ends,obstacles,pad){
  const xs=new Set(),ys=new Set();
  for(const r of obstacles){xs.add(r.left);xs.add(r.right);ys.add(r.top);ys.add(r.bottom);}
  for(const p of [...starts,...ends]){xs.add(p.exit.x);ys.add(p.exit.y);}
  const outer=Math.max(24,pad*2);
  xs.add(Math.min(...xs)-outer);xs.add(Math.max(...xs)+outer);ys.add(Math.min(...ys)-outer);ys.add(Math.max(...ys)+outer);
  const x=[...xs].sort((a,b)=>a-b),y=[...ys].sort((a,b)=>a-b),width=x.length,size=width*y.length;
  if(size>MAX_GRID_CELLS)return null;
  const xIndex=new Map(x.map((v,i)=>[v,i])),yIndex=new Map(y.map((v,i)=>[v,i]));
  const index=p=>yIndex.get(p.y)*width+xIndex.get(p.x),point=id=>({x:x[id%width],y:y[Math.floor(id/width)]});
  const startById=new Map(starts.map(p=>[index(p.exit),p])),endById=new Map(ends.map(p=>[index(p.exit),p]));
  const goalPoints=[...endById.keys()].map(point),heuristic=p=>Math.min(...goalPoints.map(goal=>length(p,goal)));
  const score=new Float64Array(size);score.fill(Infinity);const previous=new Int32Array(size);previous.fill(-1);const closed=new Uint8Array(size),heap=[];
  const compare=(a,b)=>a.f-b.f||a.h-b.h||a.id-b.id;
  const push=item=>{heap.push(item);let at=heap.length-1;while(at){const parent=(at-1)>>1;if(compare(heap[parent],item)<=0)break;heap[at]=heap[parent];at=parent;}heap[at]=item;};
  const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let at=0;while(at*2+1<heap.length){let child=at*2+1;if(child+1<heap.length&&compare(heap[child+1],heap[child])<0)child++;if(compare(last,heap[child])<=0)break;heap[at]=heap[child];at=child;}heap[at]=last;}return first;};
  const rows=new Map(),columns=new Map();
  const intervals=(axis,at)=>{
    const cache=axis==='x'?rows:columns;if(cache.has(at))return cache.get(at);
    const coordinate=axis==='x'?y[at]:x[at],raw=[];
    for(const r of obstacles){const low=axis==='x'?r.top:r.left,high=axis==='x'?r.bottom:r.right;if(coordinate>low+EPS&&coordinate<high-EPS)raw.push(axis==='x'?[r.left,r.right]:[r.top,r.bottom]);}
    raw.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const merged=[];
    for(const interval of raw){const last=merged.at(-1);if(last&&interval[0]<=last[1]+EPS)last[1]=Math.max(last[1],interval[1]);else merged.push([...interval]);}
    cache.set(at,merged);return merged;
  };
  const blocked=(axis,at,from,to)=>{
    const ranges=intervals(axis,at),low=Math.min(from,to),high=Math.max(from,to);let a=0,b=ranges.length;
    while(a<b){const mid=(a+b)>>1;if(ranges[mid][1]<=low+EPS)a=mid+1;else b=mid;}
    return a<ranges.length&&ranges[a][0]<high-EPS;
  };
  for(const [id,start]of startById){const h=heuristic(start.exit);score[id]=length(start.point,start.exit);push({id,g:score[id],h,f:score[id]+h});}
  let visits=0;
  while(heap.length&&visits<MAX_GRID_VISITS){
    const current=pop(),id=current.id;if(closed[id]||current.g>score[id]+EPS)continue;
    if(endById.has(id)){
      const path=[];let cursor=id;while(cursor!==-1){path.push(point(cursor));if(previous[cursor]===-1)break;cursor=previous[cursor];}
      const start=startById.get(cursor),end=endById.get(id);return simplify([start.point,...path.reverse(),end.point]);
    }
    closed[id]=1;visits++;const col=id%width,row=Math.floor(id/width),here=point(id),parent=previous[id]===-1?startById.get(id)?.point:point(previous[id]);
    const options=[];if(col)options.push(id-1);if(col+1<width)options.push(id+1);if(row)options.push(id-width);if(row+1<y.length)options.push(id+width);
    for(const nextId of options){
      if(closed[nextId])continue;const next=point(nextId),horizontal=next.y===here.y;
      if(blocked(horizontal?'x':'y',horizontal?row:col,horizontal?here.x:here.y,horizontal?next.x:next.y))continue;
      const bend=parent&&!samePoint(parent,here)&&((Math.abs(parent.y-here.y)<EPS)!==horizontal)?BEND_COST:0;
      const g=current.g+length(here,next)+bend;if(g>=score[nextId]-EPS)continue;
      score[nextId]=g;previous[nextId]=id;const h=heuristic(next);push({id:nextId,g,h,f:g+h});
    }
  }
  return null;
}

// A bounded outside fallback avoids an unbounded grid allocation on dense,
// irregular maps. Every candidate is still checked against every obstacle.
function outsideRoute(starts,ends,obstacles,pad,penalty=null){
  const left=Math.min(...obstacles.map(r=>r.left))-pad,right=Math.max(...obstacles.map(r=>r.right))+pad,top=Math.min(...obstacles.map(r=>r.top))-pad,bottom=Math.max(...obstacles.map(r=>r.bottom))+pad;
  let best=null,bestCost=Infinity;
  for(const start of starts)for(const end of ends){
    const candidates=[... [left,right].map(x=>[start.exit,{x,y:start.exit.y},{x,y:end.exit.y},end.exit]),... [top,bottom].map(y=>[start.exit,{x:start.exit.x,y},{x:end.exit.x,y},end.exit])];
    for(const candidate of candidates){
      const middle=simplify(candidate);if(middle.slice(1).some((point,index)=>!clear(middle[index],point,obstacles)))continue;
      const points=simplify([start.point,...middle,end.point]),cost=points.slice(1).reduce((sum,p,index)=>sum+length(points[index],p)+(penalty?.(points[index],p)||0),0)+(points.length-2)*BEND_COST;
      if(cost<bestCost-EPS){best=points;bestCost=cost;}
    }
  }
  return best;
}

const number=value=>String(Number(value.toFixed(4)));
const pair=p=>`${number(p.x)} ${number(p.y)}`;
const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const quadratic=(a,c,b,t)=>lerp(lerp(a,c,t),lerp(c,b,t),t);
function drawing(points,clearance){
  const segments=[],commands=['M '+pair(points[0])];let position=points[0];
  const line=p=>{if(samePoint(position,p))return;segments.push({from:position,to:p});commands.push('L '+pair(p));position=p;};
  for(let i=1;i<points.length-1;i++){
    const before=points[i-1],corner=points[i],after=points[i+1],radius=Math.min(6,clearance/2,length(before,corner)/2,length(corner,after)/2);
    const entry=lerp(corner,before,radius/length(corner,before)),exit=lerp(corner,after,radius/length(corner,after));line(entry);
    if(radius){segments.push({from:entry,control:corner,to:exit});commands.push(`Q ${pair(corner)} ${pair(exit)}`);position=exit;}else line(corner);
  }
  line(points.at(-1));
  const samples=[];let total=0;
  for(const segment of segments){let previous=segment.from;const steps=segment.control?16:1;for(let step=1;step<=steps;step++){const t=step/steps,p=segment.control?quadratic(segment.from,segment.control,segment.to,t):segment.to,n=Math.hypot(p.x-previous.x,p.y-previous.y);samples.push({segment,t0:(step-1)/steps,t1:t,start:total,length:n});total+=n;previous=p;}}
  const halfway=total/2,sample=samples.find(s=>s.start+s.length>=halfway)||samples.at(-1);let midpoint=points[0];
  if(sample){const t=sample.t0+(sample.t1-sample.t0)*(sample.length?(halfway-sample.start)/sample.length:0),s=sample.segment;midpoint=s.control?quadratic(s.from,s.control,s.to,t):lerp(s.from,s.to,t);}
  return {d:commands.join(' '),midpoint,points,segments,clearance,blocked:false};
}

/** Return a single SVG route and a midpoint on that route, not between endpoints.
 * `points`/`segments` are included for geometry checks. Default padding can be
 * reduced for a narrow passage; an explicit clearance (e.g. for a support badge)
 * is never reduced. Truly enclosed/overlapping endpoints yield an
 * empty, explicitly blocked route rather than a line through an unrelated card.
 * Direct facing-boundary routes are preferred. `direct:false` is reserved for
 * callers that must make space for an attached label outside a narrow gap.
 */
export function routeReasoningConnection(fromRect,toRect,obstacles=[],options={}){
  const from=rectangle(fromRect),to=rectangle(toRect),others=obstacles.map(rectangle).filter(r=>!sameRect(r,from)&&!sameRect(r,to));
  const preferred=options.clearance??CLEARANCE;
  if(!Number.isFinite(preferred)||preferred<2||preferred>256)throw Error('Reasoning route clearance must be between 2 and 256.');
  for(const clearance of options.clearance===undefined?[CLEARANCE,2]:[preferred]){
    const direct=options.direct===false?null:directRoute(from,to,others,clearance);if(direct)return drawing(direct,clearance);
    const otherBounds=others.map(r=>bounds(r,clearance)),fromBounds=bounds(from,clearance),toBounds=bounds(to,clearance),all=[...otherBounds,fromBounds,toBounds];
    const starts=ports(from,clearance,[...otherBounds,toBounds],options.fromPorts),ends=ports(to,clearance,[...otherBounds,fromBounds],options.toPorts);
    if(!starts.length||!ends.length)continue;
    const points=simpleRoute(starts,ends,all,options.segmentPenalty)||gridRoute(starts,ends,all,clearance)||outsideRoute(starts,ends,all,clearance,options.segmentPenalty);
    if(points?.length>1)return drawing(points,clearance);
  }
  return {d:'',midpoint:null,points:[],segments:[],clearance:0,blocked:true};
}
