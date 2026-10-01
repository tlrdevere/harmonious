import {FacilitationPresentation} from './facilitation-presentation.mjs';
import {initialWorkspace,validateWorkspace,startComparisonThread,comparisonHealth,comparisonJudgments,comparisonJudgmentFor,comparisonConsensus,comparisonPairKey,comparisonProposalVersions,comparisonElicitation,comparisonResponseSet,QUESTION_STATUSES,ANSWER_STATUSES} from './workspace.mjs';
import {stableJSON} from './account-model.mjs';
import {ComparisonCanvas} from './compare-canvas.mjs';
import {synchronizeIdeas,createOwnedMap} from './adoption.mjs';
import {ParticipationUI} from './participation-ui.mjs';
import {AccountWorkspace} from './account-ui.mjs';
import {ArgumentUI} from './argument-ui.mjs';
import {DiscussionUI} from './discussion-ui.mjs';
import {LibraryUI} from './library-ui.mjs';
const ui=id=>document.getElementById(id);
const wsOption=(value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o;};
export class WorkspaceController{
  constructor(editor){
    this.editor=editor;this.workspace=initialWorkspace();this.activeMapId=null;this.baseline='';this.ready=false;this.loadingMap=false;this.workspaceDirty=false;this.comparisonDirty=false;this.serverRevision=0;this.cloudLoaded=false;this.mode='individual';this.editingRecord=null;this.activeComparisonPair=null;ui('comparison-mode').textContent='Compare & align';ui('discover-mode').textContent='Map Library';ui('discover-mode').title='Browse maps and contributions';
    this.fileMode=globalThis.HARMONIOUS_FILE_MODE===true||!['http:','https:'].includes(location.protocol);
    this.sides={a:{mapId:this.workspace.maps[0].id,nodeId:null},b:{mapId:this.workspace.maps[1].id,nodeId:null}};
    this.canvas=new ComparisonCanvas(ui('compare-canvas'),(side,id)=>this.selectSource(side,id),id=>this.openRecord(id),{ownerName:map=>this.workspace.participants.find(p=>p.id===map?.ownerId)?.name||map?.person||'Participant'});
    this.participation=new ParticipationUI(this);
    this.argument=new ArgumentUI(this);
    this.library=new LibraryUI(this);
    this.discussion=new DiscussionUI(this);
    this.activeMapId=null;this.mode='library';
    this.bind();
    if(globalThis.HARMONIOUS_ACCOUNTS===true){this.accountMode=true;this.account=new AccountWorkspace(this);}
    this.updateNavigation();this.facilitationPresentation=new FacilitationPresentation(this);
  }
  canEditMap(map){return !!map&&(!this.accountMode||map.ownerId===this.account?.actor?.id);}
  activeMap(){return this.workspace.maps.find(m=>m.id===this.activeMapId);}
  captureActive(){
    if(!this.ready||this.loadingMap||!this.canEditMap(this.activeMap()))return;const content=this.editor.getMapData(),serialized=JSON.stringify(content);
    if(serialized!==this.baseline){const map=this.activeMap();map.nodes=content.nodes;map.relations=content.relations;synchronizeIdeas(this.workspace,map);map.revision++;map.updatedAt=new Date().toISOString();this.baseline=JSON.stringify({nodes:map.nodes,relations:map.relations});this.markDirty();}
  }
  markDirty(){this.workspaceDirty=true;this.status();}
  status(message=null){ui('storage-status').textContent=message||(this.fileMode?(this.workspaceDirty?'File workspace · Download to keep changes':'File workspace · Open or download a JSON file'):(this.workspaceDirty?'Unsaved workspace changes':'Workspace saved'));ui('storage-status').dataset.state=this.workspaceDirty?'dirty':'saved';ui('save-workspace').textContent=this.fileMode?'Save workspace file':'Save workspace';ui('reload-workspace').hidden=this.fileMode;}
  message(text=''){ui('workspace-message').textContent=text;ui('workspace-message').hidden=!text;}
  async initialize(){
    if(this.fileMode){this.workspace=validateWorkspace(this.workspace);this.ready=true;this.populateMaps();this.status();this.library.render();this.openComparisonRoute();return;}
    this.ready=false;for(const id of ['editor-main','comparison-workspace','argument-workspace','discover-workspace','pods-workspace','workspace-nav'])ui(id).inert=true;this.status('Opening saved workspace…');
    try{const response=await fetch('/api/workspace',{cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not open the saved workspace.');if(data.workspace)this.workspace=validateWorkspace(data.workspace);this.serverRevision=data.revision;this.cloudLoaded=true;this.workspaceDirty=!data.workspace;}
    catch(error){this.message(`${error.message} You can use Open file or download a backup. Reopen saved will retry.`);this.cloudLoaded=false;}
    finally{this.argument?.reset();this.ready=true;for(const id of ['editor-main','comparison-workspace','argument-workspace','discover-workspace','pods-workspace','workspace-nav'])ui(id).inert=false;this.activeComparisonPair=null;this.clearComparison();this.activeMapId=null;this.sides={a:{mapId:this.workspace.maps[0].id,nodeId:null},b:{mapId:this.workspace.maps[1]?.id||null,nodeId:null}};this.mode='library';this.updateNavigation();this.populateMaps();this.status(this.cloudLoaded?null:'Saved workspace unavailable');if(this.mode==='compare')this.renderComparison();this.participation.peopleSelection=null;this.participation.refresh();}
  }
  loadMap(id){
    const map=this.workspace.maps.find(m=>m.id===id);if(!map)return;this.loadingMap=true;this.activeMapId=id;this.editor.setMap(map);this.baseline=JSON.stringify({nodes:map.nodes,relations:map.relations});this.loadingMap=false;
    ui('map-select').value=id;ui('map-heading').textContent=map.name;ui('map-person').textContent=`${this.workspace.participants.find(p=>p.id===map.ownerId)?.name||map.person} · ${map.mapType==='reference'?'Authored reference map':'Personal worldview'}`;
  }
  populateMaps(){
    for(const id of ['map-select','compare-map-a','compare-map-b']){const select=ui(id);select.replaceChildren(wsOption('','Choose a map…'));for(const map of this.workspace.maps.filter(m=>!m.unavailable))select.append(wsOption(map.id,`${map.mapType==='reference'?'Reference: ':''}${map.name} · ${this.library.name(map)}`+(map.visibility==='shared'?' · Shared':'')));}
    ui('map-select').value=this.activeMapId;
    for(const side of ['a','b']){if(!this.workspace.maps.some(m=>m.id===this.sides[side].mapId))this.sides[side]={mapId:null,nodeId:null};ui(`compare-map-${side}`).value=this.sides[side].mapId||'';}
    this.library?.render();
  }
  updateNavigation(){
    const mode=this.mode;
    document.querySelector('.map-switcher').hidden=mode!=='individual'||!this.activeMap();
    ui('workspace-nav').hidden=!!this.accountMode&&document.querySelector('.map-switcher').hidden;
    for(const [name,section]of [['library','library-workspace'],['individual','editor-main'],['compare','comparison-workspace'],['argument','argument-workspace'],['discover','discover-workspace'],['pods','pods-workspace']])ui(section).hidden=mode!==name;
    for(const [id,active]of [['discover-mode',mode==='library'],['individual-mode',mode==='individual'],['comparison-mode',['compare','argument','discover'].includes(mode)],['pods-mode',mode==='pods']]){ui(id).classList.toggle('active',active);ui(id).setAttribute('aria-current',active?'page':'false');}
    ui('comparison-context').hidden=!['compare','argument'].includes(mode);
    if(['compare','argument'].includes(mode)){this.discussion?.setMode(mode);this.library.context();}
  }
  canLeaveComparison(){return (!this.discussion||this.discussion.canLeave())&&(!this.comparisonDirty||confirm('Discard the unrecorded comparison changes?'));}
  showMode(mode){
    if(mode==='individual'&&!this.activeMap()){this.library.section='maps';mode='library';}
    if(mode===this.mode)return true;
    if(this.discussion?.dialogue?.active&&!this.discussion.dialogue.close({route:false}))return false;
    if(this.discussion?.dirty&&!this.discussion.canLeave())return false;
    if(this.discussion)this.discussion.host.hidden=true;
    const paired=['compare','argument'].includes(this.mode)&&['compare','argument'].includes(mode);
    if(this.mode==='individual'&&!this.editor.beforeLeave())return false;
    if(!paired&&this.comparisonDirty&&!this.canLeaveComparison())return false;
    if(!paired&&this.argument?.dirty&&!this.argument.canLeave())return false;
    this.editor.discardDraft();this.captureActive();if(!paired){if(this.comparisonDirty)this.clearComparison();this.comparisonDirty=false;if(this.argument?.dirty)this.argument.clearDraft();}this.mode=mode;
    this.updateNavigation?.();
    if(mode==='compare'){
      this.populateMaps();this.renderComparison();
      if(paired){const selected=this.workspace.comparisons.find(p=>p.id===this.editingRecord),thread=this.workspace.comparisonThreads.find(t=>comparisonPairKey(t)===this.activeComparisonPair);this.setComparisonRoute(selected?.comparisonId||thread?.id,selected?.id);}
    }
    if(mode==='argument')this.argument.render();if(mode==='library')this.library.render();if(['discover','pods'].includes(mode))this.participation.refresh();return true;
  }
  renderComparison(fit=false){
    for(const side of ['a','b']){
      const state=this.sides[side],map=this.workspace.maps.find(m=>m.id===state.mapId),picker=ui(`compare-node-${side}`);picker.replaceChildren(wsOption('','No response on this side'));
      ui(`edit-source-${side}`).disabled=!this.canEditMap(map);
      for(const action of ['next','all','collapse'])ui(`compare-${action}-${side}`).disabled=!map;
      if(!map){ui(`source-summary-${side}`).textContent='Choose a source map above. Shared maps are listed with their owners.';continue;}
      for(const node of map.nodes)picker.append(wsOption(node.id,node.title));
      if(state.nodeId&&!map.nodes.some(n=>n.id===state.nodeId))picker.append(wsOption(state.nodeId,'Previously selected node was deleted'));
      picker.value=state.nodeId||'';this.renderSource(side);
    }
    this.canvas.setMaps(Object.fromEntries(['a','b'].map(side=>[side,{...this.sides[side],map:this.workspace.maps.find(m=>m.id===this.sides[side].mapId),frame:ui(`compare-frame-${side}`).value}])),this.recordsForActivePair().map(record=>({...record,needsReview:comparisonHealth(this.workspace,record).needsReview,consensus:comparisonConsensus(this.workspace,record)})),this.editingRecord,{fit});
    this.renderRecords();this.refreshStages();const selected=this.editingRecord&&this.workspace.comparisons.find(c=>c.id===this.editingRecord);this.renderConsensus(selected);
    this.library?.context();this.discussion?.dialogue?.refresh();
  }
  recordsForActivePair(){return this.activeComparisonPair?this.workspace.comparisons.filter(record=>comparisonPairKey(record)===this.activeComparisonPair):this.workspace.comparisons;}
  mapName(id){return this.workspace.maps.find(map=>map.id===id)?.name||'Unavailable map';}
  renderSource(side){
    const state=this.sides[side],map=this.workspace.maps.find(m=>m.id===state.mapId),node=map?.nodes.find(n=>n.id===state.nodeId),host=ui(`source-summary-${side}`);host.replaceChildren();
    if(!node){host.textContent=state.nodeId?'The original node was deleted. Its saved snapshot is retained in the comparison record.':'No response selected. Choose a node in the map or the list above.';return;}
    const kind=document.createElement('span');kind.className='source-kind';kind.textContent=node.kind[0].toUpperCase()+node.kind.slice(1);const title=document.createElement('strong');title.textContent=node.title;const summary=document.createElement('p');summary.textContent=node.summary;host.append(kind,title,summary);
    if(node.details||node.sourceTitle||node.sourceUrl){const details=document.createElement('details'),label=document.createElement('summary');label.textContent='Context and source';details.append(label);for(const text of [node.details,node.sourceTitle])if(text){const p=document.createElement('p');p.textContent=text;details.append(p);}if(node.sourceUrl){const a=document.createElement('a');a.href=node.sourceUrl;a.textContent='Open source ↗';a.target='_blank';a.rel='noopener noreferrer';details.append(a);}host.append(details);}
    if(node.parent!==null){const actions=document.createElement('div');actions.className='comparison-source-actions';const endorse=document.createElement('button');endorse.type='button';endorse.className='text-button';endorse.textContent='Co-sign this wording…';endorse.onclick=()=>this.openSourceAction(side,'endorse');actions.append(endorse);const copy=document.createElement('button');copy.type='button';copy.className='text-button';copy.textContent='Copy & adapt…';copy.onclick=()=>this.openSourceAction(side,'copy');actions.append(copy);host.append(actions);}
  }
  openSourceAction(side,mode){const state=this.sides[side],map=this.workspace.maps.find(m=>m.id===state.mapId),node=map?.nodes.find(n=>n.id===state.nodeId);if(!map||!node||node.parent===null)return;this.participation.actorId=this.account?.actor?.id||this.participation.actorId;this.participation.mapId=map.id;this.participation.nodeId=node.id;this.participation.openAction(mode,'node');}
  selectSource(side,id,focus=false){if(this.discussion?.dirty&&!this.discussion.canLeave())return;this.sides[side].nodeId=id||null;ui(`compare-node-${side}`).value=id||'';this.canvas.pick(side,id||null,focus);ui(`compare-frame-${side}`).value=this.canvas.states[side].frame;this.renderSource(side);this.renderElicitation(this.workspace.comparisons.find(record=>record.id===this.editingRecord));if(id)this.discussion?.selectNode(side,id);}
  refreshStages(){const elicitation=ui('question-status').value==='needs_elicitation',matched=ui('question-status').value==='matched';ui('answer-stage').hidden=!matched;ui('answer-status').required=matched;if(!matched)ui('answer-status').value='';ui('divergence-note').hidden=ui('answer-status').value!=='divergent';ui('shared-question-label').textContent=elicitation?'Question to ask before deciding on counterparts':matched?'Shared question':ui('question-status').value==='incommensurable'?'Describe the different questions':'Question not yet addressed by both people';this.renderElicitation(this.workspace.comparisons.find(record=>record.id===this.editingRecord));}
  clearComparison(){this.editingRecord=null;this.comparisonDirty=false;ui('comparison-form').reset();ui('comparison-review-warning').hidden=true;ui('comparison-snapshots').hidden=true;ui('comparison-form-title').textContent='Record a correspondence';ui('comparison-editing').textContent='';ui('record-comparison').textContent='Record comparison';ui('comparison-error').textContent='';ui('comparison-error').dataset.state='';this.renderConsensus(null);ui('comparison-proposal-details').hidden=true;this.renderElicitation(null);this.refreshStages();}
  renderConsensus(record){let host=ui('comparison-consensus');if(!host){host=document.createElement('span');host.id='comparison-consensus';host.className='comparison-consensus';ui('comparison-form-title')?.parentElement?.insertBefore(host,ui('comparison-editing'));}if(!host)return;if(!record){host.hidden=true;host.textContent='';return;}const consensus=comparisonConsensus(this.workspace,record);host.hidden=false;host.dataset.state=consensus.state;host.textContent=consensus.label;}
  renderRecords(){
    const threads=this.workspace.comparisonThreads||[];
    if(this.activeComparisonPair&&!threads.some(thread=>comparisonPairKey(thread)===this.activeComparisonPair))this.activeComparisonPair=null;
    const host=ui('comparison-records'),title=ui('comparison-register-title'),context=ui('comparison-register-context'),back=ui('comparison-back');host.replaceChildren();
    const all=this.workspace.comparisons,records=this.recordsForActivePair();back.hidden=!this.activeComparisonPair;
    if(!this.activeComparisonPair){title.textContent='Overall comparisons';context.hidden=true;ui('comparison-record-count').textContent=String(threads.length);if(!threads.length){const p=document.createElement('p');p.className='empty-records';p.textContent='Choose two maps and start a comparison. It will appear for both owners while both maps are visible to them.';host.append(p);return;}
      for(const thread of [...threads].reverse()){
        const key=comparisonPairKey(thread),group=all.filter(proposal=>proposal.comparisonId===thread.id),button=document.createElement('button');button.type='button';button.className='comparison-record comparison-overview';
        const maps=document.createElement('strong');maps.textContent=`${this.mapName(thread.aMapId)} / ${this.mapName(thread.bMapId)}`;
        const details=document.createElement('span');details.className='record-status';const actor=this.account?.actor?.id,needsMine=actor&&group.some(record=>!comparisonJudgmentFor(this.workspace,record,actor)),agreed=group.filter(record=>comparisonConsensus(this.workspace,record).state==='agreed').length;
        details.textContent=`${group.length} proposed ${group.length===1?'judgment':'judgments'}${needsMine?' · Your judgment is needed':agreed?` · ${agreed} agreed`:group.length?' · Open to review':' · Ready to begin'}`;
        button.append(maps,details);button.onclick=()=>this.openComparisonPair(key);host.append(button);
      }return;
    }
    const first=threads.find(thread=>comparisonPairKey(thread)===this.activeComparisonPair);title.textContent='Proposed judgments';context.hidden=false;context.textContent=first?`${this.mapName(first.aMapId)} / ${this.mapName(first.bMapId)}`:'';ui('comparison-record-count').textContent=String(records.length);
    if(!records.length){const empty=document.createElement('p');empty.className='empty-records';empty.textContent='No judgments yet. Select source nodes above to propose counterparts or ask an elicitation question.';host.append(empty);}
    for(const record of [...records].reverse()){const health=comparisonHealth(this.workspace,record),button=document.createElement('button');button.type='button';button.className=`comparison-record${this.editingRecord===record.id?' active':''}`;const a=this.workspace.maps.find(map=>map.id===record.aMapId)?.nodes.find(node=>node.id===record.aNodeId)?.title||record.aSnapshot?.node?.title||'No response',b=this.workspace.maps.find(map=>map.id===record.bMapId)?.nodes.find(node=>node.id===record.bNodeId)?.title||record.bSnapshot?.node?.title||'No response';const people=document.createElement('span');people.className='record-people';people.textContent=`${a} / ${b}`;const consensus=comparisonConsensus(this.workspace,record),question=document.createElement('strong');question.textContent=record.question;const status=document.createElement('span');status.className=`record-status consensus-${consensus.state}`;status.textContent=QUESTION_STATUSES[record.questionStatus]+(record.answerStatus?` · ${ANSWER_STATUSES[record.answerStatus]}`:'')+` · ${consensus.label}`;button.append(people,question,status);if(health.needsReview){const review=document.createElement('span');review.className='record-review';review.textContent=health.missing.length?'Source deleted · Needs review':'Source changed · Needs review';button.append(review);}button.onclick=()=>this.openRecord(record.id);host.append(button);}
  }
  openComparisonPair(key){
    if(!this.canLeaveComparison()||!this.argument.canLeave())return;const record=this.workspace.comparisonThreads?.find(item=>comparisonPairKey(item)===key);if(!record)return;this.argument.reset();this.activeComparisonPair=key;this.clearComparison();this.discussion?.setRecordsOpen(false,{focus:false});this.sides={a:{mapId:record.aMapId,nodeId:null},b:{mapId:record.bMapId,nodeId:null}};this.populateMaps();for(const side of ['a','b'])ui(`compare-frame-${side}`).value='all';this.renderComparison(true);this.setComparisonRoute(record.id);
  }
  setComparisonRoute(id=null,proposalId=null){
    const route=new URLSearchParams();if(id)route.set('comparison',id);if(proposalId)route.set('proposal',proposalId);
    history.replaceState(null,'',`${location.pathname}${location.search}${id?'#'+route:''}`);
  }
  openComparisonRoute(){
    if(!this.ready)return;
    const dialogue=this.discussion?.dialogue;if(dialogue?.active&&!dialogue.close({route:false})){history.replaceState(null,'',dialogue.url(dialogue.selected));return;}
    if(this.library?.openRoute())return;
    const route=new URLSearchParams(location.hash.slice(1)),id=route.get('comparison');if(!id)return;
    const thread=this.workspace.comparisonThreads?.find(item=>item.id===id),legacy=this.workspace.comparisons.find(item=>item.id===id);
    if(!thread&&!legacy){this.library?.open('comparisons');this.message('This comparison is unavailable to this account. Its source maps may no longer be shared.');return;}
    if(!this.showMode('compare'))return;
    const proposal=this.workspace.comparisons.find(item=>item.id===route.get('proposal')&&item.comparisonId===id)||(!thread?legacy:null);
    if(proposal)this.openRecord(proposal.id);else this.openComparisonPair(comparisonPairKey(thread));
    if(route.get('view')==='dialogue'){this.discussion.dialogue.open({type:'node',mapId:route.get('map'),nodeId:route.get('node')},{entry:route.get('entry'),route:false});}
    else if(!proposal&&route.get('view')==='argument')this.discussion.reasoning.setFocus('argument');
    if(proposal&&route.get('view')==='argument')this.argument.open({proposalId:proposal.id,revision:Number(route.get('revision'))});
  }
  async ensureComparison(){
    const a=this.sides.a.mapId,b=this.sides.b.mapId;
    const existing=this.workspace.comparisonThreads?.find(thread=>comparisonPairKey(thread)===comparisonPairKey({aMapId:a,bMapId:b}));if(existing)return existing;
    if(this.accountMode)return this.account.startComparison(a,b);
    const thread=startComparisonThread(this.workspace,a,b);this.markDirty();return thread;
  }
  comparisonSelectionError(){
    const maps=['a','b'].map(side=>this.workspace.maps.find(map=>map.id===this.sides[side].mapId&&!map.unavailable));
    if(!maps.every(Boolean))return 'Choose a map for each source. Unavailable maps are not listed.';
    if(maps[0].id===maps[1].id)return 'Choose two different maps.';
    if(this.accountMode&&!maps.some(map=>this.canEditMap(map)))return 'Choose one of your maps and another accessible map.';
    return '';
  }
  async startComparison(){
    if(this.startingComparison||!this.canLeaveComparison())return;const error=this.comparisonSelectionError();if(error){this.message(error);return;}this.startingComparison=true;this.library.context();ui('comparison-workspace').inert=true;
    try{const thread=await this.ensureComparison();this.clearComparison();this.openComparisonPair(comparisonPairKey(thread));this.message(this.accountMode?'Comparison saved. Select nodes to connect them or start a conversation.':'Comparison started. Save your workspace to keep it.');}
    catch(error){this.message(error.message);}finally{this.startingComparison=false;ui('comparison-workspace').inert=false;this.library.context();}
  }
  openRecord(id){
    if(!this.canLeaveComparison())return;const record=this.workspace.comparisons.find(c=>c.id===id);if(!record)return;this.activeComparisonPair=comparisonPairKey(record);this.clearComparison();this.editingRecord=id;this.discussion?.setRecordsOpen(true,{focus:false});
    this.sides={a:{mapId:record.aMapId,nodeId:record.aNodeId},b:{mapId:record.bMapId,nodeId:record.bNodeId}};this.populateMaps();for(const side of ['a','b'])ui(`compare-frame-${side}`).value='all';
    this.loadComparisonForm(record);
    this.renderComparison();this.canvas.fitSelection();this.comparisonDirty=false;this.renderConsensus(record);
    this.setComparisonRoute(record.comparisonId,record.id);
  }
  loadComparisonForm(record){
    for(const field of ui('comparison-form').querySelectorAll('input,select,textarea'))field.disabled=true;ui('record-comparison').hidden=true;
    const judgment=comparisonJudgmentFor(this.workspace,record,this.account?.actor?.id||null),draft=judgment||{questionStatus:'',question:comparisonProposalVersions(record).at(-1).question,answerStatus:null,notes:'',history:[]};ui('question-status').value=draft.questionStatus;ui('shared-question').value=draft.question;ui('answer-status').value=draft.answerStatus||'';ui('comparison-notes').value=draft.notes;ui('comparison-form-title').textContent='Earlier comparison';ui('record-comparison').textContent='Save your judgment';ui('comparison-editing').textContent=judgment?`${judgment.history.length} earlier ${judgment.history.length===1?'version':'versions'}`:'No judgment recorded yet';
    const health=comparisonHealth(this.workspace,{...record,...judgment});ui('comparison-review-warning').hidden=!(health.needsReview||judgment?.sourceReviewRequired);ui('comparison-review-warning').textContent='These saved sources may differ from the current maps. This earlier comparison is available as history.';
    const version=comparisonProposalVersions(record).at(-1),proposalDetails=ui('comparison-proposal-details');proposalDetails.hidden=false;proposalDetails.textContent=`Proposal version ${version.revision}: ${version.question}`;
    if(judgment?.proposalRevision!==version.revision){ui('comparison-review-warning').hidden=false;ui('comparison-review-warning').textContent='This judgment refers to an earlier proposal version. Its saved wording remains available below.';}
    ui('elicitation-response').value=judgment?.elicitationResponse||'';
    ui('divergence-confirmation').checked=!!judgment?.divergenceConfirmed&&judgment.proposalRevision===version.revision&&stableJSON(judgment.reviewedResponses)===stableJSON(comparisonResponseSet(this.workspace,record));
    this.renderElicitation(record);
    ui('comparison-snapshots').hidden=false;const host=ui('comparison-snapshot-content');host.replaceChildren();
    for(const proposal of [...comparisonProposalVersions(record)].reverse()){
      const section=document.createElement('details'),summary=document.createElement('summary');summary.textContent=`Proposal version ${proposal.revision}: ${proposal.question}`;section.append(summary);
      for(const side of ['a','b']){const source=document.createElement('p'),node=proposal[`${side}Snapshot`]?.node;source.textContent=`${side.toUpperCase()}: ${node?node.title+'\n'+node.summary:'No response selected'}`;section.append(source);}host.append(section);
    }
    for(const saved of comparisonJudgments(this.workspace,record)){
      const name=this.workspace.participants.find(person=>person.id===saved.actorId)?.name||'Participant';
      for(const [label,item]of [['Latest judgment',saved],...saved.history.map((item,index)=>[`Earlier version ${index+1}`,item])]){
        const section=document.createElement('details'),summary=document.createElement('summary');
        summary.textContent=`${name} · ${label}: ${QUESTION_STATUSES[item.questionStatus]}${item.answerStatus?' · '+ANSWER_STATUSES[item.answerStatus]:''}${item.sourceReviewRequired?' · Source review needed':''}`;section.append(summary);
        const question=document.createElement('p');question.textContent=item.question;section.append(question);
        if(item.proposalRevision){const version=document.createElement('p');version.textContent=`Reviewed proposal version ${item.proposalRevision}`;section.append(version);}
        if(item.elicitationResponse){const response=document.createElement('p');response.textContent=`Clarified response: ${item.elicitationResponse}`;section.append(response);}
        for(const side of ['a','b']){const node=item[`${side}Snapshot`]?.node,p=document.createElement('p');p.textContent=`${side.toUpperCase()}: ${node?node.title+'\n'+node.summary:'No response selected'}`;section.append(p);}
        if(item.notes){const p=document.createElement('p');p.textContent=item.notes;section.append(p);}host.append(section);
      }
    }
  }
  renderElicitation(record){
    const host=ui('elicitation-responses');host.replaceChildren();
    if(!record){ui('elicitation-status').textContent='Record a proposal to begin clarification.';ui('divergence-confirmation').disabled=true;return;}
    const version=comparisonProposalVersions(record).at(-1),state=comparisonElicitation(this.workspace,record);
    for(const judgment of comparisonJudgments(this.workspace,record))if(judgment.elicitationResponse){
      const response=document.createElement('p'),name=this.workspace.participants.find(person=>person.id===judgment.actorId)?.name||'Participant';
      response.className='elicitation-response';response.textContent=`${name}${judgment.proposalRevision===version.revision?'':` · Earlier proposal version ${judgment.proposalRevision||'unknown'}`}\n${judgment.elicitationResponse}`;host.append(response);
    }
    ui('elicitation-status').textContent=state.label;ui('elicitation-status').dataset.state=state.state;
    ui('divergence-confirmation').disabled=true;
  }
  async record(){this.message('Earlier comparisons are read-only. Use the current Compare, Inquiry, and Argument modes for new interactions.');}
  collectWork(){
    if(this.argument?.dirty){this.message('Save the Argument form before downloading or saving the workspace.');return false;}
    if(this.editor.hasChildDraft?.()){this.message('Finish or cancel the child node before saving or downloading the workspace.');return false;}
    if(!this.editor.flushDraft()){this.message('Resolve the node or connection fields before saving the workspace.');return false;}
    this.captureActive();if(this.comparisonDirty){this.message('Record the comparison before saving the workspace, or start a new comparison to discard that draft.');return false;}return true;
  }
  download(){
    if(!this.collectWork())return;validateWorkspace(this.workspace);const blob=new Blob([JSON.stringify(this.workspace,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Harmonious-workspace.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);if(this.fileMode){this.workspaceDirty=false;this.status('Workspace file downloaded');}this.message('Keep the downloaded JSON file. Use Open file to resume these maps and comparisons.');
  }
  async save(){
    if(this.fileMode){this.download();return;}if(!this.collectWork())return;if(!this.cloudLoaded){this.message('Reopen saved must succeed before this page can update the saved workspace. You can download your work now.');return;}
    const button=ui('save-workspace');button.disabled=true;this.status('Saving workspace…');const content=JSON.stringify(this.workspace);
    try{validateWorkspace(this.workspace);const response=await fetch('/api/workspace',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({workspace:this.workspace,expectedRevision:this.serverRevision})});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not save the workspace.');this.serverRevision=data.revision;this.workspaceDirty=JSON.stringify(this.workspace)!==content;this.message();this.status();}
    catch(error){this.message(error.message);this.status('Save failed · Current work retained');}finally{button.disabled=false;}
  }
  async openFile(file){
    if(!file)return;try{if(file.size>2_000_000)throw Error('This file exceeds the 2 MB prototype limit.');const workspace=validateWorkspace(JSON.parse(await file.text()));if((this.workspaceDirty||this.comparisonDirty||this.discussion?.dirty||this.argument?.dirty||this.editor.hasDraft())&&!confirm('Replace the current unsaved workspace with this file?'))return;
      this.argument?.reset();this.loadingMap=true;this.workspace=workspace;this.activeMapId=workspace.maps[0].id;this.sides={a:{mapId:workspace.maps[0].id,nodeId:null},b:{mapId:workspace.maps[1]?.id||null,nodeId:null}};this.activeComparisonPair=null;this.clearComparison();this.loadMap(this.activeMapId);this.populateMaps();this.workspaceDirty=!this.fileMode;this.status('Workspace file opened');this.message();if(this.mode==='compare')this.renderComparison();this.participation.peopleSelection=null;this.participation.refresh();}
    catch(error){this.message(`File was not opened: ${error.message}`);}finally{ui('workspace-file').value='';}
  }
  showMapDialog(rename=false,{type='personal',newPerson=false,fromMapId=null}={}){
    const source=fromMapId?this.workspace.maps.find(m=>m.id===fromMapId&&!m.unavailable):null;if(fromMapId&&!source){this.message('This source map is unavailable.');return;}
    if(!this.editor.beforeLeave()||!this.canLeaveComparison())return;this.renameMap=rename;const map=this.activeMap();
    ui('map-dialog-title').textContent=rename?'Rename map':source?'Copy a map':'Create a map';ui('map-name-input').value=rename?map.name:source?source.name.slice(0,93)+' (copy)':'';ui('map-type-input').value=rename?map.mapType:source?.mapType||type;ui('map-type-input').disabled=rename;
    ui('map-owner-input').replaceChildren(...this.workspace.participants.map(p=>wsOption(p.id,p.name)),wsOption('new','＋ New participant'));ui('map-owner-input').value=rename?map.ownerId:newPerson?'new':this.participation.actorId;ui('map-owner-input').disabled=rename;
    ui('map-person-input').value=rename?(this.workspace.participants.find(p=>p.id===map.ownerId)?.name||map.person):'';ui('map-person-group').hidden=!rename&&ui('map-owner-input').value!=='new';ui('map-person-input').required=rename||ui('map-owner-input').value==='new';
    ui('map-start-group').hidden=rename;ui('map-start-input').replaceChildren(wsOption('','Three empty frames'),...this.workspace.maps.filter(m=>!m.unavailable).map(m=>wsOption(m.id,`Copy ${m.name} · ${this.workspace.participants.find(p=>p.id===m.ownerId)?.name||m.person||'Participant'}`)));ui('map-start-input').value=source?.id||'';ui('map-dialog-error').textContent='';ui('confirm-map').textContent=rename?'Save name':'Create map';ui('map-dialog').showModal();ui('map-name-input').focus();if(source)ui('map-name-input').select();
  }
  sharedNodeNote(node){
    if(!node?.ideaId)return '';const idea=this.workspace.ideas.find(i=>i.id===node.ideaId);if(!idea)return '';
    const current=idea.versions.at(-1),own=idea.originMapId===this.activeMapId&&idea.originNodeId===node.id;
    return `${own?'Original wording':'Shared wording'} · version ${node.ideaVersion}.${current.version!==node.ideaVersion?' A newer version is available at the original source.':''} ${own?'Edits create a new version for co-signers to review.':'Editing the wording creates an independent version. Existing co-signs remain attached to their recorded wording.'}`;
  }
  exploreNode(mapId,nodeId=null){return this.library.openSource(mapId,nodeId);}
  bind(){
    ui('elicitation-response').addEventListener('input',()=>{ui('divergence-confirmation').checked=false;});
    ui('shared-question').addEventListener('input',()=>this.renderElicitation(this.workspace.comparisons.find(record=>record.id===this.editingRecord)));
    ui('start-comparison').onclick=()=>this.startComparison();window.addEventListener('hashchange',()=>this.openComparisonRoute());
    ui('individual-mode').onclick=()=>this.activeMapId?this.library.openMap(this.activeMapId):this.library.open('maps');ui('comparison-mode').onclick=()=>this.library.open('comparisons');ui('discover-mode').onclick=()=>this.library.open();ui('pods-mode').onclick=()=>this.library.open('pods');ui('explore-current').onclick=()=>this.library.open('maps');
    ui('map-select').onchange=()=>{const id=ui('map-select').value;if(id)this.library.openMap(id);else this.library.open('maps');};
    ui('new-map').onclick=()=>this.showMapDialog();ui('map-settings').onclick=()=>this.showMapDialog(true);ui('close-map-dialog').onclick=()=>ui('map-dialog').close();
    ui('map-owner-input').onchange=()=>{const fresh=ui('map-owner-input').value==='new';ui('map-person-group').hidden=!fresh;ui('map-person-input').required=fresh;};
    ui('map-dialog-form').onsubmit=e=>{
      e.preventDefault();try{const name=ui('map-name-input').value.trim(),person=ui('map-person-input').value.trim();if(!name)throw Error('Enter a map name.');this.captureActive();let map;
        if(this.renameMap){map=this.activeMap();map.name=name;const owner=this.workspace.participants.find(p=>p.id===map.ownerId);if(!person)throw Error('Enter the person’s name.');owner.name=person;for(const m of this.workspace.maps)if(m.ownerId===owner.id){m.person=person;m.revision++;}}
        else map=createOwnedMap(this.workspace,{name,ownerId:ui('map-owner-input').value,personName:person,mapType:ui('map-type-input').value,fromMapId:ui('map-start-input').value||null});
        this.comparisonDirty=false;this.participation.actorId=map.ownerId;this.loadMap(map.id);this.showMode('individual');this.populateMaps();this.library.route({map:map.id});this.markDirty();ui('map-dialog').close();
      }catch(error){ui('map-dialog-error').textContent=error.message;}
    };
    ui('map-name-input').oninput=()=>ui('map-name-input').setCustomValidity('');
    for(const side of ['a','b']){
      ui(`compare-map-${side}`).onchange=()=>{if(!this.canLeaveComparison()){ui(`compare-map-${side}`).value=this.sides[side].mapId;return;}this.activeComparisonPair=null;this.clearComparison();this.setComparisonRoute();this.sides[side]={mapId:ui(`compare-map-${side}`).value,nodeId:null};this.renderComparison();};
      ui(`compare-node-${side}`).onchange=()=>this.selectSource(side,ui(`compare-node-${side}`).value,true);
      ui(`compare-frame-${side}`).onchange=()=>this.canvas.setFrame(side,ui(`compare-frame-${side}`).value);
      ui(`compare-next-${side}`).onclick=()=>this.canvas.expand(side);
      ui(`compare-all-${side}`).onclick=()=>this.canvas.expand(side,true);
      ui(`compare-collapse-${side}`).onclick=()=>this.canvas.collapse(side);
      ui(`edit-source-${side}`).onclick=()=>{const state=this.sides[side];this.library.openMap(state.mapId,state.nodeId);};
    }
    ui('new-comparison').onclick=()=>{if(!this.canLeaveComparison())return;this.clearComparison();this.sides.a.nodeId=null;this.sides.b.nodeId=null;const thread=this.workspace.comparisonThreads?.find(item=>comparisonPairKey(item)===this.activeComparisonPair);this.setComparisonRoute(thread?.id);this.renderComparison();};ui('comparison-back').onclick=()=>{if(!this.canLeaveComparison())return;this.activeComparisonPair=null;this.clearComparison();this.setComparisonRoute();this.renderComparison();};
    ui('question-status').onchange=()=>this.refreshStages();ui('answer-status').onchange=()=>this.refreshStages();
    ui('comparison-form').addEventListener('input',()=>{this.comparisonDirty=true;});ui('comparison-form').addEventListener('change',()=>{this.comparisonDirty=true;});ui('comparison-form').onsubmit=e=>{e.preventDefault();this.record();};
    ui('save-workspace').onclick=()=>this.save();ui('download-workspace').onclick=()=>this.download();ui('open-workspace').onclick=()=>ui('workspace-file').click();ui('workspace-file').onchange=()=>this.openFile(ui('workspace-file').files[0]);
    ui('reload-workspace').onclick=()=>{if((this.workspaceDirty||this.comparisonDirty||this.discussion?.dirty||this.argument?.dirty||this.editor.hasDraft())&&!confirm('Reopen the last saved workspace and discard current unsaved changes?'))return;this.initialize();};
    window.addEventListener('beforeunload',e=>{if(this.workspaceDirty||this.comparisonDirty||this.discussion?.dirty||this.argument?.dirty||this.editor.hasDraft()){e.preventDefault();e.returnValue='';}});
  }
}
