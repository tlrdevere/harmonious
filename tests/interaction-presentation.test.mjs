import assert from 'node:assert/strict';
import {entryMode,isConversationRoot,interactionCategory,interactionPresentation,conversationThreads,searchInteractions} from '../dist/interaction-presentation.mjs';

const target={type:'node',mapId:'bob-map',nodeId:'claim'},referenceTarget={type:'node',mapId:'reference-map',nodeId:'reference'};
const classification={targetType:'node',frame:'status',edgeType:null,hasSource:true,parentAction:null};
const date=day=>`2026-09-${String(day).padStart(2,'0')}T00:00:00Z`;
const make=(id,action,mode,options=[],extra={})=>({id,kind:'interaction',action,target,comparisonId:'thread',authorId:'alice',targetLabel:'Original source title',body:'',createdAt:date(1),updatedAt:date(1),status:'active',interaction:{mode,classification,options,otherText:'',reference:null,signals:[{optionId:'false',tag:'INTERNAL_SIGNAL_DO_NOT_INDEX'}]},...extra});
const respond=(id,parent,outcome,extra={})=>make(id,'respond',parent.interaction.mode,[outcome],{target:{type:'entry',entryId:parent.id},authorId:'bob',targetLabel:parent.action,interaction:{mode:parent.interaction.mode,classification:{...classification,targetType:'entry',hasSource:false,parentAction:parent.action},options:[outcome],otherText:'',reference:null},...extra});
const earlier=(id,kind,action,extra={})=>({id,kind,action,target,comparisonId:'thread',authorId:'alice',targetLabel:'Original source title',body:'',status:'active',createdAt:date(1),updatedAt:date(1),...extra});
const workspace={maps:[{id:'bob-map',ownerId:'bob',visibility:'shared',nodes:[{id:'claim',title:'Current source title',parent:'goal'}],relations:[]},{id:'reference-map',ownerId:'alice',visibility:'shared',nodes:[{id:'reference',title:'Current reference title',parent:'status'}],relations:[]}],comparisonThreads:[{id:'thread',participants:['alice','bob']}],discussions:[]};
const dispute=make('dispute','dispute','argument',['false','data_outdated','other']);dispute.interaction.otherText='Unspecified ambiguity in comparison';
const request=make('request','request_reason','inquiry',['source']);
const endorsement=make('endorsement','endorse','compare',['already_hold']);
const legacyQuestion=earlier('legacy-question','inquiry','question');
const legacyReply=earlier('legacy-reply','reply','reply',{target:{type:'entry',entryId:legacyQuestion.id},layer:'inquiries'});
const legacyNestedReply=earlier('legacy-nested-reply','reply','reply',{target:{type:'entry',entryId:legacyReply.id},layer:'inquiries'});
const legacyChallenge=earlier('legacy-challenge','argument','fallacy');
const legacyResolve=earlier('legacy-resolve','reply','resolve',{target:{type:'entry',entryId:legacyChallenge.id},layer:'arguments'});
const counterpart=earlier('counterpart','counterpart','counterpart');
const counterpartReply=earlier('counterpart-reply','reply','no_position',{target:{type:'entry',entryId:counterpart.id},layer:'inquiries'});
const reflection=earlier('reflection','reflection','disagreement_point');
const outcome=earlier('reflection-outcome','reflection','outcome',{target:{type:'entry',entryId:reflection.id},reflection:{result:'difference_understood',nextStep:'Discuss later'}});
workspace.discussions=[dispute,request,endorsement,legacyQuestion,legacyReply,legacyNestedReply,legacyChallenge,legacyResolve,counterpart,counterpartReply,reflection,outcome];
const before=structuredClone(workspace),present=interactionPresentation(workspace,dispute,{authorName:id=>id==='alice'?'Alice':'Bob'});
assert.deepEqual(present.choices,["It's false",'The data is outdated','Other'],'Saved status and citation classification survives a move to Goal State without a citation');
assert.equal(present.preview,"It's false · The data is outdated · +1 more — Unspecified ambiguity in comparison");
assert.equal(present.category,'challenges');assert.equal(present.mode,'argument');assert.deepEqual(present.anchor,target);
for(const query of ['false','outdated','unspecified ambiguity','Alice','Original source title','Current source title'])assert.equal(searchInteractions(workspace,workspace.discussions,{query,mode:'argument',authorName:id=>id==='alice'?'Alice':'Bob'}).results.some(item=>item.entry.id===dispute.id),true,query);
assert.equal(searchInteractions(workspace,workspace.discussions,{query:'INTERNAL_SIGNAL_DO_NOT_INDEX'}).total,0,'Signals are absent from both text and search');
assert.equal(entryMode(workspace.discussions,legacyNestedReply),'inquiry');assert.equal(entryMode(workspace.discussions,counterpartReply),'compare');assert.equal(entryMode(workspace.discussions,outcome),'argument');
assert.equal(interactionCategory(legacyChallenge),'challenges');assert.equal(interactionCategory(counterpart),'counterparts');assert.equal(interactionCategory(reflection),'earlier');
assert.equal(isConversationRoot(legacyReply),false);assert.equal(isConversationRoot(outcome),false);assert.equal(isConversationRoot(earlier('context','context','context')),false);
assert.deepEqual(workspace,before,'Presentation never rewrites stored records');

// Each reply shows its outcome. No selected outcome implicitly closes a dispute.
for(const [parent,outcomes] of [[dispute,{accept:'Accept',partly_accept:'Partly accept',reject:'Reject',misrepresented:"You've misrepresented my claim",other:'Other'}],[request,{answer:'Answer',dont_know:"I don't know",other:'Other'}],[make('proposal','propose_alternative','inquiry'),{accept:'Accept',reject:'Reject',other:'Other'}]]){
  for(const [value,label] of Object.entries(outcomes)){
    const reply=respond(`reply-${parent.id}-${value}`,parent,value,{body:'My explanation'});workspace.discussions.push(reply);
    const p=interactionPresentation(workspace,reply);assert.equal(p.label,label);assert.equal(p.response,true);assert.equal(p.category,'responses');assert.equal(p.preview,'My explanation');assert.equal(isConversationRoot(reply),false);
    assert(searchInteractions(workspace,[reply],{query:label,mode:parent.interaction.mode}).results.some(item=>item.entry.id===reply.id));
  }
}
const filtered=searchInteractions(workspace,workspace.discussions,{filter:'disputes',mode:'argument'});
assert.deepEqual(filtered.results.map(item=>item.entry.id),['dispute','legacy-challenge'],'Initiating new and old disputes remain discoverable after replies, including an old Resolve');
assert.equal(searchInteractions(workspace,workspace.discussions,{mode:'compare'}).results.some(item=>item.entry.id===request.id),false);
assert.equal(searchInteractions(workspace,workspace.discussions,{mode:'inquiry'}).results.some(item=>item.entry.id===legacyNestedReply.id),true);
const limited=searchInteractions(workspace,workspace.discussions,{limit:2});assert.equal(limited.results.length,2);assert(limited.total>2);
assert.deepEqual(searchInteractions(workspace,[...workspace.discussions].reverse()).results.map(item=>item.entry.id),searchInteractions(workspace,workspace.discussions).results.map(item=>item.entry.id),'Search ties are deterministic');
const unknown=make('old-option','dispute','argument',['former_option']);assert.equal(interactionPresentation(workspace,unknown).choices[0],'Former option');

const retired=make('retired','dispute','argument',['false'],{status:'withdrawn',updatedAt:date(20)}),activeReply=respond('active-reply',retired,'partly_accept',{updatedAt:date(21)}),newer=make('newer','dispute','argument',['false'],{createdAt:date(18),updatedAt:date(18)}),recentReply=respond('recent-reply',dispute,'reject',{updatedAt:date(22)});
workspace.discussions.push(retired,activeReply,newer,recentReply);
const roots=conversationThreads([...workspace.discussions,dispute],{mode:'argument'});
assert.equal(roots[0].id,dispute.id,'Latest descendant activity ranks the thread');assert.equal(roots.filter(item=>item.id===dispute.id).length,1,'Repeated records do not inflate counts');assert(!roots.some(item=>item.id===retired.id));
assert.deepEqual(conversationThreads(workspace.discussions,{mode:'argument',history:true}).map(item=>item.id),[retired.id]);
assert(searchInteractions(workspace,workspace.discussions,{mode:'argument',query:'partly accept'}).results.some(item=>item.entry.id===activeReply.id),'Active responses survive a withdrawn initiator');
assert(!searchInteractions(workspace,workspace.discussions).results.some(item=>item.entry.id===retired.id));

const cited=make('cited','offer_reason','inquiry');cited.interaction.reference={target:referenceTarget,snapshot:{label:'Saved reference title',wording:{title:'Saved reference title',summary:'Distinctive earlier wording',details:'Additional historical details',sourceTitle:'Readable citation',sourceUrl:'https://example.test/reference'}}};workspace.discussions.push(cited);
assert.equal(searchInteractions(workspace,[cited],{query:'distinctive earlier wording'}).total,1,'Accessible saved reference wording remains searchable after edits');
workspace.maps[1].visibility='private';
assert.equal(searchInteractions(workspace,[cited],{query:'distinctive earlier wording'}).total,0,'A stale snapshot cannot leak a reference that is no longer shared with both participants');
workspace.maps[1].visibility='shared';workspace.maps[1].unavailable=true;
assert.equal(searchInteractions(workspace,[cited],{query:'Saved reference title'}).total,0,'Unavailable placeholders do not disclose snapshots');
delete workspace.maps[1].unavailable;workspace.maps[1].nodes=[];
assert.equal(searchInteractions(workspace,[cited],{query:'Readable citation'}).total,0,'Removed referenced nodes do not disclose snapshots');
workspace.discussions=workspace.discussions.filter(record=>record.id!==cited.id);
assert.equal(searchInteractions(workspace,[cited],{query:'offer reason'}).total,0,'Records removed by the access projection cannot survive in cached search input');
workspace.maps[0].unavailable=true;
assert(!interactionPresentation(workspace,dispute).searchText.includes('original source title'),'An unavailable source does not index stale target wording');

// Defensive handling for broken imported ancestry is bounded rather than
// recursive. Valid long reply chains also preserve mode and latest activity.
const cycleA=earlier('cycle-a','reply','reply',{target:{type:'entry',entryId:'cycle-b'}}),cycleB=earlier('cycle-b','reply','reply',{target:{type:'entry',entryId:'cycle-a'}});
assert.equal(entryMode([cycleA,cycleB],cycleA),'compare');assert.equal(interactionPresentation({...workspace,discussions:[cycleA,cycleB]},cycleA).anchor,null);
const chain=[request];for(let i=0;i<1000;i++)chain.push(earlier(`chain-${i}`,'reply','reply',{target:{type:'entry',entryId:chain.at(-1).id},updatedAt:date(23)}));
assert.equal(entryMode(chain,chain.at(-1)),'inquiry');assert.deepEqual(conversationThreads(chain,{mode:'inquiry'}).map(item=>item.id),[request.id]);
console.log('Interaction presentation passed: saved grounds, response outcomes, mode ancestry, root counts, latest activity, withdrawn history, scoped search, reference privacy, stable ordering, and bounded ancestry.');
