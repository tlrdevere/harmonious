import assert from 'node:assert/strict';
import {layoutForest,CARD_W,CARD_H,validateForest,connectorRoute} from '../dist/layout.mjs';
import {exampleMap,roots} from '../dist/data.mjs';
const nodes=exampleMap();
function check(nodes,expanded){const r=layoutForest(nodes,roots,expanded),items=[...r.positions];
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const [ai,a]=items[i],[bi,b]=items[j];assert(!(a.x<b.x+CARD_W&&a.x+CARD_W>b.x&&a.y<b.y+CARD_H&&a.y+CARD_H>b.y),`Overlap: ${ai}, ${bi}`);}
  for(const n of nodes){let visible=true,p=n.parent;while(p!==null){if(!expanded.has(p))visible=false;p=nodes.find(n=>n.id===p).parent;}assert.equal(r.positions.has(n.id),visible,`Visibility: ${n.id}`);}
  for(const edge of r.edges){const a=r.positions.get(edge.from),b=r.positions.get(edge.to);
    if(edge.kind==='spine')assert.equal(a.y,b.y,'The three frame centers share a horizontal spine');
    else {assert.equal(b.depth,a.depth+1);assert(b.radius>a.radius,'Descendants move outward');}
    const route=connectorRoute(a,b,edge.kind==='spine'?null:r.positions.get(roots[edge.frame]),true);for(let step=1;step<route.points.length;step++){const start=route.points[step-1],end=route.points[step],line={x1:start.x,y1:start.y,x2:end.x,y2:end.y};
    for(const [id,p] of items){if(id===edge.from||id===edge.to)continue;
      let low=0,high=1;
      for(const [origin,delta,min,max] of [[line.x1,line.x2-line.x1,p.x+1,p.x+CARD_W-1],[line.y1,line.y2-line.y1,p.y+1,p.y+CARD_H-1]]){
        if(Math.abs(delta)<1e-8){if(origin<min||origin>max){high=-1;break;}}
        else {const t1=(min-origin)/delta,t2=(max-origin)/delta;low=Math.max(low,Math.min(t1,t2));high=Math.min(high,Math.max(t1,t2));}
      }
      assert(high<low,`Connector ${edge.from} -> ${edge.to} crosses ${id}`);
    }}
  }
  assert(r.positions.get(roots[0]).x<r.positions.get(roots[1]).x&&r.positions.get(roots[1]).x<r.positions.get(roots[2]).x);return r;
}
const collapsed=check(nodes,new Set());assert.equal(collapsed.positions.size,3);
const full=check(nodes,new Set(nodes.map(n=>n.id)));assert.equal(full.positions.size,nodes.length);
assert(full.width>collapsed.width);assert(full.height>collapsed.height);assert(full.positions.get('status').x>collapsed.positions.get('status').x);const first=check(nodes,new Set(roots));for(const root of roots){const center=first.positions.get(root),kids=first.children.get(root).map(id=>first.positions.get(id));assert(kids.some(p=>p.y<center.y)&&kids.some(p=>p.y>center.y),'Branches spread above and below each center');}
const partial=new Set(['status','s1','s11','s111']);check(nodes,partial);partial.delete('s1');assert(!check(nodes,partial).positions.has('s1111'));partial.add('s1');assert(check(nodes,partial).positions.has('s1111'));
let seed=421;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
for(let run=0;run<200;run++)check(nodes,new Set(nodes.filter(()=>random()>.5).map(n=>n.id)));
const large=nodes.map(n=>({...n}));for(let i=0;i<220;i++)large.push({id:`test-${i}`,parent:large[Math.floor(random()*large.length)].id});check(large,new Set(large.map(n=>n.id)));
for(let run=0;run<40;run++)check(large,new Set(large.filter(()=>random()>.25).map(n=>n.id)));
assert.throws(()=>validateForest([...nodes,{id:'bad',parent:'missing'}],roots));assert.throws(()=>validateForest([{id:'a',parent:'b'},{id:'b',parent:'a'},...nodes],roots));
console.log(`PASS: collapsed and full maps, radial spacing and horizontal frame alignment, remembered branch state, 240 varied expansion patterns, and a ${large.length}-node forest; no overlapping cards or connectors crossing unrelated cards.`);
