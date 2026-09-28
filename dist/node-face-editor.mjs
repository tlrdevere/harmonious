// Keep the live form mounted while the map redraws or an account autosaves.
// The expanded face uses screen-sized controls so it remains readable at any zoom.
export class NodeFaceEditor {
  constructor(viewport,{done,cancel}){
    this.viewport=viewport;this.nodeId=null;this.form=null;
    this.host=document.createElement('section');this.host.id='node-face-editor';this.host.className='node-face-editor';this.host.hidden=true;this.host.setAttribute('aria-label','Edit node on map');
    const heading=document.createElement('div');heading.className='node-face-heading';
    this.label=document.createElement('span');this.label.className='eyebrow';
    this.done=document.createElement('button');this.done.type='button';this.done.className='node-face-done';this.done.textContent='Done';this.done.onclick=done;
    heading.append(this.label,this.done);this.host.append(heading);viewport.append(this.host);
    this.host.addEventListener('pointerdown',event=>event.stopPropagation());
    this.host.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancel();}});
    this.observer=new ResizeObserver(()=>this.position());this.observer.observe(this.host);
  }
  show(node,form,{frame,child=false}={}){
    this.hide();this.nodeId=node.id;this.form=form;this.home=document.createComment('node form');form.before(this.home);this.host.append(form);form.hidden=false;
    this.host.dataset.nodeId=node.id;this.host.dataset.frame=frame;this.label.textContent=child?'NEW CHILD NODE':node.parent===null?'EDIT FRAME DETAILS':'EDIT NODE';this.done.hidden=child;
    this.host.hidden=false;this.host.scrollTop=0;
  }
  hide(){
    if(this.form){this.home.replaceWith(this.form);this.form=null;this.home=null;}
    this.nodeId=null;this.host.hidden=true;
  }
  position(point=this.point,camera=this.camera){
    this.point=point;this.camera=camera;if(this.host.hidden||!point||!camera)return;
    const pad=12,w=this.viewport.clientWidth,h=this.viewport.clientHeight;
    this.host.style.maxHeight=Math.max(120,h-pad*2)+'px';
    const x=Math.max(pad,Math.min(w-this.host.offsetWidth-pad,point.x*camera.z+camera.x));
    const y=Math.max(pad,Math.min(h-this.host.offsetHeight-pad,point.y*camera.z+camera.y));
    this.host.style.left=x+'px';this.host.style.top=y+'px';
  }
}
