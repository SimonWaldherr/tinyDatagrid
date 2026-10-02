import { FormulaError } from "./formula-errors.js";
import { formulaNumber } from "./numeric-values.js";
// Text formulas use scalar text and Unicode code points for slicing/padding.
// Regex patterns/flags follow JavaScript RegExp; patterns are never JavaScript code.
const MAX_TEXT = 1_000_000;
const MAX_PARTS = 100_000;
function text(value) {
  if (value == null) return "";
  if (!["string", "number", "boolean", "bigint"].includes(typeof value))
    throw new TypeError("Expected scalar text");
  return String(value);
}
function integer(value) {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim()))
    throw new TypeError("Expected integer");
  const n = formulaNumber(value);
  if (!Number.isSafeInteger(n)) throw new RangeError("Expected safe integer");
  return n;
}
function count(value) {
  const n = integer(value);
  if (n < 0 || n > MAX_TEXT) throw new RangeError("Invalid length");
  return n;
}
function checked(min, max, fn) {
  return (...args) => {
    if (args.length < min || args.length > max)
      return new FormulaError("#VALUE!");
    try {
      return fn(...args);
    } catch (error) {
      return error instanceof RangeError
        ? new FormulaError("#NUM!")
        : new FormulaError("#VALUE!");
    }
  };
}
function trim(value, characters, side) {
  const source = text(value);
  if (characters === undefined)
    return side === "left"
      ? source.trimStart()
      : side === "right"
        ? source.trimEnd()
        : source.trim();
  const chars = new Set(Array.from(text(characters))),
    input = Array.from(source);
  let start = 0,
    end = input.length;
  if (side !== "right") while (start < end && chars.has(input[start])) start++;
  if (side !== "left") while (end > start && chars.has(input[end - 1])) end--;
  return input.slice(start, end).join("");
}
function substr(value, start, length) {
  const chars = Array.from(text(value)),
    position = integer(start);
  if (!position) throw new RangeError("Positions are one-based");
  const offset =
    position < 0 ? Math.max(0, chars.length + position) : position - 1;
  return chars
    .slice(offset, length === undefined ? undefined : offset + count(length))
    .join("");
}
function pad(value, length, fill, left) {
  const source = Array.from(text(value)),
    target = count(length),
    padding = Array.from(text(fill));
  const missing = target - source.length;
  if (missing <= 0 || !padding.length) return source.join("");
  const extra = Array.from(
    { length: missing },
    (_, i) => padding[i % padding.length],
  ).join("");
  return left ? extra + source.join("") : source.join("") + extra;
}
function regex(pattern, flags) {
  return new RegExp(text(pattern), text(flags));
}
function split(value, delimiter) {
  const source = text(value),
    separator = text(delimiter);
  const parts =
    separator === ""
      ? Array.from(source)
      : source.split(separator, MAX_PARTS + 1);
  if (parts.length > MAX_PARTS) throw new RangeError("Too many parts");
  return [parts];
}
function replaceAll(value, search, replacement) {
  const source = text(value),
    needle = text(search),
    next = text(replacement);
  if (!needle) throw new TypeError("Empty search");
  // Callback gives literal replacement semantics, including dollar signs.
  let size = source.length,
    offset = 0;
  while ((offset = source.indexOf(needle, offset)) >= 0) {
    size += next.length - needle.length;
    if (size > MAX_TEXT) throw new RangeError("Result too long");
    offset += needle.length;
  }
  return source.replaceAll(needle, () => next);
}
export function createTextFunctions() {
  const functions = {
    LTRIM: checked(1, 2, (value, chars) => trim(value, chars, "left")),
    ENCODEURL: checked(1, 1, (value) => encodeURIComponent(text(value))),
    DECODEURL: checked(1, 1, (value) => decodeURIComponent(text(value))),
    RTRIM: checked(1, 2, (value, chars) => trim(value, chars, "right")),
    TRIM: checked(1, 2, (value, chars) => trim(value, chars, "both")),
    SQUEEZE: checked(1, 1, (value) => text(value).trim().replace(/\s+/gu, " ")),
    SUBSTR: checked(2, 3, substr),
    REVERSE: checked(1, 1, (value) =>
      Array.from(text(value)).reverse().join(""),
    ),
    REPEAT: checked(2, 2, (value, times) => {
      const source = text(value),
        n = count(times);
      if (source.length * n > MAX_TEXT) throw new RangeError("Result too long");
      return source.repeat(n);
    }),
    STARTSWITH: checked(2, 2, (value, prefix) =>
      text(value).startsWith(text(prefix)),
    ),
    ENDSWITH: checked(2, 2, (value, suffix) =>
      text(value).endsWith(text(suffix)),
    ),
    CONTAINS: checked(2, 2, (value, search) =>
      text(value).includes(text(search)),
    ),
    SPLIT: checked(2, 2, split),
    REPLACEALL: checked(3, 3, replaceAll),
    PADSTART: checked(2, 3, (value, length, fill = " ") =>
      pad(value, length, fill, true),
    ),
    PADEND: checked(2, 3, (value, length, fill = " ") =>
      pad(value, length, fill, false),
    ),
    REGEXP: checked(2, 3, (value, pattern, flags = "u") =>
      regex(pattern, flags).test(text(value)),
    ),
    REGEXP_EXTRACT: checked(2, 4, (value, pattern, group = 0, flags = "u") => {
      const index = count(group),
        match = regex(pattern, flags).exec(text(value));
      if (!match) return new FormulaError("#N/A");
      if (index >= match.length) throw new RangeError("Unknown capture group");
      return match[index] ?? "";
    }),
    REGEXP_REPLACE: checked(
      3,
      4,
      (value, pattern, replacement, flags = "gu") => {
        const source = text(value),
          result = source.replace(regex(pattern, flags), text(replacement));
        if (result.length > MAX_TEXT) throw new RangeError("Result too long");
        return result;
      },
    ),
    REGEXP_SPLIT: checked(2, 3, (value, pattern, flags = "u") => {
      const parts = text(value).split(regex(pattern, flags), MAX_PARTS + 1);
      if (parts.length > MAX_PARTS) throw new RangeError("Too many parts");
      return [parts.map((part) => part ?? "")];
    }),
  };
  return functions;
}
