import { parseDataJSON } from './numeric-values.js';
// JSON as a first-class cell value. A JSONValue wraps a JSON object or array so
// it cannot be confused with a spreadsheet range (which is a plain JS array).
// Scalars found inside JSON are unwrapped to ordinary cell values.

export const JSON_LIMITS = Object.freeze({ depth: 256, cells: 100000 });

const isObjectLike = value => value !== null && typeof value === 'object';
export const isPlainObject = value => isObjectLike(value) && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
export const isJSONContainer = value => Array.isArray(value) || isPlainObject(value);

function replacer(_key, value) {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof ArrayBuffer) return Array.from(new Uint8Array(value));
  if (ArrayBuffer.isView(value)) return Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  return value;
}
/** JSON.stringify that survives BigInt, binary data and cycles (cycles become a marker). */
export function stringifyJSON(value, indent) {
  try { return JSON.stringify(value, replacer, indent) ?? 'null'; }
  catch { return '[unserializable JSON]'; }
}

const texts = new WeakMap();
export class JSONValue {
  constructor(value) {
    if (!isJSONContainer(value)) throw new TypeError('JSONValue wraps a JSON object or array');
    Object.defineProperty(this, 'value', { value, enumerable: false });
  }
  get isArray() { return Array.isArray(this.value); }
  get kind() { return this.isArray ? 'array' : 'object'; }
  get length() { return this.isArray ? this.value.length : Object.keys(this.value).length; }
  toJSON() { return this.value; }
  toString() { let text = texts.get(this); if (text === undefined) texts.set(this, text = stringifyJSON(this.value)); return text; }
  [Symbol.toPrimitive](hint) { return hint === 'number' ? NaN : this.toString(); }
  get [Symbol.toStringTag]() { return 'JSONValue'; }
}
export const isJSONValue = value => value instanceof JSONValue;
/** Elements of a JSON array as engine values (containers stay JSONValue). */
export function jsonItems(json) {
  return json.isArray ? json.value.map(fromJSONData) : Object.values(json.value).map(fromJSONData);
}

export const isJSONList = value => value instanceof JSONValue && value.isArray;
/** List-context flattening: ranges are flattened deeply and JSON arrays contribute their elements. */
export function flattenValues(value) {
  let out = Array.isArray(value) ? value.flat(Infinity) : [value];
  if (out.some(isJSONList)) out = out.flatMap(item => isJSONList(item) ? flattenValues(jsonItems(item)) : [item]);
  return out;
}
/** Matrix view of a range, a scalar, or a JSON array (as a column). */
export function rowsOf(value) {
  if (isJSONList(value)) value = jsonItems(value);
  return Array.isArray(value) ? (Array.isArray(value[0]) ? value : value.map(item => [item])) : [[value]];
}

/** Wrap host containers stored in cells: arrays and plain objects become JSON, other values pass through. */
export function wrapCellValue(value) { return value instanceof JSONValue ? value : isJSONContainer(value) ? new JSONValue(value) : value; }
/** Wrap function results: plain objects become JSON, arrays remain ranges. */
export function wrapResult(value) { return isPlainObject(value) ? new JSONValue(value) : value; }
export function unwrapCellValue(value) { return value instanceof JSONValue ? value.value : value; }

/** Raw cell content as editable text. */
export function rawText(value) {
  if (value == null) return '';
  if (value instanceof JSONValue) return stringifyJSON(value.value);
  if (value instanceof Date) return value.toISOString();
  if (isObjectLike(value) && !(value instanceof ArrayBuffer) && !ArrayBuffer.isView(value)) return stringifyJSON(value);
  return String(value);
}

/** JSON data (scalars stay scalars, containers become JSONValue). */
export function fromJSONData(data) {
  if (data === undefined) return '';
  return isJSONContainer(data) ? new JSONValue(data) : data;
}
const pad = (n, size = 2) => String(n).padStart(size, '0');
/** Convert a spreadsheet value (or nested range) to pure JSON data. Blank cells become null. */
export function toJSONData(value, depth = 0) {
  if (depth > JSON_LIMITS.depth) throw new RangeError('JSON nesting too deep');
  if (value == null || value === '') return null;
  switch (typeof value) {
    case 'number': if (!Number.isFinite(value)) throw new RangeError('JSON cannot hold non-finite numbers'); return value;
    case 'boolean': case 'string': return value;
    case 'bigint': return value.toString();
    case 'function': throw new TypeError('Functions cannot be converted to JSON');
  }
  if (value instanceof JSONValue) return value.value;
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return null;
    const local = value.getHours() === 0 && value.getMinutes() === 0 && value.getSeconds() === 0 && value.getMilliseconds() === 0;
    return local ? `${pad(value.getFullYear(), 4)}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}` : value.toISOString();
  }
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return Array.from(value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  if (Array.isArray(value)) return value.map(item => toJSONData(item, depth + 1));
  if (isPlainObject(value)) { const out = {}; for (const [key, item] of Object.entries(value)) defineOwn(out, key, toJSONData(item, depth + 1)); return out; }
  return String(value);
}
/** Assign an own data property without triggering __proto__ setters. */
export function defineOwn(object, key, value) { Object.defineProperty(object, key, { value, enumerable: true, writable: true, configurable: true }); return object; }

/** Parse JSON text with the project's numeric-loss policy. */
const parseCache = new Map();
export function parseJSONText(text) {
  const source = String(text);
  if (parseCache.has(source)) { const hit = parseCache.get(source); parseCache.delete(source); parseCache.set(source, hit); return hit; }
  const data = parseDataJSON(source);
  if (source.length < 200000) { parseCache.set(source, data); if (parseCache.size > 64) parseCache.delete(parseCache.keys().next().value); }
  return data;
}
export function isJSONText(text) { try { parseJSONText(text); return true; } catch { return false; } }

// ---- comparison ------------------------------------------------------------

export function jsonEquals(a, b, depth = 0) {
  if (depth > JSON_LIMITS.depth) throw new RangeError('JSON nesting too deep');
  if (Object.is(a, b)) return true;
  if (a === b) return true; // 0 === -0
  if (typeof a !== typeof b || !isObjectLike(a) || !isObjectLike(b)) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((item, index) => jsonEquals(item, b[index], depth + 1));
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && jsonEquals(a[key], b[key], depth + 1));
}
const rank = value => value === null || value === undefined ? 5 : typeof value === 'number' ? 0 : typeof value === 'string' ? 1 : typeof value === 'boolean' ? 2 : Array.isArray(value) ? 3 : 4;
/** Total order used by JSON.SORT: numbers, text, booleans, arrays, objects, then null. */
export function compareJSON(a, b) {
  const ra = rank(a), rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 0) return a - b;
  if (ra === 1) return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) || (a < b ? -1 : a > b ? 1 : 0);
  if (ra === 2) return Number(a) - Number(b);
  if (ra === 3 || ra === 4) { const x = stringifyJSON(a), y = stringifyJSON(b); return x < y ? -1 : x > y ? 1 : 0; }
  return 0;
}

// ---- paths -----------------------------------------------------------------
// JSONPath-style paths ("a.b[0]", "$.items[*].price", "$..id", "items[?(@.qty>1)]",
// "items[-1]", "items[1:3]", "['odd key']") and RFC 6901 pointers ("/a/0/b").
// A path is definite when it names at most one value; other paths return arrays.

const NAME_STOP = /[.\[]/;
function fail(message) { throw new SyntaxError(`Invalid JSON path: ${message}`); }
function readQuoted(source, start) {
  const quote = source[start]; let out = '', i = start + 1;
  while (i < source.length) {
    const ch = source[i++];
    if (ch === quote) return [out, i];
    if (ch === '\\') {
      const next = source[i++];
      if (next === undefined) break;
      if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(source.slice(i, i + 4))) { out += String.fromCharCode(parseInt(source.slice(i, i + 4), 16)); i += 4; }
      else out += { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' }[next] ?? next;
    } else out += ch;
  }
  fail('unterminated string');
}
function findClosing(source, start) {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"' || ch === "'") { i = readQuoted(source, i)[1] - 1; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (!depth) return i; }
  }
  fail('missing ]');
}
const integerText = /^-?\d+$/;
function parseBracket(content) {
  const text = content.trim();
  if (text === '*') return { t: 'any' };
  if (text.startsWith('?')) { let body = text.slice(1).trim(); if (body.startsWith('(') && body.endsWith(')') && matchingParen(body) === body.length - 1) body = body.slice(1, -1); return { t: 'filter', expr: parseFilter(body) }; }
  // Comma-separated union of indexes or quoted names.
  const parts = []; let i = 0, current = '';
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'") { const [value, next] = readQuoted(text, i); current += JSON.stringify(value); i = next; continue; }
    if (ch === ',') { parts.push(current); current = ''; i++; continue; }
    current += ch; i++;
  }
  parts.push(current);
  const items = parts.map(part => {
    const item = part.trim();
    if (item.startsWith('"')) return { key: JSON.parse(item) };
    if (integerText.test(item)) return { index: Number(item) };
    return null;
  });
  if (items.every(Boolean)) return items.length === 1 ? ('key' in items[0] ? { t: 'key', name: items[0].key } : { t: 'index', i: items[0].index }) : { t: 'union', items };
  const slice = /^(-?\d*)\s*:\s*(-?\d*)(?:\s*:\s*(-?\d*))?$/.exec(text);
  if (slice) return { t: 'slice', start: slice[1] === '' ? null : Number(slice[1]), end: slice[2] === '' ? null : Number(slice[2]), step: slice[3] ? Number(slice[3]) : 1 };
  return fail(`unsupported selector [${text}]`);
}
function matchingParen(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'") { i = readQuoted(text, i)[1] - 1; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') { depth--; if (!depth) return i; }
  }
  return -1;
}
const cache = new Map();
/** Parse a path into tokens. Results are cached because formulas re-use the same strings. */
export function parsePath(path) {
  const source = String(path ?? '');
  const hit = cache.get(source); if (hit) return hit;
  const parsed = parsePathUncached(source);
  cache.set(source, parsed); if (cache.size > 256) cache.delete(cache.keys().next().value);
  return parsed;
}
function parsePathUncached(source) {
  const text = source.trim();
  if (text === '' || text === '$' || text === '@') return { tokens: [], definite: true };
  const tokens = [];
  if (text.startsWith('/')) {
    for (const segment of text.slice(1).split('/')) tokens.push({ t: 'member', name: segment.replaceAll('~1', '/').replaceAll('~0', '~') });
    return { tokens, definite: true };
  }
  let i = text[0] === '$' || text[0] === '@' ? 1 : 0, first = i === 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '.') {
      if (text[i + 1] === '.') { tokens.push({ t: 'descend' }); i += 2; if (text[i] === '[') continue; }
      else i++;
      if (text[i] === '*') { tokens.push({ t: 'any' }); i++; continue; }
      let j = i; while (j < text.length && !NAME_STOP.test(text[j])) j++;
      if (j === i) fail('empty name');
      tokens.push({ t: 'member', name: text.slice(i, j) }); i = j;
    } else if (ch === '[') {
      const end = findClosing(text, i);
      tokens.push(parseBracket(text.slice(i + 1, end))); i = end + 1;
    } else if (first) {
      let j = i; while (j < text.length && !NAME_STOP.test(text[j])) j++;
      tokens.push({ t: 'member', name: text.slice(i, j) }); i = j;
    } else fail(`unexpected "${ch}"`);
    first = false;
  }
  return { tokens, definite: !tokens.some(token => ['any', 'slice', 'union', 'filter', 'descend'].includes(token.t)) };
}

// Filter expressions: @.a > 1 && (@.b == "x" || !@.c)
function tokenizeFilter(source) {
  const tokens = []; let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '"' || ch === "'") { const [value, next] = readQuoted(source, i); tokens.push({ type: 'literal', value }); i = next; continue; }
    const two = source.slice(i, i + 2);
    if (['&&', '||', '==', '!=', '<>', '<=', '>='].includes(two)) { tokens.push({ type: two === '<>' ? '!=' : two }); i += 2; continue; }
    if ('<>()!='.includes(ch)) { tokens.push({ type: ch === '=' ? '==' : ch }); i++; continue; }
    const number = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(i));
    if (number) { tokens.push({ type: 'literal', value: Number(number[0]) }); i += number[0].length; continue; }
    const word = /^(true|false|null)\b/.exec(source.slice(i));
    if (word) { tokens.push({ type: 'literal', value: word[1] === 'null' ? null : word[1] === 'true' }); i += word[1].length; continue; }
    if (ch === '@' || ch === '$') {
      let j = i + 1;
      while (j < source.length) {
        if (source[j] === '.') { j++; if (source[j] === '.') j++; while (j < source.length && !/[\s.\[\]()&|!=<>,]/.test(source[j])) j++; }
        else if (source[j] === '[') j = findClosing(source, j) + 1;
        else break;
      }
      tokens.push({ type: 'path', root: ch, path: parsePath(source.slice(i, j)) }); i = j; continue;
    }
    fail(`unexpected "${ch}" in filter`);
  }
  return tokens;
}
function parseFilter(source) {
  const tokens = tokenizeFilter(source); let position = 0;
  const peek = () => tokens[position], take = () => tokens[position++];
  function or() { let left = and(); while (peek()?.type === '||') { take(); left = { op: '||', left, right: and() }; } return left; }
  function and() { let left = not(); while (peek()?.type === '&&') { take(); left = { op: '&&', left, right: not() }; } return left; }
  function not() { if (peek()?.type === '!') { take(); return { op: '!', operand: not() }; } return compare(); }
  function compare() {
    const left = operand();
    const token = peek();
    if (token && ['==', '!=', '<', '<=', '>', '>='].includes(token.type)) { take(); return { op: token.type, left, right: operand() }; }
    return { op: 'exists', operand: left };
  }
  function operand() {
    const token = take();
    if (!token) fail('incomplete filter');
    if (token.type === '(') { const inner = or(); if (take()?.type !== ')') fail('missing )'); return inner; }
    if (token.type === 'path' || token.type === 'literal') return token;
    return fail('bad filter operand');
  }
  const expression = or();
  if (position < tokens.length) fail('trailing filter text');
  return expression;
}
const MISSING = Symbol('missing');
function operandValue(node, current, root) {
  if (node.type === 'literal') return node.value;
  if (node.type === 'path') { const found = walk(node.root === '@' ? current : root, node.path.tokens, root); return found.length ? found[0] : MISSING; }
  const result = evaluateFilter(node, current, root);
  return result;
}
function evaluateFilter(node, current, root) {
  switch (node.op) {
    case '||': return evaluateFilter(node.left, current, root) || evaluateFilter(node.right, current, root);
    case '&&': return evaluateFilter(node.left, current, root) && evaluateFilter(node.right, current, root);
    case '!': return !evaluateFilter(node.operand, current, root);
    case 'exists': { const value = operandValue(node.operand, current, root); return node.operand.type === 'literal' ? Boolean(value) : value !== MISSING; }
    default: {
      const a = operandValue(node.left, current, root), b = operandValue(node.right, current, root);
      if (a === MISSING || b === MISSING) return node.op === '!=' ? a !== b : false;
      if (node.op === '==') return jsonEquals(a, b);
      if (node.op === '!=') return !jsonEquals(a, b);
      if ((typeof a === 'number' && typeof b === 'number') || (typeof a === 'string' && typeof b === 'string')) return node.op === '<' ? a < b : node.op === '<=' ? a <= b : node.op === '>' ? a > b : a >= b;
      return false;
    }
  }
}
function children(node) { return Array.isArray(node) ? node : isPlainObject(node) ? Object.values(node) : []; }
function descendants(node, out, depth = 0) {
  if (depth > JSON_LIMITS.depth) throw new RangeError('JSON nesting too deep');
  out.push(node);
  for (const child of children(node)) if (isJSONContainer(child)) descendants(child, out, depth + 1);
  return out;
}
const arrayIndex = (array, index) => { const i = index < 0 ? array.length + index : index; return i >= 0 && i < array.length ? i : -1; };
function member(node, name) {
  if (Array.isArray(node)) {
    if (integerText.test(name)) { const i = arrayIndex(node, Number(name)); return i < 0 ? [] : [node[i]]; }
    return name === 'length' ? [node.length] : [];
  }
  if (isPlainObject(node)) return Object.hasOwn(node, name) ? [node[name]] : [];
  return typeof node === 'string' && name === 'length' ? [Array.from(node).length] : [];
}
function sliceIndexes(length, { start, end, step }) {
  step = step || 1;
  const out = [], limit = (value, low, high) => Math.max(low, Math.min(high, value));
  if (step > 0) {
    const from = limit(start == null ? 0 : start < 0 ? length + start : start, 0, length), to = limit(end == null ? length : end < 0 ? length + end : end, 0, length);
    for (let i = from; i < to; i += step) out.push(i);
  } else {
    const from = limit(start == null ? length - 1 : start < 0 ? length + start : start, -1, length - 1), to = limit(end == null ? -1 : end < 0 ? length + end : end, -1, length - 1);
    for (let i = from; i > to; i += step) out.push(i);
  }
  return out;
}
function walk(start, tokens, root) {
  let current = [start], descend = false;
  for (const token of tokens) {
    if (token.t === 'descend') { descend = true; continue; }
    const scope = descend ? current.flatMap(node => descendants(node, [])) : current;
    const next = [];
    for (const node of scope) {
      switch (token.t) {
        case 'member': next.push(...member(node, token.name)); break;
        case 'key': if (isPlainObject(node) && Object.hasOwn(node, token.name)) next.push(node[token.name]); break;
        case 'index': if (Array.isArray(node)) { const i = arrayIndex(node, token.i); if (i >= 0) next.push(node[i]); } break;
        case 'any': next.push(...children(node)); break;
        case 'union': for (const item of token.items) next.push(...('key' in item ? (isPlainObject(node) && Object.hasOwn(node, item.key) ? [node[item.key]] : []) : (Array.isArray(node) && arrayIndex(node, item.index) >= 0 ? [node[arrayIndex(node, item.index)]] : []))); break;
        case 'slice': if (Array.isArray(node)) for (const i of sliceIndexes(node.length, token)) next.push(node[i]); break;
        case 'filter': for (const child of children(node)) if (evaluateFilter(token.expr, child, root)) next.push(child); break;
      }
    }
    current = next; descend = false;
    if (current.length > JSON_LIMITS.cells) throw new RangeError('JSON path matches too many values');
  }
  return current;
}
/** Evaluate a path. Definite paths return {found,value}; others return every match as an array. */
export function queryJSON(root, path) {
  const { tokens, definite } = parsePath(path);
  const matches = walk(root, tokens, root);
  return definite ? { definite, found: matches.length > 0, value: matches[0] } : { definite, found: true, value: matches };
}

function needsDefinite(tokens) {
  if (tokens.some(token => !['member', 'key', 'index'].includes(token.t))) fail('a single location is required (no wildcards, filters or slices)');
}
function copyContainer(node) { return Array.isArray(node) ? node.slice() : { ...node }; }
function setAt(node, tokens, position, value) {
  if (position === tokens.length) return value;
  const token = tokens[position];
  const isIndex = token.t === 'index' || (token.t === 'member' && integerText.test(token.name) && (Array.isArray(node) || node == null));
  if (isIndex) {
    const index = token.t === 'index' ? token.i : Number(token.name);
    if (node != null && !Array.isArray(node)) throw new TypeError('Expected an array');
    const array = node == null ? [] : node.slice();
    const at = index < 0 ? array.length + index : index;
    if (at < 0) throw new RangeError('Array index out of range');
    if (at > JSON_LIMITS.cells) throw new RangeError('Array index too large');
    while (array.length < at) array.push(null);
    array[at] = setAt(array[at], tokens, position + 1, value);
    return array;
  }
  const key = token.name;
  if (node != null && !isPlainObject(node)) throw new TypeError('Expected an object');
  const object = node == null ? {} : copyContainer(node);
  defineOwn(object, key, setAt(Object.hasOwn(object, key) ? object[key] : undefined, tokens, position + 1, value));
  return object;
}
/** Return a copy of root with value stored at a definite path. */
export function setJSON(root, path, value) {
  const { tokens } = parsePath(path); needsDefinite(tokens);
  return setAt(root, tokens, 0, value);
}
function removeAt(node, tokens, position) {
  const token = tokens[position], last = position === tokens.length - 1;
  if (Array.isArray(node)) {
    const index = token.t === 'index' ? token.i : token.t === 'member' && integerText.test(token.name) ? Number(token.name) : null;
    const at = index == null ? -1 : arrayIndex(node, index);
    if (at < 0) return node;
    const copy = node.slice();
    if (last) copy.splice(at, 1); else copy[at] = removeAt(copy[at], tokens, position + 1);
    return copy;
  }
  if (isPlainObject(node)) {
    const key = token.t === 'key' || token.t === 'member' ? token.name : null;
    if (key == null || !Object.hasOwn(node, key)) return node;
    const copy = { ...node };
    if (last) delete copy[key]; else defineOwn(copy, key, removeAt(copy[key], tokens, position + 1));
    return copy;
  }
  return node;
}
/** Return a copy of root without the value at a definite path. */
export function removeJSON(root, path) {
  const { tokens } = parsePath(path); needsDefinite(tokens);
  return tokens.length ? removeAt(root, tokens, 0) : null;
}
/** Deep merge objects; arrays and scalars in the overlay replace the base. */
export function mergeJSON(base, overlay, depth = 0) {
  if (depth > JSON_LIMITS.depth) throw new RangeError('JSON nesting too deep');
  if (!isPlainObject(base) || !isPlainObject(overlay)) return overlay;
  const out = { ...base };
  for (const [key, value] of Object.entries(overlay)) defineOwn(out, key, Object.hasOwn(out, key) ? mergeJSON(out[key], value, depth + 1) : value);
  return out;
}

const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
/** Append one step to a textual path in the same syntax parsePath reads. */
export function joinPath(base, step) {
  if (typeof step === 'number') return `${base}[${step}]`;
  if (identifier.test(step)) return base ? `${base}.${step}` : step;
  return `${base}[${JSON.stringify(step)}]`;
}
/** Every leaf (scalar or empty container) as [path, value] pairs. */
export function flattenJSON(root, maxDepth = JSON_LIMITS.depth) {
  const rows = [];
  (function visit(node, path, depth) {
    const list = Array.isArray(node) ? node.map((item, index) => [index, item]) : isPlainObject(node) ? Object.entries(node) : null;
    if (!list || !list.length || depth >= maxDepth) { rows.push([path, node]); if (rows.length > JSON_LIMITS.cells) throw new RangeError('JSON too large to flatten'); return; }
    for (const [step, child] of list) visit(child, joinPath(path, step), depth + 1);
  })(root, '', 0);
  return rows;
}
export function jsonType(data) {
  return data === null || data === undefined ? 'null' : Array.isArray(data) ? 'array' : typeof data === 'object' ? 'object' : typeof data;
}
