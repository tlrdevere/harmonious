import assert from 'node:assert/strict';
import {layoutForest,CARD_W,CARD_H} from '../dist/layout.mjs';
import {mapTopicSectors,topicFocusMembers,connectedTopicBranches} from '../dist/topic-layout.mjs';
import {layoutComparison,comparisonNodeKey,comparisonDisplayRects} from '../dist/comparison-layout.mjs';
const roots=['status','action','goal'];
const nodes=roots.map(id=>({id,parent:null,title:id}));
for(const root of roots)for(let i=0;i<6;i++){const id=root+i;nodes.push({id,parent:root});for(let j=0;j<(i===0?root==='status'?7:2:1);j++)nodes.push({id:id+'-'+j,parent:id});}
const relations=[{id:'sa',from:'status0',to:'action0',type:'addresses'},{id:'ag',from:'action0',to:'goal0',type:'enables'}];
const all=new Set(nodes.map(n=>n.id)),before=JSON.stringify({nodes,relations});
const aligned=layoutForest(nodes,roots,all,relations);
const angle=(layout,id)=>{const p=layout.positions.get(id),r=layout.positions.get(nodes.find(n=>n.id===id).parent);return Math.atan2(p.y-r.y,p.x-r.x);};
assert(Math.abs(angle(aligned,'status0')-angle(aligned,'action0'))<1e-10);
assert(Math.abs(angle(aligned,'action0')-angle(aligned,'goal0'))<1e-10);
function noOverlap(rects){for(let i=0;i<rects.length;i++)for(let j=0;j<i;j++){const a=rects[i],b=rects[j];assert(!(a.x<b.x+b.w-.01&&a.x+a.w>b.x+.01&&a.y<b.y+b.h-.01&&a.y+a.h>b.y+.01),'Cards and ghosts must not overlap');}}
noOverlap([...aligned.positions.values()].map(p=>({...p,w:CARD_W,h:CARD_H})));
const collapsed=layoutForest(nodes,roots,new Set(roots),relations);for(const id of ['status0','action0','goal0'])assert(Math.abs(angle(collapsed,id)-angle(aligned,id))<1e-10,'Expansion preserves topic angle');
assert.deepEqual(mapTopicSectors(nodes,roots,relations),mapTopicSectors(nodes,roots,[...relations].reverse()),'Relation order has no geometric meaning');
assert.equal(mapTopicSectors(nodes,roots,[{from:'status0-0',to:'action0'}]).size,0,'Deeper relations retain their geometry');
assert.deepEqual(layoutForest(nodes,roots,all,[]),layoutForest(nodes,roots,all),'Removing all eligible links restores independent layout');
const many=[...relations,{from:'status0',to:'action1'}];const sectors=mapTopicSectors(nodes,roots,many);assert.notEqual(sectors.get('action0').angle,sectors.get('action1').angle);assert(sectors.get('action0').angle<sectors.get('status0').angle&&sectors.get('action1').angle>sectors.get('status0').angle,'One-to-many occupies adjacent sub-sectors');
noOverlap([...layoutForest(nodes,roots,all,many).positions.values()].map(p=>({...p,w:CARD_W,h:CARD_H})));
const a={id:'a',nodes,relations},b={id:'b',nodes:structuredClone(nodes),relations:structuredClone(relations)},states={a:{map:a,expanded:all,frame:'all'},b:{map:b,expanded:all,frame:'all'}};
const overlay=layoutComparison(states,roots);noOverlap(comparisonDisplayRects(overlay));
for(const side of ['a','b']){const values=['status0','action0','goal0'].map(id=>overlay.positions.get(comparisonNodeKey(side,id)).angle);assert(values.every(v=>Math.abs(v-values[0])<1e-10));}
const links=[{id:'pair',kind:'correspondence',status:'active',target:{mapId:'a',nodeId:'status0'},other:{mapId:'b',nodeId:'status0'}}];
const paired=layoutComparison(states,roots,{links});noOverlap(comparisonDisplayRects(paired));assert.equal(paired.positions.get(comparisonNodeKey('b','status0')).x-paired.positions.get(comparisonNodeKey('a','status0')).x,CARD_W+16,'Counterpart adjacency wins');
const foldedPair=layoutComparison({...states,b:{...states.b,expanded:new Set(['action','goal'])}},roots,{links});
for(const id of ['status0','action0','goal0'])assert.equal(foldedPair.positions.get(comparisonNodeKey('a',id)).angle,paired.positions.get(comparisonNodeKey('a',id)).angle,'Collapsed opposite frame preserves topic orientation');
const swapped=layoutComparison({a:states.b,b:states.a},roots,{links});for(const id of ['status0','action0','goal0'])assert.equal(swapped.positions.get(comparisonNodeKey('b',id)).angle,paired.positions.get(comparisonNodeKey('a',id)).angle,'Swapping sides preserves source topic orientation');
const focus=topicFocusMembers(nodes,new Set(['status0','goal2','missing','status0-0']));assert.equal(focus.topics.size,2);assert(focus.members.has('status0-6'));assert(!focus.members.has('action0'));assert(!focus.members.has('status'));
const added=topicFocusMembers([...nodes,{id:'new-descendant',parent:'status0-0'}],focus.topics);assert(added.members.has('new-descendant'));
const connected=connectedTopicBranches(nodes,[...many,{from:'goal0',to:'status0'},{from:'status0',to:'status5'},{from:'goal0',to:'action2-0'},{from:'goal0',to:'missing'}],'goal0');
assert.deepEqual([...connected].sort(),['status0','action0','action1','goal0'].sort(),'Follow cross-frame links backwards, through chains, branches and cycles, but not same-frame/deeper/missing endpoints');
const connectedFocus=topicFocusMembers(nodes,connected);for(const id of ['status0-6','action0-1','action1-0','goal0-1'])assert(connectedFocus.members.has(id),'Every connected topic includes its descendants');
assert.deepEqual([...connectedTopicBranches(nodes,[],'status2')],['status2']);assert.equal(connectedTopicBranches(nodes,relations,'status').size,0);
assert.equal(JSON.stringify({nodes,relations}),before,'Layout and focus do not mutate saved content');
console.log('PASS: cross-frame radial alignment, chains, crowded one-to-many groups, stable expansion, source/paired layouts, complete descendant focus and immutable map data.');
