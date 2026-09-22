import {isReflection,isDisagreementPoint,isReflectionOutcome,REFLECTION_CATEGORIES,REFLECTION_RESULTS,canMarkDisagreement,reflectionOutcomes} from './reflection.mjs';
import {makeDiscussion,discussionSource,discussionSourceSnapshot,discussionTargetLabel,discussionHealth} from './discussion.mjs';
import {revealPath} from './model.mjs';
import {stableJSON} from './account-model.mjs';

const reflectionEl=(tag,text='',cls='')=>{const e=document.createElement(tag);e.textContent=text;e.className=cls;return e;};
const reflectionButton=(label,run,cls='')=>{const e=reflectionEl('button',label,cls);e.type='button';e.onclick=run;return e;};
const reflectionVersion=r=>{const {history,...version}=r;return version;};

export class ReflectionUI{
  constructor(d){this.d=d;this.c=d.c;}
  point(record){return isDisagreementPoint(record)?record:this.c.workspace.discussions.find(r=>r.id===record.target.entryId&&isDisagreementPoint(r));}
  target(record){return this.point(record)?.target;}
  points(target){return this.d.entries().filter(r=>isDisagreementPoint(r)&&stableJSON(r.target)===stableJSON(target));}
  label(target){const r=target?.entryId&&this.c.workspace.discussions.find(r=>r.id===target.entryId);return target?.type==='inference'?`Reasoning connection: ${r?.body||'Unavailable reason'}`:r?.body||discussionTargetLabel(this.c.workspace,target);}
  sourcePreview(snapshot,depth=0){
    const section=reflectionEl('section');if(!snapshot||depth>3){section.append(reflectionEl('p','Unavailable source'));return section;}
    const w=snapshot.wording||{};section.append(reflectionEl('strong',snapshot.label||'Attached source'));
    for(const key of ['reason','conclusion'])if(w[key])section.append(reflectionEl('h4',key==='reason'?'Reason':'Conclusion'),this.sourcePreview(w[key],depth+1));
    const appendWording=value=>{
      const text=[value.title,value.body,value.summary,value.details].filter(Boolean).join('\n');if(text)section.append(reflectionEl('p',text,'discussion-body'));
      for(const [key,label]of [['kind','Type'],['timeScope','Time scope'],['sourceTitle','Source']])if(value[key])section.append(reflectionEl('p',`${label}: ${value[key]}`));
      for(const url of new Set([value.referenceUrl,value.sourceUrl].filter(Boolean))){const line=reflectionEl('p');if(/^https?:\/\//i.test(url)){const link=reflectionEl('a',url);link.href=url;link.target='_blank';link.rel='noopener noreferrer';line.append(link);}else line.textContent=url;section.append(line);}
    };
    appendWording(w);for(const endpoint of [w.from,w.to].filter(Boolean))appendWording(endpoint);
    if(w.premise)section.append(this.d.premises.wording(w.premise,'Used position'));
    if(w.reflection?.category)section.append(reflectionEl('p',REFLECTION_CATEGORIES[w.reflection.category]));
    for(const def of snapshot.definitions||[])section.append(reflectionEl('p',`Definitions / standards: ${def.title||''} ${def.body}`,'discussion-body'));return section;
  }
  group(record){
    const section=reflectionEl('section','','reflection-conversation');section.dataset.point=record.id;section.append(this.row(record));
    const outcomes=reflectionOutcomes(this.c.workspace,record.id),thread=this.d.thread();
    for(const authorId of [...new Set([thread?.aMapId,thread?.bMapId].map(id=>this.c.workspace.maps.find(m=>m.id===id)?.ownerId).filter(Boolean))]){
      const outcome=outcomes.find(r=>r.authorId===authorId),assessment=reflectionEl('div','','reflection-assessment');
      if(outcome){assessment.append(this.row(outcome));if(outcome.reflection.nextStep)assessment.append(reflectionEl('p',`Next step: ${outcome.reflection.nextStep}`,'discussion-body'));}
      else assessment.append(reflectionEl('p',`${this.d.name(authorId)} · No assessment recorded`,'field-help'));
      section.append(assessment);
    }
    return section;
  }
  marker(target,points=this.points(target)){
    if(this.d.mode()!=='argument'||!points.length)return null;
    const button=reflectionButton(`${points.length} ${points.length===1?'point':'points'}`,()=>this.list(target,points),'reflection-marker');button.setAttribute('aria-label',`${points.length} points of disagreement attached to ${this.label(target)}`);return button;
  }
  row(record){const row=reflectionButton('',()=>this.open(record),'reflection-item discussion-list-item');row.dataset.entry=record.id;row.append(reflectionEl('strong',`${isDisagreementPoint(record)?'Point of disagreement':'Outcome'} · ${this.d.name(record.authorId)}`),reflectionEl('p',record.body,'discussion-body'));if(isDisagreementPoint(record)){row.append(reflectionEl('small',`Addresses: ${this.label(record.target)}`));const outcomes=reflectionOutcomes(this.c.workspace,record.id);if(outcomes.length)row.append(reflectionEl('small',outcomes.map(r=>`${this.d.name(r.authorId)}: ${r.reflection.result?REFLECTION_RESULTS[r.reflection.result]:'Outcome recorded'}`).join(' · ')));}else if(record.reflection.result)row.append(reflectionEl('small',REFLECTION_RESULTS[record.reflection.result]));return row;}
  attach(target){
    if(this.d.mode()!=='argument')return;const points=this.points(target),allowed=canMarkDisagreement(this.c.workspace,target,this.d.thread()?.id);if(!allowed&&!points.length)return;
    const section=reflectionEl('section','','reflection-attachments');section.append(reflectionEl('h3','Points of disagreement'));for(const point of points)section.append(this.row(point));if(allowed)section.append(reflectionButton('Mark point of disagreement',()=>this.compose(target)));this.d.host.append(section);
  }
  list(target,points=this.points(target)){
    if(!this.d.canLeave())return;this.d.activateMode('argument');this.d.target=target;this.d.shell('Points of disagreement');this.d.host.append(reflectionEl('p','Each point is the assessment of the person who recorded it.','field-help'));for(const point of this.d.recentConversations(points))this.d.host.append(this.row(point));if(canMarkDisagreement(this.c.workspace,target,this.d.thread()?.id))this.d.host.append(reflectionButton('Mark point of disagreement',()=>this.compose(target)));this.d.positionPopover();
  }
  focus(record,{pan=false}={}){
    const target=this.target(record);if(!target)return;const reasoning=this.d.reasoning;reasoning.activateScope();reasoning.anchor=reasoning.anchorFor(target);reasoning.focusId=target.entryId||null;reasoning.returnId=target.entryId||null;reasoning.revealFocus=!!target.entryId;reasoning.mode='argument';reasoning.sync();this.d.draw();
    if(pan){const p=this.d.point(target);if(p){const canvas=this.d.canvas;canvas.camera={...canvas.camera,x:canvas.surface.clientWidth/2-p.x*canvas.camera.z,y:canvas.surface.clientHeight/2-p.y*canvas.camera.z};canvas.drawCamera();}}
  }
  reveal(record){
    if(!this.d.canLeave())return;const target=this.target(record),canvas=this.d.canvas;
    if(target?.type==='node'||target?.type==='edge'){
      const side=['a','b'].find(side=>this.c.sides[side].mapId===target.mapId),source=discussionSource(this.c.workspace,target);
      if(side&&source){const state=canvas.states[side],ids=target.type==='node'?[target.nodeId]:[source.item.from,source.item.to];for(const id of ids)state.expanded=revealPath(state.map.nodes,id,state.expanded);state.frame='all';document.getElementById(`compare-frame-${side}`).value='all';canvas.reflow({animate:false});}
    }
    this.d.reasoning.closeSearch(false);this.focus(record,{pan:true});this.open(record);
  }
  metadata(record,host){if(isDisagreementPoint(record)&&record.reflection.category)host.append(reflectionEl('p',REFLECTION_CATEGORIES[record.reflection.category],'discussion-byline'));if(isReflectionOutcome(record)){if(record.reflection.result)host.append(reflectionEl('p',REFLECTION_RESULTS[record.reflection.result],'discussion-state'));if(record.reflection.nextStep)host.append(reflectionEl('h3','Next step'),reflectionEl('p',record.reflection.nextStep,'discussion-body'));}}
  open(record){
    if(!this.d.canLeave())return;record=this.c.workspace.discussions.find(r=>r.id===record.id)||record;this.d.activateMode('argument');this.d.target={type:'entry',entryId:record.id};this.d.shell(isDisagreementPoint(record)?'Point of disagreement':'Individual outcome');this.d.viewId=record.id;this.focus(record);
    const point=this.point(record),target=point?.target;this.d.host.append(reflectionEl('p',`Recorded by ${this.d.name(record.authorId)}${record.status==='withdrawn'?' · Withdrawn':''}`,'discussion-byline'),reflectionEl('p',record.body,'discussion-body'));this.metadata(record,this.d.host);
    if(target)this.d.host.append(reflectionButton(`Addresses: ${this.label(target)}`,()=>target.type==='entry'?this.d.open(target.entryId):this.d.selectTarget(target),'discussion-parent-link'));
    if(isReflectionOutcome(record)&&point)this.d.host.append(reflectionButton('Back to point of disagreement',()=>this.open(point)));
    const health=discussionHealth(this.c.workspace,record);if(['changed','unavailable'].includes(health.state))this.d.host.append(reflectionEl('p',health.label,'review-warning'));this.d.sourceHistory(record,health);
    if(isDisagreementPoint(record)){
      const outcomes=reflectionOutcomes(this.c.workspace,record.id);this.d.host.append(reflectionEl('h3','Individual outcomes'),reflectionEl('p','Each person records their own assessment. These notes do not change either map or resolve a challenge.','field-help'));for(const outcome of outcomes)this.d.host.append(this.row(outcome));
      if(record.status==='active'&&health.state!=='unavailable'){const own=outcomes.find(r=>r.authorId===this.d.actor());this.d.host.append(reflectionButton(own?'Edit my outcome':'Record my outcome',()=>this.compose({type:'entry',entryId:record.id},own,true)));}
    }
    const withdrawal={target:record.target,old:record,comparisonId:record.comparisonId,reviewed:discussionSourceSnapshot(this.c.workspace,record.target),pending:null};
    if(record.authorId===this.d.actor()&&record.status==='active')this.d.actionGroup('Manage',[reflectionButton('Edit',()=>this.compose(record.target,record,isReflectionOutcome(record))),reflectionButton('Withdraw',()=>{if(confirm('Withdraw your annotation? Its history will remain saved.'))this.save(withdrawal,()=>({...record,status:'withdrawn'}),this.d.host);})]);
    if(record.history.length){const history=reflectionEl('details');history.append(reflectionEl('summary','Earlier wording'));for(const version of record.history){const section=reflectionEl('section','','reflection-history');section.append(reflectionEl('p',version.body,'discussion-body'));this.metadata(version,section);history.append(section);}this.d.host.append(history);}this.d.positionPopover();
  }
  compose(target,old=null,outcome=false){
    if(!this.d.canLeave())return;this.d.activateMode('argument');this.d.target=target;this.d.editingContributionId=old?.id||null;this.d.shell(old?'Edit '+(outcome?'my outcome':'point of disagreement'):outcome?'Record my outcome':'Mark point of disagreement');
    const form=reflectionEl('form','','reflection-form'),targetNote=reflectionEl('p',`Addresses: ${this.label(target)}`,'discussion-target-note'),label=reflectionEl('label',outcome?'Your assessment':'Where do you think the disagreement lies?'),body=reflectionEl('textarea');body.id='reflection-body';label.htmlFor=body.id;body.rows=4;body.required=true;body.maxLength=10000;body.value=old?.body||'';form.append(targetNote,label,body);
    const details=reflectionEl('details'),summary=reflectionEl('summary',outcome?'Outcome (optional)':'Type of disagreement (optional)'),select=reflectionEl('select');select.id='reflection-category';select.setAttribute('aria-label',outcome?'Outcome':'Type of disagreement');for(const [value,text]of Object.entries(outcome?REFLECTION_RESULTS:REFLECTION_CATEGORIES)){const option=reflectionEl('option',text);option.value=value;select.append(option);}select.value=old?.reflection?.[outcome?'result':'category']||'';details.append(summary,select);form.append(details);
    const next=reflectionEl('textarea');if(outcome){const nextLabel=reflectionEl('label','Next step (optional)');next.id='reflection-next-step';nextLabel.htmlFor=next.id;next.rows=2;next.maxLength=2000;next.value=old?.reflection.nextStep||'';form.append(nextLabel,next);}
    const notice=reflectionEl('section','','reflection-notice'),submit=reflectionEl('button',old?'Save changes':outcome?'Save my outcome':'Save point','primary');submit.type='submit';form.append(notice,submit);this.d.host.append(form);
    const session={target,old,comparisonId:this.d.thread()?.id,reviewed:old?.reviewedSources?.[0]||old?.sourceSnapshots?.[0]||discussionSourceSnapshot(this.c.workspace,target),pending:null};form.onsubmit=e=>{e.preventDefault();this.save(session,()=>({kind:'reflection',action:outcome?'outcome':'disagreement_point',layer:'arguments',target,body:body.value,reflection:outcome?{result:select.value,nextStep:next.value}:{category:select.value}}),form,{notice,submit});};this.d.draw();this.d.positionPopover();body.focus({preventScroll:true});
  }
  async save(session,inputFor,form,{notice=form,submit=null}={}){
    if(this.d.saving)return;this.d.saving=true;this.d.dirty=true;this.d.host.inert=true;
    try{
      session.comparisonId||=(this.d.thread()||await this.c.ensureComparison()).id;
      const input={...inputFor(),...(session.reviewAccepted?{reviewSources:true}:{})},prepare=workspace=>{
        let old=session.old;
        if(session.pending){const saved=workspace.discussions.find(r=>r.id===session.pending.record.id),found=saved&&[...saved.history,saved].some(v=>stableJSON(reflectionVersion(v))===stableJSON(reflectionVersion(session.pending.record)));if(found){if(stableJSON(input)===session.pending.input)return {workspace,record:saved,reused:true};old=saved;session.old=saved;session.pending=null;}else return session.pending;}
        if(!old&&session.identity){const saved=workspace.discussions.find(r=>r.id===session.identity);if(saved){old=saved;session.old=saved;}}
        const current=discussionSourceSnapshot(workspace,session.target);
        if(input.status!=='withdrawn'&&(!current||discussionHealth(workspace,{...input,sourceSnapshots:[current]}).state==='unavailable')){if(submit)submit.disabled=true;throw Error('This source is no longer available. Close this draft and check its source.');}
        if(input.status!=='withdrawn'&&stableJSON(current)!==stableJSON(session.reviewed)){const prompt=reflectionEl('section','','reflection-source-review');prompt.append(reflectionEl('h3','Source changed — review before saving'),reflectionEl('h4','Previously reviewed'),this.sourcePreview(session.reviewed),reflectionEl('h4','Current source'),this.sourcePreview(current));prompt.append(reflectionButton('I reviewed the updated source',()=>{session.reviewed=current;session.reviewAccepted=true;session.pending=null;prompt.remove();if(submit)submit.disabled=false;this.d.positionPopover();}));notice.querySelector('.reflection-source-review')?.remove();notice.append(prompt);if(submit)submit.disabled=true;throw Error('Review the current source before saving.');}
        if(old){const fresh=workspace.discussions.find(r=>r.id===old.id);if(!fresh||fresh.version!==old.version)throw Error('This annotation changed in another window. Reopen it before editing.');}
        if(session.pending&&session.pending.input===stableJSON(input))return session.pending;
        const record=makeDiscussion(workspace,{...old,...input,comparisonId:session.comparisonId},this.d.actor(),old);if(!old){session.identity||=record.id;record.id=session.identity;}session.pending={workspace:{...workspace,discussions:[...workspace.discussions.filter(r=>r.id!==record.id),record]},record,input:stableJSON(input)};return session.pending;
      };
      const commit=async()=>{const result=this.c.account?await this.c.account.commitCandidate(prepare):await prepare(this.c.workspace);if(!this.c.account){this.c.workspace=result.workspace;this.c.markDirty();}return result;};
      let result=await commit();if(result.input&&result.input!==stableJSON(input)){session.old=result.record;session.pending=null;result=await commit();}
      this.d.dirty=false;this.d.saving=false;this.c.library.render();this.c.renderComparison();this.open(result.record);
    }catch(error){if([400,403,409].includes(error.status))session.pending=null;let alert=form.querySelector('[role=alert]');if(!alert){alert=reflectionEl('p');alert.setAttribute('role','alert');form.append(alert);}alert.textContent=error.message+' Your draft is still here.';}
    finally{this.d.saving=false;this.d.host.inert=false;this.c.status();this.d.positionPopover();}
  }
}

