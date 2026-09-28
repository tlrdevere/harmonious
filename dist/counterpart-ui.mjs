import {comparisonCounterparts,counterpartFrame,counterpartLinks,counterpartState,counterpartRequestState,sameCounterpartSource} from './counterparts.mjs';
import {makeDiscussion,discussionSource,discussionSourceSnapshot} from './discussion.mjs';
import {comparisonNodeKey,comparisonEndpoint,COUNTERPART_W,COUNTERPART_H} from './comparison-layout.mjs';
import {newId,validateWorkspace} from './workspace.mjs';
import {synchronizeIdeas} from './adoption.mjs';
import {stableJSON} from './account-model.mjs';
import {actualNodePairKey} from './conversation-tree.mjs';
const cpEl=(tag,text='',cls='')=>{const e=document.createElement(tag);e.textContent=text;e.className=cls;return e;};
const cpButton=(text,run)=>{const b=cpEl('button',text);b.type='button';b.onclick=run;return b;};
const counterpartPath=(map,node)=>{const parts=[node.title],seen=new Set([node.id]);while(node.parent){node=map.nodes.find(p=>p.id===node.parent);if(!node||seen.has(node.id))break;seen.add(node.id);parts.unshift(node.title);}return parts.join(' › ');};
const counterpartReviewSnapshot=(workspace,target)=>{const source=discussionSource(workspace,target);if(!source)return null;const path=[],seen=new Set();let node=source.item;while(node&&!seen.has(node.id)){seen.add(node.id);path.unshift({id:node.id,parent:node.parent,title:node.title});node=source.map.nodes.find(n=>n.id===node.parent);}return {source:discussionSourceSnapshot(workspace,target),mapName:source.map.name,ownerId:source.map.ownerId,path};};

export class CounterpartUI{
  constructor(d){this.d=d;this.c=d.c;this.canvas=d.canvas;this.canvas.options.counterparts=()=>comparisonCounterparts(this.c.workspace,this.canvas.states);}
  requests(target){return this.state(target).requests;}
  links(target){return counterpartLinks(this.c.workspace,this.d.thread()?.id).filter(r=>sameCounterpartSource(r.target,target)||sameCounterpartSource(r.other,target));}
  state(target){const sideOf=t=>['a','b'].find(s=>this.canvas.states[s].map?.id===t.mapId),point=t=>this.canvas.layout.maps[sideOf(t)]?.positions.get(t.nodeId);return counterpartState(this.c.workspace,this.d.thread()?.id,target,{endpoint:other=>{const side=sideOf(other);return side?comparisonEndpoint(this.canvas.layout,side,other.nodeId):{status:'unavailable'};},adjacent:other=>!!point(target)?.groupId&&point(target).groupId===point(other)?.groupId});}
  pairs(target){return this.state(target).pairs;}
  otherMap(target){return ['a','b'].map(s=>this.canvas.states[s].map).find(m=>m&&m.id!==target.mapId);}
  canLink(target){const source=discussionSource(this.c.workspace,target),map=this.otherMap(target),thread=this.d.thread();return !!source&&target.type==='node'&&source.item.parent!==null&&!!map&&!map.unavailable&&(!thread||thread.participants.includes(this.d.actor()))&&[source.map,map].some(m=>m.ownerId===this.d.actor());}
  actions(target){
    const source=discussionSource(this.c.workspace,target),map=this.otherMap(target),pairs=this.pairs(target),buttons=[];
    if(pairs.length)buttons.push(cpButton(`View linked counterparts (${pairs.length})`,()=>this.show(target)));
    if(this.canLink(target))buttons.push(cpButton(pairs.length?'Link another counterpart':'Link counterpart',()=>this.form(target,false)));
    if(this.canLink(target)&&map.ownerId===this.d.actor())buttons.push(cpButton('Create counterpart in my map',()=>this.form(target,true)));
    const request=this.requests(target).at(-1);if(request)buttons.push(cpButton('View counterpart request',()=>this.d.open(request.id)));
    else if(!pairs.length&&source?.map.ownerId===this.d.actor()&&this.canLink(target))buttons.push(cpButton('Request counterpart',()=>this.request(target)));
    return buttons;
  }
  request(target){if(!this.d.canLeave())return;this.returnControl=target;this.d.target=target;this.d.compose('counterpart','counterpart');}
  draw(){
    this.markers=[];if(!this.d.layers.map)return;
    for(const p of this.canvas.layout.placeholders||[]){
      const map=this.canvas.states[p.side].map,source=discussionSource(this.c.workspace,p.target);if(!source||!map||map.unavailable)continue;
      const state=this.state(p.target),box=cpEl('section','','counterpart-placeholder discussion-drawing');box.dataset.identity=this.canvas.identity(p.side);box.dataset.counterpartState=state.kind;box.dataset.state=state.kind;box.dataset.sourceMap=p.target.mapId;box.dataset.sourceNode=p.target.nodeId;box.dataset.sourceSide=p.sourceSide||(p.side==='a'?'b':'a');box.dataset.sourceLabel=source.label;box.dataset.counterpartSource=JSON.stringify([p.target.mapId,p.target.nodeId]);box.setAttribute('aria-label',`Counterpart for ${source.label} from ${source.map.name}; ${map.name} by ${this.d.name(map.ownerId)}`);
      box.style.width=`${p.w||COUNTERPART_W}px`;box.style.height=`${p.h||COUNTERPART_H}px`;box.title=`${state.label} · ${map.name} by ${this.d.name(map.ownerId)}`;const owner=cpEl('p',`${this.d.name(map.ownerId)}’s map`,'counterpart-map');owner.title=`${map.name} by ${this.d.name(map.ownerId)}`;box.append(cpEl('strong',state.label),owner);
      for(const event of ['pointerdown','click','dblclick'])box.addEventListener(event,e=>e.stopPropagation());
      if(this.d.mode()==='compare'){
        let label,run;if(state.pairs.length){label=state.kind==='unavailable'?'View saved details':`View linked counterparts${state.count>1?` (${state.count})`:''}`;run=()=>this.show(p.target);}
        else if(state.request){label=state.kind==='requested'&&this.canLink(p.target)&&map.ownerId===this.d.actor()?'Respond':'View request';run=()=>this.d.open(state.request.id);}
        else if(this.canLink(p.target)){label='Link counterpart';run=()=>this.form(p.target,false);}
        if(run)box.append(cpButton(label,()=>{if(this.d.dirty&&!this.d.canLeave())return;this.returnControl=p.target;run();}));
      }
      this.canvas.world.append(box);this.markers.push({box,p});
    }
    this.position();
  }
  focusReturn(target){const marker=this.markers?.find(({p})=>sameCounterpartSource(p.target,target)),button=marker?.box.querySelector('button');if(!button)return false;button.focus({preventScroll:true});return true;}
  position(){for(const {box,p}of this.markers||[]){const side=p.sourceSide||(p.side==='a'?'b':'a'),key=comparisonNodeKey(side,p.target.nodeId),now=this.canvas.positions.get(key),end=this.canvas.layout.positions.get(key);box.style.transform=`translate(${p.x+(now&&end?now.x-end.x:0)}px,${p.y+(now&&end?now.y-end.y:0)}px)`;}}
  focus(link,anchor){
    if(!this.d.canLeave())return;
    this.c.renderComparison();this.canvas.restoreAnchor(anchor);this.d.open(link.id);
  }
  show(target){
    if(!this.d.canLeave())return;const source=discussionSource(this.c.workspace,target),map=this.otherMap(target);if(!source||!map)return;
    this.returnControl=target;
    this.d.activateMode('compare');this.d.target=target;this.d.shell('Linked counterparts');this.d.host.append(cpEl('p',`For “${source.label}”. Linking counterparts does not record agreement or disagreement.`));
    const pairs=this.pairs(target);if(!pairs.length)this.d.host.append(cpEl('p','No counterpart linked.','field-help'));
    for(const pair of pairs){const other=discussionSource(this.c.workspace,pair.other),section=cpEl('section','','counterpart-linked-pair');section.dataset.counterpartNode=pair.other.nodeId;
      if(other){section.append(cpEl('h3',other.label),cpEl('p',`${this.d.name(other.map.ownerId)} · ${other.map.name}`,'discussion-byline'),cpEl('p',counterpartPath(other.map,other.item),'field-help'));const status={collapsed:'Inside a collapsed branch',filtered:'In a hidden frame','cross-frame':'In another frame',visible:'Linked counterpart'}[pair.status];section.append(cpEl('p',status||'Counterpart unavailable','discussion-state'));if(!['missing','unavailable'].includes(pair.status))section.append(cpButton('Show connected nodes',()=>this.d.showConnectedNodes({key:actualNodePairKey(pair.records[0].target,pair.records[0].other)})));}
      else section.append(cpEl('h3','Counterpart unavailable'),cpEl('p','The saved record remains available below.','field-help'));
      const details=cpEl('details');details.append(cpEl('summary','Recorded meanings and authors'));for(const record of pair.records)details.append(cpButton(`${record.kind==='correspondence'?'Counterpart link':record.action==='agreement'?'Earlier Agreement':'Earlier Disagreement'} · ${this.d.name(record.authorId)}`,()=>this.d.open(record.id)));section.append(details);this.d.host.append(section);
    }
    this.d.actionGroup('Counterparts',this.actions(target).filter(button=>!button.textContent.startsWith('View linked counterparts')));
    this.d.positionPopover();
  }
  requestActions(r){
    const projection=this.state(r.target),state=projection.count?'Counterpart linked':counterpartRequestState(this.c.workspace,r);this.d.host.append(cpEl('p',projection.count?projection.label:state,'discussion-state'));
    if(state==='Counterpart linked'){this.d.host.append(cpButton(`View linked counterparts (${this.pairs(r.target).length})`,()=>this.show(r.target)));return;}
    const own=this.canLink(r.target)&&this.otherMap(r.target)?.ownerId===this.d.actor();
    const links=[];if(this.canLink(r.target))links.push(cpButton('Link counterpart',()=>this.form(r.target,false)));if(own)links.push(cpButton('Create counterpart in my map',()=>this.form(r.target,true)));this.d.actionGroup('Counterparts',links);
    if(own){
      this.d.actionGroup('Other responses',['no_position','not_applicable'].map(action=>cpButton(action==='no_position'?'No position yet':'Not applicable',()=>this.d.compose('reply',action,null,{layer:'inquiries'}))));}
    if(this.canLink(r.target)&&r.authorId===this.d.actor()){const action=state==='Awaiting counterpart'?'close_request':'reopen_request';this.d.host.append(cpButton(action==='close_request'?'Close request':'Reopen request',()=>this.d.compose('reply',action,null,{layer:'inquiries'})));}
  }
  form(target,create){
    if(!this.d.canLeave()||!this.c.editor.beforeLeave())return;this.c.captureActive();const source=discussionSource(this.c.workspace,target),map=this.otherMap(target);if(!this.canLink(target)||create&&map.ownerId!==this.d.actor())return;
    this.returnControl=target;
    this.d.activateMode('compare');this.d.target=target;this.d.shell(create?'Create counterpart in my map':'Link counterpart');
    this.d.host.append(cpEl('p',`For “${source.label}” by ${this.d.name(source.map.ownerId)}. ${create?'Create in':'Choose from'} ${map.name} by ${this.d.name(map.ownerId)}. This links comparable material without deciding agreement.`));
    const form=cpEl('form'),pick=cpEl('select');pick.id='counterpart-node';pick.required=true;
    const candidates=map.nodes.filter(n=>create||n.parent!==null),frame=counterpartFrame(source.map,target.nodeId),search=cpEl('input');search.type='search';search.id='counterpart-search';search.placeholder='Search wording or parent path';
    if(!create){const searchLabel=cpEl('label','Find a node');searchLabel.htmlFor=search.id;form.append(searchLabel,search);}
    const pickLabel=cpEl('label',create?'Where in your map? Choose the parent.':`Node in ${map.name}`);pickLabel.htmlFor=pick.id;form.append(pickLabel,pick);
    const title=cpEl('input'),summary=cpEl('textarea');title.id='counterpart-title';title.maxLength=200;title.required=true;summary.id='counterpart-summary';summary.rows=3;summary.maxLength=10000;
    if(create)for(const [text,input]of [['Your node title',title],['Your explanation (optional)',summary]]){const l=cpEl('label',text);l.htmlFor=input.id;form.append(l,input);}
    const preview=cpEl('p','','field-help');preview.id='counterpart-preview';pick.setAttribute('aria-describedby',preview.id);form.append(preview);
    const submit=cpEl('button',create?'Create and link counterpart':'Link counterpart','primary');submit.type='submit';form.append(submit,cpButton('Cancel',()=>this.d.close()));
    const update=()=>{const n=candidates.find(n=>n.id===pick.value);submit.disabled=!n;preview.textContent=n?`${create?'New node under':'Selected'}: ${counterpartPath(map,n)}${counterpartFrame(map,n.id)!==frame?' · Different frame: the link will cross frames.':''}${!create?[n.summary,n.details].filter(Boolean).map(text=>' — '+text).join(''):''}`:candidates.length?'Choose a node before linking.':`${map.name} has no ordinary nodes to link.`;this.d.positionPopover();};
    const fill=()=>{const previous=pick.value,query=search.value.trim().toLowerCase(),matches=candidates.filter(n=>!query||`${counterpartPath(map,n)} ${n.summary} ${n.details}`.toLowerCase().includes(query));pick.replaceChildren(new Option(create?'Choose a parent…':matches.length?'Choose a node…':'No matching nodes',''));for(const n of matches)pick.append(new Option(counterpartPath(map,n),n.id));pick.value=matches.some(n=>n.id===previous)?previous:'';update();};
    search.oninput=fill;pick.onchange=update;fill();if(create&&candidates.some(n=>n.id===frame)){pick.value=frame;update();}
    if(!candidates.length){if(map.ownerId===this.d.actor())form.append(cpButton('Create counterpart in my map',()=>this.form(target,true)));else if(!this.pairs(target).length){const request=this.requests(target).at(-1);form.append(cpButton(request?'View counterpart request':'Request counterpart',()=>request?this.d.open(request.id):this.request(target)));}}
    const reviewed=counterpartReviewSnapshot(this.c.workspace,target),recordId=newId('discussion'),nodeId=newId('node');let stagedDraft=null;
    form.onsubmit=async e=>{e.preventDefault();if(this.d.saving)return;this.d.saving=true;this.d.host.inert=true;
      try{
        this.d.dirty=true;if(!this.c.editor.flushDraft())throw Error('Finish your map edit first.');this.c.captureActive();const anchor=this.canvas.captureAnchor(target);
        const thread=await this.c.ensureComparison(),chosen={type:'node',mapId:map.id,nodeId:pick.value},chosenSnapshot=counterpartReviewSnapshot({ ...this.c.workspace,maps:this.c.workspace.maps.map(m=>m.id===map.id?map:m)},chosen),draft=stableJSON({chosen,title:create?title.value.trim():'',summary:create?summary.value.trim():''});
        const prepare=workspace=>{
          const already=workspace.discussions.find(r=>r.id===recordId);if(already){if(stagedDraft!==draft)throw Error('Your earlier choice was saved, but this draft has further changes. Copy them before reopening the saved link.');return {workspace,record:already};}
          if(stableJSON(counterpartReviewSnapshot(workspace,target))!==stableJSON(reviewed)||stableJSON(counterpartReviewSnapshot(workspace,chosen))!==stableJSON(chosenSnapshot))throw Error('A source changed or is no longer available. Your draft is still here; close and review the source before linking.');
          const ws=structuredClone(workspace),destination=ws.maps.find(m=>m.id===map.id&&!m.unavailable),currentSource=discussionSource(ws,target),actor=this.d.actor(),currentThread=ws.comparisonThreads.find(t=>t.id===thread.id);let node=destination?.nodes.find(n=>n.id===pick.value);
          if(!currentThread?.participants.includes(actor)||!node||!currentSource||currentSource.item.parent===null||![destination,currentSource.map].some(m=>m.ownerId===actor)||create&&destination.ownerId!==actor||!create&&node.parent===null)throw Error('Choose available ordinary nodes with at least one in your own map.');
          if(create){const parent=node;node={id:nodeId,parent:parent.id,title:title.value.trim(),summary:summary.value.trim(),details:'',confidence:null,kind:'position',structuralType:'nesting',timeScope:'present',sourceTitle:'',sourceUrl:''};if(!node.title)throw Error('Enter a title.');destination.nodes.push(node);synchronizeIdeas(ws,destination);destination.revision++;destination.updatedAt=new Date().toISOString();}
          const other={type:'node',mapId:destination.id,nodeId:node.id},existing=counterpartLinks(ws,thread.id).find(r=>[r.target,r.other].some(t=>sameCounterpartSource(t,target))&&[r.target,r.other].some(t=>sameCounterpartSource(t,other)));
          if(existing)return {workspace,record:existing};
          const record=makeDiscussion(ws,{kind:'correspondence',action:'counterpart_link',comparisonId:thread.id,target,other,body:'Comparable nodes linked. Agreement has not been judged.'},actor);record.id=recordId;ws.discussions.push(record);validateWorkspace(ws);stagedDraft=draft;return {workspace:ws,record};
        };
        const result=this.c.account?await this.c.account.commitCandidate(prepare):prepare(this.c.workspace);
        if(!this.c.account){this.c.workspace=result.workspace;this.c.markDirty();if(create&&this.c.activeMapId===map.id)this.c.loadMap(map.id);}
        this.d.dirty=false;this.d.saving=false;this.c.library.render();this.focus(result.record,anchor);
      }catch(error){let p=form.querySelector('[role=alert]');if(!p){p=cpEl('p');p.setAttribute('role','alert');form.append(p);}p.textContent=error.message;}
      finally{this.d.saving=false;this.d.host.inert=false;this.c.status();this.d.positionPopover();}
    };
    this.d.host.append(form);this.d.positionPopover();(create?title:search).focus({preventScroll:true});
  }
}
