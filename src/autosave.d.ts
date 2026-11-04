import type { TinyDatagrid } from "./tinygrid.js";
import type { DisposableTool } from "./ui-tools.js";
export interface AutosaveOptions {
  /** Separate documents must use separate keys. */
  key: string;
  database?: string;
  delay?: number;
  /** Save at least this often during continuous edits; default 5,000 ms. */
  maxWait?: number;
  /** Maximum UTF-8 bytes in localStorage recovery; default 1 MiB, 0 disables it. */
  recoveryMaxBytes?: number;
  formula?: HTMLInputElement | HTMLTextAreaElement;
  status?: (
    key: "savingLocal" | "savedLocal" | "savedRecovery" | "saveFailed",
  ) => void;
}
export interface Autosave extends DisposableTool {
  readonly restored: boolean;
  readonly pending: boolean;
  save(withBackup?: boolean): Promise<void>;
  restoreDraft(): void;
  /** Remove unfinished text from memory/localStorage; call when cancelling an external formula bar. */
  clearDraft(): void;
}
/** Opt-in IndexedDB saving, local recovery and draft restoration. */
export function installAutosave(
  grid: TinyDatagrid,
  options: AutosaveOptions,
): Promise<Autosave>;
