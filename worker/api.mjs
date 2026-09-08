import {validateWorkspace} from '../dist/workspace.mjs';
import {readWorkspace,writeWorkspace} from '../db/store.mjs';
const responseJSON=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
export async function handleAPI(request,env){
  if(new URL(request.url).pathname!=='/api/workspace')return responseJSON({error:'Not found.'},404);
  try{
    if(request.method==='GET')return responseJSON(await readWorkspace(env.DB));
    if(request.method!=='PUT')return responseJSON({error:'Method not allowed.'},405);
    const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return responseJSON({error:'Use the workspace from its own page.'},403);
    if(!request.headers.get('content-type')?.startsWith('application/json'))return responseJSON({error:'Expected a JSON workspace.'},415);
    const reader=request.body?.getReader();if(!reader)return responseJSON({error:'Missing workspace.'},400);
    let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2_000_000){await reader.cancel();return responseJSON({error:'This workspace exceeds the 2 MB prototype limit. Download a backup before reducing it.'},413);}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    let input;try{input=JSON.parse(new TextDecoder().decode(bytes));if(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)throw Error('Missing saved revision.');validateWorkspace(input.workspace);}catch(error){return responseJSON({error:error.message||'Invalid workspace.'},400);}
    const saved=await writeWorkspace(env.DB,input.workspace,input.expectedRevision);
    return saved?responseJSON(saved):responseJSON({error:'A newer workspace was saved in another session. Download your current work, then reopen the saved workspace before continuing.'},409);
  }catch(error){console.error('Workspace storage failure:',error.message);return responseJSON({error:'The saved workspace is unavailable. Your current work is still on this page; download a copy and try again.'},503);}
}
