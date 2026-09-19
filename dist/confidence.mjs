export function validConfidence(value){return value===null||typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100;}

// Confidence belongs to a person's placement of a claim, not shared wording.
export function setNodeConfidence(workspace,target,actor,value){
  if(!validConfidence(value))throw Error('Enter a confidence from 0 to 100, or choose Not assessed.');
  const map=workspace.maps.find(item=>item.id===target?.mapId&&!item.unavailable),node=map?.nodes.find(item=>item.id===target?.nodeId);
  if(!map||map.ownerId!==actor)throw Error('You can only set confidence on your own map.');
  if(!node||node.parent===null||node.kind!=='position')throw Error('Choose a position on your own map.');
  if(node.confidence!==value){node.confidence=value;map.revision++;map.updatedAt=new Date().toISOString();}
  return node;
}

// Compare meaningful source changes without altering the original saved snapshot.
export function confidenceNeutralSnapshot(snapshot){
  if(!snapshot)return snapshot;
  const withoutScore=node=>{if(!node)return node;const {confidence,...rest}=node;return rest;};
  return {...snapshot,node:withoutScore(snapshot.node),...(snapshot.links?{links:snapshot.links.map(link=>({...link,otherNode:withoutScore(link.otherNode)}))}:{})};
}
