import assert from 'node:assert/strict';
import TinyDatagrid from '../src/tinygrid.js';
import { JSONValue } from '../src/json-values.js';
import { worksheets } from '../src/worksheets.js';
import * as features from '../src/features.js';
const optionalPlugins = () => ['dynamicArrays', 'jsonFunctions'].flatMap(name => typeof features[name] === 'function' ? [features[name]()] : []);

class ModelGrid extends TinyDatagrid {
  build() {} bind() {} setLocale(locale) { this.locale = locale; return this; } render() { this._updateFilteredRows(); this.engine.settle(); } renderCells() {} layout() { this._updateFilteredRows(); } emit() {}
}
const make = (data, options = {}) => { const grid = new ModelGrid({}, { rows: 10, columns: 6, historyLimit: 30, plugins: optionalPlugins(), ...options }); if (data) grid.load(data); return grid; };
const at = (grid, address) => grid.getComputedValue(...(([, letters, digits]) => [Number(digits) - 1, letters.toUpperCase().charCodeAt(0) - 65])(/^([A-Za-z]+)(\d+)$/.exec(address)));
const block = (grid, r1, c1, r2, c2) => { const rows = []; for (let r = r1; r <= r2; r++) { const row = []; for (let c = c1; c <= c2; c++) row.push(grid.getComputedValue(r, c)); rows.push(row); } return rows; };

// ---- ranges as values: broadcasting and lifted functions ------------------
const values = new Map([['0,0', 1], ['1,0', 2], ['2,0', 3], ['0,1', 10], ['1,1', 20], ['2,1', 30], ['0,2', 'ann'], ['1,2', 'BOB'], ['2,2', '']]);
const host = new ModelGrid({}, { rows: 10, columns: 6, plugins: optionalPlugins() });
const engine = host.engine;
const restore = () => { host.cells = new Map([...values].filter(([, item]) => item !== '').map(([key, item]) => [key, { raw: item }])); host.engine.clearCache(); };
restore();
assert.deepEqual(engine.evaluateFormula('=A1:A3*2'), [[2], [4], [6]]);
assert.deepEqual(engine.evaluateFormula('=A1:A3+B1:B3'), [[11], [22], [33]]);
assert.deepEqual(engine.evaluateFormula('=A1:B1*A1:A2'), [[1, 10], [2, 20]], 'a row and a column stretch to a table');
assert.deepEqual(engine.evaluateFormula('=-A1:A2'), [[-1], [-2]]);
assert.deepEqual(engine.evaluateFormula('=A1:A3>1'), [[false], [true], [true]]);
assert.deepEqual(engine.evaluateFormula('=A1:A3&"x"'), [['1x'], ['2x'], ['3x']]);
assert.deepEqual(engine.evaluateFormula('=A1:A3+B1:B2'), [[11], [22], ['#N/A']], 'mismatched sizes yield #N/A');
assert.deepEqual(engine.evaluateFormula('=IF(A1:A3>1;"big";"small")'), [['small'], ['big'], ['big']]);
assert.deepEqual(engine.evaluateFormula('=IF(A1:A3>1;A1:A3)'), [[false], [2], [3]]);
assert.deepEqual(engine.evaluateFormula('=UPPER(C1:C3)'), [['ANN'], ['BOB'], ['']]);
assert.deepEqual(engine.evaluateFormula('=LEN(C1:C3)'), [[3], [3], [0]]);
assert.deepEqual(engine.evaluateFormula('=ROUND(B1:B3/7;1)'), [[1.4], [2.9], [4.3]]);
assert.deepEqual(engine.evaluateFormula('=LEFT(C1:C3;A1:A3)'), [['a'], ['BO'], ['']]);
assert.deepEqual(engine.evaluateFormula('=JSON.GET("{""k"":[1,2]}";"k[0]")'), 1);
assert.equal(engine.evaluateFormula('=SUM(A1:A3*2)'), 12);
assert.equal(engine.evaluateFormula('=SUMPRODUCT(A1:A3;B1:B3)'), 140);
values.set('1,0', 'oops'); restore();
assert.deepEqual(engine.evaluateFormula('=A1:A3*2'), [[2], ['#VALUE!'], [6]], 'a bad element only affects its own result');
values.set('1,2', '#N/A'); restore();
assert.deepEqual(engine.evaluateFormula('=UPPER(C1:C3)'), [['ANN'], ['#N/A'], ['']], 'errors travel per element');
values.set('1,0', 2); values.set('1,2', 'BOB'); restore();

// ---- spill basics ---------------------------------------------------------
let grid = make([['=SEQUENCE(4;2)', '', '=SUM(A1:B4)'], [], [], [], ['', '=A1#']]);
assert.deepEqual(block(grid, 0, 0, 3, 1), [[1, 2], [3, 4], [5, 6], [7, 8]]);
assert.equal(at(grid, 'C1'), 36);
assert.equal(at(grid, 'A1'), 1, 'the formula cell itself holds the top-left value');
assert.deepEqual(grid.getSpillRanges(), [{ row: 0, col: 0, rows: 4, cols: 2 }, { row: 4, col: 1, rows: 4, cols: 2 }], 'B5 (=A1#) copies the spill into its own range');
assert.deepEqual(block(grid, 4, 1, 7, 2), [[1, 2], [3, 4], [5, 6], [7, 8]]);
assert.deepEqual(grid.getUsedRange(), { r1: 0, c1: 0, r2: 7, c2: 2 });
assert.equal(grid.getRawValue(1, 0), '', 'spilled cells hold no content of their own');
assert.deepEqual(grid.getSpill(0, 0), [[1, 2], [3, 4], [5, 6], [7, 8]]);
grid.setCell(4, 1, '');
grid.setCell(4, 3, '=SUM(A1#)');
assert.equal(at(grid, 'D5'), 36, 'A1# refers to the whole spill');
grid.setCell(4, 4, '=ROWS(A1#)+COLUMNS(A1#)*10');
assert.equal(at(grid, 'E5'), 24);
grid.setCell(4, 4, '=A3#');
assert.equal(at(grid, 'E5'), 5, 'a cell that is not a spill origin behaves like a one-cell range');

// edits change size, contents and dependents
grid.setCell(0, 0, '=SEQUENCE(2;2;10)');
assert.deepEqual(block(grid, 0, 0, 3, 1), [[10, 11], [12, 13], ['', ''], ['', '']]);
assert.equal(at(grid, 'C1'), 46);
assert.equal(at(grid, 'D5'), 46);
grid.setCell(0, 0, '=SEQUENCE(3;1)');
assert.equal(at(grid, 'B1'), '');
assert.equal(at(grid, 'C1'), 6);
grid.setCell(0, 0, '');
assert.deepEqual(grid.getSpillRanges(), []);
assert.equal(at(grid, 'A2'), '');
assert.equal(at(grid, 'C1'), 0);
grid.setCell(0, 0, 'plain');
assert.equal(at(grid, 'A1'), 'plain');

// growing the sheet
grid = make([['=SEQUENCE(25;1)']], { rows: 6 });
assert.equal(at(grid, 'A25'), 25);
assert.ok(grid.rowCount >= 25, `sheet grows to hold the spill (${grid.rowCount})`);

// ---- blocked spills -------------------------------------------------------
grid = make([['=SEQUENCE(3;2)', '', '=A1']]);
grid.setCell(2, 1, 'x');
assert.equal(at(grid, 'A1'), '#SPILL! Blocked by B3');
assert.equal(at(grid, 'C1'), '#SPILL! Blocked by B3', 'errors propagate to dependents');
assert.equal(at(grid, 'A2'), '');
assert.equal(grid.getSpillRanges().length, 0);
grid.setCell(2, 1, '');
assert.deepEqual(block(grid, 0, 0, 2, 1), [[1, 2], [3, 4], [5, 6]], 'clearing the blocker restores the spill');
assert.equal(at(grid, 'C1'), 1);
grid.setCell(1, 1, 'typed over');
assert.match(String(at(grid, 'A1')), /^#SPILL! Blocked by B2/);
assert.equal(at(grid, 'B2'), 'typed over');
grid.clearHistory();
grid.setCell(1, 1, '');
assert.equal(at(grid, 'B2'), 4);
grid.setCell(0, 0, '=SEQUENCE(400;400)');
assert.equal(at(grid, 'A1'), '#NUM!', 'SEQUENCE has its own size limit');
grid.options.maxSpillCells = 10;
grid.setCell(0, 0, '=SEQUENCE(4;4)');
assert.match(String(at(grid, 'A1')), /^#SPILL! Result too large/);
grid.options.maxSpillCells = 100000;
grid = make([['=SEQUENCE(1;3)', '=SEQUENCE(1;1)']]);
assert.match(String(at(grid, 'A1')), /^#SPILL! Blocked by B1/);

// two spills competing: the earlier cell in reading order keeps the area
grid = make([[], ['=SEQUENCE(1;4)'], []]);
grid.setCell(0, 2, '=SEQUENCE(3;2)');
assert.deepEqual(block(grid, 0, 2, 2, 3), [[1, 2], [3, 4], [5, 6]]);
assert.equal(at(grid, 'A2'), '#SPILL! Overlaps C1');
grid.setCell(0, 2, '');
assert.deepEqual(block(grid, 1, 0, 1, 3), [[1, 2, 3, 4]], 'the loser recovers when the winner disappears');
grid.setCell(0, 2, '=SEQUENCE(3;2)');
assert.equal(at(grid, 'A2'), '#SPILL! Overlaps C1');
assert.deepEqual(block(grid, 0, 2, 2, 3), [[1, 2], [3, 4], [5, 6]]);
// a formula placed inside another spill's area turns the earlier spill into #SPILL!
grid = make([['=SEQUENCE(2;2)']]);
grid.setCell(1, 1, '=SEQUENCE(1;2)');
assert.equal(at(grid, 'A1'), '#SPILL! Blocked by B2');
assert.equal(at(grid, 'B2'), 1);

// ---- evaluation order independence ---------------------------------------
grid = make(null);
grid.load([['=SUM(B2:B4)'], ['', ''], []]);      // reads cells that a later formula fills
grid.setCell(0, 1, '=SEQUENCE(4;1;10)');
assert.equal(at(grid, 'A1'), 36);
grid = make(null);
grid.cells.set('0,3', { raw: '=SUM(B2:B4)+SUM(B2:B4)' });   // insertion order: consumer before producer
grid.cells.set('0,1', { raw: '=SEQUENCE(4;1;10)' });
grid.engine.clearCache();
assert.equal(at(grid, 'D1'), 72);
assert.equal(at(grid, 'B4'), 13);

// ---- history and workbooks ------------------------------------------------
grid = make([['=SEQUENCE(3;1)'], [], []]);
grid.clearHistory();
grid.setCell(1, 0, 'blocker');
assert.match(String(at(grid, 'A1')), /^#SPILL!/);
assert.equal(grid.undo(), true);
assert.deepEqual(block(grid, 0, 0, 2, 0), [[1], [2], [3]]);
assert.equal(grid.redo(), true);
assert.match(String(at(grid, 'A1')), /^#SPILL!/);
grid.undo();

const workbook = JSON.parse(JSON.stringify(grid.exportWorkbook()));
assert.equal(workbook.sheets[0].cells.length, 1, 'only the formula is stored, not its spilled results');
const restored = make(null);
restored.importWorkbook(workbook);
assert.deepEqual(block(restored, 0, 0, 2, 0), [[1], [2], [3]]);
const valuesOnly = JSON.parse(JSON.stringify(grid.exportWorkbook({ formulas: false })));
assert.deepEqual(valuesOnly.sheets[0].cells.map(cell => cell.value).sort(), [1, 2, 3]);
grid.selection = { r1: 0, c1: 0, r2: 2, c2: 0 };
assert.equal(grid.copySelection(), '=SEQUENCE(3;1)\n2\n3');
assert.equal(grid.exportCSV({ computed: true }), '1\r\n2\r\n3');

// ---- JSON tables ----------------------------------------------------------
grid = make([['[{"id":1,"name":"Ann","tags":["a"]},{"id":2,"name":"Bob"},{"id":3,"name":"Cy"}]'], ['=JSON.TABLE(A1)'], [], [], [], ['', '', '', '', '=SUM(B3:B5)']], { rows: 12 });
assert.deepEqual(block(grid, 1, 0, 4, 3).map(row => row.map(item => item instanceof JSONValue ? item.value : item)), [['id', 'name', 'tags', ''], [1, 'Ann', ['a'], ''], [2, 'Bob', '', ''], [3, 'Cy', '', '']].map((row, index) => index === 0 ? ['id', 'name', 'tags', ''] : row));
assert.equal(at(grid, 'A3'), 1);
assert.equal(at(grid, 'B4'), 'Bob');
grid.setCell(0, 5, '=JSON.GET(A1;"[*].name")');
assert.ok(at(grid, 'F1') instanceof JSONValue);
grid.setCell(2, 5, '=JSON.GET(A1;"[*].name")');
grid.setCell(6, 0, '=UPPER(B3:B5)');
assert.deepEqual(block(grid, 6, 0, 8, 0), [['ANN'], ['BOB'], ['CY']]);
grid.setCell(9, 0, '=JSON.GET(A1;"[?(@.id>1)].name")');
assert.equal(String(at(grid, 'A10')), '["Bob","Cy"]');
grid.setCell(10, 0, '=JSON.FROMTABLE(A2:C5)');
assert.equal(String(at(grid, 'A11')).startsWith('[{"id":1'), true);

// a JSON column: one formula fills the derived column
grid = make([
  ['{"n":"x","v":1}'], ['{"n":"y","v":2}'], ['{"n":"z"}'],
], { rows: 8 });
grid.setCell(0, 1, '=JSON.GET(A1:A3;"n")');
grid.setCell(0, 2, '=JSON.GET(A1:A3;"v";0)');
assert.deepEqual(block(grid, 0, 1, 2, 2), [['x', 1], ['y', 2], ['z', 0]]);
grid.setCell(0, 3, '=SUM(C1:C3)+COUNTA(B1:B3)');
assert.equal(at(grid, 'D1'), 6);

// text helpers produce rows
grid = make([['a,b,c', '=SPLIT(A1;",")']]);
assert.deepEqual(block(grid, 0, 1, 0, 3).flat().length, 3);

// ---- worksheets: cross-sheet reads of spilled cells -----------------------
const book = new ModelGrid({}, { rows: 8, columns: 4, plugins: [worksheets(), ...optionalPlugins()] });
const sheets = book.feature('worksheets');
book.setSheetName('Data');
book.load([['=SEQUENCE(3;1;5)']]);
assert.deepEqual(block(book, 0, 0, 2, 0), [[5], [6], [7]]);
const second = sheets.add('Report');
sheets.select(second);
book.load([["=Data!A1+Data!A3"]]);
assert.equal(at(book, 'A1'), 12, 'other sheets can read spilled results');
sheets.select('sheet1');
assert.deepEqual(block(book, 0, 0, 2, 0), [[5], [6], [7]]);
// ---- performance guard: many small spills --------------------------------
const started = performance.now();
grid = make(null, { rows: 400, columns: 8 });
for (let r = 0; r < 200; r++) grid.cells.set(`${r * 2},0`, { raw: `=SEQUENCE(2;3;${r})` });
grid.engine.clearCache();
let total = 0;
for (let r = 0; r < 400; r++) for (let c = 0; c < 3; c++) total += grid.getComputedValue(r, c);
assert.ok(total > 0);
assert.ok(performance.now() - started < 3000, 'many spill formulas evaluate quickly');
console.log('Dynamic array tests passed');
