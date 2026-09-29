import { toA1, parseA1, colToName, nameToCol } from './tinygrid.js';
import { parseNumericValue } from './numeric-values.js';

// Point-and-click rules for the conditionalFormatting() and dataValidation() plugins. The helpers change the
// grid's rule lists as one undoable step; installRuleTools() binds them to the demo's buttons and dialogs.

const WHOLE_COLUMN = 1048575; // last row of a range that covers whole columns
const MAX_LIST_VALUES = 1000;

export const CONDITIONS = [
  { id: 'gt', key: 'cfGt', inputs: 1 }, { id: 'gte', key: 'cfGte', inputs: 1 },
  { id: 'lt', key: 'cfLt', inputs: 1 }, { id: 'lte', key: 'cfLte', inputs: 1 },
  { id: 'eq', key: 'cfEq', inputs: 1 }, { id: 'ne', key: 'cfNe', inputs: 1 },
  { id: 'between', key: 'cfBetween', inputs: 2 }, { id: 'contains', key: 'cfContains', inputs: 1 },
  { id: 'empty', key: 'cfEmpty', inputs: 0 }, { id: 'notEmpty', key: 'cfNotEmpty', inputs: 0 }
];
const NUMERIC = new Set(['gt', 'gte', 'lt', 'lte', 'between']);
// Each preset sets its own text color next to the fill, so it reads well on every theme.
export const PRESETS = [
  { id: 'red', key: 'cfRed', style: { backgroundColor: '#f8d0d0', color: '#8c1d1d' } },
  { id: 'yellow', key: 'cfYellow', style: { backgroundColor: '#fbe9a6', color: '#5c4300' } },
  { id: 'green', key: 'cfGreen', style: { backgroundColor: '#cdeedb', color: '#0b5b34' } },
  { id: 'blue', key: 'cfBlue', style: { backgroundColor: '#cfe2f8', color: '#0f3c78' } },
  { id: 'gray', key: 'cfGray', style: { backgroundColor: '#e3e3e0', color: '#3a3a36' } },
  { id: 'bold', key: 'cfBold', style: { fontWeight: '700' } },
  { id: 'strike', key: 'cfStrike', style: { textDecoration: 'line-through' } }
];
const VALIDATION_TYPES = { integer: 'vlInteger', number: 'vlNumber', list: 'vlList', textLength: 'vlTextLength', json: 'vlJson' };

const fill = (text, values) => Object.entries(values).reduce((result, [name, value]) => result.replaceAll(`{${name}}`, value), text);
const overlaps = (a, b) => a.r1 <= b.r2 && a.r2 >= b.r1 && a.c1 <= b.c2 && a.c2 >= b.c1;

/** "B2", "B2:D9" or whole columns such as "B:B" and "B:D". Returns a normalized range or null. */
export function parseRangeText(text, { columns = 16384 } = {}) {
  const parts = String(text ?? '').replace(/\s+/g, '').split(':');
  if (!parts[0] || parts.length > 2) return null;
  const whole = part => /^\$?[A-Za-z]{1,3}$/.test(part);
  let a, b;
  if (parts.length === 2 && parts.every(whole)) {
    a = { row: 0, col: nameToCol(parts[0].replace('$', '')) };
    b = { row: WHOLE_COLUMN, col: nameToCol(parts[1].replace('$', '')) };
  } else {
    a = parseA1(parts[0]); b = parseA1(parts[1] ?? parts[0]);
  }
  if (!a || !b || [a.row, b.row, a.col, b.col].some(n => n < 0) || Math.max(a.col, b.col) >= columns || Math.max(a.row, b.row) > WHOLE_COLUMN) return null;
  return { r1: Math.min(a.row, b.row), c1: Math.min(a.col, b.col), r2: Math.max(a.row, b.row), c2: Math.max(a.col, b.col) };
}

/** The address of a range: "B2", "B2:D9", or "B:B" when it covers whole columns. */
export function describeRange(range) {
  if (range.r1 === 0 && range.r2 >= WHOLE_COLUMN) return `${colToName(range.c1)}:${colToName(range.c2)}`;
  const start = toA1(range.r1, range.c1), end = toA1(range.r2, range.c2);
  return start === end ? start : `${start}:${end}`;
}

/** The parts of `range` that lie outside `hole`: zero to four rectangles. */
export function subtractRange(range, hole) {
  if (!overlaps(range, hole)) return [{ ...range }];
  const pieces = [];
  if (range.r1 < hole.r1) pieces.push({ r1: range.r1, r2: hole.r1 - 1, c1: range.c1, c2: range.c2 });
  if (range.r2 > hole.r2) pieces.push({ r1: hole.r2 + 1, r2: range.r2, c1: range.c1, c2: range.c2 });
  const r1 = Math.max(range.r1, hole.r1), r2 = Math.min(range.r2, hole.r2);
  if (range.c1 < hole.c1) pieces.push({ r1, r2, c1: range.c1, c2: hole.c1 - 1 });
  if (range.c2 > hole.c2) pieces.push({ r1, r2, c1: hole.c2 + 1, c2: range.c2 });
  return pieces;
}

/** Typed value of a text field: numbers (1,5 counts as 1.5) and TRUE/FALSE are converted, other text stays. */
export function parseRuleValue(text) {
  const trimmed = String(text ?? '').trim();
  const parsed = parseNumericValue(/^[+-]?\d+,\d+$/.test(trimmed) ? trimmed.replace(',', '.') : trimmed);
  if (parsed.numeric && !parsed.lossy && typeof parsed.value === 'number') return parsed.value;
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === 'true';
  return trimmed;
}

/** Allowed values for a list from text: one per line, or separated by commas or semicolons. */
export function parseListValues(text) {
  const source = String(text ?? '');
  const items = (/\r?\n/.test(source) ? source.split(/\r?\n/) : source.split(/[,;]/)).map(item => item.trim()).filter(Boolean);
  return [...new Set(items)];
}

/** A short description of a conditional formatting rule, for example: is greater than 100. */
export function conditionText(rule, t) {
  const condition = CONDITIONS.find(item => item.id === rule.operator);
  if (!condition) return String(rule.operator);
  const shown = value => typeof value === 'string' ? `"${value}"` : String(value ?? '');
  const parts = [t(condition.key)];
  if (condition.inputs > 0) parts.push(shown(rule.value));
  if (condition.inputs > 1) parts.push(t('cfAnd'), shown(rule.max));
  return parts.join(' ');
}

/** A short description of a validation rule, for example: Whole number from 1 to 10. */
export function validationText(rule, t) {
  if (rule.type === 'list') return fill(t('vlListSummary'), { values: (rule.values ?? []).join(', ') });
  if (rule.type === 'json') return rule.kind ? t(rule.kind === 'object' ? 'vlJsonObject' : 'vlJsonArray') : t('vlJson');
  const bounds = rule.min != null && rule.max != null ? fill(t('vlBetween'), { min: rule.min, max: rule.max })
    : rule.min != null ? fill(t('vlAtLeast'), { min: rule.min }) : rule.max != null ? fill(t('vlAtMost'), { max: rule.max }) : '';
  return [t(VALIDATION_TYPES[rule.type] ?? 'vlNumber'), bounds].filter(Boolean).join(' ');
}

// ---- rule lists: one undo step each ---------------------------------------------------------------

export function addConditionalFormat(grid, rule) {
  return grid.transaction(() => grid.setConditionalFormats([...grid.conditionalFormats, rule]));
}
export function removeConditionalFormat(grid, index) {
  return grid.transaction(() => grid.setConditionalFormats(index == null ? [] : grid.conditionalFormats.filter((_, i) => i !== index)));
}
/** Set a validation rule. It replaces earlier rules in the cells of its range; the rest of those rules stays. */
export function setValidation(grid, rule) {
  const kept = [];
  for (const existing of grid.validationRules) for (const range of subtractRange(existing.range, rule.range)) kept.push({ ...existing, range });
  return grid.transaction(() => grid.setValidationRules([...kept, rule]));
}
export function removeValidation(grid, index) {
  return grid.transaction(() => grid.setValidationRules(index == null ? [] : grid.validationRules.filter((_, i) => i !== index)));
}

// ---- demo bindings ----------------------------------------------------------------------------------

export function installRuleTools({ grid, $, t, notify, selection, showDialog }) {
  const text = (key, values) => fill(t(key), values);
  const rangeText = box => describeRange(box.r1 === 0 && box.r2 >= grid.rowCount - 1 ? { ...box, r2: WHOLE_COLUMN } : box);
  const invalid = (input, message) => {
    input.setCustomValidity(message); input.reportValidity();
    input.addEventListener('input', () => input.setCustomValidity(''), { once: true });
    return null;
  };
  const targetRange = input => parseRangeText(input.value, { columns: grid.colCount }) ?? invalid(input, t('rlRangeInvalid'));
  const number = (input, required) => {
    const raw = input.value.trim();
    if (!raw) return required ? invalid(input, t('rlNeedNumber')) : undefined;
    const value = parseRuleValue(raw);
    return typeof value === 'number' ? value : invalid(input, t('rlNeedNumber'));
  };
  function renderList(host, rules, { sample, describe, remove }) {
    host.replaceChildren();
    if (!rules.length) { const empty = document.createElement('li'); empty.className = 'rule-empty'; empty.textContent = t('rlNone'); host.append(empty); return; }
    rules.forEach((rule, index) => {
      const item = document.createElement('li'), label = document.createElement('span'), where = document.createElement('b'), button = document.createElement('button');
      if (sample) { const chip = document.createElement('span'); chip.className = 'rule-sample'; chip.textContent = 'Abc'; Object.assign(chip.style, rule.style); item.append(chip); }
      where.textContent = describeRange(rule.range); label.className = 'rule-text'; label.append(where, ` ${describe(rule)}`);
      button.type = 'button'; button.className = 'icon-button'; button.textContent = '×'; button.title = `${t('rlRemove')}: ${describeRange(rule.range)}`; button.setAttribute('aria-label', button.title);
      button.onclick = () => { remove(index); renderAll(); };
      item.append(label, button); host.append(item);
    });
  }
  /** A group of buttons that behaves like radio buttons: one is selected, arrow keys move between them. */
  function choices(host, options, initial, onChange) {
    let current = initial;
    const buttons = options.map(option => {
      const button = document.createElement('button'), chip = document.createElement('span'), name = document.createElement('span');
      button.type = 'button'; button.setAttribute('role', 'radio'); button.dataset.choice = option.id; button.className = 'rule-choice';
      chip.className = 'rule-sample'; chip.textContent = 'Abc'; name.textContent = t(option.key);
      button.append(chip, name); host.append(button);
      button.onclick = () => select(option.id, true);
      button.onkeydown = event => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (!step) return;
        event.preventDefault(); select(options[(options.indexOf(option) + step + options.length) % options.length].id, true);
      };
      return { option, button, chip };
    });
    function select(id, focus) {
      current = id;
      for (const { option, button } of buttons) { button.setAttribute('aria-checked', String(option.id === id)); button.tabIndex = option.id === id ? 0 : -1; if (focus && option.id === id) button.focus(); }
      onChange(id);
    }
    select(initial, false);
    return { buttons, select, get value() { return current; } };
  }

  // ---- conditional formatting ----
  const customStyle = () => ({ backgroundColor: $('#cfFill').value, color: $('#cfTextColor').value, ...($('#cfBold').checked ? { fontWeight: '700' } : {}) });
  const styleOf = id => id === 'custom' ? customStyle() : PRESETS.find(preset => preset.id === id).style;
  let styles = null;
  function paintChoices() {
    for (const { option, chip } of styles.buttons) { chip.removeAttribute('style'); Object.assign(chip.style, styleOf(option.id)); }
  }
  function syncCondition() {
    const condition = CONDITIONS.find(item => item.id === $('#cfOperator').value), between = condition.inputs > 1;
    $('#cfValueField').hidden = condition.inputs === 0; $('#cfMaxField').hidden = !between;
    $('#cfValueLabel').textContent = t(between ? 'cfFrom' : 'cfValue');
  }
  function openConditional() {
    if (grid.readOnly) return;
    if (!styles) {
      styles = choices($('#cfStyles'), [...PRESETS, { id: 'custom', key: 'cfCustom' }], 'red', id => { $('#cfCustom').hidden = id !== 'custom'; });
      for (const id of ['#cfFill', '#cfTextColor', '#cfBold']) $(id).addEventListener('input', paintChoices);
    }
    for (const { option, button } of styles.buttons) button.lastChild.textContent = t(option.key);
    paintChoices();
    $('#cfRange').value = rangeText(selection());
    $('#cfValue').value = ''; $('#cfMax').value = '';
    syncCondition(); renderAll();
    showDialog('#cfDialog');
    ($('#cfValueField').hidden ? $('#cfOperator') : $('#cfValue')).focus();
  }
  $('#cfBtn').onclick = openConditional;
  $('#cfOperator').onchange = syncCondition;
  $('#closeCf').onclick = () => $('#cfDialog').close();
  $('#cfClear').onclick = () => { if (grid.conditionalFormats.length) removeConditionalFormat(grid, null); renderAll(); };
  $('#cfForm').onsubmit = event => {
    event.preventDefault();
    const range = targetRange($('#cfRange'));
    if (!range) return;
    const condition = CONDITIONS.find(item => item.id === $('#cfOperator').value);
    const rule = { range, operator: condition.id, style: { ...styleOf(styles.value) } };
    if (condition.inputs > 0) {
      if (NUMERIC.has(condition.id)) {
        const first = number($('#cfValue'), true);
        if (first === null) return;
        rule.value = first;
        if (condition.inputs > 1) { const second = number($('#cfMax'), true); if (second === null) return; rule.max = second; }
        if (rule.max < rule.value) [rule.value, rule.max] = [rule.max, rule.value];
      } else {
        if (!$('#cfValue').value.trim()) { invalid($('#cfValue'), t('rlNeedValue')); return; }
        rule.value = condition.id === 'contains' ? $('#cfValue').value : parseRuleValue($('#cfValue').value);
      }
    }
    try { addConditionalFormat(grid, rule); } catch { notify(t('failed')); return; }
    $('#cfDialog').close();
    notify(text('cfAdded', { range: describeRange(range) }));
  };

  // ---- validation ----
  function syncType() {
    const type = $('#vlType').value;
    $('#vlBounds').hidden = !['number', 'integer', 'textLength'].includes(type);
    $('#vlValuesField').hidden = type !== 'list'; $('#vlKindField').hidden = type !== 'json';
  }
  function openValidation() {
    if (grid.readOnly) return;
    $('#vlRange').value = rangeText(selection());
    for (const id of ['#vlMin', '#vlMax', '#vlValues', '#vlMessage']) $(id).value = '';
    $('#vlKind').value = ''; syncType(); renderAll();
    showDialog('#validationDialog');
    $('#vlType').focus();
  }
  $('#validationBtn').onclick = openValidation;
  $('#vlType').onchange = syncType;
  $('#closeValidation').onclick = () => $('#validationDialog').close();
  $('#vlClear').onclick = () => { if (grid.validationRules.length) removeValidation(grid, null); renderAll(); };
  $('#validationForm').onsubmit = event => {
    event.preventDefault();
    const range = targetRange($('#vlRange')), type = $('#vlType').value;
    if (!range) return;
    const rule = { range, type, allowEmpty: $('#vlEmpty').checked, allowFormula: $('#vlFormula').checked };
    if (['number', 'integer', 'textLength'].includes(type)) {
      const min = number($('#vlMin'), false), max = number($('#vlMax'), false);
      if (min === null || max === null) return;
      if (min !== undefined) rule.min = min;
      if (max !== undefined) rule.max = max;
      if (min !== undefined && max !== undefined && min > max) { invalid($('#vlMin'), t('vlBoundsOrder')); return; }
    } else if (type === 'list') {
      const values = parseListValues($('#vlValues').value);
      if (!values.length) { invalid($('#vlValues'), t('vlNeedValues')); return; }
      if (values.length > MAX_LIST_VALUES) { invalid($('#vlValues'), text('vlTooMany', { n: MAX_LIST_VALUES })); return; }
      rule.values = values;
    } else if ($('#vlKind').value) rule.kind = $('#vlKind').value;
    rule.message = $('#vlMessage').value.trim() || text('vlDefaultMessage', { rule: validationText(rule, t) });
    try { setValidation(grid, rule); } catch { notify(t('failed')); return; }
    $('#validationDialog').close();
    notify(text('vlAdded', { range: describeRange(range) }));
  };

  function renderAll() {
    renderList($('#cfList'), grid.conditionalFormats, { sample: true, describe: rule => conditionText(rule, t), remove: index => removeConditionalFormat(grid, index) });
    renderList($('#vlList'), grid.validationRules, { describe: rule => validationText(rule, t), remove: index => removeValidation(grid, index) });
    $('#cfClear').hidden = !grid.conditionalFormats.length; $('#vlClear').hidden = !grid.validationRules.length;
  }
  function sync() {
    for (const id of ['#cfBtn', '#validationBtn']) $(id).disabled = grid.readOnly;
  }
  grid.on('readonly', sync); sync();
  return { sync, refresh: renderAll };
}
