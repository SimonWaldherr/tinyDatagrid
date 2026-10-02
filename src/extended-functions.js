import { FormulaError } from "./formula-errors.js";
import { formulaNumber } from "./numeric-values.js";
// Synchronous, dependency-free formula extensions. Angles in GEO are degrees;
// GEOM uses Cartesian coordinates. See docs/functions.md for signatures.
const radians = (degrees) => (degrees * Math.PI) / 180;
const degrees = (radians) => (radians * 180) / Math.PI;
const wrap = (angle) => ((angle % 360) + 360) % 360;
const number = (value) => {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim()))
    throw new TypeError("Expected a number");
  const result = formulaNumber(value);
  if (Number.isNaN(result)) throw new TypeError("Expected numeric text");
  if (!Number.isFinite(result))
    throw new RangeError("Expected a finite number");
  return result;
};
const nonnegative = (value) => {
  const n = number(value);
  if (n < 0) throw new RangeError("Negative size");
  return n;
};
const integer = (value) => {
  const n = number(value);
  if (!Number.isSafeInteger(n)) throw new RangeError("Expected a safe integer");
  return n;
};
const text = (value) => {
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "boolean"
  )
    throw new TypeError("Expected scalar text");
  return String(value);
};
const unitScale = (unit) => {
  const units = { m: 1, km: 1000, mi: 1609.344, nmi: 1852 },
    key = String(unit).toLowerCase();
  const scale = Object.hasOwn(units, key) ? units[key] : null;
  if (!scale) throw new TypeError("Unknown distance unit");
  return scale;
};
const earthRadius = 6371008.8;
function position(lat, lon) {
  lat = number(lat);
  lon = number(lon);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180)
    throw new RangeError("Invalid coordinates");
  return [radians(lat), radians(lon)];
}
function distance(lat1, lon1, lat2, lon2, unit = "km") {
  const [a, b] = position(lat1, lon1),
    [c, d] = position(lat2, lon2);
  const h =
    Math.sin((c - a) / 2) ** 2 +
    Math.cos(a) * Math.cos(c) * Math.sin((d - b) / 2) ** 2;
  return (
    (2 * earthRadius * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))))) /
    unitScale(unit)
  );
}
function bearing(lat1, lon1, lat2, lon2) {
  const [a, b] = position(lat1, lon1),
    [c, d] = position(lat2, lon2);
  const y = Math.sin(d - b) * Math.cos(c),
    x = Math.cos(a) * Math.sin(c) - Math.sin(a) * Math.cos(c) * Math.cos(d - b);
  if (Math.hypot(x, y) < 1e-15) throw new RangeError("Bearing is undefined");
  return wrap(degrees(Math.atan2(y, x)));
}
function destination(lat, lon, heading, length, unit = "km") {
  const [a, b] = position(lat, lon),
    theta = radians(number(heading)),
    delta = (nonnegative(length) * unitScale(unit)) / earthRadius;
  const p = Math.asin(
    Math.max(
      -1,
      Math.min(
        1,
        Math.sin(a) * Math.cos(delta) +
          Math.cos(a) * Math.sin(delta) * Math.cos(theta),
      ),
    ),
  );
  const q =
    b +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(a),
      Math.cos(delta) - Math.sin(a) * Math.sin(p),
    );
  return [[degrees(p), wrap(degrees(q) + 180) - 180]];
}
function points(range) {
  if (
    !Array.isArray(range) ||
    range.length < 3 ||
    range.some((row) => !Array.isArray(row) || row.length !== 2)
  )
    throw new TypeError("Expected at least three [x,y] rows");
  return range.map((row) => row.map(number));
}
function polygonArea(range) {
  const p = points(range),
    [ox, oy] = p[0];
  // Translate to the first vertex to reduce cancellation for large coordinates.
  return (
    Math.abs(
      p.reduce((sum, [x, y], i) => {
        const [u, v] = p[(i + 1) % p.length];
        return sum + (x - ox) * (v - oy) - (u - ox) * (y - oy);
      }, 0),
    ) / 2
  );
}
const bytes = (value) => new TextEncoder().encode(text(value));
function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (const byte of bytes(value)) hash = Math.imul(hash ^ byte, 0x01000193);
  return hash >>> 0;
}
const hex = (n) => (n >>> 0).toString(16).padStart(8, "0");
function crc32(value) {
  let crc = 0xffffffff;
  for (const byte of bytes(value)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return hex(crc ^ 0xffffffff);
}
// SHA-256 compression and padding, FIPS 180-4 sections 5 and 6.2.
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
const rotr = (n, bits) => (n >>> bits) | (n << (32 - bits));
function sha256(value) {
  const input = bytes(value),
    length = Math.ceil((input.length + 9) / 64) * 64;
  const data = new Uint8Array(length);
  data.set(input);
  data[input.length] = 0x80;
  const view = new DataView(data.buffer),
    bitLength = input.length * 8;
  view.setUint32(length - 8, Math.floor(bitLength / 4294967296));
  view.setUint32(length - 4, bitLength >>> 0);
  const hash = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
      0x1f83d9ab, 0x5be0cd19,
    ],
    w = new Uint32Array(64);
  for (let offset = 0; offset < length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15],
        b = w[i - 2];
      w[i] =
        w[i - 16] +
        (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) +
        w[i - 7] +
        (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10));
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i++) {
      const t1 =
        (h +
          (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) +
          ((e & f) ^ (~e & g)) +
          K[i] +
          w[i]) |
        0;
      const t2 =
        ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) +
          ((a & b) ^ (a & c) ^ (b & c))) |
        0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    [a, b, c, d, e, f, g, h].forEach((n, i) => {
      hash[i] = (hash[i] + n) | 0;
    });
  }
  return hash.map(hex).join("");
}
function randomWords(size) {
  if (!globalThis.crypto?.getRandomValues)
    throw new Error("Randomness unavailable");
  return globalThis.crypto.getRandomValues(new Uint32Array(size));
}
function random() {
  const [a, b] = randomWords(2);
  return ((a >>> 5) * 67108864 + (b >>> 6)) / 9007199254740992;
}
function randomInt(min, max) {
  min = integer(min);
  max = integer(max);
  const span = max - min + 1;
  if (span < 1 || span > 4294967296)
    throw new RangeError("Invalid integer interval");
  const limit = Math.floor(4294967296 / span) * span;
  let word;
  do {
    word = randomWords(1)[0];
  } while (word >= limit);
  return min + (word % span);
}
function seeded(seed, index = 0) {
  index = integer(index);
  if (index < 0) throw new RangeError("Negative sequence index");
  // A pure indexed generator: order of formula evaluation cannot affect results.
  let n = fnv1a(JSON.stringify([text(seed), index]));
  n ^= n >>> 16;
  n = Math.imul(n, 0x21f0aaad);
  n ^= n >>> 15;
  n = Math.imul(n, 0x735a2d97);
  n ^= n >>> 15;
  return (n >>> 0) / 4294967296;
}
function uuid() {
  const data = new Uint8Array(randomWords(4).buffer);
  data[6] = (data[6] & 15) | 64;
  data[8] = (data[8] & 63) | 128;
  const h = Array.from(data, (n) => n.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function checked(min, max, fn) {
  return (...args) => {
    if (args.length < min || args.length > max)
      return new FormulaError("#VALUE!");
    try {
      const value = fn(...args);
      if (
        (Array.isArray(value) ? value.flat(Infinity) : [value]).some(
          (n) => typeof n === "number" && !Number.isFinite(n),
        )
      )
        return new FormulaError("#NUM!");
      return value;
    } catch (error) {
      return error instanceof RangeError
        ? new FormulaError("#NUM!")
        : error instanceof TypeError
          ? new FormulaError("#VALUE!")
          : new FormulaError("#ERROR!");
    }
  };
}
export function createExtendedFunctions() {
  const functions = {
    "GEO.DISTANCE": checked(4, 5, distance),
    "GEO.BEARING": checked(4, 4, bearing),
    "GEO.DESTINATION": checked(4, 5, destination),
    "GEOM.DISTANCE": checked(4, 4, (x1, y1, x2, y2) =>
      Math.hypot(number(x2) - number(x1), number(y2) - number(y1)),
    ),
    "GEOM.CIRCLE.AREA": checked(1, 1, (r) => Math.PI * nonnegative(r) ** 2),
    "GEOM.CIRCLE.CIRCUMFERENCE": checked(
      1,
      1,
      (r) => 2 * Math.PI * nonnegative(r),
    ),
    "GEOM.RECTANGLE.AREA": checked(
      2,
      2,
      (w, h) => nonnegative(w) * nonnegative(h),
    ),
    "GEOM.TRIANGLE.AREA": checked(
      2,
      2,
      (base, height) => (nonnegative(base) * nonnegative(height)) / 2,
    ),
    "GEOM.SPHERE.VOLUME": checked(
      1,
      1,
      (r) => (4 / 3) * Math.PI * nonnegative(r) ** 3,
    ),
    "GEOM.SPHERE.AREA": checked(1, 1, (r) => 4 * Math.PI * nonnegative(r) ** 2),
    "GEOM.POLYGON.AREA": checked(1, 1, polygonArea),
    "GEOM.POLYGON.PERIMETER": checked(1, 1, (range) => {
      const p = points(range);
      return p.reduce((sum, [x, y], i) => {
        const [u, v] = p[(i + 1) % p.length];
        return sum + Math.hypot(u - x, v - y);
      }, 0);
    }),
    "HASH.SHA256": checked(1, 1, sha256),
    "HASH.FNV1A": checked(1, 1, (value) => hex(fnv1a(value))),
    "HASH.CRC32": checked(1, 1, crc32),
    RANDOM: checked(0, 0, random),
    "RANDOM.INT": checked(2, 2, randomInt),
    "RANDOM.SEEDED": checked(1, 2, seeded),
    "RANDOM.NORMAL": checked(
      0,
      2,
      (mean = 0, deviation = 1) =>
        number(mean) +
        nonnegative(deviation) *
          Math.sqrt(-2 * Math.log(1 - random())) *
          Math.cos(2 * Math.PI * random()),
    ),
    "RANDOM.UUID": checked(0, 0, uuid),
    RADIANS: checked(1, 1, (n) => radians(number(n))),
    DEGREES: checked(1, 1, (n) => degrees(number(n))),
    ATAN2: checked(2, 2, (y, x) => Math.atan2(number(y), number(x))),
    HYPOT: checked(1, 256, (...ns) => Math.hypot(...ns.map(number))),
  };
  for (const name of ["sin", "cos", "tan", "asin", "acos", "atan"])
    functions[name.toUpperCase()] = checked(1, 1, (n) => Math[name](number(n)));
  return functions;
}
