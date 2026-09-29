/** A JSON object or array held in a cell or returned by a formula. Scalars inside JSON are ordinary cell values. */
export class JSONValue {
  constructor(value: Record<string, unknown> | unknown[]);
  readonly value: Record<string, unknown> | unknown[];
  readonly isArray: boolean;
  readonly kind: 'object' | 'array';
  readonly length: number;
  toJSON(): Record<string, unknown> | unknown[];
  /** Compact JSON text. */
  toString(): string;
}
export const JSON_LIMITS: Readonly<{ depth: number; cells: number }>;
export function isJSONValue(value: unknown): value is JSONValue;
export function isPlainObject(value: unknown): value is Record<string, unknown>;
export function isJSONContainer(value: unknown): value is Record<string, unknown> | unknown[];
/** Text shown when a raw cell value (string, number, object, array) is edited. */
export function rawText(value: unknown): string;
export function stringifyJSON(value: unknown, indent?: number | string): string;
export function parseJSONText(text: string): unknown;
export function isJSONText(text: string): boolean;
/** Convert a spreadsheet value or range to plain JSON data (blank cells become null). */
export function toJSONData(value: unknown): unknown;
export function fromJSONData(data: unknown): unknown;
export type JSONQueryResult = { definite: boolean; found: boolean; value: unknown };
/** Read a value by path: `a.b[0]`, `$..id`, `items[?(@.qty>1)].name`, `items[-1]`, `/a/0/b`. */
export function queryJSON(root: unknown, path: string): JSONQueryResult;
export function setJSON(root: unknown, path: string, value: unknown): unknown;
export function removeJSON(root: unknown, path: string): unknown;
export function mergeJSON(base: unknown, overlay: unknown): unknown;
export function flattenJSON(root: unknown, maxDepth?: number): Array<[string, unknown]>;
export function jsonEquals(a: unknown, b: unknown): boolean;
export function jsonType(data: unknown): 'null' | 'array' | 'object' | 'string' | 'number' | 'boolean';
