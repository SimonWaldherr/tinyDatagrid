import {
  numericOperand,
  arithmetic,
  divideNumbers,
  sumNumbers,
  meanNumbers,
  numericExtreme,
  numericCount,
} from "./numeric-operations.js";
import { compareScalars } from "./scalar-comparison.js";
import {
  FormulaError,
  isFormulaError,
  displayFormulaResult,
} from "./formula-errors.js";
import { codePoints, textIndex, findText } from "./unicode-text.js";
import { CalendarDate, ClockTime, DurationValue } from "./temporal-values.js";
import {
  DecimalValue,
  decimalOperation,
  compactDecimal,
  roundDecimal,
  exactDivide,
  createDecimalFunctions,
  formatDecimal,
  compareDecimals,
} from "./decimal-values.js";
import {
  resolveFormulaName,
  formulaCatalog,
  formulaDefinition,
} from "./formula-catalog.js";
import {
  formulaNumber,
  parseNumericValue,
  checkedResult,
  parseDataJSON,
} from "./numeric-values.js";
/* tinyDatagrid - dependency-free spreadsheet/grid/pivot library
 * MIT License
 */

import { inferAutofillSeries, findAutofillExtent } from "./autofill.js";
import {
  inferColumnType,
  coerceDataValue,
  inferDelimitedRows,
  inferDataValue,
} from "./data-types.js";
import { createLookupFunctions } from "./lookups.js";
import { createCalendarFunctions } from "./calendar-functions.js";
import { createColorFunctions } from "./color-functions.js";
import { createExtendedFunctions } from "./extended-functions.js";
import { createTextFunctions } from "./text-functions.js";
import { createArrayFunctions } from "./array-functions.js";
import { createJsonFunctions } from "./json-functions.js";
import {
  JSONValue,
  wrapCellValue,
  wrapResult,
  unwrapCellValue,
  rawText,
  jsonEquals,
  flattenValues,
  rowsOf,
} from "./json-values.js";
import { translate } from "./i18n.js";
import { difference, applyDifference } from "./history.js";
import { Dependencies, CellMap } from "./dependencies.js";
import { checkedLineage, tracePrecedents, traceDependents } from "./lineage.js";
import { followsMove } from "./references.js";
let gridSequence = 0;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
function toPortableValue(value) {
  if (value instanceof FormulaError) return value.toJSON();
  if (
    value instanceof CalendarDate ||
    value instanceof ClockTime ||
    value instanceof DurationValue
  )
    return value.toJSON();
  if (value instanceof DecimalValue) return value.toJSON();
  if (value instanceof JSONValue) return toPortableValue(value.value);
  if (value instanceof Date)
    return { $tinyDatagridType: "date", value: value.toISOString() };
  if (typeof value === "bigint")
    return { $tinyDatagridType: "bigint", value: String(value) };
  if (value instanceof ArrayBuffer)
    return { $tinyDatagridType: "binary", value: [...new Uint8Array(value)] };
  if (ArrayBuffer.isView(value))
    return {
      $tinyDatagridType: "binary",
      value: [
        ...new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
      ],
    };
  if (Array.isArray(value)) return value.map(toPortableValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toPortableValue(item)]),
    );
  return value;
}
export function fromPortableValue(value) {
  if (Array.isArray(value)) return value.map(fromPortableValue);
  if (value && typeof value === "object") {
    if (value.$tinyDatagridType === "error")
      return new FormulaError(value.code, value.message);
    if (value.$tinyDatagridType === "calendar-date")
      return CalendarDate.parse(value.value);
    if (value.$tinyDatagridType === "time") return new ClockTime(value.seconds);
    if (value.$tinyDatagridType === "duration")
      return new DurationValue(value.seconds);
    if (value.$tinyDatagridType === "decimal")
      return DecimalValue.parse(value.value);
    if (value.$tinyDatagridType === "date" && typeof value.value === "string")
      return new Date(value.value);
    if (value.$tinyDatagridType === "bigint" && typeof value.value === "string")
      return BigInt(value.value);
    if (value.$tinyDatagridType === "binary" && Array.isArray(value.value))
      return Uint8Array.from(value.value);
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        fromPortableValue(item),
      ]),
    );
  }
  return value;
}
function cursorKey(value) {
  try {
    return JSON.stringify(toPortableValue(value)) ?? String(value);
  } catch {
    return String(value);
  }
}
const SHARE_HASH_PREFIX = "tg1.";
function encodeSharePayload(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value)),
    binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return (
    SHARE_HASH_PREFIX +
    btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
  );
}
function decodeSharePayload(hash) {
  const encoded = String(hash ?? "").replace(/^#/, "");
  if (!encoded.startsWith(SHARE_HASH_PREFIX))
    throw new TypeError("URL does not contain a tinyDatagrid share link");
  const base64 = encoded
    .slice(SHARE_HASH_PREFIX.length)
    .replaceAll("-", "+")
    .replaceAll("_", "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")),
    bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return parseDataJSON(new TextDecoder().decode(bytes));
}
function resultHasMore(result) {
  return result?.hasMore == null
    ? result?.nextCursor != null
    : Boolean(result.hasMore);
}
function upperBound(values, target) {
  let low = 0,
    high = values.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (values[middle] <= target) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function colToName(index) {
  let n = index + 1,
    s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function nameToCol(name) {
  let n = 0;
  for (const ch of name.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

export function parseA1(ref) {
  const m = /^\$?([A-Z]+)\$?(\d+)$/i.exec(ref.trim());
  if (!m) return null;
  return { col: nameToCol(m[1]), row: Number(m[2]) - 1 };
}

export function toA1(row, col) {
  return `${colToName(col)}${row + 1}`;
}

/** Parse a CSV string, including quoted fields, escaped quotes and newlines. */
export function parseCSV(text, delimiter = ",") {
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
  const input = String(text ?? "").replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length || (input && !/[\r\n]$/.test(input))) {
    row.push(field);
    rows.push(row);
  }
  if (
    rows.length &&
    rows.at(-1).length === 1 &&
    rows.at(-1)[0] === "" &&
    /[\r\n]$/.test(input)
  )
    rows.pop();
  return rows;
}

export function detectDelimiter(text) {
  const sample = String(text ?? "")
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .slice(0, 12),
    candidates = [",", ";", "\t", "|"];
  const counts = Object.fromEntries(
    candidates.map((delimiter) => [delimiter, []]),
  );
  for (const line of sample) {
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"' && line[i + 1] === '"' && quoted) {
        i++;
        continue;
      }
      if (line[i] === '"') quoted = !quoted;
      else if (!quoted && candidates.includes(line[i])) counts[line[i]].push(1);
    }
  }
  return candidates
    .map((delimiter) => ({
      delimiter,
      score:
        counts[delimiter].reduce((sum, n) => formulaNumber(sum + n), 0) /
        Math.max(1, sample.length),
    }))
    .sort((a, b) => b.score - a.score)[0].delimiter;
}

export function parseMarkdownTable(text) {
  const lines = String(text ?? "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"));
  const rows = lines.map((line) =>
    line
      .slice(1, -1)
      .split(/(?<!\\)\|/)
      .map((value) => value.trim().replaceAll("\\|", "|")),
  );
  return rows.filter((row) => !row.every((value) => /^:?-{3,}:?$/.test(value)));
}

function importMarkupTable(markup, selector = "table") {
  const doc = new DOMParser().parseFromString(
      String(markup ?? ""),
      "text/html",
    ),
    table = doc.querySelector(selector);
  if (!table) throw new TypeError("No table found in imported markup");
  return [...table.querySelectorAll("tr")].map((row) =>
    [...row.querySelectorAll("th,td")].map(
      (cell) => cell.getAttribute("data-formula") || cell.textContent.trim(),
    ),
  );
}

export function stringifyCSV(rows, delimiter = ",") {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = rawText(value);
          return /["\r\n]/.test(text) || text.includes(delimiter)
            ? `"${text.replaceAll('"', '""')}"`
            : text;
        })
        .join(delimiter),
    )
    .join("\r\n");
}

function normalizeRange(a, b) {
  return {
    r1: Math.min(a.row, b.row),
    c1: Math.min(a.col, b.col),
    r2: Math.max(a.row, b.row),
    c2: Math.max(a.col, b.col),
  };
}

// List context: ranges flatten deeply and JSON arrays contribute their elements.
const flatten = flattenValues;
// Structural view for error scans: JSON contents are data, never formula errors.
const flattenPlain = (v) => (Array.isArray(v) ? v.flat(Infinity) : [v]);

const asNumber = formulaNumber;
const blank = (value) => value === "" || value == null;
function convertNumber(value, allowBlank = false) {
  if (blank(value)) {
    if (allowBlank) return 0;
    throw new TypeError("Blank is not a number");
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  const parsed =
    typeof value === "string"
      ? parseNumericValue(value)
      : { numeric: true, value };
  if (!parsed.numeric || parsed.lossy)
    throw new TypeError("Invalid numeric conversion");
  return parsed.value;
}
function selectAggregate(values, pairs, aggregate) {
  if (!pairs.length || pairs.length % 2) return new FormulaError("#VALUE!");
  const data = flatten(values),
    ranges = pairs.filter((_, i) => i % 2 === 0).map(flatten),
    criteria = pairs.filter((_, i) => i % 2 === 1);
  if (ranges.some((range) => range.length !== data.length))
    return new FormulaError("#VALUE!");
  return aggregate(
    data.filter((_, i) =>
      criteria.every((criterion, j) =>
        criteriaMatches(ranges[j][i], criterion),
      ),
    ),
  );
}
function bool(value) {
  if (typeof value !== "boolean")
    throw new TypeError("Expected boolean condition");
  return value;
}

function criteriaMatches(value, criteria) {
  const text = String(criteria ?? "");
  const match = /^(<=|>=|<>|!=|=|<|>)(.*)$/.exec(text);
  let operator = "=",
    expected = criteria;
  if (match) {
    operator = match[1];
    expected = match[2];
  }
  const lp = parseNumericValue(value),
    rp = parseNumericValue(expected),
    left = lp.value,
    right = rp.value;
  const numeric =
    value !== "" &&
    expected !== "" &&
    lp.numeric &&
    rp.numeric &&
    !lp.lossy &&
    !rp.lossy;
  const a = numeric ? left : String(value ?? "").toLocaleLowerCase(),
    b = numeric ? right : String(expected ?? "").toLocaleLowerCase();
  if (operator === "=") {
    if (typeof expected === "string" && /[?*]/.test(expected)) {
      const pattern = expected
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replaceAll("*", ".*")
        .replaceAll("?", ".");
      return new RegExp(`^${pattern}$`, "i").test(String(value ?? ""));
    }
    return numeric
      ? a == b
      : String(value ?? "").toLocaleLowerCase() ===
          String(expected ?? "").toLocaleLowerCase();
  }
  if (operator === "!=" || operator === "<>") return numeric ? a != b : a !== b;
  if (operator === "<") return a < b;
  if (operator === ">") return a > b;
  if (operator === "<=") return a <= b;
  if (operator === ">=") return a >= b;
  return false;
}

const normalizedRows = rowsOf;
/** Element-wise evaluation over ranges. Size-1 dimensions stretch; other mismatches yield #N/A. */
function broadcast(values, fn) {
  const matrices = values.map((value) =>
    Array.isArray(value) ? rowsOf(value) : null,
  );
  const shapes = matrices.map((matrix) =>
    matrix
      ? [matrix.length, Math.max(1, ...matrix.map((line) => line.length))]
      : [1, 1],
  );
  const height = Math.max(...shapes.map((shape) => shape[0])),
    width = Math.max(...shapes.map((shape) => shape[1]));
  if (height * width > 100000) throw new RangeError("Array too large");
  return Array.from({ length: height }, (_, i) =>
    Array.from({ length: width }, (_, j) => {
      const items = [];
      for (let k = 0; k < values.length; k++) {
        const matrix = matrices[k];
        if (!matrix) {
          items.push(values[k]);
          continue;
        }
        const [h, w] = shapes[k],
          ii = h === 1 ? 0 : i,
          jj = w === 1 ? 0 : j;
        if (ii >= h || jj >= w) return new FormulaError("#N/A");
        items.push(matrix[ii][jj] ?? "");
      }
      return fn(...items);
    }),
  );
}
const elementError = (error) =>
  error instanceof RangeError
    ? new FormulaError("#NUM!")
    : new FormulaError("#VALUE!");
// Scalar functions that map over ranges (=UPPER(A1:A9), =JSON.GET(A1:A9; "id")).
const LIFTED = new Set([
  "ABS",
  "ROUND",
  "ROUNDUP",
  "ROUNDDOWN",
  "FLOOR",
  "CEIL",
  "INT",
  "SQRT",
  "POW",
  "POWER",
  "MOD",
  "SIGN",
  "EXP",
  "LN",
  "LOG",
  "NOT",
  "ISBLANK",
  "ISNUMBER",
  "ISTEXT",
  "ISLOGICAL",
  "N",
  "VALUE",
  "LEN",
  "UPPER",
  "LOWER",
  "PROPER",
  "LEFT",
  "RIGHT",
  "MID",
  "FIND",
  "SEARCH",
  "SUBSTITUTE",
  "REPLACE",
  "TEXT",
  "YEAR",
  "MONTH",
  "DAY",
  "HOUR",
  "MINUTE",
  "SECOND",
  "DATE",
  "DATEVALUE",
  "DAYS",
  "ENCODEURL",
  "DECODEURL",
  "TRIM",
  "LTRIM",
  "RTRIM",
  "SQUEEZE",
  "SUBSTR",
  "SUBSTRING",
  "REVERSE",
  "REPEAT",
  "STARTSWITH",
  "ENDSWITH",
  "CONTAINS",
  "REPLACEALL",
  "PADSTART",
  "PADEND",
  "REGEXP",
  "REGEXTEST",
  "REGEXMATCH",
  "REGEXP_EXTRACT",
  "REGEXEXTRACT",
  "REGEXP_REPLACE",
  "REGEXREPLACE",
  "RADIANS",
  "DEGREES",
  "SIN",
  "COS",
  "TAN",
  "ASIN",
  "ACOS",
  "ATAN",
  "ATAN2",
  "GEO.DISTANCE",
  "GEO.BEARING",
  "GEOM.DISTANCE",
  "GEOM.CIRCLE.AREA",
  "GEOM.CIRCLE.CIRCUMFERENCE",
  "GEOM.RECTANGLE.AREA",
  "GEOM.TRIANGLE.AREA",
  "GEOM.SPHERE.VOLUME",
  "GEOM.SPHERE.AREA",
  "HASH.SHA256",
  "HASH.FNV1A",
  "HASH.CRC32",
  ...Object.keys(createCalendarFunctions()).filter(
    (name) =>
      ![
        "DATE.SEQUENCE",
        "TODAY",
        "NOW",
        "NETWORKDAYS",
        "NETWORKDAYS.INTL",
        "WORKDAY",
        "WORKDAY.INTL",
      ].includes(name),
  ),
  ...Object.keys(createColorFunctions()).filter(
    (name) => name !== "COLOR.PALETTE",
  ),
  "DECIMAL.PARSE",
  "DECIMAL.ADD",
  "DECIMAL.SUBTRACT",
  "DECIMAL.MULTIPLY",
  "DECIMAL.DIVIDE",
  "DECIMAL.ROUND",
  "DECIMAL.FORMAT",
  "DECIMAL.NUMBER",
  "JSON.PARSE",
  "JSON.GET",
  "JSON.HAS",
  "JSON.TYPE",
  "JSON.VALID",
  "JSON.LENGTH",
]);

/** Text matcher shared by find() and replace(). */
function textMatcher(
  query,
  { matchCase = false, wholeCell = false, regex = false } = {},
) {
  const text = String(query ?? "");
  if (text === "") return null;
  if (text.length > 500) throw new RangeError("Search text is too long");
  let source = regex ? text : text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (wholeCell) source = `^(?:${source})$`;
  const flags = "u" + (matchCase ? "" : "i");
  const probe = new RegExp(source, flags),
    global = new RegExp(source, flags + "g");
  return {
    test: (value) => probe.test(value),
    replace(value, replacement) {
      const matches = value.match(global);
      if (!matches) return { text: value, count: 0 };
      return {
        text: regex
          ? value.replace(global, replacement)
          : value.replace(global, () => replacement),
        count: matches.length,
      };
    },
  };
}

class FormulaTokenizer {
  constructor(input) {
    this.s = input;
    this.i = 0;
    this.tokens = [];
  }
  tokenize() {
    while (this.i < this.s.length) {
      const c = this.s[this.i];
      if (/\s/.test(c)) {
        this.i++;
        continue;
      }
      if (c === '"') {
        this.tokens.push(this.readString());
        continue;
      }
      if (c === "'") {
        this.i++;
        let name = "",
          closed = false;
        while (this.i < this.s.length) {
          const ch = this.s[this.i++];
          if (ch === "'") {
            if (this.s[this.i] === "'") {
              name += "'";
              this.i++;
              continue;
            }
            closed = true;
            break;
          }
          name += ch;
        }
        if (!closed) throw new Error("Unclosed sheet name");
        this.tokens.push({ type: "sheet", value: name });
        continue;
      }
      if (c === "!") {
        this.tokens.push({ type: "!", value: c });
        this.i++;
        continue;
      }
      if (c === "#") {
        this.tokens.push({ type: "#", value: c });
        this.i++;
        continue;
      }
      if (/[0-9.]/.test(c)) {
        this.tokens.push(this.readNumber());
        continue;
      }
      if (/[\p{L}_@$]/u.test(c)) {
        this.tokens.push(this.readIdent());
        continue;
      }
      const two = this.s.slice(this.i, this.i + 2);
      if (["<=", ">=", "<>", "!=", "=="].includes(two)) {
        this.tokens.push({ type: "op", value: two });
        this.i += 2;
        continue;
      }
      if (c === "," || c === ";") {
        this.tokens.push({ type: ",", value: "," });
        this.i++;
        continue;
      }
      if ("+-*/^%=<>()\,:&".includes(c)) {
        const type = "(),:".includes(c) ? c : "op";
        this.tokens.push({ type, value: c });
        this.i++;
        continue;
      }
      throw new Error(`Unexpected character '${c}'`);
    }
    this.tokens.push({ type: "eof", value: "" });
    return this.tokens;
  }
  readString() {
    this.i++;
    let out = "",
      closed = false;
    while (this.i < this.s.length) {
      const c = this.s[this.i++];
      if (c === '"') {
        if (this.s[this.i] === '"') {
          out += '"';
          this.i++;
          continue;
        }
        closed = true;
        break;
      }
      out += c;
    }
    if (!closed) throw new Error("Unclosed text literal");
    return { type: "string", value: out };
  }
  readNumber() {
    const start = this.i;
    while (/[0-9.eE+-]/.test(this.s[this.i] || "")) {
      const chunk = this.s.slice(start, this.i + 1);
      if (!/^\d*\.?\d*(?:[eE][+-]?\d*)?$/.test(chunk)) break;
      this.i++;
    }
    return {
      type: "number",
      value: formulaNumber(this.s.slice(start, this.i)),
    };
  }
  readIdent() {
    const start = this.i;
    if (this.s[this.i] === "@") this.i++;
    while (/[\p{L}\p{M}0-9_.$]/u.test(this.s[this.i] || "")) this.i++;
    return { type: "ident", value: this.s.slice(start, this.i) };
  }
}

class FormulaParser {
  constructor(tokens) {
    this.t = tokens;
    this.i = 0;
  }
  peek(type, value) {
    const t = this.t[this.i];
    return t.type === type && (value == null || t.value === value);
  }
  take(type, value) {
    const t = this.t[this.i];
    if (!this.peek(type, value))
      throw new Error(`Expected ${value ?? type}, got ${t.value || t.type}`);
    this.i++;
    return t;
  }
  parse() {
    const e = this.expr(0);
    this.take("eof");
    return e;
  }
  expr(minBp) {
    let left;
    const t = this.t[this.i++];
    if (t.type === "number" || t.type === "string")
      left = { type: "literal", value: t.value };
    else if (t.type === "op" && ["+", "-"].includes(t.value))
      left = { type: "unary", op: t.value, expr: this.expr(70) };
    else if (t.type === "(") {
      left = this.expr(0);
      this.take(")");
    } else if (t.type === "ident" || t.type === "sheet") {
      if (this.peek("!")) {
        this.i++;
        const cell = this.take("ident").value;
        if (!parseA1(cell)) throw new Error("Expected cell after sheet name");
        left = { type: "sheetref", sheet: t.value, name: cell };
      } else if (t.type === "sheet")
        throw new Error("Expected ! after sheet name");
      else if (this.peek("(")) {
        this.i++;
        const args = [];
        if (!this.peek(")")) {
          do {
            args.push(this.expr(0));
            if (!this.peek(",")) break;
            this.i++;
          } while (true);
        }
        this.take(")");
        left = { type: "call", name: t.value.toUpperCase(), args };
      } else {
        left = { type: "ident", name: t.value };
        if (this.peek("#") && parseA1(t.value)) {
          this.i++;
          left = { type: "spillref", target: left };
        }
      }
    } else throw new Error(`Unexpected token ${t.value || t.type}`);

    while (true) {
      const p = this.t[this.i];
      if (p.type === ":") {
        if (90 < minBp) break;
        this.i++;
        const right = this.expr(91);
        left = { type: "range", left, right };
        continue;
      }
      if (p.type !== "op") break;
      const bp = {
        "=": 10,
        "==": 10,
        "<>": 10,
        "!=": 10,
        "<": 10,
        ">": 10,
        "<=": 10,
        ">=": 10,
        "&": 20,
        "+": 30,
        "-": 30,
        "*": 40,
        "/": 40,
        "%": 40,
        "^": 50,
      }[p.value];
      if (bp == null || bp < minBp) break;
      this.i++;
      const right = this.expr(bp + (p.value === "^" ? 0 : 1));
      left = { type: "binary", op: p.value, left, right };
    }
    return left;
  }
}

const normalizeFunctionName = resolveFormulaName;

export class FormulaEngine {
  constructor(grid) {
    this.grid = grid;
    this.cache = new Map();
    this.dependencies = new Dependencies(this.cache);
    this.locals = [];
    this.functions = {
      SUM: (...xs) => sumNumbers(flatten(xs)),
      AVERAGE: (...xs) => meanNumbers(flatten(xs)),
      MIN: (...xs) => numericExtreme(flatten(xs), false),
      MAX: (...xs) => numericExtreme(flatten(xs), true),
      MEDIAN: (...xs) => {
        const a = flatten(xs)
            .filter((v) => !blank(v))
            .map(numericOperand)
            .sort(compareDecimals),
          m = a.length >> 1;
        return a.length
          ? a.length % 2
            ? a[m]
            : divideNumbers(arithmetic("+", a[m - 1], a[m]), 2)
          : new FormulaError("#N/A");
      },
      LARGE: (array, k) => {
        const a = flatten(array)
          .filter((v) => !blank(v))
          .map(numericOperand)
          .sort((x, y) => compareDecimals(y, x));
        return a[textIndex(k) - 1] ?? new FormulaError("#N/A");
      },
      SMALL: (array, k) => {
        const a = flatten(array)
          .filter((v) => !blank(v))
          .map(numericOperand)
          .sort(compareDecimals);
        return a[textIndex(k) - 1] ?? new FormulaError("#N/A");
      },
      COUNT: (...xs) => numericCount(flatten(xs)),
      COUNTA: (...xs) =>
        flatten(xs).filter((v) => v !== "" && v != null).length,
      COUNTBLANK: (...xs) =>
        flatten(xs).filter((v) => v === "" || v == null).length,
      ABS: (x) => Math.abs(asNumber(x)),
      ROUND: (x, n = 0) =>
        compactDecimal(roundDecimal(numericOperand(x), asNumber(n), "half-up")),
      ROUNDUP: (x, n = 0) =>
        compactDecimal(
          roundDecimal(numericOperand(x), asNumber(n), "away-zero"),
        ),
      ROUNDDOWN: (x, n = 0) =>
        compactDecimal(
          roundDecimal(numericOperand(x), asNumber(n), "toward-zero"),
        ),
      FLOOR: (x) => Math.floor(asNumber(x)),
      CEIL: (x) => Math.ceil(asNumber(x)),
      SQRT: (x) => Math.sqrt(asNumber(x)),
      POW: (a, b) => Math.pow(asNumber(a), asNumber(b)),
      MOD: (a, b) => asNumber(a) % asNumber(b),
      SIGN: (x) => Math.sign(asNumber(x)),
      IF: (cond, a, b) => (cond ? a : b),
      IFS: (...xs) => {
        for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i]) return xs[i + 1];
        return new FormulaError("#N/A");
      },
      SWITCH: (value, ...xs) => {
        for (let i = 0; i + 1 < xs.length; i += 2)
          if (value === xs[i]) return xs[i + 1];
        return xs.length % 2 ? xs.at(-1) : new FormulaError("#N/A");
      },
      CHOOSE: (index, ...xs) =>
        xs[Math.trunc(asNumber(index)) - 1] ?? new FormulaError("#VALUE!"),
      IFERROR: (value, fallback) => (isFormulaError(value) ? fallback : value),
      IFNA: (value, fallback) =>
        isFormulaError(value) && value.code === "#N/A" ? fallback : value,
      AND: (...xs) => flatten(xs).every(bool),
      OR: (...xs) => flatten(xs).some(bool),
      XOR: (...xs) => flatten(xs).filter(bool).length % 2 === 1,
      NOT: (x) => !bool(x),
      TRUE: () => true,
      FALSE: () => false,
      ISBLANK: (x) => x === "" || x == null,
      ISNUMBER: (x) =>
        (typeof x === "number" && Number.isFinite(x)) ||
        typeof x === "bigint" ||
        x instanceof DecimalValue,
      ISTEXT: (x) => typeof x === "string" && !isFormulaError(x),
      ISLOGICAL: (x) => typeof x === "boolean",
      ISERROR: isFormulaError,
      N: (x) => convertNumber(x, true),
      VALUE: (x) => {
        try {
          return convertNumber(x);
        } catch (error) {
          return error instanceof RangeError
            ? new FormulaError("#NUM!")
            : new FormulaError("#VALUE!");
        }
      },
      CONCAT: (...xs) => flatten(xs).join(""),
      LEN: (x) => codePoints(x).length,
      TEXTJOIN: (separator, ignoreEmpty, ...xs) =>
        flatten(xs)
          .filter((v) => !bool(ignoreEmpty) || (v !== "" && v != null))
          .join(String(separator ?? "")),
      UPPER: (x) => String(x ?? "").toUpperCase(),
      LOWER: (x) => String(x ?? "").toLowerCase(),
      PROPER: (x) =>
        String(x ?? "")
          .toLowerCase()
          .replace(
            /(^|[^\p{L}\p{M}\p{N}])(\p{L})/gu,
            (_, prefix, char) => prefix + char.toUpperCase(),
          ),
      LEFT: (x, n = 1) =>
        codePoints(x)
          .slice(0, textIndex(n, { zero: true }))
          .join(""),
      RIGHT: (x, n = 1) => {
        const count = textIndex(n, { zero: true });
        return count ? codePoints(x).slice(-count).join("") : "";
      },
      MID: (x, start, n) =>
        codePoints(x)
          .slice(
            textIndex(start) - 1,
            textIndex(start) - 1 + textIndex(n, { zero: true }),
          )
          .join(""),
      FIND: (needle, haystack, start = 1) => findText(needle, haystack, start),
      SEARCH: (needle, haystack, start = 1) =>
        findText(needle, haystack, start, true),
      SUBSTITUTE: (text, oldText, newText, instance) => {
        const s = String(text ?? ""),
          old = String(oldText ?? ""),
          replacement = String(newText ?? "");
        if (!old) return s;
        if (instance == null) return s.split(old).join(replacement);
        let seen = 0;
        return s.replaceAll(old, (m) =>
          ++seen === asNumber(instance) ? replacement : m,
        );
      },
      REPLACE: (text, start, count, replacement) => {
        const a = codePoints(text),
          i = textIndex(start) - 1;
        a.splice(
          i,
          textIndex(count, { zero: true }),
          ...Array.from(String(replacement ?? "")),
        );
        return a.join("");
      },
      TEXT: (value, format) => {
        const f = String(format ?? "General");
        if (/%/.test(f))
          return `${(asNumber(value) * 100).toFixed((f.split(".")[1] || "").replace(/[^0]/g, "").length)}%`;
        const decimals = (f.split(".")[1] || "").replace(/[^0#]/g, "").length;
        return Number.isFinite(Number(value))
          ? formulaNumber(value).toLocaleString(undefined, {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            })
          : String(value ?? "");
      },
      SUMIF: (range, criteria, sumRange = range) => {
        const a = flatten(range),
          b = flatten(sumRange);
        if (a.length !== b.length) return new FormulaError("#VALUE!");
        return sumNumbers(
          a.flatMap((v, i) => (criteriaMatches(v, criteria) ? [b[i]] : [])),
        );
      },
      COUNTIF: (range, criteria) =>
        flatten(range).filter((v) => criteriaMatches(v, criteria)).length,
      AVERAGEIF: (range, criteria, averageRange = range) => {
        const a = flatten(range),
          b = flatten(averageRange);
        if (a.length !== b.length) return new FormulaError("#VALUE!");
        return meanNumbers(
          a.flatMap((v, i) => (criteriaMatches(v, criteria) ? [b[i]] : [])),
        );
      },
      SUMIFS: (sumRange, ...xs) => selectAggregate(sumRange, xs, sumNumbers),
      COUNTIFS: (...xs) => {
        if (!xs.length || xs.length % 2) return new FormulaError("#VALUE!");
        const ranges = xs.filter((_, i) => i % 2 === 0).map(flatten),
          criteria = xs.filter((_, i) => i % 2 === 1);
        if (ranges.some((a) => a.length !== ranges[0].length))
          return new FormulaError("#VALUE!");
        return ranges[0].filter((_, i) =>
          criteria.every((c, j) => criteriaMatches(ranges[j][i], c)),
        ).length;
      },
      AVERAGEIFS: (averageRange, ...xs) =>
        selectAggregate(averageRange, xs, meanNumbers),
      ...createDecimalFunctions(),
      ...createLookupFunctions(),
      ...createExtendedFunctions(),
      ...createTextFunctions(),
      ...createArrayFunctions(),
      ...createJsonFunctions(),
      FILTER: (array, include, ifEmpty = "") => {
        const rows = normalizedRows(array),
          mask = flatten(include);
        if (mask.length !== rows.length)
          return new FormulaError("#VALUE!", "Filter mask size mismatch");
        const out = rows.filter((_, i) => bool(mask[i]));
        return out.length ? out : ifEmpty;
      },
      UNIQUE: (array) => {
        const rows = normalizedRows(array),
          seen = new Set();
        return rows.filter((row) => {
          const k = JSON.stringify(row);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      },
      SORT: (array, index = 1, order = 1) => {
        const rows = normalizedRows(array),
          col = textIndex(index) - 1,
          direction = asNumber(order);
        if (
          ![1, -1].includes(direction) ||
          rows.some((row) => col >= row.length)
        )
          return new FormulaError("#VALUE!", "Invalid sort column/order");
        return [...rows].sort((a, b) => {
          const x = a[col],
            y = b[col];
          return (
            (typeof x === "number" && typeof y === "number"
              ? x - y
              : String(x ?? "").localeCompare(String(y ?? ""), undefined, {
                  numeric: true,
                  sensitivity: "base",
                })) * direction
          );
        });
      },
      SEQUENCE: (rows = 1, columns = 1, start = 1, step = 1) => {
        const r = textIndex(rows, { zero: true }),
          c = textIndex(columns, { zero: true });
        if (r > 10000 || c > 10000 || r * c > 100000)
          return new FormulaError("#NUM!");
        return Array.from({ length: r }, (_, ri) =>
          Array.from(
            { length: c },
            (_, ci) => asNumber(start) + (ri * c + ci) * asNumber(step),
          ),
        );
      },
      TRANSPOSE: (array) => {
        const rows = normalizedRows(array);
        return rows[0].map((_, c) => rows.map((row) => row[c] ?? ""));
      },
      ROWS: (array) => normalizedRows(array).length,
      COLUMNS: (array) => normalizedRows(array)[0]?.length || 0,
      HSTACK: (...arrays) => {
        const matrices = arrays.map(normalizedRows),
          rows = Math.max(0, ...matrices.map((a) => a.length));
        return Array.from({ length: rows }, (_, r) =>
          matrices.flatMap((a) => a[r] || Array(a[0]?.length || 1).fill("")),
        );
      },
      VSTACK: (...arrays) => arrays.flatMap((a) => normalizedRows(a)),
      SUMPRODUCT: (...arrays) => {
        const values = arrays.map(flatten);
        if (!values.length || values.some((a) => a.length !== values[0].length))
          return new FormulaError("#VALUE!");
        return sumNumbers(
          values[0].map((_, i) =>
            values.reduce((product, a) => arithmetic("*", product, a[i]), 1),
          ),
        );
      },
      MAP: (array, lambda) => {
        const rows = normalizedRows(array);
        return rows.map((row) => [lambda(...row)]);
      },
      REDUCE: (initial, array, lambda) =>
        flatten(array).reduce((acc, value) => lambda(acc, value), initial),
      SCAN: (initial, array, lambda) =>
        flatten(array).reduce((out, value) => {
          const prev = out.length ? out.at(-1)[0] : initial;
          out.push([lambda(prev, value)]);
          return out;
        }, []),
      BYROW: (array, lambda) =>
        normalizedRows(array).map((row) => [lambda(row)]),
      PIVOT: (...args) => PivotEngine.fromArray(...args),
      MAKEARRAY: (rows, columns, lambda) => {
        const r = textIndex(rows, { zero: true }),
          c = textIndex(columns, { zero: true });
        if (r > 10000 || c > 10000 || r * c > 100000)
          return new FormulaError("#NUM!");
        return Array.from({ length: r }, (_, ri) =>
          Array.from({ length: c }, (_, ci) => lambda(ri + 1, ci + 1)),
        );
      },
      PI: () => Math.PI,
      EXP: (x) => Math.exp(asNumber(x)),
      LN: (x) => Math.log(asNumber(x)),
      LOG: (x, base = 10) => Math.log(asNumber(x)) / Math.log(asNumber(base)),
    };
    Object.assign(
      this.functions,
      createCalendarFunctions(() => new Date(this.dependencies.cycleTime)),
      createColorFunctions(),
    );
    // Keep exactly one callback per ID. Non-enumerable accessors preserve direct
    // legacy/translated access, including when the canonical callback is replaced.
    this.functions = Object.fromEntries(
      Object.entries(this.functions).filter(
        ([name]) => resolveFormulaName(name) === name,
      ),
    );
    this._builtInFunctions = new Map(Object.entries(this.functions));
    for (const definition of formulaCatalog)
      for (const alias of definition.aliases) {
        if (alias === definition.id) continue;
        Object.defineProperty(this.functions, alias, {
          configurable: true,
          get: () => this.functions[definition.id],
          set: (fn) => {
            this.functions[definition.id] = fn;
          },
        });
      }
    this._customFunctions = new Set();
    this.registerFunctions(grid.options?.functions ?? {});
  }
  registerFunction(name, fn) {
    return this.registerFunctions({ [normalizeFunctionName(name)]: fn });
  }
  registerFunctions(functions) {
    if (!functions || typeof functions !== "object" || Array.isArray(functions))
      throw new TypeError(
        "functions must be an object mapping names to JavaScript functions",
      );
    const entries = Object.entries(functions).map(([name, fn]) => {
      const normalized = normalizeFunctionName(name);
      if (typeof fn !== "function")
        throw new TypeError(
          `Formula function ${name} must be a JavaScript function`,
        );
      return [normalized, fn];
    });
    if (new Set(entries.map(([name]) => name)).size !== entries.length)
      throw new TypeError(
        "Duplicate formula function names after normalization",
      );
    for (const [name, fn] of entries) {
      this.functions[name] = fn;
      this._customFunctions.add(name);
    }
    this.clearCache();
    return this;
  }
  unregisterFunction(name) {
    name = normalizeFunctionName(name);
    if (!this._customFunctions.delete(name)) return false;
    if (this._builtInFunctions.has(name))
      this.functions[name] = this._builtInFunctions.get(name);
    else delete this.functions[name];
    this.clearCache();
    return true;
  }
  _callCustomFunction(name, args) {
    const error = args.flatMap(flattenPlain).find(isFormulaError);
    if (error) return error;
    return this._invokeFunction(this.functions[name], args);
  }
  _invokeFunction(fn, args) {
    try {
      const result = fn(...args);
      if (result && typeof result.then === "function") {
        Promise.resolve(result).catch(() => {});
        return new FormulaError(
          "#ERROR! Custom formula functions must return synchronously",
        );
      }
      return wrapResult(checkedResult(result));
    } catch (error) {
      return error instanceof RangeError
        ? new FormulaError("#NUM!")
        : error instanceof TypeError
          ? new FormulaError("#VALUE!")
          : new FormulaError(
              `#ERROR! ${error instanceof Error ? error.message : String(error)}`,
            );
    }
  }
  clearCache() {
    this.dependencies.clear();
  }
  // ---- dynamic arrays -------------------------------------------------------
  // A formula that returns a range of more than one cell fills the cells to its
  // right and below (its spill). Only the top-left value belongs to the formula
  // cell itself; the rest are read-only results, registered in dependencies.spills.
  cellChanged(key) {
    const dep = this.dependencies;
    if (!dep.spills.size && !dep.blocked.size) return;
    const skip = new Set(dep.stack),
      origin = dep.covered.get(this.grid._calculationKey(key));
    if (origin) dep.invalidate(origin, skip);
    if (dep.blocked.size) {
      const [row, col] = key.split(",").map(Number);
      for (const [name, info] of dep.blocked)
        if (
          info.owner === this.grid &&
          row >= info.row &&
          row < info.row + info.rows &&
          col >= info.col &&
          col < info.col + info.cols
        )
          dep.invalidate(name, skip);
    }
  }
  /** Evaluate cells invalidated since the last read so spill ranges are known before any value is returned. */
  settle() {
    const dep = this.dependencies,
      grid = this.grid;
    if (
      this._settling ||
      dep.stack.length ||
      (!dep.dirtyAll && !dep.dirty.size) ||
      typeof grid._ownKey !== "function"
    )
      return;
    this._settling = true;
    try {
      const isFormula = (raw) => typeof raw === "string" && raw.startsWith("=");
      for (let pass = 0; pass < 8; pass++) {
        const all = dep.dirtyAll,
          keys = all ? null : [...dep.dirty];
        dep.dirtyAll = false;
        dep.dirty.clear();
        const visit = (key) => {
          const split = key.indexOf(",");
          grid.getComputedValue(+key.slice(0, split), +key.slice(split + 1));
        };
        if (all) {
          for (const [key, cell] of grid.cells)
            if (
              isFormula(cell.raw) &&
              !this.cache.has(grid._calculationKey(key))
            )
              visit(key);
        } else
          for (const calc of keys) {
            const key = grid._ownKey(calc);
            if (key == null) continue;
            if (
              isFormula(grid.cells.get(key)?.raw) ||
              dep.spills.has(calc) ||
              dep.blocked.has(calc)
            )
              visit(key);
          }
        if (!dep.dirtyAll && !dep.dirty.size) break;
      }
    } finally {
      this._settling = false;
    }
    grid._growForSpills?.();
  }
  _spillKeys(info, each) {
    for (let r = info.row; r < info.row + info.rows; r++)
      for (let c = info.col; c < info.col + info.cols; c++)
        if (r !== info.row || c !== info.col)
          each(this.grid._calculationKey(this.grid.key(r, c)), r, c);
  }
  clearSpill(origin) {
    const dep = this.dependencies,
      old = dep.spills.get(origin);
    dep.blocked.delete(origin);
    if (!old) return;
    const skip = new Set(dep.stack);
    dep.spills.delete(origin);
    this._spillKeys(old, (key) => {
      if (dep.covered.get(key) === origin) {
        dep.covered.delete(key);
        dep.invalidate(key, skip);
      }
    });
    this._retryBlocked(old, skip);
  }
  /** Freed cells may let a blocked spill succeed: send blocked origins that touch the area back for re-evaluation. */
  _retryBlocked(area, skip) {
    const dep = this.dependencies;
    for (const [name, info] of dep.blocked)
      if (
        info.owner === this.grid &&
        info.row < area.row + area.rows &&
        area.row < info.row + info.rows &&
        info.col < area.col + area.cols &&
        area.col < info.col + info.cols
      )
        dep.invalidate(name, skip);
  }
  _blocker(origin, fp) {
    const dep = this.dependencies,
      grid = this.grid,
      area = fp.rows * fp.cols;
    const inside = (r, c) =>
      r >= fp.row &&
      r < fp.row + fp.rows &&
      c >= fp.col &&
      c < fp.col + fp.cols &&
      (r !== fp.row || c !== fp.col);
    const filled = (cell) => cell && cell.raw !== "" && cell.raw != null;
    if (area <= grid.cells.size) {
      for (let r = fp.row; r < fp.row + fp.rows; r++)
        for (let c = fp.col; c < fp.col + fp.cols; c++)
          if (
            (r !== fp.row || c !== fp.col) &&
            filled(grid.cells.get(grid.key(r, c)))
          )
            return `Blocked by ${toA1(r, c)}`;
    } else
      for (const [key, cell] of grid.cells) {
        if (!filled(cell)) continue;
        const [r, c] = key.split(",").map(Number);
        if (inside(r, c)) return `Blocked by ${toA1(r, c)}`;
      }
    for (const [name, other] of dep.spills) {
      if (name === origin || other.owner !== grid) continue;
      const overlap =
        other.row < fp.row + fp.rows &&
        fp.row < other.row + other.rows &&
        other.col < fp.col + fp.cols &&
        fp.col < other.col + other.cols;
      // The spill that starts first (row-major) keeps the cells.
      if (
        overlap &&
        (other.row < fp.row || (other.row === fp.row && other.col < fp.col))
      )
        return `Overlaps ${toA1(other.row, other.col)}`;
    }
    return null;
  }
  spillResult(origin, row, col, result) {
    const dep = this.dependencies,
      grid = this.grid,
      matrix = rowsOf(result).map((line) => line.slice());
    const rows = matrix.length,
      cols = matrix.reduce((n, line) => Math.max(n, line.length), 0);
    if (!rows || !cols) {
      this.clearSpill(origin);
      return "";
    }
    if (rows * cols === 1) {
      this.clearSpill(origin);
      return matrix[0][0];
    }
    for (const line of matrix) while (line.length < cols) line.push("");
    const info = { row, col, rows, cols, matrix, owner: grid },
      limit = grid.options?.maxSpillCells ?? 100000;
    const problem =
      rows * cols > limit ? "Result too large" : this._blocker(origin, info);
    if (problem) {
      this.clearSpill(origin);
      dep.blocked.set(origin, { ...info, matrix: null, message: problem });
      return new FormulaError(`#SPILL! ${problem}`);
    }
    const old = dep.spills.get(origin);
    dep.blocked.delete(origin);
    const same =
      old &&
      old.row === row &&
      old.col === col &&
      old.rows === rows &&
      old.cols === cols;
    dep.spills.set(origin, info);
    if (!same) {
      const skip = new Set(dep.stack),
        keep = new Set();
      this._spillKeys(info, (key) => {
        keep.add(key);
        if (dep.covered.get(key) !== origin) {
          const previous = dep.covered.get(key);
          dep.covered.set(key, origin);
          dep.invalidate(key, skip);
          if (previous && previous !== origin) dep.invalidate(previous, skip);
        }
      });
      if (old) {
        this._spillKeys(old, (key) => {
          if (!keep.has(key) && dep.covered.get(key) === origin) {
            dep.covered.delete(key);
            dep.invalidate(key, skip);
          }
        });
        this._retryBlocked(old, skip);
      }
      // Later overlapping spills must re-evaluate and yield.
      for (const [name, other] of dep.spills) {
        if (name === origin || other.owner !== grid) continue;
        if (
          other.row < row + rows &&
          row < other.row + other.rows &&
          other.col < col + cols &&
          col < other.col + other.cols
        )
          dep.invalidate(name, skip);
      }
    }
    return matrix[0][0];
  }
  evaluateFormula(formula, visiting = new Set()) {
    return displayFormulaResult(this.evaluateValue(formula, visiting));
  }
  evaluateValue(formula, visiting = new Set()) {
    try {
      const tokens = new FormulaTokenizer(formula.replace(/^=/, "")).tokenize();
      const ast = new FormulaParser(tokens).parse();
      return checkedResult(this.evalNode(ast, visiting));
    } catch (e) {
      return e instanceof RangeError
        ? new FormulaError("#NUM!")
        : e instanceof TypeError
          ? new FormulaError("#VALUE!")
          : new FormulaError(`#ERROR! ${e.message}`);
    }
  }
  applyBinary(op, a, b) {
    if (isFormulaError(a)) return a;
    if (isFormulaError(b)) return b;
    if (["=", "==", "<>", "!=", "<", ">", "<=", ">="].includes(op)) {
      if (a instanceof JSONValue || b instanceof JSONValue) {
        if (!["=", "==", "<>", "!="].includes(op))
          throw new TypeError("JSON values are not ordered");
        const same =
          a instanceof JSONValue &&
          b instanceof JSONValue &&
          jsonEquals(a.value, b.value);
        return op === "=" || op === "==" ? same : !same;
      }
      const order = compareScalars(a, b);
      if (op === "=" || op === "==") return order === 0;
      if (op === "<>" || op === "!=") return order !== 0;
      if (order === null)
        throw new TypeError("Cannot order different value types");
      return op === "<"
        ? order < 0
        : op === ">"
          ? order > 0
          : op === "<="
            ? order <= 0
            : order >= 0;
    }
    switch (op) {
      case "+":
        return arithmetic("+", a, b);
      case "-":
        return arithmetic("-", a, b);
      case "*":
        return arithmetic("*", a, b);
      case "/":
        return divideNumbers(a, b);
      case "%":
        return compareDecimals(numericOperand(b), 0) === 0
          ? new FormulaError("#DIV/0!")
          : arithmetic("%", a, b);
      case "^":
        return formulaNumber(Math.pow(formulaNumber(a), formulaNumber(b)));
      case "&":
        return String(a ?? "") + String(b ?? "");
      case "=":
      case "==":
        return a == b;
      case "<>":
      case "!=":
        return a != b;
      case "<":
        return a < b;
      case ">":
        return a > b;
      case "<=":
        return a <= b;
      case ">=":
        return a >= b;
    }
  }
  evalNode(n, visiting) {
    switch (n.type) {
      case "literal":
        return n.value;
      case "sheetref": {
        const sheets = this.grid.feature?.("worksheets");
        return sheets
          ? sheets.read(n.sheet, parseA1(n.name), visiting)
          : new FormulaError("#REF!");
      }
      case "spillref": {
        const p = parseA1(n.target.name);
        return this.grid.getSpill
          ? this.grid.getSpill(p.row, p.col, visiting)
          : (this.grid.getCalculationValue ?? this.grid.getComputedValue).call(
              this.grid,
              p.row,
              p.col,
              visiting,
            );
      }
      case "ident": {
        const upper = n.name.toUpperCase();
        const booleanName = /^[\p{L}_][\p{L}\p{M}0-9_.]*$/u.test(upper)
          ? resolveFormulaName(upper)
          : upper;
        if (booleanName === "TRUE") return true;
        if (booleanName === "FALSE") return false;
        for (let i = this.locals.length - 1; i >= 0; i--)
          if (Object.hasOwn(this.locals[i], upper))
            return this.locals[i][upper];
        if (/^\$?[A-Z]+\$?\d+$/.test(upper)) {
          const p = parseA1(upper);
          return (
            this.grid.getCalculationValue ?? this.grid.getComputedValue
          ).call(this.grid, p.row, p.col, visiting);
        }
        const key = n.name.startsWith("@") ? n.name.slice(1) : n.name;
        this.dependencies.read(`external:${key}`);
        if (this.grid.externalVariables?.has(key))
          return this.grid.externalVariables.get(key);
        this.dependencies.read(
          this.grid._calculationKey?.(`@${key}`) ?? `@${key}`,
        );
        if (this.grid.variables.has(key)) {
          const v = this.grid.variables.get(key);
          if (typeof v !== "string" || !v.startsWith("=")) return v;
          const variableKey =
            this.grid._calculationKey?.(`@${key}`) ?? `@${key}`;
          if (visiting.has(variableKey)) return new FormulaError("#CYCLE!");
          visiting.add(variableKey);
          try {
            return this.evaluateValue(v, visiting);
          } finally {
            visiting.delete(variableKey);
          }
        }
        return new FormulaError(`#NAME? ${n.name}`);
      }
      case "range": {
        if (
          !["ident", "sheetref"].includes(n.left.type) ||
          !["ident", "sheetref"].includes(n.right.type)
        )
          return new FormulaError("#RANGE!");
        const a = parseA1(n.left.name),
          b = parseA1(n.right.name);
        if (!a || !b) return new FormulaError("#RANGE!");
        const leftSheet = n.left.sheet,
          rightSheet = n.right.sheet;
        if (rightSheet && !leftSheet) return new FormulaError("#RANGE!");
        const sheets = this.grid.feature?.("worksheets");
        if (
          rightSheet &&
          sheets?.resolve(leftSheet) !== sheets?.resolve(rightSheet)
        )
          return new FormulaError("#RANGE!");
        const rr = normalizeRange(a, b),
          out = [];
        for (let r = rr.r1; r <= rr.r2; r++) {
          const row = [];
          for (let c = rr.c1; c <= rr.c2; c++)
            row.push(
              leftSheet
                ? sheets
                  ? sheets.read(leftSheet, { row: r, col: c }, visiting)
                  : new FormulaError("#REF!")
                : (
                    this.grid.getCalculationValue ?? this.grid.getComputedValue
                  ).call(this.grid, r, c, visiting),
            );
          out.push(row);
        }
        return out;
      }
      case "unary": {
        const raw = this.evalNode(n.expr, visiting);
        if (isFormulaError(raw)) return raw;
        if (Array.isArray(raw))
          return broadcast([raw], (x) => {
            if (isFormulaError(x)) return x;
            try {
              const v = numericOperand(x);
              return n.op === "-" ? arithmetic("*", v, -1) : v;
            } catch (error) {
              return elementError(error);
            }
          });
        const v = numericOperand(raw);
        return n.op === "-" ? arithmetic("*", v, -1) : v;
      }
      case "binary": {
        const a = this.evalNode(n.left, visiting),
          b = this.evalNode(n.right, visiting);
        if (Array.isArray(a) || Array.isArray(b))
          return broadcast([a, b], (x, y) => {
            try {
              return this.applyBinary(n.op, x, y);
            } catch (error) {
              return elementError(error);
            }
          });
        return this.applyBinary(n.op, a, b);
      }
      case "call": {
        n = { ...n, name: resolveFormulaName(n.name) };
        if (this._customFunctions.has(n.name))
          return this._callCustomFunction(
            n.name,
            n.args.map((arg) => this.evalNode(arg, visiting)),
          );
        if (n.name === "PIVOT") {
          if (n.args.length < 3 || n.args.length > 6)
            return new FormulaError("#VALUE!");
          const options = n.args
            .slice(1)
            .map((arg) => this.evalNode(arg, visiting));
          const error = options.flatMap(flattenPlain).find(isFormulaError);
          if (error) return error;
          const scope = String(options[4] ?? "all").toLowerCase();
          if (!["all", "visible"].includes(scope))
            return new FormulaError("#VALUE!");
          const source = n.args[0];
          let array;
          if (source.type === "range") {
            if (
              !["ident", "sheetref"].includes(source.left.type) ||
              !["ident", "sheetref"].includes(source.right.type)
            )
              return new FormulaError("#REF!");
            const a = parseA1(source.left.name),
              b = parseA1(source.right.name);
            if (!a || !b) return new FormulaError("#REF!");
            const range = normalizeRange(a, b),
              sheets = this.grid.feature?.("worksheets"),
              sheet = source.left.sheet;
            if (sheet || source.right.sheet)
              this.dependencies.read("worksheets:names");
            if (
              source.right.sheet &&
              (!sheet ||
                sheets?.resolve(sheet) !== sheets?.resolve(source.right.sheet))
            )
              return new FormulaError("#REF!");
            if (sheet && !sheets?.resolve(sheet))
              return new FormulaError("#REF!");
            if ((range.r2 - range.r1 + 1) * (range.c2 - range.c1 + 1) > 100000)
              return new FormulaError("#NUM!");
            if (scope === "visible" && !sheet)
              this.dependencies.read(this.grid._calculationKey("visibility"));
            array = [];
            for (let row = range.r1; row <= range.r2; row++) {
              if (
                scope === "visible" &&
                row > range.r1 &&
                !(sheet
                  ? sheets.isRowVisible(sheet, row, range.c1)
                  : this.grid.isTableRowVisible(row, range.c1))
              )
                continue;
              const values = [];
              for (let col = range.c1; col <= range.c2; col++)
                values.push(
                  sheet
                    ? sheets.read(sheet, { row, col }, visiting)
                    : (
                        this.grid.getCalculationValue ??
                        this.grid.getComputedValue
                      ).call(this.grid, row, col, visiting),
                );
              array.push(values);
            }
          } else {
            if (scope === "visible") return new FormulaError("#VALUE!");
            array = this.evalNode(source, visiting);
          }
          return PivotEngine.fromArray(array, ...options.slice(0, 4));
        }
        if (n.name === "IF") {
          if (n.args.length < 2 || n.args.length > 3)
            return new FormulaError("#VALUE!");
          const condition = this.evalNode(n.args[0], visiting);
          if (isFormulaError(condition)) return condition;
          if (Array.isArray(condition)) {
            const yes = this.evalNode(n.args[1], visiting),
              no =
                n.args.length === 3
                  ? this.evalNode(n.args[2], visiting)
                  : false;
            return broadcast([condition, yes, no], (test, a, b) =>
              isFormulaError(test) ? test : bool(test) ? a : b,
            );
          }
          if (bool(condition)) return this.evalNode(n.args[1], visiting);
          return n.args.length === 3
            ? this.evalNode(n.args[2], visiting)
            : false;
        }
        if (n.name === "IFERROR" || n.name === "IFNA") {
          if (n.args.length !== 2) return new FormulaError("#VALUE!");
          const value = this.evalNode(n.args[0], visiting);
          return n.name === "IFERROR"
            ? isFormulaError(value)
              ? this.evalNode(n.args[1], visiting)
              : value
            : isFormulaError(value) && value.code === "#N/A"
              ? this.evalNode(n.args[1], visiting)
              : value;
        }
        if (n.name === "ISERROR")
          return n.args.length === 1
            ? isFormulaError(this.evalNode(n.args[0], visiting))
            : new FormulaError("#VALUE!");
        if (n.name === "AND" || n.name === "OR") {
          for (const arg of n.args) {
            const value = this.evalNode(arg, visiting);
            if (isFormulaError(value)) return value;
            const values = flatten(value);
            if (n.name === "AND" && values.some((v) => !bool(v))) return false;
            if (n.name === "OR" && values.some(bool)) return true;
          }
          return n.name === "AND";
        }
        if (n.name === "IFS") {
          if (!n.args.length || n.args.length % 2)
            return new FormulaError("#VALUE!");
          for (let i = 0; i < n.args.length; i += 2) {
            const condition = this.evalNode(n.args[i], visiting);
            if (isFormulaError(condition)) return condition;
            if (bool(condition)) return this.evalNode(n.args[i + 1], visiting);
          }
          return new FormulaError("#N/A");
        }
        if (n.name === "SWITCH") {
          if (n.args.length < 3) return new FormulaError("#VALUE!");
          const value = this.evalNode(n.args[0], visiting),
            hasDefault = n.args.length % 2 === 0,
            pairEnd = n.args.length - (hasDefault ? 1 : 0);
          for (let i = 1; i < pairEnd; i += 2) {
            const candidate = this.evalNode(n.args[i], visiting);
            if (isFormulaError(candidate)) return candidate;
            if (this.applyBinary("=", candidate, value))
              return this.evalNode(n.args[i + 1], visiting);
          }
          return hasDefault
            ? this.evalNode(n.args.at(-1), visiting)
            : new FormulaError("#N/A");
        }
        if (n.name === "LET") {
          if (n.args.length < 3 || n.args.length % 2 === 0)
            return new FormulaError("#VALUE!");
          const scope = {};
          this.locals.push(scope);
          try {
            for (let i = 0; i < n.args.length - 1; i += 2) {
              const binding = n.args[i];
              if (
                binding.type !== "ident" ||
                /^\$?[A-Z]+\$?\d+$/i.test(binding.name)
              )
                return new FormulaError("#NAME?");
              scope[binding.name.toUpperCase()] = this.evalNode(
                n.args[i + 1],
                visiting,
              );
            }
            return this.evalNode(n.args.at(-1), visiting);
          } finally {
            this.locals.pop();
          }
        }
        if (n.name === "LAMBDA") {
          if (
            n.args.length < 2 ||
            n.args
              .slice(0, -1)
              .some(
                (p) => p.type !== "ident" || /^\$?[A-Z]+\$?\d+$/i.test(p.name),
              )
          )
            return new FormulaError("#VALUE!");
          const params = n.args.slice(0, -1).map((p) => p.name.toUpperCase()),
            body = n.args.at(-1),
            engine = this;
          const lambda = (...values) => {
            const scope = {};
            params.forEach((name, i) => (scope[name] = values[i] ?? ""));
            engine.locals.push(scope);
            try {
              return engine.evalNode(body, visiting);
            } finally {
              engine.locals.pop();
            }
          };
          lambda.__tinyLambda = true;
          return lambda;
        }
        const fn = this.functions[n.name];
        if (!fn) return new FormulaError(`#NAME? ${n.name}`);
        const definition = formulaDefinition(n.name);
        if (
          definition &&
          (n.args.length < definition.arity.min ||
            n.args.length > definition.arity.max)
        )
          return new FormulaError("#VALUE!", "Incorrect argument count");
        if (definition?.volatile) this.dependencies.read("volatile:cycle");
        const args = n.args.map((x) => this.evalNode(x, visiting));
        if (LIFTED.has(n.name) && args.some(Array.isArray))
          return broadcast(args, (...items) => {
            const error = items.find(isFormulaError);
            return error ?? this._invokeFunction(fn, items);
          });
        const lookupFunctions = [
          "MATCH",
          "XMATCH",
          "VLOOKUP",
          "HLOOKUP",
          "XLOOKUP",
          "LOOKUP",
          "SVERWEIS",
          "WVERWEIS",
          "XVERWEIS",
          "VERGLEICH",
          "VERWEIS",
        ];
        const toleratesErrors = [
          "COUNT",
          "COUNTA",
          "COUNTBLANK",
          "COUNTIF",
          "COUNTIFS",
        ];
        if (lookupFunctions.includes(n.name)) {
          if (isFormulaError(args[0])) return args[0];
        } else if (!toleratesErrors.includes(n.name)) {
          const error = args.flatMap(flattenPlain).find(isFormulaError);
          if (error) return error;
        }
        return this._invokeFunction(fn, args);
      }
    }
  }
}

export class PivotEngine {
  /** Header-first array to a spillable pivot; also available without sheetPivots. */
  static fromArray(
    source,
    rowField,
    valueField,
    aggregate = "SUM",
    columnField = "",
  ) {
    if (isFormulaError(source)) return source;
    if (
      !Array.isArray(source) ||
      !source.length ||
      !Array.isArray(source[0]) ||
      !source[0].length
    )
      return new FormulaError("#VALUE!");
    const width = source[0].length;
    if (source.length * width > 100000) return new FormulaError("#NUM!");
    if (source.some((row) => !Array.isArray(row) || row.length !== width))
      return new FormulaError("#VALUE!");
    const headerError = source[0].find(isFormulaError);
    if (headerError) return headerError;
    const headers = source[0].map((v) => String(v ?? ""));
    if (
      headers.some((h) => !h.trim()) ||
      new Set(headers).size !== headers.length
    )
      return new FormulaError("#VALUE!");
    if (
      typeof rowField !== "string" ||
      typeof valueField !== "string" ||
      typeof columnField !== "string"
    )
      return new FormulaError("#VALUE!");
    const mode = String(aggregate).toLowerCase();
    if (
      ![
        "sum",
        "count",
        "counta",
        "avg",
        "average",
        "min",
        "max",
        "first",
        "last",
      ].includes(mode)
    )
      return new FormulaError("#VALUE!");
    if (
      ![rowField, valueField, ...(columnField ? [columnField] : [])].every(
        (field) => headers.includes(field),
      )
    )
      return new FormulaError("#REF!");
    const records = [],
      rows = new Set(),
      columns = new Set();
    for (const values of source.slice(1)) {
      if (values.every((v) => v === "" || v == null)) continue;
      const record = Object.fromEntries(headers.map((h, i) => [h, values[i]]));
      const error = [
        record[rowField],
        ...(columnField ? [record[columnField]] : []),
      ].find(isFormulaError);
      if (error) return error;
      rows.add(String(record[rowField] ?? ""));
      columns.add(columnField ? String(record[columnField] ?? "") : "");
      if ((rows.size + 1) * (columns.size + 1) > 100000)
        return new FormulaError("#NUM!");
      records.push(record);
    }
    if (!records.length)
      return [[rowField, ...(columnField ? [] : [valueField])]];
    return this.pivot(records, {
      rows: [rowField],
      columns: columnField ? [columnField] : [],
      values: [{ field: valueField, aggregate: mode }],
    }).toTable();
  }

  static pivot(data, config = {}) {
    const rowFields = config.rows || [],
      colFields = config.columns || [],
      valueDefs = (config.values || []).map((v) =>
        typeof v === "string" ? { field: v, aggregate: "sum" } : v,
      );
    const filters = config.filters || {};
    const filtered = data.filter((rec) =>
      Object.entries(filters).every(([k, v]) =>
        typeof v === "function"
          ? v(rec[k], rec)
          : Array.isArray(v)
            ? v.includes(rec[k])
            : rec[k] === v,
      ),
    );
    const rowKeys = [],
      colKeys = [],
      rowSeen = new Set(),
      colSeen = new Set();
    const cells = new Map();
    const makeKey = (rec, fields) =>
      JSON.stringify(fields.map((f) => String(rec[f] ?? "")));
    const pushUnique = (k, arr, set) => {
      if (!set.has(k)) {
        set.add(k);
        arr.push(k);
      }
    };
    for (const rec of filtered) {
      const rk = makeKey(rec, rowFields),
        ck = makeKey(rec, colFields);
      pushUnique(rk, rowKeys, rowSeen);
      pushUnique(ck, colKeys, colSeen);
      const key = rk + "\u001E" + ck;
      if (!cells.has(key)) cells.set(key, {});
      const bucket = cells.get(key);
      for (const vd of valueDefs) {
        const bk = vd.field + "|" + vd.aggregate;
        (bucket[bk] ||= []).push(rec[vd.field]);
      }
    }
    const agg = (vals, type) => {
      const mode = (type || "sum").toLowerCase();
      if (mode === "count") return numericCount(vals);
      if (mode === "counta")
        return vals.filter((v) => v !== "" && v != null).length;
      if (mode === "first") return vals[0] ?? null;
      if (mode === "last") return vals.at(-1) ?? null;
      try {
        const error = vals.find(isFormulaError);
        if (error) return error;
        if (mode === "min" || mode === "max")
          return numericExtreme(vals, mode === "max");
        return mode === "avg" || mode === "average"
          ? meanNumbers(vals)
          : sumNumbers(vals);
      } catch (error) {
        return error instanceof RangeError
          ? new FormulaError("#NUM!")
          : new FormulaError("#VALUE!");
      }
    };
    const matrix = rowKeys.map((rk) =>
      colKeys.map((ck) => {
        const b = cells.get(rk + "\u001E" + ck) || {};
        const out = {};
        for (const vd of valueDefs) {
          const k = vd.field + "|" + vd.aggregate;
          out[vd.as || k] = agg(b[k] || [], vd.aggregate);
        }
        return out;
      }),
    );
    return {
      rowFields,
      colFields,
      values: valueDefs,
      rowKeys: rowKeys.map((k) => JSON.parse(k)),
      colKeys: colKeys.map((k) => JSON.parse(k)),
      matrix,
      toTable({ totalLabel = "Total" } = {}) {
        const header = [...rowFields];
        for (const ck of this.colKeys) {
          for (const vd of valueDefs)
            header.push(
              colFields.length
                ? `${ck.join(" / ") || totalLabel} · ${vd.as || vd.field}`
                : String(vd.as || vd.field),
            );
        }
        const rows = [header];
        this.rowKeys.forEach((rk, ri) => {
          const row = [...rk];
          this.colKeys.forEach((ck, ci) =>
            valueDefs.forEach((vd) =>
              row.push(matrix[ri][ci][vd.as || vd.field + "|" + vd.aggregate]),
            ),
          );
          rows.push(row);
        });
        return rows;
      },
    };
  }
}

export class TinyDatagrid {
  constructor(container, options = {}) {
    this.el =
      typeof container === "string"
        ? document.querySelector(container)
        : container;
    if (!this.el) throw new Error("tinyDatagrid container not found");
    this.options = {
      rows: 100,
      columns: 26,
      rowHeight: 28,
      columnWidth: 110,
      headerWidth: 52,
      headerHeight: 28,
      ...options,
    };
    const overscan = Math.trunc(
      Number(this.options.virtualizationOverscan ?? 6),
    );
    this.virtualization =
      Boolean(this.options.virtualization) ||
      this.options.rows * this.options.columns > 100000;
    this.virtualizationOverscan = Number.isFinite(overscan)
      ? Math.max(0, overscan)
      : 6;
    this._virtualFrame = null;
    this._resizeObserver = null;
    this.locale = options.locale || "en";
    this._gridId = `tinygrid-${++gridSequence}`;
    this.rowCount = this.options.rows;
    this.colCount = this.options.columns;
    this.rowHeights = Array(this.rowCount).fill(this.options.rowHeight);
    this.colWidths = Array(this.colCount).fill(this.options.columnWidth);
    this.visualizations = [];
    this.pivotTables = [];
    this._features = new Map();
    this.externalVariables = new Map(
      Object.entries(options.externalVariables || {}).map(([name, value]) => [
        name.replace(/^@/, ""),
        value,
      ]),
    );
    this.validationRules = [];
    this.cells = new Map();
    this.variables = new Map();
    this.engine = new FormulaEngine(this);
    this.selection = { r1: 0, c1: 0, r2: 0, c2: 0 };
    this.anchor = { row: 0, col: 0 };
    this.hiddenColumns = new Set();
    this.hiddenRows = new Set();
    this.table = null;
    this.columnFilters = new Map();
    this.filteredRows = new Set();
    this.sheetName = options.sheetName || "Sheet1";
    this.freezePanes = { rows: 0, columns: 0 };
    this.conditionalFormats = [];
    this.sqlBinding = null;
    this.readOnly = Boolean(options.readOnly);
    this.listeners = new Map();
    this._abort = new AbortController();
    this._destroyed = false;
    this._dragPayload = null;
    this._fillState = null;
    this._editing = null;
    this._history = [];
    this._future = [];
    this.historyLimit = Math.max(
      0,
      Math.trunc(Number(options.historyLimit ?? 100)) || 0,
    );
    this._historyDepth = 0;
    this._historyBefore = null;
    this.build();
    for (const plugin of options.plugins || []) this.use(plugin);
    if (options.variables)
      Object.entries(options.variables).forEach(([k, v]) =>
        this.variables.set(k, v),
      );
    this.setLocale(this.locale);
    this.bind();
    if (options.data) this.load(options.data);
  }
  get table() {
    return (
      this._tables?.find((t) => t.id === this._activeTableId) ||
      this._tables?.[0] ||
      null
    );
  }
  set table(value) {
    this._tables = value
      ? [
          {
            ...value,
            id: value.id || "table1",
            name: value.name || "Table 1",
            filters: new Map(value.filters instanceof Map ? value.filters : []),
          },
        ]
      : [];
    this._activeTableId = this._tables[0]?.id || null;
  }
  get columnFilters() {
    return this.table?.filters || (this._emptyFilters ??= new Map());
  }
  set columnFilters(value) {
    if (this.table) this.table.filters = value;
    else this._emptyFilters = value;
  }
  tableAt(row, col) {
    return (
      this._tables.find(
        (t) => row >= t.r1 && row <= t.r2 && col >= t.c1 && col <= t.c2,
      ) || null
    );
  }
  listTables() {
    return this._tables.map(({ filters, ...t }) => ({
      ...t,
      filters: [...filters].map(([column, values]) => ({
        column,
        values: [...values],
      })),
    }));
  }
  activateTable(id) {
    if (!this._tables.some((t) => t.id === id))
      throw new Error("Unknown table");
    this._activeTableId = id;
    this.emit("tableactivate", { id });
    return this;
  }
  _restoreTables(tables) {
    if (!Array.isArray(tables)) return;
    const restored = [],
      ids = new Set();
    for (const t of tables) {
      if (
        !t ||
        typeof t.id !== "string" ||
        ids.has(t.id) ||
        !["r1", "r2", "c1", "c2", "headerRow"].every(
          (k) => Number.isInteger(t[k]) && t[k] >= 0,
        ) ||
        t.r2 < t.r1 ||
        t.c2 < t.c1 ||
        t.headerRow < t.r1 ||
        t.headerRow > t.r2
      )
        throw new TypeError("Invalid table");
      if (
        restored.some(
          (a) => a.r1 <= t.r2 && a.r2 >= t.r1 && a.c1 <= t.c2 && a.c2 >= t.c1,
        )
      )
        throw new TypeError("Tables cannot overlap");
      ids.add(t.id);
      restored.push({
        ...t,
        filters: new Map(
          (t.filters || []).map((f) => [
            f.column,
            new Set(f.values.map(String)),
          ]),
        ),
      });
    }
    this._tables = restored;
    this._activeTableId = restored[0]?.id || null;
  }
  _shiftTableRanges(axis, index, delta) {
    const start = axis === "row" ? "r1" : "c1",
      end = axis === "row" ? "r2" : "c2";
    this._tables = this._tables.filter(
      (t) =>
        !(
          delta < 0 &&
          (axis === "row"
            ? t.headerRow === index
            : t.c1 === t.c2 && t.c1 === index)
        ),
    );
    for (const p of this.pivotTables)
      if (p.table && !this._tables.some((t) => t.id === p.table))
        delete p.table;
    for (const t of this._tables) {
      if (index <= t[end]) {
        if (index < t[start] || (delta > 0 && index === t[start]))
          t[start] += delta;
        t[end] += delta;
        if (axis === "row" && index <= t.headerRow) t.headerRow += delta;
      }
      if (axis === "column")
        t.filters = new Map(
          [...t.filters]
            .filter(([c]) => delta > 0 || c !== index)
            .map(([c, v]) => [c >= index ? c + delta : c, v]),
        );
    }
    for (const v of this.visualizations) {
      if (index <= v.range[end]) {
        if (index < v.range[start] || (delta > 0 && index === v.range[start]))
          v.range[start] = Math.max(0, v.range[start] + delta);
        v.range[end] = Math.max(v.range[start], v.range[end] + delta);
      }
    }
    // A pivot keeps its source and its result in step with the sheet (a pivot bound to a table follows the table).
    const place = axis === "row" ? "row" : "col";
    for (const p of this.pivotTables) {
      for (const range of [p.source, p.output])
        if (range && index <= range[end]) {
          if (index < range[start] || (delta > 0 && index === range[start]))
            range[start] = Math.max(0, range[start] + delta);
          range[end] = Math.max(range[start], range[end] + delta);
        }
      if (p.target && index <= p.target[place])
        p.target[place] = Math.max(0, p.target[place] + delta);
    }
  }
  isTableRowVisible(row, col) {
    const t = this.tableAt(row, col);
    return (
      !this.hiddenRows.has(row) &&
      (!t ||
        row <= t.headerRow ||
        [...t.filters].every(([c, values]) =>
          values.has(String(this.getComputedValue(row, c) ?? "")),
        ))
    );
  }
  listObjects() {
    return [
      ...this.listTables().map((t) => ({
        id: t.id,
        type: "table",
        name: t.name,
        range: { r1: t.r1, c1: t.c1, r2: t.r2, c2: t.c2 },
      })),
      ...this.pivotTables.map((p) => ({
        id: p.id,
        type: "pivot",
        name: p.id,
        range: { ...p.output },
      })),
      ...(this.visualizations || []).map((v) => ({
        ...structuredClone(v),
        type: "chart",
      })),
      ...this.conditionalFormats.flatMap((rule, index) =>
        rule.type === "colorScale"
          ? [
              {
                id: `heatmap${index}`,
                type: "heatmap",
                name: `Heatmap ${index + 1}`,
                range: { ...rule.range },
                ruleIndex: index,
              },
            ]
          : [],
      ),
    ];
  }
  saveVisualization({ name, range, chartType = "column" }) {
    if (this.readOnly) return false;
    if (
      !range ||
      !["r1", "r2", "c1", "c2"].every(
        (k) => Number.isInteger(range[k]) && range[k] >= 0,
      ) ||
      range.r2 < range.r1 ||
      range.c2 < range.c1
    )
      throw new TypeError("Invalid visualization range");
    let n = 1;
    while (this.visualizations.some((v) => v.id === `chart${n}`)) n++;
    const id = `chart${n}`;
    this.visualizations.push({
      id,
      name: String(name || `Chart ${n}`),
      range: { ...range },
      chartType,
    });
    this.emit("objects", {});
    return id;
  }
  removeVisualization(id) {
    if (this.readOnly) return false;
    this.visualizations = this.visualizations.filter((v) => v.id !== id);
    this.emit("objects", {});
    return this;
  }
  _calculationKey(key) {
    return this.feature("worksheets")?.calculationKey(key) || key;
  }
  get cells() {
    return this._cells;
  }
  set cells(entries) {
    this._cells = new CellMap(this, entries);
    this.engine?.clearCache();
  }
  use(plugin) {
    if (
      !plugin ||
      typeof plugin.name !== "string" ||
      typeof plugin.setup !== "function"
    )
      throw new TypeError("Invalid grid plugin");
    if (this._features.has(plugin.name))
      throw new Error(`Plugin already installed: ${plugin.name}`);
    const feature = plugin.setup(this) || {};
    this._features.set(plugin.name, feature);
    this.engine.clearCache();
    this.render();
    return this;
  }
  feature(name) {
    return this._features.get(name);
  }
  removePlugin(name) {
    const feature = this._features.get(name);
    if (!feature) return false;
    feature.destroy?.();
    this._features.delete(name);
    this.render();
    return true;
  }
  _validateWrite(key, value, nextType) {
    this.feature("pivots")?.beforeWrite(key);
    if (this._restoring) return;
    const previous = this.cells.get(key),
      previousFormula =
        previous?.valueType !== "text" &&
        typeof previous?.raw === "string" &&
        previous.raw.startsWith("=");
    if (
      this.options.protectFormulas &&
      !this._allowFormulaReplacement &&
      previousFormula &&
      !(
        nextType !== "text" &&
        typeof value === "string" &&
        value.startsWith("=")
      )
    ) {
      const [row, col] = key.split(",").map(Number),
        message =
          "Diese Zelle enthält eine Formel. Nutze „Formel durch Wert ersetzen“, um sie bewusst zu entfernen.";
      const error = new Error(message);
      error.validation = { row, col, value, message };
      this._lastWriteError = message;
      throw error;
    }
    const validator = this.feature("validation");
    if (!validator) return;
    const [row, col] = key.split(",").map(Number),
      message = validator.validate(row, col, value);
    if (message) {
      const error = new Error(message);
      error.validation = { row, col, value, message };
      throw error;
    }
  }
  setValidationRules(rules = []) {
    this.feature("validation")?.checkRules(rules);
    this.validationRules = structuredClone(rules);
    this.renderCells();
    this.emit("validationrules", { rules: this.validationRules });
    return this;
  }
  registerFunction(name, fn) {
    return this.registerFunctions({ [normalizeFunctionName(name)]: fn });
  }
  registerFunctions(functions) {
    this.engine.registerFunctions(functions);
    this.render();
    this.emit("change", { type: "functions" });
    return this;
  }
  unregisterFunction(name) {
    if (!this.engine.unregisterFunction(name)) return false;
    this.render();
    this.emit("change", { type: "functions" });
    return true;
  }
  t(key) {
    return translate(this.locale, key);
  }
  setLocale(locale = "en") {
    this.locale = locale;
    this.el.lang = locale;
    this.el.setAttribute(
      "aria-label",
      this.options.ariaLabel || this.t("grid"),
    );
    this.editor.setAttribute("aria-label", this.t("editor"));
    this.fillHandle.setAttribute("aria-label", this.t("fill"));
    this.fillHandle.title = this.t("fillHint");
    this.filterMenu.setAttribute("aria-label", this.t("filter"));
    this.autofillMenu.setAttribute("aria-label", this.t("autofill"));
    this._closeFilterMenu();
    this._closeColumnMenu();
    this._closeAutofillMenu(true);
    this.render();
    return this;
  }
  styleSelection(style = {}) {
    if (this.readOnly) return false;
    const s = this.selection;
    for (let r = Math.min(s.r1, s.r2); r <= Math.max(s.r1, s.r2); r++)
      for (let c = Math.min(s.c1, s.c2); c <= Math.max(s.c1, s.c2); c++)
        if (this.isCellReadOnly(r, c)) return false;
    this._recordHistory();
    for (let r = Math.min(s.r1, s.r2); r <= Math.max(s.r1, s.r2); r++)
      for (let c = Math.min(s.c1, s.c2); c <= Math.max(s.c1, s.c2); c++)
        this.cells.set(this.key(r, c), {
          ...this.getCell(r, c),
          style: { ...this.getCell(r, c).style, ...style },
        });
    this.renderCells();
    this.emit("format", { range: { ...s }, style: { ...style } });
    return true;
  }
  _listen(target, type, fn, options = {}) {
    target.addEventListener(type, fn, {
      ...options,
      signal: this._abort.signal,
    });
  }
  on(type, fn) {
    (
      this.listeners.get(type) || this.listeners.set(type, new Set()).get(type)
    ).add(fn);
    return () => this.listeners.get(type)?.delete(fn);
  }
  emit(type, detail) {
    if (this._destroyed) return;
    this.listeners.get(type)?.forEach((fn) => fn(detail));
    this.el.dispatchEvent(new CustomEvent(`tinygrid:${type}`, { detail }));
  }
  setReadOnly(readOnly = true) {
    this.readOnly = Boolean(readOnly);
    this.el.classList.toggle("tg-readonly", this.readOnly);
    this.el.setAttribute("aria-readonly", String(this.readOnly));
    this.editor.readOnly = this.readOnly;
    if (this.readOnly) {
      this._fillState = null;
      this._closeAutofillMenu(true);
      if (this._editing) this.commitEdit(true);
    }
    if (!this.contextMenu.hidden)
      this._renderAxisMenu(this._contextMenuAxis, this._contextMenuIndex);
    this.emit("readonly", { readOnly: this.readOnly });
    return this;
  }
  setVirtualization(enabled = true) {
    const value = Boolean(enabled) || this.rowCount * this.colCount > 100000;
    if (value === this.virtualization) return this;
    this.virtualization = value;
    this._syncVirtualizationObserver();
    this.render();
    this.emit("virtualization", {
      enabled: value,
      overscan: this.virtualizationOverscan,
    });
    return this;
  }
  _syncVirtualizationObserver() {
    if (
      !this.virtualization ||
      typeof globalThis.ResizeObserver !== "function"
    ) {
      this._resizeObserver?.disconnect();
      this._resizeObserver = null;
      return;
    }
    if (!this._resizeObserver)
      this._resizeObserver = new globalThis.ResizeObserver(() =>
        this._scheduleVirtualRender(),
      );
    this._resizeObserver.observe(this.scroll);
  }
  destroy({ clear = true } = {}) {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this._virtualFrame != null)
      globalThis.cancelAnimationFrame?.(this._virtualFrame);
    this._virtualFrame = null;
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    for (const feature of this._features.values()) feature.destroy?.();
    this._features.clear();
    this.emit("destroy", {});
    this._abort.abort();
    this._historyBefore = null;
    this._historyDepth = 0;
    this._history.length = 0;
    this._future.length = 0;
    this.listeners.clear();
    if (clear) {
      this.el.replaceChildren();
      this.el.classList.remove("tg-root");
      this.el.removeAttribute("tabindex");
    }
  }
  key(r, c) {
    return `${r},${c}`;
  }
  ensureSize(rows, cols) {
    let changed = false;
    if (rows > this.rowCount) {
      while (this.rowHeights.length < rows)
        this.rowHeights.push(this.options.rowHeight);
      this.rowCount = rows;
      changed = true;
    }
    if (cols > this.colCount) {
      while (this.colWidths.length < cols)
        this.colWidths.push(this.options.columnWidth);
      this.colCount = cols;
      changed = true;
    }
    return changed;
  }
  /** Cells whose content ('formulas'), result ('values') or either ('both') match the query, in reading order. */
  find(
    query,
    {
      matchCase = false,
      wholeCell = false,
      regex = false,
      scope = "both",
      range = null,
      visibleOnly = false,
      limit = 100000,
    } = {},
  ) {
    const matcher = textMatcher(query, { matchCase, wholeCell, regex });
    if (!matcher) return [];
    const box = range && {
      r1: Math.min(range.r1, range.r2),
      r2: Math.max(range.r1, range.r2),
      c1: Math.min(range.c1, range.c2),
      c2: Math.max(range.c1, range.c2),
    };
    const found = [],
      visited = new Set();
    const consider = (row, col) => {
      const key = this.key(row, col);
      if (visited.has(key)) return;
      visited.add(key);
      if (box && (row < box.r1 || row > box.r2 || col < box.c1 || col > box.c2))
        return;
      if (
        visibleOnly &&
        (this.hiddenRows.has(row) ||
          this.filteredRows.has(row) ||
          this.hiddenColumns.has(col))
      )
        return;
      let hit = false;
      if (scope !== "values") {
        const raw = this.getRawValue(row, col);
        hit = raw !== "" && raw != null && matcher.test(rawText(raw));
      }
      if (!hit && scope !== "formulas") {
        const value = this.getComputedValue(row, col);
        hit =
          value !== "" &&
          value != null &&
          matcher.test(
            this.formatValue(value, this.getCell(row, col).numberFormat),
          );
      }
      if (hit) found.push({ row, col });
    };
    for (const key of [...this.cells.keys()]) {
      const split = key.indexOf(",");
      consider(+key.slice(0, split), +key.slice(split + 1));
    }
    if (scope !== "formulas")
      for (const info of this.getSpillRanges())
        for (let r = info.row; r < info.row + info.rows; r++)
          for (let c = info.col; c < info.col + info.cols; c++) consider(r, c);
    found.sort((a, b) => a.row - b.row || a.col - b.col);
    return found.length > limit ? found.slice(0, limit) : found;
  }
  /** Replace text in the entered content of matching cells as one undo step. */
  replace(query, replacement, options = {}) {
    const none = { count: 0, cells: 0 };
    if (this.readOnly) return none;
    const matcher = textMatcher(query, options);
    if (!matcher) return none;
    const targets = this.find(query, { ...options, scope: "formulas" }),
      result = { count: 0, cells: 0 };
    const outcome = this.transaction(() => {
      for (const { row, col } of targets) {
        if (this.isCellReadOnly(row, col)) continue;
        const before = rawText(this.getRawValue(row, col)),
          { text, count } = matcher.replace(before, String(replacement ?? ""));
        if (!count || text === before) continue;
        this.setCell(row, col, text);
        result.count += count;
        result.cells++;
      }
    });
    return outcome === false ? none : result;
  }
  _cloneSQLBinding(binding) {
    return binding
      ? {
          ...binding,
          columns: [...binding.columns],
          keyColumns: [...binding.keyColumns],
          editableColumns: binding.editableColumns
            ? [...binding.editableColumns]
            : null,
          seenCursors: new Set(binding.seenCursors || []),
          sqlRowIds: new Map(binding.sqlRowIds),
          originalRows: new Map(binding.originalRows),
          inserted: new Set(binding.inserted),
          deleted: new Map(binding.deleted),
        }
      : null;
  }
  _snapshot() {
    return {
      tables: this.listTables(),
      visualizations: structuredClone(this.visualizations),
      pivotTables: structuredClone(this.pivotTables),
      validationRules: structuredClone(this.validationRules),
      variables: new Map(this.variables),
      cells: new Map(this.cells),
      rowCount: this.rowCount,
      colCount: this.colCount,
      rowHeights: [...this.rowHeights],
      colWidths: [...this.colWidths],
      hiddenColumns: new Set(this.hiddenColumns),
      hiddenRows: new Set(this.hiddenRows),
      sheetName: this.sheetName,
      freezePanes: { ...this.freezePanes },
      conditionalFormats: structuredClone(this.conditionalFormats),
      sqlBinding: this._cloneSQLBinding(this.sqlBinding),
    };
  }
  _recordHistory() {
    if (
      (this.historyLimit ||
        this.options.protectFormulas ||
        this.feature("validation") ||
        this.feature("conditionalFormatting") ||
        this.feature("pivots")) &&
      !this._historyBefore
    )
      this._historyBefore = this._snapshot();
  }
  _finishHistory() {
    if (this._historyDepth || !this._historyBefore) return;
    const before = this._historyBefore;
    this._historyBefore = null;
    const patch =
      difference(before, this._snapshot()) ||
      (this._pendingRemoteChanges?.length
        ? { type: "object", changes: [] }
        : null);
    if (!patch) {
      this._pendingRemoteChanges = null;
      return;
    }
    if (this._pendingRemoteChanges) {
      patch.remoteChanges = this._pendingRemoteChanges;
      this._pendingRemoteChanges = null;
    }
    if (!this.historyLimit) return;
    this._history.push(patch);
    if (this._history.length > this.historyLimit) this._history.shift();
    this._future.length = 0;
    this.emit("history", { undo: this._history.length, redo: 0 });
  }
  beginHistory() {
    if (!this._historyDepth) this._finishHistory();
    this._historyDepth++;
    this._recordHistory();
    return this;
  }
  endHistory() {
    if (this._historyDepth) this._historyDepth--;
    this._finishHistory();
    return this;
  }
  transaction(callback) {
    const outer = !this._historyDepth;
    this.beginHistory();
    try {
      return callback(this);
    } catch (error) {
      if (
        outer &&
        this._historyBefore &&
        (error.validation ||
          this.feature("validation") ||
          this.feature("conditionalFormatting") ||
          this.feature("pivots"))
      ) {
        const before = this._historyBefore;
        this._historyBefore = null;
        if (this._pendingRemoteChanges) {
          this.feature("worksheets")?.applyReferenceChanges(
            this._pendingRemoteChanges,
            false,
          );
          this._pendingRemoteChanges = null;
        }
        this._restore(before);
        if (error.validation) {
          this.emit("validationerror", error.validation);
          return false;
        }
        throw error;
      }
      throw error;
    } finally {
      this.endHistory();
      if (outer) {
        if (!this.historyLimit) this._pendingRemoteChanges = null;
        this.emit("mutation", {});
      }
    }
  }
  clearHistory() {
    this._historyBefore = null;
    this._pendingRemoteChanges = null;
    this._history.length = 0;
    this._future.length = 0;
    this.emit("history", { undo: 0, redo: 0 });
    return this;
  }
  get historyState() {
    if (!this._historyDepth) this._finishHistory();
    return { undo: this._history.length, redo: this._future.length };
  }
  _restore(state) {
    this.visualizations = structuredClone(state.visualizations || []);
    this.pivotTables = structuredClone(state.pivotTables || []);
    this.validationRules = structuredClone(state.validationRules || []);
    this.variables = new Map(state.variables);
    this.cells = new Map(state.cells);
    this.rowCount = state.rowCount;
    this.colCount = state.colCount;
    this.rowHeights = [...state.rowHeights];
    this.colWidths = [...state.colWidths];
    this.hiddenColumns = new Set(state.hiddenColumns || []);
    this.hiddenRows = new Set(state.hiddenRows || []);
    this.table = state.table ? { ...state.table } : null;
    this.columnFilters = new Map(
      [...(state.columnFilters || [])].map(([k, v]) => [k, new Set(v)]),
    );
    this.sheetName = state.sheetName || "Sheet1";
    this.freezePanes = { rows: 0, columns: 0, ...state.freezePanes };
    this.conditionalFormats = structuredClone(state.conditionalFormats || []);
    this.sqlBinding = this._cloneSQLBinding(state.sqlBinding);
    this.anchor = {
      row: clamp(this.anchor.row, 0, this.rowCount - 1),
      col: clamp(this.anchor.col, 0, this.colCount - 1),
    };
    this.selection = {
      r1: clamp(this.selection.r1, 0, this.rowCount - 1),
      c1: clamp(this.selection.c1, 0, this.colCount - 1),
      r2: clamp(this.selection.r2, 0, this.rowCount - 1),
      c2: clamp(this.selection.c2, 0, this.colCount - 1),
    };
    this._restoreTables(state.tables);
    this._activeTableId =
      state.activeTableId ||
      this.tableAt(this.anchor.row, this.anchor.col)?.id ||
      this._activeTableId;
    this.engine.clearCache();
    this.render();
    this.emit("change", { type: "history" });
  }
  get canUndo() {
    return this.historyState.undo > 0;
  }
  get canRedo() {
    return this.historyState.redo > 0;
  }
  undo() {
    if (this._historyDepth || this.readOnly) return false;
    this._finishHistory();
    if (!this._history.length) return false;
    const patch = this._history.at(-1);
    if (
      patch.remoteChanges &&
      !this.feature("worksheets")?.applyReferenceChanges(
        patch.remoteChanges,
        false,
      )
    )
      return false;
    this._history.pop();
    this._future.push(patch);
    this._restore(applyDifference(this._snapshot(), patch, false));
    this.emit("history", this.historyState);
    return true;
  }
  redo() {
    if (this._historyDepth || this.readOnly) return false;
    this._finishHistory();
    if (!this._future.length) return false;
    const patch = this._future.at(-1);
    if (
      patch.remoteChanges &&
      !this.feature("worksheets")?.applyReferenceChanges(
        patch.remoteChanges,
        true,
      )
    )
      return false;
    this._future.pop();
    this._history.push(patch);
    this._restore(applyDifference(this._snapshot(), patch, true));
    this.emit("history", this.historyState);
    return true;
  }
  recalculate({ full = true } = {}) {
    if (full) this.engine.clearCache();
    this.render();
    this.emit("change", { type: "recalculate" });
    return this;
  }
  setExternalVariable(name, value, options) {
    return this.setExternalVariables(
      { [String(name).replace(/^@/, "")]: value },
      options,
    );
  }
  setExternalVariables(values, { recalculate = true } = {}) {
    const entries = Object.entries(values).map(([name, value]) => [
      name.replace(/^@/, ""),
      value,
    ]);
    if (
      entries.some(
        ([name, value]) =>
          !/^[_A-Za-z][_A-Za-z0-9.]*$/.test(name) ||
          typeof value === "function" ||
          value?.then,
      )
    )
      throw new TypeError("Invalid external variable");
    for (const [name, value] of entries) {
      this.externalVariables.set(name, value);
      this.engine.dependencies.invalidate(`external:${name}`);
    }
    if (recalculate) this.recalculate({ full: false });
    this.emit("externalvariables", { names: entries.map(([name]) => name) });
    return this;
  }
  removeExternalVariable(name, { recalculate = true } = {}) {
    name = String(name).replace(/^@/, "");
    if (!this.externalVariables.delete(name)) return false;
    this.engine.dependencies.invalidate(`external:${name}`);
    if (recalculate) this.recalculate({ full: false });
    this.emit("externalvariables", { names: [name] });
    return true;
  }
  setSheetName(name) {
    this.sheetName = String(name);
    this.engine.dependencies.invalidate("worksheets:names");
    this.render();
    this.emit("change", { type: "rename" });
    return this;
  }
  clearSelection() {
    if (this.readOnly) return false;
    const s = this.selection;
    for (let r = Math.min(s.r1, s.r2); r <= Math.max(s.r1, s.r2); r++)
      for (let c = Math.min(s.c1, s.c2); c <= Math.max(s.c1, s.c2); c++)
        if (this.isCellReadOnly(r, c)) return false;
    for (let r = Math.min(s.r1, s.r2); r <= Math.max(s.r1, s.r2); r++)
      for (let c = Math.min(s.c1, s.c2); c <= Math.max(s.c1, s.c2); c++) {
        const key = this.key(r, c);
        if (this.cells.has(key))
          this.cells.set(key, { ...this.getCell(r, c), raw: "" });
      }
    this.render();
    this.emit("change", { type: "clear" });
    return true;
  }
  isCellReadOnly(row, col) {
    if (this.feature("pivots") && this.getCell(row, col).pivotOwner)
      return true;
    if (this.readOnly) return true;
    if (!this.sqlBinding) return false;
    if (row === this.sqlBinding.headerRow || !this.sqlBinding.keyColumns.length)
      return true;
    const column = this.sqlBinding.columns[col - this.sqlBinding.startCol];
    if (!column) return true;
    return Boolean(
      column.readOnly ||
      column.primaryKey ||
      this.sqlBinding.keyColumns.includes(column.name) ||
      (this.sqlBinding.editableColumns &&
        !this.sqlBinding.editableColumns.includes(column.name)),
    );
  }
  _coerceSQLValue(col, value) {
    if (!this.sqlBinding || typeof value !== "string" || value.startsWith("="))
      return value;
    const column = this.sqlBinding.columns[col - this.sqlBinding.startCol];
    return coerceDataValue(value, {
      type: column?.type || "unknown",
      locale: this.options.dataLocale || "en-US",
    });
  }
  setCell(row, col, value, meta = {}) {
    value = unwrapCellValue(value);
    const originalInput = value;
    if (this.sqlBinding && this.isCellReadOnly(row, col)) return false;
    value = this._coerceSQLValue(col, value);
    this._recordHistory();
    const grew = this.ensureSize(row + 1, col + 1);
    const k = this.key(row, col);
    const old = this.cells.get(k) || {};
    this.cells.set(k, { ...old, ...meta, raw: value, originalInput });
    this._growTable(row, col, value);
    this._updateFilteredRows();
    this.emit("change", { row, col, value });
    if (grew || this.table) this.render();
    else this.renderCells();
    return true;
  }
  replaceFormulaWithValue(
    row,
    col,
    value = this.getCalculationValue(row, col),
  ) {
    const previous = this._allowFormulaReplacement;
    this._allowFormulaReplacement = true;
    try {
      return this.setCell(row, col, value);
    } finally {
      this._allowFormulaReplacement = previous;
    }
  }
  getCalculationState({ settle = true } = {}) {
    if (settle) this.engine.settle();
    const dep = this.engine.dependencies;
    return {
      phase: dep.stack.length
        ? "calculating"
        : dep.dirtyAll || dep.dirty.size
          ? "pending"
          : "ready",
      revision: dep.cycle,
      calculatedAt: new Date(dep.cycleTime).toISOString(),
      errors: [...this.engine.cache].filter(
        ([key, value]) => this._ownKey(key) != null && isFormulaError(value),
      ).length,
    };
  }
  getCellInfo(row, col) {
    const raw = this.getRawValue(row, col),
      original = this.getOriginalValue(row, col),
      value = this.getCalculationValue(row, col),
      cell = this.getCell(row, col),
      display = this.formatValue(value, cell.numberFormat);
    return {
      address: toA1(row, col),
      raw,
      original,
      value: displayFormulaResult(value),
      exact: rawText(value),
      display,
      type: isFormulaError(value)
        ? "error"
        : value instanceof DecimalValue
          ? "decimal"
          : value instanceof CalendarDate
            ? "date"
            : value instanceof ClockTime
              ? "time"
              : value instanceof DurationValue
                ? "duration"
                : value instanceof Date
                  ? "datetime"
                  : typeof value,
      error: isFormulaError(value)
        ? { code: value.code, message: value.message }
        : null,
      formula:
        cell.valueType !== "text" &&
        typeof raw === "string" &&
        raw.startsWith("="),
      displayDiffers:
        !isFormulaError(value) &&
        (["number", "bigint"].includes(typeof value) ||
          value instanceof DecimalValue)
          ? String(display) !== rawText(value)
          : false,
    };
  }
  getCell(row, col) {
    return this.cells.get(this.key(row, col)) || { raw: "" };
  }
  getOriginalValue(row, col) {
    this.getRawValue(row, col);
    const cell = this.getCell(row, col);
    return Object.hasOwn(cell, "originalInput")
      ? cell.originalInput
      : this.getRawValue(row, col);
  }
  getRawValue(row, col) {
    this.engine?.dependencies.read(this._calculationKey(this.key(row, col)));
    const cell = this.getCell(row, col);
    return Object.hasOwn(cell, "raw") ? cell.raw : "";
  }
  getComputedValue(row, col, visiting = new Set()) {
    return displayFormulaResult(this.getCalculationValue(row, col, visiting));
  }
  getCalculationValue(row, col, visiting = new Set()) {
    const pivotError = this.feature("pivots")?.beforeRead(row, col);
    if (pivotError) return pivotError;
    const dep = this.engine.dependencies;
    if ((dep.dirtyAll || dep.dirty.size) && !dep.stack.length)
      this.engine.settle();
    const k = this._calculationKey(this.key(row, col));
    dep.read(k);
    if (this.engine.cache.has(k)) return this.engine.cache.get(k);
    if (visiting.has(k)) return new FormulaError("#CYCLE!");
    dep.begin(k);
    visiting.add(k);
    try {
      const raw = this.getRawValue(row, col);
      let out = raw;
      const cell = this.getCell(row, col),
        type =
          cell.valueType ||
          this.options.columnTypes?.[col] ||
          this.sqlBinding?.columns[col - this.sqlBinding.startCol]?.type;
      const registered =
          (dep.spills.size || dep.blocked.size) &&
          (dep.spills.has(k) || dep.blocked.has(k)),
        literalText =
          /^(text|string|char|character|varchar|nvarchar|nchar|uuid|citext|enum|clob|ntext)\b/i.test(
            type || "",
          ),
        formula =
          !literalText && typeof raw === "string" && raw.startsWith("=");
      if (registered && !formula) this.engine.clearSpill(k);
      if (literalText) out = wrapCellValue(raw);
      else if (formula) {
        out = this.engine.evaluateValue(raw, visiting);
        if (Array.isArray(out)) out = this.engine.spillResult(k, row, col, out);
        else if (registered) this.engine.clearSpill(k);
      } else if (
        (raw === "" || raw == null) &&
        dep.covered.size &&
        dep.covered.has(k)
      )
        out = this._spillValue(k, row, col, visiting);
      else if (type)
        out = wrapCellValue(
          coerceDataValue(raw, {
            type,
            locale: this.options.dataLocale || "en-US",
          }),
        );
      else {
        const info = inferDataValue(raw, {
          locale: this.options.dataLocale || "en-US",
          dateParsing: this.options.dateParsing ?? "iso",
        });
        out = info.type === "json" ? wrapCellValue(info.value) : info.value;
      }
      out = checkedResult(out);
      this.engine.cache.set(k, out);
      return out;
    } finally {
      visiting.delete(k);
      dep.end();
    }
  }
  _ownKey(calc) {
    const probe = this._calculationKey("0,0");
    if (probe === "0,0") return /^\d+,\d+$/.test(calc) ? calc : null;
    try {
      const [id, key] = JSON.parse(calc),
        [own] = JSON.parse(probe);
      return id === own && /^\d+,\d+$/.test(key) ? key : null;
    } catch {
      return null;
    }
  }
  _spillValue(k, row, col, visiting) {
    const dep = this.engine.dependencies,
      origin = dep.covered.get(k),
      info = origin && dep.spills.get(origin);
    if (!info) return "";
    if (visiting.has(origin)) return new FormulaError("#CYCLE!");
    this.getCalculationValue(info.row, info.col, visiting);
    const fresh = dep.spills.get(origin);
    if (!fresh || dep.covered.get(k) !== origin) return "";
    return fresh.matrix[row - fresh.row]?.[col - fresh.col] ?? "";
  }
  /** The whole result of the formula in a cell (A1#), or a one-cell range for ordinary cells. */
  getSpill(row, col, visiting = new Set()) {
    const value = this.getCalculationValue(row, col, visiting);
    if (isFormulaError(value)) return value;
    const info = this.engine.dependencies.spills.get(
      this._calculationKey(this.key(row, col)),
    );
    return info ? info.matrix.map((line) => line.slice()) : [[value]];
  }
  /** Rectangles currently filled by dynamic-array results: [{row,col,rows,cols}]. */
  getSpillRanges() {
    this.engine.settle();
    return [...this.engine.dependencies.spills.values()]
      .filter((info) => info.owner === this)
      .map(({ row, col, rows, cols }) => ({ row, col, rows, cols }));
  }
  _growForSpills() {
    let rows = this.rowCount,
      cols = this.colCount;
    for (const info of this.engine.dependencies.spills.values()) {
      if (info.owner !== this) continue;
      rows = Math.max(rows, info.row + info.rows);
      cols = Math.max(cols, info.col + info.cols);
    }
    if (rows > this.rowCount || cols > this.colCount)
      this.ensureSize(rows, cols);
  }
  setVariable(name, value) {
    name = String(name).replace(/^@/, "");
    this.variables.set(name, value);
    this.engine.dependencies.invalidate(this._calculationKey(`@${name}`));
    this.render();
    this.emit("variable", { name, value });
  }
  getVariable(name) {
    name = String(name).replace(/^@/, "");
    this.engine.dependencies.read(`external:${name}`);
    if (this.externalVariables.has(name))
      return this.externalVariables.get(name);
    this.engine.dependencies.read(this._calculationKey(`@${name}`));
    return this.variables.get(name);
  }
  setRowHeight(row, h) {
    this.rowHeights[row] = clamp(h, 18, 400);
    this.layout();
    this.emit("resize", {
      type: "row",
      index: row,
      size: this.rowHeights[row],
    });
  }
  setColumnWidth(col, w) {
    this.colWidths[col] = clamp(w, 36, 800);
    this.layout();
    this.emit("resize", {
      type: "column",
      index: col,
      size: this.colWidths[col],
    });
  }
  hideRow(row) {
    if (
      row < 0 ||
      row >= this.rowCount ||
      this.hiddenRows.has(row) ||
      this.hiddenRows.size >= this.rowCount - 1
    )
      return false;
    this._recordHistory();
    this.hiddenRows.add(row);
    let visible = row + 1;
    while (visible < this.rowCount && this.hiddenRows.has(visible)) visible++;
    if (visible >= this.rowCount) {
      visible = row - 1;
      while (visible >= 0 && this.hiddenRows.has(visible)) visible--;
    }
    visible = Math.max(0, visible);
    this.anchor = { row: visible, col: 0 };
    this.selection = { r1: visible, c1: 0, r2: visible, c2: this.colCount - 1 };
    this.layout();
    this.emit("rowhide", { index: row });
    this.emit("select", { ...this.selection });
    return true;
  }
  showAllRows() {
    if (!this.hiddenRows.size) return false;
    const rows = [...this.hiddenRows].sort((a, b) => a - b);
    this._recordHistory();
    this.hiddenRows.clear();
    this.layout();
    this.emit("rowshow", { rows });
    return true;
  }
  insertRow(index) {
    if (this.sqlBinding) return this.insertRecord({});
    index = clamp(index, 0, this.rowCount);
    this._recordHistory();
    this._shiftTableRanges("row", index, 1);
    const shifted = new Map();
    for (const [key, value] of this.cells) {
      const [row, col] = key.split(",").map(Number);
      shifted.set(this.key(row >= index ? row + 1 : row, col), value);
    }
    this.cells = shifted;
    this.rowHeights.splice(index, 0, this.options.rowHeight);
    this.hiddenRows = new Set(
      [...this.hiddenRows].map((row) => (row >= index ? row + 1 : row)),
    );
    this.rowCount++;
    this.engine.clearCache();
    this.anchor = { row: index, col: 0 };
    this.selection = { r1: index, c1: 0, r2: index, c2: this.colCount - 1 };
    this.render();
    this.emit("change", { type: "rowinsert", index });
    return this;
  }
  deleteRow(index, { history = true, trackSQL = true } = {}) {
    if (trackSQL && this.sqlBinding) return this.deleteRecord(index);
    if (index < 0 || index >= this.rowCount || this.rowCount <= 1) return false;
    if (history) this._recordHistory();
    this._shiftTableRanges("row", index, -1);
    const shifted = new Map();
    for (const [key, value] of this.cells) {
      const [row, col] = key.split(",").map(Number);
      if (row !== index)
        shifted.set(this.key(row > index ? row - 1 : row, col), value);
    }
    this.cells = shifted;
    this.rowHeights.splice(index, 1);
    this.hiddenRows = new Set(
      [...this.hiddenRows]
        .filter((row) => row !== index)
        .map((row) => (row > index ? row - 1 : row)),
    );
    if (this.sqlBinding)
      this.sqlBinding.sqlRowIds = new Map(
        [...this.sqlBinding.sqlRowIds]
          .filter(([row]) => row !== index)
          .map(([row, id]) => [row > index ? row - 1 : row, id]),
      );
    this.rowCount--;
    const selected = Math.min(index, this.rowCount - 1);
    this.anchor = { row: selected, col: 0 };
    this.selection = {
      r1: selected,
      c1: 0,
      r2: selected,
      c2: this.colCount - 1,
    };
    this.engine.clearCache();
    this.render();
    this.emit("change", { type: "rowdelete", index });
    return true;
  }
  clearRow(index) {
    if (
      this.sqlBinding &&
      (this.readOnly || index === this.sqlBinding.headerRow)
    )
      return false;
    this._recordHistory();
    for (let col = 0; col < this.colCount; col++) {
      if (this.sqlBinding && this.isCellReadOnly(index, col)) continue;
      const key = this.key(index, col),
        cell = this.cells.get(key);
      if (cell) this.cells.set(key, { ...cell, raw: "" });
    }
    this.renderCells();
    this.emit("change", { type: "rowclear", index });
    return true;
  }
  autoFitRow(index) {
    let lines = 1;
    for (let col = 0; col < this.colCount; col++) {
      if (this.hiddenColumns.has(col)) continue;
      lines = Math.max(
        lines,
        String(
          this.formatValue(
            this.getComputedValue(index, col),
            this.getCell(index, col).numberFormat,
          ) ?? "",
        ).split("\n").length,
      );
    }
    this._recordHistory();
    this.setRowHeight(index, clamp(lines * 18 + 10, 28, 400));
    return this.rowHeights[index];
  }
  hideColumn(col) {
    if (
      col < 0 ||
      col >= this.colCount ||
      this.hiddenColumns.has(col) ||
      this.hiddenColumns.size >= this.colCount - 1
    )
      return false;
    this._recordHistory();
    this.hiddenColumns.add(col);
    let visible = col + 1;
    while (visible < this.colCount && this.hiddenColumns.has(visible))
      visible++;
    if (visible >= this.colCount) {
      visible = col - 1;
      while (visible >= 0 && this.hiddenColumns.has(visible)) visible--;
    }
    visible = Math.max(0, visible);
    this.anchor = { row: 0, col: visible };
    this.selection = { r1: 0, c1: visible, r2: this.rowCount - 1, c2: visible };
    this.layout();
    this.emit("columnhide", { index: col });
    this.emit("select", { ...this.selection });
    return true;
  }
  showAllColumns() {
    if (!this.hiddenColumns.size) return false;
    const columns = [...this.hiddenColumns].sort((a, b) => a - b);
    this._recordHistory();
    this.hiddenColumns.clear();
    this.layout();
    this.emit("columnshow", { columns });
    return true;
  }
  insertColumn(index) {
    if (this.sqlBinding) return false;
    index = clamp(index, 0, this.colCount);
    this._recordHistory();
    this._shiftTableRanges("column", index, 1);
    const shifted = new Map();
    for (const [key, value] of this.cells) {
      const [row, col] = key.split(",").map(Number);
      shifted.set(this.key(row, col >= index ? col + 1 : col), value);
    }
    this.cells = shifted;
    this.colWidths.splice(index, 0, this.options.columnWidth);
    this.hiddenColumns = new Set(
      [...this.hiddenColumns].map((col) => (col >= index ? col + 1 : col)),
    );
    this.colCount++;
    this.engine.clearCache();
    this.anchor = { row: 0, col: index };
    this.selection = { r1: 0, c1: index, r2: this.rowCount - 1, c2: index };
    this.render();
    this.emit("change", { type: "columninsert", index });
    return this;
  }
  deleteColumn(index) {
    if (
      this.sqlBinding ||
      index < 0 ||
      index >= this.colCount ||
      this.colCount <= 1
    )
      return false;
    this._recordHistory();
    this._shiftTableRanges("column", index, -1);
    const shifted = new Map();
    for (const [key, value] of this.cells) {
      const [row, col] = key.split(",").map(Number);
      if (col !== index)
        shifted.set(this.key(row, col > index ? col - 1 : col), value);
    }
    this.cells = shifted;
    this.colWidths.splice(index, 1);
    this.hiddenColumns = new Set(
      [...this.hiddenColumns]
        .filter((col) => col !== index)
        .map((col) => (col > index ? col - 1 : col)),
    );
    this.colCount--;
    const selected = Math.min(index, this.colCount - 1);
    this.anchor = { row: 0, col: selected };
    this.selection = {
      r1: 0,
      c1: selected,
      r2: this.rowCount - 1,
      c2: selected,
    };
    this.engine.clearCache();
    this.render();
    this.emit("change", { type: "columndelete", index });
    return true;
  }
  clearColumn(index) {
    if (
      this.sqlBinding &&
      (this.readOnly ||
        this.isCellReadOnly(this.sqlBinding.headerRow + 1, index))
    )
      return false;
    this._recordHistory();
    for (let row = 0; row < this.rowCount; row++) {
      if (
        this.sqlBinding &&
        (row === this.sqlBinding.headerRow || this.isCellReadOnly(row, index))
      )
        continue;
      const key = this.key(row, index),
        cell = this.cells.get(key);
      if (cell) this.cells.set(key, { ...cell, raw: "" });
    }
    this.renderCells();
    this.emit("change", { type: "columnclear", index });
    return true;
  }
  autoFitColumn(index) {
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.font = getComputedStyle(this.el).font;
    let width = colToName(index).length * 8 + 20;
    for (let row = 0; row < this.rowCount; row++) {
      const text = this.formatValue(
        this.getComputedValue(row, index),
        this.getCell(row, index).numberFormat,
      );
      width = Math.max(width, ctx.measureText(String(text ?? "")).width + 18);
    }
    this._recordHistory();
    this.setColumnWidth(index, clamp(Math.ceil(width), 48, 800));
    return this.colWidths[index];
  }
  load(data, startRow = 0, startCol = 0) {
    if (Array.isArray(data)) {
      this._recordHistory();
      this.sqlBinding = null;
      data.forEach(
        (row, r) =>
          Array.isArray(row) &&
          row.forEach((v, c) => {
            if (v !== "" && v != null)
              this.cells.set(this.key(startRow + r, startCol + c), { raw: v });
          }),
      );
      const cols = Math.max(
        0,
        ...data.map((r) => (Array.isArray(r) ? r.length : 0)),
      );
      this.ensureSize(startRow + data.length, startCol + cols);
    }
    this.engine.clearCache();
    this.render();
  }
  loadRecords(
    records,
    {
      headers = Object.keys(records?.[0] || {}),
      includeHeaders = true,
      startRow = 0,
      startCol = 0,
    } = {},
  ) {
    if (!Array.isArray(records))
      throw new TypeError("Records must be an array of objects");
    const data = [
      ...(includeHeaders ? [headers] : []),
      ...records.map((record) =>
        headers.map((header) =>
          Object.hasOwn(record || {}, header) ? record[header] : "",
        ),
      ),
    ];
    this.load(data, startRow, startCol);
    return { rows: records.length, headers: [...headers] };
  }
  _sqlRecord(row, columns = this.sqlBinding.columns) {
    const record = {};
    columns.forEach((column, index) => {
      const col = this.sqlBinding.startCol + index,
        raw = this.getRawValue(row, col);
      record[column.name] =
        typeof raw === "string" && raw.startsWith("=")
          ? this.getComputedValue(row, col)
          : raw;
    });
    return record;
  }
  _sqlKey(record) {
    const columns = this.sqlBinding.keyColumns;
    if (!columns.length) return null;
    if (columns.some((name) => record[name] == null))
      throw new TypeError(`SQL key is missing a value (${columns.join(", ")})`);
    return `pk:${JSON.stringify(columns.map((name) => toPortableValue(record[name])))}`;
  }
  loadResultSet(
    result,
    {
      tableName = result?.tableName ?? null,
      keyColumns = result?.keyColumns || result?.primaryKey || [],
      editableColumns = null,
      readOnly = true,
      replace = true,
    } = {},
  ) {
    if (!result || !Array.isArray(result.rows))
      throw new TypeError("SQL result must provide a rows array");
    let columns = Array.isArray(result.columns)
      ? result.columns.map((column, index) =>
          typeof column === "string"
            ? { name: column, type: "unknown" }
            : {
                ...column,
                name: String(
                  column.name ?? column.columnName ?? `column_${index + 1}`,
                ),
                type:
                  column.type ??
                  column.dataType ??
                  column.typeName ??
                  "unknown",
              },
        )
      : [];
    if (!columns.length) {
      const first = result.rows[0];
      const names = Array.isArray(first)
        ? first.map((_, index) => `column_${index + 1}`)
        : Object.keys(first || {});
      columns = names.map((name) => ({ name: String(name), type: "unknown" }));
    }
    keyColumns = [
      ...new Set(
        (Array.isArray(keyColumns) ? keyColumns : [keyColumns])
          .map((value) => (typeof value === "string" ? value : value?.name))
          .filter(Boolean)
          .map(String),
      ),
    ];
    if (!keyColumns.length)
      keyColumns = columns
        .filter((column) => column.primaryKey || column.isPrimaryKey)
        .map((column) => String(column.name));
    columns = columns.map((column) => ({
      ...column,
      name: String(column.name),
      primaryKey: Boolean(
        column.primaryKey ||
        column.isPrimaryKey ||
        keyColumns.includes(column.name),
      ),
      readOnly: Boolean(
        column.readOnly ||
        column.isReadOnly ||
        column.generated ||
        column.isGenerated ||
        column.computed,
      ),
    }));
    if (new Set(columns.map((column) => column.name)).size !== columns.length)
      throw new TypeError(
        "SQL result column names must be unique; alias repeated fields in the query",
      );
    for (const key of keyColumns)
      if (!columns.some((column) => column.name === key))
        throw new TypeError(`SQL key column not found: ${key}`);
    if (editableColumns != null) {
      editableColumns = [
        ...new Set(
          (Array.isArray(editableColumns) ? editableColumns : [editableColumns])
            .map((column) =>
              typeof column === "string" ? column : column?.name,
            )
            .filter(Boolean)
            .map(String),
        ),
      ];
      for (const name of editableColumns)
        if (!columns.some((column) => column.name === name))
          throw new TypeError(`Editable SQL column not found: ${name}`);
    }
    const records = result.rows.map((row) =>
      Array.isArray(row)
        ? Object.fromEntries(
            columns.map((column, index) => [column.name, row[index] ?? null]),
          )
        : Object.fromEntries(
            columns.map((column) => [column.name, row?.[column.name] ?? null]),
          ),
    );
    columns = columns.map((column) => {
      const type = String(column.type || "unknown").toLowerCase();
      if (
        !["", "unknown", "any"].includes(type) ||
        keyColumns.includes(column.name)
      )
        return column;
      const inferred = inferColumnType(
        records.map((record) => record[column.name]),
        { locale: this.options.dataLocale || "en-US" },
      );
      return inferred === "unknown" ? column : { ...column, type: inferred };
    });
    records.forEach((record) =>
      columns.forEach((column) => {
        if (!keyColumns.includes(column.name))
          record[column.name] = coerceDataValue(record[column.name], {
            type: column.type,
            locale: this.options.dataLocale || "en-US",
          });
      }),
    );
    if (!columns.length)
      throw new TypeError(
        "SQL result must include column metadata, including for an empty result",
      );
    if (!readOnly && !keyColumns.length)
      throw new TypeError(
        "Editable SQL results require keyColumns so updates can target rows safely",
      );
    const startCol = 0,
      headerRow = 0,
      matrix = [
        columns.map((column) => column.name),
        ...records.map((record) =>
          columns.map((column) => record[column.name]),
        ),
      ];
    if (!replace && this.sqlBinding)
      return this.appendResultPage(
        { ...result, columns, rows: result.rows },
        { tableName, keyColumns, editableColumns, readOnly },
      );
    const binding = {
      tableName,
      columns,
      keyColumns,
      editableColumns,
      startCol,
      headerRow,
      firstDataRow: headerRow + 1,
      lastDataRow: headerRow + records.length,
      loadedRows: records.length,
      fetchedRows: records.length,
      totalRows: Number.isFinite(result.rowCount)
        ? result.rowCount
        : records.length,
      hasMore: resultHasMore(result),
      nextCursor: result.nextCursor ?? null,
      seenCursors: new Set(
        result.nextCursor == null ? [] : [cursorKey(result.nextCursor)],
      ),
      emptyPageCount: 0,
      queryId: result.queryId ?? null,
      metadata: result.metadata ?? null,
      sqlRowIds: new Map(),
      originalRows: new Map(),
      inserted: new Set(),
      deleted: new Map(),
      nextInsertId: 1,
    };
    records.forEach((record, index) => {
      if (keyColumns.some((name) => record[name] == null))
        throw new TypeError(
          `SQL key is missing a value (${keyColumns.join(", ")})`,
        );
      const id = keyColumns.length
        ? `pk:${JSON.stringify(keyColumns.map((name) => toPortableValue(record[name])))}`
        : `row:${index}`;
      if (binding.originalRows.has(id))
        throw new TypeError(`Duplicate SQL key in result: ${id}`);
      binding.sqlRowIds.set(binding.firstDataRow + index, id);
      binding.originalRows.set(id, structuredClone(record));
    });
    this._importMatrix(matrix, { replace: true, startRow: 0, startCol });
    this.table = {
      r1: headerRow,
      c1: startCol,
      r2: Math.max(headerRow, records.length),
      c2: startCol + columns.length - 1,
      headerRow,
      style: "banded",
    };
    this.columnFilters.clear();
    this.filteredRows.clear();
    this.sqlBinding = binding;
    this.setReadOnly(Boolean(readOnly));
    this.clearHistory();
    this.engine.clearCache();
    this.render();
    this.emit("sqlresult", {
      tableName,
      rows: records.length,
      totalRows: binding.totalRows,
      columns: columns.map((column) => ({ ...column })),
      readOnly: Boolean(readOnly),
    });
    return { rows: records.length, totalRows: binding.totalRows, columns };
  }
  appendResultPage(result) {
    if (!this.sqlBinding)
      throw new Error(
        "Load the first SQL result page before appending another page",
      );
    const binding = this.sqlBinding,
      columns = (result.columns || binding.columns).map((column) =>
        typeof column === "string" ? { name: column } : column,
      );
    if (
      columns
        .map((column) => String(column.name ?? column.columnName))
        .join("\u001f") !==
      binding.columns.map((column) => column.name).join("\u001f")
    )
      throw new TypeError(
        "SQL result page schema does not match the active result",
      );
    if (!result || !Array.isArray(result.rows))
      throw new TypeError("SQL page must provide a rows array");
    const rows = result.rows,
      hasMore = resultHasMore(result),
      nextCursor = result.nextCursor ?? null;
    if (hasMore && nextCursor == null && !rows.length)
      throw new Error(
        "SQL page made no progress: it returned no rows, cursor, or end-of-results signal",
      );
    if (hasMore && !rows.length && binding.emptyPageCount >= 4)
      throw new Error("SQL pagination returned too many empty pages in a row");
    if (
      hasMore &&
      nextCursor != null &&
      binding.seenCursors.has(cursorKey(nextCursor))
    )
      throw new Error(
        "SQL pagination cursor did not advance; refusing to append the same page again",
      );
    const records = rows.map((row) =>
      Array.isArray(row)
        ? Object.fromEntries(
            binding.columns.map((column, index) => [
              column.name,
              row[index] ?? null,
            ]),
          )
        : Object.fromEntries(
            binding.columns.map((column) => [
              column.name,
              row?.[column.name] ?? null,
            ]),
          ),
    );
    const pageIds = records.map((record, index) => {
      if (binding.keyColumns.some((name) => record[name] == null))
        throw new TypeError(
          `SQL key is missing a value (${binding.keyColumns.join(", ")})`,
        );
      return binding.keyColumns.length
        ? `pk:${JSON.stringify(binding.keyColumns.map((name) => toPortableValue(record[name])))}`
        : `row:${binding.fetchedRows + index}`;
    });
    const pageSeen = new Set();
    for (const id of pageIds) {
      if (pageSeen.has(id) || binding.originalRows.has(id))
        throw new TypeError(`Duplicate SQL key across pages: ${id}`);
      pageSeen.add(id);
    }
    records.forEach((record) =>
      binding.columns.forEach((column) => {
        record[column.name] = coerceDataValue(record[column.name], {
          type: column.type,
          locale: this.options.dataLocale || "en-US",
        });
      }),
    );
    const startRow = binding.lastDataRow + 1,
      matrix = records.map((record) =>
        binding.columns.map((column) => record[column.name]),
      );
    if (matrix.length)
      this._importMatrix(matrix, {
        startRow,
        startCol: binding.startCol,
        preserveDataSource: true,
      });
    records.forEach((record, index) => {
      const row = startRow + index,
        id = pageIds[index];
      binding.sqlRowIds.set(row, id);
      binding.originalRows.set(id, structuredClone(record));
    });
    binding.loadedRows += records.length;
    binding.fetchedRows += records.length;
    binding.lastDataRow = Math.max(
      binding.headerRow,
      binding.firstDataRow + binding.loadedRows - 1,
    );
    binding.totalRows = Number.isFinite(result.rowCount)
      ? result.rowCount
      : binding.totalRows;
    binding.hasMore = hasMore;
    binding.nextCursor = nextCursor;
    if (hasMore && nextCursor != null)
      binding.seenCursors.add(cursorKey(nextCursor));
    binding.emptyPageCount = records.length ? 0 : binding.emptyPageCount + 1;
    if (result.metadata != null) binding.metadata = result.metadata;
    this.table.r2 = binding.lastDataRow;
    this.render();
    this.emit("sqlpage", {
      rows: records.length,
      loadedRows: binding.loadedRows,
      fetchedRows: binding.fetchedRows,
      totalRows: binding.totalRows,
      hasMore: binding.hasMore,
      nextCursor: binding.nextCursor,
    });
    return {
      rows: records.length,
      loadedRows: binding.loadedRows,
      fetchedRows: binding.fetchedRows,
      totalRows: binding.totalRows,
      hasMore: binding.hasMore,
      nextCursor: binding.nextCursor,
    };
  }
  getSQLMetadata() {
    if (!this.sqlBinding) return null;
    const {
      tableName,
      columns,
      keyColumns,
      editableColumns,
      loadedRows,
      fetchedRows,
      totalRows,
      hasMore,
      nextCursor,
      queryId,
      metadata,
    } = this.sqlBinding;
    return {
      tableName,
      columns: columns.map((column) => ({ ...column })),
      keyColumns: [...keyColumns],
      editableColumns: editableColumns ? [...editableColumns] : null,
      loadedRows,
      fetchedRows,
      totalRows,
      hasMore,
      nextCursor,
      queryId,
      metadata,
      readOnly: this.readOnly,
    };
  }
  insertRecord(record) {
    if (!this.sqlBinding || this.readOnly || !this.sqlBinding.keyColumns.length)
      throw new Error(
        "An editable SQL result set with keyColumns is required to insert a record",
      );
    const binding = this.sqlBinding,
      row = binding.lastDataRow + 1;
    this._recordHistory();
    this.ensureSize(row + 1, this.colCount);
    binding.columns.forEach((column, index) =>
      this.cells.set(this.key(row, binding.startCol + index), {
        raw: Object.hasOwn(record || {}, column.name)
          ? record[column.name]
          : undefined,
      }),
    );
    this.rowHeights[row] = this.options.rowHeight;
    binding.lastDataRow = row;
    binding.loadedRows++;
    this.table.r2 = row;
    const id = `insert:${binding.nextInsertId++}`;
    binding.sqlRowIds.set(row, id);
    binding.inserted.add(id);
    this.engine.clearCache();
    this.render();
    this.emit("sqlinsert", { row, record: { ...record }, clientId: id });
    return { row, clientId: id };
  }
  deleteRecord(row) {
    if (
      !this.sqlBinding ||
      this.readOnly ||
      !this.sqlBinding.keyColumns.length ||
      row <= this.sqlBinding.headerRow ||
      row > this.sqlBinding.lastDataRow
    )
      return false;
    const binding = this.sqlBinding,
      id = binding.sqlRowIds.get(row);
    if (!id) return false;
    const record = this._sqlRecord(row),
      key = Object.fromEntries(
        binding.keyColumns.map((name) => [name, record[name]]),
      );
    this._recordHistory();
    if (binding.inserted.has(id)) binding.inserted.delete(id);
    else binding.deleted.set(id, structuredClone(binding.originalRows.get(id)));
    const removed = this.deleteRow(row, { history: false, trackSQL: false });
    if (removed) {
      binding.loadedRows = Math.max(0, binding.loadedRows - 1);
      binding.lastDataRow = Math.max(
        binding.headerRow,
        binding.lastDataRow - 1,
      );
      this.table.r2 = binding.lastDataRow;
      this.emit("sqldelete", { key, clientId: id });
    }
    return removed;
  }
  getDataChanges() {
    if (!this.sqlBinding) return { updates: [], inserts: [], deletes: [] };
    const binding = this.sqlBinding,
      updates = [],
      inserts = [];
    for (const [row, id] of binding.sqlRowIds) {
      if (row < binding.firstDataRow || row > binding.lastDataRow) continue;
      const current = this._sqlRecord(row);
      if (binding.inserted.has(id)) {
        inserts.push({ clientId: id, record: current });
        continue;
      }
      const original = binding.originalRows.get(id);
      if (!original) continue;
      const changes = {};
      for (const column of binding.columns) {
        const name = column.name;
        if (
          JSON.stringify(toPortableValue(current[name])) !==
          JSON.stringify(toPortableValue(original[name]))
        )
          changes[name] = current[name];
      }
      if (Object.keys(changes).length) {
        const key = Object.fromEntries(
          binding.keyColumns.map((name) => [name, original[name]]),
        );
        updates.push({ key, original: structuredClone(original), changes });
      }
    }
    const deletes = [...binding.deleted].map(([id, original]) => ({
      key: Object.fromEntries(
        binding.keyColumns.map((name) => [name, original?.[name]]),
      ),
      original: structuredClone(original),
      clientId: id,
    }));
    return { updates, inserts, deletes };
  }
  acceptDataChanges({ keyMap = {}, recordsByClientId = {} } = {}) {
    if (!this.sqlBinding) return false;
    const binding = this.sqlBinding,
      pending = this.getDataChanges(),
      counts = {
        updates: pending.updates.length,
        inserts: pending.inserts.length,
        deletes: pending.deletes.length,
      },
      getResult = (collection, id) =>
        collection instanceof Map ? collection.get(id) : collection[id],
      returnedValues = (id) => {
        const generated = getResult(keyMap, id),
          record = getResult(recordsByClientId, id) || {};
        return {
          ...record,
          ...(generated == null
            ? {}
            : typeof generated === "object"
              ? generated
              : { [binding.keyColumns[0]]: generated }),
        };
      };
    for (const [row, id] of binding.sqlRowIds) {
      if (!binding.inserted.has(id)) continue;
      const serverValues = returnedValues(id),
        current = this._sqlRecord(row);
      for (const name of binding.keyColumns)
        if (serverValues[name] == null && current[name] == null)
          throw new Error(
            `Save succeeded but returned no generated SQL key for inserted row ${id}`,
          );
    }
    for (const [row, id] of [...binding.sqlRowIds]) {
      if (row < binding.firstDataRow || row > binding.lastDataRow) continue;
      const values = returnedValues(id);
      for (const [name, value] of Object.entries(values)) {
        const index = binding.columns.findIndex(
          (column) => column.name === name,
        );
        if (index >= 0)
          this.cells.set(this.key(row, binding.startCol + index), {
            ...this.getCell(row, binding.startCol + index),
            raw: value,
          });
      }
      if (Object.keys(values).length) this.engine.clearCache();
      let currentId = id;
      if (binding.inserted.has(id)) {
        currentId = this._sqlKey(this._sqlRecord(row));
        binding.sqlRowIds.set(row, currentId);
        binding.inserted.delete(id);
        binding.originalRows.delete(id);
      }
      binding.originalRows.set(
        currentId,
        structuredClone(this._sqlRecord(row)),
      );
      binding.inserted.delete(currentId);
    }
    for (const id of binding.deleted.keys()) binding.originalRows.delete(id);
    binding.deleted.clear();
    this.engine.clearCache();
    this.renderCells();
    this.clearHistory();
    this.emit("sqlsaved", { changes: counts });
    return true;
  }
  toArray(
    range = { r1: 0, c1: 0, r2: this.rowCount - 1, c2: this.colCount - 1 },
    computed = false,
  ) {
    const rr = {
      r1: Math.min(range.r1, range.r2),
      c1: Math.min(range.c1, range.c2),
      r2: Math.max(range.r1, range.r2),
      c2: Math.max(range.c1, range.c2),
    };
    const out = [];
    for (let r = rr.r1; r <= rr.r2; r++) {
      const row = [];
      for (let c = rr.c1; c <= rr.c2; c++)
        row.push(
          computed ? this.getComputedValue(r, c) : this.getRawValue(r, c),
        );
      out.push(row);
    }
    return out;
  }
  getUsedRange() {
    if (this.sqlBinding)
      return {
        r1: this.sqlBinding.headerRow,
        c1: this.sqlBinding.startCol,
        r2: this.sqlBinding.lastDataRow,
        c2: this.sqlBinding.startCol + this.sqlBinding.columns.length - 1,
      };
    let r2 = 0,
      c2 = 0;
    for (const [key, cell] of this.cells) {
      if (cell.raw === "" || cell.raw == null) continue;
      const [r, c] = key.split(",").map(Number);
      r2 = Math.max(r2, r);
      c2 = Math.max(c2, c);
    }
    for (const info of this.getSpillRanges()) {
      r2 = Math.max(r2, info.row + info.rows - 1);
      c2 = Math.max(c2, info.col + info.cols - 1);
    }
    return { r1: 0, c1: 0, r2, c2 };
  }
  exportCSV({ range, computed = false, delimiter = "," } = {}) {
    return stringifyCSV(
      this.toArray(range || this.getUsedRange(), computed),
      delimiter,
    );
  }
  exportTSV({ range, computed = false } = {}) {
    return this.exportCSV({ range, computed, delimiter: "\t" });
  }
  exportHTML({ range, computed = true } = {}) {
    const escape = (value) =>
      rawText(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    const rows = this.toArray(range || this.getUsedRange(), computed);
    return `<!doctype html><meta charset="utf-8"><table><tbody>${rows.map((row) => `<tr>${row.map((value) => `<td>${escape(value)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  exportMarkdown({ range, computed = true } = {}) {
    const rows = this.toArray(range || this.getUsedRange(), computed).map(
      (row) =>
        row.map((value) =>
          rawText(value).replaceAll("|", "\\|").replace(/\r?\n/g, "<br>"),
        ),
    );
    if (!rows.length) return "";
    return [rows[0], rows[0].map(() => "---"), ...rows.slice(1)]
      .map((row) => `| ${row.join(" | ")} |`)
      .join("\n");
  }
  importCSV(text, options = {}) {
    return this.importDelimited(text, {
      ...options,
      delimiter: options.delimiter || detectDelimiter(text),
    });
  }
  _importMatrix(
    data,
    {
      startRow = 0,
      startCol = 0,
      replace = false,
      preserveDataSource = false,
      cellFormats = null,
      textCells = null,
      originalRows = null,
    } = {},
  ) {
    if (!Array.isArray(data) || !data.length) return 0;
    const width = Math.max(
      0,
      ...data.map((row) => (Array.isArray(row) ? row.length : 0)),
    );
    this._recordHistory();
    if (replace) {
      this.visualizations = [];
      this.pivotTables = [];
      this.validationRules = [];
      this.conditionalFormats = [];
      this.freezePanes = { rows: 0, columns: 0 };
      this.cells = new Map();
      this.hiddenRows.clear();
      this.hiddenColumns.clear();
      this.table = null;
      this.columnFilters.clear();
      this.sqlBinding = null;
      this.rowCount = Math.max(1, this.options.rows, startRow + data.length);
      this.colCount = Math.max(1, this.options.columns, startCol + width);
      this.rowHeights = Array(this.rowCount).fill(this.options.rowHeight);
      this.colWidths = Array(this.colCount).fill(this.options.columnWidth);
    } else if (!preserveDataSource) this.sqlBinding = null;
    else
      for (let r = startRow; r < startRow + data.length; r++)
        for (let c = startCol; c < startCol + width; c++)
          this.cells.delete(this.key(r, c));
    data.forEach(
      (row, r) =>
        Array.isArray(row) &&
        row.forEach((value, c) => {
          const format = cellFormats?.get(`${r},${c}`);
          this.cells.set(this.key(startRow + r, startCol + c), {
            ...(originalRows ? { originalInput: originalRows[r]?.[c] } : {}),
            ...(format ? { numberFormat: format } : {}),
            ...(textCells?.has(`${r},${c}`) ? { valueType: "text" } : {}),
            raw: value,
          });
        }),
    );
    this.ensureSize(startRow + data.length, startCol + width);
    this.engine.clearCache();
    this.render();
    this.emit("change", { type: "import", rows: data.length, replace });
    return data.length;
  }
  importDelimited(
    text,
    {
      delimiter = detectDelimiter(text),
      inferTypes = true,
      locale = this.options.dataLocale || "en-US",
      dateParsing = "iso",
      headerRow = 0,
      ...options
    } = {},
  ) {
    let data = parseCSV(text, delimiter),
      cellFormats,
      textCells;
    const originalRows = data;
    if (inferTypes) {
      const inferred = inferDelimitedRows(data, {
        locale,
        dateParsing,
        headerRow,
      });
      data = inferred.rows;
      cellFormats = inferred.formats;
      textCells = inferred.textCells;
    } else {
      textCells = new Set();
      data.forEach((row, r) =>
        row.forEach((_, c) => textCells.add(`${r},${c}`)),
      );
    }
    return this._importMatrix(data, {
      ...options,
      cellFormats,
      textCells,
      originalRows,
    });
  }
  importHTML(markup, options = {}) {
    return this._importMatrix(importMarkupTable(markup), options);
  }
  importMarkdown(markdown, options = {}) {
    return this._importMatrix(parseMarkdownTable(markdown), options);
  }
  importNDJSON(
    text,
    {
      startRow = 0,
      startCol = 0,
      replace = false,
      inferTypes = false,
      locale = this.options.dataLocale || "en-US",
      dateParsing = "iso",
    } = {},
  ) {
    const records = String(text ?? "")
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => parseDataJSON(line));
    if (!records.length) return 0;
    if (records.every(Array.isArray))
      return this._importMatrix(records, { startRow, startCol, replace });
    if (
      records.every(
        (record) =>
          record && typeof record === "object" && !Array.isArray(record),
      )
    ) {
      const headers = [...new Set(records.flatMap(Object.keys))];
      const data = [
        headers,
        ...records.map((record) =>
          headers.map((header) =>
            Object.hasOwn(record, header) ? record[header] : "",
          ),
        ),
      ];
      if (inferTypes) {
        const inferred = inferDelimitedRows(data, { locale, dateParsing });
        return this._importMatrix(inferred.rows, {
          startRow,
          startCol,
          replace,
          cellFormats: inferred.formats,
          textCells: inferred.textCells,
          originalRows: data,
        });
      }
      return this._importMatrix(data, { startRow, startCol, replace });
    }
    return this._importMatrix(
      records.map((record) => [record]),
      { startRow, startCol, replace },
    );
  }
  importSpreadsheetXML(xml, options = {}) {
    const doc = new DOMParser().parseFromString(
      String(xml ?? ""),
      "application/xml",
    );
    if (doc.querySelector("parsererror"))
      throw new TypeError("Invalid XML document");
    const elements = [...doc.getElementsByTagName("*")],
      worksheets = elements.filter(
        (element) => element.localName === "Worksheet",
      );
    let table = worksheets[0]?.getElementsByTagName("*");
    table = [...(table || [])].find((element) => element.localName === "Table");
    if (!table) throw new TypeError("No SpreadsheetML worksheet found");
    const rows = [...table.getElementsByTagName("*")].filter(
        (element) => element.localName === "Row",
      ),
      data = [],
      originalRows = [],
      textCells = new Set();
    let rowIndex = 0;
    for (const row of rows) {
      const explicitRow = Number(
        [...row.attributes].find((attr) => attr.localName === "Index")?.value,
      );
      if (explicitRow > 0) rowIndex = explicitRow - 1;
      const values = [],
        original = [];
      let colIndex = 0;
      for (const cell of [...row.children].filter(
        (element) => element.localName === "Cell",
      )) {
        const explicitCol = Number(
          [...cell.attributes].find((attr) => attr.localName === "Index")
            ?.value,
        );
        if (explicitCol > 0) colIndex = explicitCol - 1;
        const item = [...cell.getElementsByTagName("*")].find(
          (element) => element.localName === "Data",
        );
        let value = item?.textContent ?? "";
        const type = item
          ? [...item.attributes].find((attr) => attr.localName === "Type")
              ?.value
          : null;
        original[colIndex] = value;
        if (type === "Number") value = parseNumericValue(value).value;
        else if (type === "Boolean") value = value === "1";
        else if (type === "DateTime")
          value = inferDataValue(value, { locale: "en-US" }).value;
        else textCells.add(`${rowIndex},${colIndex}`);
        values[colIndex++] = value;
      }
      originalRows[rowIndex] = original;
      data[rowIndex++] = values;
    }
    return this._importMatrix(data, {
      replace: true,
      ...options,
      originalRows,
      textCells,
    });
  }
  async importFile(file, options = {}) {
    if (typeof file === "string")
      throw new TypeError("importFile expects a File object");
    const name = (file.name || "").toLowerCase();
    if (/\.(xlsx|xlsm|xlsb|ods)$/.test(name))
      throw new TypeError(
        "This archive-based spreadsheet format needs an XLSX/ODS adapter. Use CSV, TSV, HTML, SpreadsheetML XML or JSON for now.",
      );
    const text = await file.text(),
      trimmed = text.trimStart();
    if (/\.(ndjson|jsonl)$/.test(name))
      return this.importNDJSON(text, { replace: true, ...options });
    if (
      /\.(html?|htm)$/.test(name) ||
      /^<!doctype html|^<html|<table[\s>]/i.test(trimmed)
    )
      return this.importHTML(text, { replace: true, ...options });
    if (/\.xls$/.test(name))
      throw new TypeError(
        "Binary .xls files are not supported; export them as CSV, HTML or SpreadsheetML XML first.",
      );
    if (
      /\.(md|markdown)$/.test(name) ||
      /^\|[^\n]+\|\s*\n\|?\s*:?-{3,}/.test(trimmed)
    )
      return this.importMarkdown(text, { replace: true, ...options });
    if (/\.xml$/.test(name) || /^<\?xml/i.test(trimmed))
      return this.importSpreadsheetXML(text, { replace: true, ...options });
    if (/\.json$/.test(name) || /^[\[{]/.test(trimmed)) {
      try {
        return this.importJSON(text, { ...options, replace: true });
      } catch (error) {
        if (/\.json$/.test(name)) throw error;
      }
    }
    const delimiter = /\.(tsv|tab)$/.test(name)
      ? "\t"
      : /\.csv$/.test(name)
        ? detectDelimiter(text)
        : detectDelimiter(text);
    return this.importDelimited(text, { ...options, delimiter, replace: true });
  }
  exportJSON({
    range = this.getUsedRange(),
    computed = true,
    headerRow = range.r1,
  } = {}) {
    const table = this.toArray(range, computed),
      offset = headerRow - range.r1;
    const headers = (table[offset] || []).map((v, i) =>
      String(v || colToName(range.c1 + i)),
    );
    return table
      .slice(offset + 1)
      .filter((row, index) =>
        this.sqlBinding
          ? this.sqlBinding.sqlRowIds.has(headerRow + 1 + index)
          : row.some((v) => v !== "" && v != null),
      )
      .map((row) =>
        Object.fromEntries(
          headers.map((header, i) => [
            header,
            this.sqlBinding ? row[i] : (row[i] ?? ""),
          ]),
        ),
      );
  }
  exportWorkbook({
    values = true,
    formulas = true,
    formatting = true,
    dimensions = true,
    computedValues = true,
  } = {}) {
    const cells = [];
    for (const [key, meta] of this.cells) {
      const [row, col] = key.split(",").map(Number),
        raw = meta.raw;
      const cell = { row, col };
      if (
        meta.valueType !== "text" &&
        typeof raw === "string" &&
        raw.startsWith("=")
      ) {
        if (formulas) cell.formula = raw;
        if (values && computedValues)
          cell.value = toPortableValue(this.getCalculationValue(row, col));
      } else if (values && raw !== "" && raw != null)
        cell.value = toPortableValue(raw);
      if (formatting) {
        if (meta.numberFormat != null) cell.numberFormat = meta.numberFormat;
        if (meta.style) cell.style = { ...meta.style };
        if (meta.className) cell.className = meta.className;
      }
      if (meta.pivotOwner) cell.pivotOwner = meta.pivotOwner;
      if (meta.lineage && (values || formulas))
        cell.lineage = checkedLineage(meta.lineage);
      if (values && meta.valueType) cell.valueType = meta.valueType;
      if (values && Object.hasOwn(meta, "originalInput"))
        cell.originalInput = toPortableValue(meta.originalInput);
      if (Object.keys(cell).length > 2) cells.push(cell);
    }
    if (!formulas && values && computedValues)
      for (const info of this.getSpillRanges())
        for (let r = info.row; r < info.row + info.rows; r++)
          for (let c = info.col; c < info.col + info.cols; c++)
            if (r !== info.row || c !== info.col)
              cells.push({
                row: r,
                col: c,
                value: toPortableValue(this.getComputedValue(r, c)),
              });
    const dims = dimensions
      ? {
          rows: this.rowCount,
          columns: this.colCount,
          rowHeights: [...this.rowHeights],
          columnWidths: [...this.colWidths],
          hiddenRows: [...this.hiddenRows].sort((a, b) => a - b),
          hiddenColumns: [...this.hiddenColumns].sort((a, b) => a - b),
        }
      : undefined;
    const sheet = {
      id: "sheet1",
      name: this.sheetName,
      activeTableId: this._activeTableId,
      tables: this.listTables(),
      visualizations: structuredClone(this.visualizations),
      cells,
      variables: toPortableValue(Object.fromEntries(this.variables)),
      ...(dims ? { dimensions: dims } : {}),
      freezePanes: { ...this.freezePanes },
      conditionalFormats: structuredClone(this.conditionalFormats),
      validationRules: structuredClone(this.validationRules),
      pivotTables: structuredClone(this.pivotTables),
      table: this.table ? { ...this.table, filters: undefined } : null,
      filters: [...this.columnFilters].map(([column, values]) => ({
        column,
        values: [...values],
      })),
    };
    const workbook = {
      format: "tinyDatagrid-workbook",
      version: 2,
      formulaModel: "structured-v1",
      activeSheetId: "sheet1",
      sheets: [sheet],
      cells,
      variables: sheet.variables,
    };
    if (dims) workbook.dimensions = dims;
    return workbook;
  }
  /** Create a self-contained URL that restores this workbook from its hash. */
  createShareURL(baseURL = globalThis.location?.href) {
    if (!baseURL)
      throw new TypeError("A base URL is required outside a browser");
    const url = new URL(baseURL);
    url.hash = encodeSharePayload(this.exportWorkbook());
    return url.toString();
  }
  /** Restore a workbook encoded in a tinyDatagrid share URL hash. */
  importShareHash(hash = globalThis.location?.hash) {
    return this.importWorkbook(decodeSharePayload(hash), { replace: true });
  }
  importWorkbook(
    input,
    {
      replace = true,
      startRow = 0,
      startCol = 0,
      values = true,
      formulas = true,
      formatting = true,
      dimensions = true,
    } = {},
  ) {
    const workbook = typeof input === "string" ? parseDataJSON(input) : input;
    if (workbook?.formulaModel && workbook.formulaModel !== "structured-v1")
      throw new TypeError("Unsupported formula model");
    if (!workbook || workbook.format !== "tinyDatagrid-workbook")
      throw new TypeError(
        "Workbook JSON must use the tinyDatagrid-workbook format",
      );
    const activeSheet = Array.isArray(workbook.sheets)
      ? workbook.sheets.find((sheet) => sheet.id === workbook.activeSheetId) ||
        workbook.sheets[0]
      : null;
    const payload = activeSheet || workbook;
    if (!Array.isArray(payload.cells))
      throw new TypeError("Workbook sheet must contain a cells array");
    this._recordHistory();
    if (replace) {
      this.cells = new Map();
      this.sqlBinding = null;
    }
    const dims = payload.dimensions || workbook.dimensions;
    if (replace) {
      this.visualizations = (payload.visualizations || []).map((v) => {
        if (
          !v ||
          typeof v.id !== "string" ||
          !v.range ||
          !["r1", "r2", "c1", "c2"].every(
            (k) => Number.isInteger(v.range[k]) && v.range[k] >= 0,
          ) ||
          v.range.r2 < v.range.r1 ||
          v.range.c2 < v.range.c1
        )
          throw new TypeError("Invalid visualization");
        return {
          id: v.id,
          name: String(v.name || v.id),
          chartType: String(v.chartType || "column"),
          range: { ...v.range },
        };
      });
      this.pivotTables = structuredClone(payload.pivotTables || []);
      this.sheetName = payload.name || "Sheet1";
      this.freezePanes = { rows: 0, columns: 0, ...payload.freezePanes };
      this.conditionalFormats = structuredClone(
        payload.conditionalFormats || [],
      );
      this.validationRules = structuredClone(payload.validationRules || []);
      this.feature("validation")?.checkRules(this.validationRules);
      this.feature("conditionalFormatting")?.checkRules(
        this.conditionalFormats,
      );
      this.table = payload.table ? { ...payload.table } : null;
      this.columnFilters = new Map(
        (payload.filters || []).map((item) => [
          Number(item.column),
          new Set((item.values || []).map(String)),
        ]),
      );
      this._restoreTables(payload.tables);
      if (this._tables.some((t) => t.id === payload.activeTableId))
        this._activeTableId = payload.activeTableId;
    }
    if (replace && dimensions && dims && startRow === 0 && startCol === 0) {
      this.rowCount = Math.max(1, Math.trunc(Number(dims.rows) || 1));
      this.colCount = Math.max(1, Math.trunc(Number(dims.columns) || 1));
      this.rowHeights = Array.from({ length: this.rowCount }, (_, i) =>
        clamp(Number(dims.rowHeights?.[i]) || this.options.rowHeight, 18, 400),
      );
      this.colWidths = Array.from({ length: this.colCount }, (_, i) =>
        clamp(
          Number(dims.columnWidths?.[i]) || this.options.columnWidth,
          36,
          800,
        ),
      );
      this.hiddenRows = new Set(
        (dims.hiddenRows || [])
          .map(Number)
          .filter((i) => Number.isInteger(i) && i >= 0 && i < this.rowCount),
      );
      this.hiddenColumns = new Set(
        (dims.hiddenColumns || [])
          .map(Number)
          .filter((i) => Number.isInteger(i) && i >= 0 && i < this.colCount),
      );
    } else if (replace) {
      this.hiddenRows.clear();
      this.hiddenColumns.clear();
    }
    if (
      replace &&
      (payload.variables || workbook.variables) &&
      typeof (payload.variables || workbook.variables) === "object"
    )
      this.variables = new Map(
        Object.entries(
          fromPortableValue(payload.variables || workbook.variables),
        ),
      );
    for (const source of payload.cells) {
      if (
        !source ||
        !Number.isInteger(source.row) ||
        !Number.isInteger(source.col) ||
        source.row < 0 ||
        source.col < 0
      )
        continue;
      const row = startRow + source.row,
        col = startCol + source.col,
        meta = {};
      let hasValue = false,
        value;
      if (formulas && typeof source.formula === "string") {
        value = source.formula;
        hasValue = true;
        if (startRow || startCol)
          value = this.shiftFormula(value, startRow, startCol);
      } else if (values && Object.hasOwn(source, "value")) {
        value = fromPortableValue(source.value);
        hasValue = true;
      }
      if (source.pivotOwner) meta.pivotOwner = source.pivotOwner;
      if (hasValue && source.lineage)
        meta.lineage = checkedLineage(source.lineage);
      if (hasValue)
        meta.valueType =
          typeof source.valueType === "string" ? source.valueType : undefined;
      if (hasValue)
        meta.originalInput = Object.hasOwn(source, "originalInput")
          ? fromPortableValue(source.originalInput)
          : value;
      if (formatting) {
        if (Object.hasOwn(source, "numberFormat"))
          meta.numberFormat = source.numberFormat;
        if (source.style && typeof source.style === "object")
          meta.style = { ...source.style };
        if (typeof source.className === "string")
          meta.className = source.className;
      }
      if (hasValue || Object.keys(meta).length)
        Map.prototype.set.call(this.cells, this.key(row, col), {
          ...(this.cells.get(this.key(row, col)) || {}),
          ...meta,
          ...(hasValue ? { raw: value } : {}),
        });
      this.ensureSize(row + 1, col + 1);
    }
    this.anchor = {
      row: clamp(this.anchor.row, 0, this.rowCount - 1),
      col: clamp(this.anchor.col, 0, this.colCount - 1),
    };
    this.selection = {
      r1: clamp(this.selection.r1, 0, this.rowCount - 1),
      c1: clamp(this.selection.c1, 0, this.colCount - 1),
      r2: clamp(this.selection.r2, 0, this.rowCount - 1),
      c2: clamp(this.selection.c2, 0, this.colCount - 1),
    };
    this.engine.clearCache();
    this._updateFilteredRows();
    this.render();
    this.emit("change", {
      type: "workbookimport",
      cells: payload.cells.length,
    });
    return {
      cells: payload.cells.length,
      rows: this.rowCount,
      columns: this.colCount,
    };
  }
  importJSON(input, options = {}) {
    const data = typeof input === "string" ? parseDataJSON(input) : input;
    if (data?.format === "tinyDatagrid-workbook")
      return this.importWorkbook(data, options);
    if (!Array.isArray(data))
      throw new TypeError("JSON import expects an array");
    if (!data.length) return { rows: 0, headers: [] };
    if (Array.isArray(data[0])) {
      if (options.replace)
        return {
          rows: this._importMatrix(data, {
            startRow: options.startRow || 0,
            startCol: options.startCol || 0,
            replace: true,
          }),
          headers: [],
        };
      this.load(data, options.startRow || 0, options.startCol || 0);
      return { rows: data.length, headers: [] };
    }
    if (options.replace) {
      const headers = options.headers || Object.keys(data[0] || {});
      const rows = [
        ...(options.includeHeaders === false ? [] : [headers]),
        ...data.map((record) =>
          headers.map((header) =>
            Object.hasOwn(record || {}, header) ? record[header] : "",
          ),
        ),
      ];
      return {
        rows: this._importMatrix(rows, {
          startRow: options.startRow || 0,
          startCol: options.startCol || 0,
          replace: true,
        }),
        headers,
      };
    }
    return this.loadRecords(data, options);
  }
  formatSelection(format) {
    const s = this.selection,
      r1 = Math.min(s.r1, s.r2),
      r2 = Math.max(s.r1, s.r2),
      c1 = Math.min(s.c1, s.c2),
      c2 = Math.max(s.c1, s.c2);
    this._recordHistory();
    for (let r = r1; r <= r2; r++)
      for (let c = c1; c <= c2; c++) {
        const cell = this.getCell(r, c);
        this.cells.set(this.key(r, c), {
          ...cell,
          numberFormat: format || null,
        });
      }
    this.renderCells();
    this.emit("format", { range: { r1, c1, r2, c2 }, format: format || null });
  }
  createTable(
    range = this.getUsedRange(),
    {
      headerRow = range.r1,
      style = "banded",
      name,
      includeEmptyRows = false,
    } = {},
  ) {
    if (this.readOnly) return false;
    const normalized = {
      r1: clamp(Math.min(range.r1, range.r2), 0, this.rowCount - 1),
      c1: clamp(Math.min(range.c1, range.c2), 0, this.colCount - 1),
      r2: clamp(Math.max(range.r1, range.r2), 0, this.rowCount - 1),
      c2: clamp(Math.max(range.c1, range.c2), 0, this.colCount - 1),
    };
    headerRow = clamp(headerRow, normalized.r1, normalized.r2);
    const overlaps = this._tables.filter(
      (t) =>
        t.r1 <= normalized.r2 &&
        t.r2 >= normalized.r1 &&
        t.c1 <= normalized.c2 &&
        t.c2 >= normalized.c1,
    );
    if (overlaps.length) {
      const existing = overlaps[0];
      if (
        overlaps.length === 1 &&
        ["r1", "r2", "c1", "c2"].every((k) => existing[k] === normalized[k])
      ) {
        this.activateTable(existing.id);
        return this;
      }
      throw new Error("Tables cannot overlap. Select a separate range.");
    }
    this._recordHistory();
    let n = 1;
    while (this._tables.some((t) => t.id === `table${n}`)) n++;
    const id = `table${n}`;
    this._tables.push({
      ...normalized,
      headerRow,
      style,
      id,
      name: String(name || `Table ${n}`),
      ...(includeEmptyRows ? { includeEmptyRows: true } : {}),
      filters: new Map(),
    });
    this._activeTableId = id;
    this._updateFilteredRows();
    this.render();
    this.emit("table", { ...this.table });
    return this;
  }
  removeTable(id = this.table?.id) {
    if (this.readOnly || !this._tables.some((t) => t.id === id)) return false;
    this._recordHistory();
    this._tables = this._tables.filter((t) => t.id !== id);
    for (const p of this.pivotTables) if (p.table === id) delete p.table;
    if (this._activeTableId === id)
      this._activeTableId = this._tables[0]?.id || null;
    this.render();
    this.emit("table", { removed: true, id });
    return true;
  }
  _updateFilteredRows() {
    this.filteredRows.clear();
    for (const table of this._tables) {
      for (let row = table.headerRow + 1; row <= table.r2; row++) {
        if (
          !this.isTableRowVisible(row, table.c1) &&
          !this.hiddenRows.has(row) &&
          !this._tables.some(
            (other) => other !== table && row >= other.r1 && row <= other.r2,
          )
        )
          this.filteredRows.add(row);
      }
    }
    this.engine.dependencies.invalidate(
      this._calculationKey("visibility"),
      new Set(this.engine.dependencies.stack),
    );
    this.feature("pivots")?.invalidateVisibility?.();
  }
  setColumnFilter(col, values) {
    if (!this.table || col < this.table.c1 || col > this.table.c2) return false;
    this._recordHistory();
    if (values == null) this.columnFilters.delete(col);
    else this.columnFilters.set(col, new Set([...values].map(String)));
    this._updateFilteredRows();
    this.layout();
    this.emit("filter", {
      column: col,
      values: values == null ? null : [...this.columnFilters.get(col)],
      rows: [...this.filteredRows],
    });
    return true;
  }
  clearFilters() {
    if (!this.columnFilters.size) return false;
    this._recordHistory();
    this.columnFilters.clear();
    this._updateFilteredRows();
    this.layout();
    this.emit("filter", { clear: true, rows: [] });
    return true;
  }
  sortTable(col, direction = "asc") {
    if (
      !this.table ||
      (this.readOnly && !this.sqlBinding) ||
      col < this.table.c1 ||
      col > this.table.c2
    )
      return false;
    const { headerRow, r2, c1, c2 } = this.table,
      rows = [];
    for (let row = headerRow + 1; row <= r2; row++) {
      const values = [];
      for (let c = c1; c <= c2; c++) values.push({ ...this.getCell(row, c) });
      rows.push({
        values,
        row,
        height: this.rowHeights[row],
        hidden: this.hiddenRows.has(row),
        sqlId: this.sqlBinding?.sqlRowIds.get(row),
        value: this.getComputedValue(row, col),
      });
    }
    const sign = direction === "desc" ? -1 : 1;
    rows.sort((a, b) => {
      const x = a.value,
        y = b.value;
      if (x == null || x === "")
        return y == null || y === "" ? a.row - b.row : 1;
      if (y == null || y === "") return -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * sign;
      return (
        String(x).localeCompare(String(y), undefined, {
          numeric: true,
          sensitivity: "base",
        }) * sign || a.row - b.row
      );
    });
    this._recordHistory();
    const sortedSqlRows = this.sqlBinding
      ? new Map(
          [...this.sqlBinding.sqlRowIds].filter(
            ([row]) => row <= headerRow || row > r2,
          ),
        )
      : null;
    rows.forEach((item, index) => {
      const row = headerRow + 1 + index;
      for (let c = c1; c <= c2; c++) {
        const cell = { ...item.values[c - c1] },
          raw = cell.raw;
        if (typeof raw === "string" && raw.startsWith("="))
          cell.raw = this.shiftFormula(raw, row - item.row, 0);
        if (
          cell.raw === "" &&
          !cell.style &&
          !cell.numberFormat &&
          !cell.className
        )
          this.cells.delete(this.key(row, c));
        else this.cells.set(this.key(row, c), cell);
      }
      if (this._tables.length === 1) {
        this.rowHeights[row] = item.height;
        this.hiddenRows.delete(row);
        if (item.hidden) this.hiddenRows.add(row);
      }
      if (sortedSqlRows && item.sqlId) sortedSqlRows.set(row, item.sqlId);
    });
    if (sortedSqlRows) this.sqlBinding.sqlRowIds = sortedSqlRows;
    this.engine.clearCache();
    this._updateFilteredRows();
    this.render();
    this.emit("sort", { column: col, direction });
    return true;
  }
  toRecords({
    headerRow = this.table?.headerRow ?? 0,
    startRow = headerRow + 1,
    endRow = this.table?.r2 ?? this.rowCount - 1,
    startCol = this.table?.c1 ?? 0,
    endCol = this.table?.c2 ?? this.colCount - 1,
    visibleOnly = false,
  } = {}) {
    const headers = [];
    for (let c = startCol; c <= endCol; c++)
      headers.push(String(this.getComputedValue(headerRow, c) || colToName(c)));
    const out = [];
    for (let r = startRow; r <= endRow; r++) {
      if (visibleOnly && !this.isTableRowVisible(r, startCol)) continue;
      const rec = {};
      let nonEmpty = false;
      headers.forEach((h, i) => {
        const v = this.getComputedValue(r, startCol + i);
        rec[h] = v;
        if (v !== "" && v != null) nonEmpty = true;
      });
      if (nonEmpty || this.sqlBinding?.sqlRowIds.has(r)) out.push(rec);
    }
    return out;
  }
  pivot(config) {
    const source = {
      visibleOnly: Boolean(this.table),
      ...(config.source || {}),
    };
    return PivotEngine.pivot(this.toRecords(source), config);
  }
  setFreezePanes({
    rows = this.freezePanes.rows,
    columns = this.freezePanes.columns,
  } = {}) {
    this.freezePanes = {
      rows: clamp(Math.trunc(rows) || 0, 0, this.rowCount - 1),
      columns: clamp(Math.trunc(columns) || 0, 0, this.colCount - 1),
    };
    this.render();
    this.emit("freezepanes", { ...this.freezePanes });
    return this;
  }
  setConditionalFormats(rules = []) {
    if (!Array.isArray(rules))
      throw new TypeError("Conditional formatting rules must be an array");
    this.feature("conditionalFormatting")?.checkRules(rules);
    this.conditionalFormats = structuredClone(rules);
    this.renderCells();
    this.emit("conditionalformats", { rules: this.conditionalFormats });
    return this;
  }
  shiftFormula(formula, dr, dc) {
    const strings = [];
    const masked = formula.replace(
      /"(?:""|[^"])*"|'(?:''|[^'])*'(?=\s*!)|[\p{L}_][\p{L}\p{M}0-9_.]*(?=\s*!)/gu,
      (s) => {
        strings.push(s);
        return `\u0000${strings.length - 1}\u0000`;
      },
    );
    return masked
      .replace(
        /(^|[^\p{L}\p{M}0-9_@.])(\$?)([A-Z]+)(\$?)(\d+)(?![\p{L}\p{M}0-9_.]|\s*\()/giu,
        (m, prefix, ac, col, ar, row) => {
          const nc = ac ? nameToCol(col) : Math.max(0, nameToCol(col) + dc);
          const nr = ar ? Number(row) - 1 : Math.max(0, Number(row) - 1 + dr);
          return `${prefix}${ac}${colToName(nc)}${ar}${nr + 1}`;
        },
      )
      .replace(/\u0000(\d+)\u0000/g, (_, i) => strings[Number(i)]);
  }
  _fillBounds(source, target) {
    const src = {
      r1: Math.min(source.r1, source.r2),
      c1: Math.min(source.c1, source.c2),
      r2: Math.max(source.r1, source.r2),
      c2: Math.max(source.c1, source.c2),
    };
    const dst = {
      r1: Math.min(src.r1, target.r1, target.r2),
      c1: Math.min(src.c1, target.c1, target.c2),
      r2: Math.max(src.r2, target.r1, target.r2),
      c2: Math.max(src.c2, target.c1, target.c2),
    };
    return {
      src,
      dst,
      extendsRows: dst.r1 < src.r1 || dst.r2 > src.r2,
      extendsColumns: dst.c1 < src.c1 || dst.c2 > src.c2,
    };
  }
  _canFill(source, target) {
    if (this.readOnly) return false;
    if (!this.sqlBinding) return true;
    const { dst } = this._fillBounds(source, target);
    for (let row = dst.r1; row <= dst.r2; row++)
      for (let col = dst.c1; col <= dst.c2; col++)
        if (this.isCellReadOnly(row, col)) return false;
    return true;
  }
  _ambiguousAutofill(source, target) {
    const { src, dst, extendsRows, extendsColumns } = this._fillBounds(
      source,
      target,
    );
    if (!extendsRows && !extendsColumns) return null;
    const height = src.r2 - src.r1 + 1,
      width = src.c2 - src.c1 + 1;
    if (extendsRows) {
      for (let col = src.c1; col <= src.c2; col++) {
        const values = Array.from({ length: height }, (_, index) =>
            this.getRawValue(src.r1 + index, col),
          ),
          series = inferAutofillSeries(values);
        if (series.ambiguous)
          return { series, values, axis: "vertical", src, dst };
      }
    } else {
      for (let row = src.r1; row <= src.r2; row++) {
        const values = Array.from({ length: width }, (_, index) =>
            this.getRawValue(row, src.c1 + index),
          ),
          series = inferAutofillSeries(values);
        if (series.ambiguous)
          return { series, values, axis: "horizontal", src, dst };
      }
    }
    return null;
  }
  _autofillPreview(series, mode, offsets) {
    return offsets
      .map((offset) => {
        const item =
            mode === "repeat"
              ? series.repeatAt(offset)
              : series.valueAt(offset),
          value = item.value;
        return value instanceof Date
          ? value.toLocaleDateString()
          : String(value ?? "");
      })
      .join(", ");
  }
  _openAutofillMenu(source, target, ambiguity) {
    this._autofillPending = { source: { ...source }, target: { ...target } };
    this.selection = { ...target };
    this.updateSelectionOverlay();
    const { src, dst, axis, series } = ambiguity,
      seedLength =
        axis === "vertical" ? src.r2 - src.r1 + 1 : src.c2 - src.c1 + 1;
    const positive = axis === "vertical" ? dst.r2 > src.r2 : dst.c2 > src.c2;
    const count = Math.min(
      2,
      axis === "vertical"
        ? positive
          ? dst.r2 - src.r2
          : src.r1 - dst.r1
        : positive
          ? dst.c2 - src.c2
          : src.c1 - dst.c1,
    );
    const offsets = Array.from({ length: count }, (_, index) =>
      positive ? seedLength + index : -1 - index,
    );
    const menu = this.autofillMenu,
      title = document.createElement("div");
    title.className = "tg-menu-title";
    title.textContent = this.t("multipleFills");
    menu.replaceChildren(title);
    const choices = [
      [
        "series",
        `${this.t("series")}: ${this._autofillPreview(series, "series", offsets)}`,
      ],
      [
        "repeat",
        `${this.t("repeat")}: ${this._autofillPreview(series, "repeat", offsets)}`,
      ],
    ];
    for (const [mode, label] of choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tg-autofill-option";
      button.dataset.autofillMode = mode;
      button.textContent = label;
      menu.append(button);
    }
    menu.hidden = false;
    const root = this.el.getBoundingClientRect(),
      handle = this.fillHandle.getBoundingClientRect();
    let left = handle.left - root.left,
      top = handle.bottom - root.top + 7;
    if (left + menu.offsetWidth > root.width)
      left = handle.right - root.left - menu.offsetWidth;
    if (top + menu.offsetHeight > root.height)
      top = handle.top - root.top - menu.offsetHeight - 7;
    menu.style.left =
      clamp(left, 0, Math.max(0, root.width - menu.offsetWidth)) + "px";
    menu.style.top =
      clamp(top, 0, Math.max(0, root.height - menu.offsetHeight)) + "px";
    menu.querySelector("button")?.focus({ preventScroll: true });
  }
  _closeAutofillMenu(restore = false) {
    if (!this.autofillMenu || this.autofillMenu.hidden) return false;
    const pending = this._autofillPending;
    this._autofillPending = null;
    this.autofillMenu.hidden = true;
    if (restore && pending) {
      this.selection = { ...pending.source };
      this.anchor = { row: this.selection.r1, col: this.selection.c1 };
      this.updateSelectionOverlay();
    }
    return true;
  }
  _requestAutofill(source, target) {
    if (!this._canFill(source, target)) return false;
    const ambiguity = this._ambiguousAutofill(source, target);
    if (ambiguity) {
      this._openAutofillMenu(source, target, ambiguity);
      return null;
    }
    return this.fill(source, target, { mode: "series" });
  }
  _chooseAutofill(mode) {
    const pending = this._autofillPending;
    if (!pending) return false;
    this._closeAutofillMenu();
    const filled = this.fill(pending.source, pending.target, { mode });
    this.selection = { ...(filled ? pending.target : pending.source) };
    this.anchor = { row: this.selection.r1, col: this.selection.c1 };
    this.updateSelectionOverlay();
    this.el.focus({ preventScroll: true });
    return filled;
  }
  fillDownToContiguousData(source = this.selection) {
    if (this.readOnly) return false;
    const target = findAutofillExtent(source, {
      rowCount: this.rowCount,
      getValue: (row, col) => this.getRawValue(row, col),
    });
    if (!target) return false;
    const result = this._requestAutofill(source, target);
    if (result === true) {
      this.selection = { ...target };
      this.anchor = { row: target.r1, col: target.c1 };
      this.updateSelectionOverlay();
    }
    return result !== false;
  }
  fill(source, target, { mode = "series" } = {}) {
    const { src, dst, extendsRows, extendsColumns } = this._fillBounds(
      source,
      target,
    );
    if (!extendsRows && !extendsColumns) return false;
    if (!this._canFill(source, target)) return false;
    this._recordHistory();
    this.ensureSize(dst.r2 + 1, dst.c2 + 1);
    const h = src.r2 - src.r1 + 1,
      w = src.c2 - src.c1 + 1;
    const seriesCache = new Map();
    for (let r = dst.r1; r <= dst.r2; r++)
      for (let c = dst.c1; c <= dst.c2; c++) {
        if (r >= src.r1 && r <= src.r2 && c >= src.c1 && c <= src.c2) continue;
        let sr, sc, raw;
        if (extendsRows) {
          sc = src.c1 + ((((c - src.c1) % w) + w) % w);
          let series = seriesCache.get(`c${sc}`);
          if (!series) {
            series = inferAutofillSeries(
              Array.from({ length: h }, (_, index) =>
                this.getRawValue(src.r1 + index, sc),
              ),
            );
            seriesCache.set(`c${sc}`, series);
          }
          const item =
            mode === "repeat"
              ? series.repeatAt(r - src.r1)
              : series.valueAt(r - src.r1);
          sr = src.r1 + item.sourceIndex;
          raw = item.value;
        } else {
          sr = src.r1 + ((((r - src.r1) % h) + h) % h);
          let series = seriesCache.get(`r${sr}`);
          if (!series) {
            series = inferAutofillSeries(
              Array.from({ length: w }, (_, index) =>
                this.getRawValue(sr, src.c1 + index),
              ),
            );
            seriesCache.set(`r${sr}`, series);
          }
          const item =
            mode === "repeat"
              ? series.repeatAt(c - src.c1)
              : series.valueAt(c - src.c1);
          sc = src.c1 + item.sourceIndex;
          raw = item.value;
        }
        if (typeof raw === "string" && raw.startsWith("="))
          raw = this.shiftFormula(raw, r - sr, c - sc);
        this.cells.set(this.key(r, c), { ...this.getCell(sr, sc), raw });
      }
    this.render();
    this.emit("fill", {
      source: src,
      target: dst,
      direction: extendsRows
        ? extendsColumns
          ? "both"
          : "vertical"
        : "horizontal",
    });
    return true;
  }
  _referenceDocuments() {
    return (
      this.feature("worksheets")?.referenceDocuments() || [
        {
          id: null,
          name: this.sheetName,
          cells: this.cells,
          variables: this.variables,
          pivotTables: this.pivotTables,
          read: (row, col) => this.getCalculationValue(row, col),
        },
      ]
    );
  }
  /** Attach portable provenance to an output cell from any host transformation. */
  setCellLineage(row, col, lineage) {
    if (this.readOnly) return false;
    if (![row, col].every((n) => Number.isSafeInteger(n) && n >= 0))
      throw new RangeError("Invalid lineage cell");
    const checked = checkedLineage(lineage);
    return this.transaction(() => {
      const key = this.key(row, col),
        cell = { ...this.getCell(row, col) };
      if (checked) cell.lineage = checked;
      else delete cell.lineage;
      this.cells.set(key, cell);
      this.emit("change", { type: "lineage", row, col });
      return true;
    });
  }
  getPrecedents(row = this.anchor.row, col = this.anchor.col, options = {}) {
    return tracePrecedents(this, row, col, options);
  }
  getDependents(row = this.anchor.row, col = this.anchor.col, options = {}) {
    return traceDependents(this, row, col, options);
  }
  moveRange(source, destRow, destCol) {
    if (this.readOnly) return false;
    const src = {
      r1: Math.min(source.r1, source.r2),
      c1: Math.min(source.c1, source.c2),
      r2: Math.max(source.r1, source.r2),
      c2: Math.max(source.c1, source.c2),
    };
    if (
      ![...Object.values(src), destRow, destCol].every(
        (n) => Number.isInteger(n) && n >= 0,
      )
    )
      throw new RangeError("Invalid move coordinates");
    const dr = destRow - src.r1,
      dc = destCol - src.c1;
    if (!dr && !dc) return true;
    for (let r = src.r1; r <= src.r2; r++)
      for (let c = src.c1; c <= src.c2; c++)
        if (this.isCellReadOnly(r, c) || this.isCellReadOnly(r + dr, c + dc))
          return false;
    const ws = this.feature("worksheets"),
      movedId = ws?.activeId ?? null,
      plans = [];
    for (const document of this._referenceDocuments()) {
      const rewrite = (value) =>
        typeof value === "string" && value.startsWith("=")
          ? followsMove(value, {
              source: src,
              rowDelta: dr,
              colDelta: dc,
              ownerId: document.id,
              movedId,
              resolve: (name) => ws?.resolve(name),
            })
          : value;
      for (const [key, cell] of document.cells) {
        const after = rewrite(cell.raw);
        if (after !== cell.raw)
          plans.push({
            sheetId: document.id,
            kind: "cell",
            key,
            before: cell.raw,
            after,
          });
      }
      for (const [key, value] of document.variables) {
        const after = rewrite(value);
        if (after !== value)
          plans.push({
            sheetId: document.id,
            kind: "variable",
            key,
            before: value,
            after,
          });
      }
    }
    this._recordHistory();
    const moved = [];
    for (let r = src.r1; r <= src.r2; r++)
      for (let c = src.c1; c <= src.c2; c++)
        moved.push([r + dr, c + dc, this.cells.get(this.key(r, c))]);
    // Rewrite before relocating so formulas inside the moved block follow too.
    for (const change of plans.filter((p) => p.sheetId === movedId)) {
      if (change.kind === "variable")
        this.variables.set(change.key, change.after);
      else
        this.cells.set(change.key, {
          ...this.cells.get(change.key),
          raw: change.after,
        });
    }
    for (const entry of moved) {
      const original = this.key(entry[0] - dr, entry[1] - dc);
      entry[2] = this.cells.get(original);
    }
    for (let r = src.r1; r <= src.r2; r++)
      for (let c = src.c1; c <= src.c2; c++) this.cells.delete(this.key(r, c));
    this.ensureSize(src.r2 + dr + 1, src.c2 + dc + 1);
    for (const [r, c, cell] of moved) {
      if (cell) this.cells.set(this.key(r, c), cell);
      else this.cells.delete(this.key(r, c));
    }
    const remote = plans.filter((p) => p.sheetId !== movedId);
    if (remote.length) {
      ws.applyReferenceChanges(remote, true);
      const merged = new Map(
        (this._pendingRemoteChanges || []).map((p) => [
          JSON.stringify([p.sheetId, p.kind, p.key]),
          p,
        ]),
      );
      for (const change of remote) {
        const key = JSON.stringify([change.sheetId, change.kind, change.key]),
          old = merged.get(key);
        merged.set(key, {
          ...change,
          before: old ? old.before : change.before,
        });
      }
      this._pendingRemoteChanges = [...merged.values()];
    }
    this.engine.clearCache();
    this.selection = {
      r1: destRow,
      c1: destCol,
      r2: src.r2 + dr,
      c2: src.c2 + dc,
    };
    this.anchor = { row: destRow, col: destCol };
    this.render();
    this.emit("move", {
      source: src,
      destination: { row: destRow, col: destCol },
    });
    return true;
  }

  build() {
    this.el.classList.add("tg-root");
    this.el.tabIndex = 0;
    this.el.setAttribute("role", "grid");
    this.el.setAttribute("aria-multiselectable", "true");
    this.el.setAttribute("aria-readonly", String(this.readOnly));
    if (this.readOnly) this.el.classList.add("tg-readonly");
    this.el.innerHTML = `<div class="tg-corner"></div><div class="tg-colheaders" role="row" aria-rowindex="1"></div><div class="tg-rowheaders" aria-hidden="true"></div><div class="tg-scroll"><div class="tg-canvas"></div></div><div class="tg-selection"><div class="tg-fill-handle"></div></div><div class="tg-context-menu" role="menu" hidden></div><div class="tg-filter-menu" role="dialog" aria-label="Filter" hidden></div><div class="tg-autofill-menu" role="dialog" aria-label="Ausfüllmethode" hidden></div><textarea class="tg-editor" rows="1" spellcheck="false"></textarea>`;
    this.scroll = this.el.querySelector(".tg-scroll");
    this.canvas = this.el.querySelector(".tg-canvas");
    this.colHeaders = this.el.querySelector(".tg-colheaders");
    this.rowHeaders = this.el.querySelector(".tg-rowheaders");
    this.selectionEl = this.el.querySelector(".tg-selection");
    this.fillHandle = this.el.querySelector(".tg-fill-handle");
    this.fillHandle.setAttribute("role", "button");
    this.fillHandle.setAttribute("tabindex", "0");
    this.fillHandle.setAttribute("aria-label", "Fill selected cells");
    this.fillHandle.title = "Drag to fill or double-click to fill down";
    this.contextMenu = this.el.querySelector(".tg-context-menu");
    this.filterMenu = this.el.querySelector(".tg-filter-menu");
    this.autofillMenu = this.el.querySelector(".tg-autofill-menu");
    this.editor = this.el.querySelector(".tg-editor");
    this.editor.readOnly = this.readOnly;
  }
  _setColumnSelection(col) {
    this.anchor = { row: 0, col };
    this.selection = { r1: 0, c1: col, r2: this.rowCount - 1, c2: col };
    this.updateSelectionOverlay();
    this.emit("select", { ...this.selection });
  }
  _setRowSelection(row) {
    this.anchor = { row, col: 0 };
    this.selection = { r1: row, c1: 0, r2: row, c2: this.colCount - 1 };
    this.updateSelectionOverlay();
    this.emit("select", { ...this.selection });
  }
  _positionContextMenu() {
    const menu = this.contextMenu,
      root = this.el.getBoundingClientRect(),
      point = this._contextMenuPoint;
    menu.hidden = false;
    const width = menu.offsetWidth,
      height = menu.offsetHeight;
    menu.style.left =
      clamp(point.x - root.left, 0, Math.max(0, root.width - width)) + "px";
    menu.style.top =
      clamp(point.y - root.top, 0, Math.max(0, root.height - height)) + "px";
  }
  _renderAxisMenu(axis, index, sizeEditor = false) {
    this._contextMenuAxis = axis;
    this._contextMenuIndex = index;
    const row = axis === "row",
      sizeName = row ? this.t("rowHeight") : this.t("columnWidth"),
      size = row ? this.rowHeights[index] : this.colWidths[index],
      min = row ? 18 : 36,
      max = row ? 400 : 800;
    if (sizeEditor) {
      this.contextMenu.innerHTML = `<div class="tg-menu-title">${sizeName}</div><form class="tg-width-form"><label for="${this._gridId}-size">${this.t(row ? "height" : "width")} (${min}–${max} px)</label><input id="${this._gridId}-size" type="number" min="${min}" max="${max}" step="1" value="${Math.round(size)}"><div class="tg-menu-actions"><button type="button" data-action="back">${this.t("back")}</button><button type="submit">OK</button></div></form>`;
      this._positionContextMenu();
      const input = this.contextMenu.querySelector("input");
      input.focus({ preventScroll: true });
      input.select();
      return;
    }
    const items = row
      ? [
          ["copy", this.t("copyRow")],
          ["clear", this.t("clear")],
          ["insertBefore", this.t("insertRowBefore")],
          ["insertAfter", this.t("insertRowAfter")],
          ["delete", this.t("deleteRow")],
          ["size", this.t("rowHeight") + "…"],
          ["autoFit", this.t("autoFitRow")],
          ["hide", this.t("hideRow")],
          ["showAll", this.t("showRows")],
        ]
      : [
          ["copy", this.t("copyColumn")],
          ["clear", this.t("clear")],
          ["insertBefore", this.t("insertColumnBefore")],
          ["insertAfter", this.t("insertColumnAfter")],
          ["delete", this.t("deleteColumn")],
          ["size", this.t("columnWidth") + "…"],
          ["autoFit", this.t("autoFitColumn")],
          ["hide", this.t("hideColumn")],
          ["showAll", this.t("showColumns")],
        ];
    this.contextMenu.replaceChildren();
    let visibleItems = this.readOnly ? items.slice(0, 1) : items;
    if (this.sqlBinding && !this.readOnly)
      visibleItems = row
        ? items.filter(([action]) =>
            [
              "copy",
              "clear",
              "delete",
              "size",
              "autoFit",
              "hide",
              "showAll",
            ].includes(action),
          )
        : items.filter(([action]) =>
            ["copy", "size", "autoFit", "hide", "showAll"].includes(action),
          );
    visibleItems.forEach(([action, label], itemIndex) => {
      if ([2, 5, 7].includes(itemIndex)) {
        const separator = document.createElement("div");
        separator.className = "tg-menu-separator";
        separator.setAttribute("role", "separator");
        this.contextMenu.append(separator);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tg-menu-item";
      button.setAttribute("role", "menuitem");
      button.dataset.action = action;
      button.textContent = label;
      if (action === "delete" && (row ? this.rowCount : this.colCount) <= 1)
        button.disabled = true;
      if (
        action === "hide" &&
        (row
          ? this.hiddenRows.size >= this.rowCount - 1
          : this.hiddenColumns.size >= this.colCount - 1)
      )
        button.disabled = true;
      if (
        action === "showAll" &&
        !(row ? this.hiddenRows.size : this.hiddenColumns.size)
      )
        button.disabled = true;
      this.contextMenu.append(button);
    });
    this._positionContextMenu();
    this.contextMenu
      .querySelector("button:not(:disabled)")
      ?.focus({ preventScroll: true });
  }
  // Touch: tap selects, double tap edits, press-and-hold then drag extends the range; a plain drag scrolls.
  _touchBegin(e, row, col) {
    if (this._touch) {
      clearTimeout(this._touch.timer);
      this._touch = null;
    }
    const touch = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      row,
      col,
      moved: false,
      range: false,
    };
    touch.timer = setTimeout(() => {
      touch.range = true;
      navigator.vibrate?.(8);
    }, 350);
    this._touch = touch;
  }
  _touchMove(e) {
    const touch = this._touch;
    if (!touch || e.pointerId !== touch.id) return false;
    if (touch.range) {
      const p = this.getCellAtClient(e.clientX, e.clientY);
      this.select(p.row, p.col, true);
    } else if (Math.hypot(e.clientX - touch.x, e.clientY - touch.y) > 10) {
      touch.moved = true;
      clearTimeout(touch.timer);
    }
    return true;
  }
  _touchEnd(e, completed) {
    const touch = this._touch;
    if (!touch || e.pointerId !== touch.id) return;
    clearTimeout(touch.timer);
    this._touch = null;
    if (!completed || touch.moved || touch.range) return;
    const now = performance.now(),
      last = this._lastTap;
    if (
      last &&
      now - last.time < 350 &&
      last.row === touch.row &&
      last.col === touch.col
    ) {
      this._lastTap = null;
      this.edit(touch.row, touch.col);
    } else this._lastTap = { time: now, row: touch.row, col: touch.col };
  }
  _openColumnMenu(col, event) {
    event.preventDefault();
    event.stopPropagation();
    this._setColumnSelection(col);
    this._contextMenuPoint = { x: event.clientX, y: event.clientY };
    this._renderAxisMenu("column", col);
  }
  _openRowMenu(row, event) {
    event.preventDefault();
    event.stopPropagation();
    this._setRowSelection(row);
    this._contextMenuPoint = { x: event.clientX, y: event.clientY };
    this._renderAxisMenu("row", row);
  }
  _closeColumnMenu() {
    const focused = this.contextMenu.contains(document.activeElement);
    this.contextMenu.hidden = true;
    this.contextMenu.replaceChildren();
    if (focused) this.el.focus({ preventScroll: true });
  }
  _handleAxisMenuAction(action) {
    if (this.readOnly && action !== "copy") return;
    const axis = this._contextMenuAxis,
      index = this._contextMenuIndex,
      row = axis === "row";
    if (
      this.sqlBinding &&
      !row &&
      ["clear", "insertBefore", "insertAfter", "delete"].includes(action)
    )
      return;
    if (action === "size") {
      this._renderAxisMenu(axis, index, true);
      return;
    }
    if (action === "back") {
      this._renderAxisMenu(axis, index);
      return;
    }
    if (action === "copy") {
      const range = row
        ? { r1: index, c1: 0, r2: index, c2: this.colCount - 1 }
        : { r1: 0, c1: index, r2: this.rowCount - 1, c2: index };
      const text = this.toArray(range, false)
        .map((values) => values.join("\t"))
        .join("\n");
      navigator.clipboard?.writeText(text).catch(() => {});
      this._closeColumnMenu();
      return;
    }
    this._closeColumnMenu();
    if (action === "clear")
      row ? this.clearRow(index) : this.clearColumn(index);
    else if (action === "insertBefore")
      row ? this.insertRow(index) : this.insertColumn(index);
    else if (action === "insertAfter")
      row ? this.insertRow(index + 1) : this.insertColumn(index + 1);
    else if (action === "delete")
      row ? this.deleteRow(index) : this.deleteColumn(index);
    else if (action === "autoFit")
      row ? this.autoFitRow(index) : this.autoFitColumn(index);
    else if (action === "hide")
      row ? this.hideRow(index) : this.hideColumn(index);
    else if (action === "showAll")
      row ? this.showAllRows() : this.showAllColumns();
  }
  _openFilterMenu(col, trigger) {
    if (trigger?.dataset?.tableId) this.activateTable(trigger.dataset.tableId);
    if (!this.table || col < this.table.c1 || col > this.table.c2) return;
    this._filterColumn = col;
    this._filterOptions = new Map();
    for (let row = this.table.headerRow + 1; row <= this.table.r2; row++) {
      const value = String(this.getComputedValue(row, col) ?? "");
      this._filterOptions.set(value, (this._filterOptions.get(value) || 0) + 1);
    }
    const active = this.columnFilters.get(col),
      menu = this.filterMenu;
    menu.replaceChildren();
    const title = document.createElement("div");
    title.className = "tg-filter-title";
    title.textContent = String(
      this.getComputedValue(this.table.headerRow, col) || colToName(col),
    );
    menu.append(title);
    if (!this.readOnly || this.sqlBinding) {
      for (const [direction, label] of [
        ["asc", this.t("ascending")],
        ["desc", this.t("descending")],
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "tg-menu-item";
        button.dataset.sort = direction;
        button.textContent = label;
        menu.append(button);
      }
      const separator = document.createElement("div");
      separator.className = "tg-menu-separator";
      menu.append(separator);
    }
    const search = document.createElement("input");
    search.type = "search";
    search.className = "tg-filter-search";
    search.placeholder = this.t("search");
    search.setAttribute("aria-label", this.t("searchValues"));
    menu.append(search);
    const options = document.createElement("div");
    options.className = "tg-filter-options";
    options.dataset.filterOptions = "";
    const all = document.createElement("label");
    all.className = "tg-filter-option";
    const allBox = document.createElement("input");
    allBox.type = "checkbox";
    allBox.dataset.selectAll = "";
    allBox.checked = !active || active.size === this._filterOptions.size;
    all.append(allBox, document.createTextNode(" " + this.t("selectAll")));
    options.append(all);
    for (const [value, count] of this._filterOptions) {
      const label = document.createElement("label");
      label.className = "tg-filter-option";
      label.dataset.search = value.toLocaleLowerCase();
      const box = document.createElement("input");
      box.type = "checkbox";
      box.dataset.filterValue = value;
      box.setAttribute("aria-label", value || this.t("empty"));
      box.checked = !active || active.has(value);
      const text = document.createElement("span");
      text.textContent = value || "(" + this.t("empty") + ")";
      const amount = document.createElement("small");
      amount.textContent = String(count);
      label.append(box, text, amount);
      options.append(label);
    }
    menu.append(options);
    const actions = document.createElement("div");
    actions.className = "tg-menu-actions";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.dataset.filterClear = "";
    clear.textContent = this.t("clearFilter");
    const apply = document.createElement("button");
    apply.type = "button";
    apply.dataset.filterApply = "";
    apply.textContent = this.t("apply");
    actions.append(clear, apply);
    menu.append(actions);
    this._syncFilterSelectAll();
    const root = this.el.getBoundingClientRect(),
      rect = trigger.getBoundingClientRect();
    menu.hidden = false;
    menu.style.left =
      clamp(
        rect.left - root.left,
        0,
        Math.max(0, root.width - menu.offsetWidth),
      ) + "px";
    menu.style.top =
      clamp(
        rect.bottom - root.top,
        0,
        Math.max(0, root.height - menu.offsetHeight),
      ) + "px";
    menu.querySelector("button,input")?.focus({ preventScroll: true });
  }
  _syncFilterSelectAll() {
    const all = this.filterMenu.querySelector("[data-select-all]");
    if (!all) return;
    const visible = [
        ...this.filterMenu.querySelectorAll("[data-filter-value]"),
      ].filter((box) => !box.closest(".tg-filter-option").hidden),
      checked = visible.filter((box) => box.checked).length;
    all.checked = visible.length > 0 && checked === visible.length;
    all.indeterminate = checked > 0 && checked < visible.length;
    all.disabled = !visible.length;
  }
  _closeFilterMenu() {
    const focused = this.filterMenu.contains(document.activeElement);
    this.filterMenu.hidden = true;
    this.filterMenu.replaceChildren();
    if (focused) this.el.focus({ preventScroll: true });
  }
  _handleFilterMenuClick(event) {
    const button = event.target.closest("button");
    if (!button) return;
    const col = this._filterColumn;
    if (button.dataset.sort) {
      this._closeFilterMenu();
      this.sortTable(col, button.dataset.sort);
    } else if (button.hasAttribute("data-filter-clear")) {
      this.setColumnFilter(col, null);
      this._closeFilterMenu();
    } else if (button.hasAttribute("data-filter-apply")) {
      const checked = [
        ...this.filterMenu.querySelectorAll("[data-filter-value]:checked"),
      ].map((input) => input.dataset.filterValue);
      this.setColumnFilter(
        col,
        checked.length === this._filterOptions.size ? null : checked,
      );
      this._closeFilterMenu();
    }
  }
  offsets(arr) {
    const out = new Float64Array(arr.length + 1);
    for (let i = 0; i < arr.length; i++) out[i + 1] = out[i] + arr[i];
    return out;
  }
  _frozenCounts() {
    return this.feature("freezePanes")
      ? {
          rows: clamp(
            Math.trunc(Number(this.freezePanes.rows)) || 0,
            0,
            this.rowCount - 1,
          ),
          columns: clamp(
            Math.trunc(Number(this.freezePanes.columns)) || 0,
            0,
            this.colCount - 1,
          ),
        }
      : { rows: 0, columns: 0 };
  }
  _renderIndices(range, axis) {
    const rows = axis === "rows",
      offsets = rows ? this.rowOffsets : this.colOffsets,
      viewport = rows ? this.scroll.clientHeight : this.scroll.clientWidth,
      frozen = Math.min(
        this._frozenCounts()[axis],
        upperBound(offsets, viewport || 700),
      );
    return [
      ...new Set([
        ...Array.from({ length: frozen }, (_, i) => i),
        ...Array.from(
          { length: range.end - range.start },
          (_, i) => range.start + i,
        ),
      ]),
    ];
  }
  _scrollY() {
    const total = this.rowOffsets?.at(-1) || 0,
      viewport = this.scroll.clientHeight,
      physical = Math.max(0, (this._canvasHeight ?? total) - viewport),
      logical = Math.max(0, total - viewport);
    return physical ? (this.scroll.scrollTop * logical) / physical : 0;
  }
  _setScrollY(value) {
    const total = this.rowOffsets?.at(-1) || 0,
      viewport = this.scroll.clientHeight,
      logical = Math.max(0, total - viewport),
      physical = Math.max(0, (this._canvasHeight ?? total) - viewport);
    this.scroll.scrollTop = logical
      ? (clamp(value, 0, logical) * physical) / logical
      : 0;
  }
  _viewOffset(index, axis) {
    const rows = axis === "rows",
      frozen = this._frozenCounts()[axis],
      offsets = rows ? this.rowOffsets : this.colOffsets,
      scroll = rows ? this._scrollY() : this.scroll.scrollLeft;
    return index < frozen ? offsets[index] : offsets[index] - scroll;
  }
  _syncFrozenCells() {
    const frozen = this._frozenCounts();
    if (!frozen.rows && !frozen.columns) return;
    for (const cell of this.canvas.querySelectorAll(".tg-cell")) {
      const r = +cell.dataset.row,
        c = +cell.dataset.col;
      cell.classList.toggle("tg-frozen-row-edge", r === frozen.rows - 1);
      cell.classList.toggle("tg-frozen-column-edge", c === frozen.columns - 1);
      if (r < frozen.rows || c < frozen.columns) {
        cell.style.left =
          this.colOffsets[c] +
          (c < frozen.columns ? this.scroll.scrollLeft : 0) +
          "px";
        cell.style.top =
          this.rowOffsets[r] +
          (r < frozen.rows
            ? this.scroll.scrollTop
            : this.scroll.scrollTop - this._scrollY()) +
          "px";
        cell.style.zIndex = r < frozen.rows && c < frozen.columns ? "4" : "3";
      }
    }
  }
  _visibleRange(offsets, count, scrollPosition, viewportSize, fallbackSize) {
    if (!count) return { start: 0, end: 0 };
    const size = viewportSize || fallbackSize,
      first = Math.min(
        count - 1,
        Math.max(0, upperBound(offsets, Math.max(0, scrollPosition)) - 1),
      ),
      last = upperBound(offsets, Math.max(0, scrollPosition) + size);
    return {
      start: Math.max(0, first - this.virtualizationOverscan),
      end: Math.min(
        count,
        Math.max(first + 1, last) + this.virtualizationOverscan,
      ),
    };
  }
  _scheduleVirtualRender() {
    if (!this.virtualization || this._virtualFrame != null || this._destroyed)
      return;
    if (typeof globalThis.requestAnimationFrame !== "function") {
      this.renderHeaders();
      this.renderCells();
      this.syncHeaders();
      this.updateSelectionOverlay();
      return;
    }
    this._virtualFrame = globalThis.requestAnimationFrame(() => {
      this._virtualFrame = null;
      if (this._destroyed || !this.virtualization) return;
      this.renderHeaders();
      this.renderCells();
      this.syncHeaders();
      this.updateSelectionOverlay();
    });
  }
  layout() {
    this.feature("pivots")?.refresh();
    this._updateFilteredRows();
    this.displayColWidths = this.hiddenColumns.size
      ? this.colWidths.map((width, col) =>
          this.hiddenColumns.has(col) ? 0 : width,
        )
      : this.colWidths;
    this.displayRowHeights =
      this.hiddenRows.size || this.filteredRows.size
        ? this.rowHeights.map((height, row) =>
            this.hiddenRows.has(row) || this.filteredRows.has(row) ? 0 : height,
          )
        : this.rowHeights;
    this.colOffsets = this.offsets(this.displayColWidths);
    this.rowOffsets = this.offsets(this.displayRowHeights);
    const W = this.colOffsets.at(-1),
      H = this.rowOffsets.at(-1);
    this.el.setAttribute("aria-rowcount", String(this.rowCount + 1));
    this.el.setAttribute("aria-colcount", String(this.colCount));
    if (this.rowCount * this.colCount > 100000 && !this.virtualization) {
      this.virtualization = true;
      this._syncVirtualizationObserver();
    }
    this._canvasHeight = this.virtualization ? Math.min(H, 8000000) : H;
    this.canvas.style.width = W + "px";
    this.canvas.style.height = this._canvasHeight + "px";
    this.renderHeaders();
    this.renderCells();
    this.syncHeaders();
    this.updateSelectionOverlay();
  }
  render() {
    this.layout();
  }
  renderHeaders() {
    this.colHeaders.innerHTML = "";
    this.rowHeaders.innerHTML = "";
    const cols = this.virtualization
      ? this._visibleRange(
          this.colOffsets,
          this.colCount,
          this.scroll.scrollLeft,
          this.scroll.clientWidth,
          this.options.columnWidth * 10,
        )
      : { start: 0, end: this.colCount };
    const rows = this.virtualization
      ? this._visibleRange(
          this.rowOffsets,
          this.rowCount,
          this._scrollY(),
          this.scroll.clientHeight,
          this.options.rowHeight * 20,
        )
      : { start: 0, end: this.rowCount };
    for (const c of this._renderIndices(cols, "columns")) {
      if (this.virtualization && !this.displayColWidths[c]) continue;
      const h = document.createElement("div");
      h.className = "tg-colhead";
      const label = document.createElement("span");
      label.className = "tg-colhead-label";
      label.textContent = colToName(c);
      h.append(label);
      h.style.left = this.colOffsets[c] + "px";
      h.style.width = this.displayColWidths[c] + "px";
      h.dataset.col = c;
      h.setAttribute("role", "columnheader");
      h.setAttribute("aria-colindex", String(c + 1));
      if (this.hiddenColumns.has(c)) h.classList.add("tg-hidden-column");
      const rz = document.createElement("span");
      rz.className = "tg-resize-x";
      h.append(rz);
      this.colHeaders.append(h);
    }
    for (const r of this._renderIndices(rows, "rows")) {
      if (this.virtualization && !this.displayRowHeights[r]) continue;
      const h = document.createElement("div");
      h.className = "tg-rowhead";
      h.textContent = String(r + 1);
      h.style.top = this.rowOffsets[r] + "px";
      h.style.height = this.displayRowHeights[r] + "px";
      h.dataset.row = r;
      if (this.hiddenRows.has(r) || this.filteredRows.has(r))
        h.classList.add("tg-hidden-row");
      const rz = document.createElement("span");
      rz.className = "tg-resize-y";
      h.append(rz);
      this.rowHeaders.append(h);
    }
  }
  syncHeaders() {
    const sx = this.scroll?.scrollLeft || 0,
      sy = this.scroll ? this._scrollY() : 0;
    const frozen = this._frozenCounts();
    // Promote the table's labels only while its body is passing under the column bar.
    // Use logical offsets so this also works with compressed virtual scroll heights.
    this.colHeaders.querySelectorAll(".tg-colhead").forEach((h) => {
      const c = +h.dataset.col;
      h.style.left = this.colOffsets[c] - (c < frozen.columns ? 0 : sx) + "px";
      h.style.zIndex = c < frozen.columns ? "2" : "1";
      const table =
        !frozen.rows &&
        this._tables.find(
          (t) =>
            c >= t.c1 &&
            c <= t.c2 &&
            sy >= this.rowOffsets[t.headerRow + 1] &&
            sy < this.rowOffsets[t.r2 + 1],
        );
      const promote = !!table;
      let text = colToName(c),
        named = false;
      if (promote && c >= table.c1 && c <= table.c2) {
        const value = this.formatValue(
          this.getComputedValue(table.headerRow, c),
          this.getCell(table.headerRow, c).numberFormat,
        )
          .replace(/\s+/g, " ")
          .trim();
        if (value) {
          text += ` – ${value}`;
          named = true;
        }
      }
      const label = h.querySelector(".tg-colhead-label");
      if (label && label.textContent !== text) label.textContent = text;
      h.classList.toggle("tg-colhead-table", named);
      if (named) {
        h.title = text;
        h.setAttribute("aria-label", text);
      } else {
        h.removeAttribute("title");
        h.removeAttribute("aria-label");
      }
    });
    this.rowHeaders.querySelectorAll(".tg-rowhead").forEach((h) => {
      const r = +h.dataset.row;
      h.style.top =
        this.rowOffsets[r] - (r < this._frozenCounts().rows ? 0 : sy) + "px";
      h.style.zIndex = r < this._frozenCounts().rows ? "2" : "1";
    });
  }
  renderCells() {
    const rowsBefore = this.rowCount,
      colsBefore = this.colCount;
    this.engine.settle();
    this.feature("pivots")?.refresh();
    if (rowsBefore !== this.rowCount || colsBefore !== this.colCount) {
      this.layout();
      return;
    }
    this.canvas.innerHTML = "";
    const frag = document.createDocumentFragment(),
      spills = this.engine.dependencies;
    const rows = this.virtualization
      ? this._visibleRange(
          this.rowOffsets,
          this.rowCount,
          this._scrollY(),
          this.scroll.clientHeight,
          this.options.rowHeight * 20,
        )
      : { start: 0, end: this.rowCount };
    const cols = this.virtualization
      ? this._visibleRange(
          this.colOffsets,
          this.colCount,
          this.scroll.scrollLeft,
          this.scroll.clientWidth,
          this.options.columnWidth * 10,
        )
      : { start: 0, end: this.colCount };
    for (const r of this._renderIndices(rows, "rows")) {
      if (!this.displayRowHeights[r]) continue;
      const rowElement = document.createElement("div");
      rowElement.setAttribute("role", "row");
      rowElement.setAttribute("aria-rowindex", String(r + 2));
      frag.append(rowElement);
      for (const c of this._renderIndices(cols, "columns")) {
        if (
          this.virtualization &&
          (!this.displayRowHeights[r] || !this.displayColWidths[c])
        )
          continue;
        const table = this.tableAt(r, c);
        if (table && r > table.headerRow && !this.isTableRowVisible(r, c))
          continue;
        const d = document.createElement("div");
        d.className = "tg-cell";
        d.dataset.row = r;
        d.dataset.col = c;
        d.id = `${this._gridId}-cell-${r}-${c}`;
        d.setAttribute("role", "gridcell");
        d.setAttribute("aria-colindex", String(c + 1));
        d.draggable = false;
        d.style.left = this.colOffsets[c] + "px";
        d.style.top =
          this.rowOffsets[r] - this._scrollY() + this.scroll.scrollTop + "px";
        d.style.width = this.displayColWidths[c] + "px";
        d.style.height = this.displayRowHeights[r] + "px";
        if (this.hiddenColumns.has(c)) d.classList.add("tg-hidden-column");
        if (this.hiddenRows.has(r) || this.filteredRows.has(r))
          d.classList.add("tg-hidden-row");
        const v = this.getCalculationValue(r, c);
        const meta = this.getCell(r, c);
        if (spills.covered.size || spills.spills.size) {
          const calc = this._calculationKey(this.key(r, c)),
            origin = spills.spills.has(calc) ? calc : spills.covered.get(calc),
            area = origin && spills.spills.get(origin);
          if (area) {
            d.classList.add("tg-spilled");
            if (r === area.row) d.classList.add("tg-spill-t");
            if (r === area.row + area.rows - 1) d.classList.add("tg-spill-b");
            if (c === area.col) d.classList.add("tg-spill-l");
            if (c === area.col + area.cols - 1) d.classList.add("tg-spill-r");
          }
        }
        if (meta.pivotOwner) this._markPivotCell(d, meta, r, c);
        if (table && r === table.headerRow) {
          d.classList.add("tg-table-header");
          const label = document.createElement("span");
          label.className = "tg-table-header-label";
          label.textContent = this.formatValue(v, meta.numberFormat);
          const trigger = document.createElement("button");
          trigger.type = "button";
          trigger.className = "tg-filter-trigger";
          trigger.dataset.filterColumn = c;
          trigger.dataset.tableId = table.id;
          trigger.tabIndex = -1;
          trigger.setAttribute("aria-haspopup", "dialog");
          trigger.setAttribute(
            "aria-label",
            `${this.t("filter")} ${label.textContent}`,
          );
          trigger.textContent = table.filters.has(c) ? "▾•" : "▾";
          d.append(label, trigger);
        } else d.textContent = this.formatValue(v, meta.numberFormat);
        if (v instanceof JSONValue) {
          d.classList.add(
            "tg-json",
            v.isArray ? "tg-json-array" : "tg-json-object",
          );
          d.title = v.toString().slice(0, 400);
        } else if (isFormulaError(v)) {
          d.classList.add("tg-error");
          d.title = String(v);
        }
        if (typeof v === "number") d.classList.add("tg-number");
        if (
          meta.numberFormat === "currency" ||
          meta.numberFormat?.type === "currency"
        )
          d.classList.add("tg-currency");
        if (meta.className) d.classList.add(meta.className);
        if (meta.style) Object.assign(d.style, meta.style);
        const conditional = this.feature("conditionalFormatting");
        if (conditional) Object.assign(d.style, conditional.cellStyle(r, c, v));
        const invalid = this.feature("validation")?.validate(
          r,
          c,
          this.getRawValue(r, c),
        );
        if (invalid) {
          d.setAttribute("aria-invalid", "true");
          d.title = invalid;
          d.classList.add("tg-invalid");
        }
        if (this.feature("validation")?.listValues?.(r, c)) {
          d.classList.add("tg-has-list");
          d.setAttribute("aria-haspopup", "listbox");
        }
        if (
          table &&
          table.style === "banded" &&
          r > table.headerRow &&
          (r - table.headerRow) % 2 === 0
        )
          d.classList.add("tg-table-banded");
        rowElement.append(d);
      }
    }
    this.canvas.append(frag);
    this._syncFormulaReferenceHighlight();
    this._syncFrozenCells();
    this.syncHeaders();
    this.updateSelectionOverlay();
  }
  /** Classes and hint for a cell that belongs to a pivot result: the outline follows the result's edges. */
  _markPivotCell(d, meta, r, c) {
    const pivot = this.pivotTables.find((p) => p.id === meta.pivotOwner),
      area = pivot?.output;
    d.classList.add("tg-pivot");
    d.dataset.pivot = meta.pivotOwner;
    if (area) {
      if (r === area.r1) d.classList.add("tg-pivot-t", "tg-pivot-head");
      if (r === area.r2) d.classList.add("tg-pivot-b");
      if (c === area.c1) d.classList.add("tg-pivot-l");
      if (c === area.c2) d.classList.add("tg-pivot-r");
    }
    const table =
        pivot?.table && this._tables.find((t) => t.id === pivot.table),
      source = table
        ? table.name
        : pivot
          ? `${toA1(pivot.source.r1, pivot.source.c1)}:${toA1(pivot.source.r2, pivot.source.c2)}`
          : "";
    d.title = source
      ? `${this.t("pivotCell")} · ${source}`
      : this.t("pivotCell");
  }
  /** Typing directly under a table extends the table by that row (not while it is filtered or database-bound). */
  _growTable(row, col, value) {
    if (
      this.options.tableAutoExpand === false ||
      this.sqlBinding ||
      value === "" ||
      value == null
    )
      return;
    const table = this._tables.find(
      (t) => row === t.r2 + 1 && col >= t.c1 && col <= t.c2,
    );
    if (
      !table ||
      table.filters.size ||
      this._tables.some(
        (other) =>
          other !== table &&
          row >= other.r1 &&
          row <= other.r2 &&
          col >= other.c1 &&
          col <= other.c2,
      )
    )
      return;
    table.r2 = row;
  }
  formatValue(value, format) {
    if (value instanceof FormulaError) return String(value);
    if (value instanceof DecimalValue)
      return formatDecimal(value, format, this.locale);
    if (value instanceof CalendarDate)
      return value.toLocaleDateString(this.locale);
    if (value instanceof ClockTime || value instanceof DurationValue)
      return String(value);
    if (value instanceof JSONValue) return value.toString();
    if (value instanceof Date) return value.toLocaleString(this.locale);
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value))
      return `[Binary ${value.byteLength} bytes]`;
    if (value && typeof value === "object") return JSON.stringify(value);
    if (typeof value !== "number" || !Number.isFinite(value) || !format)
      return String(value ?? "");
    const config = typeof format === "string" ? { type: format } : format;
    if (config.type === "currency")
      return new Intl.NumberFormat(config.locale || this.locale, {
        style: "currency",
        currency: config.currency || "EUR",
        maximumFractionDigits: config.maximumFractionDigits ?? 2,
      }).format(value);
    if (config.type === "percent")
      return new Intl.NumberFormat(config.locale || this.locale, {
        style: "percent",
        maximumFractionDigits: config.maximumFractionDigits ?? 1,
      }).format(value);
    if (config.type === "number")
      return new Intl.NumberFormat(config.locale || this.locale, {
        maximumFractionDigits: config.maximumFractionDigits ?? 2,
      }).format(value);
    return String(value);
  }
  getCellAtClient(x, y) {
    const rect = this.scroll.getBoundingClientRect();
    const frozen = this._frozenCounts(),
      localX = x - rect.left,
      localY = y - rect.top;
    const px =
        localX +
        (localX < (this.colOffsets[frozen.columns] || 0)
          ? 0
          : this.scroll.scrollLeft),
      py =
        localY +
        (localY < (this.rowOffsets[frozen.rows] || 0) ? 0 : this._scrollY());
    const find = (offs, p) => {
      let lo = 0,
        hi = offs.length - 2;
      while (lo <= hi) {
        const m = (lo + hi) >> 1;
        if (p < offs[m]) hi = m - 1;
        else if (p >= offs[m + 1]) lo = m + 1;
        else return m;
      }
      return clamp(lo, 0, offs.length - 2);
    };
    return { row: find(this.rowOffsets, py), col: find(this.colOffsets, px) };
  }
  updateSelectionOverlay() {
    if (!this.colOffsets) return;
    const s = this.selection;
    const activeId = `${this._gridId}-cell-${s.r2}-${s.c2}`,
      active = this.canvas.querySelector(`#${activeId}`);
    if (
      active &&
      !this.hiddenColumns.has(s.c2) &&
      !this.filteredRows.has(s.r2) &&
      !this.hiddenRows.has(s.r2)
    )
      this.el.setAttribute("aria-activedescendant", activeId);
    else this.el.removeAttribute("aria-activedescendant");
    this.canvas.querySelectorAll("[role=gridcell]").forEach((cell) => {
      const r = +cell.dataset.row,
        c = +cell.dataset.col;
      cell.setAttribute(
        "aria-selected",
        String(
          r >= Math.min(s.r1, s.r2) &&
            r <= Math.max(s.r1, s.r2) &&
            c >= Math.min(s.c1, s.c2) &&
            c <= Math.max(s.c1, s.c2),
        ),
      );
    });
    const r1 = Math.min(s.r1, s.r2),
      r2 = Math.max(s.r1, s.r2),
      c1 = Math.min(s.c1, s.c2),
      c2 = Math.max(s.c1, s.c2);
    // Each frozen/scrolling pane has its own transform and clipping rectangle.
    const frozen = this._frozenCounts(),
      width = this.scroll.clientWidth,
      height = this.scroll.clientHeight;
    const segments = (first, last, axis, limit) => {
      const rows = axis === "rows",
        offsets = rows ? this.rowOffsets : this.colOffsets,
        count = frozen[axis],
        shift = rows ? this._scrollY() : this.scroll.scrollLeft,
        boundary = Math.min(limit, offsets[count] || 0),
        parts = [];
      for (const [start, end, delta, min, max] of [
        [first, Math.min(last, count - 1), 0, 0, boundary],
        [Math.max(first, count), last, shift, boundary, limit],
      ]) {
        if (start > end) continue;
        const rawStart = offsets[start] - delta,
          rawEnd = offsets[end + 1] - delta,
          lo = Math.max(min, rawStart),
          hi = Math.min(max, rawEnd);
        if (hi > lo)
          parts.push({
            lo,
            hi,
            startVisible: rawStart >= min,
            endVisible: rawEnd <= max,
          });
      }
      return parts;
    };
    const xs = segments(c1, c2, "columns", width),
      ys = segments(r1, r2, "rows", height);
    Object.assign(this.selectionEl.style, {
      left: this.scroll.offsetLeft + "px",
      top: this.scroll.offsetTop + "px",
      width: width + "px",
      height: height + "px",
      display: xs.length && ys.length ? "block" : "none",
    });
    this.selectionEl
      .querySelectorAll(".tg-selection-part")
      .forEach((part) => part.remove());
    for (const x of xs)
      for (const y of ys) {
        const part = document.createElement("div");
        part.className = "tg-selection-part";
        Object.assign(part.style, {
          left: x.lo + "px",
          top: y.lo + "px",
          width: x.hi - x.lo + "px",
          height: y.hi - y.lo + "px",
          borderLeftWidth: x.startVisible ? "2px" : "0",
          borderRightWidth: x.endVisible ? "2px" : "0",
          borderTopWidth: y.startVisible ? "2px" : "0",
          borderBottomWidth: y.endVisible ? "2px" : "0",
        });
        this.selectionEl.append(part);
      }
    const x = this._viewOffset(c2, "columns") + this.displayColWidths[c2],
      y = this._viewOffset(r2, "rows") + this.displayRowHeights[r2];
    const minX = c2 < frozen.columns ? 0 : this.colOffsets[frozen.columns],
      minY = r2 < frozen.rows ? 0 : this.rowOffsets[frozen.rows];
    Object.assign(this.fillHandle.style, {
      left: x - 4 + "px",
      top: y - 4 + "px",
      right: "auto",
      bottom: "auto",
      display:
        !this.readOnly &&
        x > minX &&
        x <= width &&
        y > minY &&
        y <= height &&
        this.displayColWidths[c2] > 0 &&
        this.displayRowHeights[r2] > 0
          ? "block"
          : "none",
    });
    if (this._editing) {
      const { row, col } = this._editing,
        ex = this._viewOffset(col, "columns"),
        ey = this._viewOffset(row, "rows");
      const visible =
        ex >= (col < frozen.columns ? 0 : this.colOffsets[frozen.columns]) &&
        ey >= (row < frozen.rows ? 0 : this.rowOffsets[frozen.rows]) &&
        ex < width &&
        ey < height;
      Object.assign(this.editor.style, {
        left: this.scroll.offsetLeft + ex + "px",
        top: this.scroll.offsetTop + ey + "px",
        visibility: visible ? "visible" : "hidden",
      });
    }
  }
  select(row, col, extend = false) {
    row = clamp(row, 0, this.rowCount - 1);
    col = clamp(col, 0, this.colCount - 1);
    if (extend)
      this.selection = {
        r1: this.anchor.row,
        c1: this.anchor.col,
        r2: row,
        c2: col,
      };
    else {
      this.anchor = { row, col };
      this.selection = { r1: row, c1: col, r2: row, c2: col };
    }
    const table = this.tableAt(row, col);
    if (table && !this.sqlBinding) this._activeTableId = table.id;
    this.scrollToCell(row, col);
    this.updateSelectionOverlay();
    this.emit("select", { ...this.selection });
  }
  /** Move by one visible cell; return false at the sheet boundary. */
  moveSelection(direction, extend = false) {
    const delta = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[
      direction
    ];
    if (!delta) return false;
    const [dr, dc] = delta;
    let row = (extend ? this.selection.r2 : this.anchor.row) + dr,
      col = (extend ? this.selection.c2 : this.anchor.col) + dc;
    while (
      dr &&
      row >= 0 &&
      row < this.rowCount &&
      !this.displayRowHeights[row]
    )
      row += dr;
    while (dc && col >= 0 && col < this.colCount && !this.displayColWidths[col])
      col += dc;
    if (row < 0 || row >= this.rowCount || col < 0 || col >= this.colCount)
      return false;
    this.select(row, col, extend);
    return true;
  }
  goTo(row, col) {
    const grew = this.ensureSize(row + 1, col + 1);
    if (grew) this.render();
    this.select(row, col);
    this.scrollToCell(row, col);
    return this;
  }
  scrollToCell(row, col) {
    if (!this.scroll.clientHeight || !this.scroll.clientWidth) return; // not laid out yet (hidden or zero-sized): scrolling would be meaningless
    const top = this.rowOffsets[row] || 0,
      bottom = this.rowOffsets[row + 1] ?? top,
      left = this.colOffsets[col] || 0,
      right = this.colOffsets[col + 1] ?? left;
    const frozen = this._frozenCounts();
    if (row >= frozen.rows) {
      if (top < this._scrollY() + this.rowOffsets[frozen.rows])
        this._setScrollY(top - this.rowOffsets[frozen.rows]);
      else if (bottom > this._scrollY() + this.scroll.clientHeight)
        this._setScrollY(bottom - this.scroll.clientHeight);
    }
    if (col >= frozen.columns) {
      if (left < this.scroll.scrollLeft + this.colOffsets[frozen.columns])
        this.scroll.scrollLeft = left - this.colOffsets[frozen.columns];
      else if (right > this.scroll.scrollLeft + this.scroll.clientWidth)
        this.scroll.scrollLeft = right - this.scroll.clientWidth;
    }
  }
  edit(row = this.selection.r2, col = this.selection.c2, initial = null) {
    if (this.editor) delete this.editor._tgReference;
    if (this.isCellReadOnly(row, col)) {
      const pivot = initial == null && this.getCell(row, col).pivotOwner;
      if (pivot) this.emit("editblocked", { row, col, pivot });
      return false;
    }
    const left = this.options.headerWidth + this._viewOffset(col, "columns"),
      top = this.options.headerHeight + this._viewOffset(row, "rows");
    this.editor.style.left = left + "px";
    this.editor.style.top = top + "px";
    this.editor.style.width = this.displayColWidths[col] + "px";
    this.editor.style.height = this.displayRowHeights[row] + "px";
    this.editor.setAttribute(
      "aria-label",
      `${toA1(row, col)} · ${this.t("editor")}`,
    );
    this.editor.value = initial ?? rawText(this.getRawValue(row, col));
    this.editor.style.display = "block";
    this.editor.style.visibility = "visible";
    this.editor.style.height =
      Math.min(
        240,
        Math.max(this.displayRowHeights[row], this.editor.scrollHeight),
      ) + "px";
    this.editor.focus({ preventScroll: true });
    if (initial == null) this.editor.select();
    else
      this.editor.setSelectionRange(
        this.editor.value.length,
        this.editor.value.length,
      );
    this._editing = { row, col };
  }
  commitEdit(cancel = false) {
    if (!this._editing) return;
    if (!cancel && !this.isCellReadOnly(this._editing.row, this._editing.col)) {
      const { row, col } = this._editing;
      if (this.setCell(row, col, this.editor.value) === false) {
        this.editor.setCustomValidity(
          this._lastWriteError ||
            this.feature("validation")?.validate(row, col, this.editor.value) ||
            "Invalid value",
        );
        this.editor.reportValidity();
        return false;
      }
    }
    this.editor.setCustomValidity("");
    this._editing = null;
    this.editor.style.display = "none";
    this.el.focus({ preventScroll: true });
  }
  // Keep reference picking separate from the selected cell and uncommitted value.
  _formulaReferenceContext(input = this.editor) {
    if (!input || input.readOnly || !input.value.startsWith("=")) return null;
    const start = input.selectionStart,
      end = input.selectionEnd,
      state = input._tgReference;
    if (
      state &&
      state.value === input.value &&
      start === state.end &&
      end === start
    )
      return state;
    const prefix = input.value.slice(0, start);
    // Quoted text (including escaped quotes) must retain ordinary caret movement.
    if (prefix.replace(/""/g, "").split('"').length % 2 === 0) return null;
    if (!/[=(:,;!+\-*/^&<>]\s*$/.test(prefix)) return null;
    return {
      start,
      end,
      row: (this._editing || this.anchor).row,
      col: (this._editing || this.anchor).col,
    };
  }
  _pickFormulaReference(row, col, input = this.editor, extend = false) {
    const state = this._formulaReferenceContext(input);
    if (!state) return false;
    row = clamp(row, 0, this.rowCount - 1);
    col = clamp(col, 0, this.colCount - 1);
    const first = extend
      ? state.first || { row: state.row, col: state.col }
      : { row, col };
    const reference =
      toA1(first.row, first.col) +
      (first.row !== row || first.col !== col ? ":" + toA1(row, col) : "");
    input.value =
      input.value.slice(0, state.start) +
      reference +
      input.value.slice(state.end);
    input.setSelectionRange(
      state.start + reference.length,
      state.start + reference.length,
    );
    input._tgReference = {
      start: state.start,
      end: state.start + reference.length,
      row,
      col,
      first,
      value: input.value,
    };
    this._formulaReferenceHighlight = {
      input,
      start: state.start,
      end: state.start + reference.length,
      reference,
      r1: Math.min(first.row, row),
      r2: Math.max(first.row, row),
      c1: Math.min(first.col, col),
      c2: Math.max(first.col, col),
    };
    if (input._tgReferenceHighlightGrid !== this && input.addEventListener) {
      input._tgReferenceHighlightGrid = this;
      this._listen(input, "blur", () =>
        this._clearFormulaReferenceHighlight(input),
      );
      this._listen(input, "input", () => {
        const range = this._formulaReferenceHighlight;
        if (
          range?.input === input &&
          input.value.slice(range.start, range.end) !== range.reference
        )
          this._clearFormulaReferenceHighlight(input);
      });
    }
    this.scrollToCell(row, col);
    input.focus({ preventScroll: true });
    this._syncFormulaReferenceHighlight();
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }
  _clearFormulaReferenceHighlight(input) {
    if (input && this._formulaReferenceHighlight?.input !== input) return;
    this._formulaReferenceHighlight = null;
    this._syncFormulaReferenceHighlight();
  }
  _syncFormulaReferenceHighlight() {
    const range = this._formulaReferenceHighlight;
    for (const cell of this.canvas?.querySelectorAll?.(".tg-cell") || []) {
      const row = +cell.dataset.row,
        col = +cell.dataset.col;
      const selected = Boolean(
        range &&
        row >= range.r1 &&
        row <= range.r2 &&
        col >= range.c1 &&
        col <= range.c2,
      );
      cell.classList.toggle("tg-formula-reference", selected);
    }
  }
  _moveFormulaReference(event, input = this.editor) {
    if (
      event.isComposing ||
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return false;
    const delta = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    }[event.key];
    const state = delta && this._formulaReferenceContext(input);
    if (!state) return false;
    let row = state.row + delta[0],
      col = state.col + delta[1];
    while (row >= 0 && row < this.rowCount && !this.displayRowHeights[row])
      row += delta[0] || 1;
    while (col >= 0 && col < this.colCount && !this.displayColWidths[col])
      col += delta[1] || 1;
    event.preventDefault();
    if (row >= 0 && row < this.rowCount && col >= 0 && col < this.colCount)
      this._pickFormulaReference(row, col, input, event.shiftKey);
    return true;
  }
  copySelection() {
    const rows = this.toArray(this.selection, false),
      dep = this.engine.dependencies;
    if (dep.covered.size) {
      const r1 = Math.min(this.selection.r1, this.selection.r2),
        c1 = Math.min(this.selection.c1, this.selection.c2);
      rows.forEach((line, i) =>
        line.forEach((value, j) => {
          if (
            value === "" &&
            dep.covered.has(this._calculationKey(this.key(r1 + i, c1 + j)))
          )
            line[j] = this.getComputedValue(r1 + i, c1 + j);
        }),
      );
    }
    return rows.map((line) => line.map(rawText).join("\t")).join("\n");
  }
  pasteText(text, start = this.anchor) {
    if (this.readOnly) return false;
    const rows = text
      .replace(/\r/g, "")
      .split("\n")
      .map((r) => r.split("\t"));
    if (
      this.sqlBinding &&
      rows.some((row, dr) =>
        row.some((_, dc) =>
          this.isCellReadOnly(start.row + dr, start.col + dc),
        ),
      )
    )
      return false;
    this._recordHistory();
    rows.forEach((rr, dr) =>
      rr.forEach((v, dc) =>
        this.cells.set(this.key(start.row + dr, start.col + dc), {
          raw: this._coerceSQLValue(start.col + dc, v),
          originalInput: v,
        }),
      ),
    );
    this.ensureSize(
      start.row + rows.length,
      start.col + Math.max(...rows.map((r) => r.length)),
    );
    this.render();
    this.emit("change", { type: "paste" });
    return true;
  }
  bind() {
    this._syncVirtualizationObserver();
    if (typeof globalThis.addEventListener === "function")
      this._listen(globalThis, "resize", () => this._scheduleVirtualRender());
    this._listen(this.scroll, "scroll", () => {
      this.syncHeaders();
      this._syncFrozenCells();
      this.updateSelectionOverlay();
      this._scheduleVirtualRender();
      this._closeColumnMenu();
      this._closeFilterMenu();
      this._closeAutofillMenu(true);
      this.emit("scroll", {
        scrollTop: this.scroll.scrollTop,
        clientHeight: this.scroll.clientHeight,
        scrollHeight: this.scroll.scrollHeight,
        remaining: Math.max(
          0,
          this.scroll.scrollHeight -
            this.scroll.scrollTop -
            this.scroll.clientHeight,
        ),
      });
    });
    this._listen(document, "pointerdown", (e) => {
      if (!this.el.contains(e.target)) {
        this._closeFilterMenu();
        this._closeColumnMenu();
        this._closeAutofillMenu(true);
      }
    });
    this._listen(this.colHeaders, "contextmenu", (e) => {
      const h = e.target.closest(".tg-colhead");
      if (h && !e.target.classList.contains("tg-resize-x"))
        this._openColumnMenu(+h.dataset.col, e);
    });
    this._listen(this.el, "pointerdown", (e) => {
      if (!this.contextMenu.hidden && !this.contextMenu.contains(e.target))
        this._closeColumnMenu();
      if (
        !this.filterMenu.hidden &&
        !this.filterMenu.contains(e.target) &&
        !e.target.closest(".tg-filter-trigger")
      )
        this._closeFilterMenu();
      if (!this.autofillMenu.hidden && !this.autofillMenu.contains(e.target))
        this._closeAutofillMenu(true);
    });
    this._listen(this.rowHeaders, "contextmenu", (e) => {
      const h = e.target.closest(".tg-rowhead");
      if (h && !e.target.classList.contains("tg-resize-y"))
        this._openRowMenu(+h.dataset.row, e);
    });
    this._listen(this.contextMenu, "click", (e) => {
      const button = e.target.closest("[data-action]");
      if (button && !button.disabled)
        this._handleAxisMenuAction(button.dataset.action);
    });
    this._listen(this.contextMenu, "submit", (e) => {
      if (!e.target.matches(".tg-width-form")) return;
      e.preventDefault();
      const input = e.target.querySelector("input"),
        size = Number(input.value),
        row = this._contextMenuAxis === "row",
        min = row ? 18 : 36,
        max = row ? 400 : 800;
      if (!Number.isFinite(size) || size < min || size > max) {
        input.reportValidity();
        return;
      }
      const index = this._contextMenuIndex;
      row ? this.setRowHeight(index, size) : this.setColumnWidth(index, size);
      this._closeColumnMenu();
    });
    this._listen(this.contextMenu, "keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (this.contextMenu.querySelector("form"))
          this._renderAxisMenu(this._contextMenuAxis, this._contextMenuIndex);
        else this._closeColumnMenu();
        return;
      }
      if (e.target.matches("input")) return;
      const items = [
          ...this.contextMenu.querySelectorAll("button:not(:disabled)"),
        ],
        index = items.indexOf(document.activeElement);
      const next = {
        ArrowDown: (index + 1) % items.length,
        ArrowUp: (index + items.length - 1) % items.length,
        Home: 0,
        End: items.length - 1,
      }[e.key];
      if (next != null) {
        e.preventDefault();
        items[next]?.focus({ preventScroll: true });
      }
    });
    this._listen(this.filterMenu, "focusout", (e) => {
      if (!this.filterMenu.hidden && !this.filterMenu.contains(e.relatedTarget))
        this._closeFilterMenu();
    });
    this._listen(this.filterMenu, "click", (e) =>
      this._handleFilterMenuClick(e),
    );
    this._listen(this.autofillMenu, "click", (e) => {
      const button = e.target.closest("[data-autofill-mode]");
      if (button) this._chooseAutofill(button.dataset.autofillMode);
    });
    this._listen(this.autofillMenu, "keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this._closeAutofillMenu(true);
        this.fillHandle.focus();
      }
    });
    this._listen(this.autofillMenu, "focusout", (e) => {
      if (
        !this.autofillMenu.hidden &&
        !this.autofillMenu.contains(e.relatedTarget)
      )
        this._closeAutofillMenu(true);
    });
    const filterInput = (e) => {
      if (e.target.matches(".tg-filter-search")) {
        const query = e.target.value.toLocaleLowerCase();
        this.filterMenu
          .querySelectorAll("[data-filter-value]")
          .forEach((box) => {
            box.closest(".tg-filter-option").hidden = !box.dataset.filterValue
              .toLocaleLowerCase()
              .includes(query);
          });
      } else if (e.target.matches("[data-select-all]"))
        this.filterMenu
          .querySelectorAll("[data-filter-value]")
          .forEach((box) => {
            if (!box.closest(".tg-filter-option").hidden)
              box.checked = e.target.checked;
          });
      this._syncFilterSelectAll();
    };
    this._listen(this.filterMenu, "input", filterInput);
    this._listen(this.filterMenu, "change", filterInput);
    this._listen(this.canvas, "click", (e) => {
      const trigger = e.target.closest(".tg-filter-trigger");
      if (trigger) {
        e.preventDefault();
        e.stopPropagation();
        this._openFilterMenu(+trigger.dataset.filterColumn, trigger);
      }
    });
    this._listen(this.canvas, "pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest(".tg-filter-trigger")) return;
      const cell = e.target.closest(".tg-cell");
      if (!cell) return;
      const row = +cell.dataset.row,
        col = +cell.dataset.col;
      if (this._editing && this._formulaReferenceContext()) {
        e.preventDefault();
        this._pickFormulaReference(row, col, this.editor, e.shiftKey);
        return;
      }
      this.el.focus({ preventScroll: true });
      this.select(row, col, e.shiftKey);
      if (e.pointerType === "touch") {
        this._touchBegin(e, row, col);
        return;
      }
      this._selectDrag = { pointerId: e.pointerId };
      this.canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    this._listen(this.canvas, "pointermove", (e) => {
      if (this._touchMove(e)) return;
      if (!this._selectDrag || e.pointerId !== this._selectDrag.pointerId)
        return;
      const p = this.getCellAtClient(e.clientX, e.clientY);
      this.select(p.row, p.col, true);
    });
    this._listen(this.canvas, "pointerup", (e) => {
      this._touchEnd(e, true);
      if (this._selectDrag?.pointerId === e.pointerId) this._selectDrag = null;
    });
    this._listen(this.canvas, "pointercancel", (e) => {
      this._touchEnd(e, false);
      if (this._selectDrag?.pointerId === e.pointerId) this._selectDrag = null;
    });
    this._listen(
      this.canvas,
      "touchmove",
      (e) => {
        if (this._touch?.range && e.cancelable) e.preventDefault();
      },
      { passive: false },
    );
    // A mouse press captures the pointer on the canvas, so the browser reports the canvas (not the cell) as the target.
    this._listen(this.canvas, "dblclick", (e) => {
      if (
        e.target.closest(".tg-filter-trigger") ||
        (this._editing && this._formulaReferenceContext())
      )
        return;
      const cell = e.target.closest(".tg-cell"),
        at = cell
          ? { row: +cell.dataset.row, col: +cell.dataset.col }
          : this.getCellAtClient(e.clientX, e.clientY);
      this.edit(at.row, at.col);
    });
    this._listen(this.fillHandle, "dblclick", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.fillDownToContiguousData();
    });
    this._listen(this.fillHandle, "keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      e.stopPropagation();
      this.fillDownToContiguousData();
    });
    this._listen(this.fillHandle, "pointerdown", (e) => {
      if (this.readOnly) return;
      e.preventDefault();
      e.stopPropagation();
      this._fillState = {
        source: { ...this.selection },
        target: { ...this.selection },
      };
      this.fillHandle.setPointerCapture(e.pointerId);
    });
    this._listen(this.fillHandle, "pointermove", (e) => {
      if (!this._fillState) return;
      const p = this.getCellAtClient(e.clientX, e.clientY);
      this._fillState.target = {
        r1: Math.min(this._fillState.source.r1, p.row),
        c1: Math.min(this._fillState.source.c1, p.col),
        r2: Math.max(this._fillState.source.r2, p.row),
        c2: Math.max(this._fillState.source.c2, p.col),
      };
      this.selection = { ...this._fillState.target };
      this.updateSelectionOverlay();
    });
    this._listen(this.fillHandle, "pointerup", (e) => {
      if (!this._fillState) return;
      const { source, target } = this._fillState;
      this._fillState = null;
      const result = this._requestAutofill(source, target);
      if (result !== null) {
        this.selection = { ...(result ? target : source) };
        this.anchor = { row: this.selection.r1, col: this.selection.c1 };
        this.updateSelectionOverlay();
      }
    });
    this._listen(this.fillHandle, "pointercancel", () => {
      if (!this._fillState) return;
      this.selection = { ...this._fillState.source };
      this._fillState = null;
      this.updateSelectionOverlay();
    });
    const resize = (axis) => (e) => {
      if (this.readOnly) return;
      this.beginHistory();
      e.preventDefault();
      e.stopPropagation();
      const head = e.target.parentElement;
      const idx = +(axis === "x" ? head.dataset.col : head.dataset.row);
      const start = axis === "x" ? e.clientX : e.clientY;
      const size = axis === "x" ? this.colWidths[idx] : this.rowHeights[idx];
      const move = (ev) => {
        if (this.readOnly) return;
        const d = (axis === "x" ? ev.clientX : ev.clientY) - start;
        axis === "x"
          ? this.setColumnWidth(idx, size + d)
          : this.setRowHeight(idx, size + d);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        this.endHistory();
      };
      window.addEventListener("pointercancel", up, {
        signal: this._abort.signal,
      });
      window.addEventListener("pointermove", move, {
        signal: this._abort.signal,
      });
      window.addEventListener("pointerup", up, { signal: this._abort.signal });
    };
    this._listen(this.colHeaders, "pointerdown", (e) => {
      if (e.target.classList.contains("tg-resize-x")) resize("x")(e);
      else {
        const h = e.target.closest(".tg-colhead");
        if (h) this._setColumnSelection(+h.dataset.col);
      }
    });
    this._listen(this.rowHeaders, "pointerdown", (e) => {
      if (e.target.classList.contains("tg-resize-y")) resize("y")(e);
      else {
        const h = e.target.closest(".tg-rowhead");
        if (h) this._setRowSelection(+h.dataset.row);
      }
    });
    // iOS never fires contextmenu, so a long press on a header opens its menu.
    const headerPress = (box, selector, resizeClass, open) => {
      let press = null;
      const stop = () => {
        if (press) {
          clearTimeout(press.timer);
          press = null;
        }
      };
      this._listen(box, "pointerdown", (e) => {
        if (
          e.pointerType !== "touch" ||
          e.target.classList.contains(resizeClass)
        )
          return;
        const header = e.target.closest(selector);
        if (!header) return;
        stop();
        const x = e.clientX,
          y = e.clientY;
        press = {
          id: e.pointerId,
          x,
          y,
          timer: setTimeout(() => {
            press = null;
            open(header, {
              clientX: x,
              clientY: y,
              preventDefault() {},
              stopPropagation() {},
            });
          }, 500),
        };
      });
      this._listen(box, "pointermove", (e) => {
        if (
          press &&
          e.pointerId === press.id &&
          Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10
        )
          stop();
      });
      this._listen(box, "pointerup", stop);
      this._listen(box, "pointercancel", stop);
    };
    headerPress(
      this.colHeaders,
      ".tg-colhead",
      "tg-resize-x",
      (header, event) => this._openColumnMenu(+header.dataset.col, event),
    );
    headerPress(
      this.rowHeaders,
      ".tg-rowhead",
      "tg-resize-y",
      (header, event) => this._openRowMenu(+header.dataset.row, event),
    );
    this._listen(this.editor, "keydown", (e) => {
      if (e.isComposing || e.defaultPrevented) return;
      if (this._moveFormulaReference(e)) return;
      if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
        e.preventDefault();
        const direction =
          e.key === "Tab"
            ? e.shiftKey
              ? "left"
              : "right"
            : e.ctrlKey || e.metaKey
              ? "up"
              : "down";
        if (this.commitEdit() === false) return;
        this.moveSelection(direction);
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.commitEdit(true);
      }
    });
    this._listen(this.editor, "input", () => {
      this.editor.setCustomValidity("");
      this.editor.style.height =
        Math.min(240, Math.max(32, this.editor.scrollHeight)) + "px";
    });
    this._listen(this.editor, "blur", () => this.commitEdit());
    this._listen(this.el, "keydown", async (e) => {
      if (e.defaultPrevented || e.isComposing) return;
      if (e.key === "Escape" && !this.autofillMenu.hidden) {
        e.preventDefault();
        this._closeAutofillMenu(true);
        return;
      }
      if (e.key === "Escape" && !this.filterMenu.hidden) {
        e.preventDefault();
        this._closeFilterMenu();
        return;
      }
      if (e.key === "Escape" && !this.contextMenu.hidden) {
        this._closeColumnMenu();
        return;
      }
      if (
        this.contextMenu.contains(e.target) ||
        this.filterMenu.contains(e.target) ||
        this.autofillMenu.contains(e.target) ||
        this._editing ||
        e.target !== this.el
      )
        return;
      const a = this.anchor;
      if (e.key === " " && (e.shiftKey || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) this._setRowSelection(a.row);
        else this._setColumnSelection(a.col);
        return;
      }
      if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
        e.preventDefault();
        const row =
            this.selection.c1 === 0 && this.selection.c2 === this.colCount - 1,
          rect = this.selectionEl.getBoundingClientRect();
        this._contextMenuPoint = { x: rect.left, y: rect.top };
        this._renderAxisMenu(row ? "row" : "column", row ? a.row : a.col);
        return;
      }
      if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault();
        const trigger = this.canvas.querySelector(
          `[data-filter-column="${a.col}"][data-table-id="${this.table?.id}"]`,
        );
        if (trigger) this._openFilterMenu(a.col, trigger);
        return;
      }
      if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        const end = e.key === "End",
          r =
            e.ctrlKey || e.metaKey ? (end ? this.getUsedRange().r2 : 0) : a.row;
        this.select(r, end ? this.getUsedRange().c2 : 0, e.shiftKey);
        return;
      }
      if (
        this.readOnly &&
        (["Enter", "F2", "Backspace", "Delete"].includes(e.key) ||
          ((e.metaKey || e.ctrlKey) &&
            ["z", "y", "v"].includes(e.key.toLowerCase())) ||
          (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey))
      ) {
        e.preventDefault();
        return;
      }
      if (e.key === "Enter" || e.key === "F2") {
        e.preventDefault();
        this.edit();
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        this.clearSelection();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? this.redo() : this.undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        this.redo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        await navigator.clipboard?.writeText(this.copySelection());
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        const t = await navigator.clipboard?.readText?.();
        if (t != null) this.pasteText(t, a);
        return;
      }
      const arrows = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };
      if (arrows[e.key]) {
        e.preventDefault();
        this.moveSelection(arrows[e.key], e.shiftKey);
        return;
      }
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        this.edit(a.row, a.col, e.key);
      }
    });
  }
}

// Public mutations share one transaction boundary. Nested operations (imports,
// SQL record deletion, autofit) become one undo step; rendering/events can run
// during the operation, but the final history event fires only after completion.
for (const name of [
  "saveVisualization",
  "removeVisualization",
  "setValidationRules",
  "replaceFormulaWithValue",
  "setCell",
  "setVariable",
  "setSheetName",
  "clearSelection",
  "styleSelection",
  "formatSelection",
  "setRowHeight",
  "setColumnWidth",
  "hideRow",
  "showAllRows",
  "insertRow",
  "deleteRow",
  "clearRow",
  "autoFitRow",
  "hideColumn",
  "showAllColumns",
  "insertColumn",
  "deleteColumn",
  "clearColumn",
  "autoFitColumn",
  "load",
  "loadRecords",
  "loadResultSet",
  "appendResultPage",
  "insertRecord",
  "deleteRecord",
  "_importMatrix",
  "importWorkbook",
  "createTable",
  "removeTable",
  "setColumnFilter",
  "clearFilters",
  "sortTable",
  "setFreezePanes",
  "setConditionalFormats",
  "fill",
  "moveRange",
  "pasteText",
]) {
  const mutate = TinyDatagrid.prototype[name];
  TinyDatagrid.prototype[name] = function (...args) {
    return this.transaction(() => mutate.apply(this, args));
  };
}

// Keep the original named export available for existing integrations.
export { TinyDatagrid as TinyGrid };
export default TinyDatagrid;
