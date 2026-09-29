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
than the viewport to leave room for scrolling content. In the demo, **View**
offers top-row, first-column, active-cell and unfreeze commands. Active-cell
freezing fixes the rows above and columns to the left of the active cell.
Selection outlines are clipped separately in each frozen/scrolling pane.

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
Without this plugin, the core loads only the active sheet. Formulas support cross-sheet cells and ranges: `=Prices!B2`,
`=SUM('Prices EU'!B2:B10)`, and `=sheet2!$B$2`. Sheet IDs are stable across
renames; name references use case-insensitive matching and become `#REF!` if the
name is missing or ambiguous. IDs take precedence over names. Renaming a sheet
does not rewrite name-based formulas; use stable IDs for references that must
survive renames. Quoted names escape an apostrophe by doubling it (`'Bob''s'!A1`).
Range endpoints must address the same sheet. Cross-sheet cycles return `#CYCLE!`.
Inactive sheets are evaluated without switching the UI, with a shared dependency
graph and cache. A change invalidates transitive dependents across sheets.
Collection exports preserve formulas and literal data; computed formula values
are recalculated when reopened.
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


## External variables and recalculation

External variables belong to the host application and are shared across all
worksheets. They are separate from sheet-local `variables`, undo history,
IndexedDB records, and exported/shared workbook contents. A host variable takes
precedence over a local variable of the same name. Names are case-sensitive and
referenced with `@name`; an optional leading `@` is accepted by setters.

```js
const grid = new TinyDatagrid('#sheet', {
  externalVariables: { vat: 0.19 }
});
grid.load([['Net', 'Gross'], [100, '=A2*(1+@vat)']]);
const select = document.querySelector('#vat');
select.addEventListener('change', () => {
  grid.setExternalVariable('vat', Number(select.value));
});
```

`setExternalVariable` and `setExternalVariables` invalidate only formulas which
read those variables and their dependents, and refresh the visible grid, filters,
and change-event subscribers. External variables are a host integration API;
the general-purpose demo does not include a domain-specific scenario control.

```js
grid.setExternalVariables({ vat: 0.07, discount: 0.1 }); // One refresh.
grid.setExternalVariable('vat', 0.19, { recalculate: false });
grid.recalculate({ full: false }); // Refresh only invalidated results.
grid.recalculate();              // Clear all cached results and refresh.
grid.removeExternalVariable('vat'); // Falls back to the sheet-local value.
```

`recalculate: false` defers rendering, but invalidates cached dependencies
immediately. A subsequent direct `getComputedValue` also sees the new value.
Setters emit `externalvariables`; recalculation emits `change` with type
`recalculate`. External values are supplied synchronously; resolve asynchronous
requests in the host before calling a setter. String values are literal data,
not formula source. Replace mutable objects through the setter to trigger
invalidation. The receiving application must provide external variables again
when reopening a workbook; missing variables return `#NAME?` unless a local
fallback exists. Function callbacks reading `grid.getVariable()` participate in
dependency tracking; callbacks closing over arbitrary outside state require an
explicit full `recalculate()`.

## Pivot tables inside the sheet

```js
import { sheetPivots } from 'tiny-datagrid/pivots';
grid.use(sheetPivots());
const pivots = grid.feature('pivots');
const id = pivots.insert({
  source: { r1: 0, c1: 0, r2: 100, c2: 3 }, // First row contains unique headers.
  target: { row: 0, col: 6 },                // G1, zero-based coordinates.
  config: {
    rows: ['Category'],
    values: [{ field: 'Revenue', aggregate: 'sum', as: 'Revenue' }]
  }
});
grid.setCell(1, 9, '=H2*1.19'); // J2 references a computed pivot result.
// pivots.remove(id);          // Removes only that pivot's result cells.
```

The demo inspector offers **Insert into sheet** using the selected destination
cell and current pivot field settings, and **Remove pivot** for the selected
result. Source and destination must be separate. The source range is explicit,
includes its header row, and remains fixed; extending a source table does not
automatically extend this range. Inserted pivots aggregate all source rows,
independently of UI filters/hidden rows; optional serializable `config.filters`
apply data filters. Empty source rows are skipped.

Results are real sheet cells: formulas, ranges, and cross-sheet references can
read them. They refresh on calculation/render when source dependencies change,
including formulas depending on external variables. Output grows or shrinks
with the groups, and downstream formulas are invalidated when results change.
Positions refer to the current group order (first occurrence), not to a permanent
group identity; use a lookup when a formula should follow a specific group.

Result cells are protected against direct edits. Remove the pivot to edit that
area. A blocked expansion yields `#SPILL!` at the pivot anchor and never overwrites
occupied cells. Clearing the conflicting cell allows recalculation to recover.
Invalid source fields yield `#REF!`; circular source/result dependencies yield
`#CYCLE!`. A pivot source cannot directly contain another pivot's output. Pivot
rules use absolute coordinates and do not automatically move on row/column
insertion, deletion, or sorting; reposition/recreate the pivot after structural
changes to its source/destination.

Definitions and generated values are included in workbook export, share links,
and per-sheet history. With the plugin disabled, saved result values remain a
static snapshot. Re-enable `sheetPivots()` to resume calculation. Worksheets also
calculate inactive-sheet pivots when formulas reference them. `list()` returns
pivot IDs, configurations, output ranges, and current errors. The existing
`grid.pivot(config)` API still returns a standalone pivot without inserting cells.

## Moving cells and following references

`grid.moveRange(source, destinationRow, destinationColumn)` moves a rectangular
selection within the active sheet and rewrites formulas referring to its cells.
The demo exposes this action under **Cell references → Move selection**.
Destination values are replaced. Protected cells reject the operation.

For example, moving A1 to C1 rewrites `=A1*2` to `=C1*2` and `=$A$1*2` to
`=$C$1*2`. Dollar signs preserve their original form. They prevent relative
adjustment when **copying/filling**, not when the referenced cell itself moves.
Formulas inside the moved selection are also updated if they refer to moved
cells; their references to unmoved cells stay unchanged.

The rewrite includes inactive worksheets, sheet-local formula variables,
absolute/mixed references, and explicit ranges. Strings and function names are
not rewritten. External variable values remain literal host data. A completely
moved range stays a range. A partially moved range becomes `VSTACK`/`HSTACK` of
references, preserving the original two-dimensional order and avoiding unrelated
cells between the old and new locations. Partial ranges above 10,000 cells reject
the move before writing. Applications overriding HSTACK/VSTACK should preserve
their normal array semantics when using these generated formulas.

The move and associated formula changes form one undo step on the source sheet.
Undo/redo checks affected remote formulas first; if another edit changed them,
it returns false and emits `historyconflict` rather than overwriting the later
edit. Row/column insertion and deletion still have their existing behavior; this
reference-following API applies specifically to `moveRange`. Pivot definitions,
validation, and conditional-format ranges remain absolute metadata and are not
rewritten by cell moves.

## Precedents, dependents, and formula assistance

`getPrecedents(row, col)` returns direct cell/range references from a cell's
formula; `getDependents(row, col)` finds formulas referring to the cell across
installed worksheets. Both default to the selected cell. These are static direct
references, including unexecuted IF branches. They do not recursively expand
formula variables or inspect JavaScript callback internals. The calculation
engine separately retains its dynamic evaluation dependency graph.

The demo's **Cell references** panel lists clickable references and highlights
visible cells on the current sheet. Its predecessor view also displays explicitly
referenced `@variables`. Sheet links navigate when the worksheets plugin is
installed. Moving a selected range is available in the same panel.

The expandable formula textarea and the in-cell editor support **Enter** to
apply and move down, **Ctrl/Cmd+Enter** to apply and move up, **Tab / Shift+Tab**
to apply and move right / left, **Shift+Enter** for a newline, and **Escape** to discard.
Arrow keys move the text cursor while editing. An open autocomplete list uses
Up/Down to select suggestions and Enter/Tab to accept one; Escape closes it.
Modified shortcuts still work with suggestions open. Formulas accept whitespace
and line breaks between tokens. Newlines within quoted text remain literal.

The **ƒ?** panel provides searchable signatures and short DE/EN explanations for
all built-in functions, including LET/LAMBDA. It follows the function before the
caret while typing. Custom documentation can be supplied via
`options.functionHelp`, keyed by uppercase function name:

```js
const options = {
  functions: { DOUBLE: value => value * 2 },
  functionHelp: {
    DOUBLE: { signature: 'DOUBLE(value)', de: 'Verdoppelt einen Wert.', en: 'Doubles a value.' }
  }
};
```

Host applications can import `functionHelp(name, language, custom)` and
`documentedFunctions()` from `tiny-datagrid/function-help` to build their own UI.
Unknown custom functions display a description-unavailable message.

## Cell context menu and worksheet tabs

Both UI features are optional, dependency-free plugins; styles are included in
`tiny-datagrid/style.css`. The worksheet model also works without a tab UI.

```js
import TinyDatagrid from 'tiny-datagrid';
import { worksheets } from 'tiny-datagrid/worksheets';
import { worksheetTabs } from 'tiny-datagrid/worksheet-tabs';
import { cellContextMenu } from 'tiny-datagrid/cell-context-menu';
import 'tiny-datagrid/style.css';

const grid = new TinyDatagrid('#grid', {
  plugins: [
    worksheets(),
    cellContextMenu({ items: [{
      id: 'inspect', label: 'Inspect cell',
      action: grid => console.log(grid.getCell(grid.anchor.row, grid.anchor.col))
    }] }),
    worksheetTabs({ container: '#sheet-tabs' })
  ]
});
const book = grid.feature('worksheets');
const id = book.add('Planning');
book.select(id);
book.rename(id, 'Schedule');
```

Right-click a cell or press Shift+F10 to open the cell menu. An existing selection
is retained when right-clicking inside it. Arrow keys navigate menu items; Escape
closes it. Clipboard actions use the browser Clipboard API and report failures
through `contextmenuerror` (`{error}`). Custom items append to the built-in actions.
Row and column headers keep their existing axis menus.

The tab bar offers `+`, sheet switching, and double-click/right-click/F2 to rename
or delete a sheet. Deletion requires a second confirmation and cannot remove the
last sheet. Sheet deletion is not undoable. Names must be nonempty and unique;
mutations respect read-only mode. Tab UI failures emit `worksheeterror` (`{error}`).
Both UI plugins accept `translate(key)`; German and English defaults are included.

`book.importSheet(sheet)` replaces only the active sheet and participates in its
undo history. The demo uses it for example content; opening a workbook replaces
the complete collection. Workbook export and autosave preserve every sheet and
the active sheet ID. Draft recovery remembers its owning sheet. Existing rules
for sheet-name references apply: stable sheet IDs survive renames; name-based
references must be updated when renaming a sheet.
