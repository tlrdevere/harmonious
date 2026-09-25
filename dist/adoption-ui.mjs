import {adoptionState,isAdoptionReceipt} from './adoption-fulfillment.mjs';
const adoptEl=(tag,text='',className='')=>{const e=document.createElement(tag);e.textContent=text;e.className=className;return e;};
const adoptButton=(label,run)=>{const b=adoptEl('button',label);b.type='button';b.onclick=run;return b;};


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
  }

}
