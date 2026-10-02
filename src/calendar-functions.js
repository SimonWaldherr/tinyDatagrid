import { FormulaError } from "./formula-errors.js";
import { CalendarDate, ClockTime, DurationValue } from "./temporal-values.js";
import { calendarUnit } from "./formula-options.js";
import { formulaNumber } from "./numeric-values.js";

const DAY = 86400000;
const flat = (value) => (Array.isArray(value) ? value.flat(Infinity) : [value]);
function number(value) {
  if (!["number", "string", "bigint"].includes(typeof value) || value === "")
    throw new TypeError("Expected number");
  const n = formulaNumber(value);
  if (!Number.isFinite(n)) throw new RangeError("Expected finite number");
  return n;
}
function integer(value) {
  const n = number(value);
  if (!Number.isSafeInteger(n)) throw new RangeError("Expected integer");
  return n;
}
function makeDate(year, month, day) {
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  if (!Number.isFinite(date.getTime()))
    throw new RangeError("Date outside supported range");
  return new CalendarDate(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
}
// Calendar dates use the same local calendar as the existing DATE/YEAR/TODAY.
// Civil-day arithmetic goes through UTC components, never through DST hours.
function date(value) {
  if (value instanceof Date && Number.isFinite(value.getTime()))
    return new Date(value);
  if (typeof value !== "string")
    throw new TypeError("Expected Date or ISO date");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const [y, m, d] = match.slice(1).map(Number),
      result = makeDate(y, m, d);
    if (
      result.getFullYear() !== y ||
      result.getMonth() + 1 !== m ||
      result.getDate() !== d
    )
      throw new TypeError("Invalid calendar date");
    return result;
  }
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  )
    throw new TypeError("Expected ISO date or timestamp with timezone");
  date(value.slice(0, 10));
  const clock = /T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (+clock[1] > 23 || +clock[2] > 59 || +(clock[3] || 0) > 59)
    throw new TypeError("Invalid timestamp time");
  const result = new Date(value);
  if (!Number.isFinite(result.getTime()))
    throw new TypeError("Invalid timestamp");
  return result;
}
function serial(value) {
  const d = date(value),
    utc = new Date(0);
  utc.setUTCFullYear(d.getFullYear(), d.getMonth(), d.getDate());
  utc.setUTCHours(0, 0, 0, 0);
  return utc.getTime() / DAY;
}
function fromSerial(value) {
  const d = new Date(value * DAY);
  return makeDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
const weekday = (day) => (((day + 3) % 7) + 7) % 7; // Monday = 0.
function monthShift(value, months, end = false) {
  const start = date(value),
    n = integer(months);
  const first = makeDate(start.getFullYear(), start.getMonth() + 1 + n, 1),
    last = makeDate(first.getFullYear(), first.getMonth() + 2, 0);
  return makeDate(
    first.getFullYear(),
    first.getMonth() + 1,
    end ? last.getDate() : Math.min(start.getDate(), last.getDate()),
  );
}
function weekend(value = 1) {
  if (typeof value === "string" && /^[01]{7}$/.test(value)) {
    if (value === "1111111") throw new RangeError("All days are weekends");
    return [...value].map((v) => v === "1");
  }
  const code = integer(value),
    days = Array(7).fill(false);
  if (code >= 1 && code <= 7) {
    const first = (code + 4) % 7;
    days[first] = days[(first + 1) % 7] = true;
  } else if (code >= 11 && code <= 17) days[(code + 2) % 7] = true;
  else throw new RangeError("Invalid weekend");
  return days;
}
function holidays(value = []) {
  const list = flat(value).filter((v) => v !== "" && v != null);
  if (list.length > 10000) throw new RangeError("Too many holidays");
  return new Set(list.map(serial));
}
function networkDays(start, end, week = 1, days = []) {
  let a = serial(start),
    b = serial(end),
    sign = 1;
  if (a > b) {
    [a, b] = [b, a];
    sign = -1;
  }
  const excluded = weekend(week),
    holiday = holidays(days),
    length = b - a + 1;
  let count = Math.floor(length / 7) * (7 - excluded.filter(Boolean).length);
  for (let i = 0; i < length % 7; i++) if (!excluded[weekday(a + i)]) count++;
  for (const day of holiday)
    if (day >= a && day <= b && !excluded[weekday(day)]) count--;
  return count * sign;
}
function workday(start, count, week = 1, days = []) {
  let day = serial(start),
    remaining = Math.abs(integer(count));
  if (remaining > 100000) throw new RangeError("At most 100,000 workdays");
  const direction = number(count) < 0 ? -1 : 1,
    excluded = weekend(week),
    holiday = holidays(days);
  while (remaining) {
    day += direction;
    if (!excluded[weekday(day)] && !holiday.has(day)) remaining--;
  }
  return fromSerial(day);
}
function isoWeek(value) {
  const day = serial(value),
    thursday = day + 3 - weekday(day),
    year = new Date(thursday * DAY).getUTCFullYear();
  const jan4 = serial(makeDate(year, 1, 4)),
    firstThursday = jan4 + 3 - weekday(jan4);
  return { week: Math.round((thursday - firstThursday) / 7) + 1, year };
}
function time(value) {
  if (value instanceof ClockTime) return value.seconds;
  if (
    typeof value === "number" ||
    typeof value === "bigint" ||
    value instanceof DurationValue
  )
    throw new TypeError("Expected clock time, not number or duration");
  if (typeof value === "string") {
    const parts = /^(\d{1,2}):(\d{2})(?::(\d{2}(?:\.\d{1,3})?))?$/.exec(value);
    if (parts) {
      const [h, m, s] = [+parts[1], +parts[2], +(parts[3] || 0)];
      if (h > 23 || m > 59 || s >= 60) throw new TypeError("Invalid time");
      return h * 3600 + m * 60 + s;
    }
  }
  const d = date(value);
  return (
    d.getHours() * 3600 +
    d.getMinutes() * 60 +
    d.getSeconds() +
    d.getMilliseconds() / 1000
  );
}
const pad = (n) => String(n).padStart(2, "0");
function duration(seconds) {
  const n = number(
      seconds instanceof DurationValue ? seconds.seconds : seconds,
    ),
    s = Math.round(Math.abs(n));
  return `${n < 0 ? "-" : ""}${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
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
export function createCalendarFunctions(now = () => new Date()) {
  return {
    TODAY: checked(0, 0, () => {
      const d = now();
      return makeDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }),
    NOW: checked(0, 0, now),
    DATE: checked(3, 3, (year, month, day) => {
      const [y, m, d] = [year, month, day].map(integer),
        result = makeDate(y, m, d);
      if (
        result.getFullYear() !== y ||
        result.getMonth() + 1 !== m ||
        result.getDate() !== d
      )
        throw new TypeError("Invalid calendar date");
      return result;
    }),
    DATEVALUE: checked(1, 1, date),
    YEAR: checked(1, 1, (value) => date(value).getFullYear()),
    MONTH: checked(1, 1, (value) => date(value).getMonth() + 1),
    DAY: checked(1, 1, (value) => date(value).getDate()),
    DAYS: checked(2, 2, (end, start) => serial(end) - serial(start)),
    "DATE.SEQUENCE": checked(2, 4, (start, count, unit = "day", step = 1) => {
      const value = date(start),
        n = integer(count),
        stride = integer(step),
        period = calendarUnit(unit);
      if (n < 0 || n > 100000) throw new RangeError("At most 100,000 dates");
      if (!stride || !["day", "week", "month", "year"].includes(period))
        throw new TypeError("Invalid date sequence");
      return n
        ? Array.from({ length: n }, (_, i) => {
            const offset = i * stride;
            if (!Number.isSafeInteger(offset))
              throw new RangeError("Date overflow");
            return [
              period === "month" || period === "year"
                ? monthShift(value, offset * (period === "year" ? 12 : 1))
                : fromSerial(
                    serial(value) + offset * (period === "week" ? 7 : 1),
                  ),
            ];
          })
        : "";
    }),
    EDATE: checked(2, 2, (d, m) => monthShift(d, m)),
    EOMONTH: checked(2, 2, (d, m) => monthShift(d, m, true)),
    WEEKDAY: checked(1, 2, (d, type = 1) => {
      const w = weekday(serial(d)),
        n = integer(type);
      if (n === 1) return ((w + 1) % 7) + 1;
      if (n === 2) return w + 1;
      if (n === 3) return w;
      if (n >= 11 && n <= 17) return ((w - (n - 11) + 7) % 7) + 1;
      throw new RangeError("Invalid weekday type");
    }),
    WEEKNUM: checked(1, 2, (d, type = 1) => {
      const n = integer(type);
      if (n === 21) return isoWeek(d).week;
      if (n !== 1 && n !== 2) throw new RangeError("Use 1, 2 or 21");
      const value = date(d),
        first = serial(makeDate(value.getFullYear(), 1, 1));
      return (
        Math.floor(
          (serial(value) -
            first +
            (n === 1 ? (weekday(first) + 1) % 7 : weekday(first))) /
            7,
        ) + 1
      );
    }),
    ISOWEEKNUM: checked(1, 1, (d) => isoWeek(d).week),
    "DATE.ISOWEEKYEAR": checked(1, 1, (d) => isoWeek(d).year),
    DATEDIF: checked(3, 3, (a, b, unit) => {
      const start = date(a),
        end = date(b),
        days = serial(end) - serial(start);
      if (days < 0) throw new RangeError("End precedes start");
      const months =
        (end.getFullYear() - start.getFullYear()) * 12 +
        end.getMonth() -
        start.getMonth() -
        (end.getDate() < start.getDate() ? 1 : 0);
      switch (String(unit).toUpperCase()) {
        case "D":
          return days;
        case "M":
          return months;
        case "Y":
          return Math.floor(months / 12);
        case "YM":
          return months % 12;
        default:
          throw new TypeError("Use D, M, Y or YM");
      }
    }),
    NETWORKDAYS: checked(2, 3, (a, b, h = []) => networkDays(a, b, 1, h)),
    "NETWORKDAYS.INTL": checked(2, 4, networkDays),
    WORKDAY: checked(2, 3, (d, n, h = []) => workday(d, n, 1, h)),
    "WORKDAY.INTL": checked(2, 4, workday),
    "DATE.ADD": checked(2, 3, (value, amount, unit = "day") => {
      const n = integer(amount),
        u = calendarUnit(unit);
      if (u === "month" || u === "year")
        return monthShift(value, n * (u === "year" ? 12 : 1));
      if (u === "day" || u === "week")
        return fromSerial(serial(value) + n * (u === "week" ? 7 : 1));
      throw new TypeError("Unknown calendar unit");
    }),
    "DATE.DIFF": checked(2, 3, (start, end, unit = "day") => {
      const u = calendarUnit(unit);
      if (u === "day") return serial(end) - serial(start);
      const scale = {
        hour: 3600000,
        minute: 60000,
        second: 1000,
        millisecond: 1,
      }[u];
      if (!scale) throw new TypeError("Unknown elapsed unit");
      return (date(end) - date(start)) / scale;
    }),
    "DATE.ISO": checked(1, 1, (value) => {
      const d = date(value);
      return `${String(d.getFullYear()).padStart(4, "0")}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }),
    "DATE.FORMAT": checked(
      1,
      3,
      (value, pattern = "YYYY-MM-DD", zone = "local") => {
        const d = date(value),
          z = String(zone);
        if (z !== "local" && z !== "UTC")
          throw new TypeError("Use local or UTC");
        const p = z === "UTC" ? "getUTC" : "get";
        const tokens = {
          YYYY: String(d[p + "FullYear"]()).padStart(4, "0"),
          MM: pad(d[p + "Month"]() + 1),
          DD: pad(d[p + "Date"]()),
          HH: pad(d[p + "Hours"]()),
          mm: pad(d[p + "Minutes"]()),
          ss: pad(d[p + "Seconds"]()),
        };
        return String(pattern).replace(
          /\[([^\]]*)\]|YYYY|MM|DD|HH|mm|ss/g,
          (token, literal) => literal ?? tokens[token],
        );
      },
    ),
    "DATE.TIMESTAMP": checked(1, 1, (value) => date(value).getTime() / 1000),
    "DATE.FROMTIMESTAMP": checked(1, 1, (value) => {
      const d = new Date(number(value) * 1000);
      if (!Number.isFinite(d.getTime()))
        throw new RangeError("Timestamp outside range");
      return d;
    }),
    "DATE.ISLEAP": checked(1, 1, (y) => {
      const n = integer(y);
      return n % 4 === 0 && (n % 100 !== 0 || n % 400 === 0);
    }),
    TIME: checked(3, 3, (h, m, s) => {
      const parts = [h, m, s].map(number);
      if (
        !Number.isInteger(parts[0]) ||
        !Number.isInteger(parts[1]) ||
        parts[0] < 0 ||
        parts[0] > 23 ||
        parts[1] < 0 ||
        parts[1] > 59 ||
        parts[2] < 0 ||
        parts[2] >= 60
      )
        throw new RangeError("Invalid time components");
      return new ClockTime(parts[0] * 3600 + parts[1] * 60 + parts[2]);
    }),
    TIMEVALUE: checked(1, 1, (value) => new ClockTime(time(value))),
    HOUR: checked(1, 1, (t) => (Math.floor(time(t) + 1e-7) / 3600) | 0),
    MINUTE: checked(1, 1, (t) => ((Math.floor(time(t) + 1e-7) / 60) % 60) | 0),
    SECOND: checked(1, 1, (t) => Math.floor(time(t) + 1e-7) % 60),
    "TIME.FORMAT": checked(1, 1, (t) => duration(Math.round(time(t)) % 86400)),
    "TIME.ADD": checked(2, 3, (t, n, unit = "hour") => {
      const scale = { hour: 3600, minute: 60, second: 1 }[calendarUnit(unit)];
      if (!scale) throw new TypeError("Unknown time unit");
      const seconds = time(t) + number(n) * scale;
      return new ClockTime(((seconds % 86400) + 86400) % 86400);
    }),
    "DURATION.FORMAT": checked(1, 1, duration),
    "DURATION.CREATE": checked(1, 2, (amount, unit = "second") => {
      const scale = { hour: 3600, minute: 60, second: 1, millisecond: 0.001 }[
        calendarUnit(unit)
      ];
      if (!scale) throw new TypeError("Expected fixed duration unit");
      return new DurationValue(number(amount) * scale);
    }),
    "DURATION.SECONDS": checked(1, 1, (value) => {
      if (!(value instanceof DurationValue))
        throw new TypeError("Expected duration");
      return value.seconds;
    }),
  };
}
