# tinyDatagrid

A dependency-free browser spreadsheet in vanilla JavaScript. No build step.

## Quick start

Run `python3 -m http.server 8080` and open the [demo](http://localhost:8080/demo/), or embed:

```html
<link rel="stylesheet" href="src/tinygrid.css">
<div id="sheet" style="height:400px"></div>
<script type="module">
  import TinyDatagrid from './src/tinygrid.js';
  const grid = new TinyDatagrid('#sheet', { rows: 100, columns: 12 });
  grid.load([['Quantity', 'Price', 'Total'], [2, 10, '=A2*B2']]);
</script>
```

## Features

- Editing, autofill, sorting, filters, formatting, and delta-based undo/redo.
- Incremental formulas with dynamic array spills, JSON values, math, lookups, text/regex, geo, geometry, hashes, and randomness. Register your own JavaScript functions.
- Data import/export, pivots, SQL integration, and sharing through self-contained URL hashes.
- Keyboard navigation, accessibility semantics, DE/EN labels, dark mode, and virtualization.
- **Opt-in tools:** theme presets, JSON editor, charts, find/replace, formula assistance, and PNG/PDF export.
- **Opt-in plugins:** frozen panes, conditional formatting, validation, worksheets, in-sheet pivots, and IndexedDB storage.

Dynamic array formulas spill into adjacent cells; use `A1#` to refer to the full result. Cross-sheet references require the worksheets plugin. Binary Excel/ODS files require an adapter. Share links include hidden cells, but exclude custom function code and history.

The demo's reusable tools are optional package entry points. See the [tool integration guide](docs/demo-features.md) for setup, stylesheets, and the required host controls.

## Documentation

[Integration guide](docs/guide.md) · [Functions](docs/functions.md) · [Plugins & benchmarks](docs/plugins.md) · [Types](src/tinygrid.d.ts)

[MIT License](LICENSE)
