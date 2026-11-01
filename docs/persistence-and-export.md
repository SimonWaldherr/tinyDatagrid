# Saving and exporting large workbooks

The demo's Save and data-export actions use cooperative batches. They show
progress and offer Cancel; Escape also cancels an active export. Workbook files
store sparse cells, formulas and every worksheet. CSV/TSV/JSON/HTML/Markdown
describe a rectangle on the active sheet, including its empty cells.

## Asynchronous exports

```js
import { exportData } from "tiny-datagrid/exporters";
import {
  GridLimitError,
  WorkbookChangedError,
  gridLimits,
} from "tiny-datagrid";

const controller = new AbortController();
const blob = await exportData(grid, {
  format: "workbook", // csv, tsv, json, html, markdown
  signal: controller.signal,
  onProgress({ phase, completed, total }) {
    console.log(phase, completed, total);
  },
});
// controller.abort() rejects with AbortError; no partial download is returned.
```

`exportData` returns a UTF-8 Blob. It defaults to 5,000,000 cells and 64 MiB of
encoded output; set `maxCells` and `maxBytes` explicitly to change those budgets.
Workbook exports count stored cell records. Rectangular exports count every
coordinate, including blanks. CSV/TSV export raw inputs by default; the other
rectangular formats export computed values. Override this with `computed`.
JSON uses the first row as field names (`headerRow` can choose another row).

Rectangular exports read one row at a time without allocating a full matrix.
Workbook capture and JSON encoding yield between batches (`batchSize: 500` by
default). Progress phases are `snapshot`, `rows` and `encode`; `total` is absent
when the encoded byte count is not known yet. A capture that sees a workbook edit
rejects with `WorkbookChangedError`, code `WORKBOOK_CHANGED`. Retry after editing.
Once a workbook snapshot is detached, encoding it can continue while editing.

To obtain the detached object instead of a file:

```js
const workbook = await grid.exportWorkbookAsync({ signal: controller.signal });
```

The default is `computedValues: false`: retain formulas and literal values without
recalculating all formulas. Worksheet collections preserve every sheet in full,
including hidden sheets, tab colors and compact dimensions. Export does not switch
the active sheet or copy the undo stacks. Existing synchronous export methods
remain available, including their dense-range budget.

These APIs are cooperative main-thread operations. A large individual cell,
formula calculation or metadata object can still take synchronous time.
Snapshot storage, Blob chunks and IndexedDB structured cloning still need memory;
the output byte budget is not a whole-process memory cap. PNG/PDF keep their
separate rendering limits.

## Autosave and recovery

```js
import { installAutosave } from "tiny-datagrid/autosave";

const saving = await installAutosave(grid, {
  key: "invoice-42",
  delay: 500,
  maxWait: 5000,
  recoveryMaxBytes: 1024 * 1024,
  status: (state) => console.log(state),
});
if (saving.restored) saving.restoreDraft();
await saving.save();
console.log(saving.pending);
// Await save before dispose when a final flush is required.
```

Each pass takes one asynchronous snapshot and reuses it for recovery and
IndexedDB. Concurrent `save()` calls join the running pass. Edits during a write
cause a subsequent pass for the latest revision; an older write never reports the
new revision as saved. Continuous editing cannot postpone the first attempt past
`maxWait`. Each document needs its own key.

The localStorage recovery envelope is encoded asynchronously and capped at
`recoveryMaxBytes` (default 1 MiB; 0 disables it). Oversized recovery is skipped;
IndexedDB is still attempted. Status is `savedLocal` after a committed IndexedDB
write, `savedRecovery` when only the current recovery copy is available, and
`saveFailed` if neither saved the current revision. `savingLocal` marks work in
progress. Restoration compares timestamps so an old recovery copy does not replace
a newer durable save. Legacy recovery copies remain readable.

Draft text stays synchronous and separate. Leaving/backgrounding the page starts
a flush without serializing the complete live workbook synchronously. Browsers
can terminate unfinished asynchronous work; changes since the last completed save
may be lost. An outstanding unsaved revision requests the browser's normal leave
confirmation where supported. The demo header distinguishes recovery from a
durable save. Export remains the independent backup option.

The lower-level IndexedDB plugin serializes `save`, `load`, `restore` and `clear`.
`save(snapshot?)` can reuse a detached workbook; do not mutate a supplied snapshot
until the promise settles. Without one, it captures asynchronously on its queue
turn. `load()` returns `{ workbook, savedAt }` or `undefined` without importing it.
Persistence is per origin; quotas, eviction and multiple tabs remain host concerns.

## Coordinates, work budgets and types

`gridLimits` exposes the shared 10,000,000-row and 32,768-column address space.
SQL destinations, growth and rule-range parsing use those same coordinates.
Whole-column rules extend through the last supported row. Existing saved rules
keep their explicit bounds. SQL result tables retain their 500,000-cell work
budget, independently of where the result is placed. Materialized range APIs
default to `maxRangeCells: 1_000_000`; streaming exports have their own budgets.

`GridLimitError` extends `RangeError`, with `code`, `limit` and `actual`. Codes are
`GRID_ROWS`, `GRID_COLUMNS`, `RANGE_CELLS`, `EXPORT_CELLS`, `EXPORT_BYTES` and
`SQL_RESULT_CELLS`. Formula evaluation still exposes errors such as `#NUM!`.

Constructor options and public grid methods are now checked explicitly by
TypeScript. Misspelled options or methods no longer fall through to an index
signature. Custom plugins can extend `TinyDatagridOptions` and `TinyDatagrid`
through TypeScript module augmentation. Workbook dimensions, async options,
progress and storage results have named types. Function callbacks and extensible
workbook metadata retain their existing flexibility.
