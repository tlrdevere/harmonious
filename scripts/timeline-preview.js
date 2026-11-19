// Independent local maps for exploring the timeline and editing a branch.
{
  const workspace={schemaVersion:6,participants:[],maps:[],ideas:[],endorsements:[],comparisons:[],comparisonThreads:[],argumentNodes:[],argumentEdges:[],discussions:[],definitions:[]};
  const first=createOwnedMap(workspace,{name:'Getting home by bus',personName:'Alex'});
  const second=createOwnedMap(workspace,{name:'Bus service after dark',personName:'Sam'});
  first.id='sample-alex-bus';second.id='sample-sam-bus';
  first.visibility='shared';second.visibility='shared';
  function add(map,id,parent,timeScope,title,summary){
    map.nodes.push({id,parent,timeScope,title,summary,details:'',kind:'position',structuralType:'nesting',confidence:null,sourceTitle:'',sourceUrl:''});
  }
  add(first,'service','status','present','Evening buses run hourly','A missed bus can mean waiting an hour for the next one.');
  add(first,'cuts','service','history','Evening service was reduced','The route ran twice an hour before the previous timetable change.');
  add(first,'funds','cuts','history','The evening budget fell','The operating budget covered fewer evening trips.');
  add(first,'wait','service','present','Shift workers wait after closing','Shop closing times fall between the last two departures.');
  add(first,'ridership','service','likely_future','More riders will switch to driving','If the timetable holds, people who can drive may give up on the evening bus.');
  add(first,'pressure','ridership','likely_future','Evening ridership will fall','Lower ridership may weaken the case for keeping the last trip.');
  add(first,'trial','action','present','Trial half-hourly service','Run an extra evening trip each hour for three months.');
  add(first,'access','goal','present','A reliable ride home after work','Workers can get home without a long wait after closing.');
  add(second,'coverage','status','present','The bus is the only way home for some riders','Several households along the route have no car.');
  first.relations.push({id:'cuts-service',from:'cuts',to:'service',type:'causal',note:'Fewer scheduled departures lengthened the gap between buses.'});
  first.relations.push({id:'cuts-trial',from:'cuts',to:'trial',type:'addresses',note:'The trial would restore the previous evening frequency.'});
  synchronizeIdeas(workspace,first);synchronizeIdeas(workspace,second);
  startComparisonThread(workspace,first.id,second.id,first.ownerId,{id:'sample-bus-comparison'});
  workspaceController.workspace=workspace;
  workspaceController.participation.actorId=first.ownerId;
  const route=new URLSearchParams(location.hash.slice(1));
  workspaceController.initialize().then(()=>{
    if(!['map','source','comparison','library','pod'].some(key=>route.has(key))){
      workspaceController.library.openMap(first.id);
      document.getElementById('next').click();
    }
    workspaceController.message('Sample workspace. Use Save workspace file to keep your edits.');
  });
}
