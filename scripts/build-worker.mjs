import {readFile,mkdir,writeFile,cp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import {clientAssets} from './client-assets.mjs';
// This is the earlier Sites demo, not the independent account deployment.
// Check configuration before writing any output.
try{await readFile('.openai/hosting.json','utf8');}catch(error){
  if(error.code!=='ENOENT')throw error;
  throw Error('The Sites demo requires .openai/hosting.json. For the independent beta, run npm run build.');
}
const assets=await clientAssets({accounts:false});
const entry=`import {handleAPI} from './worker/api.mjs';\nconst siteAssets=${JSON.stringify(assets)};\nexport default {async fetch(request,env){const pathname=new URL(request.url).pathname;if(pathname.startsWith('/api/'))return handleAPI(request,env);const asset=siteAssets[pathname];if(!asset)return new Response('Not found',{status:404});if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});return new Response(request.method==='HEAD'?null:asset.body,{headers:{'content-type':asset.type,'cache-control':'no-cache','x-content-type-options':'nosniff'}});}};\n`;
// Follow actual imports, including the conversation model, rather than a manual module list.
const result=await build({stdin:{contents:entry,resolveDir:process.cwd(),sourcefile:'sites-entry.mjs'},bundle:true,format:'esm',platform:'browser',target:'es2022',write:false});
const output=result.outputFiles[0].text;
execFileSync(process.execPath,['--check','--input-type=module'],{input:output});
await mkdir('dist/server',{recursive:true});await writeFile('dist/server/index.js',output);
await mkdir('dist/.openai',{recursive:true});await cp('.openai/hosting.json','dist/.openai/hosting.json');await cp('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Worker, frontend assets, and database migrations built.');
