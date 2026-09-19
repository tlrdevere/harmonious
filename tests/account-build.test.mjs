import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {clientFiles,clientAssets} from '../scripts/client-assets.mjs';
import worker from '../build/cloudflare/worker.mjs';
const origin='https://harmonious.example',env={APP_ORIGIN:origin,SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_never_in_a_response',BETA_INVITE_EMAILS:'alice@example.test'};
const get=path=>worker.fetch(new Request(origin+path),env);
const htmlResponse=await get('/'),html=await htmlResponse.text();assert.equal(htmlResponse.status,200);assert(html.includes('beta-boot.mjs'));assert(html.includes('accounts.css'));assert(!html.includes('sb_secret_never_in_a_response'));
assert(html.includes('Overall comparisons'));assert(html.includes('comparison-back'));
assert(htmlResponse.headers.get('content-security-policy').includes("script-src 'self'"));assert.equal(htmlResponse.headers.get('x-frame-options'),'DENY');
for(const [path,asset] of Object.entries(await clientAssets())){const response=await get(path);assert.equal(response.status,200,path);const body=await response.text();assert.equal(body,asset.body,path+' must match the current source');for(const match of body.matchAll(/from ['"]\.\/([^'"]+)['"]/g))assert(clientFiles.includes(match[1]),`${path} imports a missing module: ${match[1]}`);assert(!body.includes('sb_secret_never_in_a_response'));}
assert.equal((await get('/api/workspace')).status,401);assert.equal((await (await get('/api/session')).json()).actor,null);assert.equal((await get('/.dev.vars')).status,404);assert.equal((await get('/.openai/hosting.json')).status,404);
const unconfigured=await worker.fetch(new Request(origin+'/api/session'),{});assert.equal(unconfigured.status,503);
const source=await readFile('build/cloudflare/worker.mjs','utf8');assert(!source.includes('appgprj_'),'Independent build has no Sites identity');
console.log('Independent Worker routing, complete module graph, account gate, private configuration, and response headers passed.');
