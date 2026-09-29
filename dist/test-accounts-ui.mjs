const testEl=(tag,text='',className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
const testButton=(text,action)=>{const el=testEl('button',text);el.type='button';el.onclick=action;return el;};
const testPassword=()=> 'HT-'+[...crypto.getRandomValues(new Uint8Array(16))].map(n=>n.toString(16).padStart(2,'0')).join('');
export class TestAccountsUI{
 constructor(account){
  this.account=account;this.busy=false;this.pending=null;const gate=document.querySelector('.account-card');
  this.switchButton=testButton('Use a test account',()=>this.switchLogin(!this.testLogin));gate.querySelector('#account-email-form').before(this.switchButton);
  this.login=testEl('form');this.login.id='test-login-form';this.login.hidden=true;
  this.login.innerHTML='<p class="field-help">Use the username and password your test organizer gave you. No email or verification code is needed.</p><label for="test-username">Test username</label><input id="test-username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="32" required><label for="test-password">Password</label><input id="test-password" type="password" autocomplete="current-password" maxlength="256" required><button class="primary" type="submit">Sign in with test account</button>';
  gate.querySelector('#account-feedback').before(this.login);this.login.onsubmit=event=>{event.preventDefault();this.signIn();};
  this.manage=testButton('Test accounts',()=>this.open());this.manage.hidden=true;document.querySelector('.account-menu-content').prepend(this.manage);
  this.dialog=testEl('dialog','','test-accounts-dialog');this.dialog.setAttribute('aria-labelledby','test-accounts-title');this.dialog.innerHTML='<header><h2 id="test-accounts-title">Test accounts</h2></header><p>Create one account per tester. Each person keeps their own maps and contributions without providing an email address.</p><form id="create-test-account"><label for="new-test-name">Display name</label><input id="new-test-name" maxlength="100" required placeholder="Test participant 1"><label for="new-test-username">Username</label><input id="new-test-username" pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{2,31}" minlength="3" maxlength="32" autocomplete="off" autocapitalize="none" spellcheck="false" required placeholder="tester01"><p class="field-help">3–32 letters, numbers, underscores or hyphens. A password is generated for you.</p><button class="primary" type="submit">Create test account</button></form><p class="test-accounts-feedback" role="status" aria-live="polite"></p><section class="test-account-credentials" hidden><h3>Login details</h3><p>Copy these details before closing. Passwords are not saved here; you can generate a replacement below.</p><textarea readonly aria-label="Test account login details" rows="5"></textarea></section><h3>Existing test accounts</h3><div class="test-account-list"></div>';
  this.closeButton=testButton('Close',()=>this.close());this.dialog.querySelector('header').append(this.closeButton);document.body.append(this.dialog);
  this.feedback=this.dialog.querySelector('.test-accounts-feedback');this.credentials=this.dialog.querySelector('.test-account-credentials');this.list=this.dialog.querySelector('.test-account-list');
  this.copyButton=testButton('Copy login details',async()=>{try{await navigator.clipboard.writeText(this.credentials.querySelector('textarea').value);this.feedback.textContent='Login details copied.';}catch{this.credentials.querySelector('textarea').select();this.feedback.textContent='Select and copy the login details above.';}});this.credentials.append(this.copyButton);
  this.dialog.querySelector('form').onsubmit=event=>{event.preventDefault();this.create();};this.dialog.addEventListener('cancel',event=>{event.preventDefault();this.close();});
 }
 switchLogin(test){
  this.testLogin=test;this.login.hidden=!test;document.getElementById('account-email-form').hidden=test;document.getElementById('account-code-form').hidden=true;this.switchButton.textContent=test?'Use email sign-in':'Use a test account';document.getElementById('account-feedback').textContent='';document.getElementById(test?'test-username':'account-email').focus();
  if(!test)document.getElementById('test-password').value='';
 }
 async signIn(){
  const button=this.login.querySelector('button'),feedback=document.getElementById('account-feedback');button.disabled=true;feedback.textContent='Signing in…';
  try{await this.account.request('/api/auth/test-login',{username:document.getElementById('test-username').value,password:document.getElementById('test-password').value});document.getElementById('test-password').value='';await this.account.initialize();}catch(error){feedback.textContent=error.message;}finally{button.disabled=false;}
 }
 session(session){this.manage.hidden=!session.canManageTestAccounts;if(!session.canManageTestAccounts&&this.dialog.open){this.dialog.close();this.clear();}if(session.actor)document.getElementById('test-password').value='';}
 clear(){this.pending=null;this.credentials.hidden=true;this.credentials.querySelector('textarea').value='';this.dialog.querySelector('form').reset();this.list.replaceChildren();this.feedback.textContent='';}
 async open(){if(this.busy)return;this.clear();this.dialog.showModal();document.getElementById('new-test-name').focus();await this.load();}
 close(){if(this.busy)return;if(!this.credentials.hidden&&!confirm('Have you copied the login details? Close this window?'))return;this.dialog.close();this.clear();this.manage.focus();}
 setBusy(busy){this.busy=busy;for(const el of this.dialog.querySelectorAll('button,input'))el.disabled=busy;}
 showCredentials(account,password){this.credentials.hidden=false;this.credentials.querySelector('textarea').value=`Harmonious: ${location.origin}\nChoose “Use a test account”\nUsername: ${account.username}\nPassword: ${password}\nDisplay name: ${account.name}`;this.feedback.textContent='Ready to share with this tester.';}
 async load(page=1){
  if(page===1)this.list.replaceChildren();this.feedback.textContent='Loading test accounts…';
  try{const data=await this.account.request('/api/admin/test-accounts?page='+page);for(const user of data.accounts){const row=testEl('div','','test-account-row');row.append(testEl('span',user.name+' · '+user.username),testButton('Reset password',()=>this.reset(user)));this.list.append(row);}if(data.nextPage){const more=testButton('Load more',()=>{more.remove();this.load(data.nextPage);});this.list.append(more);}else if(!this.list.children.length)this.list.append(testEl('p','No test accounts yet.'));this.feedback.textContent='';}catch(error){this.feedback.textContent=error.message;}
 }
 async create(){
  if(this.busy)return;const username=document.getElementById('new-test-username').value.trim().toLowerCase(),name=document.getElementById('new-test-name').value.trim();
  if(!this.pending||this.pending.username!==username||this.pending.name!==name)this.pending={username,name,password:testPassword()};
  this.setBusy(true);this.feedback.textContent='Creating test account…';
  try{const result=await this.account.request('/api/admin/test-accounts',this.pending);await this.load();this.showCredentials(result.account,this.pending.password);this.pending=null;this.dialog.querySelector('form').reset();}catch(error){this.feedback.textContent=error.message;}finally{this.setBusy(false);}
 }
 async reset(user){
  if(this.busy||!confirm(`Replace the password for ${user.username}? The previous password will stop working.`))return;
  const password=testPassword();this.setBusy(true);this.feedback.textContent='Replacing password…';
  try{const result=await this.account.request('/api/admin/test-accounts/reset',{id:user.id,password});this.showCredentials(result.account,password);}catch(error){this.feedback.textContent=error.message;}finally{this.setBusy(false);}
 }
}
