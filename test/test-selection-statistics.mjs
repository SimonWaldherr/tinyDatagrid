import assert from "node:assert/strict";
import TinyDatagrid from "../src/tinygrid.js";
import { DecimalValue } from "../src/decimal-values.js";
import { CalendarDate } from "../src/temporal-values.js";
import { worksheets } from "../src/worksheets.js";

class Model extends TinyDatagrid {
  build() {}
  bind() {}
  render() {}
  renderCells() {}
  layout() {}
  setLocale() {
    return this;
  }
  emit(type, detail) {
    for (const fn of this.listeners.get(type) || []) fn(detail);
  }
}
const grid = new Model({}, { rows: 10, columns: 3, plugins: [worksheets()] });
grid.load([[1], [2], [3], [4]]);
const range = { r1: 0, c1: 0, r2: 3, c2: 0 };
grid.selection = { r1: 3, c1: 0, r2: 0, c2: 0 };
assert.equal(
  grid.getSelectionStatistics().sum,
  10,
  "reverse selections are normalized",
);
assert.deepEqual(grid.getSelectionStatistics(range), {
  count: 4,
  numericCount: 4,
  sum: 10,
  average: 2.5,
  median: 2.5,
  min: 1,
  max: 4,
  medianLimited: false,
});
grid.hiddenRows.add(0);
grid.filteredRows.add(3);
assert.deepEqual(grid.getSelectionStatistics(range), {
  count: 2,
  numericCount: 2,
  sum: 5,
  average: 2.5,
  median: 2.5,
  min: 2,
  max: 3,
  medianLimited: false,
});
assert.equal(
  grid.getSelectionStatistics(range, { visibleOnly: false }).sum,
  10,
);
grid.hiddenRows.clear();
grid.filteredRows.clear();
const limited = grid.getSelectionStatistics(range, { maxMedianValues: 2 });
assert.equal(limited.median, null);
assert.equal(limited.medianLimited, true);
assert.equal(limited.sum, 10);
assert.equal(limited.average, 2.5);
grid.setCell(0, 1, "2", { valueType: "text" });
grid.setCell(1, 1, true);
grid.setCell(2, 1, CalendarDate.parse("2026-11-04"));
grid.setCell(3, 1, "=1/0");
assert.deepEqual(grid.getSelectionStatistics({ r1: 0, r2: 3, c1: 1, c2: 1 }), {
  count: 4,
  numericCount: 0,
  sum: 0,
  average: null,
  median: null,
  min: null,
  max: null,
  medianLimited: false,
});
grid.setCell(0, 2, DecimalValue.parse("0.1"));
grid.setCell(1, 2, DecimalValue.parse("0.2"));
const precise = grid.getSelectionStatistics({ r1: 0, r2: 1, c1: 2, c2: 2 });
assert.equal(String(precise.sum), "0.3");
assert.equal(String(precise.median), "0.15");
grid.setCell(0, 2, 9007199254740993n);
grid.setCell(1, 2, 9007199254740994n);
const big = grid.getSelectionStatistics({ r1: 0, r2: 1, c1: 2, c2: 2 });
assert.equal(String(big.sum), "18014398509481987");
assert.equal(String(big.median), "9007199254740993.5");
assert.equal(String(big.average), "9007199254740993.5");
const sheets = grid.feature("worksheets"),
  original = sheets.activeId;
sheets.select(sheets.add("Other"));
assert.equal(grid.getSelectionStatistics(range).count, 0);
grid.setCell(0, 0, "=SEQUENCE(2;2;1)");
const spill = grid.getSelectionStatistics({ r1: 0, r2: 1, c1: 0, c2: 1 });
assert.equal(spill.count, 4);
assert.equal(spill.sum, 10);
assert.equal(spill.median, 2.5);
assert.equal(
  grid.getSelectionStatistics({ r1: 1, r2: 1, c1: 0, c2: 1 }).sum,
  7,
);
sheets.select(original);
assert.equal(grid.getSelectionStatistics(range).sum, 10);
const sparse = new Model({}, { rows: 10_000_000, columns: 2 });
sparse.setCell(9_999_999, 1, 10);
sparse.setCell(0, 0, 20);
assert.equal(
  sparse.getSelectionStatistics({ r1: 0, r2: 9_999_999, c1: 0, c2: 1 }).median,
  15,
);
assert.throws(
  () => grid.getSelectionStatistics({ r1: 2.5, r2: 0, c1: 0, c2: 0 }),
  TypeError,
);
assert.throws(
  () => grid.getSelectionStatistics(range, { maxMedianValues: 0 }),
  TypeError,
);
console.log(
  "Selection statistics: exact arithmetic, median budgets, visibility, types, spills, worksheets and sparse ranges passed",
);
