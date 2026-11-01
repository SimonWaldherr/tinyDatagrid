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
    const file = path.resolve(
      root,
      "." + (route === "/demo/" ? "/demo/index.html" : route),
    );
    if (
      !file.startsWith(root) ||
      !["/src/", "/demo/"].some((prefix) => route.startsWith(prefix))
    )
      throw new Error("Invalid path");
    response.setHeader(
      "Content-Type",
      file.endsWith(".html")
        ? "text/html"
        : file.endsWith(".css")
          ? "text/css"
          : "text/javascript",
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
  const io = await page.evaluate(async () => {
    const { exportData } = await import("/src/exporters.js");
    const { installAutosave } = await import("/src/autosave.js");
    let yielded = false;
    setTimeout(() => {
      yielded = true;
    }, 0);
    const snapshot = await grid.exportWorkbookAsync({ batchSize: 1 });
    const cancel = new AbortController();
    let aborted = false;
    try {
      await exportData(grid, {
        signal: cancel.signal,
        batchSize: 1,
        onProgress() {
          cancel.abort();
        },
      });
    } catch (error) {
      aborted = error.name === "AbortError";
    }
    const saving = await installAutosave(grid, {
      key: "browser-regression",
      recoveryMaxBytes: 0,
    });
    grid.setCell(0, 0, 123);
    const first = saving.save(),
      joined = saving.save();
    await first;
    const stored = await grid.feature("indexedDB").load();
    const pending = saving.pending;
    saving.dispose();
    grid.setCell(0, 0, 999);
    const restored = await installAutosave(grid, { key: "browser-regression" });
    const restoredValue = grid.getRawValue(0, 0);
    const didRestore = restored.restored;
    restored.dispose();
    return {
      yielded,
      aborted,
      joined: first === joined,
      pending,
      restoredValue,
      didRestore,
      savedValue: stored.workbook.cells.find(
        (cell) => cell.row === 0 && cell.col === 0,
      ).value,
      compact: snapshot.dimensions.rowHeightOverrides.length === 0,
    };
  });
  assert.deepEqual(io, {
    yielded: true,
    aborted: true,
    joined: true,
    pending: false,
    restoredValue: 123,
    didRestore: true,
    savedValue: 123,
    compact: true,
  });

  // Exercise the demo's actual Save / export / cancel controls and downloaded bytes.
  await page.goto(`http://127.0.0.1:${server.address().port}/demo/`);
  await page.waitForFunction(() => !document.querySelector(".app").inert);
  await page.locator("#tab-file").click();
  await page.locator("#demoContents").selectOption("budget");
  await page.locator("#loadDemoBtn").click();
  await page.evaluate(async () => {
    const { default: Grid } = await import("/src/tinygrid.js");
    const read = Grid.prototype.getUsedRange;
    window.rangeReads = 0;
    window.restoreRangeReader = () => {
      Grid.prototype.getUsedRange = read;
    };
    Grid.prototype.getUsedRange = function (...args) {
      window.rangeReads++;
      return read.apply(this, args);
    };
  });
  const workbookDownload = page.waitForEvent("download");
  await page.locator("#fileSaveBtn").click();
  const downloaded = await workbookDownload;
  const file = JSON.parse(await readFile(await downloaded.path(), "utf8"));
  assert.equal(file.format, "tinyDatagrid-workbook");
  assert.ok(file.sheets[0].cells.length > 10);
  assert.equal(
    await page.evaluate(() => window.rangeReads),
    0,
    "Workbook Save must not scan a dense used range or settle every formula",
  );
  await page.evaluate(() => window.restoreRangeReader());
  await page.locator("#exportBtn").click();
  await page.locator("#exportFormat").selectOption("csv");
  const csvDownload = page.waitForEvent("download");
  await page.locator("#downloadBtn").click();
  const csv = await csvDownload;
  assert.ok(csv.suggestedFilename().endsWith(".csv"));
  assert.ok((await readFile(await csv.path(), "utf8")).includes("\r\n"));
  await page.locator("#exportBtn").click();
  await page.locator("#exportFormat").selectOption("workbook");
  await page.evaluate(() => {
    document.querySelector("#downloadBtn").click();
    document.querySelector("#cancelExportBtn").click();
  });
  await page.waitForFunction(
    () => !document.querySelector("#downloadBtn").disabled,
  );
  assert.match(
    await page.locator("#exportStatus").textContent(),
    /cancelled|abgebrochen/i,
  );
  if (process.env.TINYGRID_SCREENSHOT_PATH) {
    await page.screenshot({ path: process.env.TINYGRID_SCREENSHOT_PATH });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: process.env.TINYGRID_SCREENSHOT_PATH.replace(
        /\.png$/,
        "-mobile.png",
      ),
    });
    assert.ok(await page.locator("#downloadBtn").isVisible());
    assert.ok(await page.locator("#exportStatus").isVisible());
  }
  assert.deepEqual(errors, []);
  console.log(
    "Browser passed: large-grid geometry, editing/undo, asynchronous export/cancel, real IndexedDB save/restore and demo downloads",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
