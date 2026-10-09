import {confidenceForm} from './confidence-ui.mjs';
export class NodeActions{
  constructor(viewport,actions){
    this.viewport=viewport;this.actions=actions;this.node=null;this.detail=null;
    this.host=document.createElement('div');this.host.className='on-map-actions';this.host.hidden=true;this.host.setAttribute('role','group');this.host.setAttribute('aria-label','Selected node actions');viewport.append(this.host);
    for(const event of ['pointerdown','wheel'])this.host.addEventListener(event,e=>e.stopPropagation());
    this.host.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();if(this.detail==='confidence')this.cancelConfidence();else{this.hide();actions.focusNode?.();}}});
  }
  button(text,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=action;return b;}
  show(node,detail=null){this.node=node;this.detail=detail;this.host.hidden=false;this.render();}
  hide(){this.host.hidden=true;this.node=null;this.detail=null;}
  cancelConfidence(){this.actions.cancelConfidence();this.hide();this.actions.focusConfidence?.();}
  group(label){const group=document.createElement('div');group.className='node-action-group';group.setAttribute('role','group');group.setAttribute('aria-label',label);this.host.append(group);return group;}
  render(){
    const n=this.node;this.host.replaceChildren();if(!n)return;
    if(this.detail==='confidence'){
      this.host.append(confidenceForm(n,{save:value=>{this.actions.saveConfidence(value);this.hide();this.actions.focusConfidence?.();},input:(value,valid)=>this.actions.draftConfidence(value,valid),cancel:()=>this.cancelConfidence()}));return;
    }
    const canEdit=this.actions.canEdit?.()!==false;
    if(canEdit){
      this.group('Edit node').append(this.button(n.parent===null?'Edit frame details':'Edit',()=>this.actions.edit()));
    }
    const main=this.group('Add or inspect');if(canEdit){const add=this.button('Add child node',()=>this.actions.addChild());add.className='primary';main.append(add);}main.append(this.button('Inspect details',()=>this.actions.inspect()));
    if(this.actions.canFocusBranch?.())main.append(this.button('Focus this branch',()=>this.actions.focusBranch()));
    if(n.parent!==null&&this.actions.philosophy)this.group('Foundations').append(this.button('Philosophy',()=>this.actions.philosophy()));
    const secondary=this.group('Other actions');
    if(canEdit&&n.parent!==null){const more=this.button(this.detail==='more'?'Fewer actions':'More actions',()=>{this.show(n,this.detail==='more'?null:'more');this.host.querySelector('.node-action-disclosure')?.focus();});more.className='node-action-disclosure';more.setAttribute('aria-expanded',String(this.detail==='more'));secondary.append(more);if(this.detail==='more'){const remove=this.button('Delete branch',()=>this.actions.remove());remove.className='danger';secondary.append(remove);}}
    const close=this.button('Close',()=>{this.hide();this.actions.focusNode?.();});close.className='text-button';secondary.append(close);
  }
  position(point,camera){
    if(this.host.hidden||!point)return;
    const w=this.viewport.clientWidth,h=this.viewport.clientHeight,width=Math.min(330,w-24);this.host.style.width=`${width}px`;
    const right=camera.x+(point.x+252)*camera.z+12,below=camera.y+(point.y+166)*camera.z+12;
    this.host.style.left=`${Math.max(12,Math.min(w-width-12,right))}px`;
    this.host.style.top=`${Math.max(12,Math.min(h-this.host.offsetHeight-60,below))}px`;
  }
}
