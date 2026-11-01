import { FormulaError, isFormulaError } from "./formula-errors.js";
import { DecimalValue, compareDecimals } from "./decimal-values.js";
import {
  numericOperand,
  arithmetic,
  divideNumbers,
} from "./numeric-operations.js";
import { JSONValue, fromJSONData } from "./json-values.js";
const blank = (value) => value === "" || value == null;
export const rangeAggregates = new Set([
  "SUM",
  "AVERAGE",
  "MIN",
  "MAX",
  "COUNT",
  "COUNTA",
  "COUNTBLANK",
]);
export function rangeFromNode(node, parseA1) {
  if (
    node.type !== "range" ||
    !["ident", "sheetref"].includes(node.left.type) ||
    !["ident", "sheetref"].includes(node.right.type)
  )
    return null;
  const a = parseA1(node.left.name),
    b = parseA1(node.right.name);
  if (!a || !b) return null;
  return {
    r1: Math.min(a.row, b.row),
    r2: Math.max(a.row, b.row),
    c1: Math.min(a.col, b.col),
    c2: Math.max(a.col, b.col),
    sheet: node.left.sheet,
    rightSheet: node.right.sheet,
  };
}
export function checkDenseRange(grid, range) {
  const cells = (range.r2 - range.r1 + 1) * (range.c2 - range.c1 + 1);
  const limit = grid.options?.maxRangeCells ?? 1_000_000;
  if (
    ![range.r1, range.r2, range.c1, range.c2].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    ) ||
    !Number.isSafeInteger(cells) ||
    cells < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    cells > limit
  )
    throw new RangeError(
      "Range exceeds maxRangeCells; use an aggregate or a smaller range",
    );
}
function accumulator(name) {
  let count = 0,
    occupied = 0,
    blanks = 0,
    sum = 0,
    extreme,
    error,
    failure;
  const consume = (value, errors = true) => {
    if (Array.isArray(value)) {
      for (const item of value) consume(item, errors);
      return;
    }
    if (value instanceof JSONValue && Array.isArray(value.value)) {
      for (const item of value.value) consume(fromJSONData(item), false);
      return;
    }
    if (errors && isFormulaError(value)) error ||= value;
    if (blank(value)) {
      blanks++;
      return;
    }
    occupied++;
    if (
      typeof value === "bigint" ||
      value instanceof DecimalValue ||
      (typeof value === "number" && Number.isFinite(value))
    )
      count++;
    if (["COUNT", "COUNTA", "COUNTBLANK"].includes(name) || failure) return;
    try {
      if (name === "SUM" || name === "AVERAGE")
        sum = arithmetic("+", sum, value);
      else {
        const number = numericOperand(value);
        if (
          extreme === undefined ||
          compareDecimals(number, extreme) * (name === "MAX" ? 1 : -1) > 0
        )
          extreme = number;
      }
    } catch (e) {
      failure = e;
    }
  };
  return {
    consume,
    missing(n) {
      blanks += n;
    },
    result() {
      if (name === "COUNT") return count;
      if (name === "COUNTA") return occupied;
      if (name === "COUNTBLANK") return blanks;
      if (error) return error;
      if (failure) throw failure;
      if (name === "SUM") return sum;
      if (name === "AVERAGE")
        return occupied
          ? divideNumbers(sum, occupied)
          : new FormulaError("#N/A");
      return extreme ?? new FormulaError("#N/A");
    },
  };
}
function consumeRange(engine, range, visiting, state) {
  const grid = engine.grid,
    sheets = grid.feature?.("worksheets"),
    dep = engine.dependencies;
  const { r1, c1, r2, c2 } = range;
  if (
    ![r1, c1, r2, c2].every((n) => Number.isSafeInteger(n) && n >= 0) ||
    !Number.isSafeInteger((r2 - r1 + 1) * (c2 - c1 + 1))
  )
    return new FormulaError("#REF!");
  if (
    range.rightSheet &&
    (!range.sheet ||
      sheets?.resolve(range.sheet) !== sheets?.resolve(range.rightSheet))
  )
    return new FormulaError("#RANGE!");
  let id = null;
  const probe = grid._calculationKey?.("0,0");
  if (probe?.startsWith("[")) id = JSON.parse(probe)[0];
  let cells = grid.cells,
    pivots = grid.pivotTables,
    read = (row, col) =>
      (grid.getCalculationValue ?? grid.getComputedValue).call(
        grid,
        row,
        col,
        visiting,
      );
  if (range.sheet) {
    dep.read("worksheets:names");
    id = sheets?.resolve(range.sheet);
    if (!id) return new FormulaError("#REF!");
    const source = sheets.referenceDocuments().find((sheet) => sheet.id === id);
    cells = source.cells;
    pivots = source.pivotTables;
    read = (row, col) => sheets.read(range.sheet, { row, col }, visiting);
  }
  if (!(cells instanceof Map) || grid.sqlBinding || pivots?.length) {
    checkDenseRange(grid, range);
    for (let row = r1; row <= r2; row++)
      for (let col = c1; col <= c2; col++) state.consume(read(row, col));
    return;
  }
  dep.readRange(id, { r1, c1, r2, c2 });
  let visited = 0;
  for (const [key, cell] of cells) {
    if (blank(cell.raw)) continue;
    const [row, col] = key.split(",").map(Number);
    if (row < r1 || row > r2 || col < c1 || col > c2) continue;
    visited++;
    const calculationKey = id === null ? key : JSON.stringify([id, key]);
    const literal =
      !(typeof cell.raw === "string" && cell.raw.startsWith("=")) &&
      !dep.covered.has(calculationKey);
    const cached = engine.cache.has(calculationKey);
    // A single range dependency replaces millions of edges to literal cells.
    if (literal) dep.stack.push(null);
    try {
      state.consume(read(row, col));
    } finally {
      if (literal) {
        dep.stack.pop();
        if (!cached) engine.cache.delete(calculationKey);
      }
    }
  }
  // Spill origins can lie outside the requested range. settle() discovers them.
  for (const spill of dep.spills.values()) {
    const owner = spill.owner._calculationKey?.("0,0");
    const sheet = owner?.startsWith("[") ? JSON.parse(owner)[0] : null;
    if (sheet !== id) continue;
    for (
      let row = Math.max(r1, spill.row);
      row <= Math.min(r2, spill.row + spill.rows - 1);
      row++
    )
      for (
        let col = Math.max(c1, spill.col);
        col <= Math.min(c2, spill.col + spill.cols - 1);
        col++
      ) {
        if (!blank(cells.get(`${row},${col}`)?.raw)) continue;
        visited++;
        state.consume(read(row, col));
      }
  }
  state.missing((r2 - r1 + 1) * (c2 - c1 + 1) - visited);
}
export function evaluateAggregate(engine, node, ranges, visiting) {
  if (!engine.dependencies.stack.length) engine.settle?.();
  return engine._invokeFunction(() => {
    const state = accumulator(node.name);
    for (let i = 0; i < node.args.length; i++) {
      if (ranges[i]) {
        const error = consumeRange(engine, ranges[i], visiting, state);
        if (error) return error;
      } else state.consume(engine.evalNode(node.args[i], visiting));
    }
    return state.result();
  }, []);
}
