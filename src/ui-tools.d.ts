import type { CellRange, TinyDatagrid } from "./tinygrid.js";
export interface ToolHost {
  grid: TinyDatagrid;
  /** Resolve host controls from the markup listed in docs/demo-features.md. */
  $: (selector: string) => Element | null;
  t: (key: string) => string;
  notify: (message: string) => void;
}
export interface SourceRecords {
  headers: string[];
  entries: import("./analysis.js").SourceEntry[];
}
export interface DisposableTool {
  dispose(): void;
}
export interface SelectionToolHost extends ToolHost {
  selection: () => CellRange;
}
