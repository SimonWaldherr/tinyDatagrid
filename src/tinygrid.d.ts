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
  updates: Array<{ key: Record<string, unknown>; original: Record<string, unknown>; changes: Record<string, unknown> }>;
  inserts: Array<{ clientId: string; record: Record<string, unknown> }>;
  deletes: Array<{ key: Record<string, unknown>; original: Record<string, unknown>; clientId: string }>;
};

export type CellRange = { r1: number; c1: number; r2: number; c2: number };
/** Synchronous host-provided callback. Ranges arrive as two-dimensional arrays. */
export type SpreadsheetFunction = (...args: any[]) => unknown;
export type SpreadsheetFunctions = Record<string, SpreadsheetFunction>;
export type TinyDatagridOptions = Record<string, unknown> & { protectFormulas?: boolean; dataLocale?: string; dateParsing?: DateParsing; columnTypes?: Record<number,string>; functions?: SpreadsheetFunctions; historyLimit?: number; plugins?: GridPlugin[]; externalVariables?: Record<string, unknown> };
export type DateParsing = 'iso' | 'locale' | false;
export type DelimitedImportOptions = { startRow?: number; startCol?: number; replace?: boolean; delimiter?: string; inferTypes?: boolean; locale?: string; dateParsing?: DateParsing; headerRow?: number };

export interface GridPlugin<T = any> { name: string; setup(grid: TinyDatagrid): T & { destroy?: () => void }; }
export type ConditionalRule = { range: CellRange; operator: 'eq'|'ne'|'gt'|'gte'|'lt'|'lte'|'between'|'contains'|'empty'|'notEmpty'; value?: unknown; max?: number; style: Partial<Pick<CSSStyleDeclaration,'backgroundColor'|'color'|'fontWeight'|'fontStyle'|'textDecoration'|'textAlign'>>; stopIfTrue?: boolean };
export type ValidationRule = { range: CellRange; type: 'number'|'integer'|'list'|'textLength'|'json'; kind?: 'object'|'array'; min?: number; max?: number; values?: Array<string|number|boolean>; allowEmpty?: boolean; allowFormula?: boolean; message?: string };

export type FindOptions = { matchCase?: boolean; wholeCell?: boolean; regex?: boolean; scope?: 'formulas'|'values'|'both'; range?: CellRange | null; visibleOnly?: boolean; limit?: number };
export type SpillRange = { row: number; col: number; rows: number; cols: number };

export class TinyDatagrid {
  constructor(container: string | Element, options?: TinyDatagridOptions);
  [key: string]: any;
  getCalculationValue(row:number,col:number): unknown;
  getCalculationState(options?:{settle?:boolean}): {phase:'calculating'|'pending'|'ready';revision:number;calculatedAt:string;errors:number};
  getCellInfo(row:number,col:number): {address:string;raw:unknown;original:unknown;value:unknown;exact:string;display:string;type:string;error:{code:string;message:string}|null;formula:boolean;displayDiffers:boolean};
  replaceFormulaWithValue(row:number,col:number,value?:unknown): boolean;
  use(plugin: GridPlugin): this;
  feature<T = any>(name: string): T | undefined;
  removePlugin(name: string): boolean;
  setFreezePanes(panes?: {rows?: number; columns?: number}): this;
  setConditionalFormats(rules?: ConditionalRule[]): this;
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
  getPrecedents(row?: number, col?: number): Array<{text: string; sheet?: string; sheetId: string|null; a: {row:number;col:number;ac:string;ar:string}; b: {row:number;col:number;ac:string;ar:string}; range: boolean}>;
  getDependents(row?: number, col?: number): Array<{sheetId:string|null;sheet:string;row:number;col:number;address:string;formula:string}>;
  /** Move to the next visible cell; false at the sheet boundary. */
  moveSelection(direction: 'up' | 'down' | 'left' | 'right', extend?: boolean): boolean;
  /** Current active table; choose one explicitly or by selecting one of its cells. */
  listTables(): Array<{id:string;name:string;r1:number;c1:number;r2:number;c2:number;headerRow:number;style:string;filters:Array<{column:number;values:string[]}>}>;
  tableAt(row:number,col:number): (Omit<ReturnType<TinyDatagrid['listTables']>[number], 'filters'> & {filters:Map<number,Set<string>>}) | null;
  createTable(range?:CellRange,options?:{headerRow?:number;style?:string;name?:string}):this|false;
  activateTable(id:string): this;
  removeTable(id?:string): boolean;
  listObjects(): Array<{id:string;type:'table'|'pivot'|'chart'|'heatmap';name:string;range:CellRange;chartType?:string}>;
  saveVisualization(options:{name?:string;range:CellRange;chartType?:string}):string|false;
  removeVisualization(id:string):this|false;
  isTableRowVisible(row:number,col:number):boolean;
  /** Clear cached results, including random values, and refresh formulas and filters. */
  recalculate(options?: { full?: boolean }): this;
  setExternalVariable(name: string, value: unknown, options?: { recalculate?: boolean }): this;
  setExternalVariables(values: Record<string, unknown>, options?: { recalculate?: boolean }): this;
  removeExternalVariable(name: string, options?: { recalculate?: boolean }): boolean;
  registerFunction(name: string, fn: SpreadsheetFunction): this;
  registerFunctions(functions: SpreadsheetFunctions): this;
  unregisterFunction(name: string): boolean;
  setReadOnly(readOnly?: boolean): this;
  /** UI language and default number/date formatting locale. */
  setLocale(locale?: string): this;
  styleSelection(style?: Partial<CSSStyleDeclaration>): boolean;
  createShareURL(baseURL?: string): string;
  importShareHash(hash?: string): { cells: number; rows: number; columns: number };
  setVirtualization(enabled?: boolean): this;
  /** Cells matching text in their entered content ('formulas'), their result ('values') or either, in reading order. */
  find(query: string, options?: FindOptions): Array<{ row: number; col: number }>;
  /** Replace text in matching cells' entered content as one undo step. */
  replace(query: string, replacement: string, options?: Omit<FindOptions, 'scope' | 'limit'>): { count: number; cells: number };
  /** The whole result of the formula in a cell (what `A1#` reads); a one-cell range for ordinary cells. */
  getSpill(row: number, col: number): unknown[][] | string;
  /** Rectangles currently filled by formulas that return several cells. */
  getSpillRanges(): SpillRange[];
  loadRecords(records: Record<string, unknown>[], options?: { headers?: string[]; includeHeaders?: boolean; startRow?: number; startCol?: number }): { rows: number; headers: string[] };
  importCSV(text: string, options?: DelimitedImportOptions): number;
  importDelimited(text: string, options?: DelimitedImportOptions): number;
  importNDJSON(text: string, options?: { startRow?: number; startCol?: number; replace?: boolean; inferTypes?: boolean; locale?: string; dateParsing?: DateParsing }): number;
  importFile(file: File, options?: DelimitedImportOptions): Promise<unknown>;
  fill(source: CellRange, target: CellRange, options?: { mode?: 'series' | 'repeat' }): boolean;
  fillDownToContiguousData(source?: CellRange): boolean;
  loadResultSet(result: SQLResultSet, options?: { tableName?: string; keyColumns?: string[]; editableColumns?: string[]; readOnly?: boolean; replace?: boolean }): { rows: number; totalRows: number; columns: SQLColumnMetadata[] };
  appendResultPage(result: SQLResultSet): { rows: number; loadedRows: number; fetchedRows: number; totalRows: number; hasMore: boolean; nextCursor: unknown };
  getSQLMetadata(): null | { tableName: string | null; columns: SQLColumnMetadata[]; keyColumns: string[]; editableColumns: string[] | null; loadedRows: number; fetchedRows: number; totalRows: number; hasMore: boolean; nextCursor: unknown; queryId: string | null; metadata: Record<string, unknown> | null; readOnly: boolean };
  getDataChanges(): SQLPendingChanges;
  insertRecord(record: Record<string, unknown>): { row: number; clientId: string };
  deleteRecord(rowIndex: number): boolean;
  acceptDataChanges(options?: { keyMap?: Record<string, unknown> | Map<string, unknown>; recordsByClientId?: Record<string, Record<string, unknown>> | Map<string, Record<string, unknown>> }): boolean;
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
  evaluateValue(formula:string): unknown;
  evaluateFormula(formula: string): unknown;
}
export class PivotEngine { static fromArray(source: unknown[][], rowField: string, valueField: string, aggregate?: string, columnField?: string): unknown[][] | string; static pivot(data: Record<string, unknown>[], config?: Record<string, unknown>): any; }
export default TinyDatagrid;
