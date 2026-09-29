import type { TinyDatagrid, CellRange } from './tinygrid.js';
import type { JSONQueryResult } from './json-values.js';

export type JSONToolsOptions = {
  grid: TinyDatagrid;
  /** Resolve the controls listed in the JSON tools integration guide. */
  $: (selector: string) => HTMLElement;
  t: (key: string) => string;
  notify: (message: string) => void;
  showDialog: (selector: string) => void;
  selection: () => CellRange;
};
/** Connect the optional JSON editor, structure viewer, and table/split commands to host markup. */
export function installJSONTools(options: JSONToolsOptions): {
  sync(): void;
  open(): void;
  queryJSON(root: unknown, path: string): JSONQueryResult;
};
