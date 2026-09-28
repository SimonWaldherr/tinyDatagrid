# tinyDatagrid

A dependency-free spreadsheet and data grid for the browser, written in vanilla JavaScript. It supports spreadsheet formulas, editable tables, CSV and JSON workflows, pivots, and an optional SQL client adapter.

## Demo

Serve the project root with a static HTTP server, then open `/demo/`:

```sh
python3 -m http.server 8080
```

## Quick start

```html
<link rel="stylesheet" href="src/tinygrid.css">
<div id="sheet" style="height:600px"></div>
<script type="module">
  import TinyDatagrid from './src/tinygrid.js';

  const grid = new TinyDatagrid('#sheet', {
    rows: 100,
    columns: 30,
    variables: { tax: 0.19 }
  });

  grid.load([
    ['Qty', 'Price', 'Net', 'Gross'],
    [2, 10, '=A2*B2', '=C2*(1+@tax)']
  ]);
</script>
```

## Features

- Cell editing, formula bar, keyboard navigation, multi-cell selection, copy/paste, and undo/redo
- Resizable rows and columns, fill handle, sorting, filters, hidden rows/columns, and read-only mode
- Formula references, named variables, common spreadsheet functions, and array functions
- CSV/TSV, JSON, HTML, Markdown, and workbook import/export
- Pivot tables and a demo chart
- Optional viewport virtualization for large rendered grids
- No runtime dependencies or build step

## Formulas

Formulas support arithmetic, comparisons, text concatenation, A1 references and ranges, named variables (such as `@tax`), and comma or semicolon argument separators. The formula engine does not execute JavaScript.

```text
=LET(wert; D2*F2; wert*1.19)
=SUMIFS(G2:G10; B2:B10; "Sicherheit"; D2:D10; ">=4")
=XLOOKUP("Handschuhe"; A2:A10; G2:G10; 0)
=SUM(MAP(D2:D10; LAMBDA(anzahl; anzahl*2)))
```

Supported functions cover math and statistics, logic, criteria-based aggregation, lookup, arrays, text, and dates. German aliases include `SVERWEIS`, `WVERWEIS`, and `XVERWEIS`. Array results can be used as function inputs, but do not spill into neighboring cells.

## Data import and export

`importFile(file)` detects CSV, TSV, delimited text, JSON, NDJSON, HTML tables, Markdown tables, and SpreadsheetML 2003 XML. Delimited imports can infer booleans, locale-aware numbers, percentages, currencies, and dates; use `{ inferTypes: false }` to keep fields as text. Legacy `.xls` files are supported only when they contain an HTML table. Binary Excel and ODS formats require an optional adapter.

Use `exportCSV()`, `exportTSV()`, `exportJSON()`, or `exportWorkbook()` as needed. Workbook JSON preserves formulas, values, formatting, dimensions, hidden rows and columns, table/filter state, variables, and sheet metadata. Freeze-pane and conditional-format rules are stored as metadata; their UI behavior is not implemented.

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
