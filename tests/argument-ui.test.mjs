import assert from 'node:assert/strict';
import {initialWorkspace,recordComparison} from '../dist/workspace.mjs';
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
  after(){} before(){} addEventListener(event,listener){(this.listeners??={})[event]=listener;} contains(){return false;} querySelector(){return null;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}
  cloneNode(){const clone=new Element();clone.value=this.value;clone.textContent=this.textContent;return clone;}
  reset(){this.value='';} focus(){}
}
const element=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
globalThis.document={getElementById:element,createElement:()=>new Element(),createElementNS:()=>new Element(),querySelector:element};
globalThis.ResizeObserver=class{observe(){}};
globalThis.matchMedia=()=>({matches:true});
globalThis.location={pathname:'/',search:'',hash:''};
globalThis.history={replaceState(a,b,url){location.hash=url.slice(url.indexOf('#'));}};
let confirmations=0;globalThis.confirm=()=>{confirmations++;return false;};
const workspace=initialWorkspace(),[a,b]=workspace.maps;
const proposal=recordComparison(workspace,{aMapId:a.id,bMapId:b.id,aNodeId:'a1',bNodeId:'a1',question:'Where should we begin?',questionStatus:'matched',answerStatus:'divergent'},null,a.ownerId);workspace.comparisons.push(proposal);
const c={workspace,editingRecord:proposal.id,mode:'compare',accountMode:true,account:{actor:{id:a.ownerId}},comparisonDirty:false,editor:{discardDraft(){},beforeLeave(){return true;}},captureActive(){},populateMaps(){},renderComparison(){},participation:{refresh(){}},markDirty(){this.workspaceDirty=true;},status(){},message(text){this.lastMessage=text;},clearComparison(){this.comparisonDirty=false;},showMode:WorkspaceController.prototype.showMode,canLeaveComparison:WorkspaceController.prototype.canLeaveComparison};
const ui=new ArgumentUI(c);c.argument=ui;c.canvas={camera:{x:10,y:20,z:.7},states:{a:{map:a,expanded:new Set(['a1']),frame:'all'},b:{map:b,expanded:new Set(['a1']),frame:'all'}}};
c.activeMap=()=>a;
c.setComparisonRoute=WorkspaceController.prototype.setComparisonRoute;
ui.open();assert.equal(c.mode,'argument');assert.equal(new URLSearchParams(location.hash.slice(1)).get('view'),'argument');
assert.equal(ui.canvas.links.length,0,'Argument must not show the Compare draft connector');
assert.deepEqual(ui.canvas.camera,c.canvas.camera);assert(ui.canvas.states.a.expanded.has('a1'));
assert.equal(element('argument-question').textContent,proposal.question);
ui.canvas.onSelect('a','unrelated-background-node');assert(!ui.dirty,'Background worldview nodes must not silently choose a saved source');
ui.chooseSource('a');assert(ui.dirty);assert.equal(ui.draftKind,'node');assert.equal(element('argument-attach').value,'source:a');assert(element('argument-edge-fields').disabled);
element('argument-kind').value='ground';element('argument-title').value='A first reason';element('argument-body').value='Explain the starting point';element('argument-initial-relation').value='supports';
ui.saveEdge();assert.equal(c.workspace.argumentEdges.length,0);assert.equal(element('argument-title').value,'A first reason');assert(ui.dirty,'Saving the other form must not discard this draft');
ui.saveNode();
assert.equal(c.workspace.argumentNodes.length,1,element('argument-error').textContent);assert.equal(c.workspace.argumentEdges.length,1);assert(!ui.dirty);assert(c.workspaceDirty);
assert.equal(ui.canvas.argumentNodes.length,1);const node=c.workspace.argumentNodes[0];
element('argument-from').value=node.id;element('argument-to').value='source:a';element('argument-relation').value='supports';element('argument-edge-form').listeners.input();
assert(element('argument-node-fields').disabled,'Only one Argument form can have unsaved changes at a time');
ui.saveEdge();assert(element('argument-error').textContent.includes('already exists'));assert.deepEqual(ui.selected,{kind:'node',id:node.id},'A rejected save must preserve the selected contribution');assert(ui.dirty);
ui.clearDraft();ui.selected={kind:'node',id:node.id};ui.render();
const rememberedCamera={x:500,y:300,z:.4};ui.canvas.camera={...rememberedCamera};const rememberedFrame=a.nodes.find(n=>n.parent===null).id;ui.canvas.states.a.frame=rememberedFrame;
element('argument-title').value='Unfinished edit';ui.dirty=true;c.comparisonDirty=true;
assert(c.showMode('compare'));assert.equal(confirmations,0);assert(ui.dirty&&c.comparisonDirty);
assert.equal(new URLSearchParams(location.hash.slice(1)).get('view'),null,'The Compare tab must stop linking back to Argument');
assert.equal(new URLSearchParams(location.hash.slice(1)).get('proposal'),proposal.id);
ui.open();assert.equal(element('argument-title').value,'Unfinished edit');assert(ui.dirty&&c.comparisonDirty);
assert.deepEqual(ui.canvas.camera,rememberedCamera,'Returning to Argument must retain its pan and zoom');assert.equal(ui.canvas.states.a.frame,rememberedFrame,'Refreshing Argument must retain its frame filter');
assert.equal(c.showMode('individual'),false);assert(ui.dirty,'Rejecting discard retains the form');
ui.dirty=false;c.comparisonDirty=false;ui.select('node',node.id);element('argument-title').value='Edited first reason';ui.saveNode();
assert.equal(c.workspace.argumentNodes[0].version,2);assert.equal(c.workspace.argumentNodes[0].history[0].title,'A first reason');
ui.undoLast();assert.equal(c.workspace.argumentNodes[0].title,'A first reason');assert.equal(c.workspace.argumentNodes[0].version,3);
ui.undoLast();assert.equal(c.workspace.argumentNodes[0].status,'withdrawn');assert.equal(c.workspace.argumentEdges[0].status,'withdrawn');assert.equal(c.workspace.argumentNodes[0].version,4);
c.account.actor.id=b.ownerId;ui.select('node',node.id);assert(element('argument-node-fields').disabled);assert(element('argument-withdraw').hidden);
// Refreshed versions do not erase an unsaved form.
element('argument-title').value='Another unfinished form';ui.dirty=true;ui.render();assert.equal(element('argument-title').value,'Another unfinished form');
ui.dirty=false;c.workspace.comparisons=[];ui.render();assert.equal(ui.canvas.world.children.length,0);assert(element('argument-node-fields').disabled);assert.equal(element('argument-records').children.length,0);
console.log('Argument view, canvas construction, draft preservation, contribution edits, undo and unavailable-source clearing passed.');
