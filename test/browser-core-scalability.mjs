// Optional real-browser regression. Install Playwright separately or provide its
// module path through TINYGRID_PLAYWRIGHT_PATH; no browser dependency is shipped.
import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const { chromium } = await import(
  process.env.TINYGRID_PLAYWRIGHT_PATH || "playwright"
);
const server = http.createServer(async (request, response) => {
  try {
    const route = new URL(request.url, "http://localhost").pathname;
    if (route === "/") {
      response.setHeader("Content-Type", "text/html");
      response.end(
        '<!doctype html><link rel="stylesheet" href="/src/tinygrid.css"><div id="grid" style="width:1000px;height:600px"></div>',
      );
      return;
    }
    const file = path.resolve(root, "." + route);
    if (!file.startsWith(root) || !route.startsWith("/src/"))
      throw new Error("Invalid path");
    response.setHeader(
      "Content-Type",
      file.endsWith(".css") ? "text/css" : "text/javascript",
    );
    response.end(await readFile(file));
  } catch {
    response.statusCode = 404;
    response.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.TINYGRID_BROWSER_CHANNEL
      ? { channel: process.env.TINYGRID_BROWSER_CHANNEL }
      : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 1200, height: 800 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(async () => {
    const { default: TinyDatagrid } = await import("/src/tinygrid.js");
    const { freezePanes } = await import("/src/features.js");
    window.grid = new TinyDatagrid("#grid", {
      rows: 10_000_000,
      columns: 32_768,
      columnWidth: 400,
      plugins: [freezePanes()],
    });
    grid.setCell(9_999_999, 32_767, "Last cell");
    grid.setFreezePanes({ rows: 1, columns: 1 });
    grid.goTo(9_999_999, 32_767);
  });
  const state = await page.evaluate(() => {
    const row = 9_999_999,
      col = 32_767,
      rect = grid.scroll.getBoundingClientRect();
    const x = grid._viewOffset(col, "columns"),
      y = grid._viewOffset(row, "rows");
    const hit = grid.getCellAtClient(rect.left + x + 5, rect.top + y + 5);
    const cell = grid.canvas.querySelector(
      `[data-row="${row}"][data-col="${col}"]`,
    );
    const cellRect = cell?.getBoundingClientRect();
    return {
      hit,
      rendered: cell?.textContent,
      x,
      y,
      cells: grid.canvas.querySelectorAll(".tg-cell").length,
      visible: Boolean(
        cellRect &&
        cellRect.left >= rect.left &&
        cellRect.top >= rect.top &&
        cellRect.right <= rect.right + 1 &&
        cellRect.bottom <= rect.bottom + 1,
      ),
      sparse: grid.rowHeights.overrides.size,
      width: grid._canvasWidth,
      height: grid._canvasHeight,
    };
  });
  assert.deepEqual(state.hit, { row: 9_999_999, col: 32_767 });
  assert.equal(state.rendered, "Last cell");
  assert.equal(state.visible, true, JSON.stringify(state));
  assert.ok(state.cells < 1000);
  assert.equal(state.sparse, 0);
  assert.equal(state.width, 8_000_000);
  assert.equal(state.height, 8_000_000);
  const movement = await page.evaluate(() => {
    const before = { x: grid._scrollX(), y: grid._scrollY() };
    const event = new WheelEvent("wheel", {
      deltaX: -20.25,
      deltaY: -28.5,
      cancelable: true,
    });
    grid.scroll.dispatchEvent(event);
    return {
      x: grid._scrollX() - before.x,
      y: grid._scrollY() - before.y,
      prevented: event.defaultPrevented,
    };
  });
  assert.equal(movement.x, -20.25);
  assert.equal(movement.y, -28.5);
  assert.equal(movement.prevented, true);
  await page.evaluate(() => {
    grid.goTo(0, 1);
    grid.setCell(0, 0, 2);
    grid.setCell(9_999_999, 0, 4);
    grid.setCell(0, 1, "=SUM(A1:A10000000)");
    grid.edit(0, 0, "5");
    grid.commitEdit();
  });
  assert.equal(await page.evaluate(() => grid.getComputedValue(0, 1)), 9);
  await page.evaluate(() => grid.undo());
  assert.equal(await page.evaluate(() => grid.getComputedValue(0, 1)), 6);
  await page.evaluate(() => grid.redo());
  assert.equal(await page.evaluate(() => grid.getComputedValue(0, 1)), 9);
  assert.deepEqual(errors, []);
  console.log(
    "Browser scalability passed: 10M rows/32768 columns, compressed scrolling, frozen panes, hit testing, editing and undo/redo",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
