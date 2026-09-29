function palette(grid) {
  const style = getComputedStyle(grid.el);
  return {
    background: style.getPropertyValue('--tg-bg').trim() || '#fff',
    header: style.getPropertyValue('--tg-table').trim() || '#eaf3ee',
    banded: style.getPropertyValue('--tg-banded').trim() || '#f7faf8',
    text: style.getPropertyValue('--tg-text').trim() || '#243532',
    border: style.getPropertyValue('--tg-border').trim() || '#ccd5d0',
    fontFamily: style.fontFamily || 'system-ui, sans-serif',
    fontSize: parseFloat(style.fontSize) || 13
  };
}

function visibleRange(grid, range = grid.getUsedRange()) {
  if (!range || !['r1', 'r2', 'c1', 'c2'].every(key => Number.isInteger(range[key]) && range[key] >= 0) || range.r1 > range.r2 || range.c1 > range.c2 || range.r2 >= grid.rowCount || range.c2 >= grid.colCount) {
    throw new TypeError('A valid cell range is required');
  }
  const rows = [], cols = [];
  for (let row = range.r1; row <= range.r2; row++) {
    if (!grid.hiddenRows.has(row) && !grid.filteredRows.has(row)) rows.push(row);
  }
  for (let col = range.c1; col <= range.c2; col++) {
    if (!grid.hiddenColumns.has(col)) cols.push(col);
  }
  if (!rows.length || !cols.length) throw new Error('No visible cells in the selected range');
  return { rows, cols };
}

function cellView(grid, row, col, colors) {
  const cell = grid.getCell(row, col), value = grid.getComputedValue(row, col);
  const condition = grid.feature?.('conditionalFormatting')?.cellStyle(row, col, value) || {};
  const header = grid.table?.headerRow === row;
  const banded = grid.table?.style === 'banded' && row > grid.table.headerRow && (row - grid.table.headerRow) % 2 === 0;
  const style = { ...cell.style, ...condition };
  return {
    text: grid.formatValue(value, cell.numberFormat),
    background: style.backgroundColor || (header ? colors.header : banded ? colors.banded : colors.background),
    color: style.color || colors.text,
    fontWeight: style.fontWeight || 'normal',
    fontStyle: style.fontStyle || 'normal',
    fontSize: parseFloat(style.fontSize) || colors.fontSize,
    fontFamily: style.fontFamily || colors.fontFamily,
    textAlign: style.textAlign || (typeof value === 'number' || typeof value === 'bigint' ? 'right' : 'left')
  };
}

/** Render the visible cells in a range to a PNG Blob, including the active grid theme. */
export function exportPNG(grid, range = grid?.getUsedRange(), { scale = 2, maxPixels = 16_000_000 } = {}) {
  if (!grid?.getComputedValue || !grid?.getCell) throw new TypeError('exportPNG expects a tinyDatagrid instance');
  if (!Number.isFinite(scale) || scale <= 0 || scale > 4) throw new RangeError('Scale must be between 0 and 4');
  const { rows, cols } = visibleRange(grid, range), colors = palette(grid);
  const width = cols.reduce((sum, col) => sum + grid.colWidths[col], 0);
  const height = rows.reduce((sum, row) => sum + grid.rowHeights[row], 0);
  if (width * height * scale * scale > maxPixels || width * scale > 16_000 || height * scale > 16_000) {
    throw new RangeError('PNG too large; select a smaller range.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * scale); canvas.height = Math.ceil(height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.scale(scale, scale);
  context.fillStyle = colors.background; context.fillRect(0, 0, width, height);
  let y = 0;
  for (const row of rows) {
    let x = 0; const rowHeight = grid.rowHeights[row];
    for (const col of cols) {
      const colWidth = grid.colWidths[col], view = cellView(grid, row, col, colors);
      context.save(); context.beginPath(); context.rect(x, y, colWidth, rowHeight); context.clip();
      context.fillStyle = view.background; context.fillRect(x, y, colWidth, rowHeight);
      context.strokeStyle = colors.border; context.lineWidth = 0.5; context.strokeRect(x, y, colWidth, rowHeight);
      context.fillStyle = view.color; context.font = `${view.fontStyle} ${view.fontWeight} ${view.fontSize}px ${view.fontFamily}`;
      context.textBaseline = 'top'; context.textAlign = ['left', 'center', 'right'].includes(view.textAlign) ? view.textAlign : 'left';
      const textX = view.textAlign === 'right' ? x + colWidth - 7 : view.textAlign === 'center' ? x + colWidth / 2 : x + 7;
      const lineHeight = view.fontSize * 1.3;
      view.text.split(/\r?\n/).forEach((line, index) => context.fillText(line, textX, y + 6 + index * lineHeight, Math.max(0, colWidth - 14)));
      context.restore(); x += colWidth;
    }
    y += rowHeight;
  }
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG export failed')), 'image/png'));
}

/** Open a print-ready view of a range. The browser can save its print dialog as PDF. */
export function printPDF(grid, range = grid?.getUsedRange()) {
  if (!grid?.getComputedValue || !grid?.getCell) throw new TypeError('printPDF expects a tinyDatagrid instance');
  const { rows, cols } = visibleRange(grid, range), colors = palette(grid);
  if (rows.length * cols.length > 50_000) throw new RangeError('Print range too large; select a smaller range.');
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Please allow the print window.');
  try {
    popup.opener = null;
    const doc = popup.document; doc.title = grid.sheetName;
    const css = doc.createElement('style');
    css.textContent = `@page{size:A4 landscape;margin:12mm}body{font:${colors.fontSize}px ${colors.fontFamily};color:${colors.text};background:white}h1{font-size:16px}table{border-collapse:collapse;width:100%;table-layout:fixed}td,th{border:1px solid ${colors.border};padding:5px;white-space:pre-wrap;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}th{background:${colors.header};text-align:left}@media print{button{display:none}}`;
    doc.head.append(css);
    const heading = doc.createElement('h1'); heading.textContent = grid.sheetName; doc.body.append(heading);
    const table = doc.createElement('table'), head = doc.createElement('thead'), body = doc.createElement('tbody');
    table.append(head, body); doc.body.append(table);
    for (const row of rows) {
      const tr = doc.createElement('tr'), header = grid.table?.headerRow === row;
      for (const col of cols) {
        const view = cellView(grid, row, col, colors), td = doc.createElement(header ? 'th' : 'td');
        td.textContent = view.text; td.style.backgroundColor = view.background; td.style.color = view.color;
        td.style.fontWeight = view.fontWeight; td.style.fontStyle = view.fontStyle; td.style.fontSize = `${view.fontSize}px`; td.style.fontFamily = view.fontFamily; td.style.textAlign = view.textAlign;
        tr.append(td);
      }
      (header ? head : body).append(tr);
    }
    popup.focus(); popup.setTimeout(() => popup.print(), 150);
  } catch (error) {
    popup.close(); throw error;
  }
}
