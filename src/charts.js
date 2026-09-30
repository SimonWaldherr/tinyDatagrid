import { includesAnalysisRow } from './analysis.js';
import { toA1 } from './tinygrid.js';

// Charts from the current selection: column, stacked column, bar, line, area and pie.
// The SVG is self-contained (resolved colors, no CSS classes) so it can be exported as SVG or PNG.
const SVG = 'http://www.w3.org/2000/svg';
const MAX_ROWS = 200, MAX_SERIES = 8, MAX_SLICES = 6;
const FONT = 'system-ui,-apple-system,"Segoe UI",sans-serif';
const W = 720, H = 380;

const isNumber = value => typeof value === 'number' && Number.isFinite(value);
const numberOf = value => isNumber(value) ? value : typeof value === 'bigint' ? Number(value) : null;
function el(name, attributes = {}, text) {
  const node = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attributes)) if (value != null) node.setAttribute(key, String(value));
  if (text != null) node.textContent = text;
  return node;
}
function niceScale(min, max, count = 5) {
  if (!(max > min)) { if (max === 0 && min === 0) return { min: 0, max: 1, step: 0.2, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] }; const pad = Math.abs(max) * 0.1 || 1; min -= pad; max += pad; }
  const raw = (max - min) / count, magnitude = 10 ** Math.floor(Math.log10(raw)), fraction = raw / magnitude;
  const step = (fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10) * magnitude;
  const low = Math.floor(min / step + 1e-9) * step, high = Math.ceil(max / step - 1e-9) * step, ticks = [];
  for (let value = low; value <= high + step / 2; value += step) ticks.push(Math.abs(value) < step / 1e6 ? 0 : Number(value.toPrecision(12)));
  return { min: low, max: high, step, ticks };
}
function roundedColumn(x, y, width, height, radius, up) {
  const r = Math.max(0, Math.min(radius, width / 2, height));
  if (up) return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
  return `M${x},${y}H${x + width}V${y + height - r}Q${x + width},${y + height} ${x + width - r},${y + height}H${x + r}Q${x},${y + height} ${x},${y + height - r}Z`;
}
function roundedRow(x, y, width, height, radius, right) {
  const r = Math.max(0, Math.min(radius, height / 2, width));
  if (right) return `M${x},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height - r}Q${x + width},${y + height} ${x + width - r},${y + height}H${x}Z`;
  return `M${x + width},${y}H${x + r}Q${x},${y} ${x},${y + r}V${y + height - r}Q${x},${y + height} ${x + r},${y + height}H${x + width}Z`;
}
const clip = (text, length) => text.length > length ? `${text.slice(0, length - 1)}…` : text;
const textWidth = (text, size = 12) => text.length * size * 0.56 + 2;

export function installCharts({ grid, $, t, notify, selection, getLanguage = () => grid.locale || 'en', getAnalysis = () => ({scope:'visible'}), onSelect }) {
  let explicitRange=null;
  let model = null, type = 'column', tableView = false, active = -1, colors = null, format = null, axisFormat = null;
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
  document.body.append(probe);
  const fallbacks = { '--panel': 'var(--tg-panel,#fff)', '--text': 'var(--tg-text,#243532)', '--muted': 'var(--tg-muted,#586d67)', '--line': 'var(--tg-border,#dce3e3)' };
  const token = name => { probe.style.color = `var(${name},${fallbacks[name] || 'transparent'})`; return getComputedStyle(probe).color; };

  // ---- reading the selection ------------------------------------------------
  const visibleRows = (r1, r2, col) => { const rows = []; for (let r = r1; r <= r2; r++) if (r===r1 || (getAnalysis().scope==='visible'&&grid.isTableRowVisible?grid.isTableRowVisible(r,col):includesAnalysisRow(grid,r,getAnalysis()))) rows.push(r); return rows; };
  const visibleCols = (c1, c2) => { const cols = []; for (let c = c1; c <= c2; c++) if (!grid.hiddenColumns.has(c)) cols.push(c); return cols; };
  const filled = (r, c) => { const v = grid.getComputedValue(r, c); return v !== '' && v != null; };
  function region() {
    let { r1, r2, c1, c2 } = selection();
    if (r1 !== r2 || c1 !== c2) return { r1, r2, c1, c2 };
    const table=grid.tableAt?.(r1,c1);if(table)return {r1:table.headerRow,c1:table.c1,r2:table.r2,c2:table.c2};
    if (!filled(r1, c1)) return { r1, r2, c1, c2 };
    const box = { r1, r2, c1, c2 };
    const any = (rows, cols) => rows.some(r => cols.some(c => r >= 0 && c >= 0 && r < grid.rowCount && c < grid.colCount && filled(r, c)));
    const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
    for (let guard = 0; guard < 2000; guard++) {
      let grew = false;
      if (box.r1 > 0 && any([box.r1 - 1], range(box.c1 - 1, box.c2 + 1))) { box.r1--; grew = true; }
      if (box.r2 < grid.rowCount - 1 && any([box.r2 + 1], range(box.c1 - 1, box.c2 + 1))) { box.r2++; grew = true; }
      if (box.c1 > 0 && any(range(box.r1 - 1, box.r2 + 1), [box.c1 - 1])) { box.c1--; grew = true; }
      if (box.c2 < grid.colCount - 1 && any(range(box.r1 - 1, box.r2 + 1), [box.c2 + 1])) { box.c2++; grew = true; }
      if (!grew || (box.r2 - box.r1) * (box.c2 - box.c1) > 200000) break;
    }
    return box;
  }
  function detect(matrix) {
    const columns = matrix[0]?.length ?? 0;
    const bodyNumeric = column => matrix.slice(1).some(row => numberOf(row[column]) != null);
    const headerCandidates = matrix[0]?.map((value, column) => typeof value === 'string' && value !== '' && numberOf(value) == null && bodyNumeric(column)) ?? [];
    const firstIsText = matrix.slice(1).some(row => typeof row[0] === 'string' && row[0] !== '') || matrix.slice(1).some(row => row[0] instanceof Date);
    const header = columns > 0 && matrix.length > 1 && (headerCandidates.some(Boolean) || (columns > 1 && matrix[0].slice(1).every(v => typeof v === 'string' && numberOf(v) == null) && matrix.slice(1).some(row => row.slice(1).some(v => numberOf(v) != null))));
    const years = matrix.slice(header ? 1 : 0).map(row => row[0]);
    const sequence = years.length > 2 && years.every(v => Number.isInteger(v)) && years.every((v, i) => i === 0 || v > years[i - 1]);
    return { header, labels: columns > 1 && (firstIsText || sequence) };
  }
  function build(overrides = {}) {
    const table=grid.table;
    const box = explicitRange|| (getAnalysis().scope==='selection'&&table?{r1:table.headerRow,c1:table.c1,r2:table.r2,c2:table.c2}:region());
    if((box.r2-box.r1+1)*(box.c2-box.c1+1)>500000){notify(t('analysisTooLarge'));return null;}
    let rows = visibleRows(box.r1, box.r2,box.c1);const cols = visibleCols(box.c1, box.c2);
    let matrix = rows.map(r => cols.map(c => grid.getComputedValue(r, c)));
    if (!matrix.length || !cols.length) return null;
    const guess = detect(matrix);
    const header = overrides.header ?? guess.header, labels = overrides.labels ?? guess.labels;
    if(!header&&!(getAnalysis().scope==='visible'&&grid.isTableRowVisible?grid.isTableRowVisible(rows[0],box.c1):includesAnalysisRow(grid,rows[0],getAnalysis()))){rows=rows.slice(1);matrix=matrix.slice(1);}
    const body = matrix.slice(header ? 1 : 0), truncated = body.length > MAX_ROWS, data = body.slice(0, MAX_ROWS);
    const seriesColumns = cols.map((_, index) => index).filter(index => !(labels && index === 0) && data.some(row => numberOf(row[index]) != null));
    if (!data.length || !seriesColumns.length) return { box, empty: true, guess, header, labels };
    const categories = data.map((row, index) => labels ? categoryLabel(row[0]) : String(index + 1));
    const series = seriesColumns.slice(0, MAX_SERIES).map((index, order) => ({
      name: header && matrix[0][index] !== '' && matrix[0][index] != null ? String(matrix[0][index]) : `${t('chartSeries')} ${order + 1}`,
      values: data.map(row => numberOf(row[index]))
    }));
    return { box, sourceRows:rows.slice(header?1:0, (header?1:0)+MAX_ROWS), sourceColumn:cols[0], guess, header, labels, categories, series, truncated, extraSeries: seriesColumns.length - series.length, title: grid.sheetName };
  }
  const categoryLabel = value => value instanceof Date ? value.toLocaleDateString(getLanguage()) : String(value ?? '');

  // ---- drawing ----------------------------------------------------------------
  function palette() {
    const series = Array.from({ length: 8 }, (_, i) => token(`--viz-${i + 1}`));
    return { series, other: token('--viz-other'), surface: token('--panel'), ink: token('--text'), muted: token('--muted'), grid: token('--line'), axis: token('--viz-axis') };
  }
  function legend(root, entries, top) {
    let position = 0;
    // Rows of key + label; identity comes from the colored key, the text stays in ink.
    let x = 0, y = top;
    const items = entries.map(entry => ({ ...entry, width: (type === 'line' ? 22 : 14) + textWidth(entry.name) + 18 }));
    const group = el('g', { role: 'list' });
    for (const item of items) {
      if (x + item.width > W - 30 && x > 0) { x = 0; y += 20; }
      const g = el('g', { transform: `translate(${30 + x},${y})`, role: 'listitem' }), texture = position++ % 4;
      if (type === 'line') g.append(el('line', { x1: 0, x2: 16, y1: 6, y2: 6, stroke: item.color, 'stroke-width': 2, 'stroke-linecap': 'round', 'data-line': texture, 'data-tex': texture }));
      else g.append(el('rect', { x: 0, y: 1, width: 10, height: 10, rx: 2, fill: item.color, 'data-key': texture, 'data-tex': texture }));
      g.append(el('text', { x: type === 'line' ? 22 : 16, y: 10.5, 'font-size': 12, fill: colors.ink, 'font-family': FONT }, item.name));
      group.append(g); x += item.width;
    }
    root.append(group);
    return y + 18;
  }
  function render() {
    const stage = $('#chartPlot');
    stage.replaceChildren(); $('#chartTooltip').hidden = true; active = -1;
    if (!model || model.empty) { stage.textContent = t('chartNoData'); $('#chartNote').textContent = ''; return; }
    colors = palette();
    const language = getLanguage();
    format = new Intl.NumberFormat(language, { maximumFractionDigits: 2 });
    axisFormat = new Intl.NumberFormat(language, { notation: 'compact', maximumFractionDigits: 1 });
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': summary(), preserveAspectRatio: 'xMidYMid meet' });
    svg.style.maxWidth = '100%'; svg.style.height = 'auto';
    svg.append(el('title', {}, model.title), el('rect', { width: W, height: H, fill: colors.surface }));
    // Texture channel for forced-colors/print: only 45°/135° hatching, four spacings (see demo.css).
    const defs = el('defs');
    [[45, 5], [135, 5], [45, 9], [135, 9]].forEach(([angle, gap], i) => {
      const pattern = el('pattern', { id: `viz-tex-${i}`, width: gap, height: gap, patternUnits: 'userSpaceOnUse', patternTransform: `rotate(${angle})` });
      pattern.append(el('rect', { width: gap, height: gap, fill: 'Canvas' }), el('line', { x1: 0, y1: 0, x2: 0, y2: gap, stroke: 'CanvasText', 'stroke-width': 2 }));
      defs.append(pattern);
    });
    svg.append(defs);
    const many = model.series.length > 1 || type === 'pie';
    const entries = type === 'pie' ? pieSlices().map((slice, i) => ({ name: slice.name, color: slice.color })) : model.series.map((s, i) => ({ name: s.name, color: colors.series[i] }));
    const top = many ? legend(svg, entries, 10) : 12;
    const frame = { top: top + 8 };
    if (type === 'pie') drawPie(svg, frame); else drawCartesian(svg, frame);
    stage.append(svg);
    const notes = [];
    if (model.truncated) notes.push(t('chartTruncated').replace('{n}', MAX_ROWS));
    if (model.extraSeries > 0) notes.push(t('chartExtraSeries').replace('{n}', MAX_SERIES));
    if (type === 'pie' && model.pieFolded) notes.push(`${model.pieFolded} ${t('chartFolded')}`);
    if (type === 'pie' && model.series.length > 1) notes.push(t('chartPieFirst'));
    $('#chartNote').textContent = notes.join(' ');
    renderTable();
  }
  const summary = () => `${model.title}: ${model.series.map(s => s.name).join(', ')} (${model.categories.length})`;

  function drawCartesian(svg, frame) {
    const horizontal = type === 'bar', stacked = type === 'stack', bars = type === 'column' || type === 'stack' || type === 'bar', n = model.categories.length;
    const values = model.series.flatMap(s => s.values).filter(v => v != null);
    // Stacked bars sum per category; others use the raw range. Bars and areas start at zero.
    let low, high;
    if (stacked) { const pos = Array(n).fill(0), neg = Array(n).fill(0); model.series.forEach(s => s.values.forEach((v, i) => { if (v > 0) pos[i] += v; else if (v < 0) neg[i] += v; })); low = Math.min(0, ...neg); high = Math.max(0, ...pos); }
    else { low = Math.min(...values); high = Math.max(...values); if (bars || type === 'area' || low > 0 && low < high * 0.5) low = Math.min(0, low); if (bars || type === 'area') high = Math.max(0, high); }
    const scale = niceScale(low, high);
    const labelSize = Math.max(...scale.ticks.map(v => axisFormat.format(v).length)) * 6.6 + 10;
    const categoryWidth = horizontal ? Math.min(150, Math.max(...model.categories.map(c => textWidth(clip(c, 22)))) + 10) : 0;
    // Line ends get a direct label when few series end apart from each other.
    const endValues = model.series.map(s => { for (let i = s.values.length - 1; i >= 0; i--) if (s.values[i] != null) return { i, v: s.values[i] }; return null; });
    const direct = type === 'line' && model.series.length > 1 && model.series.length <= 4;
    const left = horizontal ? categoryWidth + 6 : labelSize + 8, bottom = horizontal ? 30 : 44;
    let right = 22;
    const plot = { left, top: frame.top, height: H - frame.top - bottom };
    plot.width = W - left - right;
    let directLabels = null;
    if (direct) {
      const y = v => plot.top + plot.height * (1 - (v - scale.min) / (scale.max - scale.min));
      const placed = endValues.map((end, i) => end && { y: y(end.v), name: model.series[i].name, index: i }).filter(Boolean).sort((a, b) => a.y - b.y);
      if (placed.every((p, i) => i === 0 || p.y - placed[i - 1].y >= 14)) { directLabels = placed; right = Math.min(150, Math.max(...placed.map(p => textWidth(clip(p.name, 18))))) + 34; plot.width = W - left - right; }
    }
    const xOf = i => horizontal ? 0 : bars || n === 1 ? plot.left + plot.width * (i + 0.5) / n : plot.left + plot.width * i / (n - 1);
    const yOf = v => horizontal ? 0 : plot.top + plot.height * (1 - (v - scale.min) / (scale.max - scale.min));
    const valueX = v => plot.left + plot.width * (v - scale.min) / (scale.max - scale.min);
    const bandY = i => plot.top + plot.height * i / n;

    // grid and axes (hairlines, solid, recessive)
    const gridLayer = el('g', { 'font-family': FONT, 'font-size': 11 });
    for (const tick of scale.ticks) {
      if (horizontal) {
        const x = valueX(tick);
        gridLayer.append(el('line', { x1: x, x2: x, y1: plot.top, y2: plot.top + plot.height, stroke: tick === 0 ? colors.axis : colors.grid, 'stroke-width': 1 }));
        gridLayer.append(el('text', { x, y: plot.top + plot.height + 16, 'text-anchor': 'middle', fill: colors.muted }, axisFormat.format(tick)));
      } else {
        const y = yOf(tick);
        gridLayer.append(el('line', { x1: plot.left, x2: plot.left + plot.width, y1: y, y2: y, stroke: tick === 0 ? colors.axis : colors.grid, 'stroke-width': 1 }));
        gridLayer.append(el('text', { x: plot.left - 8, y: y + 3.5, 'text-anchor': 'end', fill: colors.muted }, axisFormat.format(tick)));
      }
    }
    // category labels, thinned so they never collide
    const per = horizontal ? Math.max(1, Math.ceil(n / Math.floor(plot.height / 16))) : Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plot.width / 72))));
    model.categories.forEach((name, i) => {
      if (i % per) return;
      if (horizontal) gridLayer.append(el('text', { x: plot.left - 8, y: bandY(i) + plot.height / n / 2 + 4, 'text-anchor': 'end', fill: colors.muted }, clip(name, 22)));
      else gridLayer.append(el('text', { x: xOf(i), y: plot.top + plot.height + 18, 'text-anchor': 'middle', fill: colors.muted }, clip(name, Math.max(4, Math.floor(plot.width / n * per / 6.2)))));
    });
    svg.append(gridLayer);

    const marks = el('g');
    const hits = [];
    if (bars) {
      const band = (horizontal ? plot.height : plot.width) / n, groups = stacked ? 1 : model.series.length;
      const thickness = Math.max(2, Math.min(24, (band * 0.72 - (groups - 1) * 2) / groups));
      const baseline = horizontal ? valueX(0) : yOf(0);
      const positive = Array(n).fill(0), negative = Array(n).fill(0);
      model.series.forEach((s, si) => {
        s.values.forEach((v, i) => {
          if (v == null) return;
          const center = horizontal ? bandY(i) + band / 2 : xOf(i);
          const offset = stacked ? -thickness / 2 : -(groups * thickness + (groups - 1) * 2) / 2 + si * (thickness + 2);
          let from = 0, to = v;
          if (stacked) { if (v >= 0) { from = positive[i]; positive[i] += v; to = positive[i]; } else { from = negative[i]; negative[i] += v; to = negative[i]; } }
          const last = stacked && (v >= 0 ? model.series.slice(si + 1).every(o => !(o.values[i] > 0)) : model.series.slice(si + 1).every(o => !(o.values[i] < 0)));
          const gap = stacked && from !== 0 ? 1 : 0, tipGap = stacked && !last ? 1 : 0;
          let path;
          if (horizontal) {
            const a = valueX(from) + (v >= 0 ? gap : -gap), b = valueX(to) - (v >= 0 ? tipGap : -tipGap), x = Math.min(a, b), width = Math.abs(b - a);
            path = width > 0 ? roundedRow(x, center + offset, width, thickness, !stacked || last ? 4 : 0, v >= 0) : '';
          } else {
            const a = yOf(from) + (v >= 0 ? -gap : gap), b = yOf(to) + (v >= 0 ? tipGap : -tipGap), y = Math.min(a, b), height = Math.abs(b - a);
            path = height > 0 ? roundedColumn(center + offset, y, thickness, height, !stacked || last ? 4 : 0, v >= 0) : '';
          }
          if (path) marks.append(el('path', { d: path, fill: colors.series[si], 'data-series': si, 'data-tex': si % 4, 'data-index': i }));
        });
      });
      // hit bands: the whole category is the target, larger than any bar
      for (let i = 0; i < n; i++) hits.push(horizontal ? { x: plot.left, y: bandY(i), width: plot.width, height: band, index: i } : { x: plot.left + band * i, y: plot.top, width: band, height: plot.height, index: i });
      if (model.series.length === 1) {
        // Selective label: only the largest value, at the tip when there is room.
        const s = model.series[0], peak = s.values.reduce((best, v, i) => v != null && (best < 0 || Math.abs(v) > Math.abs(s.values[best])) ? i : best, -1);
        if (peak >= 0) {
          const v = s.values[peak];
          if (horizontal) marks.append(el('text', { x: Math.min(valueX(v) + 6, plot.left + plot.width - 4), y: bandY(peak) + band / 2 + 4, 'font-size': 11, 'font-family': FONT, 'font-weight': 600, fill: colors.ink, 'text-anchor': valueX(v) + 6 > plot.left + plot.width - 40 ? 'end' : 'start' }, format.format(v)));
          else marks.append(el('text', { x: xOf(peak), y: (v >= 0 ? yOf(v) - 6 : yOf(v) + 14), 'font-size': 11, 'font-family': FONT, 'font-weight': 600, fill: colors.ink, 'text-anchor': 'middle' }, format.format(v)));
        }
      }
    } else {
      model.series.forEach((s, si) => {
        const segments = []; let current = [];
        s.values.forEach((v, i) => { if (v == null) { if (current.length) segments.push(current); current = []; } else current.push([xOf(i), yOf(v)]); });
        if (current.length) segments.push(current);
        for (const segment of segments) {
          const d = segment.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
          if (type === 'area' && segment.length > 1) marks.append(el('path', { d: `${d}L${segment.at(-1)[0].toFixed(1)},${yOf(Math.max(0, scale.min)).toFixed(1)}L${segment[0][0].toFixed(1)},${yOf(Math.max(0, scale.min)).toFixed(1)}Z`, fill: colors.series[si], 'fill-opacity': 0.1 }));
          marks.append(el('path', { d, fill: 'none', stroke: colors.series[si], 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'data-line': si, 'data-tex': si % 4 }));
          if (segment.length === 1) marks.append(el('circle', { cx: segment[0][0], cy: segment[0][1], r: 4, fill: colors.series[si], stroke: colors.surface, 'stroke-width': 2 }));
        }
        const end = endValues[si];
        if (end) marks.append(el('circle', { cx: xOf(end.i), cy: yOf(end.v), r: 4, fill: colors.series[si], stroke: colors.surface, 'stroke-width': 2 }));
      });
      if (directLabels) for (const label of directLabels) marks.append(el('text', { x: plot.left + plot.width + 12, y: label.y + 4, 'font-size': 12, 'font-family': FONT, fill: colors.ink }, clip(label.name, 18)));
      else if (model.series.length === 1 && endValues[0]) marks.append(el('text', { x: xOf(endValues[0].i), y: yOf(endValues[0].v) - 10, 'font-size': 11, 'font-family': FONT, 'font-weight': 600, fill: colors.ink, 'text-anchor': endValues[0].i === 0 ? 'start' : 'end' }, format.format(endValues[0].v)));
      const step = n > 1 ? plot.width / (n - 1) : plot.width;
      for (let i = 0; i < n; i++) hits.push({ x: xOf(i) - step / 2, y: plot.top, width: step, height: plot.height, index: i });
    }
    svg.append(marks);
    const cross = el('g', { 'data-role': 'cursor', visibility: 'hidden' });
    svg.append(cross);
    const overlay = el('g', { 'data-role': 'hits', fill: 'transparent' });
    for (const hit of hits) overlay.append(el('rect', { x: hit.x, y: hit.y, width: Math.max(1, hit.width), height: Math.max(1, hit.height), 'data-index': hit.index }));
    svg.append(overlay);
    model.geometry = { horizontal, bars, plot, xOf, yOf, bandY, valueX, n, cross };
  }

  // ---- pie ---------------------------------------------------------------------
  function pieSlices() {
    const series = model.series[0];
    let items = model.categories.map((name, i) => ({ name, value: series.values[i], index: i })).filter(item => item.value != null && item.value > 0);
    model.pieFolded = 0;
    if (items.length > MAX_SLICES) {
      const keep = new Set([...items].sort((a, b) => b.value - a.value).slice(0, MAX_SLICES - 1).map(item => item.index));
      const rest = items.filter(item => !keep.has(item.index));
      items = items.filter(item => keep.has(item.index));
      items.push({ name: t('chartOther'), value: rest.reduce((sum, item) => sum + item.value, 0), index: -1, other: true });
      model.pieFolded = rest.length;
    }
    const total = items.reduce((sum, item) => sum + item.value, 0);
    let slot = 0;
    return items.map(item => ({ ...item, total, share: item.value / total, color: item.other ? colors.other : colors.series[slot++] }));
  }
  function drawPie(svg, frame) {
    const slices = pieSlices();
    model.slices = slices;
    if (!slices.length) { svg.append(el('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', fill: colors.muted, 'font-family': FONT, 'font-size': 13 }, t('chartNoData'))); return; }
    const cx = W / 2, cy = frame.top + (H - frame.top) / 2, radius = Math.min(150, (H - frame.top - 60) / 2, (W - 260) / 2), inner = radius * 0.58;
    let angle = -Math.PI / 2;
    const marks = el('g');
    const point = (a, r) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    slices.forEach((slice, index) => {
      const sweep = slice.share * Math.PI * 2, start = angle, end = angle + sweep, large = sweep > Math.PI ? 1 : 0;
      const [x1, y1] = point(start, radius), [x2, y2] = point(end, radius), [x3, y3] = point(end, inner), [x4, y4] = point(start, inner);
      const d = slices.length === 1
        ? `M${cx},${cy - radius}A${radius},${radius} 0 1 1 ${cx - 0.01},${cy - radius}L${cx - 0.01},${cy - inner}A${inner},${inner} 0 1 0 ${cx},${cy - inner}Z`
        : `M${x1},${y1}A${radius},${radius} 0 ${large} 1 ${x2},${y2}L${x3},${y3}A${inner},${inner} 0 ${large} 0 ${x4},${y4}Z`;
      marks.append(el('path', { d, fill: slice.color, stroke: colors.surface, 'stroke-width': 2, 'data-slice': index, 'data-tex': index % 4, tabindex: 0, role: 'img', 'aria-label': `${slice.name}: ${format.format(slice.value)} (${Math.round(slice.share * 100)} %)` }));
      // selective labels: only slices that are large enough, outside the ring in ink
      if (slice.share >= 0.06) {
        const mid = start + sweep / 2, [lx, ly] = point(mid, radius + 16), right = Math.cos(mid) >= 0;
        marks.append(el('text', { x: lx, y: ly + 4, 'text-anchor': right ? 'start' : 'end', 'font-size': 12, 'font-family': FONT, fill: colors.ink }, `${clip(slice.name, 16)} · ${Math.round(slice.share * 100)} %`));
      }
      angle = end;
    });
    svg.append(marks);
    svg.append(el('text', { x: cx, y: cy - 2, 'text-anchor': 'middle', 'font-family': FONT, 'font-size': 22, 'font-weight': 600, fill: colors.ink }, axisFormat.format(slices[0].total)));
    svg.append(el('text', { x: cx, y: cy + 16, 'text-anchor': 'middle', 'font-family': FONT, 'font-size': 11, fill: colors.muted }, t('chartTotal')));
  }

  // ---- hover layer -------------------------------------------------------------
  const tooltip = () => $('#chartTooltip');
  function showTooltip(lines, clientX, clientY) {
    const box = tooltip(), stage = $('#chartStage').getBoundingClientRect();
    box.replaceChildren();
    const head = document.createElement('div'); head.className = 'viz-tip-head'; head.textContent = lines.title; box.append(head);
    for (const row of lines.rows) {
      const item = document.createElement('div'), key = document.createElement('span'), value = document.createElement('strong'), name = document.createElement('span');
      item.className = 'viz-tip-row'; key.className = 'viz-tip-key'; key.style.background = row.color; if (type === 'line' || type === 'area') key.classList.add('line');
      value.textContent = row.value; name.textContent = row.name;
      item.append(key, value, name); box.append(item);
    }
    box.hidden = false;
    const width = box.offsetWidth, height = box.offsetHeight;
    let x = clientX - stage.left + 14, y = clientY - stage.top + 14;
    if (x + width > stage.width - 4) x = clientX - stage.left - width - 14;
    if (y + height > stage.height - 4) y = Math.max(4, stage.height - height - 4);
    box.style.left = `${Math.max(4, x)}px`; box.style.top = `${Math.max(4, y)}px`;
    $('#chartLive').textContent = `${lines.title}: ${lines.rows.map(row => `${row.name} ${row.value}`).join(', ')}`;
  }
  function activate(index, clientX, clientY) {
    const g = model.geometry; if (!g || index < 0 || index >= g.n) return;
    active = index;
    const rows = model.series.map((s, i) => s.values[index] == null ? null : { color: colors.series[i], name: s.name, value: format.format(s.values[index]) }).filter(Boolean);
    const svg = $('#chartPlot svg');
    svg.querySelectorAll('[data-series]').forEach(mark => mark.setAttribute('opacity', mark.dataset.index == index || !g.bars ? 1 : 0.55));
    g.cross.replaceChildren();
    if (!g.bars) {
      g.cross.append(el('line', { x1: g.xOf(index), x2: g.xOf(index), y1: g.plot.top, y2: g.plot.top + g.plot.height, stroke: colors.axis, 'stroke-width': 1 }));
      model.series.forEach((s, i) => { if (s.values[index] != null) g.cross.append(el('circle', { cx: g.xOf(index), cy: g.yOf(s.values[index]), r: 4, fill: colors.series[i], stroke: colors.surface, 'stroke-width': 2 })); });
    }
    g.cross.setAttribute('visibility', 'visible');
    if (clientX == null) { const box = svg.getBoundingClientRect(), scale = box.width / W; clientX = box.left + (g.horizontal ? g.plot.left + g.plot.width / 2 : g.xOf(index)) * scale; clientY = box.top + (g.horizontal ? g.bandY(index) : g.plot.top) * scale; }
    showTooltip({ title: model.categories[index], rows }, clientX, clientY);
  }
  function deactivate() {
    active = -1; tooltip().hidden = true;
    const svg = $('#chartPlot svg'); if (!svg) return;
    svg.querySelectorAll('[data-series]').forEach(mark => mark.removeAttribute('opacity'));
    svg.querySelector('[data-role="cursor"]')?.setAttribute('visibility', 'hidden');
    svg.querySelectorAll('[data-slice]').forEach(mark => mark.removeAttribute('transform'));
  }
  function activateSlice(index, clientX, clientY) {
    const slice = model.slices?.[index]; if (!slice) return; active=index;
    $('#chartPlot svg').querySelectorAll('[data-slice]').forEach(mark => mark.setAttribute('opacity', Number(mark.dataset.slice) === index ? 1 : 0.6));
    if (clientX == null) { const box = $('#chartPlot svg').getBoundingClientRect(); clientX = box.left + box.width / 2; clientY = box.top + box.height / 2; }
    showTooltip({ title: slice.name, rows: [{ color: slice.color, name: `${Math.round(slice.share * 1000) / 10} %`, value: format.format(slice.value) }] }, clientX, clientY);
  }
  function wire() {
    const plot = $('#chartPlot');
    plot.onpointermove = event => {
      if (!model || model.empty) return;
      const target = event.target;
      if (type === 'pie') { const slice = target.closest?.('[data-slice]'); if (slice) activateSlice(Number(slice.dataset.slice), event.clientX, event.clientY); else { deactivate(); plot.querySelectorAll('[data-slice]').forEach(mark => mark.removeAttribute('opacity')); } return; }
      const hit = target.closest?.('[data-role="hits"] rect'); if (hit) activate(Number(hit.dataset.index), event.clientX, event.clientY);
    };
    plot.onpointerleave = () => { deactivate(); plot.querySelectorAll('[data-slice]').forEach(mark => mark.removeAttribute('opacity')); };
    const choose=index=>{if(type==='pie')index=model.slices?.[index]?.index;if(onSelect&&model?.sourceRows[index]!=null)onSelect({row:model.sourceRows[index],column:model.sourceColumn})};
    plot.onclick=event=>{const hit=event.target.closest?.('[data-role="hits"] rect, [data-slice]');if(hit)choose(Number(hit.dataset.index??hit.dataset.slice))};
    plot.onkeydown = event => {
      if(event.key==='Enter'&&active>=0){event.preventDefault();choose(active);return;}
      if (!model || model.empty) return;
      const count = type === 'pie' ? model.slices.length : model.geometry.n;
      const next = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (event.key === 'Escape') { deactivate(); return; }
      if (next === undefined && event.key !== 'Home' && event.key !== 'End') return;
      event.preventDefault();
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : (active < 0 ? (next > 0 ? 0 : count - 1) : (active + next + count) % count);
      active = index;
      if (type === 'pie') activateSlice(index); else activate(index);
    };
    plot.onblur = () => deactivate();
  }

  // ---- table twin ---------------------------------------------------------------
  function renderTable() {
    const host = $('#chartTable'); host.replaceChildren();
    if (!model || model.empty) return;
    const table = document.createElement('table'), head = document.createElement('thead'), body = document.createElement('tbody'), caption = document.createElement('caption');
    caption.textContent = `${model.title} · ${toA1(model.box.r1, model.box.c1)}:${toA1(model.box.r2, model.box.c2)}`;
    const headRow = document.createElement('tr');
    for (const name of ['', ...model.series.map(s => s.name)]) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = name; headRow.append(th); }
    head.append(headRow);
    model.categories.forEach((category, i) => {
      const row = document.createElement('tr'), th = document.createElement('th'); th.scope = 'row'; th.textContent = category; row.append(th);
      for (const s of model.series) { const td = document.createElement('td'); td.textContent = s.values[i] == null ? '' : format.format(s.values[i]); row.append(td); }
      body.append(row);
    });
    table.append(caption, head, body); host.append(table);
  }
  function applyView() {
    $('#chartPlot').hidden = tableView; $('#chartTable').hidden = !tableView;
    $('#chartTableBtn').setAttribute('aria-pressed', String(tableView));
  }

  // ---- export -------------------------------------------------------------------
  function serialize() {
    const svg = $('#chartPlot svg'); if (!svg) return null;
    const copy = svg.cloneNode(true);
    copy.querySelector('[data-role="hits"]')?.remove(); copy.querySelector('[data-role="cursor"]')?.remove();
    copy.removeAttribute('style'); copy.setAttribute('width', W); copy.setAttribute('height', H);
    return new XMLSerializer().serializeToString(copy);
  }
  function download(name, blob) {
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const fileName = extension => `${(model?.title || 'chart').replace(/[\\/:*?"<>|]/g, '-')}.${extension}`;
  function saveSVG() { const text = serialize(); if (text) download(fileName('svg'), new Blob([text], { type: 'image/svg+xml;charset=utf-8' })); }
  function savePNG() {
    const text = serialize(); if (!text) return;
    const image = new Image(), url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml;charset=utf-8' }));
    image.onload = () => {
      const canvas = document.createElement('canvas'); canvas.width = W * 2; canvas.height = H * 2;
      const context = canvas.getContext('2d'); context.scale(2, 2); context.drawImage(image, 0, 0, W, H);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => blob && download(fileName('png'), blob), 'image/png');
    };
    image.onerror = () => { URL.revokeObjectURL(url); notify(t('failed')); };
    image.src = url;
  }

  // ---- dialog -------------------------------------------------------------------
  function refresh(overrides) {
    model = build(overrides);
    $('#chartRange').textContent = model ? `${toA1(model.box.r1, model.box.c1)}:${toA1(model.box.r2, model.box.c2)} · ${t('scope'+({visible:'Visible',all:'All',selection:'Selection'}[getAnalysis().scope||'visible']))}` : '';
    if (model && !model.empty) { $('#chartHeader').checked = model.header; $('#chartLabels').checked = model.labels; }
    $('#chartHeader').disabled = $('#chartLabels').disabled = !model;
    $('#chartType').disabled = $('#chartTableBtn').disabled = $('#chartSvg').disabled = $('#chartPng').disabled = !model || model.empty;
    render(); applyView();
  }
  function open(options={}) {
    if(grid.commitEdit()===false)return;explicitRange=options.range?{...options.range}:null;if(options.chartType)type=options.chartType;
    $('#chartType').value = type; tableView = false;
    $('#chartDialog').showModal();
    refresh();rememberChart();
    $('#chartPlot').focus({ preventScroll: true });
  }
  function rememberChart(){if(model&&!model.empty&&!grid.readOnly&&grid.saveVisualization&&!grid.visualizations.some(v=>v.chartType===type&&['r1','r2','c1','c2'].every(k=>v.range[k]===model.box[k])))grid.saveVisualization({name:`${grid.sheetName} · ${type}`,range:model.box,chartType:type});}
  $('#chartBtn').onclick = ()=>open();
  $('#closeChart').onclick = () => $('#chartDialog').close();
  $('#chartType').onchange = () => { type = $('#chartType').value; render(); applyView();rememberChart(); };
  $('#chartHeader').onchange = () => refresh({ header: $('#chartHeader').checked, labels: $('#chartLabels').checked });
  $('#chartLabels').onchange = () => refresh({ header: $('#chartHeader').checked, labels: $('#chartLabels').checked });
  $('#chartTableBtn').onclick = () => { tableView = !tableView; applyView(); };
  $('#chartSvg').onclick = saveSVG;
  $('#chartPng').onclick = savePNG;
  $('#chartDialog').addEventListener('close', () => { tooltip().hidden = true; });
  let refreshTimer;
  const unsubscribers=['change','filter','analysis','worksheet'].map(event=>grid.on(event,()=>{clearTimeout(refreshTimer);if($('#chartDialog').open)refreshTimer=setTimeout(()=>{if($('#chartDialog').open)refresh()},80)}));
  wire();
  return { open, refresh, dispose(){clearTimeout(refreshTimer);unsubscribers.forEach(off=>off?.());probe.remove()} };
}
