export const roots=['status','action','goal'];
export function exampleMap(){
  const nodes=[];
  const add=(id,parent,title,summary,details='')=>nodes.push({id,parent,title,summary,details,confidence:null,kind:parent===null?'frame':'position',structuralType:parent===null?null:'specification',timeScope:'present',sourceTitle:'',sourceUrl:''});
  add('status',null,'Status Quo','How things are, and what sustains them.');
  add('action',null,'Transformative Action','What we can do to change the conditions.');
  add('goal',null,'Goal State','The future we want to create together.');
  add('s1','status','Fragmented understanding','People encounter different information and interpret it through different experiences.');
  add('s2','status','Concentrated power','Decisions affecting many people are often made by relatively few.');
  add('s3','status','Unresolved conflict','Disagreement accumulates when people lack a way to work through it.');
  add('s11','s1','Different information','Our information environments bring different facts and claims into view.');
  add('s12','s1','Different experiences','Lived experience influences what feels credible, urgent, or possible.');
  add('s13','s1','Unstated assumptions','The reasoning beneath a conclusion is often left implicit.');
  add('s111','s11','Selective exposure','We may repeatedly encounter sources that reinforce familiar accounts.');
  add('s112','s11','Missing context','A claim can travel farther than the context needed to interpret it.');
  add('s1111','s111','Feedback loops','Repeated exposure can make a viewpoint feel more widely shared than it is.');
  add('s21','s2','Unequal influence','People affected by a decision have unequal ability to shape it.');
  add('s22','s2','Weak accountability','Decision makers may face limited feedback from those bearing the costs.');
  add('s31','s3','Defensive reactions','A challenge to a belief can feel like a challenge to identity or belonging.');
  add('s32','s3','Lost discussion context','A new conversation can restart a disagreement without its previous progress.');
  add('s321','s32','Repeated arguments','Participants revisit questions they have already examined.');
  add('s322','s32','Changing claims','A revised position may be mistaken for the position discussed earlier.');
  add('a1','action','Make reasoning visible','Represent claims and their relationships in maps people can inspect.');
  add('a2','action','Work through differences','Locate the point where reasoning diverges and examine it together.');
  add('a3','action','Distribute decision power','Create ways for affected people to influence decisions and review outcomes.');
  add('a11','a1','Map worldviews','Connect descriptions of the present, proposed actions, and desired futures.');
  add('a12','a1','Clarify meaning','Make definitions and assumptions explicit before comparing conclusions.');
  add('a111','a11','State a claim','Give each idea a concise description and room for supporting detail.');
  add('a112','a11','Connect the reasoning','Show how ideas relate within a worldview.');
  add('a21','a2','Compare questions','Check whether participants are trying to answer the same question.');
  add('a22','a2','Examine a divergence','Identify which evidence, inference, or value produces a different conclusion.');
  add('a23','a2','Retain the progress','Keep unresolved questions and revisions available for future discussion.');
  add('a221','a22','Review evidence','Ask what supports the claim and what would change our confidence.');
  add('a222','a22','Inspect inferences','Check how the conclusion follows from the premises.');
  add('a223','a22','Understand priorities','Explore which needs and values participants are trying to protect.');
  add('a2211','a221','Identify uncertainty','Separate established information from assumptions and open questions.');
  add('a2212','a221','Agree on an inquiry','Identify an observation or investigation that could help resolve a question.');
  add('a31','a3','Include affected people','Bring the perspectives of people bearing consequences into deliberation.');
  add('g1','goal','Shared understanding','People can accurately explain their own reasoning and understand one another.');
  add('g2','goal','Constructive cooperation','Communities can develop and revise actions together.');
  add('g3','goal','Accountable institutions','Power responds to the people and communities affected by its use.');
  add('g11','g1','Visible agreement','People can identify where their views align and why.');
  add('g12','g1','Understood differences','Remaining disagreements have clear meaning and context.');
  add('g21','g2','Coordinated action','Shared reasoning supports collective decisions and follow-through.');
  add('g22','g2','Ongoing learning','Outcomes inform changes to beliefs, plans, and institutions.');
  add('g221','g22','Review outcomes','Compare what happened with what participants expected.');
  add('g222','g22','Revise together','Use new information to revisit the reasoning behind a decision.');
  add('g31','g3','Meaningful participation','Affected people have practical ways to shape consequential decisions.');
  for(const id of ['s1','s2','s3']){const n=nodes.find(n=>n.id===id);n.kind='topic';n.structuralType='decomposition';}
  const question=nodes.find(n=>n.id==='a21');question.kind='question';question.title='Are we answering the same question?';question.summary='What shared question would make these positions meaningfully comparable?';
  add('a211','a21','Establish the question first','Clarify a shared question before comparing people’s answers.','Two statements can sound opposed while addressing different decisions, time horizons, or groups of people.');
  nodes.find(n=>n.id==='a211').structuralType='answer';
  add('s112-example','s112','A quote without its context','A brief quotation can omit the conditions or qualifications of the original statement.','Illustrative example: a speaker says an action could help under specific conditions; a short extract makes it sound like an unconditional recommendation.');
  const example=nodes.find(n=>n.id==='s112-example');example.kind='explainer';example.structuralType='nesting';
  nodes.find(n=>n.id==='a111').details='Use the short description for the claim itself. This space can hold qualifications, context, and reasoning without filling the canvas.';
  return nodes;
}

export function exampleRelations(){return [
  {id:'r1',from:'s1',to:'a1',type:'motivates',note:'Making reasoning visible is proposed as a response to fragmented understanding.'},
  {id:'r2',from:'s3',to:'a2',type:'motivates',note:''},
  {id:'r3',from:'s2',to:'a3',type:'motivates',note:''},
  {id:'r4',from:'a1',to:'g1',type:'aims_for',note:''},
  {id:'r5',from:'a2',to:'g2',type:'aims_for',note:''},
  {id:'r6',from:'a3',to:'g3',type:'aims_for',note:''},
  {id:'r7',from:'s2',to:'g3',type:'counterpart',note:'These nodes describe present conditions and a desired alternative.'},
  {id:'r8',from:'s111',to:'s1111',type:'causal',note:''},
  {id:'r9',from:'s112-example',to:'s112',type:'illustrative',note:''}
];}
