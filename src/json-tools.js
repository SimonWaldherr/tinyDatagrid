import { JSONValue, rawText, parseJSONText, stringifyJSON, joinPath, isPlainObject, isJSONContainer, queryJSON } from './json-values.js';
import { toA1 } from './tinygrid.js';

// JSON editor, structure viewer and "expand" tools for cells that hold JSON.
export function installJSONTools({ grid, $, t, notify, showDialog, selection }) {
  const MAX_CHILDREN = 300;
  let target = null, formulaCell = false, parsed, currentPath = '', pending = 0;

  const describe = value => value.isArray ? `${t('jsonArrayInfo')} · ${value.length} ${t('jsonItems')}` : `${t('jsonObjectInfo')} · ${value.length} ${t('jsonKeys')}`;
  const cellJSON = (row, col) => { const value = grid.getComputedValue(row, col); return value instanceof JSONValue ? value : null; };
  const escapeQuotes = text => text.replaceAll('"', '""');
  const isEmpty = (row, col) => { const raw = grid.getRawValue(row, col); return (raw === '' || raw == null) && !grid.engine.dependencies.covered.has(grid._calculationKey(grid.key(row, col))); };

  // ---- status chip and button state ---------------------------------------
  function sync() {
    const { row, col } = grid.anchor, value = cellJSON(row, col), chip = $('#typeStatus');
    chip.hidden = !value;
    if (value) chip.textContent = `JSON · ${describe(value)}`;
    const locked = grid.readOnly;
    $('#jsonEditBtn').disabled = false;
    $('#jsonTableBtn').disabled = locked || !value;
    $('#jsonSplitBtn').disabled = locked;
  }

  // ---- editor dialog ------------------------------------------------------
  function position(text, index) {
    const before = text.slice(0, index).split('\n');
    return { line: before.length, column: before.at(-1).length + 1 };
  }
  function errorMessage(text, error) {
    const at = /position (\d+)/.exec(error.message);
    if (!at) return error.message;
    const { line, column } = position(text, Number(at[1]));
    return `${t('jsonLine')} ${line}, ${t('column')} ${column}`;
  }
  function validate() {
    const text = $('#jsonText').value, status = $('#jsonStatus');
    parsed = undefined;
    if (!text.trim()) { status.textContent = t('jsonEmpty'); status.dataset.state = 'empty'; renderTree(); updateButtons(); return; }
    try {
      parsed = parseJSONText(text);
      status.dataset.state = isJSONContainer(parsed) ? 'valid' : 'scalar';
      status.textContent = isJSONContainer(parsed) ? `${t('jsonValid')} · ${describe(new JSONValue(parsed))}` : t('jsonScalar');
    } catch (error) {
      status.dataset.state = 'invalid';
      status.textContent = `${t('jsonInvalid')} (${errorMessage(text, error)})`;
    }
    renderTree(); updateButtons();
  }
  function updateButtons() {
    const valid = isJSONContainer(parsed), locked = grid.readOnly;
    $('#jsonFormat').disabled = $('#jsonMinify').disabled = parsed === undefined;
    $('#jsonApply').disabled = locked || formulaCell || (!valid && $('#jsonText').value.trim() !== '' && $('#jsonStatus').dataset.state !== 'scalar');
    $('#jsonAsValue').hidden = !formulaCell;
    $('#jsonAsValue').disabled = locked || !valid;
    $('#jsonSaveCompact').disabled = formulaCell;
    $('#jsonText').readOnly = locked || formulaCell;
    $('#jsonCopyPath').disabled = $('#jsonInsertGet').disabled = !target || parsed === undefined || !isJSONContainer(parsed);
    $('#jsonInsertGet').disabled ||= locked;
  }
  const scalarClass = value => value === null ? 'null' : typeof value;
  function valueLabel(value) {
    if (value === null) return 'null';
    return typeof value === 'string' ? JSON.stringify(value.length > 120 ? `${value.slice(0, 120)}…` : value) : String(value);
  }
  function preview(value) {
    if (Array.isArray(value)) return `[…] ${value.length}`;
    return `{…} ${Object.keys(value).length}`;
  }
  function select(element, path) {
    $('#jsonTree').querySelectorAll('.selected').forEach(node => node.classList.remove('selected'));
    element.classList.add('selected');
    currentPath = path;
    $('#jsonPath').textContent = path || '$';
    updateButtons();
  }
  function keySpan(key) {
    const span = document.createElement('span');
    span.className = 'json-key';
    span.textContent = key === null ? '$' : typeof key === 'number' ? `[${key}]` : key;
    return span;
  }
  function node(key, value, path, depth) {
    const container = Array.isArray(value) || isPlainObject(value);
    if (!container) {
      const row = document.createElement('div'), val = document.createElement('span');
      row.className = 'json-node json-leaf'; row.tabIndex = 0; row.setAttribute('role', 'treeitem');
      val.className = `json-value json-${scalarClass(value)}`; val.textContent = valueLabel(value);
      row.append(keySpan(key), Object.assign(document.createElement('span'), { className: 'json-colon', textContent: ':' }), val);
      row.onclick = () => select(row, path);
      row.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(row, path); } };
      return row;
    }
    const details = document.createElement('details'), summary = document.createElement('summary'), info = document.createElement('span');
    details.className = 'json-node'; details.setAttribute('role', 'treeitem');
    info.className = 'json-count'; info.textContent = preview(value);
    summary.append(keySpan(key), info);
    summary.addEventListener('click', () => select(summary, path));
    const fill = () => {
      if (details.dataset.filled) return;
      details.dataset.filled = '1';
      const entries = Array.isArray(value) ? value.map((item, index) => [index, item]) : Object.entries(value);
      const group = document.createElement('div'); group.className = 'json-children'; group.setAttribute('role', 'group');
      for (const [childKey, child] of entries.slice(0, MAX_CHILDREN)) group.append(node(childKey, child, joinPath(path, childKey), depth + 1));
      if (entries.length > MAX_CHILDREN) group.append(Object.assign(document.createElement('div'), { className: 'json-more', textContent: `… ${entries.length - MAX_CHILDREN} ${t('jsonMore')}` }));
      details.append(group);
    };
    details.open = depth < 1;
    details.addEventListener('toggle', () => { if (details.open) fill(); });
    if (details.open) fill();
    details.prepend(summary);
    return details;
  }
  function renderTree() {
    const tree = $('#jsonTree');
    tree.replaceChildren();
    tree.dataset.empty = 'false';
    if (parsed === undefined || !isJSONContainer(parsed)) { tree.dataset.empty = 'true'; tree.textContent = t('jsonNoTree'); currentPath = ''; $('#jsonPath').textContent = ''; return; }
    tree.append(node(null, parsed, '', 0));
    currentPath = ''; $('#jsonPath').textContent = '';
  }
  function schedule() { clearTimeout(pending); pending = setTimeout(validate, 120); }

  function open() {
    const { row, col } = grid.anchor;
    target = { row, col };
    const raw = grid.getRawValue(row, col), computed = grid.getComputedValue(row, col);
    formulaCell = typeof raw === 'string' && raw.startsWith('=');
    let text = formulaCell ? (computed instanceof JSONValue ? stringifyJSON(computed.value, 2) : String(computed ?? '')) : rawText(raw);
    if (!formulaCell) { try { const data = parseJSONText(text); if (isJSONContainer(data)) text = stringifyJSON(data, 2); } catch { /* keep the text as typed */ } }
    $('#jsonCell').textContent = toA1(row, col);
    $('#jsonFormulaNote').hidden = !formulaCell;
    $('#jsonText').value = text;
    showDialog('#jsonDialog');
    validate();
    $('#jsonText').focus({ preventScroll: true });
  }
  function apply(asValue = false) {
    if (!target || grid.readOnly) return;
    let text = $('#jsonText').value;
    if (parsed !== undefined && (asValue || $('#jsonSaveCompact').checked)) text = stringifyJSON(parsed);
    if (grid.setCell(target.row, target.col, text.trim() === '' ? '' : text, { valueType: undefined }) === false) return;
    $('#jsonDialog').close();
    grid.select(target.row, target.col);
    grid.el.focus({ preventScroll: true });
  }
  $('#jsonEditBtn').onclick = open;
  $('#typeStatus').onclick = open;
  $('#jsonText').oninput = schedule;
  $('#jsonFormat').onclick = () => { if (parsed !== undefined) { $('#jsonText').value = stringifyJSON(parsed, 2); validate(); } };
  $('#jsonMinify').onclick = () => { if (parsed !== undefined) { $('#jsonText').value = stringifyJSON(parsed); validate(); } };
  $('#jsonApply').onclick = () => apply(false);
  $('#jsonAsValue').onclick = () => apply(true);
  $('#closeJson').onclick = () => $('#jsonDialog').close();
  $('#jsonCopyPath').onclick = async () => {
    try { await navigator.clipboard.writeText(currentPath || '$'); notify(t('jsonPathCopied')); }
    catch { notify(currentPath || '$'); }
  };
  $('#jsonInsertGet').onclick = () => {
    if (!target) return;
    const { row, col } = target;
    let column = col + 1;
    while (column < col + 40 && !isEmpty(row, column)) column++;
    const formula = `=JSON.GET(${toA1(row, col)};"${escapeQuotes(currentPath)}")`;
    if (grid.setCell(row, column, formula) !== false) { notify(`${t('jsonFormulaInserted')} ${toA1(row, column)}`); grid.select(row, column); }
  };
  $('#jsonDialog').addEventListener('close', () => { clearTimeout(pending); target = null; });

  // ---- expand tools ----------------------------------------------------------
  /** Put a spilling formula where it fits; undo and report when the result is blocked. */
  function placeSpill(formula, preferred) {
    const used = grid.getUsedRange();
    const candidates = [preferred, { row: used.r2 + 2, col: 0 }, { row: 0, col: used.c2 + 2 }];
    for (const spot of candidates) {
      if (!spot || !isEmpty(spot.row, spot.col)) continue;
      if (grid.setCell(spot.row, spot.col, formula) === false) return null;
      const result = grid.getComputedValue(spot.row, spot.col);
      if (typeof result === 'string' && result.startsWith('#SPILL!')) { grid.undo(); continue; }
      return spot;
    }
    return null;
  }
  $('#jsonTableBtn').onclick = () => {
    if (grid.readOnly) return;
    const { row, col } = grid.anchor;
    if (!cellJSON(row, col)) { notify(t('jsonNeedsJson')); return; }
    const used = grid.getUsedRange();
    const spot = placeSpill(`=JSON.TABLE(${toA1(row, col)};"";TRUE;TRUE)`, { row, col: used.c2 + 2 });
    if (!spot) { notify(t('jsonNoRoom')); return; }
    grid.goTo(spot.row, spot.col);
    notify(`${t('jsonTableInserted')} ${toA1(spot.row, spot.col)}`);
  };
  $('#jsonSplitBtn').onclick = () => {
    if (grid.readOnly) return;
    const s = selection(), keys = new Set();
    let found = 0;
    for (let r = s.r1; r <= s.r2; r++) {
      const value = cellJSON(r, s.c1);
      if (value && !value.isArray) { found++; for (const key of Object.keys(value.value)) keys.add(key); }
      if (keys.size > 40) break;
    }
    if (!found) { notify(t('jsonNeedsObjects')); return; }
    const names = [...keys].slice(0, 40), lastCol = s.c1 + names.length, firstCol = s.c1 + 1;
    for (let r = Math.max(0, s.r1 - 1); r <= s.r1; r++) for (let c = firstCol; c <= lastCol; c++) if (!isEmpty(r, c)) { notify(t('jsonSplitBlocked')); return; }
    const source = `${toA1(s.r1, s.c1)}:${toA1(s.r2, s.c1)}`;
    grid.transaction(() => {
      names.forEach((name, index) => {
        if (s.r1 > 0) grid.setCell(s.r1 - 1, firstCol + index, name);
        grid.setCell(s.r1, firstCol + index, `=JSON.GET(${source};"${escapeQuotes(joinPath('', name))}";"")`);
      });
    });
    for (const [index] of names.entries()) { const result = grid.getComputedValue(s.r1, firstCol + index); if (typeof result === 'string' && result.startsWith('#SPILL!')) { grid.undo(); notify(t('jsonNoRoom')); return; } }
    notify(`${t('jsonSplitDone')} ${names.length}`);
  };
  // keep the resolver reachable for tests and other tools
  return { sync, open, queryJSON };
}
