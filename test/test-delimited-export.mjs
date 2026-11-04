import assert from "node:assert/strict";
import TinyDatagrid, { stringifyCSV, parseCSV } from "../src/tinygrid.js";
import { exportData } from "../src/exporters.js";

class Model extends TinyDatagrid {
  build() {}
  bind() {}
  render() {}
  renderCells() {}
  layout() {}
  emit(type, detail) {
    for (const listener of this.listeners.get(type) || []) listener(detail);
  }
  setLocale() {
    return this;
  }
}

const strings = [
  "=1+1",
  "+1",
  "-1",
  "@name",
  "  =1+1",
  "\tvalue",
  " \nvalue",
  "＝1+1",
  "＋1",
  "－1",
  "＠name",
  '="a,b"',
  "😀 العربية",
  'a,"b',
  "ordinary",
];
for (const delimiter of [",", ";", "\t"]) {
  const rows = [strings, [-12, 0, 123n, null]];
  const original = stringifyCSV(rows, delimiter);
  assert.deepEqual(parseCSV(original, delimiter)[0], strings);
  const escaped = parseCSV(
    stringifyCSV(rows, delimiter, { escapeFormulas: true }),
    delimiter,
  );
  assert.deepEqual(
    escaped[0],
    strings.map((value, index) => (index < 12 ? "'" + value : value)),
  );
  assert.deepEqual(escaped[1], ["-12", "0", "123", ""]);
  assert.equal(
    stringifyCSV(rows, delimiter, { escapeFormulas: false }),
    original,
  );
}

const grid = new Model({}, { rows: 2, columns: 3 });
grid.setCell(0, 0, "=1+1");
grid.setCell(0, 1, "=1+1", { valueType: "text" });
grid.setCell(0, 2, -12);
grid.setCell(1, 0, "😀 العربية");
for (const format of ["csv", "tsv"]) {
  const delimiter = format === "csv" ? "," : "\t";
  for (const computed of [false, true]) {
    const options = { computed, escapeFormulas: true };
    const sync = grid[format === "csv" ? "exportCSV" : "exportTSV"](options);
    assert.equal(
      await (
        await exportData(grid, { ...options, format, batchSize: 1 })
      ).text(),
      sync,
    );
    assert.deepEqual(
      parseCSV(sync, delimiter)[0],
      computed ? ["2", "'=1+1", "-12"] : ["'=1+1", "'=1+1", "-12"],
    );
  }
}
assert.equal(
  grid.getRawValue(0, 1),
  "=1+1",
  "protection changes only exported text",
);
assert.equal(
  grid.exportCSV(),
  "=1+1,=1+1,-12\r\n😀 العربية,,",
  "existing defaults stay unchanged",
);
console.log(
  "Delimited export: opt-in text protection, numeric values, quoting, Unicode and sync/async parity passed",
);
