import {InteractionUI} from './interaction-ui.mjs';
import {InteractionSearchUI} from './interaction-search-ui.mjs';
import {entryMode,interactionCategory,conversationThreads} from './interaction-presentation.mjs';
import {interactionMode,interactionLabel} from './interaction-grammar.mjs';
import {CounterpartUI} from './counterpart-ui.mjs';
import {AdoptionUI} from './adoption-ui.mjs';
import {PremiseUI} from './premise-ui.mjs';
import {ReflectionUI} from './reflection-ui.mjs';
import {isReflection,isDisagreementPoint} from './reflection.mjs';
import {confidenceForm} from './confidence-ui.mjs';
import {setNodeConfidence} from './confidence.mjs';
import {isAdoptionReceipt} from './adoption-fulfillment.mjs';
import {ReasoningUI} from './reasoning-ui.mjs';
import {makeDiscussion,discussionLayer,discussionSource,discussionTargetLabel,discussionHealth,DISCUSSION_LABELS,isReason,isChallenge,canExplainReasoning} from './discussion.mjs';
import {comparisonPairKey,validateWorkspace} from './workspace.mjs';
import {comparisonNodeKey,visibleComparisonEndpoint,comparisonEndpoint,comparisonDisplayRects} from './comparison-layout.mjs';
import {graphEdges,revealPath,STRUCTURAL_TYPES,RELATION_TYPES} from './model.mjs';
import {CARD_W,CARD_H} from './layout.mjs';
import {routeStraightConnection} from './reasoning-layout.mjs';
import {stableJSON} from './account-model.mjs';
import {conversationAnchor,conversationGroups,challengeState,groupSourceConnections,projectComparisonConnections,actualNodePairKey,visibleNodePairKey} from './conversation-tree.mjs';
const discussEl=(tag,text='',className='')=>{const e=document.createElement(tag);e.textContent=text;e.className=className;return e;};
const discussButton=(text,fn,className='')=>{const b=discussEl('button',text,className);b.type='button';b.onclick=fn;return b;};
const discussUI=id=>document.getElementById(id);
const contributionLabel=r=>r.kind==='interaction'?interactionLabel(r):r.kind==='argument'&&r.action==='evidence'?'Evidence':DISCUSSION_LABELS[r.action];


export class DiscussionUI{
  constructor(c){
    this.c=c;this.canvas=c.canvas;this.layers={map:true,inquiries:true,arguments:true};this.target=null;this.dirty=false;
    this.groupTarget=null;this.counterparts=new CounterpartUI(this);this.adoption=new AdoptionUI(this);this.premises=new PremiseUI(this);this.reflections=new ReflectionUI(this);this.interactions=new InteractionUI(this);
    this.canvas.options.canSetConfidence=(map,node)=>map.ownerId===this.actor()&&node.parent!==null&&node.kind==='position';
    this.canvas.options.onConfidence=(side,id)=>{if(!this.canLeave())return;this.c.selectSource(side,id);this.confidence();};
    this.canvas.options.afterBuild=()=>this.draw();this.canvas.options.afterGeometry=()=>this.position();this.canvas.options.afterCamera=()=>this.positionPopover();
    this.host=discussEl('section','','discussion-popover');this.host.hidden=true;this.host.setAttribute('aria-label','On-map conversation');this.canvas.surface.append(this.host);
    this.host.addEventListener('toggle',()=>this.positionPopover(),true);
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
    const changeMaps=discussButton('Change maps',()=>this.c.library.changeComparisonMaps(),'discussion-secondary');changeMaps.id='change-comparison-maps';changeMaps.setAttribute('aria-controls','comparison-map-setup');controls.append(changeMaps);
    this.optionsBody=options;options.append(document.querySelector('.comparison-map-toolbar'),this.canvas.layerControls,discussUI('comparison-view-modes'),earlier);
    const key=discussEl('details','','connection-key');key.append(discussEl('summary','Connection key'));
    for(const [kind,label]of [['organization','Organization: parent and child'],['directed','Directed source connection'],['counterpart','Counterpart: comparable material, without agreement']]){const row=discussEl('p'),sample=discussEl('span','',`connection-key-sample ${kind}`);sample.setAttribute('aria-hidden','true');row.append(sample,document.createTextNode(label));key.append(row);}key.append(discussEl('p','Earlier judgments keep their meanings in connection details.','field-help'));options.append(key);
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
    for(const b of controls.querySelectorAll(':scope > [data-layer]'))if(b.dataset.layer!=='inquiries'){options.append(b);if(b.dataset.layer==='arguments')b.hidden=true;}
    this.reasoning=new ReasoningUI(this);
    this.search=new InteractionSearchUI(this);
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
  mode(){return this.reasoning?.mode||'compare';}
  entryMode(record){
    return entryMode(this.c.workspace.discussions,record);
  }
  activateMode(mode){this.reasoning.activateScope();this.reasoning.mode=mode;this.reasoning.sync();}
  recentConversations(records){
    const byId=new Map(this.allEntries().map(r=>[r.id,r])),latest=new Map();
    for(const r of this.allEntries().filter(r=>this.entryMode(r)===this.mode())){const date=Date.parse(r.updatedAt||r.createdAt)||0,seen=new Set();let current=r;while(current&&!seen.has(current.id)){seen.add(current.id);if((latest.get(current.id)||0)<date)latest.set(current.id,date);current=byId.get(current.target?.entryId);}}
    return [...records].sort((a,b)=>(latest.get(b.id)||Date.parse(b.updatedAt||b.createdAt)||0)-(latest.get(a.id)||Date.parse(a.updatedAt||a.createdAt)||0)||a.id.localeCompare(b.id));
  }
  applyMode(){
    this.controls.querySelector('[data-layer="inquiries"]').hidden=true;
    if(this.dirty||this.host.querySelector('form')){this.host.hidden=this.hostMode!==this.mode();return;}
    if(this.host.hidden)return;
    const record=this.viewId&&this.c.workspace.discussions.find(r=>r.id===this.viewId);
    if(record&&this.entryMode(record)===this.mode()){this.open(record.id,{context:true});return;}
    if(['entry','inference'].includes(this.target?.type)){const source=this.c.workspace.discussions.find(r=>r.id===this.target.entryId);this.target=source&&conversationAnchor(this.c.workspace.discussions,source);}
    this.viewId=null;this.groupTarget=null;if(this.target)this.actions();else this.list();
  }
  canLeave(){if(this.dirty&&!confirm('Discard this unsaved conversation draft?'))return false;this.canvas.sourceHighlights.select(null);this.dirty=false;this.viewId=null;this.editingContributionId=null;this.groupTarget=null;this.collapsedBranchKey=null;this.connectionReturn=null;this.confidenceReturn=null;this.host.hidden=true;this.host.replaceChildren();this.c.status();return true;}
  close(){const entry=this.viewId,connectionReturn=this.connectionReturn,confidenceReturn=this.confidenceReturn,counterpartReturn=this.counterparts.returnControl;if(!this.canLeave())return;this.groupTarget=null;this.target=null;this.confidenceReturn=null;this.counterparts.returnControl=null;this.draw();if(counterpartReturn&&this.counterparts.focusReturn?.(counterpartReturn))return;const counterpartSide=counterpartReturn&&['a','b'].find(side=>this.canvas.states[side].map?.id===counterpartReturn.mapId),counterpartFocus=counterpartSide&&this.canvas.cards.get(comparisonNodeKey(counterpartSide,counterpartReturn.nodeId))?.querySelector('.node-main'),marker=entry&&[...this.canvas.world.querySelectorAll('[data-entry]')].find(el=>el.dataset.entry===entry),connectionFocus=connectionReturn&&([...this.canvas.world.querySelectorAll('[data-connection-branch],[data-connection-pair]')].find(el=>connectionReturn.branchKey?el.dataset.connectionBranch===connectionReturn.branchKey:el.dataset.connectionPair===connectionReturn.pairKey)||this.canvas.cards.get(connectionReturn.nodeKey)?.querySelector('.node-main')),confidenceFocus=confidenceReturn&&this.canvas.cards.get(confidenceReturn)?.querySelector('.node-confidence');(counterpartFocus||confidenceFocus||connectionFocus||marker||(this.returnFocus?.isConnected?this.returnFocus:this.canvas.surface)).focus({preventScroll:true});}
  shell(title){this.viewOptions.open=false;this.viewId=null;this.hostMode=this.mode();this.host.replaceChildren();this.host.hidden=false;const header=discussEl('header');header.append(discussEl('strong',title),discussButton('Close',()=>this.close()));this.host.append(header);this.positionPopover();}
  actionGroup(title,buttons){if(!buttons.length)return;const section=discussEl('section','','discussion-action-group'),actions=discussEl('div','','discussion-actions');section.append(discussEl('h3',title));actions.append(...buttons);section.append(actions);this.host.append(section);}
  selectNode(side,id){if(!this.canLeave())return;this.counterparts.returnControl=null;this.confidenceReturn=null;this.target={type:'node',mapId:this.c.sides[side].mapId,nodeId:id};this.returnFocus=this.canvas.cards.get(comparisonNodeKey(side,id))?.querySelector('.node-main');this.actions();}
  selectTarget(target){if(!this.canLeave())return false;this.counterparts.returnControl=null;this.confidenceReturn=null;this.target=target;this.returnFocus=document.activeElement;this.canvas.sourceHighlights.select(this.sourceEdgeKeys?.get(stableJSON(target))||null);this.actions();return true;}
  attachmentCategory(record){const category=interactionCategory(record);return category==='counterparts'?'questions':category;}
  revealInteraction(id,{responseContext=false}={}){
    const r=this.allEntries().find(record=>record.id===id);if(!r)return false;
    const returnFocus=document.activeElement?.closest('.interaction-search')?this.search.button:document.activeElement;if(!this.canLeave())return false;
    this.activateMode(this.entryMode(r));this.reasoning.anchor=null;this.reasoning.focusId=null;this.reasoning.returnId=null;
    const anchor=conversationAnchor(this.c.workspace.discussions,r),canvas=this.canvas;
    const reveal=target=>{const side=['a','b'].find(s=>canvas.states[s].map?.id===target?.mapId),source=discussionSource(this.c.workspace,target);if(!side||!source)return;const state=canvas.states[side],ids=target.type==='node'?[target.nodeId]:target.type==='edge'?[source.item.from,source.item.to]:[];for(const nodeId of ids)state.expanded=revealPath(state.map.nodes,nodeId,state.expanded);if(ids.length){state.frame='all';discussUI('compare-frame-'+side).value='all';}};
    if(anchor?.type==='entry'){const linked=this.allEntries().find(record=>record.id===anchor.entryId);if(linked){reveal(linked.target);reveal(linked.other);}}else reveal(anchor);
    canvas.reflow({animate:false});
    const p=this.point(anchor);if(p){const x=p.x*canvas.camera.z+canvas.camera.x,y=p.y*canvas.camera.z+canvas.camera.y,w=(p.w||CARD_W)*canvas.camera.z/2,h=(p.h||CARD_H)*canvas.camera.z/2;if(x-w<24||x+w>canvas.surface.clientWidth-24||y-h<24||y+h>canvas.surface.clientHeight-24){canvas.camera={...canvas.camera,x:canvas.surface.clientWidth/2-p.x*canvas.camera.z,y:canvas.surface.clientHeight/2-p.y*canvas.camera.z};canvas.drawCamera();}}
    if(responseContext&&r.kind==='interaction'&&r.action==='respond')this.interactions.open(r.target.entryId,{selectedResponse:id});else this.open(id);
    this.returnFocus=returnFocus;return true;
  }
  confidence(){
    if(!this.canLeave())return;const target=this.target,source=discussionSource(this.c.workspace,target);
    if(target?.type!=='node'||source?.map.ownerId!==this.actor()||source.item.parent===null||source.item.kind!=='position')return;
    const side=['a','b'].find(key=>this.c.sides[key].mapId===target.mapId);this.confidenceReturn=comparisonNodeKey(side,target.nodeId);
    this.shell('Confidence');this.host.append(confidenceForm(source.item,{cancel:()=>{this.dirty=false;this.close();},save:value=>{
      if(!this.c.editor.flushDraft())throw Error('Resolve the unfinished map edit before saving confidence.');this.c.captureActive();
      const map=this.c.workspace.maps.find(m=>m.id===target.mapId);setNodeConfidence(this.c.workspace,target,this.actor(),value);
      if(this.c.activeMapId===map.id){this.c.baseline=JSON.stringify({nodes:map.nodes,relations:map.relations});this.c.editor.updateConfidence(target.nodeId,value);}
      this.dirty=false;this.c.markDirty();this.c.renderComparison();this.close();
    }}));this.positionPopover();this.host.querySelector('input')?.focus({preventScroll:true});
  }
  actions(){this.interactions.sourceActions();}
  legacyEditingAllowed(kind,target){
    if(['counterpart','context'].includes(kind))return true;
    if(kind!=='reply')return false;
    const seen=new Set();let current=this.c.workspace.discussions.find(r=>r.id===target?.entryId);
    while(current&&!seen.has(current.id)){if(current.kind==='counterpart')return true;seen.add(current.id);current=this.c.workspace.discussions.find(r=>r.id===current.target?.entryId);}return false;
  }
  compose(kind,action,old=null,extra={}){
    if(!this.legacyEditingAllowed(kind,old?.target||this.target)){this.c.message('This earlier interaction is available as history. Select a source to use the current modes.');return;}
    if(kind==='reflection'){this.reflections.compose(old?.target||this.target,old,action==='outcome');return;}
    if(old?.premise){this.premises.review(old);return;}
    if(!this.canLeave())return;this.groupTarget=null;const target=old?.target||this.target,{title,...saveExtra}=extra;this.target=target;this.activateMode(this.entryMode({...old,...saveExtra,kind,action,target}));this.editingContributionId=old?.id||null;this.shell(old?'Edit contribution':title||contributionLabel({kind,action}));
    const reasoning=kind==='argument'&&action==='reason',argumentReply=kind==='reply'&&(old?.layer||saveExtra.layer)==='arguments';
    const form=discussEl('form'),fieldLabel=kind==='context'?'Author’s definitions and standards':kind==='inquiry'?'Your question':reasoning?'Your reason':kind==='argument'?'Your challenge':['counterpart','adoption'].includes(kind)?'Optional note':'Description';const label=discussEl('label',fieldLabel);label.htmlFor='discussion-body';
    let options=kind==='inquiry'?['question','explain','example','evidence','change_mind']:kind==='argument'&&!reasoning?['challenge','inference','counterexample','fallacy']:kind==='relationship'?['agreement','disagreement']:null;
    if(reasoning||kind==='argument'||argumentReply)form.append(discussEl('p',target.type==='inference'?'Addresses the reasoning connection, not the node itself.':`Addresses: ${discussionTargetLabel(this.c.workspace,target)}`,'discussion-target-note'));
    if(old&&options&&!options.includes(action))options=[...options,action];
    const select=discussEl('select');select.id='discussion-action';select.setAttribute('aria-label','Contribution type');if(options){for(const value of options){const o=discussEl('option',value==='change_mind'?'What would change your mind?':contributionLabel({kind,action:value}));o.value=value;select.append(o);}select.value=action;if(kind!=='argument')form.append(select);}
    const body=discussEl('textarea');body.id='discussion-body';body.rows=5;body.maxLength=10000;body.value=old?.body||'';body.required=!['counterpart','adoption','relationship'].includes(kind);
    const prompts={explain:'Could you explain this in more detail?',example:'Could you give an example?',evidence:'What evidence supports this?',change_mind:'What would change your mind?'};
    body.placeholder=reasoning?'Explain why this supports your position.':argumentReply?'Explain your response.':kind==='context'?'Define key terms, then describe the standards or criteria used here.':kind==='counterpart'?'Describe the counterpart you are looking for.':kind==='adoption'?'Explain why this node may belong in the other person’s map.':kind==='relationship'?'Describe the relationship (optional).':kind==='argument'?'Explain the problem you see.':'Write your question.';
    if(options)select.onchange=()=>{if(kind==='inquiry'&&(!body.value||Object.values(prompts).includes(body.value)))body.value=prompts[select.value]||'';this.dirty=true;};
    if(!old&&kind==='inquiry'&&prompts[action])body.value=prompts[action];
    const reference=discussEl('input');reference.type='url';reference.id='discussion-reference';reference.maxLength=2000;reference.placeholder='https://';reference.value=old?.referenceUrl||'';
    if(kind==='counterpart'){const thread=this.thread(),other=this.c.workspace.maps.find(m=>[thread?.aMapId,thread?.bMapId].includes(m.id)&&m.id!==target.mapId);form.append(discussEl('p',`Request to ${this.name(other?.ownerId)} to add a corresponding node.`,'field-help'));}
    if(kind==='adoption'){const thread=this.thread(),other=this.c.workspace.maps.find(m=>[thread?.aMapId,thread?.bMapId].includes(m.id)&&m.id!==target.mapId);form.append(discussEl('p',`Suggestion to ${this.name(other?.ownerId)} to consider this node for their map.`,'field-help'));}
    let referenceLabel=null;form.append(label,body);if(kind==='argument'&&!reasoning){const type=discussEl('details','','challenge-type');type.append(discussEl('summary','Type of challenge (optional)'),select);form.append(type);}if(old?.referenceUrl||reasoning||argumentReply){referenceLabel=discussEl('label','Reference link (optional)');referenceLabel.htmlFor=reference.id;form.append(referenceLabel,reference);}
    const readDefinitions=kind==='argument'||argumentReply?this.reasoning.definitionChoices(form,old):null;
    const submitLabels={inquiry:'Send question',argument:'Add challenge',counterpart:'Send request',adoption:'Send suggestion',relationship:'Record relationship',reply:'Post response',context:'Save definition'};
    const submit=discussEl('button',old?'Save changes':reasoning?'Add reason':['resolve','reopen','accept','maintain','no_position','not_applicable','close_request','reopen_request'].includes(action)?DISCUSSION_LABELS[action]:submitLabels[kind]||'Save','primary');submit.type='submit';form.append(submit);this.host.append(form);
    const premisePicker=reasoning?this.premises.attach(form,{body,label,reference,referenceLabel,definitions:form.querySelector('.reasoning-definition-choices'),submit,target,old}):null;
    form.onsubmit=e=>{e.preventDefault();if(premisePicker?.active()){premisePicker.save();return;}this.save({...old,...saveExtra,kind,action:options?(select.value==='change_mind'?'question':select.value):action,target,body:body.value,referenceUrl:reference.value,...(readDefinitions?{definitionRefs:readDefinitions()}: {})},old);};this.draw();this.positionPopover();body.focus({preventScroll:true});
  }
  async save(input,old=null){
    if(this.saving)return;this.saving=true;this.host.inert=true;
    const affectsPair=['correspondence','relationship'].includes(input.kind),anchor=affectsPair?this.canvas.captureAnchor(this.counterparts.returnControl||input.target):null;
    try{
      const thread=input.kind==='context'?null:await this.c.ensureComparison();
      const value=makeDiscussion(this.c.workspace,{...input,comparisonId:thread?.id||null},this.actor(),old);
      const candidate={...this.c.workspace,discussions:[...(this.c.workspace.discussions||[]).filter(r=>r.id!==value.id),value]};validateWorkspace(candidate);this.c.workspace=candidate;this.dirty=false;this.c.markDirty();
      if(thread){this.c.activeComparisonPair=comparisonPairKey(thread);this.c.setComparisonRoute(thread.id);}
      if(value.kind!=='interaction'&&discussionLayer(value)==='arguments'&&value.status==='active')this.reasoning.focusEntry(value);
      this.c.renderComparison();this.canvas.restoreAnchor(anchor);this.c.library.render();this.saving=false;if(value.status==='active')this.open(value.id);else this.close();
    }catch(e){let error=this.host.querySelector('[role=alert]');if(!error){error=discussEl('p');error.setAttribute('role','alert');this.host.append(error);}error.textContent=e.message;}finally{this.saving=false;this.host.inert=false;}
  }
  open(id,{context=false,mode=null}={}){
    if(this.c.workspace.discussions?.find(r=>r.id===id)?.kind==='interaction'){this.interactions.open(id);return;}
    const annotation=this.c.workspace.discussions?.find(r=>r.id===id&&isReflection(r));if(annotation){this.reflections.open(annotation);return;}
    if(!this.canLeave())return;const r=this.c.workspace.discussions?.find(e=>e.id===id);if(!r)return;const recordMode=this.entryMode(r);if(mode)this.activateMode(mode);else if(recordMode==='argument'||!context&&this.mode()!=='argument')this.activateMode(recordMode);this.target={type:'entry',entryId:id};this.returnFocus=document.activeElement;this.shell(contributionLabel(r));this.viewId=id;this.groupTarget=null;
    if(recordMode!==this.mode())this.host.append(discussButton('Open in Compare',()=>this.open(r.id,{mode:'compare'}),'discussion-parent-link'));
    const anchor=conversationAnchor(this.c.workspace.discussions,r);
    if(anchor&&r.kind!=='context')this.host.append(discussButton('All attached conversations',()=>this.openGroup(anchor),'discussion-text-action'));
    if(r.target.type==='inference')this.host.append(discussButton('Addresses: reasoning connection',()=>this.reasoning.openInference(r.target.entryId),'discussion-parent-link'));
    if(r.target.type==='entry'){const parent=this.c.workspace.discussions.find(p=>p.id===r.target.entryId);if(parent)this.host.append(discussButton(this.entryMode(parent)===this.mode()?`Responding to: ${contributionLabel(parent)} by ${this.name(parent.authorId)}`:`Open parent in ${this.entryMode(parent)==='argument'?'Argument':'Compare'}`,()=>this.open(parent.id,{mode:this.entryMode(parent)}),'discussion-parent-link'));}
    if(isChallenge(r))this.host.append(discussEl('p',challengeState(this.entries(),r),'discussion-state'));
    const byline=r.kind==='relationship'?`Recorded by ${this.name(r.authorId)} · Source: ${r.targetLabel}`:`${this.name(r.authorId)} · Source: ${r.targetLabel}`;
    if(r.status==='withdrawn')this.host.append(discussEl('p','Withdrawn','discussion-state'));this.host.append(discussEl('p',byline,'discussion-byline'));if(!r.premise)this.host.append(discussEl('p',r.body|| (r.kind==='relationship'?'Relationship recorded.':r.kind==='adoption'?'Please consider adopting this node.':'Please add a corresponding node.'),'discussion-body'));
    if(r.premise)this.premises.render(r);
    if(r.referenceUrl){const link=discussEl('a','Open evidence / reference');link.href=r.referenceUrl;link.target='_blank';link.rel='noopener noreferrer';this.host.append(link);}
    if(this.reasoning.hasDefinitions(r))this.host.append(discussButton('View invoked definitions & standards',()=>this.reasoning.showDefinitions(r)));
    if(discussionLayer(r)==='arguments'){this.host.append(discussButton('Follow argument',()=>this.reasoning.follow({type:'entry',entryId:r.id})),discussButton('Back to source',()=>{this.reasoning.anchor=anchor;this.reasoning.back();}));}
    const health=discussionHealth(this.c.workspace,r);
    if(['changed','unavailable'].includes(health.state))this.host.append(discussEl('p',health.label,'review-warning'));
    this.sourceHistory(r,health);
    const allResponses=this.allEntries().filter(e=>['entry','inference'].includes(e.target.type)&&e.target.entryId===id),responses=allResponses.filter(e=>!isReflection(e)&&this.entryMode(e)===this.mode()).sort((a,b)=>(Date.parse(a.createdAt)||0)-(Date.parse(b.createdAt)||0)||a.id.localeCompare(b.id));
    if(responses.length){const heading=discussEl('h3','Conversation');this.host.append(heading);for(const reply of responses){const card=discussButton('',()=>this.open(reply.id),'discussion-reply discussion-list-item');card.dataset.entry=reply.id;card.append(discussEl('strong',`${contributionLabel(reply)} · ${this.name(reply.authorId)}${reply.status==='withdrawn'?' · Withdrawn':''}`),discussEl('p',reply.body));this.host.append(card);}}
    if(this.mode()==='compare'&&allResponses.some(e=>this.entryMode(e)==='argument'))this.host.append(discussButton('Open attached argument',()=>this.reasoning.follow({type:'entry',entryId:r.id}),'discussion-parent-link'));
    if(this.mode()==='compare'&&(r.kind==='adoption'||isAdoptionReceipt(r)))this.adoption.state(r);
    if(r.status==='active'){
      if(this.mode()==='compare'&&r.kind==='counterpart'){
        this.counterparts.requestActions(r);
        if(r.authorId!==this.actor()&&this.counterparts.canLink(r.target)&&this.counterparts.otherMap(r.target)?.ownerId===this.actor())this.actionGroup('Respond',[discussButton('Respond',()=>this.compose('reply','reply',null,{layer:discussionLayer(r)}))]);
      }
      if(['relationship','correspondence'].includes(r.kind))this.actionGroup('Connected nodes',[discussButton('Show connected nodes',()=>this.showConnectedNodes({key:actualNodePairKey(r.target,r.other)}))]);
      if(isReason(r))this.actionGroup('Earlier reasoning',[discussButton('Inspect reasoning connection',()=>this.reasoning.openInference(r.id))]);
    }
    this.reflections.attach(this.target);
    if(recordMode===this.mode()&&r.authorId===this.actor()&&!isAdoptionReceipt(r)&&r.status==='active'){
      const buttons=[];if(this.legacyEditingAllowed(r.kind,r.target))buttons.push(discussButton('Edit',()=>r.kind==='context'&&r.definitionRefs?this.c.library.definitions.choose(r.target):this.compose(r.kind,r.action,r)));
      buttons.push(discussButton('Withdraw',()=>{if(confirm('Withdraw your contribution? Its history will remain saved.'))this.save({...r,status:'withdrawn'},r);}));this.actionGroup('Manage',buttons);
    }
    if(r.history.length){const details=discussEl('details');details.append(discussEl('summary','Earlier wording'));for(const v of r.history)details.append(discussEl('p',`${DISCUSSION_LABELS[v.action]} · ${v.body||'No description'}`));this.host.append(details);}
    this.draw();this.positionPopover();
  }
  sourceHistory(r,health){
    const details=discussEl('details','','discussion-source-history');details.append(discussEl('summary','Source wording & history'));
    const renderSnapshot=s=>this.reflections.sourcePreview(s);
    const add=(title,snapshots)=>{details.append(discussEl('strong',title));if(!snapshots){details.append(discussEl('p','Not captured for this earlier contribution.'));return;}for(const s of snapshots)details.append(renderSnapshot(s));};
    add('Originally discussed',r.sourceSnapshots);if(r.reviewedSources)add('Last reviewed',r.reviewedSources);if(health.needsReview)add('Current source',health.current);
    if(this.legacyEditingAllowed(r.kind,r.target)&&r.authorId===this.actor()&&health.state==='changed'&&!isAdoptionReceipt(r)&&!isReflection(r)&&(!r.premise||stableJSON(health.current)!==stableJSON(r.reviewedSources||r.sourceSnapshots)))details.append(discussButton(r.premise?'Confirm current conclusion wording':'Confirm current source wording',()=>this.save({...r,reviewSources:true},r)));
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
    const children=this.entries().filter(e=>e.target.entryId===r.id&&this.entryMode(e)===this.mode()),b=discussButton('',()=>this.open(r.id),'discussion-list-item');
    b.dataset.entry=r.id;b.append(discussEl('strong',`${contributionLabel(r)} · ${this.name(r.authorId)}`),discussEl('p',r.body||'Open request','discussion-body'));
    if(isChallenge(r))b.append(discussEl('small',challengeState(this.entries(),r)));
    if(children.length)b.append(discussEl('small',` · ${children.length} follow-ups`));return b;
  }
  openGroup(target,kind=null,groups=null){
    const selected=groups||conversationGroups(this.allEntries()).filter(g=>stableJSON(g.target)===stableJSON(target));
    this.interactions.list(target,selected.flatMap(g=>g.entries),{category:kind});
  }
  listArguments(){this.activateMode('argument');this.interactions.list();}
  list(){this.interactions.list();}
  projectConnections(){
    const previous=this.canvas.records.map(r=>({...r,legacy:true,target:{type:'node',mapId:r.aMapId,nodeId:r.aNodeId},other:{type:'node',mapId:r.bMapId,nodeId:r.bNodeId}}));
    const endpoint=target=>{const side=['a','b'].find(s=>this.canvas.states[s].map?.id===target?.mapId);return side?comparisonEndpoint(this.canvas.layout,side,target.nodeId):{status:'unavailable'};};
    return projectComparisonConnections([...this.entries().filter(r=>['relationship','correspondence'].includes(r.kind)),...previous],endpoint);
  }
  connectionSourceLabel(target){
    const source=discussionSource(this.c.workspace,target);if(!source)return 'Source no longer available';
    const path=[],seen=new Set();let n=source.item;
    while(n&&!seen.has(n.id)){seen.add(n.id);path.unshift(n.title);n=source.map.nodes.find(item=>item.id===n.parent);}
    return `${this.name(source.map.ownerId)} · ${path.join(' › ')}`;
  }
  connectionRecords(group){
    const records=[...group.records],seen=new Set(records.map(r=>r.id));
    for(const r of this.allEntries())if(['relationship','correspondence'].includes(r.kind)&&actualNodePairKey(r.target,r.other)===group.key&&!seen.has(r.id)){seen.add(r.id);records.push(r);}
    return records.sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||'')||a.id.localeCompare(b.id));
  }
  connectionDetails(group,host){
    host.append(discussEl('p',this.connectionSourceLabel(group.target),'connection-source-label'),discussEl('p',this.connectionSourceLabel(group.other),'connection-source-label'));
    for(const r of this.connectionRecords(group)){
      const count=this.allEntries().filter(e=>['entry','inference'].includes(e.target.type)&&e.target.entryId===r.id).length;
      const label=r.legacy?`Earlier comparison · ${r.question}`:`${r.kind==='correspondence'?'Counterpart link':contributionLabel(r)} · ${this.name(r.authorId)}${r.status==='withdrawn'?' · Withdrawn':''}`;
      const button=discussButton(label,()=>r.legacy?this.c.openRecord(r.id):this.open(r.id),'discussion-list-item');button.dataset.entry=r.id;
      if(count)button.append(discussEl('small',`${count} saved ${count===1?'follow-up':'follow-ups'}`));host.append(button);
    }
    const show=discussButton('Show connected nodes',()=>this.showConnectedNodes(group));show.dataset.showConnection=group.key;host.append(show);
  }
  openConnection(group,label,anchor,{details=false}={}){
    const target=group.target||group.records[0]?.target,side=['a','b'].find(side=>this.canvas.states[side].map?.id===target?.mapId),returnTo={pairKey:group.key,nodeKey:side&&comparisonNodeKey(side,target.nodeId)};
    if(!details&&group.records.length===1){const r=group.records[0];if(r.legacy){if(this.canLeave()){this.c.openRecord(r.id);return true;}}else{this.open(r.id);if(this.viewId===r.id&&!this.host.hidden){this.connectionReturn=returnTo;this.host.querySelector('header button')?.focus({preventScroll:true});return true;}}return false;}
    if(!this.canLeave())return false;this.target=anchor;this.shell(label);this.connectionReturn=returnTo;this.connectionDetails(group,this.host);this.positionPopover();this.host.querySelector('header button')?.focus({preventScroll:true});return true;
  }
  openCollapsedConnections(key){
    const branch=this.projectConnections().branches.find(b=>b.key===key);if(!branch||!this.canLeave())return;
    this.target={type:'node',mapId:branch.endpoint.mapId,nodeId:branch.endpoint.visibleId};this.shell('Connections inside this branch');
    this.collapsedBranchKey=key;this.connectionReturn={branchKey:key};
    for(const group of branch.groups){const section=discussEl('section','','collapsed-connection-pair');section.dataset.connectionPair=group.key;this.connectionDetails(group,section);this.host.append(section);}
    this.draw();this.positionPopover();this.host.querySelector('header button')?.focus({preventScroll:true});
  }
  showConnectedNodes(group){
    const current=this.projectConnections().groups.find(g=>g.key===group.key);if(!current||current.ends.some(e=>!e||['missing','unavailable'].includes(e.status))){this.c.message('These connected sources are no longer available. Their permitted history remains in Conversations or Earlier records.');return;}
    if(!this.canLeave())return;const canvas=this.canvas,zoom=canvas.camera.z,filtered=current.status==='filtered';
    for(const target of [current.target,current.other]){
      const side=['a','b'].find(s=>canvas.states[s].map?.id===target.mapId),state=canvas.states[side];
      state.expanded=revealPath(state.map.nodes,target.nodeId,state.expanded);state.selected=target.nodeId;state.frame='all';this.c.sides[side].nodeId=target.nodeId;discussUI('compare-frame-'+side).value='all';
    }
    this.reasoning.anchor=null;this.reasoning.focusId=null;this.c.renderComparison();
    const points=[this.point(current.target),this.point(current.other)];canvas.camera.z=zoom;
    const outside=points.some(p=>p.x*zoom+canvas.camera.x-CARD_W*zoom/2<24||p.x*zoom+canvas.camera.x+CARD_W*zoom/2>canvas.surface.clientWidth-24||p.y*zoom+canvas.camera.y-CARD_H*zoom/2<24||p.y*zoom+canvas.camera.y+CARD_H*zoom/2>canvas.surface.clientHeight-24);
    if(outside){canvas.camera.x=canvas.surface.clientWidth/2-(points[0].x+points[1].x)*zoom/2;canvas.camera.y=canvas.surface.clientHeight/2-(points[0].y+points[1].y)*zoom/2;}canvas.drawCamera();
    const anchor={type:'connection',a:current.target,b:current.other,key:current.key};this.openConnection(current,'Connected nodes',anchor,{details:true});
    if(filtered)this.host.append(discussEl('p','The frame filter was cleared to reveal both connected nodes.','field-help'));
    const side=['a','b'].find(s=>canvas.states[s].map?.id===current.target.mapId);this.connectionReturn={pairKey:current.key,nodeKey:comparisonNodeKey(side,current.target.nodeId)};
    this.positionPopover();this.host.querySelector('header button')?.focus({preventScroll:true});
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
    const canvas=this.canvas;if(!canvas.layout)return;this.reasoning?.activateScope();canvas.sourceHighlights.reset();canvas.world.querySelectorAll('.discussion-drawing,.discussion-context-icon').forEach(e=>e.remove());
    for(const link of canvas.links||[]){link.path.remove();link.hit?.remove();link.badge?.remove();}
    this.items=[];const svg=canvas.svgElement('svg',{});svg.classList.add('discussion-drawing','discussion-lines');canvas.world.append(svg);this.svg=svg;
    const defs=canvas.svgElement('defs',{}),marker=canvas.svgElement('marker',{id:'comparison-source-arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:5,markerHeight:5,orient:'auto-start-reverse'});marker.append(canvas.svgElement('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#758995'}));defs.append(marker);svg.append(defs);
    for(const card of canvas.cards.values())card.hidden=!this.layers.map;
    canvas.world.querySelectorAll('.comparison-lines,.comparison-map-lane,.comparison-link-label').forEach(e=>e.style.visibility=this.layers.map?'':'hidden');
    // Reuse the tree's existing path where available. A transparent hit area
    // follows that same route; it is not a second visible connection.
    this.sourceEdgeKeys=new Map();this.connectionKeys=new Map();
    if(this.layers.map)for(const side of ['a','b']){const map=canvas.states[side].map;if(!map||map.unavailable)continue;
      for(const grouped of groupSourceConnections(graphEdges(map.nodes,map.relations))){
        const edges=[...grouped].sort((a,b)=>Number(a.structural)-Number(b.structural)||a.id.localeCompare(b.id));
        const edge=edges[0],targets=edges.map(e=>({type:'edge',mapId:map.id,edgeId:e.id})),target=targets[0];
        const a={type:'node',mapId:map.id,nodeId:edge.from},b={type:'node',mapId:map.id,nodeId:edge.to};
        if(!canvas.layout.maps[side]?.positions.has(edge.from)||!canvas.layout.maps[side]?.positions.has(edge.to))continue;
        const key=visibleNodePairKey(comparisonNodeKey(side,edge.from),comparisonNodeKey(side,edge.to));for(const t of targets)this.sourceEdgeKeys.set(stableJSON(t),key);
        const branch=canvas.branches.find(e=>e.side===side&&visibleNodePairKey(e.edge.from,e.edge.to)===visibleNodePairKey(edge.from,edge.to));
        const path=branch?.path||canvas.svgElement('path',{fill:'none'});path.classList.add('discussion-source-edge','source-connection-path');path.dataset.nodePair=key;path.dataset.side=side;path.dataset.identity=canvas.identity(side);path.removeAttribute('stroke-dasharray');
        path.removeAttribute('marker-start');path.removeAttribute('marker-end');
        if(edges.some(e=>!e.structural&&RELATION_TYPES[e.type]?.directed&&e.from===edge.from))path.setAttribute('marker-end','url(#comparison-source-arrow)');
        if(edges.some(e=>!e.structural&&RELATION_TYPES[e.type]?.directed&&e.from===edge.to))path.setAttribute('marker-start','url(#comparison-source-arrow)');
        const hit=canvas.svgElement('path',{class:'discussion-edge-hit',fill:'none',tabindex:'0',role:'button','aria-label':`Select connection ${discussionTargetLabel(this.c.workspace,target)}`});
        const select=()=>{if(!this.selectTarget(target))return;if(edges.length>1){const details=discussEl('details');details.append(discussEl('summary','Connection details'));for(const e of edges){const t={type:'edge',mapId:map.id,edgeId:e.id};details.append(discussButton((e.structural?STRUCTURAL_TYPES[e.type]:RELATION_TYPES[e.type])?.label||e.type,()=>this.selectTarget(t)));}this.host.append(details);this.positionPopover();}};
        hit.onclick=select;hit.onpointerdown=e=>e.stopPropagation();hit.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();select();}};
        if(!branch)svg.append(path);svg.append(hit);canvas.sourceHighlights.bind(key,path,hit,[edge.from,edge.to].map(id=>canvas.cards.get(comparisonNodeKey(side,id))));this.items.push({type:'edge',target,targets,a,b,path,hit,branch,sourceKey:key});
        if(targets.some(t=>this.c.workspace.discussions.some(r=>r.kind==='context'&&r.status==='active'&&stableJSON(r.target)===stableJSON(t))))this.badge('▤',target,()=>this.openEdgeContexts(targets),'Definitions and standards for '+discussionTargetLabel(this.c.workspace,target));
      }
    }
    for(const r of this.c.workspace.discussions||[])if(r.kind==='context'&&r.status==='active'&&r.target.type==='node'&&this.layers.map){const side=['a','b'].find(s=>canvas.states[s].map?.id===r.target.mapId),card=side&&canvas.cards.get(comparisonNodeKey(side,r.target.nodeId));if(card&&!card.querySelector('.discussion-context-icon')){const b=discussButton('▤',()=>this.openContexts(r.target),'discussion-context-icon');b.setAttribute('aria-label','Definitions and standards for '+r.targetLabel);card.querySelector('.node-bottom').append(b);}}
    const groups=conversationGroups(this.allEntries());
    const connections=this.projectConnections(),foldedRecords=new Set(connections.groups.filter(g=>g.status==='collapsed').flatMap(g=>g.records.filter(r=>!r.legacy).map(r=>r.id)));
    for(const connection of connections.visible){
      const records=connection.records,judgments=records.filter(r=>!r.legacy&&r.kind==='relationship'),r=judgments[0]||records.find(r=>!r.legacy)||records[0];
      const mixed=new Set(judgments.map(e=>e.action)).size>1,action=mixed?'mixed':r.legacy?'earlier':r.action;
      let label=mixed?'Mixed judgments':r.legacy?'Earlier comparison':`${DISCUSSION_LABELS[r.action]} · ${r.kind==='correspondence'?'Linked':'Recorded'} by ${this.name(r.authorId)}`;
      if(judgments.length>1&&!mixed)label=`${DISCUSSION_LABELS[r.action]} · ${judgments.length} judgments`;
      if(this.mode()==='argument'&&records.some(e=>groups.some(g=>g.target.entryId===e.id&&g.openChallenges)))label+=' · Contested';
      if(records.some(e=>!e.legacy&&discussionHealth(this.c.workspace,e).state==='changed'))label+=' · Review source';
      const path=canvas.svgElement('path',{class:`discussion-relationship ${action}`,fill:'none'});path.dataset.nodePair=connection.key;
      const anchor={type:'connection',a:r.target,b:r.other,key:connection.key},open=()=>{if(this.openConnection(connection,label,anchor))this.counterparts.returnControl=null;};
      const hit=canvas.svgElement('path',{class:'discussion-edge-hit discussion-relationship-hit',fill:'none',tabindex:'0',role:'button','aria-label':`Select ${label}`});
      hit.dataset.connectionPair=connection.key;
      hit.onclick=open;hit.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();open();}};
      const edge={type:'edge',a:r.target,b:r.other,path,hit,connection:anchor};svg.append(path,hit);this.items.push(edge);
      this.badge(label,anchor,open,label,action);edge.badge=this.items.at(-1);edge.badge.edge=edge;
      this.items.at(-1).aliases=records.filter(e=>!e.legacy).map(e=>e.id);for(const e of records)this.connectionKeys.set(e.id,connection.key);
    }
    for(const branch of connections.branches){
      const card=canvas.cards.get(branch.key);if(!card)continue;card.hidden=false;
      const count=branch.groups.length,button=discussButton(`↔ ${count}`,()=>this.openCollapsedConnections(branch.key),'collapsed-connection-badge discussion-drawing');
      button.dataset.connectionBranch=branch.key;button.setAttribute('aria-label',`${count} ${count===1?'connection':'connections'} inside this branch`);button.title=button.getAttribute('aria-label');button.setAttribute('aria-expanded',String(!this.host.hidden&&this.collapsedBranchKey===branch.key));card.querySelector('.node-bottom').append(button);
    }
    // Collapse at the source. Hidden layers retain their counts and are still discoverable.
    const rails=new Map();
    for(const g of groups){
      // Hidden pair follow-ups remain available through that pair's branch
      // list and detail, rather than floating beside a fabricated proxy edge.
      if(g.target.type==='entry'&&foldedRecords.has(g.target.entryId))continue;
      let card=null;
      if(g.target.type==='node'){const side=['a','b'].find(s=>canvas.states[s].map?.id===g.target.mapId),end=side&&visibleComparisonEndpoint(canvas.layout,side,g.target.nodeId);card=end&&canvas.cards.get(end.key);}
      const key=card||(g.target.type==='edge'?this.sourceEdgeKeys.get(stableJSON(g.target)):g.target.type==='entry'?this.connectionKeys.get(g.target.entryId):null)||g.key;if(!rails.has(key))rails.set(key,{card,groups:[],target:g.target});rails.get(key).groups.push(g);
    }
    const activeThreads=conversationThreads(this.allEntries(),{mode:this.mode()});
    for(const rail of rails.values()){
      const shown=rail.groups.flatMap(g=>g.entries).filter(r=>this.entryMode(r)===this.mode());if(!shown.length)continue;
      const roots=activeThreads.filter(r=>shown.some(item=>item.id===r.id)),counts={questions:0,challenges:0,reasons:0,positions:0};for(const r of roots){const category=this.attachmentCategory(r);if(Object.hasOwn(counts,category))counts[category]++;}
      const bar=discussEl('span','','discussion-rail discussion-drawing');
      for(const [kind,icon]of [['positions','◇'],['reasons','↳'],['questions','?'],['challenges','!']])if(counts[kind]){
        const latest=shown.filter(r=>r.kind==='interaction'&&interactionMode(r)==='compare'&&r.action!=='respond').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];const text=kind==='positions'&&latest?`${interactionLabel(latest)} · ${this.name(latest.authorId)}`:`${icon} ${counts[kind]}`;const b=discussButton(text,()=>this.interactions.list(rail.target,shown,{category:kind}));b.setAttribute('aria-label',`${counts[kind]} ${kind} attached to ${discussionTargetLabel(this.c.workspace,rail.target)}`);b.setAttribute('aria-expanded',String(!this.host.hidden&&this.groupCategory===kind&&stableJSON(this.groupTarget)===stableJSON(rail.target)));b.className=kind;b.dataset.collapsed=String(!this.layers[kind==='questions'?'inquiries':'arguments']);b.title='Open attached '+kind;bar.append(b);
      }
      const points=shown.filter(isDisagreementPoint),pointMarker=this.reflections.marker(rail.target,points);if(pointMarker)bar.append(pointMarker);
      if(!counts.positions&&!counts.questions&&!counts.challenges&&!counts.reasons&&!points.length)continue;
      if(rail.card){rail.card.hidden=false;rail.card.querySelector('.node-bottom').append(bar);}
      else{canvas.world.append(bar);this.items.push({type:'badge',target:rail.target,b:bar});}
    }
    this.counterparts.draw();
    this.reasoning.draw();this.search?.sync();
    canvas.hint.textContent=this.mode()==='inquiry'?'Select another person’s node or connection to ask or offer something.':this.mode()==='compare'?'Select another person’s node or connection to record your position.':'Select another person’s node or reasoning connection to dispute it.';
    document.querySelector('.comparison-canvas-footer').textContent=this.mode()==='inquiry'?'Ask, clarify, or offer · Drag empty space to pan · Scroll to zoom':this.mode()==='compare'?'Record your position · Drag empty space to pan · Scroll to zoom':'Dispute a node or connection · Drag empty space to pan · Scroll to zoom';
    canvas.linkStatus.textContent=`${conversationThreads(this.allEntries()).length} conversations in this comparison`;
    document.querySelector('.comparison-heading').hidden=!!this.thread();
    discussUI('comparison-form').hidden=!this.c.editingRecord;
    discussUI('argument-mode').hidden=!this.c.workspace.comparisons.some(r=>r.comparisonId===this.thread()?.id);
    const threadKey=this.thread()?.id||null;if(this.viewThreadKey!==threadKey){this.viewOptions.open=false;this.viewThreadKey=threadKey;}
    discussUI('comparison-view-modes').hidden=discussUI('argument-mode').hidden;
    this.position();
  }
  badge(text,target,action,aria,style=''){const b=discussButton(text,action,`discussion-badge discussion-drawing ${style}`);b.setAttribute('aria-label',aria);b.title=aria;if(target.type==='entry')b.dataset.entry=target.entryId;this.canvas.world.append(b);this.items.push({type:'badge',target,b});}
  position(){
    if(!this.items)return;this.entryPositions=new Map();this.connectionPositions=new Map();const routeBounds=[],occupied=comparisonDisplayRects(this.canvas.layout,this.canvas.positions);
    this.canvas.ensureSourceRoutes();
    const overlaps=(x,y,w,h)=>occupied.some(r=>x<r.x+r.w+12&&x+w+12>r.x&&y<r.y+r.h+12&&y+h+12>r.y);
    for(const item of this.items){
      if(item.type==='edge'){
        const a=this.point(item.a),b=this.point(item.b);item.path.style.display=a&&b?'':'none';if(item.hit)item.hit.style.display=a&&b?'':'none';if(!a||!b){item.route=null;continue;}
        let d;
        if(item.connection){
          const label=item.badge.b;label.hidden=false;
          const sourcePoint=target=>{const side=['a','b'].find(side=>this.canvas.states[side].map?.id===target.mapId);return side&&this.canvas.positions.get(comparisonNodeKey(side,target.nodeId));},pa=sourcePoint(item.a),pb=sourcePoint(item.b),group=pa?.groupId&&pa.groupId===pb?.groupId&&this.canvas.layout.groups?.get(pa.groupId),adjacent=group?.members?.length===2,obstacles=occupied.map(r=>({x:r.x+r.w/2,y:r.y+r.h/2,w:r.w,h:r.h})),straight=adjacent&&routeStraightConnection(a,b,obstacles);
          item.route=straight&&!straight.blocked?{...straight,label:null}:this.canvas.routeConnection(a,b,obstacles,{w:label.offsetWidth,h:label.offsetHeight});d=item.route.d;item.path.dataset.adjacentPair=String(!!straight&&!straight.blocked);
          const attachment=item.route.label||item.route.midpoint;if(attachment){this.connectionPositions.set(item.connection.key,attachment);for(const id of item.badge.aliases||[])this.entryPositions.set(id,attachment);}
          routeBounds.push(...item.route.points.map(p=>({...p,w:0,h:0})));
        }else{item.route=this.canvas.sourceRoutes.get(item.sourceKey);d=item.route?.d||'';if(item.route)routeBounds.push(...item.route.points.map(p=>({...p,w:0,h:0})));}
        item.path.setAttribute('d',d);item.hit?.setAttribute('d',d);
        if(item.hit){const blocked=!item.route||item.route.blocked;item.hit.style.display=blocked?'none':'';item.hit.setAttribute('tabindex',blocked?'-1':'0');}
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
    x=Math.max(12,Math.min(surface.clientWidth-width-12,x));
    // Tall source previews and expanded definition choices must not cover the
    // argument navigation. Measure its wrapped height instead of stacking it
    // over the form, and keep the remaining form area independently scrollable.
    const tools=this.reasoning?.tools;let minY=12;
    if(tools&&!tools.hidden&&x<tools.offsetLeft+tools.offsetWidth+8&&x+width>tools.offsetLeft-8)minY=Math.max(minY,tools.offsetTop+tools.offsetHeight+10);
    this.host.style.maxHeight=Math.max(80,surface.clientHeight-minY-12)+'px';
    this.host.style.left=x+'px';this.host.style.top=Math.max(minY,Math.min(surface.clientHeight-this.host.offsetHeight-12,y))+'px';
  }
}
