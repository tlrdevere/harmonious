import {discussionSource,discussionSourceSnapshot,makeDiscussion} from './discussion.mjs';
import {frameOf,validateRelationship,canonicalRelationType} from './model.mjs';
import {synchronizeIdeas} from './adoption.mjs';
import {stableJSON} from './account-model.mjs';
import {validateWorkspace} from './workspace.mjs';

// Applying a recorded interaction is a separate, reviewed edit to one's own map.
export function interactionApplicationPreview(ws,id,actor){
  const record=ws.discussions.find(r=>r.id===id&&r.kind==='interaction'&&r.status==='active');if(!record)throw Error('This interaction is unavailable.');
  const origin=record.action==='respond'?ws.discussions.find(r=>r.id===record.target.entryId&&r.status==='active'):record;
  if(!origin)throw Error('The original interaction is unavailable.');
  const source=discussionSource(ws,origin.target),thread=ws.comparisonThreads.find(t=>t.id===origin.comparisonId);
  if(!source||![thread?.aMapId,thread?.bMapId].every(mapId=>ws.maps.some(m=>m.id===mapId&&!m.unavailable&&(m.ownerId===actor||m.visibility==='shared'))))throw Error('Both comparison maps must be available.');
  const destination=ws.maps.find(m=>[thread.aMapId,thread.bMapId].includes(m.id)&&m.ownerId===actor&&!m.unavailable);
  if(!destination)throw Error('Choose your own comparison map.');
  let operation=null;
  if(record.action==='endorse'&&record.authorId===actor)operation='copy';
  if(operation==='copy'&&origin.target.type==='edge'&&!['reason','cause','addresses','enables'].includes(canonicalRelationType(source.item.type)))operation=null;
  if(record.action==='respond'&&record.authorId===actor&&record.interaction.options.some(o=>['accept','partly_accept'].includes(o))&&source.map.ownerId===actor){
    if(['propose_alternative','dispute'].includes(origin.action))operation='revise';
    if(origin.action==='offer_reason')operation='reason';
  }
  if(record.action==='respond'&&record.authorId===actor&&record.interaction.options.includes('answer')&&source.map.ownerId===actor){
    if(origin.action==='request_reason')operation='reason';
    if(origin.action==='request_explanation')operation='revise';
  }
  if(operation==='revise'&&origin.target.type==='edge'&&source.item.structural)operation=null;
  if(!operation)throw Error('This interaction has no map change for you to apply.');
  const receipt=(destination.interactionApplications||[]).find(r=>r.interactionId===id);
  const referenceRecord=record.action==='respond'&&record.interaction.options.includes('answer')?record:origin;
  const reference=referenceRecord.interaction.reference?discussionSource(ws,referenceRecord.interaction.reference.target):null;
  if(referenceRecord.interaction.reference&&!reference)throw Error('The offered reference is no longer available.');
  const reviewed={recordVersion:record.version,originVersion:origin.version,source:discussionSourceSnapshot(ws,origin.target),reference:referenceRecord.interaction.reference?discussionSourceSnapshot(ws,referenceRecord.interaction.reference.target):null};
  return {record,origin,source,destination,operation,receipt,reference,reviewed};
}

export function applyInteractionToMap(ws,input,actor){
  const preview=interactionApplicationPreview(ws,input.recordId,actor);
  if(preview.receipt)return {workspace:ws,receipt:preview.receipt};
  if(stableJSON(input.reviewed)!==stableJSON(preview.reviewed))throw Error('The interaction or its source changed. Reopen the preview before applying it.');
  const candidate=structuredClone(ws),map=candidate.maps.find(m=>m.id===preview.destination.id),nodeIds=[],edgeIds=[];
  const id=suffix=>`${input.operationId}-${suffix}`;
  const newNode=(source,parent,nodeId,title=source?.title)=>{
    if(!map.nodes.some(n=>n.id===parent))throw Error('Choose a parent in your map.');
    if(!title?.trim())throw Error('Enter a title for the node you want to add.');
    const node={id:nodeId,parent,title:title.trim(),summary:source?.summary||'',details:source?.details||'',kind:'position',structuralType:'nesting',timeScope:'present',sourceTitle:source?.sourceTitle||'',sourceUrl:source?.sourceUrl||'',confidence:null};
    map.nodes.push(node);nodeIds.push(node.id);return node;
  };
  const edge=(from,to,type,note='')=>{const existing=map.relations.find(e=>e.from===from&&e.to===to&&e.type===type);if(existing){edgeIds.push(existing.id);return;}const value={id:id('edge-'+edgeIds.length),from,to,type,note};validateRelationship(map.nodes,map.relations,value);map.relations.push(value);edgeIds.push(value.id);};
  if(preview.operation==='revise'){
    if(preview.source.map.id!==map.id)throw Error('Only the source owner can revise it.');
    if(preview.origin.target.type==='node'){
      const node=map.nodes.find(n=>n.id===preview.source.item.id);if(!input.title?.trim())throw Error('Enter the revised node title.');node.title=input.title.trim();node.summary=input.summary||'';node.details=input.details||'';nodeIds.push(node.id);
    }else{
      const connection=map.relations.find(e=>e.id===preview.source.item.id);if(!connection)throw Error('Organizational connections cannot be revised here.');connection.note=input.details?.trim()||'';edgeIds.push(connection.id);
    }
  }else if(preview.operation==='copy'&&preview.origin.target.type==='node'){
    let node;
    if(input.mode==='existing'){node=map.nodes.find(n=>n.id===input.nodeId&&n.parent!==null);if(!node)throw Error('Choose an existing node in your map.');nodeIds.push(node.id);}
    else node=newNode({...preview.source.item,summary:input.summary||'',details:input.details||''},input.parentId,id('node'),input.title);
    if(preview.origin.interaction.options.includes('own_reason')){
      let premise=preview.reference?.map.id===map.id?map.nodes.find(n=>n.id===preview.reference.item.id):null;
      if(!premise&&(preview.reference||input.reasonTitle?.trim()))premise=newNode(preview.reference?.item,preview.reference?frameOf(preview.reference.map.nodes,preview.reference.item.id):'status',id('own-reason'),preview.reference?.item.title||input.reasonTitle);
      if(premise)edge(premise.id,node.id,'reason');
    }
    if(input.linkCounterpart){
      const other={type:'node',mapId:map.id,nodeId:node.id},target=preview.origin.target;
      const already=candidate.discussions.some(r=>r.kind==='correspondence'&&r.status==='active'&&[stableJSON(r.target),stableJSON(r.other)].sort().join('|')===[stableJSON(target),stableJSON(other)].sort().join('|'));
      if(!already)candidate.discussions.push(makeDiscussion(candidate,{kind:'correspondence',action:'counterpart_link',comparisonId:preview.origin.comparisonId,target,other,body:''},actor));
    }
  }else if(preview.operation==='copy'){
    const original=preview.source.item,type=canonicalRelationType(original.type);
    if(!['reason','cause','addresses','enables'].includes(type))throw Error('Only typed reasoning connections can be copied here.');
    const sourceMap=preview.source.map,from=sourceMap.nodes.find(n=>n.id===original.from),to=sourceMap.nodes.find(n=>n.id===original.to);
    const a=newNode(from,frameOf(sourceMap.nodes,from.id),id('from')),b=newNode(to,frameOf(sourceMap.nodes,to.id),id('to'));edge(a.id,b.id,type,original.note||'');
  }else{
    let node;if(input.mode==='existing'){node=map.nodes.find(n=>n.id===input.nodeId&&n.parent!==null);if(!node)throw Error('Choose an existing node in your map.');nodeIds.push(node.id);}
    else node=newNode({...preview.reference?.item,summary:input.summary||'',details:input.details||''},input.parentId,id('reason'),input.title);
    if(preview.origin.target.type==='node')edge(node.id,preview.source.item.id,'reason');
    // For an explanation of an edge, the original offer retains the precise
    // edge target. Do not invent a node-to-node inference with another meaning.
  }
  map.revision++;map.updatedAt=new Date().toISOString();synchronizeIdeas(candidate,map);
  const receipt={interactionId:input.recordId,operation:preview.operation,nodeIds,edgeIds,createdAt:map.updatedAt};map.interactionApplications=[...(map.interactionApplications||[]),receipt];validateWorkspace(candidate);return {workspace:candidate,receipt};
}
