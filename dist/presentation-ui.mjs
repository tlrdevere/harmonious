import {MapOutlineUI} from './map-outline-ui.mjs';
import {ComparisonOutlineUI} from './comparison-outline-ui.mjs';

const presentationEl=(tag,cls='')=>{const e=document.createElement(tag);e.className=cls;return e;};
export class PresentationUI{
 constructor(c){
  this.c=c;this.homes=new Map();this.views=new Map();this.cameras=new Map();this.scrolls=new Map();
  this.controls=presentationEl('div','presentation-switch');this.controls.setAttribute('role','group');this.controls.setAttribute('aria-label','Workspace presentation');
  for(const value of ['canvas','outline']){const b=presentationEl('button');b.type='button';b.id='presentation-'+value;b.textContent=value==='canvas'?'Canvas':'Outline';b.onclick=()=>this.set(value);this.controls.append(b);}
  document.getElementById('workspace-message').after(this.controls);
  for(const [kind,anchor]of [['map','viewport'],['source','reference-canvas'],['pod','pod-canvas'],['comparison','compare-canvas']]){const host=presentationEl('section','outline-workspace');host.id='outline-'+kind;host.hidden=true;host.setAttribute('aria-label',kind==='comparison'?'Comparison outline':kind+' outline');document.getElementById(anchor).after(host);this.views.set(kind,kind==='comparison'?new ComparisonOutlineUI(c,host):new MapOutlineUI(c,host,kind));}
  let saved;try{saved=localStorage.getItem('harmonious-presentation');}catch{}
  const route=new URLSearchParams(location.hash.slice(1)).get('layout');this.value=['canvas','outline'].includes(route)?route:['canvas','outline'].includes(saved)?saved:matchMedia('(max-width: 700px)').matches?'outline':'canvas';
  document.body.dataset.presentation=this.value;
  this.observer=new MutationObserver(records=>{if(records.some(r=>r.type==='childList'||r.oldValue!==r.target.getAttribute(r.attributeName)))this.schedule();});this.observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['hidden']});
  for(const event of ['click','input','change','submit'])document.addEventListener(event,()=>this.schedule());
  document.addEventListener('focusin',event=>{if(event.target.matches('input,textarea,select')&&event.target.closest('.node-face-editor,.on-map-actions,#inspector,.discussion-popover'))this.lastField={element:event.target,context:this.context()};});
  this.routeChanged=()=>{const value=new URLSearchParams(location.hash.slice(1)).get('layout');if(['canvas','outline'].includes(value)&&value!==this.value)this.set(value,{route:false});};
  window.addEventListener('hashchange',this.routeChanged);window.addEventListener('popstate',this.routeChanged);
  this.refresh();
 }
 get outline(){return this.value==='outline';}
 identity(){return JSON.stringify([this.c.accountMode?this.c.account?.actor?.id||null:'local',this.c.account?.facilitator?.context?.participantId||null]);}
 context(){return JSON.stringify([this.identity(),this.c.mode,this.c.activeMapId,this.c.sides?.a?.mapId,this.c.sides?.b?.mapId,this.c.participation.mapId,this.c.participation.podMapId,this.c.discussion.dialogue.active?this.c.discussion.dialogue.target:null]);}
 cameraKey(canvas){const index=this.canvases().indexOf(canvas),target=index===3?this.c.discussion.dialogue.target:null;return JSON.stringify([this.identity(),index,canvas.states?.a?.map?.id,canvas.states?.b?.map?.id,target]);}
 schedule(){if(this.pending)return;this.pending=true;requestAnimationFrame(()=>{this.pending=false;this.refresh();});}
 set(value,{route=true}={}){
  if(!['canvas','outline'].includes(value)||value===this.value)return;
  if(this.c.discussion?.saving){this.c.message('Please wait for this contribution to finish saving.');return;}
  const active=document.activeElement,prior=this.lastField?.context===this.context()?this.lastField.element:null,focus=active?.closest('form')?active:prior?.getClientRects().length?prior:active,selection=focus&&'selectionStart'in focus?[focus.selectionStart,focus.selectionEnd]:null;
  const context=this.context(),identity=this.identity();this.scrolls.set(context+':'+this.value,scrollY);
  if(value==='outline'){this.cameras.set(identity+':map:'+this.c.activeMapId,this.c.editor.outlineState().camera);for(const canvas of this.canvases())this.cameras.set(this.cameraKey(canvas),{...canvas.camera});}
  this.value=value;document.body.dataset.presentation=value;
  try{localStorage.setItem('harmonious-presentation',value);}catch{}
  if(route){const params=new URLSearchParams(location.hash.slice(1));params.set('layout',value);history.pushState(null,'',location.pathname+location.search+'#'+params);}
  this.refresh();
  requestAnimationFrame(()=>{
   if(value!==this.value||context!==this.context()||identity!==this.identity())return;
   if(value==='canvas'){const mapCamera=this.cameras.get(identity+':map:'+this.c.activeMapId);if(mapCamera)this.c.editor.restoreCamera(mapCamera);for(const canvas of this.canvases()){const camera=this.cameras.get(this.cameraKey(canvas));if(camera){canvas.camera={...camera};canvas.drawCamera();}}}
   if(focus?.isConnected&&focus.closest('form')&&focus.getClientRects().length){focus.focus({preventScroll:true});if(selection&&selection[0]!==null)focus.setSelectionRange?.(...selection);focus.scrollIntoView({block:'nearest'});}else scrollTo(0,this.scrolls.get(context+':'+value)||0);
  });
 }
 canvases(){return [this.c.canvas,this.c.participation.canvas,this.c.participation.podCanvas,this.c.discussion.dialogue.canvas];}
 move(el,host){if(!el||el.parentElement===host)return;if(!this.homes.has(el)){const marker=document.createComment('presentation home');el.before(marker);this.homes.set(el,marker);}host.append(el);}
 restore(el){const marker=this.homes.get(el);if(marker&&el.previousSibling!==marker)marker.after(el);}
 mountPanels(){
  const c=this.c,d=c.discussion;
  if(this.outline){
   const mapDetail=this.views.get('map').detailHost;for(const el of c.editor.outlineState().panels)this.move(el,mapDetail);
   for(const [kind,selector]of [['source','.discovery-layout > .reference-inspector'],['pod','.pod-layout > .reference-inspector']]){const el=document.querySelector(selector)||this[`${kind}Inspector`];if(el){this[`${kind}Inspector`]=el;this.move(el,this.views.get(kind).detailHost);}}
   const comparison=this.views.get('comparison');this.move(d.host,comparison.detailHost);this.move(d.search.host,comparison.detailHost);
   this.move(d.reasoning.tools,comparison.host);if(comparison.host.firstChild!==d.reasoning.tools)comparison.host.prepend(d.reasoning.tools);
  }else{
   for(const el of c.editor.outlineState().panels)this.restore(el);for(const kind of ['source','pod'])this.restore(this[`${kind}Inspector`]);
   const surface=d.dialogue.active?d.dialogue.canvas.surface:c.canvas.surface;
   for(const el of [d.host,d.search.host])if(el.parentElement!==surface)surface.append(el);
   this.restore(d.reasoning.tools);
  }
 }
 refresh(){
  if(this.refreshing)return;this.refreshing=true;
  try{
   const identity=this.identity();if(identity!==this.lastIdentity){this.lastIdentity=identity;this.cameras.clear();this.scrolls.clear();for(const view of this.views.values())view.reset?.();}
   if(this.controls.hidden===this.c.ready)this.controls.hidden=!this.c.ready;for(const button of this.controls.children){const active=button.id==='presentation-'+this.value;button.setAttribute('aria-pressed',String(active));button.classList.toggle('active',active);button.disabled=!!this.c.discussion.saving;}
   this.mountPanels();
   const mode=this.c.mode,active=mode==='individual'?'map':mode==='discover'?'source':mode==='pods'?'pod':mode==='compare'?'comparison':null;
   for(const [kind,view]of this.views){const visible=this.c.ready&&(!this.c.accountMode||!!this.c.account?.actor)&&this.outline&&kind===active;if(view.host.hidden===visible)view.host.hidden=!visible;if(visible)view.render();}
   this.c.facilitationPresentation?.refresh?.();
  }finally{this.refreshing=false;}
 }
}
