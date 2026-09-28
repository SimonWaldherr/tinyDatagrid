import { formulaNumber, parseNumericValue } from './numeric-values.js';
const isFormulaError = value => typeof value === 'string' && /^#(?:REF!|N\/A|VALUE!|NAME[?!]|NUM!|DIV\/0!|ERROR!|CYCLE!|SPILL!|RANGE!)/.test(value);
const asNumber = formulaNumber;
const flatten = value => Array.isArray(value) ? value.flat(Infinity) : [value];
const normalizedRows = value => Array.isArray(value) ? (Array.isArray(value[0]) ? value : value.map(item => [item])) : [[value]];

function compareValues(left, right) {
  if (left instanceof Date || right instanceof Date) {
    const millis = value => value instanceof Date ? value.getTime() : typeof value === 'string' && /^\d{4}-\d\d-\d\d(?:T.*)?$/.test(value) ? Date.parse(value) : NaN;
    const a = millis(left), b = millis(right);
    if (Number.isFinite(a) && Number.isFinite(b)) return Math.sign(a - b);
  }
  if (typeof left === 'boolean' && typeof right === 'boolean') return Math.sign(Number(left) - Number(right));
  if (typeof left === 'bigint' || typeof right === 'bigint') {
    const toBigInt = value => typeof value === 'bigint' ? value : typeof value === 'number' && Number.isSafeInteger(value) ? BigInt(value) : typeof value === 'string' && /^[+-]?(?:0|[1-9]\d*)$/.test(value.trim()) ? BigInt(value.trim()) : null;
    const a = toBigInt(left), b = toBigInt(right);
    if (a != null && b != null) return a < b ? -1 : a > b ? 1 : 0;
  }
  const padded = value => typeof value === 'string' && /^[-+]?0\d+$/.test(value.trim());
  const lp=parseNumericValue(left),rp=parseNumericValue(right),a=lp.value,b=rp.value;
  const numericLeft = !padded(left) && left !== '' && left != null && lp.numeric && !lp.lossy;
  const numericRight = !padded(right) && right !== '' && right != null && rp.numeric && !rp.lossy;
  if (numericLeft && numericRight) return a<b?-1:a>b?1:0;
  return String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true, sensitivity: 'base' });
}

function wildcardExpression(pattern) {
  let source = '';
  const text = String(pattern ?? '');
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '~' && index + 1 < text.length) source += text[++index].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    else if (char === '*') source += '.*';
    else if (char === '?') source += '.';
    else source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`, 'iu');
}

function matches(value, lookup, wildcard = false) {
  if (wildcard && typeof lookup === 'string' && /[~*?]/.test(lookup)) return wildcardExpression(lookup).test(String(value ?? ''));
  return compareValues(value, lookup) === 0;
}

function findIndex(values, lookup, { matchMode = 0, searchMode = 1, wildcards = false } = {}) {
  const items = values || [], length = items.length;
  if (!length) return -1;
  if (items.some(isFormulaError)) searchMode = 1;
  const wildcard = (matchMode === 2 || wildcards) && typeof lookup === 'string' && /[~*?]/.test(lookup);
  const exactAt = index => !isFormulaError(items[index]) && matches(items[index], lookup, wildcard);
  if (matchMode === 0 || matchMode === 2) {
    if (searchMode === -1) {
      for (let index = length - 1; index >= 0; index--) if (exactAt(index)) return index;
      return -1;
    }
    if ((searchMode === 2 || searchMode === -2) && !wildcard) {
      let low = 0, high = length - 1;
      const direction = searchMode === 2 ? 1 : -1;
      while (low <= high) {
        const middle = (low + high) >> 1, comparison = compareValues(items[middle], lookup) * direction;
        if (comparison === 0) return middle;
        if (comparison < 0) low = middle + 1;
        else high = middle - 1;
      }
      return -1;
    }
    for (let index = 0; index < length; index++) if (exactAt(index)) return index;
    return -1;
  }
  if (matchMode !== -1 && matchMode !== 1) return -1;
  if (searchMode === 2 || searchMode === -2) {
    const direction = searchMode === 2 ? 1 : -1;
    let low = 0, high = length - 1, found = -1;
    while (low <= high) {
      const middle = (low + high) >> 1, comparison = compareValues(items[middle], lookup);
      if (matchMode === -1) {
        if (comparison === 0) return middle;
        if (comparison < 0) { found = middle; if (direction === 1) low = middle + 1; else high = middle - 1; }
        else if (direction === 1) high = middle - 1;
        else low = middle + 1;
      } else {
        if (comparison === 0) return middle;
        if (comparison > 0) { found = middle; if (direction === 1) high = middle - 1; else low = middle + 1; }
        else if (direction === 1) low = middle + 1;
        else high = middle - 1;
      }
    }
    return found;
  }
  let found = -1;
  for (let index = 0; index < length; index++) {
    if (isFormulaError(items[index])) continue;
    const comparison = compareValues(items[index], lookup);
    if (matchMode === -1 && comparison <= 0 && (found < 0 || compareValues(items[index], items[found]) > 0)) found = index;
    if (matchMode === 1 && comparison >= 0 && (found < 0 || compareValues(items[index], items[found]) < 0)) found = index;
  }
  return found;
}

export function createLookupFunctions() {
  const functions = {
    INDEX: (array, row = 1, col = 1) => {
      const rows = normalizedRows(array), rowIndex = Math.trunc(asNumber(row)) - 1, colIndex = Math.trunc(asNumber(col)) - 1;
      return rows[rowIndex]?.[colIndex] ?? '#REF!';
    },
    MATCH: (lookup, array, matchType = 1) => {
      const mode = asNumber(matchType);
      if (![-1, 0, 1].includes(mode)) return '#N/A';
      const index = findIndex(flatten(array), lookup, { matchMode: mode, wildcards: mode === 0 });
      return index < 0 ? '#N/A' : index + 1;
    },
    XMATCH: (lookup, lookupArray, matchMode = 0, searchMode = 1) => {
      const mode = asNumber(matchMode), search = asNumber(searchMode);
      if (![-1, 0, 1, 2].includes(mode) || ![1, -1, 2, -2].includes(search)) return '#VALUE!';
      const index = findIndex(flatten(lookupArray), lookup, { matchMode: mode, searchMode: search });
      return index < 0 ? '#N/A' : index + 1;
    },
    VLOOKUP: (lookup, table, index, rangeLookup = true) => {
      const rows = normalizedRows(table), col = Math.trunc(asNumber(index)) - 1;
      if (col < 0) return '#VALUE!';
      if (rows.some(row => col >= row.length)) return '#REF!';
      const keys = rows.map(row => row[0]), exact = rangeLookup === false || rangeLookup === 0;
      const found = findIndex(keys, lookup, { matchMode: exact ? 0 : -1, wildcards: exact });
      return found < 0 ? '#N/A' : rows[found][col] ?? '#REF!';
    },
    HLOOKUP: (lookup, table, index, rangeLookup = true) => {
      const rows = normalizedRows(table), rowIndex = Math.trunc(asNumber(index)) - 1;
      if (rowIndex < 0) return '#VALUE!';
      if (rowIndex >= rows.length) return '#REF!';
      const keys = rows[0] || [], exact = rangeLookup === false || rangeLookup === 0;
      const found = findIndex(keys, lookup, { matchMode: exact ? 0 : -1, wildcards: exact });
      return found < 0 ? '#N/A' : rows[rowIndex]?.[found] ?? '#REF!';
    },
    XLOOKUP: (lookup, lookupArray, returnArray, ifNotFound = '#N/A', matchMode = 0, searchMode = 1) => {
      const keys = flatten(lookupArray), mode = asNumber(matchMode), search = asNumber(searchMode);
      if (![-1, 0, 1, 2].includes(mode) || ![1, -1, 2, -2].includes(search)) return '#VALUE!';
      const index = findIndex(keys, lookup, { matchMode: mode, searchMode: search });
      if (index < 0) return ifNotFound;
      const rows = normalizedRows(returnArray), flat = flatten(returnArray);
      if (rows.length === keys.length) {
        const row = rows[index];
        return row?.length === 1 ? row[0] ?? '#N/A' : row ?? '#N/A';
      }
      if (rows.length === 1 && rows[0].length === keys.length) return rows[0][index] ?? '#N/A';
      return flat.length === keys.length ? flat[index] ?? '#N/A' : '#VALUE!';
    },
    LOOKUP: (lookup, lookupVector, resultVector) => {
      const keys = flatten(lookupVector), values = resultVector == null ? keys : flatten(resultVector);
      const index = findIndex(keys, lookup, { matchMode: -1 });
      return index < 0 ? '#N/A' : values[index] ?? '#N/A';
    }
  };
  functions.SVERWEIS = (...args) => functions.VLOOKUP(...args);
  functions.XVERWEIS = (...args) => functions.XLOOKUP(...args);
  functions.WVERWEIS = (...args) => functions.HLOOKUP(...args);
  functions.VERGLEICH = (...args) => functions.MATCH(...args);
  functions.VERWEIS = (...args) => functions.LOOKUP(...args);
  return functions;
}
