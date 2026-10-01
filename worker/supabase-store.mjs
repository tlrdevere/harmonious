import {AccountError} from './account-policy.mjs';
export class SupabaseStore{
  constructor(env,fetcher=(...args)=>fetch(...args)){this.env=env;this.fetcher=fetcher;}
  async rpc(name,input={}){
    const response=await this.fetcher(`${this.env.SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:this.env.SUPABASE_SECRET_KEY,'content-type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(15000)});
    const result=await response.json();
    if(!response.ok){const error=new AccountError(response.status===403?'Facilitation permission ended or changed.':response.status===409?'Changes arrived while saving. Please refresh and review again.':'Saved data is temporarily unavailable.',[400,403,409].includes(response.status)?response.status:503);error.snapshotChanged=result.message==='snapshot_changed';throw error;}
    return result;
  }
  facilitate(operator,manager,generation,command,input){return this.rpc('harmonious_facilitate',{p_operator:operator,p_manager:manager,p_generation:generation,p_command:command,p_input:input});}
  snapshot(){return this.rpc('harmonious_snapshot');}
  commit(actorId,generation,changes){return this.rpc('harmonious_commit',{p_actor:actorId,p_generation:generation,p_changes:changes});}
}
