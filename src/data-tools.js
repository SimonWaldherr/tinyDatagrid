import { toA1, colToName } from './tinygrid.js';
import { JSONValue, isJSONText } from './json-values.js';

// Data cleanup helpers: remove duplicate rows, tidy whitespace, split text into columns.
// The functions work on any grid and are undoable as a single step; installDataTools() binds
// them to the demo's buttons and dialogs.

const normalize = range => ({ r1: Math.min(range.r1, range.r2), r2: Math.max(range.r1, range.r2), c1: Math.min(range.c1, range.c2), c2: Math.max(range.c1, range.c2) });
const isFormula = raw => typeof raw === 'string' && raw.startsWith('=');
const isEmpty = raw => raw === '' || raw == null;

/** Rows are compared by displayed value. Dates, JSON and numbers compare by their text form. */
function comparableText(value, matchCase) {
  const text = value instanceof Date ? value.toISOString() : value instanceof JSONValue ? value.toString() : String(value ?? '');
  const trimmed = text.trim();
  return matchCase ? trimmed : trimmed.toLowerCase();
}
function spilledCells(grid, box) {
  return (grid.getSpillRanges?.() ?? []).some(spill => spill.row <= box.r2 && spill.row + spill.rows - 1 >= box.r1 && spill.col <= box.c2 && spill.col + spill.cols - 1 >= box.c1);
}

/**
 * Find rows that repeat an earlier row. Returns zero-based sheet rows, in order:
 * { keep, drop } where keep includes the first occurrence of every distinct row.
 */
export function findDuplicateRows(grid, range, { columns, hasHeader = false, matchCase = false } = {}) {
  const box = normalize(range), first = box.r1 + (hasHeader ? 1 : 0);
  const compared = (columns ?? Array.from({ length: box.c2 - box.c1 + 1 }, (_, i) => box.c1 + i)).filter(c => c >= box.c1 && c <= box.c2);
  const seen = new Set(), keep = [], drop = [];
  for (let row = first; row <= box.r2; row++) {
    const key = JSON.stringify(compared.map(c => comparableText(grid.getComputedValue(row, c), matchCase)));
    if (seen.has(key)) drop.push(row); else { seen.add(key); keep.push(row); }
  }
  return { keep, drop, first, compared };
}

/**
 * Remove repeated rows inside a range. The first occurrence stays, later rows are removed and the rows
 * below move up within the range; the freed rows at the bottom are emptied. Formulas move with their row.
 */
export function removeDuplicateRows(grid, range, options = {}) {
  const box = normalize(range);
  if (grid.readOnly || grid.sqlBinding) return { removed: 0, kept: 0, refused: 'locked' };
  if (spilledCells(grid, box)) return { removed: 0, kept: 0, refused: 'spill' };
  const { keep, drop, first } = findDuplicateRows(grid, box, options);
  if (!drop.length) return { removed: 0, kept: keep.length };
  const outcome = grid.transaction(() => {
    const moved = keep.map(row => Array.from({ length: box.c2 - box.c1 + 1 }, (_, i) => {
      const cell = grid.cells.get(grid.key(row, box.c1 + i));
      return cell ? { ...cell } : null;
    }));
    for (let row = first; row <= box.r2; row++) for (let c = box.c1; c <= box.c2; c++) grid.cells.delete(grid.key(row, c));
    keep.forEach((source, index) => {
      const target = first + index;
      moved[index].forEach((cell, i) => {
        if (!cell) return;
        if (isFormula(cell.raw) && typeof grid.shiftFormula === 'function') cell.raw = grid.shiftFormula(cell.raw, target - source, 0);
        grid.cells.set(grid.key(target, box.c1 + i), cell);
      });
    });
    grid.engine.clearCache(); grid._updateFilteredRows?.(); grid.render(); grid.emit('change', { type: 'dedupe', removed: drop.length });
  });
  if (outcome === false) return { removed: 0, kept: keep.length, refused: 'validation' };
  return { removed: drop.length, kept: keep.length };
}

/** Trim outer spaces, collapse runs of spaces and tabs, and turn non-breaking spaces into ordinary ones. */
export function cleanSpaces(text) {
  return String(text).split('\n').map(line => line.replace(/[ \t   ]+/g, ' ').trim()).join('\n').trim();
}
/** Clean entered text in a range. Formulas, numbers and JSON stay untouched. */
export function trimSpaces(grid, range) {
  const box = normalize(range);
  if (grid.readOnly) return { changed: 0 };
  const changes = [];
  for (const [key, cell] of grid.cells) {
    const raw = cell.raw;
    if (typeof raw !== 'string' || isFormula(raw)) continue;
    const split = key.indexOf(','), row = +key.slice(0, split), col = +key.slice(split + 1);
    if (row < box.r1 || row > box.r2 || col < box.c1 || col > box.c2 || grid.isCellReadOnly?.(row, col)) continue;
    const cleaned = cleanSpaces(raw);
    if (cleaned === raw) continue;
    if (/^[\[{]/.test(raw.trim()) && isJSONText(raw)) continue; // whitespace inside JSON strings is data
    changes.push([row, col, cleaned]);
  }
  if (!changes.length) return { changed: 0 };
  const outcome = grid.transaction(() => { for (const [row, col, value] of changes) grid.setCell(row, col, value); });
  return { changed: outcome === false ? 0 : changes.length, refused: outcome === false ? 'validation' : undefined };
}

/** Split at a single-character delimiter; a quote opens a quoted part when only spaces came before it. */
function splitQuoted(value, delimiter) {
  const parts = [];
  let field = '', quoted = false;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (quoted) { if (ch === '"') { if (value[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += ch; }
    else if (ch === '"' && field.trim() === '') { quoted = true; field = ''; }
    else if (ch === delimiter) { parts.push(field); field = ''; }
    else field += ch;
  }
  parts.push(field);
  return parts;
}
/** Split one text into parts. Quotes keep delimiters together unless the delimiter has several characters. */
export function splitText(text, { delimiter = ',', collapse = false, quotes = true } = {}) {
  const value = String(text ?? '');
  if (!delimiter) return [value];
  let parts = delimiter.length > 1 || !quotes ? value.split(delimiter) : splitQuoted(value, delimiter);
  if (collapse) parts = parts.filter(part => part !== '');
  return parts.length ? parts : [''];
}
/**
 * Split the text in the first column of a range over that column and the columns to its right.
 * Refuses (blocked: true) when a target cell already has content, and changes nothing then.
 */
export function splitTextToColumns(grid, range, options = {}) {
  const box = normalize(range);
  if (grid.readOnly) return { rows: 0, columns: 0, refused: 'locked' };
  const jobs = [];
  for (let row = box.r1; row <= box.r2; row++) {
    if (grid.hiddenRows.has(row) || grid.filteredRows.has(row)) continue;
    const raw = grid.getRawValue(row, box.c1);
    if (typeof raw !== 'string' || isEmpty(raw) || isFormula(raw)) continue;
    const parts = splitText(raw, options);
    if (parts.length > 1) jobs.push({ row, parts });
  }
  if (!jobs.length) return { rows: 0, columns: 0 };
  const width = Math.max(...jobs.map(job => job.parts.length));
  for (const { row, parts } of jobs) {
    for (let i = 1; i < parts.length; i++) {
      const col = box.c1 + i;
      if (grid.isCellReadOnly?.(row, col) || !isEmpty(grid.getRawValue(row, col)) || grid.engine.dependencies.covered.has(grid._calculationKey(grid.key(row, col)))) return { rows: 0, columns: 0, blocked: true };
    }
  }
  const outcome = grid.transaction(() => { for (const { row, parts } of jobs) parts.forEach((part, i) => grid.setCell(row, box.c1 + i, part.trim())); });
  if (outcome === false) return { rows: 0, columns: 0, refused: 'validation' };
  return { rows: jobs.length, columns: width };
}

// ---- demo bindings ----------------------------------------------------------------------------

export function installDataTools({ grid, $, t, notify, selection, showDialog }) {
  const number = (key, values) => Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, value), t(key));
  const single = box => box.r1 === box.r2 && box.c1 === box.c2;
  /** A single cell means "the data around it": the table, or the block of filled cells. */
  function scope() {
    const box = selection();
    if (!single(box)) return box;
    const table = grid.table;
    if (table && box.r1 >= table.r1 && box.r1 <= table.r2 && box.c1 >= table.c1 && box.c1 <= table.c2) return { r1: table.r1, r2: table.r2, c1: table.c1, c2: table.c2 };
    const filled = (r, c) => { const v = grid.getComputedValue(r, c); return v !== '' && v != null; };
    if (!filled(box.r1, box.c1)) return box;
    const region = { ...box };
    const any = (rows, cols) => rows.some(r => cols.some(c => r >= 0 && c >= 0 && r < grid.rowCount && c < grid.colCount && filled(r, c)));
    const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
    for (let guard = 0; guard < 2000; guard++) {
      let grew = false;
      if (region.r1 > 0 && any([region.r1 - 1], range(region.c1 - 1, region.c2 + 1))) { region.r1--; grew = true; }
      if (region.r2 < grid.rowCount - 1 && any([region.r2 + 1], range(region.c1 - 1, region.c2 + 1))) { region.r2++; grew = true; }
      if (region.c1 > 0 && any(range(region.r1 - 1, region.r2 + 1), [region.c1 - 1])) { region.c1--; grew = true; }
      if (region.c2 < grid.colCount - 1 && any(range(region.r1 - 1, region.r2 + 1), [region.c2 + 1])) { region.c2++; grew = true; }
      if (!grew) break;
    }
    return region;
  }
  const label = box => `${toA1(box.r1, box.c1)}:${toA1(box.r2, box.c2)}`;
  const looksLikeHeader = box => {
    if (box.r2 - box.r1 < 1) return false;
    const first = Array.from({ length: box.c2 - box.c1 + 1 }, (_, i) => grid.getComputedValue(box.r1, box.c1 + i));
    const below = Array.from({ length: box.c2 - box.c1 + 1 }, (_, i) => grid.getComputedValue(box.r1 + 1, box.c1 + i));
    return first.every(v => typeof v === 'string' && v !== '') && below.some(v => typeof v !== 'string');
  };

  // ---- duplicates ----
  let dedupeBox = null;
  function fillColumns() {
    const list = $('#dedupeColumns'), header = $('#dedupeHeader').checked;
    const previous = new Map([...list.querySelectorAll('input')].map(input => [Number(input.value), input.checked]));
    list.replaceChildren();
    for (let c = dedupeBox.c1; c <= dedupeBox.c2; c++) {
      const item = document.createElement('label'), input = document.createElement('input'), text = document.createElement('span');
      input.type = 'checkbox'; input.value = String(c); input.checked = previous.get(c) ?? true;
      const name = header ? String(grid.getComputedValue(dedupeBox.r1, c) || '') : '';
      text.textContent = name || `${t('column')} ${colToName(c)}`;
      item.className = 'check'; item.append(input, text); list.append(item);
    }
  }
  function openDedupe() {
    if (grid.readOnly) return;
    dedupeBox = scope();
    if (dedupeBox.r2 - dedupeBox.r1 < 1) { notify(t('dtNeedRange')); return; }
    $('#dedupeIntro').textContent = number('dtDedupeIntro', { range: label(dedupeBox) });
    $('#dedupeHeader').checked = looksLikeHeader(dedupeBox);
    $('#dedupeCase').checked = false;
    $('#dedupeColumns').replaceChildren(); fillColumns();
    showDialog('#dedupeDialog');
  }
  $('#dedupeBtn').onclick = openDedupe;
  $('#dedupeHeader').onchange = fillColumns;
  $('#closeDedupe').onclick = () => $('#dedupeDialog').close();
  $('#dedupeForm').onsubmit = event => {
    event.preventDefault();
    const columns = [...$('#dedupeColumns').querySelectorAll('input:checked')].map(input => Number(input.value));
    if (!columns.length) { notify(t('dtPickColumns')); return; }
    const result = removeDuplicateRows(grid, dedupeBox, { columns, hasHeader: $('#dedupeHeader').checked, matchCase: $('#dedupeCase').checked });
    $('#dedupeDialog').close();
    if (result.refused === 'spill') notify(t('dtHasSpill'));
    else if (result.refused) notify(t('failed'));
    else notify(result.removed ? number('dtDedupeDone', { n: result.removed, m: result.kept }) : t('dtNoDuplicates'));
  };

  // ---- spaces ----
  $('#trimBtn').onclick = () => {
    if (grid.readOnly) return;
    const result = trimSpaces(grid, scope());
    notify(result.changed ? number('dtTrimDone', { n: result.changed }) : t('dtTrimNone'));
  };

  // ---- text to columns ----
  const delimiters = { comma: ',', semicolon: ';', tab: '\t', space: ' ', pipe: '|' };
  const splitOptions = () => ({ delimiter: $('#splitDelimiter').value === 'custom' ? $('#splitCustom').value : delimiters[$('#splitDelimiter').value], collapse: $('#splitCollapse').checked, quotes: $('#splitQuotes').checked });
  let splitBox = null;
  function renderPreview() {
    const custom = $('#splitDelimiter').value === 'custom';
    $('#splitCustom').hidden = !custom;
    const options = splitOptions(), host = $('#splitPreview'), rows = [];
    for (let r = splitBox.r1; r <= splitBox.r2 && rows.length < 5; r++) {
      const raw = grid.getRawValue(r, splitBox.c1);
      if (typeof raw === 'string' && raw && !isFormula(raw)) rows.push(splitText(raw, options));
    }
    const table = document.createElement('table'), body = document.createElement('tbody');
    for (const parts of rows) { const tr = document.createElement('tr'); for (const part of parts.slice(0, 8)) { const td = document.createElement('td'); td.textContent = part; tr.append(td); } body.append(tr); }
    table.append(body); host.replaceChildren(table);
    $('#splitApply').disabled = !rows.some(parts => parts.length > 1) || (custom && !$('#splitCustom').value);
  }
  $('#splitTextBtn').onclick = () => {
    if (grid.readOnly) return;
    const box = scope();
    splitBox = { ...box, c2: box.c1 };
    if (!Array.from({ length: splitBox.r2 - splitBox.r1 + 1 }, (_, i) => grid.getRawValue(splitBox.r1 + i, splitBox.c1)).some(raw => typeof raw === 'string' && raw && !isFormula(raw))) { notify(t('dtSplitNothing')); return; }
    $('#splitIntro').textContent = number('dtSplitIntro', { range: label(splitBox) });
    showDialog('#splitTextDialog'); renderPreview();
  };
  for (const id of ['#splitDelimiter', '#splitCustom', '#splitCollapse', '#splitQuotes']) $(id).addEventListener('input', () => splitBox && renderPreview());
  $('#closeSplitText').onclick = () => $('#splitTextDialog').close();
  $('#splitForm').onsubmit = event => {
    event.preventDefault();
    const result = splitTextToColumns(grid, splitBox, splitOptions());
    if (result.blocked) { notify(t('dtSplitBlocked')); return; }
    $('#splitTextDialog').close();
    notify(result.rows ? number('dtSplitDone', { n: result.columns }) : t('dtSplitNothing'));
  };

  function sync() {
    const locked = grid.readOnly;
    for (const id of ['#dedupeBtn', '#trimBtn', '#splitTextBtn']) $(id).disabled = locked;
  }
  grid.on('readonly', sync); sync();
  return { sync, scope };
}
