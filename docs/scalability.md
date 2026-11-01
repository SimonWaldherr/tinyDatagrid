# Large worksheets and exact calculation

The grid addresses up to **10,000,000 rows and 32,768 columns**. Empty cells are
not allocated. These limits describe coordinates, not a measured capacity for
fully populated sheets. Device memory, formula complexity and persistence still
bound usable data volume.

## Geometry and persistence

Above 20,000 rows, row heights use an array-like axis with a default height and
sparse overrides. Numeric indexing and iteration remain available, but
`Array.isArray(grid.rowHeights)` is false for a large axis. Layout computes row
offsets from changed/hidden rows without allocating one offset per logical row.
Virtual scroll canvases are capped at eight million pixels in each direction;
keyboard navigation, hit testing, frozen panes and wheel deltas use logical
coordinates. Blank viewport reads do not accumulate calculation-cache entries.

Workbook version 2 remains unchanged. Small sheets retain `rowHeights` arrays.
Large dimensions export `rowHeights: []`, `defaultRowHeight` and sorted
`rowHeightOverrides: [[rowIndex, height], ...]`. Import accepts both dense legacy
heights and compact dimensions, including inactive worksheets. Older readers
that ignore the additional fields will lose custom heights on large sheets.
Keep those fields when transforming workbook JSON.

## Calculation

Numeric formula tokens are parsed directly from their original text, preserving
large integers and long decimals. Decimal cell inference preserves digits while
explicit text types and zero-padded identifiers remain text. Scientific-looking
identifiers continue to require explicit numeric conversion. Already rounded
JavaScript Numbers cannot be repaired.

Terminating division, integer powers and perfect square roots stay exact.
Recurring division, averages and irrational square roots round to 34 significant
decimal digits, half even. `DECIMAL.DIVIDE` keeps its explicit decimal-place API.
Transcendental functions and fractional powers use Number arithmetic, rejecting
precision-losing conversions. Existing DecimalValue digit/scale budgets apply.

`SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `COUNTA` and `COUNTBLANK` stream stored
cells and spill outputs when passed direct range arguments. They account for
implicit blanks and record a range dependency, so writing into a previously
empty cell invalidates the result. Worksheet references and custom-function
overrides retain their semantics. SQL-bound and pivot-backed ranges use the
ordinary bounded evaluation path. Streaming costs scale with stored cells and
spill outputs, not just the requested rectangle's populated cells.

## History and dense operations

Ordinary cell actions retain original records only when they are written.
Undo/redo apply their cell patches in place; metadata is compared separately.
Structural changes that replace the map still require a full comparison.
Nested transactions form one history step. Failed outer transactions restore
cells and metadata, including when `historyLimit: 0` disables retained undo.

Operations that must materialize a dense rectangle use the configurable
`maxRangeCells` option, default **1,000,000**. This applies to range matrices,
`toArray` (and synchronous exports using it), dense selection formatting, fill and move.
Oversized formula matrices return `#NUM!`; host APIs throw `RangeError`.
Streaming aggregates and sparse clearing are exempt. This budget does not cap
the number of stored cells in a workbook. Choose a larger finite positive safe
integer only when the host can afford the resulting allocations.
The [asynchronous exporter](persistence-and-export.md) reads rows without a dense
matrix and uses separate cell/byte budgets. Autosave takes cooperative snapshots,
reuses them for storage and recovery, and caps localStorage recovery size.

```js
const grid = new TinyDatagrid(container, {
  rows: 10_000_000,
  columns: 26,
  virtualization: true,
  maxRangeCells: 1_000_000,
});
grid.setCell(0, 0, 2);
grid.setCell(9_999_999, 0, 4);
grid.setCell(0, 1, "=SUM(A1:A10000000)"); // 6, without a 10M-element matrix
```

## Regression checks

`npm test` includes `test/test-core-scalability.mjs`: exact numeric results,
compact ten-million-row roundtrips, sparse aggregate invalidation, worksheet and
spill behavior, no full map scans for ordinary edit/undo/redo, structural undo,
validation and failure rollback, and dense-range budgets. Existing layout,
formula, SQL, pivot and worksheet tests also run.

The optional real-browser check needs a separately installed Playwright and a
browser. Run `node test/browser-core-scalability.mjs`; use
`TINYGRID_PLAYWRIGHT_PATH` for an external Playwright module and
`TINYGRID_BROWSER_CHANNEL=chrome` for an installed Chrome. It checks real cell
rendering, both compressed axes, frozen panes, hit testing, wheel precision,
editing, recalculation and undo/redo, real IndexedDB save/restore, asynchronous
export and the demo's Save/download/cancel controls. It starts a temporary loopback server and
closes the browser/server afterward. Touch scrolling on physical devices is
not covered by this regression.
