import assert from 'node:assert/strict';
import TinyDatagrid from './src/tinygrid.js';
import { conditionalFormatting, dataValidation } from './src/features.js';
import { heatmapRule } from './src/heatmap.js';
import { featureTranslator } from './src/feature-i18n.js';
import { listChoices } from './src/list-dropdown.js';
import { CONDITIONS, PRESETS, parseRangeText, describeRange, subtractRange, parseRuleValue, parseListValues, conditionText, validationText, addConditionalFormat, removeConditionalFormat, setValidation, removeValidation } from './src/rule-tools.js';

class ModelGrid extends TinyDatagrid {
  build() {} bind() {} setLocale(locale) { this.locale = locale; return this; } render() { this._updateFilteredRows(); this.engine.settle(); } renderCells() {} layout() { this._updateFilteredRows(); } emit() {}
}
const make = () => {
  const grid = new ModelGrid({}, { rows: 20, columns: 8, historyLimit: 30, plugins: [conditionalFormatting(), dataValidation()] });
  grid.load([['Name', 'Score'], ['Ann', 5], ['Ben', 120], ['Cy', '']]); grid.clearHistory();
  return grid;
};
const en = featureTranslator('en'), de = featureTranslator('de');

// ---- ranges ---------------------------------------------------------------------------------------------
assert.deepEqual(parseRangeText('B2'), { r1: 1, c1: 1, r2: 1, c2: 1 });
assert.deepEqual(parseRangeText(' b2 : d9 '), { r1: 1, c1: 1, r2: 8, c2: 3 });
assert.deepEqual(parseRangeText('$D$9:$B$2'), { r1: 1, c1: 1, r2: 8, c2: 3 }, 'corners in any order');
assert.deepEqual(parseRangeText('B:B'), { r1: 0, c1: 1, r2: 1048575, c2: 1 }, 'a whole column');
assert.deepEqual(parseRangeText('c:b'), { r1: 0, c1: 1, r2: 1048575, c2: 2 });
for (const bad of ['', 'B', 'B2:', ':B2', 'B2:D9:F3', 'A0', '1A', 'B2 D9', 'A1:B', 'ZZZZ1']) assert.equal(parseRangeText(bad), null, `"${bad}" is not a range`);
assert.equal(parseRangeText('Z1', { columns: 8 }), null, 'columns beyond the sheet are refused');
assert.deepEqual(parseRangeText('H1', { columns: 8 }), { r1: 0, c1: 7, r2: 0, c2: 7 });
assert.equal(describeRange({ r1: 1, c1: 1, r2: 1, c2: 1 }), 'B2');
assert.equal(describeRange({ r1: 1, c1: 1, r2: 8, c2: 3 }), 'B2:D9');
assert.equal(describeRange({ r1: 0, c1: 1, r2: 1048575, c2: 1 }), 'B:B');
assert.equal(describeRange(parseRangeText('B:D')), 'B:D');

// taking a rectangle out of another keeps exactly the cells that were not covered
const cells = range => { const out = new Set(); for (let r = range.r1; r <= range.r2; r++) for (let c = range.c1; c <= range.c2; c++) out.add(`${r},${c}`); return out; };
for (let n = 0; n < 400; n++) {
  const pick = () => { const a = Math.floor(Math.random() * 6), b = Math.floor(Math.random() * 6), x = Math.floor(Math.random() * 6), y = Math.floor(Math.random() * 6); return { r1: Math.min(a, b), r2: Math.max(a, b), c1: Math.min(x, y), c2: Math.max(x, y) }; };
  const range = pick(), hole = pick(), pieces = subtractRange(range, hole), covered = cells(hole), expected = new Set([...cells(range)].filter(key => !covered.has(key))), seen = new Set();
  for (const piece of pieces) for (const key of cells(piece)) { assert.ok(!seen.has(key), 'pieces do not overlap'); seen.add(key); }
  assert.deepEqual([...seen].sort(), [...expected].sort(), JSON.stringify({ range, hole }));
}
assert.deepEqual(subtractRange({ r1: 0, c1: 0, r2: 4, c2: 4 }, { r1: 9, c1: 9, r2: 9, c2: 9 }), [{ r1: 0, c1: 0, r2: 4, c2: 4 }]);
assert.deepEqual(subtractRange({ r1: 2, c1: 2, r2: 3, c2: 3 }, { r1: 0, c1: 0, r2: 9, c2: 9 }), []);

// ---- values ---------------------------------------------------------------------------------------------
assert.equal(parseRuleValue('5'), 5);
assert.equal(parseRuleValue(' -2.5 '), -2.5);
assert.equal(parseRuleValue('1e3'), 1000);
assert.equal(parseRuleValue('true'), true);
assert.equal(parseRuleValue('FALSE'), false);
assert.equal(parseRuleValue('Ann'), 'Ann');
assert.equal(parseRuleValue('007'), '007', 'identifiers with leading zeros stay text');
assert.equal(parseRuleValue('2026-01-02'), '2026-01-02', 'dates are compared as text');
assert.equal(parseRuleValue('3,5'), '3,5', 'cells read 3,5 as text in an English data locale ...');
assert.equal(parseRuleValue('3,5', { locale: 'de-DE' }), 3.5, '... and as a number in a German one');
assert.equal(parseRuleValue('9007199254740993'), '9007199254740993', 'numbers beyond the safe range stay text');
assert.deepEqual(parseListValues('a, b;c , ,a'), ['a', 'b', 'c']);
assert.deepEqual(parseListValues('one, two\nthree\r\n\nfour'), ['one, two', 'three', 'four'], 'one value per line when there are line breaks');
assert.deepEqual(parseListValues(''), []);

// ---- descriptions ---------------------------------------------------------------------------------------
assert.equal(conditionText({ operator: 'gt', value: 100 }, en), 'is greater than 100');
assert.equal(conditionText({ operator: 'between', value: 1, max: 5 }, en), 'is between 1 and 5');
assert.equal(conditionText({ operator: 'contains', value: 'ab' }, en), 'contains the text "ab"');
assert.equal(conditionText({ operator: 'empty' }, de), 'ist leer');
assert.equal(conditionText({ type: 'colorScale', min: 0, max: 9 }, en), 'Color scale 0 – 9', 'heatmap rules share the list');
assert.equal(validationText({ type: 'integer', min: 1, max: 10 }, en), 'Whole number from 1 to 10');
assert.equal(validationText({ type: 'number', min: 0 }, en), 'Number at least 0');
assert.equal(validationText({ type: 'textLength', max: 20 }, de), 'Textlänge höchstens 20');
assert.equal(validationText({ type: 'list', values: ['a', 'b'] }, en), 'One of: a, b');
assert.equal(validationText({ type: 'json', kind: 'array' }, en), 'JSON array');
assert.equal(validationText({ type: 'json' }, en), 'JSON');
for (const condition of CONDITIONS) assert.notEqual(en(condition.key), condition.key, `${condition.id} has a label`);
for (const preset of PRESETS) assert.notEqual(en(preset.key), preset.key, `${preset.id} has a label`);

// ---- conditional formatting -----------------------------------------------------------------------------
let grid = make(), format = grid.feature('conditionalFormatting');
const red = PRESETS.find(preset => preset.id === 'red').style;
addConditionalFormat(grid, { range: parseRangeText('B2:B4'), operator: 'gt', value: 100, style: { ...red } });
assert.deepEqual(format.cellStyle(2, 1, 120), red);
assert.deepEqual(format.cellStyle(1, 1, 5), {});
assert.deepEqual(format.cellStyle(6, 1, 500), {}, 'outside the range');
assert.equal(grid.historyState.undo, 1, 'one undo step');
addConditionalFormat(grid, { range: parseRangeText('B:B'), operator: 'between', value: 1, max: 9, style: { fontWeight: '700' } });
assert.deepEqual(format.cellStyle(1, 1, 5), { fontWeight: '700' }, 'whole-column rules reach every row');
assert.deepEqual(format.cellStyle(300, 1, 5), { fontWeight: '700' });
addConditionalFormat(grid, heatmapRule({ r1: 0, c1: 3, r2: 3, c2: 3 }, { min: 0, max: 10 }));
assert.equal(grid.conditionalFormats.length, 3);
removeConditionalFormat(grid, 1);
assert.deepEqual(grid.conditionalFormats.map(rule => rule.operator ?? rule.type), ['gt', 'colorScale']);
grid.undo();
assert.equal(grid.conditionalFormats.length, 3, 'removal can be undone');
removeConditionalFormat(grid, null);
assert.equal(grid.conditionalFormats.length, 0);
grid.undo();
assert.equal(grid.conditionalFormats.length, 3);
assert.throws(() => addConditionalFormat(grid, { range: parseRangeText('B2'), operator: 'nope', style: {} }), /operator/);
assert.equal(grid.conditionalFormats.length, 3, 'a rejected rule changes nothing');

// ---- validation -----------------------------------------------------------------------------------------
grid = make(); const validator = grid.feature('validation');
setValidation(grid, { range: parseRangeText('B2:B10'), type: 'integer', min: 0, max: 100, allowEmpty: true, allowFormula: true, message: 'Whole number, 0 to 100' });
assert.equal(validator.validate(1, 1, '50'), null);
assert.equal(validator.validate(1, 1, '500'), 'Whole number, 0 to 100');
assert.equal(validator.validate(1, 1, '1.5'), 'Whole number, 0 to 100');
assert.equal(validator.validate(1, 1, ''), null, 'empty cells are allowed');
assert.equal(validator.validate(1, 1, '=A1+1'), null, 'formulas are allowed');
assert.equal(validator.validate(20, 1, 'text'), null, 'cells outside the range are free');
assert.equal(grid.setCell(2, 1, 'abc'), false, 'invalid input is rejected');
assert.equal(grid.getComputedValue(2, 1), 120);
assert.equal(grid.historyState.undo, 1);

// a rule for some cells replaces the earlier rule there and keeps it elsewhere
setValidation(grid, { range: parseRangeText('B4:B5'), type: 'list', values: ['low', 'high'], message: 'low or high' });
assert.equal(validator.validate(3, 1, 'low'), null);
assert.equal(validator.validate(3, 1, '50'), 'low or high', 'the integer rule no longer applies to B4:B5');
assert.equal(validator.validate(5, 1, '50'), null, 'B6 keeps the integer rule');
assert.equal(validator.validate(5, 1, 'x'), 'Whole number, 0 to 100');
assert.deepEqual(grid.validationRules.map(rule => describeRange(rule.range)).sort(), ['B2:B3', 'B4:B5', 'B6:B10']);
setValidation(grid, { range: parseRangeText('B:B'), type: 'number', min: 0, message: 'positive' });
assert.equal(grid.validationRules.length, 1, 'a rule for the whole column replaces everything below it');
assert.equal(validator.validate(1, 1, '-3'), 'positive');
removeValidation(grid, 0);
assert.equal(grid.validationRules.length, 0);
grid.undo();
assert.equal(grid.validationRules.length, 1);
removeValidation(grid, null);
assert.equal(validator.validate(1, 1, '-3'), null);

// list rules offer their values to the dropdown
setValidation(grid, { range: parseRangeText('C2:C4'), type: 'list', values: ['low', 'high', 3], message: 'pick one' });
assert.deepEqual(listChoices(grid, 1, 2), ['low', 'high', 3]);
assert.equal(listChoices(grid, 1, 1), null, 'other cells offer nothing');
assert.equal(listChoices(grid, 5, 2), null);
assert.equal(validator.validate(1, 2, '3'), null, 'numbers in the list match their text');
assert.equal(grid.setCell(1, 2, 'medium'), false);
assert.equal(grid.setCell(1, 2, 'high'), true, 'a listed value is accepted');
assert.equal(grid.getComputedValue(1, 2), 'high');
removeValidation(grid, null);
assert.equal(listChoices(grid, 1, 2), null);

// JSON rules and text length
setValidation(grid, { range: parseRangeText('C2:C3'), type: 'json', kind: 'array', message: 'array' });
assert.equal(validator.validate(1, 2, '[1,2]'), null);
assert.equal(validator.validate(1, 2, '{"a":1}'), 'array');
setValidation(grid, { range: parseRangeText('D2'), type: 'textLength', min: 2, max: 4, message: '2 to 4' });
assert.equal(validator.validate(1, 3, 'abc'), null);
assert.equal(validator.validate(1, 3, 'abcde'), '2 to 4');
assert.throws(() => setValidation(grid, { range: parseRangeText('E2'), type: 'nope' }), /validation type/);
assert.equal(grid.validationRules.length, 2, 'a rejected rule changes nothing');

// rules are saved with the workbook
const saved = JSON.parse(JSON.stringify(grid.exportWorkbook()));
const loaded = new ModelGrid({}, { rows: 20, columns: 8, plugins: [conditionalFormatting(), dataValidation()] });
loaded.importWorkbook(saved, { replace: true });
assert.equal(loaded.validationRules.length, 2);
assert.equal(loaded.feature('validation').validate(1, 3, 'abcde'), '2 to 4');

console.log('Rule tool tests passed');
