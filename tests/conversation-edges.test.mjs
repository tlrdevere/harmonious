import assert from 'node:assert/strict';
import {groupSourceConnections,groupComparisonConnections,projectComparisonConnections} from '../dist/conversation-tree.mjs';
import {comparisonEndpoint,layoutComparison} from '../dist/comparison-layout.mjs';
const structural={id:'structure:example',from:'parent',to:'example',structural:true},illustration={id:'illustration',from:'example',to:'parent',type:'illustrative'};
const source=groupSourceConnections([structural,illustration,{id:'other',from:'parent',to:'different'}]);
assert.equal(source.length,2);assert.deepEqual(source[0],[structural,illustration],'Reverse direction and different meanings share a line without losing details');
const a={mapId:'a',nodeId:'n'},b={mapId:'b',nodeId:'n'},c={mapId:'b',nodeId:'child'};
const records=[{id:'counterpart',target:a,other:b},{id:'agreement',target:b,other:a},{id:'disagreement',target:a,other:b},{id:'legacy',legacy:true,target:a,other:b},{id:'descendant',target:a,other:c}];
const endpoint=t=>({status:'visible',key:JSON.stringify([t.mapId,t.nodeId]),visibleId:t.nodeId,mapId:t.mapId,nodeId:t.nodeId,proxy:false});
const expanded=groupComparisonConnections(records,endpoint);assert.equal(expanded.length,2);assert.equal(expanded.find(g=>g.records.some(r=>r.id==='counterpart')).records.length,4);
const collapse=t=>t.nodeId==='child'?{...endpoint(t),status:'collapsed',visibleId:'n',key:JSON.stringify([t.mapId,'n']),proxy:true}:endpoint(t);
const collapsed=projectComparisonConnections(records,collapse);assert.equal(collapsed.groups.length,2,'Actual pairs are never merged by a displayed ancestor');assert.equal(collapsed.visible.length,1);assert.equal(collapsed.visible[0].records.length,4,'Only the genuine visible pair contributes to its edge');assert.equal(collapsed.branches.length,1);assert.equal(collapsed.branches[0].groups.length,1);assert.equal(collapsed.branches[0].groups[0].records[0].id,'descendant');
const hidden=[...records,{id:'second-hidden-meaning',target:c,other:a},{id:'second-hidden-pair',target:{mapId:'a',nodeId:'child'},other:c}];
const both=projectComparisonConnections(hidden,collapse);assert.equal(both.branches.find(g=>g.endpoint.mapId==='b').groups.length,2,'Counts distinct pairs, not meanings');assert.equal(both.branches.find(g=>g.endpoint.mapId==='a').groups.length,1);assert.equal(both.groups.length,3,'Two access points do not duplicate the connection');
for(const status of ['filtered','missing','unavailable']){
  const projection=projectComparisonConnections(hidden,t=>t.mapId==='a'?{...endpoint(t),status}:collapse(t));
  assert.equal(projection.visible.length,0);assert.equal(projection.branches.length,0,`A ${status} endpoint does not become a collapsed-branch claim`);assert(projection.groups.every(g=>g.status===status));
}
assert.deepEqual(projectComparisonConnections([...hidden].reverse(),collapse).groups.map(g=>g.key),both.groups.map(g=>g.key),'Stable pair order is independent of fetched record order');
const roots=['status','action','goal'],map={id:'map',nodes:[...roots.map(id=>({id,parent:null})),{id:'parent',parent:'status'},{id:'child',parent:'parent'}]};
const states={a:{map,frame:'all',expanded:new Set(['status'])},b:{map:null}};
const layout=layoutComparison(states,roots);
assert.equal(comparisonEndpoint(layout,'a','parent').status,'visible');
assert.deepEqual(Object.fromEntries(['status','proxy','visibleId','nodeId'].map(k=>[k,comparisonEndpoint(layout,'a','child')[k]])),{status:'collapsed',proxy:true,visibleId:'parent',nodeId:'child'});
assert.equal(comparisonEndpoint(layout,'a','deleted').status,'missing');
states.a.frame='goal';assert.equal(comparisonEndpoint(layoutComparison(states,roots),'a','child').status,'filtered');
layout.maps.a.map={...map,unavailable:true};assert.equal(comparisonEndpoint(layout,'a','child').status,'unavailable');
console.log('Single-edge projection passed: exact pairs, multiple meanings, truthful collapsed branch counts, mixed visibility, retained records and source status.');
