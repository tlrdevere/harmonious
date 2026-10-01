import {stableJSON} from '../dist/account-model.mjs';
import {AccountError,projectAccountWorkspace,validateAccountChanges,initialAccountChanges,orderAccountChanges} from './account-policy.mjs';
import {TestAccounts,isTestUser,canManageTestAccounts} from './test-accounts.mjs';
import {validateFacilitatedBatch,facilitationChanges} from '../dist/facilitation.mjs';
import {comparisonPairKey,startComparisonThread} from '../dist/workspace.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class FacilitationAPI{
 constructor(store,auth,env,actor){Object.assign(this,{store,auth,env,actor});}
 async checkTarget(id){if(!UUID.test(id||''))throw new AccountError('Choose a test participant.');const user=await new TestAccounts(this.auth).call(`users/${id}`);if(!isTestUser(user))throw new AccountError('Facilitation is available only for test accounts.',403);return user;}
 grant(snapshot,id,version){const g=(snapshot.facilitationGrants||[]).find(g=>g.participantId===id);if(!canManageTestAccounts(this.env,this.actor)||!g?.active||g.operatorId!==this.actor.id||g.version!==version)throw new AccountError('Facilitation permission ended or changed. Return to your own account.',403);return g;}
 async workspace(id,version){await this.checkTarget(id);const snapshot=await this.store.snapshot();this.grant(snapshot,id,version);return this.view(snapshot,id);}
 view(snapshot,id){const result=projectAccountWorkspace(snapshot,id),person=result.workspace.participants.find(p=>p.id===id);if(!person)throw new AccountError('The participant needs an initialized workspace.',409);return {...result,actor:person,operator:{id:this.actor.id,name:this.actor.name}};}
 async list(){const s=await this.store.snapshot(),manager=canManageTestAccounts(this.env,this.actor),grants=(s.facilitationGrants||[]).filter(g=>g.participantId===this.actor.id||manager&&g.operatorId===this.actor.id),allowed=new Set();if(manager)for(const g of grants.filter(g=>g.active)){try{await this.checkTarget(g.participantId);allowed.add(g.participantId);}catch(e){if(e.status!==403)throw e;}}return {grants,participants:s.records.filter(r=>r.kind==='profile').map(r=>({id:r.id,name:r.value.name})).filter(p=>p.id===this.actor.id||grants.some(g=>[g.operatorId,g.participantId].includes(p.id))),drafts:(s.facilitationDrafts||[]).filter(d=>d.participantId===this.actor.id||manager&&allowed.has(d.participantId)&&d.operatorId===this.actor.id).map(d=>({...d,review:facilitationChanges(s,d.changes)}))};}
 async command(command,input){
  if(!['grant','revoke','draft','record','approve','decline','withdraw','comparison'].includes(command))throw new AccountError('Unknown facilitator action.');
  const id=input?.participantId;if(!UUID.test(id||'')||typeof input.operationId!=='string'||input.operationId.length<10||input.operationId.length>100)throw new AccountError('Invalid facilitation request.');
  const manager=canManageTestAccounts(this.env,this.actor);
  if(command==='grant'&&!manager)throw new AccountError('Only the organizer can enable facilitation.',403);
  const targetUser=manager?await this.checkTarget(id):null;if(!manager) if(this.actor.id!==id||!['revoke','approve','decline'].includes(command))throw new AccountError('This action belongs to the participant or organizer.',403);
  if(!manager&&command!=='revoke')await this.checkTarget(id);
  for(let attempt=0;attempt<4;attempt++){
   const snapshot=await this.store.snapshot(),g=(snapshot.facilitationGrants||[]).find(g=>g.participantId===id);
   if(!['grant','revoke'].includes(command)){if(manager)this.grant(snapshot,id,input.grantVersion);else if(!g?.active||g.version!==input.grantVersion)throw new AccountError('Facilitation permission ended or changed.',403);}
   let clean={participantId:id,operationId:input.operationId,grantVersion:input.grantVersion,expectedVersion:input.expectedVersion,attested:input.attested===true,method:input.method};
   if(command==='grant')clean.verifiedTest=true;
   if(['approve','decline','withdraw'].includes(command)){
    const draft=(snapshot.facilitationDrafts||[]).find(d=>d.id===input.draftId&&d.participantId===id);
    if(!draft||draft.version!==input.draftVersion||draft.grantVersion!==g?.version)throw new AccountError('This draft changed or is unavailable.',409);
    Object.assign(clean,{draftId:draft.id,draftVersion:draft.version});if(command==='approve'){clean.changes=draft.changes;clean.method=manager?'verbal':'direct';}
   }else if(['draft','record'].includes(command))clean.changes=input.changes;
   if(command==='comparison'){
    const view=projectAccountWorkspace(snapshot,id),sources=[input.aMapId,input.bMapId].map(mid=>view.workspace.maps.find(m=>m.id===mid&&!m.unavailable));
    if(!sources.every(Boolean)||sources[0].id===sources[1].id||!sources.some(m=>m.ownerId===id))throw new AccountError('Choose your participant’s map and another visible map.',403);
    const existing=snapshot.records.find(r=>r.kind==='comparison_thread'&&comparisonPairKey(r.value)===comparisonPairKey(input));if(existing)return {comparisonThread:existing.value,revision:existing.revision};
    const thread=startComparisonThread(view.workspace,input.aMapId,input.bMapId,id);clean.changes=[{kind:'comparison_thread',id:thread.id,expectedRevision:0,value:thread}];
   }
   if(clean.changes)clean.changes=orderAccountChanges(clean.changes);
   const prior=(snapshot.facilitationOperations||[]).find(p=>p.id===input.operationId);
   if(prior){if(prior.operatorId!==this.actor.id||stableJSON(prior.request)!==stableJSON(JSON.parse(JSON.stringify({command,input:clean}))))throw new AccountError('This operation already contains different content.',409);return this.store.facilitate(this.actor.id,this.env.TEST_ACCOUNT_ADMIN_ID||null,snapshot.revision,command,clean);}
   if(clean.changes){try{validateFacilitatedBatch(snapshot,id,clean.changes,{draft:command==='draft'});}catch(e){throw new AccountError(e.message);}clean.changes=validateAccountChanges(snapshot,id,clean.changes);}
   try{const result=await this.store.facilitate(this.actor.id,this.env.TEST_ACCOUNT_ADMIN_ID||null,snapshot.revision,command,clean);if(command==='grant'&&!snapshot.records.some(r=>r.kind==='profile'&&r.id===id)){const fresh=await this.store.snapshot();if(!fresh.records.some(r=>r.kind==='profile'&&r.id===id))await this.store.commit(id,fresh.revision,initialAccountChanges({id,name:targetUser.user_metadata?.display_name||'Test participant'}));}return command==='comparison'?{comparisonThread:clean.changes[0].value,revision:1}:result;}catch(e){if(e.snapshotChanged)continue;throw e;}
  }
  throw new AccountError('Changes arrived while saving. Please review again.',409);
 }
}
