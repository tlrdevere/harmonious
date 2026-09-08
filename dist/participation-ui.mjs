import {ComparisonCanvas} from './compare-canvas.mjs';
import {NODE_KINDS,frameOf} from './model.mjs';
import {roots} from './data.mjs';
import {scopeNodeIds,ideaVersion,endorsementIndex,nodeEndorsements,endorsementHealth,endorseNodes,transferNodes,withdrawEndorsement,derivePodMap,commonEndorsers} from './adoption.mjs';
const adUI=id=>document.getElementById(id);
const adEl=(tag,text='',className='')=>{const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;};
const adOption=(value,label)=>{const o=adEl('option',label);o.value=value;return o;};
export class ParticipationUI{
  constructor(controller){
    this.controller=controller;this.actorId=controller.workspace.participants[0]?.id;this.mapId=null;this.nodeId=null;this.podMapId=null;this.podNodeId=null;this.peopleSelection=null;this.nodeSet=new Set();this.history=false;this.index=new Map();this.pending=null;
    this.canvas=new ComparisonCanvas(adUI('reference-canvas'),(_,id)=>{this.nodeId=id;this.canvas.pick('a',id);this.renderDetail();},()=>{},{single:true,nodeMeta:n=>n.parent===null?'Frame':`${nodeEndorsements(this.index,n).current.size} co-signs · ${NODE_KINDS[n.kind].label}`});
    this.podCanvas=new ComparisonCanvas(adUI('pod-canvas'),(_,id)=>{this.podNodeId=id;this.podCanvas.pick('a',id);this.renderPodDetail();},()=>{},{single:true,hint:'Select a shared node to see its members. Muted nodes provide context.',nodeMeta:n=>n.parent===null?'Frame':n.podContext?'Context only':`${nodeEndorsements(this.pod?.index||new Map(),n).current.size} / ${this.pod?.people.length||0} co-sign`});
    this.bind();
  }
  get workspace(){return this.controller.workspace;}
  personName(id){return this.workspace.participants.find(p=>p.id===id)?.name||'Unknown participant';}
  source(){return this.workspace.maps.find(m=>m.id===this.mapId);}
  feedback(text=''){adUI('discovery-feedback').hidden=!text;adUI('discovery-feedback').textContent=text;}
  refresh(){
    if(this.controller.accountMode)this.actorId=this.controller.account.actor?.id;
    if(!this.workspace.participants.some(p=>p.id===this.actorId))this.actorId=this.workspace.participants[0]?.id;
    const select=adUI('acting-participant');select.replaceChildren(...this.workspace.participants.map(p=>adOption(p.id,p.name)));select.value=this.actorId||'';
    if(!this.source()){this.mapId=(this.workspace.maps.find(m=>m.mapType==='reference')||this.workspace.maps[0])?.id;this.nodeId=null;}
    if(!this.workspace.maps.some(m=>m.id===this.podMapId))this.podMapId=this.mapId;
    if(this.controller.mode==='discover')this.renderExplore();if(this.controller.mode==='pods')this.renderPods();
  }
  openMap(id,nodeId=null){this.mapId=id;this.nodeId=nodeId;this.history=false;this.renderExplore(true);if(nodeId)this.canvas.fitSelection();}
  renderExplore(fit=false){
    this.index=endorsementIndex(this.workspace);adUI('discovery-browse').hidden=this.history;adUI('endorsement-history').hidden=!this.history;
    adUI('browse-endorsements').classList.toggle('active',!this.history);adUI('my-endorsements').classList.toggle('active',this.history);
    const pending=this.workspace.endorsements.filter(e=>e.participantId===this.actorId&&e.status==='active'&&endorsementHealth(this.workspace,e).needsReview).length;
    adUI('my-endorsements').textContent=`My co-signs${pending?` · ${pending} need review`:''}`;
    if(this.history){this.renderHistory();return;}
    this.renderCatalog();const map=this.source();if(!map)return;
    if(!map.nodes.some(n=>n.id===this.nodeId))this.nodeId=null;
    adUI('reference-title').textContent=map.name;adUI('reference-credit').textContent=`${map.mapType==='reference'?'Reference map by':'Personal worldview of'} ${this.personName(map.ownerId)}`;
    adUI('reference-edit').hidden=!this.controller.canEditMap(map);
    this.canvas.setMaps({a:{map,nodeId:this.nodeId,frame:'all'},b:{map:null,nodeId:null,frame:'all'}},[],null,{fit});this.renderDetail();
  }
  renderCatalog(){
    const host=adUI('discover-map-list'),results=adUI('discover-search-results'),query=adUI('discover-search').value.trim().toLowerCase();host.replaceChildren();results.replaceChildren();
    const score=map=>map.nodes.reduce((sum,n)=>sum+nodeEndorsements(this.index,n).current.size,0);
    const maps=[...this.workspace.maps].filter(m=>!m.unavailable&&(!query||[m.name,this.personName(m.ownerId),...m.nodes.map(n=>n.title+' '+n.summary)].some(s=>s.toLowerCase().includes(query))));
    maps.sort((a,b)=>adUI('discover-sort').value==='name'?a.name.localeCompare(b.name):score(b)-score(a)||(a.mapType==='reference'?-1:1)-(b.mapType==='reference'?-1:1)||a.name.localeCompare(b.name));
    for(const map of maps){const b=adEl('button','',`catalog-map${map.id===this.mapId?' active':''}`);b.type='button';b.append(adEl('span',map.mapType==='reference'?'REFERENCE MAP':'PERSONAL MAP','catalog-type'),adEl('strong',map.name),adEl('span',`By ${this.personName(map.ownerId)}`),adEl('span',`${score(map)} node co-signs`,'catalog-count'));b.onclick=()=>this.openMap(map.id);host.append(b);}
    if(!maps.length)host.append(adEl('p','No matching maps or nodes.','empty-records'));
    if(query){results.append(adEl('h3','Matching nodes'));let count=0;for(const map of maps)for(const node of map.nodes){if(node.parent===null||!`${node.title} ${node.summary}`.toLowerCase().includes(query)||count>=20)continue;const b=adEl('button','', 'catalog-node');b.type='button';b.append(adEl('strong',node.title),adEl('span',map.name));b.onclick=()=>this.openMap(map.id,node.id);results.append(b);count++;}if(!count)results.append(adEl('p','No matching content nodes.'));}
  }
  names(ids){return [...ids].map(id=>this.personName(id)).join(', ');}
  wording(host,node){host.append(adEl('span',node.parent===null?'Frame':NODE_KINDS[node.kind].label,'catalog-type'),adEl('h2',node.title),adEl('p',node.summary,'detail-summary'));if(node.details){const d=adEl('details'),s=adEl('summary','Reasoning and context');d.append(s,adEl('p',node.details));host.append(d);}if(node.sourceTitle)host.append(adEl('p',node.sourceTitle,'field-help'));if(node.sourceUrl){const a=adEl('a','Open source ↗');a.href=node.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';host.append(a);}}
  renderDetail(){
    const map=this.source(),node=map?.nodes.find(n=>n.id===this.nodeId),host=adUI('reference-detail'),supporters=adUI('reference-supporters');host.replaceChildren();supporters.replaceChildren();adUI('reference-actions').hidden=!node;
    if(!node){host.append(adEl('h2','Find a node to build from'),adEl('p','Expand a frame, then choose a node to read its wording and see who co-signs it.'));supporters.textContent='Choose a content node to see its members.';return;}
    this.wording(host,node);const root=node.parent===null;adUI('cosign-node').hidden=root;adUI('view-node-pod').hidden=root;adUI('endorse-section').disabled=!scopeNodeIds(map,'section',node.id).length;adUI('copy-section').disabled=adUI('endorse-section').disabled;
    if(root){supporters.textContent='A frame organizes the map. Select content nodes to record a co-sign.';return;}
    const idea=this.workspace.ideas.find(i=>i.id===node.ideaId),latest=idea.versions.at(-1),counts=nodeEndorsements(this.index,node);host.append(adEl('p',`Wording version ${node.ideaVersion}`,'wording-version'));
    if(latest.version!==node.ideaVersion){host.append(adEl('p',`A newer version (${latest.version}) is available. Existing co-signs stay with their recorded wording.`,'review-warning'));}
    if(idea.originMapId!==map.id||idea.originNodeId!==node.id||latest.version!==node.ideaVersion){const original=this.workspace.maps.find(m=>m.id===idea.originMapId);if(original?.nodes.some(n=>n.id===idea.originNodeId)){const button=adEl('button',`Open original in ${original.name}`,'text-button');button.onclick=()=>this.openMap(original.id,idea.originNodeId);host.append(button);}}
    if(node.copiedFrom){const original=this.workspace.maps.find(m=>m.id===node.copiedFrom.mapId);host.append(adEl('p',`${node.reuseMode==='linked'?'Shared from':'Adapted from'} ${original?.name||'an earlier source map'}.`,'field-help'));}
    supporters.append(adEl('strong',`${counts.current.size} current ${counts.current.size===1?'co-sign':'co-signs'}`),adEl('p',counts.current.size?this.names(counts.current):'No current co-signs yet.'));
    if(counts.review.size)supporters.append(adEl('p',`${counts.review.size} need review: ${this.names(counts.review)}`,'review-warning'));
    if(counts.current.has(this.actorId)){const b=adEl('button','Review or withdraw my co-signs','text-button');b.onclick=()=>{this.history=true;this.renderExplore();};supporters.append(b);}
    adUI('cosign-node').disabled=latest.version!==node.ideaVersion;
  }
  editSource(){const map=this.source();if(!map||!this.controller.showMode('individual'))return;this.controller.loadMap(map.id);this.controller.populateMaps();if(this.nodeId)this.controller.editor.focusNode(this.nodeId);}
  openAction(mode,scope='node',record=null){
    const map=this.source();if(!map)return;this.pending={mode,sourceMapId:map.id,actorId:this.actorId,anchorId:this.nodeId,replaceId:record?.id||null,record};
    adUI('adoption-title').textContent=mode==='copy'?'Copy content to adapt':record?`Review co-sign for ${this.personName(this.actorId)}`:`Co-sign as ${this.personName(this.actorId)}`;
    adUI('adoption-source').textContent=`From ${map.name} · ${this.personName(map.ownerId)}`;adUI('adoption-scope').value=scope;adUI('adoption-scope').options[0].disabled=!this.nodeId||roots.includes(this.nodeId);adUI('adoption-scope').options[1].disabled=!this.nodeId;
    adUI('adoption-add').checked=mode!=='copy';adUI('adoption-add-label').hidden=mode==='copy';adUI('adoption-error').textContent='';
    const prior=adUI('adoption-prior');prior.replaceChildren();prior.hidden=!record;
    if(record){const d=adEl('details'),s=adEl('summary','Previously co-signed wording');d.append(s);for(const e of record.entries){const old=ideaVersion(this.workspace,e.ideaId,e.version);if(old)d.append(adEl('strong',old.content.title),adEl('p',old.content.summary));}prior.append(d);}
    const targets=this.workspace.maps.filter(m=>m.ownerId===this.actorId&&m.id!==map.id&&(mode==='copy'||m.mapType==='personal'));
    const target=adUI('adoption-target');target.replaceChildren(...targets.map(m=>adOption(m.id,m.name)));
    const oldTarget=record?.entries.find(e=>e.targetMapId)?.targetMapId;if(targets.some(m=>m.id===oldTarget))target.value=oldTarget;
    adUI('adoption-add').disabled=!targets.length;if(!targets.length)adUI('adoption-add').checked=false;
    this.renderActionNodes();adUI('adoption-dialog').showModal();
  }
  renderActionNodes(){
    const map=this.workspace.maps.find(m=>m.id===this.pending.sourceMapId),scope=adUI('adoption-scope').value,ids=scopeNodeIds(map,scope,this.pending.anchorId),host=adUI('adoption-node-list');host.replaceChildren();
    for(const id of ids){const node=map.nodes.find(n=>n.id===id),idea=this.workspace.ideas.find(i=>i.id===node.ideaId),older=node.ideaVersion!==idea.versions.at(-1).version;
      const wasSelected=!this.pending.record||this.pending.record.entries.some(e=>e.ideaId===node.ideaId||(this.pending.sourceMapId===this.pending.record.sourceMapId&&e.sourceNodeId===node.id));
      const label=adEl('label','', 'adoption-node-choice'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=id;checkbox.checked=wasSelected&&(!older||this.pending.mode==='copy');checkbox.disabled=older&&this.pending.mode!=='copy';
      const text=adEl('span');text.append(adEl('strong',node.title),adEl('span',node.summary),adEl('small',`${NODE_KINDS[node.kind].label} · v${node.ideaVersion}${older?' · newer wording at original source':''}`));label.append(checkbox,text);host.append(label);checkbox.onchange=()=>this.refreshAction();
    }
    if(!ids.length)host.append(adEl('p','There are no content nodes in this selection.'));
    this.refreshAction();
  }
  actionIds(){return [...adUI('adoption-node-list').querySelectorAll('input:checked')].map(el=>el.value);}
  refreshAction(){
    const ids=this.actionIds(),copy=this.pending.mode==='copy',add=copy||adUI('adoption-add').checked,map=this.workspace.maps.find(m=>m.id===this.pending.sourceMapId),target=this.workspace.maps.find(m=>m.id===adUI('adoption-target').value),frames=new Set(ids.map(id=>frameOf(map.nodes,id)));
    adUI('adoption-selection-count').textContent=`${ids.length} ${ids.length===1?'node':'nodes'} selected`;adUI('adoption-destination').hidden=!add;
    const parent=adUI('adoption-parent'),previous=parent.value;parent.replaceChildren(adOption('','Matching frame(s)'));
    if(frames.size===1&&target)for(const n of target.nodes)if(frames.has(frameOf(target.nodes,n.id)))parent.append(adOption(n.id,n.title));
    if([...parent.options].some(o=>o.value===previous))parent.value=previous;
    adUI('adoption-parent-group').hidden=frames.size!==1;adUI('adoption-placement-note').textContent=target?'Only selected nodes are added. Their internal connections are preserved; other branches stay outside the selection.':'Create a destination map for this participant under Maps, or co-sign without adding nodes.';
    adUI('adoption-meaning').textContent=copy?'This creates independent nodes with source attribution. Editing them will not change the originals. Copying records no endorsement.':`This records ${this.personName(this.pending.actorId)}’s co-sign for the checked wording and selected structure, at the displayed versions. Later additions or edits require review.${this.pending.replaceId?' Confirming replaces the earlier record; its history is retained.':''}`;
    adUI('adoption-confirm').textContent=copy?`Copy ${ids.length} nodes`:`Record ${ids.length} co-signs${add?' & add to map':''}`;adUI('adoption-confirm').disabled=!ids.length||(add&&!target);
  }
  submitAction(){
    try{
      const p=this.pending,ids=this.actionIds(),scope=adUI('adoption-scope').value,source=this.workspace.maps.find(m=>m.id===p.sourceMapId),all=scopeNodeIds(source,scope,p.anchorId),targetMapId=adUI('adoption-target').value||null;
      if(p.mode==='copy')transferNodes(this.workspace,{sourceMapId:p.sourceMapId,targetMapId,nodeIds:ids,mode:'copy',parentId:adUI('adoption-parent-group').hidden?null:adUI('adoption-parent').value||null});
      else endorseNodes(this.workspace,{participantId:p.actorId,sourceMapId:p.sourceMapId,nodeIds:ids,scope:all.length===ids.length?scope:'selection',anchorId:p.anchorId,targetMapId:adUI('adoption-add').checked?targetMapId:null,parentId:adUI('adoption-parent-group').hidden?null:adUI('adoption-parent').value||null,replaceId:p.replaceId});
      this.controller.loadMap(this.controller.activeMapId);this.controller.populateMaps();this.controller.markDirty();adUI('adoption-dialog').close();this.pending=null;
      this.feedback(p.mode==='copy'?`${ids.length} nodes copied. Open the destination map to adapt them.`:`${ids.length} co-signs recorded for ${this.personName(p.actorId)}. ${this.controller.accountMode?'Saving to your account…':'Save the workspace to keep them.'}`);this.renderExplore();
    }catch(error){adUI('adoption-error').textContent=error.message;}
  }
  renderHistory(){
    const host=adUI('endorsement-history');host.replaceChildren(adEl('h2',`Co-signs recorded for ${this.personName(this.actorId)}`));const records=this.workspace.endorsements.filter(e=>e.participantId===this.actorId).slice().reverse();
    if(!records.length){host.append(adEl('p','No co-signs have been recorded for this participant. Browse a map to choose the wording they share.','empty-records'));return;}
    for(const record of records){const health=endorsementHealth(this.workspace,record),card=adEl('article','', 'endorsement-record'),heading=adEl('div','', 'section-heading');heading.append(adEl('h3',record.sourceMapName),adEl('span',record.status==='active'?(health.needsReview?'Needs review':'Current'):record.status,'endorsement-state'));card.append(heading,adEl('p',`${record.entries.length} selected nodes · ${record.scope} · ${new Date(record.createdAt).toLocaleDateString()}`,'field-help'));
      if(health.needsReview&&record.status==='active')card.append(adEl('p',health.issues.join(' · '),'review-warning'));
      const list=adEl('details'),summary=adEl('summary','Recorded wording');list.append(summary);for(const e of record.entries){const content=ideaVersion(this.workspace,e.ideaId,e.version)?.content;if(content)list.append(adEl('strong',`${content.title} · v${e.version}`),adEl('p',content.summary));}card.append(list);
      const actions=adEl('div','', 'reference-action-row'),source=this.workspace.maps.find(m=>m.id===record.sourceMapId);
      if(source){const open=adEl('button','Open source map');open.onclick=()=>this.openMap(source.id,source.nodes.some(n=>n.id===record.entries[0].sourceNodeId)?record.entries[0].sourceNodeId:null);actions.append(open);}
      if(record.status==='active'){
        const review=adEl('button','Review / co-sign again');review.disabled=!source;review.onclick=()=>this.reviewRecord(record);actions.append(review);
        const withdraw=adEl('button','Withdraw','text-button');withdraw.onclick=()=>{withdrawEndorsement(this.workspace,record.id,this.actorId);this.controller.markDirty();this.feedback('This record was withdrawn. Other active co-sign records, if any, still apply.');this.renderExplore();};actions.append(withdraw);
      }
      card.append(actions);host.append(card);
    }
  }
  reviewRecord(record){
    let source=this.workspace.maps.find(m=>m.id===record.sourceMapId),anchor=record.anchorId;
    if(record.entries.length===1){const entry=record.entries[0],current=source?.nodes.find(n=>n.id===entry.sourceNodeId),idea=this.workspace.ideas.find(i=>i.id===entry.ideaId),origin=this.workspace.maps.find(m=>m.id===idea?.originMapId);anchor=current?.id;
      if(current?.ideaId===entry.ideaId&&current.ideaVersion!==idea.versions.at(-1).version&&origin?.nodes.some(n=>n.id===idea.originNodeId)){source=origin;anchor=idea.originNodeId;}
      if(!anchor){this.feedback('The selected source was removed. Its recorded wording is retained. You can withdraw this record or co-sign a different node.');return;}
    }
    if(!source)return;this.openMap(source.id,anchor&&source.nodes.some(n=>n.id===anchor)?anchor:null);this.openAction('endorse',record.entries.length===1?'node':record.scope==='section'&&this.nodeId?'section':'map',record);
  }
  renderPods(){
    const maps=adUI('pod-source');maps.replaceChildren(...this.workspace.maps.map(m=>adOption(m.id,m.name)));if(!this.workspace.maps.some(m=>m.id===this.podMapId))this.podMapId=this.mapId;maps.value=this.podMapId;
    if(this.peopleSelection===null)this.peopleSelection=new Set(this.workspace.participants.map(p=>p.id));const people=adUI('pod-people');people.replaceChildren();
    for(const p of this.workspace.participants){const label=adEl('label','', 'checkbox-label'),box=document.createElement('input');box.type='checkbox';box.checked=this.peopleSelection.has(p.id);box.onchange=()=>{box.checked?this.peopleSelection.add(p.id):this.peopleSelection.delete(p.id);this.renderPods();};label.append(box,adEl('span',p.name));people.append(label);}
    const select=adUI('pod-threshold'),previous=this.requestedThreshold||select.value;this.requestedThreshold=null;select.replaceChildren(adOption('all','Everyone selected'));for(let n=1;n<this.peopleSelection.size;n++)select.append(adOption(String(n),`At least ${n} ${n===1?'person':'people'}`));if([...select.options].some(o=>o.value===previous))select.value=previous;
    const minimum=select.value==='all'?this.peopleSelection.size:Number(select.value);this.pod=derivePodMap(this.workspace,this.podMapId,[...this.peopleSelection],minimum);
    const source=this.workspace.maps.find(m=>m.id===this.podMapId);if(!this.pod.map.nodes.some(n=>n.id===this.podNodeId))this.podNodeId=null;this.nodeSet=new Set([...this.nodeSet].filter(id=>source.nodes.some(n=>n.id===id)));
    adUI('pod-result-count').textContent=this.peopleSelection.size?`${this.pod.matched.size} nodes meet this threshold among ${this.peopleSelection.size} people.`:'Choose at least one person.';
    this.podCanvas.setMaps({a:{map:this.pod.map,nodeId:this.podNodeId,frame:'all'},b:{map:null,nodeId:null,frame:'all'}},[],null,{fit:true});
    // Show the shared results immediately; users can collapse either a branch or the entire view.
    this.podCanvas.expand('a',true);this.renderPodDetail();
  }
  renderPodDetail(){
    const host=adUI('pod-node-detail'),node=this.pod?.map.nodes.find(n=>n.id===this.podNodeId);host.replaceChildren();adUI('pod-add-node').disabled=!node||node.parent===null;
    if(node){this.wording(host,node);if(node.parent!==null){const counts=nodeEndorsements(this.pod.index,node);host.append(adEl('h3',`${counts.current.size} people in this node’s pod`),adEl('p',this.names(counts.current)||'No current co-signs among the selected people.'));if(node.podContext)host.append(adEl('p','This node is shown to preserve the branch’s context. It does not meet the chosen threshold.','field-help'));if(counts.review.size)host.append(adEl('p',`Needs review: ${this.names(counts.review)}`,'review-warning'));}}
    else host.append(adEl('h2','Select a node'),adEl('p','Its pod consists of the selected people who currently co-sign that exact wording.'));
    const source=this.workspace.maps.find(m=>m.id===this.podMapId),setHost=adUI('pod-set-nodes');setHost.replaceChildren();
    const nodes=[...this.nodeSet].map(id=>source.nodes.find(n=>n.id===id)).filter(Boolean);for(const n of nodes){const row=adEl('div','', 'pod-set-node'),button=adEl('button','×');button.setAttribute('aria-label',`Remove ${n.title} from this set`);button.onclick=()=>{this.nodeSet.delete(n.id);this.renderPodDetail();};row.append(adEl('span',n.title),button);setHost.append(row);}
    const common=commonEndorsers(this.pod?.index||new Map(),nodes);adUI('pod-set-people').textContent=nodes.length?`${common.size} people co-sign every selected node${common.size?': '+this.names(common):'.'}`:'No nodes in the set yet.';
  }
  bind(){
    adUI('acting-participant').onchange=()=>{this.actorId=adUI('acting-participant').value;this.feedback();this.renderExplore();};
    adUI('new-participant').onclick=()=>this.controller.showMapDialog(false,{newPerson:true});adUI('new-reference').onclick=()=>this.controller.showMapDialog(false,{type:'reference'});
    adUI('browse-endorsements').onclick=()=>{this.history=false;this.renderExplore();};adUI('my-endorsements').onclick=()=>{this.history=true;this.renderExplore();};
    adUI('discover-search').oninput=()=>this.renderCatalog();adUI('discover-sort').onchange=()=>this.renderCatalog();adUI('reference-edit').onclick=()=>this.editSource();
    for(const [prefix,canvas]of [['reference',this.canvas],['pod',this.podCanvas]]){adUI(`${prefix}-next`).onclick=()=>canvas.expand('a');adUI(`${prefix}-all`).onclick=()=>canvas.expand('a',true);adUI(`${prefix}-collapse`).onclick=()=>canvas.collapse('a');}
    adUI('cosign-node').onclick=()=>this.openAction('endorse','node');adUI('endorse-section').onclick=()=>this.openAction('endorse','section');adUI('copy-section').onclick=()=>this.openAction('copy','section');adUI('endorse-map').onclick=()=>this.openAction('endorse','map');adUI('copy-map').onclick=()=>this.openAction('copy','map');
    adUI('close-adoption').onclick=()=>{adUI('adoption-dialog').close();this.pending=null;};adUI('adoption-dialog').addEventListener('cancel',()=>this.pending=null);adUI('adoption-scope').onchange=()=>this.renderActionNodes();adUI('adoption-add').onchange=()=>this.refreshAction();adUI('adoption-target').onchange=()=>this.refreshAction();
    adUI('adoption-select-all').onclick=()=>{for(const input of adUI('adoption-node-list').querySelectorAll('input:not(:disabled)'))input.checked=true;this.refreshAction();};adUI('adoption-form').onsubmit=e=>{e.preventDefault();this.submitAction();};
    adUI('view-node-pod').onclick=()=>{this.podMapId=this.mapId;this.podNodeId=this.nodeId;this.nodeSet=new Set([this.nodeId]);this.peopleSelection=null;this.requestedThreshold='1';this.controller.showMode('pods');};
    adUI('pod-source').onchange=()=>{this.podMapId=adUI('pod-source').value;this.podNodeId=null;this.nodeSet.clear();this.renderPods();};adUI('pod-threshold').onchange=()=>this.renderPods();
    adUI('pod-add-node').onclick=()=>{if(this.podNodeId&&!roots.includes(this.podNodeId)){this.nodeSet.add(this.podNodeId);this.renderPodDetail();}};adUI('pod-clear-set').onclick=()=>{this.nodeSet.clear();this.renderPodDetail();};
    adUI('pod-explore').onclick=()=>{if(this.controller.showMode('discover'))this.openMap(this.podMapId,this.podNodeId);};
  }
}
