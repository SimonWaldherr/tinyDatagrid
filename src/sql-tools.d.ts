import type { CellRange } from "./tinygrid.js";
import type { LocalSQLResult } from "./local-sql.js";
import type {
  DisposableTool,
  SelectionToolHost,
  SourceRecords,
} from "./ui-tools.js";
export interface SQLTools extends DisposableTool {
  open(sql?: string): void;
  execute(): LocalSQLResult | null;
  refreshLabels(): void;
}
/** Requires localSQL; materialization also requires worksheets. */
export function installSQLTools(
  options: SelectionToolHost & {
    showSource: (data: SourceRecords, range: CellRange) => void;
  },
): SQLTools;
