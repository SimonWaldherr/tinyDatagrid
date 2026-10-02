import { DecimalValue, decimalOperation } from "./decimal-values.js";
// Calendar dates travel between timezones as calendar components, not midnight
// timestamps. Clock times and durations cannot be mistaken for day fractions.
const pad = (n) => String(n).padStart(2, "0");
export class CalendarDate extends Date {
  constructor(year, month, day) {
    super(0);
    this.setHours(0, 0, 0, 0);
    this.setFullYear(year, month - 1, day);
    if (
      ![year, month, day].every(Number.isSafeInteger) ||
      this.getFullYear() !== year ||
      this.getMonth() + 1 !== month ||
      this.getDate() !== day
    )
      throw new TypeError("Invalid calendar date");
  }
  static parse(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    if (!match) throw new TypeError("Expected YYYY-MM-DD");
    return new CalendarDate(...match.slice(1).map(Number));
  }
  calendarText() {
    return `${String(this.getFullYear()).padStart(4, "0")}-${pad(this.getMonth() + 1)}-${pad(this.getDate())}`;
  }
  toJSON() {
    return { $tinyDatagridType: "calendar-date", value: this.calendarText() };
  }
}
export class ClockTime {
  constructor(seconds) {
    if (
      typeof seconds !== "number" ||
      !Number.isFinite(seconds) ||
      seconds < 0 ||
      seconds >= 86400
    )
      throw new TypeError("Invalid clock time");
    const value = decimalOperation("*", DecimalValue.parse(seconds), 1000);
    if (value.scale)
      throw new TypeError("Clock times support millisecond precision");
    this.milliseconds = Number(value.coefficient);
    this.seconds = seconds;
    Object.freeze(this);
  }
  toString() {
    const s = Math.floor(this.milliseconds / 1000),
      fraction = this.milliseconds % 1000;
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}${fraction ? "." + String(fraction).padStart(3, "0").replace(/0+$/, "") : ""}`;
  }
  toJSON() {
    return { $tinyDatagridType: "time", seconds: this.seconds };
  }
}
export class DurationValue {
  constructor(seconds) {
    if (
      typeof seconds !== "number" ||
      !Number.isFinite(seconds) ||
      Math.abs(seconds) > Number.MAX_SAFE_INTEGER
    )
      throw new TypeError("Invalid duration");
    this.seconds = seconds;
    Object.freeze(this);
  }
  toString() {
    return `${this.seconds}s`;
  }
  toJSON() {
    return { $tinyDatagridType: "duration", seconds: this.seconds };
  }
}
