import { sourceLineage, checkedLineage } from "./lineage.js";
import { analysisRecords } from "./analysis.js";
import { DecimalValue, compactDecimal } from "./decimal-values.js";
import { compareScalars, scalarKind } from "./scalar-comparison.js";
import { isFormulaError } from "./formula-errors.js";
import {
  sumNumbers,
  meanNumbers,
  numericExtreme,
} from "./numeric-operations.js";
import { CalendarDate, ClockTime, DurationValue } from "./temporal-values.js";
import { JSONValue } from "./json-values.js";
import { parseA1 } from "./tinygrid.js";

const functions = new Set(["COUNT", "SUM", "AVG", "MIN", "MAX"]);
const clauses = new Set([
  "INTO",
  "FROM",
  "WHERE",
  "GROUP",
  "HAVING",
  "ORDER",
  "LIMIT",
  "OFFSET",
  "ASC",
  "DESC",
]);
const numeric = (v) =>
  typeof v === "bigint" ||
  v instanceof DecimalValue ||
  (typeof v === "number" && Number.isFinite(v));
const nullable = (v) => (v === "" || v == null ? null : v);

function tokenize(sql) {
  if (typeof sql !== "string" || !sql.trim() || sql.length > 32768)
    throw new TypeError("SQL must contain 1–32768 characters");
  const tokens = [];
  let i = 0;
  while (i < sql.length) {
    const pos = i,
      ch = sql[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (sql.startsWith("--", i)) {
      const end = sql.indexOf("\n", i + 2);
      i = end < 0 ? sql.length : end + 1;
      continue;
    }
    if (sql.startsWith("/*", i)) {
      const end = sql.indexOf("*/", i + 2);
      if (end < 0) throw new SyntaxError(`Unclosed comment at ${i + 1}`);
      i = end + 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      let value = "",
        closed = false;
      i++;
      while (i < sql.length) {
        if (sql[i] === ch) {
          if (sql[i + 1] === ch) {
            value += ch;
            i += 2;
          } else {
            i++;
            closed = true;
            break;
          }
        } else value += sql[i++];
      }
      if (!closed) throw new SyntaxError(`Unclosed quote at ${pos + 1}`);
      tokens.push({ type: ch === "'" ? "literal" : "id", value, pos });
    } else {
      const word = /^[A-Za-z_][A-Za-z_0-9]*/.exec(sql.slice(i));
      const number = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(
        sql.slice(i),
      );
      if (word) {
        tokens.push({ type: "word", value: word[0], pos });
        i += word[0].length;
      } else if (number) {
        tokens.push({
          type: "literal",
          value: compactDecimal(DecimalValue.parse(number[0])),
          pos,
        });
        i += number[0].length;
      } else {
        const op = /^(?:<=|>=|<>|!=|[=<>(),*?;:])/.exec(sql.slice(i));
        if (!op) throw new SyntaxError(`Unsupported SQL character at ${i + 1}`);
        tokens.push({ type: "symbol", value: op[0], pos });
        i += op[0].length;
      }
    }
    if (tokens.length > 4096) throw new RangeError("SQL exceeds 4096 tokens");
  }
  tokens.push({ type: "end", value: "", pos: sql.length });
  return tokens;
}

function parse(sql, params) {
  if (!Array.isArray(params))
    throw new TypeError("SQL parameters must be an array");
  const tokens = tokenize(sql);
  let index = 0,
    parameter = 0,
    depth = 0;
  const peek = () => tokens[index];
  const is = (value) =>
    peek().type !== "id" &&
    peek().type !== "literal" &&
    String(peek().value).toUpperCase() === value;
  const take = (value) => {
    if (!is(value)) return false;
    index++;
    return true;
  };
  const fail = (message) => {
    throw new SyntaxError(`${message} at ${peek().pos + 1}`);
  };
  const expect = (value) => {
    if (!take(value)) fail(`Expected ${value}`);
  };
  const identifier = () => {
    const token = peek();
    if (!["word", "id"].includes(token.type)) fail("Expected identifier");
    index++;
    return { name: token.value, quoted: token.type === "id" };
  };
  const list = (read) => {
    const out = [read()];
    while (take(",")) out.push(read());
    return out;
  };
  function value(allowAggregate = true) {
    if (take("?")) {
      if (parameter >= params.length) fail("Missing SQL parameter");
      return { kind: "literal", value: params[parameter++] ?? null };
    }
    if (peek().type === "literal")
      return { kind: "literal", value: tokens[index++].value };
    if (take("NULL")) return { kind: "literal", value: null };
    if (take("TRUE")) return { kind: "literal", value: true };
    if (take("FALSE")) return { kind: "literal", value: false };
    const field = identifier();
    if (take("(")) {
      const fn = field.name.toUpperCase();
      if (!allowAggregate || field.quoted || !functions.has(fn))
        fail("Unsupported function");
      const distinct = take("DISTINCT");
      const arg = take("*")
        ? { kind: "star" }
        : { kind: "field", ...identifier() };
      if (arg.kind === "star" && (fn !== "COUNT" || distinct))
        fail("Only COUNT(*) is supported");
      expect(")");
      return { kind: "aggregate", fn, arg, distinct };
    }
    return { kind: "field", ...field };
  }
  function predicate(allowAggregate) {
    if (++depth > 64) throw new RangeError("SQL nesting exceeds 64 levels");
    try {
      if (take("NOT")) return { op: "not", child: predicate(allowAggregate) };
      if (take("(")) {
        const node = boolean(allowAggregate);
        expect(")");
        return node;
      }
      const left = value(allowAggregate);
      if (take("IS")) {
        const not = take("NOT");
        expect("NULL");
        return { op: "null", left, not };
      }
      const not = take("NOT");
      let node;
      if (take("IN")) {
        expect("(");
        const items = list(() => value(allowAggregate));
        expect(")");
        node = { op: "in", left, items };
      } else if (take("LIKE"))
        node = { op: "like", left, right: value(allowAggregate) };
      else if (take("BETWEEN")) {
        const low = value(allowAggregate);
        expect("AND");
        node = { op: "between", left, low, high: value(allowAggregate) };
      } else {
        if (not) fail("Expected IN, LIKE or BETWEEN after NOT");
        const op = peek().value;
        if (!["=", "!=", "<>", "<", ">", "<=", ">="].includes(op))
          fail("Expected comparison");
        index++;
        return { op, left, right: value(allowAggregate) };
      }
      return not ? { op: "not", child: node } : node;
    } finally {
      depth--;
    }
  }
  function boolean(allowAggregate) {
    const and = () => {
      let node = predicate(allowAggregate);
      while (take("AND"))
        node = { op: "and", left: node, right: predicate(allowAggregate) };
      return node;
    };
    let node = and();
    while (take("OR")) node = { op: "or", left: node, right: and() };
    return node;
  }
  expect("SELECT");
  const distinct = take("DISTINCT");
  const select = take("*")
    ? [{ kind: "star" }]
    : list(() => {
        const expr = value();
        let alias;
        if (take("AS")) alias = identifier();
        else if (
          peek().type === "id" ||
          (peek().type === "word" && !clauses.has(peek().value.toUpperCase()))
        )
          alias = identifier();
        return { ...expr, alias };
      });
  let into = null;
  if (take("INTO")) {
    const sheet = identifier();
    expect(":");
    const cell = identifier();
    if (cell.quoted || !/^[A-Za-z]+[1-9]\d*$/.test(cell.name))
      fail("Expected destination cell such as A5");
    into = { sheet, cell: cell.name };
  }
  expect("FROM");
  const table = identifier();
  const where = take("WHERE") ? boolean(false) : null;
  let group = [];
  if (take("GROUP")) {
    expect("BY");
    group = list(() => ({ kind: "field", ...identifier() }));
  }
  const having = take("HAVING") ? boolean(true) : null;
  let order = [];
  if (take("ORDER")) {
    expect("BY");
    order = list(() => {
      const expr = value();
      const descending = take("DESC");
      if (!descending) take("ASC");
      return { expr, descending };
    });
  }
  const integer = () => {
    const token = peek();
    if (
      token.type !== "literal" ||
      typeof token.value !== "number" ||
      !Number.isSafeInteger(token.value) ||
      token.value < 0
    )
      fail("Expected nonnegative integer");
    index++;
    return token.value;
  };
  const limit = take("LIMIT") ? integer() : null;
  const hasOffset = take("OFFSET");
  const offset = hasOffset ? integer() : 0;
  if (hasOffset && limit == null) fail("OFFSET requires LIMIT");
  take(";");
  if (peek().type !== "end")
    fail("Unexpected SQL token (only one SELECT is supported)");
  if (parameter !== params.length) throw new TypeError("Unused SQL parameters");
  return {
    table,
    select,
    distinct,
    where,
    group,
    having,
    order,
    limit,
    offset,
    into,
  };
}

const matchesName = (id, name) =>
  id.quoted ? id.name === name : id.name.toLowerCase() === name.toLowerCase();
function resolve(id, names) {
  const matches = names.filter((name) => matchesName(id, name));
  if (matches.length !== 1)
    throw new TypeError(
      `${matches.length ? "Ambiguous" : "Unknown"} SQL field: ${id.name}`,
    );
  return matches[0];
}
function scalarKey(value) {
  value = nullable(value);
  if (isFormulaError(value))
    throw new TypeError(`SQL source contains ${value}`);
  const kind = scalarKind(value);
  if (kind === "null") return [kind, ""];
  if (kind === "number") return [kind, DecimalValue.parse(value).toString()];
  if (kind === "date" || kind === "datetime")
    return [kind, value.toISOString()];
  if (kind === "time" || kind === "duration")
    return [kind, String(value.seconds)];
  if (kind === "string" || kind === "boolean") return [kind, String(value)];
  throw new TypeError("SQL grouping/comparison requires scalar values");
}
const keyOf = (values) => JSON.stringify(values.map(scalarKey));
function compare(a, b, op) {
  if (a == null || b == null) return null;
  const order = compareScalars(a, b);
  if (op === "=") return order === 0;
  if (op === "!=" || op === "<>") return order !== 0;
  if (order == null)
    throw new TypeError("SQL ordered comparison requires matching types");
  if (op === "<") return order < 0;
  if (op === ">") return order > 0;
  if (op === "<=") return order <= 0;
  return order >= 0;
}
const sqlAnd = (a, b) =>
  a === false || b === false ? false : a == null || b == null ? null : true;
const sqlOr = (a, b) =>
  a === true || b === true ? true : a == null || b == null ? null : false;
function like(value, pattern, charge) {
  if (value == null || pattern == null) return null;
  if (typeof value !== "string" || typeof pattern !== "string")
    throw new TypeError("LIKE requires text");
  const text = Array.from(value),
    chars = Array.from(pattern);
  if ((text.length + 1) * (chars.length + 1) > 1000000)
    throw new RangeError("LIKE pattern exceeds work limit");
  charge((text.length + 1) * (chars.length + 1));
  let previous = new Array(text.length + 1).fill(false);
  previous[0] = true;
  for (const ch of chars) {
    const next = new Array(text.length + 1).fill(false);
    next[0] = ch === "%" && previous[0];
    for (let i = 1; i <= text.length; i++)
      next[i] =
        ch === "%"
          ? previous[i] || next[i - 1]
          : previous[i - 1] && (ch === "_" || ch === text[i - 1]);
    previous = next;
  }
  return previous[text.length];
}
function test(node, read, charge) {
  if (!node) return true;
  charge(1);
  if (node.op === "not") {
    const result = test(node.child, read, charge);
    return result == null ? null : !result;
  }
  if (node.op === "and" || node.op === "or") {
    const left = test(node.left, read, charge);
    if (node.op === "and" && left === false) return false;
    if (node.op === "or" && left === true) return true;
    return (node.op === "and" ? sqlAnd : sqlOr)(
      left,
      test(node.right, read, charge),
    );
  }
  const left = read(node.left);
  if (node.op === "null") return node.not ? left != null : left == null;
  if (node.op === "in")
    return node.items.reduce(
      (answer, item) => sqlOr(answer, compare(left, read(item), "=")),
      false,
    );
  if (node.op === "like") return like(left, read(node.right), charge);
  if (node.op === "between")
    return sqlAnd(
      compare(left, read(node.low), ">="),
      compare(left, read(node.high), "<="),
    );
  return compare(left, read(node.right), node.op);
}
function visit(node, callback) {
  if (!node || typeof node !== "object") return;
  if (node.kind) {
    callback(node);
    return;
  }
  for (const child of Object.values(node))
    if (Array.isArray(child)) child.forEach((n) => visit(n, callback));
    else if (child && typeof child === "object") visit(child, callback);
}

/** SQL subset over active-sheet tables; an explicit INTO clause writes the result. */
export function queryTables(grid, sql, params = [], options = {}) {
  let remainingWork = 5000000;
  const charge = (amount) => {
    remainingWork -= amount;
    if (remainingWork < 0)
      throw new RangeError(
        "SQL exceeds work limit; simplify the query or reduce the source table",
      );
  };
  const query = parse(sql, params);
  const tables = grid.listTables();
  // Exact ids are stable even when a table has been renamed.
  const byId = tables.filter((t) => matchesName(query.table, t.id));
  const found = byId.length
    ? byId
    : tables.filter((t) => matchesName(query.table, t.name));
  if (found.length !== 1)
    throw new TypeError(
      `${found.length ? "Ambiguous" : "Unknown"} SQL table: ${query.table.name}`,
    );
  const table = found[0];
  const reader = {
    hiddenRows: grid.hiddenRows,
    filteredRows: grid.filteredRows,
    isAnalysisRowVisible: grid.isAnalysisRowVisible?.bind(grid),
    isTableRowVisible: grid.isTableRowVisible?.bind(grid),
    getComputedValue: (grid.getCalculationValue ?? grid.getComputedValue).bind(
      grid,
    ),
  };
  const { headers, entries } = analysisRecords(
    reader,
    {
      r1: table.headerRow,
      r2: table.r2,
      c1: table.c1,
      c2: table.c2,
    },
    {
      includeEmptyRows: table.includeEmptyRows === true,
      ...options,
      scope: options.scope ?? "all",
    },
  );
  if (query.select[0].kind === "star")
    query.select = headers.map((name) => ({
      kind: "field",
      name,
      quoted: true,
    }));
  const columns = query.select.map(
    (expr) =>
      expr.alias?.name ??
      (expr.kind === "field"
        ? expr.name
        : expr.kind === "aggregate"
          ? `${expr.fn}(${expr.distinct ? "DISTINCT " : ""}${expr.arg.name ?? "*"})`
          : String(expr.value)),
  );
  if (new Set(columns.map((c) => c.toLowerCase())).size !== columns.length)
    throw new TypeError(
      "SQL result column names must be unique; use AS aliases",
    );
  const bind = (expr, aliases = false) => {
    if (expr.kind === "field") {
      const matches = headers.filter((h) => matchesName(expr, h));
      if (!matches.length && aliases) {
        const name = resolve(expr, columns);
        return { ...query.select[columns.indexOf(name)] };
      }
      return { ...expr, name: resolve(expr, headers) };
    }
    if (expr.kind === "aggregate" && expr.arg.kind !== "star")
      return { ...expr, arg: bind(expr.arg) };
    return expr;
  };
  query.select = query.select.map((expr) => bind(expr));
  query.group = query.group.map((expr) => bind(expr));
  const bindPredicate = (node, aliases = false) => {
    visit(node, (expr) => Object.assign(expr, bind(expr, aliases)));
  };
  bindPredicate(query.where);
  bindPredicate(query.having, true);
  query.order = query.order.map(({ expr, descending }) => {
    if (expr.kind === "literal") {
      if (
        !Number.isInteger(expr.value) ||
        expr.value < 1 ||
        expr.value > query.select.length
      )
        throw new TypeError("ORDER BY position is outside the result columns");
      expr = query.select[expr.value - 1];
    } else {
      // ORDER BY gives result aliases precedence over source fields.
      const alias =
        expr.kind === "field" && columns.filter((c) => matchesName(expr, c));
      expr =
        alias?.length === 1
          ? query.select[columns.indexOf(alias[0])]
          : bind(expr, true);
    }
    return { expr, descending };
  });
  let grouped = query.group.length > 0;
  const outputExpressions = [
    ...query.select,
    query.having,
    ...query.order.map((o) => o.expr),
  ];
  outputExpressions.forEach((node) =>
    visit(node, (expr) => {
      if (expr.kind === "aggregate") grouped = true;
    }),
  );
  if (query.having && !grouped)
    throw new TypeError("HAVING requires GROUP BY or an aggregate");
  if (grouped)
    outputExpressions.forEach((node) =>
      visit(node, (expr) => {
        if (
          expr.kind === "field" &&
          !query.group.some((g) => g.name === expr.name)
        )
          throw new TypeError(
            `SQL field must appear in GROUP BY: ${expr.name}`,
          );
      }),
    );
  if (
    query.distinct &&
    !grouped &&
    query.order.some(
      ({ expr }) =>
        expr.kind === "field" &&
        !query.select.some((s) => s.kind === "field" && s.name === expr.name),
    )
  )
    throw new TypeError(
      "SELECT DISTINCT requires ORDER BY fields in the result",
    );
  function field(entry, name) {
    charge(1);
    const value = nullable(entry.record[name]);
    if (isFormulaError(value))
      throw new TypeError(`SQL source field ${name} contains ${value}`);
    return value;
  }
  function read(expr, bucket) {
    charge(1);
    if (expr.kind === "literal") return expr.value;
    if (expr.kind === "field")
      return bucket.length ? field(bucket[0], expr.name) : null;
    if (expr.fn === "COUNT" && expr.arg.kind === "star") return bucket.length;
    let values = bucket
      .map((entry) => field(entry, expr.arg.name))
      .filter((v) => v != null);
    if (expr.distinct) {
      const seen = new Set();
      values = values.filter((v) => {
        const key = keyOf([v]);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    if (expr.fn === "COUNT") return values.length;
    if (["SUM", "AVG"].includes(expr.fn)) {
      if (values.some((v) => !numeric(v)))
        throw new TypeError(`${expr.fn} requires numeric values`);
      if (!values.length) return null;
      return expr.fn === "SUM" ? sumNumbers(values) : meanNumbers(values);
    }
    if (!values.length) return null;
    if (values.every(numeric)) return numericExtreme(values, expr.fn === "MAX");
    return values.reduce((a, b) => {
      const order = compareScalars(a, b);
      if (order == null)
        throw new TypeError(`${expr.fn} requires matching types`);
      return order * (expr.fn === "MAX" ? 1 : -1) >= 0 ? a : b;
    });
  }
  const filtered = entries.filter(
    (entry) =>
      test(query.where, (expr) => read(expr, [entry]), charge) === true,
  );
  let buckets;
  if (!grouped) buckets = filtered.map((entry) => [entry]);
  else if (!query.group.length) buckets = [filtered];
  else {
    const groups = new Map();
    for (const entry of filtered) {
      const key = keyOf(query.group.map((expr) => field(entry, expr.name)));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }
    buckets = [...groups.values()];
  }
  let results = buckets
    .filter(
      (bucket) =>
        test(query.having, (expr) => read(expr, bucket), charge) === true,
    )
    .map((bucket) => ({
      row: query.select.map((expr) => read(expr, bucket)),
      bucket,
      sort: query.order.map(({ expr }) => read(expr, bucket)),
    }));
  if (query.distinct) {
    const seen = new Map();
    results = results.filter((result) => {
      const key = keyOf(result.row);
      if (seen.has(key)) {
        seen.get(key).bucket.push(...result.bucket);
        return false;
      }
      // Keep a private bucket when DISTINCT merges drill-through records.
      result.bucket = result.bucket.slice();
      seen.set(key, result);
      return true;
    });
  }
  results.sort((a, b) => {
    for (let i = 0; i < query.order.length; i++) {
      charge(1);
      const av = a.sort[i],
        bv = b.sort[i];
      if (av == null || bv == null) {
        if (av == null && bv == null) continue;
        return av == null ? 1 : -1;
      }
      const order = compareScalars(av, bv);
      if (order == null)
        throw new TypeError("ORDER BY requires matching scalar types");
      if (order) return order * (query.order[i].descending ? -1 : 1);
    }
    return 0;
  });
  results = results.slice(
    query.offset,
    query.limit == null ? undefined : query.offset + query.limit,
  );
  if (results.length > 10000)
    throw new RangeError("SQL result exceeds 10,000 rows; add LIMIT");
  const result = {
    columns,
    rows: results.map((r) => r.row),
    rowCount: results.length,
    tableId: table.id,
    lineage: sourceLineage(
      grid,
      { r1: table.headerRow, r2: table.r2, c1: table.c1, c2: table.c2 },
      "sql",
      sql,
    ),
    toTable() {
      return [columns.slice(), ...results.map((r) => r.row.slice())];
    },
    drill(index) {
      return Number.isInteger(index) && index >= 0
        ? (results[index]?.bucket.slice() ?? [])
        : [];
    },
  };
  if (query.into)
    result.destination = placeSQLResult(grid, result, {
      sheetName: query.into.sheet.name,
      quoted: query.into.sheet.quoted,
      ...destinationCell(query.into.cell),
      reuse: true,
      activate: false,
    });
  return result;
}

function copyResultValue(value, seen = new WeakMap()) {
  if (value == null || typeof value !== "object") return value;
  if (
    value instanceof DecimalValue ||
    value instanceof ClockTime ||
    value instanceof DurationValue ||
    isFormulaError(value)
  )
    return value;
  if (value instanceof CalendarDate)
    return CalendarDate.parse(value.calendarText());
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value))
    return structuredClone(value);
  if (seen.has(value)) return seen.get(value);
  if (value instanceof JSONValue)
    return new JSONValue(copyResultValue(value.value, seen));
  const copy = Array.isArray(value) ? [] : {};
  seen.set(value, copy);
  for (const [key, item] of Object.entries(value))
    Object.defineProperty(copy, key, {
      value: copyResultValue(item, seen),
      writable: true,
      enumerable: true,
      configurable: true,
    });
  return copy;
}

/** Materialize a SQL result snapshot as an editable table in a new worksheet. */
function placeSQLResult(
  grid,
  result,
  {
    sheetName = "SQL result",
    tableName,
    startRow = 0,
    startCol = 0,
    reuse = false,
    activate = true,
    quoted = false,
  } = {},
) {
  if (grid.readOnly) throw new Error("Workbook is read-only");
  const sheets = grid.feature("worksheets");
  if (!sheets)
    throw new Error("SQL result tables require the worksheets plugin");
  if (grid.sqlBinding || grid._historyDepth)
    throw new Error(
      "Cannot write SQL results during a transaction or external SQL session",
    );
  if (
    !Array.isArray(result?.columns) ||
    !result.columns.length ||
    result.columns.some((c) => typeof c !== "string") ||
    new Set(result.columns.map((c) => c.toLowerCase())).size !==
      result.columns.length ||
    !Array.isArray(result.rows) ||
    result.rows.some(
      (r) => !Array.isArray(r) || r.length !== result.columns.length,
    )
  )
    throw new TypeError("Invalid SQL result schema");
  if ((result.rows.length + 1) * result.columns.length > 500000)
    throw new RangeError("SQL result table exceeds 500,000 cells");
  if (
    startRow + result.rows.length >= 2000000 ||
    startCol + result.columns.length > 16384
  )
    throw new RangeError(
      "SQL destination exceeds 2,000,000 rows or 16,384 columns",
    );
  const base = String(sheetName).trim();
  if (!base || base.length > 80)
    throw new TypeError("Sheet name must contain 1–80 characters");
  const existing = sheets.list();
  const target =
    reuse &&
    (existing.find((s) => matchesName({ name: base, quoted }, s.id)) ??
      existing.find((s) => matchesName({ name: base, quoted }, s.name)));
  const used = new Set(
    existing.flatMap((s) => [s.id.toLowerCase(), s.name.toLowerCase()]),
  );
  let name = base,
    n = 2;
  while (!reuse && used.has(name.toLowerCase())) {
    const suffix = ` (${n++})`;
    name = base.slice(0, 80 - suffix.length) + suffix;
  }
  // Copy and validate before adding a sheet. Strings stay literal, including leading '='.
  const data = [
    result.columns.slice(),
    ...result.rows.map((r) => r.map((v) => copyResultValue(v))),
  ];
  const lineage = checkedLineage(result.lineage);
  const textCells = new Set();
  data.forEach((row, r) =>
    row.forEach((v, c) => {
      if (typeof v === "string") textCells.add(`${r},${c}`);
    }),
  );
  const range = {
    r1: startRow,
    c1: startCol,
    r2: startRow + result.rows.length,
    c2: startCol + result.columns.length - 1,
  };
  if (grid.commitEdit?.() === false)
    throw new Error("Finish editing before creating a SQL result table");
  const previous = sheets.activeId;
  const previousTable = grid.table?.id;
  const sheetId = target ? target.id : sheets.add(name);
  let before = null,
    history,
    future;
  try {
    if (sheets.select(sheetId) === false)
      throw new Error("Could not select result worksheet");
    if (grid.sqlBinding)
      throw new Error("SQL destination is bound to an external database");
    if (
      grid
        .listTables()
        .some(
          (t) =>
            t.r1 <= range.r2 &&
            t.r2 >= range.r1 &&
            t.c1 <= range.c2 &&
            t.c2 >= range.c1,
        )
    )
      throw new Error("SQL destination overlaps an existing table");
    for (let r = range.r1; r <= range.r2; r++)
      for (let c = range.c1; c <= range.c2; c++) {
        const raw = grid.getRawValue(r, c),
          value = grid.getCalculationValue(r, c);
        if ((raw !== "" && raw != null) || (value !== "" && value != null))
          throw new Error("SQL destination contains occupied cells");
      }
    const tableNames = new Set(
      grid.listTables().map((t) => t.name.toLowerCase()),
    );
    const tableBase = String(tableName ?? (reuse ? "SQL result" : name));
    let outputName = tableBase,
      tableIndex = 2;
    while (tableNames.has(outputName.toLowerCase()))
      outputName = `${tableBase} (${tableIndex++})`;
    before = grid._snapshot();
    history = [...grid._history];
    future = [...grid._future];
    grid.transaction(() => {
      grid._importMatrix(data, { startRow, startCol, textCells });
      if (lineage)
        for (let r = range.r1; r <= range.r2; r++)
          for (let c = range.c1; c <= range.c2; c++) {
            const key = grid.key(r, c);
            grid.cells.set(key, { ...grid.getCell(r, c), lineage });
          }
      if (
        grid.createTable(range, {
          name: outputName,
          includeEmptyRows: true,
        }) === false
      )
        throw new Error("Could not create SQL result table");
    });
    if (activate) grid.select(startRow, startCol);
    grid.emit("change", {
      type: "sqlmaterialize",
      sheetId,
      tableId: grid.table.id,
    });
    const created = {
      sheetId,
      tableId: grid.table.id,
      name: grid.sheetName,
      range,
    };
    if (!activate) {
      sheets.select(previous);
      if (previousTable) grid.activateTable(previousTable);
      if (target?.hidden) sheets.setHidden(sheetId, true);
    }
    return created;
  } catch (error) {
    if (before) {
      grid._restore(before);
      grid._history = history;
      grid._future = future;
      grid.emit("history", grid.historyState);
    }
    sheets.select(previous);
    if (target?.hidden) sheets.setHidden(sheetId, true);
    if (!target) sheets.remove(sheetId);
    throw error;
  }
}

function destinationCell(cell) {
  if (typeof cell !== "string" || !/^[A-Za-z]+[1-9]\d*$/.test(cell))
    throw new TypeError("Invalid SQL destination cell");
  const { row, col } = parseA1(cell);
  if (
    !Number.isSafeInteger(row) ||
    !Number.isSafeInteger(col) ||
    row >= 2000000 ||
    col >= 16384
  )
    throw new RangeError(
      "SQL destination exceeds 2,000,000 rows or 16,384 columns",
    );
  return { startRow: row, startCol: col };
}

export function materializeSQLResult(
  grid,
  result,
  { sheetName = "SQL result", tableName } = {},
) {
  return placeSQLResult(grid, result, { sheetName, tableName });
}

/** Write a snapshot to a free range in an existing or newly created sheet. */
export function writeSQLResult(
  grid,
  result,
  { sheetName, cell = "A1", tableName, activate = true } = {},
) {
  if (typeof sheetName !== "string")
    throw new TypeError("SQL destination requires a sheet name");
  return placeSQLResult(grid, result, {
    sheetName,
    tableName,
    ...destinationCell(cell),
    reuse: true,
    activate,
  });
}

export function localSQL() {
  return {
    name: "sql",
    setup(grid) {
      return {
        query(sql, params = [], options = {}) {
          return queryTables(grid, sql, params, options);
        },
        materialize(result, options) {
          return materializeSQLResult(grid, result, options);
        },
        write(result, options) {
          return writeSQLResult(grid, result, options);
        },
        tables() {
          return grid
            .listTables()
            .map((table) => ({
              id: table.id,
              name: table.name,
              columns: Array.from({ length: table.c2 - table.c1 + 1 }, (_, i) =>
                String(grid.getComputedValue(table.headerRow, table.c1 + i)),
              ),
            }));
        },
      };
    },
  };
}
