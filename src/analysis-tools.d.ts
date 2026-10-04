import type { CellRange } from "./tinygrid.js";
import type {
  DisposableTool,
  SelectionToolHost,
  SourceRecords,
} from "./ui-tools.js";
export interface AnalysisTools extends DisposableTool {
  show(data: SourceRecords, source: CellRange): void;
  refreshLabels(): void;
}
/** Requires analysisContext; pivot drill-through also requires sheetPivots. */
export function installAnalysisTools(
  options: SelectionToolHost & {
    refresh: () => void;
  },
): AnalysisTools;
