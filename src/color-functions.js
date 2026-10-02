import { FormulaError } from "./formula-errors.js";
import { formulaNumber } from "./numeric-values.js";
function number(value) {
  if (!["number", "string", "bigint"].includes(typeof value) || value === "")
    throw new TypeError("Expected number");
  const n = formulaNumber(value);
  if (!Number.isFinite(n)) throw new RangeError("Expected finite number");
  return n;
}
function bounded(value, min, max) {
  const n = number(value);
  if (n < min || n > max) throw new RangeError("Color component outside range");
  return n;
}
const hex = (channels) =>
  "#" +
  channels.map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");
function rgb(value) {
  if (typeof value !== "string" || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value))
    throw new TypeError("Expected #RGB or #RRGGBB");
  const s =
    value.length === 4
      ? [...value.slice(1)].map((c) => c + c).join("")
      : value.slice(1);
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
}
function hsl(h, s, l) {
  h = (((number(h) % 360) + 360) % 360) / 360;
  s = bounded(s, 0, 100) / 100;
  l = bounded(l, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s,
    x = chroma * (1 - Math.abs(((h * 6) % 2) - 1)),
    m = l - chroma / 2;
  const colors = [
    [chroma, x, 0],
    [x, chroma, 0],
    [0, chroma, x],
    [0, x, chroma],
    [x, 0, chroma],
    [chroma, 0, x],
  ];
  return hex(colors[Math.floor(h * 6)].map((n) => (n + m) * 255));
}
function toHsl(color) {
  const [r, g, b] = rgb(color).map((n) => n / 255),
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min,
    l = (max + min) / 2;
  let h = 0;
  if (delta)
    h =
      60 *
      (max === r
        ? ((g - b) / delta) % 6
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4);
  return [
    ((h % 360) + 360) % 360,
    delta ? (delta / (1 - Math.abs(2 * l - 1))) * 100 : 0,
    l * 100,
  ];
}
function luminance(color) {
  const values = rgb(color)
    .map((n) => n / 255)
    .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
function contrast(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function mix(a, b, weight = 0.5) {
  const t = bounded(weight, 0, 1),
    x = rgb(a),
    y = rgb(b);
  return hex(x.map((n, i) => n + (y[i] - n) * t));
}
function checked(min, max, fn) {
  return (...args) => {
    if (args.length < min || args.length > max)
      return new FormulaError("#VALUE!");
    try {
      return fn(...args);
    } catch (e) {
      return e instanceof RangeError
        ? new FormulaError("#NUM!")
        : new FormulaError("#VALUE!");
    }
  };
}
export function createColorFunctions() {
  return {
    "COLOR.RGB": checked(3, 3, (r, g, b) =>
      hex([r, g, b].map((n) => bounded(n, 0, 255))),
    ),
    "COLOR.HSL": checked(3, 3, hsl),
    "COLOR.HEX": checked(1, 1, (c) => hex(rgb(c))),
    "COLOR.RED": checked(1, 1, (c) => rgb(c)[0]),
    "COLOR.GREEN": checked(1, 1, (c) => rgb(c)[1]),
    "COLOR.BLUE": checked(1, 1, (c) => rgb(c)[2]),
    "COLOR.HUE": checked(1, 1, (c) => toHsl(c)[0]),
    "COLOR.SATURATION": checked(1, 1, (c) => toHsl(c)[1]),
    "COLOR.LIGHTNESS": checked(1, 1, (c) => toHsl(c)[2]),
    "COLOR.MIX": checked(2, 3, mix),
    "COLOR.LIGHTEN": checked(2, 2, (c, t) => mix(c, "#ffffff", t)),
    "COLOR.DARKEN": checked(2, 2, (c, t) => mix(c, "#000000", t)),
    "COLOR.INVERT": checked(1, 1, (c) => hex(rgb(c).map((n) => 255 - n))),
    "COLOR.COMPLEMENT": checked(1, 1, (c) => {
      const [h, s, l] = toHsl(c);
      return hsl(h + 180, s, l);
    }),
    "COLOR.LUMINANCE": checked(1, 1, luminance),
    "COLOR.CONTRAST": checked(2, 2, contrast),
    "COLOR.TEXT": checked(1, 1, (c) =>
      contrast(c, "#000000") >= contrast(c, "#ffffff") ? "#000000" : "#ffffff",
    ),
    "COLOR.PALETTE": checked(3, 3, (a, b, count) => {
      const n = number(count);
      if (!Number.isInteger(n) || n < 2 || n > 256)
        throw new RangeError("Use 2–256 colors");
      return Array.from({ length: n }, (_, i) => [mix(a, b, i / (n - 1))]);
    }),
  };
}
