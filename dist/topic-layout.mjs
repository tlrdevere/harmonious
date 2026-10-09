// Presentation only: saved parentage and relationship meanings remain intact.
export function topicSectors(topics,connections){
  const byId=new Map(topics.map(t=>[t.id,t])),parent=new Map(topics.map(t=>[t.id,t.id]));
  const find=id=>{let p=id;while(parent.get(p)!==p)p=parent.get(p);return p;};
  let linked=false;
  for(const edge of connections){const a=byId.get(edge.from),b=byId.get(edge.to);if(!a||!b||a.frame===b.frame)continue;linked=true;const x=find(a.id),y=find(b.id);if(x!==y)parent.set(y,x);}
  if(!linked)return new Map();
  const groups=new Map();for(const topic of topics){const key=find(topic.id);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(topic);}
  const ordered=[...groups.values()],sectors=new Map(),split=Math.floor(ordered.length/2),corridor=Math.PI/10;
  const weight=list=>Math.max(...[...new Set(list.map(t=>t.frame))].map(frame=>list.filter(t=>t.frame===frame).reduce((sum,t)=>sum+(t.weight||1),0)));
  function distribute(list,start,end){const total=list.reduce((sum,g)=>sum+weight(g),0);let cursor=start;
    for(const group of list){const span=(end-start)*weight(group)/total;
      for(const frame of new Set(group.map(t=>t.frame))){const members=group.filter(t=>t.frame===frame),totalWeight=members.reduce((s,t)=>s+(t.weight||1),0);let at=cursor;
        for(const t of members){const size=span*(t.weight||1)/totalWeight;sectors.set(t.id,{start:at,end:at+size,angle:at+size/2});at+=size;}}
      cursor+=span;
    }
  }
  if(ordered.length===1)distribute(ordered,-Math.PI*.75,-Math.PI*.25);
  else{distribute(ordered.slice(0,split),-Math.PI+corridor,-corridor);distribute(ordered.slice(split),corridor,Math.PI-corridor);}
  return sectors;
}

export function mapTopicSectors(nodes,roots,relations=[]){
  const children=new Map(nodes.map(n=>[n.id,[]]));for(const n of nodes)children.get(n.parent)?.push(n.id);
  const weight=id=>children.get(id)?.length?children.get(id).reduce((s,k)=>s+weight(k),0):1;
  const topics=roots.flatMap(root=>nodes.filter(n=>n.parent===root).map(n=>({id:n.id,frame:root,weight:weight(n.id)})));
  return topicSectors(topics,relations);
}

export function topicFocusMembers(nodes,selection){
  const byId=new Map(nodes.map(n=>[n.id,n])),topics=new Set([...selection].filter(id=>byId.get(byId.get(id)?.parent)?.parent===null)),members=new Set();
  for(const n of nodes){let p=n;const seen=new Set();while(p&&!seen.has(p.id)){if(topics.has(p.id)){members.add(n.id);break;}seen.add(p.id);p=byId.get(p.parent);}}
  return {topics,members};
}

// Topic focus follows cross-frame links in either direction, including chains.
// Same-frame links and links to deeper descendants do not extend the topic set.
export function connectedTopicBranches(nodes,relations,nodeId){
  const byId=new Map(nodes.map(n=>[n.id,n])),topics=new Set(nodes.filter(n=>byId.get(n.parent)?.parent===null).map(n=>n.id));
  if(!topics.has(nodeId))return new Set();
  const neighbors=new Map([...topics].map(id=>[id,[]]));
  for(const edge of relations||[]){
    if(!topics.has(edge.from)||!topics.has(edge.to)||byId.get(edge.from).parent===byId.get(edge.to).parent)continue;
    neighbors.get(edge.from).push(edge.to);neighbors.get(edge.to).push(edge.from);
  }
  const result=new Set([nodeId]),queue=[nodeId];
  for(let i=0;i<queue.length;i++)for(const id of neighbors.get(queue[i]))if(!result.has(id)){result.add(id);queue.push(id);}
  return result;
}
