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

Supported functions cover math and statistics, logic, criteria-based aggregation, lookup, arrays, text, dates, and JSON. German aliases include `SVERWEIS`, `WVERWEIS`, and `XVERWEIS`. Dynamic array results such as `=SEQUENCE(5)` or `=FILTER(A2:B20;B2:B20>0)` fill adjacent cells. A blocked result displays `#SPILL!`; use `A1#` to reference the full result.

See the [function reference](functions.md) for geo, geometry, hashing, random generation, text, and regular expressions.

## Custom formula functions

Provide plain JavaScript functions when creating a grid:

```js
const grid = new TinyDatagrid('#grid', {
  functions: {
    '=LTRIM': function (value) {
      return String(value ?? '').trimStart();
    },
    DOUBLE: value => value * 2,
    'STATS.TOTAL': rows => rows.flat().reduce((sum, value) => sum + value, 0)
  }
});
```

Use `=LTRIM(A1)`, `=DOUBLE(21)`, or `=STATS.TOTAL(B2:B10)` in cells. The leading `=` in a registration key is optional; names are case-insensitive and can use dotted namespaces. Names consist of letters, digits, and underscores, with each namespace segment starting with a letter or underscore. Function implementations are ordinary callbacks, with no requirement to follow Excel's function semantics. `LTRIM` is now built in; registering it explicitly overrides that implementation.

```js
grid.registerFunction('LTRIM', value => String(value ?? '').trimStart());
grid.registerFunctions({ DOUBLE: value => value * 2, GREET: name => `Hello, ${name}` });
grid.unregisterFunction('DOUBLE'); // true if a custom registration was removed
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
grid.loadRecords(records, { headers: ['id', 'name'] });
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
  grid.setCell(0, 0, 'Quantity');
  grid.setCell(0, 1, 'Price');
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
import { SQLClientAdapter } from './src/sql-client.js';

const sql = new SQLClientAdapter(grid, {
  query: ({ sql, params, signal }) => database.query({ sql, params, signal }),
  commitChanges: (changes, context) => database.applyGridChanges(changes, context)
});

await sql.query('SELECT id, name FROM products WHERE tenant_id = $1', [tenantId], {
  resultOptions: { tableName: 'products', keyColumns: ['id'], readOnly: false }
});
await sql.commitChanges();
```

The host is responsible for permissions, parameter binding, transactions, and conflict handling. Cursor pagination is supported when the host provides `queryPage`; grid-side filtering and sorting only cover rows currently loaded.

## Pivot tables

For live pivot results inserted into cells and usable in formulas, use the [optional sheet pivots plugin](plugins.md#pivot-tables-inside-the-sheet). The API below returns a standalone pivot.

```js
const pivot = grid.pivot({
  rows: ['Kategorie'],
  columns: ['Lagerort'],
  values: [{ field: 'Lagerwert', aggregate: 'sum', as: 'Lagerwert' }]
});

console.table(pivot.toTable());
```

For record arrays, use the exported `PivotEngine.pivot(records, config)` method.

## Package entry points

The browser module, CSS, type declarations, and SQL adapter are exposed through `package.json`. Optional UI tools have independent entry points and stylesheets: `tiny-datagrid/themes.css`, `tiny-datagrid/json`, `tiny-datagrid/json-tools` and `tiny-datagrid/json-tools.css`, `tiny-datagrid/search-tools` and `tiny-datagrid/search-tools.css`, `tiny-datagrid/charts` and `tiny-datagrid/charts.css`, `tiny-datagrid/formula-assist` and `tiny-datagrid/formula-assist.css`, `tiny-datagrid/exporters`, and `tiny-datagrid/feature-i18n`. See the [tool integration guide](demo-features.md) for host markup and examples. Import local `src/` files directly when using the repository without installing the package.

## Spreadsheet demo

Serve the repository over HTTP and open `demo/` (for example, `python3 -m http.server 8000`, then `http://localhost:8000/demo/`). The demo has Start/Home, Data, File, and View tabs, an editable sheet name, a formula bar with range navigation and formula assistance, text and number formatting, AutoSum, find/replace, charts, JSON editing and expansion tools, selection statistics, and a collapsible pivot inspector. AutoSum writes below a selected single-column range only when the destination is empty. Workbook export and share links preserve formatting and formulas; these actions are explicit snapshots, not automatic saves.

The View tab switches between German and English and between system, light, dark, and additional theme presets. Only these preferences are stored locally. Sheet contents and formula syntax are not translated. The sample inventory keeps its German data labels.

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
const grid = new TinyDatagrid('#grid', {
  dataLocale: 'de-DE',
  dateParsing: 'iso',
  columnTypes: { 0: 'text', 1: 'decimal', 2: 'date' }
});
grid.setCell(0, 0, '00123');
grid.setCell(0, 1, '1234567890,123456789'); // exact decimal text
const original = grid.getOriginalValue(0, 1);
```

`columnTypes` uses zero-based column indexes. A cell's explicit `valueType`
overrides the column type. Decimal types preserve strings; they do not enable
arbitrary-precision arithmetic. Set these options when creating the grid.

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
zero; empty cells still count as zero. Large `BigInt` values can be
stored and referenced, but built-in Number arithmetic will not round them into
ordinary numbers. JSON text with unsafe numeric literals is rejected before
`JSON.parse` can discard digits; encode those values as strings or use the
workbook's tagged BigInt representation.

Ordinary arithmetic remains IEEE-754 floating point (for example, `0.1 + 0.2`
is not exact decimal arithmetic). Precision already lost in a host-provided
JavaScript Number cannot be recovered. Supply exact values as strings/BigInts,
and use a host-provided decimal function for calculations that require exact
decimal results. Custom functions remain responsible for their internal arithmetic.

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
