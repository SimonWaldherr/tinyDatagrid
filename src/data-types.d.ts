import type { DateParsing, NumberFormat } from "./tinygrid.js";
export type DataType =
  | "null"
  | "boolean"
  | "integer"
  | "number"
  | "date"
  | "datetime"
  | "binary"
  | "json"
  | "decimal"
  | "empty"
  | "text"
  | "percent"
  | "currency"
  | "unknown"
  | "mixed";
export interface DataInferenceOptions {
  locale?: string;
  dateParsing?: DateParsing;
  scientific?: boolean;
}
export interface InferredDataValue {
  type: DataType;
  value: unknown;
  format?: NumberFormat;
}
export function getDataLocale(locale?: string): string;
export function inferDataValue(
  input: unknown,
  options?: DataInferenceOptions,
): InferredDataValue;
export function inferColumnType(
  values: unknown[],
  options?: DataInferenceOptions,
): DataType;
export function coerceDataValue(
  input: unknown,
  options?: { type?: string; locale?: string },
): unknown;
export function inferDelimitedRows(
  rows: unknown[][],
  options?: DataInferenceOptions & {
    headerRow?: number;
  },
): {
  rows: unknown[][];
  formats: Map<string, NumberFormat>;
  textCells: Set<string>;
};
