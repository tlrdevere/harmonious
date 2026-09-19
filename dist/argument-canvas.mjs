import {ComparisonCanvas} from './compare-canvas.mjs';
import {comparisonNodeKey} from './comparison-layout.mjs';
import {CARD_W,CARD_H,edgeEndpoints} from './layout.mjs';
import {comparisonProposalVersions,comparisonParticipants} from './workspace.mjs';
import {ARGUMENT_KINDS,ARGUMENT_RELATIONS,argumentGraphMatches,argumentNeedsReview} from './argument.mjs';

export function layoutArgument(nodes,bounds,anchors,owners){
  const positions=new Map(),counts=new Map();
  for(const side of ['a','b'])positions.set(`source:${side}`,anchors[side]||{x:bounds.x+(side==='a'?0:Math.max(bounds.width-CARD_W,CARD_W+40)),y:bounds.y-CARD_H-60});
  const center=bounds.x+bounds.width/2;
  for(const node of [...nodes].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))){
    const lane=node.authorId===owners[0]?0:1,row=counts.get(lane)||0;counts.set(lane,row+1);
    positions.set(`node:${node.id}`,{x:center+(lane===0?-CARD_W-40:40),y:bounds.y+bounds.height+90+row*(CARD_H+90)});
  }
  return positions;
}
export class ArgumentCanvas extends ComparisonCanvas{
  constructor(host,onSelect,onSource){super(host,()=>{},()=>{});this.onArgumentSelect=onSelect;this.onArgumentSource=onSource;this.surface.classList.add('argument-canvas');this.surface.setAttribute('aria-label','Argument over the compared worldviews. Reasoning connects to the saved source positions.');this.hint.textContent='Add reasoning, then connect it to a position or another reason.';}
  setArgument(workspace,proposal,revision){
    this.context={workspace,proposal,revision};
    const version=comparisonProposalVersions(proposal).find(v=>v.revision===revision);
    this.argumentNodes=workspace.argumentNodes.filter(n=>argumentGraphMatches(n,proposal.id,revision));
    this.argumentEdges=workspace.argumentEdges.filter(e=>argumentGraphMatches(e,proposal.id,revision)&&e.status==='active');
    this.setMaps(Object.fromEntries(['a','b'].map(side=>[side,{map:workspace.maps.find(m=>m.id===proposal[`${side}MapId`]),nodeId:version[`${side}NodeId`],frame:this.states[side].map?.id===proposal[`${side}MapId`]?this.states[side].frame:'all'}])),[],null);
  }
  argumentPositions(){
    if(!this.context||!this.layout)return new Map();
    const anchors=Object.fromEntries(['a','b'].map(side=>[side,this.layout.positions.get(comparisonNodeKey(side,this.states[side].selected))]));
    return layoutArgument(this.argumentNodes,this.layout.bounds,anchors,comparisonParticipants(this.context.workspace,this.context.proposal));
  }
  adoptCompareView(compare){
    for(const side of ['a','b'])if(this.states[side].map?.id===compare.states[side].map?.id){this.states[side].expanded=new Set(compare.states[side].expanded);this.states[side].frame=compare.states[side].frame;}
    this.reflow({animate:false});this.camera={...compare.camera};this.drawCamera();
  }
  buildWorld(){
    super.buildWorld();
    for(const link of this.links){link.path.remove();link.hit?.remove();link.badge?.remove();}this.links=[];
    this.hint.textContent='Add reasoning, then connect it to a saved position or another reason.';
    this.linkStatus.textContent='Arrows point from a reason to what it supports or rebuts.';
  }
  reflow(options={}){super.reflow({...options,animate:false});}
  fitCamera(points=null){return super.fitCamera(points||[...this.argumentPositions().values()]);}
  drawGeometry(...args){super.drawGeometry(...args);if(!this.context)return;this.drawArgument();}
  drawArgument(){
    this.argumentLayer?.remove();this.argumentLayer=document.createElement('div');this.argumentLayer.className='argument-layer';this.world.append(this.argumentLayer);
    const positions=this.argumentPositions(),{workspace,proposal,revision}=this.context,version=comparisonProposalVersions(proposal).find(v=>v.revision===revision);
    const svg=this.svgElement('svg',{'aria-label':'Reasoning connections'});svg.classList.add('comparison-lines');this.argumentLayer.append(svg);
    const defs=this.svgElement('defs'),marker=this.svgElement('marker',{id:'argument-arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'});marker.append(this.svgElement('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#53647c'}));defs.append(marker);svg.append(defs);
    for(const edge of this.argumentEdges){
      const a=positions.get(`node:${edge.from.id}`),b=positions.get(edge.to.type==='source'?`source:${edge.to.side}`:`node:${edge.to.id}`);if(!a||!b)continue;
      const p=edgeEndpoints(a,b),d=`M ${p.x1} ${p.y1} C ${p.x1+45} ${(p.y1+p.y2)/2} ${p.x2+45} ${(p.y1+p.y2)/2} ${p.x2} ${p.y2}`;
      const path=this.svgElement('path',{d,fill:'none',stroke:edge.relation==='rebuts'?'#b76b4c':'#53647c','stroke-width':2,'marker-end':'url(#argument-arrow)','stroke-dasharray':argumentNeedsReview(workspace,edge)?'7 5':''});svg.append(path);
      const label=this.svgElement('text',{x:(p.x1+p.x2)/2+45,y:(p.y1+p.y2)/2,'font-size':13,fill:'#37485f'});label.textContent=ARGUMENT_RELATIONS[edge.relation];svg.append(label);
    }
    for(const side of ['a','b']){
      const snap=version[`${side}Snapshot`],key=`source:${side}`;
      this.cards.get(comparisonNodeKey(side,this.states[side].selected))?.style.setProperty('visibility','hidden');
      this.addCard(key,positions.get(key),`${side.toUpperCase()} · Saved source · Proposal ${revision}`,snap.node?.title||'No source response',snap.node?.summary||'',()=>this.onArgumentSource(side),'source');
    }
    for(const node of this.argumentNodes){const name=workspace.participants.find(p=>p.id===node.authorId)?.name||'Participant';this.addCard(node.id,positions.get(`node:${node.id}`),`${ARGUMENT_KINDS[node.kind]} · ${name}${node.status==='withdrawn'?' · Withdrawn':''}`,node.title,node.body,()=>this.onArgumentSelect('node',node.id),node.status);}
  }
  addCard(id,point,label,title,body,action,state){
    const card=document.createElement('button');card.type='button';card.className='argument-card';card.dataset.state=state;card.style.transform=`translate(${point.x}px,${point.y}px)`;card.style.width=CARD_W+'px';card.style.height=CARD_H+'px';card.onclick=action;
    const meta=document.createElement('span');meta.className='argument-card-meta';meta.textContent=label;const heading=document.createElement('strong');heading.textContent=title;const text=document.createElement('span');text.className='argument-card-body';text.textContent=body;card.append(meta,heading,text);this.argumentLayer.append(card);
  }
}
