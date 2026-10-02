import { FormulaError } from "./formula-errors.js";
import { DecimalValue } from "./decimal-values.js";
// One conversion policy for cell inference and formula arithmetic. Decimal
// round trips detect discarded input digits; this is not decimal arithmetic.
const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
function decimalKey(text) {
  const [mantissa, exponent = "0"] = text.toLowerCase().split("e");
  const negative = mantissa.startsWith("-"),
    unsigned = mantissa.replace(/^[+-]/, "");
  let digits = unsigned.replace(".", "").replace(/^0+/, ""),
    scale = Number(exponent) - (unsigned.split(".")[1]?.length || 0);
  if (!digits) return "0";
  while (digits.endsWith("0")) {
    digits = digits.slice(0, -1);
    scale++;
  }
  return `${negative ? "-" : ""}${digits}e${scale}`;
}
export function parseNumericValue(input) {
  const text = String(input).trim();
  if (!numeric.test(text)) return { value: input, numeric: false };
  if (/^[+-]?\d+$/.test(text)) {
    const exact = BigInt(text);
    return {
      value:
        exact >= BigInt(Number.MIN_SAFE_INTEGER) &&
        exact <= BigInt(Number.MAX_SAFE_INTEGER)
          ? Number(exact)
          : exact,
      numeric: true,
    };
  }
  const value = Number(text);
  if (
    !Number.isFinite(value) ||
    (Number.isInteger(value) && !Number.isSafeInteger(value)) ||
    decimalKey(text) !== decimalKey(String(value))
  )
    return { value: input, numeric: true, lossy: true };
  return { value, numeric: true };
}
export function formulaNumber(value) {
  if (value instanceof DecimalValue) return value.toNumber();
  if (value == null || value === "" || typeof value === "boolean")
    throw new TypeError(
      "Expected number; use explicit conversion for blanks and booleans",
    );
  if (typeof value === "string" && /^[+-]?0\d/.test(value.trim()))
    throw new TypeError(
      "Zero-padded identifier requires explicit VALUE conversion",
    );
  const parsed =
    typeof value === "string"
      ? parseNumericValue(value)
      : {
          value,
          numeric: typeof value === "number" || typeof value === "bigint",
        };
  if (!parsed.numeric) throw new TypeError("Expected numeric value");
  if (parsed.lossy)
    throw new RangeError("Numeric conversion would lose precision");
  const result = Number(parsed.value);
  if (
    !Number.isFinite(result) ||
    (Number.isInteger(result) && !Number.isSafeInteger(result))
  )
    throw new RangeError("Numeric conversion would lose precision");
  return result;
}
export function checkedResult(value) {
  if (Array.isArray(value)) return value.map(checkedResult);
  if (
    typeof value === "number" &&
    (!Number.isFinite(value) ||
      (Number.isInteger(value) && !Number.isSafeInteger(value)))
  )
    return new FormulaError("#NUM!");
  return value;
}

// JSON.parse would already discard digits before inference can inspect them.
// Require strings/tagged BigInts for numbers outside the safe Number domain.
export function parseDataJSON(text) {
  for (const token of String(text).matchAll(
    /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
  )) {
    if (!token[0].startsWith('"')) formulaNumber(token[0]);
  }
  return JSON.parse(text);
}
