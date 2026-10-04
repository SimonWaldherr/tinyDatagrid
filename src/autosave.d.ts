import type { TinyDatagrid } from "./tinygrid.js";
import type { DisposableTool } from "./ui-tools.js";
export interface AutosaveOptions {
  /** Separate documents must use separate keys. */
  key: string;
  database?: string;
  delay?: number;
  formula?: HTMLInputElement | HTMLTextAreaElement;
  status?: (key: "savingLocal" | "savedLocal" | "saveFailed") => void;
}
export interface Autosave extends DisposableTool {
  readonly restored: boolean;
  save(withBackup?: boolean): Promise<void>;
  restoreDraft(): void;
}
/** Opt-in IndexedDB saving, local recovery and draft restoration. */
export function installAutosave(
  grid: TinyDatagrid,
  options: AutosaveOptions,
): Promise<Autosave>;
