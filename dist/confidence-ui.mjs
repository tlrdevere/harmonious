const confidenceScales=new WeakMap();
let confidenceFieldSerial=0;

// The number field owns the value. A range cannot represent null, so its muted
// midpoint is only an invitation to choose a score, never an assessed value.
export function attachConfidenceScale(field){
  if(confidenceScales.has(field))return confidenceScales.get(field);
  const element=document.createElement('span');element.className='confidence-scale';
  const row=document.createElement('span');row.className='confidence-scale-row';
  const range=document.createElement('input');range.type='range';range.min='0';range.max='100';range.step='1';range.setAttribute('aria-label','Confidence scale');
  const footer=document.createElement('span');footer.className='confidence-scale-footer';
  const state=document.createElement('span');state.className='confidence-scale-state';
  const clear=document.createElement('button');clear.type='button';clear.className='confidence-scale-clear';clear.textContent='Not assessed';
  field.classList.add('confidence-scale-number');field.placeholder='—';
  field.before(element);row.append(range,field);footer.append(state,clear);element.append(row,footer);
  const sync=()=>{
    const valid=field.checkValidity(),assessed=field.value!==''&&valid,empty=field.value===''&&valid;
    element.dataset.assessed=String(assessed);
    range.value=assessed?String(Math.round(Number(field.value))):'50';
    range.setAttribute('aria-valuetext',empty?'Not assessed':assessed?`${field.value}%`:'Enter a confidence from 0 to 100');
    state.textContent=empty?'No rating yet':assessed?'0–100%':'Enter 0–100';
    clear.setAttribute('aria-pressed',String(empty));
  };
  const relay=type=>field.dispatchEvent(new Event(type,{bubbles:true}));
  range.addEventListener('input',event=>{event.stopPropagation();field.value=range.value;relay('input');});
  range.addEventListener('change',event=>{event.stopPropagation();relay('change');});
  field.addEventListener('input',sync);field.addEventListener('change',sync);
  clear.onclick=()=>{field.value='';relay('input');field.focus();};
  field.form?.addEventListener('reset',()=>queueMicrotask(sync));
  const control={element,range,clear,sync};confidenceScales.set(field,control);sync();return control;
}

export function confidenceBadge(node,owner,onEdit=null){
  if(node.parent===null||node.kind!=='position')return null;
  const unassessed=node.confidence===null,value=unassessed?'not assessed':`${node.confidence}%`;
  const badge=document.createElement(onEdit?'button':'span');badge.className='node-confidence';badge.dataset.confidenceNode=node.id;badge.dataset.assessed=String(!unassessed);badge.textContent=`Confidence ${unassessed?'—':value}`;
  badge.title=`${owner}’s confidence: ${value}`;badge.setAttribute('aria-label',`Confidence: ${value} — ${owner}${onEdit?'; edit confidence':''}`);
  if(onEdit){badge.type='button';badge.onclick=e=>{e.stopPropagation();onEdit();};}
  return badge;
}

export function confidenceForm(node,{save,cancel,input=()=>{}}){
  const form=document.createElement('form');form.className='confidence-form';form.setAttribute('aria-label','Confidence');
  const title=document.createElement('strong');title.className='confidence-position';title.textContent=node.title;form.append(title);
  const help=document.createElement('p');help.className='field-help';help.textContent='How confident are you in this position? Leave blank if you have not assessed it.';
  const label=document.createElement('label');label.textContent='Confidence (%)';
  const field=document.createElement('input');field.id=`confidence-value-${++confidenceFieldSerial}`;label.htmlFor=field.id;field.type='number';field.min='0';field.max='100';field.step='any';field.inputMode='decimal';field.value=node.confidence===null?'':String(node.confidence);
  const actions=document.createElement('div');actions.className='confidence-actions';
  const submit=document.createElement('button');submit.type='submit';submit.textContent='Save confidence';
  const back=document.createElement('button');back.type='button';back.textContent='Back';back.onclick=cancel;
  const error=document.createElement('p');error.className='confidence-error';error.setAttribute('role','alert');
  field.oninput=()=>{error.textContent='';input(field.value,field.checkValidity());};
  form.onsubmit=event=>{event.preventDefault();if(!field.reportValidity())return;try{save(field.value===''?null:Number(field.value));}catch(e){error.textContent=e.message;}};
  actions.append(submit,back);form.append(help,label,field,actions,error);attachConfidenceScale(field);return form;
}
