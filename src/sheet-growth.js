// Add empty space as the user approaches an edge.
// Growth is navigation, so it must not consume an undo step or change selection.
export const sheetLimits = { rows: 10000, columns: 256 };

export function installSheetGrowth(
  grid,
  {
    maxRows = sheetLimits.rows,
    maxColumns = sheetLimits.columns,
    rowStep = 100,
    columnStep = 12,
  } = {},
) {
  if (
    ![maxRows, maxColumns, rowStep, columnStep].every(
      (value) => Number.isSafeInteger(value) && value > 0,
    ) ||
    maxRows > 2000000 ||
    maxColumns > 16384
  )
    throw new TypeError("Invalid sheet growth limits or increments");
  let previousTop = grid.scroll.scrollTop,
    previousLeft = grid.scroll.scrollLeft;
  let frame = null,
    pendingRows = false,
    pendingColumns = false;
  const reset = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    pendingRows = pendingColumns = false;
    previousTop = grid.scroll.scrollTop;
    previousLeft = grid.scroll.scrollLeft;
  };
  const unsubscribe = grid.on("scroll", () => {
    const scroll = grid.scroll,
      top = Math.max(0, scroll.scrollTop),
      left = Math.max(0, scroll.scrollLeft);
    const down = top > previousTop,
      right = left > previousLeft;
    previousTop = top;
    previousLeft = left;
    if (grid.readOnly || grid.sqlBinding || grid._editing) return;
    pendingRows ||=
      down &&
      scroll.scrollHeight - top - scroll.clientHeight <=
        grid.options.rowHeight * 3;
    pendingColumns ||=
      right &&
      scroll.scrollWidth - left - scroll.clientWidth <=
        grid.options.columnWidth;
    if (frame !== null || (!pendingRows && !pendingColumns)) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      const rows =
        pendingRows &&
        scroll.scrollHeight -
          Math.max(0, scroll.scrollTop) -
          scroll.clientHeight <=
          grid.options.rowHeight * 3;
      const columns =
        pendingColumns &&
        scroll.scrollWidth -
          Math.max(0, scroll.scrollLeft) -
          scroll.clientWidth <=
          grid.options.columnWidth;
      pendingRows = pendingColumns = false;
      if (grid.readOnly || grid.sqlBinding || grid._editing) return;
      const rowCount = rows
        ? Math.max(grid.rowCount, Math.min(maxRows, grid.rowCount + rowStep))
        : grid.rowCount;
      const colCount = columns
        ? Math.max(
            grid.colCount,
            Math.min(maxColumns, grid.colCount + columnStep),
          )
        : grid.colCount;
      if (!grid.ensureSize(rowCount, colCount)) return;
      grid.render();
      grid.emit("resize", { type: "sheet", rows: rowCount, columns: colCount });
      grid.emit("mutation", { type: "sheetgrow" });
    });
  });
  const offWorksheet = grid.on("worksheet", reset);
  const offChange = grid.on("change", (detail) => {
    if (["history", "import", "workbookimport"].includes(detail.type)) reset();
  });
  function dispose() {
    reset();
    unsubscribe();
    offWorksheet();
    offChange();
    offDestroy();
  }
  const offDestroy = grid.on("destroy", dispose);
  return { dispose };
}
