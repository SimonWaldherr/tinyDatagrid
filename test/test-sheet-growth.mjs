import assert from 'node:assert/strict';
import { TinyDatagrid } from '../src/tinygrid.js';
import { worksheets } from '../src/worksheets.js';
import { installSheetGrowth, sheetLimits } from '../demo/sheet-growth.js';

let nextFrame = 0;
const frames = new Map();
globalThis.requestAnimationFrame = callback => { frames.set(++nextFrame, callback); return nextFrame; };
globalThis.cancelAnimationFrame = id => frames.delete(id);
function flush() { for (const [id, callback] of frames) { frames.delete(id); callback(); } }
class ModelGrid extends TinyDatagrid {
  build() { this.scroll = {scrollTop:0,scrollLeft:0,clientHeight:310,clientWidth:360}; }
  bind() {} setLocale() { return this; }
  emit(type,detail) { this.listeners.get(type)?.forEach(callback=>callback(detail)); }
  render() { this.scroll.scrollHeight=this.rowCount*this.options.rowHeight;this.scroll.scrollWidth=this.colCount*this.options.columnWidth; }
  renderCells() {} updateSelectionOverlay() {} scrollToCell() {}
}
const grid = new ModelGrid({}, {rows:60,columns:12,rowHeight:31,columnWidth:120,plugins:[worksheets()]});
installSheetGrowth(grid);
const scroll = (top=grid.scroll.scrollTop,left=grid.scroll.scrollLeft) => {
  grid.scroll.scrollTop=top;grid.scroll.scrollLeft=left;grid.emit('scroll',{});
};
grid.setCell(0,0,'kept');grid.anchor={row:4,col:1};grid.selection={r1:4,r2:5,c1:1,c2:2};
const history=grid.historyState;
let mutations=0;grid.on('mutation',()=>mutations++);
scroll(100);flush();assert.equal(grid.rowCount,60);
scroll(1500,1000);scroll(1520,1010);
assert.equal(frames.size,1,'scroll events coalesce');flush();
assert.equal(grid.rowCount,160);assert.equal(grid.colCount,24);
assert.equal(grid.getRawValue(0,0),'kept');assert.deepEqual(grid.anchor,{row:4,col:1});
assert.deepEqual(grid.selection,{r1:4,r2:5,c1:1,c2:2});assert.deepEqual(grid.historyState,history);
assert.equal(mutations,1,'new dimensions are saved');
scroll(1520,1010);flush();assert.equal(grid.rowCount,160,'stationary events do not grow');
// A fling back from the edge cancels pending growth.
scroll(4600);scroll(0);flush();assert.equal(grid.rowCount,160);
for(const mode of ['readOnly','sqlBinding','_editing']){
  grid[mode]=true;scroll(4600);flush();assert.equal(grid.rowCount,160,mode);grid[mode]=false;scroll(0);
}
scroll(4600);grid.readOnly=true;flush();assert.equal(grid.rowCount,160);grid.readOnly=false;
scroll(0);scroll(4600);grid.emit('worksheet',{type:'select'});flush();assert.equal(grid.rowCount,160,'sheet switches cancel growth');
grid.ensureSize(sheetLimits.rows-1,sheetLimits.columns-1);grid.render();scroll(0,0);
scroll(grid.scroll.scrollHeight-310,grid.scroll.scrollWidth-360);flush();
assert.equal(grid.rowCount,sheetLimits.rows);assert.equal(grid.colCount,sheetLimits.columns);
scroll(0,0);scroll(grid.scroll.scrollHeight-310,grid.scroll.scrollWidth-360);flush();assert.equal(mutations,2,'no growth beyond demo limits');
// Workbook round trips preserve the extended space on every sheet.
const restored=new ModelGrid({}, {rows:60,columns:12,plugins:[worksheets()]});
restored.importWorkbook(grid.exportWorkbook({computedValues:false}));
assert.equal(restored.rowCount,sheetLimits.rows);assert.equal(restored.colCount,sheetLimits.columns);
assert.equal(restored.getRawValue(0,0),'kept');
grid.ensureSize(sheetLimits.rows+10,sheetLimits.columns+10);grid.render();scroll(0,0);
scroll(grid.scroll.scrollHeight-310,grid.scroll.scrollWidth-360);flush();
assert.equal(grid.rowCount,sheetLimits.rows+10,'larger imports are never shrunk');
assert.equal(grid.colCount,sheetLimits.columns+10);
grid.emit('destroy',{});scroll(0,0);scroll(grid.scroll.scrollHeight-310);assert.equal(frames.size,0);
console.log('Sheet growth, navigation, persistence and limits regression tests passed');
