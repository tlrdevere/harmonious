import {AccountChallenge} from './account-challenge.mjs';
import {validateWorkspace,newId} from './workspace.mjs';
import {synchronizeIdeas} from './adoption.mjs';
import {accountKey,accountClone,stableJSON,ownedAccountRecords,accountChanges} from './account-model.mjs';
const accountUI=id=>document.getElementById(id);
const accountOption=(value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o;};
export class AccountWorkspace{
  constructor(controller){
    this.controller=controller;this.actor=null;this.baseline=new Map();this.revisions={};this.ownedKeys=[];this.timer=null;this.draftTimer=null;this.saving=false;this.blocked=false;this.loading=false;
    this.mount();this.install();
  }
  mount(){
    document.body.classList.add('accounts','account-locked');
    const panel=document.createElement('main');panel.id='account-gate';panel.className='account-gate';
    panel.innerHTML=`<section class="account-card" aria-labelledby="account-title"><div class="eyebrow">HARMONIOUS BETA</div><h1 id="account-title">Make room for your worldview.</h1><p>Sign in to keep your maps and return to the conversation.</p><form id="account-email-form"><label for="account-name">Display name</label><input id="account-name" autocomplete="nickname" maxlength="100" required><p class="field-help">Other beta participants see this name when you share maps or co-sign shared nodes. Your email stays private.</p><label for="account-email">Email address</label><input id="account-email" type="email" autocomplete="email" required maxlength="254"><div id="account-challenge"></div><button class="primary" id="account-send" type="submit">Email me a sign-in code</button></form><form id="account-code-form" hidden><label for="account-code">Code from your email</label><input id="account-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" minlength="6" maxlength="10" required><button class="primary" id="account-verify" type="submit">Sign in</button><button id="account-change-email" type="button" class="text-button">Use a different email or resend</button></form><p id="account-feedback" role="status" aria-live="polite">Opening your account…</p><p class="field-help" id="account-signup-help">Personal maps start private.</p></section>`;
    document.querySelector('.topbar').after(panel);
    const controls=document.createElement('div');controls.className='account-controls';controls.innerHTML='<span id="account-display"></span><button id="account-signout" type="button">Sign out</button>';document.querySelector('.topbar').append(controls);
    accountUI('reset').hidden=true;accountUI('open-workspace').textContent='Import maps';accountUI('reload-workspace').hidden=false;accountUI('reload-workspace').textContent='Refresh maps';
    document.querySelector('.prototype').textContent='Beta';document.querySelector('.participant-control').hidden=true;
    document.querySelector('.participation-subnav > span').textContent='Your co-signs are recorded under your account';
    accountUI('map-settings').textContent='Map settings';accountUI('map-settings').setAttribute('aria-label','Map name and sharing');
    const sharing=document.createElement('div');sharing.id='account-sharing';sharing.innerHTML='<label for="map-visibility">Who can see this map?</label><select id="map-visibility"><option value="private">Only me</option><option value="shared">All beta participants</option></select><p class="field-help">Sharing lets other beta participants read, copy and co-sign its nodes. They can keep copies and earlier comparison records after you make it private again.</p>';
    accountUI('map-start-group').after(sharing);
    this.challenge=new AccountChallenge(accountUI('account-challenge'),message=>{accountUI('account-send').disabled=this.sending||!!this.signup?.turnstile&&!this.challenge.token;if(message)accountUI('account-feedback').textContent=message;});
    accountUI('account-email-form').onsubmit=e=>{e.preventDefault();this.sendCode();};accountUI('account-code-form').onsubmit=e=>{e.preventDefault();this.verifyCode();};
    accountUI('account-change-email').onclick=()=>{accountUI('account-code-form').hidden=true;accountUI('account-email-form').hidden=false;accountUI('account-feedback').textContent='You can request another code after a short wait.';accountUI('account-email').focus();};
    accountUI('account-signout').onclick=()=>this.signOut();
    accountUI('edit-form').addEventListener('input',()=>this.scheduleDraft());accountUI('edit-form').addEventListener('change',()=>this.scheduleDraft());
    accountUI('comparison-form').addEventListener('input',()=>this.status());accountUI('comparison-form').addEventListener('change',()=>this.status());
    window.addEventListener('online',()=>{if(this.controller.workspaceDirty&&!this.blocked)this.schedule();});
    this.poll=setInterval(()=>{if(!document.hidden)this.refresh();},30000);
  }
  install(){
    const c=this.controller;
    c.initialize=()=>this.initialize();c.save=()=>this.save();c.status=message=>this.status(message);c.openFile=file=>this.importFile(file);
    const mark=c.markDirty.bind(c);c.markDirty=()=>{mark();if(c.ready){for(const e of c.workspace.endorsements)if(e.participantId===this.actor?.id&&!this.baseline.has(accountKey('endorsement',e.id)))e.method='authenticated';for(const m of c.workspace.maps)if(m.ownerId===this.actor?.id&&!m.visibility)m.visibility='private';this.schedule();}};
    const load=c.loadMap.bind(c);c.loadMap=id=>{const map=c.workspace.maps.find(m=>m.id===id);if(this.actor&&map?.ownerId!==this.actor.id){c.exploreNode(id);return;}load(id);if(map&&this.actor)accountUI('map-person').textContent=`${map.person} · ${map.mapType==='reference'?'Reference map':'Personal worldview'} · ${map.visibility==='shared'?'Shared with beta participants':'Only you'}`;};
    const populate=c.populateMaps.bind(c);c.populateMaps=()=>{populate();const picker=accountUI('map-select');picker.replaceChildren(...c.workspace.maps.filter(m=>m.ownerId===this.actor?.id).map(m=>accountOption(m.id,m.name)));picker.value=c.activeMapId;};
    const show=c.showMapDialog.bind(c);c.showMapDialog=(rename=false,options={})=>{show(rename,options);accountUI('map-owner-input').replaceChildren(accountOption(this.actor.id,this.actor.name));accountUI('map-owner-input').disabled=true;accountUI('map-person-input').value=this.actor.name;accountUI('map-person-input').required=false;accountUI('map-person-group').hidden=true;accountUI('map-owner-input').hidden=true;document.querySelector('label[for="map-owner-input"]').hidden=true;accountUI('map-visibility').value=rename?(c.activeMap().visibility||'private'):'private';};
    const submit=accountUI('map-dialog-form').onsubmit;accountUI('map-dialog-form').onsubmit=e=>{const visibility=accountUI('map-visibility').value;submit(e);if(!accountUI('map-dialog').open){c.activeMap().visibility=visibility;c.loadMap(c.activeMapId);c.markDirty();}};
    const action=c.participation.refreshAction.bind(c.participation);c.participation.refreshAction=()=>{action();if(c.participation.pending?.mode!=='copy')accountUI('adoption-meaning').textContent+=' Your display name and co-sign are visible to beta participants who can view this source. A private destination map stays private.';};
    const record=c.record.bind(c);c.record=()=>{record();if(accountUI('comparison-error').dataset.state==='success')accountUI('comparison-error').textContent='Comparison recorded. Saving to your account…';};
  }
  async request(path,body,method='POST'){
    const response=await fetch(path,{method:body===undefined?'GET':method,cache:'no-store',headers:body===undefined?{}:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    let data;try{data=await response.json();}catch{throw Error('The service could not be reached. Your work is still on this page.');}
    if(!response.ok){const error=Error(data.error||'Please try again.');error.status=response.status;throw error;}return data;
  }
  async sendCode(){
    if(this.signup?.turnstile&&!this.challenge.token){accountUI('account-feedback').textContent='Complete the security check first.';return;}
    this.sending=true;accountUI('account-send').disabled=true;accountUI('account-feedback').textContent='Sending your code…';
    try{const data=await this.request('/api/auth/code',{email:accountUI('account-email').value,name:accountUI('account-name').value,...(this.signup?.turnstile?{captchaToken:this.challenge.token}:{})});accountUI('account-feedback').textContent=data.message;accountUI('account-email-form').hidden=true;accountUI('account-code-form').hidden=false;accountUI('account-code').focus();}catch(error){accountUI('account-feedback').textContent=error.message;}finally{this.sending=false;this.challenge.reset();accountUI('account-send').disabled=!!this.signup?.turnstile;}
  }
  async verifyCode(){
    accountUI('account-verify').disabled=true;accountUI('account-feedback').textContent='Checking your code…';
    try{await this.request('/api/auth/verify',{email:accountUI('account-email').value,code:accountUI('account-code').value});await this.initialize();}catch(error){accountUI('account-feedback').textContent=error.message;}finally{accountUI('account-verify').disabled=false;}
  }
  async initialize(){
    const c=this.controller;clearTimeout(this.timer);this.loading=true;c.ready=false;
    try{
      const session=await this.request('/api/session');this.signup=session.signup;
      const publicSignup=this.signup?.mode==='public';
      accountUI('account-signup-help').textContent=publicSignup?'Anyone can create an account with their email. Personal maps start private.':'Invited participants can create an account with their email. Personal maps start private.';
      if(!session.actor&&this.signup?.turnstile)await this.challenge.mount(this.signup.turnstile);
      accountUI('account-send').disabled=!!this.signup?.turnstile&&!this.challenge.token;
      if(!session.actor){document.body.classList.add('account-locked');accountUI('account-feedback').textContent=publicSignup?'Enter your email address and a display name to begin.':'Enter your invited email address to begin.';this.status('Sign in to open your maps');return;}
      const data=await this.request('/api/workspace');this.actor=data.actor;this.accept(data,true);this.blocked=false;
      document.body.classList.remove('account-locked');accountUI('account-display').textContent=this.actor.name;accountUI('account-feedback').textContent='';c.message();this.status();
    }catch(error){accountUI('account-feedback').textContent=error.message;c.message(error.message);this.status('Account unavailable');}
    finally{this.loading=false;}
  }
  accept(data,reset=false){
    const c=this.controller,workspace=validateWorkspace(data.workspace),oldMap=c.activeMap(),oldContent=oldMap?stableJSON(oldMap):'';
    c.workspace=workspace;this.revisions=data.revisions;this.ownedKeys=data.ownedKeys;this.actor=data.actor;
    this.baseline=new Map(ownedAccountRecords(workspace,this.actor.id,this.ownedKeys).map(r=>[accountKey(r.kind,r.id),r.value]));
    c.ready=true;c.cloudLoaded=true;c.workspaceDirty=false;document.body.classList.remove('account-locked');
    if(reset||!workspace.maps.some(m=>m.id===c.activeMapId&&m.ownerId===this.actor.id)){c.activeMapId=workspace.maps.find(m=>m.ownerId===this.actor.id).id;c.clearComparison();c.sides={a:{mapId:c.activeMapId,nodeId:null},b:{mapId:workspace.maps.find(m=>m.id!==c.activeMapId)?.id||null,nodeId:null}};}
    if(reset||oldContent!==stableJSON(c.activeMap()))c.loadMap(c.activeMapId);
    c.populateMaps();if(c.mode==='compare')c.renderComparison();c.participation.actorId=this.actor.id;c.participation.peopleSelection=null;c.participation.refresh();
  }
  status(message=null){
    const c=this.controller;accountUI('save-workspace').textContent=this.blocked?'Retry save':'Save now';accountUI('storage-status').dataset.state=c.workspaceDirty?'dirty':'saved';
    accountUI('storage-status').textContent=message||(!this.actor?'Sign in to open your maps':this.saving?'Saving…':this.blocked?'Save needs attention':c.workspaceDirty?'Changes waiting to save':c.editor.hasDraft()?'Node changes waiting to save':c.comparisonDirty?'Comparison draft · Record to save':'All changes saved');
  }
  schedule(){clearTimeout(this.timer);if(this.actor&&!this.blocked&&!this.loading)this.timer=setTimeout(()=>this.save(false),900);}
  scheduleDraft(){this.status();clearTimeout(this.draftTimer);this.draftTimer=setTimeout(()=>{if(this.controller.ready&&accountUI('edit-form').checkValidity()&&accountUI('connection-form').hidden){this.controller.editor.flushDraft();this.controller.captureActive();this.status();}},1100);}
  async save(flush=true){
    const c=this.controller;if(!this.actor||!c.ready||this.loading)return;if(this.saving){this.schedule();return;}
    clearTimeout(this.timer);if(flush&&!c.editor.flushDraft())return;c.captureActive();
    const records=ownedAccountRecords(c.workspace,this.actor.id,this.ownedKeys),changes=accountChanges(records,this.baseline,this.revisions);
    if(!changes.length){c.workspaceDirty=false;this.status();return;}
    this.saving=true;accountUI('save-workspace').disabled=true;this.status();
    try{
      validateWorkspace(c.workspace);const result=await this.request('/api/workspace',{changes},'PUT');this.revisions={...this.revisions,...result.revisions};
      for(const r of changes){const key=accountKey(r.kind,r.id);this.baseline.set(key,accountClone(r.value));if(!this.ownedKeys.includes(key))this.ownedKeys.push(key);}
      this.blocked=false;c.workspaceDirty=accountChanges(ownedAccountRecords(c.workspace,this.actor.id,this.ownedKeys),this.baseline,this.revisions).length>0;c.message();
    }catch(error){this.blocked=true;c.workspaceDirty=true;c.message(`${error.message} Download a backup to keep your current work.${error.status===401?' Sign in again in a new tab, then retry this save.':''}`);}
    finally{this.saving=false;accountUI('save-workspace').disabled=false;this.status();if(c.workspaceDirty&&!this.blocked)this.schedule();}
  }
  async refresh(){
    const c=this.controller;if(!this.actor||this.saving||this.loading||this.blocked||c.workspaceDirty||c.comparisonDirty||c.editor.hasDraft()||document.querySelector('dialog[open]'))return;
    this.loading=true;try{const data=await this.request('/api/workspace');if(!c.workspaceDirty&&!c.comparisonDirty&&!c.editor.hasDraft()&&!document.querySelector('dialog[open]')){this.accept(data);this.status();}}catch(error){if(error.status===401)c.message('Your session ended. Sign in again in a new tab to continue saving.');}finally{this.loading=false;if(c.workspaceDirty&&!this.blocked)this.schedule();}
  }
  async signOut(){
    const c=this.controller;await this.save();if((c.workspaceDirty||c.comparisonDirty||c.editor.hasDraft())&&!confirm('Some work has not been saved. Sign out and discard it?'))return;
    try{await this.request('/api/auth/logout',{});c.ready=false;c.workspaceDirty=false;c.comparisonDirty=false;c.editor.discardDraft();location.reload();}catch(error){c.message(error.message);}
  }
  async importFile(file){
    const c=this.controller;if(!file)return;
    try{
      if(file.size>2_000_000)throw Error('This file exceeds the 2 MB import limit.');const source=validateWorkspace(JSON.parse(await file.text()));
      if(!confirm(`Import ${source.maps.length} maps as private copies owned by you? The original file keeps its participant identities and co-signs; those will not be recorded as authenticated choices.`))return;
      if(!c.editor.beforeLeave())return;c.captureActive();const candidate=accountClone(c.workspace),mapping=new Map();
      for(const original of source.maps){const map=accountClone(original);map.id=newId('map');mapping.set(original.id,map.id);map.name=map.name.slice(0,88)+' (imported)';map.ownerId=this.actor.id;map.person=this.actor.name;map.visibility='private';delete map.unavailable;map.revision=1;map.updatedAt=new Date().toISOString();for(const n of map.nodes){delete n.ideaId;delete n.ideaVersion;delete n.copiedFrom;delete n.reuseMode;}candidate.maps.push(map);synchronizeIdeas(candidate,map);}
      // Historical judgments remain in the original backup. Importing a map
      // does not assert a fresh comparison against possibly changed sources.
      validateWorkspace(candidate);c.workspace=candidate;c.loadMap(mapping.values().next().value);c.populateMaps();c.markDirty();c.message('Private map copies imported. Your original file retains the earlier comparisons, participant identities, and co-signs.');
    }catch(error){c.message(`File was not imported: ${error.message}`);}finally{accountUI('workspace-file').value='';}
  }
}

