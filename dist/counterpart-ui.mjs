import {comparisonCounterparts,counterpartFrame,counterpartLinks,counterpartRequestState,sameCounterpartSource} from './counterparts.mjs';
import {makeDiscussion,discussionSource} from './discussion.mjs';
import {comparisonNodeKey} from './comparison-layout.mjs';
import {newId,validateWorkspace} from './workspace.mjs';
import {synchronizeIdeas} from './adoption.mjs';
const cpEl=(tag,text='',cls='')=>{const e=document.createElement(tag);e.textContent=text;e.className=cls;return e;};
const cpButton=(text,run)=>{const b=cpEl('button',text);b.type='button';b.onclick=run;return b;};

export class CounterpartUI{
  constructor(d){this.d=d;this.c=d.c;this.canvas=d.canvas;this.canvas.options.counterparts=()=>comparisonCounterparts(this.c.workspace,this.canvas.states);}
  requests(target){return this.d.entries().filter(r=>r.kind==='counterpart'&&sameCounterpartSource(r.target,target));}
  links(target){return counterpartLinks(this.c.workspace,this.d.thread()?.id).filter(r=>sameCounterpartSource(r.target,target)||sameCounterpartSource(r.other,target));}
  otherMap(target){return ['a','b'].map(s=>this.canvas.states[s].map).find(m=>m&&m.id!==target.mapId);}
  draw(){
    this.markers=[];
    for(const p of this.canvas.layout.placeholders||[]){
      const map=this.canvas.states[p.side].map,source=discussionSource(this.c.workspace,p.target),request=this.requests(p.target).at(-1);
      if(!source)continue;
      const box=cpEl('section','','counterpart-placeholder discussion-drawing');box.dataset.identity=this.canvas.identity(p.side);box.setAttribute('aria-label',`Counterpart spot for ${source.label}`);
      box.append(cpEl('strong','No counterpart linked'),cpEl('p',`${this.d.name(map.ownerId)}’s map`));if(this.d.mode()==='compare')box.append(cpButton(map.ownerId===this.d.actor()?'Add your counterpart':request?'View counterpart request':'Request counterpart',()=>this.show(p.target)));
      this.canvas.world.append(box);this.markers.push({box,p});
    }
    for(const request of this.d.entries().filter(r=>r.kind==='counterpart'&&this.d.mode()==='compare')){
      const state=counterpartRequestState(this.c.workspace,request);if(['Awaiting counterpart','Counterpart linked'].includes(state))continue;
      const side=['a','b'].find(s=>this.canvas.states[s].map?.id===request.target.mapId),card=side&&this.canvas.cards.get(comparisonNodeKey(side,request.target.nodeId));
      if(card){const b=cpButton(state,()=>this.d.open(request.id));b.className='counterpart-status discussion-drawing';card.querySelector('.node-bottom').append(b);}
    }
    this.position();
  }
  position(){for(const {box,p}of this.markers||[]){const side=p.side==='a'?'b':'a',key=comparisonNodeKey(side,p.target.nodeId),now=this.canvas.positions.get(key),end=this.canvas.layout.positions.get(key);box.style.transform=`translate(${p.x+(now&&end?now.x-end.x:0)}px,${p.y+(now&&end?now.y-end.y:0)}px)`;}}
  focus(link){
    if(!this.d.canLeave())return;
    for(const target of [link.target,link.other]){const side=['a','b'].find(s=>this.c.sides[s].mapId===target.mapId);if(!side)continue;this.c.sides[side].nodeId=target.nodeId;document.getElementById(`compare-frame-${side}`).value='all';}
    this.c.renderComparison();this.canvas.fitSelection();this.d.open(link.id);
  }
  show(target){
    if(!this.d.canLeave())return;const source=discussionSource(this.c.workspace,target),map=this.otherMap(target);if(!source||!map)return;
    this.d.activateMode('compare');this.d.target=target;this.d.shell('Find a counterpart');this.d.host.append(cpEl('p',`For “${source.label}” in ${map.name}. Linking counterparts does not record agreement or disagreement.`));
    const links=this.links(target);for(const link of links)this.d.host.append(cpButton('Show linked counterpart',()=>this.focus(link)));
    if(map.ownerId===this.d.actor())this.d.actionGroup('Your map',[cpButton('Create counterpart',()=>this.form(target,true)),cpButton('Choose existing node',()=>this.form(target,false))]);
    const request=this.requests(target).at(-1);
    if(request){this.d.host.append(cpEl('p',counterpartRequestState(this.c.workspace,request)),cpButton('Open request',()=>this.d.open(request.id)));}
    else if(!links.length&&source.map.ownerId===this.d.actor())this.d.host.append(cpButton('Request counterpart',()=>this.d.compose('counterpart','counterpart')));
    this.d.positionPopover();
  }
  requestActions(r){
    const state=counterpartRequestState(this.c.workspace,r);this.d.host.append(cpEl('p',state,'discussion-state'));
    if(state==='Counterpart linked'){for(const link of this.links(r.target))this.d.host.append(cpButton('Show linked counterpart',()=>this.focus(link)));return;}
    const own=this.otherMap(r.target)?.ownerId===this.d.actor();
    if(own){this.d.actionGroup('Add your counterpart',[cpButton('Create counterpart',()=>this.form(r.target,true)),cpButton('Choose existing node',()=>this.form(r.target,false))]);
      this.d.actionGroup('Other responses',['no_position','not_applicable'].map(action=>cpButton(action==='no_position'?'No position yet':'Not applicable',()=>this.d.compose('reply',action,null,{layer:'inquiries'}))));}
    if(r.authorId===this.d.actor()){const action=state==='Awaiting counterpart'?'close_request':'reopen_request';this.d.host.append(cpButton(action==='close_request'?'Close request':'Reopen request',()=>this.d.compose('reply',action,null,{layer:'inquiries'})));}
  }
  form(target,create){
    if(!this.d.canLeave()||!this.c.editor.beforeLeave())return;this.c.captureActive();const source=discussionSource(this.c.workspace,target),map=this.otherMap(target);if(!source||map?.ownerId!==this.d.actor())return;
    this.d.activateMode('compare');this.d.target=target;this.d.shell(create?'Create counterpart':'Choose existing node');
    this.d.host.append(cpEl('p',`Your counterpart to “${source.label}”. This links comparable material without deciding agreement.`));
    const form=cpEl('form'),pick=cpEl('select');pick.id='counterpart-node';pick.required=true;
    const path=n=>{const parts=[n.title],seen=new Set([n.id]);while(n.parent){n=map.nodes.find(p=>p.id===n.parent);if(!n||seen.has(n.id))break;seen.add(n.id);parts.unshift(n.title);}return parts.join(' › ');};
    for(const n of map.nodes.filter(n=>create||n.parent!==null)){const o=cpEl('option',path(n));o.value=n.id;pick.append(o);}
    const frame=counterpartFrame(source.map,target.nodeId),defaultNode=map.nodes.find(n=>create?n.id===frame:n.parent!==null&&counterpartFrame(map,n.id)===frame);if(defaultNode)pick.value=defaultNode.id;
    const pickLabel=cpEl('label',create?'Where in your map? Choose the parent.':'Node from your map');pickLabel.htmlFor=pick.id;form.append(pickLabel,pick);
    const title=cpEl('input'),summary=cpEl('textarea');title.id='counterpart-title';title.maxLength=200;title.required=true;summary.id='counterpart-summary';summary.rows=3;summary.maxLength=10000;
    if(create)for(const [text,input]of [['Your node title',title],['Your explanation (optional)',summary]]){const l=cpEl('label',text);l.htmlFor=input.id;form.append(l,input);}
    const preview=cpEl('p','','field-help');const update=()=>{const n=map.nodes.find(n=>n.id===pick.value);preview.textContent=n?`${create?'New node under':'Selected'}: ${path(n)}${counterpartFrame(map,n.id)!==frame?' · Different frame: the link will cross frames.':''}${!create&&n.summary?' — '+n.summary:''}`:'';};pick.onchange=update;update();form.append(preview);
    const submit=cpEl('button',create?'Create and link counterpart':'Link counterpart','primary');submit.type='submit';submit.disabled=!pick.options.length;form.append(submit);
    if(!pick.options.length)form.append(cpEl('p','Your map has no non-frame nodes yet.'),cpButton('Create counterpart',()=>this.form(target,true)));
    form.onsubmit=async e=>{e.preventDefault();if(this.d.saving)return;this.d.saving=true;this.d.host.inert=true;
      try{
        const thread=await this.c.ensureComparison(),ws=structuredClone(this.c.workspace),own=ws.maps.find(m=>m.id===map.id);let node=own?.nodes.find(n=>n.id===pick.value);
        if(own?.ownerId!==this.d.actor()||!node)throw Error('The source changed. Reopen the counterpart chooser.');
        if(create){const parent=node;node={id:newId('node'),parent:parent.id,title:title.value.trim(),summary:summary.value.trim(),details:'',confidence:null,kind:'position',structuralType:'nesting',timeScope:'present',sourceTitle:'',sourceUrl:''};if(!node.title)throw Error('Enter a title.');own.nodes.push(node);synchronizeIdeas(ws,own);own.revision++;own.updatedAt=new Date().toISOString();}
        const ownTarget={type:'node',mapId:own.id,nodeId:node.id};
        const existing=counterpartLinks(ws,thread.id).find(r=>[r.target,r.other].some(t=>sameCounterpartSource(t,target))&&[r.target,r.other].some(t=>sameCounterpartSource(t,ownTarget)));
        const record=existing||makeDiscussion(ws,{kind:'correspondence',action:'counterpart_link',comparisonId:thread.id,target,other:ownTarget,body:'Comparable nodes linked. Agreement has not been judged.'},this.d.actor());
        if(!existing)ws.discussions.push(record);validateWorkspace(ws);this.c.workspace=ws;this.d.dirty=false;
        if(this.c.activeMapId===own.id)this.c.loadMap(own.id);
        this.c.markDirty();this.c.library.render();this.focus(record);
      }catch(error){let p=form.querySelector('[role=alert]');if(!p){p=cpEl('p');p.setAttribute('role','alert');form.append(p);}p.textContent=error.message;}
      finally{this.d.saving=false;this.d.host.inert=false;}
    };
    this.d.host.append(form);this.d.positionPopover();(create?title:pick).focus({preventScroll:true});
  }
}
