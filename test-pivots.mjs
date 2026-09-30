import assert from 'node:assert/strict';
import TinyDatagrid from './src/tinygrid.js';
import { sheetPivots } from './src/pivots.js';
import { worksheets } from './src/worksheets.js';

class ModelGrid extends TinyDatagrid {
  build() {} bind() {} setLocale(locale) { this.locale = locale; return this; } render() { this._updateFilteredRows(); this.engine.settle(); } renderCells() {} layout() { this._updateFilteredRows(); } emit(name, detail) { (this.events ??= []).push(name); }
}
const DATA = [['Region', 'Product', 'Sales'], ['North', 'Pen', 10], ['South', 'Pen', 20], ['North', 'Ink', 5], ['South', 'Ink', 7], ['North', 'Pen', 1]];
const make = (options = {}) => {
  const grid = new ModelGrid({}, { rows: 30, columns: 12, historyLimit: 30, plugins: [sheetPivots(), ...(options.sheets ? [worksheets()] : [])], ...options.grid });
  grid.load(DATA); grid.createTable({ r1: 0, c1: 0, r2: 5, c2: 2 }); grid.clearHistory();
  return grid;
};
const block = (grid, r1, c1, r2, c2) => Array.from({ length: r2 - r1 + 1 }, (_, r) => Array.from({ length: c2 - c1 + 1 }, (_, c) => grid.getComputedValue(r1 + r, c1 + c)));
const config = { rows: ['Region'], values: [{ field: 'Sales', aggregate: 'sum', as: 'Sales' }] };

// ---- a pivot bound to a table --------------------------------------------------------------------------
let grid = make(), pivots = grid.feature('pivots');
const id = pivots.insert({ table: 'table1', target: { row: 0, col: 5 }, config });
assert.equal(id, 'pivot1');
assert.deepEqual(block(grid, 0, 5, 2, 6), [['Region', 'Sales'], ['North', 16], ['South', 27]]);
assert.equal(pivots.get(id).table, 'table1', 'the pivot remembers its source table');
assert.deepEqual(pivots.get(id).source, { r1: 0, c1: 0, r2: 5, c2: 2 });
assert.equal(grid.getCell(1, 5).pivotOwner, id);
assert.deepEqual(pivots.at(1, 6).output, { r1: 0, c1: 5, r2: 2, c2: 6 });
assert.equal(pivots.at(1, 1), null, 'ordinary cells do not belong to a pivot');
assert.equal(grid.setCell(1, 6, 99), false, 'a pivot result cannot be typed over');
assert.equal(grid.getComputedValue(1, 6), 16);

// values follow the source
grid.setCell(1, 2, 110);
assert.equal(grid.getComputedValue(1, 6), 116);

// a new record typed under the table becomes part of it, and of the pivot
assert.equal(grid.table.r2, 5);
grid.setCell(6, 0, 'East'); grid.setCell(6, 1, 'Pen'); grid.setCell(6, 2, 40);
assert.equal(grid.table.r2, 6, 'typing directly under the table extends it');
assert.deepEqual(block(grid, 0, 5, 3, 6), [['Region', 'Sales'], ['North', 116], ['South', 27], ['East', 40]]);
grid.undo(); grid.undo(); grid.undo();
assert.equal(grid.table.r2, 5, 'undo restores the table extent');
assert.deepEqual(block(grid, 0, 5, 3, 6), [['Region', 'Sales'], ['North', 116], ['South', 27], ['', '']]);
assert.equal(grid.getCell(3, 5).pivotOwner, undefined, 'rows that left the result are cleared');

// the growth rules
grid.setCell(7, 0, 'gap'); assert.equal(grid.table.r2, 5, 'a gap between table and entry does not extend it');
grid.setCell(7, 0, '');
grid.setCell(6, 4, 'side'); assert.equal(grid.table.r2, 5, 'only cells in the table columns extend it');
grid.setCell(6, 4, '');
grid.setCell(6, 0, ''); assert.equal(grid.table.r2, 5, 'clearing a cell does not extend it');
const fixed = make({ grid: { tableAutoExpand: false } });
fixed.setCell(6, 0, 'East'); assert.equal(fixed.table.r2, 5, 'the option turns growth off');
const filtered = make(); filtered.setColumnFilter(0, ['North']);
filtered.setCell(6, 0, 'West'); assert.equal(filtered.table.r2, 5, 'a filtered table keeps its extent');

// ---- changing the settings -----------------------------------------------------------------------------
grid = make(); pivots = grid.feature('pivots');
pivots.insert({ table: 'table1', target: { row: 0, col: 5 }, config });
grid.clearHistory();
assert.equal(pivots.update('pivot1', { config: { rows: ['Region'], columns: ['Product'], values: [{ field: 'Sales', aggregate: 'sum', as: 'Sales' }] } }), true);
assert.deepEqual(block(grid, 0, 5, 2, 8), [['Region', 'Pen · Sales', 'Ink · Sales', ''], ['North', 11, 5, ''], ['South', 20, 7, '']]);
assert.deepEqual(pivots.get('pivot1').output, { r1: 0, c1: 5, r2: 2, c2: 7 });
assert.equal(grid.historyState.undo, 1, 'one undo step');
grid.undo();
assert.deepEqual(block(grid, 0, 5, 2, 6), [['Region', 'Sales'], ['North', 16], ['South', 27]]);
assert.equal(grid.getCell(0, 7).pivotOwner, undefined, 'undo takes the extra column away again');
grid.redo();
assert.equal(grid.getComputedValue(0, 7), 'Ink · Sales');

// fewer rows shrink the result and free the cells
pivots.update('pivot1', { config: { rows: [], values: [{ field: 'Sales', aggregate: 'sum', as: 'Sales' }] } });
assert.deepEqual(pivots.get('pivot1').output, { r1: 0, c1: 5, r2: 1, c2: 5 });
assert.equal(grid.getCell(2, 5).pivotOwner, undefined);
pivots.update('pivot1', { config });

// moving the pivot
assert.throws(() => pivots.update('pivot1', { target: { row: 1, col: 0 } }), /occupied|must not include/);
grid.setCell(9, 9, 'busy');
assert.throws(() => pivots.update('pivot1', { target: { row: 9, col: 9 } }), /occupied/);
pivots.update('pivot1', { target: { row: 8, col: 5 } });
assert.deepEqual(block(grid, 8, 5, 10, 6), [['Region', 'Sales'], ['North', 16], ['South', 27]]);
assert.equal(grid.getCell(0, 5).pivotOwner, undefined, 'the old place is free');
assert.equal(grid.getCell(0, 5).raw ?? '', '');

// errors leave the pivot untouched
assert.throws(() => pivots.update('pivot1', { config: { rows: ['Region'], values: [] } }), /value fields/);
assert.throws(() => pivots.update('pivot1', { config: { values: [{ field: 'Sales', aggregate: 'median' }] } }), /aggregate/);
assert.throws(() => pivots.update('pivot1', { table: 'nope' }), /Unknown table/);
assert.throws(() => pivots.update('missing', {}), /Unknown pivot/);
assert.equal(block(grid, 8, 6, 8, 6)[0][0], 'Sales');

// detach from the table: the source stays a fixed range
pivots.update('pivot1', { table: null });
assert.equal(pivots.get('pivot1').table, undefined);
grid.setCell(6, 0, 'East'); grid.setCell(6, 1, 'Pen'); grid.setCell(6, 2, 40);
assert.deepEqual(block(grid, 8, 5, 10, 6), [['Region', 'Sales'], ['North', 16], ['South', 27]], 'a detached pivot ignores new rows');
// ... and binding it again picks the table up (which grew with the new record)
pivots.update('pivot1', { table: 'table1' });
assert.deepEqual(pivots.get('pivot1').source, { r1: 0, c1: 0, r2: 6, c2: 2 });
assert.deepEqual(block(grid, 8, 5, 11, 6), [['Region', 'Sales'], ['North', 16], ['South', 27], ['East', 40]]);

// recalculate on demand
assert.equal(pivots.recalculate('pivot1'), true);
assert.equal(pivots.recalculate('missing'), false);
assert.equal(pivots.recalculate(), true);
assert.equal(grid.getComputedValue(9, 6), 16);

// scope changes, and a removed table leaves the pivot on its last range
pivots.update('pivot1', { analysis: { scope: 'visible' } });
assert.deepEqual(pivots.get('pivot1').analysis, { scope: 'visible' });
assert.throws(() => pivots.update('pivot1', { analysis: { scope: 'selection' } }), /analysis scope/);
assert.throws(() => pivots.update('pivot1', { analysis: { scope: 'sideways' } }), /analysis scope/);
grid.removeTable('table1');
assert.equal(pivots.get('pivot1').table, undefined, 'removing the table detaches the pivot');
assert.deepEqual(pivots.get('pivot1').source, { r1: 0, c1: 0, r2: 6, c2: 2 });
assert.equal(grid.getComputedValue(9, 6), 16, 'and it keeps working on that range');
grid.undo();
assert.equal(pivots.get('pivot1').table, 'table1', 'undo binds it again');

// ---- rows and columns inserted around the pivot ---------------------------------------------------------
grid = make(); pivots = grid.feature('pivots');
pivots.insert({ table: 'table1', target: { row: 2, col: 5 }, config });
grid.insertRow(0);
assert.deepEqual(pivots.get('pivot1').target, { row: 3, col: 5 });
assert.deepEqual(pivots.get('pivot1').source, { r1: 1, c1: 0, r2: 6, c2: 2 });
assert.deepEqual(block(grid, 3, 5, 5, 6), [['Region', 'Sales'], ['North', 16], ['South', 27]]);
grid.insertColumn(0);
assert.deepEqual(pivots.get('pivot1').target, { row: 3, col: 6 });
assert.deepEqual(block(grid, 3, 6, 5, 7), [['Region', 'Sales'], ['North', 16], ['South', 27]]);
grid.deleteColumn(0); grid.deleteRow(0);
assert.deepEqual(block(grid, 2, 5, 4, 6), [['Region', 'Sales'], ['North', 16], ['South', 27]]);
assert.equal(pivots.get('pivot1').error, null);

// a fixed range moves with the sheet too
grid = make(); pivots = grid.feature('pivots');
pivots.insert({ source: { r1: 0, c1: 0, r2: 5, c2: 2 }, target: { row: 0, col: 5 }, config });
grid.insertRow(0);
assert.deepEqual(pivots.get('pivot1').source, { r1: 1, c1: 0, r2: 6, c2: 2 });
assert.deepEqual(block(grid, 1, 5, 3, 6), [['Region', 'Sales'], ['North', 16], ['South', 27]]);

// ---- saving and loading --------------------------------------------------------------------------------
grid = make(); pivots = grid.feature('pivots');
pivots.insert({ table: 'table1', target: { row: 0, col: 5 }, config, analysis: { scope: 'all' } });
const saved = JSON.parse(JSON.stringify(grid.exportWorkbook()));
assert.equal(saved.sheets[0].pivotTables[0].table, 'table1');
const loaded = new ModelGrid({}, { rows: 30, columns: 12, plugins: [sheetPivots()] });
loaded.importWorkbook(saved, { replace: true });
assert.deepEqual(block(loaded, 0, 5, 2, 6), [['Region', 'Sales'], ['North', 16], ['South', 27]]);
assert.equal(loaded.getCell(1, 5).pivotOwner, 'pivot1', 'the result cells are still pivot cells');
loaded.setCell(1, 2, 30); assert.equal(loaded.getComputedValue(1, 6), 36, 'a loaded pivot is still live');
loaded.setCell(6, 0, 'East'); loaded.setCell(6, 2, 4);
assert.equal(loaded.table.r2, 6);
assert.equal(loaded.getComputedValue(3, 5), 'East', 'and follows its table');
loaded.feature('pivots').update('pivot1', { config: { rows: ['Product'], values: [{ field: 'Sales', aggregate: 'max', as: 'Sales' }] } });
assert.deepEqual(block(loaded, 0, 5, 2, 6), [['Product', 'Sales'], ['Pen', 30], ['Ink', 7]]);

// ---- read-only, removal --------------------------------------------------------------------------------
grid.readOnly = true;
assert.throws(() => pivots.update('pivot1', { config }), /read-only/);
grid.readOnly = false;
assert.equal(pivots.remove('pivot1'), true);
assert.equal(grid.getCell(1, 5).pivotOwner, undefined);
assert.equal(pivots.at(1, 5), null);

// ---- several sheets ------------------------------------------------------------------------------------
grid = make({ sheets: true }); pivots = grid.feature('pivots');
const sheets = grid.feature('worksheets');
pivots.insert({ table: 'table1', target: { row: 0, col: 5 }, config });
const second = sheets.add('Other');
sheets.select(second);
grid.setCell(0, 0, '=Sheet1!G2');
assert.equal(grid.getComputedValue(0, 0), 16, 'another sheet reads the pivot result');
sheets.select('sheet1');
assert.equal(grid.getCell(1, 5).pivotOwner, 'pivot1');
grid.setCell(1, 2, 12); assert.equal(grid.getComputedValue(1, 6), 18);
assert.equal(grid.feature('pivots').at(1, 5).table, 'table1');

console.log('Pivot tests passed');
