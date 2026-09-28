import {CARD_W,CARD_H,FRAME_GAP,layoutForest} from './layout.mjs';

export const COUNTERPART_W=CARD_W,COUNTERPART_H=CARD_H;
export const COUNTERPART_GAP=16,COMPARISON_PAIR_GAP=16,COMPARISON_GROUP_GAP=44;
export const OVERLAY_TOP_GAP=72;

// The two maps share frame columns, but retain independent trees and expansion state.
export function comparisonNodeKey(side,id){return JSON.stringify([side,id]);}
export function layoutComparison(states,roots,context={}){
  if(states.a.map&&states.b.map)return layoutOverlay(states,roots,context);
  const maps={},columns=new Map();
  for(const side of ['a','b']){
    const state=states[side];if(!state.map)continue;
    const layout=layoutForest(state.map.nodes,roots,state.expanded);
    const visible=new Map([...layout.positions].filter(([,p])=>state.frame==='all'||roots[p.frame]===state.frame));
    maps[side]={map:state.map,layout,positions:visible};
    for(let frame=0;frame<roots.length;frame++){
      const points=[...visible.values()].filter(p=>p.frame===frame);if(!points.length)continue;
      const root=layout.positions.get(roots[frame]),column=columns.get(frame)||{left:0,right:0};
      column.left=Math.max(column.left,root.x-Math.min(...points.map(p=>p.x)));
      column.right=Math.max(column.right,Math.max(...points.map(p=>p.x+CARD_W))-root.x);columns.set(frame,column);
    }
  }
  let x=32;
  for(const frame of [...columns.keys()].sort((a,b)=>a-b)){const c=columns.get(frame);c.x=x+c.left;x+=c.left+c.right+FRAME_GAP;}
  const width=Math.max(CARD_W+64,x-FRAME_GAP+32),positions=new Map(),lanes=[];let y=0;
  for(const side of ['a','b']){
    const map=maps[side];if(!map)continue;
    const points=[...map.positions.values()];if(!points.length)continue;
    const minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y+CARD_H));
    const height=maxY-minY+106;lanes.push({side,x:0,y,width,height});
    map.positions=new Map([...map.positions].map(([id,p])=>{
      const root=map.layout.positions.get(roots[p.frame]),point={...p,x:p.x-root.x+columns.get(p.frame).x,y:p.y-minY+y+74,side};
      positions.set(comparisonNodeKey(side,id),point);return[id,point];
    }));y+=height+136;
  }
  return {maps,positions,lanes,bounds:{x:0,y:0,width,height:Math.max(0,y-136)}};
}

// Only occupied, explicitly paired groups enter the display forest. Source
// trees, records and their real parent connectors are never rewritten here.
function layoutOverlay(states,roots,{links=[]}={}){
  const maps={},members=new Map(),groups=new Map(),groupFor=new Map();
  const compare=(a,b)=>String(a).localeCompare(String(b));
  const memberOrder=(a,b)=>compare(a.mapId,b.mapId)||a.order-b.order||compare(a.nodeId,b.nodeId);
  for(const side of ['a','b']){
    const state=states[side],layout=layoutForest(state.map.nodes,roots,state.expanded);
    const byId=new Map(state.map.nodes.map(n=>[n.id,n]));
    maps[side]={map:state.map,layout,positions:new Map()};
    let order=0;
    for(const [nodeId,p]of layout.positions)if(state.frame==='all'||roots[p.frame]===state.frame){
      const key=comparisonNodeKey(side,nodeId);
      members.set(key,{key,side,mapId:state.map.id,nodeId,parentId:byId.get(nodeId).parent,frame:p.frame,order:order++});
    }
  }
  function addGroup(list,kind){
    list=[...list].sort(memberOrder);const anchor=list[0];
    const id=kind==='frame'?JSON.stringify(['frame',roots[anchor.frame]]):JSON.stringify([kind,...list.map(m=>[m.mapId,m.nodeId])]);
    const group={id,kind,frame:anchor.frame,members:list,anchor,parent:null,children:[],w:list.length===2?CARD_W*2+COMPARISON_PAIR_GAP:kind==='frame'?CARD_W:CARD_W+COUNTERPART_GAP+COUNTERPART_W,h:CARD_H};
    groups.set(id,group);for(const m of list)groupFor.set(m.key,id);return group;
  }
  for(const root of roots){const list=[...members.values()].filter(m=>m.nodeId===root);if(list.length)addGroup(list,'frame');}
  const sideOf=t=>['a','b'].find(side=>states[side].map.id===t?.mapId);
  const priority=(a,b)=>(a.kind==='correspondence'?0:1)-(b.kind==='correspondence'?0:1)||compare(a.createdAt||'',b.createdAt||'')||compare(a.id||'',b.id||'');
  const pairs=new Map();
  for(const record of [...links].sort(priority)){
    if(record.status!=='active'||!['correspondence','relationship'].includes(record.kind))continue;
    const a=sideOf(record.target),b=sideOf(record.other);if(!a||!b||a===b)continue;
    const list=[members.get(comparisonNodeKey(a,record.target.nodeId)),members.get(comparisonNodeKey(b,record.other.nodeId))];
    if(list.some(m=>!m||roots.includes(m.nodeId))||list[0].frame!==list[1].frame||states[a].map.unavailable||states[b].map.unavailable)continue;
    list.sort(memberOrder);const key=JSON.stringify(list.map(m=>[m.mapId,m.nodeId]));if(!pairs.has(key))pairs.set(key,list);
  }
  for(const list of pairs.values())if(list.every(m=>!groupFor.has(m.key)))addGroup(list,'pair');
  for(const m of [...members.values()].sort(memberOrder))if(!groupFor.has(m.key))addGroup([m],'solo');
  function setParents(){
    for(const group of groups.values()){
      group.children=[];group.parent=group.kind==='frame'?null:groupFor.get(comparisonNodeKey(group.anchor.side,group.anchor.parentId));
    }
  }
  function invalidGroups(){
    const invalid=new Set();
    for(const start of groups.values()){
      const path=new Set();let group=start;
      while(group?.kind!=='frame'){
        if(!group||path.has(group.id)||group.frame!==start.frame){for(const id of path)invalid.add(id);break;}
        path.add(group.id);group=groups.get(group.parent);
      }
    }
    return invalid;
  }
  setParents();const invalid=invalidGroups();
  // A malformed grouping must lose adjacency, never a source card. Valid
  // cross-depth pairs normally cannot cycle because all use the same map order.
  if(invalid.size){
    for(const group of [...groups.values()])if(group.kind==='pair'&&invalid.has(group.id)){
      groups.delete(group.id);for(const member of group.members)addGroup([member],'solo');
    }
    setParents();
  }
  for(const group of groups.values())if(group.parent)groups.get(group.parent)?.children.push(group.id);
  for(const group of groups.values())group.children.sort((a,b)=>memberOrder(groups.get(a).anchor,groups.get(b).anchor));
  const additionalPairs=new Map();let crossFrameRelations=0;
  for(const side of ['a','b'])for(const relation of states[side].map.relations||[]){
    const from=members.get(comparisonNodeKey(side,relation.from)),to=members.get(comparisonNodeKey(side,relation.to));
    if(!from||!to||from.parentId===to.nodeId||to.parentId===from.nodeId)continue;
    const key=JSON.stringify([from.key,to.key].sort());if(additionalPairs.has(key))continue;
    additionalPairs.set(key,{fromKey:from.key,toKey:to.key});if(from.frame!==to.frame)crossFrameRelations++;
  }
  const straightSource=placeGroups(groups,[...additionalPairs.values()]);straightSource.additional.crossFrame=crossFrameRelations;
  const positions=new Map(),placeholders=[];
  for(const group of groups.values()){
    for(const m of group.members){
      const inset=group.members.length===2?(m.side==='b'?CARD_W+COMPARISON_PAIR_GAP:0):group.kind==='solo'&&m.side==='b'?COUNTERPART_W+COUNTERPART_GAP:0;
      const point={x:group.x+inset,y:group.y,frame:group.frame,depth:group.depth,angle:group.angle,radius:group.radius,side:m.side,slot:group.id,groupId:group.id};
      maps[m.side].positions.set(m.nodeId,point);positions.set(m.key,point);
    }
    if(group.kind==='solo'){
      const m=group.anchor;placeholders.push({target:{type:'node',mapId:m.mapId,nodeId:m.nodeId},sourceSide:m.side,side:m.side==='a'?'b':'a',slot:group.id,groupId:group.id,frame:group.frame,x:group.x+(m.side==='a'?CARD_W+COUNTERPART_GAP:0),y:group.y+(CARD_H-COUNTERPART_H)/2,w:COUNTERPART_W,h:COUNTERPART_H});
    }
  }
  const rects=comparisonDisplayRects({positions,placeholders}),width=rects.length?Math.max(...rects.map(p=>p.x+p.w))+32:0,height=rects.length?Math.max(...rects.map(p=>p.y+p.h))+32:0;
  return {maps,positions,placeholders,groups,groupFor,straightSource,lanes:rects.length?[{side:'a',x:0,y:0,width,height}]:[],overlay:true,bounds:{x:0,y:0,width,height}};
}

// Solve forbidden radius intervals for actual rectangles. This is a bounded
// radial pass, not a force simulation or a blanket stretch of another layout.
function radiusInterval(dx,dy,x,y,w,h){
  const axis=(d,c,size)=>Math.abs(d)<1e-12?(Math.abs(c)<size?[-Infinity,Infinity]:null):[(c-size)/d,(c+size)/d].sort((a,b)=>a-b);
  const a=axis(dx,x,w),b=axis(dy,y,h);if(!a||!b)return null;
  const low=Math.max(a[0],b[0]),high=Math.min(a[1],b[1]);return low<high?[low,high]:null;
}
function freeRadius(moving,fixed,min){
  const intervals=[],add=(a,b,moves)=>{
    const interval=radiusInterval(a.dx-(moves?b.dx:0),a.dy-(moves?b.dy:0),moves?0:b.cx,moves?0:b.cy,(a.w+b.w)/2+COMPARISON_GROUP_GAP,(a.h+b.h)/2+COMPARISON_GROUP_GAP);
    if(interval)intervals.push(interval);
  };
  for(let i=0;i<moving.length;i++){for(const b of fixed)add(moving[i],b,false);for(let j=0;j<i;j++)add(moving[i],moving[j],true);}
  intervals.sort((a,b)=>a[0]-b[0]);let radius=min;
  for(const [low,high]of intervals)if(radius>=low-1e-8&&radius<high+1e-8)radius=high+1e-6;
  return radius;
}
function groupCardRects(items,reverse=false){
  const rects=[];
  for(const group of items){
    for(const member of group.members){const right=reverse?member.side==='a':member.side==='b',x=group.cx-group.w/2+CARD_W/2+(group.w>CARD_W&&right?CARD_W+COMPARISON_PAIR_GAP:0);rects.push({key:member.key,x,y:group.cy,w:CARD_W,h:CARD_H,member});}
    if(group.kind==='solo'){const member=group.anchor,left=reverse?member.side==='b':member.side==='a';rects.push({key:JSON.stringify(['ghost',member.mapId,member.nodeId]),x:group.cx+(left?1:-1)*(CARD_W+COMPARISON_PAIR_GAP)/2,y:group.cy,w:COUNTERPART_W,h:COUNTERPART_H});}
  }
  return rects;
}
function segmentHitsRect(a,b,rect,padding=6){
  let low=0,high=1;
  for(const axis of ['x','y']){const half=(axis==='x'?rect.w:rect.h)/2+padding,d=b[axis]-a[axis],start=rect[axis]-half,end=rect[axis]+half;
    if(Math.abs(d)<1e-10){if(a[axis]<=start||a[axis]>=end)return false;continue;}
    let first=(start-a[axis])/d,last=(end-a[axis])/d;if(first>last)[first,last]=[last,first];low=Math.max(low,first);high=Math.min(high,last);if(low>=high-1e-10)return false;
  }
  return high>0&&low<1;
}
function directSourceState(items,reverse=false,additionalPairs=[]){
  const rects=groupCardRects(items,reverse),byKey=new Map(rects.filter(r=>r.member).map(r=>[r.key,r])),blocked=[];let total=0,length=0;
  for(const to of byKey.values()){
    if(to.member.parentId===null)continue;const from=byKey.get(comparisonNodeKey(to.member.side,to.member.parentId));if(!from)continue;
    total++;length+=Math.hypot(to.x-from.x,to.y-from.y);const obstacles=rects.filter(r=>r!==from&&r!==to&&segmentHitsRect(from,to,r));
    if(obstacles.length)blocked.push({fromKey:from.key,toKey:to.key,obstacles:obstacles.map(r=>r.key)});
  }
  const additional={total:0,clear:0,blocked:[],length:0};
  for(const pair of additionalPairs){const from=byKey.get(pair.fromKey),to=byKey.get(pair.toKey);if(!from||!to)continue;
    additional.total++;additional.length+=Math.hypot(to.x-from.x,to.y-from.y);const obstacles=rects.filter(r=>r!==from&&r!==to&&segmentHitsRect(from,to,r));
    if(obstacles.length)additional.blocked.push({...pair,obstacles:obstacles.map(r=>r.key)});else additional.clear++;
  }
  return {total,clear:total-blocked.length,blocked,length,additional};
}
function placeGroups(groups,additionalPairs){
  const frames=[...groups.values()].filter(g=>g.kind==='frame').sort((a,b)=>a.frame-b.frame),clusters=[];
  for(const root of frames){
    let best=null;
    // The world grows to clear the actual parent-to-child segments. Full-size
    // counterpart halves remain obstacles even when they contain no real node.
    // Candidate count and growth are bounded; exceptional blocked edges remain
    // explicit so the renderer can retain its honest fallback.
    for(const corridor of [Math.PI/5,Math.PI/4,Math.PI/6])for(const depthGrowth of [.6,1,1.6,2.4])for(const compact of [true,false]){
      const cluster=solveGroupFrame(root,groups,{corridor,depthGrowth,compact}),state=directSourceState(cluster.items,false,additionalPairs),reversed=directSourceState(cluster.items,true,additionalPairs);
      // The same actual identities choose the same world after swapping A/B.
      const scoreBlocked=state.blocked.length+reversed.blocked.length,scoreAdditional=state.additional.blocked.length+reversed.additional.blocked.length,scoreLength=state.length+reversed.length+state.additional.length+reversed.additional.length;
      if(!best||scoreBlocked<best.scoreBlocked||scoreBlocked===best.scoreBlocked&&(scoreAdditional<best.scoreAdditional||scoreAdditional===best.scoreAdditional&&scoreLength<best.scoreLength-.001))best={...cluster,state,scoreBlocked,scoreAdditional,scoreLength};
    }
    clusters.push(best);
  }
  const top=clusters.length?Math.min(...clusters.map(c=>c.minY)):0;let left=32;
  for(const cluster of clusters){
    for(const group of cluster.items)Object.assign(groups.get(group.id),group,{x:group.cx-group.w/2-cluster.minX+left,y:group.cy-group.h/2-top+OVERLAY_TOP_GAP});
    left+=cluster.maxX-cluster.minX+FRAME_GAP;
  }
  const blocked=clusters.flatMap(c=>c.state.blocked),total=clusters.reduce((sum,c)=>sum+c.state.total,0),additionalBlocked=clusters.flatMap(c=>c.state.additional.blocked),additionalTotal=clusters.reduce((sum,c)=>sum+c.state.additional.total,0);
  return {total,clear:total-blocked.length,blocked,additional:{total:additionalTotal,clear:additionalTotal-additionalBlocked.length,blocked:additionalBlocked}};
}
function solveGroupFrame(root,groups,{corridor,depthGrowth,compact}){
    const weights=new Map(),levels=new Map(),items=[];
    function measure(id){const g=groups.get(id),weight=g.children.length?g.children.reduce((sum,child)=>sum+measure(child),0):1;weights.set(id,weight);return weight;}
    measure(root.id);
    function distribute(ids,start,end,depth){
      const total=ids.reduce((sum,id)=>sum+weights.get(id),0);let cursor=start;
      for(const id of ids){const group=groups.get(id),span=(end-start)*weights.get(id)/total,angle=cursor+span/2;
        const heading=angle;
        Object.assign(group,{depth,angle:heading,dx:Math.cos(heading),dy:Math.sin(heading)});if(!levels.has(depth))levels.set(depth,[]);levels.get(depth).push(group);
        distribute(group.children,cursor,cursor+span,depth+1);cursor+=span;
      }
    }
    Object.assign(root,{depth:0,angle:0,radius:0,cx:0,cy:0});items.push(root);
    const owners=[...new Set(root.children.map(id=>groups.get(id).anchor.mapId))];
    const split=owners.length===2?root.children.filter(id=>groups.get(id).anchor.mapId===owners[0]).length:Math.floor(root.children.length/2);
    if(root.children.length===1)distribute(root.children,-Math.PI*.75,-Math.PI*.25,1);
    else{distribute(root.children.slice(0,split),-Math.PI+corridor,-corridor,1);distribute(root.children.slice(split),corridor,Math.PI-corridor,1);}
    let previous=0,firstRadius=0;
    for(const depth of [...levels.keys()].sort((a,b)=>a-b)){
      // Add a bounded ring step, rather than multiplying the preceding ring.
      // A long one-child chain therefore grows linearly with its real content.
      const level=levels.get(depth),min=previous+Math.max(CARD_H+COMPARISON_GROUP_GAP,firstRadius*depthGrowth);
      const radius=freeRadius(level,items,min);
      if(!firstRadius)firstRadius=radius;
      for(const group of level)Object.assign(group,{radius,cx:group.dx*radius,cy:group.dy*radius});
      if(compact){
        const batches=new Map();for(const group of level){const key=group.dy.toFixed(9);if(!batches.has(key))batches.set(key,[]);batches.get(key).push(group);}
        for(const batch of [...batches.values()].sort((a,b)=>Math.abs(b[0].dx)-Math.abs(a[0].dx))){
          const fixed=items.concat(level.filter(g=>!batch.includes(g))),r=freeRadius(batch,fixed,min);
          for(const group of batch)Object.assign(group,{radius:r,cx:group.dx*r,cy:group.dy*r});
        }
      }
      previous=Math.max(...level.map(g=>g.radius));items.push(...level);
    }
    const minX=Math.min(...items.map(g=>g.cx-g.w/2)),maxX=Math.max(...items.map(g=>g.cx+g.w/2)),minY=Math.min(...items.map(g=>g.cy-g.h/2)),maxY=Math.max(...items.map(g=>g.cy+g.h/2));
    return {items:items.map(g=>({...g})),minX,maxX,minY,maxY};
}

// Top-left rectangles are the common source for Fit and obstacle consumers.
// During animation a ghost follows its real source card, never a stale slot.
export function comparisonDisplayRects(layout,positions=layout.positions){
  const result=[...positions].map(([key,p])=>({...p,key,kind:'node',w:CARD_W,h:CARD_H}));
  for(const placeholder of layout.placeholders||[]){
    const sourceSide=placeholder.sourceSide||(placeholder.side==='a'?'b':'a'),sourceKey=comparisonNodeKey(sourceSide,placeholder.target.nodeId),current=positions.get(sourceKey),final=layout.positions?.get(sourceKey);
    if(!current)continue;
    result.push({...placeholder,key:JSON.stringify(['counterpart',placeholder.target.mapId,placeholder.target.nodeId]),sourceKey,kind:'counterpart',x:placeholder.x+(final?current.x-final.x:0),y:placeholder.y+(final?current.y-final.y:0),w:placeholder.w??COUNTERPART_W,h:placeholder.h??COUNTERPART_H});
  }
  return result;
}

export function visibleComparisonEndpoint(layout,side,id){
  const view=layout.maps[side];if(!view||!id)return null;
  const byId=new Map(view.map.nodes.map(n=>[n.id,n]));let node=byId.get(id);
  while(node){if(view.positions.has(node.id))return {side,nodeId:id,visibleId:node.id,proxy:node.id!==id,key:comparisonNodeKey(side,node.id)};node=byId.get(node.parent);}
  return null;
}

// Rich visibility is for connection projection; ordinary attachment badges can
// still use visibleComparisonEndpoint's nearest visible ancestor.
export function comparisonEndpoint(layout,side,id){
  const view=layout.maps[side],base={side,mapId:view?.map.id,nodeId:id,actualKey:JSON.stringify([view?.map.id,id]),visibleId:null,key:null,proxy:false};
  if(!view||view.map.unavailable)return {...base,status:'unavailable'};
  const byId=new Map(view.map.nodes.map(n=>[n.id,n]));let node=byId.get(id);
  if(!node)return {...base,status:'missing'};
  const seen=new Set();while(node.parent&&!seen.has(node.id)){seen.add(node.id);node=byId.get(node.parent);if(!node)return {...base,status:'missing'};}
  if(!view.positions.has(node.id))return {...base,status:'filtered'};
  const visible=visibleComparisonEndpoint(layout,side,id);
  return visible?{...base,...visible,status:visible.proxy?'collapsed':'visible'}:{...base,status:'unavailable'};
}

export function comparisonRecordEnds(record,states){
  if(record.aMapId===states.a.map?.id&&record.bMapId===states.b.map?.id)return {a:record.aNodeId,b:record.bNodeId};
  if(record.bMapId===states.a.map?.id&&record.aMapId===states.b.map?.id)return {a:record.bNodeId,b:record.aNodeId};
  return null;
}
