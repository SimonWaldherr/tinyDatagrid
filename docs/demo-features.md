# Optional tools from the demo

The demo UI tools are reusable package subpaths. Import the modules you want and
their matching CSS; they work with an existing `TinyDatagrid` instance and do
not add controls to the page. Copy the corresponding markup from
[`demo/index.html`](../demo/index.html) and connect it to your own toolbar.

```js
import TinyDatagrid from 'tiny-datagrid';
import { installJSONTools } from 'tiny-datagrid/json-tools';
import { installSearch } from 'tiny-datagrid/search-tools';
import { installCharts } from 'tiny-datagrid/charts';
import { attachFormulaAssist, installFormulaTools } from 'tiny-datagrid/formula-assist';
import { exportPNG, printPDF } from 'tiny-datagrid/exporters';
import { featureTranslator } from 'tiny-datagrid/feature-i18n';
import 'tiny-datagrid/style.css';
import 'tiny-datagrid/themes.css';
import 'tiny-datagrid/json-tools.css';
import 'tiny-datagrid/search-tools.css';
import 'tiny-datagrid/charts.css';
import 'tiny-datagrid/formula-assist.css';

const grid = new TinyDatagrid('#sheet', { rows: 100, columns: 12 });
const $ = selector => document.querySelector(selector);
const t = featureTranslator('en');
const notify = message => { status.textContent = message; };
const selection = () => {
  const s = grid.selection;
  return { r1: Math.min(s.r1, s.r2), r2: Math.max(s.r1, s.r2),
    c1: Math.min(s.c1, s.c2), c2: Math.max(s.c1, s.c2) };
};
const showDialog = selector => { grid.commitEdit(); $(selector).showModal(); };

const search = installSearch({ grid, $, t, notify, selection });
const charts = installCharts({ grid, $, t, notify, selection });
const json = installJSONTools({ grid, $, t, notify, showDialog, selection });
grid.on('select', json.sync);
grid.on('change', json.sync);
grid.on('readonly', json.sync);
attachFormulaAssist(grid.editor, grid, { language: 'en' });
attachFormulaAssist($('#formula'), grid, { language: 'en' });
const formulaTools = installFormulaTools({ grid, $, t,
  language: () => 'en', formatValue: value => String(value ?? '') });

$('#downloadPng').onclick = async () => {
  const blob = await exportPNG(grid, selection());
  const link = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob), download: 'sheet.png'
  });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};
$('#printPdf').onclick = () => printPDF(grid, selection());
```

Use `featureTranslator(language)` for the JSON, search, and chart controls. It
includes German, English, French, Spanish, Italian, and Dutch labels; unknown
languages use English. Pass any `t(key)` function to supply another translation
system. `installSearch` keeps matches fresh while its bar is open and implements
Ctrl/Cmd+F and Ctrl+H. The chart helper reads the current visible selection,
creates an accessible SVG and table view, and can save SVG or PNG.

## Host markup

Each installer binds controls by ID. The demo markup is the complete reference
and includes labels, dialog semantics, and responsive structure.

- Search: `#findBtn`, `#searchBar`, `#search`, `#searchResult`, `#optCase`,
  `#optWhole`, `#optRegex`, `#previousMatch`, `#closeSearch`, `#toggleReplace`,
  `#replaceRow`, `#replaceText`, `#replaceOne`, and `#replaceAll`.
- Charts: `#chartBtn`, `#chartDialog`, `#closeChart`, `#chartType`,
  `#chartHeader`, `#chartLabels`, `#chartRange`, `#chartPlot`, `#chartStage`,
  `#chartTooltip`, `#chartLive`, `#chartNote`, `#chartTable`, `#chartTableBtn`,
  `#chartSvg`, and `#chartPng`.
- JSON tools: `#jsonEditBtn`, `#jsonTableBtn`, `#jsonSplitBtn`, `#typeStatus`,
  and the `#jsonDialog` controls `#jsonCell`, `#jsonFormulaNote`, `#jsonText`,
  `#jsonStatus`, `#jsonTree`, `#jsonPath`, `#jsonFormat`, `#jsonMinify`,
  `#jsonSaveCompact`, `#jsonAsValue`, `#jsonApply`, `#closeJson`,
  `#jsonCopyPath`, and `#jsonInsertGet`.
- Formula assistance attaches to any input or textarea. The grid's editor is
  `grid.editor`; a host formula bar can use the same `attachFormulaAssist()` API.
  Optional function help and precedent/dependent tracing use
  `#formulaHelpBtn`, `#formulaHelpPanel`, `#functionSearch`, `#functionList`,
  `#functionSignature`, `#functionDescription`, `#traceBtn`,
  `#dependencyPanel`, `#precedentsBtn`, `#dependentsBtn`, and `#referenceList`.

`$` resolves those selectors in your host UI; it may query within a toolbar or
dialog root. The JSON helper expects `showDialog(selector)` to open its dialog,
and `selection()` to return a normalized `{ r1, c1, r2, c2 }` range. Call
`json.sync()` after selection and cell changes to update its status chip and
buttons.

## Themes and visual exports

Load `tiny-datagrid/themes.css` to use the `data-theme` presets `light`, `dark`,
`ocean`, `paper`, `midnight`, `graphite`, and `contrast`; omit it if you define
your own `--tg-*` variables. Apply `data-theme` to the document root or a
containing element so both the grid and optional dialogs inherit the same
palette.

`exportPNG(grid, range?, { scale?, maxPixels? })` returns an `image/png` Blob;
the default scale is 2 and the default pixel cap is 16 million. `printPDF(grid,
range?)` opens a print-ready page and the browser print dialog, where the user
can choose Save as PDF. Both helpers render computed values and visible cells,
and respect the active theme, cell formatting, and conditional formatting.
They export the selected or used sheet area without the application's toolbar.
