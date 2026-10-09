import {topicFocusMembers} from './topic-layout.mjs';

export const topicNodeKey=(mapId,nodeId)=>JSON.stringify([mapId,nodeId]);
export function markTopicElement(element,keys){if(element)element.dataset.topicKeys=JSON.stringify(keys);}

export class TopicFocusUI{
  constructor(host,{maps,world,mapLabel=map=>map.name,scope='map',beforeOpen=()=>true}){
    this.maps=maps;this.world=world;this.mapLabel=mapLabel;this.scope=scope;this.beforeOpen=beforeOpen;this.selection=new Set();this.context=null;
    this.controls=document.createElement('span');this.controls.className='topic-focus-controls';
    this.choose=this.button('Focus selection',()=>this.open());this.clear=this.button('Clear focus',()=>this.set([]));this.clear.hidden=true;this.status=document.createElement('span');this.status.setAttribute('role','status');this.controls.append(this.choose,this.clear,this.status);host.append(this.controls);
    this.dialog=document.createElement('dialog');this.dialog.className='topic-focus-dialog';this.dialog.setAttribute('aria-label','Choose topic branches');document.body.append(this.dialog);
    this.dialog.addEventListener('close',()=>{const details=this.choose.closest('details');(details&&!details.open?details.querySelector('summary'):this.choose).focus({preventScroll:true});});
  }
  button(label,action){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=action;return b;}
  sync(){
    const maps=this.maps().filter(m=>m&&!m.unavailable),context=this.scope+':'+maps.map(m=>m.id).sort().join('|');
    if(context!==this.context){this.context=context;try{const saved=JSON.parse(sessionStorage.getItem('harmonious-topic-focus:'+context)||'[]');this.selection=new Set(Array.isArray(saved)?saved.filter(k=>typeof k==='string'):[]);}catch{this.selection=new Set();}if(this.dialog.open)this.dialog.close();}
    const valid=new Set();this.members=new Set();this.frames=new Set();
    for(const map of maps){const chosen=new Set(map.nodes.filter(n=>this.selection.has(topicNodeKey(map.id,n.id))).map(n=>n.id)),focus=topicFocusMembers(map.nodes,chosen);
      for(const id of focus.topics)valid.add(topicNodeKey(map.id,id));for(const id of focus.members)this.members.add(topicNodeKey(map.id,id));for(const n of map.nodes)if(n.parent===null)this.frames.add(topicNodeKey(map.id,n.id));}
    this.selection=valid;this.active=valid.size>0;this.choose.textContent=this.active?'Change selection':'Focus selection';this.clear.hidden=!this.active;this.status.textContent=this.active?`${valid.size} topic ${valid.size===1?'branch':'branches'} focused`:'';
    const summary=this.choose.closest('details')?.querySelector(':scope>summary');if(summary){summary.dataset.topicOriginal||=summary.textContent;summary.textContent=summary.dataset.topicOriginal+(this.active?` · ${valid.size} focused`:'');}
    try{sessionStorage.setItem('harmonious-topic-focus:'+context,JSON.stringify([...valid]));}catch{}
  }
  set(keys){this.selection=new Set(keys);this.apply();}
  focus(mapId,nodeId){this.sync();this.set([topicNodeKey(mapId,nodeId)]);}
  apply(){
    this.sync();const world=this.world();if(!world)return;world.classList.toggle('topic-focus-active',this.active);
    for(const el of world.querySelectorAll('[data-topic-keys]')){let keys;try{keys=JSON.parse(el.dataset.topicKeys);}catch{keys=[];}
      const prominent=!this.active||keys.length&&keys[el.dataset.topicAny==='true'?'some':'every'](key=>this.members.has(key)||this.frames.has(key));el.classList.toggle('topic-faded',!prominent);}
  }
  open(){
    if(!this.beforeOpen())return;this.sync();this.dialog.replaceChildren();const title=document.createElement('h2');title.textContent='Focus topic branches';const help=document.createElement('p');help.textContent='Choose topics to emphasize with all their children. Other nodes will fade; branches stay expanded or collapsed as they are.';this.dialog.append(title,help);
    const fields=[];
    for(const map of this.maps().filter(m=>m&&!m.unavailable)){const heading=document.createElement('h3');heading.textContent=this.mapLabel(map);this.dialog.append(heading);
      for(const frame of map.nodes.filter(n=>n.parent===null)){const topics=map.nodes.filter(n=>n.parent===frame.id);if(!topics.length)continue;const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=frame.title;group.append(legend);
        for(const node of topics){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=topicNodeKey(map.id,node.id);input.checked=this.selection.has(input.value);label.append(input,document.createTextNode(node.title));group.append(label);fields.push(input);}this.dialog.append(group);}}
    if(!fields.length){const empty=document.createElement('p');empty.textContent='Add a topic beneath a frame to use branch focus.';this.dialog.append(empty);}
    const actions=document.createElement('div');actions.className='form-actions';const apply=this.button('Apply focus',()=>{this.set(fields.filter(f=>f.checked).map(f=>f.value));this.dialog.close();});apply.disabled=!fields.length;actions.append(this.button('Cancel',()=>this.dialog.close()),apply);this.dialog.append(actions);this.dialog.showModal();
  }
}
