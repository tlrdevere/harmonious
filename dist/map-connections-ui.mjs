import {RELATION_TYPES,STRUCTURAL_TYPES} from './model.mjs';

const mapEdgeEl=(tag,text='',className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
const mapEdgeButton=(label,run)=>{const button=mapEdgeEl('button',label);button.type='button';button.onclick=run;return button;};

// An editor connection is inspected on the canvas; its existing edit form is
// still the single place that commits wording or type changes.
export class MapConnectionsUI{
  constructor(viewport,actions){
    this.viewport=viewport;this.actions=actions;this.key=null;
    this.host=mapEdgeEl('section','','map-connection-menu');this.host.hidden=true;this.host.setAttribute('aria-label','Connection details');viewport.append(this.host);
    for(const type of ['pointerdown','wheel'])this.host.addEventListener(type,event=>event.stopPropagation());
    this.host.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();this.actions.close(this.key);}});
  }
  hide(){this.key=null;this.host.hidden=true;}
  show(key,edges,nodes,canEdit){
    this.key=key;this.host.hidden=false;this.host.replaceChildren();
    const header=mapEdgeEl('header');header.append(mapEdgeEl('strong','Connection'),mapEdgeButton('Close',()=>this.actions.close(key)));this.host.append(header);
    const byId=new Map(nodes.map(node=>[node.id,node]));
    for(const edge of edges){
      const row=mapEdgeEl('div','','map-connection-detail');row.dataset.edgeId=edge.id;
      const from=byId.get(edge.from),to=byId.get(edge.to),definition=edge.structural?STRUCTURAL_TYPES[edge.type]:RELATION_TYPES[edge.type];
      const label=edge.structural?(definition?.forward||'Contains'):(definition?.label||'Connection');
      row.append(mapEdgeEl('div',label,'map-connection-kind'),mapEdgeEl('p',`${from?.title||'Unavailable node'} ${edge.structural||definition?.directed?'→':'↔'} ${to?.title||'Unavailable node'}`));
      if(edge.note)row.append(mapEdgeEl('p',edge.note,'map-connection-note'));
      if(edge.structural)row.append(mapEdgeEl('small','Branch organization; it does not by itself assert a reason.'));
      else if(canEdit){const controls=mapEdgeEl('div','','map-connection-actions');controls.append(mapEdgeButton('Edit',()=>this.actions.edit(edge.id)),mapEdgeButton('Remove',()=>this.actions.remove(edge.id,key)));row.append(controls);}
      this.host.append(row);
    }
    this.host.append(mapEdgeButton('Show connected nodes',()=>this.actions.reveal(edges[0].from,edges[0].to)));
    header.querySelector('button').focus({preventScroll:true});
  }
  position(point,camera){
    if(this.host.hidden||!point)return;
    const width=Math.min(360,this.viewport.clientWidth-24),height=this.viewport.clientHeight;
    this.host.style.width=width+'px';this.host.style.maxHeight=Math.max(100,height-82)+'px';
    this.host.style.left=Math.max(12,Math.min(this.viewport.clientWidth-width-12,camera.x+point.x*camera.z+12))+'px';
    this.host.style.top=Math.max(12,Math.min(height-this.host.offsetHeight-66,camera.y+point.y*camera.z+12))+'px';
  }
}
