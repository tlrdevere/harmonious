import {AccountError,initialAccountChanges,projectAccountWorkspace,validateAccountChanges} from './account-policy.mjs';
import {AccountAuth,accountConfiguration,accountSignupConfiguration,requireAccountOrigin,accountBody} from './account-auth.mjs';
import {SupabaseStore} from './supabase-store.mjs';
import {startComparisonThread,comparisonPairKey} from '../dist/workspace.mjs';
const accountResponse=(data,status=200,cookies=[])=>{const headers=new Headers({'cache-control':'no-store','x-content-type-options':'nosniff'});for(const cookie of cookies)headers.append('set-cookie',cookie);return Response.json(data,{status,headers});};
export const REASONING_CAPABILITY='comparison-reasoning-v1';
export function requiresReasoningCapability(discussions){return discussions.some(record=>[record,...(Array.isArray(record?.history)?record.history:[])].some(r=>r&&(r.kind==='argument'&&r.action==='reason'||r.target?.type==='inference'||r.other?.type==='inference'||r.kind!=='context'&&r.definitionRefs!==undefined)));}
function requireCompatibleWorkspace(workspace,reasoningCapable,changes=[]){
  if(!reasoningCapable&&(requiresReasoningCapability(workspace.discussions)||requiresReasoningCapability(Array.isArray(changes)?changes.filter(c=>c?.kind==='discussion'&&c.value).map(c=>c.value):[]))){
    const error=new AccountError('This comparison uses a newer version of Harmonious. Keep this page open to download your unsaved work, then reopen Harmonious in a new tab. Your drafts have not been discarded.',409);error.code='CLIENT_UPDATE_REQUIRED';throw error;
  }
}
export async function accountWorkspace(store,actor,{reasoningCapable=true}={}){
  for(let attempt=0;attempt<4;attempt++){
    const snapshot=await store.snapshot();
    if(snapshot.records.some(r=>r.kind==='profile'&&r.id===actor.id)){
      const result=projectAccountWorkspace(snapshot,actor.id);requireCompatibleWorkspace(result.workspace,reasoningCapable);
      // An unaffected older client still receives the envelope it understands.
      if(!reasoningCapable)result.workspace.schemaVersion=2;
      return {...result,actor:{id:actor.id,name:snapshot.records.find(r=>r.kind==='profile'&&r.id===actor.id).value.name}};
    }
    const changes=initialAccountChanges(actor);validateAccountChanges(snapshot,actor.id,changes);
    try{await store.commit(actor.id,snapshot.revision,changes);}catch(error){if(error.snapshotChanged)continue;throw error;}
  }
  throw new AccountError('Your account is being opened in another session. Please try again.',409);
}
export async function saveAccountChanges(store,actorId,changes,{reasoningCapable=true}={}){
  for(let attempt=0;attempt<4;attempt++){
    const snapshot=await store.snapshot();requireCompatibleWorkspace(projectAccountWorkspace(snapshot,actorId).workspace,reasoningCapable,changes);
    const accepted=validateAccountChanges(snapshot,actorId,changes);
    try{return await store.commit(actorId,snapshot.revision,accepted);}catch(error){if(error.snapshotChanged)continue;throw error;}
  }
  throw new AccountError('Several changes arrived at once. Please try saving again.',409);
}
export async function startAccountComparison(store,actorId,input,{reasoningCapable=true}={}){
  if(typeof input?.aMapId!=='string'||typeof input?.bMapId!=='string')throw new AccountError('Choose two maps.');
  for(let attempt=0;attempt<4;attempt++){
    const snapshot=await store.snapshot(),view=projectAccountWorkspace(snapshot,actorId),sources=[input.aMapId,input.bMapId].map(id=>view.workspace.maps.find(map=>map.id===id&&!map.unavailable));
    requireCompatibleWorkspace(view.workspace,reasoningCapable);
    if(!sources.every(Boolean)||sources[0].id===sources[1].id||!sources.some(map=>map.ownerId===actorId))throw new AccountError('Choose one of your maps and another visible map.',403);
    const existing=snapshot.records.find(record=>record.kind==='comparison_thread'&&comparisonPairKey(record.value)===comparisonPairKey(input));
    if(existing)return {comparisonThread:existing.value,revision:existing.revision};
    const thread=startComparisonThread(view.workspace,input.aMapId,input.bMapId,actorId),changes=[{kind:'comparison_thread',id:thread.id,expectedRevision:0,value:thread}];
    const accepted=validateAccountChanges(snapshot,actorId,changes);
    try{await store.commit(actorId,snapshot.revision,accepted);return {comparisonThread:thread,revision:1};}catch(error){if(error.snapshotChanged)continue;throw error;}
  }
  throw new AccountError('This comparison is being opened in another session. Try again.',409);
}
export async function handleAccountAPI(request,env,dependencies={}){
  const path=new URL(request.url).pathname,capabilities={reasoningCapable:(request.headers.get('X-Harmonious-Capabilities')||'').split(/[\s,]+/).includes(REASONING_CAPABILITY)};let cookies=[];
  if(!accountConfiguration(env))return accountResponse({error:'Sign-in is being set up. Please return soon.',configured:false},503);
  const auth=dependencies.auth||new AccountAuth(env),store=dependencies.store||new SupabaseStore(env);
  try{
    if(new URL(request.url).origin!==env.APP_ORIGIN)throw new AccountError('Use the configured Harmonious address.',403);
    if(!['GET','POST','PUT'].includes(request.method))throw new AccountError('Method not allowed.',405);
    if(request.method!=='GET')requireAccountOrigin(request,env);
    if(path==='/api/auth/code'&&request.method==='POST')return accountResponse(await auth.requestCode(await accountBody(request,4096),request));
    if(path==='/api/auth/verify'&&request.method==='POST'){const session=await auth.verifyCode(await accountBody(request,4096));cookies=session.cookies;return accountResponse({signedIn:true},200,cookies);}
    if(path==='/api/auth/logout'&&request.method==='POST')return accountResponse({signedIn:false},200,await auth.logout(request));
    const session=await auth.identify(request);cookies=session.cookies;
    if(path==='/api/session'&&request.method==='GET')return accountResponse({actor:session.actor?{id:session.actor.id,name:session.actor.name}:null,configured:true,signup:accountSignupConfiguration(env)},200,cookies);
    if(!session.actor)throw new AccountError('Sign in to open your maps.',401);
    if(path==='/api/workspace'&&request.method==='GET')return accountResponse(await accountWorkspace(store,session.actor,capabilities),200,cookies);
    if(path==='/api/comparisons'&&request.method==='POST')return accountResponse(await startAccountComparison(store,session.actor.id,await accountBody(request,4096),capabilities),200,cookies);
    if(path==='/api/workspace'&&request.method==='PUT'){const input=await accountBody(request);return accountResponse(await saveAccountChanges(store,session.actor.id,input.changes,capabilities),200,cookies);}
    throw new AccountError('Not found.',404);
  }catch(error){return accountResponse({error:error instanceof AccountError?error.message:'The service is temporarily unavailable. Your unsaved work is still on this page.',...(error.code==='CLIENT_UPDATE_REQUIRED'?{code:error.code,requiredCapability:REASONING_CAPABILITY}:{})},error.status||503,cookies);}
}
