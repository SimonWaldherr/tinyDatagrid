import type {
  TinyDatagrid,
  CellRange,
  CellLineage,
  GridPlugin,
} from "./tinygrid.js";
import type { AnalysisOptions, SourceEntry } from "./analysis.js";
import type { DecimalValue } from "./values.js";
export type BINumber = number | bigint | DecimalValue;
export interface BIMetric {
  id: string;
  /** Omit only for a count of records. count with a field counts numeric cells. */
  field?: string;
  aggregate:
    "count" | "counta" | "distinct" | "sum" | "average" | "min" | "max";
  target?: BINumber;
}
export interface BIConfig {
  metrics: BIMetric[];
  dimensions?: string[];
  filters?: Record<string, unknown | unknown[]>;
  sort?: { metric: string; direction?: "asc" | "desc" };
  limit?: number;
}
export interface BIMeasure {
  id: string;
  /** null for average/min/max with no numeric data; typed formula errors propagate. */
  value: BINumber | import("./values.js").FormulaError | null;
  target?: BINumber;
  delta?: BINumber | import("./values.js").FormulaError | null;
  /** Ratio (1 = 100%); null when the target is zero or the value is unavailable. */
  attainment?: BINumber | import("./values.js").FormulaError | null;
}
export interface BIReport {
  lineage: CellLineage;
  headers: string[];
  rowCount: number;
  metrics: BIMeasure[];
  /** Number of groups before the limit. Totals always cover all eligible records. */
  groupCount: number;
  groups: Array<{
    dimensions: Record<string, string>;
    rowCount: number;
    metrics: BIMeasure[];
  }>;
  /** Zero-based group index after sorting/limiting; omitted means all eligible records. */
  drill(index?: number): SourceEntry[];
}
export interface BusinessIntelligence {
  summarize(
    source: CellRange,
    config: BIConfig,
    options?: AnalysisOptions,
  ): BIReport;
}
export function summarizeBI(
  grid: TinyDatagrid,
  source: CellRange,
  config: BIConfig,
  options?: AnalysisOptions,
): BIReport;
export function businessIntelligence(): GridPlugin<BusinessIntelligence>;
