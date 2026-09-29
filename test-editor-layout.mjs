import assert from 'node:assert/strict';
import {TinyDatagrid} from './src/tinygrid.js';
import {difference,applyDifference} from './src/history.js';
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
