import type { TinyDatagrid, CellRange } from './tinygrid.js';

export type ChartsOptions = {
  grid: TinyDatagrid;
  /** Resolve the controls listed in the charts integration guide. */
  $: (selector: string) => HTMLElement;
  t: (key: string) => string;
  notify: (message: string) => void;
  selection: () => CellRange;
  getLanguage?: () => string;
};
/** Connect the optional selection chart, accessible data table, and SVG/PNG export controls. */
export function installCharts(options: ChartsOptions): { open(): void; refresh(): void };
