# Optional features

The core imports **no** worksheet or storage module. Applications choose plugins
per grid; workbook metadata cannot enable plugins or database access. Import
local files from `src/` when using the repository directly.

```js
import TinyDatagrid from 'tiny-datagrid';
import { freezePanes, conditionalFormatting, dataValidation } from 'tiny-datagrid/features';

const grid = new TinyDatagrid('#sheet', {
  virtualization: true,
  plugins: [freezePanes(), conditionalFormatting(), dataValidation()]
});
```

Omit any factory to disable its behavior. Metadata still survives workbook
export/import while the feature is disabled. Install later with `grid.use(plugin)`;
`grid.removePlugin(name)` disposes it and refreshes the view. Installing a name
twice throws. Custom plugins implement `{ name, setup(grid) }`; the returned API
is available via `grid.feature(name)` and may expose `destroy()` for cleanup.
`grid.destroy()` disposes all installed plugins. UI and persistence plugins are
independent of formula functions registered through `registerFunction`.

## Freeze panes

```js
grid.setFreezePanes({ rows: 1, columns: 2 }); // Leading rows/columns, zero unfreezes.
```

Install `freezePanes()` (name `freezePanes`) to activate it. Frozen cells and
headers stay visible when scrolling, also with virtualization enabled. Counts
include hidden rows/columns; hidden entries occupy no space. Editing, hit testing,
and keyboard scrolling account for the fixed areas. Keep frozen areas smaller
than the viewport to leave room for scrolling content.

## Conditional formatting

```js
grid.setConditionalFormats([{
  range: { r1: 1, c1: 2, r2: 100, c2: 2 },
  operator: 'lt', value: 0,
  style: { color: 'var(--tg-error)', backgroundColor: 'var(--tg-error-bg)' }
}]);
```

Install `conditionalFormatting()` (name `conditionalFormatting`). Rules use
zero-based inclusive ranges and computed cell values. Operators: `eq`, `ne`,
`gt`, `gte`, `lt`, `lte`, `between` (`value` and `max`, inclusive), `contains`,
`empty`, `notEmpty`. Equality is strict; ordered comparisons accept numeric
values/strings. Later matching rules override earlier style properties; set
`stopIfTrue: true` to stop after a match. Allowed styles are `color`,
`backgroundColor`, `fontWeight`, `fontStyle`, `textDecoration`, and `textAlign`.

Rules affect display only; they never overwrite a cell's stored style. Use
semantic CSS variables for light/dark themes. Rule edits support undo/redo and
workbook sharing. Formula-based rules, color scales, and icon sets are not
implemented in this first rule API.

## Data validation

```js
grid.setValidationRules([{
  range: { r1: 1, c1: 0, r2: 100, c2: 0 },
  type: 'integer', min: 0, max: 100,
  allowEmpty: false,
  message: 'Enter a whole number between 0 and 100.'
}]);
grid.on('validationerror', ({ row, col, value, message }) => showError(message));
```

Install `dataValidation()` (name `validation`). Rule types:

- `number` / `integer`: optional inclusive `min` and `max`.
- `textLength`: Unicode code-point count with optional `min` and `max`.
- `list`: `values: ['Open', 'Closed']` (compares scalar text representations).

Empty values are allowed unless `allowEmpty: false`. Rules validate **input**,
not results of future formula calculations. `allowFormula: true` explicitly
allows formula inputs without checking their result. Existing invalid cells are
marked visually and with `aria-invalid`; enabling rules does not erase them.

Invalid cell edits return `false` and emit `validationerror`. Bulk writes such
as paste/fill roll back the entire transaction if any write is invalid. Invalid
editor input stays open for correction. Clearing cells also obeys rules. UI
validation is not a replacement for server-side validation of SQL writes.
Structural operations/import replacement establish a new layout; they are not
row-level validation of a remote database. Inserting/deleting rows does not shift
rule ranges automatically: ranges remain absolute grid coordinates.

## Worksheets

```js
import { worksheets } from 'tiny-datagrid/worksheets';
grid.use(worksheets());
const sheets = grid.feature('worksheets');
const id = sheets.add('Forecast');
sheets.select(id);
sheets.rename(id, 'Forecast 2027');
console.log(sheets.list()); // [{ id, name }, ...]
// sheets.remove(id); // At least one sheet must remain.
```

Each sheet has its own cells, variables, rules, layout, selection, and undo/redo
stacks. The host renders tabs/selectors using `list()`, `activeId`, and the
`worksheet` event. Selecting a sheet is not an undoable edit; add/remove/rename
of inactive sheets are collection operations outside cell history.

With this plugin, `exportWorkbook()` and share links include **all sheets**;
collection export preserves full sheet data regardless of single-sheet export
options. Importing a collection replaces the collection and clears history.
Without this plugin, the core loads only the active sheet. Formulas currently
reference cells within their own sheet: cross-sheet references are not supported.
Switching during an open transaction or active SQL binding is rejected.
Removing the plugin leaves the currently selected sheet in the core grid.

## IndexedDB storage

```js
import { indexedDBStorage } from 'tiny-datagrid/indexeddb';
grid.use(indexedDBStorage({ key: 'invoice-123' }));
const storage = grid.feature('indexedDB');
await storage.save();
await storage.restore(); // false if no saved document exists
await storage.clear();
```

No database is opened on installation. The first explicit operation opens it.
The default database is `tinyDatagrid`; choose a `database` and unique `key` per
application/document. Storage stays in the browser's origin. It saves workbook
data, including rules and installed worksheet collections, but not history or
JavaScript function implementations.

Autosave is opt-in: `{ key: 'invoice-123', autoSave: true, delay: 500 }`.
It debounces completed mutations and serializes database operations. Restoration
is always explicit, so initial demo data cannot silently overwrite a saved file
through automatic loading. When using autosave, call `restore()` before starting
edits or seeding a new document. `storage` events report saved/restored/cleared
operations; `storageerror` reports autosave errors; `storageblocked` reports a
blocked database open. Explicit operations reject on failure. `clear()` cancels
a pending autosave; subsequent edits can save again.

Destroy/removal cancels pending debounce work and closes the connection; call
and await `save()` first when the host requires a final flush. Browser quotas,
private browsing restrictions, and eviction can affect persistence. The plugin
does not perform multi-tab conflict resolution or cloud synchronization.

## Incremental calculation and measurements

Formula evaluation records cell/range/variable reads, including cached reads and
the branches actually evaluated. Cell edits invalidate the edited cells and
transitive dependents. Changing a formula replaces its previous dependencies
when it is next evaluated. Unrelated cached formulas, including random values,
remain unchanged. Variables referenced by name are tracked, including currently
undefined variables. Custom functions that read grid cells through
`getComputedValue()` or `getRawValue()` are tracked too; external mutable state
requires explicit `grid.recalculate()`.

Structural edits, workbook replacement, function registration, undo/redo, and
explicit recalculation clear the full cache. Incremental calculation does not
mean incremental DOM rendering: the existing renderer still refreshes the
visible cells. Virtualization limits rendering; very large formula ranges still
consume calculation/dependency memory.

Run `npm run benchmark`. The script compares a single edit against full
recalculation, traverses every output, checks the expected result and number of
callback invocations, and separately measures the edit with history enabled.
[Recorded run](performance.json): Node on Apple M2 Max, no DOM, one measured run
per size (not a statistical browser benchmark).

| Cells | Incremental | Full recalculation | Edit with history | Recomputed counted formulas |
| ---: | ---: | ---: | ---: | ---: |
| 30,000 | 2.00 ms | 37.12 ms | 15.73 ms | 1 / 10,000 |
| 150,000 | 8.49 ms | 192.60 ms | 95.82 ms | 1 / 50,000 |

The temporary comparison snapshots for history still cost O(sheet size).
The numbers separate this cost from dependency-based calculation savings.
