import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import TinyDatagrid from "../src/tinygrid.js";
import { worksheets } from "../src/worksheets.js";
import { installSearch } from "../src/search-tools.js";
import { translator } from "../src/demo-i18n.js";

const { window, document } = parseHTML(`<html><body>
  <button id="findBtn"></button><div id="grid"></div>
  <form id="searchBar" hidden>
    <input id="search" aria-describedby="help"><output id="searchResult"></output>
    <button id="optCase" type="button" aria-pressed="false"></button>
    <button id="optWhole" type="button" aria-pressed="false"></button>
    <button id="optRegex" type="button" aria-pressed="false"></button>
    <button id="previousMatch" type="button"></button><button type="submit"></button>
    <button id="closeSearch" type="button"></button><button id="toggleReplace" type="button"></button>
    <div id="replaceRow" hidden><input id="replaceText"><button id="replaceOne" type="button"></button><button id="replaceAll" type="button"></button></div>
  </form></body></html>`);
Object.assign(globalThis, {
  window,
  document,
  CustomEvent: window.CustomEvent,
});
let activeElement = null;
Object.defineProperty(document, "activeElement", { get: () => activeElement });
window.HTMLElement.prototype.focus = function () {
  activeElement = this;
};
window.HTMLInputElement.prototype.select = function () {};
class Model extends TinyDatagrid {
  build() {}
  bind() {}
  render() {}
  layout() {}
  renderCells() {}
  goTo(row, col) {
    this.lastTarget = { row, col };
  }
  setLocale(locale) {
    this.locale = locale;
    return this;
  }
}
const $ = (selector) => document.querySelector(selector);
const grid = new Model($("#grid"), {
  rows: 1300,
  columns: 1,
  plugins: [worksheets()],
});
grid.load([["Apple"], ["Apple"]]);
const sheets = grid.feature("worksheets"),
  first = sheets.activeId;
let language = "en";
const notices = [];
const options = {
  grid,
  $,
  t: (key) => translator(language)(key),
  language: () => language,
  notify: (message) => notices.push(message),
  selection: () => ({ r1: 0, r2: 0, c1: 0, c2: 0 }),
};
let api = installSearch(options);
$("#findBtn").focus();
api.open(true);
assert.equal(document.activeElement, $("#search"));
$("#search").value = "Apple";
api.refresh(false);
assert.equal($("#searchResult").textContent, "2 matches");
$("#previousMatch").click();
assert.deepEqual(
  grid.lastTarget,
  { row: 1, col: 0 },
  "previous starts at the last match",
);
api.refresh(false);
$("#replaceText").value = "Pear";
$("#replaceOne").click();
assert.equal(
  grid.getRawValue(0, 0),
  "Pear",
  "replace works immediately after opening",
);
assert.equal(notices.at(-1), "1 replacement · 1 cell");
grid.undo();
assert.equal($("#searchResult").textContent, "2 matches");

$("#optRegex").click();
$("#search").value = "(";
api.refresh();
assert.equal($("#search").getAttribute("aria-invalid"), "true");
assert.equal(
  $("#search").getAttribute("aria-describedby"),
  "help searchResult",
);
assert.equal($("#searchResult").getAttribute("role"), "status");
assert.equal($("#searchResult").getAttribute("aria-atomic"), "true");
assert.equal($("#replaceAll").disabled, true);
assert.equal($("#searchBar button[type=submit]").disabled, true);
const errorText = $("#searchResult").textContent;
$("#searchBar").dispatchEvent(new window.Event("submit", { cancelable: true }));
assert.equal(
  $("#searchResult").textContent,
  errorText,
  "navigation retains the error explanation",
);
$("#search").value = "Apple";
api.refresh();
assert.equal($("#search").getAttribute("aria-invalid"), "false");
const other = sheets.add("Other");
sheets.select(other);
assert.equal($("#searchResult").textContent, "0 matches");
assert.equal($("#replaceOne").disabled, true);
sheets.select(first);
assert.equal($("#searchResult").textContent, "2 matches");
api.close();
assert.equal(document.activeElement, $("#findBtn"));

grid.load(Array.from({ length: 1200 }, () => ["Apple"]));
api.open();
language = "de-DE";
api.refresh(false);
assert.equal($("#searchResult").textContent, "1.200 Treffer");
grid.importCSV("Apple", { replace: true, inferTypes: false });
for (const [locale, expected] of [
  ["en", "1 match"],
  ["fr", "1 résultat"],
  ["it", "1 risultato"],
  ["es", "1 resultado"],
  ["nl", "1 treffer"],
]) {
  language = locale;
  api.refresh(false);
  assert.equal($("#searchResult").textContent, expected);
}
api.dispose();
api.dispose();
const legacy = installSearch({
  ...options,
  t: (key) => ({ matches: "hits" })[key],
});
$("#search").value = "Apple";
legacy.refresh(false);
assert.equal(
  $("#searchResult").textContent,
  "1 hits",
  "legacy translators can omit new plural keys",
);
legacy.dispose();
const shortcut = () => {
  const event = new window.Event("keydown", {
    cancelable: true,
    bubbles: true,
  });
  Object.assign(event, { key: "f", ctrlKey: true });
  document.dispatchEvent(event);
  return event;
};
assert.equal(
  shortcut().defaultPrevented,
  false,
  "disposed tool releases browser shortcuts",
);
assert.equal($("#searchBar").hidden, true);
api = installSearch(options);
assert.equal(
  $("#search").getAttribute("aria-describedby"),
  "help searchResult",
);
assert.equal(shortcut().defaultPrevented, true);
grid.destroy();
assert.equal(
  shortcut().defaultPrevented,
  false,
  "grid destruction releases browser shortcuts",
);
assert.equal($("#searchBar").hidden, true);
assert.equal(grid.listeners.size, 0);
console.log(
  "Search UI: errors, status, focus, immediate replace, worksheet/history refresh, locale counts and disposal passed",
);
