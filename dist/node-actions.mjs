import {confidenceForm} from './confidence-ui.mjs';
export class NodeActions{
  constructor(viewport,actions){
    this.viewport=viewport;this.actions=actions;this.node=null;this.detail=null;
    this.host=document.createElement('div');this.host.className='on-map-actions';this.host.hidden=true;this.host.setAttribute('role','group');this.host.setAttribute('aria-label','Selected node actions');viewport.append(this.host);
    for(const event of ['pointerdown','wheel'])this.host.addEventListener(event,e=>e.stopPropagation());
    this.host.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();this.hide();actions.focusNode?.();}});
  }
  button(text,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=action;return b;}
  show(node,detail=null){this.node=node;this.detail=detail;this.host.hidden=false;this.render();}
  hide(){this.host.hidden=true;this.node=null;this.detail=null;}
  render(){
    const n=this.node;this.host.replaceChildren();if(!n)return;
    if(this.detail==='confidence'){
      this.host.append(confidenceForm(n,{save:value=>this.actions.saveConfidence(value),input:(value,valid)=>this.actions.draftConfidence(value,valid),cancel:()=>{this.actions.cancelConfidence();this.show(n);}}));return;
    }
    if(this.detail==='child'){
      const title=document.createElement('strong');title.textContent=`Add beneath “${n.title}”`;
      this.host.append(title,this.button('Create node',()=>this.actions.addChild()));
      if(n.parent!==null)this.host.append(this.button('Create reason',()=>this.actions.addChild(true)));
      this.host.append(this.button('Back',()=>this.show(n)));return;
    }
    const canEdit=this.actions.canEdit?.()!==false;
    if(canEdit){
      this.host.append(this.button('Edit',()=>this.actions.edit()),this.button('Add node',()=>this.show(n,'child')));
      if(n.parent!==null)this.host.append(this.button('Create reason',()=>this.actions.addChild(true)));
      if(n.parent!==null)this.host.append(this.button('Connect',()=>this.actions.connect()));
    }
    if(n.kind==='position'&&n.parent!==null&&this.actions.canSetConfidence?.())this.host.append(this.button('My confidence',()=>this.actions.confidence(n.id)));
    if(this.actions.definitions)this.host.append(this.button('Definitions & standards',()=>this.actions.definitions(n.id)));
    if(n.parent!==null)this.host.append(this.button('Compare',()=>this.actions.compare(n.id)));
    if(canEdit&&n.parent!==null){if(this.detail==='more')this.host.append(this.button('Delete branch',()=>this.actions.remove()));this.host.append(this.button(this.detail==='more'?'Less':'More',()=>this.show(n,this.detail==='more'?null:'more')));}
    this.host.append(this.button('Close',()=>{this.hide();this.actions.focusNode?.();}));
  }
  position(point,camera){
    if(this.host.hidden||!point)return;
    const w=this.viewport.clientWidth,h=this.viewport.clientHeight,width=Math.min(330,w-24);this.host.style.width=`${width}px`;
    const right=camera.x+(point.x+252)*camera.z+12,below=camera.y+(point.y+166)*camera.z+12;
    this.host.style.left=`${Math.max(12,Math.min(w-width-12,right))}px`;
    this.host.style.top=`${Math.max(12,Math.min(h-this.host.offsetHeight-60,below))}px`;
  }
}
