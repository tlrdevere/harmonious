import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const clientFiles=['index.html','style.css','accounts.css','layout.mjs','data.mjs','model.mjs','account-model.mjs','account-ui.mjs','account-challenge.mjs','adoption.mjs','workspace.mjs','comparison-layout.mjs','compare-canvas.mjs','participation-ui.mjs','workspace-ui.mjs','app.mjs','beta-boot.mjs'];
const assets={};
for(const file of clientFiles){let body=await readFile(`dist/${file}`,'utf8');if(file==='index.html')body=body.replace('</head>','<link rel="stylesheet" href="./accounts.css"></head>').replace('src="./app.mjs"','src="./beta-boot.mjs"');assets[`/${file}`]={body,type:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'};}
assets['/']=assets['/index.html'];
const paths=['dist/account-model.mjs','dist/layout.mjs','dist/model.mjs','dist/data.mjs','dist/adoption.mjs','dist/workspace.mjs','worker/account-policy.mjs','worker/account-auth.mjs','worker/supabase-store.mjs','worker/account-api.mjs'];
const parts=[];for(const path of paths)parts.push((await readFile(path,'utf8')).replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,''));
const output=parts.join('\n')+`\nconst betaAssets=${JSON.stringify(assets)};
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
execFileSync('node',['--check','--input-type=module'],{input:output});await mkdir('build/cloudflare',{recursive:true});await writeFile('build/cloudflare/worker.mjs',output);
console.log('Independent Cloudflare Worker built with account APIs and all frontend assets.');

