import {AccountError} from './account-policy.mjs';
export class SupabaseStore{
  constructor(env,fetcher=fetch){this.env=env;this.fetcher=fetcher;}
  async rpc(name,input={}){
    const response=await this.fetcher(`${this.env.SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:this.env.SUPABASE_SECRET_KEY,'content-type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(15000)});
    const result=await response.json();
    if(!response.ok){const error=new AccountError(response.status===409?'Changes arrived while saving. Please try again.':'Saved data is temporarily unavailable.',response.status===409?409:503);error.snapshotChanged=result.message==='snapshot_changed';throw error;}
    return result;
  }
  snapshot(){return this.rpc('harmonious_snapshot');}
  commit(actorId,generation,changes){return this.rpc('harmonious_commit',{p_actor:actorId,p_generation:generation,p_changes:changes});}
}
