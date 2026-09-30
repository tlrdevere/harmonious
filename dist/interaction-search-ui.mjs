import {searchInteractions} from './interaction-presentation.mjs';

const el=(tag,text='',cls='')=>{const node=document.createElement(tag);node.textContent=text;node.className=cls;return node;};
const button=(text,run)=>{const node=el('button',text);node.type='button';node.onclick=run;return node;};
const modeNames={compare:'Compare',inquiry:'Inquiry',argument:'Argument'};

// Search is a view of the same accessible records used by attachment lists.
// Opening a result delegates to the common source/interaction navigation path.
export class InteractionSearchUI{
  constructor(d){
    this.d=d;this.queries=new Map();this.scope=null;this.limit=50;
    this.button=button('Find',()=>this.open());this.button.className='discussion-secondary';
    d.controls.insertBefore(this.button,d.viewOptions);
    this.host=el('section','','reasoning-search interaction-search');this.host.hidden=true;this.host.setAttribute('aria-label','Find interactions');
    const header=el('header');this.title=el('strong');header.append(this.title,button('Close',()=>this.close()));
    this.input=el('input');this.input.type='search';this.input.placeholder='Find wording, choices, author or source';this.input.setAttribute('aria-label','Search interactions');this.input.oninput=()=>{this.state().query=this.input.value;this.limit=50;this.render();};
    this.filters=el('div','','reasoning-search-filters');
    for(const [value,label]of [['all','All'],['disputes','Disputes'],['standstills','Standstills']]){const b=button(label,()=>{this.state().filter=value;this.limit=50;this.render();});b.dataset.filter=value;this.filters.append(b);}
    this.results=el('div','','reasoning-search-results');this.host.append(header,this.input,this.filters,this.results);d.canvas.surface.append(this.host);
    for(const event of ['pointerdown','wheel'])this.host.addEventListener(event,e=>e.stopPropagation());
    this.host.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();this.close();}});
  }
  state(){const key=this.d.mode();if(!this.queries.has(key))this.queries.set(key,{query:'',filter:'all'});return this.queries.get(key);}
  sync(){
    const scope=this.d.actor()+':'+(this.d.thread()?.id||'');if(scope!==this.scope){this.scope=scope;this.queries.clear();this.host.hidden=true;}
    this.title.textContent='Find in '+modeNames[this.d.mode()];this.input.value=this.state().query;this.filters.hidden=this.d.mode()!=='argument';
    if(!this.host.hidden)this.render();
  }
  open(){this.sync();this.d.viewOptions.open=false;this.limit=50;this.host.hidden=false;this.render();this.input.focus({preventScroll:true});}
  close(focus=true){this.host.hidden=true;if(focus)this.button.focus({preventScroll:true});}
  render(){
    const d=this.d,state=this.state(),{results,total}=searchInteractions(d.c.workspace,d.allEntries(),{mode:d.mode(),query:state.query,filter:d.mode()==='argument'?state.filter:'all',authorName:id=>d.name(id),limit:this.limit});
    this.results.replaceChildren(el('p',`${total} matching ${total===1?'contribution':'contributions'}`,'reasoning-search-count'));
    for(const b of this.filters.children)b.setAttribute('aria-pressed',String(b.dataset.filter===state.filter));
    for(const item of results){const r=item.entry,row=el('article','','reasoning-search-result interaction-search-result');row.dataset.entry=r.id;row.append(el('strong',`${item.label} · ${d.name(r.authorId)}`),el('p',r.targetLabel),el('p',item.preview),button('Show on map',async()=>{const shown=r.kind==='standstill'?await d.standstills.reveal(r.id):d.revealInteraction(r.id,{responseContext:true});if(shown)this.close(false);}));this.results.append(row);}
    if(total>results.length)this.results.append(button('More results',()=>{this.limit+=50;this.render();}));
  }
}
