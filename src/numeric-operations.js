import { formulaNumber } from "./numeric-values.js";
import {
  DecimalValue,
  decimalOperation,
  compactDecimal,
  compareDecimals,
  exactDivide,
  divideDecimal,
  roundDecimal,
} from "./decimal-values.js";
import { FormulaError } from "./formula-errors.js";
const blank = (value) => value === "" || value == null;
export function numericOperand(value) {
  if (value instanceof DecimalValue || typeof value === "bigint") return value;
  return formulaNumber(value);
}
export function arithmetic(op, a, b) {
  return compactDecimal(
    decimalOperation(op, numericOperand(a), numericOperand(b)),
  );
}
// Ordinary division retains terminating decimals exactly and rounds recurring
// decimals to 34 significant digits (half even). No binary intermediate is used.
export function divideNumbers(a, b) {
  a = DecimalValue.parse(numericOperand(a));
  b = DecimalValue.parse(numericOperand(b));
  if (!b.coefficient) return new FormulaError("#DIV/0!");
  try {
    return compactDecimal(exactDivide(a, b));
  } catch (error) {
    if (!error.message.startsWith("Repeating decimal:")) throw error;
    const x = (a.coefficient < 0n ? -a.coefficient : a.coefficient).toString();
    const y = (b.coefficient < 0n ? -b.coefficient : b.coefficient).toString();
    let order = x.length - y.length;
    if (
      order >= 0
        ? BigInt(x) < BigInt(y) * 10n ** BigInt(order)
        : BigInt(x) * 10n ** BigInt(-order) < BigInt(y)
    )
      order--;
    order += b.scale - a.scale;
    const places = 33 - order;
    // divideDecimal accepts decimal places; scale large quotients before rounding.
    if (places >= 0)
      return compactDecimal(divideDecimal(a, b, places, "half-even"));
    const scaled = new DecimalValue(
      b.coefficient * 10n ** BigInt(-places),
      b.scale,
    );
    const rounded = divideDecimal(a, scaled, 0, "half-even");
    return compactDecimal(
      new DecimalValue(rounded.coefficient * 10n ** BigInt(-places)),
    );
  }
}
export function powerNumbers(a, b) {
  a = numericOperand(a);
  const exponent = DecimalValue.parse(numericOperand(b));
  if (exponent.scale)
    return formulaNumber(Math.pow(formulaNumber(a), formulaNumber(b)));
  let power = exponent.coefficient,
    result = 1;
  const negative = power < 0n;
  if (negative) power = -power;
  // A result cannot exceed the DecimalValue digit budget; repeated squaring
  // reaches that bound without a loop proportional to the exponent.
  while (power) {
    if (power & 1n) result = arithmetic("*", result, a);
    power >>= 1n;
    if (power) a = arithmetic("*", a, a);
  }
  return negative ? divideNumbers(1, result) : result;
}
export function sqrtNumber(input) {
  const value = DecimalValue.parse(numericOperand(input));
  if (value.coefficient < 0n) return new FormulaError("#NUM!");
  if (!value.coefficient) return 0;
  const isqrt = (n) => {
    if (n < 2n) return n;
    let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
    for (;;) {
      const next = (x + n / x) / 2n;
      if (next >= x) return x;
      x = next;
    }
  };
  const square = value.scale % 2 ? value.coefficient * 10n : value.coefficient;
  const exact = isqrt(square);
  if (exact * exact === square)
    return compactDecimal(new DecimalValue(exact, Math.ceil(value.scale / 2)));
  const order = Math.floor(
    (value.coefficient.toString().length - 1 - value.scale) / 2,
  );
  const places = 33 - order,
    shift = 2 * places - value.scale;
  const numerator = value.coefficient * (shift > 0 ? 10n ** BigInt(shift) : 1n);
  const denominator = shift < 0 ? 10n ** BigInt(-shift) : 1n;
  let root = isqrt(numerator / denominator);
  const midpoint = (2n * root + 1n) ** 2n * denominator;
  if (4n * numerator > midpoint || (4n * numerator === midpoint && root % 2n))
    root++;
  return compactDecimal(
    places >= 0
      ? new DecimalValue(root, places)
      : new DecimalValue(root * 10n ** BigInt(-places)),
  );
}
export function floorNumber(value, ceiling = false) {
  value = DecimalValue.parse(numericOperand(value));
  const truncated = roundDecimal(value, 0, "toward-zero");
  return compactDecimal(
    compareDecimals(value, truncated) === 0
      ? truncated
      : ceiling && value.coefficient > 0n
        ? arithmetic("+", truncated, 1)
        : !ceiling && value.coefficient < 0n
          ? arithmetic("-", truncated, 1)
          : truncated,
  );
}
export function sumNumbers(values) {
  return values
    .filter((value) => !blank(value))
    .reduce((sum, value) => arithmetic("+", sum, value), 0);
}
export function meanNumbers(values) {
  const items = values.filter((value) => !blank(value));
  return items.length
    ? divideNumbers(sumNumbers(items), items.length)
    : new FormulaError("#N/A");
}
export function numericExtreme(values, maximum) {
  const items = values.filter((value) => !blank(value)).map(numericOperand);
  return items.length
    ? items.reduce((a, b) =>
        compareDecimals(a, b) * (maximum ? 1 : -1) >= 0 ? a : b,
      )
    : new FormulaError("#N/A");
}
export const numericCount = (values) =>
  values.filter(
    (value) =>
      (typeof value === "number" && Number.isFinite(value)) ||
      typeof value === "bigint" ||
      value instanceof DecimalValue,
  ).length;
