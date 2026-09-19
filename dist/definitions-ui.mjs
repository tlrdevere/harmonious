import {makeDefinition,definitionReference,definitionReferenceText} from './definitions.mjs';
import {makeDiscussion,discussionSource} from './discussion.mjs';
import {stableJSON} from './account-model.mjs';
const defEl=(tag,text='',cls='')=>{const e=document.createElement(tag);e.textContent=text;e.className=cls;return e;};
const defButton=(label,fn)=>{const b=defEl('button',label);b.type='button';b.onclick=fn;return b;};

export class DefinitionsUI{
  constructor(c){
    this.c=c;this.dirty=false;this.dialog=defEl('dialog','','definitions-dialog');document.body.append(this.dialog);
    this.dialog.addEventListener('input',()=>{this.dirty=true;});
    this.dialog.addEventListener('cancel',e=>{e.preventDefault();this.close();});
    window.addEventListener('beforeunload',e=>{if(this.dirty){e.preventDefault();e.returnValue='';}});
  }
  actor(){return this.c.account?.actor?.id||this.c.participation.actorId||this.c.workspace.participants[0]?.id;}
  own(){return (this.c.workspace.definitions||[]).filter(d=>d.authorId===this.actor());}
  close(){if(this.dirty&&!confirm('Discard this unsaved definition draft?'))return;this.dirty=false;this.dialog.close();}
  shell(title){this.dialog.replaceChildren();const h=defEl('header');h.append(defEl('h2',title),defButton('Close',()=>this.close()));this.dialog.append(h);if(!this.dialog.open)this.dialog.showModal();this.dirty=false;}
  error(e){let p=this.dialog.querySelector('[role=alert]');if(!p){p=defEl('p');p.setAttribute('role','alert');this.dialog.append(p);}p.textContent=e.message;}
  changed(){this.dirty=false;this.c.markDirty();this.c.library.render();if(this.c.mode==='compare')this.c.renderComparison();}
  render(host,query=''){
    const lead=defEl('article','','library-card');lead.append(defEl('h2','Definitions & standards'),defEl('p','Create once, then use a specific version on any of your nodes or edges. Your unused library wording stays private.'),defButton('Create definition or standard',()=>this.edit()));host.append(lead);
    for(const d of this.own()){
      const v=d.versions.at(-1);if(query&&!`${v.title} ${v.body}`.toLowerCase().includes(query))continue;
      const card=defEl('article','','library-card');card.append(defEl('h2',v.title),defEl('p',`${d.type==='standard'?'Standard':'Definition'} · Version ${v.version}${d.status==='archived'?' · Archived':''}`),defEl('p',v.body),defButton('View entry',()=>this.view(d.id)));host.append(card);
    }
  }
  view(id){
    const d=this.own().find(d=>d.id===id);if(!d)return;const v=d.versions.at(-1);this.shell(v.title);
    this.dialog.append(defEl('p',`${d.type} · Version ${v.version} · ${d.status}`),defEl('p',v.body,'definition-wording'),defButton('Edit entry',()=>this.edit(d)),defButton(d.status==='archived'?'Restore entry':'Archive entry',()=>{try{const next=makeDefinition(this.c.workspace,{status:d.status==='active'?'archived':'active'},this.actor(),d);this.c.workspace.definitions=this.c.workspace.definitions.map(x=>x.id===id?next:x);this.changed();this.view(id);}catch(e){this.error(e);}}));
    const history=defEl('details');history.append(defEl('summary','Earlier versions'));for(const old of d.versions.slice(0,-1).reverse())history.append(defEl('h3',`${old.title} · Version ${old.version}`),defEl('p',old.body,'definition-wording'));this.dialog.append(history);
    const uses=(this.c.workspace.discussions||[]).filter(r=>r.kind==='context'&&r.status==='active'&&r.definitionRefs?.some(ref=>ref.definitionId===id));this.dialog.append(defEl('h3','Used on your maps'));
    for(const r of uses){const source=discussionSource(this.c.workspace,r.target),ref=r.definitionRefs.find(ref=>ref.definitionId===id);this.dialog.append(defButton(`${source?.map.name||'Unavailable map'} · ${source?.label||r.targetLabel} · Version ${ref.version}`,()=>this.choose(r.target)));}
    if(!uses.length)this.dialog.append(defEl('p','Not yet used on a node or edge.'));
  }
  edit(old=null){
    this.shell(old?'Edit library entry':'Create definition or standard');const form=defEl('form'),type=defEl('select');type.id='definition-type';for(const value of ['definition','standard']){const o=defEl('option',value==='definition'?'Definition':'Standard');o.value=value;type.append(o);}type.value=old?.type||'definition';type.disabled=!!old;
    const title=defEl('input');title.id='definition-title';title.required=true;title.maxLength=200;title.value=old?.versions.at(-1).title||'';
    const body=defEl('textarea');body.id='definition-body';body.rows=6;body.required=true;body.maxLength=10000;body.value=old?.versions.at(-1).body||'';
    for(const [name,input]of [['Type',type],['Term or standard name',title],['Meaning or criteria',body]]){const label=defEl('label',name);label.htmlFor=input.id;form.append(label,input);}
    form.append(defEl('p','Existing uses keep their selected version. You can update each use after reviewing the new wording.','field-help'));
    const submit=defEl('button','Save library entry','primary');submit.type='submit';form.append(submit);form.onsubmit=e=>{e.preventDefault();try{const d=makeDefinition(this.c.workspace,{type:type.value,title:title.value,body:body.value},this.actor(),old);this.c.workspace.definitions=[...(this.c.workspace.definitions||[]).filter(x=>x.id!==d.id),d];this.changed();this.view(d.id);}catch(error){this.error(error);}};this.dialog.append(form);title.focus();
  }
  choose(target){
    if(!this.c.editor.beforeLeave())return;this.c.captureActive();const source=discussionSource(this.c.workspace,target);if(!source||source.map.ownerId!==this.actor())return;
    const previous=(this.c.workspace.discussions||[]).find(r=>r.kind==='context'&&r.definitionRefs&&stableJSON(r.target)===stableJSON(target));
    this.shell(`Definitions for ${source.label}`);this.dialog.append(defEl('p','Select the definitions and standards this source uses. Only the selected wording is shared with readers of this map.'));
    const form=defEl('form'),choices=[];
    for(const d of this.own()){
      const used=previous?.status==='active'&&previous.definitionRefs.find(r=>r.definitionId===d.id);if(d.status==='archived'&&!used)continue;
      const row=defEl('section','','definition-choice'),check=defEl('input');check.type='checkbox';check.checked=!!used;check.id=`use-${d.id}`;const label=defEl('label',d.versions.at(-1).title);label.htmlFor=check.id;
      const version=defEl('select');version.setAttribute('aria-label',`Version of ${d.versions.at(-1).title}`);for(const v of [...d.versions].reverse()){const o=defEl('option',`Version ${v.version}${v.version===d.versions.length?' · Latest':''}`);o.value=String(v.version);version.append(o);}version.value=String(used?.version||d.versions.length);
      const wording=defEl('p','','definition-wording');const update=()=>{wording.textContent=d.versions[Number(version.value)-1].body;};version.onchange=update;update();row.append(check,label,version,wording);form.append(row);choices.push({d,check,version});
    }
    if(!choices.length){this.dialog.append(defEl('p','Create a library entry first from Map Library → Definitions & standards.'),defButton('Create definition or standard',()=>this.edit()));return;}
    const save=defEl('button','Save references','primary');save.type='submit';form.append(save);form.onsubmit=e=>{e.preventDefault();try{const refs=choices.filter(x=>x.check.checked).map(x=>definitionReference(x.d,Number(x.version.value)));if(!refs.length&&!previous){this.close();return;}
      const r=makeDiscussion(this.c.workspace,{kind:'context',action:'context',target,definitionRefs:refs,body:definitionReferenceText(refs),status:refs.length?'active':'withdrawn'},this.actor(),previous);
      this.c.workspace.discussions=[...(this.c.workspace.discussions||[]).filter(x=>x.id!==r.id),r];this.changed();this.dialog.close();
    }catch(error){this.error(error);}};this.dialog.append(form);
  }
}
