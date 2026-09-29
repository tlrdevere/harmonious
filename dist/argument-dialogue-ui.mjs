import {frameOf} from './model.mjs';
import {comparisonNodeKey} from './comparison-layout.mjs';
import {ComparisonCanvas} from './compare-canvas.mjs';
import {dialogueRecords,dialogueTree,layoutDialogue} from './argument-dialogue.mjs';
import {interactionPresentation} from './interaction-presentation.mjs';
import {interactionSource,interactionOptions,canReplyArgument} from './interaction-grammar.mjs';

const dialogueEl=(tag,text='',cls='')=>{const e=document.createElement(tag);e.textContent=text;e.className=cls;return e;};
const dialogueButton=(text,fn)=>{const e=dialogueEl('button',text);e.type='button';e.onclick=fn;return e;};
class DialogueCanvas extends ComparisonCanvas{
 constructor(host,options){super(host,()=>{},()=>{},{single:true,autoFitOnResize:false,...options});this.surface.setAttribute('aria-label','Node argument dialogue. Drag empty space to pan; scroll to zoom; F fits the dialogue.');this.surface.classList.add('dialogue-canvas');this.hint.textContent='Disputes branch from the claim · Other connections mean responds to';this.focusButton.hidden=true;const fit=this.surface.querySelector('[aria-label="Fit map"]');fit.textContent='Fit dialogue';fit.setAttribute('aria-label','Fit dialogue');}
 drawGeometry(){}
 fit(){if(!this.layout)return;this.stopAnimation();this.camera=this.fitCamera();this.drawCamera();}
}
export class ArgumentDialogueUI{
 constructor(d){
  this.d=d;this.c=d.c;this.active=false;this.sessions=new Map();this.cards=new Map();
  this.host=dialogueEl('section','','argument-dialogue');this.host.hidden=true;this.host.setAttribute('aria-label','Argument dialogue');this.comparisonHost=document.getElementById('compare-canvas');this.comparisonHost.after(this.host);
  this.header=dialogueEl('header','','dialogue-header');this.backButton=dialogueButton('Back to comparison',()=>this.close());this.heading=dialogueEl('strong');this.logButton=dialogueButton('Chronological log',()=>this.log());this.header.append(this.backButton,this.heading,this.logButton);this.host.append(this.header);
  this.canvasHost=dialogueEl('div','','dialogue-canvas-host');this.host.append(this.canvasHost);
  this.canvas=new DialogueCanvas(this.canvasHost,{onBlankClick:()=>d.host.hidden||d.close({focus:false}),afterCamera:()=>this.positionPopover()});
 }
 key(target=this.target){return JSON.stringify([this.d.actor(),this.d.thread()?.id,target?.mapId,target?.nodeId]);}
 url(entry=null){const p=new URLSearchParams({comparison:this.d.thread().id,view:'dialogue',map:this.target.mapId,node:this.target.nodeId});if(entry&&entry!=='claim')p.set('entry',entry);return location.pathname+location.search+'#'+p;}
 async open(target,{entry=null,route=true}={}){
  const source=interactionSource(this.c.workspace,target);let thread=this.d.thread();
  if(!thread&&source&&source.item.parent!==null&&[this.c.sides.a.mapId,this.c.sides.b.mapId].includes(target.mapId)){try{thread=await this.c.ensureComparison();}catch(error){this.c.message(error.message);return false;}}
  if(!thread||!source||source.item.parent===null||![thread.aMapId,thread.bMapId].includes(target.mapId)){this.c.message('This node is unavailable in this comparison.');return false;}
  if(!this.d.canLeave())return false;
  if(this.active)this.detach();else this.comparisonCamera={...this.c.canvas.camera};
  this.target={...target};this.scope=this.key();this.state=this.sessions.get(this.scope)||{collapsed:new Set(),expanded:new Set(),camera:null};this.sessions.set(this.scope,this.state);
  this.active=true;this.selected=entry||'claim';this.d.activateMode('argument');this.host.hidden=false;this.comparisonHost.hidden=true;this.c.canvas.surface.hidden=true;
  this.d.canvas.layerControls.hidden=true;this.d.viewOptions.hidden=true;this.canvas.surface.append(this.d.host,this.d.search.host);
  this.heading.textContent=source.item.title+' · '+this.d.name(source.map.ownerId);this.refresh(true);
  this.canvas.camera=this.state.camera?{...this.state.camera}:{x:40,y:50-(this.canvas.layout.positions.get('claim')?.y||0)*.85,z:.85};this.canvas.drawCamera();
  if(entry)this.reveal(entry);history[route?'pushState':'replaceState'](null,'',this.url(entry));
  this.backButton.focus({preventScroll:true});return true;
 }
 detach(){
  this.state.camera={...this.canvas.camera};this.host.hidden=true;this.comparisonHost.hidden=false;this.c.canvas.surface.hidden=false;this.c.canvas.surface.append(this.d.host,this.d.search.host);this.d.canvas.layerControls.hidden=false;this.d.viewOptions.hidden=false;this.active=false;
 }
 close({route=true}={}){
  if(!this.active)return true;if(!this.d.canLeave())return false;
  const target=this.target;this.detach();this.c.canvas.camera={...this.comparisonCamera};this.c.canvas.drawCamera();
  if(route)history.replaceState(null,'',location.pathname+location.search+'#'+new URLSearchParams({comparison:this.d.thread()?.id||'',view:'argument'}));
  this.d.selectTarget(target);const side=['a','b'].find(side=>this.c.sides[side].mapId===target.mapId);this.d.returnFocus=this.c.canvas.cards.get(comparisonNodeKey(side,target.nodeId))?.querySelector('.node-main');this.d.host.querySelector('header button')?.focus({preventScroll:true});return true;
 }
 root(r){return r.action==='dispute'?r:this.c.workspace.discussions.find(e=>e.id===r.target.entryId);}
 reply(r){
  if(!this.d.canLeave())return;this.d.target={type:'entry',entryId:this.root(r).id};
  const root=this.root(r),first=r.id===root.id&&root.interaction.recipientId===this.d.actor()&&!this.d.interactions.responses(root.id).length;
  this.selected=r.id;this.d.interactions.compose(first?'respond':'reply',null,{replyTo:{entryId:r.id,version:r.version}});this.positionPopover();this.d.host.querySelector('#interaction-comment')?.focus({preventScroll:true});
 }
 inspect(id){if(!this.d.canLeave())return;this.selected=id;if(id==='claim'){this.d.target={...this.target};this.d.interactions.sourceActions();}else this.d.interactions.open(id);this.reveal(id);this.positionPopover();}
 log(){if(!this.d.canLeave())return;this.selected='claim';this.d.target={...this.target};this.d.shell('Chronological dispute log');this.d.interactions.argumentLog();this.positionPopover();}
 reveal(id){
  if(!this.active)return;let n=this.tree?.nodes.get(id);if(!n)return;
  while(n?.parent){this.state.collapsed.delete(n.parent);n=this.tree.nodes.get(n.parent);}this.selected=id;this.refresh(true);
  const p=this.canvas.layout.positions.get(id);if(p){const z=Math.max(.65,this.canvas.camera.z);this.canvas.camera={z,x:this.canvas.surface.clientWidth/2-(p.x+p.w/2)*z,y:this.canvas.surface.clientHeight/2-(p.y+p.h/2)*z};this.canvas.drawCamera();}
  history.replaceState(null,'',this.url(id));this.cards.get(id)?.querySelector('button')?.focus({preventScroll:true});
 }
 refresh(force=false){
  if(!this.active)return;
  if(this.scope!==this.key()||this.d.mode()!=='argument'){if(!this.d.dirty)this.close({route:false});return;}
  const source=interactionSource(this.c.workspace,this.target);
  if(!source){this.canvas.world.replaceChildren();this.heading.textContent='Source unavailable';if(!this.d.dirty){this.d.canLeave();this.detach();}this.c.message('This source is no longer available. Any unfinished reply has been kept.');return;}
  const records=dialogueRecords(this.c.workspace,this.d.thread().id,this.target),signature=JSON.stringify([source.item,records,[...this.state.collapsed],[...this.state.expanded]]);
  if(!force&&signature===this.signature)return;const refreshDetail=!force&&!this.d.dirty&&!this.d.saving&&!this.d.host.hidden&&!this.d.host.querySelector('form')&&this.d.viewId;this.signature=signature;this.heading.textContent=source.item.title+' · '+this.d.name(source.map.ownerId);
  const old=this.canvas.layout?.positions.get(this.selected),focus=document.activeElement,focusId=focus?.closest('[data-dialogue-entry]')?.dataset.dialogueEntry,focusLabel=focus?.textContent;
  this.tree=dialogueTree(records,this.state.collapsed);this.canvas.world.replaceChildren();this.cards.clear();
  const svg=this.canvas.svgElement('svg',{class:'comparison-lines dialogue-lines'});this.canvas.world.append(svg);const sizes=new Map();
  for(const id of this.tree.visible){
   const n=this.tree.nodes.get(id),r=n.record,card=dialogueEl('article','','dialogue-card reasoning-card');card.dataset.dialogueEntry=id;card.dataset.status=r?.status||'active';card.dataset.owner=r?.authorId||source.map.ownerId;card.dataset.identity=card.dataset.owner===this.c.workspace.maps.find(m=>m.id===this.d.thread().aMapId)?.ownerId?'one':'two';
   for(const event of ['pointerdown','wheel'])card.addEventListener(event,e=>e.stopPropagation());
   const p=r&&interactionPresentation(this.c.workspace,r),title=r?[(r.action==='dispute'?'Dispute':p.label),...p.choices.filter(choice=>choice!==p.label)].filter(Boolean).join(' · '):source.item.title;
   const main=dialogueButton(title,()=>this.inspect(id));main.className='dialogue-main';main.setAttribute('aria-label','Read '+title);card.append(main,dialogueEl('small',this.d.name(r?.authorId||source.map.ownerId)+(r?' · '+new Date(r.createdAt).toLocaleString():' · Original claim · '+({status:'Status Quo',action:'Transformative Action',goal:'Goal State'}[frameOf(source.map.nodes,source.item.id)]||'')),'dialogue-author'));
   if(r?.status==='withdrawn')card.append(dialogueEl('strong','Withdrawn','dialogue-withdrawn'));
   const text=r?[r.body,r.interaction.otherText].filter(Boolean).join('\n\n'):[source.item.summary,source.item.details].filter(Boolean).join('\n\n');
   const body=dialogueEl('p',text||'No additional explanation.','dialogue-text');if(id!=='claim'&&!this.state.expanded.has(id))body.classList.add('dialogue-preview');card.append(body);
   if(text.length>180&&id!=='claim')card.append(dialogueButton(this.state.expanded.has(id)?'Less text':'Full text',()=>{this.selected=id;this.state.expanded.has(id)?this.state.expanded.delete(id):this.state.expanded.add(id);this.refresh(true);}));
   if(r?.interaction.version===6)card.append(dialogueEl('small','Earlier response — no specific reply target recorded','dialogue-history-note'));
   if(r?.interaction.replyTo){const addressed=this.tree.nodes.get(r.interaction.replyTo.entryId)?.record;if(addressed&&addressed.version!==r.interaction.replyTo.version)card.append(dialogueEl('small','Addressed an earlier version · inspect history','dialogue-history-note'));}
   const actions=dialogueEl('footer');
   if(!r&&source.map.ownerId!==this.d.actor()&&interactionOptions(this.c.workspace,this.target,'dispute').length)actions.append(dialogueButton('Dispute reasoning',()=>{if(!this.d.canLeave())return;this.selected='claim';this.d.target={...this.target};this.d.interactions.compose('dispute');}));
   if(r&&r.status==='active'&&canReplyArgument(this.root(r),this.d.actor()))actions.append(dialogueButton(r.action==='dispute'&&r.interaction.recipientId===this.d.actor()&&!this.d.interactions.responses(r.id).length?'Respond':'Reply',()=>this.reply(r)));
   if(r)actions.append(dialogueButton('Details',()=>this.inspect(id)));
   if(n.count){const collapsed=this.state.collapsed.has(id),button=dialogueButton(collapsed?'Expand · '+n.count:'Collapse · '+n.count,()=>{if(this.d.dirty){this.c.message('Finish or close this draft before collapsing the dialogue.');return;}this.selected=id;collapsed?this.state.collapsed.delete(id):this.state.collapsed.add(id);this.refresh(true);});button.setAttribute('aria-expanded',String(!collapsed));actions.append(button);}
   card.append(actions);this.canvas.world.append(card);this.cards.set(id,card);sizes.set(id,{w:card.offsetWidth,h:card.offsetHeight});
  }
  this.canvas.layout=layoutDialogue(this.tree,sizes);
  for(const [id,p]of this.canvas.layout.positions){this.cards.get(id).style.transform='translate('+p.x+'px,'+p.y+'px)';const parent=this.tree.nodes.get(id).parent,a=this.canvas.layout.positions.get(parent);if(a){const line=this.canvas.svgElement('line',{x1:a.x+a.w,y1:a.y+a.h/2,x2:p.x,y2:p.y+p.h/2,stroke:'#8195a7','stroke-width':1.5});line.append(this.canvas.svgElement('title'));line.firstChild.textContent=parent==='claim'?'Disputes':'Responds to';svg.append(line);}}
  const next=this.canvas.layout.positions.get(this.selected);if(old&&next){this.canvas.camera.x+=(old.x-next.x)*this.canvas.camera.z;this.canvas.camera.y+=(old.y-next.y)*this.canvas.camera.z;}this.canvas.drawCamera();
  if(refreshDetail){const scroll=this.d.host.scrollTop;this.d.interactions.open(refreshDetail);this.d.host.scrollTop=scroll;}
  if(focusId&&this.cards.has(focusId)){[...this.cards.get(focusId).querySelectorAll('button')].find(b=>b.textContent===focusLabel)?.focus({preventScroll:true});}
 }
 positionPopover(){
  if(!this.active||this.d.host.hidden)return;
  const canvas=this.canvas,p=canvas.layout?.positions.get(this.selected),w=Math.min(350,canvas.surface.clientWidth-24);this.d.host.style.width=w+'px';this.d.host.style.maxHeight=Math.max(100,canvas.surface.clientHeight-28)+'px';
  let x=p?canvas.camera.x+(p.x+p.w)*canvas.camera.z+12:12,y=p?canvas.camera.y+p.y*canvas.camera.z:12;
  this.d.host.style.left=Math.max(12,Math.min(canvas.surface.clientWidth-w-12,x))+'px';this.d.host.style.top=Math.max(12,Math.min(canvas.surface.clientHeight-this.d.host.offsetHeight-12,y))+'px';
 }
}

