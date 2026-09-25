import {CARD_W,CARD_H,FRAME_GAP,layoutForest} from './layout.mjs';

// Keep the two source trees distinct while avoiding an unnecessarily wide
// world that forces Fit all to make every card tiny. The pair gap remains
// independent from these scales so corresponding nodes stay readable.
export const OVERLAY_X_SCALE=1.8;
export const OVERLAY_Y_SCALE=1.3;
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
    const points=[...map.positions.values()],minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y+CARD_H));
    const height=maxY-minY+106;lanes.push({side,x:0,y,width,height});
    map.positions=new Map([...map.positions].map(([id,p])=>{
      const root=map.layout.positions.get(roots[p.frame]),point={...p,x:p.x-root.x+columns.get(p.frame).x,y:p.y-minY+y+74,side};
      positions.set(comparisonNodeKey(side,id),point);return[id,point];
    }));y+=height+136;
  }
  return {maps,positions,lanes,bounds:{x:0,y:0,width,height:Math.max(0,y-136)}};
}

// Sibling paths provide provisional display slots, never semantic matches.
// Source identities, parent edges, and expansion remain independent per map.
function layoutOverlay(states,roots,{links=[],reserved=[]}={}){
  const maps={},slots=new Map(roots.map(id=>[id,{id,parent:null}])),slotFor={a:new Map(),b:new Map()};
  for(const side of ['a','b']){
    const state=states[side],layout=layoutForest(state.map.nodes,roots,state.expanded);
    const visible=new Map([...layout.positions].filter(([,p])=>state.frame==='all'||roots[p.frame]===state.frame));
    maps[side]={map:state.map,layout,positions:new Map()};
    function visit(id,slot,parent){
      if(!visible.has(id))return;
      slots.set(slot,{id:slot,parent});slotFor[side].set(id,slot);
      layout.children.get(id).forEach((child,index)=>visit(child,`${slot}/${index}`,slot));
    }
    roots.forEach(id=>visit(id,id,null));
  }
  // Persisted counterpart links override provisional sibling slots. These are
  // display assignments only: source parents and authored edges are untouched.
  const occupied={a:new Map([...slotFor.a].map(([id,slot])=>[slot,id])),b:new Map([...slotFor.b].map(([id,slot])=>[slot,id]))};
  const sideOf=t=>['a','b'].find(s=>states[s].map.id===t?.mapId);
  const canonical=states.a.map.id<states.b.map.id?'a':'b',used=new Set();
  function displace(side,id){
    const old=slotFor[side].get(id),frame=maps[side].layout.positions.get(id).frame;
    const slot=JSON.stringify([roots[frame],side,id]);slots.set(slot,{id:slot,parent:roots[frame]});
    if(occupied[side].get(old)===id)occupied[side].delete(old);slotFor[side].set(id,slot);occupied[side].set(slot,id);
  }
  for(const link of links){
    const a=sideOf(link.target),b=sideOf(link.other);if(!a||!b||a===b)continue;
    const ids={[a]:link.target.nodeId,[b]:link.other.nodeId},anchor=canonical,other=anchor==='a'?'b':'a';
    if((roots.includes(ids.a)||roots.includes(ids.b))&&ids.a!==ids.b)continue;
    const p=maps[anchor].layout.positions.get(ids[anchor]),q=maps[other].layout.positions.get(ids[other]);
    if(!slotFor[anchor].has(ids[anchor])||!slotFor[other].has(ids[other])||p.frame!==q.frame||used.has(comparisonNodeKey(anchor,ids[anchor]))||used.has(comparisonNodeKey(other,ids[other])))continue;
    const slot=slotFor[anchor].get(ids[anchor]),old=slotFor[other].get(ids[other]),occupant=occupied[other].get(slot);
    if(occupant&&occupant!==ids[other])displace(other,occupant);
    if(occupied[other].get(old)===ids[other])occupied[other].delete(old);
    slotFor[other].set(ids[other],slot);occupied[other].set(slot,ids[other]);
    used.add(comparisonNodeKey(anchor,ids[anchor]));used.add(comparisonNodeKey(other,ids[other]));
  }
  const empty=[];
  for(const target of reserved){
    const side=sideOf(target);if(!side||!slotFor[side].has(target.nodeId)||used.has(comparisonNodeKey(side,target.nodeId)))continue;
    const other=side==='a'?'b':'a',slot=slotFor[side].get(target.nodeId),occupant=occupied[other].get(slot);
    if(occupant)displace(other,occupant);
    empty.push({side:other,slot,target});
  }
  const joint=layoutForest([...slots.values()],roots,new Set(slots.keys()));
  const positions=new Map(),pairOffset=(CARD_W+16)/2;
  for(const side of ['a','b'])for(const [id,slot]of slotFor[side]){
     const p=joint.positions.get(slot),point={...p,x:p.x*OVERLAY_X_SCALE+(side==='a'?-pairOffset:pairOffset),y:p.y*OVERLAY_Y_SCALE,side,slot};
    maps[side].positions.set(id,point);positions.set(comparisonNodeKey(side,id),point);
  }
  const placeholders=empty.map(e=>{const p=joint.positions.get(e.slot);return {...e,...p,x:p.x*OVERLAY_X_SCALE+(e.side==='a'?-pairOffset:pairOffset),y:p.y*OVERLAY_Y_SCALE};});
  const points=[...positions.values(),...placeholders];
  const minX=Math.min(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y));
  for(const p of points){p.x+=32-minX;p.y+=OVERLAY_TOP_GAP-minY;}
  const width=Math.max(...points.map(p=>p.x+CARD_W))+32,height=Math.max(...points.map(p=>p.y+CARD_H))+32;
  return {maps,positions,placeholders,lanes:[{side:'a',x:0,y:0,width,height}],overlay:true,bounds:{x:0,y:0,width,height}};
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
