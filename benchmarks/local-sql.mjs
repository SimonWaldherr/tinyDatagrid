import assert from "node:assert/strict";
import os from "node:os";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { queryTables } from "../src/local-sql.js";

// Headless SQL evaluation including source reading, projection and drill buckets.
// No DOM, formula recalculation or database/network latency is measured.
export function benchmarkSQL(query = queryTables) {
  const runs = [];
  for (const rows of [10000, 50000]) {
    const grid = {
      listTables: () => [
        {
          id: "table1",
          name: "Data",
          headerRow: 0,
          r2: rows,
          c1: 0,
          c2: 2,
        },
      ],
      getComputedValue: (r, c) =>
        r === 0
          ? ["id", "group", "value"][c]
          : c === 0
            ? r
            : c === 1
              ? r % 100
              : r % 256,
      hiddenRows: new Set(),
      filteredRows: new Set(),
    };
    const cases = [
      {
        name: "projection-limit",
        sql: "SELECT * FROM table1 LIMIT 50 OFFSET 100",
        verify: (result) => {
          assert.equal(result.rowCount, 50);
          assert.equal(result.rows[0][0], 101);
          assert.equal(result.drill(0)[0].row, 101);
        },
      },
      {
        name: "constant-in",
        sql: `SELECT COUNT(*) FROM table1 WHERE value IN (${Array.from({ length: 16 }, (_, i) => i).join(", ")})`,
        verify: (result) =>
          assert.equal(
            result.rows[0][0],
            Math.floor(rows / 256) * 16 + Math.min(rows % 256, 15),
          ),
      },
      {
        name: "repeated-aggregates",
        sql: `SELECT group, SUM(value) AS total, SUM(value) AS repeated,
          COUNT(value) AS filled, COUNT(value) AS counted
          FROM table1 GROUP BY group HAVING SUM(value) >= 0 ORDER BY SUM(value) DESC`,
        verify: (result) => {
          assert.equal(result.rowCount, 100);
          assert.ok(
            result.rows.every((row) => row[1] === row[2] && row[3] === row[4]),
          );
          assert.equal(
            result.rows.reduce((sum, row) => sum + row[3], 0),
            rows,
          );
        },
      },
    ];
    for (const scenario of cases) {
      scenario.verify(query(grid, scenario.sql));
      const times = [];
      for (let run = 0; run < 5; run++) {
        const start = performance.now();
        const result = query(grid, scenario.sql);
        times.push(performance.now() - start);
        scenario.verify(result);
      }
      times.sort((a, b) => a - b);
      runs.push({
        rows,
        query: scenario.name,
        medianMs: Number(times[2].toFixed(2)),
      });
    }
  }
  return {
    node: process.version,
    cpu: os.cpus()[0].model,
    scope: "Headless SQL, including source reading; median of 5 warm runs",
    runs,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(benchmarkSQL(), null, 2));
