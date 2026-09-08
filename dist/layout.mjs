export const CARD_W=252, CARD_H=166, SIBLING_GAP=28, LEVEL_GAP=74, FRAME_GAP=104;

export function validateForest(nodes, roots) {
  const ids=new Set();
  for(const n of nodes){if(ids.has(n.id))throw Error('Duplicate node');ids.add(n.id);}
  if(roots.length!==3 || new Set(roots).size!==3)throw Error('Three distinct frames are required');
  const byId=new Map(nodes.map(n=>[n.id,n]));
  for(const n of nodes){
    if(n.parent===null){if(!roots.includes(n.id))throw Error('Unexpected root');}
    else if(!byId.has(n.parent))throw Error('Missing parent');
    const seen=new Set([n.id]);let p=n.parent;
    while(p!==null){if(seen.has(p))throw Error('Cycle');seen.add(p);p=byId.get(p)?.parent??null;}
  }
  for(const id of roots)if(!byId.has(id)||byId.get(id).parent!==null)throw Error('Invalid frame');
}

// Each frame is a radial tree. The horizontal gaps between the upper and
// lower sectors reserve a clear corridor for the non-parent frame spine.
export function layoutForest(nodes, roots, expanded){
  validateForest(nodes,roots);
  const children=new Map(nodes.map(n=>[n.id,[]]));
  for(const n of nodes)if(n.parent!==null)children.get(n.parent).push(n.id);
  const positions=new Map(),edges=[],clusters=[];
  const clearance=Math.hypot(CARD_W,CARD_H)+36, corridor=Math.PI/10;
  for(let frame=0;frame<roots.length;frame++){
    const root=roots[frame],weights=new Map(),polar=new Map(),levels=new Map();
    function measure(id){const kids=expanded.has(id)?children.get(id):[];const weight=kids.length?kids.reduce((sum,k)=>sum+measure(k),0):1;weights.set(id,weight);return weight;}
    measure(root);
    function distribute(ids,start,end,depth){
      const total=ids.reduce((sum,id)=>sum+weights.get(id),0);let cursor=start;
      for(const id of ids){const span=(end-start)*weights.get(id)/total,angle=cursor+span/2;
        polar.set(id,{angle,depth});if(!levels.has(depth))levels.set(depth,[]);levels.get(depth).push(angle);
        if(expanded.has(id))distribute(children.get(id),cursor,cursor+span,depth+1);
        cursor+=span;
      }
    }
    const kids=expanded.has(root)?children.get(root):[],split=Math.floor(kids.length/2);
    if(kids.length===1)distribute(kids,-Math.PI*.75,-Math.PI*.25,1);
    else {distribute(kids.slice(0,split),-Math.PI+corridor,-corridor,1);distribute(kids.slice(split),corridor,Math.PI-corridor,1);}
    const radii=new Map();let previous=0;
    for(const [depth,angles] of levels){
      angles.sort((a,b)=>a-b);let radius=previous+clearance+40;
      for(let i=0;i<angles.length;i++)if(angles.length>1){const next=i+1<angles.length?angles[i+1]:angles[0]+2*Math.PI;const delta=next-angles[i];radius=Math.max(radius,clearance/(2*Math.sin(delta/2)));}
      radii.set(depth,radius);previous=radius;
    }
    // Recursion visits levels in depth-first order; solve rings in depth order.
    previous=0;
    for(const depth of [...radii.keys()].sort((a,b)=>a-b)){radii.set(depth,Math.max(radii.get(depth),previous+clearance+40));previous=radii.get(depth);}
    const local=new Map([[root,{x:-CARD_W/2,y:-CARD_H/2,frame,depth:0,angle:0,radius:0}]]);
    for(const [id,p] of polar){const radius=radii.get(p.depth);local.set(id,{x:Math.cos(p.angle)*radius-CARD_W/2,y:Math.sin(p.angle)*radius-CARD_H/2,frame,depth:p.depth,angle:p.angle,radius});edges.push({from:nodes.find(n=>n.id===id).parent,to:id,frame,kind:'branch'});}
    const values=[...local.values()];clusters.push({local,minX:Math.min(...values.map(p=>p.x)),maxX:Math.max(...values.map(p=>p.x+CARD_W)),minY:Math.min(...values.map(p=>p.y)),maxY:Math.max(...values.map(p=>p.y+CARD_H))});
  }
  const minY=Math.min(...clusters.map(c=>c.minY)),maxY=Math.max(...clusters.map(c=>c.maxY));let left=0;
  for(const c of clusters){for(const [id,p] of c.local)positions.set(id,{...p,x:p.x-c.minX+left,y:p.y-minY});left+=c.maxX-c.minX+FRAME_GAP;}
  for(let i=0;i<roots.length-1;i++)edges.push({from:roots[i],to:roots[i+1],frame:-1,kind:'spine'});
  return {positions,edges,children,width:left-FRAME_GAP,height:maxY-minY};
}

// Clip connectors at card edges, keeping lines and arrows out of node text.
export function edgeEndpoints(a,b){
  const ax=a.x+CARD_W/2,ay=a.y+CARD_H/2,bx=b.x+CARD_W/2,by=b.y+CARD_H/2;
  const dx=bx-ax,dy=by-ay;
  const t=Math.min(dx===0?Infinity:(CARD_W/2+5)/Math.abs(dx),dy===0?Infinity:(CARD_H/2+5)/Math.abs(dy));
  if(!Number.isFinite(t)||t>=.5)return {x1:ax,y1:ay,x2:bx,y2:by};
  return {x1:ax+dx*t,y1:ay+dy*t,x2:bx-dx*t,y2:by-dy*t};
}

export function connectorRoute(a,b,root,sample=false){
  const straight=()=>{const {x1,y1,x2,y2}=edgeEndpoints(a,b);return {d:`M ${x1} ${y1} L ${x2} ${y2}`,points:[{x:x1,y:y1},{x:x2,y:y2}]};};
  if(!root||a.depth===0)return straight();
  const cx=root.x+CARD_W/2,cy=root.y+CARD_H/2,ax=a.x+CARD_W/2-cx,ay=a.y+CARD_H/2-cy,bx=b.x+CARD_W/2-cx,by=b.y+CARD_H/2-cy;
  const ra=Math.hypot(ax,ay),rb=Math.hypot(bx,by);
  if(ra<1||rb-ra<Math.hypot(CARD_W,CARD_H))return straight();
  const angleA=Math.atan2(ay,ax),angleB=Math.atan2(by,bx),middle=(ra+rb)/2;
  let delta=angleB-angleA;while(delta>Math.PI)delta-=2*Math.PI;while(delta< -Math.PI)delta+=2*Math.PI;
  const point=(radius,angle)=>({x:cx+radius*Math.cos(angle),y:cy+radius*Math.sin(angle)});
  const boundary=angle=>Math.min((CARD_W/2+5)/Math.max(1e-12,Math.abs(Math.cos(angle))),(CARD_H/2+5)/Math.max(1e-12,Math.abs(Math.sin(angle))));
  const start=point(ra+boundary(angleA),angleA),first=point(middle,angleA),last=point(middle,angleB),end=point(rb-boundary(angleB),angleB);
  const points=[start,first];if(sample){const steps=Math.max(1,Math.ceil(Math.abs(delta)*middle/12));for(let i=1;i<steps;i++)points.push(point(middle,angleA+delta*i/steps));}points.push(last,end);
  const arc=Math.abs(delta)<1e-9?'':` A ${middle} ${middle} 0 0 ${delta>=0?1:0} ${last.x} ${last.y}`;
  return {d:`M ${start.x} ${start.y} L ${first.x} ${first.y}${arc} L ${end.x} ${end.y}`,points};
}
