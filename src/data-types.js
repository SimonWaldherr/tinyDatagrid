const BOOLEAN_VALUES = new Map([
  ['true', true], ['false', false], ['yes', true], ['no', false], ['ja', true], ['nein', false],
  ['oui', true], ['non', false], ['sí', true], ['si', true], ['on', true], ['off', false]
]);

const CURRENCY_CODES = new Map([
  ['€', 'EUR'], ['eur', 'EUR'], ['$','USD'], ['usd', 'USD'], ['£', 'GBP'], ['gbp', 'GBP'],
  ['¥', 'JPY'], ['jpy', 'JPY'], ['₹', 'INR'], ['inr', 'INR'], ['₽', 'RUB'], ['rub', 'RUB'],
  ['chf', 'CHF'], ['c$', 'CAD'], ['cad', 'CAD'], ['a$', 'AUD'], ['aud', 'AUD']
]);

export function getDataLocale(locale) {
  return locale || globalThis.navigator?.language || Intl.NumberFormat().resolvedOptions().locale || 'en-US';
}

function numberSeparators(locale) {
  const parts = new Intl.NumberFormat(getDataLocale(locale)).formatToParts(12345.6);
  return {
    group: parts.find(part => part.type === 'group')?.value || ',',
    decimal: parts.find(part => part.type === 'decimal')?.value || '.'
  };
}

function parseNumberText(input, locale) {
  let text = String(input).trim();
  if (!text) return null;
  let percent = false, currency = null, negative = false;
  if (text.startsWith('(') && text.endsWith(')')) { negative = true; text = text.slice(1, -1).trim(); }
  if (/%$/.test(text)) { percent = true; text = text.slice(0, -1).trim(); }
  if (/^[+-]/.test(text)) { if (text[0] === '-') negative = !negative; text = text.slice(1); }
  const currencies = [...CURRENCY_CODES.keys()].sort((a, b) => b.length - a.length);
  for (const symbol of currencies) {
    const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(`(?:^${escaped}\\s*|\\s*${escaped}$)`, 'i');
    if (expression.test(text)) { currency = CURRENCY_CODES.get(symbol.toLowerCase()); text = text.replace(expression, '').trim(); break; }
  }
  if (!text || !/[0-9]/.test(text)) return null;
  const separators = numberSeparators(locale);
  const dots = [...text.matchAll(/\./g)].map(match => match.index), commas = [...text.matchAll(/,/g)].map(match => match.index);
  let decimal = separators.decimal, group = separators.group;
  if (dots.length && commas.length) {
    decimal = dots.at(-1) > commas.at(-1) ? '.' : ',';
    group = decimal === '.' ? ',' : '.';
  } else {
    const symbol = dots.length ? '.' : commas.length ? ',' : null;
    if (symbol && symbol !== separators.decimal && symbol !== separators.group) return null;
    if (symbol && symbol === separators.group && symbol !== separators.decimal) {
      const groups = text.split(symbol);
      if (groups.length > 1 && groups.slice(1).every(part => part.length === 3)) group = symbol;
      else return null;
    }
  }
  let normalized = text.replace(/[\s\u00a0\u202f'_]/g, '');
  if (group) normalized = normalized.split(group).join('');
  if (decimal && decimal !== '.') normalized = normalized.replace(decimal, '.');
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized)) return null;
  // Keep zero-padded whole numbers as text; they are usually identifiers or codes.
  if (!percent && !currency && /^0\d+$/.test(normalized)) return null;
  const integerToken = /^\d+$/.test(normalized);
  let value;
  if (integerToken && !percent && !currency) {
    try {
      const exact = BigInt(normalized);
      value = exact <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(exact) : exact;
    } catch { return null; }
  } else {
    value = Number(normalized);
    if (!Number.isFinite(value)) return null;
  }
  if (negative) value = typeof value === 'bigint' ? -value : -value;
  if (percent) value /= 100;
  return {
    type: currency ? 'currency' : percent ? 'percent' : typeof value === 'bigint' || Number.isInteger(value) ? 'integer' : 'number',
    value,
    format: currency ? { type: 'currency', currency, locale: getDataLocale(locale) } : percent ? { type: 'percent', locale: getDataLocale(locale) } : null
  };
}

function parseDateText(input, locale) {
  const text = String(input).trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match) {
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const date = new Date(0);
    date.setHours(0, 0, 0, 0);
    date.setFullYear(year, month - 1, day);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) return { type: 'date', value: date };
    return null;
  }
  if (/^\d{4}-\d\d-\d\d[Tt ]/.test(text)) {
    const time = Date.parse(text);
    if (Number.isFinite(time)) return { type: 'datetime', value: new Date(time) };
    return null;
  }
  match = /^(\d{1,2})([./-])(\d{1,2})\2(\d{4})$/.exec(text);
  if (!match) return null;
  let [, first, , second, yearText] = match;
  let day = Number(first), month = Number(second), year = Number(yearText);
  const language = getDataLocale(locale).toLowerCase();
  const usOrder = language.startsWith('en-us') || language.startsWith('en-ca') || language.startsWith('ja');
  if (match[2] === '/' && Number(first) <= 12 && Number(second) <= 12 && usOrder) { month = Number(first); day = Number(second); }
  else if (match[2] === '/' && Number(first) <= 12 && Number(second) > 12) { month = Number(first); day = Number(second); }
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return { type: 'date', value: date };
}

function parseStructuredText(value) {
  const text = value.trim();
  if (!/^[\[{]/.test(text)) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') return { type: 'json', value: parsed };
  } catch {}
  return null;
}

/** Identify and convert a single imported value without coercing ambiguous identifiers. */
export function inferDataValue(input, { locale } = {}) {
  if (input == null) return { type: 'null', value: input };
  if (typeof input === 'boolean') return { type: 'boolean', value: input };
  if (typeof input === 'bigint') return { type: 'integer', value: input };
  if (typeof input === 'number') return { type: Number.isInteger(input) ? 'integer' : 'number', value: input };
  if (input instanceof Date && Number.isFinite(input.getTime())) return { type: 'datetime', value: input };
  if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) return { type: 'binary', value: input };
  if (Array.isArray(input)) return { type: 'json', value: input };
  if (typeof input === 'object') return { type: 'json', value: input };
  const text = String(input), trimmed = text.trim();
  if (!trimmed) return { type: 'empty', value: input };
  const boolean = BOOLEAN_VALUES.get(trimmed.toLocaleLowerCase());
  if (boolean !== undefined) return { type: 'boolean', value: boolean };
  const date = parseDateText(trimmed, locale);
  if (date) return date;
  const structured = parseStructuredText(trimmed);
  if (structured) return structured;
  const numeric = parseNumberText(trimmed, locale);
  if (numeric) return numeric;
  return { type: 'text', value: input };
}

export function inferColumnType(values, options = {}) {
  const types = [...new Set(values.filter(value => value != null && value !== '').map(value => inferDataValue(value, options).type))];
  if (!types.length) return 'unknown';
  if (types.length === 1) return types[0];
  if (types.every(type => ['integer', 'number', 'currency', 'percent'].includes(type))) return 'number';
  return 'mixed';
}

export function coerceDataValue(input, { type = 'unknown', locale } = {}) {
  if (input == null || typeof input !== 'string') return input;
  const normalized = String(type).toLowerCase().trim();
  const base = normalized.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ');
  if (['unknown', '', 'mixed'].includes(base)) return inferDataValue(input, { locale }).value;
  if (/^(bool|boolean|bit)$/.test(base)) {
    const text = input.trim().toLowerCase();
    if (['true', 't', '1', 'yes', 'ja', 'on'].includes(text)) return true;
    if (['false', 'f', '0', 'no', 'nein', 'off'].includes(text)) return false;
    return input;
  }
  if (/^(bigint|int8|integer64|serial8|bigserial)$/.test(base)) {
    if (!/^[+-]?\d+$/.test(input.trim())) return input;
    try { const number = BigInt(input.trim()); return number <= BigInt(Number.MAX_SAFE_INTEGER) && number >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(number) : number; } catch { return input; }
  }
  if (/^(tinyint|smallint|mediumint|int|int2|int4|integer|serial|serial2|serial4)(?:\s+unsigned)?$/.test(base)) {
    const parsed = parseNumberText(input, locale);
    return parsed?.type === 'integer' && (typeof parsed.value === 'bigint' || Number.isInteger(parsed.value)) ? parsed.value : input;
  }
  if (/^(decimal|numeric|money|smallmoney|dec)$/.test(base) || /^(numeric|decimal)\b/.test(normalized)) {
    const parsed = parseNumberText(input, locale);
    return parsed && ['integer', 'number'].includes(parsed.type) ? String(parsed.value) : input;
  }
  if (/^(float|float4|float8|real|double|double precision|numeric_float|number)$/.test(base)) {
    const parsed = parseNumberText(input, locale);
    return parsed && ['integer', 'number'].includes(parsed.type) ? Number(parsed.value) : input;
  }
  if (/^(date)$/.test(base)) return parseDateText(input, locale)?.value ?? input;
  if (/^(datetime|timestamp|timestamptz|timestamp with time zone|timestamp without time zone|smalldatetime)$/.test(base)) {
    const parsed = parseDateText(input, locale);
    if (parsed) return parsed.value;
    const timestamp = Date.parse(input);
    return Number.isFinite(timestamp) ? new Date(timestamp) : input;
  }
  if (/^(json|jsonb|object|array)$/.test(base)) return parseStructuredText(input)?.value ?? input;
  return input;
}

function identifierHeader(header) {
  const original = String(header ?? '').trim();
  const normalized = original.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const compact = normalized.replaceAll('_', '');
  if (/^(id|uuid|guid|code|sku|zip|zipcode|postalcode|postcode|phone|phonenumber|telephone|mobile|iban|accountnumber|serialnumber|trackingnumber)$/.test(compact)) return true;
  return /(?:^|[_\s-])(id|uuid|guid|code|sku|zip|postcode|postal_code|phone|telephone|mobile|iban|account_number|serial_number|tracking_number)$/.test(original.toLowerCase()) || /(?:Id|ID|UUID|GUID|SKU|IBAN)$/.test(original);
}

/** Parse delimited text values and retain format hints for percentages and currencies. */
export function inferDelimitedRows(rows, { locale, headerRow = 0 } = {}) {
  const result = rows.map(row => [...row]);
  const formats = new Map();
  const width = Math.max(0, ...rows.map(row => row.length));
  for (let col = 0; col < width; col++) {
    const header = Number.isInteger(headerRow) && rows[headerRow] ? rows[headerRow][col] : null;
    if (identifierHeader(header)) continue;
    for (let row = 0; row < rows.length; row++) {
      const info = inferDataValue(rows[row][col], { locale });
      result[row][col] = info.value;
      if (info.format) formats.set(`${row},${col}`, info.format);
    }
  }
  return { rows: result, formats };
}
