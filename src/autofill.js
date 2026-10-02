import { CalendarDate } from './temporal-values.js';
const DAY_MS = 86_400_000;
const modulo = (value, length) => ((value % length) + length) % length;
const isEmpty = value => value == null || value === '';

function normalizeName(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.\s]/g, '').toLocaleLowerCase();
}

function preserveCase(value, template) {
  const text = String(value), sample = String(template);
  if (sample === sample.toLocaleUpperCase()) return text.toLocaleUpperCase();
  if (sample === sample.toLocaleLowerCase()) return text.toLocaleLowerCase();
  if (sample[0] === sample[0]?.toLocaleUpperCase() && sample.slice(1) === sample.slice(1).toLocaleLowerCase()) {
    return text[0]?.toLocaleUpperCase() + text.slice(1).toLocaleLowerCase();
  }
  return text;
}

function makeNameCycles(kind) {
  const values = new Map();
  const locales = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pt', 'pl', 'sv', 'da', 'no', 'fi', 'ru'];
  for (const locale of locales) {
    for (const width of ['long', 'short']) {
      const date = new Date(Date.UTC(2024, 0, 1));
      const length = kind === 'weekday' ? 7 : 12;
      const labels = Array.from({ length }, (_, index) => {
        const item = new Date(date);
        if (kind === 'weekday') item.setUTCDate(item.getUTCDate() + index);
        else item.setUTCMonth(index);
        return new Intl.DateTimeFormat(locale, { [kind]: width, timeZone: 'UTC' }).format(item);
      });
      const normalized = labels.map(normalizeName);
      if (new Set(normalized).size !== length) continue;
      const key = normalized.join('|');
      if (!values.has(key)) values.set(key, labels);
    }
  }
  return [...values.values()];
}

const WEEKDAY_CYCLES = makeNameCycles('weekday');
const MONTH_CYCLES = makeNameCycles('month');

function inferCycle(values, cycles) {
  const normalized = values.map(normalizeName);
  for (const labels of cycles) {
    const lookup = new Map(labels.map((label, index) => [normalizeName(label), index]));
    const indexes = normalized.map(value => lookup.get(value));
    if (indexes.some(index => index == null)) continue;
    const length = labels.length;
    const differences = indexes.slice(1).map((index, i) => {
      let delta = index - indexes[i];
      if (delta > length / 2) delta -= length;
      if (delta < -length / 2) delta += length;
      return delta;
    });
    const step = differences[0] ?? 1;
    if (differences.every(delta => delta === step)) return { labels, indexes, step, kind: cycles === WEEKDAY_CYCLES ? 'weekday' : 'month' };
  }
  return null;
}

function parseNumericText(value) {
  if (typeof value !== 'string') return null;
  const match = /^(.*?)(-?\d+(?:[.,]\d+)?)([^\d]*)$/.exec(value);
  if (!match) return null;
  const [, prefix, token, suffix] = match;
  const normalized = token.replace(',', '.');
  const number = Number(normalized);
  if (!Number.isFinite(number)) return null;
  const decimalPlaces = (normalized.split('.')[1] || '').length;
  const integerPart = normalized.replace(/^-/, '').split('.')[0];
  const zeroPad = integerPart.length > 1 && integerPart.startsWith('0') ? integerPart.length : 0;
  return { prefix, suffix, number, decimalPlaces, zeroPad, comma: token.includes(',') };
}

function formatNumericText(template, number, details) {
  let formatted = details.decimalPlaces ? number.toFixed(details.decimalPlaces) : String(Math.round(number));
  if (details.zeroPad) {
    const negative = formatted.startsWith('-');
    const [whole, fraction] = (negative ? formatted.slice(1) : formatted).split('.');
    formatted = `${negative ? '-' : ''}${whole.padStart(details.zeroPad, '0')}${fraction == null ? '' : `.${fraction}`}`;
  }
  if (details.comma) formatted = formatted.replace('.', ',');
  return `${details.prefix}${formatted}${details.suffix}`;
}

function parseDate(value) {
  if(value instanceof CalendarDate){const date=new Date(0);date.setUTCFullYear(value.getFullYear(),value.getMonth(),value.getDate());date.setUTCHours(0,0,0,0);return {date,kind:'calendarDate'};}
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return { date: new Date(value.getTime()), kind: 'dateObject' };
  }
  if (typeof value !== 'string') return null;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})(.*)$/.exec(value);
  if (match) {
    const [, year, month, day, suffix] = match;
    const date = new Date(Date.UTC(+year, +month - 1, +day));
    if (date.getUTCFullYear() !== +year || date.getUTCMonth() !== +month - 1 || date.getUTCDate() !== +day) return null;
    if (suffix && Number.isNaN(Date.parse(value))) return null;
    return { date: suffix ? new Date(Date.parse(value)) : date, kind: suffix ? 'isoDateTime' : 'isoDate' };
  }
  match = /^(\d{1,2})([./-])(\d{1,2})\2(\d{4})$/.exec(value);
  if (match) {
    const [, first, separator, second, year] = match;
    let day = +first, month = +second;
    if (separator === '/' && +first <= 12 && +second > 12) { month = +first; day = +second; }
    const date = new Date(Date.UTC(+year, month - 1, day));
    if (date.getUTCFullYear() !== +year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    const kind = separator === '/' && month === +first ? 'mdy' : 'dmy';
    return { date, kind, separator, dayWidth: kind === 'mdy' ? second.length : first.length, monthWidth: kind === 'mdy' ? first.length : second.length };
  }
  return null;
}

function endOfMonth(date) {
  return date.getUTCDate() === new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

function addMonths(date, amount, preserveMonthEnd) {
  const monthIndex = date.getUTCFullYear() * 12 + date.getUTCMonth() + amount;
  const year = Math.floor(monthIndex / 12), month = modulo(monthIndex, 12);
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = preserveMonthEnd ? lastDay : Math.min(date.getUTCDate(), lastDay);
  return new Date(Date.UTC(year, month, day, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()));
}

function formatDate(date, spec, template) {
  const pad = (value, width = 2) => String(value).padStart(width, '0');
  if(spec.kind==='calendarDate')return new CalendarDate(date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate());
  if (spec.kind === 'dateObject') return new Date(date.getTime());
  if (spec.kind === 'isoDateTime') return date.toISOString();
  const year = String(date.getUTCFullYear()), month = pad(date.getUTCMonth() + 1, spec.monthWidth || 2), day = pad(date.getUTCDate(), spec.dayWidth || 2);
  if (spec.kind === 'isoDate') return `${year}-${month}-${day}`;
  if (spec.kind === 'mdy') return `${month}${spec.separator}${day}${spec.separator}${year}`;
  return `${day}${spec.separator}${month}${spec.separator}${year}`;
}

function parseColor(value) {
  if (typeof value !== 'string') return null;
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3) digits = [...digits].map(ch => ch + ch).join('');
    return { channels: [0, 2, 4].map(index => Number.parseInt(digits.slice(index, index + 2), 16)), kind: 'hex', width: hex[1].length, upper: hex[1] === hex[1].toUpperCase() && /[A-F]/.test(hex[1]) };
  }
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(value);
  if (rgb && rgb.slice(1, 4).every(channel => +channel <= 255)) return { channels: rgb.slice(1, 4).map(Number), alpha: rgb[4] == null ? null : Number(rgb[4]), kind: rgb[4] == null ? 'rgb' : 'rgba' };
  const hsl = /^hsla?\(\s*(-?[\d.]+)(?:deg)?\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(value);
  if (hsl && +hsl[2] <= 100 && +hsl[3] <= 100) return { channels: hslToRgb([modulo(+hsl[1], 360), +hsl[2] / 100, +hsl[3] / 100]), alpha: hsl[4] == null ? null : Number(hsl[4]), kind: hsl[4] == null ? 'hsl' : 'hsla' };
  return null;
}

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let h = 0;
  if (delta) h = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  h = (h * 60 + 360) % 360;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return [h, s, l];
}

function hslToRgb([h, s, l]) {
  const chroma = (1 - Math.abs(2 * l - 1)) * s, x = chroma * (1 - Math.abs((h / 60) % 2 - 1)), m = l - chroma / 2;
  const [r, g, b] = h < 60 ? [chroma, x, 0] : h < 120 ? [x, chroma, 0] : h < 180 ? [0, chroma, x] : h < 240 ? [0, x, chroma] : h < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return [r, g, b].map(channel => Math.round((channel + m) * 255));
}

function formatColor(channels, spec) {
  const bounded = channels.map(channel => Math.max(0, Math.min(255, Math.round(channel))));
  if (spec.kind === 'rgb' || spec.kind === 'rgba') return spec.kind === 'rgba' ? `rgba(${bounded.join(', ')}, ${spec.alpha})` : `rgb(${bounded.join(', ')})`;
  if (spec.kind === 'hsl' || spec.kind === 'hsla') {
    const [hue, saturation, lightness] = rgbToHsl(bounded), color = `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
    return spec.kind === 'hsla' ? `hsla(${color} / ${spec.alpha})` : `hsl(${color})`;
  }
  let hex = bounded.map(channel => channel.toString(16).padStart(2, '0')).join('');
  if (spec.width === 3 && [...hex].every((char, index) => index % 2 ? char === hex[index - 1] : true)) hex = [...hex].filter((_, index) => index % 2 === 0).join('');
  if (spec.upper) hex = hex.toUpperCase();
  return `#${hex}`;
}

function constantStep(values, project = value => value) {
  if (values.length < 2) return 0;
  const numbers = values.map(project);
  const step = numbers[1] - numbers[0];
  if (typeof step === 'bigint') return numbers.slice(2).every((number, index) => number - numbers[index + 1] === step) ? step : null;
  return numbers.slice(2).every((number, index) => Math.abs((number - numbers[index + 1]) - step) < 1e-9) ? step : null;
}

function makeSeries(values, kind, step, generate, sourceIndex) {
  const repeatIndex = offset => modulo(offset, values.length);
  return {
    kind,
    step,
    sourceIndexAt(offset) {
      if (offset >= 0 && offset < values.length) return offset;
      return sourceIndex(offset);
    },
    valueAt(offset) {
      if (offset >= 0 && offset < values.length) return { value: values[offset], sourceIndex: offset };
      return { value: generate(offset), sourceIndex: sourceIndex(offset) };
    },
    repeatAt(offset) {
      const index = repeatIndex(offset);
      return { value: values[index], sourceIndex: index };
    }
  };
}

function sameValue(a, b) {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a === 'object' && typeof b === 'object') {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch { return a === b; }
  }
  return Object.is(a, b);
}

function finishSeries(values, series) {
  series.ambiguous = values.length >= 2 && !['formula', 'repeat', 'empty'].includes(series.kind) &&
    !sameValue(series.valueAt(values.length).value, series.repeatAt(values.length).value);
  return series;
}

/** Infer a spreadsheet-style fill pattern and return values for offsets around the seed range. */
export function inferAutofillSeries(input) {
  const values = [...input];
  if (!values.length) return makeSeries(values, 'empty', 0, () => '', () => 0);
  const repeatIndex = offset => modulo(offset, values.length);
  const formulas = values.every(value => typeof value === 'string' && value.startsWith('='));
  if (formulas) return finishSeries(values, makeSeries(values, 'formula', 0, offset => values[repeatIndex(offset)], repeatIndex));

  const dateValues = values.map(parseDate);
  if (dateValues.every(Boolean)) {
    const dates = dateValues.map(spec => spec.date);
    const monthIndexes = dates.map(date => date.getUTCFullYear() * 12 + date.getUTCMonth());
    const monthStep = constantStep(monthIndexes);
    const monthBased = values.length > 1 && monthStep != null && monthStep !== 0 && (
      dates.every(date => date.getUTCDate() === dates[0].getUTCDate()) || dates.every(endOfMonth)
    );
    const dayValues = dates.map(date => date.getTime() / DAY_MS);
    const dayStep = constantStep(dayValues);
    if (monthBased) {
      const edge = offset => offset < 0 ? 0 : values.length - 1;
      const from = offset => {
        const index = edge(offset), delta = offset < 0 ? offset : offset - (values.length - 1);
        return addMonths(dates[index], monthStep * delta, dates.every(endOfMonth));
      };
      return finishSeries(values, makeSeries(values, 'date-month', monthStep, offset => formatDate(from(offset), dateValues[edge(offset)], values[edge(offset)]), edge));
    }
    const step = values.length === 1 ? 1 : dayStep;
    if (step != null) {
      const edge = offset => offset < 0 ? 0 : values.length - 1;
      const from = offset => {
        const index = edge(offset), delta = offset < 0 ? offset : offset - (values.length - 1);
        return new Date(dates[index].getTime() + step * delta * DAY_MS);
      };
      return finishSeries(values, makeSeries(values, 'date-day', step, offset => formatDate(from(offset), dateValues[edge(offset)], values[edge(offset)]), edge));
    }
  }

  const weekdays = inferCycle(values, WEEKDAY_CYCLES);
  if (weekdays) {
    const edge = offset => offset < 0 ? 0 : values.length - 1;
    return finishSeries(values, makeSeries(values, 'weekday', weekdays.step, offset => {
      const delta = offset < 0 ? offset : offset - (values.length - 1);
      const label = weekdays.labels[modulo(weekdays.indexes[edge(offset)] + weekdays.step * delta, weekdays.labels.length)];
      return preserveCase(label, values[edge(offset)]);
    }, edge));
  }

  const months = inferCycle(values, MONTH_CYCLES);
  if (months) {
    const edge = offset => offset < 0 ? 0 : values.length - 1;
    return finishSeries(values, makeSeries(values, 'month-name', months.step, offset => {
      const delta = offset < 0 ? offset : offset - (values.length - 1);
      return preserveCase(months.labels[modulo(months.indexes[edge(offset)] + months.step * delta, months.labels.length)], values[edge(offset)]);
    }, edge));
  }

  const colors = values.map(parseColor);
  if (colors.every(Boolean) && colors.every(color => color.kind === colors[0].kind)) {
    const hsl = colors.map(color => rgbToHsl(color.channels));
    let hueStep = null;
    if (hsl.every(color => Math.abs(color[1] - hsl[0][1]) < 1e-6 && Math.abs(color[2] - hsl[0][2]) < 1e-6)) {
      const hueDiffs = hsl.slice(1).map((color, index) => {
        let delta = color[0] - hsl[index][0];
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        return delta;
      });
      hueStep = hueDiffs.length ? hueDiffs[0] : null;
      if (!hueDiffs.every(delta => Math.abs(delta - hueStep) < 1e-6)) hueStep = null;
    }
    const channelSteps = [0, 1, 2].map(channel => constantStep(colors.map(color => color.channels[channel])));
    if (hueStep != null && hueStep !== 0) {
      const edge = offset => offset < 0 ? 0 : values.length - 1;
      return finishSeries(values, makeSeries(values, 'color-hue', hueStep, offset => {
        const index = edge(offset), delta = offset < 0 ? offset : offset - (values.length - 1), colorHsl = [...hsl[index]];
        colorHsl[0] = modulo(colorHsl[0] + hueStep * delta, 360);
        return formatColor(hslToRgb(colorHsl), colors[index]);
      }, edge));
    }
    if (channelSteps.every(step => step != null)) {
      const edge = offset => offset < 0 ? 0 : values.length - 1;
      return finishSeries(values, makeSeries(values, 'color-rgb', channelSteps, offset => {
        const index = edge(offset), delta = offset < 0 ? offset : offset - (values.length - 1);
        return formatColor(colors[index].channels.map((channel, i) => channel + channelSteps[i] * delta), colors[index]);
      }, edge));
    }
  }

  if (values.every(value => typeof value === 'bigint')) {
    const step = constantStep(values);
    if (step != null) {
      const edge = offset => offset < 0 ? 0 : values.length - 1;
      return finishSeries(values, makeSeries(values, 'bigint', step, offset => {
        const delta = BigInt(offset < 0 ? offset : offset - (values.length - 1));
        return values[edge(offset)] + step * delta;
      }, edge));
    }
  }

  if (values.every(value => typeof value === 'number' && Number.isFinite(value))) {
    const step = values.length === 1 ? null : constantStep(values);
    if (step != null) {
      const edge = offset => offset < 0 ? 0 : values.length - 1;
      return finishSeries(values, makeSeries(values, step === 0 ? 'repeat' : 'number', step, offset => {
        const delta = offset < 0 ? offset : offset - (values.length - 1);
        return values[edge(offset)] + step * delta;
      }, edge));
    }
  }

  const numericText = values.map(parseNumericText);
  if (numericText.every(Boolean) && numericText.every(item => item.prefix === numericText[0].prefix && item.suffix === numericText[0].suffix && item.decimalPlaces === numericText[0].decimalPlaces && item.comma === numericText[0].comma)) {
    const step = values.length === 1 ? 1 : constantStep(numericText, item => item.number);
    if (step != null) {
      const edge = offset => offset < 0 ? 0 : values.length - 1;
      return finishSeries(values, makeSeries(values, 'numbered-text', step, offset => {
        const delta = offset < 0 ? offset : offset - (values.length - 1), item = numericText[edge(offset)];
        return formatNumericText(values[edge(offset)], item.number + step * delta, item);
      }, edge));
    }
  }

  return makeSeries(values, 'repeat', 0, offset => values[repeatIndex(offset)], repeatIndex);
}

/** Find the contiguous neighboring data range used by the fill-handle double-click. */
export function findAutofillExtent(source, { rowCount, getValue }) {
  const top = Math.min(source.r1, source.r2), bottom = Math.max(source.r1, source.r2);
  const left = Math.min(source.c1, source.c2), right = Math.max(source.c1, source.c2);
  const candidates = [left - 1, right + 1].filter(col => col >= 0);
  const extents = candidates.map(col => {
    let end = bottom;
    for (let row = bottom + 1; row < rowCount && !isEmpty(getValue(row, col)); row++) end = row;
    return { col, end, count: end - bottom };
  }).sort((a, b) => b.count - a.count || (a.col === left - 1 ? -1 : 1));
  if (!extents[0]?.count) return null;
  return { r1: top, c1: left, r2: extents[0].end, c2: right };
}
