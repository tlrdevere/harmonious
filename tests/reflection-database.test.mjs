import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {alice,bob,seedActor,edit,view} from './accounts.test.mjs';
import {startAccountComparison} from '../worker/account-api.mjs';
import {createOwnedMap,synchronizeIdeas} from '../dist/adoption.mjs';
import {exampleMap} from '../dist/data.mjs';
import {makeDiscussion,discussionSnapshots} from '../dist/discussion.mjs';
import {capturePremise} from '../dist/premise.mjs';

const revised=(record,patch={})=>{const copy=structuredClone(record),{history,...prior}=structuredClone(record);return {...copy,...patch,version:record.version+1,history:[...history,prior],updatedAt:new Date().toISOString()};};
const entry=r=>({type:'entry',entryId:r.id});
const change=(value,expectedRevision=0)=>({kind:'discussion',id:value.id,expectedRevision,value});

export async function exerciseReflectionDatabaseBoundary(store){
  const maps={},refs={};
  for(const actor of [alice,bob])await edit(store,actor,ws=>{const map=createOwnedMap(ws,{name:`Reflection SQL fixture ${actor.name}`,ownerId:actor.id});maps[actor.name]=map.id;map.visibility='shared';for(const title of [actor.name,`${actor.name} premise`]){const node={...exampleMap().find(n=>n.parent!==null),id:`reflection-source-${crypto.randomUUID()}`,parent:'status',kind:'position',title,summary:'',details:''};delete node.ideaId;delete node.ideaVersion;map.nodes.push(node);refs[title]={type:'node',mapId:map.id,nodeId:node.id};}map.relations.push({id:`reflection-edge-${actor.name}`,from:refs[actor.name].nodeId,to:refs[`${actor.name} premise`].nodeId,type:'related'});synchronizeIdeas(ws,map);});
  const thread=(await startAccountComparison(store,alice.id,{aMapId:maps.Alice,bMapId:maps.Bob})).comparisonThread;
  const workspace=async actor=>(await view(store,actor||alice)).workspace;
  const fresh=async(actor,input)=>makeDiscussion(await workspace(actor),{comparisonId:thread.id,...input},actor.id);
  const point=(actor,target,extra={})=>fresh(actor,{kind:'reflection',action:'disagreement_point',layer:'arguments',target,body:'We differ on the weight of this claim.',reflection:{category:'facts'},...extra});
  const outcome=(actor,parent,extra={})=>fresh(actor,{kind:'reflection',action:'outcome',layer:'arguments',target:entry(parent),body:'I understand the distinction and still need more evidence.',reflection:{result:'more_work',nextStep:'Review the cited source together.'},...extra});
  const save=async(value,actor=value.authorId===bob.id?bob:alice)=>{const snap=await store.snapshot(),row=snap.records.find(r=>r.kind==='discussion'&&r.id===value.id);await store.commit(actor.id,snap.revision,[change(value,row?.revision||0)]);return value;};
  const rejects=async(value,pattern,actor=value.authorId===bob.id?bob:alice)=>{const snap=await store.snapshot(),row=snap.records.find(r=>r.kind==='discussion'&&r.id===value.id);await assert.rejects(()=>store.commit(actor.id,snap.revision,[change(value,row?.revision||0)]),pattern);assert.deepEqual(await store.snapshot(),snap,'Rejected reflection writes preserve the entire account snapshot');};
  for(const label of ['z','A'])await edit(store,bob,ws=>{const context=makeDiscussion(ws,{kind:'context',action:'context',target:refs.Bob,body:`Explicit source context ${label}`},bob.id);context.id=`reflection-context-${label}-${crypto.randomUUID()}`;ws.discussions.push(context);});
  let ws=await workspace(),reason=await save(makeDiscussion(ws,{comparisonId:thread.id,kind:'argument',action:'reason',target:refs.Alice,body:'Alice premise',premise:capturePremise(ws,refs['Alice premise'])},alice.id));
  const challenge=await save(await fresh(bob,{kind:'argument',action:'challenge',target:entry(reason),body:'A pre-existing challenge remains separate.'}));
  const response=await save(await fresh(alice,{kind:'reply',action:'reply',target:entry(challenge),layer:'arguments',body:'A response that makes its own claim.'}));
  const before=await store.snapshot();let primary=await save(await point(alice,refs.Bob));
  for(const target of [refs.Alice,entry(reason),entry(response),{type:'inference',entryId:reason.id},{type:'edge',mapId:maps.Bob,edgeId:'reflection-edge-Bob'},{type:'edge',mapId:maps.Bob,edgeId:`structure:${refs.Bob.nodeId}`}])await save(await point(bob,target,{reflection:{category:''}}));
  const after=await store.snapshot();assert.deepEqual(after.records.filter(r=>r.kind==='map'),before.records.filter(r=>r.kind==='map'),'Marking a disagreement never rewrites either source map');assert.deepEqual(after.records.find(r=>r.id===challenge.id),before.records.find(r=>r.id===challenge.id),'Marking a disagreement does not resolve or alter a challenge');
  let mine=await save(await outcome(alice,primary)),theirs=await save(await outcome(bob,primary,{reflection:{result:'difference_understood',nextStep:''}}));
  const duplicate={...mine,id:`discussion-${crypto.randomUUID()}`};await rejects(duplicate,/already have an outcome/);
  mine=await save(revised(mine,{body:'I have changed how I describe my position.',reflection:{result:'changed_position',nextStep:''}}));assert.equal(mine.history[0].reflection.result,'more_work');
  const invalid=await point(alice,refs.Bob);
  for(const reflection of [null,{},[],{category:'unknown'},{category:'facts',extra:'unexpected'},{result:'more_work',nextStep:''}])await rejects({...invalid,reflection},/reflection metadata|disagreement category/);
  for(const body of ['', '   ','x'.repeat(10001)])await rejects({...invalid,body},/Invalid reflection contribution/);
  for(const [key,value]of [['premise',null],['adoption',null],['definitionRefs',[]],['referenceUrl','https://example.test']])await rejects({...invalid,[key]:value},/reflection contribution|saved premise|adoption|definition references/);
  await rejects({...invalid,layer:'inquiries'},/reflection contribution/);
  await rejects({...invalid,other:refs.Alice},/reflection contribution/);
  await rejects({...invalid,target:{type:'node',mapId:maps.Bob,nodeId:'status'}},/ordinary node/);
  await rejects({...invalid,target:entry(challenge)},/position, reason/);
  await rejects({...invalid,target:entry(primary)},/Only an individual outcome/);
  const badOutcome={...invalid,action:'outcome',reflection:{result:'more_work',nextStep:''}};await rejects(badOutcome,/active disagreement point/);
  for(const reflection of [{result:'false-consensus',nextStep:''},{result:'more_work'},{result:'more_work',nextStep:'x'.repeat(2001)},{result:'',nextStep:'',extra:1}])await rejects({...badOutcome,target:entry(primary),reflection},/individual outcome/);
  await rejects(revised(primary,{action:'outcome',reflection:{result:'',nextStep:''}}),/action cannot change/);
  await rejects(revised(primary,{target:refs.Alice}),/identity/);
  await rejects({...invalid,authorId:bob.id},/author/,alice);
  await rejects(revised(mine,{body:'Edited by the other participant'}),/another account|permission|owned|owner|Forbidden|author/i,bob);
  const forgedSnapshot=structuredClone(invalid);forgedSnapshot.sourceSnapshots[0].wording.title='Invented source wording';await rejects(forgedSnapshot,/snapshot must capture/);
  await rejects({...invalid,reviewedSources:forgedSnapshot.sourceSnapshots},/snapshot must capture/);
  const past=revised(mine);past.history[0].body='Rewritten past';await rejects(past,/remain in history/);
  const changedSource=revised(primary);changedSource.sourceSnapshots[0].wording.title='Changed original';await rejects(changedSource,/remain in history/);
  const changedAction=revised(primary);changedAction.history[0].action='outcome';await rejects(changedAction,/remain in history/);
  const unsavedStep=revised(primary,{body:'An unsaved wording step.'}),forgedIntermediate=revised(unsavedStep,{body:'Final wording.'});forgedIntermediate.history.at(-1).sourceSnapshots[0].wording.title='Invented intermediate source';await rejects(forgedIntermediate,/original source snapshot/);
  // Generic conversations may not be attached beneath either note kind.
  for(const parent of [primary,mine])for(const kind of ['argument','inquiry','reply']){const generic={...invalid,id:`discussion-${crypto.randomUUID()}`,kind,action:kind==='argument'?'challenge':kind==='reply'?'reply':'question',layer:kind==='reply'?'inquiries':null,target:entry(parent)};delete generic.reflection;await rejects(generic,/Only an individual outcome/);}
  const metadataOnPlain={...challenge,id:`discussion-${crypto.randomUUID()}`,reflection:{category:'facts'}};await rejects(metadataOnPlain,/belongs only/);
  // New points/outcomes in one ordered transaction see the final point snapshot.
  ws=await workspace();const batchPoint=makeDiscussion(ws,{comparisonId:thread.id,kind:'reflection',action:'disagreement_point',layer:'arguments',target:refs.Alice,body:'A distinct point.',reflection:{category:'values'}},alice.id);ws.discussions.push(batchPoint);const batchOutcome=makeDiscussion(ws,{comparisonId:thread.id,kind:'reflection',action:'outcome',layer:'arguments',target:entry(batchPoint),body:'My assessment.',reflection:{result:'',nextStep:''}},alice.id);
  let snap=await store.snapshot();await store.commit(alice.id,snap.revision,[change(batchPoint),change(batchOutcome)]);
  const twinPoint=await point(alice,refs.Alice);ws=await workspace();ws.discussions.push(twinPoint);const twinA={...batchOutcome,id:`discussion-${crypto.randomUUID()}`,target:entry(twinPoint)};twinA.sourceSnapshots=discussionSnapshots(ws,twinA);const twinB={...twinA,id:`discussion-${crypto.randomUUID()}`};snap=await store.snapshot();await assert.rejects(()=>store.commit(alice.id,snap.revision,[change(twinPoint),change(twinA),change(twinB)]),/already have an outcome/);assert.deepEqual(await store.snapshot(),snap,'Invalid multi-record outcomes roll back atomically');
  // Withdrawing an outcome permits a fresh authored assessment; restoring the
  // earlier record while that replacement is active must not create duplicates.
  theirs=await save(revised(theirs,{status:'withdrawn'}));const replacement=await save(await outcome(bob,primary,{reflection:{result:'',nextStep:''}}));await rejects(revised(theirs,{status:'active'}),/already have an outcome/);
  await edit(store,bob,w=>{const map=w.maps.find(m=>m.id===maps.Bob);map.nodes.find(n=>n.id===refs.Bob.nodeId).summary='Updated source';synchronizeIdeas(w,map);});
  primary=await save(revised(primary,{body:'Reworded disagreement after the source changed.'}));assert.equal(primary.history[0].body,'We differ on the weight of this claim.');
  ws=await workspace();const review=revised(primary);review.reviewedSources=discussionSnapshots(ws,review);primary=await save(review);
  const reviewForgery=revised(primary);reviewForgery.reviewedSources[0].wording.summary='Not the current source';await rejects(reviewForgery,/snapshot must capture/);
  const erasedReview=revised(primary);delete erasedReview.reviewedSources;await rejects(erasedReview,/snapshot must capture/);
  // No source availability is inferred from a still-active direct parent.
  const nestedPoint=await point(bob,entry(response));
  await edit(store,alice,w=>{const map=w.maps.find(m=>m.id===maps.Alice);map.nodes=map.nodes.filter(n=>n.id!==refs['Alice premise'].nodeId);map.relations=[];});await rejects(nestedPoint,/Ancestor source position unavailable/);
  const pendingOutcome={...replacement,id:`discussion-${crypto.randomUUID()}`,authorId:alice.id};
  await edit(store,bob,w=>{const map=w.maps.find(m=>m.id===maps.Bob);map.nodes=map.nodes.filter(n=>n.id!==refs.Bob.nodeId);map.relations=[];});
  await rejects(revised(primary,{body:'Disguised unavailable edit'}),/source.*unavailable/i);await rejects(pendingOutcome,/source.*unavailable/i);
  await rejects(revised(primary,{status:'withdrawn',body:'Disguised withdrawal edit'}),/source.*unavailable/i);
  await edit(store,bob,w=>{w.maps.find(m=>m.id===maps.Bob).visibility='private';});
  assert(!(await workspace(alice)).discussions.some(r=>r.id===primary.id),'Revoking a compared map hides both its points and assessments');
  await rejects(revised(primary,{status:'withdrawn'}),/Both comparison maps/);
  await edit(store,bob,w=>{w.maps.find(m=>m.id===maps.Bob).visibility='shared';});
  primary=await save(revised(primary,{status:'withdrawn'}));mine=await save(revised(mine,{status:'withdrawn'}));await save(revised(replacement,{status:'withdrawn'}));
  assert.equal(mine.status,'withdrawn');assert.deepEqual(mine.history.at(-1).reflection,{result:'changed_position',nextStep:''});
  console.log('Direct PostgreSQL disagreement targets, independent outcomes, exact source/history, duplicates, ancestry, privacy, rollback and narrow withdrawal passed.');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {PGlite}=await import('@electric-sql/pglite'),{readFile,readdir}=await import('node:fs/promises'),db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users(id)values('${alice.id}'),('${bob.id}');`);
  for(const file of(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
  const rows=(await db.query("select proname,prosecdef,has_function_privilege('anon',oid,'EXECUTE') as anon,has_function_privilege('authenticated',oid,'EXECUTE') as authenticated,has_function_privilege('service_role',oid,'EXECUTE') as service from pg_proc where proname=any($1)",[['harmonious_reflection_snapshot','harmonious_reflection_identity','harmonious_reflection_complete']])).rows;
  assert.equal(rows.length,3);assert(rows.every(r=>!r.prosecdef&&!r.anon&&!r.authenticated&&r.service));
  await db.exec('set role service_role');const store={async snapshot(){return(await db.query('select public.harmonious_snapshot() as data')).rows[0].data;},async commit(actor,generation,changes){return(await db.query('select public.harmonious_commit($1::uuid,$2::bigint,$3::jsonb) as data',[actor,generation,JSON.stringify(changes)])).rows[0].data;}};
  for(const actor of [alice,bob])await seedActor(store,actor);await exerciseReflectionDatabaseBoundary(store);
 }finally{await db.close();}
}
