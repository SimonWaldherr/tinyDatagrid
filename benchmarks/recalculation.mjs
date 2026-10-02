import { performance } from "node:perf_hooks";
import os from "node:os";
import { TinyDatagrid } from "../src/tinygrid.js";
class Model extends TinyDatagrid {
  build() {}
  bind() {}
  render() {}
  renderCells() {}
  layout() {}
  setLocale() {
    return this;
  }
  emit() {}
}
const report = {
  date: new Date().toISOString(),
  node: process.version,
  cpu: os.cpus()[0].model,
  scope:
    "Headless calculation; no DOM/layout. Each row: input A, TICK(A*2) in B, B+1 in C.",
  runs: [],
};
for (const rows of [10000, 50000]) {
  let calls = 0;
  const grid = new Model(
    {},
    {
      rows,
      columns: 3,
      historyLimit: 0,
      functions: {
        TICK: (n) => {
          calls++;
          return n;
        },
      },
    },
  );
  for (let r = 0; r < rows; r++) {
    grid.cells.set(`${r},0`, { raw: r });
    grid.cells.set(`${r},1`, { raw: `=TICK(A${r + 1}*2)` });
    grid.cells.set(`${r},2`, { raw: `=B${r + 1}+1` });
  }
  const evaluate = () => {
    for (let r = 0; r < rows; r++) grid.getComputedValue(r, 2);
  };
  let t = performance.now();
  evaluate();
  const coldMs = performance.now() - t;
  calls = 0;
  t = performance.now();
  grid.setCell(0, 0, 123);
  evaluate();
  const incrementalMs = performance.now() - t,
    incrementalCalls = calls;
  if (incrementalCalls !== 1 || grid.getComputedValue(0, 2) !== 247)
    throw new Error("Invalid incremental benchmark result");
  calls = 0;
  t = performance.now();
  grid.recalculate();
  evaluate();
  const fullMs = performance.now() - t,
    fullCalls = calls;
  if (fullCalls !== rows)
    throw new Error("Invalid full calculation benchmark result");
  grid.historyLimit = 100;
  calls = 0;
  t = performance.now();
  grid.setCell(0, 0, 124);
  evaluate();
  const withHistoryMs = performance.now() - t;
  report.runs.push({
    rows,
    cells: rows * 3,
    coldMs,
    incrementalMs,
    fullMs,
    incrementalCalls,
    fullCalls,
    withHistoryMs,
    historyPatches: grid.historyState.undo,
  });
}
console.log(JSON.stringify(report, null, 2));
