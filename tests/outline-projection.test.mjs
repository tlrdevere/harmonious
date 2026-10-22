import assert from 'node:assert/strict';
import {outlineMap,outlineConnections,outlineComparison,outlineDialogue} from '../dist/outline-projection.mjs';

const roots=['status','action','goal'];
const node=(id,parent,title=id,extra={})=>({id,parent,title,summary:'',details:'',structuralType:parent===null?null:'nesting',...extra});
const map=(id)=>({id,name:'Map '+id,ownerId:'owner-'+id,nodes:[...roots.map(id=>node(id,null)),node('topic','status','Topic'),node('child','topic','Child',{summary:'A unique full description',details:'Long context',confidence:0}),node('other','status','Other'),node('action-topic','action'),node('goal-topic','goal')],relations:[{id:'reason',from:'child',to:'topic',type:'reason'},{id:'cross',from:'topic',to:'action-topic',type:'addresses'},{id:'related',from:'other',to:'topic',type:'related'}]});
const a=map('a'),b=map('b'),original=JSON.stringify([a,b]);
b.nodes.find(node=>node.id==='child').parent='status';
const pair=(id,left='child',right='child',extra={})=>({id,kind:'correspondence',status:'active',createdAt:'2026-10-21T10:00:00Z',target:{type:'node',mapId:'a',nodeId:left},other:{type:'node',mapId:'b',nodeId:right},...extra});

const projection=outlineMap(a);
assert.deepEqual(projection.rows.map(row=>row.id),['status','topic','child','other','action','action-topic','goal','goal-topic']);
assert.equal(projection.byId.get('child').node,a.nodes.find(node=>node.id==='child'),'Shared commands keep the original node identity');
assert.deepEqual(projection.byId.get('child').ancestors,[{id:'status',title:'status'},{id:'topic',title:'Topic'}]);
assert.equal(projection.byId.get('child').topicId,'topic');
assert.equal(projection.byId.get('child').depth,2);
assert.deepEqual(outlineMap(a,{query:'FULL unique'}).rows.map(row=>row.id),['status','topic','child'],'Search reads full descriptions and retains only the needed ancestor context');
assert.equal(outlineMap(a,{query:'unique'}).byId.get('topic').context,true);
assert.deepEqual(outlineMap(a,{frame:'action'}).rows.map(row=>row.id),['action','action-topic']);
const scoped=outlineMap(a,{scopeIds:new Set(['topic','child'])});
assert.equal(scoped.excludedCount,3);assert(!scoped.rows.some(row=>row.id==='other'));
assert(outlineMap(a,{scopeIds:[JSON.stringify(['a','child'])]}).rows.some(row=>row.id==='child'),'Focus accepts globally unique map/node keys');
assert.equal(outlineMap(a,{scopeIds:[JSON.stringify(['b','child'])]}).byId.get('child').inScope,false,'The same ID in a second map cannot focus this node');

const connections=outlineConnections(a,'topic');
assert.equal(connections.length,5,'A structural connection and reason between the same endpoints remain separate');
assert(connections.some(row=>row.structural&&row.from.id==='status'&&row.to.id==='topic'));
assert(connections.some(row=>row.id==='reason'&&!row.structural&&row.from.id==='child'&&row.to.id==='topic'&&row.label==='Is a reason for'));
assert(connections.some(row=>row.id==='cross'&&row.directed&&row.forward==='Is addressed by'));
assert(connections.some(row=>row.id==='related'&&!row.directed));
assert.deepEqual(connections.find(row=>row.id==='reason').target,{type:'edge',mapId:'a',edgeId:'reason'});
assert(!outlineConnections({...a,relations:[...a.relations,{id:'bad',from:'child',to:'missing',type:'reason'}]}).some(row=>row.id==='bad'));

const unpaired=outlineComparison({a,b});
assert.equal(unpaired.groups.filter(group=>group.kind==='pair').length,0,'Identical wording and array order never imply a pair');
assert.equal(unpaired.groups.filter(group=>group.kind==='frame').length,3);
assert.equal(unpaired.groups.filter(group=>group.kind==='solo').length,10);
const links=[pair('explicit'),pair('legacy','child','other',{kind:'relationship'}),pair('cross-frame','other','action-topic'),pair('duplicate-record')];
const comparison=outlineComparison({a,b},links);
assert.equal(comparison.groups.filter(group=>group.kind==='pair').length,3,'Every legacy pairing remains readable, including many-to-one and cross-frame');
const explicit=comparison.groups.find(group=>group.records.some(record=>record.id==='explicit'));
assert.deepEqual(explicit.members.map(member=>member.ancestors.length),[2,1],'Counterparts preserve their own different parent chains');
assert.deepEqual(explicit.records.map(record=>record.id),['duplicate-record','explicit'],'Duplicate links for one actual pair share one group without erasing their records');
assert.equal(comparison.groups.find(group=>group.records.some(record=>record.id==='cross-frame')).crossFrame,true);
const filtered=outlineComparison({a,b},[pair('one')],{query:'unique'});
assert.equal(filtered.groups.length,1);assert.equal(filtered.groups[0].members.length,2,'Finding one member retains the other real counterpart for context');
assert.equal(outlineComparison({a,b},[pair('one'),{id:'undo',kind:'counterpart_unlink',status:'active',unlinkedRecordIds:['one']}]).groups.filter(group=>group.kind==='pair').length,0);
assert.equal(outlineComparison({a,b},[pair('withdrawn','child','child',{status:'withdrawn'})]).groups.filter(group=>group.kind==='pair').length,0);
assert.deepEqual(outlineComparison({a,b},links).groups.map(group=>group.id),outlineComparison({a,b},[...links].reverse()).groups.map(group=>group.id),'Link retrieval order does not change identity or list placement');
assert.equal(outlineComparison({a,b},[pair('other-map','child','child',{other:{type:'node',mapId:'elsewhere',nodeId:'child'}})]).groups.filter(group=>group.kind==='pair').length,0);

// A stale object may still hold wording. The unavailable/deleted marker wins.
for(const hidden of [{...b,unavailable:true},{...b,deletedAt:'2026-10-21'}]){
  hidden.name='HIDDEN MAP NAME';hidden.nodes=[node('status',null,'HIDDEN ROOT'),node('child','status','HIDDEN WORDING')];
  const result=outlineMap(hidden);assert.equal(result.available,false);assert.equal(result.rows.length,0);assert.equal(result.byId.size,0);assert(!JSON.stringify(result).includes('HIDDEN'));
  assert.equal(outlineConnections(hidden).length,0);
  const paired=outlineComparison({a,b:hidden},[pair('link')]);
  assert(!JSON.stringify(paired).includes('HIDDEN'),'Unavailable names and text never enter headings, breadcrumbs or connections');
  const solo=paired.groups.find(group=>group.members.some(member=>member.id==='child'));
  assert.equal(solo.kind,'solo');assert.equal(solo.unavailableCounterpart,true);assert.equal(solo.records.length,1,'Losing source access does not pretend a saved link never existed');
}
assert.equal(outlineMap(null).rows.length,0);
assert.equal(outlineComparison({a,b:null},[pair('missing-map')]).groups.filter(group=>group.kind==='pair').length,0);
assert(!outlineMap({...a,nodes:[...a.nodes,node('orphan','gone','Unavailable ancestry'),node('cycle1','cycle2'),node('cycle2','cycle1')]}).byId.has('orphan'),'Malformed or detached ancestry is not assigned an invented frame');

const records=[
  {id:'d',action:'dispute',createdAt:'01',interaction:{},status:'active'},
  {id:'r1',action:'respond',createdAt:'02',target:{entryId:'d'},interaction:{replyTo:{entryId:'d',version:2},placement:'above'}},
  {id:'r2',action:'respond',createdAt:'03',target:{entryId:'d'},interaction:{replyTo:{entryId:'d',version:2},placement:'below'}},
  {id:'r3',action:'respond',createdAt:'04',target:{entryId:'d'},interaction:{replyTo:{entryId:'r1',version:1},placement:'right'}},
  {id:'old',action:'respond',createdAt:'05',target:{entryId:'d'},interaction:{}},
  {id:'lost',action:'respond',createdAt:'06',target:{entryId:'d'},interaction:{replyTo:{entryId:'unavailable',version:4}}}
];
const dialogue=outlineDialogue(records),replies=new Map(dialogue.map(row=>[row.id,row]));
assert.deepEqual(replies.get('d').children,['r1','r2','old']);
assert.equal(replies.get('r2').targetId,'d','Chronological adjacency must not turn a sibling into a reply to the previous reply');
assert.equal(replies.get('r3').targetId,'r1');assert.equal(replies.get('r3').depth,3);
assert.equal(replies.get('r1').targetVersion,2);assert.equal(replies.get('r1').placement,'above');assert.equal(replies.get('r2').placement,'below');
assert.equal(replies.get('old').targetId,'d');assert.equal(replies.get('lost').targetAvailable,false);assert.equal(replies.get('lost').targetId,'unavailable');
assert.deepEqual(outlineDialogue([...records].reverse()).map(row=>row.id),dialogue.map(row=>row.id));
assert.equal(outlineDialogue([{id:'cycle',action:'respond',interaction:{replyTo:{entryId:'cycle'}}}]).length,1,'Malformed stored cycles cannot hang the outline');

// The projection should handle a long branch without recursive stack overflow
// or eagerly creating every ancestor array at every level.
const deep={id:'deep',nodes:[node('status',null)],relations:[]};
for(let i=0;i<10000;i++)deep.nodes.push(node('n'+i,i?'n'+(i-1):'status'));
const deepView=outlineMap(deep);assert.equal(deepView.rows.length,10001);assert.equal(deepView.byId.get('n9999').depth,10000);assert.equal(deepView.byId.get('n9999').ancestors.length,10000);
assert.equal(outlineComparison({a:deep,b:null}).groups.length,10001);
const deepReplies=[records[0]];for(let i=0;i<10000;i++)deepReplies.push({id:'q'+i,action:'respond',createdAt:String(i).padStart(6,'0'),target:{entryId:'d'},interaction:{replyTo:{entryId:i?'q'+(i-1):'d'}}});
assert.equal(outlineDialogue(deepReplies).find(row=>row.id==='q9999').depth,10001);
assert.equal(JSON.stringify(a),JSON.stringify(JSON.parse(original)[0]),'Projection never mutates the map');
assert.equal(records[2].interaction.replyTo.entryId,'d');
console.log('PASS: outline source identity, hierarchy, complete wording, focus/search, explicit and legacy pair truth, unavailable-source privacy, connection meaning and deep targeted dialogue.');
