import {MapConnectionsUI} from './map-connections-ui.mjs';
import {groupSourceConnections,visibleNodePairKey} from './conversation-tree.mjs';
import {graphEdges,RELATION_TYPES,STRUCTURAL_TYPES} from './model.mjs';
import {comparisonNodeKey} from './comparison-layout.mjs';
import {CARD_W,CARD_H} from './layout.mjs';

let sourceCanvasSerial=0;

// A single path and its actual endpoint cards share hover, focus and selection.
// Rebinding after a redraw retains an inspected pair without retaining old DOM.
export function createSourceConnectionHighlights(){
  const items=new Map();let selected=null,hovered=null,focused=null;
  const clearMarks=()=>{for(const item of items.values()){item.path.classList.remove('source-connection-highlight');for(const card of item.cards)card?.classList.remove('source-endpoint-highlight');}};
  const apply=()=>{clearMarks();for(const key of [selected,hovered,focused]){const item=items.get(key);if(item){item.path.classList.add('source-connection-highlight');for(const card of item.cards)card?.classList.add('source-endpoint-highlight');}}};
  return {
    reset(){clearMarks();items.clear();hovered=null;focused=null;},
    select(key){selected=key;apply();},
    bind(key,path,hit,cards){
      items.set(key,{path,hit,cards});path.dataset.sourcePair=key;hit.dataset.sourcePair=key;
      hit.addEventListener('pointerenter',()=>{hovered=key;apply();});hit.addEventListener('pointerleave',()=>{if(hovered===key)hovered=null;apply();});
      hit.addEventListener('focus',()=>{focused=key;apply();});hit.addEventListener('blur',()=>{if(focused===key)focused=null;apply();});apply();
    }
  };
}

// Source browsing has the same saved connection meanings as the editor, but
// inspecting them never offers an edit or a comparison interaction.
export class SourceConnectionsUI{
  constructor(canvas){
    this.canvas=canvas;this.items=[];this.markerId=`source-connection-arrow-${++sourceCanvasSerial}`;
    this.menu=new MapConnectionsUI(canvas.surface,{
      close:key=>{this.menu.hide();canvas.sourceHighlights.select(null);const item=this.items.find(item=>item.key===key);item?.group.classList.remove('active');(item?.hit||canvas.surface).focus({preventScroll:true});},
      reveal:()=>this.reveal()
    });
  }
  build(){
    const canvas=this.canvas,svg=canvas.world.querySelector('.comparison-lines');
    this.menu.hide();canvas.sourceHighlights.reset();canvas.sourceHighlights.select(null);this.items=[];
    const defs=canvas.svgElement('defs'),marker=canvas.svgElement('marker',{id:this.markerId,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:5,markerHeight:5,orient:'auto-start-reverse'});
    marker.append(canvas.svgElement('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#758995'}));defs.append(marker);svg.append(defs);
    for(const side of ['a','b']){
      const state=canvas.states[side],view=canvas.layout.maps[side],map=state.map;if(!view||map.unavailable)continue;
      const byId=new Map(map.nodes.map(node=>[node.id,node]));
      for(const grouped of groupSourceConnections(graphEdges(map.nodes,map.relations))){
        const edges=[...grouped].sort((a,b)=>Number(a.structural)-Number(b.structural)||a.id.localeCompare(b.id)),edge=edges[0];
        if(!view.positions.has(edge.from)||!view.positions.has(edge.to))continue;
        const key=visibleNodePairKey(comparisonNodeKey(side,edge.from),comparisonNodeKey(side,edge.to));
        const branch=canvas.branches.find(item=>item.side===side&&visibleNodePairKey(item.edge.from,item.edge.to)===visibleNodePairKey(edge.from,edge.to));
        const group=canvas.svgElement('g',{class:'map-edge-group'}),path=branch?.path||canvas.svgElement('path',{fill:'none'});path.classList.add('source-connection-path',edge.structural?'edge':'semantic-edge');path.dataset.nodePair=key;path.removeAttribute('stroke-dasharray');
        if(edges.some(item=>!item.structural&&RELATION_TYPES[item.type]?.directed&&item.from===edge.from))path.setAttribute('marker-end',`url(#${this.markerId})`);
        if(edges.some(item=>!item.structural&&RELATION_TYPES[item.type]?.directed&&item.from===edge.to))path.setAttribute('marker-start',`url(#${this.markerId})`);
        const hit=canvas.svgElement('path',{class:'map-edge-hit',fill:'none',tabindex:'0',role:'button','aria-label':`Inspect connection: ${byId.get(edge.from).title} to ${byId.get(edge.to).title}`});hit.dataset.nodePair=key;
        const labelText=edges.length>1?`${edges.length} connection meanings`:(edge.structural?STRUCTURAL_TYPES[edge.type]:RELATION_TYPES[edge.type])?.label||'Connection',width=labelText.length*7.2+20;
        const label=canvas.svgElement('g',{class:`edge-label${edge.structural?' structural-label':''}`}),text=canvas.svgElement('text',{x:0,y:0});text.textContent=labelText;
        label.append(canvas.svgElement('rect',{x:-width/2,y:-12,width,height:24}),text);
        const item={key,side,map,edges,edge,group,path,hit,label,width};
        const inspect=()=>{for(const other of this.items)other.group.classList.toggle('active',other===item);canvas.sourceHighlights.select(key);this.menu.show(key,edges,map.nodes,false);this.positionMenu();};
        hit.onclick=inspect;hit.onpointerdown=event=>event.stopPropagation();hit.onkeydown=event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();inspect();}};
        group.append(path,hit,label);svg.append(group);this.items.push(item);canvas.sourceHighlights.bind(key,path,hit,[edge.from,edge.to].map(id=>canvas.cards.get(comparisonNodeKey(side,id))));
      }
    }
  }
  position(){
    const canvas=this.canvas;canvas.ensureSourceRoutes();
    for(const item of this.items){
      const route=canvas.sourceRoutes.get(item.key);if(!route)continue;item.route=route;item.path.setAttribute('d',route.d);item.hit.setAttribute('d',route.d);item.hit.style.display=route.blocked?'none':'';item.hit.setAttribute('tabindex',route.blocked?'-1':'0');
      const point=canvas.sourceRouteLabel(item.key,{w:item.width,h:24});item.label.style.display=point?'':'none';if(point)item.label.setAttribute('transform',`translate(${point.x},${point.y})`);
    }
    this.positionMenu();
  }
  positionMenu(){this.menu.position(this.items.find(item=>item.key===this.menu.key)?.route?.midpoint,this.canvas.camera);}
  reveal(){
    const canvas=this.canvas,item=this.items.find(item=>item.key===this.menu.key);if(!item)return;
    canvas.stopAnimation();const a=canvas.positions.get(comparisonNodeKey(item.side,item.edge.from)),b=canvas.positions.get(comparisonNodeKey(item.side,item.edge.to));if(!a||!b)return;
    canvas.camera={...canvas.camera,x:canvas.surface.clientWidth/2-((a.x+b.x+CARD_W)/2)*canvas.camera.z,y:canvas.surface.clientHeight/2-((a.y+b.y+CARD_H)/2)*canvas.camera.z};canvas.drawCamera();
  }
}
