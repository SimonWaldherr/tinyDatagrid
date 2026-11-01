import assert from "node:assert/strict";
import TinyDatagrid from "../src/tinygrid.js";
import { analysisContext, analysisRecords } from "../src/analysis.js";
import { businessIntelligence, summarizeBI } from "../src/bi.js";
import { DecimalValue } from "../src/decimal-values.js";
import { FormulaError } from "../src/formula-errors.js";

class ModelGrid extends TinyDatagrid {
  build() {}
  bind() {}
  setLocale(locale) {
    this.locale = locale;
    return this;
  }
  render() {
    this._updateFilteredRows();
    this.engine.settle();
  }
  renderCells() {}
  layout() {
    this._updateFilteredRows();
  }
  emit() {}
}
const grid = new ModelGrid(
  {},
  {
    rows: 15,
    columns: 5,
    plugins: [analysisContext(), businessIntelligence()],
  },
);
grid.load([
  ["Region", "Sales"],
  ["North", 10],
  ["South", 20],
  ["North", "=B2+5"],
  ["South", ""],
  ["North", "text"],
  ["", ""],
]);
grid.createTable({ r1: 0, c1: 0, r2: 6, c2: 1 });
const source = { r1: 0, c1: 0, r2: 6, c2: 1 };
const config = {
  metrics: [
    { id: "sales", field: "Sales", aggregate: "sum", target: 50 },
    { id: "avg", field: "Sales", aggregate: "average" },
    { id: "rows", aggregate: "count" },
    { id: "numeric", field: "Sales", aggregate: "count" },
    { id: "filled", field: "Sales", aggregate: "counta" },
    { id: "regions", field: "Region", aggregate: "distinct" },
    { id: "min", field: "Sales", aggregate: "min" },
    { id: "max", field: "Sales", aggregate: "max" },
  ],
  dimensions: ["Region"],
  sort: { metric: "sales" },
  limit: 1,
};
const bi = grid.feature("bi");
let report = bi.summarize(source, config);
assert.equal(report.rowCount, 5);
assert.deepEqual(
  report.metrics.map((m) => m.value),
  [45, 15, 5, 3, 4, 2, 10, 20],
);
assert.equal(report.metrics[0].delta, -5);
assert.equal(report.metrics[0].attainment, 0.9);
assert.equal(report.groupCount, 2);
assert.equal(report.groups.length, 1);
assert.deepEqual(report.groups[0].dimensions, { Region: "North" });
assert.deepEqual(
  report.drill(0).map((e) => e.row),
  [1, 3, 5],
);
assert.deepEqual(report.drill(-1), []);
assert.deepEqual(report.drill(1), []);
assert.equal(report.drill().length, 5);
assert.equal(
  bi.summarize(source, {
    ...config,
    sort: { metric: "sales", direction: "asc" },
  }).groups[0].dimensions.Region,
  "South",
);

grid.setColumnFilter(0, ["South"]);
assert.equal(bi.summarize(source, config).metrics[0].value, 20);
grid.feature("analysis").set({ scope: "all" });
assert.equal(bi.summarize(source, config).metrics[0].value, 45);
grid
  .feature("analysis")
  .set({ scope: "selection", selection: { r1: 3, r2: 1, c1: 0, c2: 1 } });
assert.equal(bi.summarize(source, config).metrics[0].value, 45);
assert.equal(bi.summarize(source, config, { scope: "visible" }).rowCount, 2);
assert.equal(
  summarizeBI(
    grid,
    source,
    { ...config, filters: { Region: ["North"] } },
    { scope: "all" },
  ).rowCount,
  3,
);
grid.clearFilters();
grid.setCell(1, 1, 100);
assert.equal(
  bi.summarize(source, config, { scope: "all" }).metrics[0].value,
  225,
);
assert.equal(report.metrics[0].value, 45); // reports are snapshots

const fake = (rows) => ({
  getComputedValue: (r, c) => rows[r][c],
  hiddenRows: new Set(),
  filteredRows: new Set(),
});
const range = { r1: 0, r2: 3, c1: 0, c2: 1 };
const exactGrid = fake([
  ["Region", "Sales"],
  ["A", 9007199254740993n],
  ["B", DecimalValue.parse("0.1")],
  ["B", DecimalValue.parse("0.2")],
]);
report = summarizeBI(exactGrid, range, config);
assert.equal(String(report.metrics[0].value), "9007199254740993.3");
assert.equal(report.groups[0].dimensions.Region, "A");
assert.equal(String(report.metrics[0].delta), "9007199254740943.3");
report = summarizeBI(
  fake([
    ["Region", "Sales"],
    ["A", ""],
    ["A", false],
    ["A", "20"],
  ]),
  range,
  config,
);
assert.equal(report.metrics[0].value, 0);
assert.equal(report.metrics[1].value, null);
report = summarizeBI(exactGrid, range, {
  ...config,
  filters: { Region: "missing" },
});
assert.equal(report.rowCount, 0);
assert.equal(report.metrics[0].value, 0);
assert.equal(report.metrics[1].value, null);
assert.deepEqual(report.groups, []);
report = summarizeBI(exactGrid, range, {
  metrics: [{ id: "zero", field: "Sales", aggregate: "sum", target: 0 }],
});
assert.equal(report.metrics[0].attainment, null);
const failure = new FormulaError("#DIV/0!");
report = summarizeBI(
  fake([
    ["Region", "Sales"],
    ["A", failure],
    ["A", 3],
    ["B", 5],
  ]),
  range,
  config,
);
assert.equal(report.metrics[0].value, failure);
assert.equal(report.metrics[0].delta, null);
assert.equal(report.groups[0].dimensions.Region, "B"); // errors sort last
for (const invalid of [
  { metrics: [] },
  { metrics: [{ id: "x", aggregate: "unknown" }] },
  { metrics: [{ id: "x", aggregate: "sum", field: "missing" }] },
  { ...config, limit: 0 },
  { ...config, sort: { metric: "missing" } },
  { ...config, dimensions: ["missing"] },
  { ...config, dimensions: ["Region", "Region"] },
  { ...config, filters: { missing: "A" } },
  { metrics: [{ id: "x", aggregate: "count", target: Infinity }] },
  {
    metrics: [
      { id: "x", aggregate: "count" },
      { id: "x", aggregate: "count" },
    ],
  },
])
  assert.throws(() => summarizeBI(exactGrid, range, invalid), TypeError);
assert.throws(
  () => summarizeBI(grid, source, config, { scope: "bad" }),
  TypeError,
);
assert.throws(() => analysisRecords(grid, source, { scope: "bad" }), TypeError);
console.log("BI tests passed");
