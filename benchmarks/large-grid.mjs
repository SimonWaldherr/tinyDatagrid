import { performance } from "node:perf_hooks";
import os from "node:os";
import assert from "node:assert/strict";
import { TinyDatagrid } from "../src/tinygrid.js";
class Model extends TinyDatagrid {
  build() {
    this.scroll = {
      scrollTop: 0,
      scrollLeft: 0,
      clientHeight: 700,
      clientWidth: 1100,
    };
    this.canvas = { style: {} };
    this.el.setAttribute = () => {};
  }
  bind() {}
  setLocale() {
    return this;
  }
  emit() {}
  renderHeaders() {}
  renderCells() {}
  syncHeaders() {}
  updateSelectionOverlay() {}
}
const t = performance.now(),
  grid = new Model(
    {},
    { rows: 2000000, columns: 100, virtualization: true, historyLimit: 0 },
  );
const initMs = performance.now() - t;
let start = performance.now();
grid.layout();
const layoutMs = performance.now() - start;
start = performance.now();
for (let i = 0; i < 5; i++) grid.layout();
const repeatLayoutMs = (performance.now() - start) / 5;
// A deterministic dense source without allocating 200 million JS cell objects.
const source = (r, c) => r * 100 + c;
let checksum = 0n;
start = performance.now();
for (let r = 0; r < 2000000; r++) {
  let sum = 0;
  for (let c = 0; c < 100; c++) sum += source(r, c);
  checksum += BigInt(sum);
}
const denseScanMs = performance.now() - start;
assert.equal(checksum, 19999999900000000n);
for (let r = 0; r < 2000000; r += 100)
  for (let c = 0; c < 100; c += 10)
    grid.cells.set(`${r},${c}`, { raw: source(r, c) });
start = performance.now();
grid.setCell(1999999, 99, "=A1999901+1");
assert.equal(grid.getComputedValue(1999999, 99), 199990001);
const editMs = performance.now() - start;
grid.historyLimit = 10;
start = performance.now();
grid.setCell(0, 0, 123);
const historyEditMs = performance.now() - start;
assert.ok(grid.canUndo);
grid.undo();
assert.equal(grid.getRawValue(0, 0), 0);
grid.scrollToCell(1999999, 99);
assert.ok(Math.abs(grid._scrollY() - (56000000 - 700)) < 0.01);
assert.ok(grid.scroll.scrollTop <= 8000000);
const last = grid._visibleRange(
  grid.rowOffsets,
  grid.rowCount,
  grid.rowOffsets.at(-1) - 700,
  700,
  700,
);
assert.equal(last.end, 2000000);
assert.ok(last.end - last.start < 40);
console.log(
  JSON.stringify(
    {
      date: new Date().toISOString(),
      node: process.version,
      cpu: os.cpus()[0].model,
      rows: 2000000,
      columns: 100,
      logicalCells: 200000000,
      storedCells: grid.cells.size,
      scope:
        "Real model layout/edit with 200,000 stored cells; all 200M dense source values scanned separately, not stored or evaluated as formulas; no DOM.",
      initMs,
      layoutMs,
      repeatLayoutMs,
      denseScanMs,
      editMs,
      historyEditMs,
      checksum: String(checksum),
      heapMB: process.memoryUsage().heapUsed / 1048576,
      rssMB: process.memoryUsage().rss / 1048576,
      arrayBuffersMB: process.memoryUsage().arrayBuffers / 1048576,
      canvasHeight: grid.canvas.style.height,
    },
    null,
    2,
  ),
);
