import {interactionActions,interactionOptions,optionsForClassification,interactionMode,interactionLabel,interactionReferenceChoices,canReplyArgument} from './interaction-grammar.mjs';
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
    if(d.mode()==='argument'&&target.type==='node'){if(ordinary&&!d.dialogue?.active)d.host.append(interactionButton('Open argument canvas',()=>d.dialogue.open(target),'primary'));this.argumentLog();}
    const wording=[source.item.summary,source.item.details,source.item.note].filter(Boolean).join('\n');
    if(wording)d.host.append(interactionEl('p',wording,'discussion-body source-wording'));
    if(source.item.sourceTitle||source.item.sourceUrl){const citation=interactionEl('p',source.item.sourceTitle||'Source','field-help');if(source.item.sourceUrl){const a=interactionEl('a','Open source');a.href=source.item.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';citation.append(' · ',a);}d.host.append(citation);}
    if(ordinary&&!own){
      const actions=interactionActions(d.mode()).filter(action=>action.id!=='dispute'||interactionOptions(ws,target,'dispute').length>0);
      d.actionGroup({compare:'Your position',inquiry:'Ask or offer',argument:'Critique'}[d.mode()],actions.map(action=>interactionButton(action.label,()=>this.compose(action.id))));
      if(d.mode()==='argument'&&!actions.length)d.host.append(interactionEl('p','This is an organizational connection. Select a node or a typed reasoning connection to dispute.','field-help'));
    }
    if(own&&target.type==='node'&&ordinary){
      const actions=[interactionButton('Edit in my map',()=>{if(d.canLeave())this.c.library.openMap(source.map.id,source.item.id);})];
      d.actionGroup('Your node',actions);
    }
    if(target.type==='node'&&source?.map.nodes.find(n=>n.id===source.item.parent)?.parent===null)d.actionGroup('View',[interactionButton('Focus this branch',()=>{if(d.canLeave())d.canvas.topicFocus.focus(source.map.id,source.item.id);})]);
    const context=(ws.discussions||[]).find(r=>r.kind==='context'&&r.status==='active'&&stableJSON(r.target)===stableJSON(target));
    const definitions=[];if(own&&ordinary)definitions.push(interactionButton('Philosophy',()=>{if(d.canLeave())this.c.library.definitions.choose(target);}));else if(context)definitions.push(interactionButton('Philosophy',()=>d.openContexts(target)));d.actionGroup('Foundations',definitions);
    if(d.mode()==='compare'&&target.type==='node'&&ordinary){
      d.host.append(interactionEl('p',d.counterparts.state(target).label,'field-help counterpart-state'));
      d.actionGroup('Counterparts',d.counterparts.actions(target));
    }
    const attached=conversationThreads(d.allEntries(),{mode:d.mode()}).filter(r=>stableJSON(conversationAnchor(ws.discussions,r))===stableJSON(target));
    const remaining=attached.filter(r=>!(d.mode()==='argument'&&target.type==='node'&&r.kind==='interaction'&&r.action==='dispute'));
    if(remaining.length)d.host.append(interactionButton(`View ${remaining.length} attached ${remaining.length===1?'interaction':'interactions'}`,()=>this.list(target),'discussion-text-action'));
    d.positionPopover();
  }
  responses(id){return this.d.allEntries().filter(r=>r.kind==='interaction'&&r.action==='respond'&&r.target.entryId===id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));}
  argumentLog(){
    const d=this.d,ws=this.c.workspace,section=interactionEl('section','','argument-log');
    const entries=d.recentConversations(d.allEntries().filter(r=>r.kind==='interaction'&&r.action==='dispute'&&stableJSON(r.target)===stableJSON(d.target)));
    const active=entries.filter(r=>r.status==='active'),withdrawn=entries.filter(r=>r.status==='withdrawn');
    section.append(interactionEl('h3',`Disputes (${active.length})`));
    if(discussionSource(ws,d.target)?.item.parent!==null)d.standstills.sourceControls(section,d.target);
    if(!active.length)section.append(interactionEl('p','No disputes recorded on this node yet.','field-help'));
    const render=r=>{
      const p=interactionPresentation(ws,r),replies=this.responses(r.id),current=replies.filter(reply=>reply.status==='active'),latest=current.at(-1);
      const card=interactionEl('details','','argument-log-entry'),summary=interactionEl('summary'),body=interactionEl('div','','argument-log-detail');
      card.dataset.dispute=r.id;
      summary.append(interactionEl('strong',`${d.name(r.authorId)} · ${p.choices.join(' · ')}`),interactionEl('small',new Date(r.createdAt).toLocaleString(),'argument-log-date'));
      const excerpt=text=>text.length>160?text.slice(0,157)+'…':text;
      if(r.body||r.interaction.otherText)summary.append(interactionEl('span',excerpt([r.body,r.interaction.otherText].filter(Boolean).join(' · ')),'argument-log-preview'));
      const outcome=latest?interactionPresentation(ws,latest).label:null;
      summary.append(interactionEl('span',latest?`${current.length} ${current.length===1?'response':'responses'} · Latest: ${d.name(latest.authorId)} — ${outcome}`:'No response yet','argument-log-response'));
      if(latest?.body)summary.append(interactionEl('span',excerpt(latest.body),'argument-log-preview'));
      summary.append(interactionEl('span','Details','argument-log-expand'));
      if(r.status==='withdrawn')body.append(interactionEl('p','Withdrawn dispute','discussion-state'));
      this.content(r,body);
      body.append(interactionEl('h4','Responses'));
      if(!replies.length)body.append(interactionEl('p','No response yet.','field-help'));
      for(const reply of replies){
        const response=interactionEl('section','','argument-log-reply');response.dataset.response=reply.id;
        response.append(interactionEl('strong',`${d.name(reply.authorId)}${reply.status==='withdrawn'?' · Withdrawn response':''}`),interactionEl('small',new Date(reply.createdAt).toLocaleString(),'argument-log-date'));
        this.content(reply,response);this.replyControl(reply,response,'Reply to this response');d.standstills.pointControls(response,reply);
        if(reply.authorId===d.actor()&&reply.status==='active')response.append(interactionButton('Manage response',()=>this.open(reply.id),'discussion-text-action'));
        body.append(response);
      }
      this.replyControl(r,body);d.standstills.pointControls(body,r);
      if(r.authorId===d.actor())body.append(interactionButton('Manage dispute',()=>this.open(r.id),'discussion-text-action'));
      card.append(summary,body);card.addEventListener('toggle',()=>d.positionPopover());return card;
    };
    for(const r of active)section.append(render(r));
    if(withdrawn.length){const history=interactionEl('details','','argument-log-history');history.append(interactionEl('summary',`Withdrawn disputes (${withdrawn.length})`));for(const r of withdrawn)history.append(render(r));section.append(history);}
    section.argumentSnapshot=stableJSON(ws);d.host.append(section);
  }
  refreshArgumentLog(){
    const d=this.d,old=d.host?.querySelector('.argument-log');
    if(!old||d.host.hidden||d.mode()!=='argument'||d.target?.type!=='node'||d.dirty||d.saving||d.host.querySelector('form'))return;
    if(old.argumentSnapshot===stableJSON(this.c.workspace))return;
    const open=new Set([...old.querySelectorAll('details[open][data-dispute]')].map(el=>el.dataset.dispute)),standstillOpen=new Set([...old.querySelectorAll('details[open][data-standstill-history]')].map(el=>el.dataset.standstillHistory)),historyOpen=old.querySelector('.argument-log-history')?.open;
    const focused=document.activeElement,focusId=old.contains(focused)&&focused.closest('[data-dispute]')?.dataset.dispute,responseId=focused?.closest('[data-response]')?.dataset.response,scroll=d.host.scrollTop;
    this.argumentLog();const next=d.host.querySelector('.argument-log:last-child');old.replaceWith(next);
    for(const el of next.querySelectorAll('[data-dispute]'))el.open=open.has(el.dataset.dispute);
    for(const el of next.querySelectorAll('[data-standstill-history]'))el.open=standstillOpen.has(el.dataset.standstillHistory);
    const history=next.querySelector('.argument-log-history');if(history)history.open=!!historyOpen;
    if(focusId){const card=[...next.querySelectorAll('[data-dispute]')].find(el=>el.dataset.dispute===focusId),scope=responseId?[...card?.querySelectorAll('[data-response]')||[]].find(el=>el.dataset.response===responseId):card,button=focused.matches('button')&&[...scope?.querySelectorAll('button')||[]].find(el=>el.textContent===focused.textContent);(button||card?.querySelector('summary'))?.focus({preventScroll:true});}
    d.positionPopover();d.host.scrollTop=scroll;
  }
  replyControl(record,host,label=null){
    const d=this.d,root=record.action==='respond'?this.c.workspace.discussions.find(r=>r.id===record.target.entryId):record;
    if(!canReplyArgument(root,d.actor())||record.status!=='active')return false;
    const first=root.interaction.recipientId===d.actor()&&!this.responses(root.id).length;
    host.append(interactionButton(label||(first?'Respond':'Reply'),()=>{d.target={type:'entry',entryId:root.id};this.compose(first?'respond':'reply',null,{replyTo:{entryId:record.id,version:record.version}});},'primary'));return true;
  }
  content(r,host){
    const d=this.d,ws=this.c.workspace,p=interactionPresentation(ws,r);
    if(r.interaction.replyTo){const addressed=ws.discussions.find(e=>e.id===r.interaction.replyTo.entryId);if(addressed){host.append(interactionButton('Replying to '+d.name(addressed.authorId)+' · version '+r.interaction.replyTo.version,()=>{const root=ws.discussions.find(e=>e.id===r.target.entryId);if(d.dialogue?.active){this.open(addressed.id);d.dialogue.reveal(addressed.id);}else if(root?.target.type==='node')d.dialogue.open(root.target,{entry:addressed.id});else this.open(addressed.id);},'discussion-text-action'));}}
    for(const label of p.choices)host.append(interactionEl('p',label,'interaction-selected'));
    for(const text of [r.interaction.otherText,r.body].filter(Boolean))host.append(interactionEl('p',text,'discussion-body'));
    if(r.interaction.reference){const ref=r.interaction.reference,accessible=interactionReferenceChoices(ws,r.comparisonId).some(choice=>stableJSON(choice.target)===stableJSON(ref.target));const box=interactionEl('section','','interaction-reference-preview');box.append(interactionEl('strong','Referenced node'));if(accessible)box.append(interactionEl('p',ref.snapshot.label),interactionButton('Show referenced node',()=>{if(d.canLeave())this.c.library.openSource(ref.target.mapId,ref.target.nodeId);}));else box.append(interactionEl('p','Reference no longer available','field-help'));host.append(box);}
    const health=discussionHealth(ws,r);if(['changed','unavailable'].includes(health.state))host.append(interactionEl('p',health.label,'review-warning'));
    if(r.history.length){const history=interactionEl('details','','interaction-history');history.append(interactionEl('summary','Earlier versions'));for(const revision of r.history){const section=interactionEl('section'),presentation=interactionPresentation(ws,revision);section.append(interactionEl('strong',`Version ${revision.version}`));for(const label of presentation.choices)section.append(interactionEl('p',label,'interaction-selected'));for(const text of [revision.interaction.otherText,revision.body].filter(Boolean))section.append(interactionEl('p',text,'discussion-body'));history.append(section);}host.append(history);}
  }
  compose(action,old=null,{replyTo=null,placement=undefined}={}){
    const d=this.d;if(!d.canLeave())return;
    const continuation=action==='reply'||[6,7].includes(old?.interaction.version);if(continuation)action='respond';
    const target=old?.target||d.target,ws=this.c.workspace,parent=target.type==='entry'?ws.discussions.find(r=>r.id===target.entryId):null;
    replyTo=old?.interaction.replyTo||replyTo||(continuation&&!old&&parent?{entryId:parent.id,version:parent.version}:null);
    placement=old?old.interaction.placement:placement;
    const mode=old?interactionMode(old):action==='respond'?interactionMode(parent):d.mode();
    d.activateMode(mode);d.target=target;d.shell(old?'Edit '+interactionLabel(old):continuation?'Reply':interactionLabel(action));
    const converting=action==='dispute'&&old?.interaction.version===4;
    if(replyTo){const addressed=ws.discussions.find(r=>r.id===replyTo.entryId);d.host.append(interactionEl('p',addressed?'Replying to '+d.name(addressed.authorId)+' · '+(addressed.body||interactionPresentation(ws,addressed).preview).slice(0,160):'Reply target unavailable','dialogue-reply-target'));}
    if(placement)d.host.append(interactionEl('p',`Place ${placement==='right'?'to the right':placement} of this response. Placement does not change the meaning of your reply.`,'field-help'));
    const form=interactionEl('form','','interaction-form'),choices=continuation?[]:interactionOptions(ws,target,action),selected=new Set(continuation?['reply']:converting?[]:old?.interaction.options||[]);
    if(old&&action==='dispute'&&!choices.length){d.host.append(interactionEl('p','This source no longer offers dispute choices. You can keep the saved interaction or withdraw it from its details.','review-warning'),interactionButton('Back to interaction',()=>this.open(old.id)));d.positionPopover();return;}
    const reviewed=discussionSourceSnapshot(ws,target),recordId=old?.id||'discussion-'+crypto.randomUUID(),nodeId='node-'+crypto.randomUUID();
    let stagedEdit=null,stagedDraft=null;
    form.append(interactionEl('p',`About: ${discussionTargetLabel(ws,target)}`,'discussion-target-note'));
    if(action==='dispute'&&target.type==='node'&&reviewed?.wording.summary)form.append(interactionEl('p',reviewed.wording.summary,'discussion-body disputed-node-description'));
    const previousChoices=old?optionsForClassification(old.interaction.classification,action,old.interaction.version):[],earlierChoices=continuation?[]:[...selected].filter(id=>!choices.some(option=>option.id===id)).map(id=>previousChoices.find(option=>option.id===id)||{id,label:id.replaceAll('_',' ')});
    if(converting){form.append(interactionEl('p','This argument used the earlier dispute choices. Choose one or more current categories to save an edit. Its previous wording and choices stay in history.','review-warning'),interactionEl('p','Earlier choices: '+old.interaction.options.map(id=>previousChoices.find(o=>o.id===id)?.label||id).join(' · '),'field-help'));}
    const groups=new Map();if(earlierChoices.length){form.append(interactionEl('p','The source changed since this interaction was saved. Clear the earlier choices below before saving an updated interaction. The previous version keeps its original choices.','review-warning'));groups.set('Earlier choices',earlierChoices);}
    for(const option of choices){const group=option.group||'Options';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(option);}
    const other=interactionEl('textarea');other.rows=3;other.maxLength=10000;other.value=old?.interaction.otherText||'';const otherWrap=interactionEl('div');interactionField(otherWrap,'Other',other,'interaction-other');
    const syncOther=()=>{otherWrap.hidden=!selected.has('other');d.positionPopover();};
    for(const [name,options]of groups){const fieldset=interactionEl('fieldset','','interaction-options');fieldset.append(interactionEl('legend',name));
      for(const option of options){const label=interactionEl('label','','interaction-choice'),control=interactionEl('input');control.type=action==='respond'?'radio':'checkbox';control.name='interaction-option';control.value=option.id;control.checked=selected.has(option.id);const text=interactionEl('span');text.append(interactionEl('span',option.label));if(option.helper)text.append(interactionEl('small',option.helper,'field-help'));label.append(control,text);fieldset.append(label);control.onchange=()=>{if(action==='respond')selected.clear();control.checked?selected.add(option.id):selected.delete(option.id);d.dirty=true;syncOther();};}
      form.append(fieldset);
    }
    form.append(otherWrap);syncOther();
    const comment=interactionEl('textarea');comment.rows=3;comment.maxLength=10000;comment.required=continuation;comment.value=converting?[old.body,old.interaction.otherText].filter(Boolean).join('\n\n'):old?.body||'';interactionField(form,continuation?'Reply':action==='propose_alternative'?'Proposed wording or comment (optional)':'Comment (optional)',comment,'interaction-comment');
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
    const submit=interactionEl('button',old?'Save changes':continuation?'Send reply':action==='respond'?'Send response':mode==='compare'?'Record position':'Send '+(action==='dispute'?'dispute':action==='offer_reason'?'offer':action==='propose_alternative'?'proposal':'request'),'primary');submit.type='submit';form.append(submit);d.host.append(form);
    form.onsubmit=async e=>{e.preventDefault();if(d.saving)return;if(earlierChoices.some(option=>selected.has(option.id))){this.error(form,'Clear the earlier choices that are no longer offered for this source before saving.');d.positionPopover();return;}d.saving=true;d.dirty=true;d.host.inert=true;
      try{
        if(!this.c.editor.flushDraft())throw Error('Finish your map edit first.');this.c.captureActive();
        const thread=await this.c.ensureComparison(),input={id:recordId,kind:'interaction',action,target,comparisonId:thread.id,body:comment.value,interaction:{mode,...(continuation&&replyTo?{replyTo}:{}),...(placement!==undefined?{placement}:{}),options:[...selected],otherText:other.value,reference:reference.value&&reference.value!=='new'?JSON.parse(reference.value):null}};
        const draft=stableJSON({input,newNode:reference.value==='new'?{mapId:mapSelect.value,frame:frameSelect.value,title:nodeTitle.value}:null});
        const prepare=workspace=>{
          const already=workspace.discussions.find(r=>r.id===recordId);
          if(!old&&already){if(continuation&&stagedDraft&&draft!==stagedDraft)throw Error('Your earlier reply was saved, but this draft has further changes. Your draft is still here. Copy it before closing and reopening the saved reply.');return {workspace,record:already};}
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
          const record=makeDiscussion(candidate,input,d.actor(),old);candidate.discussions=candidate.discussions.filter(r=>r.id!==record.id);candidate.discussions.push(record);validateWorkspace(candidate);if(old)stagedEdit=structuredClone(record);stagedDraft=draft;return {workspace:candidate,record};
        };
        const result=this.c.account?await this.c.account.commitCandidate(prepare):prepare(this.c.workspace);
        if(result.facilitatorDraft){d.dirty=false;d.saving=false;d.close();return;}
        if(!this.c.account){this.c.workspace=result.workspace;this.c.markDirty();if(this.c.activeMapId)this.c.loadMap(this.c.activeMapId);}
        d.dirty=false;d.saving=false;this.c.library.render();this.c.renderComparison();this.open(result.record.id);if(d.dialogue?.active){d.dialogue.refresh();d.dialogue.reveal(result.record.id);}
      }catch(error){this.error(form,error.message);}finally{d.saving=false;d.host.inert=false;this.c.status();d.positionPopover();}
    };d.positionPopover();
  }
  error(host,message){let alert=host.querySelector('[role=alert]');if(!alert){alert=interactionEl('p');alert.setAttribute('role','alert');host.append(alert);}alert.textContent=message;}
  open(id,{selectedResponse=null}={}){
    const d=this.d;if(!d.canLeave())return;const r=this.c.workspace.discussions.find(r=>r.id===id);if(!r)return;
    d.activateMode(interactionMode(r));d.target={type:'entry',entryId:id};d.shell(interactionPresentation(this.c.workspace,r).label);d.viewId=id;if(d.dialogue?.active){d.dialogue.selected=id;d.dialogue.refresh();}
    d.host.append(interactionEl('p',`${d.name(r.authorId)} · ${r.targetLabel}`,'discussion-byline'));
    const parent=r.target.type==='entry'?this.c.workspace.discussions.find(p=>p.id===r.target.entryId):null;
    this.content(r,d.host);
    const argumentReply=this.replyControl(r,d.host);
    if(r.interaction?.mode==='argument')d.standstills.pointControls(d.host,r);
    if(!argumentReply&&r.status==='active'&&r.action!=='respond'&&['request_reason','request_explanation','propose_alternative','offer_reason','dispute'].includes(r.action)&&r.interaction.recipientId===d.actor())d.actionGroup('Your response',[interactionButton('Respond',()=>this.compose('respond'))]);
    if(r.status==='withdrawn')d.host.append(interactionEl('p','Withdrawn','discussion-state'));
    const replies=this.responses(id);
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
