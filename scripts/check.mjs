import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
let count = 0;
function check(directory) {
  for (const entry of readdirSync(join(root, directory), {
    withFileTypes: true,
  })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) check(path);
    else if (/\.m?js$/.test(entry.name)) {
      execFileSync(process.execPath, ["--check", path], {
        cwd: root,
        stdio: "inherit",
      });
      count++;
    }
  }
}
for (const directory of ["src", "demo", "test", "scripts", "benchmarks"])
  check(directory);
console.log(`JavaScript syntax checked: ${count} files`);
