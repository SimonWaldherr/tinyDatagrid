import { FormulaError } from './formula-errors.js';
import { parseNumericValue } from './numeric-values.js';
import {
  JSON_LIMITS, JSONValue, isPlainObject, defineOwn, fromJSONData, toJSONData, parseJSONText, isJSONText, stringifyJSON,
  queryJSON, setJSON, removeJSON, mergeJSON, flattenJSON, jsonEquals, compareJSON, jsonType
} from './json-values.js';

// JSON.* formulas. Text is parsed on demand (JSON typed in a cell is already a JSONValue),
// results that are objects or arrays stay JSON, and tabular results are ranges.
class NotFound extends Error {}
function checked(min, max, fn) {
  return (...args) => {
    if (args.length < min || args.length > max) return new FormulaError('#VALUE!');
    try { return fn(...args); }
    catch (error) {
      if (error instanceof NotFound) return new FormulaError('#N/A');
      if (error instanceof RangeError) return new FormulaError('#NUM!');
      if (error instanceof SyntaxError) return `#VALUE! ${String(error.message).slice(0, 140)}`;
      return new FormulaError('#VALUE!');
    }
  };
}
const flattenRange = value => Array.isArray(value) ? value.flat(Infinity) : [value];
const normalizedRows = value => Array.isArray(value) ? (Array.isArray(value[0]) ? value : value.map(item => [item])) : [[value]];
const blank = value => value === undefined || value === null || value === '';
function truthy(value, fallback) {
  if (blank(value)) return fallback;
  return typeof value === 'string' ? !/^(false|0|no|nein|off)$/i.test(value.trim()) : Boolean(value);
}
function integer(value, fallback) {
  if (blank(value)) return fallback;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) throw new TypeError('Expected a number');
  return Math.trunc(n);
}
/** Accept JSON values, JSON text, or ordinary values; returns plain JSON data. */
function input(value, { allowBlank = false } = {}) {
  if (value instanceof JSONValue) return value.value;
  if (blank(value)) { if (allowBlank) return null; throw new TypeError('Expected JSON'); }
  if (typeof value === 'string') return parseJSONText(value);
  return toJSONData(value);
}
const pathText = path => typeof path === 'number' ? `[${path}]` : blank(path) ? '' : String(path);
function resolve(json, path) {
  const result = queryJSON(input(json), pathText(path));
  if (!result.found) throw new NotFound();
  return result.value;
}
const elements = data => Array.isArray(data) ? data : isPlainObject(data) ? Object.values(data) : (() => { throw new TypeError('Expected a JSON array or object'); })();
const cell = data => data === null || data === undefined ? '' : fromJSONData(data);
function labelKey(value) {
  if (blank(value)) throw new TypeError('JSON keys cannot be blank');
  if (typeof value === 'object') throw new TypeError('JSON keys must be text');
  return String(value);
}
function looseEquals(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a === 'object' || typeof b === 'object') return typeof a === typeof b && jsonEquals(a, b);
  if (typeof a === 'boolean' || typeof b === 'boolean') return false;
  if (typeof a === 'string' && typeof b === 'string') return a.toLocaleLowerCase() === b.toLocaleLowerCase();
  const pa = parseNumericValue(a), pb = parseNumericValue(b);
  return pa.numeric && pb.numeric && !pa.lossy && !pb.lossy && pa.value == pb.value;
}
function columnList(value) {
  if (blank(value)) return null;
  const raw = value instanceof JSONValue ? (value.isArray ? value.value : null) : Array.isArray(value) ? flattenRange(value) : typeof value === 'string' && value.includes(',') ? value.split(',') : [value];
  if (!raw) throw new TypeError('Expected column names');
  const names = raw.map(item => String(item ?? '').trim()).filter(Boolean);
  return names.length ? names : null;
}
function valueAt(item, name) {
  if (isPlainObject(item) && Object.hasOwn(item, name)) return item[name];
  const found = queryJSON(item, name);
  return found.found ? found.value : undefined;
}
function flattenObject(object, prefix, out, depth = 0) {
  for (const [key, value] of Object.entries(object)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value) && Object.keys(value).length && depth < JSON_LIMITS.depth) flattenObject(value, name, out, depth + 1);
    else out.set(name, value);
  }
  return out;
}
function tableFrom(data, { columns, header, flatten }) {
  let rows;
  if (Array.isArray(data)) rows = data;
  else if (isPlainObject(data)) return [...(header ? [['key', 'value']] : []), ...Object.entries(data).map(([key, value]) => [key, cell(value)])];
  else return [[cell(data)]];
  if (rows.length * Math.max(1, columns?.length ?? 1) > JSON_LIMITS.cells) throw new RangeError('JSON table too large');
  const objects = rows.some(isPlainObject);
  if (!objects && !columns) {
    const arrays = rows.some(Array.isArray);
    if (!arrays) return [...(header ? [['value']] : []), ...rows.map(item => [cell(item)])];
    const width = Math.max(0, ...rows.map(item => Array.isArray(item) ? item.length : 1));
    return rows.map(item => Array.from({ length: width }, (_, index) => Array.isArray(item) ? cell(item[index]) : index ? '' : cell(item)));
  }
  const flat = rows.map(item => isPlainObject(item) ? (flatten ? flattenObject(item, '', new Map()) : new Map(Object.entries(item))) : new Map([['value', item]]));
  const names = columns ?? [...new Set(flat.flatMap(map => [...map.keys()]))];
  if (rows.length * names.length > JSON_LIMITS.cells) throw new RangeError('JSON table too large');
  const body = rows.map((item, index) => names.map(name => {
    if (flat[index].has(name)) return cell(flat[index].get(name));
    if (!columns) return '';
    return cell(valueAt(item, name));
  }));
  return header ? [names.slice(), ...body] : body;
}
function recordsFrom(range, header) {
  const rows = normalizedRows(range);
  if (!header) return rows.map(row => row.map(value => toJSONData(value)));
  if (!rows.length) return [];
  const seen = new Map();
  const keys = rows[0].map((value, index) => {
    let key = blank(value) ? `column${index + 1}` : String(value);
    const count = seen.get(key) ?? 0; seen.set(key, count + 1);
    return count ? `${key}_${count + 1}` : key;
  });
  return rows.slice(1).filter(row => row.some(value => !blank(value))).map(row => {
    const record = {};
    keys.forEach((key, index) => defineOwn(record, key, toJSONData(row[index])));
    return record;
  });
}
function sortedBy(list, path, direction) {
  const key = item => { if (blank(path)) return item; const found = queryJSON(item, pathText(path)); return found.found ? found.value : null; };
  return list.map((item, index) => ({ item, index, key: key(item) })).sort((a, b) => {
    const an = a.key === null || a.key === undefined, bn = b.key === null || b.key === undefined;
    if (an || bn) return an === bn ? a.index - b.index : an ? 1 : -1;
    return compareJSON(a.key, b.key) * direction || a.index - b.index;
  }).map(entry => entry.item);
}

export function createJsonFunctions() {
  return {
    'JSON.PARSE': checked(1, 1, text => {
      if (text instanceof JSONValue) return text;
      if (typeof text !== 'string') throw new TypeError('Expected JSON text');
      return cell(parseJSONText(text));
    }),
    'JSON.STRINGIFY': checked(1, 2, (value, indent) => {
      let space;
      if (typeof indent === 'string' && indent && Number.isNaN(Number(indent))) space = indent.slice(0, 10);
      else { const n = integer(indent, 0); space = n > 0 ? Math.min(10, n) : undefined; }
      return stringifyJSON(value === '' ? '' : toJSONData(value), space);
    }),
    'JSON.VALID': checked(1, 1, value => value instanceof JSONValue ? true : typeof value === 'string' ? isJSONText(value) : false),
    'JSON.TYPE': checked(1, 2, (value, path) => {
      if (value instanceof JSONValue || (typeof value === 'string' && path !== undefined)) return jsonType(resolve(value, path));
      if (blank(value)) return 'null';
      if (typeof value === 'bigint') return 'number';
      return jsonType(toJSONData(value));
    }),
    'JSON.GET': checked(2, 3, (json, path, ...fallback) => {
      const result = queryJSON(input(json), pathText(path));
      if (!result.found) { if (fallback.length) return fallback[0]; throw new NotFound(); }
      return cell(result.value);
    }),
    'JSON.HAS': checked(2, 2, (json, path) => {
      const result = queryJSON(input(json), pathText(path));
      return result.definite ? result.found : result.value.length > 0;
    }),
    'JSON.KEYS': checked(1, 2, (json, path) => {
      const data = blank(path) ? input(json) : resolve(json, path);
      if (Array.isArray(data)) return data.map((_, index) => [index]);
      if (isPlainObject(data)) return Object.keys(data).map(key => [key]);
      throw new TypeError('Expected a JSON array or object');
    }),
    'JSON.VALUES': checked(1, 2, (json, path) => elements(blank(path) ? input(json) : resolve(json, path)).map(value => [cell(value)])),
    'JSON.ENTRIES': checked(1, 2, (json, path) => {
      const data = blank(path) ? input(json) : resolve(json, path);
      if (Array.isArray(data)) return data.map((value, index) => [index, cell(value)]);
      if (isPlainObject(data)) return Object.entries(data).map(([key, value]) => [key, cell(value)]);
      throw new TypeError('Expected a JSON array or object');
    }),
    'JSON.LENGTH': checked(1, 2, (json, path) => {
      const data = blank(path) ? (json instanceof JSONValue ? json.value : typeof json === 'string' && isJSONText(json) ? parseJSONText(json) : json) : resolve(json, path);
      if (Array.isArray(data)) return data.length;
      if (isPlainObject(data)) return Object.keys(data).length;
      if (typeof data === 'string') return Array.from(data).length;
      throw new TypeError('Expected JSON text, an array or an object');
    }),
    'JSON.SET': checked(3, 128, (json, ...pairs) => {
      if (pairs.length % 2) throw new TypeError('JSON.SET expects path/value pairs');
      let data = input(json, { allowBlank: true });
      for (let i = 0; i < pairs.length; i += 2) data = setJSON(data, pathText(pairs[i]), toJSONData(pairs[i + 1]));
      return cell(data);
    }),
    'JSON.REMOVE': checked(2, 128, (json, ...paths) => {
      let data = input(json);
      for (const path of paths) data = removeJSON(data, pathText(path));
      return cell(data);
    }),
    'JSON.MERGE': checked(1, 128, (...items) => cell(items.filter(item => !blank(item)).map(item => input(item)).reduce((base, overlay) => mergeJSON(base, overlay), {}))),
    'JSON.OBJECT': checked(1, 256, (...args) => {
      const object = {};
      if (args.length === 1 && Array.isArray(args[0])) {
        for (const row of normalizedRows(args[0])) { if (row.length < 2) throw new TypeError('Expected key/value rows'); defineOwn(object, labelKey(row[0]), toJSONData(row[1])); }
      } else if (args.length === 2 && Array.isArray(args[0]) && Array.isArray(args[1])) {
        const keys = flattenRange(args[0]), values = flattenRange(args[1]);
        if (keys.length !== values.length) throw new TypeError('Keys and values need the same length');
        keys.forEach((key, index) => defineOwn(object, labelKey(key), toJSONData(values[index])));
      } else {
        if (args.length % 2) throw new TypeError('JSON.OBJECT expects key/value pairs');
        for (let i = 0; i < args.length; i += 2) defineOwn(object, labelKey(args[i]), toJSONData(args[i + 1]));
      }
      return new JSONValue(object);
    }),
    'JSON.ARRAY': checked(0, 256, (...args) => new JSONValue(args.flatMap(flattenRange).map(item => toJSONData(item)))),
    'JSON.CONCAT': checked(1, 256, (...args) => new JSONValue(args.flatMap(arg => {
      if (Array.isArray(arg)) return flattenRange(arg).map(item => toJSONData(item));
      if (arg instanceof JSONValue) return arg.isArray ? arg.value : [arg.value];
      if (typeof arg === 'string') { try { const parsed = parseJSONText(arg); if (Array.isArray(parsed)) return parsed; } catch { /* plain text element */ } }
      return [toJSONData(arg)];
    }))),
    'JSON.LOOKUP': checked(3, 5, (lookup, json, keyPath, resultPath, ...rest) => {
      const needle = toJSONData(lookup);
      for (const item of elements(input(json))) {
        const key = blank(keyPath) ? { found: true, value: item } : queryJSON(item, pathText(keyPath));
        if (!key.found || !looseEquals(key.value, needle)) continue;
        if (blank(resultPath)) return cell(item);
        const result = queryJSON(item, pathText(resultPath));
        if (result.found) return cell(result.value);
        break;
      }
      if (rest.length) return rest[0];
      throw new NotFound();
    }),
    'JSON.SORT': checked(1, 3, (json, path, order) => {
      const list = input(json);
      if (!Array.isArray(list)) throw new TypeError('Expected a JSON array');
      return new JSONValue(sortedBy(list, path, integer(order, 1) < 0 ? -1 : 1));
    }),
    'JSON.UNIQUE': checked(1, 2, (json, path) => {
      const list = input(json);
      if (!Array.isArray(list)) throw new TypeError('Expected a JSON array');
      const seen = [], out = [];
      for (const item of list) {
        const key = blank(path) ? item : (() => { const found = queryJSON(item, pathText(path)); return found.found ? found.value : null; })();
        if (seen.some(other => jsonEquals(other, key))) continue;
        seen.push(key); out.push(item);
      }
      return new JSONValue(out);
    }),
    'JSON.TABLE': checked(1, 4, (json, columns, header, flatten) => tableFrom(input(json), { columns: columnList(columns), header: truthy(header, true), flatten: truthy(flatten, false) })),
    'JSON.FROMTABLE': checked(1, 2, (range, header) => new JSONValue(recordsFrom(range, truthy(header, true)))),
    'JSON.FLATTEN': checked(1, 2, (json, maxDepth) => flattenJSON(input(json), integer(maxDepth, JSON_LIMITS.depth)).map(([path, value]) => [path, cell(value)]))
  };
}
