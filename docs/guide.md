# Integration guide

[← Overview](../README.md) · [Function reference](functions.md)

## Formulas

Formulas support arithmetic, comparisons, text concatenation, A1 references and ranges, named variables (such as `@tax`), and comma or semicolon argument separators. Formula text is parsed, never evaluated as JavaScript. Host applications can explicitly register JavaScript callbacks.

```text
=LET(wert; D2*F2; wert*1.19)
=SUMIFS(G2:G10; B2:B10; "Sicherheit"; D2:D10; ">=4")
=XLOOKUP("Handschuhe"; A2:A10; G2:G10; 0)
=SUM(MAP(D2:D10; LAMBDA(anzahl; anzahl*2)))
```

Supported functions cover math and statistics, logic, criteria-based aggregation, lookup, arrays, text, dates, and JSON. German aliases include `SVERWEIS`, `WVERWEIS`, and `XVERWEIS`. Dynamic array results such as `=SEQUENCE(5)` or `=FILTER(A2:B20;B2:B20>0)` fill adjacent cells. A blocked result displays `#SPILL!`; use `A1#` to reference the full result. See [Dynamic arrays](arrays.md) for spill rules and element-wise calculations, and [JSON values and formulas](json.md) for the `JSON.*` functions and paths.

See the [function reference](functions.md) for calendar dates, workdays, times, durations, colors, geo, geometry, hashing, random generation, text, and regular expressions. Web queries require a separate [native app adapter](functions.md#web-queries--ios-app-only).

## Custom formula functions

Provide plain JavaScript functions when creating a grid:

```js
const grid = new TinyDatagrid("#grid", {
  functions: {
    "=LTRIM": function (value) {
      return String(value ?? "").trimStart();
    },
    DOUBLE: (value) => value * 2,
    "STATS.TOTAL": (rows) => rows.flat().reduce((sum, value) => sum + value, 0),
  },
});
```

Use `=LTRIM(A1)`, `=DOUBLE(21)`, or `=STATS.TOTAL(B2:B10)` in cells. The leading `=` in a registration key is optional; names are case-insensitive and can use dotted namespaces. Names consist of letters, digits, and underscores, with each namespace segment starting with a letter or underscore. Function implementations are ordinary callbacks, with no requirement to follow Excel's function semantics. `LTRIM` is now built in; registering it explicitly overrides that implementation.

```js
grid.registerFunction("LTRIM", (value) => String(value ?? "").trimStart());
grid.registerFunctions({
  DOUBLE: (value) => value * 2,
  GREET: (name) => `Hello, ${name}`,
});
grid.unregisterFunction("DOUBLE"); // true if a custom registration was removed
```

Registrations belong to the individual grid. Registering, replacing, or removing a callback clears cached formula results and refreshes the grid, including active filters. Bulk registration validates all entries before applying them. A custom function can override a built-in, including special forms such as `IF`; removing the override restores the original built-in. Overrides receive eagerly evaluated arguments, so they do not inherit built-in short-circuit behavior.

Callbacks receive evaluated arguments without extra coercion: a cell reference passes its computed value, and a range passes a two-dimensional array. Default parameters and rest parameters work normally. Formula errors in arguments propagate without calling the callback; thrown exceptions become `#ERROR!` values. Callbacks must return synchronously; promises produce a formula error. Keep callbacks free of side effects: recalculation can call them multiple times. An array returned from a cell formula spills into adjacent cells when those cells are available.

Workbooks and share links contain expressions and values, **not callback code**. The receiving application must register the same functions to recalculate them; missing functions display `#NAME?`. Standalone `FormulaEngine` instances expose the same registration methods.

## Data import and export

`importFile(file)` detects CSV, TSV, delimited text, JSON, NDJSON, HTML tables, Markdown tables, and SpreadsheetML 2003 XML. Delimited imports infer booleans, locale-aware numbers, percentages, currencies, and strictly validated ISO calendar dates/timestamps. Date inference defaults to `{ dateParsing: 'iso' }`: `2026-09-28` and `2026-09-28T12:34:56+02:00` are recognized; ambiguous values such as `01/02/2026`, month-name strings, and invalid dates such as `2025-02-29` remain text. Date-only and zone-less timestamps use local time; explicit offsets identify instants. The supported ISO forms use `YYYY-MM-DD`, `T`, hours/minutes, optional seconds/fractions, and optional `Z` or numeric offsets; this is not a parser for every ISO week, ordinal, or duration notation.

Use `{ dateParsing: 'locale', locale: 'de-DE' }` to opt into local numeric date formats, `{ dateParsing: false }` to disable date inference, or `{ inferTypes: false }` to preserve delimited fields as strings. Delimited fields classified as text, including fields beginning with `=`, stay literal. To insert a formula intentionally, use `setCell(row, col, formula, { valueType: undefined })` on an untyped column. `dateParsing` also applies to NDJSON imports when `inferTypes` is enabled. Headers are never inferred. Identifier columns (including `gene`, `gene_id`, and `gene_symbol`) retain text, including scientific-notation-like identifiers such as `2310009E13`. This text information is preserved in workbook exports and share links. Values such as `MARCH1`, `SEPT1`, and `DEC1` remain text regardless of the locale. Legacy `.xls` files are supported only when they contain an HTML table. Binary Excel and ODS formats require an optional adapter.

Use `exportCSV()`, `exportTSV()`, `exportJSON()`, or `exportWorkbook()` as needed. Workbook JSON preserves formulas, values, formatting, dimensions, hidden rows and columns, table/filter state, variables, and sheet metadata. Freeze panes, conditional formatting, and input validation are activated with [optional plugins](plugins.md).

Create a self-contained share link with `grid.createShareURL()` and restore it with `grid.importShareHash()`. The versioned `#tg1.` URL hash contains the workbook as URL-safe Base64-encoded JSON, so no server storage is involved. Share links include the complete workbook and can become long for large datasets.

## API overview

Common methods include:

```js
grid.setCell(row, col, value);
grid.getComputedValue(row, col);
grid.loadRecords(records, { headers: ["id", "name"] });
grid.createTable({ r1: 0, c1: 0, r2: 20, c2: 3 }, { headerRow: 0 });
grid.setVirtualization(true);
grid.setReadOnly(true);
const shareURL = grid.createShareURL();
grid.undo();
grid.redo();
grid.destroy();
```

`grid.on(type, listener)` subscribes to changes, selection, resizing, formatting, fill, move, and other grid events. Call `destroy()` when removing the grid from a page. The package exports `TinyDatagrid` as the default and named export; `TinyGrid` remains as a compatibility alias.

For larger sheets, set `virtualization: true` in the constructor or call `grid.setVirtualization(true)`. This limits rendered DOM elements; cell data and dimensions remain in memory. Virtualization is off by default.

## Undo and redo

The demo supports **Ctrl/Cmd+Z**, **Ctrl/Cmd+Shift+Z**, and **Ctrl+Y**. The
ribbon shows the number of available undo/redo steps. While typing in a text
field, these shortcuts retain the browser's text-editing behavior; after
committing the edit, they operate on the sheet.

History stores reversible differences: changed cell values, formatting, filters,
row/column dimensions, variables, and workbook metadata. It does not retain a
full workbook for each step. One temporary comparison snapshot is used during
an action and released afterward; comparison time still scales with sheet size.
Large replacements/imports necessarily retain the data needed to restore the
previous contents. Undo and redo move the same patch between stacks.

`historyLimit` defaults to 100 steps; use `0` to disable history. A new change
after undo discards the redo branch; no-op edits do not. History stays in memory
and is excluded from exports and share links. SQL result replacement and saving
SQL changes clear history, so undo cannot cross a database save boundary.

```js
grid.transaction(() => {
  grid.setCell(0, 0, "Quantity");
  grid.setCell(0, 1, "Price");
}); // One undo step for both cells.
grid.undo();
grid.redo();
grid.clearHistory(); // For example, after loading initial demo data.
```

Transactions are synchronous and nestable. For a drag gesture, pair
`beginHistory()` with `endHistory()` (including cancellation). The built-in
row/column resize gesture already does this. `historyState` returns `{ undo,
redo }`; the `history` event fires after completed actions and undo/redo.
Use grid methods to edit data: direct mutation of `cells` or cell objects is
not a supported history API.

## SQL client adapter

The optional `tiny-datagrid/sql-client` adapter connects the grid to a host-provided SQL client. The host supplies parameterized `query` and transactional `commitChanges` callbacks; the grid does not open database connections or construct SQL statements. Query results are read-only by default. Editable results need key columns and `readOnly: false`.

```js
import { SQLClientAdapter } from "./src/sql-client.js";

const sql = new SQLClientAdapter(grid, {
  query: ({ sql, params, signal }) => database.query({ sql, params, signal }),
  commitChanges: (changes, context) =>
    database.applyGridChanges(changes, context),
});

await sql.query(
  "SELECT id, name FROM products WHERE tenant_id = $1",
  [tenantId],
  {
    resultOptions: {
      tableName: "products",
      keyColumns: ["id"],
      readOnly: false,
    },
  },
);
await sql.commitChanges();
```

The host is responsible for permissions, parameter binding, transactions, and conflict handling. Cursor pagination is supported when the host provides `queryPage`; grid-side filtering and sorting only cover rows currently loaded.

## Pivot tables

For live pivot results inserted into cells and usable in formulas, use the [optional sheet pivots plugin](plugins.md#pivot-tables-inside-the-sheet). Such a pivot stays linked to its source table, refreshes with it, and its settings can be changed later. The API below returns a standalone pivot.

```js
const pivot = grid.pivot({
  rows: ["Kategorie"],
  columns: ["Lagerort"],
  values: [{ field: "Lagerwert", aggregate: "sum", as: "Lagerwert" }],
});

console.table(pivot.toTable());
```

For record arrays, use the exported `PivotEngine.pivot(records, config)` method.

## Package entry points

The browser module, CSS, type declarations, and SQL adapter are exposed through `package.json`. Optional UI tools have independent entry points and stylesheets: `tiny-datagrid/themes.css`, `tiny-datagrid/json`, `tiny-datagrid/json-tools` and `tiny-datagrid/json-tools.css`, `tiny-datagrid/search-tools` and `tiny-datagrid/search-tools.css`, `tiny-datagrid/charts` and `tiny-datagrid/charts.css`, `tiny-datagrid/formula-assist` and `tiny-datagrid/formula-assist.css`, `tiny-datagrid/data-tools`, `tiny-datagrid/rule-tools`, `tiny-datagrid/list-dropdown`, `tiny-datagrid/exporters`, and `tiny-datagrid/feature-i18n`. See the [tool integration guide](demo-features.md) for host markup and examples. Import local `src/` files directly when using the repository without installing the package.

## Spreadsheet demo

Serve the repository over HTTP and open `demo/` (for example, `python3 -m http.server 8000`, then `http://localhost:8000/demo/`). The demo has General, Data, File, and View tabs, an editable sheet name, a formula bar with range navigation and formula assistance, text and number formatting, AutoSum, find/replace, charts, JSON editing and expansion tools, selection statistics, and an analysis dialog. AutoSum writes below a selected single-column range only when the destination is empty. Workbook export and share links preserve formatting and formulas; these actions are explicit snapshots, not automatic saves.

The View tab switches the UI language and selects system, light, dark, and additional theme presets. These preferences and the workbook are stored locally; see [automatic local saving](#automatic-local-saving). Changing the UI language does not translate sheet contents or rewrite formulas.

The grid exposes row/cell semantics, selection, active-cell focus, and read-only state to assistive technology. Arrow keys navigate visible cells; Shift + arrows extends a selection; Enter/F2 edits; Alt + Down opens a column filter. Shift + Space selects a row, Ctrl/Cmd + Space selects a column, and Shift + F10 opens its context menu. Menus support Escape and dialogs restore focus. Outside editing, Tab moves to the next control. While editing, arrows move the text cursor; Enter applies and moves down, Ctrl/Cmd + Enter applies and moves up, Tab / Shift + Tab applies and moves right / left. Shift + Enter inserts a newline; Escape discards the edit. An open formula suggestion list uses Up/Down and Enter/Tab until dismissed with Escape. Cell navigation skips hidden/filtered rows and hidden columns and stops at sheet boundaries. Library integrations can call `grid.moveSelection("up" | "down" | "left" | "right", extend = false)` (returns false at a boundary). The demo supports Ctrl/Cmd + F to search values and formulas in visible cells. Screen-reader behavior can vary by browser and assistive technology.

For embedded grids, pass `{ locale: 'de' }` or call `grid.setLocale('en')`. Grid menus are translated into German, English, French, Spanish, Italian and Dutch (region suffixes such as `fr-CA` are accepted); other locales fall back to English. The demo adds the same languages in `demo/locales/*.js`; missing keys fall back to English. `grid.styleSelection({ fontWeight: 'bold', textAlign: 'right' })` applies undoable CSS formatting to the current selection. Import `tiny-datagrid/themes.css` to enable the optional `data-theme` presets: `light`, `dark`, `ocean`, `paper`, `midnight`, `graphite`, and `contrast` (high contrast). Set `data-theme` on the document root or grid. Without a value, or with `system`, the grid follows the system color scheme. Colors are exposed as `--tg-*` CSS variables, so custom themes only need to define those variables under `[data-theme="mytheme"] .tg-root`. Set `--tg-font` to change the grid typeface.

## Optional plugins and calculation

See [feature configuration and measurements](plugins.md) for incremental recalculation, freeze panes, conditional formatting, validation, worksheet collections, and explicit IndexedDB persistence.

## External controls and sheet references

Use `=Prices!B2` or `=SUM('Prices EU'!B2:B10)` with the worksheets plugin. Host controls can update `@vat` through `grid.setExternalVariable('vat', 0.19)`; `grid.recalculate()` triggers a full refresh. See [external variables](plugins.md#external-variables-and-recalculation) for batching, scope, and persistence behavior.

### Loss-aware values

Cell entry, pasted values and import inference share numeric conversion rules.
`00123`, `SEPT1`, ambiguous dates and decimal strings that would lose digits stay
text. Whole-number strings outside the safe Number range become `BigInt`.
Automatic boolean detection only accepts `true`/`false`; other spellings require
an explicit boolean type. Number separators follow the selected data locale,
including grouping validation, rather than guessing from mixed separators.
The grid defaults to `dataLocale: 'en-US'`; UI language does not change stored
values. Imports can override `locale` explicitly.

```js
const grid = new TinyDatagrid("#grid", {
  dataLocale: "de-DE",
  dateParsing: "iso",
  columnTypes: { 0: "text", 1: "decimal", 2: "date" },
});
grid.setCell(0, 0, "00123");
grid.setCell(0, 1, "1234567890,123456789"); // exact decimal text
const original = grid.getOriginalValue(0, 1);
```

`columnTypes` uses zero-based column indexes. A cell's explicit `valueType`
overrides the column type. Explicit decimal columns parse valid input into exact
`DecimalValue` objects; invalid input remains editable text. Set these options when
creating the grid.

Original inputs are retained alongside converted values for cell edits, pasted
cells, delimited imports and SpreadsheetML imports. `getOriginalValue(row,col)`
returns that input (or the raw value when no source input is available). Workbook
exports, share links and undo/redo retain this metadata. This preserves field
contents, not CSV quoting, delimiters or the complete source file.

The demo previews up to six rows/eight columns of CSV/TSV before applying an
import and offers a switch to keep every field as text. Other supported formats
have no type preview. Imported replacements remain undoable.

Formula numeric conversions, numeric literals and results reject unsafe integers,
overflow and detected input-digit loss with `#NUM!`. Nonnumeric operands in
arithmetic and numeric aggregates produce `#VALUE!` instead of silently becoming
zero; empty cells still count as zero. `BigInt` and `DecimalValue` preserve exact
numeric values through arithmetic. JSON text with unsafe numeric literals is rejected before
`JSON.parse` can discard digits; encode those values as strings or use the
workbook's tagged BigInt representation.

Addition, subtraction, multiplication and sums use base-10 arithmetic, so
`0.1 + 0.2` evaluates to `0.3`. Ordinary Number division and transcendental
functions can still produce approximations. Use `DECIMAL.DIVIDE` for explicit
division precision and rounding. Precision already lost in a host-provided
JavaScript Number cannot be recovered. Supply exact values as decimal strings,
`DecimalValue` objects or BigInts. Custom functions remain responsible for their
internal arithmetic. See [precision and limits](excel-safety.md#genauigkeit-und-grenzen).

The demo starts with an empty worksheet, without preset business data, validation
rules or frozen panes. Import a workbook or enter data to begin.

### File tab in the demo

**File** offers Open, Save (editable workbook JSON), Export, and optional example
sheets: blank, class timetable, weekly planner, timesheet, offer comparison,
learning progress, budget, project plan, inventory, text functions and geometry.
Timetables and weekly planners use a plain grid; calculation examples include
editable formulas for totals, net hours, weighted scores and progress.
Loading an example replaces the current sheet and can be undone.

Exports include workbook, CSV, TSV, JSON, HTML, Markdown, PNG and PDF/Print.
Choose the used range or current selection; workbooks always preserve everything.
The optional PNG/PDF helpers use computed values, active theme colors, cell
formatting, and conditional formatting while excluding hidden and filtered
cells. They are generated print views, not screenshots of the full application.
PNG defaults to 2× resolution and a 16-million-pixel limit. PDF opens the
browser print dialog with landscape pages and repeating table headers; use
`tiny-datagrid/exporters` to call either helper from your own controls.

## Touch devices

On touch screens a tap selects a cell, a double tap edits it, and dragging scrolls. Press and hold a cell for about half a second, then drag to select a range. Press and hold a row or column header to open its menu, because iOS does not send `contextmenu` events. Hit areas for resize handles, the fill handle and filter buttons grow automatically on coarse pointers, and inputs use 16 px text so iOS Safari does not zoom in on focus. The demo also respects safe areas and follows the on-screen keyboard through `visualViewport`.

### Automatic local saving

The demo restores its last workbook on reload using IndexedDB, with a temporary
localStorage recovery copy for pending writes. Cell-editor and formula-bar drafts
are saved separately while typing. The document header reports saving failures.
Shared URLs have a separate local save slot, so reloading a shared sheet retains
local edits without replacing the ordinary local worksheet. This is browser/origin
storage, not cloud sync: clearing site data removes it. Export remains the durable
backup option; private mode, quotas or disabled storage can prevent local saves.

### Table labels while scrolling

When a formatted table's header row has scrolled completely above the viewport
and no rows are frozen, its column headers display labels such as **A – Item**.
Only columns inside that table change. Letters return when scrolling back to the
header or beyond the table. Blank headers keep their letters; long labels are
truncated with the full text available as a tooltip and accessible name. This
behavior is built into the grid and also supports virtualized and frozen columns.

### Multiple independent tables and object overview

Select a rectangle including its header row and choose **Format as table**. Each
non-overlapping rectangle becomes a separate named table. For a single selected
cell the demo detects the data block along its column and header row; explicitly
select irregular or adjacent blocks. Formatting an existing identical rectangle
activates it. Overlapping rectangles are rejected instead of merged.

Typing directly under a table adds that row to it (not while the table is filtered; the grid
option `tableAutoExpand: false` turns this off), so pivots and charts built on the table
pick up new records.

Selecting a table cell activates that table for sort, filter and pivot controls.
Selecting a destination outside tables retains the active source. Table styling
and sorting stay within its columns. Filters belong to each table: when tables
share row numbers, rejected cells are left blank in that table so the neighboring
table is not hidden. Without a neighboring table, filtered rows collapse normally.
Filter criteria continue to affect pivot/chart analyses independently.

The analysis dialog's **Objects** tab lists all tables, inserted pivots, heatmaps and saved chart
views **across all worksheets**, with their sheet names and ranges. Click an item to select it
or reopen its chart. Removing a table keeps its values; removing a pivot removes
its generated result cells; removing a chart deletes only its saved view.
Opening a nonempty chart in the demo registers its range and chart type once.
These definitions and all table filters travel with workbook saving, sharing and
worksheets; their edits use normal history. Legacy single-table files still load.

```js
grid.createTable({ r1: 0, c1: 0, r2: 10, c2: 3 }, { name: "Costs" });
grid.createTable({ r1: 0, c1: 6, r2: 20, c2: 9 }, { name: "Orders" });
const [costs, orders] = grid.listTables();
grid.activateTable(orders.id);
grid.setColumnFilter(6, ["Open"]);
grid.sortTable(7, "asc");
grid.listObjects(); // table / pivot / chart descriptors on the active sheet
grid.feature("worksheets").listObjects(); // Across the workbook, including sheet IDs
grid.removeTable(costs.id); // Keep cells; remove the table definition.
grid.saveVisualization({
  name: "Order amounts",
  range: { r1: 0, c1: 6, r2: 20, c2: 7 },
  chartType: "column",
});
```

`grid.table` and `grid.columnFilters` remain compatibility aliases for the active
table. Prefer `createTable`, `activateTable`, `listTables`, and `removeTable(id)`
for multiple tables. `tableAt(row,col)` returns the live table definition or null.
Deleting a table's header row removes its definition; inserting/deleting other
rows or columns adjusts table and saved-chart ranges. Table filters use literal
column values; chart views store their source coordinates and chart type.

### Pivot formulas

Use a header-first range with unique, nonempty column names:

```text
=PIVOT(A1:D100; "Category"; "Amount"; "SUM")
=PIVOT(A1:D100; "Category"; "Amount"; "SUM"; "Year")
=PIVOT('Sales'!A1:D100; "Category"; "Amount"; "SUM"; "Year"; "visible")
```

`PIVOT(source; rowField; valueField; aggregate="SUM"; columnField=""; scope="all")`
returns a dynamic array including headings. Supported aggregates: `SUM`, `COUNT`
(record count), `COUNTA` (nonempty values), `AVG`/`AVERAGE`, `MIN`, `MAX`, `FIRST`,
`LAST`. Empty source rows are ignored. Field names match exactly.

The default includes all source rows. `"visible"` respects the source table's
filters and hidden rows, recalculates when visibility changes, and requires a
direct cell range. For the default scope, arrays such as `VSTACK(...)` are also
accepted. Sources and outputs are limited to 100,000 cells (`#NUM!` on overflow).
Unknown fields return `#REF!`; malformed headers/options return `#VALUE!`.

Results expand from the formula cell; occupied destinations yield `#SPILL!`
without overwriting their contents. Other formulas can reference result cells
or the complete array, for example `F2#`. Source changes recalculate the result.
The source rectangle is explicit: adding rows beyond it does not extend the formula.

In the demo Pivot dialog, select **Insert as formula** to generate the formula.
The selected analysis scope is retained; selected rows become explicit ranges
joined with the header using `VSTACK`. Edit formula settings in the formula bar.
Existing pivot objects continue to use their own settings dialog.
Library users can use `PIVOT` without installing `sheetPivots`, or call
`PivotEngine.fromArray(matrix, rowField, valueField, aggregate, columnField)`.

### Array formulas for data preparation

These built-ins require no plugin. Their arrays use the same spill handling as
`PIVOT`: existing cells are protected, dependencies recalculate, and `F2#`
references the complete result anchored at F2. New functions limit each input
matrix and output to 100,000 cells (grouping/join key expansion is also bounded).
Text inputs are limited to 1,000,000 UTF-16 code units. Limit violations return
`#NUM!`; invalid arguments return `#VALUE!`; unknown table fields return `#REF!`.
No rows yields blank text, or just the header for table-producing functions.
Existing formula errors in inputs propagate.

#### Text and CSV

```text
=TEXTSPLIT(A1; ";")
=TEXTSPLIT(A1; ";"; " / ")
=CSV.PARSE(A1; ";")
=REGEXP_EXTRACTALL(A1; "([A-Z]+)-([0-9]+)")
```

`TEXTSPLIT` uses literal, distinct nonempty column/row delimiters, retaining
empty fields and padding shorter rows with blanks. It does not interpret CSV
quoting. `CSV.PARSE` handles quoted delimiters, escaped quotes (`""`), CR/LF/CRLF,
a leading BOM, and embedded newlines. Malformed quoting is an error; a final
record separator adds no extra row. Both preserve text such as `00123`, `SEPT1`
and `2026-10-01` without converting it to numbers or dates.

`REGEXP_EXTRACTALL(text; pattern; flags="u")` returns one row per match.
When capture groups exist, each group gets a column; otherwise the full match
gets one column. Unmatched optional groups become blank. JavaScript regex flags
are supported; global matching is automatic. No matches returns blank text.

#### Selecting and reshaping

```text
=CHOOSECOLS(A1:F20; 3; 1; -1)
=CHOOSEROWS(A1:F20; 1; 5; -1)
=TAKE(A2:D100; 10)
=TAKE(A2:D100; -5; 2)
=DROP(A1:D100; 1)
=TOCOL(A1:C5; TRUE())
=TOROW(A1:C5)
```

Selection indexes start at 1; negative indexes count from the end. Repeated
indexes duplicate columns/rows; zero or out-of-range indexes are invalid.
`TAKE` and `DROP` accept row counts and optional column counts: positive counts
operate from the start, negative counts from the end. Counts beyond the size
are clipped; zero rows in `TAKE` gives blank, zero in `DROP` leaves rows intact.
`TOCOL`/`TOROW` read left-to-right, then top-to-bottom. Their optional Boolean
`ignoreBlank` omits empty strings/nulls, preserving zero and false.

#### Grouping, unpivoting and joining

All three take tables whose first row contains unique nonempty text headers;
completely blank data rows are skipped. Names are exact and case-sensitive.
Field lists can be a single name, a cell range, or a `SPLIT` result.

```text
=GROUPBY(A1:D100; "Category"; "Amount"; "SUM")
=GROUPBY(A1:F100; SPLIT("Region;Category"; ";"); SPLIT("Amount;Quantity"; ";"); SPLIT("SUM;AVERAGE"; ";"))
=UNPIVOT(A1:D20; "Product"; "Month"; "Amount")
=TABLE.JOIN(A1:C20; F1:H30; "ID"; "ProductID"; "left")
```

- `GROUPBY(source; rowFields; valueFields; aggregates="SUM")` keeps first-seen
  group order. One aggregate applies to all value fields, or provide one per
  field. Supports `SUM`, `COUNT`, `COUNTA`, `AVG`/`AVERAGE`, `MIN`, `MAX`, `FIRST`,
  `LAST`. COUNT counts records; COUNTA counts nonempty values. Numeric aggregates
  use the grid's strict numeric conversion. Group key values retain their types.
- `UNPIVOT(source; idFields; fieldName="Field"; valueName="Value")` keeps the ID
  fields and emits a row for each remaining source column, including blank
  values. Output field names must be unique and nonempty.
- `TABLE.JOIN(left; right; leftKeys; rightKeys; mode="inner")` supports `inner`,
  `left`, `right`, `full`, plus composite keys of equal length. All matching
  combinations are retained. Numeric 1 and text "1" differ; a key containing a
  blank never matches. Unmatched fields become blank. Both tables' columns are
  retained; duplicate output names receive ` (2)`, ` (3)`, etc. Left rows keep
  their order, followed by unmatched right rows where applicable.

#### Dates and frequency tables

```text
=DATE.SEQUENCE("2026-01-31"; 12; "month")
=DATE.SEQUENCE("2026-10-01"; 8; "week"; 2)
=FREQUENCY(A2:A100; SEQUENCE(5; 1; 10; 10))
```

`DATE.SEQUENCE(start; count; unit="day"; step=1)` accepts an actual Date or a
strict ISO `YYYY-MM-DD` string and returns Date values. Format the result cells
as dates if needed. Units are `day`, `week`, `month`, `year`; a nonzero integer
step may be negative. Calculations use the same local calendar as DATE.ADD; calendar days remain correct across daylight-saving transitions. Month/year steps use the original
anchor day, clamped to each month's end: Jan 31 → Feb 28 → Mar 31. Zero count
returns blank; negative counts and invalid dates are rejected.

`FREQUENCY(values; bins)` returns one count per strictly increasing upper bound,
plus a final overflow count. Each bound is inclusive; empty data cells are
ignored. Invalid numeric text is an error. With bounds 10, 20, 30 the rows count
values ≤10, >10 through 20, >20 through 30, and >30.
