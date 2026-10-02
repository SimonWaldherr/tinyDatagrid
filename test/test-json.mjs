import assert from 'node:assert/strict';
import TinyDatagrid, { FormulaEngine } from '../src/tinygrid.js';
import { JSONValue, queryJSON, setJSON, removeJSON, mergeJSON, flattenJSON, jsonEquals, rawText, toJSONData, stringifyJSON } from '../src/json-values.js';
import { inferDataValue } from '../src/data-types.js';
import * as features from '../src/features.js';
const { conditionalFormatting, dataValidation } = features;
const optionalPlugins = () => ['dynamicArrays', 'jsonFunctions'].flatMap(name => typeof features[name] === 'function' ? [features[name]()] : []);

// ---- path queries ---------------------------------------------------------
const store = { store: { book: [{ title: 'A', price: 8.95, tags: ['x', 'y'] }, { title: 'B', price: 12.99 }, { title: 'C', price: 22.99, isbn: '1' }], bicycle: { color: 'red', price: 19.95 } }, 'odd key': 1, arr: [1, 2, 3, 4, 5], 'a.b': 'dot' };
const q = path => queryJSON(store, path);
assert.equal(q('store.book[0].title').value, 'A');
assert.equal(q('$.store.book[-1].title').value, 'C');
assert.deepEqual(q('store.book[*].title').value, ['A', 'B', 'C']);
assert.deepEqual(q('$..price').value, [8.95, 12.99, 22.99, 19.95]);
assert.deepEqual(q('store.book[?(@.price>10)].title').value, ['B', 'C']);
assert.deepEqual(q('store.book[?(@.price>10 && @.price<20)].title').value, ['B']);
assert.deepEqual(q('store.book[?(@.price<10 || @.isbn)].title').value, ['A', 'C']);
assert.deepEqual(q('store.book[?(!@.isbn)].title').value, ['A', 'B']);
assert.deepEqual(q('store.book[?(@.title=="B")].price').value, [12.99]);
assert.deepEqual(q("store.book[?(@.title=='B')].price").value, [12.99]);
assert.deepEqual(q('store.book[?(@.tags.length>1)].title').value, ['A']);
assert.equal(q('["odd key"]').value, 1);
assert.equal(q("['a.b']").value, 'dot');
assert.deepEqual(q('arr[1:3]').value, [2, 3]);
assert.deepEqual(q('arr[-2:]').value, [4, 5]);
assert.deepEqual(q('arr[::2]').value, [1, 3, 5]);
assert.deepEqual(q('arr[::-1]').value, [5, 4, 3, 2, 1]);
assert.deepEqual(q('arr[0,2]').value, [1, 3]);
assert.equal(q('arr.length').value, 5);
assert.equal(q('arr.1').value, 2);
assert.equal(q('/store/bicycle/color').value, 'red');
assert.equal(q('nothing').found, false);
assert.equal(q('arr[9]').found, false);
assert.equal(q('').value, store);
assert.deepEqual(q('store.book[?(@.price>100)]').value, []);
assert.throws(() => queryJSON(store, 'store..'), SyntaxError);
assert.throws(() => queryJSON(store, 'a[?(@.x =)]'), SyntaxError);
assert.throws(() => queryJSON(store, 'a[unclosed'), SyntaxError);

// ---- immutable editing ----------------------------------------------------
const original = { a: { b: 1 }, list: [1, 2] };
const frozen = structuredClone(original);
assert.deepEqual(setJSON(original, 'a.c', 2), { a: { b: 1, c: 2 }, list: [1, 2] });
assert.deepEqual(setJSON(original, 'list[3]', 9).list, [1, 2, null, 9]);
assert.deepEqual(setJSON(original, 'list[-1]', 9).list, [1, 9]);
assert.deepEqual(setJSON(null, 'a.0.b', 1), { a: [{ b: 1 }] });
assert.deepEqual(setJSON({}, 'x.y.z', true), { x: { y: { z: true } } });
assert.equal(setJSON(original, '', 5), 5);
assert.throws(() => setJSON(original, 'a[0]', 1), TypeError);
assert.throws(() => setJSON(original, 'list.name', 1), TypeError);
assert.throws(() => setJSON(original, 'list[*]', 1), SyntaxError);
assert.deepEqual(removeJSON(original, 'a.b'), { a: {}, list: [1, 2] });
assert.deepEqual(removeJSON(original, 'list[0]'), { a: { b: 1 }, list: [2] });
assert.deepEqual(removeJSON(original, 'missing.path'), original);
assert.deepEqual(mergeJSON({ a: { b: 1, c: 2 }, d: [1] }, { a: { c: 3 }, d: [2], e: null }), { a: { b: 1, c: 3 }, d: [2], e: null });
assert.deepEqual(original, frozen, 'editing helpers never mutate their input');
assert.deepEqual(flattenJSON({ a: { b: [1, { c: 2 }] }, e: [], 'x y': 1 }).map(([path, value]) => [path, value]), [['a.b[0]', 1], ['a.b[1].c', 2], ['e', []], ['["x y"]', 1]]);
assert.ok(jsonEquals({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }));
assert.ok(!jsonEquals({ a: 1 }, { a: '1' }));

// ---- prototype pollution --------------------------------------------------
const polluted = setJSON({}, '["__proto__"].polluted', true);
assert.equal({}.polluted, undefined);
assert.equal(Object.hasOwn(polluted, '__proto__'), true);
const parsed = JSON.parse('{"__proto__":{"x":1}}');
assert.equal(Object.hasOwn(mergeJSON({}, parsed), '__proto__'), true);
assert.equal({}.x, undefined);

// ---- formulas -------------------------------------------------------------
class ModelGrid extends TinyDatagrid {
  build() {} bind() {} setLocale(locale) { this.locale = locale; return this; } render() { this._updateFilteredRows(); this.engine.settle(); } renderCells() {} layout() { this._updateFilteredRows(); } emit() {}
}
const host = new ModelGrid({}, { rows: 20, columns: 6, plugins: optionalPlugins() });
const engine = host.engine;
const put = rows => { host.cells = new Map(); rows.forEach((row, r) => row.forEach((item, c) => { if (item !== '' && item != null) host.cells.set(`${r},${c}`, { raw: item }); })); host.engine.clearCache(); };
const value = formula => engine.evaluateFormula(formula);
const data = formula => { const result = value(formula); return result instanceof JSONValue ? result.value : result; };
const error = (formula, prefix) => { const result = String(value(formula)); assert.ok(result.startsWith(prefix), `${formula} -> ${result}`); return result; };

assert.deepEqual(data('=JSON.PARSE("{""a"":[1,2,{""b"":null}]}")'), { a: [1, 2, { b: null }] });
assert.equal(value('=JSON.PARSE("42")'), 42);
assert.equal(value('=JSON.PARSE("""text""")'), 'text');
assert.equal(value('=JSON.PARSE("null")'), '', 'JSON null is a blank cell');
assert.ok(value('=JSON.PARSE("[1]")') instanceof JSONValue);
error('=JSON.PARSE("nope")', '#VALUE!');
error('=JSON.PARSE("")', '#VALUE!');
assert.equal(value('=JSON.PARSE("12345678901234567890")'), '#NUM!', 'unsafe numbers are rejected like everywhere else');
assert.equal(value('=JSON.PARSE()'), '#VALUE!');
assert.equal(value('=JSON.VALID("{""a"":1}")'), true);
assert.equal(value('=JSON.VALID("{a:1}")'), false);
assert.equal(value('=JSON.VALID(5)'), false);
assert.equal(value('=JSON.TYPE(JSON.PARSE("[1]"))'), 'array');
assert.equal(value('=JSON.TYPE(JSON.PARSE("{}"))'), 'object');
assert.equal(value('=JSON.TYPE("text")'), 'string');
assert.equal(value('=JSON.TYPE(5)'), 'number');
assert.equal(value('=JSON.TYPE(TRUE)'), 'boolean');
assert.equal(value('=JSON.TYPE("{""a"":[1]}";"a")'), 'array');

const book = '"{""title"":""A"",""price"":9.5,""tags"":[""x"",""y""],""author"":{""name"":""Ann""},""nothing"":null}"';
assert.equal(value(`=JSON.GET(${book};"title")`), 'A');
assert.equal(value(`=JSON.GET(${book};"author.name")`), 'Ann');
assert.equal(value(`=JSON.GET(${book};"tags[1]")`), 'y');
assert.equal(value(`=JSON.GET(${book};"tags[-1]")`), 'y');
assert.equal(value(`=JSON.GET(${book};"tags.length")`), 2);
assert.equal(value(`=JSON.GET(${book};"nothing")`), '');
assert.equal(value(`=JSON.HAS(${book};"nothing")`), true, 'a null value still exists');
assert.equal(value(`=JSON.GET(${book};"missing")`), '#N/A');
assert.equal(value(`=JSON.GET(${book};"missing";"fallback")`), 'fallback');
assert.equal(value(`=JSON.GET(${book};"missing";0)`), 0);
assert.deepEqual(data(`=JSON.GET(${book};"tags")`), ['x', 'y']);
assert.deepEqual(data(`=JSON.GET(${book};"tags[*]")`), ['x', 'y']);
assert.equal(value('=JSON.GET("[10,20,30]";1)'), 20, 'numbers address array positions');
assert.equal(value(`=JSON.GET(${book};"")`) instanceof JSONValue, true);
error('=JSON.GET("not json";"a")', '#VALUE!');
error('=JSON.GET("{}";"a[")', '#VALUE!');
assert.equal(value('=JSON.GET("{}")'), '#VALUE!');
assert.equal(value(`=JSON.HAS(${book};"author.name")`), true);
assert.equal(value(`=JSON.HAS(${book};"author.age")`), false);
assert.equal(value(`=JSON.HAS(${book};"tags[*]")`), true);
assert.deepEqual(value(`=JSON.KEYS(${book})`).map(row => row[0]), ['title', 'price', 'tags', 'author', 'nothing']);
assert.deepEqual(value('=JSON.KEYS("[5,6]")'), [[0], [1]]);
assert.deepEqual(value('=JSON.VALUES("[5,6]")'), [[5], [6]]);
assert.deepEqual(value(`=JSON.VALUES(${book};"tags")`), [['x'], ['y']]);
assert.deepEqual(value('=JSON.ENTRIES("{""a"":1,""b"":[2]}")').map(([key, item]) => [key, item instanceof JSONValue ? item.value : item]), [['a', 1], ['b', [2]]]);
assert.equal(value(`=JSON.LENGTH(${book})`), 5);
assert.equal(value(`=JSON.LENGTH(${book};"tags")`), 2);
assert.equal(value('=JSON.LENGTH("héllo")'), 5);
error('=JSON.LENGTH(5)', '#VALUE!');

// building
assert.equal(value('=JSON.STRINGIFY(JSON.OBJECT("x";1;"y";TRUE;"z";""))'), '{"x":1,"y":true,"z":null}');
assert.equal(value('=JSON.STRINGIFY(JSON.ARRAY(1;"a";TRUE))'), '[1,"a",true]');
assert.equal(value('=JSON.STRINGIFY(JSON.ARRAY())'), '[]');
assert.equal(value('=JSON.STRINGIFY("a")'), '"a"');
assert.equal(value('=JSON.STRINGIFY("")'), '""');
assert.equal(value('=JSON.STRINGIFY(3)'), '3');
assert.equal(value('=JSON.STRINGIFY(JSON.OBJECT("a";JSON.ARRAY(1;2));2)'), '{\n  "a": [\n    1,\n    2\n  ]\n}');
assert.equal(value('=JSON.STRINGIFY(JSON.ARRAY(1;2);"--")'), '[\n--1,\n--2\n]');
error('=JSON.OBJECT("a")', '#VALUE!');
error('=JSON.OBJECT("";1)', '#VALUE!');
assert.equal(value('=JSON.STRINGIFY(JSON.OBJECT("date";DATE(2026;9;28)))'), '{"date":"2026-09-28"}');
assert.deepEqual(data('=JSON.OBJECT("a";JSON.OBJECT("b";1))'), { a: { b: 1 } });
assert.deepEqual(data('=JSON.ARRAY(JSON.ARRAY(1;2);3)'), [[1, 2], 3], 'nested JSON stays nested');
assert.deepEqual(data('=JSON.CONCAT(JSON.ARRAY(1;2);JSON.ARRAY(3);4)'), [1, 2, 3, 4]);
assert.deepEqual(data('=JSON.CONCAT("[1,2]";3)'), [1, 2, 3]);
put([['x', 1], ['y', ''], ['z', 3]]);
assert.deepEqual(data('=JSON.ARRAY(A1:A3)'), ['x', 'y', 'z']);
assert.deepEqual(data('=JSON.ARRAY(B1:B3)'), [1, null, 3], 'blank cells become null');
assert.deepEqual(data('=JSON.OBJECT(A1:B3)'), { x: 1, y: null, z: 3 });
assert.deepEqual(data('=JSON.OBJECT(A1:A3;B1:B3)'), { x: 1, y: null, z: 3 });
assert.equal(value('=JSON.STRINGIFY(A1:B2)'), '[["x",1],["y",null]]');
assert.equal(String(engine.evaluateFormula('=JSON.STRINGIFY(A1:B2)')), '[["x",1],["y",null]]');

// editing
const base = '"{""a"":{""b"":1},""list"":[1,2]}"';
assert.deepEqual(data(`=JSON.SET(${base};"a.c";2)`), { a: { b: 1, c: 2 }, list: [1, 2] });
assert.deepEqual(data(`=JSON.SET(${base};"a.c";2;"list[0]";9)`), { a: { b: 1, c: 2 }, list: [9, 2] });
assert.deepEqual(data('=JSON.SET("";"name";"Ann")'), { name: 'Ann' });
assert.deepEqual(data(`=JSON.SET(${base};"list";JSON.ARRAY(7))`), { a: { b: 1 }, list: [7] });
error(`=JSON.SET(${base};"a")`, '#VALUE!');
error(`=JSON.SET(${base};"a[*]";1)`, '#VALUE!');
assert.deepEqual(data(`=JSON.REMOVE(${base};"a.b";"list[0]")`), { a: {}, list: [2] });
assert.deepEqual(data('=JSON.MERGE("{""a"":{""b"":1}}";"{""a"":{""c"":2}}";"{""d"":true}")'), { a: { b: 1, c: 2 }, d: true });

// lookup, sort, unique
const people = '"[{""id"":1,""name"":""Zed"",""age"":30},{""id"":2,""name"":""Amy"",""age"":25},{""id"":3,""name"":""Bob"",""age"":30}]"';
assert.equal(value(`=JSON.LOOKUP(2;${people};"id";"name")`), 'Amy');
assert.equal(value(`=JSON.LOOKUP("2";${people};"id";"name")`), 'Amy', 'numeric text matches numbers');
assert.equal(value(`=JSON.LOOKUP("bob";${people};"name";"age")`), 30);
assert.equal(value(`=JSON.LOOKUP(9;${people};"id";"name")`), '#N/A');
assert.equal(value(`=JSON.LOOKUP(9;${people};"id";"name";"none")`), 'none');
assert.deepEqual(data(`=JSON.LOOKUP(3;${people};"id")`), { id: 3, name: 'Bob', age: 30 });
assert.deepEqual(data(`=JSON.SORT(${people};"name")`).map(item => item.name), ['Amy', 'Bob', 'Zed']);
assert.deepEqual(data(`=JSON.SORT(${people};"name";-1)`).map(item => item.name), ['Zed', 'Bob', 'Amy']);
assert.deepEqual(data(`=JSON.SORT(${people};"age")`).map(item => item.name), ['Amy', 'Zed', 'Bob'], 'sorting is stable');
assert.deepEqual(data('=JSON.SORT("[3,1,2]")'), [1, 2, 3]);
assert.deepEqual(data('=JSON.SORT("[""b"",null,""a"",2]")'), [2, 'a', 'b', null]);
assert.deepEqual(data(`=JSON.UNIQUE(${people};"age")`).map(item => item.id), [1, 2]);
assert.deepEqual(data('=JSON.UNIQUE("[1,1,2,[3],[3]]")'), [1, 2, [3]]);

// tables
const rows = '"[{""id"":1,""name"":""Zed"",""geo"":{""lat"":1,""lon"":2}},{""id"":2,""name"":""Amy"",""extra"":true}]"';
assert.deepEqual(value(`=JSON.TABLE(${rows})`).map(row => row.map(item => item instanceof JSONValue ? item.value : item)), [['id', 'name', 'geo', 'extra'], [1, 'Zed', { lat: 1, lon: 2 }, ''], [2, 'Amy', '', true]]);
assert.deepEqual(value(`=JSON.TABLE(${rows};"";FALSE)`).length, 2);
assert.deepEqual(value(`=JSON.TABLE(${rows};"";TRUE;TRUE)`)[0], ['id', 'name', 'geo.lat', 'geo.lon', 'extra']);
assert.deepEqual(value(`=JSON.TABLE(${rows};"name,geo.lat")`), [['name', 'geo.lat'], ['Zed', 1], ['Amy', '']]);
assert.deepEqual(value('=JSON.TABLE("[[1,2],[3]]")'), [[1, 2], [3, '']]);
assert.deepEqual(value('=JSON.TABLE("[1,2]")'), [['value'], [1], [2]]);
assert.deepEqual(value('=JSON.TABLE("{""a"":1,""b"":2}")'), [['key', 'value'], ['a', 1], ['b', 2]]);
put([['id', 'name', ''], [1, 'Zed', ''], [2, '', ''], ['', '', '']]);
assert.deepEqual(data('=JSON.FROMTABLE(A1:C4)'), [{ id: 1, name: 'Zed', column3: null }, { id: 2, name: null, column3: null }]);
assert.deepEqual(data('=JSON.FROMTABLE(A2:B3;FALSE)'), [[1, 'Zed'], [2, null]]);
assert.deepEqual(value('=JSON.FLATTEN("{""a"":{""b"":[1,{""c"":2}]},""e"":[]}")').map(([path, item]) => [path, item instanceof JSONValue ? item.value : item]), [['a.b[0]', 1], ['a.b[1].c', 2], ['e', []]]);

// ---- JSON in cells --------------------------------------------------------
const grid = new ModelGrid({}, { rows: 12, columns: 6, historyLimit: 20, plugins: [...optionalPlugins(), conditionalFormatting(), dataValidation()] });
grid.load([
  ['{"name":"Ann","age":31,"tags":["a","b"],"address":{"city":"Bonn"}}', '[1,2,3]', '{ "name" : "Ann", "age" : 31, "tags" : ["a","b"], "address": {"city":"Bonn"} }'],
  ['=JSON.GET(A1;"address.city")', '=SUM(B1)', '=A1=C1'],
  ['[1,', '{oops}', '=A1&"!"'],
  ['=TEXTJOIN(", ";TRUE;JSON.GET(A1;"tags"))', '=COUNTA(B1)', '=JSON.LENGTH(A1)'],
  ['=UPPER(B1)', '=A1<>B1', '=LEN(B1)']
]);
assert.ok(grid.getComputedValue(0, 0) instanceof JSONValue);
assert.equal(grid.getComputedValue(0, 0).kind, 'object');
assert.equal(grid.getComputedValue(0, 1).kind, 'array');
assert.equal(grid.getComputedValue(1, 0), 'Bonn');
assert.equal(grid.getComputedValue(1, 1), 6, 'a JSON array behaves like a column of values in list context');
assert.equal(grid.getComputedValue(1, 2), true, 'equal JSON compares by content, not spacing');
assert.equal(grid.getComputedValue(2, 0), '[1,', 'invalid JSON stays text');
assert.equal(grid.getComputedValue(2, 1), '{oops}');
assert.equal(grid.getComputedValue(2, 2), '{"name":"Ann","age":31,"tags":["a","b"],"address":{"city":"Bonn"}}!');
assert.equal(grid.getComputedValue(3, 0), 'a, b');
assert.equal(grid.getComputedValue(3, 1), 3);
assert.equal(grid.getComputedValue(3, 2), 4);
assert.equal(grid.getComputedValue(4, 0), '[1,2,3]');
assert.equal(grid.getComputedValue(4, 1), true);
assert.equal(grid.formatValue(grid.getComputedValue(0, 1)), '[1,2,3]');
assert.equal(String(grid.getComputedValue(0, 1)), '[1,2,3]');
assert.equal(JSON.stringify({ cell: grid.getComputedValue(0, 1) }), '{"cell":[1,2,3]}');

// typed as text, and edits keep text
grid.setCell(5, 0, '{"a":1}', { valueType: 'text' });
assert.equal(grid.getComputedValue(5, 0), '{"a":1}');
grid.setCell(5, 1, new JSONValue({ a: 1 }));
assert.deepEqual(grid.getRawValue(5, 1), { a: 1 }, 'wrappers are never stored in cells');
assert.ok(grid.getComputedValue(5, 1) instanceof JSONValue);
assert.equal(rawText(grid.getRawValue(5, 1)), '{"a":1}');
assert.equal(rawText(null), '');
assert.equal(rawText(3), '3');

// exports
grid.load([['x', '{"k":[1,2]}']], 8, 0);
assert.equal(grid.exportCSV({ range: { r1: 8, c1: 0, r2: 8, c2: 1 }, computed: true }), 'x,"{""k"":[1,2]}"');
assert.equal(grid.exportCSV({ range: { r1: 8, c1: 0, r2: 8, c2: 1 }, computed: false }), 'x,"{""k"":[1,2]}"');
assert.ok(grid.exportHTML({ range: { r1: 8, c1: 0, r2: 8, c2: 1 } }).includes('{&quot;k&quot;:[1,2]}'));
assert.ok(grid.exportMarkdown({ range: { r1: 8, c1: 0, r2: 8, c2: 1 } }).includes('{"k":[1,2]}'));
grid.selection = { r1: 8, c1: 0, r2: 8, c2: 1 };
assert.equal(grid.copySelection(), 'x\t{"k":[1,2]}');
const workbook = JSON.stringify(grid.exportWorkbook());
const restored = new ModelGrid({}, { rows: 12, columns: 6, plugins: optionalPlugins() });
restored.importWorkbook(workbook);
assert.ok(restored.getComputedValue(0, 0) instanceof JSONValue);
assert.equal(restored.getComputedValue(1, 0), 'Bonn');
assert.equal(restored.getComputedValue(1, 1), 6);

// importing nested JSON keeps objects usable
const imported = new ModelGrid({}, { rows: 6, columns: 4, plugins: optionalPlugins() });
imported.importJSON([{ id: 1, meta: { level: 3 }, tags: ['x', 'y'] }, { id: 2, meta: { level: 5 }, tags: [] }], { replace: true });
assert.ok(imported.getComputedValue(1, 1) instanceof JSONValue);
assert.equal(imported.formatValue(imported.getComputedValue(1, 1)), '{"level":3}');
imported.setCell(4, 0, '=JSON.GET(B2;"level")+JSON.GET(B3;"level")');
assert.equal(imported.getComputedValue(4, 0), 8);
assert.deepEqual(imported.exportJSON({ range: { r1: 0, c1: 0, r2: 2, c2: 2 } }).map(record => JSON.parse(JSON.stringify(record))), [{ id: 1, meta: { level: 3 }, tags: ['x', 'y'] }, { id: 2, meta: { level: 5 }, tags: [] }]);
assert.ok(imported.exportCSV({ range: { r1: 0, c1: 0, r2: 2, c2: 2 } }).includes('"{""level"":3}"'));

// column types, SQL-style JSON columns and CSV import inference
const typed = new ModelGrid({}, { rows: 3, columns: 2, columnTypes: { 1: 'jsonb' } });
typed.load([['a', '{"n":1}'], ['b', 'not json']]);
assert.ok(typed.getComputedValue(0, 1) instanceof JSONValue);
assert.equal(typed.getComputedValue(1, 1), 'not json');
assert.equal(inferDataValue('{"a":1}').type, 'json');
assert.equal(inferDataValue('[1, 2]').type, 'json');
assert.equal(inferDataValue('{"n":12345678901234567890}').type, 'text', 'lossy numbers keep JSON text');
assert.equal(inferDataValue('[TODO] later').type, 'text');
const csv = new ModelGrid({}, { rows: 4, columns: 3 });
csv.importCSV('id,payload\n1,"{""a"":[1,2]}"\n2,plain', { delimiter: ',' });
assert.ok(csv.getComputedValue(1, 1) instanceof JSONValue);
assert.equal(csv.getComputedValue(2, 1), 'plain');

// conversions
assert.equal(toJSONData(''), null);
assert.equal(toJSONData(10n ** 20n), '100000000000000000000');
assert.equal(toJSONData(new Date(2026, 8, 28)), '2026-09-28');
assert.equal(toJSONData(new Date(Date.UTC(2026, 8, 28, 10, 30))).slice(0, 10) >= '2026-09-28', true);
assert.throws(() => toJSONData(() => 1), TypeError);
assert.throws(() => toJSONData(Infinity), RangeError);
assert.equal(stringifyJSON({ big: 10n ** 20n }), '{"big":"100000000000000000000"}');
const cyclic = {}; cyclic.self = cyclic;
assert.equal(stringifyJSON(cyclic), '[unserializable JSON]');

// validation rule for JSON
const validated = new ModelGrid({}, { rows: 4, columns: 2, plugins: [dataValidation()] });
validated.setValidationRules([{ range: { r1: 0, c1: 0, r2: 3, c2: 0 }, type: 'json', kind: 'object', message: 'Object expected' }]);
assert.equal(validated.feature('validation').validate(0, 0, '{"a":1}'), null);
assert.equal(validated.feature('validation').validate(0, 0, '[1]'), 'Object expected');
assert.equal(validated.feature('validation').validate(0, 0, 'plain'), 'Object expected');
assert.throws(() => validated.setValidationRules([{ range: { r1: 0, c1: 0, r2: 0, c2: 0 }, type: 'json', kind: 'text' }]), TypeError);

// custom functions may return plain objects; they become JSON
const custom = new ModelGrid({}, { rows: 3, columns: 2, plugins: optionalPlugins(), functions: { USER: id => ({ id, tags: [id] }), LIST: () => [[1], [2]] } });
custom.load([['=USER(7)', '=JSON.GET(A1;"tags[0]")']]);
assert.ok(custom.getComputedValue(0, 0) instanceof JSONValue);
assert.equal(custom.getComputedValue(0, 1), 7);

// conditional formatting sees JSON text
const styled = new ModelGrid({}, { rows: 2, columns: 1, plugins: [conditionalFormatting()] });
styled.load([['{"flag":true}']]);
styled.setConditionalFormats?.([{ range: { r1: 0, c1: 0, r2: 0, c2: 0 }, operator: 'contains', value: 'flag', style: { color: 'red' } }]);
console.log('JSON tests passed');
