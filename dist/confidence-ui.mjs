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
  const field=document.createElement('input');field.type='number';field.min='0';field.max='100';field.step='any';field.inputMode='decimal';field.placeholder='Not assessed';field.value=node.confidence===null?'':String(node.confidence);label.append(field);
  const actions=document.createElement('div');actions.className='confidence-actions';
  const clear=document.createElement('button');clear.type='button';clear.textContent='Not assessed';clear.onclick=()=>{field.value='';field.dispatchEvent(new Event('input',{bubbles:true}));field.focus();};
  const submit=document.createElement('button');submit.type='submit';submit.textContent='Save confidence';
  const back=document.createElement('button');back.type='button';back.textContent='Back';back.onclick=cancel;
  const error=document.createElement('p');error.className='confidence-error';error.setAttribute('role','alert');
  field.oninput=()=>{error.textContent='';input(field.value,field.checkValidity());};
  form.onsubmit=event=>{event.preventDefault();if(!field.reportValidity())return;try{save(field.value===''?null:Number(field.value));}catch(e){error.textContent=e.message;}};
  actions.append(submit,clear,back);form.append(help,label,actions,error);return form;
}
