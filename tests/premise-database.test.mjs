import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {alice,bob,seedActor,edit,view} from './accounts.test.mjs';
import {startAccountComparison} from '../worker/account-api.mjs';
import {createOwnedMap,synchronizeIdeas} from '../dist/adoption.mjs';
import {exampleMap} from '../dist/data.mjs';
import {makeDiscussion} from '../dist/discussion.mjs';
import {capturePremise} from '../dist/premise.mjs';
import {makeDefinition,definitionReference,definitionReferenceText} from '../dist/definitions.mjs';

const revised=(record,patch={})=>{const copy=structuredClone(record),{history,...prior}=copy;return {...copy,...patch,version:record.version+1,history:[...history,prior],updatedAt:new Date().toISOString()};};
const entry=record=>({type:'entry',entryId:record.id});
const change=(value,revision=0)=>({kind:'discussion',id:value.id,expectedRevision:revision,value});

// Deliberately bypass validateAccountChanges: these assertions exercise the
// service-only PostgreSQL boundary, including atomic deferred checks.
export async function exercisePremiseDatabaseBoundary(store){
  const refs={},maps={};
  for(const actor of [alice,bob])await edit(store,actor,ws=>{
    const map=createOwnedMap(ws,{name:`SQL premise fixture ${actor.name}`,ownerId:actor.id});map.visibility='shared';maps[actor.name]=map.id;
    const titles=actor===alice?['Conclusion','Premise','Further','Other conclusion','History','Future','Other frame','Question']:['Foreign conclusion','Foreign alternative','Foreign action'];
    for(const title of titles){const node={...exampleMap().find(n=>n.parent!==null),id:`premise-sql-${crypto.randomUUID()}`,parent:title==='Other frame'||title==='Foreign action'?'action':'status',kind:title==='Question'?'question':'position',title,summary:'',details:'',timeScope:title==='History'?'history':title==='Future'?'likely_future':'present'};delete node.ideaId;delete node.ideaVersion;map.nodes.push(node);refs[title]={type:'node',mapId:map.id,nodeId:node.id};}
    if(actor===bob)map.relations.push({id:'sql-premise-same-frame',type:'related',from:refs['Foreign conclusion'].nodeId,to:refs['Foreign alternative'].nodeId},{id:'sql-premise-cross-frame',type:'motivates',from:refs['Foreign conclusion'].nodeId,to:refs['Foreign action'].nodeId});
    synchronizeIdeas(ws,map);
  });
  const thread=(await startAccountComparison(store,alice.id,{aMapId:maps.Alice,bMapId:maps.Bob})).comparisonThread;
  let definition,context;
  await edit(store,alice,ws=>{definition=makeDefinition(ws,{type:'definition',title:'SQL premise term',body:'Exact invoked meaning'},alice.id);ws.definitions.push(definition);const definitionRefs=[definitionReference(definition)];context=makeDiscussion(ws,{kind:'context',action:'context',target:refs.Premise,body:definitionReferenceText(definitionRefs),definitionRefs},alice.id);ws.discussions.push(context);});
  const workspace=async actor=>(await view(store,actor||alice)).workspace;
  const fresh=async(target,source,patch={})=>{const ws=await workspace(),premise=capturePremise(ws,source);return {...makeDiscussion(ws,{comparisonId:thread.id,kind:'argument',action:'reason',target,body:premise?.wording.title||'Plain reason'},alice.id),...(premise?{premise}:{}),...patch};};
  const save=async(value,actor=alice)=>{const snap=await store.snapshot(),row=snap.records.find(r=>r.kind==='discussion'&&r.id===value.id);await store.commit(actor.id,snap.revision,[change(value,row?.revision||0)]);return value;};
  const rejects=async(value,pattern,actor=alice)=>{const snap=await store.snapshot(),row=snap.records.find(r=>r.kind==='discussion'&&r.id===value.id);await assert.rejects(()=>store.commit(actor.id,snap.revision,[change(value,row?.revision||0)]),pattern);assert.deepEqual(await store.snapshot(),snap,'A rejected premise must not change records or revisions');};
  let reason=await save(await fresh(refs.Conclusion,refs.Premise));const original=structuredClone(reason.premise);
  assert.equal(original.contexts[0].definitionRefs[0].body,'Exact invoked meaning');
  await save(await fresh(refs['Other conclusion'],refs.History));await save(await fresh(refs['Other conclusion'],refs.Future));
  await rejects(await fresh(refs.Conclusion,refs.Premise),/already supports/);
  await rejects(await fresh(refs.Conclusion,refs.Conclusion),/support itself/);
  await rejects(await fresh(refs.Premise,refs.Conclusion),/cycle/);
  await rejects(await fresh(entry(reason),refs.Premise),/repeat within/);
  let child=await save(await fresh(entry(reason),refs.Further));
  await rejects(await fresh(refs.Conclusion,refs['Other frame']),/same comparison map and frame/);
  await rejects(await fresh(refs.Conclusion,refs['Foreign conclusion']),/own Position/);
  const valid=await fresh(refs.Conclusion,refs.Further);
  await rejects({...valid,body:'Forged claim'},/saved premise/);
  await rejects({...valid,premise:null},/saved premise/);
  await rejects({...valid,premise:{...valid.premise,extra:'hidden'}},/saved premise/);
  await rejects({...valid,kind:'inquiry',action:'question'},/saved premise/);
  await rejects({...valid,action:'challenge'},/saved premise/);
  await rejects({...valid,premise:{...valid.premise,ideaVersion:999}},/source position changed/);
  await rejects({...valid,premise:{...valid.premise,ideaId:'not-the-source'}},/source position changed/);
  await rejects({...valid,premise:{...valid.premise,wording:{...valid.premise.wording,title:'Forged title'}},body:'Forged title'},/source position changed/);
  await rejects({...valid,premise:{...valid.premise,contexts:original.contexts}},/source position changed/);
  const missingContext=await fresh(refs['Other conclusion'],refs.Premise);missingContext.premise.contexts=[];await rejects(missingContext,/source position changed/);
  const forgedContext=await fresh(refs['Other conclusion'],refs.Premise);forgedContext.premise.contexts[0].definitionRefs[0].body='Not invoked';await rejects(forgedContext,/source position changed/);
  await rejects({...valid,premise:{...valid.premise,nodeId:refs.Question.nodeId}},/unavailable/);
  await rejects({...valid,premise:{...valid.premise,nodeId:'status'}},/unavailable/);
  const plain=await save(await fresh(refs.Conclusion,{}));
  await rejects(revised(plain,{premise:valid.premise,body:valid.body}),/preserve its source placement/);
  const erased=revised(reason);delete erased.premise;await rejects(erased,/preserve its source placement/);
  await rejects(revised(reason,{premise:valid.premise,body:valid.body}),/preserve its source placement/);
  await rejects({...valid,authorId:bob.id},/own ordinary node|own Position/,bob);

  // A contextual reply is a separate claim, not an implied support dependency.
  const responseAt=async target=>{let ws=await workspace();const challenge=makeDiscussion(ws,{comparisonId:thread.id,kind:'argument',action:'challenge',target,body:'A challenge for the SQL fixture'},alice.id);await save(challenge);ws=await workspace();return save(makeDiscussion(ws,{comparisonId:thread.id,kind:'reply',action:'reply',layer:'arguments',target:entry(challenge),body:'An independent response'},alice.id));};
  const foreignReply=await responseAt(refs['Foreign conclusion']);await save(await fresh(entry(foreignReply),refs.Premise));
  const ownReply=await responseAt(entry(reason));await save(await fresh(entry(ownReply),refs.Conclusion));
  const edgeReply=await responseAt({type:'edge',mapId:maps.Bob,edgeId:'sql-premise-same-frame'});await save(await fresh(entry(edgeReply),refs.Premise));
  const crossReply=await responseAt({type:'edge',mapId:maps.Bob,edgeId:'sql-premise-cross-frame'});await rejects(await fresh(entry(crossReply),refs.Premise),/same comparison map and frame/);

  let outside;
  await edit(store,alice,ws=>{outside=createOwnedMap(ws,{name:'Outside premise comparison',ownerId:alice.id});outside.visibility='shared';const node={...structuredClone(ws.maps.find(m=>m.id===maps.Alice).nodes.find(n=>n.id===refs.Further.nodeId)),id:'outside-premise-position'};delete node.ideaId;delete node.ideaVersion;outside.nodes.push(node);synchronizeIdeas(ws,outside);});
  await rejects(await fresh(refs.Conclusion,{mapId:outside.id,nodeId:'outside-premise-position'}),/own Position/);
  const ownThread=(await startAccountComparison(store,alice.id,{aMapId:maps.Alice,bMapId:outside.id})).comparisonThread;
  const wrongOwnedMap=await fresh(refs.Conclusion,{mapId:outside.id,nodeId:'outside-premise-position'},{comparisonId:ownThread.id});await rejects(wrongOwnedMap,/same comparison map and frame/);

  // A new context saved later in the same atomic batch must be captured exactly.
  let ws=await workspace();const lateContext=makeDiscussion(ws,{kind:'context',action:'context',target:refs.Further,body:'Same transaction source context'},alice.id);ws.discussions.push(lateContext);
  const batched=makeDiscussion(ws,{comparisonId:thread.id,kind:'argument',action:'reason',target:refs['Other conclusion'],body:'Further'},alice.id);batched.premise=capturePremise(ws,refs.Further);
  let snap=await store.snapshot();await store.commit(alice.id,snap.revision,[change(batched),change(lateContext)]);
  assert.equal((await workspace()).discussions.find(r=>r.id===batched.id).premise.contexts[0].body,lateContext.body);
  // Both sides of a cycle are rejected together, even when neither existed yet.
  const cycleA=await fresh(refs.History,refs.Future),cycleB=await fresh(refs.Future,refs.History);snap=await store.snapshot();await assert.rejects(()=>store.commit(alice.id,snap.revision,[change(cycleA),change(cycleB)]),/cycle/);assert.deepEqual(await store.snapshot(),snap);

  await edit(store,alice,w=>{const map=w.maps.find(m=>m.id===maps.Alice);map.nodes.find(n=>n.id===refs.Premise.nodeId).summary='Changed current source';synchronizeIdeas(w,map);});
  assert.deepEqual((await workspace()).discussions.find(r=>r.id===reason.id).premise,original,'Source edits preserve pinned earlier wording');
  reason=await save(revised(reason,{referenceUrl:'https://example.org/pinned-source'}));
  ws=await workspace();const current=capturePremise(ws,refs.Premise);
  const fabricatedStep=revised(reason,{premise:{...current,wording:{...current.wording,title:'Fabricated intermediate'}},body:'Fabricated intermediate'});
  await rejects(revised(fabricatedStep,{premise:current,body:current.wording.title}),/New history/);
  const savedStep=revised(reason,{referenceUrl:'https://example.org/intermediate'});reason=await save(revised(savedStep,{premise:current,body:current.wording.title}));
  assert.deepEqual(reason.history[0].premise,original,'Exact old/current snapshots may be combined while earlier history remains intact');
  const tampered=revised(reason);tampered.history[0].premise.wording.summary='Rewritten past';await rejects(tampered,/remain in history/);
  const stale=await fresh(refs['Other conclusion'],refs.Premise);
  await edit(store,alice,w=>{const map=w.maps.find(m=>m.id===maps.Alice);map.nodes.find(n=>n.id===refs.Premise.nodeId).details='Changed after preview';synchronizeIdeas(w,map);});await rejects(stale,/source position changed/);
  ws=await workspace();
  const incoming=[await fresh(entry(child),{}),makeDiscussion(ws,{comparisonId:thread.id,kind:'argument',action:'challenge',target:entry(child),body:'Challenge below the reused source'},bob.id),makeDiscussion(ws,{comparisonId:thread.id,kind:'argument',action:'inference',target:{type:'inference',entryId:child.id},body:'Inference challenge below the reused source'},bob.id),makeDiscussion(ws,{comparisonId:thread.id,kind:'reply',action:'reply',target:entry(ownReply),layer:'arguments',body:'Another response'},bob.id)];
  // Different wording is still available: participants can discuss the pinned
  // version without a silent refresh. Availability is stricter than currency.
  for(const record of incoming)await save({...record,id:`discussion-${crypto.randomUUID()}`},record.authorId===alice.id?alice:bob);
  await edit(store,alice,w=>{const map=w.maps.find(m=>m.id===maps.Alice);map.nodes.find(n=>n.id===refs.Premise.nodeId).parent='action';synchronizeIdeas(w,map);});
  for(const record of incoming)await rejects(record,/Ancestor source position unavailable/,record.authorId===alice.id?alice:bob);
  await edit(store,alice,w=>{const map=w.maps.find(m=>m.id===maps.Alice);map.nodes.find(n=>n.id===refs.Premise.nodeId).parent='status';synchronizeIdeas(w,map);});
  await edit(store,alice,w=>{w.maps.find(m=>m.id===maps.Alice).nodes=w.maps.find(m=>m.id===maps.Alice).nodes.filter(n=>n.id!==refs.Premise.nodeId);});
  for(const record of incoming)await rejects(record,/Ancestor source position unavailable/,record.authorId===alice.id?alice:bob);
  await rejects(revised(ownReply,{body:'An edit with an unavailable upstream source'}),/Ancestor source position unavailable/);
  await rejects(revised(reason,{referenceUrl:'https://example.org/hidden-edit'}),/unavailable/);
  await rejects(revised(reason,{status:'withdrawn',referenceUrl:'https://example.org/disguised'}),/unavailable/);
  const corruptWithdrawal=revised(reason,{status:'withdrawn'});corruptWithdrawal.history[0].body='Altered history';await rejects(corruptWithdrawal,/remain in history/);
  await edit(store,bob,w=>{w.maps.find(m=>m.id===maps.Bob).visibility='private';});
  await rejects(revised(reason,{status:'withdrawn'}),/available|unavailable|comparison/);
  await edit(store,bob,w=>{w.maps.find(m=>m.id===maps.Bob).visibility='shared';});
  await save(revised(ownReply,{status:'withdrawn'}));
  reason=await save(revised(reason,{status:'withdrawn'}));child=await save(revised(child,{status:'withdrawn'}));
  assert.equal(reason.status,'withdrawn');assert.equal(child.status,'withdrawn');assert.deepEqual(reason.premise,current);
  console.log('Direct PostgreSQL premise ownership, exact context, history, complete batches, duplicates, cycles, source deletion and narrow withdrawal passed.');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const {PGlite}=await import('@electric-sql/pglite'),{readFile,readdir}=await import('node:fs/promises'),db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users(id)values('${alice.id}'),('${bob.id}');`);
    for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
    const functions=['harmonious_valid_premise','harmonious_premise_identity','harmonious_check_premise'];
    const permissions=(await db.query('select proname,prosecdef,has_function_privilege(\'anon\',oid,\'EXECUTE\') as anon,has_function_privilege(\'authenticated\',oid,\'EXECUTE\') as authenticated,has_function_privilege(\'service_role\',oid,\'EXECUTE\') as service from pg_proc where proname=any($1)',[functions])).rows;
    assert.equal(permissions.length,3);assert(permissions.every(p=>!p.prosecdef&&!p.anon&&!p.authenticated&&p.service));
    await db.exec('set role service_role');
    const store={async snapshot(){return(await db.query('select public.harmonious_snapshot() as data')).rows[0].data;},async commit(actor,generation,changes){return(await db.query('select public.harmonious_commit($1::uuid,$2::bigint,$3::jsonb) as data',[actor,generation,JSON.stringify(changes)])).rows[0].data;}};
    for(const actor of [alice,bob])await seedActor(store,actor);
    await exercisePremiseDatabaseBoundary(store);
  }finally{await db.close();}
}
