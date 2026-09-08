import {initialWorkspace,validateWorkspace,recordComparison,comparisonHealth,QUESTION_STATUSES,ANSWER_STATUSES} from './workspace.mjs';
import {ComparisonCanvas} from './compare-canvas.mjs';
import {synchronizeIdeas,createOwnedMap} from './adoption.mjs';
import {ParticipationUI} from './participation-ui.mjs';
import {AccountWorkspace} from './account-ui.mjs';
const ui=id=>document.getElementById(id);
const wsOption=(value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o;};
export class WorkspaceController{
  constructor(editor){
    this.editor=editor;this.workspace=initialWorkspace();this.activeMapId=this.workspace.maps[0].id;this.baseline='';this.ready=false;this.loadingMap=false;this.workspaceDirty=false;this.comparisonDirty=false;this.serverRevision=0;this.cloudLoaded=false;this.mode='individual';this.editingRecord=null;
    this.fileMode=globalThis.HARMONIOUS_FILE_MODE===true||!['http:','https:'].includes(location.protocol);
    this.sides={a:{mapId:this.workspace.maps[0].id,nodeId:null},b:{mapId:this.workspace.maps[1].id,nodeId:null}};
    this.canvas=new ComparisonCanvas(ui('compare-canvas'),(side,id)=>this.selectSource(side,id),id=>this.openRecord(id));
    this.participation=new ParticipationUI(this);
    this.bind();
    if(globalThis.HARMONIOUS_ACCOUNTS===true){this.accountMode=true;this.account=new AccountWorkspace(this);}
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
    if(this.fileMode){this.ready=true;this.loadMap(this.activeMapId);this.populateMaps();this.status();return;}
    this.ready=false;for(const id of ['editor-main','comparison-workspace','discover-workspace','pods-workspace','workspace-nav'])ui(id).inert=true;this.status('Opening saved workspace…');
    try{const response=await fetch('/api/workspace',{cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not open the saved workspace.');if(data.workspace)this.workspace=validateWorkspace(data.workspace);this.serverRevision=data.revision;this.cloudLoaded=true;this.workspaceDirty=!data.workspace;}
    catch(error){this.message(`${error.message} You can use Open file or download a backup. Reopen saved will retry.`);this.cloudLoaded=false;}
    finally{this.ready=true;for(const id of ['editor-main','comparison-workspace','discover-workspace','pods-workspace','workspace-nav'])ui(id).inert=false;this.clearComparison();this.activeMapId=this.workspace.maps[0].id;this.sides={a:{mapId:this.workspace.maps[0].id,nodeId:null},b:{mapId:this.workspace.maps[1]?.id||null,nodeId:null}};this.loadMap(this.activeMapId);this.populateMaps();this.status(this.cloudLoaded?null:'Saved workspace unavailable');if(this.mode==='compare')this.renderComparison();this.participation.peopleSelection=null;this.participation.refresh();}
  }
  loadMap(id){
    const map=this.workspace.maps.find(m=>m.id===id);if(!map)return;this.loadingMap=true;this.activeMapId=id;this.editor.setMap(map);this.baseline=JSON.stringify({nodes:map.nodes,relations:map.relations});this.loadingMap=false;
    ui('map-select').value=id;ui('map-heading').textContent=map.name;ui('map-person').textContent=`${this.workspace.participants.find(p=>p.id===map.ownerId)?.name||map.person} · ${map.mapType==='reference'?'Authored reference map':'Personal worldview'}`;
  }
  populateMaps(){
    for(const id of ['map-select','compare-map-a','compare-map-b']){const select=ui(id);select.replaceChildren();for(const map of this.workspace.maps)select.append(wsOption(map.id,`${map.mapType==='reference'?'Reference: ':''}${map.name}`+(map.person?` · ${map.person}`:'')));}
    ui('map-select').value=this.activeMapId;
    for(const side of ['a','b']){if(!this.workspace.maps.some(m=>m.id===this.sides[side].mapId))this.sides[side]={mapId:this.workspace.maps[side==='a'?0:1]?.id||null,nodeId:null};ui(`compare-map-${side}`).value=this.sides[side].mapId||'';}
  }
  canLeaveComparison(){return !this.comparisonDirty||confirm('Discard the unrecorded comparison changes?');}
  showMode(mode){
    if(mode===this.mode)return true;
    if(this.mode==='individual'&&!this.editor.beforeLeave())return false;if(this.mode==='compare'&&!this.canLeaveComparison())return false;
    this.editor.discardDraft();this.captureActive();if(this.comparisonDirty)this.clearComparison();this.comparisonDirty=false;this.mode=mode;
    document.querySelector('.map-switcher').hidden=mode!=='individual';
    for(const [name,section,button]of [['individual','editor-main','individual-mode'],['compare','comparison-workspace','comparison-mode'],['discover','discover-workspace','discover-mode'],['pods','pods-workspace','pods-mode']]){ui(section).hidden=mode!==name;ui(button).classList.toggle('active',mode===name);}
    if(mode==='compare'){this.populateMaps();this.renderComparison();}if(['discover','pods'].includes(mode))this.participation.refresh();return true;
  }
  renderComparison(fit=false){
    for(const side of ['a','b']){
      const state=this.sides[side],map=this.workspace.maps.find(m=>m.id===state.mapId),picker=ui(`compare-node-${side}`);picker.replaceChildren(wsOption('','No response on this side'));
      ui(`edit-source-${side}`).disabled=!this.canEditMap(map);
      for(const action of ['next','all','collapse'])ui(`compare-${action}-${side}`).disabled=!map;
      if(!map){ui(`source-summary-${side}`).textContent='Create a second map in Individual map to compare.';continue;}
      for(const node of map.nodes)picker.append(wsOption(node.id,node.title));
      if(state.nodeId&&!map.nodes.some(n=>n.id===state.nodeId))picker.append(wsOption(state.nodeId,'Previously selected node was deleted'));
      picker.value=state.nodeId||'';this.renderSource(side);
    }
    this.canvas.setMaps(Object.fromEntries(['a','b'].map(side=>[side,{...this.sides[side],map:this.workspace.maps.find(m=>m.id===this.sides[side].mapId),frame:ui(`compare-frame-${side}`).value}])),this.workspace.comparisons.map(record=>({...record,needsReview:comparisonHealth(this.workspace,record).needsReview})),this.editingRecord,{fit});
    this.renderRecords();this.refreshStages();
  }
  renderSource(side){
    const state=this.sides[side],map=this.workspace.maps.find(m=>m.id===state.mapId),node=map?.nodes.find(n=>n.id===state.nodeId),host=ui(`source-summary-${side}`);host.replaceChildren();
    if(!node){host.textContent=state.nodeId?'The original node was deleted. Its saved snapshot is retained in the comparison record.':'No response selected. Choose a node in the map or the list above.';return;}
    const kind=document.createElement('span');kind.className='source-kind';kind.textContent=node.kind[0].toUpperCase()+node.kind.slice(1);const title=document.createElement('strong');title.textContent=node.title;const summary=document.createElement('p');summary.textContent=node.summary;host.append(kind,title,summary);
    if(node.details||node.sourceTitle||node.sourceUrl){const details=document.createElement('details'),label=document.createElement('summary');label.textContent='Context and source';details.append(label);for(const text of [node.details,node.sourceTitle])if(text){const p=document.createElement('p');p.textContent=text;details.append(p);}if(node.sourceUrl){const a=document.createElement('a');a.href=node.sourceUrl;a.textContent='Open source ↗';a.target='_blank';a.rel='noopener noreferrer';details.append(a);}host.append(details);}
  }
  selectSource(side,id,focus=false){this.sides[side].nodeId=id||null;ui(`compare-node-${side}`).value=id||'';this.canvas.pick(side,id||null,focus);ui(`compare-frame-${side}`).value=this.canvas.states[side].frame;this.renderSource(side);if(ui('question-status').value||ui('shared-question').value)this.comparisonDirty=true;}
  refreshStages(){const matched=ui('question-status').value==='matched';ui('answer-stage').hidden=!matched;ui('answer-status').required=matched;if(!matched)ui('answer-status').value='';ui('divergence-note').hidden=ui('answer-status').value!=='divergent';ui('shared-question-label').textContent=matched?'Shared question':ui('question-status').value==='incommensurable'?'Describe the different questions':'Question not yet addressed by both people';}
  clearComparison(){this.editingRecord=null;this.comparisonDirty=false;ui('comparison-form').reset();ui('comparison-review-warning').hidden=true;ui('comparison-snapshots').hidden=true;ui('comparison-form-title').textContent='Record a correspondence';ui('comparison-editing').textContent='';ui('record-comparison').textContent='Record comparison';ui('comparison-error').textContent='';ui('comparison-error').dataset.state='';this.refreshStages();}
  renderRecords(){
    const host=ui('comparison-records');host.replaceChildren();ui('comparison-record-count').textContent=String(this.workspace.comparisons.length);
    if(!this.workspace.comparisons.length){const p=document.createElement('p');p.className='empty-records';p.textContent='Your recorded correspondences will appear here, with references back to both original maps.';host.append(p);return;}
    for(const record of [...this.workspace.comparisons].reverse()){
      const health=comparisonHealth(this.workspace,record),button=document.createElement('button');button.type='button';button.className=`comparison-record${this.editingRecord===record.id?' active':''}`;
      const people=document.createElement('span');people.className='record-people';people.textContent=`${this.workspace.maps.find(m=>m.id===record.aMapId).name} / ${this.workspace.maps.find(m=>m.id===record.bMapId).name}`;
      const title=document.createElement('strong');title.textContent=record.question;const status=document.createElement('span');status.className='record-status';status.textContent=QUESTION_STATUSES[record.questionStatus]+(record.answerStatus?` · ${ANSWER_STATUSES[record.answerStatus]}`:'');button.append(people,title,status);
      if(health.needsReview){const review=document.createElement('span');review.className='record-review';review.textContent=health.missing.length?'Source deleted · Needs review':'Source changed · Needs review';button.append(review);}
      button.onclick=()=>this.openRecord(record.id);host.append(button);
    }
  }
  openRecord(id){
    if(!this.canLeaveComparison())return;const record=this.workspace.comparisons.find(c=>c.id===id);if(!record)return;this.clearComparison();this.editingRecord=id;
    this.sides={a:{mapId:record.aMapId,nodeId:record.aNodeId},b:{mapId:record.bMapId,nodeId:record.bNodeId}};this.populateMaps();for(const side of ['a','b'])ui(`compare-frame-${side}`).value='all';
    ui('question-status').value=record.questionStatus;ui('shared-question').value=record.question;ui('answer-status').value=record.answerStatus||'';ui('comparison-notes').value=record.notes;ui('comparison-form-title').textContent='Review this correspondence';ui('record-comparison').textContent='Save reviewed comparison';ui('comparison-editing').textContent=`${record.history.length} earlier ${record.history.length===1?'version':'versions'}`;
    const health=comparisonHealth(this.workspace,record);ui('comparison-review-warning').hidden=!health.needsReview;ui('comparison-review-warning').textContent='A source node, its context, or its connections changed. Review the current maps against the saved sources before recording a new judgment.';
    ui('comparison-snapshots').hidden=false;const host=ui('comparison-snapshot-content');host.replaceChildren();
    for(const [label,item]of [['Last recorded',record],...record.history.map((item,index)=>[`Earlier version ${index+1}`,item])]){const section=document.createElement('details'),summary=document.createElement('summary');summary.textContent=`${label}: ${QUESTION_STATUSES[item.questionStatus]}${item.answerStatus?' · '+ANSWER_STATUSES[item.answerStatus]:''}`;section.append(summary);for(const side of ['a','b']){const node=item[`${side}Snapshot`]?.node,p=document.createElement('p');p.textContent=`${side.toUpperCase()}: ${node?node.title+'\n'+node.summary:'No response selected'}`;section.append(p);}if(item.notes){const p=document.createElement('p');p.textContent=item.notes;section.append(p);}host.append(section);}
    this.renderComparison();this.canvas.fitSelection();this.comparisonDirty=false;
  }
  record(){
    try{const input={aMapId:this.sides.a.mapId,bMapId:this.sides.b.mapId,aNodeId:this.sides.a.nodeId,bNodeId:this.sides.b.nodeId,questionStatus:ui('question-status').value,question:ui('shared-question').value,answerStatus:ui('answer-status').value||null,notes:ui('comparison-notes').value};const existing=this.workspace.comparisons.find(c=>c.id===this.editingRecord);const record=recordComparison(this.workspace,input,existing);if(existing)this.workspace.comparisons=this.workspace.comparisons.map(c=>c.id===existing.id?record:c);else this.workspace.comparisons.push(record);this.comparisonDirty=false;this.markDirty();this.openRecord(record.id);ui('comparison-error').textContent='Comparison recorded. Save the workspace to keep it.';ui('comparison-error').dataset.state='success';}
    catch(error){ui('comparison-error').textContent=error.message;ui('comparison-error').dataset.state='error';}
  }
  collectWork(){
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
    if(!file)return;try{if(file.size>2_000_000)throw Error('This file exceeds the 2 MB prototype limit.');const workspace=validateWorkspace(JSON.parse(await file.text()));if((this.workspaceDirty||this.comparisonDirty||this.editor.hasDraft())&&!confirm('Replace the current unsaved workspace with this file?'))return;
      this.loadingMap=true;this.workspace=workspace;this.activeMapId=workspace.maps[0].id;this.sides={a:{mapId:workspace.maps[0].id,nodeId:null},b:{mapId:workspace.maps[1]?.id||null,nodeId:null}};this.clearComparison();this.loadMap(this.activeMapId);this.populateMaps();this.workspaceDirty=!this.fileMode;this.status('Workspace file opened');this.message();if(this.mode==='compare')this.renderComparison();this.participation.peopleSelection=null;this.participation.refresh();}
    catch(error){this.message(`File was not opened: ${error.message}`);}finally{ui('workspace-file').value='';}
  }
  showMapDialog(rename=false,{type='personal',newPerson=false}={}){
    if(!this.editor.beforeLeave()||!this.canLeaveComparison())return;this.renameMap=rename;const map=this.activeMap();
    ui('map-dialog-title').textContent=rename?'Rename map':'Create a map';ui('map-name-input').value=rename?map.name:'';ui('map-type-input').value=rename?map.mapType:type;ui('map-type-input').disabled=rename;
    ui('map-owner-input').replaceChildren(...this.workspace.participants.map(p=>wsOption(p.id,p.name)),wsOption('new','＋ New participant'));ui('map-owner-input').value=rename?map.ownerId:newPerson?'new':this.participation.actorId;ui('map-owner-input').disabled=rename;
    ui('map-person-input').value=rename?(this.workspace.participants.find(p=>p.id===map.ownerId)?.name||map.person):'';ui('map-person-group').hidden=!rename&&ui('map-owner-input').value!=='new';ui('map-person-input').required=rename||ui('map-owner-input').value==='new';
    ui('map-start-group').hidden=rename;ui('map-start-input').replaceChildren(wsOption('','Three empty frames'),...this.workspace.maps.map(m=>wsOption(m.id,'Copy '+m.name)));ui('map-dialog-error').textContent='';ui('confirm-map').textContent=rename?'Save name':'Create map';ui('map-dialog').showModal();ui('map-name-input').focus();
  }
  sharedNodeNote(node){
    if(!node?.ideaId)return '';const idea=this.workspace.ideas.find(i=>i.id===node.ideaId);if(!idea)return '';
    const current=idea.versions.at(-1),own=idea.originMapId===this.activeMapId&&idea.originNodeId===node.id;
    return `${own?'Original wording':'Shared wording'} · version ${node.ideaVersion}.${current.version!==node.ideaVersion?' A newer version is available at the original source.':''} ${own?'Edits create a new version for co-signers to review.':'Editing the wording creates an independent version. Existing co-signs remain attached to their recorded wording.'}`;
  }
  exploreNode(mapId,nodeId=null){if(this.showMode('discover'))this.participation.openMap(mapId,nodeId);}
  bind(){
    ui('individual-mode').onclick=()=>this.showMode('individual');ui('comparison-mode').onclick=()=>this.showMode('compare');ui('discover-mode').onclick=()=>this.showMode('discover');ui('pods-mode').onclick=()=>this.showMode('pods');ui('explore-current').onclick=()=>this.exploreNode(this.activeMapId);
    ui('map-select').onchange=()=>{if(!this.editor.beforeLeave()){ui('map-select').value=this.activeMapId;return;}this.captureActive();this.loadMap(ui('map-select').value);};
    ui('new-map').onclick=()=>this.showMapDialog();ui('map-settings').onclick=()=>this.showMapDialog(true);ui('close-map-dialog').onclick=()=>ui('map-dialog').close();
    ui('map-owner-input').onchange=()=>{const fresh=ui('map-owner-input').value==='new';ui('map-person-group').hidden=!fresh;ui('map-person-input').required=fresh;};
    ui('map-dialog-form').onsubmit=e=>{
      e.preventDefault();try{const name=ui('map-name-input').value.trim(),person=ui('map-person-input').value.trim();if(!name)throw Error('Enter a map name.');this.captureActive();let map;
        if(this.renameMap){map=this.activeMap();map.name=name;const owner=this.workspace.participants.find(p=>p.id===map.ownerId);if(!person)throw Error('Enter the person’s name.');owner.name=person;for(const m of this.workspace.maps)if(m.ownerId===owner.id){m.person=person;m.revision++;}}
        else map=createOwnedMap(this.workspace,{name,ownerId:ui('map-owner-input').value,personName:person,mapType:ui('map-type-input').value,fromMapId:ui('map-start-input').value||null});
        this.comparisonDirty=false;this.participation.actorId=map.ownerId;this.showMode('individual');this.loadMap(map.id);this.populateMaps();this.markDirty();ui('map-dialog').close();
      }catch(error){ui('map-dialog-error').textContent=error.message;}
    };
    ui('map-name-input').oninput=()=>ui('map-name-input').setCustomValidity('');
    for(const side of ['a','b']){
      ui(`compare-map-${side}`).onchange=()=>{if(!this.canLeaveComparison()){ui(`compare-map-${side}`).value=this.sides[side].mapId;return;}this.clearComparison();this.sides[side]={mapId:ui(`compare-map-${side}`).value,nodeId:null};this.renderComparison();};
      ui(`compare-node-${side}`).onchange=()=>this.selectSource(side,ui(`compare-node-${side}`).value,true);
      ui(`compare-frame-${side}`).onchange=()=>this.canvas.setFrame(side,ui(`compare-frame-${side}`).value);
      ui(`compare-next-${side}`).onclick=()=>this.canvas.expand(side);
      ui(`compare-all-${side}`).onclick=()=>this.canvas.expand(side,true);
      ui(`compare-collapse-${side}`).onclick=()=>this.canvas.collapse(side);
      ui(`edit-source-${side}`).onclick=()=>{const state=this.sides[side];if(!this.showMode('individual'))return;this.loadMap(state.mapId);this.populateMaps();if(state.nodeId&&this.activeMap().nodes.some(n=>n.id===state.nodeId))this.editor.focusNode(state.nodeId);};
    }
    ui('new-comparison').onclick=()=>{if(!this.canLeaveComparison())return;this.clearComparison();this.sides.a.nodeId=null;this.sides.b.nodeId=null;this.renderComparison();};
    ui('question-status').onchange=()=>this.refreshStages();ui('answer-status').onchange=()=>this.refreshStages();
    ui('comparison-form').addEventListener('input',()=>{this.comparisonDirty=true;});ui('comparison-form').addEventListener('change',()=>{this.comparisonDirty=true;});ui('comparison-form').onsubmit=e=>{e.preventDefault();this.record();};
    ui('save-workspace').onclick=()=>this.save();ui('download-workspace').onclick=()=>this.download();ui('open-workspace').onclick=()=>ui('workspace-file').click();ui('workspace-file').onchange=()=>this.openFile(ui('workspace-file').files[0]);
    ui('reload-workspace').onclick=()=>{if((this.workspaceDirty||this.comparisonDirty||this.editor.hasDraft())&&!confirm('Reopen the last saved workspace and discard current unsaved changes?'))return;this.initialize();};
    window.addEventListener('beforeunload',e=>{if(this.workspaceDirty||this.comparisonDirty||this.editor.hasDraft()){e.preventDefault();e.returnValue='';}});
  }
}
