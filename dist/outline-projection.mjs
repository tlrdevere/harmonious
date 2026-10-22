import {graphEdges,RELATION_TYPES,STRUCTURAL_TYPES} from './model.mjs';

const frameIds=['status','action','goal'];
const frameNames={status:'Status Quo',action:'Transformative Action',goal:'Goal State'};
const compare=(a,b)=>String(a??'').localeCompare(String(b??''));
const sourceKey=(mapId,nodeId)=>JSON.stringify([mapId,nodeId]);
const available=map=>!!map&&!map.unavailable&&!map.deletedAt;
const words=query=>String(query||'').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
const matches=(node,terms)=>{const value=['title','summary','details','sourceTitle','sourceUrl'].map(key=>node[key]||'').join(' ').toLocaleLowerCase();return terms.every(term=>value.includes(term));};

// Projection inputs are the already authorized workspace. Never fill a missing
// source from a discussion snapshot or from another map with the same node ID.
// Iterative traversal and lazy ancestry keep very deep maps usable.
export function outlineMap(map,{roots=frameIds,frame='all',query='',scopeIds=null}={}){
  const result={available:available(map),frames:[],rows:[],allRows:[],byId:new Map(),excludedCount:0};
  if(!result.available)return result;
  const raw=new Map(),children=new Map(),terms=words(query),scope=scopeIds===null?null:new Set(scopeIds);
  for(const node of map.nodes||[])if(node?.id&&!raw.has(node.id)){raw.set(node.id,node);children.set(node.id,[]);}
  for(const node of raw.values())if(node.parent!==null)children.get(node.parent)?.push(node.id);
  for(const rootId of roots){
    const root=raw.get(rootId);if(!root||root.parent!==null)continue;
    const section={id:rootId,title:root.title||frameNames[rootId]||rootId,rows:[]},pending=[{id:rootId,depth:0,topicId:null}];
    result.frames.push(section);
    while(pending.length){
      const {id,depth,topicId}=pending.pop();if(result.byId.has(id))continue;
      const node=raw.get(id),key=sourceKey(map.id,id);
      const row={id,key,mapId:map.id,node,parentId:node.parent,frameId:rootId,topicId,depth,children:children.get(id)||[],matches:matches(node,terms),inScope:!scope||depth===0||scope.has(id)||scope.has(key),context:false};
      // Read only when a selected row needs its breadcrumb, not for every row.
      Object.defineProperty(row,'ancestors',{enumerable:true,get(){
        const list=[];let parent=result.byId.get(row.parentId);
        while(parent){list.push({id:parent.id,title:parent.node.title||'Untitled node'});parent=result.byId.get(parent.parentId);}
        return list.reverse();
      }});
      result.byId.set(id,row);result.allRows.push(row);
      for(let i=row.children.length-1;i>=0;i--)pending.push({id:row.children[i],depth:depth+1,topicId:depth===0?row.children[i]:topicId});
    }
  }
  // Search retains ancestor context; it never adds the descendants of a match
  // unless those descendants also match. Focus exclusions remain measurable.
  const shown=new Set();
  for(const row of result.allRows){
    if(!row.inScope){result.excludedCount++;continue;}
    if(frame!=='all'&&row.frameId!==frame||!row.matches)continue;
    let current=row;
    while(current&&!shown.has(current.id)){shown.add(current.id);current=result.byId.get(current.parentId);}
  }
  result.rows=result.allRows.filter(row=>shown.has(row.id));
  for(const row of result.rows)row.context=!row.matches;
  for(const section of result.frames)section.rows=result.rows.filter(row=>row.frameId===section.id);
  return result;
}

// Parent structure and semantic/source relationships stay separate, even when
// the same endpoints carry more than one saved connection meaning.
export function outlineConnections(map,nodeId=null){
  const projection=outlineMap(map);if(!projection.available)return [];
  return graphEdges(map.nodes||[],map.relations||[]).flatMap(edge=>{
    const from=projection.byId.get(edge.from),to=projection.byId.get(edge.to);
    if(!from||!to||nodeId!==null&&edge.from!==nodeId&&edge.to!==nodeId)return [];
    const meaning=(edge.structural?STRUCTURAL_TYPES:RELATION_TYPES)[edge.type];
    return [{id:edge.id,target:{type:'edge',mapId:map.id,edgeId:edge.id},from,to,label:meaning?.label||'Connection',forward:edge.structural?meaning?.forward:meaning?.label,directed:edge.structural||!!meaning?.directed,structural:!!edge.structural,edge}];
  });
}

// A pair exists only because a record says so. In particular, position in an
// array, identical wording and a shared parent never infer a counterpart.
// Older many-to-one/cross-frame records remain distinct readable pair groups.
export function outlineComparison(sourceMaps,links=[],options={}){
  const sources=Array.isArray(sourceMaps)?{a:sourceMaps[0],b:sourceMaps[1]}:sourceMaps||{},roots=options.roots||frameIds;
  const maps={},members=new Map(),groups=[],paired=new Set(),frames=roots.map(id=>({id,title:frameNames[id]||id,groups:[]}));
  for(const side of ['a','b']){
    const map=sources[side];maps[side]=outlineMap(map,{roots});
    for(const row of maps[side].allRows){
      const member=Object.defineProperties({side,map},Object.getOwnPropertyDescriptors(row));
      members.set(row.key,member);
    }
  }
  const removed=new Set(links.filter(record=>record.kind==='counterpart_unlink'&&record.status==='active').flatMap(record=>record.unlinkedRecordIds||[]));
  const records=links.filter(record=>record.status==='active'&&['correspondence','relationship'].includes(record.kind)&&!removed.has(record.id)).sort((a,b)=>(a.kind==='correspondence'?0:1)-(b.kind==='correspondence'?0:1)||compare(a.createdAt,b.createdAt)||compare(a.id,b.id));
  const pairs=new Map(),unavailablePairs=new Map();
  for(const record of records){
    const endpoints=[record.target,record.other];
    if(endpoints.some(target=>target?.type&&target.type!=='node')||endpoints.some(target=>!target?.mapId||!target?.nodeId)||endpoints[0].mapId===endpoints[1].mapId||!endpoints.every(target=>[sources.a?.id,sources.b?.id].includes(target.mapId)))continue;
    const keys=endpoints.map(target=>sourceKey(target.mapId,target.nodeId)).sort(compare),list=keys.map(key=>members.get(key)),id=JSON.stringify(['pair',...keys]);
    if(list.every(Boolean)){
      if(!pairs.has(id))pairs.set(id,{id,kind:'pair',frameId:list[0].frameId,members:list.sort((a,b)=>compare(a.side,b.side)),records:[],crossFrame:list[0].frameId!==list[1].frameId});
      pairs.get(id).records.push(record);for(const member of list)paired.add(member.key);
    }else for(const member of list.filter(Boolean)){
      if(!unavailablePairs.has(member.key))unavailablePairs.set(member.key,[]);
      unavailablePairs.get(member.key).push(record);
    }
  }
  // Frame headings correspond structurally, without creating a link record.
  for(const root of roots){const list=[...members.values()].filter(member=>member.id===root&&!paired.has(member.key));if(list.length){groups.push({id:JSON.stringify(['frame',root]),kind:'frame',frameId:root,members:list,records:[],crossFrame:false});for(const member of list)paired.add(member.key);}}
  groups.push(...pairs.values());
  for(const member of members.values())if(!paired.has(member.key))groups.push({id:JSON.stringify(['solo',member.key]),kind:'solo',frameId:member.frameId,members:[member],records:unavailablePairs.get(member.key)||[],crossFrame:false,unavailableCounterpart:unavailablePairs.has(member.key)});
  const terms=words(options.query),scope=options.scopeIds===null||options.scopeIds===undefined?null:new Set(options.scopeIds),topic=options.topic||'all',frame=options.frame||'all';
  const accepts=group=>group.members.some(member=>(frame==='all'||member.frameId===frame)&&(topic==='all'||member.topicId===topic||sourceKey(member.mapId,member.topicId)===topic)&&(!scope||member.depth===0||scope.has(member.key)||scope.has(member.id))&&matches(member.node,terms));
  const filtered=groups.filter(accepts),order=new Map([...members.keys()].map((key,index)=>[key,index]));
  filtered.sort((a,b)=>roots.indexOf(a.frameId)-roots.indexOf(b.frameId)||Number(b.kind==='frame')-Number(a.kind==='frame')||Math.min(...a.members.map(member=>order.get(member.key)))-Math.min(...b.members.map(member=>order.get(member.key)))||compare(a.id,b.id));
  for(const group of filtered)frames.find(frame=>frame.id===group.frameId)?.groups.push(group);
  return {maps,groups:filtered,frames};
}

// Chronology is for scanning. The recorded target, not the previous displayed
// row, determines the conversation's actual parent and canvas placement.
export function outlineDialogue(records=[]){
  const ordered=[...records].sort((a,b)=>compare(a.createdAt,b.createdAt)||compare(a.id,b.id)),ids=new Set(ordered.map(record=>record.id)),byId=new Map(),depths=new Map([['claim',0]]);
  for(const record of ordered){
    const targetId=record.action==='dispute'?'claim':record.interaction?.replyTo?.entryId||record.target?.entryId||null;
    byId.set(record.id,{id:record.id,record,targetId,targetVersion:record.interaction?.replyTo?.version??null,targetAvailable:targetId==='claim'||ids.has(targetId),depth:0,placement:record.interaction?.placement||'right',children:[]});
  }
  for(const row of byId.values())byId.get(row.targetId)?.children.push(row.id);
  for(const row of byId.values()){
    const path=[],seen=new Set();let current=row;
    while(current&&!depths.has(current.id)&&!seen.has(current.id)){seen.add(current.id);path.push(current);current=byId.get(current.targetId);}
    let depth=current&&depths.has(current.id)?depths.get(current.id):path.at(-1)?.targetId==='claim'?0:-1;
    for(let i=path.length-1;i>=0;i--){const item=path[i];item.depth=depth<0?0:++depth;depths.set(item.id,item.depth);}
  }
  return [...byId.values()];
}
