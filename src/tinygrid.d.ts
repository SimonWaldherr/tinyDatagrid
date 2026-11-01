/** Provenance ranges are structural inputs, including filters/grouping, rather than exact value attribution. */
export interface CellLineage {
  kind: string;
  sources: Array<CellRange & { sheetId: string | null }>;
  query?: string;
}
export interface TraceOptions {
  recursive?: boolean;
}
export type SQLColumnMetadata = {
  name: string;
  type?: string;
  nullable?: boolean;
  primaryKey?: boolean;
  isPrimaryKey?: boolean;
  readOnly?: boolean;
  isReadOnly?: boolean;
  defaultValue?: unknown;
  precision?: number;
  scale?: number;
  [metadata: string]: unknown;
};

export type SQLResultSet<Row = Record<string, unknown> | unknown[]> = {
  columns: Array<string | SQLColumnMetadata>;
  rows: Row[];
  rowCount?: number;
  hasMore?: boolean;
  nextCursor?: unknown;
  queryId?: string;
  tableName?: string;
  keyColumns?: string[];
  primaryKey?: string[];
  metadata?: Record<string, unknown>;
};

export type SQLPendingChanges = {
  updates: Array<{
    key: Record<string, unknown>;
    original: Record<string, unknown>;
    changes: Record<string, unknown>;
  }>;
  inserts: Array<{ clientId: string; record: Record<string, unknown> }>;
  deletes: Array<{
    key: Record<string, unknown>;
    original: Record<string, unknown>;
    clientId: string;
  }>;
};

export type CellRange = { r1: number; c1: number; r2: number; c2: number };
export type NumberFormat =
  string | ({ type?: string } & Record<string, unknown>);
export interface GridCell {
  raw: unknown;
  style?: Partial<CSSStyleDeclaration>;
  numberFormat?: NumberFormat | null;
  valueType?: string;
  className?: string;
  [key: string]: unknown;
}
export interface WorkbookCell {
  row: number;
  col: number;
  value?: unknown;
  formula?: string;
  style?: Partial<CSSStyleDeclaration>;
  numberFormat?: NumberFormat | null;
  valueType?: string;
  [key: string]: unknown;
}
export interface WorkbookDimensions {
  rows: number;
  columns: number;
  rowHeights?: number[];
  defaultRowHeight?: number;
  rowHeightOverrides?: Array<[number, number]>;
  columnWidths?: number[];
  hiddenRows?: number[];
  hiddenColumns?: number[];
}
export interface WorkbookSheet {
  id?: string;
  name?: string;
  cells: WorkbookCell[];
  dimensions?: WorkbookDimensions;
  hidden?: boolean;
  tabColor?: string;
  [key: string]: unknown;
}
export interface Workbook {
  format: "tinyDatagrid-workbook";
  version: number;
  activeSheetId?: string;
  sheets?: WorkbookSheet[];
  cells?: WorkbookCell[];
  dimensions?: WorkbookDimensions;
  [key: string]: unknown;
}
export interface WorkbookOptions {
  values?: boolean;
  formulas?: boolean;
  formatting?: boolean;
  dimensions?: boolean;
  computedValues?: boolean;
}
export interface ExportOptions {
  range?: CellRange;
  computed?: boolean;
}
export interface WorkbookImportResult {
  cells: number;
  rows: number;
  columns: number;
}
export interface ColorScaleRule {
  type: "colorScale";
  range: CellRange;
  min?: number;
  max?: number;
  colors?: string[];
  stopIfTrue?: boolean;
}
/** Synchronous host-provided callback. Ranges arrive as two-dimensional arrays. */
export type SpreadsheetFunction = (...args: any[]) => unknown;
export type SpreadsheetFunctions = Record<string, SpreadsheetFunction>;
export interface TinyDatagridOptions {
  rows?: number;
  columns?: number;
  rowHeight?: number;
  columnWidth?: number;
  headerWidth?: number;
  headerHeight?: number;
  locale?: string;
  ariaLabel?: string;
  sheetName?: string;
  data?: unknown[][];
  variables?: Record<string, unknown>;
  readOnly?: boolean;
  virtualization?: boolean;
  virtualizationOverscan?: number;
  tableAutoExpand?: boolean;
  maxSpillCells?: number;
  functionHelp?: Record<
    string,
    import("./function-help.js").FunctionDescription
  >;
  protectFormulas?: boolean;
  dataLocale?: string;
  dateParsing?: DateParsing;
  columnTypes?: Record<number, string>;
  functions?: SpreadsheetFunctions;
  historyLimit?: number;
  /** Maximum cells in a materialized range (default 1,000,000). Streaming aggregates are exempt. */
  maxRangeCells?: number;
  plugins?: GridPlugin[];
  externalVariables?: Record<string, unknown>;
}
export interface ExportProgress {
  phase: "snapshot" | "encode" | "rows";
  completed: number;
  /** Absent when the final encoded byte count is not known yet. */
  total?: number;
}
export interface AsyncOptions {
  signal?: AbortSignal;
  batchSize?: number;
  onProgress?: (progress: ExportProgress) => void;
}
export interface AsyncWorkbookOptions extends WorkbookOptions, AsyncOptions {}
export class WorkbookChangedError extends Error {
  constructor();
  readonly code: "WORKBOOK_CHANGED";
}
export { gridLimits, GridLimitError } from "./limits.js";
export type DateParsing = "iso" | "locale" | false;
export type DelimitedImportOptions = {
  startRow?: number;
  startCol?: number;
  replace?: boolean;
  delimiter?: string;
  inferTypes?: boolean;
  locale?: string;
  dateParsing?: DateParsing;
  headerRow?: number;
};

export interface GridPlugin<T = unknown> {
  name: string;
  setup(grid: TinyDatagrid): T & { destroy?: () => void };
}
export type ConditionalRule = {
  range: CellRange;
  operator:
    | "eq"
    | "ne"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "between"
    | "contains"
    | "empty"
    | "notEmpty";
  value?: unknown;
  max?: number;
  style: Partial<
    Pick<
      CSSStyleDeclaration,
      | "backgroundColor"
      | "color"
      | "fontWeight"
      | "fontStyle"
      | "textDecoration"
      | "textAlign"
    >
  >;
  stopIfTrue?: boolean;
};
export type ValidationRule = {
  range: CellRange;
  type: "number" | "integer" | "list" | "textLength" | "json";
  kind?: "object" | "array";
  min?: number;
  max?: number;
  values?: Array<string | number | boolean>;
  allowEmpty?: boolean;
  allowFormula?: boolean;
  message?: string;
};

export type FindOptions = {
  matchCase?: boolean;
  wholeCell?: boolean;
  regex?: boolean;
  scope?: "formulas" | "values" | "both";
  range?: CellRange | null;
  visibleOnly?: boolean;
  limit?: number;
};
export type SpillRange = {
  row: number;
  col: number;
  rows: number;
  cols: number;
};

export class TinyDatagrid {
  constructor(container: string | Element, options?: TinyDatagridOptions);
  readonly options: TinyDatagridOptions;
  rowCount: number;
  colCount: number;
  sheetName: string;
  selection: CellRange;
  anchor: { row: number; col: number };
  el: HTMLElement;
  editor: HTMLTextAreaElement;
  scroll: HTMLElement;
  engine: FormulaEngine;
  conditionalFormats: Array<ConditionalRule | ColorScaleRule>;
  validationRules: ValidationRule[];
  hiddenRows: Set<number>;
  hiddenColumns: Set<number>;
  getCell(row: number, col: number): GridCell;
  getRawValue(row: number, col: number): unknown;
  getComputedValue(row: number, col: number): unknown;
  setCell(
    row: number,
    col: number,
    value: unknown,
    meta?: Partial<GridCell>,
  ): boolean;
  isCellReadOnly(row: number, col: number): boolean;
  ensureSize(rows: number, columns: number): boolean;
  load(data: unknown[][], startRow?: number, startCol?: number): void;
  select(row: number, col: number, extend?: boolean): void;
  goTo(row: number, col: number): void;
  edit(row?: number, col?: number, initial?: string | null): void;
  commitEdit(cancel?: boolean): false | void;
  emit(type: string, detail?: unknown): void;
  setVariable(name: string, value: unknown): void;
  getVariable(name: string): unknown;
  formatSelection(format: NumberFormat | null): void;
  formatValue(value: unknown, format?: NumberFormat | null): string;
  setRowHeight(row: number, height: number): void;
  setColumnWidth(col: number, width: number): void;
  autoFitRow(row: number): number;
  autoFitColumn(col: number): number;
  hideRow(row: number): boolean;
  hideColumn(col: number): boolean;
  showAllRows(): boolean;
  showAllColumns(): boolean;
  insertRow(row: number): this | { row: number; clientId: string };
  insertColumn(col: number): this | false;
  deleteRow(row: number): boolean;
  deleteColumn(col: number): boolean;
  clearRow(row: number): boolean;
  clearColumn(col: number): boolean;
  setColumnFilter(col: number, values: unknown[] | null): boolean;
  clearFilters(): boolean;
  sortTable(col: number, direction?: "asc" | "desc"): boolean;
  getUsedRange(): CellRange;
  toArray(range?: CellRange, computed?: boolean): unknown[][];
  toRecords(options?: {
    headerRow?: number;
    startRow?: number;
    startCol?: number;
    endRow?: number;
    endCol?: number;
    visibleOnly?: boolean;
  }): Record<string, unknown>[];
  pivot(config: Record<string, unknown>): ReturnType<typeof PivotEngine.pivot>;
  exportCSV(options?: ExportOptions & { delimiter?: string }): string;
  exportTSV(options?: ExportOptions): string;
  exportHTML(options?: ExportOptions): string;
  exportMarkdown(options?: ExportOptions): string;
  exportJSON(
    options?: ExportOptions & { headerRow?: number },
  ): Record<string, unknown>[];
  exportWorkbook(options?: WorkbookOptions): Workbook;
  /** Yield between batches; reject if the workbook changes during capture. Defaults to computedValues: false. */
  exportWorkbookAsync(options?: AsyncWorkbookOptions): Promise<Workbook>;
  importWorkbook(
    input: Workbook | string,
    options?: WorkbookOptions & {
      replace?: boolean;
      startRow?: number;
      startCol?: number;
    },
  ): WorkbookImportResult | false;
  importJSON(
    input: unknown,
    options?: DelimitedImportOptions & { headers?: string[] },
  ): { rows: number; headers: string[] } | WorkbookImportResult | false;
  importHTML(markup: string, options?: DelimitedImportOptions): number;
  importMarkdown(markdown: string, options?: DelimitedImportOptions): number;
  importSpreadsheetXML(
    xml: string,
    options?: DelimitedImportOptions,
  ): number | WorkbookImportResult | false;
  getCalculationValue(row: number, col: number): unknown;
  getCalculationState(options?: { settle?: boolean }): {
    phase: "calculating" | "pending" | "ready";
    revision: number;
    calculatedAt: string;
    errors: number;
  };
  getCellInfo(
    row: number,
    col: number,
  ): {
    address: string;
    raw: unknown;
    original: unknown;
    value: unknown;
    exact: string;
    display: string;
    type: string;
    error: { code: string; message: string } | null;
    formula: boolean;
    displayDiffers: boolean;
  };
  replaceFormulaWithValue(row: number, col: number, value?: unknown): boolean;
  use(plugin: GridPlugin): this;
  feature<T = unknown>(name: string): T | undefined;
  removePlugin(name: string): boolean;
  setFreezePanes(panes?: { rows?: number; columns?: number }): this;
  setConditionalFormats(rules?: Array<ConditionalRule | ColorScaleRule>): this;
  setValidationRules(rules?: ValidationRule[]): this;
  readonly readOnly: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly historyState: { undo: number; redo: number };
  undo(): boolean;
  redo(): boolean;
  clearHistory(): this;
  /** Group synchronous edits into one undo step. Nested calls are supported. */
  transaction<T>(callback: (grid: this) => T): T;
  /** Begin a group spanning a pointer gesture; always balance with endHistory. */
  beginHistory(): this;
  endHistory(): this;
  setSheetName(name: string): this;
  clearSelection(): boolean;
  moveRange(source: CellRange, destRow: number, destCol: number): boolean;
  getOriginalValue(row: number, col: number): unknown;
  setCellLineage(
    row: number,
    col: number,
    lineage: CellLineage | null,
  ): boolean;
  getPrecedents(
    row?: number,
    col?: number,
    options?: TraceOptions,
  ): Array<{
    kind?: string;
    text: string;
    sheet?: string;
    sheetId: string | null;
    a: { row: number; col: number; ac: string; ar: string };
    b: { row: number; col: number; ac: string; ar: string };
    range: boolean;
  }>;
  getDependents(
    row?: number,
    col?: number,
    options?: TraceOptions,
  ): Array<{
    kind?: string;
    sheetId: string | null;
    sheet: string;
    row: number;
    col: number;
    address: string;
    formula: string;
  }>;
  /** Move to the next visible cell; false at the sheet boundary. */
  moveSelection(
    direction: "up" | "down" | "left" | "right",
    extend?: boolean,
  ): boolean;
  /** Current active table; choose one explicitly or by selecting one of its cells. */
  listTables(): Array<{
    id: string;
    name: string;
    r1: number;
    c1: number;
    r2: number;
    c2: number;
    headerRow: number;
    style: string;
    includeEmptyRows?: boolean;
    filters: Array<{ column: number; values: string[] }>;
  }>;
  tableAt(
    row: number,
    col: number,
  ):
    | (Omit<ReturnType<TinyDatagrid["listTables"]>[number], "filters"> & {
        filters: Map<number, Set<string>>;
      })
    | null;
  createTable(
    range?: CellRange,
    options?: {
      headerRow?: number;
      style?: string;
      name?: string;
      includeEmptyRows?: boolean;
    },
  ): this | false;
  activateTable(id: string): this;
  removeTable(id?: string): boolean;
  listObjects(): Array<{
    id: string;
    type: "table" | "pivot" | "chart" | "heatmap";
    name: string;
    range: CellRange;
    chartType?: string;
  }>;
  saveVisualization(options: {
    name?: string;
    range: CellRange;
    chartType?: string;
  }): string | false;
  removeVisualization(id: string): this | false;
  isTableRowVisible(row: number, col: number): boolean;
  /** Clear cached results, including random values, and refresh formulas and filters. */
  recalculate(options?: { full?: boolean }): this;
  setExternalVariable(
    name: string,
    value: unknown,
    options?: { recalculate?: boolean },
  ): this;
  setExternalVariables(
    values: Record<string, unknown>,
    options?: { recalculate?: boolean },
  ): this;
  removeExternalVariable(
    name: string,
    options?: { recalculate?: boolean },
  ): boolean;
  registerFunction(name: string, fn: SpreadsheetFunction): this;
  registerFunctions(functions: SpreadsheetFunctions): this;
  unregisterFunction(name: string): boolean;
  setReadOnly(readOnly?: boolean): this;
  /** UI language and default number/date formatting locale. */
  setLocale(locale?: string): this;
  styleSelection(style?: Partial<CSSStyleDeclaration>): boolean;
  createShareURL(baseURL?: string): string;
  importShareHash(hash?: string): {
    cells: number;
    rows: number;
    columns: number;
  };
  setVirtualization(enabled?: boolean): this;
  /** Cells matching text in their entered content ('formulas'), their result ('values') or either, in reading order. */
  find(
    query: string,
    options?: FindOptions,
  ): Array<{ row: number; col: number }>;
  /** Replace text in matching cells' entered content as one undo step. */
  replace(
    query: string,
    replacement: string,
    options?: Omit<FindOptions, "scope" | "limit">,
  ): { count: number; cells: number };
  /** The whole result of the formula in a cell (what `A1#` reads); a one-cell range for ordinary cells. */
  getSpill(
    row: number,
    col: number,
  ): unknown[][] | import("./values.js").FormulaError;
  /** Rectangles currently filled by formulas that return several cells. */
  getSpillRanges(): SpillRange[];
  loadRecords(
    records: Record<string, unknown>[],
    options?: {
      headers?: string[];
      includeHeaders?: boolean;
      startRow?: number;
      startCol?: number;
    },
  ): { rows: number; headers: string[] };
  importCSV(text: string, options?: DelimitedImportOptions): number;
  importDelimited(text: string, options?: DelimitedImportOptions): number;
  importNDJSON(
    text: string,
    options?: {
      startRow?: number;
      startCol?: number;
      replace?: boolean;
      inferTypes?: boolean;
      locale?: string;
      dateParsing?: DateParsing;
    },
  ): number;
  importFile(file: File, options?: DelimitedImportOptions): Promise<unknown>;
  fill(
    source: CellRange,
    target: CellRange,
    options?: { mode?: "series" | "repeat" },
  ): boolean;
  fillDownToContiguousData(source?: CellRange): boolean;
  loadResultSet(
    result: SQLResultSet,
    options?: {
      tableName?: string;
      keyColumns?: string[];
      editableColumns?: string[];
      readOnly?: boolean;
      replace?: boolean;
    },
  ): { rows: number; totalRows: number; columns: SQLColumnMetadata[] };
  appendResultPage(result: SQLResultSet): {
    rows: number;
    loadedRows: number;
    fetchedRows: number;
    totalRows: number;
    hasMore: boolean;
    nextCursor: unknown;
  };
  getSQLMetadata(): null | {
    tableName: string | null;
    columns: SQLColumnMetadata[];
    keyColumns: string[];
    editableColumns: string[] | null;
    loadedRows: number;
    fetchedRows: number;
    totalRows: number;
    hasMore: boolean;
    nextCursor: unknown;
    queryId: string | null;
    metadata: Record<string, unknown> | null;
    readOnly: boolean;
  };
  getDataChanges(): SQLPendingChanges;
  insertRecord(record: Record<string, unknown>): {
    row: number;
    clientId: string;
  };
  deleteRecord(rowIndex: number): boolean;
  acceptDataChanges(options?: {
    keyMap?: Record<string, unknown> | Map<string, unknown>;
    recordsByClientId?:
      | Record<string, Record<string, unknown>>
      | Map<string, Record<string, unknown>>;
  }): boolean;
  on(type: string, listener: (detail: any) => void): () => void;
  destroy(options?: { clear?: boolean }): void;
}

export { TinyDatagrid as TinyGrid };
export function parseA1(ref: string): { row: number; col: number } | null;
export function toA1(row: number, col: number): string;
export function colToName(index: number): string;
export function nameToCol(name: string): number;
export function parseCSV(text: string, delimiter?: string): string[][];
export function detectDelimiter(text: string): string;
export function parseMarkdownTable(text: string): string[][];
export function stringifyCSV(rows: unknown[][], delimiter?: string): string;
export class FormulaEngine {
  constructor(grid: TinyDatagrid);
  registerFunction(name: string, fn: SpreadsheetFunction): this;
  registerFunctions(functions: SpreadsheetFunctions): this;
  unregisterFunction(name: string): boolean;
  evaluateValue(formula: string): unknown;
  evaluateFormula(formula: string): unknown;
}
export class PivotEngine {
  static fromArray(
    source: unknown[][],
    rowField: string,
    valueField: string,
    aggregate?: string,
    columnField?: string,
  ): unknown[][] | string;
  static pivot(
    data: Record<string, unknown>[],
    config?: Record<string, unknown>,
  ): any;
}
export default TinyDatagrid;
