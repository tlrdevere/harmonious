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
  for(const v of r.history)if(JSON.stringify(v.interaction.replyTo)!==JSON.stringify(ref))throw Error('A reply keeps its original target.');
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
 const positions=new Map(),spans=new Map(),depth=new Map([['claim',0]]),widths=[],shown=new Set(tree.visible);
 for(const id of tree.visible){const n=tree.nodes.get(id),d=depth.get(id)||0;for(const child of n.children)depth.set(child,d+1);widths[d]=Math.max(widths[d]||0,sizes.get(id)?.w||300);}
 for(const id of [...tree.visible].reverse()){const n=tree.nodes.get(id),children=n.children.filter(c=>shown.has(c)),h=sizes.get(id)?.h||180;spans.set(id,Math.max(h,children.reduce((sum,c)=>sum+spans.get(c),0)+Math.max(0,children.length-1)*56));}
 const columns=[0];for(let i=0;i<widths.length;i++)columns[i+1]=columns[i]+widths[i]+135;
 const tops=new Map([['claim',0]]);
 for(const id of tree.visible){const n=tree.nodes.get(id),size=sizes.get(id)||{w:300,h:180},top=tops.get(id)||0,span=spans.get(id);positions.set(id,{x:columns[depth.get(id)],y:top+(span-size.h)/2,...size});let childY=top+(span-(n.children.filter(c=>shown.has(c)).reduce((s,c)=>s+spans.get(c),0)+Math.max(0,n.children.filter(c=>shown.has(c)).length-1)*56))/2;for(const c of n.children)if(shown.has(c)){tops.set(c,childY);childY+=spans.get(c)+56;}}
 return {positions,bounds:{x:0,y:0,width:Math.max(...[...positions.values()].map(p=>p.x+p.w)),height:spans.get('claim')||180}};
}

