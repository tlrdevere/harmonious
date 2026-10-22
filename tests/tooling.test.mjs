import assert from 'node:assert/strict';
import {cpSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {delimiter,dirname,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {runInNewContext} from 'node:vm';

// Exercise the real consumers of the scoped esbuild override. These tools are
// not part of the deployed app, so application tests alone cannot check them.
const require=createRequire(import.meta.url),root=resolve('.');
const loaderRequire=createRequire(require.resolve('@esbuild-kit/core-utils'));
assert.equal(loaderRequire('esbuild').version,require('esbuild').version,'The legacy loader must resolve the patched, pinned builder');
const {transform,transformSync}=require('@esbuild-kit/core-utils');
const fixture='type Input = { value?: number }; const input: Input = { value: 41 }; export const answer: number = (input.value ?? 0) + 1;';
const common=transformSync(fixture,join(root,'fixture.cts'));
const exports={},module={exports};runInNewContext(common.code,{exports,module});assert.equal(module.exports.answer,42);
const esm=await transform(fixture,join(root,'fixture.mts'));
assert.equal((await import('data:text/javascript;base64,'+Buffer.from(esm.code).toString('base64'))).answer,42);
assert(common.map&&esm.map,'Both loader paths retain source maps');

mkdirSync('build',{recursive:true});const temp=mkdtempSync(resolve('build/tooling-check-'));
cpSync('drizzle',join(temp,'migrations'),{recursive:true});
writeFileSync(join(temp,'schema.ts'),readFileSync('db/schema.ts'));
writeFileSync(join(temp,'drizzle.config.ts'),readFileSync('drizzle.config.ts','utf8').replace('./db/schema.ts','./schema.ts').replace("out:'./drizzle'","out:'./migrations'"));
const env={...process.env,WRANGLER_SEND_METRICS:'false',CI:'true'};
const pathKey=Object.keys(env).find(k=>k.toLowerCase()==='path')||'PATH';env[pathKey]=dirname(process.execPath)+delimiter+(env[pathKey]||'');
function cli(file,args,cwd=root){
 const r=spawnSync(process.execPath,[file,...args],{cwd,env,encoding:'utf8',windowsHide:true,timeout:120000});
 assert.equal(r.status,0,`${file}: ${r.error?.message||''}\n${r.stdout}\n${r.stderr}`);return r.stdout+r.stderr;
}
const drizzle=resolve('node_modules/drizzle-kit/bin.cjs');
const files=()=>readdirSync(join(temp,'migrations')).filter(f=>f.endsWith('.sql')).sort();
const original=files();cli(drizzle,['generate','--config=drizzle.config.ts'],temp);
assert.deepEqual(files(),original,'Unchanged schema must not generate a migration');
writeFileSync(join(temp,'schema.ts'),readFileSync(join(temp,'schema.ts'),'utf8')+"\nexport const maintenanceProbe = sqliteTable('maintenance_probe', { id: integer('id').primaryKey(), label: text('label').notNull() });\n");
cli(drizzle,['generate','--config=drizzle.config.ts','--name=tooling_probe'],temp);
assert.equal(files().length,original.length+1,'A real schema addition must generate one migration');
const db=new DatabaseSync(':memory:');
try{
 for(const name of files())db.exec(readFileSync(join(temp,'migrations',name),'utf8'));
 db.exec("INSERT INTO maintenance_probe (id,label) VALUES (1,'works')");
 assert.equal(db.prepare('SELECT label FROM maintenance_probe WHERE id=1').get().label,'works');
 assert.equal(db.prepare('SELECT count(*) AS n FROM workspaces').get().n,0);
}finally{db.close();}

// A dry run checks the actual deployment config and packaging without sign-in,
// uploading a version, or contacting the production database.
const output=join(temp,'worker');
cli(resolve('node_modules/wrangler/bin/wrangler.js'),['deploy','--dry-run','--outdir',output]);
assert(readdirSync(output).some(f=>f.endsWith('.js')||f.endsWith('.mjs')),'Deployment dry run emits a Worker');
console.log('Tooling checks passed: patched loader sync/async TypeScript, unchanged-schema stability, executable SQLite migration, and Cloudflare deployment dry run.');
