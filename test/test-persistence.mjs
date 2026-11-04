import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import TinyDatagrid from "../src/tinygrid.js";
import { installAutosave } from "../src/autosave.js";

const { window, document } = parseHTML("<html><body></body></html>");
Object.assign(globalThis, {
  window,
  document,
  CustomEvent: window.CustomEvent,
});
let activeElement = null;
Object.defineProperty(document, "activeElement", { get: () => activeElement });
const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
class Model extends TinyDatagrid {
  build() {
    this.editor = document.createElement("textarea");
    this.el.append(this.editor);
  }
  bind() {}
  layout() {}
  render() {}
  renderCells() {}
  setLocale() {
    return this;
  }
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function until(condition) {
  const deadline = Date.now() + 2000;
  while (!condition()) {
    assert.ok(Date.now() < deadline, "asynchronous operation did not finish");
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}
function fixture({
  load = async () => undefined,
  write = async () => true,
} = {}) {
  const grid = new Model(document.createElement("div"), {
    rows: 5,
    columns: 2,
  });
  grid.setCell(0, 0, "initial");
  const use = grid.use;
  const snapshots = [];
  let captures = 0;
  grid.use = function (plugin) {
    use.call(this, plugin);
    if (plugin.name === "indexedDB")
      Object.assign(this.feature("indexedDB"), {
        load,
        async save(snapshot) {
          snapshots.push(snapshot);
          return write(snapshot, snapshots.length);
        },
      });
    return this;
  };
  const capture = grid.exportWorkbookAsync;
  grid.exportWorkbookAsync = function (options) {
    captures++;
    return capture.call(this, options);
  };
  grid.exportWorkbook = () => {
    throw new Error("unexpected synchronous full export");
  };
  return {
    grid,
    snapshots,
    get captures() {
      return captures;
    },
  };
}

// Concurrent callers join one save. Edits during its write produce one latest snapshot.
values.clear();
const firstWrite = deferred(),
  states = [];
const serial = fixture({
  write: async (_, n) => {
    if (n === 1) await firstWrite.promise;
  },
});
const api = await installAutosave(serial.grid, {
  key: "serial",
  delay: 1000,
  status: (state) => states.push(state),
});
serial.grid.setCell(0, 0, "first");
const a = api.save(),
  b = api.save();
assert.equal(a, b);
await until(() => serial.snapshots.length === 1);
serial.grid.setCell(0, 0, "latest");
assert.equal(api.pending, true);
assert.equal(api.save(), a);
firstWrite.resolve();
await a;
assert.equal(serial.snapshots.length, 2);
assert.equal(
  serial.captures,
  2,
  "one live snapshot per write, reused for recovery",
);
assert.equal(serial.snapshots[1].cells[0].value, "latest");
assert.equal(states.filter((s) => s === "savedLocal").length, 1);
assert.equal(api.pending, false);
assert.equal(values.has("serial:recovery"), false);
await api.save();
assert.equal(serial.captures, 2);
api.dispose();

// A bounded fallback is distinguished from a committed IndexedDB write.
const fallback = fixture({
  write: async () => {
    throw new Error("unavailable");
  },
});
const fallbackStates = [];
const recovery = await installAutosave(fallback.grid, {
  key: "fallback",
  status: (state) => fallbackStates.push(state),
});
fallback.grid.setCell(0, 0, "small");
await recovery.save();
assert.equal(fallbackStates.at(-1), "savedRecovery");
assert.equal(recovery.pending, false);
assert.equal(
  JSON.parse(values.get("fallback:recovery")).workbook.cells[0].value,
  "small",
);
recovery.dispose();
const restored = fixture();
const restoredAPI = await installAutosave(restored.grid, { key: "fallback" });
assert.equal(restoredAPI.restored, true);
assert.equal(restored.grid.getRawValue(0, 0), "small");
restoredAPI.dispose();

const large = fixture({
  write: async () => {
    throw new Error("quota");
  },
});
const largeStates = [];
const bounded = await installAutosave(large.grid, {
  key: "bounded",
  recoveryMaxBytes: 64,
  status: (state) => largeStates.push(state),
});
large.grid.setCell(0, 0, "x".repeat(1000));
await bounded.save();
assert.equal(values.has("bounded:recovery"), false);
assert.equal(largeStates.at(-1), "saveFailed");
assert.equal(bounded.pending, true);
const unload = new window.Event("beforeunload", { cancelable: true });
window.dispatchEvent(unload);
assert.equal(unload.defaultPrevented, true);
bounded.dispose();

// Recovery left behind by an older failed session must not replace a newer durable save.
const portable = (text) => ({
  format: "tinyDatagrid-workbook",
  version: 2,
  cells: [{ row: 0, col: 0, value: text }],
});
values.set(
  "newer:recovery",
  JSON.stringify({
    format: "tinyDatagrid-recovery",
    savedAt: "2026-11-01T10:00:00.000Z",
    workbook: portable("old"),
  }),
);
const newer = fixture({
  load: async () => ({
    workbook: portable("new"),
    savedAt: "2026-11-01T11:00:00.000Z",
  }),
});
const newerAPI = await installAutosave(newer.grid, { key: "newer" });
assert.equal(newer.grid.getRawValue(0, 0), "new");
assert.equal(values.has("newer:recovery"), false);
newerAPI.dispose();

// A recovery-only revision can be explicitly retried after IndexedDB becomes usable.
let unavailable = true;
const retry = fixture({
  write: async () => {
    if (unavailable) throw new Error("offline");
  },
});
const retryStates = [];
const retryAPI = await installAutosave(retry.grid, {
  key: "retry",
  status: (state) => retryStates.push(state),
});
retry.grid.setCell(0, 0, "retry me");
await retryAPI.save();
assert.equal(retryStates.at(-1), "savedRecovery");
unavailable = false;
await retryAPI.save();
assert.equal(retryStates.at(-1), "savedLocal");
assert.equal(retry.snapshots.length, 2);
assert.equal(values.has("retry:recovery"), false);
retryAPI.dispose();

// Continuous input cannot postpone saving indefinitely.
const busy = fixture();
const busyAPI = await installAutosave(busy.grid, {
  key: "busy",
  delay: 1000,
  maxWait: 20,
});
let i = 0;
const input = setInterval(() => busy.grid.setCell(0, 0, ++i), 2);
try {
  await until(() => busy.snapshots.length > 0);
} finally {
  clearInterval(input);
}
await busyAPI.save();
busyAPI.dispose();

// Edits made during asynchronous startup take precedence over stored data.
const editedLoad = deferred();
const edited = fixture({ load: () => editedLoad.promise });
const editedPending = installAutosave(edited.grid, { key: "edited-load" });
edited.grid.setCell(0, 0, "typed while loading");
const historyBeforeRestore = edited.grid.historyState.undo;
editedLoad.resolve({
  workbook: portable("old saved value"),
  savedAt: "2026-11-01T12:00:00.000Z",
});
const editedAPI = await editedPending;
assert.equal(editedAPI.restored, false);
assert.equal(edited.grid.getRawValue(0, 0), "typed while loading");
assert.equal(edited.grid.historyState.undo, historyBeforeRestore);
assert.equal(editedAPI.pending, true);
await editedAPI.save();
assert.equal(edited.snapshots[0].cells[0].value, "typed while loading");
editedAPI.dispose();

// Uncommitted editor text also takes precedence over a late workbook/draft restore.
values.set(
  "draft-load:draft",
  JSON.stringify({ row: 0, col: 0, value: "old draft" }),
);
const draftLoad = deferred();
const typing = fixture({ load: () => draftLoad.promise });
const typingPending = installAutosave(typing.grid, { key: "draft-load" });
typing.grid._editing = { row: 0, col: 0 };
typing.grid.editor.value = "new draft";
typing.grid.editor.dispatchEvent(new window.Event("input"));
draftLoad.resolve({
  workbook: portable("old saved value"),
  savedAt: "2026-11-01T12:00:00.000Z",
});
const typingAPI = await typingPending;
typingAPI.restoreDraft();
assert.equal(typingAPI.restored, false);
assert.equal(typing.grid.editor.value, "new draft");
assert.equal(JSON.parse(values.get("draft-load:draft")).value, "new draft");
typing.grid._editing = null;
typing.grid.editor.dispatchEvent(new window.Event("blur"));
await Promise.resolve();
assert.equal(
  values.has("draft-load:draft"),
  false,
  "discarded drafts are removed from local storage",
);
await typingAPI.save();
typingAPI.dispose();

// The first grid keystroke starts edit() without emitting an input event.
const firstKeyLoad = deferred();
const firstKey = fixture({ load: () => firstKeyLoad.promise });
const firstKeyPending = installAutosave(firstKey.grid, { key: "first-key" });
firstKey.grid._editing = { row: 0, col: 0 };
firstKey.grid.editor.value = "x";
firstKey.grid.el.dispatchEvent(new window.Event("keydown"));
firstKeyLoad.resolve({
  workbook: portable("old"),
  savedAt: "2026-11-01T12:00:00.000Z",
});
const firstKeyAPI = await firstKeyPending;
assert.equal(firstKeyAPI.restored, false);
assert.equal(firstKey.grid.editor.value, "x");
firstKeyAPI.dispose();

// A host formula bar can lose focus without cancelling its draft. Explicit
// cancellation erases both the stored draft and the captured restoration text.
values.set(
  "external-draft:draft",
  JSON.stringify({ row: 0, col: 0, value: "old draft" }),
);
const external = fixture();
const formula = document.createElement("textarea");
const externalAPI = await installAutosave(external.grid, {
  key: "external-draft",
  formula,
});
activeElement = formula;
formula.value = "still editing";
formula.dispatchEvent(new window.Event("input"));
let draftRestores = 0;
external.grid.edit = () => draftRestores++;
externalAPI.restoreDraft();
assert.equal(draftRestores, 0, "new input supersedes the startup draft");
assert.equal(
  JSON.parse(values.get("external-draft:draft")).value,
  "still editing",
);
activeElement = null;
formula.dispatchEvent(new window.Event("blur"));
await Promise.resolve();
assert.equal(
  JSON.parse(values.get("external-draft:draft")).value,
  "still editing",
);
externalAPI.clearDraft();
assert.equal(values.has("external-draft:draft"), false);
externalAPI.restoreDraft();
assert.equal(draftRestores, 0, "cancelled draft must not be restored");
assert.equal(values.has("external-draft:draft"), false);
externalAPI.dispose();

// Destruction while reading storage cannot restore data or install new hooks.
const loading = deferred();
const late = fixture({ load: () => loading.promise });
const pending = installAutosave(late.grid, { key: "late" });
late.grid.destroy();
loading.resolve({
  workbook: portable("late"),
  savedAt: "2026-11-01T12:00:00.000Z",
});
const lateAPI = await pending;
assert.equal(lateAPI.restored, false);
assert.equal(late.grid.getRawValue(0, 0), "initial");
assert.equal(late.grid.listeners.size, 0);
console.log(
  "Autosave: serialized writes, coalescing, bounded recovery, latest restoration, deadlines and disposal passed",
);
