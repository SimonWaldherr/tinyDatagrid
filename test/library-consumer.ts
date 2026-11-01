import TinyDatagrid, {
  TinyGrid,
  FormulaEngine,
  type CellRange,
  type Workbook,
} from "tiny-datagrid";
import { localSQL, queryTables, type LocalSQL } from "tiny-datagrid/local-sql";
import { SQLClientAdapter } from "tiny-datagrid/sql-client";
import {
  businessIntelligence,
  type BusinessIntelligence,
} from "tiny-datagrid/bi";
import { worksheets, type Worksheets } from "tiny-datagrid/worksheets";
import { sheetPivots } from "tiny-datagrid/pivots";
import { analysisContext } from "tiny-datagrid/analysis";
import {
  conditionalFormatting,
  dataValidation,
  freezePanes,
} from "tiny-datagrid/features";
import { heatmapRule } from "tiny-datagrid/heatmap";
import { lifeStep, computeMandelbrot } from "tiny-datagrid/simulations";
import { inferDataValue, inferDelimitedRows } from "tiny-datagrid/data-types";
import {
  DecimalValue,
  CalendarDate,
  FormulaError,
  isFormulaError,
} from "tiny-datagrid/values";
import { installSQLTools } from "tiny-datagrid/sql-tools";
import { installAnalysisTools } from "tiny-datagrid/analysis-tools";
import { installSimulations } from "tiny-datagrid/simulation-tools";
import { installObjectBrowser } from "tiny-datagrid/object-browser";
import { installAutosave } from "tiny-datagrid/autosave";
import { installSheetGrowth } from "tiny-datagrid/sheet-growth";
import { demoWorkbook } from "tiny-datagrid/sample-workbooks";
import { translator, detectLanguage } from "tiny-datagrid/demo-i18n";
import * as demoTools from "tiny-datagrid/demo-tools";
import { generateForm, appendFormResponse } from "tiny-datagrid/form-generator";
import { openFormGenerator } from "tiny-datagrid/form-ui";
import { installCharts } from "tiny-datagrid/charts";
import { featureTranslator } from "tiny-datagrid/feature-i18n";
import "tiny-datagrid/style.css";
import "tiny-datagrid/demo-tools.css";

const grid: TinyDatagrid = new TinyGrid("#grid", {
  rows: 100,
  columns: 12,
  plugins: [
    worksheets(),
    localSQL(),
    businessIntelligence(),
    analysisContext(),
    sheetPivots(),
    conditionalFormatting(),
    dataValidation(),
    freezePanes(),
  ],
});
const range: CellRange = { r1: 0, c1: 0, r2: 3, c2: 2 };
const host = {
  grid,
  $: (selector: string) => document.querySelector(selector),
  t: translator(detectLanguage(["de-DE"])),
  notify: (message: string) => console.log(message),
  selection: () => range,
};
const sql = grid.feature<LocalSQL>("sql")!;
const result = sql.query(
  "SELECT * FROM table1 ORDER BY 1 NULLS FIRST LIMIT ? OFFSET ?",
  [50, 0],
);
sql.materialize(result, { sheetName: "Result" });
sql.write(result, { sheetName: "Result", cell: "A5", activate: false });
queryTables(grid, "SELECT COUNT(*) FROM table1");
const sqlUI = installSQLTools({
  ...host,
  showSource: (data, source) => {
    data.entries[0]?.record;
    source.c1;
  },
});
sqlUI.open("SELECT * FROM table1");
sqlUI.execute()?.drill(0);
sqlUI.refreshLabels();
sqlUI.dispose();
const analysisUI = installAnalysisTools({ ...host, refresh: () => {} });
analysisUI.show(
  { headers: ["x"], entries: [{ row: 1, record: { x: 1 } }] },
  range,
);
analysisUI.dispose();
const simulation = installSimulations(host);
simulation.open("mandelbrot");
simulation.refreshLabels();
simulation.dispose();
installObjectBrowser({
  ...host,
  openChart: (options) => options.range.c1,
}).dispose();
installSheetGrowth(grid, { maxRows: 2000000, maxColumns: 16384 }).dispose();
installAutosave(grid, {
  key: "document",
  status: (state) => host.notify(state),
}).then((api) => {
  api.restoreDraft();
  void api.save();
  api.dispose();
});
demoTools.installSheetGrowth(grid).dispose();
const workbook: Workbook = demoWorkbook("budget", "de");
grid.importWorkbook(workbook);
grid.exportWorkbook({ computedValues: false });
grid.setCell(1, 0, DecimalValue.parse("0.1"));
grid.setCell(1, 1, CalendarDate.parse("2026-10-04"));
grid.setConditionalFormats([heatmapRule(range, { min: 0, max: 1 })]);
grid.formatSelection({ type: "percent" });
grid.setColumnFilter(0, ["a"]);
grid.clearFilters();
grid.sortTable(0, "desc");
grid.exportCSV({ computed: true });
grid.exportJSON({ range });
grid.exportHTML();
const info = inferDataValue("00123");
info.type;
inferDelimitedRows([["id"], ["00123"]], { locale: "de-DE" }).textCells;
grid.feature<Worksheets>("worksheets")!.listObjects();
grid
  .feature<BusinessIntelligence>("bi")!
  .summarize(range, { metrics: [{ id: "Rows", aggregate: "count" }] });
new FormulaEngine(grid).evaluateValue("=SUM(1;2)");
const spill = grid.getSpill(1, 1);
if (isFormulaError(spill)) {
  const error: FormulaError = spill;
  error.code;
}
lifeStep([0, 1, 0, 1], 2, 2);
void computeMandelbrot({ rows: 2, columns: 2 });
const form = generateForm(grid);
appendFormResponse(grid, form, {});
openFormGenerator({ grid });
installCharts({
  ...host,
  $: (selector) => document.querySelector<HTMLElement>(selector)!,
});
featureTranslator("de")("localSQLRun");
const adapter = new SQLClientAdapter(grid, {
  query: async () => ({ columns: ["x"], rows: [[1]] }),
});
void adapter.query("SELECT x FROM source");

// Incorrect public API usage must fail even with legacy grid extension fields.
// @ts-expect-error Local SQL parameters are positional arrays.
sql.query("SELECT * FROM table1", { limit: 50 });
// @ts-expect-error Simulations expose exactly these two preview modes.
simulation.open("other");
// @ts-expect-error Sample workbook names are checked.
demoWorkbook("missing");
// @ts-expect-error Heatmaps need a source rectangle.
grid.setConditionalFormats([{ type: "colorScale", min: 0, max: 1 }]);
