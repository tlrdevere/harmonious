import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../build/cloudflare/worker.mjs';
const origin='https://harmonious.example',env={APP_ORIGIN:origin,SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_never_in_a_response',BETA_INVITE_EMAILS:'alice@example.test'};
const get=path=>worker.fetch(new Request(origin+path),env);
const htmlResponse=await get('/'),html=await htmlResponse.text();assert.equal(htmlResponse.status,200);assert(html.includes('beta-boot.mjs'));assert(html.includes('accounts.css'));assert(!html.includes('sb_secret_never_in_a_response'));
assert(htmlResponse.headers.get('content-security-policy').includes("script-src 'self'"));assert.equal(htmlResponse.headers.get('x-frame-options'),'DENY');
const files=['beta-boot.mjs','app.mjs','workspace-ui.mjs','account-ui.mjs','account-challenge.mjs','account-model.mjs','style.css','accounts.css','participation-ui.mjs','adoption.mjs','workspace.mjs','comparison-layout.mjs','compare-canvas.mjs','layout.mjs','data.mjs','model.mjs'];
for(const file of files){const response=await get('/'+file);assert.equal(response.status,200,file);const body=await response.text();for(const match of body.matchAll(/from ['"]\.\/([^'"]+)['"]/g))assert(files.includes(match[1]),`${file} imports a missing module: ${match[1]}`);assert(!body.includes('sb_secret_never_in_a_response'));}
assert.equal((await get('/api/workspace')).status,401);assert.equal((await (await get('/api/session')).json()).actor,null);assert.equal((await get('/.dev.vars')).status,404);assert.equal((await get('/.openai/hosting.json')).status,404);
const unconfigured=await worker.fetch(new Request(origin+'/api/session'),{});assert.equal(unconfigured.status,503);
const source=await readFile('build/cloudflare/worker.mjs','utf8');assert(!source.includes('appgprj_'),'Independent build has no Sites identity');
console.log('Independent Worker routing, complete module graph, account gate, private configuration, and response headers passed.');

