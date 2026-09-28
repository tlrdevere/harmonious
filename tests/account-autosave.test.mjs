import assert from 'node:assert/strict';
import {AccountWorkspace} from '../dist/account-ui.mjs';
import {accountKey,accountClone,ownedAccountRecords} from '../dist/account-model.mjs';
import {initialWorkspace,validateWorkspace} from '../dist/workspace.mjs';
import {alice,memoryStore,seedActor,view} from './accounts.test.mjs';
const store=memoryStore();await seedActor(store,alice);const data=await view(store,alice),button={disabled:false};
globalThis.document={getElementById:()=>button};
const c={workspace:data.workspace,ready:true,workspaceDirty:false,editor:{flushDraft:()=>true},captureActive(){},message(text){this.lastMessage=text;}};
let scheduled=0,acknowledge;
const state={controller:c,actor:alice,baseline:new Map(ownedAccountRecords(data.workspace,alice.id,data.ownedKeys).map(r=>[accountKey(r.kind,r.id),accountClone(r.value)])),ownedKeys:data.ownedKeys,revisions:data.revisions,saving:false,loading:false,blocked:false,status(){},schedule(){scheduled++;},request:()=>new Promise(resolve=>{acknowledge=resolve;})};
const map=c.workspace.maps[0];map.name='First edit';c.workspaceDirty=true;
const pending=AccountWorkspace.prototype.save.call(state,false);await Promise.resolve();assert(button.disabled);
map.name='Edit made while save is in flight';acknowledge({revisions:{[accountKey('map',map.id)]:2}});await pending;
assert(c.workspaceDirty,'An edit made during a request must remain unsaved');assert.equal(state.baseline.get(accountKey('map',map.id)).name,'First edit');assert.equal(map.name,'Edit made while save is in flight');assert.equal(scheduled,1);assert(!button.disabled);
state.request=async()=>{const error=Error('A newer version exists.');error.status=409;throw error;};await AccountWorkspace.prototype.save.call(state,false);
assert(state.blocked);assert(c.workspaceDirty);assert.equal(map.name,'Edit made while save is in flight');assert(c.lastMessage.includes('Download a backup'));
const draftController={workspace:{comparisonThreads:[]},workspaceDirty:false,comparisonDirty:true},startState={controller:draftController,baseline:new Map(),revisions:{},save:async()=>{},request:()=>new Promise(resolve=>{acknowledge=resolve;})};
const starting=AccountWorkspace.prototype.startComparison.call(startState,'map-a','map-b');await Promise.resolve();
assert(startState.loading,'Background refresh must pause while a parent is being created');
acknowledge({comparisonThread:{id:'thread-one'},revision:1});const started=await starting;
assert.equal(started.id,'thread-one');assert(draftController.comparisonDirty,'Starting a comparison must preserve an unrecorded judgment draft');assert(!startState.loading);
assert.equal(startState.baseline.get(accountKey('comparison_thread',started.id)).id,started.id,'A directly saved parent must not be submitted again by autosave');

const backup=initialWorkspace(),[ownBackup,foreignBackup]=backup.maps;
const ownNodes=ownBackup.nodes.filter(n=>n.kind==='position'),foreignNodes=foreignBackup.nodes.filter(n=>n.kind==='position');
ownNodes[0].confidence=73;ownNodes[1].confidence=0;foreignNodes[0].confidence=83;foreignNodes[1].confidence=0;
const originalBackup=JSON.stringify(backup),importActor={id:ownBackup.ownerId,name:ownBackup.person};
const importedController={workspace:accountClone(backup),editor:{beforeLeave:()=>true},captureActive(){},loadMap(id){this.activeMapId=id;},populateMaps(){},markDirty(){this.workspaceDirty=true;},message(text){this.lastMessage=text;}};
const originalConfirm=globalThis.confirm;globalThis.confirm=()=>true;
try{await AccountWorkspace.prototype.importFile.call({controller:importedController,actor:importActor},{size:originalBackup.length,text:async()=>originalBackup});}finally{globalThis.confirm=originalConfirm;}
const ownImport=importedController.workspace.maps.find(m=>m.name===ownBackup.name+' (imported)'),foreignImport=importedController.workspace.maps.find(m=>m.name===foreignBackup.name+' (imported)');
assert(ownImport&&foreignImport,'Both backup maps are imported');
assert.equal(ownImport.nodes.find(n=>n.id===ownNodes[0].id).confidence,73,'Restoring your own map preserves your confidence');
assert.equal(ownImport.nodes.find(n=>n.id===ownNodes[1].id).confidence,0,'A saved zero confidence belongs to its original author too');
assert.equal(foreignImport.nodes.find(n=>n.id===foreignNodes[0].id).confidence,null,'Importing another author’s map must not attribute their confidence to you');
assert.equal(foreignImport.nodes.find(n=>n.id===foreignNodes[1].id).confidence,null,'Another author’s zero confidence is also cleared');
assert.equal(foreignImport.ownerId,importActor.id);assert.equal(foreignImport.visibility,'private');
assert.equal(JSON.stringify(backup),originalBackup,'Import leaves the backup unchanged');
assert.equal(importedController.workspace.maps.find(m=>m.id===foreignBackup.id).nodes.find(n=>n.id===foreignNodes[0].id).confidence,83,'Existing source maps keep their author’s confidence');
validateWorkspace(importedController.workspace);

// A delayed edit autosave must never submit a subsequently opened child form.
let pendingChild=true,flushCount=0,captureCount=0;
const originalDocument=globalThis.document;
globalThis.document={getElementById:id=>id==='edit-form'?{checkValidity:()=>true}:{hidden:true}};
const childState={controller:{ready:true,editor:{hasChildDraft:()=>pendingChild,flushDraft:()=>{flushCount++;return true;}},captureActive:()=>{captureCount++;}},status(){}};
try{
  AccountWorkspace.prototype.scheduleDraft.call(childState);await new Promise(resolve=>setTimeout(resolve,1250));
  assert.equal(flushCount,0,'Pending child creation is never flushed by the edit autosave timer');assert.equal(captureCount,0);
  pendingChild=false;AccountWorkspace.prototype.scheduleDraft.call(childState);await new Promise(resolve=>setTimeout(resolve,1250));
  assert.equal(flushCount,1,'Existing node drafts retain their autosave behavior');assert.equal(captureCount,1);
}finally{clearTimeout(childState.draftTimer);globalThis.document=originalDocument;}
console.log('Autosave preserves in-flight edits and conflicting work; imports retain only the original owner’s confidence.');
