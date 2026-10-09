import {FacilitationAPI} from './facilitation-api.mjs';
import {AccountError,initialAccountChanges,projectAccountWorkspace,validateAccountChanges} from './account-policy.mjs';
import {AccountAuth,accountConfiguration,accountSignupConfiguration,requireAccountOrigin,accountBody} from './account-auth.mjs';
import {SupabaseStore} from './supabase-store.mjs';
import {TestAccounts,canManageTestAccounts} from './test-accounts.mjs';
import {startComparisonThread,comparisonPairKey} from '../dist/workspace.mjs';
import {accountKey,stableJSON} from '../dist/account-model.mjs';
import {adoptionFulfillmentId,isAdoptionReceipt} from '../dist/adoption-fulfillment.mjs';
const accountResponse=(data,status=200,cookies=[])=>{const headers=new Headers({'cache-control':'no-store','x-content-type-options':'nosniff'});for(const cookie of cookies)headers.append('set-cookie',cookie);return Response.json(data,{status,headers});};
export const PHILOSOPHY_CAPABILITY='philosophy-v1';
export function requiresPhilosophyCapability(workspace){
  const extended=value=>value&&typeof value==='object'&&(Array.isArray(value)?value.some(extended):(['principle','belief','other'].includes(value.type)&&(value.definitionId||value.versions)||Object.values(value).some(extended)));
  return extended(workspace.definitions)||extended(workspace.discussions);
}
export const REASONING_CAPABILITY='comparison-reasoning-v1';
export const MAP_DELETION_CAPABILITY='map-deletion-v1';
export async function deleteAccountMap(store,actor,input){
  if(typeof input?.id!=='string'||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<1)throw new AccountError('Choose a saved map to delete.');
  for(let attempt=0;attempt<4;attempt++){
    const snapshot=await store.snapshot(),record=snapshot.records.find(r=>r.kind==='map'&&r.id===input.id);
    if(!record||record.ownerId!==actor.id)throw new AccountError('You can only delete your own maps.',403);
    if(record.value.deletedAt)return accountWorkspace(store,actor);
    if(record.revision!==input.expectedRevision)throw new AccountError('This map changed in another session. Cancel, refresh maps and review it before deleting.',409);
    const changes=validateAccountChanges(snapshot,actor.id,[{kind:'map',id:record.id,expectedRevision:record.revision,value:{...record.value,visibility:'private',deletedAt:new Date().toISOString()}}],{allowMapDeletion:true});
    try{await store.commit(actor.id,snapshot.revision,changes);return accountWorkspace(store,actor);}catch(error){if(error.snapshotChanged)continue;throw error;}
  }
  throw new AccountError('Changes arrived while deleting. Please try again.',409);
}
export const ADOPTION_CAPABILITY='comparison-adoption-v1';
export const PREMISE_CAPABILITY='comparison-premise-v1';
export const REFLECTION_CAPABILITY='comparison-reflection-v1';
export const INTERACTION_CAPABILITY='interaction-grammar-v4';
export const STANDSTILL_CAPABILITY='argument-standstill-v1';
export function requiresStandstillCapability(discussions){return discussions.some(record=>[record,...(Array.isArray(record?.history)?record.history:[])].some(r=>r?.kind==='standstill'||r?.standstill!==undefined));}
export const PLACEMENT_CAPABILITY='argument-placement-v1';
export function requiresPlacementCapability(discussions){return discussions.some(record=>[record,...(Array.isArray(record?.history)?record.history:[])].some(r=>r?.interaction&&Object.hasOwn(r.interaction,'placement')));}
export const DIALOGUE_CAPABILITY='argument-dialogue-v1';
export function requiresDialogueCapability(discussions){return discussions.some(record=>[record,...(Array.isArray(record?.history)?record.history:[])].some(r=>r?.interaction?.version===7));}
export const REPLIES_CAPABILITY='argument-replies-v1';
export function requiresRepliesCapability(discussions){return discussions.some(record=>[record,...(Array.isArray(record?.history)?record.history:[])].some(r=>r?.interaction?.version===6));}
export const ARGUMENT_CAPABILITY='argument-categories-v1';
export function requiresArgumentCapability(discussions){return discussions.some(record=>[record,...(Array.isArray(record?.history)?record.history:[])].some(r=>r?.interaction?.version===5));}
export const COUNTERPART_CAPABILITY='counterpart-integrity-v1';
export function requiresReasoningCapability(discussions){return discussions.some(record=>[record,...(Array.isArray(record?.history)?record.history:[])].some(r=>r&&(r.kind==='argument'&&r.action==='reason'||r.target?.type==='inference'||r.other?.type==='inference'||r.kind!=='context'&&r.definitionRefs!==undefined)));}
export function requiresAdoptionCapability(workspace){return (workspace.discussions||[]).some(r=>r.adoption!==undefined||['adoption_added','adoption_existing','adoption_not_now'].includes(r.action))||(workspace.definitions||[]).some(d=>d.copiedFrom!==undefined);}
export function requiresPremiseCapability(discussions){return discussions.some(record=>[record,...(Array.isArray(record?.history)?record.history:[])].some(r=>r?.premise!==undefined));}
export function requiresReflectionCapability(discussions){return discussions.some(record=>[record,...(Array.isArray(record?.history)?record.history:[])].some(r=>r?.kind==='reflection'||r?.reflection!==undefined));}
export function requiresInteractionCapability(discussions){return discussions.some(record=>[record,...(Array.isArray(record?.history)?record.history:[])].some(r=>r?.kind==='interaction'||r?.interaction!==undefined));}
export function requiresCounterpartCapability(discussions){return discussions.some(r=>r?.kind==='counterpart_unlink'||r?.unlinkedRecordIds!==undefined);}
function requireCompatibleWorkspace(workspace,{reasoningCapable,adoptionCapable,premiseCapable,reflectionCapable,interactionCapable,counterpartCapable,argumentCapable,repliesCapable,dialogueCapable,placementCapable,standstillCapable,facilitationCapable,philosophyCapable},changes=[]){
  const incoming={discussions:Array.isArray(changes)?changes.filter(c=>c?.kind==='discussion'&&c.value).map(c=>c.value):[],definitions:Array.isArray(changes)?changes.filter(c=>c?.kind==='definition'&&c.value).map(c=>c.value):[]};
  const missing=!placementCapable&&(requiresPlacementCapability(workspace.discussions)||requiresPlacementCapability(incoming.discussions))?PLACEMENT_CAPABILITY:!facilitationCapable&&workspace.facilitationHistory?.length?'facilitation-v1':!standstillCapable&&(requiresStandstillCapability(workspace.discussions)||requiresStandstillCapability(incoming.discussions))?STANDSTILL_CAPABILITY:!dialogueCapable&&(requiresDialogueCapability(workspace.discussions)||requiresDialogueCapability(incoming.discussions))?DIALOGUE_CAPABILITY:!counterpartCapable&&(requiresCounterpartCapability(workspace.discussions)||requiresCounterpartCapability(incoming.discussions))?COUNTERPART_CAPABILITY:!interactionCapable&&(requiresInteractionCapability(workspace.discussions)||requiresInteractionCapability(incoming.discussions))?INTERACTION_CAPABILITY:!argumentCapable&&(requiresArgumentCapability(workspace.discussions)||requiresArgumentCapability(incoming.discussions)||incoming.discussions.some(r=>r?.kind==='interaction'&&r.action==='dispute'))?ARGUMENT_CAPABILITY:!repliesCapable&&(requiresRepliesCapability(workspace.discussions)||requiresRepliesCapability(incoming.discussions))?REPLIES_CAPABILITY:!reflectionCapable&&(requiresReflectionCapability(workspace.discussions)||requiresReflectionCapability(incoming.discussions))?REFLECTION_CAPABILITY:!premiseCapable&&(requiresPremiseCapability(workspace.discussions)||requiresPremiseCapability(incoming.discussions))?PREMISE_CAPABILITY:!adoptionCapable&&(requiresAdoptionCapability(workspace)||requiresAdoptionCapability(incoming))?ADOPTION_CAPABILITY:!reasoningCapable&&(requiresReasoningCapability(workspace.discussions)||requiresReasoningCapability(incoming.discussions))?REASONING_CAPABILITY:!philosophyCapable&&(requiresPhilosophyCapability(workspace)||requiresPhilosophyCapability(incoming))?PHILOSOPHY_CAPABILITY:null;
  if(missing){
    const error=new AccountError('This comparison uses a newer version of Harmonious. Keep this page open to download your unsaved work, then reopen Harmonious in a new tab. Your drafts have not been discarded.',409);error.code='CLIENT_UPDATE_REQUIRED';error.requiredCapability=missing;throw error;
  }
}
export async function accountWorkspace(store,actor,{reasoningCapable=true,adoptionCapable=true,premiseCapable=true,reflectionCapable=true,interactionCapable=true,counterpartCapable=true,argumentCapable=true,repliesCapable=true,dialogueCapable=true,placementCapable=true,standstillCapable=true,facilitationCapable=true,philosophyCapable=true}={}){
  for(let attempt=0;attempt<4;attempt++){
    const snapshot=await store.snapshot();
    if(snapshot.records.some(r=>r.kind==='profile'&&r.id===actor.id)){
      const result=projectAccountWorkspace(snapshot,actor.id);requireCompatibleWorkspace(result.workspace,{reasoningCapable,adoptionCapable,premiseCapable,reflectionCapable,interactionCapable,counterpartCapable,argumentCapable,repliesCapable,dialogueCapable,placementCapable,standstillCapable,facilitationCapable,philosophyCapable});
      // An unaffected older client still receives the envelope it understands.
      if(!adoptionCapable)result.workspace.schemaVersion=reasoningCapable?3:2;
      else if(!premiseCapable)result.workspace.schemaVersion=4;
      else if(!reflectionCapable)result.workspace.schemaVersion=5;
      return {...result,actor:{id:actor.id,name:snapshot.records.find(r=>r.kind==='profile'&&r.id===actor.id).value.name}};
    }
    const changes=initialAccountChanges(actor);validateAccountChanges(snapshot,actor.id,changes);
    try{await store.commit(actor.id,snapshot.revision,changes);}catch(error){if(error.snapshotChanged)continue;throw error;}
  }
  throw new AccountError('Your account is being opened in another session. Please try again.',409);
}
export async function saveAccountChanges(store,actorId,changes,{reasoningCapable=true,adoptionCapable=true,premiseCapable=true,reflectionCapable=true,interactionCapable=true,counterpartCapable=true,argumentCapable=true,repliesCapable=true,dialogueCapable=true,placementCapable=true,standstillCapable=true,facilitationCapable=true,philosophyCapable=true}={}){
  if(Array.isArray(changes))for(const change of changes)if(change?.kind==='discussion'&&isAdoptionReceipt(change.value)&&change.id!==await adoptionFulfillmentId(change.value.target?.entryId,actorId))throw new AccountError('Invalid adoption fulfillment identity.');
  for(let attempt=0;attempt<4;attempt++){
    const snapshot=await store.snapshot();requireCompatibleWorkspace(projectAccountWorkspace(snapshot,actorId).workspace,{reasoningCapable,adoptionCapable,premiseCapable,reflectionCapable,interactionCapable,counterpartCapable,argumentCapable,repliesCapable,dialogueCapable,placementCapable,standstillCapable,facilitationCapable,philosophyCapable},changes);
    // A lost response may be retried with the exact staged batch. Acknowledging
    // it is safe only while every submitted value still equals its saved row.
    if(Array.isArray(changes)&&changes.length>0&&changes.length<=500&&new Set(changes.map(c=>accountKey(c?.kind,c?.id))).size===changes.length&&changes.every(c=>Number.isSafeInteger(c?.expectedRevision)&&c.expectedRevision>=0&&snapshot.records.some(r=>r.kind===c.kind&&r.id===c.id&&r.ownerId===actorId&&stableJSON(r.value)===stableJSON(c.value))))return {revision:snapshot.revision,revisions:Object.fromEntries(changes.map(c=>[accountKey(c.kind,c.id),snapshot.records.find(r=>r.kind===c.kind&&r.id===c.id).revision])),replayed:true,...(snapshot.facilitationHistory?.length?{facilitationHistory:projectAccountWorkspace(snapshot,actorId).workspace.facilitationHistory||[]}: {})};
    const accepted=validateAccountChanges(snapshot,actorId,changes);
    try{const result=await store.commit(actorId,snapshot.revision,accepted);if(snapshot.facilitationHistory?.length)result.facilitationHistory=projectAccountWorkspace(await store.snapshot(),actorId).workspace.facilitationHistory||[];return result;}catch(error){if(error.snapshotChanged)continue;throw error;}
  }
  throw new AccountError('Several changes arrived at once. Please try saving again.',409);
}
export async function startAccountComparison(store,actorId,input,{reasoningCapable=true,adoptionCapable=true,premiseCapable=true,reflectionCapable=true,interactionCapable=true,counterpartCapable=true,argumentCapable=true,repliesCapable=true,dialogueCapable=true,placementCapable=true,standstillCapable=true,facilitationCapable=true,philosophyCapable=true}={}){
  if(typeof input?.aMapId!=='string'||typeof input?.bMapId!=='string')throw new AccountError('Choose two maps.');
  for(let attempt=0;attempt<4;attempt++){
    const snapshot=await store.snapshot(),view=projectAccountWorkspace(snapshot,actorId),sources=[input.aMapId,input.bMapId].map(id=>view.workspace.maps.find(map=>map.id===id&&!map.unavailable));
    requireCompatibleWorkspace(view.workspace,{reasoningCapable,adoptionCapable,premiseCapable,reflectionCapable,interactionCapable,counterpartCapable,argumentCapable,repliesCapable,dialogueCapable,placementCapable,standstillCapable,facilitationCapable,philosophyCapable});
    if(!sources.every(Boolean)||sources[0].id===sources[1].id||!sources.some(map=>map.ownerId===actorId))throw new AccountError('Choose one of your maps and another visible map.',403);
    const existing=snapshot.records.find(record=>record.kind==='comparison_thread'&&comparisonPairKey(record.value)===comparisonPairKey(input));
    if(existing)return {comparisonThread:existing.value,revision:existing.revision};
    const thread=startComparisonThread(view.workspace,input.aMapId,input.bMapId,actorId),changes=[{kind:'comparison_thread',id:thread.id,expectedRevision:0,value:thread}];
    const accepted=validateAccountChanges(snapshot,actorId,changes);
    try{await store.commit(actorId,snapshot.revision,accepted);return {comparisonThread:thread,revision:1};}catch(error){if(error.snapshotChanged)continue;throw error;}
  }
  throw new AccountError('This comparison is being opened in another session. Try again.',409);
}
async function currentTestAccountNames(store,result){
  const profiles=new Map((await store.snapshot()).records.filter(r=>r.kind==='profile').map(r=>[r.id,r.value.name]));
  const current=account=>({...account,name:profiles.get(account.id)||account.name});
  return {...result,...(result.accounts?{accounts:result.accounts.map(current)}:{}),...(result.account?{account:current(result.account)}:{})};
}
export async function handleAccountAPI(request,env,dependencies={}){
  const path=new URL(request.url).pathname,declared=(request.headers.get('X-Harmonious-Capabilities')||'').split(/[\s,]+/),capabilities={philosophyCapable:declared.includes(PHILOSOPHY_CAPABILITY),reasoningCapable:declared.includes(REASONING_CAPABILITY),adoptionCapable:declared.includes(ADOPTION_CAPABILITY),premiseCapable:declared.includes(PREMISE_CAPABILITY),reflectionCapable:declared.includes(REFLECTION_CAPABILITY),interactionCapable:declared.includes(INTERACTION_CAPABILITY),counterpartCapable:declared.includes(COUNTERPART_CAPABILITY),argumentCapable:declared.includes(ARGUMENT_CAPABILITY),repliesCapable:declared.includes(REPLIES_CAPABILITY),dialogueCapable:declared.includes(DIALOGUE_CAPABILITY),placementCapable:declared.includes(PLACEMENT_CAPABILITY),facilitationCapable:declared.includes('facilitation-v1'),standstillCapable:declared.includes(STANDSTILL_CAPABILITY)};let cookies=[];
  if(!accountConfiguration(env))return accountResponse({error:'Sign-in is being set up. Please return soon.',configured:false},503);
  const auth=dependencies.auth||new AccountAuth(env),store=dependencies.store||new SupabaseStore(env);
  try{
    if(new URL(request.url).origin!==env.APP_ORIGIN)throw new AccountError('Use the configured Harmonious address.',403);
    if(!['GET','POST','PUT'].includes(request.method))throw new AccountError('Method not allowed.',405);
    if(request.method!=='GET')requireAccountOrigin(request,env);
    if(path==='/api/auth/code'&&request.method==='POST')return accountResponse(await auth.requestCode(await accountBody(request,4096),request));
    if(path==='/api/auth/test-login'&&request.method==='POST'){const session=await auth.signInTest(await accountBody(request,4096));return accountResponse({signedIn:true},200,session.cookies);}
    if(path==='/api/auth/verify'&&request.method==='POST'){const session=await auth.verifyCode(await accountBody(request,4096));cookies=session.cookies;return accountResponse({signedIn:true},200,cookies);}
    if(path==='/api/auth/logout'&&request.method==='POST')return accountResponse({signedIn:false},200,await auth.logout(request));
    const session=await auth.identify(request);cookies=session.cookies;
    if(path==='/api/session'&&request.method==='GET')return accountResponse({actor:session.actor?{id:session.actor.id,name:session.actor.name}:null,canManageTestAccounts:canManageTestAccounts(env,session.actor),configured:true,signup:accountSignupConfiguration(env)},200,cookies);
    if(!session.actor)throw new AccountError('Sign in to open your maps.',401);
    const participant=request.headers.get('X-Harmonious-Participant'),grantVersion=Number(request.headers.get('X-Harmonious-Grant-Version'));
    const facilitation=new FacilitationAPI(store,auth,env,session.actor);
    if(path.startsWith('/api/facilitation')||participant){
      if(!capabilities.facilitationCapable)throw new AccountError('Refresh Harmonious before using facilitation.',409);
      if(participant){
        if(path==='/api/workspace'&&request.method==='GET'){const data=await facilitation.workspace(participant,grantVersion);requireCompatibleWorkspace(data.workspace,capabilities);return accountResponse(data,200,cookies);}
        if(path==='/api/comparisons'&&request.method==='POST'){const input=await accountBody(request,4096);return accountResponse(await facilitation.command('comparison',{...input,participantId:participant,grantVersion}),200,cookies);}
        if(!path.startsWith('/api/facilitation/'))throw new AccountError('Exit facilitation to use your account controls.',403);
      }
      if(path==='/api/facilitation'&&request.method==='GET')return accountResponse(await facilitation.list(),200,cookies);
      if(path.startsWith('/api/facilitation/')&&request.method==='POST')return accountResponse(await facilitation.command(path.slice('/api/facilitation/'.length),await accountBody(request)),200,cookies);
      throw new AccountError('Not found.',404);
    }
    if(path==='/api/admin/test-accounts'&&request.method==='GET')return accountResponse(await currentTestAccountNames(store,await new TestAccounts(auth).list(session.actor,Number(new URL(request.url).searchParams.get('page')||1))),200,cookies);
    if(path==='/api/admin/test-accounts'&&request.method==='POST')return accountResponse(await new TestAccounts(auth).create(session.actor,await accountBody(request,4096)),201,cookies);
    if(path==='/api/admin/test-accounts/reset'&&request.method==='POST')return accountResponse(await currentTestAccountNames(store,await new TestAccounts(auth).reset(session.actor,await accountBody(request,4096))),200,cookies);
    if(path==='/api/maps/delete'&&request.method==='POST')return accountResponse(await deleteAccountMap(store,session.actor,await accountBody(request,4096)),200,cookies);
    if(path==='/api/workspace'&&request.method==='GET'){
      const data=await accountWorkspace(store,session.actor,capabilities);
      if(!data.workspace.maps.length&&!declared.includes(MAP_DELETION_CAPABILITY)){
        const error=new AccountError('Refresh Harmonious to open your empty map library. Your unsaved work is still on this page.',409);error.code='CLIENT_UPDATE_REQUIRED';error.requiredCapability=MAP_DELETION_CAPABILITY;throw error;
      }
      return accountResponse(data,200,cookies);
    }
    if(path==='/api/comparisons'&&request.method==='POST')return accountResponse(await startAccountComparison(store,session.actor.id,await accountBody(request,4096),capabilities),200,cookies);
    if(path==='/api/workspace'&&request.method==='PUT'){const input=await accountBody(request);return accountResponse(await saveAccountChanges(store,session.actor.id,input.changes,capabilities),200,cookies);}
    throw new AccountError('Not found.',404);
  }catch(error){return accountResponse({error:error instanceof AccountError?error.message:'The service is temporarily unavailable. Your unsaved work is still on this page.',...(error.code==='CLIENT_UPDATE_REQUIRED'?{code:error.code,requiredCapability:error.requiredCapability}:{})},error.status||503,cookies);}
}
