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

Supported functions cover math and statistics, logic, criteria-based aggregation, lookup, arrays, text, and dates. German aliases include `SVERWEIS`, `WVERWEIS`, and `XVERWEIS`. Array results can be used as function inputs, but do not spill into neighboring cells.

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

Callbacks receive evaluated arguments without extra coercion: a cell reference passes its computed value, and a range passes a two-dimensional array. Default parameters and rest parameters work normally. Formula errors in arguments propagate without calling the callback; thrown exceptions become `#ERROR!` values. Callbacks must return synchronously; promises produce a formula error. Keep callbacks free of side effects: recalculation can call them multiple times. Arrays can feed other functions but do not spill into adjacent cells.

Workbooks and share links contain expressions and values, **not callback code**. The receiving application must register the same functions to recalculate them; missing functions display `#NAME?`. Standalone `FormulaEngine` instances expose the same registration methods.

## Data import and export

`importFile(file)` detects CSV, TSV, delimited text, JSON, NDJSON, HTML tables, Markdown tables, and SpreadsheetML 2003 XML. Delimited imports infer booleans, locale-aware numbers, percentages, currencies, and strictly validated ISO calendar dates/timestamps. Date inference defaults to `{ dateParsing: 'iso' }`: `2026-09-28` and `2026-09-28T12:34:56+02:00` are recognized; ambiguous values such as `01/02/2026`, month-name strings, and invalid dates such as `2025-02-29` remain text. Date-only and zone-less timestamps use local time; explicit offsets identify instants. The supported ISO forms use `YYYY-MM-DD`, `T`, hours/minutes, optional seconds/fractions, and optional `Z` or numeric offsets; this is not a parser for every ISO week, ordinal, or duration notation.

Use `{ dateParsing: 'locale', locale: 'de-DE' }` to opt into local numeric date formats, `{ dateParsing: false }` to disable date inference, or `{ inferTypes: false }` to preserve delimited fields as strings. Formula strings beginning with `=` still participate in formula evaluation. `dateParsing` also applies to NDJSON imports when `inferTypes` is enabled. Headers are never inferred. Identifier columns (including `gene`, `gene_id`, and `gene_symbol`) retain text, including scientific-notation-like identifiers such as `2310009E13`. This text information is preserved in workbook exports and share links. Values such as `MARCH1`, `SEPT1`, and `DEC1` remain text regardless of the locale. Legacy `.xls` files are supported only when they contain an HTML table. Binary Excel and ODS formats require an optional adapter.

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

The browser module, CSS, type declarations, and SQL adapter are exposed through `package.json` as `tiny-datagrid`, `tiny-datagrid/style.css`, and `tiny-datagrid/sql-client`. Import the local source files directly when using the repository without installing the package.

## Spreadsheet demo

Serve the repository over HTTP and open `demo/` (for example, `python3 -m http.server 8000`, then `http://localhost:8000/demo/`). The demo has Start/Home, Data, and View tabs, an editable sheet name, a formula bar with range navigation, text and number formatting, AutoSum, visible-cell search, selection statistics, and a collapsible pivot inspector. AutoSum writes below a selected single-column range only when the destination is empty. Workbook export and share links preserve formatting and formulas; these actions are explicit snapshots, not automatic saves.

The View tab switches between German and English and between system, light, and dark appearance. Only these preferences are stored locally. Sheet contents and formula syntax are not translated. The sample inventory keeps its German data labels.

The grid exposes row/cell semantics, selection, active-cell focus, and read-only state to assistive technology. Arrow keys navigate visible cells; Shift + arrows extends a selection; Enter/F2 edits; Alt + Down opens a column filter. Shift + Space selects a row, Ctrl/Cmd + Space selects a column, and Shift + F10 opens its context menu. Menus support Escape and dialogs restore focus. Tab moves to the next control. The demo supports Ctrl/Cmd + F to search values and formulas in visible cells. Screen-reader behavior can vary by browser and assistive technology.

For embedded grids, pass `{ locale: 'de' }` or call `grid.setLocale('en')`; unsupported UI languages fall back to English. `grid.styleSelection({ fontWeight: 'bold', textAlign: 'right' })` applies undoable CSS formatting to the current selection. Set `data-theme="light"` or `data-theme="dark"` on the document root or grid to override the system color scheme. Colors are exposed as `--tg-*` CSS variables.

## Optional plugins and calculation

See [feature configuration and measurements](plugins.md) for incremental recalculation, freeze panes, conditional formatting, validation, worksheet collections, and explicit IndexedDB persistence.
