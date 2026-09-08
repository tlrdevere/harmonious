import {CARD_W,CARD_H,FRAME_GAP,layoutForest} from './layout.mjs';

// The two maps share frame columns, but retain independent trees and expansion state.
export function comparisonNodeKey(side,id){return JSON.stringify([side,id]);}
export function layoutComparison(states,roots){
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

export function visibleComparisonEndpoint(layout,side,id){
  const view=layout.maps[side];if(!view||!id)return null;
  const byId=new Map(view.map.nodes.map(n=>[n.id,n]));let node=byId.get(id);
  while(node){if(view.positions.has(node.id))return {side,nodeId:id,visibleId:node.id,proxy:node.id!==id,key:comparisonNodeKey(side,node.id)};node=byId.get(node.parent);}
  return null;
}

export function comparisonRecordEnds(record,states){
  if(record.aMapId===states.a.map?.id&&record.bMapId===states.b.map?.id)return {a:record.aNodeId,b:record.bNodeId};
  if(record.bMapId===states.a.map?.id&&record.aMapId===states.b.map?.id)return {a:record.bNodeId,b:record.aNodeId};
  return null;
}
