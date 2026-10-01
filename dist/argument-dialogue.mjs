// A projection of existing authorized discussions, never a second conversation store.
export function dialogueRecords(ws,comparisonId,target){
 const roots=ws.discussions.filter(r=>r.comparisonId===comparisonId&&r.kind==='interaction'&&r.action==='dispute'&&r.interaction.mode==='argument'&&r.target.type==='node'&&r.target.mapId===target.mapId&&r.target.nodeId===target.nodeId);
 const ids=new Set(roots.map(r=>r.id));
 return [...roots,...ws.discussions.filter(r=>r.comparisonId===comparisonId&&r.kind==='interaction'&&r.action==='respond'&&ids.has(r.target.entryId))].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
}
export function validateDialogueTargets(ws){
 const byId=new Map(ws.discussions.map(r=>[r.id,r])),checked=new Set();
 for(const r of ws.discussions){
  if(r.interaction?.version!==7)continue;
  const ref=r.interaction.replyTo,p=byId.get(ref.entryId),root=byId.get(r.target.entryId);
  if(!root||root.kind!=='interaction'||root.action!=='dispute'||root.interaction.mode!=='argument'||!p||p.comparisonId!==r.comparisonId||!(p.id===root.id||p.kind==='interaction'&&p.action==='respond'&&p.target.entryId===root.id)||![p,...p.history].some(v=>v.version===ref.version))throw Error('Invalid reply target in this dispute.');
  for(const v of r.history){if(JSON.stringify(v.interaction.replyTo)!==JSON.stringify(ref))throw Error('A reply keeps its original target.');if(v.interaction.placement!==r.interaction.placement)throw Error('A reply keeps its original placement.');}
  let current=r;const path=new Set();
  while(current?.interaction?.version===7&&!checked.has(current.id)){if(path.has(current.id))throw Error('Reply targets cannot form a cycle.');path.add(current.id);current=byId.get(current.interaction.replyTo.entryId);}
  for(const id of path)checked.add(id);
 }
}
export function dialogueTree(records,collapsed=new Set()){
 const nodes=new Map([['claim',{id:'claim',record:null,parent:null,children:[],count:0}]]),order=['claim'];
 for(const r of records)nodes.set(r.id,{id:r.id,record:r,parent:r.action==='dispute'?'claim':r.interaction.replyTo?.entryId||r.target.entryId,children:[],count:0});
 for(const n of nodes.values())if(n.id!=='claim'&&nodes.has(n.parent)&&n.parent!==n.id)nodes.get(n.parent).children.push(n.id);
 const seen=new Set(['claim']);
 for(let i=0;i<order.length;i++)for(const id of nodes.get(order[i]).children)if(!seen.has(id)){seen.add(id);order.push(id);}
 for(let i=order.length-1;i>0;i--){const n=nodes.get(order[i]);nodes.get(n.parent).count+=1+n.count;}
 const visible=['claim'];for(let i=0;i<visible.length;i++){const n=nodes.get(visible[i]);if(!collapsed.has(n.id))for(const id of n.children)if(seen.has(id))visible.push(id);}
 return {nodes,order,visible};
}
export function layoutDialogue(tree,sizes){
 if(tree.visible.some(id=>['above','below'].includes(tree.nodes.get(id).record?.interaction.placement)))return layoutDirectionalDialogue(tree,sizes);
 const positions=new Map(),spans=new Map(),depth=new Map([['claim',0]]),widths=[],shown=new Set(tree.visible);
 for(const id of tree.visible){const n=tree.nodes.get(id),d=depth.get(id)||0;for(const child of n.children)depth.set(child,d+1);widths[d]=Math.max(widths[d]||0,sizes.get(id)?.w||300);}
 for(const id of [...tree.visible].reverse()){const n=tree.nodes.get(id),children=n.children.filter(c=>shown.has(c)),h=sizes.get(id)?.h||180;spans.set(id,Math.max(h,children.reduce((sum,c)=>sum+spans.get(c),0)+Math.max(0,children.length-1)*56));}
 const columns=[0];for(let i=0;i<widths.length;i++)columns[i+1]=columns[i]+widths[i]+135;
 const tops=new Map([['claim',0]]);
 for(const id of tree.visible){const n=tree.nodes.get(id),size=sizes.get(id)||{w:300,h:180},top=tops.get(id)||0,span=spans.get(id);positions.set(id,{x:columns[depth.get(id)],y:top+(span-size.h)/2,...size});let childY=top+(span-(n.children.filter(c=>shown.has(c)).reduce((s,c)=>s+spans.get(c),0)+Math.max(0,n.children.filter(c=>shown.has(c)).length-1)*56))/2;for(const c of n.children)if(shown.has(c)){tops.set(c,childY);childY+=spans.get(c)+56;}}
 return {positions,bounds:{x:0,y:0,width:Math.max(...[...positions.values()].map(p=>p.x+p.w)),height:spans.get('claim')||180}};
}

// Clip a straight centre-to-centre connection to the two card boundaries.
export function dialogueLine(a,b){
 const ax=a.x+a.w/2,ay=a.y+a.h/2,bx=b.x+b.w/2,by=b.y+b.h/2,dx=bx-ax,dy=by-ay;
 const start=Math.min(dx? a.w/2/Math.abs(dx):Infinity,dy?a.h/2/Math.abs(dy):Infinity),end=Math.min(dx?b.w/2/Math.abs(dx):Infinity,dy?b.h/2/Math.abs(dy):Infinity);
 return {x1:ax+dx*start,y1:ay+dy*start,x2:bx-dx*end,y2:by-dy*end};
}
function dialogueCrossesCard(line,p,padding=12){
 let lo=0,hi=1;
 for(const [start,end,min,max]of [[line.x1,line.x2,p.x-padding,p.x+p.w+padding],[line.y1,line.y2,p.y-padding,p.y+p.h+padding]]){
  const delta=end-start;if(!delta){if(start<=min||start>=max)return false;continue;}
  const a=(min-start)/delta,b=(max-start)/delta;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));if(lo>=hi)return false;
 }
 return hi>0&&lo<1;
}
function layoutDirectionalDialogue(tree,sizes){
 const positions=new Map(),edges=[],gap=135,size=id=>sizes.get(id)||{w:300,h:180};
 positions.set('claim',{x:0,y:0,...size('claim')});
 for(const id of tree.visible.slice(1)){
  const parent=tree.nodes.get(id).parent,side=tree.nodes.get(id).record?.interaction.placement||'right',s=size(id);
  let placed=false,attempt=0;
  // Prefer a directly adjacent card, then fan siblings into available space.
  // If a crowded branch has no clear exit, enlarge the existing drawing. Uniform
  // centre scaling preserves directions and clears space without bending lines.
  while(!placed){
   const a=positions.get(parent),cx=a.x+a.w/2,cy=a.y+a.h/2;
   const occupied=[-75,75];
   for(const [from,to]of edges)if(from===parent||to===parent){const q=positions.get(from===parent?to:from),dx=q.x+q.w/2-cx,dy=q.y+q.h/2-cy,angle=Math.atan2(side==='right'?dy:dx,side==='above'?-dy:side==='below'?dy:dx)*180/Math.PI;if(angle>-75&&angle<75)occupied.push(angle);}
   occupied.sort((a,b)=>a-b);
   const gaps=occupied.slice(1).map((angle,i)=>({angle:(angle+occupied[i])/2,width:angle-occupied[i]})).sort((a,b)=>b.width-a.width);
   const angles=[0,25,-25,45,-45,60,-60,75,-75,...gaps.map(g=>g.angle)];
   search:for(const distance of [1,1.5,2,3]){candidate:for(const degrees of angles){
    const vertical=side!=='right',forward=((vertical?a.h+s.h:a.w+s.w)/2+gap)*distance*2**(attempt%8),lateral=forward*Math.tan(degrees*Math.PI/180);
    const p={x:cx+(vertical?lateral:forward)-s.w/2,y:cy+(vertical?(side==='above'?-forward:forward):lateral)-s.h/2,...s},line=dialogueLine(a,p);
    for(const [other,q]of positions){
     if(p.x<q.x+q.w+56&&p.x+p.w+56>q.x&&p.y<q.y+q.h+56&&p.y+p.h+56>q.y)continue candidate;
     if(other!==parent&&dialogueCrossesCard(line,q))continue candidate;
    }
    for(const [from,to]of edges)if(dialogueCrossesCard(dialogueLine(positions.get(from),positions.get(to)),p))continue candidate;
    positions.set(id,p);edges.push([parent,id]);placed=true;break search;
   }}
   if(!placed&&++attempt%8===0)for(const p of positions.values()){p.x=(p.x+p.w/2)*2-p.w/2;p.y=(p.y+p.h/2)*2-p.h/2;}
  }
 }
 const cards=[...positions.values()],minX=Math.min(...cards.map(p=>p.x)),minY=Math.min(...cards.map(p=>p.y));
 for(const p of cards){p.x-=minX;p.y-=minY;}
 return {positions,bounds:{x:0,y:0,width:Math.max(...cards.map(p=>p.x+p.w)),height:Math.max(...cards.map(p=>p.y+p.h))}};
}
