import {adoptionPreview,adoptionState,isAdoptionReceipt,prepareAdoption} from './adoption-fulfillment.mjs';
import {stableJSON} from './account-model.mjs';
import {counterpartFrame} from './counterparts.mjs';
const adoptEl=(tag,text='',className='')=>{const e=document.createElement(tag);e.textContent=text;e.className=className;return e;};
const adoptButton=(label,run)=>{const b=adoptEl('button',label);b.type='button';b.onclick=run;return b;};
const adoptPath=(map,node)=>{const parts=[],seen=new Set();while(node&&!seen.has(node.id)){seen.add(node.id);parts.unshift(node.title);node=map.nodes.find(n=>n.id===node.parent);}return parts.join(' › ');};

export class AdoptionUI{
  constructor(d){this.d=d;this.c=d.c;}
  state(record){
    const suggestion=isAdoptionReceipt(record)?this.c.workspace.discussions.find(r=>r.id===record.target.entryId):record;
    if(!suggestion)return;
    const state=adoptionState(this.c.workspace,suggestion),receipt=state.receipt;
    const recipient=this.c.workspace.maps.find(m=>[this.d.thread()?.aMapId,this.d.thread()?.bMapId].includes(m.id)&&m.id!==suggestion.target.mapId)?.ownerId;
    this.d.host.append(adoptEl('p',`${state.label}${receipt?' · '+this.d.name(receipt.authorId):recipient?' · '+this.d.name(recipient):''}`,'discussion-state'));
    if(receipt){
      if(state.suggestionWithdrawn)this.d.host.append(adoptEl('p','Suggestion withdrawn. The saved copy and this record remain.','field-help'));
      if(state.removed)this.d.host.append(adoptEl('p','Removed from map','field-help'));
      else {if(state.changed)this.d.host.append(adoptEl('p','Changed since adding','field-help'));this.d.host.append(adoptButton('Open node',()=>{const t=receipt.adoption.destination;return t.mapId&&this.c.workspace.maps.find(m=>m.id===t.mapId)?.ownerId===this.d.actor()?this.c.library.openMap(t.mapId,t.nodeId):this.c.library.openSource(t.mapId,t.nodeId);}));}
      const history=adoptEl('details');history.append(adoptEl('summary','Adoption details'));
      const source=receipt.adoption.source;
      history.append(adoptEl('p',`Independent node · Source version ${source.ideaVersion} · ${receipt.adoption.counterpartId?'Linked as counterparts':'No counterpart link added'}`,'field-help'));
      history.append(adoptEl('strong',source.wording.title),adoptEl('p',[source.wording.summary,source.wording.details].filter(Boolean).join('\n'),'discussion-body'));
      for(const item of receipt.adoption.importedDefinitions)history.append(adoptEl('p',`Imported ${item.source.title} · Version ${item.source.version} · ${this.d.name(item.source.authorId)}`,'field-help'));
      this.d.host.append(history);return;
    }
    if(suggestion.status==='active'&&recipient===this.d.actor()&&suggestion.authorId!==recipient){
      this.d.actionGroup('Your map',[adoptButton('Add to my map',()=>this.form(suggestion.id,'copy')),adoptButton('Use an existing node',()=>this.form(suggestion.id,'existing')),adoptButton('Not now',()=>this.form(suggestion.id,'not_now'))]);
    }
  }
  form(suggestionId,mode){
    if(!this.d.canLeave()||!this.c.editor.beforeLeave())return;this.c.captureActive();
    let preview;try{preview=adoptionPreview(this.c.workspace,suggestionId,this.d.actor());}catch(error){this.d.shell('Adoption unavailable');this.d.host.append(adoptEl('p',error.message));return;}
    if(preview.receipt){this.d.open(suggestionId);return;}
    this.d.target={type:'entry',entryId:suggestionId};this.d.shell(mode==='copy'?'Add to my map':mode==='existing'?'Use an existing node':'Not now');
    this.d.host.append(adoptEl('p',`Your map: ${preview.destinationMap.name}`,'adoption-destination'));
    const form=adoptEl('form','','adoption-form'),sourceBox=adoptEl('section','','adoption-source'),definitionBox=adoptEl('details','','adoption-definitions'),notice=adoptEl('section','','adoption-review');
    const session={preview,pending:null,signature:null};
    const showSource=()=>{const source=session.preview.sourceSnapshot;sourceBox.replaceChildren(adoptEl('h3',`Suggested by ${this.d.name(preview.suggestion.authorId)}`));if(source)sourceBox.append(adoptEl('strong',source.wording.title),adoptEl('p',[source.wording.summary,source.wording.details].filter(Boolean).join('\n'),'discussion-body'),adoptEl('small',`Source version ${source.ideaVersion}`));else sourceBox.append(adoptEl('p','This source is no longer available.'));};showSource();form.append(sourceBox);
    const field=(label,input,id)=>{input.id=id;const l=adoptEl('label',label);l.htmlFor=id;form.append(l,input);return input;};
    const pick=adoptEl('select'),title=adoptEl('input'),summary=adoptEl('textarea'),details=adoptEl('textarea'),note=adoptEl('textarea'),link=adoptEl('input');
    const destination=preview.destinationMap;
    if(mode!=='not_now'){
      for(const node of destination.nodes.filter(n=>mode==='copy'||n.parent!==null)){const option=adoptEl('option',adoptPath(destination,node));option.value=node.id;pick.append(option);}
      pick.required=true;field(mode==='copy'?'Choose a parent in your map':'Choose your existing node',pick,'adoption-node');
      const frame=counterpartFrame(preview.sourceMap,preview.sourceNode?.id),initial=destination.nodes.find(n=>mode==='copy'?n.id===frame:n.parent!==null&&counterpartFrame(destination,n.id)===frame);if(initial)pick.value=initial.id;
      const location=adoptEl('p','','field-help');const showLocation=()=>{const n=destination.nodes.find(n=>n.id===pick.value);location.textContent=n?`${mode==='copy'?'New node under':'Selected node'}: ${adoptPath(destination,n)}${counterpartFrame(destination,n.id)!==frame?' · Different frame':''}${mode==='existing'?'\n'+[n.summary,n.details].filter(Boolean).join('\n'):''}`:'Your map has no ordinary nodes yet.';};pick.onchange=showLocation;showLocation();form.append(location);
      if(mode==='copy'){
        title.value=preview.sourceNode?.title||'';title.required=true;title.maxLength=200;field('Your node title',title,'adoption-node-title');
        summary.value=preview.sourceNode?.summary||'';summary.rows=3;summary.maxLength=10000;field('Your explanation',summary,'adoption-summary');
        details.value=preview.sourceNode?.details||'';details.rows=3;details.maxLength=10000;field('More detail (optional)',details,'adoption-details');
      }
      const linkLabel=adoptEl('label','','adoption-choice');link.type='checkbox';link.id='adoption-link';linkLabel.append(link,adoptEl('span','Link as counterparts'));form.append(linkLabel,adoptEl('p',mode==='copy'?'Creates one independent node. Later edits stay separate. This does not record agreement or a co-sign.':'Your existing wording and definitions stay unchanged. This does not record agreement or a co-sign.','field-help'));
    }else{note.rows=3;note.maxLength=10000;field('Optional response',note,'adoption-note');form.append(adoptEl('p','You can reconsider later. Your map will not change.','field-help'));}
    const selected=new Set(),renderDefinitions=()=>{
      definitionBox.replaceChildren(adoptEl('summary',`Definitions used by ${this.d.name(preview.suggestion.authorId)}`));
      const fresh=session.preview;for(const item of fresh.definitions){const ref=item.reference,article=adoptEl('section');article.append(adoptEl('h4',ref.title),adoptEl('p',`${ref.type==='standard'?'Standard':'Definition'} · Version ${ref.version}`,'field-help'),adoptEl('p',ref.body,'discussion-body'));
        if(mode==='copy'){const label=adoptEl('label','','adoption-choice'),checkbox=adoptEl('input');checkbox.type='checkbox';checkbox.checked=selected.has(item.key);checkbox.dataset.definitionKey=item.key;checkbox.onchange=()=>checkbox.checked?selected.add(item.key):selected.delete(item.key);label.append(checkbox,adoptEl('span','Copy to my library and use here'));article.append(label);}definitionBox.append(article);
      }
      for(const context of fresh.sourceSnapshot?.contexts||[])if(!context.definitionRefs.length)definitionBox.append(adoptEl('p',context.body,'discussion-body'));
      definitionBox.hidden=definitionBox.children.length===1;
    };renderDefinitions();form.append(definitionBox,notice);
    const submit=adoptEl('button',mode==='copy'?'Create my independent node':mode==='existing'?'Use this node':'Save response','primary');submit.type='submit';submit.disabled=!preview.sourceSnapshot||(mode!=='not_now'&&!pick.options.length);form.append(submit);this.d.host.append(form);
    const reviewChanged=fresh=>{
      notice.replaceChildren(adoptEl('h3','Source changed — review before saving'),adoptEl('p','Your wording and choices have been kept. Check the updated source; new definitions remain unselected.'));
      for(const [label,source]of [['Previously reviewed',session.preview.sourceSnapshot],['Updated source',fresh.sourceSnapshot]]){const section=adoptEl('section');section.append(adoptEl('h4',label));if(source){section.append(adoptEl('strong',source.wording.title),adoptEl('p',[source.wording.summary,source.wording.details].filter(Boolean).join('\n'),'discussion-body'));for(const context of source.contexts)section.append(adoptEl('p',context.body,'discussion-body'));}else section.append(adoptEl('p','Source unavailable'));notice.append(section);}
      if(fresh.sourceSnapshot&&fresh.suggestion.status==='active')notice.append(adoptButton('I reviewed the updated source',()=>{session.preview=fresh;session.pending=null;for(const key of selected)if(!fresh.definitions.some(d=>d.key===key))selected.delete(key);showSource();renderDefinitions();notice.replaceChildren(adoptEl('p','Updated source reviewed. Your draft is unchanged.','field-help'));this.d.dirty=true;this.d.positionPopover();}));
    };
    form.onsubmit=async event=>{
      event.preventDefault();if(this.d.saving)return;this.d.saving=true;this.d.dirty=true;this.d.host.inert=true;
      try{
        const input={suggestionId,reviewedSource:session.preview.sourceSnapshot,mode,parentId:pick.value,nodeId:pick.value,title:title.value,summary:summary.value,details:details.value,body:note.value,definitionKeys:[...selected],linkCounterpart:link.checked};
        const signature=stableJSON(input);
        const prepare=async workspace=>{
          const fresh=adoptionPreview(workspace,suggestionId,this.d.actor());
          if(fresh.receipt)return {workspace,receipt:fresh.receipt,reused:true};
          if(stableJSON(fresh.sourceSnapshot)!==stableJSON(session.preview.sourceSnapshot)){reviewChanged(fresh);throw Error('Review the changed source before saving.');}
          if(session.pending&&session.signature===signature)return session.pending;
          session.pending=await prepareAdoption(workspace,input,this.d.actor());session.signature=signature;return session.pending;
        };
        const result=this.c.account?await this.c.account.commitCandidate(prepare):await prepare(this.c.workspace);
        if(!this.c.account){this.c.workspace=result.workspace;this.c.markDirty();if(this.c.activeMapId===destination.id)this.c.loadMap(destination.id);}
        this.d.dirty=false;this.c.library.render();this.c.renderComparison();this.d.saving=false;this.d.open(suggestionId);
      }catch(error){if(error.status===409)session.pending=null;let alert=form.querySelector('[role=alert]');if(!alert){alert=adoptEl('p');alert.setAttribute('role','alert');form.append(alert);}alert.textContent=error.message+' Your draft is still here.';}
      finally{this.d.saving=false;this.d.host.inert=false;this.c.status();this.d.positionPopover();}
    };
    this.d.positionPopover();(mode==='copy'?title:mode==='existing'?pick:note).focus({preventScroll:true});
  }
}
