import type { TinyDatagrid, CellRange } from "./tinygrid.js";

export type SearchToolsOptions = {
  grid: TinyDatagrid;
  /** Resolve the controls listed in the search tools integration guide. */
  $: (selector: string) => HTMLElement;
  t: (key: string) => string;
  notify: (message: string) => void;
  selection: () => CellRange;
};
/** Connect find/replace controls, regex options, and Ctrl/Cmd+F and Ctrl+H shortcuts. */
export function installSearch(options: SearchToolsOptions): {
  open(withReplace?: boolean): void;
  refresh(move?: boolean): void;
  close(): void;
};
