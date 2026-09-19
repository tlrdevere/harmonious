import {isReason,isChallenge} from './discussion.mjs';
import {comparisonHealth} from './workspace.mjs';
import {isDisagreementPoint,isReflectionOutcome} from './reflection.mjs';

const libraryTimestamp=value=>{const time=typeof value==='string'?Date.parse(value):NaN;return Number.isFinite(time)?time:0;};
const libraryNameOrder=(a,b)=>String(a||'').localeCompare(String(b||''),'en',{sensitivity:'base',numeric:true});
const libraryIdOrder=(a,b)=>a===b?0:a<b?-1:1;

export function libraryMapOrder(maps){
  return [...maps].sort((a,b)=>libraryTimestamp(b.updatedAt)-libraryTimestamp(a.updatedAt)||libraryNameOrder(a.name,b.name)||libraryIdOrder(a.id,b.id));
}

// This receives the same access-filtered workspace as the Library. No global
// activity or source-map edits are consulted to rank a shared conversation.
export function libraryComparisonSummary(workspace,thread){
  const discussions=(workspace.discussions||[]).filter(r=>r.comparisonId===thread.id),active=discussions.filter(r=>r.status==='active');
  const proposals=(workspace.comparisons||[]).filter(r=>r.comparisonId===thread.id),earlier=[...(workspace.argumentNodes||[]),...(workspace.argumentEdges||[])].filter(r=>r.comparisonId===thread.id);
  const maps=[thread.aMapId,thread.bMapId].map(id=>workspace.maps.find(map=>map.id===id));
  const title=maps.map(map=>map?.name||'Unavailable source map').join(' / ');
  let activity=0;for(const record of [thread,...discussions,...proposals,...earlier])activity=Math.max(activity,libraryTimestamp(record.createdAt),libraryTimestamp(record.updatedAt));
  const counts={relationships:active.filter(r=>r.kind==='relationship').length,inquiries:active.filter(r=>['inquiry','counterpart','adoption'].includes(r.kind)).length,reasons:active.filter(isReason).length,challenges:active.filter(isChallenge).length,earlierJudgments:proposals.length,earlierReasoning:earlier.filter(r=>r.status==='active').length,sourceReviews:proposals.filter(p=>comparisonHealth(workspace,p).needsReview).length};
  const points=active.filter(isDisagreementPoint);counts.disagreementPoints=points.length;counts.outcomes=active.filter(r=>isReflectionOutcome(r)&&points.some(p=>p.id===r.target.entryId)).length;
  const labels=[];
  for(const [key,singular,plural]of [['relationships','relationship','relationships'],['inquiries','question or request','questions & requests'],['reasons','reason','reasons'],['challenges','challenge','challenges'],['disagreementPoints','point of disagreement','points of disagreement'],['outcomes','individual outcome','individual outcomes'],['earlierJudgments','earlier judgment','earlier judgments'],['earlierReasoning','earlier reasoning item','earlier reasoning items']])if(counts[key])labels.push(`${counts[key]} ${counts[key]===1?singular:plural}`);
  if(counts.sourceReviews)labels.push(`${counts.sourceReviews} need source review`);
  return {thread,title,activity,counts,description:labels.join(' · ')||(discussions.length||earlier.length?'Conversation history available':'No contributions yet')};
}

export function libraryComparisonOrder(workspace){
  return (workspace.comparisonThreads||[]).map(thread=>libraryComparisonSummary(workspace,thread)).sort((a,b)=>b.activity-a.activity||libraryNameOrder(a.title,b.title)||libraryIdOrder(a.thread.id,b.thread.id));
}
