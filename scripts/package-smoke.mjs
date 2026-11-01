import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const work = mkdtempSync(join(tmpdir(), "tinygrid-package-"));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const runNpm = (args) =>
  execFileSync(npm, args, {
    cwd: work,
    encoding: "utf8",
    shell: process.platform === "win32",
    env: { ...process.env, npm_config_cache: join(work, "cache") },
  });
try {
  const [packed] = JSON.parse(
    runNpm([
      "pack",
      root,
      "--json",
      "--ignore-scripts",
      "--pack-destination",
      work,
    ]),
  );
  const files = new Set(packed.files.map((file) => file.path));
  for (const path of files) {
    assert.match(
      path,
      /^(src\/|demo\/|docs\/|package\.json$|README\.md$|LICENSE$|CHANGELOG\.md$)/,
    );
    assert.doesNotMatch(
      path,
      /(^|\/)(node_modules|\.git|\.DS_Store|ios-prototype)(\/|$)/,
    );
  }
  for (const entry of Object.values(pkg.exports))
    for (const path of Object.values(entry))
      assert.ok(files.has(path.slice(2)), "Unpacked export: " + path);
  assert.ok(files.has("src/simulation-worker.js"));
  assert.ok(files.has("demo/index.html"));
  assert.ok(files.has("CHANGELOG.md"));
  writeFileSync(
    join(work, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  runNpm([
    "install",
    join(work, packed.filename),
    "--offline",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--package-lock=false",
  ]);
  const specs = Object.keys(pkg.exports).map((key) =>
    key === "." ? pkg.name : pkg.name + key.slice(1),
  );
  writeFileSync(
    join(work, "packed.json"),
    JSON.stringify({ specs, files: [...files] }),
  );
  copyFileSync(
    join(root, "test/package-consumer.mjs"),
    join(work, "consumer.mjs"),
  );
  execFileSync(process.execPath, [join(work, "consumer.mjs")], {
    cwd: work,
    stdio: "inherit",
  });

  // Check every export's declarations and real typed usage from a clean consumer.
  const imports = specs
    .map((spec, i) =>
      spec.endsWith(".css")
        ? "import " + JSON.stringify(spec) + ";"
        : "import * as entry" +
          i +
          " from " +
          JSON.stringify(spec) +
          "; void entry" +
          i +
          ";",
    )
    .join("\n");
  writeFileSync(
    join(work, "consumer.ts"),
    imports +
      "\n" +
      readFileSync(join(root, "test/library-consumer.ts"), "utf8"),
  );
  const config = JSON.parse(
    readFileSync(join(root, "test/tsconfig.json"), "utf8"),
  );
  config.files = ["consumer.ts"];
  writeFileSync(join(work, "tsconfig.json"), JSON.stringify(config));
  const typescriptPath = createRequire(import.meta.url).resolve(
    "typescript/package.json",
  );
  const typescript = JSON.parse(readFileSync(typescriptPath, "utf8"));
  const compiler = join(dirname(typescriptPath), typescript.bin.tsc);
  execFileSync(
    process.execPath,
    [compiler, "-p", join(work, "tsconfig.json")],
    { cwd: work, stdio: "inherit" },
  );
  console.log(
    packed.filename +
      ": " +
      files.size +
      " files, " +
      specs.length +
      " public imports, CSS, workers, SQL and TypeScript passed (" +
      packed.size +
      " bytes)",
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
