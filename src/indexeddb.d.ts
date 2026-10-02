import type { GridPlugin } from "./tinygrid.js";
export interface GridStorage {
  save(): Promise<boolean>;
  restore(): Promise<boolean>;
  clear(): Promise<boolean>;
}
export function indexedDBStorage(options: {
  key: string;
  database?: string;
  autoSave?: boolean;
  delay?: number;
}): GridPlugin<GridStorage>;
