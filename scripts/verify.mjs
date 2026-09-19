import {spawn,spawnSync} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {access,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {delimiter,dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url),args=process.argv.slice(2);
if(args.some(arg=>!['--list','--preflight','--help'].includes(arg))||args.length>1){console.error('Usage: node scripts/verify.mjs [--list | --preflight | --help]');process.exit(2);}
if(args[0]==='--help'){
  console.log('Run every release check with installed Node, Python 3 and Playwright. No npm executable is required.\n--list lists checks; --preflight checks runtimes without running tests.\nOptional environment: HARMONIOUS_PYTHON, HARMONIOUS_PLAYWRIGHT (filesystem path), HARMONIOUS_BROWSER.');
  process.exit(0);
}
const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
function testFiles(name){
  const script=pkg.scripts?.[name];if(!script)throw Error(`Missing package script: ${name}`);
  return script.split(/\s*&&\s*/).map(command=>{
    const match=/^node\s+(tests\/[a-zA-Z0-9._/-]+\.mjs)$/.exec(command.trim());
    if(!match||match[1].split('/').includes('..'))throw Error(`Unsupported command in ${name}: ${command}. Register plain "node tests/example.test.mjs" entries so verification does not execute a shell.`);
    return match[1];
  });
}
const registeredBrowsers=testFiles('test:browser');
const discoveredBrowsers=(await readdir(join(root,'tests'))).filter(name=>name.endsWith('-browser.test.mjs')).sort().map(name=>'tests/'+name);
const stages=[
  ...testFiles('test').map(file=>({group:'application',file})),
  ...testFiles('test:accounts').map(file=>({group:'accounts',file})),
  {group:'portable',file:'scripts/export-standalone.py'},
  ...[...new Set([...registeredBrowsers,...discoveredBrowsers])].map(file=>({group:'browser',file})),
  {group:'build',file:'scripts/build-cloudflare.mjs'},
  {group:'build',file:'tests/account-build.test.mjs'}
];
if(args[0]==='--list'){
  for(const [index,stage]of stages.entries())console.log(`${String(index+1).padStart(2,'0')} ${stage.group.padEnd(11)} ${stage.file}`);
  console.log(`${stages.length} checks. Browser discovery includes future *-browser.test.mjs walkthroughs.`);process.exit(0);
}

const startedAt=new Date().toISOString(),runId=startedAt.replace(/[:.]/g,'-')+'-'+process.pid;
const reportDir=join(root,'build','verification',runId);
await mkdir(reportDir,{recursive:true});
const report={startedAt,mode:args[0]==='--preflight'?'preflight':'full',status:'running',runtime:{},checks:stages.map(s=>({...s,status:'not_run'}))};
const env={...process.env,WRANGLER_SEND_METRICS:'false'};
const pathKey=Object.keys(env).find(key=>key.toLowerCase()==='path')||'PATH';
env[pathKey]=dirname(process.execPath)+delimiter+(env[pathKey]||'');
// Python's exporter invokes "node" itself, so all child checks use this runtime.
function pythonRuntime(){
  const requested=env.HARMONIOUS_PYTHON;
  const candidates=requested?[{command:requested,args:[]}]:process.platform==='win32'?[{command:'python',args:[]},{command:'py',args:['-3']}]:[{command:'python3',args:[]},{command:'python',args:[]}];
  for(const candidate of candidates){
    const result=spawnSync(candidate.command,[...candidate.args,'--version'],{cwd:root,env,encoding:'utf8',windowsHide:true,timeout:10000});
    const version=(result.stdout||result.stderr||'').trim();
    if(result.status===0&&/^Python 3\./.test(version))return {...candidate,version};
  }
  throw Error('Python 3 is unavailable. Set HARMONIOUS_PYTHON to its executable path; no packages are needed for the portable exporter.');
}
async function preflight(){
  if(Number(process.versions.node.split('.')[0])<20)throw Error('Use Node 20 or newer (Node 24 is the release-check runtime).');
  for(const stage of stages)await access(join(root,stage.file));
  for(const name of ['esbuild','@electric-sql/pglite']){
    try{require.resolve(name);}catch{throw Error(`Missing installed dependency: ${name}. Install the locked development dependencies before verification.`);}
  }
  const python=pythonRuntime();
  let playwright=env.HARMONIOUS_PLAYWRIGHT;
  if(playwright?.startsWith('file:'))throw Error('HARMONIOUS_PLAYWRIGHT must be a filesystem path, not a file URL.');
  if(!playwright){
    try{playwright=join(dirname(require.resolve('playwright/package.json')),'index.mjs');}
    catch{throw Error('Playwright is unavailable. Install the pinned development dependency or set HARMONIOUS_PLAYWRIGHT to an existing playwright/index.mjs filesystem path.');}
  }
  playwright=resolve(root,playwright);await access(playwright);
  const metadata=JSON.parse(await readFile(join(dirname(playwright),'package.json'),'utf8'));
  if(metadata.name!=='playwright')throw Error('HARMONIOUS_PLAYWRIGHT must point to the Playwright package entry point.');
  const expected=pkg.devDependencies?.playwright;
  if(expected&&metadata.version!==expected)throw Error(`Playwright ${metadata.version} differs from the pinned ${expected}. Use the locked version so the local and hosted checks match.`);
  env.HARMONIOUS_PLAYWRIGHT=playwright;
  env.HARMONIOUS_BROWSER=env.HARMONIOUS_BROWSER||(process.platform==='win32'?'msedge':'chromium');
  report.runtime={node:process.version,python:python.version,playwright:metadata.version,browser:env.HARMONIOUS_BROWSER,platform:process.platform};
  const {chromium}=await import(pathToFileURL(playwright));
  let browser;
  try{browser=await chromium.launch({headless:true,channel:env.HARMONIOUS_BROWSER});}
  catch(error){throw Error(`Cannot launch ${env.HARMONIOUS_BROWSER}. Install that browser before running verification. ${error.message}`);}
  finally{if(browser)await browser.close();}
  console.log(`Runtimes ready: Node ${process.versions.node}; ${python.version}; Playwright ${metadata.version}; ${env.HARMONIOUS_BROWSER}.`);
  return python;
}
async function run(stage,index,python){
  const entry=report.checks[index],logName=`${String(index+1).padStart(2,'0')}-${stage.file.replace(/[^a-zA-Z0-9.-]/g,'-')}.log`;
  entry.status='running';entry.startedAt=new Date().toISOString();entry.log=logName;
  const isPython=stage.file.endsWith('.py'),command=isPython?python.command:process.execPath;
  const commandArgs=isPython?[...python.args,stage.file]:[stage.file];
  console.log(`\n[${index+1}/${stages.length}] ${stage.file}`);
  const started=performance.now(),log=createWriteStream(join(reportDir,logName));
  const result=await new Promise(resolveRun=>{
    const child=spawn(command,commandArgs,{cwd:root,env,stdio:['ignore','pipe','pipe'],windowsHide:true,shell:false});
    let failure=null,timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');},10*60*1000);
    child.stdout.on('data',chunk=>{process.stdout.write(chunk);log.write(chunk);});
    child.stderr.on('data',chunk=>{process.stderr.write(chunk);log.write(chunk);});
    child.on('error',error=>{failure=error.message;log.write(error.message+'\n');});
    child.on('close',(code,signal)=>{clearTimeout(timer);log.end(()=>resolveRun({code,signal,failure,timedOut}));});
  });
  Object.assign(entry,{status:result.code===0&&!result.timedOut?'passed':'failed',durationMs:Math.round(performance.now()-started),exitCode:result.code,signal:result.signal});
  if(result.failure)entry.error=result.failure;
  if(result.timedOut)entry.error='Check exceeded the 10-minute limit.';
  if(entry.status!=='passed')throw Error(`${stage.file} failed${entry.error?': '+entry.error:'.'} See ${join(reportDir,logName)}.`);
}
try{
  const python=await preflight();
  if(report.mode==='full')for(const [index,stage]of stages.entries())await run(stage,index,python);
  report.status='passed';
  console.log(report.mode==='full'?`\nAll ${stages.length} release checks passed.`:'Preflight passed. No application checks were run.');
}catch(error){report.status='failed';report.error=error.message;console.error('\nVerification failed: '+error.message);process.exitCode=1;}
finally{
  report.completedAt=new Date().toISOString();await writeFile(join(reportDir,'summary.json'),JSON.stringify(report,null,2)+'\n');
  const passed=report.checks.filter(check=>check.status==='passed').length;
  const summary=`## Harmonious ${report.mode==='full'?'release checks':'preflight'}\n\nStatus: **${report.status}**. ${passed}/${stages.length} checks passed.\n\n${report.error?report.error+'\n\n':''}Diagnostic logs: \`build/verification/${runId}/\`.\n`;
  await writeFile(join(reportDir,'summary.md'),summary);
  if(env.GITHUB_STEP_SUMMARY)await writeFile(env.GITHUB_STEP_SUMMARY,summary,{flag:'a'});
  console.log('Verification report: '+join(reportDir,'summary.json'));
}
