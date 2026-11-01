import assert from "node:assert/strict";
import TinyDatagrid from "../src/tinygrid.js";
import { worksheets } from "../src/worksheets.js";
import { sheetPivots } from "../src/pivots.js";
import { localSQL } from "../src/local-sql.js";
import { summarizeBI } from "../src/bi.js";
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
  {
    rows: 20,
    columns: 8,
    historyLimit: 30,
    plugins: [worksheets(), sheetPivots(), localSQL()],
  },
);
grid.load([
  ["Group", "Value"],
  ["A", 10],
  ["B", 20],
  ["A", 15],
]);
grid.createTable({ r1: 0, r2: 3, c1: 0, c2: 1 });
const sheets = grid.feature("worksheets"),
  pivots = grid.feature("pivots"),
  sql = grid.feature("sql");
const sourceId = sheets.activeId;
const pivotId = pivots.insert({
  table: "table1",
  target: { row: 6, col: 0 },
  config: { rows: ["Group"], values: [{ field: "Value", aggregate: "sum" }] },
});
const pivotRange = pivots.get(pivotId).output;
grid.createTable(pivotRange, { name: "PivotSource" });
assert.equal(grid.getComputedValue(7, 1), 25);
assert.equal(grid.getPrecedents(7, 1)[0].kind, "pivot");
const derived = sql.query("SELECT * INTO Report:A1 FROM PivotSource");
assert.equal(sheets.activeId, sourceId);
const outputId = derived.destination.sheetId;
sheets.select(outputId);
grid.setCell(1, 3, "=B2*2");
assert.equal(grid.getComputedValue(1, 3), 50);
const direct = grid.getPrecedents(1, 1);
assert.equal(direct[0].kind, "sql");
assert.equal(direct[0].sheetId, sourceId);
assert.equal(direct[0].a.row, 6);
const chain = grid.getPrecedents(1, 3, { recursive: true });
assert.ok(chain.some((r) => r.kind === "formula"));
assert.ok(chain.some((r) => r.kind === "sql"));
assert.ok(
  chain.some((r) => r.kind === "pivot" && r.a.row === 0 && r.b.row === 3),
);
sheets.select(sourceId);
assert.ok(grid.getDependents(1, 1).some((r) => r.kind === "pivot"));
assert.ok(!grid.getDependents(1, 1).some((r) => r.sheetId === outputId));
const descendants = grid.getDependents(1, 1, { recursive: true });
assert.ok(descendants.some((r) => r.kind === "sql" && r.sheetId === outputId));
assert.ok(
  descendants.some(
    (r) => r.kind === "formula" && r.col === 3 && r.sheetId === outputId,
  ),
);
// SQL inputs also include rows/columns deciding filters, grouping, order and empty results.
const filtered = sql.query(
  "SELECT Value INTO Filtered:A1 FROM table1 WHERE Group = 'A' LIMIT 1",
);
assert.ok(
  grid
    .getDependents(2, 0)
    .some((r) => r.sheetId === filtered.destination.sheetId),
);
// Provenance survives portable workbook save/load, renaming and worksheet switches.
sheets.select(outputId);
const workbook = JSON.parse(JSON.stringify(grid.exportWorkbook()));
grid.importWorkbook(workbook);
assert.ok(
  grid.getPrecedents(1, 3, { recursive: true }).some((r) => r.kind === "pivot"),
);
sheets.rename(sourceId, "Renamed source");
assert.match(grid.getPrecedents(1, 1)[0].text, /Renamed source/);
// Replacing a snapshot cell drops its SQL lineage; undo/redo restores/removes it.
grid.setCell(1, 1, 99);
assert.equal(grid.getPrecedents(1, 1).length, 0);
grid.undo();
assert.equal(grid.getPrecedents(1, 1)[0].kind, "sql");
grid.redo();
assert.equal(grid.getPrecedents(1, 1).length, 0);
// Host transformations and BI use the same portable lineage contract.
sheets.select(sourceId);
const report = summarizeBI(
  grid,
  { r1: 0, r2: 3, c1: 0, c2: 1 },
  { metrics: [{ id: "total", field: "Value", aggregate: "sum" }] },
);
grid.setCell(12, 0, report.metrics[0].value);
grid.setCellLineage(12, 0, report.lineage);
assert.equal(grid.getPrecedents(12, 0)[0].kind, "bi");
assert.ok(grid.getDependents(1, 1).some((r) => r.kind === "bi"));
assert.throws(
  () =>
    grid.setCellLineage(12, 0, {
      kind: "custom",
      sources: [{ sheetId: sourceId, r1: -1 }],
    }),
  /lineage/,
);
// Cycles in generic provenance terminate in both directions.
grid.setCellLineage(12, 0, {
  kind: "custom",
  sources: [{ sheetId: sourceId, r1: 13, r2: 13, c1: 0, c2: 0 }],
});
grid.setCellLineage(13, 0, {
  kind: "custom",
  sources: [{ sheetId: sourceId, r1: 12, r2: 12, c1: 0, c2: 0 }],
});
assert.equal(grid.getPrecedents(12, 0, { recursive: true }).length, 2);
assert.equal(grid.getDependents(12, 0, { recursive: true }).length, 1);
// Formula-looking literal text never creates false references.
grid.setCell(14, 0, "=B2", { valueType: "text" });
assert.equal(grid.getPrecedents(14, 0).length, 0);
// Dynamic-array children link to the origin formula.
grid.setCell(16, 0, "=SEQUENCE(2,2)");
assert.equal(grid.getComputedValue(17, 1), 4);
assert.equal(grid.getPrecedents(17, 1)[0].kind, "spill");
assert.ok(grid.getDependents(16, 0).some((r) => r.kind === "spill"));
grid.registerFunction("READVALUE", () => grid.getCalculationValue(1, 1));
grid.setCell(10, 4, "=READVALUE()");
assert.ok(
  grid.getPrecedents(10, 4).some((r) => r.a.row === 1 && r.a.col === 1),
);
assert.ok(grid.getDependents(1, 1).some((r) => r.row === 10 && r.col === 4));
console.log(
  "Cross-sheet formula, pivot, SQL, BI and spill lineage tests passed",
);

// The same API works without the optional worksheet plugin.
const standalone = new ModelGrid({}, { rows: 5, columns: 4 });
standalone.load([[2, "=A1*3", "=B1+1"]]);
assert.equal(standalone.getPrecedents(0, 1)[0].sheetId, null);
assert.equal(standalone.getDependents(0, 0).length, 1);
assert.equal(standalone.getDependents(0, 0, { recursive: true }).length, 2);
standalone.setCellLineage(1, 0, {
  kind: "custom",
  sources: [{ sheetId: null, r1: 0, r2: 0, c1: 0, c2: 0 }],
});
assert.equal(standalone.getPrecedents(1, 0)[0].kind, "custom");
