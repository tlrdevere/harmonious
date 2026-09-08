import {AccountError,initialAccountChanges,projectAccountWorkspace,validateAccountChanges} from './account-policy.mjs';
import {AccountAuth,accountConfiguration,requireAccountOrigin,accountBody} from './account-auth.mjs';
import {SupabaseStore} from './supabase-store.mjs';
const accountResponse=(data,status=200,cookies=[])=>{const headers=new Headers({'cache-control':'no-store','x-content-type-options':'nosniff'});for(const cookie of cookies)headers.append('set-cookie',cookie);return Response.json(data,{status,headers});};
export async function accountWorkspace(store,actor){
  for(let attempt=0;attempt<4;attempt++){
    const snapshot=await store.snapshot();
    if(snapshot.records.some(r=>r.kind==='profile'&&r.id===actor.id))return {...projectAccountWorkspace(snapshot,actor.id),actor:{id:actor.id,name:snapshot.records.find(r=>r.kind==='profile'&&r.id===actor.id).value.name}};
    const changes=initialAccountChanges(actor);validateAccountChanges(snapshot,actor.id,changes);
    try{await store.commit(actor.id,snapshot.revision,changes);}catch(error){if(error.snapshotChanged)continue;throw error;}
  }
  throw new AccountError('Your account is being opened in another session. Please try again.',409);
}
export async function saveAccountChanges(store,actorId,changes){
  for(let attempt=0;attempt<4;attempt++){
    const snapshot=await store.snapshot(),accepted=validateAccountChanges(snapshot,actorId,changes);
    try{return await store.commit(actorId,snapshot.revision,accepted);}catch(error){if(error.snapshotChanged)continue;throw error;}
  }
  throw new AccountError('Several changes arrived at once. Please try saving again.',409);
}
export async function handleAccountAPI(request,env,dependencies={}){
  const path=new URL(request.url).pathname;let cookies=[];
  if(!accountConfiguration(env))return accountResponse({error:'Sign-in is being set up. Please return soon.',configured:false},503);
  const auth=dependencies.auth||new AccountAuth(env),store=dependencies.store||new SupabaseStore(env);
  try{
    if(new URL(request.url).origin!==env.APP_ORIGIN)throw new AccountError('Use the configured Harmonious address.',403);
    if(!['GET','POST','PUT'].includes(request.method))throw new AccountError('Method not allowed.',405);
    if(request.method!=='GET')requireAccountOrigin(request,env);
    if(path==='/api/auth/code'&&request.method==='POST')return accountResponse(await auth.requestCode(await accountBody(request,4096)));
    if(path==='/api/auth/verify'&&request.method==='POST'){const session=await auth.verifyCode(await accountBody(request,4096));cookies=session.cookies;return accountResponse({signedIn:true},200,cookies);}
    if(path==='/api/auth/logout'&&request.method==='POST')return accountResponse({signedIn:false},200,await auth.logout(request));
    const session=await auth.identify(request);cookies=session.cookies;
    if(path==='/api/session'&&request.method==='GET')return accountResponse({actor:session.actor?{id:session.actor.id,name:session.actor.name}:null,configured:true},200,cookies);
    if(!session.actor)throw new AccountError('Sign in to open your maps.',401);
    if(path==='/api/workspace'&&request.method==='GET')return accountResponse(await accountWorkspace(store,session.actor),200,cookies);
    if(path==='/api/workspace'&&request.method==='PUT'){const input=await accountBody(request);return accountResponse(await saveAccountChanges(store,session.actor.id,input.changes),200,cookies);}
    throw new AccountError('Not found.',404);
  }catch(error){return accountResponse({error:error instanceof AccountError?error.message:'The service is temporarily unavailable. Your unsaved work is still on this page.'},error.status||503,cookies);}
}
