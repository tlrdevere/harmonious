import {interactionActions,interactionOptions,optionsForClassification,interactionMode,interactionLabel,interactionReferenceChoices} from './interaction-grammar.mjs';
import {makeDiscussion,discussionSource,discussionTargetLabel,discussionSourceSnapshot,discussionHealth} from './discussion.mjs';
import {conversationAnchor} from './conversation-tree.mjs';
import {validateWorkspace} from './workspace.mjs';
import {synchronizeIdeas} from './adoption.mjs';
import {stableJSON} from './account-model.mjs';
import {InteractionApplicationUI} from './interaction-application-ui.mjs';
import {interactionPresentation,conversationThreads} from './interaction-presentation.mjs';

const interactionEl=(tag,text='',cls='')=>{const e=document.createElement(tag);e.textContent=text;e.className=cls;return e;};
const interactionButton=(text,run,cls='')=>{const e=interactionEl('button',text,cls);e.type='button';e.onclick=run;return e;};
const interactionField=(host,text,input,id)=>{input.id=id;const label=interactionEl('label',text);label.htmlFor=id;host.append(label,input);return input;};
const interactionParentLabels={status:'Status Quo',action:'Transformative Action',goal:'Goal State'};

export class InteractionUI{
  constructor(d){this.d=d;this.c=d.c;this.application=new InteractionApplicationUI(this);}
  sourceActions(){
    const d=this.d,ws=this.c.workspace,target=d.target,source=discussionSource(ws,target);
    d.shell(discussionTargetLabel(ws,target));
    if(!source){d.host.append(interactionEl('p','Select a node or connection.'));return;}
    const own=source.map.ownerId===d.actor(),ordinary=target.type==='edge'||source.item.parent!==null;
    d.host.append(interactionEl('p',d.name(source.map.ownerId),'discussion-byline'));
    const wording=[source.item.summary,source.item.details,source.item.note].filter(Boolean).join('\n');
    if(wording){const details=interactionEl('details');details.append(interactionEl('summary','Read source'),interactionEl('p',wording,'discussion-body'));d.host.append(details);}
    if(source.item.sourceTitle||source.item.sourceUrl){const citation=interactionEl('p',source.item.sourceTitle||'Source','field-help');if(source.item.sourceUrl){const a=interactionEl('a','Open source');a.href=source.item.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';citation.append(' · ',a);}d.host.append(citation);}
    if(ordinary&&!own){
      const actions=interactionActions(d.mode()).filter(action=>action.id!=='dispute'||interactionOptions(ws,target,'dispute').length>0);
      d.actionGroup({compare:'Your position',inquiry:'Ask or offer',argument:'Critique'}[d.mode()],actions.map(action=>interactionButton(action.label,()=>this.compose(action.id))));
      if(d.mode()==='argument'&&!actions.length)d.host.append(interactionEl('p','This is an organizational connection. Select a node or a typed reasoning connection to dispute.','field-help'));
    }
    if(own&&target.type==='node'&&ordinary){
      const actions=[interactionButton('Edit in my map',()=>{if(d.canLeave())this.c.library.openMap(source.map.id,source.item.id);})];
      if(source.item.kind==='position')actions.push(interactionButton('My confidence',()=>d.confidence()));
      d.actionGroup('Your node',actions);
    }
    const context=(ws.discussions||[]).find(r=>r.kind==='context'&&r.status==='active'&&stableJSON(r.target)===stableJSON(target));
    const definitions=[];if(context)definitions.push(interactionButton('View definitions & standards',()=>d.openContexts(target)));if(own&&ordinary)definitions.push(interactionButton('Use definitions & standards',()=>this.c.library.definitions.choose(target)));d.actionGroup('Meaning',definitions);
    if(d.mode()==='compare'&&target.type==='node'&&ordinary){
      const buttons=[interactionButton('Find or view counterpart',()=>d.counterparts.show(target))];
      if(own&&!d.counterparts.links(target).length)buttons.push(interactionButton('Request counterpart',()=>{const request=d.counterparts.requests(target).at(-1);if(request)d.open(request.id);else d.compose('counterpart','counterpart');}));
      d.actionGroup('Counterparts',buttons);
    }
    const attached=conversationThreads(d.allEntries(),{mode:d.mode()}).filter(r=>stableJSON(conversationAnchor(ws.discussions,r))===stableJSON(target));
    if(attached.length)d.host.append(interactionButton(`View ${attached.length} attached ${attached.length===1?'interaction':'interactions'}`,()=>this.list(target),'discussion-text-action'));
    d.positionPopover();
  }
  compose(action,old=null){
    const d=this.d;if(!d.canLeave())return;
    const target=old?.target||d.target,ws=this.c.workspace,parent=target.type==='entry'?ws.discussions.find(r=>r.id===target.entryId):null;
    const mode=old?interactionMode(old):action==='respond'?interactionMode(parent):d.mode();
    d.activateMode(mode);d.target=target;d.shell(old?'Edit '+interactionLabel(old):interactionLabel(action));
    const form=interactionEl('form','','interaction-form'),choices=interactionOptions(ws,target,action,parent),selected=new Set(old?.interaction.options||[]);
    if(old&&action==='dispute'&&!choices.length){d.host.append(interactionEl('p','This source no longer offers dispute choices. You can keep the saved interaction or withdraw it from its details.','review-warning'),interactionButton('Back to interaction',()=>this.open(old.id)));d.positionPopover();return;}
    const reviewed=discussionSourceSnapshot(ws,target),recordId=old?.id||'discussion-'+crypto.randomUUID(),nodeId='node-'+crypto.randomUUID();
    let stagedEdit=null,stagedDraft=null;
    form.append(interactionEl('p',`About: ${discussionTargetLabel(ws,target)}`,'discussion-target-note'));
    const previousChoices=old?optionsForClassification(old.interaction.classification,action):[],earlierChoices=[...selected].filter(id=>!choices.some(option=>option.id===id)).map(id=>previousChoices.find(option=>option.id===id)||{id,label:id.replaceAll('_',' ')});
    const groups=new Map();if(earlierChoices.length){form.append(interactionEl('p','The source changed since this interaction was saved. Clear the earlier choices below before saving an updated interaction. The previous version keeps its original choices.','review-warning'));groups.set('Earlier choices',earlierChoices);}
    for(const option of choices){const group=option.group||'Options';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(option);}
    const other=interactionEl('textarea');other.rows=3;other.maxLength=10000;other.value=old?.interaction.otherText||'';const otherWrap=interactionEl('div');interactionField(otherWrap,'Other',other,'interaction-other');
    const syncOther=()=>{otherWrap.hidden=!selected.has('other');d.positionPopover();};
    for(const [name,options]of groups){const fieldset=interactionEl('fieldset','','interaction-options');fieldset.append(interactionEl('legend',name));
      for(const option of options){const label=interactionEl('label','','interaction-choice'),control=interactionEl('input');control.type=action==='respond'?'radio':'checkbox';control.name='interaction-option';control.value=option.id;control.checked=selected.has(option.id);const text=interactionEl('span');text.append(interactionEl('span',option.label));if(option.helper)text.append(interactionEl('small',option.helper,'field-help'));label.append(control,text);fieldset.append(label);control.onchange=()=>{if(action==='respond')selected.clear();control.checked?selected.add(option.id):selected.delete(option.id);d.dirty=true;syncOther();};}
      form.append(fieldset);
    }
    form.append(otherWrap);syncOther();
    const comment=interactionEl('textarea');comment.rows=3;comment.maxLength=10000;comment.value=old?.body||'';interactionField(form,action==='propose_alternative'?'Proposed wording or comment (optional)':'Comment (optional)',comment,'interaction-comment');
    const refs=interactionReferenceChoices(ws,d.thread()?.id),reference=interactionEl('select');reference.append(new Option('No node reference',''));
    for(const r of refs)reference.append(new Option(`${r.mapName} · ${r.label}`,JSON.stringify(r.target)));
    reference.append(new Option('Create a node in my map…','new'));
    const oldReference=old?.interaction.reference?.target;if(oldReference)reference.value=JSON.stringify(oldReference);
    const referenceWrap=interactionEl('details','','interaction-reference');referenceWrap.append(interactionEl('summary','Point to a node (optional)'));interactionField(referenceWrap,'One node both people can access',reference,'interaction-reference');
    const newFields=interactionEl('div'),mapSelect=interactionEl('select'),frameSelect=interactionEl('select'),nodeTitle=interactionEl('input');nodeTitle.maxLength=200;
    const availableMaps=ws.maps.filter(m=>!m.unavailable&&m.ownerId===d.actor()&&m.visibility==='shared');for(const m of availableMaps)mapSelect.append(new Option(m.name,m.id));
    const preferred=availableMaps.find(m=>[d.thread()?.aMapId,d.thread()?.bMapId].includes(m.id));if(preferred)mapSelect.value=preferred.id;
    for(const [id,label]of Object.entries(interactionParentLabels))frameSelect.append(new Option(label,id));
    interactionField(newFields,'Your shared map',mapSelect,'interaction-new-map');interactionField(newFields,'Frame',frameSelect,'interaction-new-frame');interactionField(newFields,'New node',nodeTitle,'interaction-new-title');
    newFields.append(interactionEl('p','Saving creates this node in your map and references it here.','field-help'));referenceWrap.append(newFields);form.append(referenceWrap);
    const syncReference=()=>{newFields.hidden=reference.value!=='new';nodeTitle.required=!newFields.hidden;mapSelect.required=!newFields.hidden;d.positionPopover();};reference.onchange=()=>{d.dirty=true;syncReference();};syncReference();if(oldReference)referenceWrap.open=true;
    const submit=interactionEl('button',old?'Save changes':action==='respond'?'Send response':mode==='compare'?'Record position':'Send '+(action==='dispute'?'dispute':action==='offer_reason'?'offer':action==='propose_alternative'?'proposal':'request'),'primary');submit.type='submit';form.append(submit);d.host.append(form);
    form.onsubmit=async e=>{e.preventDefault();if(d.saving)return;if(earlierChoices.some(option=>selected.has(option.id))){this.error(form,'Clear the earlier choices that are no longer offered for this source before saving.');d.positionPopover();return;}d.saving=true;d.dirty=true;d.host.inert=true;
      try{
        if(!this.c.editor.flushDraft())throw Error('Finish your map edit first.');this.c.captureActive();
        const thread=await this.c.ensureComparison(),input={id:recordId,kind:'interaction',action,target,comparisonId:thread.id,body:comment.value,interaction:{mode,options:[...selected],otherText:other.value,reference:reference.value&&reference.value!=='new'?JSON.parse(reference.value):null}};
        const draft=stableJSON({input,newNode:reference.value==='new'?{mapId:mapSelect.value,frame:frameSelect.value,title:nodeTitle.value}:null});
        const prepare=workspace=>{
          const already=workspace.discussions.find(r=>r.id===recordId);
          if(!old&&already)return {workspace,record:already};
          if(old&&stableJSON(already)!==stableJSON(old)){
            if(stagedEdit&&stableJSON(already)===stableJSON(stagedEdit)){
              if(draft===stagedDraft)return {workspace,record:already};
              throw Error('Your earlier edit was saved, but this draft has further changes. Your draft is still here. Copy it before closing and reopening the saved interaction.');
            }
            throw Error('This interaction was edited in another session. Your draft is still here. Copy it before closing and reopening the latest interaction.');
          }
          if(stableJSON(discussionSourceSnapshot(workspace,target))!==stableJSON(reviewed))throw Error('The source changed. Close this form and review it before sending. Your draft is still here.');
          if(input.interaction.reference&&stableJSON(discussionSourceSnapshot(ws,input.interaction.reference))!==stableJSON(discussionSourceSnapshot(workspace,input.interaction.reference)))throw Error('The referenced node changed. Reopen it before sending. Your draft is still here.');
          const candidate=structuredClone(workspace);
          if(reference.value==='new'){
            const map=candidate.maps.find(m=>m.id===mapSelect.value&&m.ownerId===d.actor()&&m.visibility==='shared'&&!m.unavailable);if(!map)throw Error('Choose one of your shared maps.');
            const title=nodeTitle.value.trim();if(!title)throw Error('Enter a title for the node you want to add.');
            map.nodes.push({id:nodeId,parent:frameSelect.value,title,summary:'',details:'',kind:'position',structuralType:'nesting',timeScope:'present',sourceTitle:'',sourceUrl:'',confidence:null});map.revision++;map.updatedAt=new Date().toISOString();synchronizeIdeas(candidate,map);input.interaction.reference={type:'node',mapId:map.id,nodeId};
          }
          const record=makeDiscussion(candidate,input,d.actor(),old);candidate.discussions=candidate.discussions.filter(r=>r.id!==record.id);candidate.discussions.push(record);validateWorkspace(candidate);if(old){stagedEdit=structuredClone(record);stagedDraft=draft;}return {workspace:candidate,record};
        };
        const result=this.c.account?await this.c.account.commitCandidate(prepare):prepare(this.c.workspace);
        if(!this.c.account){this.c.workspace=result.workspace;this.c.markDirty();if(this.c.activeMapId)this.c.loadMap(this.c.activeMapId);}
        d.dirty=false;d.saving=false;this.c.library.render();this.c.renderComparison();this.open(result.record.id);
      }catch(error){this.error(form,error.message);}finally{d.saving=false;d.host.inert=false;this.c.status();d.positionPopover();}
    };d.positionPopover();
  }
  error(host,message){let alert=host.querySelector('[role=alert]');if(!alert){alert=interactionEl('p');alert.setAttribute('role','alert');host.append(alert);}alert.textContent=message;}
  open(id,{selectedResponse=null}={}){
    const d=this.d;if(!d.canLeave())return;const r=this.c.workspace.discussions.find(r=>r.id===id);if(!r)return;
    d.activateMode(interactionMode(r));d.target={type:'entry',entryId:id};d.shell(interactionPresentation(this.c.workspace,r).label);d.viewId=id;
    d.host.append(interactionEl('p',`${d.name(r.authorId)} · ${r.targetLabel}`,'discussion-byline'));
    const parent=r.target.type==='entry'?this.c.workspace.discussions.find(p=>p.id===r.target.entryId):null;
    const choices=optionsForClassification(r.interaction.classification,r.action),labels=new Map(choices.map(o=>[o.id,o.label]));
    for(const option of r.interaction.options)d.host.append(interactionEl('p',labels.get(option)||option.replaceAll('_',' '),'interaction-selected'));
    if(r.interaction.otherText)d.host.append(interactionEl('p',r.interaction.otherText,'discussion-body'));if(r.body)d.host.append(interactionEl('p',r.body,'discussion-body'));
    if(r.interaction.reference){const ref=r.interaction.reference,accessible=interactionReferenceChoices(this.c.workspace,r.comparisonId).some(choice=>stableJSON(choice.target)===stableJSON(ref.target));const box=interactionEl('section','','interaction-reference-preview');box.append(interactionEl('strong','Referenced node'));if(accessible)box.append(interactionEl('p',ref.snapshot.label),interactionButton('Show referenced node',()=>{if(d.canLeave())this.c.library.openSource(ref.target.mapId,ref.target.nodeId);}));else box.append(interactionEl('p','Reference no longer available','field-help'));d.host.append(box);}
    const health=discussionHealth(this.c.workspace,r);if(['changed','unavailable'].includes(health.state))d.host.append(interactionEl('p',health.label,'review-warning'));
    if(r.status==='active'&&r.action!=='respond'&&['request_reason','request_explanation','propose_alternative','offer_reason','dispute'].includes(r.action)&&r.interaction.recipientId===d.actor())d.actionGroup('Your response',[interactionButton('Respond',()=>this.compose('respond'))]);
    if(r.status==='withdrawn')d.host.append(interactionEl('p','Withdrawn','discussion-state'));
    const replies=d.allEntries().filter(reply=>reply.kind==='interaction'&&reply.action==='respond'&&reply.target.entryId===id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
    if(replies.length){d.host.append(interactionEl('h3','Responses'));for(const reply of replies){const row=this.row(reply);if(reply.id===selectedResponse){row.setAttribute('aria-current','true');row.dataset.selectedResponse=reply.id;}d.host.append(row);}}
    if(parent)d.host.append(interactionButton('Back to '+interactionPresentation(this.c.workspace,parent).label,()=>d.revealInteraction(parent.id),'discussion-text-action'));
    this.application.actions(r);
    if(r.status==='active'&&r.authorId===d.actor())d.actionGroup('Manage',[interactionButton('Edit',()=>this.compose(r.action,r)),interactionButton('Withdraw',()=>{if(confirm('Withdraw this interaction?'))d.save({...r,status:'withdrawn'},r);})]);
    d.draw();d.positionPopover();if(selectedResponse)d.host.querySelector('[data-selected-response]')?.focus({preventScroll:true});
  }
  row(r){const d=this.d,p=interactionPresentation(this.c.workspace,r,{authorName:id=>d.name(id)}),button=interactionButton('',()=>d.revealInteraction(r.id),'discussion-list-item');button.dataset.entry=r.id;button.append(interactionEl('strong',`${p.label} · ${d.name(r.authorId)}${r.status==='withdrawn'?' · Withdrawn':''}`),interactionEl('small',r.targetLabel),interactionEl('p',p.preview));return button;}
  list(target=null,records=null,{category=null,history=false}={}){
    const d=this.d;if(!d.canLeave())return;d.target=target;d.shell({compare:'Compare interactions',inquiry:'Inquiry interactions',argument:'Argument interactions'}[d.mode()]);
    d.groupTarget=target;d.groupCategory=category;
    const allowed=records&&new Set(records.map(r=>r.id)),matches=r=>(!allowed||allowed.has(r.id))&&(!target||records||stableJSON(conversationAnchor(d.allEntries(),r))===stableJSON(target))&&(!category||d.attachmentCategory(r)===category);
    const entries=conversationThreads(d.allEntries(),{mode:d.mode(),history}).filter(matches);
    if(history)d.host.append(interactionEl('h3','Withdrawn interactions'));
    if(!entries.length)d.host.append(interactionEl('p',history?'No withdrawn interactions.':'No interactions here yet. Select another person’s node or connection to begin.'));for(const r of entries)d.host.append(this.row(r));
    if(!records){const earlier=conversationThreads(d.allEntries(),{mode:d.mode(),history:!history}).filter(matches);if(earlier.length||history)d.host.append(interactionButton(history?'Back to active interactions':'Withdrawn interactions',()=>this.list(target,null,{category,history:!history}),'discussion-text-action'));}
    d.draw();d.positionPopover();
  }
}
