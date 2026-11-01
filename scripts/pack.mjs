import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const destination = join(root, "dist");
mkdirSync(destination, { recursive: true });
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const [packed] = JSON.parse(
  execFileSync(npm, ["pack", "--json", "--pack-destination", destination], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    env: { ...process.env, npm_config_cache: join(destination, ".npm-cache") },
  }),
);
writeFileSync(
  join(destination, "package-info.json"),
  JSON.stringify(packed, null, 2) + "\n",
);
console.log(join(destination, packed.filename));
console.log("SHA-512 integrity: " + packed.integrity);
