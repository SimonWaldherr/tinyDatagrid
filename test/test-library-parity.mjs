import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join, resolve } from "node:path";
import { translator, languages, detectLanguage } from "tiny-datagrid/demo-i18n";
import { demoWorkbook } from "tiny-datagrid/sample-workbooks";
import { inferDataValue } from "tiny-datagrid/data-types";
const root = fileURLToPath(new URL("../", import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const publicFiles = new Set(
  Object.values(pkg.exports)
    .map((entry) => entry.import)
    .filter(Boolean)
    .map((path) => resolve(root, path)),
);

// Every library module used by the demo must have a public, typed npm entry point.
let imports = 0;
function check(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) check(path);
    else if (entry.name.endsWith(".js")) {
      const code = readFileSync(path, "utf8");
      for (const match of code.matchAll(/from\s*["']([^"']+)["']/g)) {
        const target = fileURLToPath(new URL(match[1], pathToFileURL(path)));
        if (target.startsWith(join(root, "src"))) {
          assert.ok(
            publicFiles.has(target),
            "Demo module has no public entry point: " + match[1],
          );
          imports++;
        }
      }
    }
  }
}
check(join(root, "demo"));
assert.ok(imports > 30);
for (const [path, entry] of Object.entries(pkg.exports)) {
  assert.ok(entry.types, "Missing types: " + path);
  if (entry.import) {
    const spec = path === "." ? pkg.name : pkg.name + path.slice(1);
    const api = await import(spec);
    assert.ok(Object.keys(api).length, "Empty public module: " + spec);
  }
}
for (const [old, spec] of [
  ["sql-tools", "sql-tools"],
  ["analysis-tools", "analysis-tools"],
  ["object-browser", "object-browser"],
  ["simulations", "simulation-tools"],
  ["sheet-growth", "sheet-growth"],
  ["autosave", "autosave"],
  ["file-tools", "sample-workbooks"],
  ["i18n", "demo-i18n"],
]) {
  const demo = await import("../demo/" + old + ".js");
  const library = await import("tiny-datagrid/" + spec);
  assert.deepEqual(Object.keys(demo), Object.keys(library));
  for (const key of Object.keys(demo)) assert.equal(demo[key], library[key]);
}
assert.equal(detectLanguage(["zz", "DE-de"]), "de");
assert.equal(
  translator("de-DE")("localSQLRun"),
  translator("de")("localSQLRun"),
);
assert.equal(translator("zz")("close"), translator("en")("close"));
for (const [language] of languages) {
  const t = translator(language);
  for (const key of [
    "localSQLTitle",
    "localSQLRun",
    "analysisScope",
    "sourceRows",
    "simulations",
    "savingLocal",
    "objectTables",
  ])
    assert.notEqual(t(key), key, language + ": " + key);
}
for (const name of [
  "blank",
  "timetable",
  "week",
  "timesheet",
  "comparison",
  "learning",
  "budget",
  "project",
  "inventory",
  "text",
  "json",
  "arrays",
  "geometry",
])
  assert.equal(demoWorkbook(name).format, "tinyDatagrid-workbook");
assert.equal(inferDataValue("00123").type, "text");
console.log(
  "Demo/library parity: " +
    imports +
    " public module imports, shared implementations, types, sample workbooks and translations passed",
);
