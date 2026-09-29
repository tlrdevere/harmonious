import {DISCUSSION_LABELS,discussionHealth} from './discussion.mjs';
import {counterpartState,sameCounterpartSource} from './counterparts.mjs';
import {interactionLabel,optionsForClassification} from './interaction-grammar.mjs';
import {graphEdges} from './model.mjs';

const parentTarget=target=>['entry','inference'].includes(target?.type);
const modes=new Set(['compare','inquiry','argument']);
const timestamp=value=>{const time=Date.parse(value);return Number.isFinite(time)?time:0;};
const activity=record=>Math.max(timestamp(record.createdAt),timestamp(record.updatedAt));
const idOrder=(a,b)=>String(a.id)<String(b.id)?-1:String(a.id)>String(b.id)?1:0;
const readable=value=>String(value||'Earlier contribution').replace(/[_-]+/g,' ').replace(/^./,c=>c.toUpperCase());
const isResponse=record=>record?.kind==='reply'||record?.kind==='interaction'&&record.action==='respond'||record?.kind==='reflection'&&record.action==='outcome';

// A withdrawal of the most recent assessment clears it; it must not silently
// resurrect an older opinion. The original records remain available in history.
export function nodeAssessment(workspace,comparisonId,target,authorId){
  const thread=workspace.comparisonThreads?.find(t=>t.id===comparisonId),source=accessibleSource(workspace,target);
  const empty={state:'unassessed',label:'Not assessed',record:null,needsReview:false,authorId};
  if(!source||!thread?.participants.includes(authorId)||source.map.ownerId===authorId||![thread.aMapId,thread.bMapId].includes(target.mapId))return empty;
  const record=(workspace.discussions||[]).filter(r=>r.comparisonId===comparisonId&&r.authorId===authorId&&r.kind==='interaction'&&r.interaction?.mode==='compare'&&['endorse','disagree','decline'].includes(r.action)&&sameCounterpartSource(r.target,target)).sort((a,b)=>timestamp(b.createdAt)-timestamp(a.createdAt)||idOrder(b,a))[0];
  if(!record||record.status!=='active')return empty;
  const state={endorse:'agree',disagree:'disagree',decline:'no-position'}[record.action];
  return {state,label:interactionLabel(record),record,needsReview:discussionHealth(workspace,record).needsReview,authorId};
}

export function counterpartAssessment(workspace,comparisonId,target){
  const display=counterpartDisplay(workspace,comparisonId,target);
  return display&&['agree','disagree'].includes(display.state)?display:null;
}

// A display state is not a new opinion or relationship record. In particular,
// missing information must never acquire the meaning of an explicit disagreement.
export function counterpartDisplay(workspace,comparisonId,target){
  const pairs=counterpartState(workspace,comparisonId,target).pairs;
  if(pairs.length!==1)return null;
  const other=pairs[0].other,source=accessibleSource(workspace,target),opposite=accessibleSource(workspace,other);
  if(!source||!opposite||source.map.ownerId===opposite.map.ownerId||target.type!=='node'||other.type!=='node')return null;
  if([target,other].some(t=>!workspace.maps.find(m=>m.id===t.mapId)?.nodes.find(n=>n.id===t.nodeId)?.parent))return null;
  const reverse=counterpartState(workspace,comparisonId,other).pairs;
  if(reverse.length!==1||!sameCounterpartSource(reverse[0].other,target))return null;
  const a=nodeAssessment(workspace,comparisonId,target,opposite.map.ownerId),b=nodeAssessment(workspace,comparisonId,other,source.map.ownerId);
  const state=a.needsReview||b.needsReview?'review':[a,b].some(s=>s.state==='unassessed')?'unassessed':a.state===b.state?a.state:'mixed';
  const label={agree:'Both agree',disagree:'Both disagree','no-position':'Both no position',mixed:'Mixed positions',unassessed:'Awaiting assessment',review:'Needs review'}[state];
  return {state,label,assessments:[a,b],target,other};
}

export const isConversationRoot=record=>!!record&&record.kind!=='context'&&!isResponse(record);

// Categories describe presentation, not a conversion to the earlier grammar.
export function interactionCategory(record){
  if(isResponse(record))return 'responses';
  if(record?.kind==='interaction')return {compare:'positions',inquiry:'questions',argument:'challenges'}[record.interaction?.mode]||'earlier';
  if(record?.kind==='relationship')return 'positions';
  if(record?.kind==='inquiry')return 'questions';
  if(record?.kind==='counterpart')return 'counterparts';
  if(record?.kind==='argument')return record.action==='reason'?'reasons':'challenges';
  return 'earlier';
}

function recordContext(records){
  const byId=new Map(records.map(record=>[record.id,record])),modeCache=new Map(),anchorCache=new Map();
  const modeOf=record=>{
    if(!record)return 'compare';
    if(modeCache.has(record.id))return modeCache.get(record.id);
    const seen=new Set(),path=[];let current=record,mode='compare';
    while(current&&!seen.has(current.id)){
      if(modeCache.has(current.id)){mode=modeCache.get(current.id);break;}
      seen.add(current.id);path.push(current.id);
      if(current.kind==='interaction'&&modes.has(current.interaction?.mode)){mode=current.interaction.mode;break;}
      if(current.kind==='inquiry'){mode='inquiry';break;}
      if(['argument','reflection'].includes(current.kind)||current.kind==='reply'&&current.layer==='arguments'||current.target?.type==='inference'){mode='argument';break;}
      if(!parentTarget(current.target))break;
      current=byId.get(current.target.entryId);
    }
    for(const id of path)modeCache.set(id,mode);
    return mode;
  };
  const anchorOf=record=>{
    if(!record)return null;
    if(anchorCache.has(record.id))return anchorCache.get(record.id);
    const seen=new Set(),path=[];let current=record,anchor=null;
    while(current&&!seen.has(current.id)){
      if(anchorCache.has(current.id)){anchor=anchorCache.get(current.id);break;}
      seen.add(current.id);path.push(current.id);
      if(!parentTarget(current.target)){anchor=current.target||null;break;}
      const parent=byId.get(current.target.entryId);
      if(!parent)break;
      if(['relationship','correspondence'].includes(parent.kind)){anchor=current.target;break;}
      current=parent;
    }
    for(const id of path)anchorCache.set(id,anchor);
    return anchor;
  };
  return {byId,modeOf,anchorOf};
}

export const entryMode=(records,record)=>recordContext(records).modeOf(record);

function accessibleSource(workspace,target){
  const map=(workspace.maps||[]).find(candidate=>candidate.id===target?.mapId&&!candidate.unavailable);
  if(!map)return null;
  const nodes=map.nodes||[];
  if(target.type==='node'){const node=nodes.find(candidate=>candidate.id===target.nodeId);return node?{map,label:node.title}:null;}
  if(target.type==='edge'){
    const edge=graphEdges(nodes,map.relations||[]).find(candidate=>candidate.id===target.edgeId);
    return edge?{map,label:`${nodes.find(node=>node.id===edge.from)?.title||'Node'} → ${nodes.find(node=>node.id===edge.to)?.title||'Node'}`}:null;
  }
  return null;
}

function referenceText(workspace,record){
  const reference=record.interaction?.reference;
  if(!reference)return '';
  const source=accessibleSource(workspace,reference.target),thread=workspace.comparisonThreads?.find(item=>item.id===record.comparisonId);
  // The server is the authority for access. This additional check prevents a
  // stale client record from indexing a saved snapshot after access refresh.
  if(!source||!thread?.participants?.length||!thread.participants.every(id=>source.map.ownerId===id||source.map.visibility==='shared'))return '';
  const wording=reference.snapshot?.wording;
  return [reference.snapshot?.label,...['title','summary','details','sourceTitle','sourceUrl'].map(key=>wording?.[key])].filter(Boolean).join(' ');
}

function present(workspace,record,context,authorName){
  const response=isResponse(record),category=interactionCategory(record),mode=context.modeOf(record),anchor=context.anchorOf(record);
  const metadata=record.interaction;
  // Saved classification keeps an earlier ground intelligible when its source
  // moves frame, loses a citation, or is subsequently revised.
  const options=record.kind==='interaction'?optionsForClassification(metadata?.classification,record.action,metadata?.version):[];
  const choices=(metadata?.options||[]).map(id=>options.find(option=>option.id===id)?.label||readable(id));
  const actionLabel=interactionLabel(record),label=record.kind==='interaction'?(response?(choices[0]||'Response'):actionLabel==='Interaction'?readable(record.action):actionLabel):DISCUSSION_LABELS[record.action]||readable(record.action);
  const anchorRecord=parentTarget(anchor)?context.byId.get(anchor.entryId):null;
  const source=accessibleSource(workspace,anchorRecord?.target||anchor);
  const targetLabel=source?(record.targetLabel||source.label):'Unavailable source';
  const compactChoices=choices.slice(0,2).join(' · ')+(choices.length>2?` · +${choices.length-2} more`:'');
  const detail=[metadata?.otherText,record.body].filter(value=>typeof value==='string'&&value.trim()).join(' · ');
  const preview=[response?'':compactChoices,detail].filter(Boolean).join(' — ')||targetLabel;
  const earlierMetadata=record.kind==='reflection'?[readable(record.reflection?.category),readable(record.reflection?.result),record.reflection?.nextStep]:[];
  // Never stringify interaction metadata: Signals and redacted history are
  // deliberately absent, and references are indexed only while accessible.
  const searchText=[label,...choices,detail,authorName(record.authorId),targetLabel,source?.label,referenceText(workspace,record),...earlierMetadata,...['title','summary','details'].map(key=>record.premise?.wording?.[key])].filter(Boolean).join(' ').toLocaleLowerCase();
  return {label,choices,preview,searchText,mode,anchor,response,category};
}

export function interactionPresentation(workspace,record,{authorName=id=>id}={}){
  return present(workspace,record,recordContext(workspace.discussions||[]),authorName);
}

export function conversationThreads(records,{mode,history=false}={}){
  const context=recordContext(records),latest=new Map(),children=new Map();
  // Responses (including those to a withdrawn initiator) affect the activity
  // of their thread, but never become additional counted threads themselves.
  for(const record of context.byId.values()){latest.set(record.id,activity(record));const parent=parentTarget(record.target)&&context.byId.get(record.target.entryId);if(parent)children.set(parent.id,(children.get(parent.id)||0)+1);}
  const pending=[...context.byId.values()].filter(record=>!children.has(record.id));
  for(let index=0;index<pending.length;index++){
    const record=pending[index],parent=parentTarget(record.target)&&context.byId.get(record.target.entryId);
    if(!parent)continue;
    latest.set(parent.id,Math.max(latest.get(parent.id),latest.get(record.id)));
    children.set(parent.id,children.get(parent.id)-1);if(children.get(parent.id)===0)pending.push(parent);
  }
  return [...context.byId.values()].filter(record=>isConversationRoot(record)&&record.status===(history?'withdrawn':'active')&&(!mode||context.modeOf(record)===mode)).sort((a,b)=>(latest.get(b.id)||0)-(latest.get(a.id)||0)||idOrder(a,b));
}

export function searchInteractions(workspace,records,{mode,query='',filter='all',authorName=id=>id,limit=50}={}){
  const context=recordContext(workspace.discussions||[]),words=String(query).trim().toLocaleLowerCase().split(/\s+/).filter(Boolean),results=[];
  // Use current projected records, not stale copies retained by a search UI.
  const selected=new Set(records.map(record=>record.id));
  for(const record of context.byId.values()){
    if(!selected.has(record.id)||record.kind==='context'||record.status!=='active')continue;
    const presentation=present(workspace,record,context,authorName);
    if(mode&&presentation.mode!==mode)continue;
    if(filter==='disputes'&&(!isConversationRoot(record)||presentation.category!=='challenges'))continue;
    if(!words.every(word=>presentation.searchText.includes(word)))continue;
    results.push({entry:record,...presentation});
  }
  results.sort((a,b)=>activity(b.entry)-activity(a.entry)||idOrder(a.entry,b.entry));
  return {results:results.slice(0,Math.max(1,Number.isFinite(limit)?Math.floor(limit):50)),total:results.length};
}
