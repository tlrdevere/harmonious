import {PHILOSOPHY_TYPES,philosophyTypeLabel} from './definitions.mjs';
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
  close(){if(this.dirty&&!confirm('Discard this unsaved philosophy draft?'))return;this.dirty=false;this.dialog.close();}
  shell(title){this.dialog.replaceChildren();const h=defEl('header');h.append(defEl('h2',title),defButton('Close',()=>this.close()));this.dialog.append(h);if(!this.dialog.open)this.dialog.showModal();this.dirty=false;}
  error(e){let p=this.dialog.querySelector('[role=alert]');if(!p){p=defEl('p');p.setAttribute('role','alert');this.dialog.append(p);}p.textContent=e.message;}
  changed(){this.dirty=false;this.c.markDirty();this.c.library.render();if(this.c.mode==='compare')this.c.renderComparison();}
  render(host,query=''){
    const lead=defEl('article','','library-card');lead.append(defEl('h2','Philosophy bank'),defEl('p','Your definitions, standards, principles, beliefs and other foundations. Create an idea here or from a node’s Philosophy menu, then reuse it wherever needed. Unused ideas stay private.'),defButton('Create idea',()=>this.edit()));if(this.c.account?.facilitator?.context){const b=lead.querySelector('button');b.disabled=true;b.title='Philosophy authoring is unavailable during facilitation.';}host.append(lead);
    for(const d of this.own()){
      const v=d.versions.at(-1);if(query&&!`${v.title} ${v.body}`.toLowerCase().includes(query))continue;
      const card=defEl('article','','library-card');card.append(defEl('h2',v.title),defEl('p',`${philosophyTypeLabel(d.type)} · Version ${v.version}${d.status==='archived'?' · Archived':''}`),defEl('p',v.body),defButton('View entry',()=>this.view(d.id)));host.append(card);
    }
  }
  view(id){
    const d=this.own().find(d=>d.id===id);if(!d)return;const v=d.versions.at(-1);this.shell(v.title);
    this.dialog.append(defEl('p',`${d.type} · Version ${v.version} · ${d.status}`),defEl('p',v.body,'definition-wording'),defButton('Edit entry',()=>this.edit(d)),defButton(d.status==='archived'?'Restore entry':'Archive entry',()=>{try{const next=makeDefinition(this.c.workspace,{status:d.status==='active'?'archived':'active'},this.actor(),d);this.c.workspace.definitions=this.c.workspace.definitions.map(x=>x.id===id?next:x);this.changed();this.view(id);}catch(e){this.error(e);}}));
    if(this.c.account?.facilitator?.context)for(const b of this.dialog.querySelectorAll('button'))if(['Edit entry','Restore entry','Archive entry'].includes(b.textContent)){b.disabled=true;b.title='Philosophy authoring is unavailable during facilitation.';}
    if(d.copiedFrom){const origin=d.copiedFrom,author=this.c.workspace.participants.find(p=>p.id===origin.authorId)?.name||'another participant',source=defEl('details');source.append(defEl('summary',`Copied from ${author} · Version ${origin.version}`),defEl('h3',origin.title),defEl('p',origin.body,'definition-wording'),defEl('p','This is your independent library entry. Later edits do not update the original.','field-help'));this.dialog.append(source);}
    const history=defEl('details');history.append(defEl('summary','Earlier versions'));for(const old of d.versions.slice(0,-1).reverse())history.append(defEl('h3',`${old.title} · Version ${old.version}`),defEl('p',old.body,'definition-wording'));this.dialog.append(history);
    const uses=(this.c.workspace.discussions||[]).filter(r=>r.kind==='context'&&r.status==='active'&&r.definitionRefs?.some(ref=>ref.definitionId===id));this.dialog.append(defEl('h3','Used on your maps'));
    for(const r of uses){const source=discussionSource(this.c.workspace,r.target),ref=r.definitionRefs.find(ref=>ref.definitionId===id);this.dialog.append(defButton(`${source?.map.name||'Unavailable map'} · ${source?.label||r.targetLabel} · Version ${ref.version}`,()=>this.choose(r.target)));}
    if(!uses.length)this.dialog.append(defEl('p','Not yet used on a node or edge.'));
  }
  edit(old=null){
    if(this.c.account?.facilitator?.context){this.shell('Philosophy');this.dialog.append(defEl('p','Existing philosophy ideas can be read and referenced. Create or revise entries outside facilitation.'));return;}
    this.shell(old?'Edit philosophy idea':'Create idea');const form=defEl('form'),type=defEl('select');type.id='definition-type';for(const [value,label]of Object.entries(PHILOSOPHY_TYPES)){const o=defEl('option',label);o.value=value;type.append(o);}type.value=old?.type||'definition';type.disabled=!!old;
    const title=defEl('input');title.id='definition-title';title.required=true;title.maxLength=200;title.value=old?.versions.at(-1).title||'';
    const body=defEl('textarea');body.id='definition-body';body.rows=6;body.required=true;body.maxLength=10000;body.value=old?.versions.at(-1).body||'';
    for(const [name,input]of [['Type',type],['Title',title],['Idea',body]]){const label=defEl('label',name);label.htmlFor=input.id;form.append(label,input);}
    form.append(defEl('p','Existing uses keep their selected version. You can update each use after reviewing the new wording.','field-help'));
    const submit=defEl('button','Save library entry','primary');submit.type='submit';form.append(submit);form.onsubmit=e=>{e.preventDefault();try{const d=makeDefinition(this.c.workspace,{type:type.value,title:title.value,body:body.value},this.actor(),old);this.c.workspace.definitions=[...(this.c.workspace.definitions||[]).filter(x=>x.id!==d.id),d];this.changed();this.view(d.id);}catch(error){this.error(error);}};this.dialog.append(form);title.focus();
  }
  choose(target){
    if(!this.c.editor.beforeLeave())return;this.c.captureActive();const source=discussionSource(this.c.workspace,target);if(!source||source.map.ownerId!==this.actor())return;
    const previous=(this.c.workspace.discussions||[]).find(r=>r.kind==='context'&&r.definitionRefs&&stableJSON(r.target)===stableJSON(target));
    this.shell(`Philosophy for ${source.label}`);this.dialog.append(defEl('p','Select the philosophical foundations this source uses. Only the selected wording is shared with readers of this map.'));
    const form=defEl('form'),choices=[];
    for(const d of this.own()){
      const used=previous?.status==='active'&&previous.definitionRefs.find(r=>r.definitionId===d.id);if(d.status==='archived'&&!used)continue;
      const row=defEl('section','','definition-choice'),check=defEl('input');check.type='checkbox';check.checked=!!used;check.id=`use-${d.id}`;const label=defEl('label',d.versions.at(-1).title);label.htmlFor=check.id;
      const version=defEl('select');version.setAttribute('aria-label',`Version of ${d.versions.at(-1).title}`);for(const v of [...d.versions].reverse()){const o=defEl('option',`Version ${v.version}${v.version===d.versions.length?' · Latest':''}`);o.value=String(v.version);version.append(o);}version.value=String(used?.version||d.versions.length);
      const wording=defEl('p','','definition-wording');const update=()=>{wording.textContent=d.versions[Number(version.value)-1].body;};version.onchange=update;update();row.append(check,label,defEl('p',philosophyTypeLabel(d.type),'field-help'),version,wording);form.append(row);choices.push({d,check,version,row});
    }
    const heading=defEl('h3','Choose from your bank');form.prepend(heading);
    if(!choices.length)form.append(defEl('p','Your bank is empty. Create your first idea above.'));
    if(choices.length){const search=defEl('input');search.type='search';search.placeholder='Find a saved idea';search.setAttribute('aria-label','Find a saved philosophy idea');search.oninput=e=>{e.stopPropagation();const q=search.value.toLowerCase();for(const {d,row}of choices)row.hidden=!`${philosophyTypeLabel(d.type)} ${d.versions.at(-1).title} ${d.versions.at(-1).body}`.toLowerCase().includes(q);};heading.after(search);}
    const create=defEl('details'),type=defEl('select'),title=defEl('input'),body=defEl('textarea');create.append(defEl('summary','Create a new idea'));create.open=!choices.length;
    type.id='philosophy-new-type';for(const [value,label]of Object.entries(PHILOSOPHY_TYPES)){const option=defEl('option',label);option.value=value;type.append(option);}title.id='philosophy-new-title';title.maxLength=200;body.id='philosophy-new-body';body.maxLength=10000;body.rows=5;
    for(const [name,input]of [['Type',type],['Title',title],['Idea',body]]){const label=defEl('label',name);label.htmlFor=input.id;create.append(label,input);}create.append(defEl('p','Saving adds this idea to your bank and uses it on this node.','field-help'));
    create.className='philosophy-create';if(!this.c.account?.facilitator?.context)form.prepend(create);
    const save=defEl('button','Save philosophy','primary');save.type='submit';form.append(save);form.onsubmit=e=>{e.preventDefault();try{const refs=choices.filter(x=>x.check.checked).map(x=>definitionReference(x.d,Number(x.version.value))),ws=this.c.workspace;
      const d=title.value.trim()||body.value.trim()?makeDefinition(ws,{type:type.value,title:title.value,body:body.value},this.actor()):null;
      if(d)refs.push(definitionReference(d));if(!refs.length&&!previous){this.close();return;}
      const candidate={...ws,definitions:d?[...ws.definitions,d]:ws.definitions};
      const r=makeDiscussion(candidate,{kind:'context',action:'context',target,definitionRefs:refs,body:definitionReferenceText(refs),status:refs.length?'active':'withdrawn'},this.actor(),previous);
      ws.definitions=candidate.definitions;ws.discussions=[...(ws.discussions||[]).filter(x=>x.id!==r.id),r];this.changed();this.dialog.close();
    }catch(error){this.error(error);}};this.dialog.append(form);
  }
  read(target){
    const source=discussionSource(this.c.workspace,target);if(!source)return;
    this.shell(`Philosophy for ${source.label}`);
    const uses=(this.c.workspace.discussions||[]).filter(r=>r.kind==='context'&&r.status==='active'&&stableJSON(r.target)===stableJSON(target));
    for(const use of uses){for(const ref of use.definitionRefs||[])this.dialog.append(defEl('h3',ref.title),defEl('p',`${philosophyTypeLabel(ref.type)} · ${this.c.workspace.participants.find(p=>p.id===ref.authorId)?.name||'Author'} · Version ${ref.version}`,'field-help'),defEl('p',ref.body,'definition-wording'));if(!use.definitionRefs?.length)this.dialog.append(defEl('p',use.body,'definition-wording'));}
    if(!uses.length)this.dialog.append(defEl('p','No philosophical foundations have been attached to this node.'));
  }
}
