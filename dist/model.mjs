import {validateForest} from './layout.mjs';

export const NODE_KINDS={
  position:{label:'Node',hint:'A claim, reason, example, or proposed course of action.'},
  // Older files can still be opened, but new nodes all use the statement kind.
  topic:{label:'Node',legacy:true},
  question:{label:'Node',legacy:true},
  explainer:{label:'Node',legacy:true}
};
export const STRUCTURAL_TYPES={
  nesting:{label:'Nested under parent',forward:'contains'},
  decomposition:{label:'Part of parent',forward:'has part'},
  specification:{label:'More specific than parent',forward:'is specified by'},
  answer:{label:'Answers parent question',forward:'is answered by'}
};
export const RELATION_TYPES={
  reason:{label:'Is a reason for',group:'reasoning',directed:true},
  cause:{label:'Causes',group:'reasoning',directed:true},
  addresses:{label:'Is addressed by',group:'cross',directed:true},
  enables:{label:'Enables',group:'cross',directed:true},
  causal:{label:'Contributes to',group:'within',directed:true},
  related:{label:'Related to',group:'within',directed:false},
  illustrative:{label:'Illustrates',group:'within',directed:true},
  motivates:{label:'Motivates action',group:'cross',directed:true},
  aims_for:{label:'Aims toward',group:'cross',directed:true},
  counterpart:{label:'Counterpart of',group:'cross',directed:false}
};
export function frameOf(nodes,id){
  const byId=new Map(nodes.map(n=>[n.id,n]));let n=byId.get(id),seen=new Set();
  while(n?.parent!==null){if(!n||seen.has(n.id))return null;seen.add(n.id);n=byId.get(n.parent);}
  return n?.id??null;
}
export function allowedRelationTypes(nodes,from,to){
  if(from===to||!nodes.some(n=>n.id===from&&n.parent!==null)||!nodes.some(n=>n.id===to&&n.parent!==null))return [];
  const a=frameOf(nodes,from),b=frameOf(nodes,to);
  return ['reason','cause',...(a==='status'&&b==='action'?['addresses']:[]),...(a==='action'&&b==='goal'?['enables']:[])];
}
function legacyRelationTypes(nodes,from,to){
  if(from===to||!nodes.some(n=>n.id===from)||!nodes.some(n=>n.id===to))return [];
  const a=frameOf(nodes,from),b=frameOf(nodes,to);
  if(a===b)return ['causal','related','illustrative'];
  if(a==='status'&&b==='action')return ['motivates'];
  if(a==='action'&&b==='goal')return ['aims_for'];
  if((a==='status'&&b==='goal')||(a==='goal'&&b==='status'))return ['counterpart'];
  return [];
}
export function canonicalRelationType(type){return {causal:'cause',motivates:'addresses',aims_for:'enables'}[type]||type;}
export function validateRelationship(nodes,relations,edge,ignoreId=null){
  if(![...allowedRelationTypes(nodes,edge.from,edge.to),...legacyRelationTypes(nodes,edge.from,edge.to)].includes(edge.type))throw Error('Choose a relationship that fits these frames and its direction.');
  if(relations.some(e=>e.id!==ignoreId&&canonicalRelationType(e.type)===canonicalRelationType(edge.type)&&((e.from===edge.from&&e.to===edge.to)||(!RELATION_TYPES[edge.type].directed&&e.from===edge.to&&e.to===edge.from))))throw Error('That connection already exists.');
}
export function createChildStatement(nodes,parent,id,{reasonId=null}={}){
  const source=nodes.find(n=>n.id===parent);if(!source)throw Error('Choose a parent node.');
  if(nodes.some(n=>n.id===id))throw Error('Duplicate node ID.');
  if(reasonId&&source.parent===null)throw Error('Choose a node to give a reason for.');
  const node={id,parent,title:reasonId?'New reason':'New node',summary:'',details:'',confidence:null,kind:'position',structuralType:'nesting',timeScope:'present',sourceTitle:'',sourceUrl:''};
  return {node,relation:reasonId?{id:reasonId,from:id,to:parent,type:'reason',note:''}:null};
}
export function validateGraph(nodes,roots,relations){
  validateForest(nodes,roots);const byId=new Map(nodes.map(n=>[n.id,n]));
  for(const n of nodes){
    if(n.sourceUrl){let url;try{url=new URL(n.sourceUrl);}catch{throw Error('Use a complete http or https source URL.');}if(!['http:','https:'].includes(url.protocol))throw Error('Use an http or https source URL.');}
    if(n.parent===null)continue;
    if(!NODE_KINDS[n.kind])throw Error('Choose a node kind.');
    if(!STRUCTURAL_TYPES[n.structuralType])throw Error('Choose a relationship to the parent.');
    if(n.structuralType==='answer'&&(n.kind!=='position'||byId.get(n.parent).kind!=='question'))throw Error(`“${n.title}” uses an answer relationship, which requires a Position under a Question. Change that relationship before changing the node kind.`);
  }
  const ids=new Set();for(const e of relations){if(!e.id||ids.has(e.id))throw Error('Duplicate connection ID.');ids.add(e.id);validateRelationship(nodes,relations,e,e.id);}
}
export function graphEdges(nodes,relations){
  return [...nodes.filter(n=>n.parent!==null).map(n=>({id:`structure:${n.id}`,from:n.parent,to:n.id,type:n.structuralType,structural:true})),...relations.map(e=>({...e,structural:false}))];
}
export function revealPath(nodes,id,expanded){
  const byId=new Map(nodes.map(n=>[n.id,n]));let n=byId.get(id);const next=new Set(expanded);
  while(n?.parent!==null&&n){next.add(n.parent);n=byId.get(n.parent);}return next;
}
export function removeBranch(nodes,relations,id){
  if(nodes.find(n=>n.id===id)?.parent===null)throw Error('A frame cannot be deleted.');
  const removed=new Set([id]);let changed=true;
  while(changed){changed=false;for(const n of nodes)if(removed.has(n.parent)&&!removed.has(n.id)){removed.add(n.id);changed=true;}}
  return {nodes:nodes.filter(n=>!removed.has(n.id)),relations:relations.filter(e=>!removed.has(e.from)&&!removed.has(e.to)),removed};
}
