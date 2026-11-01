import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import TinyDatagrid from "tiny-datagrid";
import { worksheets } from "tiny-datagrid/worksheets";
import { localSQL } from "tiny-datagrid/local-sql";
import { analysisContext } from "tiny-datagrid/analysis";
import {
  installSQLTools,
  installAnalysisTools,
  installSimulations,
  installObjectBrowser,
  installAutosave,
  translator,
} from "tiny-datagrid/demo-tools";

// A real DOM tree for controls/events; dialog, canvas and focus APIs are browser
// boundaries and are stubbed here. This test does not assert visual rendering.
const { window, document } = parseHTML(
  '<html><body><button id="pivotBtn"></button>' +
    '<div class="dialog-heading"><span id="chartRange"></span></div>' +
    '<div id="analysisHelpHost"></div><div id="analysisScopeHost"></div>' +
    '<div id="pivotSecondaryActions"></div><div class="tools-grid"></div>' +
    '<select id="demoContents"></select><dialog id="inspector"></dialog>' +
    '<div id="sheetObjectList"></div><button id="inspector-objects-tab"></button></body></html>',
);
Object.assign(globalThis, {
  window,
  document,
  Event: window.Event,
  CustomEvent: window.CustomEvent,
});
let activeElement = null;
Object.defineProperty(document, "activeElement", { get: () => activeElement });
window.HTMLElement.prototype.focus = function () {
  activeElement = this;
};
// This DOM implementation incorrectly hyphenates digits in dataset.i18n.
Object.defineProperty(window.HTMLElement.prototype, "dataset", {
  get() {
    const element = this;
    const attribute = (key) =>
      "data-" + String(key).replace(/[A-Z]/g, (ch) => "-" + ch.toLowerCase());
    return new Proxy(
      {},
      {
        get: (_, key) => element.getAttribute(attribute(key)) ?? undefined,
        set: (_, key, value) => {
          element.setAttribute(attribute(key), value);
          return true;
        },
      },
    );
  },
});
window.HTMLElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
window.HTMLElement.prototype.close = function () {
  if (!this.hasAttribute("open")) return;
  this.removeAttribute("open");
  this.dispatchEvent(new window.Event("close"));
  this.onclose?.();
};
Object.defineProperty(window.HTMLSelectElement.prototype, "value", {
  get() {
    return (
      this.querySelector("option[selected]")?.value ??
      this.querySelector("option")?.value ??
      ""
    );
  },
  set(value) {
    for (const option of this.querySelectorAll("option"))
      option.toggleAttribute("selected", option.value === value);
  },
  configurable: true,
});
globalThis.Option = function (text, value) {
  const option = document.createElement("option");
  option.textContent = text;
  option.value = value;
  return option;
};
window.HTMLCanvasElement.prototype.getContext = () => ({
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  putImageData() {},
  strokeRect() {},
});
const stored = new Map();
globalThis.localStorage = {
  getItem: (key) => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, value),
  removeItem: (key) => stored.delete(key),
};
class Model extends TinyDatagrid {
  build() {
    this.scroll = document.createElement("div");
    this.editor = document.createElement("textarea");
    this.contextMenu = document.createElement("div");
    this.contextMenu.hidden = true;
    this.el.append(this.scroll, this.editor);
  }
  bind() {}
  renderCells() {}
  layout() {}
  updateSelectionOverlay() {}
  scrollToCell() {}
  setLocale(locale) {
    this.locale = locale;
    return this;
  }
  render() {
    this._updateFilteredRows();
    this.engine.settle();
  }
  edit(row, col, value) {
    this._editing = { row, col };
    this.editor.value = value;
  }
}
const grid = new Model(document.createElement("div"), {
  rows: 12,
  columns: 6,
  plugins: [worksheets(), localSQL(), analysisContext()],
});
document.body.append(grid.el);
grid.load([["x"], [1], [2]]);
grid.createTable({ r1: 0, c1: 0, r2: 2, c2: 0 });
const t = translator("en");
const host = {
  grid,
  $: (selector) => document.querySelector(selector),
  t,
  notify() {},
  selection: () => ({ r1: 1, r2: 2, c1: 0, c2: 0 }),
};
const listeners = () =>
  [...grid.listeners.values()].reduce((n, set) => n + set.size, 0);
const initialListeners = listeners();
let drilled = null;
const sql = installSQLTools({
  ...host,
  showSource: (data) => {
    drilled = data;
  },
});
assert.equal(
  document.querySelector("#localSQLTitle").textContent,
  t("localSQLTitle"),
);
sql.open("SELECT SUM(x) AS Total FROM table1");
assert.deepEqual(sql.execute().rows, [[3]]);
document.querySelector(".local-sql-results button").onclick();
assert.deepEqual(
  drilled.entries.map((entry) => entry.row),
  [1, 2],
);
sql.open("DELETE FROM table1");
assert.equal(sql.execute(), null);
assert.match(
  document.querySelector("#localSQLStatus").textContent,
  /Expected SELECT/,
);
sql.open("SELECT * FROM table1");
sql.execute();
grid.setReadOnly(true);
assert.equal(document.querySelector("#materializeLocalSQL").disabled, true);
grid.setReadOnly(false);
sql.dispose();
assert.equal(listeners(), initialListeners);
assert.equal(document.querySelector(".local-sql-dialog"), null);
assert.equal(document.querySelector("#localSQLBtn"), null);

const analysis = installAnalysisTools({ ...host, refresh() {} });
const data = { headers: ["x"], entries: [{ row: 1, record: { x: 1 } }] };
analysis.show(data, { r1: 0, r2: 2, c1: 0, c2: 0 });
assert.equal(
  document.querySelector(".analysis-details").hasAttribute("open"),
  true,
);
assert.equal(
  document.querySelector(".analysis-details td button").textContent,
  "2",
);
analysis.dispose();
assert.equal(listeners(), initialListeners);
assert.equal(document.querySelector("#analysisScope"), null);

const simulations = installSimulations(host);
assert.equal(document.querySelector("#demoContents").children.length, 2);
simulations.open("life");
assert.match(
  document.querySelector(".simulation-dialog output").textContent,
  /Generation 0/i,
);
document.querySelector('[data-action="step"]').onclick();
assert.match(
  document.querySelector(".simulation-dialog output").textContent,
  /Generation 1/i,
);
grid.setReadOnly(true);
assert.equal(document.querySelector('[data-action="insert"]').disabled, true);
grid.setReadOnly(false);
simulations.dispose();
assert.equal(listeners(), initialListeners);
assert.equal(document.querySelector(".simulation-dialog"), null);
assert.equal(document.querySelector("#demoContents").children.length, 0);

const objects = installObjectBrowser({ ...host, openChart() {} });
assert.equal(document.querySelectorAll(".sheet-object").length, 1);
objects.dispose();
assert.equal(listeners(), initialListeners);
assert.equal(document.querySelector("#sheetObjectList").children.length, 0);

// Recovery works even without IndexedDB; disposal stops all saving and draft hooks.
await assert.rejects(installAutosave(grid, { key: "" }), /document key/);
const statuses = [];
const autosave = await installAutosave(grid, {
  key: "doc",
  delay: 1000,
  status: (key) => statuses.push(key),
});
grid.emit("mutation", {});
await autosave.save();
assert.ok(stored.has("doc:recovery"));
assert.equal(statuses.at(-1), "savedLocal");
grid.edit(1, 0, "unfinished");
grid.editor.dispatchEvent(new window.Event("input"));
assert.equal(JSON.parse(stored.get("doc:draft")).value, "unfinished");
autosave.dispose();
assert.equal(listeners(), initialListeners);
assert.equal(grid.feature("indexedDB"), undefined);
const restored = await installAutosave(grid, { key: "doc" });
assert.equal(restored.restored, true);
restored.restoreDraft();
assert.equal(grid.editor.value, "unfinished");
restored.dispose();
assert.equal(listeners(), initialListeners);
const destroyed = installSQLTools({ ...host, showSource() {} });
grid.destroy();
assert.equal(document.querySelector(".local-sql-dialog"), null);
destroyed.dispose(); // repeated cleanup is safe
// Destruction during async restoration must not attach fresh listeners afterward.
const pendingGrid = new Model(document.createElement("div"), {
  rows: 2,
  columns: 2,
});
const lateStatuses = [];
const pendingSaving = installAutosave(pendingGrid, {
  key: "pending",
  status: (key) => lateStatuses.push(key),
});
pendingGrid.destroy();
const pendingAutosave = await pendingSaving;
await pendingAutosave.save();
assert.equal(pendingGrid.listeners.size, 0);
assert.deepEqual(lateStatuses, []);
pendingAutosave.dispose();
console.log(
  "Public demo tools: SQL execution/drill, analysis, simulations, object browser, autosave recovery and disposal passed",
);
