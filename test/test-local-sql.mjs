import assert from "node:assert/strict";
import TinyDatagrid from "../src/tinygrid.js";
import { localSQL, queryTables } from "../src/local-sql.js";
import { DecimalValue } from "../src/decimal-values.js";
import { FormulaError } from "../src/formula-errors.js";
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
}
const grid = new ModelGrid({}, { rows: 15, columns: 6, plugins: [localSQL()] });
grid.load([
  ["Region", "Sales", "Name"],
  ["North", 10, "O'Brien"],
  ["South", 20, "Pen"],
  ["North", "=B2+5", "Ink"],
  ["South", "", "Pen"],
  ["", "", ""],
]);
grid.createTable({ r1: 0, c1: 0, r2: 5, c2: 2 });
const api = grid.feature("sql");
const q = (sql, params, options) => api.query(sql, params, options);
assert.deepEqual(q("SELECT * FROM table1").toTable(), [
  ["Region", "Sales", "Name"],
  ["North", 10, "O'Brien"],
  ["South", 20, "Pen"],
  ["North", 15, "Ink"],
  ["South", null, "Pen"],
]);
assert.deepEqual(
  q(
    'select region, sales as Revenue from "Table 1" where sales >= ? order by Revenue desc limit 1',
    [12],
  ).rows,
  [["South", 20]],
);
assert.deepEqual(q("SELECT DISTINCT Region FROM table1 ORDER BY 1").rows, [
  ["North"],
  ["South"],
]);
let result = q(
  "SELECT Region, SUM(Sales) AS Total, AVG(Sales) AS Avg, COUNT(*) AS Rows, COUNT(Sales) AS Filled FROM table1 GROUP BY Region HAVING Total >= 20 ORDER BY Total DESC",
);
assert.deepEqual(result.rows, [
  ["North", 25, 12.5, 2, 2],
  ["South", 20, 20, 2, 1],
]);
assert.deepEqual(
  result.drill(0).map((e) => e.row),
  [1, 3],
);
assert.deepEqual(result.drill(-1), []);
assert.deepEqual(
  q("SELECT COUNT(DISTINCT Name), MIN(Name), MAX(Sales) FROM table1").rows,
  [[3, "Ink", 20]],
);
assert.deepEqual(q("SELECT Region FROM table1 WHERE Sales IS NULL").rows, [
  ["South"],
]);
assert.equal(q("SELECT * FROM table1 WHERE Sales = NULL").rowCount, 0);
assert.equal(q("SELECT * FROM table1 WHERE NOT (Sales = NULL)").rowCount, 0);
assert.equal(
  q("SELECT * FROM table1 WHERE Sales NOT IN (10, NULL)").rowCount,
  0,
);
assert.equal(q("SELECT * FROM table1 WHERE Sales IN (10, NULL)").rowCount, 1);
assert.equal(
  q(
    "SELECT * FROM table1 WHERE Region = 'South' OR Region = 'North' AND Sales > 12",
  ).rowCount,
  3,
);
assert.equal(
  q(
    "SELECT * FROM table1 WHERE (Region = 'South' OR Region = 'North') AND Sales > 12",
  ).rowCount,
  2,
);
assert.equal(
  q("SELECT * FROM table1 WHERE Sales BETWEEN 10 AND 15").rowCount,
  2,
);
assert.equal(
  q("SELECT * FROM table1 WHERE Name LIKE '%en' AND Sales IS NOT NULL")
    .rowCount,
  2,
);
assert.equal(q("SELECT * FROM table1 WHERE Name NOT LIKE '%en'").rowCount, 1);
assert.equal(q("SELECT * FROM table1 WHERE Name = 'O''Brien'").rowCount, 1);
assert.equal(
  q("SELECT * FROM table1 WHERE Name = ?", ["x' OR 1=1 --"]).rowCount,
  0,
);
assert.equal(
  q("SELECT * FROM table1 -- comment\n WHERE Sales <> 10 /*ok*/;").rowCount,
  2,
);
assert.deepEqual(
  q("SELECT Sales FROM table1 ORDER BY Sales DESC LIMIT 2 OFFSET 1").rows,
  [[15], [10]],
);
assert.equal(q("SELECT * FROM table1 LIMIT 0").rowCount, 0);
assert.deepEqual(
  q(
    "SELECT SUM(Sales), AVG(Sales), MIN(Sales), COUNT(*) FROM table1 WHERE Sales > 100",
  ).rows,
  [[null, null, null, 0]],
);
assert.equal(
  q("SELECT Region, COUNT(*) FROM table1 WHERE Sales > 100 GROUP BY Region")
    .rowCount,
  0,
);
assert.deepEqual(
  q("SELECT DISTINCT Region FROM table1")
    .drill(1)
    .map((e) => e.row),
  [2, 4],
);
assert.deepEqual(q("SELECT COUNT(*) FROM table1 HAVING COUNT(*) > 2").rows, [
  [4],
]);
assert.deepEqual(
  q("SELECT Region FROM table1 GROUP BY Region ORDER BY SUM(Sales) DESC").rows,
  [["North"], ["South"]],
);
assert.deepEqual(
  q("SELECT Sales AS Region FROM table1 ORDER BY Region DESC LIMIT 1").rows,
  [[20]],
);
assert.equal(api.tables()[0].id, "table1");
grid.setColumnFilter(0, ["North"]);
assert.equal(q("SELECT * FROM table1").rowCount, 4);
assert.equal(q("SELECT * FROM table1", [], { scope: "visible" }).rowCount, 2);
assert.equal(
  q("SELECT * FROM table1", [], {
    scope: "selection",
    selection: { r1: 3, r2: 2, c1: 0, c2: 1 },
  }).rowCount,
  2,
);
assert.deepEqual(grid.getComputedValue(1, 1), 10);
grid.clearFilters();
grid.setCell(1, 1, 100);
assert.equal(q("SELECT SUM(Sales) FROM table1").rows[0][0], 225);
assert.equal(result.rows[0][1], 25); // snapshots remain stable

const fake = (rows) => ({
  listTables: () => [
    {
      id: "table1",
      name: "Sales data",
      headerRow: 0,
      r2: rows.length - 1,
      c1: 0,
      c2: rows[0].length - 1,
    },
  ],
  getComputedValue: (r, c) => rows[r][c],
  hiddenRows: new Set(),
  filteredRows: new Set(),
});
const precise = fake([
  ["Region", "Sales"],
  ["A", 9007199254740993n],
  ["B", DecimalValue.parse("0.1")],
  ["B", DecimalValue.parse("0.2")],
]);
result = queryTables(precise, "SELECT SUM(Sales) FROM table1");
assert.equal(String(result.rows[0][0]), "9007199254740993.3");
assert.equal(
  queryTables(precise, "SELECT * FROM table1 WHERE Sales > 9007199254740992")
    .rowCount,
  1,
);
assert.equal(
  String(
    queryTables(precise, "SELECT SUM(Sales) FROM table1 WHERE Sales < 1")
      .rows[0][0],
  ),
  "0.3",
);
assert.deepEqual(
  queryTables(
    fake([["x"], [1], [1n], [DecimalValue.parse("1")], ["1"]]),
    "SELECT x, COUNT(*) FROM table1 GROUP BY x",
  ).rows,
  [
    [1, 3],
    ["1", 1],
  ],
);
assert.deepEqual(
  queryTables(fake([['a"b'], [42]]), 'SELECT "a""b" FROM table1').rows,
  [[42]],
);
assert.deepEqual(
  queryTables(fake([["x"], ["😀X"]]), "SELECT * FROM table1 WHERE x LIKE '_X'")
    .rows,
  [["😀X"]],
);
for (const sql of [
  "DELETE FROM table1",
  "SELECT * FROM table1; SELECT * FROM table1",
  "SELECT missing FROM table1",
  "SELECT * FROM missing",
  "SELECT SUM(Sales), Region FROM table1",
  "SELECT * FROM table1 GROUP BY Region",
  "SELECT * FROM table1 WHERE SUM(Sales) > 1",
  "SELECT * FROM table1 HAVING Sales > 1",
  "SELECT * FROM table1 JOIN table2 ON 1=1",
  "SELECT * FROM table1 LIMIT -1",
  "SELECT Sales, Sales FROM table1",
  "SELECT COUNT(DISTINCT *) FROM table1",
  "SELECT * FROM table1 ORDER BY 0",
  "SELECT * FROM table1 ORDER BY 99",
  "SELECT SUM(missing) FROM table1 WHERE Sales > 999",
  "SELECT * FROM table1 WHERE Region = 'unclosed",
  "SELECT * FROM table1 /* unclosed",
  "SELECT ABS(Sales) FROM table1",
  "SELECT DISTINCT Region FROM table1 ORDER BY Sales",
])
  assert.throws(() => q(sql), undefined, sql);
assert.throws(() => q("SELECT * FROM table1 WHERE Sales > ?"), /Missing/);
assert.throws(() => q("SELECT * FROM table1", [1]), /Unused/);
assert.throws(() => q("SELECT * FROM table1", [], { scope: "bad" }), /scope/);
assert.throws(
  () =>
    queryTables(
      fake([
        ["x", "X"],
        [1, 2],
      ]),
      "SELECT x FROM table1",
    ),
  /Ambiguous/,
);
assert.throws(
  () =>
    queryTables(
      fake([["x"], [new FormulaError("#DIV/0!")]]),
      "SELECT SUM(x) FROM table1",
    ),
  /SQL source/,
);
assert.throws(
  () => queryTables(fake([["x"], ["20"]]), "SELECT SUM(x) FROM table1"),
  /numeric/,
);
assert.throws(
  () => q("SELECT * FROM table1 WHERE Sales > '20'"),
  /matching types/,
);
assert.throws(
  () =>
    q(
      "SELECT * FROM table1 WHERE " +
        "(".repeat(65) +
        "Sales = 10" +
        ")".repeat(65),
    ),
  /nesting/,
);
console.log("Local SQL tests passed");

// Schema checks run on empty sources; table resolution is independent of the active table.
assert.throws(
  () => queryTables(fake([["x"]]), "SELECT missing FROM table1"),
  /Unknown/,
);
assert.deepEqual(
  queryTables(fake([["x"]]), "SELECT COUNT(*), SUM(x) FROM table1").rows,
  [[0, null]],
);
const multiple = fake([["x"], [42]]);
multiple.listTables = () => [
  { id: "table1", name: "Repeated", headerRow: 0, r2: 1, c1: 0, c2: 0 },
  { id: "table2", name: "Repeated", headerRow: 0, r2: 1, c1: 0, c2: 0 },
];
assert.deepEqual(queryTables(multiple, "SELECT x FROM table2").rows, [[42]]);
assert.throws(
  () => queryTables(multiple, "SELECT x FROM Repeated"),
  /Ambiguous/,
);
assert.throws(() => q("SELECT * FROM table1 OFFSET 0"), /requires LIMIT/);
assert.throws(
  () =>
    q("SELECT * FROM table1 WHERE " + "Name = 1 OR ".repeat(2000) + "Name = 1"),
  /tokens/,
);
const large = fake([["x"], ...Array.from({ length: 10001 }, (_, i) => [i])]);
assert.throws(() => queryTables(large, "SELECT * FROM table1"), /10,000/);
assert.equal(
  queryTables(large, "SELECT * FROM table1 LIMIT 100").rowCount,
  100,
);
assert.throws(
  () =>
    queryTables(
      fake([["x"], ["x".repeat(1000)]]),
      "SELECT * FROM table1 WHERE x LIKE '" + "%".repeat(1000) + "'",
    ),
  /work limit/,
);
assert.equal(q("SELECT 1 AS one FROM table1 WHERE Sales > 1000").rowCount, 0);
console.log("Local SQL schema and limit tests passed");
