import assert from 'node:assert/strict';
import {TinyDatagrid} from '../src/tinygrid.js';
import {difference,applyDifference} from '../src/history.js';
// Reproduce the editor selection that the browser uses for subsequent typing.
const editor={style:{},value:'',scrollHeight:32,setAttribute(){},focus(){},select(){this.selectionStart=0;this.selectionEnd=this.value.length},setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b}};
const grid={editor,selection:{r2:0,c2:0},isCellReadOnly:()=>false,options:{headerWidth:52,headerHeight:28},_viewOffset:()=>0,displayColWidths:[110],displayRowHeights:[28],getRawValue:()=> 'existing',t:()=> 'Editor'};
TinyDatagrid.prototype.edit.call(grid,0,0,'a');
assert.equal(editor.selectionStart,1);assert.equal(editor.selectionEnd,1);
editor.value=editor.value.slice(0,editor.selectionStart)+'b'+editor.value.slice(editor.selectionEnd);
assert.equal(editor.value,'ab');
TinyDatagrid.prototype.edit.call(grid,0,0);assert.equal(editor.selectionStart,0);assert.equal(editor.selectionEnd,8);
TinyDatagrid.prototype.edit.call(grid,0,0,'ü');assert.equal(editor.selectionStart,1);
class Model extends TinyDatagrid{
 build(){this.el.setAttribute=()=>{};this.scroll={scrollTop:0,scrollLeft:0,clientWidth:1100,clientHeight:700,getBoundingClientRect:()=>({left:0,top:0})};this.canvas={style:{}}}
 bind(){} setLocale(){return this} emit(){} renderHeaders(){} renderCells(){} syncHeaders(){} updateSelectionOverlay(){}
}
const model=new Model({}, {rows:2000000,columns:100,historyLimit:0});model.layout();
assert.equal(model.virtualization,true);assert.equal(model.canvas.style.height,'8000000px');
for(const row of [0,50,1000000,1999999]){
 model.scrollToCell(row,0);
 const top=model._viewOffset(row,'rows');assert.ok(top>=-0.01&&top<700);
 assert.equal(model.getCellAtClient(10,top+14).row,row);
 const range=model._visibleRange(model.rowOffsets,model.rowCount,model._scrollY(),700,700);
 assert.ok(range.start<=row&&range.end>row);assert.ok(range.end-range.start<45);
}
assert.ok(model.scroll.scrollTop<=8000000-700);
model._features.set('freezePanes',{});model.freezePanes={rows:1,columns:1};model.scrollToCell(1999999,99);
assert.equal(model._viewOffset(0,'rows'),0);assert.equal(model.getCellAtClient(5,5).row,0);
// Array history preserves holes, changes and resizing with the indexed fast path.
for(const [before,after] of [[[1,2,3],[1,4,3]],[[1,2],[1]],[[1],[1,,3]],[Array(3),[undefined,2]]]){
 const patch=difference(before,after);assert.deepEqual(applyDifference(before,patch,true),after);assert.deepEqual(applyDifference(after,patch,false),before);
}
console.log('Editor, 2M-row layout/scroll and array history regression tests passed');

// Picking references must keep the formula's destination and raw value intact.
const referenceInput={...editor,readOnly:false,dispatchEvent(){},setCustomValidity(){}};
model.editor=referenceInput;model.anchor={row:5,col:5};model._editing={row:5,col:5};
function formula(value,position=value.length){referenceInput.value=value;referenceInput.setSelectionRange(position,position);delete referenceInput._tgReference;}
function arrow(key,shiftKey=false){const event={key,shiftKey,preventDefault(){this.defaultPrevented=true}};const handled=model._moveFormulaReference(event);return {handled,event};}
formula('=SUM(');
assert.equal(arrow('ArrowLeft').handled,true);assert.equal(referenceInput.value,'=SUM(E6');
arrow('ArrowUp');assert.equal(referenceInput.value,'=SUM(E5');
arrow('ArrowRight',true);assert.equal(referenceInput.value,'=SUM(E5:F5');
assert.deepEqual(model.anchor,{row:5,col:5});assert.deepEqual(model._editing,{row:5,col:5});assert.equal(model.getRawValue(5,5),'');
formula('=SUM(;10)',5);model._pickFormulaReference(2,1);assert.equal(referenceInput.value,'=SUM(B3;10)');
model._pickFormulaReference(3,2);assert.equal(referenceInput.value,'=SUM(C4;10)');
formula('=A1+');model._pickFormulaReference(1,1);assert.equal(referenceInput.value,'=A1+B2');
referenceInput.value+='*';referenceInput.setSelectionRange(referenceInput.value.length,referenceInput.value.length);
model._pickFormulaReference(2,2);assert.equal(referenceInput.value,'=A1+B2*C3');
for(const value of ['plain','=SUM("text','=SUM("escaped ""text','=SUM(A1)','=123']){formula(value);assert.equal(arrow('ArrowLeft').handled,false);}
formula('=SUM("text";');assert.equal(arrow('ArrowDown').handled,true);
formula('=');model._editing={row:0,col:0};assert.equal(arrow('ArrowUp').handled,true);assert.equal(referenceInput.value,'=');
model.hiddenRows.clear();model.displayRowHeights[1]=0;arrow('ArrowDown');assert.equal(referenceInput.value,'=A3');
model.displayRowHeights[1]=28;
formula('=');referenceInput.readOnly=true;assert.equal(arrow('ArrowDown').handled,false);referenceInput.readOnly=false;
console.log('Formula reference picking, ranges, caret contexts and hidden-row navigation passed');

// The visible reference follows the active picker without changing selection.
const visibleCells=[[0,0],[1,0],[1,1],[2,0],[2,1],[3,0]].map(([row,col])=>({dataset:{row:String(row),col:String(col)},classes:new Set(),classList:{toggle(name,on){on?this.owner.classes.add(name):this.owner.classes.delete(name)}}}));
for(const cell of visibleCells)cell.classList.owner=cell;
model.canvas.querySelectorAll=()=>visibleCells;
const events=new EventTarget();
referenceInput.addEventListener=events.addEventListener.bind(events);
referenceInput.dispatchEvent=events.dispatchEvent.bind(events);
model._editing={row:0,col:0};formula('=SUM(');
model._pickFormulaReference(1,0);
const highlighted=()=>visibleCells.filter(cell=>cell.classes.has('tg-formula-reference')).map(cell=>[+cell.dataset.row,+cell.dataset.col]);
assert.deepEqual(highlighted(),[[1,0]]);
model._pickFormulaReference(2,1,referenceInput,true);
assert.deepEqual(highlighted(),[[1,0],[1,1],[2,0],[2,1]]);
for(const cell of visibleCells)cell.classes.clear();model._syncFormulaReferenceHighlight();
assert.deepEqual(highlighted(),[[1,0],[1,1],[2,0],[2,1]]);
model._pickFormulaReference(3,0);assert.deepEqual(highlighted(),[[3,0]]);
referenceInput.value+=')';referenceInput.dispatchEvent(new Event('input'));assert.deepEqual(highlighted(),[[3,0]]);
referenceInput.value='=123';referenceInput.dispatchEvent(new Event('input'));assert.deepEqual(highlighted(),[]);
formula('=');model._pickFormulaReference(1,1);referenceInput.dispatchEvent(new Event('blur'));assert.deepEqual(highlighted(),[]);
console.log('Reference highlights follow cells and ranges, survive redraws and clear on edits/blur');
