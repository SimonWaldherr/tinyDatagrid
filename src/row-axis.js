// Compact row geometry. Only nondefault heights consume per-row storage.
// Numeric indexing is retained for editors, exporters and host integrations.
import { gridLimits } from "./limits.js";
export { checkDimensions } from "./limits.js";
export const MAX_ROWS = gridLimits.rows;
export const MAX_COLUMNS = gridLimits.columns;
export const DENSE_ROWS = 20_000;
const indexOf = (key) =>
  typeof key === "string" && /^(0|[1-9]\d*)$/.test(key) ? Number(key) : null;
const height = (value, fallback = 28) =>
  Math.max(18, Math.min(400, Number(value) || fallback));
export class RowAxis {
  constructor(length, defaultHeight, overrides = []) {
    this.length = length;
    this.defaultHeight = height(defaultHeight);
    this.overrides = new Map();
    for (const [row, size] of overrides) {
      if (!Number.isInteger(row) || row < 0 || row >= length)
        throw new RangeError("Invalid row height index");
      const value = height(size, this.defaultHeight);
      if (value !== this.defaultHeight) this.overrides.set(row, value);
    }
    return new Proxy(this, {
      get(target, key, receiver) {
        const row = indexOf(key);
        return row === null
          ? Reflect.get(target, key, receiver)
          : row < target.length
            ? (target.overrides.get(row) ?? target.defaultHeight)
            : undefined;
      },
      set(target, key, value, receiver) {
        const row = indexOf(key);
        if (row === null) {
          if (key === "length") {
            if (!Number.isInteger(value) || value < 0 || value > MAX_ROWS)
              throw new RangeError("Invalid row count");
            for (const row of target.overrides.keys())
              if (row >= value) target.overrides.delete(row);
          }
          return Reflect.set(target, key, value, receiver);
        }
        if (row >= MAX_ROWS) throw new RangeError("Invalid row height index");
        if (row >= target.length) target.length = row + 1;
        const size = height(value, target.defaultHeight);
        if (size === target.defaultHeight) target.overrides.delete(row);
        else target.overrides.set(row, size);
        return true;
      },
    });
  }
  at(index) {
    return this[index < 0 ? this.length + index : index];
  }
  *[Symbol.iterator]() {
    for (let row = 0; row < this.length; row++) yield this[row];
  }
  splice(start, count, ...items) {
    start = Math.min(
      this.length,
      Math.max(0, start < 0 ? this.length + start : start),
    );
    count = Math.min(this.length - start, Math.max(0, count));
    const removed = Array.from({ length: count }, (_, i) => this[start + i]);
    const next = new Map(),
      delta = items.length - count;
    if (this.length + delta > MAX_ROWS)
      throw new RangeError("Invalid row count");
    for (const [row, value] of this.overrides) {
      if (row < start) next.set(row, value);
      else if (row >= start + count) next.set(row + delta, value);
    }
    this.overrides = next;
    this.length += delta;
    items.forEach((value, i) => {
      this[start + i] = value;
    });
    return removed;
  }
  layout(hidden = new Set()) {
    const changes = new Map(this.overrides);
    for (const row of hidden)
      if (row >= 0 && row < this.length) changes.set(row, 0);
    const entries = [...changes].sort((a, b) => a[0] - b[0]);
    const prefix = [0];
    for (const [, size] of entries)
      prefix.push(prefix.at(-1) + size - this.defaultHeight);
    const offset = (row) => {
      let low = 0,
        high = entries.length;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (entries[middle][0] < row) low = middle + 1;
        else high = middle;
      }
      return row * this.defaultHeight + prefix[low];
    };
    const offsets = new Proxy(
      {
        length: this.length + 1,
        at: (i) => offset(i < 0 ? this.length + 1 + i : i),
      },
      {
        get: (target, key) => {
          const row = indexOf(key);
          return row === null
            ? target[key]
            : row <= this.length
              ? offset(row)
              : undefined;
        },
      },
    );
    const sizes = new Proxy(
      { length: this.length },
      {
        get: (target, key) => {
          const row = indexOf(key);
          return row === null || Object.hasOwn(target, key)
            ? target[key]
            : row < this.length
              ? hidden.has(row)
                ? 0
                : this[row]
              : undefined;
        },
      },
    );
    return { offsets, sizes };
  }
}
export function rowHeights(rows, defaultHeight, dimensions = {}) {
  const base = height(dimensions.defaultRowHeight, defaultHeight);
  if (rows <= DENSE_ROWS && !dimensions.rowHeightOverrides)
    return Array.from({ length: rows }, (_, i) =>
      height(dimensions.rowHeights?.[i], base),
    );
  const values = new Map();
  const dense = dimensions.rowHeights || [];
  for (let i = 0; i < Math.min(rows, dense.length); i++)
    if (dense[i] != null && height(dense[i], base) !== base)
      values.set(i, height(dense[i], base));
  for (const [row, size] of dimensions.rowHeightOverrides || [])
    values.set(row, size);
  return new RowAxis(rows, base, values);
}
export function rowDimensions(heights) {
  return heights instanceof RowAxis
    ? {
        rowHeights: [],
        defaultRowHeight: heights.defaultHeight,
        rowHeightOverrides: [...heights.overrides].sort((a, b) => a[0] - b[0]),
      }
    : { rowHeights: [...heights] };
}
