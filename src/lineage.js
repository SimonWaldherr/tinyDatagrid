import { references, containsReference } from "./references.js";

const inside = (ref, row, col) => containsReference(ref, row, col);
const address = (row, col) => {
  let name = "";
  for (let n = col + 1; n; n = Math.floor((n - 1) / 26))
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return `${name}${row + 1}`;
};

/** Portable provenance, separate from the formula recalculation graph. */
export function checkedLineage(lineage) {
  if (lineage == null) return undefined;
  if (
    !lineage ||
    typeof lineage.kind !== "string" ||
    !lineage.kind.trim() ||
    !Array.isArray(lineage.sources) ||
    lineage.sources.length > 10000
  )
    throw new TypeError("Invalid cell lineage");
  const sources = lineage.sources.map((source) => {
    if (
      !source ||
      !(source.sheetId === null || typeof source.sheetId === "string") ||
      !["r1", "r2", "c1", "c2"].every(
        (k) => Number.isSafeInteger(source[k]) && source[k] >= 0,
      ) ||
      source.r2 < source.r1 ||
      source.c2 < source.c1
    )
      throw new TypeError("Invalid lineage source");
    return {
      sheetId: source.sheetId,
      r1: source.r1,
      r2: source.r2,
      c1: source.c1,
      c2: source.c2,
    };
  });
  return {
    kind: lineage.kind,
    sources,
    ...(typeof lineage.query === "string" ? { query: lineage.query } : {}),
  };
}

export function sourceLineage(grid, source, kind, query) {
  return checkedLineage({
    kind,
    query,
    sources: [
      {
        sheetId: grid.feature?.("worksheets")?.activeId ?? null,
        ...source,
      },
    ],
  });
}

function rangeReference(source, kind, documents) {
  const sheet = documents.find((d) => d.id === source.sheetId)?.name;
  const a = { row: source.r1, col: source.c1, ac: "", ar: "" };
  const b = { row: source.r2, col: source.c2, ac: "", ar: "" };
  const range = a.row !== b.row || a.col !== b.col;
  const text = `${sheet ? `'${sheet.replaceAll("'", "''")}'!` : ""}${address(a.row, a.col)}${range ? ":" + address(b.row, b.col) : ""}`;
  return { a, b, range, sheet, sheetId: source.sheetId, text, kind };
}

function cellReferences(grid, document, row, col, documents) {
  const cell = document.cells.get(`${row},${col}`);
  const ws = grid.feature("worksheets");
  if (
    cell?.valueType !== "text" &&
    typeof cell?.raw === "string" &&
    cell.raw.startsWith("=")
  )
    document.read?.(row, col);
  const refs =
    cell?.valueType === "text"
      ? []
      : references(cell?.raw).map((ref) => ({
          ...ref,
          kind: "formula",
          sheetId: ref.sheet ? (ws?.resolve(ref.sheet) ?? null) : document.id,
        }));
  const lineage = checkedLineage(cell?.lineage);
  for (const source of lineage?.sources || [])
    refs.push(rangeReference(source, lineage.kind, documents));
  if (cell?.pivotOwner) {
    const pivot = document.pivotTables?.find((p) => p.id === cell.pivotOwner);
    if (pivot)
      refs.push(
        rangeReference(
          { sheetId: document.id, ...pivot.source },
          "pivot",
          documents,
        ),
      );
  }
  // Spill cells point at their formula origin, including origins on inactive worksheets.
  const key = ws
    ? JSON.stringify([document.id, `${row},${col}`])
    : `${row},${col}`;
  if (
    cell?.valueType !== "text" &&
    typeof cell?.raw === "string" &&
    cell.raw.startsWith("=")
  )
    for (const dependency of grid.engine.dependencies.reads.get(key) || []) {
      let id = null,
        cellKey = dependency;
      if (ws) {
        try {
          [id, cellKey] = JSON.parse(dependency);
        } catch {
          continue;
        }
      }
      if (typeof cellKey !== "string" || !/^\d+,\d+$/.test(cellKey)) continue;
      const [r, c] = cellKey.split(",").map(Number);
      if (!refs.some((ref) => ref.sheetId === id && inside(ref, r, c)))
        refs.push(
          rangeReference(
            { sheetId: id, r1: r, r2: r, c1: c, c2: c },
            "formula",
            documents,
          ),
        );
    }
  const origin = grid.engine.dependencies.covered.get(key);
  if (origin && origin !== key) {
    const cellKey = ws ? JSON.parse(origin)[1] : origin;
    const [r, c] = cellKey.split(",").map(Number);
    if (Number.isInteger(r) && Number.isInteger(c))
      refs.push(
        rangeReference(
          { sheetId: document.id, r1: r, r2: r, c1: c, c2: c },
          "spill",
          documents,
        ),
      );
  }
  return refs;
}
const refKey = (ref) =>
  JSON.stringify([
    ref.sheetId,
    ref.sheetId == null ? ref.sheet : null,
    ref.a.row,
    ref.a.col,
    ref.b.row,
    ref.b.col,
  ]);

export function tracePrecedents(grid, row, col, { recursive = false } = {}) {
  grid.getCalculationValue(row, col);
  const documents = grid._referenceDocuments();
  const id = grid.feature("worksheets")?.activeId ?? null;
  const current = documents.find((d) => d.id === id);
  const pending = cellReferences(grid, current, row, col, documents);
  const out = [],
    seen = new Set(),
    cells = new Set([JSON.stringify([id, row, col])]);
  for (let i = 0; i < pending.length; i++) {
    const ref = pending[i],
      key = refKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
    if (!recursive || (ref.sheet && ref.sheetId == null)) continue;
    const document = documents.find((d) => d.id === ref.sheetId);
    if (!document) continue;
    for (const [cellKey] of document.cells) {
      const [r, c] = cellKey.split(",").map(Number);
      const visited = JSON.stringify([document.id, r, c]);
      if (cells.has(visited) || !inside(ref, r, c)) continue;
      cells.add(visited);
      pending.push(...cellReferences(grid, document, r, c, documents));
    }
  }
  return out;
}

function* documentCells(grid, document) {
  yield* document.cells;
  const ws = grid.feature("worksheets");
  for (const key of grid.engine.dependencies.covered.keys()) {
    const [id, cellKey] = ws ? JSON.parse(key) : [null, key];
    if (id === document.id && !document.cells.has(cellKey)) yield [cellKey, {}];
  }
}

export function traceDependents(grid, row, col, { recursive = false } = {}) {
  grid.feature("pivots")?.refresh();
  const documents = grid._referenceDocuments();
  const id = grid.feature("worksheets")?.activeId ?? null;
  const nodes = [];
  for (const document of documents)
    for (const [key, cell] of documentCells(grid, document)) {
      const [r, c] = key.split(",").map(Number);
      const refs = cellReferences(grid, document, r, c, documents);
      if (refs.length) nodes.push({ document, cell, row: r, col: c, refs });
    }
  const remaining = new Set(nodes);
  const pending = [{ sheetId: id, row, col }],
    seen = new Set([JSON.stringify([id, row, col])]),
    out = [];
  for (let i = 0; i < pending.length; i++) {
    const source = pending[i];
    for (const node of remaining) {
      const key = JSON.stringify([node.document.id, node.row, node.col]);
      if (seen.has(key)) continue;
      const ref = node.refs.find(
        (ref) =>
          ref.sheetId === source.sheetId &&
          !(ref.sheet && ref.sheetId == null) &&
          inside(ref, source.row, source.col),
      );
      if (!ref) continue;
      seen.add(key);
      remaining.delete(node);
      const item = {
        sheetId: node.document.id,
        sheet: node.document.name,
        row: node.row,
        col: node.col,
        address: address(node.row, node.col),
        formula: typeof node.cell.raw === "string" ? node.cell.raw : "",
        kind: ref.kind,
      };
      out.push(item);
      if (recursive) pending.push(item);
    }
  }
  return out;
}
