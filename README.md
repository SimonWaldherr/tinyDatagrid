# tinyDatagrid

A dependency-free browser spreadsheet in vanilla JavaScript. No build step.

## npm

```sh
npm install tiny-datagrid
```

```js
import TinyDatagrid from "tiny-datagrid";
import { worksheets } from "tiny-datagrid/worksheets";
import { localSQL } from "tiny-datagrid/local-sql";
import "tiny-datagrid/style.css";

const grid = new TinyDatagrid("#sheet", {
  rows: 100,
  columns: 12,
  plugins: [worksheets(), localSQL()],
});
```

The package provides ESM imports and TypeScript declarations for every public
module. All reusable demo functionality is available through the library,
including SQL/analysis dialogs, simulations, object browsing, autosave,
automatic sheet growth, translations and sample workbooks. See the
[demo/library API map](docs/demo-features.md#demo-and-library-parity).

## Quick start

Run `make run` and open the [demo](http://localhost:8080/demo/), or embed:

```html
<link rel="stylesheet" href="src/tinygrid.css" />
<div id="sheet" style="height:400px"></div>
<script type="module">
  import TinyDatagrid from "./src/tinygrid.js";
  const grid = new TinyDatagrid("#sheet", { rows: 100, columns: 12 });
  grid.load([
    ["Quantity", "Price", "Total"],
    [2, 10, "=A2*B2"],
  ]);
</script>
```

## Development

Core tests live in `test/`; the native prototype keeps its tests in `ios-prototype/tests/`.
Run `make help` for all targets. Common commands are `make test`, `make check`,
`make fmt`, `make benchmark`, and `make docs`. Set `PORT=3000` to change the demo
server port: `make run PORT=3000`.

Serving requires Python 3; tests and benchmarks require Node.js and npm.
Run `npm ci` to install the pinned development tools. `npm run release:check`
checks tests, types and installation from the npm tarball;
`npm run release:pack` produces the release archive in `dist/`.
See [npm release preparation](docs/release.md).
Formatting requires Prettier on your PATH, or a command override such as
`make fmt PRETTIER='npx prettier'`. Formatting is opt-in and rewrites the selected
source, test, and documentation files. Use `make fmt-check` to check without edits.

## Features

- Editing, autofill, sorting, filters, formatting, and delta-based undo/redo.
- Incremental formulas with dynamic array spills, JSON values, math, lookups, text/regex, geo, geometry, hashes, and randomness. Register your own JavaScript functions.
- Data import/export, pivots, SQL integration, and sharing through self-contained URL hashes.
- Keyboard navigation, accessibility semantics, DE/EN labels, dark mode, and virtualization.
- Sheet-only zoom (25–400%) and visible-selection statistics with sum, count,
  average, median, minimum and maximum; compact layouts expose the full summary.
- Sparse geometry for up to 10 million addressable rows and 32,768 columns;
  streaming range aggregates and cell-journal history. See [scalability](docs/scalability.md).
- [Asynchronous saving and export](docs/persistence-and-export.md) with coalesced autosave,
  bounded recovery, progress, cancellation and shared coordinate limits.
- **Opt-in tools:** theme presets, JSON editor, charts, find/replace, formula assistance, and PNG/PDF export.
- **Opt-in plugins:** frozen panes, conditional formatting, validation, worksheets, in-sheet pivots, and IndexedDB storage.
- **Basic BI:** scoped KPI summaries, target comparisons, ranked groups, and source-row drill-through via the optional [BI module](docs/bi.md).
- **Local SQL:** `SELECT` queries over worksheet tables, with filtering, grouping, aggregates, sorting, parameter binding, and `SELECT INTO Sheet2:A5` for result tables. See [local SQL](docs/local-sql.md).

Dynamic array formulas spill into adjacent cells; use `A1#` to refer to the full result. Cross-sheet references require the worksheets plugin. Binary Excel/ODS files require an adapter. Share links include hidden cells, but exclude custom function code and history.

The demo's reusable tools are optional package entry points. See the [tool integration guide](docs/demo-features.md) for setup, stylesheets, and the required host controls.

## Documentation

[Integration guide](docs/guide.md) · [Functions](docs/functions.md) · [JSON](docs/json.md) · [Dynamic arrays](docs/arrays.md) · [Plugins & benchmarks](docs/plugins.md) · [Demo tools](docs/demo-features.md) · [Types](src/tinygrid.d.ts)

[MIT License](LICENSE)

The [spreadsheet safety rules](docs/excel-safety.md) document exact decimal arithmetic, strict lookups, typed calendar/time/error values, formula protection and migration. The complete [formula reference](docs/formula-overview.md) includes the shared German, English, French and Italian aliases.

The [form generator](docs/form-generator.md) creates typed input forms from table headings and validation rules. Separate native iOS and Mac prototypes add local HTTP sharing and offline QR codes; those hosts are not included in this repository or the npm package.
