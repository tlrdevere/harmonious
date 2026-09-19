import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {recordComparison,validateWorkspace} from '../dist/workspace.mjs';
import {saveArgumentNode,saveArgumentEdge,argumentNodeRef,argumentNeedsReview} from '../dist/argument.mjs';
import {layoutArgument} from '../dist/argument-canvas.mjs';
import {validateAccountChanges,projectAccountWorkspace} from '../worker/account-policy.mjs';
import {alice,bob,memoryStore,seedActor,edit,view,addNode} from './accounts.test.mjs';

export async function exerciseArguments(store){
  let a,b,an,bn,proposalId,groundId,evidenceId,rebuttalId,edgeId;
  await edit(store,alice,w=>{an=addNode(w,alice,'Argument source A').id;a=w.maps.find(m=>m.ownerId===alice.id);a.visibility='shared';});
  await edit(store,bob,w=>{bn=addNode(w,bob,'Argument source B').id;b=w.maps.find(m=>m.ownerId===bob.id);b.visibility='shared';});
  await edit(store,alice,w=>{const p=recordComparison(w,{aMapId:a.id,bMapId:b.id,aNodeId:an,bNodeId:bn,question:'How should we decide?',questionStatus:'matched',answerStatus:'divergent'},null,alice.id);proposalId=p.id;w.comparisons.push(p);});
  const context=w=>{const p=w.comparisons.find(p=>p.id===proposalId);return {comparisonId:p.comparisonId,proposalId,proposalRevision:p.proposalVersions.at(-1).revision};};
  const originalMaps=structuredClone((await view(store,alice)).workspace.maps);
  // A node and its connection commit together, with nodes inserted before edges.
  await edit(store,alice,w=>{
    const ground=saveArgumentNode(w,{...context(w),kind:'ground',title:'Consider consequences',body:'Start with the likely effects.'},alice.id);groundId=ground.id;w.argumentNodes.push(ground);
    const evidence=saveArgumentNode(w,{...context(w),kind:'evidence',title:'A relevant study',sourceUrl:'https://example.org/study'},alice.id);evidenceId=evidence.id;w.argumentNodes.push(evidence);
    w.argumentEdges.push(saveArgumentEdge(w,{...context(w),from:argumentNodeRef(w,ground.id),to:{type:'source',side:'a'},relation:'supports'},alice.id));
    w.argumentEdges.push(saveArgumentEdge(w,{...context(w),from:argumentNodeRef(w,evidence.id),to:argumentNodeRef(w,ground.id),relation:'evidence_for'},alice.id));
  });
  await edit(store,bob,w=>{
    assert(w.argumentNodes.some(n=>n.id===groundId));
    const rebuttal=saveArgumentNode(w,{...context(w),kind:'ground',title:'Effects are uncertain'},bob.id);rebuttalId=rebuttal.id;w.argumentNodes.push(rebuttal);
    const edge=saveArgumentEdge(w,{...context(w),from:argumentNodeRef(w,rebuttal.id),to:argumentNodeRef(w,groundId),relation:'rebuts'},bob.id);edgeId=edge.id;w.argumentEdges.push(edge);
    const value=saveArgumentNode(w,{...context(w),kind:'value',title:'Fairness matters'},bob.id);w.argumentNodes.push(value);
    w.argumentEdges.push(saveArgumentEdge(w,{...context(w),from:argumentNodeRef(w,value.id),to:{type:'source',side:'b'},relation:'supports'},bob.id));
  });
  let w=(await view(store,alice)).workspace;
  const independent=saveArgumentNode(w,{...context(w),kind:'value',title:'An independent contribution'},alice.id);
  await edit(store,bob,current=>{current.argumentNodes.push(saveArgumentNode(current,{...context(current),kind:'value',title:'Added from another browser'},bob.id));});
  const afterOtherWrite=await store.snapshot(),independentRequest=[{kind:'argument_node',id:independent.id,expectedRevision:0,value:independent}];
  validateAccountChanges(afterOtherWrite,alice.id,independentRequest);await store.commit(alice.id,afterOtherWrite.revision,independentRequest);
  w=(await view(store,alice)).workspace;assert(w.argumentNodes.some(n=>n.title==='Added from another browser'));assert(w.argumentNodes.some(n=>n.id===independent.id),'Independent contributions must not overwrite each other');
  assert(w.argumentNodes.some(n=>n.id===rebuttalId));assert.deepEqual(w.maps,originalMaps,'Reasoning must leave source maps unchanged');
  assert.deepEqual(validateWorkspace(JSON.parse(JSON.stringify(w))).argumentNodes,w.argumentNodes);
  const saved=await store.snapshot(),ground=w.argumentNodes.find(n=>n.id===groundId),stored=saved.records.find(r=>r.kind==='argument_node'&&r.id===groundId);
  const request=value=>[{kind:'argument_node',id:groundId,expectedRevision:stored.revision,value}];
  assert.throws(()=>validateAccountChanges(saved,bob.id,request({...ground,title:'Forged'})),e=>e.status===403);
  const honest=saveArgumentNode(w,{...ground,title:'Consider longer-term consequences'},alice.id,ground);
  const forged=structuredClone(honest);forged.history[0].title='Rewritten past';
  assert.throws(()=>validateAccountChanges(saved,alice.id,request(forged)),/Earlier reasoning/);
  assert.throws(()=>saveArgumentNode(w,{...context(w),kind:'evidence',title:'Unsafe URL',sourceUrl:'javascript:alert(1)'},alice.id),/HTTPS/);
  const edgeInput={...context(w),from:argumentNodeRef(w,groundId),to:argumentNodeRef(w,evidenceId),relation:'evidence_for'};
  assert.throws(()=>saveArgumentEdge(w,edgeInput,alice.id),/start at evidence/);
  assert.throws(()=>saveArgumentEdge(w,{...edgeInput,relation:'supports',to:argumentNodeRef(w,groundId)},alice.id),/itself/);
  assert.throws(()=>saveArgumentEdge(w,{...edgeInput,relation:'supports'},bob.id),/your own reasoning/);
  const duplicated=structuredClone(w);duplicated.argumentEdges.push({...duplicated.argumentEdges.find(e=>e.id===edgeId),id:'duplicate-edge'});assert.throws(()=>validateWorkspace(duplicated),/already exists/);
  const privateSnapshot=structuredClone(saved);privateSnapshot.records.find(r=>r.kind==='map'&&r.id===a.id).value.visibility='private';
  assert(!projectAccountWorkspace(privateSnapshot,bob.id).workspace.argumentNodes.some(n=>n.proposalId===proposalId),'Hidden proposals must hide their reasoning too');
  await edit(store,alice,w=>{w.argumentNodes=w.argumentNodes.map(n=>n.id===groundId?honest:n);});
  w=(await view(store,bob)).workspace;let edge=w.argumentEdges.find(e=>e.id===edgeId);
  assert(argumentNeedsReview(w,edge),'Editing a target does not silently adopt new wording for someone else');assert.equal(edge.to.version,1);
  await edit(store,bob,w=>{const old=w.argumentEdges.find(e=>e.id===edgeId);w.argumentEdges=w.argumentEdges.map(e=>e.id===edgeId?saveArgumentEdge(w,{...old,to:argumentNodeRef(w,groundId)},bob.id,old):e);});
  w=(await view(store,bob)).workspace;edge=w.argumentEdges.find(e=>e.id===edgeId);assert(!argumentNeedsReview(w,edge));assert.equal(edge.to.version,2);assert.equal(edge.history[0].to.version,1);
  // Withdrawal and its inverse are new versions; links and old wording survive.
  await edit(store,alice,w=>{const old=w.argumentNodes.find(n=>n.id===groundId);w.argumentNodes=w.argumentNodes.map(n=>n.id===groundId?saveArgumentNode(w,{...old,status:'withdrawn'},alice.id,old):n);});
  w=(await view(store,bob)).workspace;assert(argumentNeedsReview(w,w.argumentEdges.find(e=>e.id===edgeId)));
  await edit(store,alice,w=>{const old=w.argumentNodes.find(n=>n.id===groundId);w.argumentNodes=w.argumentNodes.map(n=>n.id===groundId?saveArgumentNode(w,{...old,status:'active'},alice.id,old):n);});
  w=(await view(store,alice)).workspace;assert.equal(w.argumentNodes.find(n=>n.id===groundId).history.length,3);
  await edit(store,alice,w=>{const old=w.comparisons.find(p=>p.id===proposalId);w.comparisons=w.comparisons.map(p=>p.id===proposalId?recordComparison(w,{...old,question:'How should we decide under uncertainty?'},old,alice.id):p);});
  w=(await view(store,alice)).workspace;const previous=w.argumentNodes.find(n=>n.id===groundId);assert(argumentNeedsReview(w,previous));
  assert.throws(()=>saveArgumentNode(w,{...previous,title:'Rewrite old context'},alice.id,previous),/Review the current sources/);
  const newer=saveArgumentNode(w,{...context(w),kind:'ground',title:'A new version reason'},alice.id);w.argumentNodes.push(newer);
  assert.throws(()=>saveArgumentEdge(w,{...context(w),from:argumentNodeRef(w,newer.id),to:argumentNodeRef(w,groundId),relation:'supports'},alice.id),/one proposal version/);
  const anchors={a:{x:100,y:200},b:{x:110,y:210}},positions=layoutArgument(w.argumentNodes,{x:0,y:0,width:1000,height:900},anchors,[alice.id,bob.id]);
  assert.deepEqual(positions.get('source:a'),anchors.a);assert.deepEqual(positions.get('source:b'),anchors.b);
  const cards=[...positions.entries()].filter(([id])=>id.startsWith('node:')).map(([,p])=>p);
  for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++)assert(Math.abs(cards[i].x-cards[j].x)>=252||Math.abs(cards[i].y-cards[j].y)>=166,'Reasoning cards must not overlap');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const store=memoryStore();await seedActor(store,alice);await seedActor(store,bob);await exerciseArguments(store);console.log('Shared Argument, author boundaries, pinned links, revision history, withdrawal, privacy and layout passed.');}
