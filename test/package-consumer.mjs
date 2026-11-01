// Copied into a clean project by package-smoke.mjs; all imports resolve the tarball.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import TinyDatagrid from "tiny-datagrid";
import { worksheets } from "tiny-datagrid/worksheets";
import { localSQL } from "tiny-datagrid/local-sql";
import { demoWorkbook } from "tiny-datagrid/sample-workbooks";
import {
  lifeStep,
  mandelbrot,
  computeMandelbrot,
} from "tiny-datagrid/simulations";
const { specs, files } = JSON.parse(
  readFileSync(new URL("./packed.json", import.meta.url), "utf8"),
);
for (const spec of specs) {
  if (spec.endsWith(".css"))
    assert.ok(readFileSync(new URL(import.meta.resolve(spec)), "utf8").length);
  else assert.ok(Object.keys(await import(spec)).length, spec);
}
class Model extends TinyDatagrid {
  build() {}
  bind() {}
  renderCells() {}
  layout() {}
  emit() {}
  updateSelectionOverlay() {}
  scrollToCell() {}
  setLocale(locale) {
    this.locale = locale;
    return this;
  }
  render() {
    this.engine.settle();
  }
}
const grid = new Model(
  {},
  { rows: 30, columns: 8, plugins: [worksheets(), localSQL()] },
);
grid.importWorkbook(demoWorkbook("budget"));
const result = grid
  .feature("sql")
  .query("SELECT COUNT(*) FROM table1 LIMIT ?", [1]);
assert.deepEqual(result.rows, [[4]]);
const saved = grid.feature("sql").materialize(result, { sheetName: "Count" });
assert.equal(saved.name, "Count");
assert.deepEqual(grid.feature("sql").query("SELECT * FROM table1").rows, [[4]]);
assert.equal(lifeStep([0, 1, 0, 1], 2, 2).length, 4);
assert.equal(mandelbrot(0, 0, 10), 10);
assert.equal(mandelbrot(3, 0, 10), 1);
await assert.rejects(computeMandelbrot({}, { signal: AbortSignal.abort() }), {
  name: "AbortError",
});
const simulations = new URL(import.meta.resolve("tiny-datagrid/simulations"));
assert.ok(existsSync(new URL("./simulation-worker.js", simulations)));
// Relative imports and worker assets must stay within the installed package.
const packageRoot = new URL(
  "../",
  new URL(import.meta.resolve("tiny-datagrid")),
);
for (const path of files.filter(
  (file) => file.startsWith("src/") && file.endsWith(".js"),
)) {
  const file = new URL(path, packageRoot);
  const source = readFileSync(file, "utf8");
  assert.ok(!source.includes("../demo/"), path);
  for (const match of source.matchAll(
    /(?:from\s*|import\s*(?:\(\s*)?|new URL\(\s*)['"](\.\.?\/[^'"]+)['"]/g,
  )) {
    const target = new URL(match[1], file);
    const reference = path + " -> " + match[1];
    assert.ok(target.href.startsWith(packageRoot.href), reference);
    assert.ok(existsSync(target), reference);
  }
}
