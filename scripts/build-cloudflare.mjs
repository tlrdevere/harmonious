import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import {clientAssets} from './client-assets.mjs';
const assets=await clientAssets();
const entry=`import {handleAccountAPI} from './worker/account-api.mjs';\nconst betaAssets=${JSON.stringify(assets)};
export default {async fetch(request,env){
  const url=new URL(request.url);let response;
  if(url.pathname.startsWith('/api/'))response=await handleAccountAPI(request,env);
  else {const asset=betaAssets[url.pathname];if(!asset)response=new Response('Not found',{status:404});
    else if(!['GET','HEAD'].includes(request.method))response=new Response('Method not allowed',{status:405});
    else response=new Response(request.method==='HEAD'?null:asset.body,{headers:{'content-type':asset.type,'cache-control':'no-cache'}});}
  const headers=new Headers(response.headers);
  headers.set('x-content-type-options','nosniff');headers.set('referrer-policy','no-referrer');headers.set('x-frame-options','DENY');
  headers.set('content-security-policy',"default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  if(url.protocol==='https:')headers.set('strict-transport-security','max-age=31536000');
  return new Response(response.body,{status:response.status,headers});
}};\n`;
const result=await build({stdin:{contents:entry,resolveDir:process.cwd(),sourcefile:'cloudflare-entry.mjs'},bundle:true,format:'esm',platform:'browser',target:'es2022',write:false});
const output=result.outputFiles[0].text;
execFileSync('node',['--check','--input-type=module'],{input:output});await mkdir('build/cloudflare',{recursive:true});await writeFile('build/cloudflare/worker.mjs',output);
console.log('Independent Cloudflare Worker built with account APIs and all frontend assets.');
