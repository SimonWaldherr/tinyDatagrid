import assert from "node:assert/strict";
import TinyDatagrid, { FormulaEngine } from "../src/tinygrid.js";
import { DecimalValue } from "../src/decimal-values.js";
import { RowAxis } from "../src/row-axis.js";
import { worksheets } from "../src/worksheets.js";
import { dataValidation } from "../src/features.js";
import { sheetPivots } from "../src/pivots.js";
import { inferDataValue } from "../src/data-types.js";

class Model extends TinyDatagrid {
  build() {
    this.el.setAttribute = () => {};
    this.el.dispatchEvent = () => {};
    this.canvas = { style: {} };
    this.scroll = {
      scrollTop: 0,
      scrollLeft: 0,
      clientHeight: 700,
      clientWidth: 900,
    };
  }
  bind() {}
  setLocale() {
    return this;
  }
  render() {}
  renderCells() {}
  renderHeaders() {}
  syncHeaders() {}
  updateSelectionOverlay() {}
}
const text = (value) => String(value);
const f = new FormulaEngine({ variables: new Map() });
for (const [formula, expected] of [
  ["123456789012345678901234567890+1", "123456789012345678901234567891"],
  ["0.123456789012345678901234567890+0.1", "0.22345678901234567890123456789"],
  ["1e30+1", "1000000000000000000000000000001"],
  ["1/3", "0.3333333333333333333333333333333333"],
  ["-2/3", "-0.6666666666666666666666666666666667"],
  ["1e60/3", "333333333333333333333333333333333300000000000000000000000000"],
  ["1/8", "0.125"],
  ['VALUE("0.123456789012345678901")', "0.123456789012345678901"],
  ["SQRT(0.0004)", "0.02"],
  ["1/0", "#DIV/0!"],
  ["2^100", "1267650600228229401496703205376"],
  ["POW(2;-3)", "0.125"],
  ["SQRT(152415787532388367501905199875019052100)", "12345678901234567890"],
  ["SQRT(2)", "1.414213562373095048801688724209698"],
  ["SQRT(-1)", "#NUM!"],
  ["ABS(-123456789012345678901234567890)", "123456789012345678901234567890"],
  ["FLOOR(-1.123456789012345678901)", "-2"],
  ["CEIL(1.123456789012345678901)", "2"],
  ["MOD(123456789012345678901;10)", "1"],
  ['"123456789012345678901"', "123456789012345678901"],
  ["SIN(123456789012345678901)", "#NUM!"],
])
  assert.equal(text(f.evaluateFormula("=" + formula)), expected, formula);
const precise = new Model({}, { rows: 10, columns: 3 });
precise.setCell(0, 0, "0.123456789012345678901");
precise.setCell(1, 0, "00123");
precise.setCell(2, 0, "0.123456789012345678901", { valueType: "text" });
assert.ok(precise.getCalculationValue(0, 0) instanceof DecimalValue);
assert.equal(
  text(precise.getCalculationValue(0, 0)),
  "0.123456789012345678901",
);
assert.equal(precise.getCalculationValue(1, 0), "00123");
assert.equal(precise.getCalculationValue(2, 0), "0.123456789012345678901");
for (const [input, expected] of [
  ["0.07%", "0.0007"],
  ["-0.07%", "-0.0007"],
  ["0.123456789012345678901%", "0.00123456789012345678901"],
])
  assert.equal(
    String(inferDataValue(input, { locale: "en-US" }).value),
    expected,
  );

// Ten million addressable rows need neither ten million heights nor offsets.
const large = new Model({}, { rows: 10_000_000, columns: 2 });
assert.ok(large.rowHeights instanceof RowAxis);
assert.equal(large.rowHeights.overrides.size, 0);
large.setRowHeight(9_999_999, 55);
large.hiddenRows.add(1);
large.layout();
assert.equal(large.rowOffsets.length, 10_000_001);
assert.equal(large.rowOffsets[2], 28);
assert.equal(large.rowOffsets.at(-1), 10_000_000 * 28 - 28 + 27);
assert.equal(large.displayRowHeights[1], 0);
large.scrollToCell(9_999_999, 0);
assert.ok(large._viewOffset(9_999_999, "rows") >= 0);
assert.ok(large._viewOffset(9_999_999, "rows") < 700);
// Simulate the browser rounding a compressed physical scroll position.
let top = 0;
Object.defineProperty(large.scroll, "scrollTop", {
  configurable: true,
  get: () => top,
  set: (n) => {
    top = Math.round(n);
  },
});
large._setScrollY(123_456_789.25);
assert.equal(large._scrollY(), 123_456_789.25);
for (let row = 100; row < 1000; row++)
  assert.equal(large.getCalculationValue(row, 1), "");
assert.equal(
  large.engine.cache.size,
  0,
  "blank viewport reads leave no cache entries",
);
const portable = large.exportWorkbook({ computedValues: false });
assert.deepEqual(portable.dimensions.rowHeights, []);
assert.deepEqual(portable.dimensions.rowHeightOverrides, [[9_999_999, 55]]);
assert.ok(JSON.stringify(portable).length < 2000);
const restored = new Model({}, { rows: 2, columns: 2 });
restored.importWorkbook(JSON.stringify(portable));
assert.equal(restored.rowCount, 10_000_000);
assert.equal(restored.rowHeights[9_999_999], 55);
assert.ok(restored.hiddenRows.has(1));
assert.throws(() => restored.toArray(), /maxRangeCells/);
assert.throws(() => restored.ensureSize(10_000_001, 2), RangeError);
assert.throws(() => restored.setCell(0, 32_768, 1), RangeError);
assert.equal(restored.colCount, 2);
assert.equal(restored.getRawValue(0, 32_768), "");

// Streaming aggregates count implicit blanks and register range dependencies.
large.setCell(0, 0, 2);
large.setCell(9_999_999, 0, 4);
for (const [name, expected] of [
  ["SUM", 6],
  ["AVERAGE", 3],
  ["MIN", 2],
  ["MAX", 4],
  ["COUNT", 2],
  ["COUNTA", 2],
  ["COUNTBLANK", 9_999_998],
])
  assert.equal(
    large.engine.evaluateFormula(`=${name}(A1:A10000000)`),
    expected,
    name,
  );
large.setCell(0, 1, "=SUM(A1:A10000000)");
assert.equal(large.getComputedValue(0, 1), 6);
assert.ok(large.engine.dependencies.ranges.size < 3);
assert.ok(large.engine.cache.size < 10);
large.setCell(123456, 0, 10);
assert.equal(
  large.getComputedValue(0, 1),
  16,
  "newly occupied cells invalidate range consumers",
);
large.setCell(123456, 0, "");
assert.equal(large.getComputedValue(0, 1), 6);
large.setCell(0, 1, "=MAX(A1:A10000000)");
assert.equal(large.getComputedValue(0, 1), 4);
large.setCell(0, 1, "=A1");
large.getComputedValue(0, 1);
assert.equal(
  large.engine.dependencies.ranges.size,
  0,
  "obsolete range dependencies are released",
);
assert.equal(large.engine.evaluateFormula("=A1:A10000000"), "#NUM!");
large.engine.registerFunction("SUM", () => 99);
assert.equal(
  large.engine.evaluateFormula("=SUM(A1:A3)"),
  99,
  "custom overrides use the ordinary call path",
);

// A formula transitively feeding another range must invalidate that range too.
const nested = new Model({}, { rows: 20, columns: 3 });
nested.load([[1, "=A1+1", "=SUM(B1:B20)"]]);
assert.equal(nested.getComputedValue(0, 2), 2);
nested.setCell(0, 0, 10);
assert.equal(nested.getComputedValue(0, 2), 11);
assert.equal(nested.engine.evaluateFormula('=COUNT(A1:A20;"x";TRUE)'), 1);
nested.setCell(0, 2, "=SUM(A1:C20)");
assert.equal(nested.getComputedValue(0, 2), "#CYCLE!");

const spills = new Model({}, { rows: 20, columns: 4 });
spills.setCell(0, 0, "=SEQUENCE(3)");
spills.setCell(0, 2, "=SUM(A2:A20)");
assert.equal(
  spills.getComputedValue(0, 2),
  5,
  "a spill origin may be outside the aggregate range",
);
spills.setCell(0, 0, "=SEQUENCE(4)");
assert.equal(spills.getComputedValue(0, 2), 9);

const book = new Model({}, { rows: 10, columns: 3, plugins: [worksheets()] });
const ws = book.feature("worksheets"),
  first = ws.activeId;
book.setSheetName("Input");
book.setCell(0, 0, 7);
const report = ws.add("Report");
ws.select(report);
book.setCell(0, 0, "=SUM(Input!A1:A10000000)");
assert.equal(book.getComputedValue(0, 0), 7);
ws.select(first);
book.setCell(8, 0, 5);
ws.select(report);
assert.equal(book.getComputedValue(0, 0), 12);
assert.equal(book.engine.evaluateFormula("=SUM(Missing!A1:A2)"), "#REF!");
assert.equal(
  book.engine.evaluateFormula("=SUM(Input!A1:Report!A2)"),
  "#RANGE!",
);
ws.select(first);
book.setCell(0, 1, "=SUM(A1:A10000000)");
ws.select(report);
book.setCell(0, 1, "=Input!B1");
assert.equal(book.getComputedValue(0, 1), 12);
ws.select(first);
book.setCell(8, 0, 6);
ws.select(report);
assert.equal(book.getComputedValue(0, 1), 13);
book.registerFunction("SUM", () => 99);
assert.equal(book.getComputedValue(0, 1), "#NUM!");
ws.select(first);
book.setCell(0, 1, "=SUM(A1:A10)");
ws.select(report);
assert.equal(book.getComputedValue(0, 1), 99);
book.unregisterFunction("SUM");
assert.equal(book.getComputedValue(0, 1), 13);

// Import and pivot writers bypass CellMap validation but must retain undo records.
const merged = new Model({}, { rows: 5, columns: 2 });
merged.setCell(0, 0, "before");
merged.clearHistory();
const fragment = {
  format: "tinyDatagrid-workbook",
  version: 2,
  cells: [
    { row: 0, col: 0, value: "after" },
    { row: 1, col: 0, value: "added" },
  ],
};
merged.importWorkbook(fragment, { replace: false });
assert.equal(merged.historyState.undo, 1);
merged.undo();
assert.equal(merged.getRawValue(0, 0), "before");
assert.equal(merged.cells.has("1,0"), false);
merged.redo();
assert.equal(merged.getRawValue(0, 0), "after");
assert.equal(merged.getRawValue(1, 0), "added");
merged.undo();
assert.throws(
  () =>
    merged.transaction(() => {
      merged.importWorkbook(fragment, { replace: false });
      throw new Error("abort merged import");
    }),
  /abort merged import/,
);
assert.equal(merged.getRawValue(0, 0), "before");
assert.equal(merged.cells.has("1,0"), false);

const pivotGrid = new Model(
  {},
  { rows: 5, columns: 5, plugins: [sheetPivots()] },
);
pivotGrid.load([
  ["Group", "Value"],
  ["A", 2],
]);
pivotGrid.clearHistory();
const pivot = pivotGrid.feature("pivots");
const pivotId = pivot.insert({
  source: { r1: 0, r2: 1, c1: 0, c2: 1 },
  target: { row: 0, col: 3 },
  config: { rows: ["Group"], values: [{ field: "Value", aggregate: "sum" }] },
});
assert.equal(pivotGrid.getRawValue(1, 4), 2);
pivotGrid.undo();
assert.equal(pivotGrid.pivotTables.length, 0);
assert.equal(pivotGrid.cells.has("1,4"), false);
pivotGrid.redo();
assert.equal(pivotGrid.getComputedValue(1, 4), 2);
pivot.remove(pivotId);
assert.equal(pivotGrid.cells.has("1,4"), false);
pivotGrid.undo();
assert.equal(pivotGrid.getComputedValue(1, 4), 2);
pivotGrid.redo();
assert.equal(pivotGrid.cells.has("1,4"), false);
pivotGrid.clearHistory();
pivotGrid.transaction(() => {
  const transient = pivot.insert({
    source: { r1: 0, r2: 1, c1: 0, c2: 1 },
    target: { row: 0, col: 3 },
    config: { rows: ["Group"], values: [{ field: "Value", aggregate: "sum" }] },
  });
  pivot.remove(transient);
});
assert.equal(
  pivotGrid.canUndo,
  false,
  "creating and removing a pivot is a no-op",
);

// A single edit, undo and redo must not enumerate the stored workbook cells.
const history = new Model({}, { rows: 100_000, columns: 3 });
for (let row = 0; row < 80_000; row++)
  Map.prototype.set.call(history.cells, `${row},0`, { raw: row });
history.clearHistory();
const iterator = history.cells[Symbol.iterator];
history.cells[Symbol.iterator] = () => {
  throw new Error("unexpected full cell-map scan");
};
history.setCell(2, 0, 999);
assert.equal(
  history._history.at(-1).changes.find((c) => c.key === "cells").patch.changes
    .length,
  1,
);
assert.equal(history.undo(), true);
assert.equal(history.getRawValue(2, 0), 2);
assert.equal(history.redo(), true);
assert.equal(history.getRawValue(2, 0), 999);
history.cells[Symbol.iterator] = iterator;
history.clearHistory();
history.transaction(() => {
  history.setCell(3, 0, 1);
  history.setCell(3, 0, 2);
  history.setCell(4, 0, 3);
});
assert.equal(history.historyState.undo, 1);
assert.equal(
  history._history[0].changes.find((c) => c.key === "cells").patch.changes
    .length,
  2,
);
history.undo();
assert.equal(history.getRawValue(3, 0), 3);
assert.equal(history.getRawValue(4, 0), 4);
history.redo();
history.setCell(5, 0, 100);
assert.equal(history.canRedo, false);
history.clearHistory();
assert.throws(
  () =>
    history.transaction(() => {
      history.setCell(7, 0, 999);
      throw new Error("rollback");
    }),
  /rollback/,
);
assert.equal(history.getRawValue(7, 0), 7);
assert.equal(history.canUndo, false);
history.setCell(8, 0, 8);
history.clearHistory();
history.transaction(() => {
  history.setCell(8, 0, 10);
  history.setCell(8, 0, 8);
});
assert.equal(history.canUndo, false, "net-zero actions leave no history entry");
history.insertRow(2);
assert.equal(history.getRawValue(3, 0), 999);
history.undo();
assert.equal(history.getRawValue(2, 0), 999);
history.redo();
assert.equal(history.getRawValue(3, 0), 999);
const valid = new Model(
  {},
  { rows: 5, columns: 2, plugins: [dataValidation()] },
);
valid.setCell(0, 0, 5);
valid.setValidationRules([
  { range: { r1: 0, r2: 4, c1: 0, c2: 0 }, type: "number", max: 10 },
]);
valid.clearHistory();
assert.equal(
  valid.transaction(() => {
    valid.setCell(0, 0, 7);
    valid.setCell(1, 0, 20);
  }),
  false,
);
assert.equal(valid.getRawValue(0, 0), 5);
assert.equal(valid.getRawValue(1, 0), "");
assert.equal(valid.canUndo, false);

const clear = new Model({}, { rows: 10_000_000, columns: 2 });
clear.load([[1], [2]]);
clear.setCell(9_999_999, 0, 3);
clear.clearHistory();
clear.selection = { r1: 0, c1: 0, r2: 9_999_999, c2: 0 };
assert.equal(clear.clearSelection(), true);
assert.equal(clear.cells.size, 3);
clear.undo();
assert.equal(clear.getRawValue(9_999_999, 0), 3);
clear.clearColumn(0);
clear.undo();
assert.equal(clear.getRawValue(1, 0), 2);
console.log(
  "Core scalability: decimal precision, sparse geometry/ranges, spills, worksheet references, journal history and rollback passed",
);

const unrecorded = new Model({}, { rows: 3, columns: 2, historyLimit: 0 });
unrecorded.setCell(0, 0, 1);
assert.throws(
  () =>
    unrecorded.transaction(() => {
      unrecorded.setCell(0, 0, 2);
      throw new Error("abort");
    }),
  /abort/,
);
assert.equal(unrecorded.getRawValue(0, 0), 1);
assert.equal(unrecorded.canUndo, false);
assert.throws(
  () =>
    unrecorded.transaction(() => {
      unrecorded.setCell(0, 0, 3);
      unrecorded.cells = new Map([["1,0", { raw: 4 }]]);
      throw new Error("replace");
    }),
  /replace/,
);
assert.equal(unrecorded.getRawValue(0, 0), 1);
assert.equal(unrecorded.getRawValue(1, 0), "");
const original = unrecorded.exportWorkbook({ computedValues: false });
assert.throws(
  () =>
    unrecorded.importWorkbook({
      ...original,
      sheets: [
        { ...original.sheets[0], dimensions: { rows: 10_000_001, columns: 2 } },
      ],
    }),
  RangeError,
);
assert.deepEqual(
  unrecorded.exportWorkbook({ computedValues: false }),
  original,
);
const limited = new Model({}, { rows: 10, columns: 2, maxRangeCells: 4 });
assert.equal(limited.engine.evaluateFormula("=SUM(A1:A10)"), 0);
assert.equal(limited.engine.evaluateFormula("=A1:A10"), "#NUM!");
assert.throws(
  () => limited.toArray({ r1: 0, r2: 4, c1: 0, c2: 0 }),
  RangeError,
);
limited.selection = { r1: 0, r2: 4, c1: 0, c2: 0 };
assert.throws(() => limited.styleSelection({ fontWeight: "bold" }), RangeError);
assert.throws(
  () =>
    limited.fill(
      { r1: 0, r2: 0, c1: 0, c2: 0 },
      { r1: 0, r2: 4, c1: 0, c2: 0 },
    ),
  RangeError,
);
assert.equal(limited.cells.size, 0);
console.log(
  "Atomic rollback without history and configurable dense-range budgets passed",
);
