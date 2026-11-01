import assert from "node:assert/strict";
import TinyDatagrid, {
  gridLimits,
  GridLimitError,
  colToName,
} from "../src/tinygrid.js";
import { exportData } from "../src/exporters.js";
import { worksheets } from "../src/worksheets.js";
import { localSQL } from "../src/local-sql.js";
import { parseRangeText } from "../src/rule-tools.js";
import { DecimalValue } from "../src/decimal-values.js";
import { dataValidation } from "../src/features.js";
import { CalendarDate } from "../src/temporal-values.js";

class Model extends TinyDatagrid {
  build() {}
  bind() {}
  render() {}
  layout() {}
  renderCells() {}
  emit(type, detail) {
    for (const listener of this.listeners.get(type) || []) listener(detail);
  }
  select(row, col) {
    this.anchor = { row, col };
    this.selection = { r1: row, r2: row, c1: col, c2: col };
  }
  setLocale() {
    return this;
  }
}
const grid = new Model({}, { rows: 10, columns: 3, maxRangeCells: 2 });
grid.load([
  ["Name", "Value"],
  ['A,"B', 2],
  ["<x>|\ny", "=B2+1"],
]);
const range = { r1: 0, r2: 2, c1: 0, c2: 1 };
// Streaming exports have their own budget, independent of dense array allocation.
assert.throws(() => grid.toArray(range), GridLimitError);
for (const format of ["csv", "tsv", "json", "html", "markdown"]) {
  const blob = await exportData(grid, { format, range, batchSize: 2 });
  const content = await blob.text();
  grid.options.maxRangeCells = 10;
  const expected =
    format === "json"
      ? JSON.stringify(grid.exportJSON({ range }))
      : grid[
          {
            csv: "exportCSV",
            tsv: "exportTSV",
            html: "exportHTML",
            markdown: "exportMarkdown",
          }[format]
        ]({ range });
  assert.equal(content, expected, format);
  grid.options.maxRangeCells = 2;
}
const workbook = await grid.exportWorkbookAsync({ batchSize: 2 });
assert.deepEqual(workbook, grid.exportWorkbook({ computedValues: false }));
assert.deepEqual(JSON.parse(await (await exportData(grid)).text()), workbook);
const before = [...grid.listeners.values()].reduce((n, set) => n + set.size, 0);
await assert.rejects(
  exportData(grid, { format: "csv", range, maxCells: 5 }),
  (error) =>
    error.code === "EXPORT_CELLS" && error.limit === 5 && error.actual === 6,
);
await assert.rejects(
  exportData(grid, { maxBytes: 10 }),
  (e) => e.code === "EXPORT_BYTES",
);
await assert.rejects(
  grid.exportWorkbookAsync({ signal: AbortSignal.abort() }),
  { name: "AbortError" },
);
const controller = new AbortController();
await assert.rejects(
  exportData(grid, {
    format: "csv",
    range,
    batchSize: 1,
    signal: controller.signal,
    onProgress() {
      controller.abort();
    },
  }),
  { name: "AbortError" },
);
await assert.rejects(
  grid.exportWorkbookAsync({
    batchSize: 1,
    onProgress() {
      grid.setCell(0, 0, "edited");
    },
  }),
  (e) => e.code === "WORKBOOK_CHANGED",
);
assert.equal(
  [...grid.listeners.values()].reduce((n, set) => n + set.size, 0),
  before,
);

// UTF-8 limits count bytes, not code units; aborted exports leave no partial file.
const unicode = new Model({}, { rows: 1, columns: 1 });
unicode.setCell(0, 0, "😀");
await assert.rejects(
  exportData(unicode, { format: "csv", maxBytes: 3 }),
  (e) => e.code === "EXPORT_BYTES",
);
assert.equal(
  (await exportData(unicode, { format: "csv", maxBytes: 4 })).size,
  4,
);

// Cooperative snapshots do not call the synchronous full workbook export.
const book = new Model({}, { rows: 5, columns: 3, plugins: [worksheets()] });
const sheets = book.feature("worksheets"),
  first = sheets.activeId;
book.setCell(0, 0, DecimalValue.parse("0.123456789012345678901"));
book.setCell(1, 0, CalendarDate.parse("2026-11-01"));
const second = sheets.add("Other");
sheets.select(second);
book.setCell(0, 0, 9007199254740993n);
sheets.setColor(first, "#112233");
const expected = book.exportWorkbook({ computedValues: false });
book.exportWorkbook = () => {
  throw new Error("synchronous export");
};
const snapshot = await book.exportWorkbookAsync({ batchSize: 1 });
assert.deepEqual(snapshot, expected);
assert.equal(sheets.activeId, second);
const imported = new Model(
  {},
  { rows: 5, columns: 3, plugins: [worksheets()] },
);
imported.importWorkbook(snapshot);
assert.equal(imported.getCalculationValue(0, 0), 9007199254740993n);
imported.feature("worksheets").select(first);
assert.equal(
  String(imported.getCalculationValue(0, 0)),
  "0.123456789012345678901",
);
assert.ok(imported.getCalculationValue(1, 0) instanceof CalendarDate);

// Rules and SQL destinations share the grid coordinate limits, not an Office limit.
const lastColumn = colToName(gridLimits.columns - 1);
assert.deepEqual(parseRangeText(`${lastColumn}:${lastColumn}`), {
  r1: 0,
  r2: gridLimits.rows - 1,
  c1: gridLimits.columns - 1,
  c2: gridLimits.columns - 1,
});
assert.equal(parseRangeText(`A${gridLimits.rows + 1}`), null);
const validation = new Model({}, { plugins: [dataValidation()] });
assert.throws(
  () =>
    validation.setValidationRules([
      { range: { r1: 0, r2: gridLimits.rows, c1: 0, c2: 0 }, type: "number" },
    ]),
  (error) => error.code === "GRID_ROWS",
);
const sqlGrid = new Model(
  {},
  { rows: 3, columns: 2, plugins: [worksheets(), localSQL()] },
);
const sql = sqlGrid.feature("sql");
const saved = sql.write(
  { columns: ["x"], rows: [[1]] },
  { sheetName: "Edge", cell: `${lastColumn}${gridLimits.rows - 1}` },
);
assert.equal(saved.range.r2, gridLimits.rows - 1);
assert.equal(saved.range.c2, gridLimits.columns - 1);
assert.throws(
  () =>
    sql.write(
      { columns: ["x"], rows: [[1], [2]] },
      { sheetName: "Overflow", cell: `A${gridLimits.rows - 1}` },
    ),
  (error) => error.code === "GRID_ROWS",
);
for (const maxRangeCells of [0, 1.5, Infinity])
  assert.throws(() => new Model({}, { maxRangeCells }), TypeError);
console.log(
  "Async export: formats, budgets, cancellation, coherent snapshots, typed values and shared coordinate limits passed",
);
