import { positiveInteger } from "./limits.js";

export class WorkbookChangedError extends Error {
  constructor() {
    super("Workbook changed during export; retry the export.");
    this.name = "WorkbookChangedError";
    this.code = "WORKBOOK_CHANGED";
  }
}

/** Yield between batches; never return a snapshot assembled across edits. */
export function asyncTask(grid, { signal, batchSize = 500, onProgress } = {}) {
  positiveInteger(batchSize, "batchSize");
  let changed = false;
  const off = ["mutation", "worksheet", "externalvariables"].map((name) =>
    grid.on(name, () => {
      changed = true;
    }),
  );
  const check = () => {
    signal?.throwIfAborted();
    if (grid._destroyed) throw new DOMException("Grid destroyed", "AbortError");
    if (changed) throw new WorkbookChangedError();
  };
  return {
    batchSize,
    check,
    report(progress) {
      check();
      onProgress?.(progress);
      check();
    },
    async yield(progress) {
      this.report(progress);
      await new Promise((resolve) => setTimeout(resolve, 0));
      check();
    },
    dispose() {
      off.forEach((unsubscribe) => unsubscribe());
    },
  };
}
