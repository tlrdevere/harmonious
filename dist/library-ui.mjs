import {comparisonPairKey,comparisonConsensus,comparisonProposalVersions} from './workspace.mjs';
import {DefinitionsUI} from './definitions-ui.mjs';
import {libraryMapOrder,libraryComparisonOrder} from './library-summary.mjs';
const libUI=id=>document.getElementById(id);
const libEl=(tag,text='',className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
const libButton=(text,action,className='')=>{const button=libEl('button',text,className);button.type='button';button.onclick=action;return button;};

// The Library lists saved objects. Opening a canvas is always a deliberate action.
export class LibraryUI{
  constructor(controller){
    this.c=controller;this.definitions=new DefinitionsUI(controller);this.section='maps';this.query='';this.browsing=false;
    const section=libEl('section','','library-workspace');section.id='library-workspace';section.hidden=true;
    section.innerHTML='<div class="library-heading"><div><div class="eyebrow">YOUR WORKSPACE</div><h1>Map Library</h1><p>Choose where to begin, or return to a conversation.</p></div><div id="library-create" class="library-actions"></div></div><nav id="library-sections" class="library-sections" aria-label="Library sections"></nav><label for="library-search">Find in this section</label><input id="library-search" type="search" placeholder="Search by map name or person"><div id="library-results" class="library-grid"></div>';
    libUI('editor-main').before(section);
    for(const [key,label]of [['maps','My maps'],['comparisons','Comparisons & arguments'],['pods','Pods'],['definitions','Definitions & standards']])libUI('library-sections').append(libButton(label,()=>this.open(key),`library-section-${key}`));
    libUI('library-search').oninput=()=>{this.query=libUI('library-search').value.trim().toLowerCase();this.render();};
    libUI('library-create').append(libButton('Create map',()=>this.c.showMapDialog(), 'primary'),libButton('Create comparison',()=>this.createComparison()));
    const tabs=document.querySelector('.mode-tabs');tabs.prepend(libUI('discover-mode'));libUI('comparison-mode').textContent='Comparisons';
    const shell=libEl('section','','comparison-context');shell.id='comparison-context';shell.hidden=true;
    shell.innerHTML='<div class="context-heading"><button id="comparison-library" type="button">← Comparisons</button><div class="comparison-context-copy"><h1 id="comparison-context-title"><span id="comparison-identity-a" class="comparison-identity" data-side="a"><strong>Choose a map</strong><small>First source</small></span><span class="comparison-between">with</span><span id="comparison-identity-b" class="comparison-identity" data-side="b"><strong>Choose a map</strong><small>Second source</small></span></h1><p id="comparison-context-question"></p></div><span id="comparison-context-state" role="status"></span><div id="comparison-view-modes" class="view-modes" role="group" aria-label="Earlier comparison views"></div></div>';
    libUI('comparison-workspace').before(shell);
    const setup=libEl('section','','comparison-map-setup');setup.id='comparison-map-setup';setup.setAttribute('aria-label','Choose comparison maps');
    const choices=libEl('div','','comparison-map-choices');
    for(const [side,label]of [['a','First source map'],['b','Second source map']]){
      const field=libEl('div','','comparison-map-choice'),caption=libEl('label',label),select=libUI(`compare-map-${side}`);caption.htmlFor=select.id;select.setAttribute('aria-label',label);select.setAttribute('aria-describedby','comparison-map-help');
      document.querySelector(`label[for="${select.id}"]`).htmlFor=`compare-frame-${side}`;field.append(caption,select);choices.append(field);
    }
    const help=libEl('p','','field-help');help.id='comparison-map-help';help.setAttribute('role','status');
    setup.append(choices,libUI('start-comparison'),help);shell.append(setup);
    libUI('comparison-library').onclick=()=>this.open('comparisons');
    const compare=libButton('Compare',()=>this.c.showMode('compare'));compare.id='compare-view-mode';libUI('comparison-view-modes').append(compare,libUI('argument-mode'));
    libUI('argument-mode').onclick=()=>this.c.argument.open();
    for(const side of ['a','b'])libUI(`edit-source-${side}`).after(libButton('View source map',()=>{const state=this.c.sides[side];if(state.mapId)this.openSource(state.mapId,state.nodeId);},'text-button'));
    libUI('pod-explore').textContent='View source map';
    // Contribution browsing is a detail reached from a comparison's sources.
    const back=libButton('← Comparisons',()=>this.open('comparisons'));libUI('discover-workspace').prepend(back);
    document.querySelector('.participation-heading h1').textContent='Shared map';
    document.querySelector('.participation-heading p').textContent='Read the source, co-sign its wording, or copy a section to adapt.';
    document.querySelector('.discovery-catalog').hidden=true;
    document.querySelector('.discovery-layout').classList.add('library-map-detail');
    document.querySelector('.participation-subnav > div').append(libButton('Compare this map',()=>this.createComparison(this.c.participation.mapId)));
    libUI('browse-endorsements').textContent='Source map';libUI('new-reference').hidden=true;
    const podHeading=document.querySelector('#pods-workspace h1');if(podHeading)podHeading.textContent='Derived pod maps';
    const podNote=libEl('p','This prototype derives shared nodes from recorded co-signs. Pod authoring will be designed separately.','field-help');libUI('pods-workspace').prepend(libButton('← Pods in Library',()=>this.open('pods')),podNote);
  }
  open(section=this.section){
    if(!this.c.showMode('library'))return false;this.c.message();this.section=section;this.browsing=false;this.query='';libUI('library-search').value='';this.render();this.route({library:section});return true;
  }
  route(values){const hash=new URLSearchParams(values);history.replaceState(null,'',`${location.pathname}${location.search}#${hash}`);}
  ownedMaps(){return this.c.workspace.maps.filter(map=>!map.unavailable&&this.c.canEditMap(map));}
  name(map){return this.c.workspace.participants.find(p=>p.id===map.ownerId)?.name||map.person||'Participant';}
  matches(text){return !this.query||text.toLowerCase().includes(this.query);}
  card(title,description,action,label='Open'){
    const card=libEl('article','','library-card');card.append(libEl('h2',title),libEl('p',description),libButton(label,action));return card;
  }
  render(){
    if(!libUI('library-results'))return;
    for(const button of libUI('library-sections').children)button.setAttribute('aria-current',String(button.className===`library-section-${this.section}`));
    const host=libUI('library-results');host.replaceChildren();const ws=this.c.workspace;
    if(this.section==='definitions')this.definitions.render(host,this.query);
    if(this.section==='maps')for(const map of libraryMapOrder(this.ownedMaps())){
      if(!this.matches(`${map.name} ${this.name(map)}`))continue;
      const updated=map.updatedAt?new Date(map.updatedAt).toLocaleDateString():'';
      host.append(this.card(map.name,`${this.name(map)} · ${map.visibility==='shared'?'Shared with beta participants':'Private'}${updated?' · Updated '+updated:''}`,()=>this.openMap(map.id),'Open map'));
    }
    libUI('library-search').placeholder=this.browsing?'Search shared maps by name or person':'Search by map name or person';
    if(this.section==='comparisons'&&this.browsing){this.renderDiscovery(host);return;}
    if(this.section==='comparisons'){
      if(!this.query)host.append(this.card('Start a comparison','Choose one of your maps and another accessible map. Or find another person’s shared map below.',()=>this.createComparison(),'Choose maps'));
      host.append(libButton('Find a shared map',()=>{this.browsing=true;this.query='';libUI('library-search').value='';this.render();libUI('library-search').focus();},'library-browse'));
      for(const {thread,title,description}of libraryComparisonOrder(ws)){
        const maps=ws.maps.filter(m=>[thread.aMapId,thread.bMapId].includes(m.id));
        if(!this.matches(title+' '+maps.map(m=>this.name(m)).join(' ')))continue;
        host.append(this.card(title,description,()=>{if(this.c.showMode('compare'))this.c.openComparisonPair(comparisonPairKey(thread));},'Open comparison'));
      }
    }
    if(this.section==='pods')for(const map of ws.maps.filter(m=>!m.unavailable)){
      if(!this.matches(map.name+' '+this.name(map)))continue;
      host.append(this.card(`Shared nodes in ${map.name}`,`Derived from co-signs on ${this.name(map)}’s map. Choose people and a threshold to inspect their shared wording.`,()=>{this.c.participation.podMapId=map.id;this.c.participation.peopleSelection=null;if(this.c.showMode('pods'))this.route({pod:map.id});},'Inspect derived pod'));
    }
    if(!host.children.length||[...host.children].every(child=>child.classList.contains('library-browse'))){const empty=libEl('div','','library-empty');empty.append(libEl('h2',this.query?'No matching work':'Choose your starting point'),libEl('p',this.query?'Try another name or clear the search.':'Create your first map. It starts private; you can share it when ready.'));if(!this.query)empty.append(libButton('Create your first map',()=>this.c.showMapDialog()));host.append(empty);}
  }
  renderDiscovery(host){
    const heading=libEl('div','','library-discovery-heading');heading.append(libButton('← Saved comparisons',()=>this.open('comparisons')),libEl('h2','Find a shared map'),libEl('p','Shared maps, ordered by name. Choose a map to read it or compare it with one of your own.'));host.append(heading);
    const actor=this.c.account?.actor?.id||this.c.participation.actorId;
    const maps=this.c.workspace.maps.filter(m=>!m.unavailable&&m.visibility==='shared'&&m.ownerId!==actor&&this.matches(`${m.name} ${this.name(m)}`)).sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base',numeric:true})||this.name(a).localeCompare(this.name(b),'en')||a.id.localeCompare(b.id));
    for(const map of maps){const card=this.card(map.name,`By ${this.name(map)}`,()=>this.openSource(map.id),'View map');card.dataset.map=map.id;card.append(libButton('Compare with my map',()=>{
      const current=this.c.workspace.maps.find(m=>m.id===map.id&&!m.unavailable&&m.visibility==='shared');if(!current){this.render();this.c.message('This map is no longer available.');return;}
      this.createComparison(null,null,current.id);
    }));host.append(card);}
    if(!maps.length)host.append(libEl('p',this.query?'No shared maps match. Try another map name or person.':'No other shared maps are available yet.','library-empty'));
  }
  openMap(id,nodeId=null){
    const map=this.c.workspace.maps.find(m=>m.id===id&&!m.unavailable);if(!map){this.open('maps');this.c.message('This map is unavailable.');return false;}
    if(!this.c.canEditMap(map))return this.openSource(id,nodeId);
    if(!this.c.editor.beforeLeave()||!this.c.showMode('individual'))return false;
    this.c.captureActive();this.c.loadMap(id);this.c.showMode('individual');this.c.populateMaps();this.c.updateNavigation();if(nodeId&&map.nodes.some(n=>n.id===nodeId))this.c.editor.focusNode(nodeId);this.route({map:id,...(nodeId?{node:nodeId}:{})});return true;
  }
  openSource(id,nodeId=null){if(!this.c.showMode('discover'))return false;this.c.participation.openMap(id,nodeId);this.route({source:id,...(nodeId?{node:nodeId}:{})});return true;}
  createComparison(mapId=null,nodeId=null,otherMapId=null){
    if(!this.c.showMode('compare')||!this.c.canLeaveComparison()||!this.c.argument.canLeave())return;
    this.c.argument.reset();this.c.clearComparison();this.c.activeComparisonPair=null;
    this.c.sides={a:{mapId,nodeId},b:{mapId:otherMapId,nodeId:null}};this.c.populateMaps();this.c.renderComparison(true);this.c.setComparisonRoute();
    this.c.message('Choose two source maps, then select Start / open comparison. Shared maps are listed with their owners.');libUI('compare-map-a').focus();
  }
  changeComparisonMaps(){const {a,b}=this.c.sides;this.createComparison(a.mapId,a.nodeId,b.mapId);}
  context(){
    const c=this.c,proposal=c.mode==='argument'?c.argument.proposal():c.workspace.comparisons.find(p=>p.id===c.editingRecord),version=proposal&&comparisonProposalVersions(proposal).find(v=>v.revision===(c.mode==='argument'?c.argument.revision:comparisonProposalVersions(proposal).at(-1).revision));
    const maps=Object.fromEntries(['a','b'].map(side=>[side,c.workspace.maps.find(m=>m.id===(proposal?.[`${side}MapId`]||c.sides[side].mapId))]));
    const ordered=[...new Set(['a','b'].map(side=>maps[side]?.id).filter(Boolean))].sort();
    for(const side of ['a','b']){
      const map=maps[side],identity=libUI(`comparison-identity-${side}`),owner=map?this.name(map):side==='a'?'First source':'Second source';
      identity.querySelector('strong').textContent=map?.name||'Choose a map';identity.querySelector('small').textContent=owner;
      identity.dataset.identity=ordered.indexOf(map?.id)===1?'two':'one';identity.title=map?`${map.name} by ${owner}`:'Choose a source map';
      for(const letter of document.querySelectorAll(`#comparison-workspace .map-letter[for$="-${side}"],#comparison-workspace .source-picker[aria-label$="map ${side.toUpperCase()}"] .map-letter`)){letter.dataset.identity=identity.dataset.identity;letter.title=identity.title;}
    }
    const choosing=c.mode==='compare'&&!c.activeComparisonPair,error=c.comparisonSelectionError(),available=c.workspace.maps.filter(m=>!m.unavailable);
    libUI('comparison-map-setup').hidden=!choosing;libUI('comparison-context').classList.toggle('choosing-maps',choosing);
    if(libUI('change-comparison-maps'))libUI('change-comparison-maps').hidden=choosing;
    libUI('start-comparison').disabled=!!error||!!c.startingComparison;
    for(const side of ['a','b'])libUI(`compare-map-${side}`).disabled=!available.length||!!c.startingComparison;
    libUI('comparison-map-help').textContent=!available.length?'No accessible maps are available. Return to the Library to create a map or find a shared map.':available.length<2?'A comparison needs two different maps. Return to the Library to create another map or find a shared map.':error||'Ready to start. Opening an existing pair returns to its saved comparison. Map sharing stays unchanged.';
    libUI('comparison-context-question').textContent=version?`Proposal ${version.revision} · ${version.question}`:choosing?'Choose both source maps below.':'Select nodes or connections to relate, inquire, or argue.';
    const status=proposal?comparisonConsensus(c.workspace,proposal):null;libUI('comparison-context-state').textContent=status?.label||(choosing?'Choose source maps':'Shared conversation');libUI('comparison-context-state').dataset.state=status?.state||'pending';
    for(const [id,mode]of [['compare-view-mode','compare'],['argument-mode','argument']])libUI(id).setAttribute('aria-pressed',String(c.mode===mode));
  }
  openRoute(){
    const route=new URLSearchParams(location.hash.slice(1));
    if(route.has('comparison'))return false;
    if(route.has('map'))this.openMap(route.get('map'),route.get('node'));
    else if(route.has('source')){const id=route.get('source');if(this.c.workspace.maps.some(m=>m.id===id&&!m.unavailable))this.openSource(id,route.get('node'));else{this.open('comparisons');this.c.message('This source map is unavailable.');}}
    else if(route.has('pod')){const id=route.get('pod');if(this.c.workspace.maps.some(m=>m.id===id&&!m.unavailable)){this.c.participation.podMapId=id;this.c.showMode('pods');}else this.open('pods');}
    else this.open(['maps','comparisons','pods','definitions'].includes(route.get('library'))?route.get('library'):'maps');
    return true;
  }
}
