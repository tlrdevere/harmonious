import {capturePremise,premiseChoices,premiseHealth,premiseScope} from './premise.mjs';
import {makeDiscussion,discussionSourceSnapshot,discussionTargetLabel} from './discussion.mjs';
import {stableJSON} from './account-model.mjs';

const premiseEl=(tag,text='',className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
const premiseButton=(text,run)=>{const button=premiseEl('button',text);button.type='button';button.onclick=run;return button;};
const premiseVersion=value=>{const {history,...version}=value;return version;};

export class PremiseUI{
  constructor(d){this.d=d;this.c=d.c;}
  wording(snapshot,title){
    const section=premiseEl('section','','premise-wording');if(title)section.append(premiseEl('h3',title));
    if(!snapshot){section.append(premiseEl('p','This node is no longer available.'));return section;}
    const wording=snapshot.wording;section.append(premiseEl('strong',wording.title),premiseEl('p',[wording.summary,wording.details].filter(Boolean).join('\n'),'discussion-body'),premiseEl('small',`Reviewed node version ${snapshot.ideaVersion}`));
    if(wording.sourceTitle||wording.sourceUrl){const source=premiseEl('p');let url;try{const candidate=new URL(wording.sourceUrl);if(['http:','https:'].includes(candidate.protocol))url=candidate.href;}catch{}if(url){const link=premiseEl('a',wording.sourceTitle||'Open source reference');link.href=url;link.target='_blank';link.rel='noopener noreferrer';source.append(link);}else source.textContent=wording.sourceTitle;section.append(source);}
    const definitions=premiseEl('details');definitions.append(premiseEl('summary','Definitions & standards used by this node'));
    for(const context of snapshot.contexts||[]){if(context.body&&!context.definitionRefs?.length)definitions.append(premiseEl('p',context.body,'discussion-body'));for(const ref of context.definitionRefs||[])definitions.append(premiseEl('h4',ref.title),premiseEl('p',ref.body,'discussion-body'),premiseEl('small',`${this.d.name(ref.authorId)} · Version ${ref.version}`));}
    if(definitions.children.length>1)section.append(definitions);return section;
  }
  destination(target,workspace=this.c.workspace){
    const box=premiseEl('section','','premise-destination'),entry=target.type==='entry'&&workspace.discussions.find(r=>r.id===target.entryId),snapshot=discussionSourceSnapshot(workspace,target);
    box.append(premiseEl('h3','Supports this conclusion'),premiseEl('strong',entry?.body||discussionTargetLabel(workspace,target)));
    if(snapshot?.wording?.summary)box.append(premiseEl('p',snapshot.wording.summary,'discussion-body'));return box;
  }
  attach(form,{body,label,reference,referenceLabel,definitions,submit,target,old}){
    if(old)return null;
    const tabs=premiseEl('div','','premise-mode');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Reason source');
    const panel=premiseEl('section','','premise-picker');panel.hidden=true;
    const search=premiseEl('input');search.type='search';search.placeholder='Find a position in your map';search.setAttribute('aria-label','Find one of my nodes');
    const results=premiseEl('div','','premise-results'),preview=premiseEl('section','','premise-preview'),notice=premiseEl('section','','premise-notice');
    const scopeHelp=premiseEl('p','','field-help'),destinationPreview=premiseEl('section');destinationPreview.append(this.destination(target));panel.append(premiseEl('p','Use one of your existing positions as a reason. Your original map stays unchanged.','field-help'),scopeHelp,destinationPreview,search,results,preview,notice);
    const session={target,old:null,selected:null,reviewed:null,destination:discussionSourceSnapshot(this.c.workspace,target),pending:null,comparisonId:this.d.thread()?.id};
    let active=false,choices=[];
    const render=()=>{const words=search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean),matches=choices.filter(choice=>words.every(word=>[choice.node.title,choice.node.summary,choice.map.name,choice.path].join(' ').toLocaleLowerCase().includes(word)));results.replaceChildren();
      for(const choice of matches.slice(0,30)){const button=premiseButton('',()=>{session.selected={mapId:choice.map.id,nodeId:choice.node.id};session.reviewed=capturePremise(this.c.workspace,session.selected);session.pending=null;preview.replaceChildren(this.wording(session.reviewed,'Selected position'));notice.replaceChildren();this.d.dirty=true;submit.disabled=!session.reviewed;render();this.d.positionPopover();});button.className='premise-choice';button.setAttribute('aria-pressed',String(session.selected?.nodeId===choice.node.id&&session.selected?.mapId===choice.map.id));button.append(premiseEl('strong',choice.node.title),premiseEl('small',`${choice.map.name} · ${choice.path}`));results.append(button);}
      if(!matches.length)results.append(premiseEl('p',choices.length?'No matching positions. Try other words.':'No eligible positions in this map and frame. You can write a reason instead.','field-help'));else if(matches.length>30)results.append(premiseEl('p',`Showing 30 of ${matches.length}. Refine your search to find another position.`,'field-help'));
    };
    const choose=async use=>{active=use;panel.hidden=!use;for(const control of [body,label,reference,referenceLabel,definitions].filter(Boolean))control.hidden=use;body.disabled=reference.disabled=use;submit.textContent=use?'Use selected node':'Add reason';submit.disabled=use&&!session.reviewed;write.setAttribute('aria-pressed',String(!use));reuse.setAttribute('aria-pressed',String(use));
      if(use){try{session.comparisonId=(this.d.thread()||await this.c.ensureComparison()).id;const scope=premiseScope(this.c.workspace,{comparisonId:session.comparisonId,target},this.d.actor());scopeHelp.textContent=scope?`${scope.map.name} · ${scope.map.nodes.find(n=>n.id===scope.frame)?.title||scope.frame}`:'';choices=premiseChoices(this.c.workspace,{comparisonId:session.comparisonId,target},this.d.actor());render();}catch(error){results.replaceChildren(premiseEl('p',error.message,'field-help'));}search.focus({preventScroll:true});}else body.focus({preventScroll:true});this.d.positionPopover();};
    const write=premiseButton('Write a reason',()=>choose(false)),reuse=premiseButton('Use one of my nodes',()=>choose(true));write.setAttribute('aria-pressed','true');reuse.setAttribute('aria-pressed','false');tabs.append(write,reuse);form.insertBefore(tabs,label);form.insertBefore(panel,label);search.oninput=render;
    return {active:()=>active,save:()=>this.save(session,{form,notice,submit,onReviewed:()=>preview.replaceChildren(this.wording(session.reviewed,'Selected position')),onUnavailable:workspace=>{const scope=premiseScope(workspace,session,this.d.actor());scopeHelp.textContent=scope?`${scope.map.name} · ${scope.map.nodes.find(n=>n.id===scope.frame)?.title||scope.frame}`:'';destinationPreview.replaceChildren(this.destination(target,workspace));session.destination=discussionSourceSnapshot(workspace,target);choices=premiseChoices(workspace,session,this.d.actor());render();}})};
  }
  render(record){
    if(!record.premise)return;
    const map=this.c.workspace.maps.find(m=>m.id===record.premise.mapId);
    this.d.host.append(premiseEl('p',`Uses a position from ${map?.name||'the author’s map'} · ${this.d.name(record.authorId)}`,'discussion-byline'),this.wording(record.premise));
    const previous=record.history.filter(version=>version.premise);if(previous.length){const history=premiseEl('details');history.append(premiseEl('summary','Earlier used-node wording'));for(const version of previous)history.append(this.wording(version.premise,`Reason version ${version.version}`));this.d.host.append(history);}
  }
  review(record){
    if(!this.d.canLeave())return;this.d.activateMode('argument');this.d.target={type:'entry',entryId:record.id};this.d.editingContributionId=record.id;this.d.shell('Review used node');
    const health=premiseHealth(this.c.workspace,record),form=premiseEl('form','','premise-review'),notice=premiseEl('section','','premise-notice'),current=health.state==='unavailable'?null:health.current,session={target:record.target,old:record,selected:{mapId:record.premise.mapId,nodeId:record.premise.nodeId},reviewed:current,destination:discussionSourceSnapshot(this.c.workspace,record.target),pending:null,comparisonId:record.comparisonId};
    const currentPreview=premiseEl('section');currentPreview.append(this.wording(current,'Current node wording'));form.append(this.destination(record.target),this.wording(record.premise,'Previously reviewed'),currentPreview,premiseEl('p','Saving records this reviewed wording as a new version. Earlier wording and challenges remain saved.','field-help'),notice);
    const submit=premiseEl('button','Use this reviewed wording','primary');submit.type='submit';submit.disabled=!current||stableJSON(current)===stableJSON(record.premise);form.append(submit);this.d.host.append(form);
    if(health.state==='unavailable')notice.append(premiseEl('p',health.label,'field-help'));
    form.onsubmit=event=>{event.preventDefault();this.save(session,{form,notice,submit,onReviewed:()=>currentPreview.replaceChildren(this.wording(session.reviewed,'Current node wording'))});};this.d.positionPopover();
  }
  async save(session,{form,notice,submit,onReviewed,onUnavailable}){
    if(this.d.saving||!session.reviewed)return;this.d.saving=true;this.d.dirty=true;this.d.host.inert=true;
    const reviewChange=(current,destination)=>{notice.replaceChildren(premiseEl('h3','Source changed — review before saving'),this.wording(session.reviewed,'Previously reviewed'),this.wording(current,'Current node wording'));
      if(stableJSON(destination)!==stableJSON(session.destination))notice.append(this.destination(session.target));
      if(current&&destination)notice.append(premiseButton('I reviewed the updated wording',()=>{session.reviewed=current;session.destination=destination;session.pending=null;notice.replaceChildren(premiseEl('p','Updated wording reviewed. Save when ready.','field-help'));submit.disabled=false;onReviewed();this.d.positionPopover();}));
    };
    try{
      const prepare=async workspace=>{
        if(session.pending){const existing=workspace.discussions.find(r=>r.id===session.pending.record.id);if(existing&&[...existing.history,existing].some(version=>stableJSON(premiseVersion(version))===stableJSON(premiseVersion(session.pending.record))))return {workspace,record:existing,reused:true};}
        const eligible=premiseChoices(workspace,session,this.d.actor(),session.old?.id).some(choice=>choice.map.id===session.selected.mapId&&choice.node.id===session.selected.nodeId);
        if(!eligible){session.pending=null;session.reviewed=null;submit.disabled=true;const message=session.old?'This position is no longer available for this conclusion. Close this review and check the source map.':'This position is no longer available for this conclusion. Choose another position from the current map section, or write a reason.';notice.replaceChildren(premiseEl('p',message,'field-help'));onUnavailable?.(workspace);throw Error(message);}
        const current=capturePremise(workspace,session.selected),destination=discussionSourceSnapshot(workspace,session.target);
        if(stableJSON(current)!==stableJSON(session.reviewed)||stableJSON(destination)!==stableJSON(session.destination)){reviewChange(current,destination);throw Error('Review the updated source before saving.');}
        if(session.old){const existing=workspace.discussions.find(r=>r.id===session.old.id);if(!existing||existing.version!==session.old.version)throw Error('This reason changed in another window. Reopen it to review the latest version.');}
        if(session.pending)return session.pending;
        const record=makeDiscussion(workspace,{...session.old,kind:'argument',action:'reason',comparisonId:session.comparisonId,target:session.target,body:session.reviewed.wording.title,premise:session.reviewed},this.d.actor(),session.old);
        session.pending={workspace:{...workspace,discussions:[...workspace.discussions.filter(r=>r.id!==record.id),record]},record};return session.pending;
      };
      const result=this.c.account?await this.c.account.commitCandidate(prepare):await prepare(this.c.workspace);
      if(!this.c.account){this.c.workspace=result.workspace;this.c.markDirty();}
      this.d.dirty=false;this.d.reasoning.focusEntry(result.record);this.c.library.render();this.c.renderComparison();this.d.saving=false;this.d.open(result.record.id);
    }catch(error){if(error.status===409)session.pending=null;let alert=form.querySelector('[role="alert"]');if(!alert){alert=premiseEl('p');alert.setAttribute('role','alert');form.append(alert);}alert.textContent=error.message+' Your selection is still here.';}
    finally{this.d.saving=false;this.d.host.inert=false;this.c.status();this.d.positionPopover();}
  }
}
