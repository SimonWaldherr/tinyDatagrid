import { scalarKind, compareScalars } from "./scalar-comparison.js";
import { FormulaError, isFormulaError } from "./formula-errors.js";
import { DecimalValue, compareDecimals } from "./decimal-values.js";
import { formulaNumber, parseNumericValue } from "./numeric-values.js";
import { flattenValues, rowsOf } from "./json-values.js";
const asNumber = formulaNumber;
const flatten = flattenValues;
const normalizedRows = rowsOf;

const empty = (value) => value === "" || value == null;
const kind = scalarKind;
function compareValues(left, right) {
  const result = compareScalars(left, right);
  if (result === null) return kind(left) < kind(right) ? -1 : 1;
  return result;
}
function position(value) {
  const n = asNumber(value);
  if (!Number.isSafeInteger(n) || n < 1)
    throw new TypeError("Expected positive one-based integer");
  return n;
}
function rectangle(value) {
  const rows = normalizedRows(value);
  if (
    !rows.length ||
    !rows[0]?.length ||
    rows.some((row) => row.length !== rows[0].length)
  )
    throw new TypeError("Expected rectangular table");
  return rows;
}
function wildcardExpression(pattern) {
  let source = "";
  const text = String(pattern ?? "");
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === "~" && index + 1 < text.length)
      source += text[++index].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    else if (char === "*") source += ".*";
    else if (char === "?") source += ".";
    else source += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}$`, "u");
}

function matches(value, lookup, wildcard = false) {
  if (wildcard && typeof lookup === "string" && /[~*?]/.test(lookup))
    return typeof value === "string" && wildcardExpression(lookup).test(value);
  return (
    !empty(value) &&
    !empty(lookup) &&
    kind(value) === kind(lookup) &&
    compareValues(value, lookup) === 0
  );
}

function findIndex(
  values,
  lookup,
  { matchMode = 0, searchMode = 1, wildcards = false } = {},
) {
  const items = values || [],
    length = items.length;
  if (!length || empty(lookup)) return -1;
  if (searchMode === 2 || searchMode === -2) {
    const direction = searchMode === 2 ? 1 : -1;
    if (
      items.some(
        (value) =>
          empty(value) || isFormulaError(value) || kind(value) !== kind(lookup),
      ) ||
      items.some(
        (value, index) =>
          index && compareValues(items[index - 1], value) * direction > 0,
      )
    )
      throw new TypeError(
        "Binary search requires correctly sorted, consistently typed keys",
      );
  }
  if (matchMode === -1 || matchMode === 1) {
    if (
      items.some(
        (value) =>
          !empty(value) &&
          !isFormulaError(value) &&
          kind(value) !== kind(lookup),
      )
    )
      throw new TypeError(
        "Approximate search requires consistently typed keys",
      );
  }
  if (items.some(isFormulaError)) searchMode = 1;
  const wildcard =
    (matchMode === 2 || wildcards) &&
    typeof lookup === "string" &&
    /[~*?]/.test(lookup);
  const exactAt = (index) =>
    !isFormulaError(items[index]) && matches(items[index], lookup, wildcard);
  if (matchMode === 0 || matchMode === 2) {
    if (searchMode === -1) {
      for (let index = length - 1; index >= 0; index--)
        if (exactAt(index)) return index;
      return -1;
    }
    if ((searchMode === 2 || searchMode === -2) && !wildcard) {
      let low = 0,
        high = length - 1;
      const direction = searchMode === 2 ? 1 : -1;
      while (low <= high) {
        const middle = (low + high) >> 1,
          comparison = compareValues(items[middle], lookup) * direction;
        if (comparison === 0) return middle;
        if (comparison < 0) low = middle + 1;
        else high = middle - 1;
      }
      return -1;
    }
    for (let index = 0; index < length; index++)
      if (exactAt(index)) return index;
    return -1;
  }
  if (matchMode !== -1 && matchMode !== 1) return -1;
  if (searchMode === 2 || searchMode === -2) {
    const direction = searchMode === 2 ? 1 : -1;
    let low = 0,
      high = length - 1,
      found = -1;
    while (low <= high) {
      const middle = (low + high) >> 1,
        comparison = compareValues(items[middle], lookup);
      if (matchMode === -1) {
        if (comparison === 0) return middle;
        if (comparison < 0) {
          found = middle;
          if (direction === 1) low = middle + 1;
          else high = middle - 1;
        } else if (direction === 1) high = middle - 1;
        else low = middle + 1;
      } else {
        if (comparison === 0) return middle;
        if (comparison > 0) {
          found = middle;
          if (direction === 1) high = middle - 1;
          else low = middle + 1;
        } else if (direction === 1) low = middle + 1;
        else high = middle - 1;
      }
    }
    return found;
  }
  let found = -1;
  for (let index = 0; index < length; index++) {
    if (isFormulaError(items[index]) || empty(items[index])) continue;
    const comparison = compareValues(items[index], lookup);
    if (
      matchMode === -1 &&
      comparison <= 0 &&
      (found < 0 || compareValues(items[index], items[found]) > 0)
    )
      found = index;
    if (
      matchMode === 1 &&
      comparison >= 0 &&
      (found < 0 || compareValues(items[index], items[found]) < 0)
    )
      found = index;
  }
  return found;
}

export function createLookupFunctions() {
  const functions = {
    INDEX: (array, row = 1, col = 1) => {
      const rows = normalizedRows(array),
        rowIndex = position(row) - 1,
        colIndex = position(col) - 1;
      return rows[rowIndex]?.[colIndex] ?? new FormulaError("#REF!");
    },
    MATCH: (lookup, array, matchType = 0) => {
      const mode = asNumber(matchType);
      if (![-1, 0, 1].includes(mode)) return new FormulaError("#N/A");
      const index = findIndex(flatten(array), lookup, {
        matchMode: mode,
        wildcards: false,
      });
      return index < 0 ? new FormulaError("#N/A") : index + 1;
    },
    XMATCH: (lookup, lookupArray, matchMode = 0, searchMode = 1) => {
      const mode = asNumber(matchMode),
        search = asNumber(searchMode);
      if (![-1, 0, 1, 2].includes(mode) || ![1, -1, 2, -2].includes(search))
        return new FormulaError("#VALUE!");
      const index = findIndex(flatten(lookupArray), lookup, {
        matchMode: mode,
        searchMode: search,
      });
      return index < 0 ? new FormulaError("#N/A") : index + 1;
    },
    VLOOKUP: (lookup, table, index, rangeLookup = false) => {
      const rows = rectangle(table),
        col = position(index) - 1;
      if (typeof rangeLookup !== "boolean") return new FormulaError("#VALUE!");
      if (col < 0) return new FormulaError("#VALUE!");
      if (rows.some((row) => col >= row.length))
        return new FormulaError("#REF!");
      const keys = rows.map((row) => row[0]),
        exact = rangeLookup === false || rangeLookup === 0;
      const found = findIndex(keys, lookup, {
        matchMode: exact ? 0 : -1,
        wildcards: false,
      });
      return found < 0
        ? new FormulaError("#N/A")
        : (rows[found][col] ?? new FormulaError("#REF!"));
    },
    HLOOKUP: (lookup, table, index, rangeLookup = false) => {
      const rows = rectangle(table),
        rowIndex = position(index) - 1;
      if (typeof rangeLookup !== "boolean") return new FormulaError("#VALUE!");
      if (rowIndex < 0) return new FormulaError("#VALUE!");
      if (rowIndex >= rows.length) return new FormulaError("#REF!");
      const keys = rows[0] || [],
        exact = rangeLookup === false || rangeLookup === 0;
      const found = findIndex(keys, lookup, {
        matchMode: exact ? 0 : -1,
        wildcards: false,
      });
      return found < 0
        ? new FormulaError("#N/A")
        : (rows[rowIndex]?.[found] ?? new FormulaError("#REF!"));
    },
    XLOOKUP: (
      lookup,
      lookupArray,
      returnArray,
      ifNotFound = new FormulaError("#N/A"),
      matchMode = 0,
      searchMode = 1,
    ) => {
      const keys = flatten(lookupArray),
        mode = asNumber(matchMode),
        search = asNumber(searchMode);
      if (![-1, 0, 1, 2].includes(mode) || ![1, -1, 2, -2].includes(search))
        return new FormulaError("#VALUE!");
      const index = findIndex(keys, lookup, {
        matchMode: mode,
        searchMode: search,
      });
      const rows = rectangle(returnArray),
        flat = flatten(returnArray);
      const valid =
        rows.length === keys.length ||
        (rows.length === 1 && rows[0].length === keys.length);
      if (!valid) return new FormulaError("#VALUE!");
      if (index < 0) return ifNotFound;
      if (rows.length === keys.length) {
        const row = rows[index];
        return row?.length === 1
          ? (row[0] ?? new FormulaError("#N/A"))
          : (row ?? new FormulaError("#N/A"));
      }
      if (rows.length === 1 && rows[0].length === keys.length)
        return rows[0][index] ?? new FormulaError("#N/A");
      return flat.length === keys.length
        ? (flat[index] ?? new FormulaError("#N/A"))
        : new FormulaError("#VALUE!");
    },
    LOOKUP: (lookup, lookupVector, resultVector) => {
      const keys = flatten(lookupVector),
        values = resultVector == null ? keys : flatten(resultVector);
      if (values.length !== keys.length) return new FormulaError("#VALUE!");
      const index = findIndex(keys, lookup, { matchMode: 0 });
      return index < 0
        ? new FormulaError("#N/A")
        : (values[index] ?? new FormulaError("#N/A"));
    },
  };
  return functions;
}
