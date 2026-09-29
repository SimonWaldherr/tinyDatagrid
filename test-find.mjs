import assert from 'node:assert/strict';
import TinyDatagrid from './src/tinygrid.js';
import * as features from './src/features.js';
const { dataValidation } = features;
const optionalPlugins = () => ['dynamicArrays', 'jsonFunctions'].flatMap(name => typeof features[name] === 'function' ? [features[name]()] : []);

class ModelGrid extends TinyDatagrid {
  build() {} bind() {} setLocale(locale) { this.locale = locale; return this; } render() { this._updateFilteredRows(); this.engine.settle(); } renderCells() {} layout() { this._updateFilteredRows(); } emit() {}
}
const grid = new ModelGrid({}, { rows: 10, columns: 4, historyLimit: 10, plugins: [dataValidation(), ...optionalPlugins()] });
grid.load([
  ['Apple pie', 'apple', 10, '=UPPER(A1)'],
  ['Banana', 'APPLE sauce', 20, '=B2&"!"'],
  ['pineapple', 'Apple', 15, '=SEQUENCE(2;1;100)'],
  ['', '', '', '']
]);
const addresses = list => list.map(({ row, col }) => `${'ABCD'[col]}${row + 1}`);
assert.deepEqual(addresses(grid.find('apple')), ['A1', 'B1', 'D1', 'B2', 'D2', 'A3', 'B3']);
assert.deepEqual(addresses(grid.find('apple', { scope: 'formulas' })), ['A1', 'B1', 'B2', 'A3', 'B3']);
assert.deepEqual(addresses(grid.find('APPLE', { scope: 'values' })), ['A1', 'B1', 'D1', 'B2', 'D2', 'A3', 'B3']);
assert.deepEqual(addresses(grid.find('apple', { matchCase: true })), ['B1', 'A3']);
assert.deepEqual(addresses(grid.find('apple', { wholeCell: true })), ['B1', 'B3']);
assert.deepEqual(addresses(grid.find('^a\\w+', { regex: true, scope: 'formulas' })), ['A1', 'B1', 'B2', 'B3']);
assert.deepEqual(addresses(grid.find('apple', { range: { r1: 0, c1: 0, r2: 0, c2: 1 } })), ['A1', 'B1']);
assert.deepEqual(addresses(grid.find('101', { scope: 'values' })), ['D4'], 'spilled results are searchable');
assert.deepEqual(addresses(grid.find('101', { scope: 'formulas' })), []);
assert.deepEqual(grid.find(''), []);
assert.throws(() => grid.find('(', { regex: true }), SyntaxError);
grid.hiddenRows.add(1);
assert.deepEqual(addresses(grid.find('apple', { visibleOnly: true, scope: 'formulas' })), ['A1', 'B1', 'A3', 'B3']);
grid.hiddenRows.clear();

grid.clearHistory();
const first = grid.replace('apple', 'pear');
assert.deepEqual(first, { count: 5, cells: 5 });
assert.equal(grid.getRawValue(0, 0), 'pear pie');
assert.equal(grid.getRawValue(2, 0), 'pinepear');
assert.equal(grid.getComputedValue(0, 3), 'PEAR PIE', 'dependent formulas follow');
assert.equal(grid.historyState.undo, 1, 'replace all is a single undo step');
grid.undo();
assert.equal(grid.getRawValue(0, 0), 'Apple pie');
assert.equal(grid.getComputedValue(0, 3), 'APPLE PIE');

assert.deepEqual(grid.replace('a(p+)le', '<$1>', { regex: true, matchCase: false }), { count: 5, cells: 5 });
assert.equal(grid.getRawValue(0, 1), '<pp>');
grid.undo();
assert.deepEqual(grid.replace('$&', 'x'), { count: 0, cells: 0 });
grid.setCell(3, 0, 'cost $& more');
assert.deepEqual(grid.replace('$&', '[$1]'), { count: 1, cells: 1 });
assert.equal(grid.getRawValue(3, 0), 'cost [$1] more', 'plain replacements are literal');

assert.deepEqual(grid.replace('1', '2', { range: { r1: 0, c1: 2, r2: 2, c2: 2 } }), { count: 2, cells: 2 });
assert.deepEqual([grid.getComputedValue(0, 2), grid.getComputedValue(2, 2)], [20, 25], 'numbers are edited as text and become numbers again');
assert.deepEqual(grid.replace('B', 'b', { matchCase: true, wholeCell: true, scope: 'formulas' }), { count: 0, cells: 0 });
assert.deepEqual(grid.replace('Banana', 'b', { matchCase: true, wholeCell: true }), { count: 1, cells: 1 });

grid.setValidationRules([{ range: { r1: 0, c1: 2, r2: 2, c2: 2 }, type: 'integer', min: 0, max: 30 }]);
const before = grid.getRawValue(0, 2);
assert.deepEqual(grid.replace('20', '999', { range: { r1: 0, c1: 2, r2: 2, c2: 2 } }), { count: 0, cells: 0 }, 'a validation failure rolls the whole replace back');
assert.equal(grid.getRawValue(0, 2), before);
grid.readOnly = true;
assert.deepEqual(grid.replace('a', 'b'), { count: 0, cells: 0 });
console.log('Find and replace tests passed');
