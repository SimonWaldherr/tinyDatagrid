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
- Incremental formulas: math, lookups, text/regex, geo, geometry, hashes, and randomness. Register your own JavaScript functions.
- Data import/export, pivots, SQL integration, and sharing through self-contained URL hashes.
- Keyboard navigation, accessibility semantics, DE/EN labels, dark mode, and virtualization.
- **Opt-in plugins:** frozen panes, conditional formatting, validation, worksheets, and IndexedDB storage.

Array formulas do not spill; cross-sheet references are not supported. Binary Excel/ODS files require an adapter. Share links include hidden cells, but exclude custom function code and history.

## Documentation

[Integration guide](docs/guide.md) · [Functions](docs/functions.md) · [Plugins & benchmarks](docs/plugins.md) · [Types](src/tinygrid.d.ts)

[MIT License](LICENSE)
