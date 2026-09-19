import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {clientAssets} from './client-assets.mjs';
const origin='https://harmonious-beta.tlrdevere.workers.dev';
const get=path=>fetch(origin+path,{cache:'no-store',signal:AbortSignal.timeout(20000)});
for(const [path,asset] of Object.entries(await clientAssets())){const response=await get(path);assert.equal(response.status,200,path);assert.equal(await response.text(),asset.body,path+' must match this checkout');console.log(path+': matches local build');}
const home=await get('/'),html=await home.text();assert.equal(home.status,200);assert(html.includes('library.css')&&html.includes('beta-boot.mjs'));assert(home.headers.get('content-security-policy').includes("script-src 'self'"));
const session=await get('/api/session'),state=await session.json();assert.equal(session.status,200);assert.equal(state.configured,true);assert.equal(state.actor,null);
assert.equal((await get('/api/workspace')).status,401);assert.equal((await get('/.dev.vars')).status,404);
const bundle=await readFile('build/cloudflare/worker.mjs');console.log('Local Worker SHA-256: '+createHash('sha256').update(bundle).digest('hex'));
console.log('Live release verified: exact frontend assets, homepage, configured sign-in, account gate, private configuration path and security headers.');
