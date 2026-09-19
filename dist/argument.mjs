import {stableJSON} from './account-model.mjs';
import {comparisonProposalVersions,comparisonParticipants,comparisonHealth} from './workspace.mjs';

export const ARGUMENT_KINDS={ground:'Ground',evidence:'Evidence',value:'Value'};
export const ARGUMENT_RELATIONS={supports:'Supports',evidence_for:'Evidence for',rebuts:'Rebuts'};
export const argumentIdentity=['id','comparisonId','proposalId','proposalRevision','authorId','createdAt'];
export const argumentRevision=value=>{const {history,...saved}=value;return structuredClone(saved);};
export const argumentGraphMatches=(value,proposalId,revision)=>value.proposalId===proposalId&&value.proposalRevision===revision;
export function argumentContext(workspace,value){
  const proposal=workspace.comparisons.find(p=>p.id===value.proposalId);
  const version=proposal&&comparisonProposalVersions(proposal).find(v=>v.revision===value.proposalRevision);
  if(!proposal||proposal.comparisonId!==value.comparisonId||!version)throw Error('This reasoning needs an existing proposal version.');
  return {proposal,version};
}
export function argumentNeedsReview(workspace,value){
  const {proposal}=argumentContext(workspace,value);
  if(value.proposalRevision!==comparisonProposalVersions(proposal).at(-1).revision||comparisonHealth(workspace,proposal).needsReview)return true;
  return [value.from,value.to].filter(ref=>ref?.type==='node').some(ref=>{
    const node=workspace.argumentNodes.find(n=>n.id===ref.id);return !node||node.status!=='active'||node.version!==ref.version;
  });
}
function argumentNext(workspace,input,actorId,old,type){
  const now=new Date().toISOString();
  const value={...input,id:old?.id||`argument-${type}-${crypto.randomUUID()}`,authorId:actorId,createdAt:old?.createdAt||now,updatedAt:now,status:input.status||'active',version:(old?.version||0)+1,history:old?[...old.history,argumentRevision(old)]:[]};
  if(old)for(const key of argumentIdentity)value[key]=old[key];
  const {proposal}=argumentContext(workspace,value);
  if(!comparisonParticipants(workspace,proposal).includes(actorId)||old&&old.authorId!==actorId)throw Error('You can only edit your own reasoning.');
  if(value.status==='active'&&argumentNeedsReview(workspace,{...value,from:null,to:null}))throw Error('Review the current sources in Compare before adding or editing reasoning.');
  return value;
}
export function saveArgumentNode(workspace,input,actorId,old=null){
  const value=argumentNext(workspace,{comparisonId:input.comparisonId,proposalId:input.proposalId,proposalRevision:input.proposalRevision,kind:input.kind,title:input.title?.trim(),body:input.body?.trim()||'',sourceUrl:input.sourceUrl?.trim()||'',status:input.status},actorId,old,'node');
  validateArgumentNode(value);return value;
}
export function argumentNodeRef(workspace,id){
  const node=workspace.argumentNodes?.find(n=>n.id===id&&n.status==='active');
  if(!node)throw Error('Choose an available reasoning node.');
  return {type:'node',id,version:node.version};
}
export function saveArgumentEdge(workspace,input,actorId,old=null){
  const value=argumentNext(workspace,{comparisonId:input.comparisonId,proposalId:input.proposalId,proposalRevision:input.proposalRevision,from:input.from,to:input.to,relation:input.relation,note:input.note?.trim()||'',status:input.status},actorId,old,'edge');
  validateArgumentEdge(workspace,value);
  if(value.status==='active'&&argumentNeedsReview(workspace,value))throw Error('Review the current endpoints before saving this connection.');
  return value;
}
function validateArgumentBase(value){
  if(!value||typeof value.id!=='string'||!value.id||value.id.length>200||typeof value.authorId!=='string'||!Number.isSafeInteger(value.proposalRevision)||value.proposalRevision<1||!Number.isSafeInteger(value.version)||value.version<1||!['active','withdrawn'].includes(value.status)||!Number.isFinite(Date.parse(value.createdAt))||!Number.isFinite(Date.parse(value.updatedAt)))throw Error('Invalid reasoning record.');
}
function validateArgumentNode(value){
  validateArgumentBase(value);
  if(!Object.hasOwn(ARGUMENT_KINDS,value.kind)||typeof value.title!=='string'||!value.title.trim()||value.title.length>120||typeof value.body!=='string'||value.body.length>10000||typeof value.sourceUrl!=='string'||value.sourceUrl.length>2000)throw Error('Add a title and keep the reasoning within the field limits.');
  if(value.sourceUrl){let url;try{url=new URL(value.sourceUrl);}catch{throw Error('Use a full HTTPS or HTTP source address.');}if(!['https:','http:'].includes(url.protocol))throw Error('Use a full HTTPS or HTTP source address.');}
}
function validateArgumentEdge(workspace,value){
  validateArgumentBase(value);
  if(!Object.hasOwn(ARGUMENT_RELATIONS,value.relation)||typeof value.note!=='string'||value.note.length>2000||value.from?.type!=='node')throw Error('Choose a valid reasoning connection.');
  for(const ref of [value.from,value.to]){
    if(ref?.type==='source'){const {version}=argumentContext(workspace,value);if(!['a','b'].includes(ref.side)||!version[`${ref.side}Snapshot`]?.node)throw Error('Choose a source position present in this proposal.');}
    else if(ref?.type==='node'){
      const node=workspace.argumentNodes?.find(n=>n.id===ref.id);
      if(!node||!argumentGraphMatches(node,value.proposalId,value.proposalRevision)||!Number.isSafeInteger(ref.version)||ref.version<1||ref.version>node.version)throw Error('Connections must stay within one proposal version.');
      if(ref===value.from){if(node.authorId!==value.authorId)throw Error('Start connections from your own reasoning.');const pinned=node.version===ref.version?node:node.history.find(v=>v.version===ref.version);if(value.relation==='evidence_for'&&pinned?.kind!=='evidence')throw Error('An evidence-for connection must start at evidence.');}
    }else throw Error('Choose an available connection endpoint.');
  }
  if(value.to.type==='node'&&value.to.id===value.from.id)throw Error('A reasoning node cannot connect to itself.');
}
export function validateArguments(workspace){
  workspace.argumentNodes??=[];workspace.argumentEdges??=[];
  if(!Array.isArray(workspace.argumentNodes)||!Array.isArray(workspace.argumentEdges)||workspace.argumentNodes.length>2000||workspace.argumentEdges.length>5000)throw Error('Invalid argument map.');
  for(const [collection,type]of [[workspace.argumentNodes,'node'],[workspace.argumentEdges,'edge']]){
    const ids=new Set();
    for(const record of collection){
      const {proposal}=argumentContext(workspace,record);
      if(ids.has(record.id)||!comparisonParticipants(workspace,proposal).includes(record.authorId)||!Array.isArray(record.history)||record.version!==record.history.length+1)throw Error('Invalid argument authorship or revision history.');ids.add(record.id);
      for(const [index,version]of [...record.history,record].entries()){
        if(version.version!==index+1||argumentIdentity.some(key=>version[key]!==record[key]))throw Error('Argument history must retain its identity.');
        if(type==='node')validateArgumentNode(version);else validateArgumentEdge(workspace,version);
      }
    }
  }
  const links=new Set();for(const edge of workspace.argumentEdges.filter(e=>e.status==='active')){
    const key=JSON.stringify([edge.proposalId,edge.proposalRevision,edge.authorId,edge.from.id,edge.to.type,edge.to.id||edge.to.side,edge.relation]);
    if(links.has(key))throw Error('That reasoning connection already exists.');links.add(key);
  }
  return workspace;
}
export function validateArgumentEdit(workspace,old,value,actorId){
  const {proposal}=argumentContext(workspace,value);
  if(value.authorId!==actorId||!comparisonParticipants(workspace,proposal).includes(actorId))throw Error('Reasoning must belong to the signed-in participant.');
  if(old){
    if(argumentIdentity.some(key=>value[key]!==old[key]))throw Error('Reasoning cannot move to another author or proposal.');
    const prefix=[...old.history,argumentRevision(old)];
    if(value.version<=old.version||stableJSON(value.history.slice(0,prefix.length))!==stableJSON(prefix))throw Error('Earlier reasoning versions must remain unchanged.');
  }else if(value.version!==value.history.length+1)throw Error('Invalid initial reasoning history.');
  if(value.status==='active'&&argumentNeedsReview(workspace,value))throw Error('Review the current proposal and connection endpoints before saving.');
}
