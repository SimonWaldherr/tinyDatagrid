import assert from "node:assert/strict";
import { queryTables } from "../src/local-sql.js";
import { DecimalValue } from "../src/decimal-values.js";
import {
  CalendarDate,
  ClockTime,
  DurationValue,
} from "../src/temporal-values.js";

const source = (headers, rows) => ({
  listTables: () => [
    {
      id: "table1",
      name: "Data",
      headerRow: 0,
      r2: rows.length,
      c1: 0,
      c2: headers.length - 1,
      includeEmptyRows: true,
    },
  ],
  getComputedValue: (r, c) => (r === 0 ? headers[c] : rows[r - 1][c]),
  hiddenRows: new Set(),
  filteredRows: new Set(),
});
const grid = source(
  ["id", "value"],
  [
    [1, 2],
    [2, null],
    [3, 1],
    [4, null],
  ],
);
const q = (sql, params = []) => queryTables(grid, sql, params);

// Bound pagination follows the parameter order across all clauses.
assert.deepEqual(
  q(
    "SELECT id FROM table1 WHERE id >= ? ORDER BY id LIMIT ? OFFSET ?",
    [2, 2, 1],
  ).rows,
  [[3], [4]],
);
const page = q("SELECT id FROM table1 LIMIT ? OFFSET ?", [2, 1]);
assert.deepEqual(page.rows, [[2], [3]]);
assert.deepEqual(
  page.drill(0).map((e) => e.row),
  [2],
);
assert.deepEqual(q("SELECT id FROM table1 LIMIT 1 OFFSET 20").rows, []);
assert.deepEqual(q("SELECT COUNT(*) FROM table1 LIMIT ?", [0]).rows, []);
for (const invalid of [
  -1,
  0.5,
  NaN,
  Infinity,
  Number.MAX_SAFE_INTEGER + 1,
  "2",
  2n,
  null,
  true,
]) {
  assert.throws(
    () => q("SELECT id FROM table1 LIMIT ?", [invalid]),
    /nonnegative integer/,
  );
  assert.throws(
    () => q("SELECT id FROM table1 LIMIT 1 OFFSET ?", [invalid]),
    /nonnegative integer/,
  );
}
assert.throws(() => q("SELECT id FROM table1 LIMIT ?"), /Missing/);
assert.throws(() => q("SELECT id FROM table1 LIMIT ?", [1, 2]), /Unused/);
assert.throws(() => q("SELECT id FROM table1 OFFSET ?", [1]), /requires LIMIT/);
assert.throws(() => q("SELECT id FROM table1 LIMIT id"), /nonnegative integer/);

// NULL placement is independent of direction, with subsequent keys breaking ties.
for (const [direction, expected] of [
  ["ASC", [3, 1]],
  ["DESC", [1, 3]],
]) {
  for (const [placement, ids] of [
    ["FIRST", [4, 2, ...expected]],
    ["LAST", [...expected, 4, 2]],
  ]) {
    assert.deepEqual(
      q(
        `SELECT id FROM table1 ORDER BY value ${direction} NULLS ${placement}, id DESC`,
      ).rows.flat(),
      ids,
    );
  }
  assert.deepEqual(
    q(`SELECT id FROM table1 ORDER BY value ${direction}`).rows.flat(),
    [...expected, 2, 4],
  );
}
assert.throws(
  () => q("SELECT id FROM table1 ORDER BY value NULLS"),
  /Expected LAST/,
);
assert.throws(
  () => q("SELECT id FROM table1 ORDER BY value NULLS MIDDLE"),
  /Expected LAST/,
);
assert.deepEqual(
  q("SELECT value AS v FROM table1 ORDER BY v NULLS FIRST LIMIT 1").rows,
  [[null]],
);
assert.deepEqual(
  q(
    "SELECT DISTINCT value FROM table1 ORDER BY 1 NULLS FIRST LIMIT ? OFFSET ?",
    [2, 1],
  ).rows,
  [[1], [2]],
);
assert.deepEqual(
  q(
    "SELECT value, COUNT(*) AS n FROM table1 GROUP BY value ORDER BY value NULLS FIRST LIMIT 1",
  )
    .drill(0)
    .map((e) => e.row),
  [2, 4],
);

// Indexed IN preserves three-valued logic and numeric equality across types.
const numeric = source(
  ["x"],
  [[1], [1n], [DecimalValue.parse("1.0")], [2], ["1"], [null], [""]],
);
const inQuery = (items, params = [], not = false) =>
  queryTables(
    numeric,
    `SELECT x FROM table1 WHERE x ${not ? "NOT " : ""}IN (${items})`,
    params,
  );
assert.deepEqual(inQuery("1, 3, 4, 5, 6, 7, 8, NULL").rows, [
  [1],
  [1n],
  [DecimalValue.parse("1")],
]);
assert.deepEqual(inQuery("1, 3, 4, 5, 6, 7, 8, NULL", [], true).rows, []);
assert.deepEqual(inQuery("1, 3, 4, 5, 6, 7, 8, 9", [], true).rows, [
  [2],
  ["1"],
]);
assert.deepEqual(inQuery("'1', '', 3, 4, 5, 6, 7, 8").rows, [["1"]]);
assert.deepEqual(
  inQuery("?, ?, ?, ?, ?, ?, ?, ?", ["", 3, 4, 5, 6, 7, 8, 9], true).rows,
  [[1], [1n], [DecimalValue.parse("1")], [2], ["1"]],
);
assert.deepEqual(
  inQuery("?, ?, ?, ?, ?, ?, ?, ?", [1n, 3, 4, 5, 6, 7, 8, null]).rows,
  [[1], [1n], [DecimalValue.parse("1")]],
);
// A second execution rebuilds its index from the current parameters.
assert.deepEqual(
  inQuery("?, ?, ?, ?, ?, ?, ?, ?", [2, 3, 4, 5, 6, 7, 8, null]).rows,
  [[2]],
);
assert.equal(
  q("SELECT id FROM table1 WHERE '' IN ('', 2, 3, 4, 5, 6, 7, NULL)").rowCount,
  4,
);
assert.equal(
  q("SELECT id FROM table1 WHERE '' IN (1, 2, 3, 4, 5, 6, 7, NULL)").rowCount,
  0,
);
assert.deepEqual(q("SELECT id FROM table1 WHERE id IN (value, 99)").rows, []);

for (const value of [
  true,
  CalendarDate.parse("2026-10-04"),
  new Date("2026-10-04T12:00:00Z"),
  new ClockTime(60),
  new DurationValue(60),
]) {
  const clone =
    value instanceof CalendarDate
      ? CalendarDate.parse(value.calendarText())
      : value instanceof Date
        ? new Date(value.getTime())
        : value instanceof ClockTime
          ? new ClockTime(value.seconds)
          : value instanceof DurationValue
            ? new DurationValue(value.seconds)
            : value;
  assert.equal(
    queryTables(
      source(["x"], [[value]]),
      "SELECT x FROM table1 WHERE x IN (?, 2, 3, 4, 5, 6, 7, 8)",
      [clone],
    ).rowCount,
    1,
  );
}

// Cached aggregate inputs do not merge DISTINCT and ordinary aggregates or groups.
const grouped = source(
  ["g", "x"],
  [
    ["a", 1],
    ["a", 1n],
    ["a", 2],
    ["a", null],
    ["b", 8],
  ],
);
const groupedResult = queryTables(
  grouped,
  `
  SELECT g, SUM(x) AS total, SUM(DISTINCT x) AS uniqueTotal,
    COUNT(x) AS filled, COUNT(DISTINCT x) AS uniqueCount, AVG(x) AS mean
  FROM table1 GROUP BY g HAVING SUM(x) >= 4 ORDER BY SUM(x) DESC LIMIT ?
`,
  [1],
);
assert.deepEqual(groupedResult.rows, [["b", 8, 8, 1, 1, 8]]);
assert.deepEqual(
  groupedResult.drill(0).map((e) => e.row),
  [5],
);
assert.deepEqual(
  queryTables(
    grouped,
    `
  SELECT SUM(x), SUM(DISTINCT x), COUNT(x), COUNT(DISTINCT x)
  FROM table1 WHERE g = 'a' HAVING SUM(x) = 4 ORDER BY SUM(x)
`,
  ).rows,
  [[4, 3, 3, 2]],
);
assert.deepEqual(
  queryTables(
    source(["x"], []),
    "SELECT SUM(x) AS a, SUM(x) AS b FROM table1 HAVING SUM(x) IS NULL ORDER BY SUM(x)",
  ).rows,
  [[null, null]],
);

// Large constant lists and repeated aggregates fit within the existing work budget.
const manyRows = source(
  ["x"],
  Array.from({ length: 80000 }, (_, i) => [i % 256]),
);
const repeated = Array.from({ length: 80 }, (_, i) => `COUNT(x) AS n${i}`).join(
  ", ",
);
assert.deepEqual(queryTables(manyRows, `SELECT ${repeated} FROM table1`).rows, [
  Array(80).fill(80000),
]);
const longList = Array.from({ length: 256 }, (_, i) => i).join(", ");
assert.deepEqual(
  queryTables(manyRows, `SELECT COUNT(*) FROM table1 WHERE x IN (${longList})`)
    .rows,
  [[80000]],
);
assert.throws(
  () =>
    queryTables(
      manyRows,
      `SELECT COUNT(*) FROM table1 WHERE x IN (${Array(128).fill(999).join(", ")}, x)`,
    ),
  /work limit/,
);
// DISTINCT can merge large grouped drill buckets without spreading function arguments.
const largeGroups = source(
  ["x"],
  Array.from({ length: 300000 }, (_, i) => [i % 2]),
);
const merged = queryTables(
  largeGroups,
  "SELECT DISTINCT COUNT(*) FROM table1 GROUP BY x",
);
assert.deepEqual(merged.rows, [[150000]]);
assert.equal(merged.drill(0).length, 300000);
console.log("SQL pagination, NULL ordering and optimization tests passed");
