import { indexedDBStorage } from "./indexeddb.js";

// IndexedDB stores the workbook. A synchronous recovery copy covers reloads
// before the asynchronous transaction finishes; a separate key keeps edit drafts.
export async function installAutosave(
  grid,
  {
    formula = grid.editor,
    status: report = () => {},
    key,
    database = "tinyDatagrid",
    delay = 150,
  } = {},
) {
  if (typeof key !== "string" || !key)
    throw new TypeError("Autosave requires a nonempty document key");
  if (!Number.isFinite(delay) || delay < 0)
    throw new TypeError("Autosave delay must be nonnegative");
  if (grid._destroyed) throw new Error("Autosave requires an active grid");
  let disposed = false;
  const status = (message) => {
    if (!disposed) report(message);
  };
  const recoveryKey = `${key}:recovery`,
    draftKey = `${key}:draft`;
  grid.use(indexedDBStorage({ key, database }));
  const storage = grid.feature("indexedDB");
  let timer,
    revision = 0,
    restored = false,
    backupAvailable = false;
  const offPreparing = grid.on("destroy", () => {
    disposed = true;
  });
  const read = (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  };
  const remove = (name) => {
    try {
      localStorage.removeItem(name);
    } catch {}
  };
  const put = (name, value) => {
    try {
      localStorage.setItem(name, value);
      return true;
    } catch {
      return false;
    }
  };
  const recovery = read(recoveryKey);
  if (recovery) {
    try {
      grid.importWorkbook(JSON.parse(recovery), { replace: true });
      grid.clearHistory();
      restored = true;
      backupAvailable = true;
    } catch {
      status("saveFailed");
    }
  }
  if (!restored) {
    try {
      restored = await storage.restore();
    } catch {
      status("saveFailed");
    }
  }
  offPreparing();
  if (disposed)
    return { restored: false, save, dispose() {}, restoreDraft() {} };
  function backup() {
    try {
      backupAvailable = put(
        recoveryKey,
        JSON.stringify(grid.exportWorkbook({ computedValues: false })),
      );
      return backupAvailable;
    } catch {
      return false;
    }
  }
  async function save(withBackup = true) {
    if (disposed) return;
    clearTimeout(timer);
    const version = revision;
    status("savingLocal");
    if (withBackup) backup();
    try {
      await storage.save();
      if (disposed) return;
      if (version === revision) {
        remove(recoveryKey);
        backupAvailable = false;
        status("savedLocal");
      }
    } catch {
      status(backupAvailable ? "savedLocal" : "saveFailed");
    }
  }
  function changed() {
    if (disposed) return;
    revision++;
    remove(draftKey);
    status("savingLocal");
    clearTimeout(timer);
    timer = setTimeout(save, delay);
  }
  const offs = ["mutation", "history", "worksheet"].map((event) =>
    grid.on(event, changed),
  );
  function draft() {
    if (disposed) return;
    const editing = grid._editing;
    if (editing)
      put(
        draftKey,
        JSON.stringify({
          sheetId: grid.feature("worksheets")?.activeId,
          ...editing,
          value: grid.editor.value,
        }),
      );
    else if (document.activeElement === formula)
      put(
        draftKey,
        JSON.stringify({
          sheetId: grid.feature("worksheets")?.activeId,
          ...grid.anchor,
          value: formula.value,
        }),
      );
  }
  grid.editor.addEventListener("input", draft);
  if (formula !== grid.editor) formula.addEventListener("input", draft);
  // The first keystroke is inserted by edit(), before the editor's input event.
  const keydown = () => queueMicrotask(draft);
  grid.el.addEventListener("keydown", keydown);
  offs.push(
    grid.on("select", () => {
      if (!grid._editing && document.activeElement !== formula)
        remove(draftKey);
    }),
  );
  function flush() {
    draft();
    clearTimeout(timer);
    if (revision) {
      backup();
      void save(false);
    }
  }
  window.addEventListener("pagehide", flush);
  const visibility = () => {
    if (document.visibilityState === "hidden") flush();
  };
  document.addEventListener("visibilitychange", visibility);
  function dispose() {
    if (disposed) return;
    disposed = true;
    clearTimeout(timer);
    offs.forEach((off) => off());
    grid.editor.removeEventListener("input", draft);
    if (formula !== grid.editor) formula.removeEventListener("input", draft);
    grid.el.removeEventListener("keydown", keydown);
    window.removeEventListener("pagehide", flush);
    document.removeEventListener("visibilitychange", visibility);
    if (grid.feature("indexedDB") === storage) grid.removePlugin("indexedDB");
  }
  offs.push(grid.on("destroy", dispose));
  const savedDraft = read(draftKey);
  return {
    restored,
    save,
    dispose,
    restoreDraft() {
      if (disposed || !savedDraft) return;
      try {
        const item = JSON.parse(savedDraft);
        if (
          item.sheetId &&
          grid.feature("worksheets") &&
          item.sheetId !== grid.feature("worksheets").activeId
        ) {
          if (
            !grid
              .feature("worksheets")
              .list()
              .some((s) => s.id === item.sheetId)
          )
            return;
          grid.feature("worksheets").select(item.sheetId);
        }
        if (
          !Number.isInteger(item.row) ||
          !Number.isInteger(item.col) ||
          item.row < 0 ||
          item.col < 0 ||
          item.row >= grid.rowCount ||
          item.col >= grid.colCount ||
          typeof item.value !== "string"
        )
          return;
        grid.select(item.row, item.col);
        grid.edit(item.row, item.col, item.value);
        put(draftKey, savedDraft);
      } catch {
        status("saveFailed");
      }
    },
  };
}
