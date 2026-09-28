import assert from 'node:assert/strict';
import {initialWorkspace,createMap,validateWorkspace,recordComparison,comparisonHealth} from '../dist/workspace.mjs';
import {createOwnedMap,synchronizeIdeas,scopeNodeIds,transferNodes,endorseNodes,endorsementIndex,nodeEndorsements,endorsementHealth,withdrawEndorsement,derivePodMap,commonEndorsers} from '../dist/adoption.mjs';
const clone=value=>JSON.parse(JSON.stringify(value));

// Existing workspaces gain shared identities without changing old comparison judgments.
const oldA=createMap('First','A',true),oldB=createMap('Second','B',true),legacy={schemaVersion:1,maps:[oldA,oldB],comparisons:[]};
const oldComparison=recordComparison(legacy,{aMapId:oldA.id,bMapId:oldB.id,aNodeId:'a211',bNodeId:'a211',questionStatus:'matched',question:'Which step comes first?',answerStatus:'aligned',notes:''});legacy.comparisons.push(oldComparison);
const oldSnapshot=clone(oldComparison);validateWorkspace(legacy);assert.equal(legacy.schemaVersion,6);assert.deepEqual(legacy.comparisons[0],oldSnapshot);assert(!comparisonHealth(legacy,oldComparison).needsReview);

const w=initialWorkspace(),[a,b,ref]=w.maps,source=ref.nodes.find(n=>n.kind==='position'),originalCount=w.endorsements.length;
assert.equal(ref.mapType,'reference');assert.equal(ref.ownerId,a.ownerId);assert.notEqual(ref.id,a.id);assert.equal(originalCount,0,'Authorship and copied content do not fabricate endorsements');
const target=createOwnedMap(w,{name:'A blank personal map',ownerId:a.ownerId});
const selected=[source.id],record=endorseNodes(w,{participantId:a.ownerId,sourceMapId:ref.id,nodeIds:selected,targetMapId:target.id});
const linked=target.nodes.find(n=>n.ideaId===source.ideaId);assert(linked);assert.equal(linked.ideaVersion,source.ideaVersion);assert.equal(linked.confidence,null);assert.equal(target.nodes.length,4,'A single co-sign adds no surrounding nodes');
assert.equal(nodeEndorsements(endorsementIndex(w),source).current.size,1);
endorseNodes(w,{participantId:a.ownerId,sourceMapId:ref.id,nodeIds:selected,targetMapId:target.id});
assert.equal(target.nodes.length,4,'Repeated adoption reuses the placement');assert.equal(nodeEndorsements(endorsementIndex(w),source).current.size,1,'One person is counted once across repeated co-signs');
const bRecord=endorseNodes(w,{participantId:b.ownerId,sourceMapId:ref.id,nodeIds:selected});assert.equal(nodeEndorsements(endorsementIndex(w),source).current.size,2);
const allPeople=w.participants.map(p=>p.id),pod=derivePodMap(w,ref.id,allPeople,2);assert(pod.matched.has(source.id));assert(pod.map.nodes.some(n=>n.parent===null&&n.podContext),'Frames are context, not shared commitments');

// Copies are independently editable and keep attribution to the exact old version.
const copyTarget=createOwnedMap(w,{name:'An alternative reference',ownerId:b.ownerId,mapType:'reference'});
const copied=transferNodes(w,{sourceMapId:ref.id,targetMapId:copyTarget.id,nodeIds:selected,mode:'copy'});const adapted=copyTarget.nodes.find(n=>n.id===copied.added[0]);
assert.notEqual(adapted.ideaId,source.ideaId);assert.equal(adapted.copiedFrom.ideaId,source.ideaId);assert.equal(nodeEndorsements(endorsementIndex(w),adapted).current.size,0);
adapted.summary='My own interpretation.';synchronizeIdeas(w,copyTarget);assert.notEqual(adapted.summary,source.summary);validateWorkspace(w);

// Old wording remains pinned; review explicitly changes the personal placement and the consent record.
const previousWording=linked.summary,previousVersion=linked.ideaVersion,linkedId=linked.id;
source.summary+=' A meaningful clarification.';ref.revision++;synchronizeIdeas(w,ref);
assert.equal(linked.summary,previousWording);assert.equal(linked.ideaVersion,previousVersion);assert(endorsementHealth(w,record).needsReview);assert.equal(nodeEndorsements(endorsementIndex(w),source).current.size,0);
const beforeInvalid=JSON.stringify(target);assert.throws(()=>endorseNodes(w,{participantId:a.ownerId,sourceMapId:ref.id,nodeIds:selected,targetMapId:b.id}),/own personal map/);assert.equal(JSON.stringify(target),beforeInvalid);
const reviewed=endorseNodes(w,{participantId:a.ownerId,sourceMapId:ref.id,nodeIds:selected,targetMapId:target.id,replaceId:record.id});
assert.equal(record.status,'superseded');assert.equal(record.entries[0].version,previousVersion);assert.equal(target.nodes.find(n=>n.id===linkedId).ideaVersion,source.ideaVersion);assert.equal(target.nodes.length,4);assert(!endorsementHealth(w,reviewed).needsReview);assert.equal(nodeEndorsements(endorsementIndex(w),source).current.size,1);
withdrawEndorsement(w,reviewed.id,a.ownerId);assert.equal(nodeEndorsements(endorsementIndex(w),source).current.size,0);assert.equal(reviewed.status,'withdrawn');assert.equal(bRecord.status,'active');

// A personal edit forks identity, preserving the source and flagging the former co-sign.
const latest=endorseNodes(w,{participantId:a.ownerId,sourceMapId:ref.id,nodeIds:selected,targetMapId:target.id});const personal=target.nodes.find(n=>n.id===linkedId),originalIdea=personal.ideaId;
personal.summary='I now hold a different view.';synchronizeIdeas(w,target);assert.notEqual(personal.ideaId,originalIdea);assert.equal(personal.copiedFrom.ideaId,originalIdea);assert(endorsementHealth(w,latest).issues.includes('Personal version changed'));assert.equal(nodeEndorsements(endorsementIndex(w),source).current.size,0);

// Whole-map consent is an exact set. New nodes do not inherit old endorsements.
const mapRecord=endorseNodes(w,{participantId:b.ownerId,sourceMapId:ref.id,nodeIds:scopeNodeIds(ref,'map'),scope:'map'}),oldSize=mapRecord.entries.length;
ref.nodes.push({...clone(source),id:'new-reference-node',parent:'goal',title:'A newly added goal',structuralType:'nesting',ideaId:undefined,ideaVersion:undefined,copiedFrom:null});synchronizeIdeas(w,ref);
assert.equal(mapRecord.entries.length,oldSize);assert(endorsementHealth(w,mapRecord).issues.includes('Section or map membership changed'));assert.equal(nodeEndorsements(endorsementIndex(w),ref.nodes.at(-1)).current.size,0);

// Per-node majorities are not treated as one group endorsing the whole set.
const c=createOwnedMap(w,{name:'C’s worldview',personName:'C'}),second=ref.nodes.find(n=>n.parent!==null&&n.id!==source.id&&n.id!=='new-reference-node');
endorseNodes(w,{participantId:c.ownerId,sourceMapId:ref.id,nodeIds:[source.id]});endorseNodes(w,{participantId:a.ownerId,sourceMapId:ref.id,nodeIds:[second.id]});
const index=endorsementIndex(w),cohort=commonEndorsers(index,[source,second]);assert(cohort.has(b.ownerId));assert(!cohort.has(a.ownerId));assert(!cohort.has(c.ownerId));
assert.equal(derivePodMap(w,ref.id,[],1).matched.size,0);

// A section can be copied with its hierarchy while excluded parents remain unendorsed.
const branch=ref.nodes.find(n=>n.parent!==null&&ref.nodes.some(p=>p.parent===n.id)),branchIds=scopeNodeIds(ref,'section',branch.id),branchTarget=createOwnedMap(w,{name:'Branch copy',ownerId:c.ownerId});
const transfer=transferNodes(w,{sourceMapId:ref.id,targetMapId:branchTarget.id,nodeIds:branchIds,mode:'copy'});assert.equal(transfer.added.length,branchIds.length);assert.equal(branchTarget.nodes.length,branchIds.length+3);validateWorkspace(w);
const reopened=validateWorkspace(clone(w));assert.deepEqual(reopened,w,'Portable files retain people, shared versions, source attribution and endorsement history');
const damaged=clone(w);damaged.maps[0].nodes.find(n=>n.parent!==null).summary='Tampered without a version';assert.throws(()=>validateWorkspace(damaged),/saved shared wording/);
const wrongPerson=clone(w);wrongPerson.endorsements[0].participantId='missing';assert.throws(()=>validateWorkspace(wrongPerson),/co-sign record/);

// Whole-map copies are independent, preserve your assessments and frame details,
// and do not attribute another author's confidence to the new owner.
const copies=initialWorkspace(),original=copies.maps[0],content=original.nodes.filter(n=>n.parent!==null);
content[0].confidence=73;content[1].confidence=0;content[2].confidence=null;
original.nodes.find(n=>n.id==='status').summary='My map-specific frame explanation.';
const originalBefore=clone(original),priorRecords={comparisons:clone(copies.comparisons),endorsements:clone(copies.endorsements),discussions:clone(copies.discussions),definitions:clone(copies.definitions)};
const duplicate=createOwnedMap(copies,{name:'My independent duplicate',ownerId:original.ownerId,fromMapId:original.id});
assert.deepEqual(original,originalBefore,'Duplicating a map never changes the original');assert.notEqual(duplicate.id,original.id);
assert.deepEqual(duplicate.nodes.filter(n=>n.parent===null),original.nodes.filter(n=>n.parent===null),'Frame details are copied too');
assert.equal(duplicate.nodes.length,original.nodes.length);assert.equal(duplicate.relations.length,original.relations.length);
const copiedNodes=new Map(duplicate.nodes.filter(n=>n.parent!==null).map(n=>[n.copiedFrom.nodeId,n]));
for(const n of content){const copy=copiedNodes.get(n.id);assert.notEqual(copy.id,n.id);assert.notEqual(copy.ideaId,n.ideaId);assert.equal(copy.confidence,n.confidence);assert.equal(copy.title,n.title);assert.equal(copy.summary,n.summary);assert.equal(copy.sourceTitle,n.sourceTitle);assert.equal(copy.sourceUrl,n.sourceUrl);assert.equal(copy.parent,copiedNodes.get(n.parent)?.id||n.parent);assert.equal(copy.structuralType,n.structuralType);assert.deepEqual(copy.copiedFrom,{ideaId:n.ideaId,version:n.ideaVersion,mapId:original.id,nodeId:n.id});}
for(const edge of original.relations)assert(duplicate.relations.some(e=>e.id!==edge.id&&e.from===copiedNodes.get(edge.from).id&&e.to===copiedNodes.get(edge.to).id&&e.type===edge.type&&e.note===edge.note),'Semantic connections retain direction, type and note');
assert.deepEqual({comparisons:copies.comparisons,endorsements:copies.endorsements,discussions:copies.discussions,definitions:copies.definitions},priorRecords,'Copying creates no co-signs, conversations, comparisons or definitions');
const otherOwner=copies.participants.find(p=>p.id!==original.ownerId).id,adaptedMap=createOwnedMap(copies,{name:'Another author’s adaptation',ownerId:otherOwner,fromMapId:original.id});
assert(adaptedMap.nodes.filter(n=>n.parent!==null).every(n=>n.confidence===null),'Someone else’s assessments remain unassessed in your copy');
copiedNodes.get(content[0].id).summary='Only the duplicate changes.';synchronizeIdeas(copies,duplicate);assert.deepEqual(original,originalBefore);validateWorkspace(copies);
const empty=createOwnedMap(copies,{name:'An empty source',ownerId:original.ownerId});empty.nodes[0].summary='A custom empty frame';
const emptyCopy=createOwnedMap(copies,{name:'An empty duplicate',ownerId:original.ownerId,fromMapId:empty.id});assert.deepEqual(emptyCopy.nodes,empty.nodes);assert.equal(emptyCopy.relations.length,0);validateWorkspace(copies);
const unavailable=clone(copies);unavailable.maps.find(m=>m.id===original.id).unavailable=true;const unavailableBefore=clone(unavailable);assert.throws(()=>createOwnedMap(unavailable,{name:'Unavailable duplicate',personName:'Do not add this participant',fromMapId:original.id}),/unavailable/);assert.deepEqual(unavailable,unavailableBefore);
const invalid=clone(copies);invalid.maps.find(m=>m.id===original.id).relations[0].to='missing-node';const invalidBefore=clone(invalid);assert.throws(()=>createOwnedMap(invalid,{name:'Invalid duplicate',personName:'Do not add this participant',fromMapId:original.id}));assert.deepEqual(invalid,invalidBefore,'A rejected copy leaves no partial map, participant, or wording identities');
console.log('PASS: v1 migration and comparison continuity; separate reference maps; exact-scope adoption; identity and copy attribution; unique-person counts; pinned versions, review and withdrawal; set intersections; branch copying; portable endorsement history; independent whole-map copies, authored confidence, empty sources and atomic failures.');
