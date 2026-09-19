import {CounterpartUI} from './counterpart-ui.mjs';
import {AdoptionUI} from './adoption-ui.mjs';
import {confidenceForm} from './confidence-ui.mjs';
import {setNodeConfidence} from './confidence.mjs';
import {isAdoptionReceipt} from './adoption-fulfillment.mjs';
import {ReasoningUI} from './reasoning-ui.mjs';
import {makeDiscussion,discussionLayer,discussionSource,discussionTargetLabel,discussionHealth,DISCUSSION_LABELS,isReason,isChallenge,canExplainReasoning} from './discussion.mjs';
import {comparisonPairKey,validateWorkspace} from './workspace.mjs';
import {comparisonNodeKey,visibleComparisonEndpoint} from './comparison-layout.mjs';
import {routeComparisonConnection} from './comparison-routing.mjs';
import {graphEdges,STRUCTURAL_TYPES,RELATION_TYPES} from './model.mjs';
import {CARD_W,CARD_H,connectorRoute} from './layout.mjs';
import {stableJSON} from './account-model.mjs';
import {conversationAnchor,conversationGroups,challengeState,groupSourceConnections,groupComparisonConnections,visibleNodePairKey} from './conversation-tree.mjs';
const discussEl=(tag,text='',className='')=>{const e=document.createElement(tag);e.textContent=text;e.className=className;return e;};
const discussButton=(text,fn,className='')=>{const b=discussEl('button',text,className);b.type='button';b.onclick=fn;return b;};
const discussUI=id=>document.getElementById(id);
const contributionLabel=r=>r.kind==='argument'&&r.action==='evidence'?'Evidence':DISCUSSION_LABELS[r.action];


export class DiscussionUI{
  constructor(c){
    this.c=c;this.canvas=c.canvas;this.layers={map:true,inquiries:true,arguments:true};this.target=null;this.dirty=false;
    this.groupTarget=null;this.counterparts=new CounterpartUI(this);this.adoption=new AdoptionUI(this);
    this.canvas.options.canSetConfidence=(map,node)=>map.ownerId===this.actor()&&node.kind==='position';
    this.canvas.options.onConfidence=(side,id)=>{if(!this.canLeave())return;this.c.selectSource(side,id);this.confidence();};
    this.canvas.options.afterBuild=()=>this.draw();this.canvas.options.afterGeometry=()=>this.position();this.canvas.options.afterCamera=()=>this.positionPopover();
    this.host=discussEl('section','','discussion-popover');this.host.hidden=true;this.host.setAttribute('aria-label','On-map conversation');this.canvas.surface.append(this.host);
    for(const event of ['pointerdown','wheel'])this.host.addEventListener(event,e=>e.stopPropagation());
    this.host.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();this.close();}});
    this.host.addEventListener('input',()=>{this.dirty=true;this.c.status();});
    const controls=discussEl('div','','discussion-layers');controls.setAttribute('role','group');controls.setAttribute('aria-label','Visible comparison layers');
    for(const [key,label]of [['map','Map'],['inquiries','Inquiries'],['arguments','Arguments']]){const b=discussButton(label,()=>{this.layers[key]=!this.layers[key];b.setAttribute('aria-pressed',String(this.layers[key]));if(this.groupTarget)this.openGroup(this.groupTarget);this.draw();this.position();});b.dataset.layer=key;b.setAttribute('aria-pressed','true');controls.append(b);}
    const earlier=discussButton('Earlier records',()=>this.setRecordsOpen(this.recordsPanel.hidden));
    earlier.className='discussion-secondary';earlier.setAttribute('aria-controls','comparison-panel');earlier.setAttribute('aria-expanded','false');
    controls.append(discussButton('Refresh',async()=>{if(!this.c.account)return;if(this.dirty){this.c.message('Save or close your conversation draft before refreshing.');return;}await this.c.account.save();await this.c.account.refresh();if(this.viewId)this.open(this.viewId);},'discussion-secondary'),discussButton('Conversations',()=>this.list(),'discussion-secondary'),earlier);
    controls.id='comparison-commandbar';discussUI('comparison-context').append(controls);
    this.controls=controls;
    this.viewOptions=discussEl('details','','comparison-view-options');
    const summary=discussEl('summary','View options'),options=discussEl('div','','comparison-options-body');
    const startActions=document.querySelector('#comparison-workspace>.comparison-heading .comparison-register-actions');
    this.optionsBody=options;options.append(document.querySelector('.comparison-map-toolbar'),startActions,this.canvas.layerControls,discussUI('comparison-view-modes'),earlier);
    this.viewOptions.append(summary,options);controls.append(this.viewOptions);
    this.viewOptions.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();this.viewOptions.open=false;summary.focus();}});
    document.addEventListener('pointerdown',e=>{if(!this.viewOptions.contains(e.target))this.viewOptions.open=false;});
    discussUI('start-comparison').addEventListener('click',()=>{this.viewOptions.open=false;});
    this.focusMode=discussButton('Full canvas',()=>{const active=document.body.classList.toggle('comparison-full-canvas');this.focusMode.textContent=active?'Exit full canvas':'Full canvas';this.focusMode.setAttribute('aria-pressed',String(active));});
    this.focusMode.classList.add('comparison-full-toggle');this.focusMode.setAttribute('aria-pressed','false');controls.append(this.focusMode);
    const fullStatus=discussEl('span','','comparison-full-status');fullStatus.setAttribute('role','status');controls.append(fullStatus);
    const status=discussUI('storage-status'),message=discussUI('workspace-message'),syncStatus=()=>{fullStatus.textContent=[status.textContent,message.hidden?'':message.textContent].filter(Boolean).join(' · ');};
    for(const el of [status,message])new MutationObserver(syncStatus).observe(el,{childList:true,characterData:true,subtree:true,attributes:true});syncStatus();
    const panel=document.querySelector('.comparison-panel');this.recordsPanel=panel;this.recordsToggle=earlier;panel.id='comparison-panel';panel.hidden=true;document.querySelector('.comparison-layout').classList.add('map-first');
    const recordsHeader=discussEl('header','','comparison-records-header');
    this.recordsClose=discussButton('Close records',()=>this.setRecordsOpen(false));
    recordsHeader.append(discussEl('strong','Earlier records'),this.recordsClose);panel.prepend(recordsHeader);
    panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();this.setRecordsOpen(false);}});
    for(const button of document.querySelectorAll('.comparison-expand-controls button'))button.title=button.getAttribute('aria-label');
    discussUI('new-comparison').hidden=true;
    document.querySelector('.comparison-heading p').textContent='Connect positions, ask questions, and challenge reasoning together.';
    document.querySelector('.comparison-canvas-footer').textContent='Select nodes or connections to relate, ask, or challenge · Drag empty space to pan · Scroll to zoom';
    discussUI('compare-view-mode').textContent='Map & conversation';discussUI('argument-mode').textContent='Earlier reasoning';
    for(const b of controls.querySelectorAll('[data-layer]'))if(b.dataset.layer!=='inquiries')options.append(b);
    this.reasoning=new ReasoningUI(this);
  }
  setMode(mode){
    const views=discussUI('comparison-view-modes'),heading=discussUI('comparison-context').querySelector('.context-heading');
    if(mode==='argument'){this.controls.hidden=true;heading.append(views);views.hidden=false;}
    else{this.controls.hidden=false;this.optionsBody.append(views);}
  }
  setRecordsOpen(open,{focus=true}={}){
    if(open&&this.recordsPanel.hidden){this.recordsReturnFocus=this.viewOptions.querySelector('summary');this.viewOptions.open=false;}
    this.recordsPanel.hidden=!open;
    this.recordsToggle.setAttribute('aria-expanded',String(open));
    if(focus){if(open)this.recordsClose.focus({preventScroll:true});else (this.recordsReturnFocus?.isConnected?this.recordsReturnFocus:this.recordsToggle).focus({preventScroll:true});}
  }
  actor(){return this.c.account?.actor?.id||this.c.participation.actorId||this.c.workspace.maps.find(m=>m.id===this.c.sides.a.mapId)?.ownerId;}
  thread(){return this.c.workspace.comparisonThreads?.find(t=>comparisonPairKey(t)===comparisonPairKey({aMapId:this.c.sides.a.mapId,bMapId:this.c.sides.b.mapId}));}
  entries(){return (this.c.workspace.discussions||[]).filter(r=>r.comparisonId===this.thread()?.id&&r.status==='active');}
  allEntries(){return (this.c.workspace.discussions||[]).filter(r=>r.comparisonId===this.thread()?.id);}
  name(id){return this.c.workspace.participants.find(p=>p.id===id)?.name||'Participant';}
  canLeave(){if(this.dirty&&!confirm('Discard this unsaved conversation draft?'))return false;this.dirty=false;this.viewId=null;this.editingContributionId=null;this.groupTarget=null;this.host.hidden=true;this.c.status();return true;}
  close(){const entry=this.viewId;if(!this.canLeave())return;this.groupTarget=null;this.target=null;this.draw();const marker=entry&&[...this.canvas.world.querySelectorAll('[data-entry]')].find(el=>el.dataset.entry===entry);(marker||(this.returnFocus?.isConnected?this.returnFocus:this.canvas.surface)).focus({preventScroll:true});}
  shell(title){this.viewId=null;this.host.replaceChildren();this.host.hidden=false;const header=discussEl('header');header.append(discussEl('strong',title),discussButton('Close',()=>this.close()));this.host.append(header);this.positionPopover();}
  actionGroup(title,buttons){if(!buttons.length)return;const section=discussEl('section','','discussion-action-group'),actions=discussEl('div','','discussion-actions');section.append(discussEl('h3',title));actions.append(...buttons);section.append(actions);this.host.append(section);}
  selectNode(side,id){if(!this.canLeave())return;this.target={type:'node',mapId:this.c.sides[side].mapId,nodeId:id};this.returnFocus=this.canvas.cards.get(comparisonNodeKey(side,id))?.querySelector('.node-main');this.actions();}
  selectTarget(target){if(!this.canLeave())return;this.target=target;this.returnFocus=document.activeElement;this.actions();}
  confidence(){
    if(!this.canLeave())return;const target=this.target,source=discussionSource(this.c.workspace,target);
    if(target?.type!=='node'||source?.map.ownerId!==this.actor()||source.item.kind!=='position')return;
    this.shell('My confidence');this.host.append(confidenceForm(source.item,{cancel:()=>{this.dirty=false;this.actions();},save:value=>{
      if(!this.c.editor.flushDraft())throw Error('Resolve the unfinished map edit before saving confidence.');this.c.captureActive();
      const map=this.c.workspace.maps.find(m=>m.id===target.mapId);setNodeConfidence(this.c.workspace,target,this.actor(),value);
      if(this.c.activeMapId===map.id){this.c.baseline=JSON.stringify({nodes:map.nodes,relations:map.relations});this.c.editor.updateConfidence(target.nodeId,value);}
      this.dirty=false;this.c.markDirty();this.c.renderComparison();this.actions();
    }}));this.positionPopover();
  }
  actions(){
    if(this.target?.type==='inference'){this.reasoning.openInference(this.target.entryId);return;}
    if(!this.target)return;const ws=this.c.workspace,source=discussionSource(ws,this.target),own=source?.map.ownerId===this.actor();this.shell(discussionTargetLabel(ws,this.target));
    if(source){const text=source.item.details||source.item.summary;if(text){const details=discussEl('details');details.append(discussEl('summary','Read source'),discussEl('p',text,'discussion-body'));this.host.append(details);}}
    const pair=['a','b'].map(side=>({type:'node',mapId:this.c.sides[side].mapId,nodeId:this.c.sides[side].nodeId}));
    if(this.target.type==='node'&&pair.every(t=>t.nodeId)&&pair[0].mapId!==pair[1].mapId){
      this.actionGroup('Record relationship',['agreement','disagreement'].map(action=>discussButton(DISCUSSION_LABELS[action],()=>this.save({kind:'relationship',action,target:pair[0],other:pair[1],body:''}),action)));
      this.host.append(discussButton('Clear other selection',()=>{const side=this.c.sides.a.mapId===this.target.mapId?'b':'a';this.c.sides[side].nodeId=null;discussUI(`compare-node-${side}`).value='';this.c.canvas.pick(side,null);this.actions();},'discussion-text-action'));
    }
    const understand=[],respond=[],collaborate=[];
    if(this.target.type==='node'&&own&&source.item.kind==='position')this.actionGroup('My position',[discussButton('My confidence',()=>this.confidence())]);
    if(canExplainReasoning(ws,this.target,this.actor()))respond.push(discussButton('Explain my reasoning',()=>this.compose('argument','reason')));
    if(source){
      const context=(ws.discussions||[]).find(r=>r.kind==='context'&&r.status==='active'&&stableJSON(r.target)===stableJSON(this.target));
      if(context)understand.push(discussButton('View definitions & standards',()=>this.openContexts(this.target)));
      if(own)understand.push(discussButton('Use definitions & standards',()=>this.c.library.definitions.choose(this.target)));
    }
    if(this.target.type==='node'&&own){if(source.item.parent!==null&&!this.counterparts.links(this.target).length)collaborate.push(discussButton('Request counterpart',()=>{const request=this.counterparts.requests(this.target).at(-1);if(request)this.open(request.id);else this.compose('counterpart','counterpart');}));if(source.item.parent!==null&&this.counterparts.otherMap(this.target)?.ownerId!==this.actor())collaborate.push(discussButton('Suggest adoption',()=>this.compose('adoption','adoption')));}
    else if(source){understand.unshift(discussButton('Ask',()=>this.compose('inquiry','question')));respond.push(discussButton('Challenge',()=>this.compose('argument','challenge')));}
    if(this.target.type==='node'&&source?.item.parent!==null)collaborate.push(discussButton('Find or view counterpart',()=>this.counterparts.show(this.target)));
    this.actionGroup('Understand',understand);this.actionGroup('Respond',respond);this.actionGroup('Collaborate',collaborate);this.positionPopover();
  }
  compose(kind,action,old=null,extra={}){
    if(!this.canLeave())return;this.groupTarget=null;const target=old?.target||this.target,{title,...saveExtra}=extra;this.target=target;this.editingContributionId=old?.id||null;this.shell(old?'Edit contribution':title||contributionLabel({kind,action}));
    const reasoning=kind==='argument'&&action==='reason',argumentReply=kind==='reply'&&(old?.layer||saveExtra.layer)==='arguments';
    const form=discussEl('form'),fieldLabel=kind==='context'?'Author’s definitions and standards':kind==='inquiry'?'Your question':reasoning?'Your reason':kind==='argument'?'Your challenge':['counterpart','adoption'].includes(kind)?'Optional note':'Description';const label=discussEl('label',fieldLabel);label.htmlFor='discussion-body';
    let options=kind==='inquiry'?['question','explain','example','evidence']:kind==='argument'&&!reasoning?['challenge','inference','counterexample','fallacy']:kind==='relationship'?['agreement','disagreement']:null;
    if(reasoning||kind==='argument'||argumentReply)form.append(discussEl('p',target.type==='inference'?'Addresses the reasoning connection, not the statement itself.':`Addresses: ${discussionTargetLabel(this.c.workspace,target)}`,'discussion-target-note'));
    if(old&&options&&!options.includes(action))options=[...options,action];
    const select=discussEl('select');select.id='discussion-action';select.setAttribute('aria-label','Contribution type');if(options){for(const value of options){const o=discussEl('option',contributionLabel({kind,action:value}));o.value=value;select.append(o);}select.value=action;form.append(select);}
    const body=discussEl('textarea');body.id='discussion-body';body.rows=5;body.maxLength=10000;body.value=old?.body||'';body.required=!['counterpart','adoption','relationship'].includes(kind);
    const prompts={explain:'Could you explain this in more detail?',example:'Could you give an example?',evidence:'What evidence supports this?'};
    body.placeholder=reasoning?'Explain why this supports your position.':argumentReply?'Explain your response.':kind==='context'?'Define key terms, then describe the standards or criteria used here.':kind==='counterpart'?'Describe the counterpart you are looking for.':kind==='adoption'?'Explain why this node may belong in the other person’s map.':kind==='relationship'?'Describe the relationship (optional).':kind==='argument'?'Explain the problem you see.':'Write your question.';
    if(options)select.onchange=()=>{if(kind==='inquiry'&&(!body.value||Object.values(prompts).includes(body.value)))body.value=prompts[select.value]||'';this.dirty=true;};
    if(!old&&kind==='inquiry'&&prompts[action])body.value=prompts[action];
    if(kind==='argument'&&!reasoning)form.append(discussEl('p','Choose the closest type, then explain the problem in your own words.','field-help'));
    const reference=discussEl('input');reference.type='url';reference.id='discussion-reference';reference.maxLength=2000;reference.placeholder='https://';reference.value=old?.referenceUrl||'';
    if(kind==='counterpart'){const thread=this.thread(),other=this.c.workspace.maps.find(m=>[thread?.aMapId,thread?.bMapId].includes(m.id)&&m.id!==target.mapId);form.append(discussEl('p',`Request to ${this.name(other?.ownerId)} to add a corresponding node.`,'field-help'));}
    if(kind==='adoption'){const thread=this.thread(),other=this.c.workspace.maps.find(m=>[thread?.aMapId,thread?.bMapId].includes(m.id)&&m.id!==target.mapId);form.append(discussEl('p',`Suggestion to ${this.name(other?.ownerId)} to consider this node for their map.`,'field-help'));}
    form.append(label,body);if(old?.referenceUrl||reasoning||argumentReply){const refLabel=discussEl('label','Reference link (optional)');refLabel.htmlFor=reference.id;form.append(refLabel,reference);}
    const readDefinitions=kind==='argument'||argumentReply?this.reasoning.definitionChoices(form,old):null;
    const submitLabels={inquiry:'Send question',argument:'Add challenge',counterpart:'Send request',adoption:'Send suggestion',relationship:'Record relationship',reply:'Post response',context:'Save definition'};
    const submit=discussEl('button',old?'Save changes':reasoning?'Add reason':['resolve','reopen','accept','maintain','no_position','not_applicable','close_request','reopen_request'].includes(action)?DISCUSSION_LABELS[action]:submitLabels[kind]||'Save','primary');submit.type='submit';form.append(submit);this.host.append(form);
    form.onsubmit=e=>{e.preventDefault();this.save({...old,...saveExtra,kind,action:options?select.value:action,target,body:body.value,referenceUrl:reference.value,...(readDefinitions?{definitionRefs:readDefinitions()}: {})},old);};this.positionPopover();body.focus({preventScroll:true});
  }
  async save(input,old=null){
    if(this.saving)return;this.saving=true;this.host.inert=true;
    try{
      const thread=input.kind==='context'?null:await this.c.ensureComparison();
      const value=makeDiscussion(this.c.workspace,{...input,comparisonId:thread?.id||null},this.actor(),old);
      const candidate={...this.c.workspace,discussions:[...(this.c.workspace.discussions||[]).filter(r=>r.id!==value.id),value]};validateWorkspace(candidate);this.c.workspace=candidate;this.dirty=false;this.c.markDirty();
      if(thread){this.c.activeComparisonPair=comparisonPairKey(thread);this.c.setComparisonRoute(thread.id);}
      if(discussionLayer(value)==='arguments'&&value.status==='active')this.reasoning.focusEntry(value);
      this.c.renderComparison();this.c.library.render();this.saving=false;if(value.status==='active')this.open(value.id);else this.close();
    }catch(e){let error=this.host.querySelector('[role=alert]');if(!error){error=discussEl('p');error.setAttribute('role','alert');this.host.append(error);}error.textContent=e.message;}finally{this.saving=false;this.host.inert=false;}
  }
  open(id){
    if(!this.canLeave())return;const r=this.c.workspace.discussions?.find(e=>e.id===id);if(!r)return;this.target={type:'entry',entryId:id};this.returnFocus=document.activeElement;this.shell(contributionLabel(r));this.viewId=id;this.groupTarget=null;
    const anchor=conversationAnchor(this.c.workspace.discussions,r);
    if(anchor&&r.kind!=='context')this.host.append(discussButton('All attached conversations',()=>this.openGroup(anchor),'discussion-text-action'));
    if(r.target.type==='inference')this.host.append(discussButton('Addresses: reasoning connection',()=>this.reasoning.openInference(r.target.entryId),'discussion-parent-link'));
    if(r.target.type==='entry'){const parent=this.c.workspace.discussions.find(p=>p.id===r.target.entryId);if(parent)this.host.append(discussButton(`Responding to: ${contributionLabel(parent)} by ${this.name(parent.authorId)}`,()=>this.open(parent.id),'discussion-parent-link'));}
    if(isChallenge(r))this.host.append(discussEl('p',challengeState(this.entries(),r),'discussion-state'));
    const byline=r.kind==='relationship'?`Recorded by ${this.name(r.authorId)} · Source: ${r.targetLabel}`:`${this.name(r.authorId)} · Source: ${r.targetLabel}`;
    this.host.append(discussEl('p',byline,'discussion-byline'),discussEl('p',r.body|| (r.kind==='relationship'?'Relationship recorded.':r.kind==='adoption'?'Please consider adopting this node.':'Please add a corresponding node.'),'discussion-body'));
    if(r.referenceUrl){const link=discussEl('a','Open evidence / reference');link.href=r.referenceUrl;link.target='_blank';link.rel='noopener noreferrer';this.host.append(link);}
    if(r.definitionRefs?.length)this.host.append(discussButton('View invoked definitions & standards',()=>this.reasoning.showDefinitions(r)));
    if(discussionLayer(r)==='arguments'){this.host.append(discussButton('Follow argument',()=>this.reasoning.follow({type:'entry',entryId:r.id})),discussButton('Back to source',()=>{this.reasoning.anchor=anchor;this.reasoning.back();}));}
    const health=discussionHealth(this.c.workspace,r);
    if(['changed','unavailable'].includes(health.state))this.host.append(discussEl('p',health.label,'review-warning'));
    this.sourceHistory(r,health);
    const responses=this.entries().filter(e=>['entry','inference'].includes(e.target.type)&&e.target.entryId===id);
    if(responses.length){const heading=discussEl('h3','Conversation');this.host.append(heading);for(const reply of responses){const card=discussButton('',()=>this.open(reply.id),'discussion-reply discussion-list-item');card.append(discussEl('strong',`${contributionLabel(reply)} · ${this.name(reply.authorId)}`),discussEl('p',reply.body));this.host.append(card);}}
    if(r.kind==='adoption'||isAdoptionReceipt(r))this.adoption.state(r);
    if(r.status==='active'){
      if(r.kind==='counterpart')this.counterparts.requestActions(r);
      if(r.kind==='correspondence')this.actionGroup('Compared nodes',[discussButton('Show linked counterpart',()=>this.counterparts.focus(r)),...['agreement','disagreement'].map(action=>discussButton(DISCUSSION_LABELS[action],()=>this.save({kind:'relationship',action,target:r.target,other:r.other,body:''})))]);
      if(r.kind==='relationship'){
        this.actionGroup('Understand',[discussButton('Ask about relationship',()=>this.compose('inquiry','question',null,{title:'Ask about relationship'}))]);
        if(r.authorId!==this.actor())this.actionGroup('Respond',[discussButton(`Contest ${r.action}`,()=>this.compose('argument','challenge',null,{title:`Contest ${r.action}`}))]);
      }else if(['inquiry','counterpart','adoption'].includes(r.kind)&&r.authorId!==this.actor())this.actionGroup('Respond',[discussButton(r.kind==='inquiry'?'Answer':'Respond',()=>this.compose('reply','reply',null,{layer:discussionLayer(r)}))]);
      else if(['argument','reply'].includes(r.kind)&&!isAdoptionReceipt(r)){
        const buttons=isReason(r)?[]:[discussButton('Respond',()=>this.compose('reply','reply',null,{layer:discussionLayer(r)}))];
        if(canExplainReasoning(this.c.workspace,this.target,this.actor()))buttons.push(discussButton('Add supporting reason',()=>this.compose('argument','reason')));
        if(r.authorId!==this.actor())buttons.push(discussButton(isReason(r)?'Challenge reason':'Challenge response',()=>this.compose('argument','challenge')));
        if(isReason(r))buttons.push(discussButton('Inspect reasoning connection',()=>this.reasoning.openInference(r.id)));
        if(isChallenge(r)){
          if(r.authorId===this.actor()){const action=challengeState(this.entries(),r)==='Open'?'resolve':'reopen';buttons.push(discussButton(action==='resolve'?'Mark resolved':'Reopen challenge',()=>this.compose('reply',action,null,{layer:'arguments'})));}
          else for(const action of ['accept','maintain'])buttons.push(discussButton(DISCUSSION_LABELS[action],()=>this.compose('reply',action,null,{layer:'arguments'})));
        }
        this.actionGroup('Respond',buttons);
      }
    }
    if(r.authorId===this.actor()&&!isAdoptionReceipt(r))this.actionGroup('Manage',[discussButton('Edit',()=>r.kind==='context'&&r.definitionRefs?this.c.library.definitions.choose(r.target):this.compose(r.kind,r.action,r)),discussButton('Withdraw',()=>{if(confirm('Withdraw your contribution? Its history will remain saved.'))this.save({...r,status:'withdrawn'},r);})]);
    if(r.history.length){const details=discussEl('details');details.append(discussEl('summary','Earlier wording'));for(const v of r.history)details.append(discussEl('p',`${DISCUSSION_LABELS[v.action]} · ${v.body||'No description'}`));this.host.append(details);}
    this.draw();this.positionPopover();
  }
  sourceHistory(r,health){
    const details=discussEl('details','','discussion-source-history');details.append(discussEl('summary','Source wording & history'));
    const renderSnapshot=(s,depth=0)=>{const article=discussEl('article');article.append(discussEl('strong',s?.label||'Unavailable source'));if(!s||depth>3)return article;const wording=s.wording||{};
      for(const key of ['reason','conclusion'])if(wording[key]){article.append(discussEl('h4',key==='reason'?'Reason':'Conclusion'),renderSnapshot(wording[key],depth+1));}
      for(const value of [wording.from,wording.to].filter(Boolean))article.append(discussEl('p',[value.title,value.summary,value.details,value.body].filter(Boolean).join('\n'),'discussion-body'));
      const text=[wording.title,wording.summary,wording.details,wording.body].filter(Boolean).join('\n');if(text)article.append(discussEl('p',text,'discussion-body'));for(const d of s.definitions||[])article.append(discussEl('p',`Definitions / standards: ${d.title||''} ${d.body}`,'discussion-body'));return article;};
    const add=(title,snapshots)=>{details.append(discussEl('strong',title));if(!snapshots){details.append(discussEl('p','Not captured for this earlier contribution.'));return;}for(const s of snapshots)details.append(renderSnapshot(s));};
    add('Originally discussed',r.sourceSnapshots);if(r.reviewedSources)add('Last reviewed',r.reviewedSources);if(health.needsReview)add('Current source',health.current);
    if(r.authorId===this.actor()&&health.state==='changed'&&!isAdoptionReceipt(r))details.append(discussButton('Confirm current source wording',()=>this.save({...r,reviewSources:true},r)));
    this.host.append(details);
  }
  openContexts(target){
    if(!this.canLeave())return;this.target=target;this.shell('Definitions & standards');
    const records=this.c.workspace.discussions.filter(r=>r.kind==='context'&&r.status==='active'&&stableJSON(r.target)===stableJSON(target));
    for(const r of records){
      if(r.definitionRefs)for(const ref of r.definitionRefs){this.host.append(discussEl('h3',ref.title),discussEl('p',`${ref.type==='standard'?'Standard':'Definition'} · ${this.name(ref.authorId)} · Version ${ref.version}`,'discussion-byline'),discussEl('p',ref.body,'discussion-body'));}
        else {this.host.append(discussEl('p',r.body,'discussion-body'));if(r.authorId===this.actor())this.host.append(discussButton('Edit earlier definition',()=>this.compose(r.kind,r.action,r)));}
    }
    if(discussionSource(this.c.workspace,target)?.map.ownerId===this.actor())this.host.append(discussButton('Choose library references',()=>this.c.library.definitions.choose(target)));
    this.positionPopover();
  }
  entryButton(r){
    const children=this.entries().filter(e=>e.target.entryId===r.id),b=discussButton('',()=>this.open(r.id),'discussion-list-item');
    b.dataset.entry=r.id;b.append(discussEl('strong',`${contributionLabel(r)} · ${this.name(r.authorId)}`),discussEl('p',r.body||'Open request','discussion-body'));
    if(isChallenge(r))b.append(discussEl('small',challengeState(this.entries(),r)));
    if(children.length)b.append(discussEl('small',` · ${children.length} responses`));return b;
  }
  openGroup(target,kind=null,groups=null){
    if(!this.canLeave())return;this.target=target;this.groupTarget=target;this.shell(discussionTargetLabel(this.c.workspace,target));
    const selected=groups||conversationGroups(this.allEntries()).filter(g=>stableJSON(g.target)===stableJSON(target));
    const entries=selected.flatMap(g=>g.entries),roots=entries.filter(r=>r.kind!=='reply'||!entries.some(p=>p.id===r.target.entryId));
    const heading=kind==='challenges'?'Challenges':kind==='questions'?'Questions & requests':'Attached conversations';this.host.append(discussEl('h3',heading));
    const visible=roots.filter(r=>kind?kind==='challenges'?isChallenge(r):kind==='reasons'?isReason(r):discussionLayer(r)==='inquiries':this.layers[discussionLayer(r)]);
    for(const r of visible)this.host.append(this.entryButton(r));
    if(!visible.length)this.host.append(discussEl('p',roots.length?'These conversations are collapsed by the display controls.':'No active questions or challenges.'));
    if(visible.length<roots.length)this.host.append(discussButton(`Show all ${roots.length} attached conversations`,()=>{this.layers.inquiries=true;this.layers.arguments=true;for(const b of this.controls.querySelectorAll('[data-layer]'))b.setAttribute('aria-pressed',String(this.layers[b.dataset.layer]));this.openGroup(target,null,selected);}));
    this.draw();this.positionPopover();
  }
  listArguments(){
    this.target=null;this.groupTarget=null;this.shell('Arguments in this comparison');
    const records=this.entries(),args=records.filter(isChallenge).sort((a,b)=>(challengeState(records,a)==='Open'?0:1)-(challengeState(records,b)==='Open'?0:1));
    this.host.append(discussEl('p',`${args.filter(r=>challengeState(records,r)==='Open').length} open challenges · ${args.filter(r=>challengeState(records,r)!=='Open').length} resolved by their authors.`));
    for(const r of args)this.host.append(this.entryButton(r));
    for(const r of records.filter(isReason))this.host.append(this.entryButton(r));
    if(!args.length)this.host.append(discussEl('p','Select another person’s node or edge and choose Challenge.'));
    this.positionPopover();
  }
  list(){if(!this.canLeave())return;this.target=null;this.shell('Conversations');for(const r of this.entries().filter(r=>r.kind!=='reply')){const health=discussionHealth(this.c.workspace,r);this.host.append(discussButton(`${contributionLabel(r)} · ${this.name(r.authorId)} · ${r.targetLabel}${health.state==='changed'?' · Review source':''}`,()=>this.open(r.id),'discussion-list-item'));}const withdrawn=(this.c.workspace.discussions||[]).filter(r=>r.comparisonId===this.thread()?.id&&r.status==='withdrawn');if(withdrawn.length){const history=discussEl('details');history.append(discussEl('summary','Withdrawn contributions'));for(const r of withdrawn)history.append(discussButton(`${DISCUSSION_LABELS[r.action]} · ${this.name(r.authorId)}`,()=>this.open(r.id),'discussion-list-item'));this.host.append(history);}if(this.host.children.length===1)this.host.append(discussEl('p','Select a node or connection to begin.'));this.positionPopover();}
  openConnection(group,label,anchor){
    if(group.records.length===1){const r=group.records[0];if(r.legacy){if(this.canLeave())this.c.openRecord(r.id);}else this.open(r.id);return;}
    if(!this.canLeave())return;this.target=anchor;this.shell(label);this.host.append(discussEl('p','One connection, with these saved details.'));
    for(const r of group.records)this.host.append(discussButton(r.legacy?`Earlier comparison · ${r.question}`:`${contributionLabel(r)} · ${this.name(r.authorId)} · ${r.targetLabel}`,()=>r.legacy?this.c.openRecord(r.id):this.open(r.id),'discussion-list-item'));
    this.positionPopover();
  }
  openEdgeContexts(targets){
    const used=targets.filter(t=>this.c.workspace.discussions.some(r=>r.kind==='context'&&r.status==='active'&&stableJSON(r.target)===stableJSON(t)));
    if(used.length===1){this.openContexts(used[0]);return;}
    if(!this.canLeave())return;this.target=targets[0];this.shell('Connection definitions & standards');
    for(const target of used)this.host.append(discussButton(discussionTargetLabel(this.c.workspace,target),()=>this.openContexts(target)));this.positionPopover();
  }
  point(target,visited=new Set()){
    if(!target)return null;
    if(target.type==='inference'){const p=this.reasoning?.inferences.get(target.entryId);if(p)return p;const r=this.c.workspace.discussions.find(e=>e.id===target.entryId);if(!r||visited.has(r.id))return null;visited.add(r.id);return this.point(r.target,visited);}
    if(target.type==='connection'){const routed=this.connectionPositions?.get(target.key);if(routed)return routed;const a=this.point(target.a,visited),b=this.point(target.b,visited);return a&&b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2}:null;}
    while(target.type==='entry'){if(this.reasoning?.positions.has(target.entryId))return this.reasoning.positions.get(target.entryId);if(this.entryPositions?.has(target.entryId))return this.entryPositions.get(target.entryId);if(visited.has(target.entryId))return null;visited.add(target.entryId);const r=this.c.workspace.discussions?.find(e=>e.id===target.entryId);if(!r)return null;if(['relationship','correspondence'].includes(r.kind)){const p=this.point(r.target,visited),q=this.point(r.other,visited);return p&&q?{x:(p.x+q.x)/2,y:(p.y+q.y)/2}:p;}target=r.target;if(target.type==='inference')return this.point(target,visited);}
    const side=['a','b'].find(s=>this.canvas.states[s].map?.id===target.mapId);if(!side)return null;
    if(target.type==='edge'){const rendered=this.items?.find(i=>i.type==='edge'&&i.targets?.some(t=>t.edgeId===target.edgeId&&t.mapId===target.mapId));if(rendered?.path.getAttribute('d')){const p=rendered.path.getPointAtLength(rendered.path.getTotalLength()/2);return {x:p.x,y:p.y};}const source=discussionSource(this.c.workspace,target);if(!source)return null;const a=this.point({type:'node',mapId:target.mapId,nodeId:source.item.from}),b=this.point({type:'node',mapId:target.mapId,nodeId:source.item.to});return a&&b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2}:a||b;}
    const end=visibleComparisonEndpoint(this.canvas.layout,side,target.nodeId),p=end&&this.canvas.positions.get(end.key);return p?{x:p.x+CARD_W/2,y:p.y+CARD_H/2,w:CARD_W,h:CARD_H}:null;
  }
  draw(){
    const canvas=this.canvas;if(!canvas.layout)return;canvas.world.querySelectorAll('.discussion-drawing,.discussion-context-icon').forEach(e=>e.remove());
    for(const link of canvas.links||[]){link.path.remove();link.hit?.remove();link.badge?.remove();}
    this.items=[];const svg=canvas.svgElement('svg',{});svg.classList.add('discussion-drawing','discussion-lines');canvas.world.append(svg);this.svg=svg;
    for(const card of canvas.cards.values())card.hidden=!this.layers.map;
    canvas.world.querySelectorAll('.comparison-lines,.comparison-map-lane,.comparison-link-label').forEach(e=>e.style.visibility=this.layers.map?'':'hidden');
    // Reuse the tree's existing path where available. A transparent hit area
    // follows that same route; it is not a second visible connection.
    this.sourceEdgeKeys=new Map();this.connectionKeys=new Map();
    if(this.layers.map)for(const side of ['a','b']){const map=canvas.states[side].map;if(!map||map.unavailable)continue;
      for(const edges of groupSourceConnections(graphEdges(map.nodes,map.relations))){
        const edge=edges[0],targets=edges.map(e=>({type:'edge',mapId:map.id,edgeId:e.id})),target=targets[0];
        const a={type:'node',mapId:map.id,nodeId:edge.from},b={type:'node',mapId:map.id,nodeId:edge.to};
        if(!canvas.layout.maps[side]?.positions.has(edge.from)||!canvas.layout.maps[side]?.positions.has(edge.to))continue;
        const key=visibleNodePairKey(comparisonNodeKey(side,edge.from),comparisonNodeKey(side,edge.to));for(const t of targets)this.sourceEdgeKeys.set(stableJSON(t),key);
        const branch=canvas.branches.find(e=>e.side===side&&visibleNodePairKey(e.edge.from,e.edge.to)===visibleNodePairKey(edge.from,edge.to));
        const path=branch?.path||canvas.svgElement('path',{fill:'none'});path.classList.add('discussion-source-edge');path.dataset.nodePair=key;
        const hit=canvas.svgElement('path',{class:'discussion-edge-hit',fill:'none',tabindex:'0',role:'button','aria-label':`Select connection ${discussionTargetLabel(this.c.workspace,target)}`});
        const select=()=>{this.selectTarget(target);if(!this.dirty&&edges.length>1){const details=discussEl('details');details.append(discussEl('summary','Connection details'));for(const e of edges){const t={type:'edge',mapId:map.id,edgeId:e.id};details.append(discussButton((e.structural?STRUCTURAL_TYPES[e.type]:RELATION_TYPES[e.type])?.label||e.type,()=>this.selectTarget(t)));}this.host.append(details);this.positionPopover();}};
        hit.onclick=select;hit.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();select();}};
        if(!branch)svg.append(path);svg.append(hit);this.items.push({type:'edge',target,targets,a,b,path,hit,branch});
        if(targets.some(t=>this.c.workspace.discussions.some(r=>r.kind==='context'&&r.status==='active'&&stableJSON(r.target)===stableJSON(t))))this.badge('▤',target,()=>this.openEdgeContexts(targets),'Definitions and standards for '+discussionTargetLabel(this.c.workspace,target));
      }
    }
    for(const r of this.c.workspace.discussions||[])if(r.kind==='context'&&r.status==='active'&&r.target.type==='node'&&this.layers.map){const side=['a','b'].find(s=>canvas.states[s].map?.id===r.target.mapId),card=side&&canvas.cards.get(comparisonNodeKey(side,r.target.nodeId));if(card&&!card.querySelector('.discussion-context-icon')){const b=discussButton('▤',()=>this.openContexts(r.target),'discussion-context-icon');b.setAttribute('aria-label','Definitions and standards for '+r.targetLabel);card.querySelector('.node-bottom').append(b);}}
    const groups=conversationGroups(this.allEntries());
    const previous=canvas.records.map(r=>({...r,legacy:true,target:{type:'node',mapId:r.aMapId,nodeId:r.aNodeId},other:{type:'node',mapId:r.bMapId,nodeId:r.bNodeId}}));
    const endpoint=t=>{const side=['a','b'].find(s=>canvas.states[s].map?.id===t?.mapId);return side&&visibleComparisonEndpoint(canvas.layout,side,t.nodeId)?.key;};
    const connections=groupComparisonConnections([...this.entries().filter(r=>['relationship','correspondence'].includes(r.kind)),...previous],endpoint);
    for(const connection of connections){
      const records=connection.records,judgments=records.filter(r=>!r.legacy&&r.kind==='relationship'),r=judgments[0]||records.find(r=>!r.legacy)||records[0];
      const actualPairs=new Set(records.map(e=>visibleNodePairKey(stableJSON(e.target),stableJSON(e.other))));
      const mixed=new Set(judgments.map(e=>e.action)).size>1,action=actualPairs.size>1?'grouped':mixed?'mixed':r.legacy?'earlier':r.action;
      let label=actualPairs.size>1?`${actualPairs.size} connections · Collapsed branches`:mixed?'Mixed judgments':r.legacy?'Earlier comparison':`${DISCUSSION_LABELS[r.action]} · ${r.kind==='correspondence'?'Linked':'Recorded'} by ${this.name(r.authorId)}`;
      if(judgments.length>1&&!mixed&&actualPairs.size===1)label=`${DISCUSSION_LABELS[r.action]} · ${judgments.length} judgments`;
      if(records.some(e=>groups.some(g=>g.target.entryId===e.id&&g.openChallenges)))label+=' · Contested';
      if(records.some(e=>!e.legacy&&discussionHealth(this.c.workspace,e).state==='changed'))label+=' · Review source';
      const path=canvas.svgElement('path',{class:`discussion-relationship ${action}`,fill:'none'});path.dataset.nodePair=connection.key;
      const anchor={type:'connection',a:r.target,b:r.other,key:connection.key},open=()=>this.openConnection(connection,label,anchor);
      const hit=canvas.svgElement('path',{class:'discussion-edge-hit discussion-relationship-hit',fill:'none',tabindex:'0',role:'button','aria-label':`Select ${label}`});
      hit.onclick=open;hit.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();open();}};
      const edge={type:'edge',a:r.target,b:r.other,path,hit,connection:anchor};svg.append(path,hit);this.items.push(edge);
      this.badge(label,anchor,open,label,action);edge.badge=this.items.at(-1);edge.badge.edge=edge;
      this.items.at(-1).aliases=records.filter(e=>!e.legacy).map(e=>e.id);for(const e of records)this.connectionKeys.set(e.id,connection.key);
    }
    // Collapse at the source. Hidden layers retain their counts and are still discoverable.
    const rails=new Map();
    for(const g of groups){
      let card=null;
      if(g.target.type==='node'){const side=['a','b'].find(s=>canvas.states[s].map?.id===g.target.mapId),end=side&&visibleComparisonEndpoint(canvas.layout,side,g.target.nodeId);card=end&&canvas.cards.get(end.key);}
      const key=card||(g.target.type==='edge'?this.sourceEdgeKeys.get(stableJSON(g.target)):g.target.type==='entry'?this.connectionKeys.get(g.target.entryId):null)||g.key;if(!rails.has(key))rails.set(key,{card,groups:[],target:g.target});rails.get(key).groups.push(g);
    }
    for(const rail of rails.values()){
      const counts={questions:0,challenges:0,reasons:0};for(const g of rail.groups){counts.questions+=g.questions;counts.challenges+=g.challenges;counts.reasons+=g.reasons||0;}
      const bar=discussEl('span','','discussion-rail discussion-drawing');
      for(const [kind,icon]of [['reasons','↳'],['questions','?'],['challenges','!']])if(counts[kind]){
        const b=discussButton(`${icon} ${counts[kind]}`,()=>kind==='reasons'&&rail.groups.length===1?this.reasoning.follow(rail.target):this.openGroup(rail.target,kind,rail.groups));b.setAttribute('aria-label',`${counts[kind]} ${kind} attached to ${discussionTargetLabel(this.c.workspace,rail.target)}`);b.setAttribute('aria-expanded',String(stableJSON(this.groupTarget)===stableJSON(rail.target)));b.className=kind;b.dataset.collapsed=String(!this.layers[kind==='questions'?'inquiries':'arguments']);b.title='Open attached '+kind;bar.append(b);
      }
      if(!counts.questions&&!counts.challenges&&!counts.reasons){const b=discussButton('Responses',()=>this.openGroup(rail.target,null,rail.groups));bar.append(b);}
      if(rail.card){rail.card.hidden=false;rail.card.querySelector('.node-bottom').append(bar);}
      else{canvas.world.append(bar);this.items.push({type:'badge',target:rail.target,b:bar});}
    }
    this.counterparts.draw();
    this.reasoning.draw();
    canvas.hint.textContent='Select two nodes to record agreement or disagreement. Select a source to ask or challenge. Open its ? / ! counts to follow conversations.';
    canvas.linkStatus.textContent=`${this.entries().filter(r=>r.kind!=='reply').length} contributions in this comparison`;
    document.querySelector('.comparison-heading').hidden=!!this.thread();
    discussUI('comparison-form').hidden=!this.c.editingRecord;
    discussUI('argument-mode').hidden=!this.c.workspace.comparisons.some(r=>r.comparisonId===this.thread()?.id);
    const threadKey=this.thread()?.id||null;if(this.viewThreadKey!==threadKey){this.viewOptions.open=!threadKey;this.viewThreadKey=threadKey;}
    discussUI('comparison-view-modes').hidden=discussUI('argument-mode').hidden;
    this.position();
  }
  badge(text,target,action,aria,style=''){const b=discussButton(text,action,`discussion-badge discussion-drawing ${style}`);b.setAttribute('aria-label',aria);b.title=aria;if(target.type==='entry')b.dataset.entry=target.entryId;this.canvas.world.append(b);this.items.push({type:'badge',target,b});}
  position(){
    if(!this.items)return;this.entryPositions=new Map();this.connectionPositions=new Map();const routeBounds=[],occupied=[...this.canvas.positions.values(),...(this.canvas.layout.placeholders||[])].map(p=>({x:p.x,y:p.y,w:CARD_W,h:CARD_H}));
    const overlaps=(x,y,w,h)=>occupied.some(r=>x<r.x+r.w+12&&x+w+12>r.x&&y<r.y+r.h+12&&y+h+12>r.y);
    for(const item of this.items){
      if(item.type==='edge'){
        const a=this.point(item.a),b=this.point(item.b);item.path.style.display=a&&b?'':'none';if(item.hit)item.hit.style.display=a&&b?'':'none';if(!a||!b){item.route=null;continue;}
        let d;
        if(item.connection){
          const label=item.badge.b;label.hidden=false;
          item.route=routeComparisonConnection(a,b,occupied.map(r=>({x:r.x+r.w/2,y:r.y+r.h/2,w:r.w,h:r.h})),{w:label.offsetWidth,h:label.offsetHeight});d=item.route.d;
          if(item.route.label)this.connectionPositions.set(item.connection.key,item.route.label);
          routeBounds.push(...item.route.points.map(p=>({...p,w:0,h:0})));
        }else d=item.branch?.path.getAttribute('d')||connectorRoute({x:a.x-CARD_W/2,y:a.y-CARD_H/2},{x:b.x-CARD_W/2,y:b.y-CARD_H/2},null).d;
        item.path.setAttribute('d',d);item.hit?.setAttribute('d',d);
      }else {
        const p=item.edge?item.edge.route?.label:this.point(item.target),el=item.b;el.hidden=!p;if(!p)continue;
        const w=el.offsetWidth,h=el.offsetHeight;let x=p.x-w/2,y=item.edge?p.y-h/2:p.y-CARD_H/2-h-18;
        if(!item.edge){if(item.target.type==='edge'){x=p.x+8;y=p.y-h/2;}else if(el.classList.contains('discussion-rail')){x=p.x+(p.w||0)/2+8;y=p.y-h/2;}while(overlaps(x,y,w,h))y-=h+12;}
        occupied.push({x,y,w,h});if(el.classList.contains('discussion-badge'))for(const id of item.aliases||(item.target.type==='entry'?[item.target.entryId]:[]))this.entryPositions.set(id,{x:x+w/2,y:y+h/2,w,h});el.style.transform=`translate(${x}px,${y}px)`;
      }
    }
    if(occupied.length){const visible=[...occupied,...routeBounds],x=Math.min(0,...visible.map(r=>r.x)),y=Math.min(0,...visible.map(r=>r.y));this.canvas.layout.bounds={x,y,width:Math.max(...visible.map(r=>r.x+r.w))+32-x,height:Math.max(...visible.map(r=>r.y+r.h))+32-y};}
    this.counterparts.position();this.reasoning.position();this.positionPopover();
  }
  positionPopover(){
    if(this.host.hidden)return;const {surface,camera}=this.canvas,p=this.point(this.target),width=Math.min(350,surface.clientWidth-24);
    this.host.style.width=width+'px';this.host.style.maxHeight=Math.max(150,surface.clientHeight-32)+'px';
    let x=12,y=64;
    if(p){const left=camera.x+(p.x-(p.w||0)/2)*camera.z,right=camera.x+(p.x+(p.w||0)/2)*camera.z,top=camera.y+(p.y-(p.h||0)/2)*camera.z,bottom=camera.y+(p.y+(p.h||0)/2)*camera.z;
      x=left;y=bottom+10;
      if(y+this.host.offsetHeight>surface.clientHeight-12){x=right+12;y=top;if(x+width>surface.clientWidth-12)x=left-width-12;}
    }
    this.host.style.left=Math.max(12,Math.min(surface.clientWidth-width-12,x))+'px';this.host.style.top=Math.max(12,Math.min(surface.clientHeight-this.host.offsetHeight-12,y))+'px';
  }
}
