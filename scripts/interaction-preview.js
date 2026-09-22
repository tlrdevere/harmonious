// Disposable, clearly labelled sample maps for the standalone redesign review.
workspaceController.initialize().then(()=>{
  const ws={schemaVersion:6,participants:[],maps:[],ideas:[],endorsements:[],comparisons:[],comparisonThreads:[],argumentNodes:[],argumentEdges:[],discussions:[],definitions:[]};
  const samples=[
    {name:'Alex — community meetings',person:'Alex',id:'sample-alex',nodes:[
      ['current','status','Evening meetings are easier to attend','Sample position: work schedules make daytime attendance difficult.'],
      ['reason','status','Most sample respondents prefer evenings','Illustrative survey — sample data only.'],
      ['action','action','Offer an evening meeting each month','Try an additional evening session.'],
      ['goal','goal','Make participation accessible','More members should be able to participate.']]},
    {name:'Blair — community meetings',person:'Blair',id:'sample-blair',nodes:[
      ['current','status','Daytime meetings work for many members','Sample position: some members cannot travel in the evening.'],
      ['reason','status','Sample attendance was higher at lunchtime','Illustrative attendance record — sample data only.'],
      ['action','action','Alternate daytime and evening sessions','Offer different meeting times in successive months.'],
      ['goal','goal','Make participation accessible','More members should be able to participate.']]}
  ];
  for(const sample of samples){
    const map=createOwnedMap(ws,{name:sample.name,ownerId:sample.id,personName:sample.person});sample.ownerId=map.ownerId;map.visibility='shared';
    for(const [key,parent,title,summary]of sample.nodes)map.nodes.push({id:sample.id+'-'+key,parent,title,summary,details:'',kind:'position',structuralType:'nesting',confidence:null,timeScope:'present',sourceTitle:key==='reason'?'Illustrative source for this sample map':'',sourceUrl:'',});
    map.relations=[{id:sample.id+'-reason-link',from:sample.id+'-reason',to:sample.id+'-current',type:'reason',note:''},{id:sample.id+'-addresses',from:sample.id+'-current',to:sample.id+'-action',type:'addresses',note:''},{id:sample.id+'-enables',from:sample.id+'-action',to:sample.id+'-goal',type:'enables',note:''}];synchronizeIdeas(ws,map);
  }
  workspaceController.workspace=validateWorkspace(ws);workspaceController.activeMapId=null;workspaceController.participation.actorId=ws.maps[0].ownerId;workspaceController.populateMaps();workspaceController.library.render();workspaceController.library.createComparison(ws.maps[0].id,null,ws.maps[1].id);workspaceController.discussion.reasoning.setFocus('inquiry');
  for(const side of ['a','b'])document.getElementById('compare-all-'+side).click();workspaceController.canvas.fit();
  workspaceController.discussion.viewOptions.open=false;workspaceController.message('Local sample maps reset when reopened. Download a backup to keep changes.');
  const actorLabel=document.createElement('label'),actorSelect=document.createElement('select');actorSelect.id='interaction-preview-actor';actorLabel.htmlFor=actorSelect.id;actorLabel.textContent='Preview as';
  for(const sample of samples)actorSelect.append(new Option(sample.person,sample.ownerId));actorSelect.value=workspaceController.participation.actorId;
  document.querySelector('.workspace-files').prepend(actorLabel,actorSelect);
  actorSelect.onchange=()=>{
    const previous=workspaceController.participation.actorId,entry=workspaceController.discussion.viewId;
    if(!workspaceController.editor.beforeLeave()||!workspaceController.canLeaveComparison()){actorSelect.value=previous;return;}
    workspaceController.participation.actorId=actorSelect.value;workspaceController.participation.refresh();workspaceController.library.render();workspaceController.renderComparison();
    if(entry)workspaceController.discussion.open(entry);
  };
});
