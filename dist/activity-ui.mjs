const activityElement=(tag,text='',className='')=>{const element=document.createElement(tag);element.textContent=text;if(className)element.className=className;return element;};
const activityButton=(text,action,key='')=>{const button=activityElement('button',text);button.type='button';button.onclick=action;if(key)button.dataset.activityControl=key;return button;};

// Activity is independent of workspace refresh: reading this inbox never accepts
// a workspace, flushes an editor, or changes a conversation draft.
export class ActivityUI{
 constructor(account){
  this.a=account;this.c=account.controller;this.epoch=0;this.filter='all';this.items=[];this.snapshots=new Map();this.muted=new Set();this.loadedPages=1;this.unreadCount=0;this.failures=0;this.expanded=new Set();this.seenGroups=new Set();
  this.button=activityButton('Activity',()=>this.open());this.button.id='activity-open';this.button.className='activity-open';this.button.hidden=true;this.button.setAttribute('aria-haspopup','dialog');
  const accountMenu=document.querySelector('.account-controls');if(accountMenu)accountMenu.before(this.button);else document.querySelector('.topbar').append(this.button);
  this.dialog=activityElement('dialog','','activity-dialog');this.dialog.id='activity-dialog';this.dialog.setAttribute('aria-labelledby','activity-title');
  const heading=activityElement('div','','activity-heading'),title=activityElement('h2','Activity');title.id='activity-title';heading.append(title,activityButton('Close',()=>this.close(),'close'));
  this.accountLabel=activityElement('p','','activity-account');
  this.facilitationNotice=activityElement('section','','activity-facilitation');this.facilitationNotice.append(activityElement('p','Activity belongs to your signed-in account. Return to your account to read it.'),activityButton('Return to my account',()=>this.returnToAccount(),'return-account'));
  this.tools=activityElement('div','','activity-tools');const filters=activityElement('div','','activity-filters');filters.setAttribute('role','group');filters.setAttribute('aria-label','Activity filter');
  this.filters={};for(const value of ['all','unread']){const button=activityButton(value==='all'?'All':'Unread',()=>this.setFilter(value),'filter-'+value);this.filters[value]=button;filters.append(button);}
  this.refreshButton=activityButton('Refresh',()=>this.refresh({force:true}),'refresh');this.markCurrent=activityButton('Mark shown items read',()=>this.setRead(this.items,true),'read-shown');this.tools.append(filters,this.refreshButton,this.markCurrent);
  this.feedback=activityElement('p','','activity-feedback');this.feedback.id='activity-feedback';this.feedback.setAttribute('role','status');this.feedback.setAttribute('aria-live','polite');
  this.list=activityElement('div','','activity-list');this.list.id='activity-list';
  this.more=activityButton('Load older activity',()=>this.loadMore(),'more');this.more.className='activity-more';this.more.hidden=true;
  this.footer=activityElement('p','Muted comparisons stay here. Muting applies to future alerts; existing unread items stay unread.','activity-help');
  this.dialog.append(heading,this.accountLabel,this.facilitationNotice,this.tools,this.feedback,this.list,this.more,this.footer);document.body.append(this.dialog);
  this.dialog.addEventListener('cancel',event=>{event.preventDefault();this.close();});
  this.onFocus=event=>{const el=event.target;if(!el.closest('.activity-dialog')&&el.matches('input,textarea,select,[contenteditable="true"]'))this.lastField={element:el,identity:this.identity(),route:location.hash};};document.addEventListener('focusin',this.onFocus);
  this.onVisible=()=>{if(!document.hidden){this.sync();this.refresh({force:true});}else clearTimeout(this.poll);};document.addEventListener('visibilitychange',this.onVisible);
  this.onOnline=()=>this.refresh({force:true});window.addEventListener('online',this.onOnline);
  this.lifecycle=new MutationObserver(()=>this.sync());this.lifecycle.observe(document.body,{attributes:true,attributeFilter:['class']});this.sync();
 }
 identity(){return JSON.stringify([this.a.facilitator?.operator?.id||this.a.actor?.id||null,this.a.actor?.id||null,this.a.facilitator?.context?.participantId||null,this.a.facilitator?.epoch||0]);}
 eligible(){return !!this.a.actor&&!!this.c.ready&&!this.a.facilitator?.context&&!document.body.classList.contains('account-locked');}
 valid(epoch,identity){return epoch===this.epoch&&identity===this.identity()&&this.eligible();}
 sync(){
  const identity=this.identity(),signedIn=!!this.a.actor&&!!this.c.ready&&!document.body.classList.contains('account-locked');
  if(identity!==this.lastIdentity||!signedIn&&this.wasSignedIn){this.lastIdentity=identity;this.epoch++;this.items=[];this.snapshots.clear();this.muted.clear();this.expanded.clear();this.seenGroups.clear();this.unreadCount=0;this.nextCursor=null;this.loadedPages=1;this.loaded=false;this.filter='all';this.error='';this.inflight=null;this.mutating=false;this.expired=false;this.list.replaceChildren();clearTimeout(this.poll);this.poll=null;if(this.dialog.open)this.close({restore:false});}
  this.wasSignedIn=signedIn;this.button.hidden=!signedIn;this.updateBadge();
  if(this.eligible()&&!this.inflight&&!this.poll&&!this.expired)this.queuePoll(this.loaded?30000:0);
 }
 updateBadge(){const count=this.a.facilitator?.context?0:this.unreadCount;this.button.textContent=count?'Activity · '+count:'Activity';this.button.setAttribute('aria-label',count?`Activity, ${count} unread`:'Activity');this.button.dataset.unread=String(count);}
 queuePoll(delay=30000){clearTimeout(this.poll);this.poll=null;if(!this.eligible()||document.hidden||this.expired)return;this.poll=setTimeout(()=>{this.poll=null;this.refresh();},delay);}
 rememberFocus(){const field=this.lastField,element=field?.identity===this.identity()&&field.route===location.hash&&field.element.isConnected&&field.element.getClientRects().length?field.element:document.activeElement;this.returnFocus={element,route:location.hash,identity:this.identity(),selection:element&&'selectionStart'in element?[element.selectionStart,element.selectionEnd]:null};}
 async open(){
  this.sync();if(!this.a.actor||!this.c.ready)return;this.rememberFocus();this.render();if(!this.dialog.open)this.dialog.showModal();this.dialog.querySelector('[data-activity-control="close"]').focus();if(this.eligible())await this.refresh({force:true});
 }
 close({restore=true}={}){if(this.dialog.open)this.dialog.close();const old=this.returnFocus;if(restore&&old?.identity===this.identity()&&old.route===location.hash&&old.element?.isConnected&&old.element.getClientRects().length){old.element.focus({preventScroll:true});if(old.selection?.[0]!==null&&old.selection?.[0]!==undefined)old.element.setSelectionRange?.(...old.selection);}else if(restore&&!this.button.hidden)this.button.focus({preventScroll:true});}
 async returnToAccount(){try{const returned=await this.a.facilitator.switchTo(null);this.sync();if(returned)await this.open();else if(this.dialog.open){this.feedback.textContent='Finish or cancel your current contribution, then return to your account.';}}catch(error){if(this.dialog.open)this.feedback.textContent=error.message;}}
 setFilter(value){if(this.filter===value||this.mutating)return;this.filter=value;this.epoch++;this.inflight=null;this.items=[];this.snapshots.clear();this.nextCursor=null;this.loadedPages=1;this.error='';this.render();this.refresh({force:true});}
 checkResponse(data,epoch,identity){if(!this.valid(epoch,identity))return false;if(data.actorId!==this.a.actor.id){this.clearUnavailable('Your signed-in account changed. Reopen Harmonious to read its activity.');return false;}return true;}
 clearUnavailable(message){this.epoch++;this.items=[];this.snapshots.clear();this.muted.clear();this.unreadCount=0;this.nextCursor=null;this.inflight=null;this.mutating=false;this.expired=true;this.error=message;this.list.replaceChildren();this.updateBadge();this.render();clearTimeout(this.poll);this.poll=null;}
 async fetchPage(cursor,epoch,identity){const params=new URLSearchParams({filter:this.filter});if(cursor)params.set('cursor',cursor);const data=await this.a.request('/api/activity?'+params);return this.checkResponse(data,epoch,identity)?data:null;}
 async refresh({force=false,more=false}={}){
  this.sync();if(!this.eligible()||document.hidden||this.inflight||this.mutating||this.expired&&!force)return false;
  const epoch=this.epoch,identity=this.identity(),request={};this.inflight=request;clearTimeout(this.poll);this.poll=null;this.renderBusy();
  try{
   const result=[],snapshots=new Map();let data,cursor=more?this.nextCursor:null;
   if(more&&!cursor)return false;
   for(let page=0;page<(more?1:this.loadedPages);page++){
    data=await this.fetchPage(cursor,epoch,identity);if(!data)return false;
    for(const item of data.items||[]){result.push(item);snapshots.set(item.id,data.snapshotToken);}
    cursor=data.nextCursor||null;if(!cursor)break;
   }
   if(!this.valid(epoch,identity))return false;
   this.items=more?[...new Map([...this.items,...result].map(item=>[item.id,item])).values()]:result;this.snapshots=more?new Map([...this.snapshots,...snapshots]):snapshots;this.nextCursor=cursor;this.unreadCount=data.unreadCount||0;this.muted=new Set(data.mutedComparisons||[]);this.error='';this.expired=false;this.failures=0;this.loaded=true;if(more)this.loadedPages++;this.updateBadge();this.render();return true;
  }catch(error){if(!this.valid(epoch,identity))return false;if(error.status===401||error.status===403)this.clearUnavailable('Your session needs attention. Sign in again to read activity.');else{this.failures++;this.error='Activity could not refresh. Your work is still here. '+error.message;this.render();}return false;
  }finally{if(this.inflight===request)this.inflight=null;if(this.valid(epoch,identity)){this.renderBusy();this.queuePoll(Math.min(300000,30000*2**this.failures));}}
 }
 loadMore(){return this.refresh({more:true,force:true});}
 renderBusy(){const busy=!!this.inflight||this.mutating;this.dialog.setAttribute('aria-busy',String(busy));this.refreshButton.disabled=busy;this.more.disabled=busy;this.markCurrent.disabled=busy||!this.items.some(item=>!item.read);for(const button of Object.values(this.filters))button.disabled=busy;for(const button of this.list.querySelectorAll('button'))button.disabled=busy;}
 render(){
  const facilitating=!!this.a.facilitator?.context;this.facilitationNotice.hidden=!facilitating;this.tools.hidden=facilitating;this.list.hidden=facilitating;this.footer.hidden=facilitating;this.more.hidden=facilitating||!this.nextCursor;
  this.accountLabel.textContent=facilitating?'Your personal activity':this.a.actor?.name?'Activity for '+this.a.actor.name:'';
  if(facilitating){this.feedback.textContent='';return;}
  for(const [value,button]of Object.entries(this.filters))button.setAttribute('aria-pressed',String(value===this.filter));
  this.feedback.textContent=this.error||(!this.loaded&&this.inflight?'Loading activity…':this.items.length?`${this.items.length} ${this.items.length===1?'item':'items'} shown · ${this.unreadCount} unread`:this.filter==='unread'?'You have no unread activity.':'No activity yet. New interactions with your maps will appear here.');
  const focus=document.activeElement?.dataset.activityControl,scroll=this.dialog.scrollTop;for(const group of this.list.querySelectorAll('details[data-activity-group]')){if(group.open)this.expanded.add(group.dataset.activityGroup);else this.expanded.delete(group.dataset.activityGroup);}
  const groups=new Map();for(const item of this.items){const key=item.groupKey||item.comparisonId||item.id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}
  this.list.replaceChildren();
  for(const [key,items]of groups){
   const group=activityElement('details','','activity-group');group.dataset.activityGroup=key;group.open=this.expanded.has(key)||!this.seenGroups.has(key)&&groups.size===1;this.seenGroups.add(key);const summary=activityElement('summary'),first=items[0],total=Number.isInteger(first.groupCount)?first.groupCount:null;summary.dataset.activityControl='group-'+key;summary.append(activityElement('strong',first.contextLabel||'Map activity'),activityElement('span',total!==null?`${total} ${total===1?'event':'events'}`:`${items.length} shown`,'activity-group-count'));group.append(summary);
   if(first.comparisonId){const muted=this.muted.has(first.comparisonId),tools=activityElement('div','','activity-group-tools');tools.append(activityButton(muted?'Unmute this comparison':'Mute this comparison',()=>this.setMuted(first.comparisonId,!muted),'mute-'+key));if(muted)tools.append(activityElement('span','New alerts muted','activity-muted'));group.append(tools);}
   for(const item of items)group.append(this.card(item));this.list.append(group);
  }
  this.renderBusy();this.dialog.scrollTop=scroll;if(focus){const button=[...this.dialog.querySelectorAll('[data-activity-control]')].find(el=>el.dataset.activityControl===focus&&!el.disabled);button?.focus({preventScroll:true});}
 }
 card(item){
  const card=activityElement('article','','activity-item');card.dataset.activityId=item.id;card.dataset.read=String(!!item.read);const heading=activityElement('div','','activity-item-heading'),title=activityElement('h3',item.title||'New activity');heading.append(title,activityElement('span',item.read?'Read':item.suppressed?'Muted when received':'Unread','activity-read-label'));card.append(heading);
  const byline=[item.actorName||'Participant',...(item.recorderName?['Recorded by '+item.recorderName]:[])].join(' · ');card.append(activityElement('p',byline,'activity-byline'));
  if(item.body)card.append(activityElement('p',item.body,'activity-body'));
  const time=activityElement('time'),date=new Date(item.createdAt);if(!Number.isNaN(date.valueOf())){time.dateTime=date.toISOString();time.textContent=date.toLocaleString();}card.append(time);
  const actions=activityElement('div','','activity-item-actions');actions.append(activityButton('Open activity',()=>this.openItem(item),'open-'+item.id),activityButton(item.read?'Mark unread':'Mark read',()=>this.setRead([item],!item.read),'read-'+item.id));card.append(actions);return card;
 }
 async setRead(items,read){
  if(!this.eligible()||this.inflight||this.mutating||!items.length)return;const epoch=this.epoch,identity=this.identity(),groups=new Map();for(const item of items){const token=this.snapshots.get(item.id);if(!token)continue;if(!groups.has(token))groups.set(token,[]);groups.get(token).push(item.id);}if(!groups.size)return;
  this.mutating=true;this.renderBusy();let completed=false;
  try{for(const [snapshotToken,ids]of groups){const data=await this.a.request('/api/activity/read',{ids,read,snapshotToken});if(!this.checkResponse(data,epoch,identity))return;for(const item of this.items)if(ids.includes(item.id)){item.read=read;if(!read)item.suppressed=false;}if(Number.isInteger(data.unreadCount))this.unreadCount=data.unreadCount;this.updateBadge();}this.error='';completed=true;}
  catch(error){if(this.valid(epoch,identity)){if(error.status===401||error.status===403)this.clearUnavailable('Your session needs attention. Sign in again to read activity.');else this.error='The read status could not be saved. '+error.message;}}
  finally{if(this.valid(epoch,identity)){this.mutating=false;this.render();if(completed)await this.refresh({force:true});}}
 }
 async setMuted(comparisonId,muted){
  if(!this.eligible()||this.inflight||this.mutating)return;const epoch=this.epoch,identity=this.identity();this.mutating=true;this.renderBusy();let completed=false;
  try{const data=await this.a.request('/api/activity/mute',{comparisonId,muted});if(!this.checkResponse(data,epoch,identity))return;if(muted)this.muted.add(comparisonId);else this.muted.delete(comparisonId);this.error='';completed=true;}
  catch(error){if(this.valid(epoch,identity))this.error='The notification setting could not be saved. '+error.message;}
  finally{if(this.valid(epoch,identity)){this.mutating=false;this.render();if(completed)await this.refresh({force:true});}}
 }
 async openItem(item){
  if(!this.eligible()||this.inflight||this.mutating)return;const epoch=this.epoch,identity=this.identity();this.mutating=true;this.renderBusy();let opened=false,unavailable=false;
  try{opened=await this.a.openActivity(item.id);if(!this.valid(epoch,identity))return;if(opened)this.close({restore:false});else this.error='Activity was not opened. Your current work and unread status are unchanged.';}
  catch(error){if(this.valid(epoch,identity)){if(error.status===404||error.status===403){unavailable=true;this.items=this.items.filter(record=>record.id!==item.id);this.snapshots.delete(item.id);this.error='This activity is no longer available.';}else if(error.status===401)this.clearUnavailable('Your session needs attention. Sign in again to read activity.');else this.error=error.message;}}
  finally{if(this.valid(epoch,identity)){this.mutating=false;this.render();}}
  if(opened&&this.valid(epoch,identity)){await this.setRead([item],true);if(this.error)this.c.message('Activity opened, but its read status could not be updated. Use Activity to retry.');}
  else if(unavailable&&this.valid(epoch,identity)){await this.refresh({force:true});if(this.valid(epoch,identity)){this.error='This activity is no longer available.';this.render();}}
 }
 destroy(){clearTimeout(this.poll);this.epoch++;this.lifecycle.disconnect();document.removeEventListener('visibilitychange',this.onVisible);document.removeEventListener('focusin',this.onFocus);window.removeEventListener('online',this.onOnline);this.dialog.remove();this.button.remove();}
}
