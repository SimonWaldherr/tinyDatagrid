import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
for (const file of readdirSync(new URL("../test/", import.meta.url)).sort())
  if (/^test.*\.mjs$/.test(file))
    execFileSync(process.execPath, [`test/${file}`], {
      cwd: root,
      stdio: "inherit",
    });
execFileSync(process.execPath, ["scripts/formula-overview.mjs", "--check"], {
  cwd: root,
  stdio: "inherit",
});
