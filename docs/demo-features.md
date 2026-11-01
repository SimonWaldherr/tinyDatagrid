# Optional tools from the demo

The demo UI tools are reusable package subpaths. Import the modules you want and
their matching CSS; they work with an existing `TinyDatagrid` instance.
Search, charts, JSON, data cleanup and rule tools bind existing controls. The
SQL, analysis and simulation helpers also create their own dialogs and buttons.
Copy the corresponding host markup from
[`demo/index.html`](../demo/index.html) and connect it to your own toolbar.

```js
import TinyDatagrid from "tiny-datagrid";
import { installJSONTools } from "tiny-datagrid/json-tools";
import { installSearch } from "tiny-datagrid/search-tools";
import { installCharts } from "tiny-datagrid/charts";
import {
  installDataTools,
  removeDuplicateRows,
  trimSpaces,
  splitTextToColumns,
} from "tiny-datagrid/data-tools";
import { installRuleTools } from "tiny-datagrid/rule-tools";
import {
  attachFormulaAssist,
  installFormulaTools,
} from "tiny-datagrid/formula-assist";
import { exportPNG, printPDF } from "tiny-datagrid/exporters";
import { featureTranslator } from "tiny-datagrid/feature-i18n";
import "tiny-datagrid/style.css";
import "tiny-datagrid/themes.css";
import "tiny-datagrid/json-tools.css";
import "tiny-datagrid/search-tools.css";
import "tiny-datagrid/charts.css";
import "tiny-datagrid/formula-assist.css";

const grid = new TinyDatagrid("#sheet", { rows: 100, columns: 12 });
const $ = (selector) => document.querySelector(selector);
const t = featureTranslator("en");
const status = document.createElement("output");
document.body.append(status);
const notify = (message) => {
  status.textContent = message;
};
const selection = () => {
  const s = grid.selection;
  return {
    r1: Math.min(s.r1, s.r2),
    r2: Math.max(s.r1, s.r2),
    c1: Math.min(s.c1, s.c2),
    c2: Math.max(s.c1, s.c2),
  };
};
const showDialog = (selector) => {
  grid.commitEdit();
  $(selector).showModal();
};

const search = installSearch({ grid, $, t, notify, selection });
const charts = installCharts({ grid, $, t, notify, selection });
const json = installJSONTools({ grid, $, t, notify, showDialog, selection });
const cleanup = installDataTools({ grid, $, t, notify, selection, showDialog });
const rules = installRuleTools({ grid, $, t, notify, selection, showDialog });
grid.on("select", json.sync);
grid.on("change", json.sync);
grid.on("readonly", json.sync);
attachFormulaAssist(grid.editor, grid, { language: "en" });
attachFormulaAssist($("#formula"), grid, { language: "en" });
const formulaTools = installFormulaTools({
  grid,
  $,
  t,
  language: () => "en",
  formatValue: (value) => String(value ?? ""),
});

$("#downloadPng").onclick = async () => {
  const blob = await exportPNG(grid, selection());
  const link = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: "sheet.png",
  });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};
$("#printPdf").onclick = () => printPDF(grid, selection());
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
- Data cleanup: `#dedupeBtn`, `#trimBtn`, `#splitTextBtn`, and the two dialogs:
  `#dedupeDialog` with `#dedupeForm`, `#closeDedupe`, `#dedupeIntro`, `#dedupeHeader`,
  `#dedupeCase`, `#dedupeColumns`; `#splitTextDialog` with `#splitForm`,
  `#closeSplitText`, `#splitIntro`, `#splitDelimiter`, `#splitCustom`,
  `#splitCollapse`, `#splitQuotes`, `#splitPreview`, `#splitApply`.
- Rules: `#cfBtn` and `#validationBtn`, and the dialogs `#cfDialog` (`#cfForm`, `#closeCf`,
  `#cfRange`, `#cfOperator`, `#cfValueField`, `#cfValueLabel`, `#cfValue`, `#cfMaxField`,
  `#cfMax`, `#cfStyles`, `#cfCustom`, `#cfFill`, `#cfTextColor`, `#cfBold`, `#cfList`,
  `#cfClear`) and `#validationDialog` (`#validationForm`, `#closeValidation`, `#vlRange`,
  `#vlType`, `#vlBounds`, `#vlMin`, `#vlMax`, `#vlValuesField`, `#vlValues`, `#vlKindField`,
  `#vlKind`, `#vlMessage`, `#vlEmpty`, `#vlFormula`, `#vlList`, `#vlClear`).
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
buttons. Add the `tg-json-chip` class to `#typeStatus` and `tg-json-dialog` to
the JSON dialog to apply the optional component styling.

## Demo and library parity

The demo uses the same implementations as the npm package. The compatibility
files under `demo/` re-export the public modules; they contain no separate
implementations. Each entry point has TypeScript declarations.

| Demo feature                                                                                  | Public library API                                                                               |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Editing, autofill, formatting, sorting, filters, history, virtualization, keyboard navigation | `tiny-datagrid` / `TinyDatagrid`                                                                 |
| CSV/TSV/HTML/Markdown/JSON/workbook import/export, share URLs                                 | `TinyDatagrid` import/export methods                                                             |
| Import type inference and preview                                                             | `tiny-datagrid/data-types`                                                                       |
| Exact numbers, dates, times and typed errors                                                  | `tiny-datagrid/values`                                                                           |
| JSON cell tools, charts, search, cleanup, rules, formula assistance                           | `json-tools`, `charts`, `search-tools`, `data-tools`, `rule-tools`, `formula-assist`             |
| Worksheets, tabs, menus, validation, frozen panes                                             | `worksheets`, `worksheet-tabs`, `cell-context-menu`, `list-dropdown`, `features`                 |
| Pivot creation, analysis scopes and source-record drill-through                               | `pivots`, `analysis`, `analysis-tools`                                                           |
| BI totals, grouped metrics and targets                                                        | `bi`                                                                                             |
| SQL queries, result tables, schema picker and SQL dialog                                      | `local-sql`, `sql-tools`                                                                         |
| Game of Life and Mandelbrot computation and interactive preview                               | `simulations`, `simulation-tools`                                                                |
| Heatmaps and saved object browser                                                             | `heatmap`, `object-browser`                                                                      |
| Autosave, recovery and unfinished edit restoration                                            | `autosave` / `installAutosave`                                                                   |
| Growth while scrolling near sheet edges                                                       | `sheet-growth` / `installSheetGrowth`                                                            |
| Input form generator and form dialog                                                          | `form-generator`, `form-ui`                                                                      |
| PNG/PDF/SVG exports                                                                           | `exporters`, `charts`                                                                            |
| Function catalog, help and provenance inspection                                              | `formula-catalog`, `function-help`, `formula-assist`, `TinyDatagrid.getPrecedents/getDependents` |
| Demo labels, language detection and sample workbooks                                          | `demo-i18n`, `sample-workbooks`                                                                  |

All table subpaths above are prefixed with `tiny-datagrid/`. Alternatively,
`tiny-datagrid/demo-tools` collects the SQL/analysis/simulation/object-browser
installers, autosave, growth, translations and sample workbooks. Load
`tiny-datagrid/demo-tools.css` for their shared optional component styles.

```js
import { installSQLTools, translator } from "tiny-datagrid/demo-tools";
import "tiny-datagrid/demo-tools.css";

const sqlTools = installSQLTools({
  grid,
  $,
  t: translator("en"),
  selection,
  notify,
  showSource: (data, range) => sourceViewer.show(data, range),
});
sqlTools.open("SELECT * FROM table1 LIMIT 100");
// Use localSQL for direct parameterized queries without UI.
sqlTools.dispose();
```

SQL requires the `localSQL()` plugin and a `#pivotBtn` host anchor. Its
`open(query?)`, `execute()`, `refreshLabels()` and `dispose()` methods are public.
`execute()` returns a result or null and displays errors in the dialog.
`showSource(data, range)` receives headers and source entries for drill-through.
Saving result tables additionally requires `worksheets()`.

Analysis tools require `analysisContext()`, `#chartRange` inside a
`.dialog-heading`, `#analysisHelpHost`, `#analysisScopeHost`,
`#pivotSecondaryActions` and `.tools-grid`. They expose
`show({ headers, entries }, range)` and `refreshLabels()`; pivot drill-through
uses `sheetPivots()`. The simulation installer needs `.tools-grid` and
`#demoContents`; `open("life" | "mandelbrot")` launches its preview. Insertion
requires worksheets and conditional formatting. The object browser uses
`#sheetObjectList`, `#inspector`, and `#inspector-objects-tab`, and receives an
`openChart({ range, chartType })` callback.

The UI helpers expose `dispose()` and clean themselves up when the grid is
destroyed. Use a translation callback such as `t: key => translator(language)(key)`
for a changeable language and call `refreshLabels()` after changing it.
The object browser instead refreshes through `render()`.

```js
import { installAutosave, installSheetGrowth } from "tiny-datagrid/demo-tools";

const saving = await installAutosave(grid, {
  key: "document-42",
  database: "my-workbooks",
  formula: document.querySelector("#formula"),
  status: (key) => notify(t(key)),
});
if (saving.restored) saving.restoreDraft();
const growth = installSheetGrowth(grid, {
  maxRows: 10000,
  maxColumns: 256,
  rowStep: 100,
  columnStep: 12,
});
// Before removing these integrations independently of the grid:
saving.dispose();
growth.dispose();
```

Autosave is explicit opt-in, needs a separate key per document, and installs
the IndexedDB plugin. It retains a synchronous recovery copy when IndexedDB
is unavailable. Growth does not add undo steps and pauses during editing,
read-only mode and external SQL sessions.

## Themes and visual exports

Load `tiny-datagrid/themes.css` to use the `data-theme` presets `light`, `dark`,
`ocean`, `paper`, `midnight`, `graphite`, and `contrast`; omit it if you define
your own `--tg-*` variables. Apply `data-theme` to the document root or a
containing element so both the grid and optional dialogs inherit the same
palette. With `system` (or no explicit theme), dark OS appearance uses Midnight.
The demo labels the existing `dark` preset “Forest green”; saved selections stay compatible.

`exportPNG(grid, range?, { scale?, maxPixels? })` returns an `image/png` Blob;
the default scale is 2 and the default pixel cap is 16 million. `printPDF(grid,
range?)` opens a print-ready page and the browser print dialog, where the user
can choose Save as PDF. Both helpers render computed values and visible cells,
and respect the active theme, cell formatting, and conditional formatting.
They export the selected or used sheet area without the application's toolbar.

The General ribbon tab groups AutoSum, charts, pivot tables, search, recalculation,
function help, cell references, and column fitting in a compact tools area.
Pivot opens the analysis dialog, where the summary can be inserted into the
sheet. Function help and references focus their respective panels for keyboard use.

## Data cleanup

`installDataTools` adds three commands that work on the selection (or on the block
of data around a single selected cell):

- **Remove duplicates** compares rows by their computed values and ignores outer spaces.
  Case is ignored too, unless you ask to match it. You can choose the columns and mark a header row. The first
  occurrence stays, later ones are removed, and the rows below move up inside the
  range; formulas and formats move with their row. It is one undo step and refuses
  ranges that contain spilled array results.
- **Clean up spaces** trims entered text, collapses runs of spaces and tabs, and turns
  non-breaking spaces into ordinary ones. Line breaks, formulas, numbers and JSON
  text stay as they are.
- **Text to columns** splits the text of the first selected column at a comma, semicolon,
  tab, space, `|` or any text you type, with a preview. Quoted parts stay together,
  consecutive delimiters can count as one, and the parts are typed like ordinary
  input (`31` becomes a number). If a cell on the right already has content nothing is
  changed.

The same operations are available without any UI: `removeDuplicateRows(grid, range,
{ columns, hasHeader, matchCase })`, `trimSpaces(grid, range)`, and
`splitTextToColumns(grid, range, { delimiter, collapse, quotes })`.

## Analysis and simulation demos

The inspector's **Data scope** selects all, visible, or captured selected rows for
pivot preview, newly inserted pivots, and charts. Pivot values open paginated source
records; inserted pivots offer **Source records** at the selected result cell.
Chart categories can filter the table; **Clear filters** resets these filters.
The **Heatmap** tool colors numeric selections without replacing their values.

**File → Demo contents** offers **Game of Life** and **Mandelbrot**. Simulations
open a separate interactive preview; inserting its result creates a new worksheet.
Life supports steps, playback and editable pixels. Mandelbrot provides adjustable
coordinates/iterations, worker progress, cancellation and optional cell formulas.
The reusable APIs and limits are documented in [Plugins](plugins.md).

## Analysis dialogs and compact tools

The analysis dialog is a modal workspace. The Pivot
button opens source-table selection and configuration next to the result preview;
the destination address can be entered directly. The Insights buttons open its
workbook-wide Objects tab. Chart views continue to use their own dialog.
The General ribbon keeps its tools on one line: AutoSum, Chart, Pivot and Find
are direct actions; More tools opens the remaining tools in an overlay.

Selection and compact counts sit above the tabs; the insertion target and actions
stay in the footer. Explanations are collapsed by default. The tabs support arrow
keys/Home/End; Escape closes the dialog.

## Pivot tables stay linked to their source

**Insert into sheet** creates a live pivot bound to the selected source _table_. The sheet
keeps the definition, so the result is more than pasted values:

- It refreshes with the table, including records typed directly below the table (the table
  grows by that row) and rows or columns inserted, deleted or moved. **Recalculate**, the
  dialog's **Refresh** and the cell menu's **Refresh pivot** recalculate it on demand.
- Selecting a result cell shows `Pivot · source …` in the status bar, the ribbon's Pivot
  button reads **Pivot settings**, and the results carry an outline and a tooltip.
- A double-click, Enter or F2 on a result, the cell menu's **Pivot settings …**, or the
  Pivot button opens the analysis dialog with that pivot's source table, fields,
  aggregate, destination and data scope. **Apply changes** updates the pivot in the sheet
  (one undo step); **Create a new pivot** leaves the edit mode. Fields beyond the ones the
  form shows (set through the API) are kept.
- The cell menu also has **Source records** and **Remove pivot**. Removing the source table
  keeps the pivot working on its last range.

The reusable API (`insert({ table })`, `update`, `recalculate`, `at`, `get`) is described in
[Plugins](plugins.md#pivot-tables-inside-the-sheet).

## Highlighting and input rules

`installRuleTools` adds two dialogs on top of the `conditionalFormatting()` and
`dataValidation()` plugins. Both work on a range that defaults to the selection (whole
columns such as `B:B` reach rows added later), and both list the rules of the sheet with a
button to delete each one. Every change is one undo step.

- **Conditional formatting** (General tab) highlights cells whose value is greater than, less
  than or equal to a value, between two values, contains a text, or is empty. Choose a
  ready-made look (each sets a fill _and_ a matching text color, so it reads on every theme)
  or your own colors. Newer rules take precedence; color scales from the Heatmap tool appear
  in the same list.
- **Input validation** (Data tab) allows whole numbers, numbers, text of a given length, JSON
  objects or arrays, or a list of choices, with optional bounds, empty cells and formulas
  allowed, and a message. Invalid input is refused with that message (a default one is
  generated in the current language); invalid values that are already there are marked.
  A rule for some cells replaces earlier rules on those cells and leaves them elsewhere.
  A choice list also gets an in-cell menu from the `listDropdown()` plugin: click the arrow of
  the active cell or press Alt+Down.

The helpers work without the dialogs: `parseRangeText`, `describeRange`, `subtractRange`,
`addConditionalFormat`, `removeConditionalFormat`, `setValidation` and `removeValidation`.

## Growing sheets and phone layout

The demo starts with 60 rows and 12 columns. Scrolling towards the bottom adds
100 empty rows; scrolling towards the right adds 12 columns. Growth preserves
cell contents, selection and undo history, and saves the new dimensions locally.
The demo stops adding space at 10,000 rows and 256 columns; larger imported
workbooks keep their existing dimensions. Read-only and SQL-bound sheets do not
expand automatically. Rendering is virtualized from the start.

On phones up to 560 CSS pixels wide, the ribbon starts collapsed. Tapping a tool
tab opens its panel; the arrow beside the tabs toggles it. The address, value or
formula, and Apply button occupy one row. Focusing the input reveals Cancel,
formula expansion, function help and references. The address keyboard offers Go.
The application can shrink below 480 pixels when the on-screen keyboard opens.

Below 361 CSS pixels, import and export remain available in the File tab, while
the header keeps the sheet name and Share button visible. Tool tabs scroll
horizontally if necessary.
