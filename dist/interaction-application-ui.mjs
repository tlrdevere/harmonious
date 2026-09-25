import {interactionApplicationPreview,applyInteractionToMap} from './interaction-application.mjs';
import {frameOf} from './model.mjs';
const applicationEl=(tag,text='',cls='')=>{const e=document.createElement(tag);e.textContent=text;e.className=cls;return e;};
const applicationButton=(label,run)=>{const b=applicationEl('button',label);b.type='button';b.onclick=run;return b;};
export class InteractionApplicationUI{
  constructor(ui){this.ui=ui;this.d=ui.d;this.c=ui.c;}
  actions(record){
    let p;try{p=interactionApplicationPreview(this.c.workspace,record.id,this.d.actor());}catch{return;}
    if(p.receipt){this.d.host.append(applicationEl('p','Applied to your map','field-help'));return;}
    this.d.actionGroup('Your map',[applicationButton(p.operation==='revise'?'Review a revision':p.operation==='reason'?'Review adding this reason':'Review adding to my map',()=>this.form(record.id))]);
  }
  form(id){
    const d=this.d;if(!d.canLeave()||!this.c.editor.beforeLeave())return;this.c.captureActive();
    let preview;try{preview=interactionApplicationPreview(this.c.workspace,id,d.actor());}catch(e){d.shell('Map change unavailable');this.ui.error(d.host,e.message);return;}
    d.target={type:'entry',entryId:id};d.shell('Review change to your map');
    const form=applicationEl('form','','interaction-application-form'),map=preview.destination,operationId='application-'+crypto.randomUUID();
    form.append(applicationEl('p',`Your map: ${map.name}`,'discussion-byline'));
    const source=preview.source.item,edge=preview.origin.target.type==='edge';
    form.append(applicationEl('p',preview.operation==='revise'?'Only your wording will change.':edge&&preview.operation==='copy'?'This creates independent copies of both nodes and their connection.':preview.operation==='reason'&&edge?'This adds a node to your map. The offer remains attached to the original connection.':'This creates an independent node.','field-help'));
    const field=(text,input,name)=>{input.id='application-'+name;const l=applicationEl('label',text);l.htmlFor=input.id;form.append(l,input);return input;};
    const mode=applicationEl('select');mode.append(new Option('Create a node','copy'),new Option('Use an existing node','existing'));
    if(preview.operation!=='revise'&&!(edge&&preview.operation==='copy'))field('How to add it',mode,'mode');
    const parent=applicationEl('select'),existing=applicationEl('select');for(const node of map.nodes){parent.append(new Option(node.title,node.id));if(node.parent!==null)existing.append(new Option(node.title,node.id));}
    const placementSource=preview.operation==='reason'?preview.reference:!edge?preview.source:null;if(placementSource)parent.value=frameOf(placementSource.map.nodes,placementSource.item.id);
    field('Place under',parent,'parent');field('Existing node',existing,'existing');
    const seed=preview.operation==='reason'?preview.reference?.item:source;
    const title=applicationEl('input'),summary=applicationEl('textarea'),details=applicationEl('textarea');title.maxLength=200;summary.maxLength=10000;details.maxLength=10000;summary.rows=3;details.rows=3;
    title.value=preview.operation==='revise'&&preview.origin.action==='propose_alternative'?(preview.origin.body||preview.origin.interaction.otherText||source.title):seed?.title||preview.origin.body||preview.origin.interaction.otherText||'';
    summary.value=preview.origin.action==='request_explanation'?(preview.record.body||seed?.summary||''):seed?.summary||'';details.value=edge&&preview.operation==='revise'?(preview.origin.action==='request_explanation'?preview.record.body:preview.origin.body||preview.origin.interaction.otherText||source.note||''):seed?.details||'';
    if(preview.operation==='reason'&&preview.origin.action==='request_reason')title.value=seed?.title||preview.record.body||preview.record.interaction.otherText||'';
    if(title.value.length>200){summary.value=[title.value,summary.value].filter(Boolean).join('\n\n');title.value=title.value.slice(0,200).trimEnd();}
    field('Node title',title,'title');field('Explanation (optional)',summary,'summary');field(edge&&preview.operation==='revise'?'Connection wording':'More detail (optional)',details,'details');
    const link=applicationEl('input');link.type='checkbox';link.id='application-counterpart';const linkLabel=applicationEl('label','','interaction-choice');linkLabel.append(link,applicationEl('span','Link as counterparts'));if(preview.operation==='copy'&&!edge)form.append(linkLabel);
    const reasonTitle=applicationEl('textarea');reasonTitle.maxLength=200;reasonTitle.rows=2;
    if(preview.operation==='copy'&&!edge&&preview.origin.interaction.options.includes('own_reason')){
      if(preview.reference)form.append(applicationEl('p',`Supporting reason: ${preview.reference.item.title}${preview.reference.map.id===map.id?' (use your existing node)':' (add an independent copy)'}`,'field-help'));
      else{reasonTitle.value=preview.origin.body;field('Your reason node (optional)',reasonTitle,'own-reason');}
    }
    const show=(input,visible)=>{input.hidden=!visible;form.querySelector(`label[for="${input.id}"]`)?.toggleAttribute('hidden',!visible);};
    const sync=()=>{const simple=!(edge&&preview.operation==='copy'),copy=mode.value==='copy',revise=preview.operation==='revise';show(parent,!revise&&simple&&copy);show(existing,!revise&&simple&&!copy);show(title,simple&&!(revise&&edge)&&(revise||copy));show(summary,simple&&(!edge||preview.operation==='reason')&&(revise||copy));show(details,simple&&(revise||copy));title.required=!title.hidden;d.positionPopover();};mode.onchange=()=>{d.dirty=true;sync();};sync();
    if(edge&&preview.operation==='copy')for(const nodeId of [source.from,source.to]){const n=preview.source.map.nodes.find(n=>n.id===nodeId);form.append(applicationEl('strong',n.title),applicationEl('p',[n.summary,n.details].filter(Boolean).join('\n'),'discussion-body'));}
    const save=applicationEl('button','Apply to my map','primary');save.type='submit';form.append(save);d.host.append(form);
    form.onsubmit=async e=>{e.preventDefault();if(d.saving)return;d.saving=true;d.dirty=true;d.host.inert=true;
      try{const input={recordId:id,operationId,reviewed:preview.reviewed,mode:mode.value,parentId:parent.value,nodeId:existing.value,title:title.value,summary:summary.value,details:details.value,reasonTitle:reasonTitle.value,linkCounterpart:link.checked};
        const prepare=workspace=>applyInteractionToMap(workspace,input,d.actor());const result=this.c.account?await this.c.account.commitCandidate(prepare):prepare(this.c.workspace);
        if(!this.c.account){this.c.workspace=result.workspace;this.c.markDirty();if(this.c.activeMapId)this.c.loadMap(this.c.activeMapId);}
        d.dirty=false;d.saving=false;this.c.library.render();this.c.renderComparison();this.ui.open(id);
      }catch(error){this.ui.error(form,error.message);}finally{d.saving=false;d.host.inert=false;this.c.status();d.positionPopover();}
    };d.positionPopover();
  }
}
