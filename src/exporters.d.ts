import type { TinyDatagrid, CellRange } from "./tinygrid.js";

export type PNGExportOptions = { scale?: number; maxPixels?: number };
/** Render the visible cells in a range to an image/png Blob using the active grid colors. */
export function exportPNG(
  grid: TinyDatagrid,
  range?: CellRange,
  options?: PNGExportOptions,
): Promise<Blob>;
/** Open a print-ready view of a range. Use the browser print dialog to save it as PDF. */
export function printPDF(grid: TinyDatagrid, range?: CellRange): void;
