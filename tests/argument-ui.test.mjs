import assert from 'node:assert/strict';
import {initialWorkspace,recordComparison} from '../dist/workspace.mjs';
import {saveArgumentNode,saveArgumentEdge,argumentNodeRef} from '../dist/argument.mjs';
import {ArgumentUI} from '../dist/argument-ui.mjs';
import {WorkspaceController} from '../dist/workspace-ui.mjs';

// Exercise actual controller and canvas construction with a small DOM adapter.
// Geometry is tested separately; this does not substitute for visual acceptance.
const elements=new Map();
class Element{
  constructor(){this.children=[];this.dataset={};this.value='';this.textContent='';this.attributes={};this.style={setProperty(k,v){this[k]=v;}};this.classList={add(){},remove(){},toggle(){},contains(){return false;}};this.clientWidth=1000;this.clientHeight=700;}
  set innerHTML(html){for(const match of html.matchAll(/\bid="([^"]+)"/g))elements.set(match[1],new Element());}
  setAttribute(k,v){this.attributes[k]=v;}
  append(...items){for(const item of items){item.parent=this;this.children.push(item);}}
  prepend(...items){this.children.unshift(...items);}
  replaceChildren(...items){this.children=[];this.append(...items);}
  after(){} before(){} addEventListener(event,listener){(this.listeners??={})[event]=listener;} contains(){return false;} querySelector(){return null;} querySelectorAll(){return [];}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}
  cloneNode(){const clone=new Element();clone.value=this.value;clone.textContent=this.textContent;return clone;}
  reset(){this.value='';} focus(){}
}
const element=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
globalThis.window=new EventTarget();
globalThis.document=Object.assign(new EventTarget(),{getElementById:element,createElement:()=>new Element(),createElementNS:()=>new Element(),querySelector:element});
globalThis.ResizeObserver=class{observe(){}};
globalThis.matchMedia=()=>({matches:true});
globalThis.location={pathname:'/',search:'',hash:''};
globalThis.history={replaceState(a,b,url){location.hash=url.slice(url.indexOf('#'));}};
let confirmations=0;globalThis.confirm=()=>{confirmations++;return false;};
const workspace=initialWorkspace(),[a,b]=workspace.maps;
const proposal=recordComparison(workspace,{aMapId:a.id,bMapId:b.id,aNodeId:'a1',bNodeId:'a1',question:'Where should we begin?',questionStatus:'matched',answerStatus:'divergent'},null,a.ownerId);workspace.comparisons.push(proposal);
const c={workspace,editingRecord:proposal.id,mode:'compare',accountMode:true,account:{actor:{id:a.ownerId}},comparisonDirty:false,editor:{discardDraft(){},beforeLeave(){return true;}},captureActive(){},populateMaps(){},renderComparison(){},participation:{refresh(){}},markDirty(){this.workspaceDirty=true;},status(){},message(text){this.lastMessage=text;},clearComparison(){this.comparisonDirty=false;},showMode:WorkspaceController.prototype.showMode,canLeaveComparison:WorkspaceController.prototype.canLeaveComparison};
// Seed historical records through the model, not a retired creation form.
const context={comparisonId:proposal.comparisonId,proposalId:proposal.id,proposalRevision:proposal.proposalRevision};
context.proposalRevision=1;
const node=saveArgumentNode(workspace,{...context,kind:'ground',title:'A first reason',body:'Explain the starting point',sourceUrl:''},a.ownerId);workspace.argumentNodes.push(node);
const edge=saveArgumentEdge(workspace,{...context,from:argumentNodeRef(workspace,node.id),to:{type:'source',side:'a'},relation:'supports',note:''},a.ownerId);workspace.argumentEdges.push(edge);
const ui=new ArgumentUI(c);c.argument=ui;c.canvas={camera:{x:10,y:20,z:.7},states:{a:{map:a,expanded:new Set(['a1']),frame:'all'},b:{map:b,expanded:new Set(['a1']),frame:'all'}}};
c.activeMap=()=>a;c.setComparisonRoute=WorkspaceController.prototype.setComparisonRoute;
ui.open();assert.equal(c.mode,'argument');assert.equal(new URLSearchParams(location.hash.slice(1)).get('view'),'argument');
assert.deepEqual(ui.canvas.camera,c.canvas.camera);assert(ui.canvas.states.a.expanded.has('a1'));
assert.equal(element('argument-question').textContent,proposal.question);
assert(element('argument-new').hidden&&element('argument-undo').hidden);
assert(element('argument-node-fields').disabled&&element('argument-edge-fields').disabled);
ui.select('node',node.id);assert.equal(element('argument-title').value,'A first reason');assert(element('argument-history').children.length);
const before=JSON.stringify(c.workspace);ui.chooseSource('a');ui.markDraft('node');ui.saveNode();ui.saveEdge();ui.undoLast();
assert.equal(JSON.stringify(c.workspace),before,'Retired authoring paths do not mutate historical records');assert(!ui.dirty);
await WorkspaceController.prototype.record.call(c);assert.equal(JSON.stringify(c.workspace),before,'Earlier proposal submission is read-only');
const rememberedCamera={x:500,y:300,z:.4};ui.canvas.camera={...rememberedCamera};ui.canvas.states.a.frame='status';
assert(c.showMode('compare'));assert.equal(new URLSearchParams(location.hash.slice(1)).get('view'),null);ui.open();assert.deepEqual(ui.canvas.camera,rememberedCamera);assert.equal(ui.canvas.states.a.frame,'status');
ui.select('node',node.id);ui.withdraw();assert.equal(c.workspace.argumentNodes[0].status,'withdrawn');assert.equal(c.workspace.argumentNodes[0].history[0].title,'A first reason');
c.account.actor.id=b.ownerId;ui.select('node',node.id);assert(element('argument-withdraw').hidden);
c.workspace.comparisons=[];ui.render();assert.equal(ui.canvas.world.children.length,0);assert(element('argument-node-fields').disabled);assert.equal(element('argument-records').children.length,0);
console.log('Earlier Argument reading, source view, history, no retired creation, authorized withdrawal and unavailable clearing passed.');
