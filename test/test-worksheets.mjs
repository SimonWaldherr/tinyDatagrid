import assert from 'node:assert/strict';
import TinyDatagrid from '../src/tinygrid.js';
import { worksheets } from '../src/worksheets.js';

class ModelGrid extends TinyDatagrid {
  build() {} bind() {} setLocale(locale) { this.locale = locale; return this; } render() { this._updateFilteredRows(); this.engine.settle(); } renderCells() {} layout() { this._updateFilteredRows(); } emit(type, detail) { (this.events ||= []).push({ type, ...detail }); }
}
const book = new ModelGrid({}, { rows: 6, columns: 4, plugins: [worksheets()] });
const sheets = book.feature('worksheets');
const names = () => sheets.list().map(sheet => sheet.name);
book.setSheetName('Data');
book.load([[1, 2, '=A1+B1']]);
const first = sheets.activeId;
const second = sheets.add('Report');
const third = sheets.add('Notes');
assert.deepEqual(names(), ['Data', 'Report', 'Notes']);

// ---- duplicate ------------------------------------------------------------
const copy = sheets.duplicate(first);
assert.deepEqual(names(), ['Data', 'Data (2)', 'Report', 'Notes'], 'the copy sits next to its source');
assert.equal(sheets.list()[1].id, copy);
assert.equal(sheets.duplicate(first), sheets.list()[1].id, 'the newest copy is inserted right after the source');
assert.deepEqual(names(), ['Data', 'Data (3)', 'Data (2)', 'Report', 'Notes']);
sheets.select(copy);
assert.equal(book.getComputedValue(0, 2), 3, 'formulas and values are copied');
assert.equal(book.historyState.undo, 0, 'a copy starts without history of its own');
book.setCell(0, 0, 10);
assert.equal(book.getComputedValue(0, 2), 12);
sheets.select(first);
assert.equal(book.getComputedValue(0, 2), 3, 'the source is unaffected by edits to the copy');
assert.throws(() => sheets.duplicate('missing'), /Unknown worksheet/);
assert.equal(sheets.duplicate(second, 'Report copy') != null, true);
assert.throws(() => sheets.duplicate(second, 'report COPY'), /already exists/);
sheets.remove(sheets.list().find(sheet => sheet.name === 'Report copy').id);
assert.throws(() => sheets.duplicate(second, ''), TypeError);

// formulas can address the copy by its name
sheets.select(third);
book.setCell(0, 0, "='Data (2)'!C1");
assert.equal(book.getComputedValue(0, 0), 12);

// ---- move -----------------------------------------------------------------
const ids = () => sheets.list().map(sheet => sheet.id);
const before = ids();
assert.equal(sheets.move(third, 0), true);
assert.equal(sheets.list()[0].name, 'Notes');
assert.equal(sheets.move(third, 0), false, 'moving to the same position is a no-op');
assert.equal(sheets.move(third, 99), true, 'positions are clamped');
assert.equal(sheets.list().at(-1).name, 'Notes');
assert.deepEqual(ids(), before, 'moving back restores the original order');
assert.equal(sheets.activeId, third, 'the active sheet does not change');
assert.deepEqual(book.exportWorkbook().sheets.map(sheet => sheet.name), names(), 'export follows the tab order');
assert.throws(() => sheets.move('missing', 0), /Unknown worksheet/);

// ---- tab colors -----------------------------------------------------------
assert.equal(sheets.setColor(first, '#2A78D6'), true);
assert.equal(sheets.list().find(sheet => sheet.id === first).color, '#2a78d6', 'colors are normalized to lowercase');
assert.throws(() => sheets.setColor(first, 'red'), TypeError);
assert.throws(() => sheets.setColor(first, '#12345'), TypeError);
assert.equal(sheets.list().find(sheet => sheet.id === first).color, '#2a78d6');
const colored = sheets.duplicate(first);
assert.equal(sheets.list().find(sheet => sheet.id === colored).color, '#2a78d6', 'a copy keeps the tab color');
sheets.setColor(colored, null);
assert.equal(sheets.list().find(sheet => sheet.id === colored).color, null);
sheets.remove(colored);

// ---- hiding ---------------------------------------------------------------
assert.equal(sheets.setHidden(second, true), true);
assert.equal(sheets.list().find(sheet => sheet.id === second).hidden, true);
assert.equal(sheets.setHidden(second, true), true, 'hiding twice is harmless');
sheets.select(first);
assert.equal(sheets.setHidden(first, true), true, 'hiding the active sheet moves the selection');
assert.notEqual(sheets.activeId, first);
assert.equal(sheets.list().find(sheet => sheet.id === sheets.activeId).hidden, false);
sheets.select(first);
assert.equal(sheets.list().find(sheet => sheet.id === first).hidden, false, 'selecting a hidden sheet shows it again');

// workbooks keep metadata
const saved = JSON.parse(JSON.stringify(book.exportWorkbook()));
assert.equal(saved.sheets.find(sheet => sheet.id === second).hidden, true);
assert.equal(saved.sheets.find(sheet => sheet.id === first).tabColor, '#2a78d6');
const restored = new ModelGrid({}, { rows: 6, columns: 4, plugins: [worksheets()] });
restored.importWorkbook(saved);
const restoredSheets = restored.feature('worksheets');
assert.deepEqual(restoredSheets.list().map(sheet => [sheet.name, sheet.color, sheet.hidden]), sheets.list().map(sheet => [sheet.name, sheet.color, sheet.hidden]));
// a hostile or damaged file cannot hide everything or inject odd colors
const damaged = JSON.parse(JSON.stringify(saved));
damaged.sheets.forEach(sheet => { sheet.hidden = true; sheet.tabColor = 'url(javascript:alert(1))'; });
const safe = new ModelGrid({}, { rows: 6, columns: 4, plugins: [worksheets()] });
safe.importWorkbook(damaged);
const safeList = safe.feature('worksheets').list();
assert.ok(safeList.some(sheet => !sheet.hidden), 'at least one sheet stays visible');
assert.ok(safeList.every(sheet => sheet.color === null));

// hiding the last visible sheet is refused; removing keeps a visible one
const trio = new ModelGrid({}, { rows: 4, columns: 3, plugins: [worksheets()] });
const trioSheets = trio.feature('worksheets');
const a = trioSheets.activeId, b = trioSheets.add('B'), c = trioSheets.add('C');
trioSheets.setHidden(b, true);
trioSheets.setHidden(c, true);
assert.throws(() => trioSheets.setHidden(a, true), /At least one visible/);
trioSheets.remove(a);
assert.equal(trioSheets.list().filter(sheet => !sheet.hidden).length, 1, 'removing the last visible sheet reveals one that was hidden');
trioSheets.setHidden(c, false);
trioSheets.select(c);
trioSheets.remove(c);
assert.equal(trioSheets.list().some(sheet => sheet.id === c), false);
assert.equal(trioSheets.list().every(sheet => sheet.color === null || typeof sheet.color === 'string'), true);

// ---- read-only workbooks ---------------------------------------------------
book.readOnly = true;
for (const action of [() => sheets.duplicate(first), () => sheets.move(first, 1), () => sheets.setColor(first, '#000000'), () => sheets.setHidden(second, false)]) assert.throws(action, /read-only/);
book.readOnly = false;
console.log('Worksheet menu API tests passed');
