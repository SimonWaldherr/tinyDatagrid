import { asyncTask } from "./async-task.js";
import {
  gridLimits,
  GridLimitError,
  positiveInteger,
  checkDimensions,
} from "./limits.js";
import { rawText } from "./json-values.js";
import { stringifyCSV, colToName } from "./tinygrid.js";

function writer(maxBytes) {
  positiveInteger(maxBytes, "maxBytes");
  const encoder = new TextEncoder(),
    parts = [];
  let buffer = "",
    bytes = 0;
  function flush() {
    if (!buffer) return;
    const part = encoder.encode(buffer);
    if (bytes + part.length > maxBytes)
      throw new GridLimitError(
        "EXPORT_BYTES",
        maxBytes,
        bytes + part.length,
        "Export exceeds the byte budget; select a smaller range or increase maxBytes.",
      );
    bytes += part.length;
    parts.push(part);
    buffer = "";
  }
  return {
    append(text) {
      buffer += text;
      if (buffer.length >= Math.min(65536, maxBytes - bytes + 1)) flush();
    },
    get bytes() {
      return bytes;
    },
    blob(type) {
      flush();
      return new Blob(parts, { type });
    },
  };
}

// JSON is encoded incrementally instead of stringify() on a complete workbook.
function* jsonTokens(value, ancestors = new Set(), arrayItem = false) {
  if (value && typeof value.toJSON === "function") value = value.toJSON();
  if (typeof value === "bigint") value = String(value);
  if (
    value === undefined ||
    typeof value === "function" ||
    typeof value === "symbol"
  ) {
    if (arrayItem) yield "null";
    return;
  }
  if (!value || typeof value !== "object") {
    yield JSON.stringify(value);
    return;
  }
  if (ancestors.has(value)) throw new TypeError("Cannot export cyclic data");
  ancestors.add(value);
  const array = Array.isArray(value);
  yield array ? "[" : "{";
  let first = true;
  for (const [key, item] of array ? value.entries() : Object.entries(value)) {
    if (
      !array &&
      (item === undefined ||
        typeof item === "function" ||
        typeof item === "symbol")
    )
      continue;
    if (!first) yield ",";
    first = false;
    if (!array) yield JSON.stringify(key) + ":";
    yield* jsonTokens(item, ancestors, array);
  }
  yield array ? "]" : "}";
  ancestors.delete(value);
}

async function encode(value, output, task) {
  let tokens = 0;
  for (const token of jsonTokens(value)) {
    output.append(token);
    if (++tokens % (task.batchSize * 10) === 0)
      await task.yield({ phase: "encode", completed: output.bytes });
  }
}

/** Encode a detached snapshot, also used for bounded local recovery copies. */
export async function workbookBlob(workbook, options = {}) {
  const task = asyncTask({ on: () => () => {} }, options);
  try {
    task.check();
    const output = writer(options.maxBytes ?? gridLimits.exportBytes);
    await encode(workbook, output, task);
    task.check();
    return output.blob("application/json;charset=utf-8");
  } finally {
    task.dispose();
  }
}

const formats = {
  workbook: "application/json",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  json: "application/json",
  html: "text/html",
  markdown: "text/markdown",
};
const escapeHTML = (value) =>
  rawText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** Export without a dense matrix, with cooperative scheduling and explicit budgets. */
export async function exportData(grid, options = {}) {
  const { format = "workbook", signal, onProgress } = options;
  if (!Object.hasOwn(formats, format))
    throw new TypeError("Unknown export format");
  const maxCells = positiveInteger(
    options.maxCells ?? gridLimits.exportCells,
    "maxCells",
  );
  const maxBytes = positiveInteger(
    options.maxBytes ?? gridLimits.exportBytes,
    "maxBytes",
  );
  if (format === "workbook") {
    const workbook = await grid.exportWorkbookAsync({
      signal,
      batchSize: options.batchSize,
      onProgress(progress) {
        if (progress.total > maxCells)
          throw new GridLimitError(
            "EXPORT_CELLS",
            maxCells,
            progress.total,
            "Workbook exceeds the export cell budget",
          );
        onProgress?.(progress);
      },
    });
    return workbookBlob(workbook, {
      signal,
      onProgress,
      maxBytes,
      batchSize: options.batchSize,
    });
  }
  const range = options.range ?? grid.getUsedRange();
  if (
    !range ||
    ![range.r1, range.r2, range.c1, range.c2].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    ) ||
    range.r1 > range.r2 ||
    range.c1 > range.c2
  )
    throw new TypeError("A valid export range is required");
  checkDimensions(range.r2 + 1, range.c2 + 1);
  const total = (range.r2 - range.r1 + 1) * (range.c2 - range.c1 + 1);
  if (total > maxCells)
    throw new GridLimitError(
      "EXPORT_CELLS",
      maxCells,
      total,
      "Export exceeds the cell budget; select a smaller range.",
    );
  const headerRow = options.headerRow ?? range.r1;
  if (
    format === "json" &&
    (!Number.isInteger(headerRow) ||
      headerRow < range.r1 ||
      headerRow > range.r2)
  )
    throw new TypeError("headerRow must be within the export range");
  const task = asyncTask(grid, options),
    output = writer(maxBytes);
  try {
    task.check();
    const computed = options.computed ?? !["csv", "tsv"].includes(format);
    let completed = 0,
      headers,
      records = 0;
    if (format === "html")
      output.append('<!doctype html><meta charset="utf-8"><table><tbody>');
    if (format === "json") output.append("[");
    for (let row = range.r1; row <= range.r2; row++) {
      const values = [];
      for (let col = range.c1; col <= range.c2; col++) {
        values.push(
          computed
            ? grid.getComputedValue(row, col)
            : grid.getRawValue(row, col),
        );
        if (++completed % task.batchSize === 0)
          await task.yield({ phase: "rows", completed, total });
      }
      switch (format) {
        case "csv":
        case "tsv":
          output.append(
            (row === range.r1 ? "" : "\r\n") +
              stringifyCSV(
                [values],
                format === "tsv" ? "\t" : (options.delimiter ?? ","),
                { escapeFormulas: options.escapeFormulas },
              ),
          );
          break;
        case "html":
          output.append(
            "<tr>" +
              values.map((value) => `<td>${escapeHTML(value)}</td>`).join("") +
              "</tr>",
          );
          break;
        case "markdown": {
          const line = values.map((value) =>
            rawText(value).replaceAll("|", "\\|").replace(/\r?\n/g, "<br>"),
          );
          output.append(
            (row === range.r1 ? "" : "\n") + `| ${line.join(" | ")} |`,
          );
          if (row === range.r1)
            output.append("\n| " + values.map(() => "---").join(" | ") + " |");
          break;
        }
        case "json":
          if (row === headerRow)
            headers = values.map((v, i) =>
              String(v || colToName(range.c1 + i)),
            );
          else if (
            row > headerRow &&
            (grid.sqlBinding
              ? grid.sqlBinding.sqlRowIds.has(row)
              : values.some((v) => v !== "" && v != null))
          ) {
            if (records++) output.append(",");
            await encode(
              Object.fromEntries(
                headers.map((header, i) => [
                  header,
                  grid.sqlBinding ? values[i] : (values[i] ?? ""),
                ]),
              ),
              output,
              task,
            );
          }
          break;
      }
    }
    if (format === "html") output.append("</tbody></table>");
    if (format === "json") output.append("]");
    task.report({ phase: "rows", completed, total });
    return output.blob(formats[format] + ";charset=utf-8");
  } finally {
    task.dispose();
  }
}
