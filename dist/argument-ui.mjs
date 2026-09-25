import {ArgumentCanvas} from './argument-canvas.mjs';
import {ARGUMENT_KINDS,ARGUMENT_RELATIONS,argumentGraphMatches,argumentNeedsReview,argumentNodeRef,saveArgumentNode,saveArgumentEdge} from './argument.mjs';
import {comparisonProposalVersions,comparisonParticipants,validateWorkspace} from './workspace.mjs';
const argUI=id=>document.getElementById(id);
const argOption=(value,label)=>{const option=document.createElement('option');option.value=value;option.textContent=label;return option;};

export class ArgumentUI{
  constructor(controller){
    this.c=controller;this.proposalId=null;this.revision=null;this.selected=null;this.dirty=false;this.draftKind=null;this.undo=[];
    const tab=document.createElement('button');tab.id='argument-mode';tab.textContent='Argument';argUI('comparison-mode').after(tab);
    const section=document.createElement('section');section.id='argument-workspace';section.hidden=true;section.className='argument-workspace';
    section.innerHTML=`<div class="comparison-heading"><div><div class="eyebrow">REASONING TOGETHER</div><h1>Argument</h1><p id="argument-question"></p></div><button id="argument-back" type="button">Back to Compare</button></div><p id="argument-state" role="status" class="field-help"></p><div class="argument-toolbar"><label for="argument-version">Proposal version</label><select id="argument-version"></select><label id="argument-actor-label" for="argument-actor">Recording for</label><select id="argument-actor"></select><button id="argument-fit" type="button">Fit reasoning</button><button id="argument-new" type="button">Add reasoning</button><button id="argument-undo" type="button">Undo last change</button></div><div class="argument-layout"><div class="argument-stage"><div id="argument-canvas"></div></div><aside class="argument-inspector"><form id="argument-node-form"><fieldset id="argument-node-fields"><legend id="argument-form-heading">Add reasoning</legend><label for="argument-kind">Kind</label><select id="argument-kind"></select><label for="argument-title">Title</label><input id="argument-title" maxlength="120" required><label for="argument-body">Reasoning</label><textarea id="argument-body" rows="4" maxlength="10000"></textarea><label for="argument-source-url">Evidence or reference URL (optional)</label><input id="argument-source-url" type="url" maxlength="2000" placeholder="https://"><a id="argument-source-link" hidden target="_blank" rel="noopener noreferrer">Open reference</a><div id="argument-attach-group"><label for="argument-attach">Connect to</label><select id="argument-attach"></select><label for="argument-initial-relation">Relationship</label><select id="argument-initial-relation"></select></div><button type="submit" class="primary">Save reasoning</button></fieldset></form><form id="argument-edge-form"><fieldset id="argument-edge-fields"><legend>Add or review a connection</legend><label for="argument-from">From your reasoning</label><select id="argument-from" required></select><label for="argument-relation">Relationship</label><select id="argument-relation"></select><label for="argument-to">To</label><select id="argument-to" required></select><label for="argument-edge-note">Why this connection?</label><textarea id="argument-edge-note" rows="2" maxlength="2000"></textarea><button type="submit">Save connection and review endpoints</button></fieldset></form><button id="argument-withdraw" type="button" class="danger" hidden>Withdraw selected contribution</button><p id="argument-error" role="alert"></p><details><summary>Selected contribution history</summary><div id="argument-history"></div></details><h2>Reasoning and connections</h2><div id="argument-records"></div></aside></div>`;
    argUI('comparison-workspace').after(section);
    for(const id of ['argument-new','argument-undo'])argUI(id).hidden=true;
    for(const form of ['argument-node-form','argument-edge-form'])for(const button of argUI(form).querySelectorAll('button[type=submit]'))button.hidden=true;
    const open=document.createElement('button');open.id='open-argument';open.type='button';open.textContent='View earlier reasoning';argUI('comparison-snapshots').after(open);
    this.canvas=new ArgumentCanvas(argUI('argument-canvas'),(kind,id)=>this.select(kind,id),side=>this.chooseSource(side));
    for(const [id,values]of [['argument-kind',ARGUMENT_KINDS],['argument-relation',ARGUMENT_RELATIONS],['argument-initial-relation',ARGUMENT_RELATIONS]])argUI(id).replaceChildren(...Object.entries(values).map(([key,label])=>argOption(key,label)));
    tab.onclick=open.onclick=()=>this.open();argUI('argument-back').onclick=()=>{if(this.c.showMode('compare'))this.c.setComparisonRoute(this.c.workspace.comparisons.find(p=>p.id===this.proposalId)?.comparisonId,this.proposalId);};
    argUI('argument-version').onchange=()=>{if(!this.canLeave()){argUI('argument-version').value=String(this.revision);return;}this.undo=[];this.revision=Number(argUI('argument-version').value);this.clearDraft();this.render();this.writeRoute();};
    argUI('argument-actor').onchange=()=>{if(!this.canLeave()){argUI('argument-actor').value=this.actor();return;}this.actorId=argUI('argument-actor').value;this.undo=[];this.clearDraft();this.render();};
    argUI('argument-new').onclick=()=>{if(this.canLeave()){this.clearDraft();this.render();}};argUI('argument-fit').onclick=()=>this.canvas.fit();argUI('argument-undo').onclick=()=>this.undoLast();
    for(const kind of ['node','edge'])for(const event of ['input','change'])argUI(`argument-${kind}-form`).addEventListener(event,()=>this.markDraft(kind));
    argUI('argument-node-form').onsubmit=e=>{e.preventDefault();this.saveNode();};argUI('argument-edge-form').onsubmit=e=>{e.preventDefault();this.saveEdge();};argUI('argument-withdraw').onclick=()=>this.withdraw();
  }
  actor(){return this.c.account?.actor?.id||this.actorId||this.proposal()?.createdBy;}
  proposal(){return this.c.workspace.comparisons.find(p=>p.id===this.proposalId);}
  context(){const proposal=this.proposal();return {comparisonId:proposal.comparisonId,proposalId:proposal.id,proposalRevision:this.revision};}
  canLeave(){return !this.dirty||confirm('Discard the unsaved Argument form changes?');}
  clearDraft(){this.selected=null;this.dirty=false;this.draftKind=null;argUI('argument-node-form').reset();argUI('argument-edge-form').reset();argUI('argument-error').textContent='';this.c.status();}
  updateFormAvailability(){argUI('argument-node-fields').disabled=true;argUI('argument-edge-fields').disabled=true;}
  markDraft(){}
  chooseSource(side){
    const version=this.proposal()&&comparisonProposalVersions(this.proposal()).find(v=>v.revision===this.revision);
    if(!version?.[`${side}Snapshot`]?.node)return;
    const kind=this.draftKind||(this.selected?'edge':'node');if(argUI(`argument-${kind}-fields`).disabled)return;
    argUI(kind==='node'?'argument-attach':'argument-to').value=`source:${side}`;this.markDraft(kind);
  }
  reset(){this.clearDraft();this.undo=[];this.proposalId=null;this.revision=null;this.actorId=null;if(this.c.mode==='argument')this.render();}
  open(options={}){
    const id=options.proposalId||this.c.editingRecord,proposal=this.c.workspace.comparisons.find(p=>p.id===id);
    if(!proposal){if(!this.canLeave())return;this.reset();this.c.showMode('argument');this.c.message('Select an earlier comparison to read its reasoning.');return;}
    if(this.proposalId!==id&&!this.canLeave())return;
    const changedProposal=this.proposalId!==id;
    if(changedProposal){this.clearDraft();this.undo=[];this.proposalId=id;this.revision=comparisonProposalVersions(proposal).at(-1).revision;}
    if(options.revision&&options.revision!==this.revision&&comparisonProposalVersions(proposal).some(v=>v.revision===options.revision)){if(!this.canLeave())return;this.clearDraft();this.undo=[];this.revision=options.revision;}
    if(!this.c.showMode('argument'))return;
    this.render();if(changedProposal)this.canvas.adoptCompareView(this.c.canvas);this.writeRoute();
    this.c.library?.context();
    if(this.c.comparisonDirty)this.c.message('Argument uses the last recorded proposal. Your unrecorded Compare draft is still there.');
  }
  writeRoute(){const proposal=this.proposal();if(!proposal)return;const route=new URLSearchParams({comparison:proposal.comparisonId,proposal:proposal.id,view:'argument',revision:String(this.revision)});history.replaceState(null,'',`${location.pathname}${location.search}#${route}`);}
  render(){
    const proposal=this.proposal();if(!proposal){this.clearDraft();this.undo=[];this.canvas.context=null;this.canvas.world.replaceChildren();argUI('argument-records').replaceChildren();argUI('argument-history').replaceChildren();argUI('argument-question').textContent='Unavailable comparison';argUI('argument-source-link').hidden=argUI('argument-withdraw').hidden=true;argUI('argument-state').textContent='This proposal is no longer available to this account.';argUI('argument-node-fields').disabled=argUI('argument-edge-fields').disabled=true;return;}
    const versions=comparisonProposalVersions(proposal),version=versions.find(v=>v.revision===this.revision)||versions.at(-1);this.revision=version.revision;
    argUI('argument-version').disabled=false;
    const ws=this.c.workspace,actor=this.actor(),participants=comparisonParticipants(ws,proposal),editable=false;
    argUI('argument-question').textContent=version.question;argUI('argument-version').replaceChildren(...versions.map(v=>argOption(v.revision,`Version ${v.revision}${v.revision===versions.at(-1).revision?' · Current':''}`)));argUI('argument-version').value=String(this.revision);
    argUI('argument-state').textContent='Earlier reasoning is preserved here. Use Compare, Inquiry, and Argument on the shared map for new interactions.';
    argUI('argument-actor-label').hidden=argUI('argument-actor').hidden=!!this.c.accountMode;argUI('argument-actor').replaceChildren(...participants.map(id=>argOption(id,ws.participants.find(p=>p.id===id)?.name||'Participant')));argUI('argument-actor').value=actor;
    const nodes=ws.argumentNodes.filter(n=>argumentGraphMatches(n,proposal.id,this.revision)),edges=ws.argumentEdges.filter(e=>argumentGraphMatches(e,proposal.id,this.revision)),selected=this.selected&&ws[this.selected.kind==='node'?'argumentNodes':'argumentEdges'].find(r=>r.id===this.selected.id),own=!selected||selected.authorId===actor;
    if(!this.dirty){
      const targets=[...['a','b'].filter(side=>version[`${side}Snapshot`]?.node).map(side=>argOption(`source:${side}`,`${side.toUpperCase()}: ${version[`${side}Snapshot`].node.title}`)),...nodes.filter(n=>n.status==='active').map(n=>argOption(`node:${n.id}`,n.title))];
      argUI('argument-from').replaceChildren(...nodes.filter(n=>n.authorId===actor&&n.status==='active').map(n=>argOption(n.id,n.title)));
      argUI('argument-to').replaceChildren(...targets.map(option=>option.cloneNode(true)));argUI('argument-attach').replaceChildren(argOption('','No connection yet'),...targets);
      if(selected&&this.selected.kind==='node'){argUI('argument-kind').value=selected.kind;argUI('argument-title').value=selected.title;argUI('argument-body').value=selected.body;argUI('argument-source-url').value=selected.sourceUrl;}
      if(selected&&this.selected.kind==='edge'){argUI('argument-from').value=selected.from.id;argUI('argument-relation').value=selected.relation;argUI('argument-to').value=selected.to.type==='source'?`source:${selected.to.side}`:`node:${selected.to.id}`;argUI('argument-edge-note').value=selected.note;}
    }
    argUI('argument-form-heading').textContent=selected&&this.selected.kind==='node'?`View ${ARGUMENT_KINDS[selected.kind]}`:'Select earlier reasoning';argUI('argument-attach-group').hidden=!!selected;
    this.editState={editable,own,selected};this.updateFormAvailability();
    argUI('argument-withdraw').hidden=!selected||!own||selected.status==='withdrawn';argUI('argument-new').disabled=!editable;argUI('argument-undo').disabled=!this.undo.length;
    const sourceLink=argUI('argument-source-link');sourceLink.hidden=!(selected?.sourceUrl);if(selected?.sourceUrl)sourceLink.href=selected.sourceUrl;
    const historyHost=argUI('argument-history');historyHost.replaceChildren();for(const saved of selected?[...selected.history,selected].reverse():[]){const p=document.createElement('p');p.textContent=`Version ${saved.version} · ${saved.status}\n${saved.title||saved.relation}\n${saved.body||saved.note||''}${saved.from?'\nFrom: '+this.describeEndpoint(saved.from,saved)+'\nTo: '+this.describeEndpoint(saved.to,saved):''}`;historyHost.append(p);}
    const records=argUI('argument-records');records.replaceChildren();for(const [kind,list]of [['node',nodes],['edge',edges]])for(const item of list){const button=document.createElement('button');button.type='button';button.className='comparison-record';const author=ws.participants.find(p=>p.id===item.authorId)?.name||'Participant';button.textContent=`${kind==='node'?item.title:ARGUMENT_RELATIONS[item.relation]+' · '+(nodes.find(n=>n.id===item.from.id)?.title||'Reasoning')} · ${author}${item.status==='withdrawn'?' · Withdrawn':argumentNeedsReview(ws,item)?' · Needs review':''}${item.note?' — '+item.note:''}`;button.onclick=()=>this.select(kind,item.id);records.append(button);}
    this.canvas.setArgument(ws,proposal,this.revision);
    this.c.library?.context();
  }
  select(kind,id){if(!this.canLeave())return;this.clearDraft();this.selected={kind,id};this.render();}
  endpoint(ws,value){return value.startsWith('source:')?{type:'source',side:value.slice(7)}:argumentNodeRef(ws,value.replace(/^node:/,''));}
  describeEndpoint(ref,edge){
    if(ref.type==='source'){const version=comparisonProposalVersions(this.proposal()).find(v=>v.revision===edge.proposalRevision);return `${ref.side.toUpperCase()} · ${version[`${ref.side}Snapshot`].node.title} · Saved proposal ${edge.proposalRevision}`;}
    const current=this.c.workspace.argumentNodes.find(n=>n.id===ref.id),saved=current.version===ref.version?current:current.history.find(n=>n.version===ref.version);
    return `${saved.title} · Version ${ref.version}${current.version!==ref.version?`\nNow: ${current.title} · Version ${current.version}`:''}${current.status==='withdrawn'?' · Withdrawn':''}`;
  }
  apply(changes,selection=this.selected){
    const candidate=structuredClone(this.c.workspace),undo=[];
    for(const {collection,value}of changes){const old=candidate[collection].find(r=>r.id===value.id);undo.push({collection,before:old?structuredClone(old):null,after:structuredClone(value)});if(old)candidate[collection]=candidate[collection].map(r=>r.id===value.id?value:r);else candidate[collection].push(value);}
    validateWorkspace(candidate);this.c.workspace=candidate;this.selected=selection;this.undo.push(undo);this.dirty=false;this.draftKind=null;this.c.markDirty();this.render();argUI('argument-error').textContent=this.c.accountMode?'Saved on this page. Account changes save automatically.':'Saved on this page. Export your workspace to keep a portable copy.';
  }
  saveNode(){this.c.message('Earlier reasoning is read-only. Use the current interaction modes for new work.');}
  saveEdge(){this.saveNode();}
  withdraw(){try{if(!this.canLeave())return;const collection=this.selected.kind==='node'?'argumentNodes':'argumentEdges',old=this.c.workspace[collection].find(r=>r.id===this.selected.id),save=this.selected.kind==='node'?saveArgumentNode:saveArgumentEdge;this.apply([{collection,value:save(this.c.workspace,{...old,status:'withdrawn'},this.actor(),old)}]);}catch(error){argUI('argument-error').textContent=error.message;}}
  undoLast(){this.saveNode();}
}
