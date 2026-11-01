import type { GridPlugin, Workbook } from "./tinygrid.js";
export interface StoredWorkbook {
  workbook: Workbook;
  savedAt: string;
}
export interface GridStorage {
  /** Without a snapshot, capture asynchronously when this queued write starts. */
  save(snapshot?: Workbook): Promise<boolean>;
  load(): Promise<StoredWorkbook | undefined>;
  restore(): Promise<boolean>;
  clear(): Promise<boolean>;
}
export function indexedDBStorage(options: {
  key: string;
  database?: string;
  autoSave?: boolean;
  delay?: number;
}): GridPlugin<GridStorage>;
