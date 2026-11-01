import type { TinyDatagrid, CellRange, AsyncOptions } from "./tinygrid.js";

export type DataExportFormat =
  "workbook" | "csv" | "tsv" | "json" | "html" | "markdown";
export interface DataExportOptions extends AsyncOptions {
  format?: DataExportFormat;
  range?: CellRange;
  computed?: boolean;
  delimiter?: string;
  headerRow?: number;
  /** Default 5,000,000. Independent of maxRangeCells. */
  maxCells?: number;
  /** UTF-8 byte budget; default 64 MiB. */
  maxBytes?: number;
}
/** Sparse workbook or row-wise data export, with progress, cancellation and budgets. */
export function exportData(
  grid: TinyDatagrid,
  options?: DataExportOptions,
): Promise<Blob>;

export type PNGExportOptions = { scale?: number; maxPixels?: number };
/** Render the visible cells in a range to an image/png Blob using the active grid colors. */
export function exportPNG(
  grid: TinyDatagrid,
  range?: CellRange,
  options?: PNGExportOptions,
): Promise<Blob>;
/** Open a print-ready view of a range. Use the browser print dialog to save it as PDF. */
export function printPDF(grid: TinyDatagrid, range?: CellRange): void;
