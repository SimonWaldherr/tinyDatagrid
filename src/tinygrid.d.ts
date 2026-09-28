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
export type DelimitedImportOptions = { startRow?: number; startCol?: number; replace?: boolean; delimiter?: string; inferTypes?: boolean; locale?: string; headerRow?: number };

export class TinyDatagrid {
  constructor(container: string | Element, options?: Record<string, unknown>);
  [key: string]: any;
  readonly readOnly: boolean;
  setReadOnly(readOnly?: boolean): this;
  setVirtualization(enabled?: boolean): this;
  loadRecords(records: Record<string, unknown>[], options?: { headers?: string[]; includeHeaders?: boolean; startRow?: number; startCol?: number }): { rows: number; headers: string[] };
  importCSV(text: string, options?: DelimitedImportOptions): number;
  importDelimited(text: string, options?: DelimitedImportOptions): number;
  importNDJSON(text: string, options?: { startRow?: number; startCol?: number; replace?: boolean; inferTypes?: boolean; locale?: string }): number;
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
export class FormulaEngine { constructor(grid: TinyDatagrid); evaluateFormula(formula: string): unknown; }
export class PivotEngine { static pivot(data: Record<string, unknown>[], config?: Record<string, unknown>): any; }
export default TinyDatagrid;
