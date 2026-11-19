import {roots} from './data.mjs';
const mainRoots=roots;

const periods=['history','present','likely_future'];
const headingTitles=['History','Status Quo · Present','Likely Future'];

export function temporalRoots(view='main',maps=[]){
  if(view!=='timeline')return [...mainRoots];
  const ids=new Set(maps.filter(map=>map&&!map.deletedAt&&!map.unavailable).flatMap(map=>(map.nodes||[]).map(node=>node.id)));
  const headingId=period=>{
    let id='~'+period;
    while(ids.has(id))id='~'+id;
    return id;
  };
  return [headingId('history'),'status',headingId('likely_future')];
}

// Saved maps have three real frame roots. Work out actual frame membership
// before interpreting timeScope, which only classifies Status Quo claims.
function sourceFrames(nodes){
  const children=new Map(),frames=new Map();
  for(const node of nodes){
    if(!children.has(node.parent))children.set(node.parent,[]);
    children.get(node.parent).push(node.id);
  }
  for(const root of children.get(null)||[]){
    if(!mainRoots.includes(root))continue;
    const stack=[root];
    while(stack.length){
      const id=stack.pop();
      if(frames.has(id))continue;
      frames.set(id,root);
      for(const child of children.get(id)||[])stack.push(child);
    }
  }
  return frames;
}

export function temporalViewForNode(map,id,current='main'){
  if(!map||map.unavailable||map.deletedAt)return current;
  const node=map.nodes?.find(item=>item.id===id);
  if(!node)return current;
  const frame=sourceFrames(map.nodes).get(id);
  if(frame==='action'||frame==='goal')return 'main';
  if(frame==='status'&&node.parent!==null&&['history','likely_future'].includes(node.timeScope))return 'timeline';
  return current;
}

// Only parent pointers used by the layout change. Source edges, identifiers,
// breadcrumbs and editable records are always resolved against sourceById.
export function projectTemporalMap(map,view='main',roots=temporalRoots(view,[map])){
  const sourceNodes=map&&!map.unavailable&&!map.deletedAt?map.nodes||[]:[];
  const sourceById=new Map(sourceNodes.map(node=>[node.id,node]));
  const frames=sourceFrames(sourceNodes),nodes=[],sectionById=new Map(),syntheticIds=new Set();
  const timeline=view==='timeline';
  for(const node of sourceNodes){
    const frame=frames.get(node.id);
    if(!frame)continue;
    const period=frame==='status'&&node.parent!==null&&periods.includes(node.timeScope)?node.timeScope:'present';
    if(timeline?frame!=='status':period!=='present')continue;
    sectionById.set(node.id,timeline?roots[periods.indexOf(period)]:frame);
  }
  if(timeline&&sourceById.has('status')){
    for(const index of [0,2]){
      const id=roots[index];
      nodes.push({id,parent:null,title:headingTitles[index],summary:'',kind:'frame',confidence:null,timeScope:periods[index],temporalHeading:true});
      sectionById.set(id,id);syntheticIds.add(id);
    }
  }
  for(const source of sourceNodes){
    const section=sectionById.get(source.id);
    if(!section)continue;
    const parent=source.parent===null?null:sectionById.get(source.parent)===section?source.parent:section;
    if(timeline&&source.id==='status')nodes.push({...source,title:headingTitles[1]});
    else nodes.push(parent===source.parent?source:{...source,parent});
  }
  const byId=new Map(nodes.map(node=>[node.id,node]));
  const relations=(map?.relations||[]).filter(edge=>sourceById.has(edge.from)&&sourceById.has(edge.to)&&byId.has(edge.from)&&byId.has(edge.to));
  return {nodes,roots,byId,sourceById,sectionById,relations,syntheticIds,view:timeline?'timeline':'main'};
}
