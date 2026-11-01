import assert from "node:assert/strict";
import TinyDatagrid from "../src/tinygrid.js";
import { localSQL, materializeSQLResult } from "../src/local-sql.js";
import { worksheets } from "../src/worksheets.js";
import { DecimalValue } from "../src/decimal-values.js";
import { CalendarDate } from "../src/temporal-values.js";

class ModelGrid extends TinyDatagrid {
  build() {}
  bind() {}
  renderCells() {}
  emit() {}
  setLocale(locale) {
    this.locale = locale;
    return this;
  }
  render() {
    this._updateFilteredRows();
    this.engine.settle();
  }
  layout() {
    this._updateFilteredRows();
  }
  select(row, col) {
    this.anchor = { row, col };
    this.selection = { r1: row, r2: row, c1: col, c2: col };
  }
}
const grid = new ModelGrid(
  {},
  { rows: 12, columns: 5, plugins: [worksheets(), localSQL()] },
);
grid.load([
  ["Region", "Sales"],
  ["North", 10],
  ["South", 20],
  ["North", 15],
]);
grid.createTable({ r1: 0, r2: 3, c1: 0, c2: 1 });
const sheets = grid.feature("worksheets"),
  sql = grid.feature("sql");
const original = sheets.activeId;
const result = sql.query(
  "SELECT Region, SUM(Sales) AS Revenue FROM table1 GROUP BY Region ORDER BY Revenue DESC",
);
const created = sql.materialize(result, {
  sheetName: "Regional sales",
  tableName: "Summary",
});
assert.equal(sheets.activeId, created.sheetId);
assert.equal(created.name, "Regional sales");
assert.deepEqual(created.range, { r1: 0, r2: 2, c1: 0, c2: 1 });
assert.equal(grid.table.name, "Summary");
assert.equal(grid.sqlBinding, null);
assert.equal(grid.getComputedValue(1, 1), 25);
assert.equal(grid.table.includeEmptyRows, true);
assert.deepEqual(
  sql.query("SELECT Region FROM Summary WHERE Revenue > 20").rows,
  [["North"]],
);
assert.equal(sql.query("SELECT SUM(Revenue) FROM Summary").rows[0][0], 45);
grid.setCell(1, 1, 30);
assert.equal(sql.query("SELECT SUM(Revenue) FROM Summary").rows[0][0], 50);
sheets.select(original);
assert.equal(grid.getComputedValue(1, 1), 10);
assert.equal(grid.listTables().length, 1);
const repeated = sql.materialize(result, { sheetName: "regional sales" });
assert.equal(repeated.name, "regional sales (2)");

// Exact types, objects and text which resembles formulas survive materialization and workbook round trips.
const decimal = DecimalValue.parse("0.1234567890123456789");
const date = CalendarDate.parse("2026-10-03");
const object = { nested: ["original"] };
const typed = materializeSQLResult(grid, {
  columns: ["=A1", "Decimal", "Big", "Day", "JSON"],
  rows: [["=1+2", decimal, 9007199254740993n, date, object]],
});
assert.equal(grid.getComputedValue(0, 0), "=A1");
assert.equal(grid.getComputedValue(1, 0), "=1+2");
assert.equal(grid.getCell(1, 0).valueType, "text");
assert.equal(String(grid.getComputedValue(1, 1)), String(decimal));
assert.equal(grid.getComputedValue(1, 2), 9007199254740993n);
assert.ok(grid.getComputedValue(1, 3) instanceof CalendarDate);
object.nested[0] = "changed";
date.setFullYear(2027);
assert.equal(grid.getComputedValue(1, 3).calendarText(), "2026-10-03");
assert.equal(grid.getRawValue(1, 4).nested[0], "original");
const workbook = grid.exportWorkbook();
grid.importWorkbook(workbook);
assert.equal(String(grid.getComputedValue(1, 1)), String(decimal));
assert.equal(grid.getComputedValue(1, 0), "=1+2");
assert.equal(grid.getComputedValue(1, 2), 9007199254740993n);
assert.equal(sheets.activeId, typed.sheetId);

const nulls = sql.materialize({ columns: ["x"], rows: [[null], [null]] });
assert.equal(sql.query("SELECT COUNT(*) FROM table1").rows[0][0], 2);
assert.deepEqual(sql.query("SELECT x FROM table1").rows, [[null], [null]]);
sheets.select(original);
sheets.select(nulls.sheetId);
assert.equal(sql.query("SELECT COUNT(*) FROM table1").rows[0][0], 2);
const empty = sql.materialize({ columns: ["x"], rows: [] });
assert.equal(grid.table.r2, 0);
assert.equal(sql.query("SELECT COUNT(*) FROM table1").rows[0][0], 0);
assert.deepEqual(sql.query("SELECT * FROM table1").columns, ["x"]);

const before = sheets.list().length;
for (const bad of [
  { columns: [], rows: [] },
  { columns: ["x", "X"], rows: [] },
  { columns: ["x"], rows: [[1, 2]] },
  { columns: [1], rows: [] },
])
  assert.throws(() => sql.materialize(bad), /schema/);
assert.throws(() => sql.materialize(result, { sheetName: " " }), /name/);
assert.equal(sheets.list().length, before);
grid.readOnly = true;
assert.throws(() => sql.materialize(result), /read-only/);
assert.equal(sheets.list().length, before);
grid.readOnly = false;
// A failed population leaves the original active sheet and no abandoned worksheet.
const importMatrix = grid._importMatrix;
grid._importMatrix = () => {
  throw new Error("Import failed");
};
assert.throws(() => sql.materialize(result), /Import failed/);
grid._importMatrix = importMatrix;
assert.equal(sheets.activeId, empty.sheetId);
assert.equal(sheets.list().length, before);
assert.equal(grid.getComputedValue(0, 0), "x");
assert.equal(grid.table.r2, 0);
const standalone = new ModelGrid({}, { rows: 5, columns: 5 });
assert.throws(
  () => materializeSQLResult(standalone, result),
  /worksheets plugin/,
);
console.log("SQL result materialization tests passed");

sheets.select(original);
const originalName = grid.sheetName;
const into = sql.query(
  'SELECT Region, SUM(Sales) AS Revenue INTO "Regional overview":B5 FROM table1 GROUP BY Region ORDER BY Revenue DESC',
);
assert.equal(sheets.activeId, original);
assert.equal(grid.table.id, "table1");
assert.deepEqual(into.destination.range, { r1: 4, r2: 6, c1: 1, c2: 2 });
sheets.select(into.destination.sheetId);
assert.equal(grid.getComputedValue(4, 1), "Region");
assert.equal(grid.getComputedValue(5, 2), 25);
assert.equal(grid.getRawValue(0, 0), "");
assert.deepEqual(sql.query("SELECT SUM(Revenue) FROM table1").rows, [[45]]);
const targetId = sheets.activeId;
grid.setCell(0, 0, "keep");
sheets.select(original);
const countBefore = sheets.list().length;
assert.throws(
  () => sql.query('SELECT * INTO "Regional overview":B5 FROM table1'),
  /overlaps/,
);
assert.throws(
  () => sql.query('SELECT * INTO "Regional overview":A1 FROM table1'),
  /occupied/,
);
assert.equal(sheets.activeId, original);
assert.equal(sheets.list().length, countBefore);
const secondTable = sql.query(
  'SELECT * INTO "Regional overview":E5 FROM table1',
);
assert.equal(secondTable.destination.sheetId, targetId);
assert.equal(secondTable.destination.tableId, "table2");
sheets.select(targetId);
assert.equal(grid.getComputedValue(0, 0), "keep");
assert.equal(grid.listTables().length, 2);
assert.equal(grid.getComputedValue(5, 5), 10);
sheets.select(original);
const sameSheet = sql.query(`SELECT * INTO "${originalName}":E5 FROM table1`);
assert.equal(sameSheet.destination.sheetId, original);
assert.equal(grid.table.id, "table1");
assert.equal(grid.getComputedValue(5, 5), 10);
assert.equal(grid.getComputedValue(1, 1), 10);
assert.throws(
  () => sql.query(`SELECT * INTO "${originalName}":A1 FROM table1`),
  /overlaps/,
);
for (const cell of ["A0", "A10000001", "ZZZZ5"])
  assert.throws(() => sql.query(`SELECT * INTO Bad:${cell} FROM table1`));
assert.throws(
  () => sql.query("SELECT missing INTO Bad:A1 FROM table1"),
  /Unknown/,
);
assert.equal(sheets.list().length, countBefore);
// Hide state is preserved when INTO writes without activating the output sheet.
sheets.setHidden(targetId, true);
const hiddenOutput = sql.query(
  'SELECT * INTO "Regional overview":J5 FROM table1',
);
assert.equal(hiddenOutput.destination.sheetId, targetId);
assert.equal(sheets.list().find((s) => s.id === targetId).hidden, true);
assert.equal(sheets.activeId, original);
assert.throws(
  () => sql.query('SELECT * INTO "Regional overview":A1 FROM table1'),
  /occupied/,
);
assert.equal(sheets.list().find((s) => s.id === targetId).hidden, true);
// A partial import failure restores an existing destination and its table definitions.
sheets.setHidden(targetId, false);
sheets.select(targetId);
const targetHistory = { ...grid.historyState };
sheets.select(original);
grid._importMatrix = (...args) => {
  importMatrix.apply(grid, args);
  throw new Error("Partial import failed");
};
assert.throws(
  () => sql.query('SELECT * INTO "Regional overview":M5 FROM table1'),
  /Partial import/,
);
grid._importMatrix = importMatrix;
assert.equal(sheets.activeId, original);
sheets.select(targetId);
assert.equal(grid.getComputedValue(4, 12), "");
assert.equal(grid.listTables().length, 3);
assert.deepEqual(grid.historyState, targetHistory);
sheets.select(original);
grid.readOnly = true;
assert.throws(
  () => sql.query("SELECT * INTO Readonly:A1 FROM table1"),
  /read-only/,
);
grid.readOnly = false;
assert.equal(sheets.list().length, countBefore);
console.log("SELECT INTO placement, collisions and rollback tests passed");
