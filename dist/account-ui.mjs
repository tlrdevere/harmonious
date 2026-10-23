import {FacilitatorUI} from './facilitator-ui.mjs';
import {ActivityUI} from './activity-ui.mjs';
import {comparisonPairKey} from './workspace.mjs';
import {AccountChallenge} from './account-challenge.mjs';
import {TestAccountsUI} from './test-accounts-ui.mjs';
import {validateWorkspace,newId} from './workspace.mjs';
import {synchronizeIdeas} from './adoption.mjs';
import {discussionSource} from './discussion.mjs';
import {accountKey,accountClone,stableJSON,ownedAccountRecords,accountChanges} from './account-model.mjs';
const accountUI=id=>document.getElementById(id);
const accountOption=(value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o;};
export class AccountWorkspace{
  constructor(controller){
    this.controller=controller;this.actor=null;this.baseline=new Map();this.revisions={};this.ownedKeys=[];this.timer=null;this.draftTimer=null;this.saving=false;this.blocked=false;this.loading=false;
    this.authIntent='signin';this.authEpoch=0;this.pendingCode=null;this.codeCooldowns=new Map();this.sending=false;this.verifying=false;
    this.mount();this.install();this.facilitator=new FacilitatorUI(this);this.activity=new ActivityUI(this);
  }
  mount(){
    document.body.classList.add('accounts','account-locked');
    const topbar=document.querySelector('.topbar'),tabs=document.querySelector('.mode-tabs'),primaryNav=document.createElement('nav');
    primaryNav.className='topbar-primary-nav';primaryNav.setAttribute('aria-label','Main navigation');tabs.classList.add('topbar-tabs');primaryNav.append(tabs);topbar.insertBefore(primaryNav,accountUI('storage-status'));
    const panel=document.createElement('main');panel.id='account-gate';panel.className='account-gate';
    panel.innerHTML=`<section class="account-card" aria-labelledby="account-title"><div class="eyebrow">HARMONIOUS BETA</div><h1 id="account-title">Make room for your worldview.</h1><p id="account-intro">Sign in with a code sent to your email. No password to remember.</p><div id="account-intents" class="account-intents" role="group" aria-label="Choose sign in or account creation"><button id="account-intent-signin" type="button" aria-pressed="true">Sign in</button><button id="account-intent-signup" type="button" aria-pressed="false">Create account</button></div><form id="account-email-form"><div id="account-name-group" hidden><label for="account-name">Display name</label><input id="account-name" autocomplete="nickname" maxlength="100"><p class="field-help">Other participants see this name on your maps and contributions. You can change it later. Your email stays private.</p></div><label for="account-email">Email address</label><input id="account-email" type="email" autocomplete="email" autocapitalize="none" spellcheck="false" required maxlength="254"><div id="account-challenge"></div><button class="primary" id="account-send" type="submit">Email me a sign-in code</button></form><form id="account-code-form" hidden><p id="account-code-destination" class="field-help"></p><label for="account-code">Code from your email</label><input id="account-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" minlength="6" maxlength="10" required><button class="primary" id="account-verify" type="submit">Verify code and sign in</button><div class="account-code-actions"><button id="account-resend" type="button">Resend code</button><button id="account-change-email" type="button" class="text-button">Change email</button></div></form><p id="account-code-wait" class="field-help"></p><p id="account-feedback" role="status" aria-live="polite">Opening your account…</p><p class="field-help" id="account-signup-help">Personal maps start private.</p></section>`;
    topbar.after(panel);
    const controls=document.createElement('details');controls.className='account-controls account-menu';controls.innerHTML='<summary><span id="account-display">Account</span></summary><div class="account-menu-content"><button id="account-signout" type="button">Sign out</button></div>';document.querySelector('.topbar').append(controls);controls.querySelector('.account-menu-content').prepend(document.querySelector('.workspace-files'));controls.querySelector('.account-menu-content').addEventListener('click',event=>{if(event.target.closest('button'))controls.open=false;});
    accountUI('reset').hidden=true;accountUI('open-workspace').textContent='Import maps';accountUI('reload-workspace').hidden=false;accountUI('reload-workspace').textContent='Refresh maps';
    document.querySelector('#editor-main .workspace-header').append(document.querySelector('.map-switcher'));
    document.querySelector('.prototype').textContent='Beta';document.querySelector('.participant-control').hidden=true;
    document.querySelector('.participation-subnav > span').textContent='Your co-signs are recorded under your account';
    accountUI('map-settings').textContent='Map settings';accountUI('map-settings').setAttribute('aria-label','Map name and sharing');
    const sharing=document.createElement('div');sharing.id='account-sharing';sharing.innerHTML='<label for="map-visibility">Who can see this map?</label><select id="map-visibility"><option value="private">Only me</option><option value="shared">All beta participants</option></select><p class="field-help">Sharing lets other beta participants read, copy and co-sign its nodes. They can keep copies and earlier comparison records after you make it private again.</p>';
    accountUI('map-start-group').after(sharing);
    accountUI('account-code-form').before(accountUI('account-challenge'));
    this.challenge=new AccountChallenge(accountUI('account-challenge'),message=>{this.renderAuth();if(message)accountUI('account-feedback').textContent=message;});
    accountUI('account-email-form').onsubmit=e=>{e.preventDefault();this.sendCode();};accountUI('account-code-form').onsubmit=e=>{e.preventDefault();this.verifyCode();};
    accountUI('account-change-email').onclick=()=>{if(!this.cancelAuthAttempt())return;accountUI('account-feedback').textContent='Enter the email address you want to use.';accountUI('account-email').focus();};
    accountUI('account-resend').onclick=()=>this.sendCode(true);
    for(const intent of ['signin','signup'])accountUI('account-intent-'+intent).onclick=()=>this.setAuthIntent(intent);
    accountUI('account-email').addEventListener('input',()=>this.renderAuth());
    accountUI('account-signout').onclick=()=>this.signOut();
    this.testAccounts=new TestAccountsUI(this);
    this.renderAuth();
    const rename=document.createElement('button');rename.id='change-display-name';rename.type='button';rename.textContent='Change display name';controls.querySelector('.account-menu-content').prepend(rename);
    const profileDialog=document.createElement('dialog');profileDialog.id='display-name-dialog';profileDialog.className='account-settings-dialog';profileDialog.setAttribute('aria-labelledby','display-name-title');profileDialog.innerHTML='<form id="display-name-form"><h2 id="display-name-title">Change display name</h2><p>This name appears on your maps and contributions. Your login details stay the same.</p><label for="display-name-value">Display name</label><input id="display-name-value" autocomplete="nickname" maxlength="100" required><p id="display-name-error" role="status" aria-live="polite"></p><div class="dialog-actions"><button id="display-name-cancel" type="button">Cancel</button><button id="display-name-save" class="primary" type="submit">Save display name</button></div></form>';document.body.append(profileDialog);
    rename.onclick=()=>{if(!this.actor)return;accountUI('display-name-value').value=this.actor.name;accountUI('display-name-error').textContent='';profileDialog.showModal();accountUI('display-name-value').focus();accountUI('display-name-value').select();};
    const closeProfile=()=>{if(this.profileSaving)return;profileDialog.close();accountUI('display-name-value').value='';rename.focus();};accountUI('display-name-cancel').onclick=closeProfile;profileDialog.addEventListener('cancel',event=>{event.preventDefault();closeProfile();});accountUI('display-name-form').onsubmit=event=>{event.preventDefault();this.saveDisplayName();};
    accountUI('edit-form').addEventListener('input',()=>this.scheduleDraft());accountUI('edit-form').addEventListener('change',()=>this.scheduleDraft());
    accountUI('comparison-form').addEventListener('input',()=>this.status());accountUI('comparison-form').addEventListener('change',()=>this.status());
    window.addEventListener('online',()=>{if(this.controller.workspaceDirty&&!this.blocked)this.schedule();});
    this.poll=setInterval(()=>{if(!document.hidden)this.refresh();},30000);
  }
  install(){
    const c=this.controller;
    c.initialize=()=>this.initialize();c.save=()=>this.save();c.status=message=>this.status(message);c.openFile=file=>this.importFile(file);
    const mark=c.markDirty.bind(c);c.markDirty=()=>{mark();if(c.ready){for(const e of c.workspace.endorsements)if(e.participantId===this.actor?.id&&!this.baseline.has(accountKey('endorsement',e.id)))e.method='authenticated';for(const m of c.workspace.maps)if(m.ownerId===this.actor?.id&&!m.visibility)m.visibility='private';this.schedule();}};
    const load=c.loadMap.bind(c);c.loadMap=id=>{if(this.facilitator?.context&&c.workspaceDirty&&id!==c.activeMapId){c.message('Review this facilitator contribution before opening another map.');return;}const map=c.workspace.maps.find(m=>m.id===id);if(!map||map.unavailable||this.actor&&map.ownerId!==this.actor.id)return;load(id);this.renderAccountName();};
    const populate=c.populateMaps.bind(c);c.populateMaps=()=>{populate();const picker=accountUI('map-select');picker.replaceChildren(accountOption('','Choose a map…'),...c.workspace.maps.filter(m=>m.ownerId===this.actor?.id&&!m.unavailable).map(m=>accountOption(m.id,m.name)));picker.value=c.activeMapId||'';};
    const show=c.showMapDialog.bind(c);c.showMapDialog=(rename=false,options={})=>{if(this.facilitator?.context&&this.facilitator.pending()){c.message('Review this facilitator contribution before changing maps.');return;}show(rename,options);accountUI('map-owner-input').replaceChildren(accountOption(this.actor.id,this.actor.name));accountUI('map-owner-input').disabled=true;accountUI('map-person-input').value=this.actor.name;accountUI('map-person-input').required=false;accountUI('map-person-group').hidden=true;accountUI('map-owner-input').hidden=true;document.querySelector('label[for="map-owner-input"]').hidden=true;accountUI('map-visibility').value=rename?(c.activeMap().visibility||'private'):'private';};
    const submit=accountUI('map-dialog-form').onsubmit;accountUI('map-dialog-form').onsubmit=e=>{const visibility=accountUI('map-visibility').value;submit(e);if(!accountUI('map-dialog').open){c.activeMap().visibility=visibility;c.loadMap(c.activeMapId);c.markDirty();}};
    const action=c.participation.refreshAction.bind(c.participation);c.participation.refreshAction=()=>{action();if(c.participation.pending?.mode!=='copy')accountUI('adoption-meaning').textContent+=' Your display name and co-sign are visible to beta participants who can view this source. A private destination map stays private.';};
    const record=c.record.bind(c);c.record=async()=>{await record();if(accountUI('comparison-error').dataset.state==='success')accountUI('comparison-error').textContent='Judgment recorded. Saving to your account…';};
  }
  async request(path,body,method='POST'){
    const epoch=this.facilitator?.epoch,context=this.facilitator?.context,delegated=context&&(path==='/api/workspace'||path==='/api/comparisons');
    if(context&&path==='/api/workspace'&&body!==undefined)throw Error('Review this contribution before publishing it for the participant.');
    const response=await fetch(path,{method:body===undefined?'GET':method,cache:'no-store',headers:{'X-Harmonious-Capabilities':'comparison-reasoning-v1, comparison-adoption-v1, comparison-premise-v1, comparison-reflection-v1, interaction-grammar-v4, counterpart-integrity-v1, argument-categories-v1, argument-replies-v1, argument-dialogue-v1, argument-placement-v1, map-deletion-v1, argument-standstill-v1, facilitation-v1, philosophy-v1',...(delegated?{'X-Harmonious-Participant':context.participantId,'X-Harmonious-Grant-Version':String(context.version)}:{}),...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
    let data;try{data=await response.json();}catch{throw Error('The service could not be reached. Your work is still on this page.');}
    if(delegated&&epoch!==this.facilitator.epoch)throw Error('Participant context changed.');
    if(!response.ok){const error=Error(data.error||'Please try again.');error.status=response.status;error.code=data.code;if(error.code==='CLIENT_UPDATE_REQUIRED'){this.blocked=true;this.controller.message(error.message);this.status('Update needed · Your work is still on this page');}throw error;}return data;
  }
  async startComparison(aMapId,bMapId){
    await this.save();
    if(this.loading||this.saving||this.blocked||this.controller.workspaceDirty)throw Error('Your maps need to finish saving or refreshing before starting the comparison.');
    this.loading=true;
    try{
      const result=await this.request('/api/comparisons',{aMapId,bMapId,...(this.facilitator?.context?{operationId:crypto.randomUUID()}: {})}),thread=result.comparisonThread,key=accountKey('comparison_thread',thread.id);
      const threads=this.controller.workspace.comparisonThreads??=[];
      if(!threads.some(item=>item.id===thread.id))threads.push(thread);
      this.baseline.set(key,accountClone(thread));this.revisions[key]=result.revision;
      return thread;
    }finally{this.loading=false;if(this.controller.workspaceDirty&&!this.blocked)this.schedule();}
  }
  async openActivity(id){
    const c=this.controller,actorId=this.actor?.id,epoch=this.facilitator?.epoch;
    const unfinished=()=>this.saving||this.blocked||c.workspaceDirty||c.editor.hasDraft()||c.comparisonDirty||c.discussion?.dirty||c.argument?.dirty||c.library.definitions?.dirty||[...document.querySelectorAll('dialog[open]')].some(dialog=>dialog.id!=='activity-dialog');
    if(!actorId||this.facilitator?.context||this.loading||unfinished())throw Error('Finish saving or cancel your current edit before opening activity. Your work and unread status are unchanged.');
    this.loading=true;
    try{
      const data=await this.request('/api/activity/open',{id});
      if(this.actor?.id!==actorId||this.facilitator?.epoch!==epoch||this.facilitator?.context)return false;
      if(data.actorId!==actorId||data.workspaceEnvelope?.actor?.id!==actorId){this.activity.clearUnavailable('Your signed-in account changed. Reopen Harmonious to read its activity.');return false;}
      // Recheck after the request: a user may have started typing while it ran.
      if(unfinished())throw Error('Finish saving or cancel your current edit before opening activity. Your work and unread status are unchanged.');
      if(this.accept(data.workspaceEnvelope)===false)return false;
      const route=data.item.route,d=c.discussion;
      if(route.source)return c.library.openSource(route.source,route.node);
      const thread=c.workspace.comparisonThreads.find(item=>item.id===route.comparison);
      if(!thread||d.dialogue.active&&!d.dialogue.close({route:false})||!c.showMode('compare')||!c.openComparisonPair(comparisonPairKey(thread)))return false;
      if(route.view==='dialogue'){
        if(!await d.dialogue.open({type:'node',mapId:route.map,nodeId:route.node},{entry:route.entry}))return false;
      }else d.reasoning.setFocus(route.view);
      return d.revealInteraction(route.entry);
    }finally{this.loading=false;this.status();if(c.workspaceDirty&&!this.blocked)this.schedule();}
  }
  renderAccountName(){
    if(!this.actor)return;const c=this.controller,person=c.workspace.participants.find(p=>p.id===this.actor.id);if(person)this.actor={...this.actor,name:person.name};accountUI('account-display').textContent=this.actor.name;
    const map=c.activeMap();if(map)accountUI('map-person').textContent=`${c.workspace.participants.find(p=>p.id===map.ownerId)?.name||map.person} · ${map.mapType==='reference'?'Reference map':'Personal worldview'} · ${map.visibility==='shared'?'Shared with beta participants':'Only you'}`;
  }
  async saveDisplayName(){
    const c=this.controller,name=accountUI('display-name-value').value.trim(),error=accountUI('display-name-error');
    if(!name||name.length>100){error.textContent='Enter a display name between 1 and 100 characters.';return;}
    if(!this.actor||this.loading||this.saving||this.blocked){error.textContent='Finish saving your earlier changes, then try again. Your name has not been changed.';return;}
    const id=this.actor.id,key=accountKey('profile',id),value={id,name},change={kind:'profile',id,expectedRevision:this.revisions[key],value};
    this.profileSaving=true;this.loading=true;for(const field of accountUI('display-name-form').querySelectorAll('input,button'))field.disabled=true;error.textContent='Saving display name…';
    try{
      const result=await this.request('/api/workspace',{changes:[change]},'PUT');
      const person=c.workspace.participants.find(p=>p.id===id);person.name=name;this.baseline.set(key,accountClone(value));this.revisions={...this.revisions,...result.revisions};this.renderAccountName();
      c.populateMaps();if(c.mode==='compare')c.renderComparison();if(['discover','pods'].includes(c.mode))c.participation.refresh();if(c.mode==='argument')c.argument.render();c.discussion?.interactions?.refreshArgumentLog();
      accountUI('display-name-dialog').close();accountUI('display-name-value').value='';accountUI('change-display-name').focus();c.message('Display name updated.');
    }catch(e){error.textContent=e.status===409?'Your profile changed in another session. Cancel, refresh your account, and try again. Your entered name is still here.':e.message;}
    finally{this.profileSaving=false;this.loading=false;for(const field of accountUI('display-name-form').querySelectorAll('input,button'))field.disabled=false;this.status();if(c.workspaceDirty&&!this.blocked)this.schedule();}
  }
  async confirmMapDeletion(id){
    const c=this.controller;
    if(this.facilitator?.context||this.loading||this.saving||c.editor.hasDraft()||c.comparisonDirty||c.discussion?.dirty||c.argument?.dirty){c.message('Finish your current changes before deleting a map.');return;}
    await this.save();
    const map=c.workspace.maps.find(m=>m.id===id&&!m.unavailable&&m.ownerId===this.actor?.id);
    if(!map||this.blocked||c.workspaceDirty)return;
    document.getElementById('delete-map-dialog')?.remove();
    const dialog=document.createElement('dialog');dialog.id='delete-map-dialog';dialog.className='account-settings-dialog';dialog.setAttribute('aria-labelledby','delete-map-title');
    dialog.innerHTML='<form><h2 id="delete-map-title">Delete map?</h2><p id="delete-map-name"></p><p>This removes the map from your library and shared browsing. Comparisons using it become unavailable. Existing copies and previously recorded contributions are kept. This cannot be undone.</p><p id="delete-map-error" role="status" aria-live="polite"></p><div class="dialog-actions"><button type="button" id="delete-map-cancel">Cancel</button><button type="submit" id="delete-map-confirm" class="danger">Delete map</button></div></form>';
    document.body.append(dialog);dialog.querySelector('#delete-map-name').textContent=map.name;
    const request={id,expectedRevision:this.revisions[accountKey('map',id)]},actorId=this.actor.id;
    let busy=false;
    const close=()=>{if(!busy){dialog.close();c.library.render();document.querySelector('#library-results button')?.focus();}};
    dialog.querySelector('#delete-map-cancel').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.querySelector('form').onsubmit=async event=>{
      event.preventDefault();if(busy)return;
      if(this.actor?.id!==actorId||this.facilitator?.context||c.workspaceDirty){dialog.querySelector('#delete-map-error').textContent='Your account or map changed. Cancel and review it before deleting.';return;}
      busy=true;this.loading=true;dialog.querySelectorAll('button').forEach(b=>b.disabled=true);dialog.querySelector('#delete-map-error').textContent='Deleting map…';
      try{
        const data=await this.request('/api/maps/delete',request);
        this.accept(data,true);dialog.close();c.library.open('maps');c.message('Map deleted.');document.querySelector('#library-results button, #library-create button')?.focus();
      }catch(error){dialog.querySelector('#delete-map-error').textContent=error.message;}
      finally{busy=false;this.loading=false;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);this.status();}
    };
    dialog.showModal();dialog.querySelector('#delete-map-cancel').focus();
  }
  cancelAuthAttempt(){
    // A verification response sets cookies: do not offer a competing identity
    // change until that request has finished. Code sends may be abandoned safely.
    if(this.verifying||this.testAccounts?.signingIn)return false;
    this.authEpoch++;this.pendingCode=null;accountUI('account-code').value='';this.renderAuth();return true;
  }
  setAuthIntent(intent){
    if(!['signin','signup'].includes(intent)||!this.cancelAuthAttempt())return;
    this.authIntent=intent;if(this.testAccounts?.testLogin)this.testAccounts.switchLogin(false);
    this.renderAuth();accountUI('account-feedback').textContent='';accountUI(intent==='signup'?'account-name':'account-email').focus();
  }
  renderAuth(){
    const test=!!this.testAccounts?.testLogin,signup=this.authIntent==='signup',pending=this.pendingCode,locked=this.verifying||!!this.testAccounts?.signingIn;
    const email=pending?.email||accountUI('account-email').value.trim().toLowerCase(),wait=Math.max(0,Math.ceil(((this.codeCooldowns.get(email)||0)-Date.now())/1000));
    accountUI('account-intents').hidden=test;accountUI('account-challenge').hidden=test;accountUI('account-name-group').hidden=!signup;accountUI('account-name').required=signup&&!test;accountUI('account-name').disabled=!signup||locked||this.sending;
    accountUI('account-email-form').hidden=test||!!pending;accountUI('account-code-form').hidden=test||!pending;
    accountUI('account-email').disabled=locked||this.sending;accountUI('account-code').disabled=locked||this.sending;
    accountUI('account-intro').textContent=test?'Use the login details your test organizer gave you.':signup?'Create your account with an email code. No password to remember.':'Sign in with a code sent to your email. No password to remember.';
    for(const intent of ['signin','signup']){const button=accountUI('account-intent-'+intent);button.setAttribute('aria-pressed',String(intent===this.authIntent));button.disabled=locked;}
    const challengeNeeded=!!this.signup?.turnstile&&!this.challenge.token;
    accountUI('account-send').disabled=locked||this.sending||wait>0||challengeNeeded;
    accountUI('account-send').textContent=signup?'Email me an account code':'Email me a sign-in code';
    accountUI('account-resend').disabled=locked||this.sending||wait>0||challengeNeeded;accountUI('account-verify').disabled=locked||this.sending||!pending;accountUI('account-change-email').disabled=locked;
    accountUI('account-code-destination').textContent=pending?'Enter the code sent to '+pending.email+'.':'';
    const waitLabel=accountUI('account-code-wait');waitLabel.textContent=wait?`You can request another code in ${wait} second${wait===1?'':'s'}.`:'';waitLabel.hidden=test||!wait;
    if(this.testAccounts)this.testAccounts.switchButton.disabled=locked;
    clearTimeout(this.codeCooldownTimer);if(wait&&!test)this.codeCooldownTimer=setTimeout(()=>this.renderAuth(),1000);
  }
  async sendCode(resend=false){
    if(this.sending||this.verifying||this.testAccounts?.testLogin)return;
    const attempt=resend?this.pendingCode:{email:accountUI('account-email').value.trim().toLowerCase(),intent:this.authIntent,...(this.authIntent==='signup'?{name:accountUI('account-name').value.trim()}:{})};
    if(!attempt||(!resend&&!accountUI('account-email-form').reportValidity()))return;
    if((this.codeCooldowns.get(attempt.email)||0)>Date.now()){this.renderAuth();return;}
    if(this.signup?.turnstile&&!this.challenge.token){accountUI('account-feedback').textContent='Complete the security check first.';return;}
    const epoch=this.authEpoch,body={...attempt,...(this.signup?.turnstile?{captchaToken:this.challenge.token}:{})};
    this.sending=true;this.renderAuth();accountUI('account-feedback').textContent='Sending your code…';
    try{
      const data=await this.request('/api/auth/code',body),seconds=Number.isFinite(data.resendAfterSeconds)?Math.max(1,Math.min(3600,data.resendAfterSeconds)):60;
      this.codeCooldowns.set(attempt.email,Date.now()+seconds*1000);
      if(epoch!==this.authEpoch)return;
      this.pendingCode=Object.freeze({...attempt});accountUI('account-email').value=attempt.email;accountUI('account-code').value='';accountUI('account-feedback').textContent=data.message;
    }catch(error){if(error.status===429)this.codeCooldowns.set(attempt.email,Date.now()+60000);if(epoch===this.authEpoch)accountUI('account-feedback').textContent=error.message;}
    finally{this.sending=false;this.challenge.reset();this.renderAuth();if(epoch===this.authEpoch&&this.pendingCode)accountUI('account-code').focus();}
  }
  async verifyCode(){
    if(this.verifying||this.sending||!this.pendingCode||this.testAccounts?.testLogin||!accountUI('account-code-form').reportValidity())return;
    const pending=this.pendingCode,epoch=this.authEpoch,code=accountUI('account-code').value.trim();this.verifying=true;this.renderAuth();accountUI('account-feedback').textContent='Checking your code…';
    try{await this.request('/api/auth/verify',{email:pending.email,code});if(epoch!==this.authEpoch)return;accountUI('account-code').value='';await this.initialize();}
    catch(error){if(epoch===this.authEpoch)accountUI('account-feedback').textContent=error.message;}
    finally{this.verifying=false;this.renderAuth();}
  }
  async initialize(){
    const c=this.controller,previousReady=c.ready;clearTimeout(this.timer);this.loading=true;c.ready=false;
    try{
      const session=await this.request('/api/session');this.signup=session.signup;this.testAccounts.session(session);this.facilitator?.session(session);
      const publicSignup=this.signup?.mode==='public';
      accountUI('account-signup-help').textContent=publicSignup?'Anyone can create an account with their email. Personal maps start private.':'Invited participants can create an account with their email. Personal maps start private.';
      if(!session.actor&&this.signup?.turnstile)await this.challenge.mount(this.signup.turnstile);
      this.renderAuth();
      if(!session.actor){document.body.classList.add('account-locked');accountUI('account-feedback').textContent=publicSignup?'Enter your email to sign in, or choose Create account.':'Enter your invited email to sign in, or choose Create account.';this.status('Sign in to open your maps');return;}
      const data=await this.request('/api/workspace');c.message();if(this.accept(data,true)===false){c.ready=previousReady;return;}this.blocked=false;
      this.authEpoch++;this.pendingCode=null;accountUI('account-code').value='';accountUI('account-name').value='';clearTimeout(this.codeCooldownTimer);
      document.body.classList.remove('account-locked');accountUI('account-display').textContent=this.actor.name;accountUI('account-feedback').textContent='';this.facilitator?.render();this.status();
    }catch(error){accountUI('account-feedback').textContent=error.message;c.message(error.message);this.status('Account unavailable');}
    finally{this.loading=false;this.activity?.sync();}
  }
  accept(data,reset=false){
    const actorChanged=!!this.actor&&this.actor.id!==data.actor.id;
    if(actorChanged&&(this.controller.workspaceDirty||this.controller.comparisonDirty||this.controller.discussion?.dirty||this.controller.argument?.dirty||this.controller.editor.hasDraft())){this.blocked=true;this.controller.message('Another account is signed in. Download your unsaved work before reopening Harmonious. The current account and drafts have been kept on this page.');this.status('Account changed · Download your unsaved work');return false;}
    reset=reset||actorChanged;
    const c=this.controller,workspace=validateWorkspace(data.workspace),oldMap=c.activeMap(),oldContent=oldMap?stableJSON(oldMap):'';
    const d=c.discussion,visibleEntries=new Set(workspace.discussions.map(r=>r.id)),available=target=>!target||(['entry','inference'].includes(target.type)?visibleEntries.has(target.entryId):!!discussionSource(workspace,target));
    const lostConversation=(c.workspace.discussions||[]).some(r=>!visibleEntries.has(r.id));
    if(reset)c.argument?.reset();
    if(d&&(reset||!d.dirty&&(lostConversation||!available(d.target)||!available(d.groupTarget)||d.viewId&&!visibleEntries.has(d.viewId)))){d.dirty=false;d.viewId=null;d.target=null;d.groupTarget=null;d.reasoning?.reset();if(d.host){d.host.hidden=true;d.host.replaceChildren();}}
    c.workspace=workspace;this.revisions=data.revisions;this.ownedKeys=data.ownedKeys;this.actor=data.actor;
    this.renderAccountName();this.facilitator?.render();
    this.baseline=new Map(ownedAccountRecords(workspace,this.actor.id,this.ownedKeys).map(r=>[accountKey(r.kind,r.id),r.value]));
    c.ready=true;c.cloudLoaded=true;c.workspaceDirty=false;document.body.classList.remove('account-locked');this.activity?.sync();
    if(reset){c.activeComparisonPair=null;c.activeMapId=null;c.editor.discardDraft();c.clearComparison();c.sides={a:{mapId:null,nodeId:null},b:{mapId:null,nodeId:null}};c.mode='library';c.updateNavigation?.();}
    else if(c.activeMapId&&!workspace.maps.some(m=>m.id===c.activeMapId&&m.ownerId===this.actor.id&&!m.unavailable)){c.activeMapId=null;if(c.mode==='individual')c.library.open('maps');}
    if(c.editingRecord&&!workspace.comparisons.some(record=>record.id===c.editingRecord))c.clearComparison();
    if(c.activeMapId&&(reset||oldContent!==stableJSON(c.activeMap())))c.loadMap(c.activeMapId);
    const selected=workspace.comparisons.find(record=>record.id===c.editingRecord);
    if(selected&&!c.comparisonDirty){c.sides={a:{mapId:selected.aMapId,nodeId:selected.aNodeId},b:{mapId:selected.bMapId,nodeId:selected.bNodeId}};c.loadComparisonForm(selected);}
    c.populateMaps();if(c.mode==='compare')c.renderComparison();c.participation.actorId=this.actor.id;c.participation.peopleSelection=null;c.participation.refresh();if(c.mode==='argument')c.argument.render();d?.interactions?.refreshArgumentLog();if(reset)c.openComparisonRoute();return true;
  }
  status(message=null){
    const c=this.controller;accountUI('save-workspace').textContent=this.blocked?'Retry save':'Save now';accountUI('storage-status').dataset.state=c.workspaceDirty?'dirty':'saved';
    accountUI('storage-status').textContent=message||(!this.actor?'Sign in to open your maps':this.saving?'Saving…':this.blocked?'Save needs attention':c.workspaceDirty?'Changes waiting to save':c.editor.hasChildDraft?.()?'Child node draft · Add child node to save':c.editor.hasDraft()?'Node changes waiting to save':c.discussion?.dirty?'Conversation draft · Add to map to save':c.argument?.dirty?'Argument draft - Save the form':c.comparisonDirty?'Comparison draft · Record to save':'All changes saved');
  }
  schedule(){if(this.facilitator?.context){this.status('Facilitator changes waiting for review');return;}clearTimeout(this.timer);if(this.actor&&!this.blocked&&!this.loading)this.timer=setTimeout(()=>this.save(false),900);}
  scheduleDraft(){this.status();clearTimeout(this.draftTimer);this.draftTimer=setTimeout(()=>{if(this.controller.ready&&!this.controller.editor.hasChildDraft?.()&&accountUI('edit-form').checkValidity()&&accountUI('connection-form').hidden){this.controller.editor.flushDraft();this.controller.captureActive();this.status();}},1100);}
  async save(flush=true){
    if(this.facilitator?.context)return this.facilitator.save(flush);
    const c=this.controller;if(!this.actor||!c.ready||this.loading)return;if(this.saving){this.schedule();return;}
    clearTimeout(this.timer);if(flush&&!c.editor.flushDraft())return;c.captureActive();
    const records=ownedAccountRecords(c.workspace,this.actor.id,this.ownedKeys),changes=accountChanges(records,this.baseline,this.revisions);
    if(!changes.length){c.workspaceDirty=false;this.status();return;}
    this.saving=true;accountUI('save-workspace').disabled=true;this.status();
    try{
      validateWorkspace(c.workspace);const result=await this.request('/api/workspace',{changes},'PUT');this.revisions={...this.revisions,...result.revisions};if(result.facilitationHistory)c.workspace.facilitationHistory=result.facilitationHistory;
      for(const r of changes){const key=accountKey(r.kind,r.id);this.baseline.set(key,accountClone(r.value));if(!this.ownedKeys.includes(key))this.ownedKeys.push(key);}
      this.blocked=false;c.workspaceDirty=accountChanges(ownedAccountRecords(c.workspace,this.actor.id,this.ownedKeys),this.baseline,this.revisions).length>0;c.message();this.activity?.refresh({force:true});
    }catch(error){this.blocked=true;c.workspaceDirty=true;c.message(`${error.message} Download a backup to keep your current work.${error.status===401?' Sign in again in a new tab, then retry this save.':''}`);}
    finally{this.saving=false;accountUI('save-workspace').disabled=false;this.status();if(c.workspaceDirty&&!this.blocked)this.schedule();}
  }
  // A reviewed choice stays staged until the whole account batch is acknowledged. The
  // callback can reuse its exact batch after a lost response; it first sees the
  // latest account, so an already-saved fulfillment is found before retrying.
  async commitCandidate(prepare){
    if(this.facilitator?.context)return this.facilitator.commit(prepare);
    const c=this.controller;await this.save();
    if(!this.actor||this.loading||this.saving||this.blocked||c.workspaceDirty)throw Error('Finish saving your earlier changes before saving this choice.');
    const actor=this.actor.id,wasInert=document.body.inert;this.loading=true;this.saving=true;document.body.inert=true;this.status('Checking and saving your choice…');
    try{
      const current=await this.request('/api/workspace');
      if(current.actor.id!==actor)throw Error('Another account is signed in. Your draft has been kept; reopen your original account before continuing.');
      if(this.accept(current)===false)throw Error('Your account needs attention before this choice can be saved.');
      const prepared=await prepare(c.workspace);
      const changes=prepared.changes||accountChanges(ownedAccountRecords(prepared.workspace,actor,this.ownedKeys),this.baseline,this.revisions);
      prepared.changes=changes;
      if(!changes.length)return prepared;
      const result=await this.request('/api/workspace',{changes},'PUT');
      // Merge only acknowledged records into the fresh read, retaining newer
      // foreign records even when this was an exact retry of an earlier batch.
      const workspace=accountClone(c.workspace),collections={profile:'participants',map:'maps',idea:'ideas',endorsement:'endorsements',comparison_thread:'comparisonThreads',comparison:'comparisons',argument_node:'argumentNodes',argument_edge:'argumentEdges',discussion:'discussions',definition:'definitions'};
      if(result.facilitationHistory)workspace.facilitationHistory=result.facilitationHistory;
      const ownedKeys=new Set(this.ownedKeys);
      for(const change of changes){const records=workspace[collections[change.kind]],index=records.findIndex(r=>r.id===change.id);if(index<0)records.push(accountClone(change.value));else records[index]=accountClone(change.value);ownedKeys.add(accountKey(change.kind,change.id));}
      this.accept({actor:current.actor,workspace,revisions:{...this.revisions,...result.revisions},ownedKeys:[...ownedKeys]});c.message();return prepared;
    }finally{document.body.inert=wasInert;this.loading=false;this.saving=false;this.status();this.activity?.refresh({force:true});}
  }
  async refresh(){
    const c=this.controller;if(!this.actor||this.saving||this.loading||this.blocked||c.workspaceDirty||c.comparisonDirty||c.discussion?.dirty||c.argument?.dirty||c.editor.hasDraft()||document.querySelector('dialog[open]'))return;
    this.loading=true;try{const data=await this.request('/api/workspace');if(!c.workspaceDirty&&!c.comparisonDirty&&!c.discussion?.dirty&&!c.argument?.dirty&&!c.editor.hasDraft()&&!document.querySelector('dialog[open]')){this.accept(data);this.status();}}catch(error){if(error.status===401)c.message('Your session ended. Sign in again in a new tab to continue saving.');}finally{this.loading=false;if(c.workspaceDirty&&!this.blocked)this.schedule();}
  }
  async signOut(){
    const c=this.controller;await this.save();if((c.workspaceDirty||c.comparisonDirty||c.discussion?.dirty||c.argument?.dirty||c.editor.hasDraft())&&!confirm('Some work has not been saved. Sign out and discard it?'))return;
    try{await this.request('/api/auth/logout',{});c.ready=false;this.actor=null;this.activity?.sync();c.workspaceDirty=false;c.comparisonDirty=false;c.editor.discardDraft();location.reload();}catch(error){c.message(error.message);}
  }
  async importFile(file){
    const c=this.controller;if(this.facilitator?.context){c.message('Exit facilitation before importing maps.');return;}if(!file)return;
    try{
      if(file.size>2_000_000)throw Error('This file exceeds the 2 MB import limit.');const source=validateWorkspace(JSON.parse(await file.text()));
      if(!confirm(`Import ${source.maps.length} maps as private copies owned by you? The original file keeps its participant identities and co-signs; those will not be recorded as authenticated choices.`))return;
      if(!c.editor.beforeLeave())return;c.captureActive();const candidate=accountClone(c.workspace),mapping=new Map();
      for(const original of source.maps){const map=accountClone(original);map.id=newId('map');mapping.set(original.id,map.id);map.name=map.name.slice(0,88)+' (imported)';map.ownerId=this.actor.id;map.person=this.actor.name;map.visibility='private';delete map.unavailable;map.revision=1;map.updatedAt=new Date().toISOString();for(const n of map.nodes){delete n.ideaId;delete n.ideaVersion;delete n.copiedFrom;delete n.reuseMode;if(original.ownerId!==this.actor.id)n.confidence=null;}candidate.maps.push(map);synchronizeIdeas(candidate,map);}
      // Historical judgments remain in the original backup. Importing a map
      // does not assert a fresh comparison against possibly changed sources.
      validateWorkspace(candidate);c.workspace=candidate;c.loadMap(mapping.values().next().value);c.populateMaps();c.markDirty();c.message('Private map copies imported. Your original file retains the earlier comparisons, arguments, participant identities, and co-signs.');
    }catch(error){c.message(`File was not imported: ${error.message}`);}finally{accountUI('workspace-file').value='';}
  }
}
