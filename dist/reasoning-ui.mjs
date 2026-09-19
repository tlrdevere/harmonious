import {isReason,isChallenge,discussionTargetLabel,discussionHealth} from './discussion.mjs';
import {conversationAnchor,reasoningBranch,selectReasoningEntries,challengeState} from './conversation-tree.mjs';
import {definitionReference} from './definitions.mjs';
import {CARD_W,CARD_H} from './layout.mjs';
import {routeReasoningConnection} from './reasoning-layout.mjs';

const reasoningEl=(tag,text='',cls='')=>{const e=document.createElement(tag);e.textContent=text;e.className=cls;return e;};
const reasoningButton=(label,fn,cls='')=>{const b=reasoningEl('button',label,cls);b.type='button';b.onclick=fn;return b;};
const reasoningRole=r=>isReason(r)?'Reason':isChallenge(r)?'Challenge':r.kind==='reply'?'Response':'Context';

// This view projects the existing discussions. It never saves a second graph
// or changes a source map's layout, hierarchy or text.
export class ReasoningUI{
  constructor(d){this.d=d;this.mode='compare';this.anchor=null;this.positions=new Map();this.inferences=new Map();this.cards=[];this.links=[];this.scope=null;
    this.modes=reasoningEl('span','','reasoning-modes');this.modes.setAttribute('role','group');this.modes.setAttribute('aria-label','Comparison mode');
    for(const mode of ['compare','argument']){const b=reasoningButton(mode==='compare'?'Compare':'Argument',()=>this.setFocus(mode));b.id='reasoning-'+mode+'-mode';b.setAttribute('aria-pressed',String(mode===this.mode));this.modes.append(b)}d.controls.prepend(this.modes);
    this.tools=reasoningEl('div','','reasoning-tools');this.fitButton=reasoningButton('Fit argument',()=>this.fit(),'reasoning-fit');this.tools.append(this.fitButton,reasoningButton('Back to source',()=>this.back(),'reasoning-back'),reasoningButton('Collapse argument',()=>{if(!d.canLeave())return;this.anchor=null;d.draw()},'reasoning-collapse'));this.tools.hidden=true;d.canvas.surface.append(this.tools);
    for(const e of ['pointerdown','wheel'])this.tools.addEventListener(e,event=>event.stopPropagation());
  }
  reset(){this.anchor=null;this.focusId=null;this.scope=null;this.mode='compare';this.positions.clear();this.inferences.clear();this.tools.hidden=true;this.sync()}
  sync(){for(const b of this.modes.children)b.setAttribute('aria-pressed',String(b.id==='reasoning-'+this.mode+'-mode'))}
  setFocus(mode){this.mode=mode;this.sync();if(mode==='argument'){this.d.layers.arguments=true;if(!this.anchor&&!this.d.dirty){const target=this.d.target;if(target)this.anchor=this.anchorFor(target);if(!this.anchor)this.d.listArguments()}}this.d.draw();this.d.positionPopover()}
  anchorFor(target){if(!target)return null;if(['entry','inference'].includes(target.type)){const entry=this.d.c.workspace.discussions.find(r=>r.id===target.entryId);if(entry&&['relationship','correspondence'].includes(entry.kind))return {type:'entry',entryId:entry.id};return entry&&conversationAnchor(this.d.c.workspace.discussions,entry)}return target}
  focusEntry(entry){this.anchor=conversationAnchor(this.d.c.workspace.discussions,entry);this.focusId=entry.id;this.mode='argument';this.d.layers.arguments=true;this.sync()}
  follow(target,{fit=true}={}){if(!this.d.canLeave())return;this.anchor=this.anchorFor(target);this.focusId=target.entryId||null;this.mode='argument';this.d.layers.arguments=true;this.sync();this.d.draw();if(fit)this.fit()}
  back(){const p=this.d.point(this.anchor);if(!p)return;const canvas=this.d.canvas;canvas.stopAnimation();canvas.camera={...canvas.camera,x:canvas.surface.clientWidth/2-p.x*canvas.camera.z,y:canvas.surface.clientHeight/2-p.y*canvas.camera.z};canvas.drawCamera();if(!this.d.dirty)this.d.selectTarget(this.anchor)}
  openInference(id){if(!this.d.canLeave())return;const r=this.d.allEntries().find(e=>e.id===id&&isReason(e));if(!r)return;this.d.target={type:'inference',entryId:id};this.d.shell('Reasoning connection');
    this.d.host.append(reasoningEl('p',`${this.d.name(r.authorId)} says this reason supports its conclusion.`,'discussion-byline'),reasoningEl('h3','Reason'),reasoningEl('p',r.body,'discussion-body'),reasoningEl('h3','Conclusion'));
    const source=r.target.type==='entry'?this.d.c.workspace.discussions.find(e=>e.id===r.target.entryId)?.body:discussionTargetLabel(this.d.c.workspace,r.target);this.d.host.append(reasoningEl('p',source||'Unavailable source','discussion-body'));
    if(r.authorId!==this.d.actor()&&r.status==='active'&&discussionHealth(this.d.c.workspace,r).state!=='unavailable')this.d.host.append(reasoningButton('Challenge reasoning',()=>this.d.compose('argument','inference',null,{title:'Challenge reasoning'})));
    this.d.host.append(reasoningButton('Open reason',()=>this.d.open(id)));
    for(const child of this.d.entries().filter(e=>e.target.type==='inference'&&e.target.entryId===id))this.d.host.append(this.d.entryButton(child));this.d.positionPopover();
  }
  definitionChoices(form,old){
    const details=reasoningEl('details','','reasoning-definition-choices');details.append(reasoningEl('summary','Definitions & standards (optional)'));const choices=[];
    for(const def of this.d.c.workspace.definitions.filter(e=>e.authorId===this.d.actor())){const used=old?.definitionRefs?.find(r=>r.definitionId===def.id);if(def.status==='archived'&&!used)continue;
      const row=reasoningEl('div','','definition-choice'),check=reasoningEl('input');check.type='checkbox';check.id='reasoning-use-'+def.id;check.checked=!!used;const label=reasoningEl('label',def.versions.at(-1).title);label.htmlFor=check.id;
      const version=reasoningEl('select');version.setAttribute('aria-label','Version of '+def.versions.at(-1).title);for(const v of [...def.versions].reverse()){const o=reasoningEl('option','Version '+v.version);o.value=String(v.version);version.append(o)}version.value=String(used?.version||def.versions.length);
      const wording=reasoningEl('p',def.versions[Number(version.value)-1].body);version.onchange=()=>{wording.textContent=def.versions[Number(version.value)-1].body;this.d.dirty=true};row.append(check,label,version,wording);details.append(row);choices.push({def,check,version});
    }
    if(!choices.length)details.append(reasoningEl('p','Create reusable entries in Map Library → Definitions & standards.'));
    form.append(details);return ()=>choices.filter(c=>c.check.checked).map(c=>definitionReference(c.def,Number(c.version.value)));
  }
  showDefinitions(r){if(!this.d.canLeave())return;this.d.target={type:'entry',entryId:r.id};this.d.shell('Definitions & standards');for(const ref of r.definitionRefs||[])this.d.host.append(reasoningEl('h3',ref.title),reasoningEl('p',`${this.d.name(ref.authorId)} · Version ${ref.version}`,'discussion-byline'),reasoningEl('p',ref.body,'discussion-body'));this.d.host.append(reasoningButton('Back to contribution',()=>this.d.open(r.id)));this.d.positionPopover()}
  draw(){const d=this.d,canvas=d.canvas,scope=d.actor()+':'+(d.thread()?.id||'');if(this.scope!==scope){this.anchor=null;this.scope=scope}canvas.world.querySelectorAll('.reasoning-drawing').forEach(e=>e.remove());this.positions.clear();this.inferences.clear();this.cards=[];this.links=[];this.tools.hidden=true;
    if(this.mode!=='argument'||!this.anchor||!d.layers.arguments)return;
    const branch=reasoningBranch(d.allEntries(),this.anchor),entries=branch.entries,selected=selectReasoningEntries(branch,40,this.focusId);
    if(!entries.length)return;this.tools.hidden=false;const visible=selected.entries;this.svg=canvas.svgElement('svg',{class:'discussion-lines reasoning-drawing'});const defs=canvas.svgElement('defs'),arrow=canvas.svgElement('marker',{id:'reasoning-support-arrow',viewBox:'0 0 8 6',refX:8,refY:3,markerWidth:6,markerHeight:5,orient:'auto'});arrow.append(canvas.svgElement('path',{d:'M 0 0 L 8 3 L 0 6 Z',fill:'#94a9b5'}));defs.append(arrow);this.svg.append(defs);canvas.world.append(this.svg);
    for(const r of visible){const article=reasoningEl('article','','reasoning-card reasoning-drawing');article.dataset.entry=r.id;article.dataset.role=reasoningRole(r).toLowerCase();const ownerMaps=Object.values(canvas.states).map(s=>s.map).filter(Boolean).sort((a,b)=>a.id.localeCompare(b.id));article.dataset.identity=ownerMaps.findIndex(m=>m.ownerId===r.authorId)===0?'one':'two';
      article.dataset.status=r.status;const main=reasoningButton('',()=>d.open(r.id),'reasoning-main');main.append(reasoningEl('strong',reasoningRole(r)+(r.status==='withdrawn'?' · Withdrawn':'')),reasoningEl('span',r.body,'reasoning-excerpt'));const foot=reasoningEl('footer');foot.append(reasoningEl('span',d.name(r.authorId),'reasoning-author'));if(r.definitionRefs?.length){const icon=reasoningButton('≡',()=>this.showDefinitions(r),'reasoning-definitions');icon.setAttribute('aria-label','View invoked definitions and standards');foot.append(icon);}if(isChallenge(r))foot.append(reasoningEl('small',challengeState(d.allEntries(),r)));
      const health=discussionHealth(d.c.workspace,r);if(['changed','unavailable'].includes(health.state))foot.append(reasoningEl('small',health.state==='changed'?'Source changed':'Source unavailable','reasoning-health'));article.append(main,foot);canvas.world.append(article);this.cards.push({r,article});
      if(isReason(r)){const badge=reasoningButton('Supports',()=>this.openInference(r.id),'reasoning-inference reasoning-drawing');badge.dataset.reason=r.id;badge.setAttribute('aria-label','Inspect reasoning connection: '+r.body.slice(0,100));canvas.world.append(badge);this.links.push({r,badge,path:canvas.svgElement('path',{class:'reasoning-edge'})})}else this.links.push({r,path:canvas.svgElement('path',{class:'reasoning-edge '+(isChallenge(r)?'reasoning-challenge-edge':'')})});
    }
    for(const l of this.links){l.path.dataset.entry=l.r.id;if(l.badge)l.path.setAttribute('marker-end','url(#reasoning-support-arrow)');this.svg.append(l.path)}
    if(entries.length>visible.length){const more=reasoningButton(`Show all ${entries.length} contributions`,()=>d.openGroup(this.anchor),'reasoning-more reasoning-drawing');canvas.world.append(more);this.more=more}else this.more=null;
  }
  position(){if(!this.cards.length)return;const d=this.d,canvas=d.canvas,anchor=d.point(this.anchor);if(!anchor){this.tools.hidden=true;for(const e of canvas.world.querySelectorAll('.reasoning-drawing'))e.hidden=true;return}
    const occupied=[...canvas.positions.values(),...(canvas.layout.placeholders||[])].map(p=>({x:p.x,y:p.y,w:CARD_W,h:CARD_H}));const overlaps=(a,b)=>a.x<b.x+b.w+26&&a.x+a.w+26>b.x&&a.y<b.y+b.h+26&&a.y+a.h+26>b.y;
    // Place appendages in free rows near their anchor. No source coordinates move.
    const width=280,gap=62,columns=canvas.surface.clientWidth<650?1:3;let baseY=anchor.y+(anchor.h||CARD_H)/2+100;const baseX=anchor.x-width/2;
    for(let row=0;row<Math.ceil(this.cards.length/columns);row++){
      const chunk=this.cards.slice(row*columns,(row+1)*columns),height=Math.max(...chunk.map(c=>c.article.offsetHeight));let y=baseY;
      while(chunk.some((c,col)=>occupied.some(p=>overlaps({x:baseX+col*(width+gap),y,w:width,h:height},p))))y+=height+100;
      for(const [col,c]of chunk.entries()){const x=baseX+col*(width+gap),h=c.article.offsetHeight;c.article.style.transform=`translate(${x}px,${y}px)`;const p={x:x+width/2,y:y+h/2,w:width,h};this.positions.set(c.r.id,p);occupied.push({x,y,w:width,h});}baseY=y+height+105;
    }
    const point=target=>target.type==='entry'?this.positions.get(target.entryId)||d.point(target):target.type==='inference'?this.inferences.get(target.entryId)||d.point(target):d.point(target);
    const obstacles=occupied.map(p=>({x:p.x+p.w/2,y:p.y+p.h/2,w:p.w,h:p.h}));
    this.inferences.clear();
    // Route support first: an inference challenge terminates on the actual
    // support connection, never on an unrelated source card beneath it.
    for(const link of [...this.links.filter(l=>l.badge),...this.links.filter(l=>!l.badge)]){
      const a=this.positions.get(link.r.id),b=link.r.target.type==='inference'?this.inferences.get(link.r.target.entryId):point(link.r.target);
      const clearance=link.badge?Math.max(link.badge.offsetWidth||90,link.badge.offsetHeight||30)/2+4:undefined;
      const route=a&&b?routeReasoningConnection(a,b,obstacles,clearance?{clearance}:undefined):null;
      link.path.setAttribute('d',route?.d||'');
      if(link.badge){link.badge.hidden=!route?.midpoint;if(route?.midpoint){const p={...route.midpoint,w:link.badge.offsetWidth||90,h:link.badge.offsetHeight||30};this.inferences.set(link.r.id,p);link.badge.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-50%)`}}
    }
    if(this.more)this.more.style.transform=`translate(${baseX}px,${baseY}px)`;
    const bounds=canvas.layout.bounds,minX=Math.min(bounds.x,...occupied.map(p=>p.x)),minY=Math.min(bounds.y,...occupied.map(p=>p.y));canvas.layout.bounds={x:minX,y:minY,width:Math.max(bounds.x+bounds.width,...occupied.map(p=>p.x+p.w))+32-minX,height:Math.max(bounds.y+bounds.height,...occupied.map(p=>p.y+p.h))+32-minY};
  }
  fit(){if(!this.cards.length)return;const canvas=this.d.canvas,source=this.d.point(this.anchor),points=[...this.positions.values(),source].filter(Boolean);if(!points.length)return;const x=Math.min(...points.map(p=>p.x-(p.w||0)/2))-30,y=Math.min(...points.map(p=>p.y-(p.h||0)/2))-45,right=Math.max(...points.map(p=>p.x+(p.w||0)/2))+30,bottom=Math.max(...points.map(p=>p.y+(p.h||0)/2))+30;const w=canvas.surface.clientWidth,h=canvas.surface.clientHeight,z=Math.min(1.1,Math.max(.12,Math.min(w/(right-x),(h-130)/(bottom-y))));canvas.stopAnimation();canvas.camera={z,x:(w-(right-x)*z)/2-x*z,y:70-y*z};canvas.drawCamera()}
}
