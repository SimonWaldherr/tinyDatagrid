import assert from 'node:assert/strict';
import TinyDatagrid from '../src/tinygrid.js';
import { findDuplicateRows, removeDuplicateRows, cleanSpaces, trimSpaces, splitText, splitTextToColumns } from '../src/data-tools.js';

class ModelGrid extends TinyDatagrid {
  build() {} bind() {} setLocale(locale) { this.locale = locale; return this; } render() { this._updateFilteredRows(); this.engine.settle(); } renderCells() {} layout() { this._updateFilteredRows(); } emit() {}
}
const make = data => { const grid = new ModelGrid({}, { rows: 12, columns: 6, historyLimit: 20 }); grid.load(data); grid.clearHistory(); return grid; };
const column = (grid, col, rows = 12) => Array.from({ length: rows }, (_, r) => grid.getComputedValue(r, col));

// ---- duplicates -------------------------------------------------------------
let grid = make([['Name', 'City', 'Amount'], ['Ann', 'Bonn', 1], ['ann ', 'BONN', 1], ['Ben', 'Köln', 2], ['Ann', 'Bonn', 1], ['Ann', 'Essen', 3]]);
const found = findDuplicateRows(grid, { r1: 0, c1: 0, r2: 5, c2: 2 }, { hasHeader: true });
assert.deepEqual(found.keep, [1, 3, 5]);
assert.deepEqual(found.drop, [2, 4]);
assert.deepEqual(findDuplicateRows(grid, { r1: 0, c1: 0, r2: 5, c2: 2 }, { hasHeader: true, matchCase: true }).drop, [4], 'case and outer spaces matter when asked');
assert.deepEqual(findDuplicateRows(grid, { r1: 0, c1: 0, r2: 5, c2: 2 }, { hasHeader: true, columns: [0] }).drop, [2, 4, 5], 'only the chosen columns are compared');

let result = removeDuplicateRows(grid, { r1: 0, c1: 0, r2: 5, c2: 2 }, { hasHeader: true });
assert.deepEqual(result, { removed: 2, kept: 3 });
assert.deepEqual(column(grid, 0, 7), ['Name', 'Ann', 'Ben', 'Ann', '', '', '']);
assert.deepEqual(column(grid, 1, 6), ['City', 'Bonn', 'Köln', 'Essen', '', '']);
assert.equal(grid.historyState.undo, 1, 'one undo step');
grid.undo();
assert.deepEqual(column(grid, 0, 6), ['Name', 'Ann', 'ann ', 'Ben', 'Ann', 'Ann']);
assert.deepEqual(removeDuplicateRows(grid, { r1: 0, c1: 0, r2: 5, c2: 2 }, { hasHeader: true, columns: [0, 1, 2], matchCase: true }), { removed: 1, kept: 4 });

// nothing to do, and rows below the range are untouched
grid = make([['a', 1], ['b', 2], ['c', 3], ['Below', 'keep']]);
assert.deepEqual(removeDuplicateRows(grid, { r1: 0, c1: 0, r2: 2, c2: 1 }), { removed: 0, kept: 3 });
assert.equal(grid.historyState.undo, 0);

// formulas and formats move with their row
grid = make([['x', 1, '=B1*10'], ['y', 2, '=B2*10'], ['x', 1, '=B3*10'], ['z', 4, '=B4*10'], ['tail', 9]]);
grid.formatSelection.call(Object.assign(grid, { selection: { r1: 3, c1: 1, r2: 3, c2: 1 }, renderCells() {} }), { type: 'currency', currency: 'EUR' });
result = removeDuplicateRows(grid, { r1: 0, c1: 0, r2: 3, c2: 2 });
assert.deepEqual(result, { removed: 1, kept: 3 });
assert.deepEqual(column(grid, 0, 5), ['x', 'y', 'z', '', 'tail']);
assert.deepEqual(column(grid, 2, 4), [10, 20, 40, ''], 'relative references follow the moved rows');
assert.equal(grid.getRawValue(2, 2), '=B3*10');
assert.deepEqual(grid.getCell(2, 1).numberFormat, { type: 'currency', currency: 'EUR' });
assert.equal(grid.getCell(3, 1).numberFormat, undefined, 'the freed row is emptied completely');

// refusals
grid = make([['=SEQUENCE(3;1)'], [], [], ['x'], ['x']]);
assert.equal(removeDuplicateRows(grid, { r1: 0, c1: 0, r2: 4, c2: 0 }).refused, 'spill');
grid.readOnly = true;
assert.equal(removeDuplicateRows(grid, { r1: 0, c1: 0, r2: 4, c2: 0 }).refused, 'locked');

// ---- spaces --------------------------------------------------------------------
assert.equal(cleanSpaces('  a   b\t c  '), 'a b c');
assert.equal(cleanSpaces('x  y'), 'x y');
assert.equal(cleanSpaces(' line one  \n  line   two '), 'line one\nline two');
grid = make([['  Ann  ', 'Bob   Miller', 42, '=" x "'], [' {"a": "b   c"} ', ' [1, 2] ', ' nb ', 'ok']]);
assert.deepEqual(trimSpaces(grid, { r1: 0, c1: 0, r2: 1, c2: 3 }), { changed: 3, refused: undefined });
assert.equal(grid.getRawValue(0, 0), 'Ann');
assert.equal(grid.getRawValue(0, 1), 'Bob Miller');
assert.equal(grid.getRawValue(0, 2), 42);
assert.equal(grid.getRawValue(0, 3), '=" x "');
assert.equal(grid.getRawValue(1, 0), ' {"a": "b   c"} ', 'JSON text is left alone');
assert.equal(grid.getRawValue(1, 1), ' [1, 2] ');
assert.equal(grid.getRawValue(1, 2), 'nb');
assert.equal(grid.historyState.undo, 1);
assert.deepEqual(trimSpaces(grid, { r1: 0, c1: 0, r2: 1, c2: 3 }), { changed: 0 });
assert.deepEqual(trimSpaces(grid, { r1: 0, c1: 0, r2: 0, c2: 0 }), { changed: 0 }, 'a second run finds nothing');

// ---- text to columns ---------------------------------------------------------------
assert.deepEqual(splitText('a,b,c'), ['a', 'b', 'c']);
assert.deepEqual(splitText('a,"b,c",d'), ['a', 'b,c', 'd']);
assert.deepEqual(splitText('a,"b,c",d', { quotes: false }), ['a', '"b', 'c"', 'd']);
assert.deepEqual(splitText('a;;b', { delimiter: ';' }), ['a', '', 'b']);
assert.deepEqual(splitText('a;;b', { delimiter: ';', collapse: true }), ['a', 'b']);
assert.deepEqual(splitText('a::b::c', { delimiter: '::' }), ['a', 'b', 'c']);
assert.deepEqual(splitText('one  two   three', { delimiter: ' ', collapse: true }), ['one', 'two', 'three']);
assert.deepEqual(splitText('a\tb', { delimiter: '\t' }), ['a', 'b']);
assert.deepEqual(splitText('', { delimiter: ',' }), ['']);
assert.deepEqual(splitText('plain', { delimiter: '' }), ['plain']);

grid = make([['Ann, 31, Bonn'], ['Ben, 25, "Köln, DE"'], ['single'], ['=1+1'], [''], ['Cy, 40']]);
result = splitTextToColumns(grid, { r1: 0, c1: 0, r2: 5, c2: 0 }, { delimiter: ',' });
assert.deepEqual(result, { rows: 3, columns: 3 });
assert.deepEqual([0, 1, 2].map(c => grid.getComputedValue(0, c)), ['Ann', 31, 'Bonn'], 'parts are typed like typed cells');
assert.deepEqual([0, 1, 2].map(c => grid.getComputedValue(1, c)), ['Ben', 25, 'Köln, DE']);
assert.equal(grid.getComputedValue(2, 0), 'single');
assert.equal(grid.getRawValue(3, 0), '=1+1', 'formulas are not split');
assert.deepEqual([0, 1].map(c => grid.getComputedValue(5, c)), ['Cy', 40]);
assert.equal(grid.historyState.undo, 1);
grid.undo();
assert.equal(grid.getRawValue(0, 0), 'Ann, 31, Bonn');
assert.equal(grid.getRawValue(0, 1), '');

grid = make([['a,b'], ['c,d'], ['e,f']]);
grid.setCell(1, 1, 'occupied');
grid.clearHistory();
result = splitTextToColumns(grid, { r1: 0, c1: 0, r2: 2, c2: 0 }, { delimiter: ',' });
assert.equal(result.blocked, true, 'existing content on the right blocks the split');
assert.deepEqual(column(grid, 0, 3), ['a,b', 'c,d', 'e,f'], 'nothing is changed when blocked');
assert.equal(grid.historyState.undo, 0);
grid.hiddenRows.add(1);
grid.setCell(1, 1, '');
assert.deepEqual(splitTextToColumns(grid, { r1: 0, c1: 0, r2: 2, c2: 0 }, { delimiter: ',' }), { rows: 2, columns: 2 }, 'hidden rows are skipped');
assert.equal(grid.getRawValue(1, 0), 'c,d');
console.log('Data tools tests passed');
