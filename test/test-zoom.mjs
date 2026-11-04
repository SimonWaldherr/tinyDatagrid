import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import TinyDatagrid from "../src/tinygrid.js";
const { window, document } = parseHTML(
  "<html><body><div id='grid'></div></body></html>",
);
Object.assign(globalThis, {
  window,
  document,
  CustomEvent: window.CustomEvent,
});
class View extends TinyDatagrid {
  bind() {}
  render() {}
  layout() {}
  scrollToCell() {}
}
const grid = new View(document.querySelector("#grid"), {
  rows: 4,
  columns: 3,
  zoom: 150,
});
assert.equal(grid.zoom, 150);
assert.equal(grid.viewport.style.getPropertyValue("--tg-zoom"), "1.5");
grid.cells.set("0,0", { raw: 42 });
const before = grid.exportWorkbook({ computedValues: false }),
  history = grid.historyState;
const changes = [];
grid.on("zoom", (event) => changes.push(event.percent));
for (const percent of [25, 50, 100, 200, 400]) {
  assert.equal(grid.setZoom(percent), grid);
  assert.equal(grid.zoom, percent);
  assert.deepEqual(grid.exportWorkbook({ computedValues: false }), before);
  assert.deepEqual(grid.historyState, history);
  assert.equal(
    grid.contextMenu.parentElement,
    grid.el,
    "menus remain outside magnification",
  );
  assert.equal(
    grid.editor.parentElement,
    grid.viewport,
    "editor follows cell magnification",
  );
}
assert.deepEqual(changes, [25, 50, 100, 200, 400]);
for (const invalid of [0, 24, 401, NaN, Infinity, "200"])
  assert.throws(() => grid.setZoom(invalid), RangeError);
assert.equal(grid.zoom, 400);
grid.setZoom(100);
globalThis.CSS = { supports: () => false };
assert.throws(() => grid.setZoom(200), /does not support/);
assert.equal(grid.zoom, 100, "unsupported zoom cannot corrupt pointer scaling");
delete globalThis.CSS;
grid.setZoom(200);
grid.colOffsets = [0, 110, 220, 330];
grid.rowOffsets = [0, 28, 56, 84, 112];
grid.displayColWidths = [110, 110, 110];
grid.displayRowHeights = [28, 28, 28, 28];
grid._scrollX = () => 0;
grid._scrollY = () => 0;
Object.defineProperties(grid.scroll, {
  clientWidth: { value: 300 },
  clientHeight: { value: 150 },
  offsetLeft: { value: 104 },
  offsetTop: { value: 56 },
});
grid.updateSelectionOverlay();
assert.equal(
  grid.selectionEl.style.left,
  "52px",
  "Safari-scaled offsetLeft must not shift the selection",
);
assert.equal(grid.selectionEl.style.top, "28px");
grid._editing = { row: 1, col: 1 };
grid.updateSelectionOverlay();
assert.equal(grid.editor.style.left, "162px");
assert.equal(grid.editor.style.top, "56px");
grid._editing = null;
const geometry = {
  zoom: 200,
  scroll: { getBoundingClientRect: () => ({ left: 104, top: 56 }) },
  colOffsets: [0, 110, 220, 330],
  rowOffsets: [0, 28, 56, 84],
  _frozenCounts: () => ({ rows: 0, columns: 0 }),
  _scrollX: () => 0,
  _scrollY: () => 0,
};
assert.deepEqual(
  TinyDatagrid.prototype.getCellAtClient.call(
    geometry,
    104 + 220 + 10,
    56 + 56 + 10,
  ),
  { row: 1, col: 1 },
);
geometry.zoom = 50;
assert.deepEqual(
  TinyDatagrid.prototype.getCellAtClient.call(
    geometry,
    104 + 55 + 1,
    56 + 14 + 1,
  ),
  { row: 1, col: 1 },
);
geometry.zoom = 200;
geometry._frozenCounts = () => ({ rows: 1, columns: 1 });
geometry._scrollX = () => 110;
geometry._scrollY = () => 28;
assert.deepEqual(
  TinyDatagrid.prototype.getCellAtClient.call(geometry, 104 + 20, 56 + 20),
  { row: 0, col: 0 },
);
assert.deepEqual(
  TinyDatagrid.prototype.getCellAtClient.call(geometry, 104 + 230, 56 + 66),
  { row: 2, col: 2 },
);
grid.destroy();
console.log(
  "Sheet zoom: bounds, view-only state, menu/editor placement and scaled/frozen pointer coordinates passed",
);
