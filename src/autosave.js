import { indexedDBStorage } from "./indexeddb.js";
import { workbookBlob } from "./async-export.js";

// One snapshot per save, one writer, and a bounded recovery copy. Drafts stay small
// and synchronous; pagehide never serializes the complete live workbook.
export async function installAutosave(
  grid,
  {
    formula = grid.editor,
    status: report = () => {},
    key,
    database = "tinyDatagrid",
    delay = 500,
    maxWait = 5000,
    recoveryMaxBytes = 1024 * 1024,
  } = {},
) {
  if (typeof key !== "string" || !key)
    throw new TypeError("Autosave requires a nonempty document key");
  if (!Number.isFinite(delay) || delay < 0)
    throw new TypeError("Autosave delay must be nonnegative");
  if (!Number.isFinite(maxWait) || maxWait <= 0)
    throw new TypeError("Autosave maxWait must be positive");
  if (!Number.isSafeInteger(recoveryMaxBytes) || recoveryMaxBytes < 0)
    throw new TypeError("recoveryMaxBytes must be a nonnegative safe integer");
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
    deadline,
    running = null,
    controller = null,
    revision = 0,
    savedRevision = -1,
    durableRevision = -1,
    activeRevision = -1,
    restored = false,
    backupRevision = -1;
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
  let recovery, persisted;
  try {
    const raw = read(recoveryKey),
      parsed = raw && JSON.parse(raw);
    if (parsed)
      recovery =
        parsed.format === "tinyDatagrid-recovery"
          ? parsed
          : { workbook: parsed, savedAt: null };
  } catch {
    status("saveFailed");
  }
  try {
    persisted = await storage.load();
  } catch {
    /* Recovery may still be available. */
  }
  const recoveryFirst =
    recovery &&
    (!persisted || !recovery.savedAt || recovery.savedAt >= persisted.savedAt);
  for (const item of recoveryFirst
    ? [recovery, persisted]
    : [persisted, recovery]) {
    if (!item || disposed) continue;
    try {
      if (grid.importWorkbook(item.workbook, { replace: true }) === false)
        continue;
      grid.clearHistory();
      restored = true;
      savedRevision = 0;
      if (item === recovery) backupRevision = 0;
      else {
        durableRevision = 0;
        remove(recoveryKey);
      }
      status(item === recovery ? "savedRecovery" : "savedLocal");
      break;
    } catch {
      status("saveFailed");
    }
  }
  offPreparing();
  if (disposed)
    return {
      restored: false,
      pending: false,
      save,
      dispose() {},
      restoreDraft() {},
    };
  function clearTimers() {
    clearTimeout(timer);
    clearTimeout(deadline);
    timer = deadline = null;
  }
  function save(withBackup = true) {
    clearTimers();
    if (disposed) return Promise.resolve();
    if (running) return running;
    if (durableRevision === revision) return Promise.resolve();
    controller = new AbortController();
    running = (async () => {
      do {
        activeRevision = revision;
        const version = activeRevision;
        status("savingLocal");
        try {
          const workbook = await grid.exportWorkbookAsync({
            signal: controller.signal,
          });
          if (disposed) return;
          if (version !== revision) continue;
          if (withBackup && recoveryMaxBytes) {
            try {
              const blob = await workbookBlob(
                {
                  format: "tinyDatagrid-recovery",
                  savedAt: new Date().toISOString(),
                  workbook,
                },
                { maxBytes: recoveryMaxBytes, signal: controller.signal },
              );
              const text = await blob.text();
              if (disposed) return;
              if (version !== revision) continue;
              if (put(recoveryKey, text)) backupRevision = version;
            } catch (error) {
              if (error.name === "AbortError") return;
              // Recovery is optional and size bounded; IndexedDB is still tried.
            }
          }
          let failure;
          try {
            await storage.save(workbook);
          } catch (error) {
            failure = error;
          }
          if (disposed) return;
          if (version === revision) {
            if (!failure || backupRevision === version) {
              savedRevision = version;
              if (!failure) {
                durableRevision = version;
                remove(recoveryKey);
                backupRevision = -1;
              }
              status(failure ? "savedRecovery" : "savedLocal");
            } else status("saveFailed");
          }
        } catch (error) {
          if (disposed || error.name === "AbortError") return;
          if (error.code !== "WORKBOOK_CHANGED") {
            status("saveFailed");
            return;
          }
          // A cooperative capture saw an edit. Yield before taking the latest revision.
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      } while (!disposed && revision !== activeRevision);
    })().finally(() => {
      running = null;
      controller = null;
    });
    return running;
  }
  function changed() {
    if (disposed) return;
    revision++;
    remove(draftKey);
    status("savingLocal");
    clearTimeout(timer);
    timer = setTimeout(() => void save(), delay);
    deadline ??= setTimeout(() => void save(), maxWait);
  }
  const offs = ["mutation", "history", "worksheet", "externalvariables"].map(
    (event) => grid.on(event, changed),
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
    if (revision > savedRevision) void save();
  }
  const beforeUnload = (event) => {
    if (revision > 0 && revision > savedRevision) {
      event.preventDefault();
      event.returnValue = "";
    }
  };
  window.addEventListener("beforeunload", beforeUnload);
  window.addEventListener("pagehide", flush);
  const visibility = () => {
    if (document.visibilityState === "hidden") flush();
  };
  document.addEventListener("visibilitychange", visibility);
  function dispose() {
    if (disposed) return;
    disposed = true;
    clearTimers();
    controller?.abort();
    offs.forEach((off) => off());
    grid.editor.removeEventListener("input", draft);
    if (formula !== grid.editor) formula.removeEventListener("input", draft);
    grid.el.removeEventListener("keydown", keydown);
    window.removeEventListener("pagehide", flush);
    window.removeEventListener("beforeunload", beforeUnload);
    document.removeEventListener("visibilitychange", visibility);
    if (grid.feature("indexedDB") === storage) grid.removePlugin("indexedDB");
  }
  offs.push(grid.on("destroy", dispose));
  const savedDraft = read(draftKey);
  return {
    restored,
    get pending() {
      return revision > 0 && revision > savedRevision;
    },
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
