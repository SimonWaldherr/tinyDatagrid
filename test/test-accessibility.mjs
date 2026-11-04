import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import TinyDatagrid from "../src/tinygrid.js";

const read = (name) => readFileSync(new URL(name, import.meta.url), "utf8");
const demo = read("../demo/demo.css"),
  core = read("../src/tinygrid.css"),
  themes = read("../src/themes.css");
function tokens(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = css.match(new RegExp(escaped + "\\s*\\{([^}]+)\\}"));
  assert.ok(block, `Missing palette: ${selector}`);
  return Object.fromEntries(
    [...block[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map(
      ([, key, value]) => [key, value.trim()],
    ),
  );
}
// WCAG 2.2 relative luminance; compare unrounded ratios to avoid accepting
// values that only round up to the required threshold.
function luminance(hex) {
  assert.match(hex, /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i);
  hex = hex.slice(1);
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
  return [0.2126, 0.7152, 0.0722].reduce((sum, weight, i) => {
    const c = parseInt(hex.slice(i * 2, i * 2 + 2), 16) / 255;
    return (
      sum + weight * (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    );
  }, 0);
}
function contrast(a, b) {
  const [dark, light] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (light + 0.05) / (dark + 0.05);
}
const base = tokens(demo, ":root"),
  baseGrid = tokens(core, ".tg-root");
let comparisons = 0;
for (const name of [
  "light",
  "dark",
  "ocean",
  "paper",
  "midnight",
  "graphite",
  "contrast",
]) {
  const ui = {
    ...base,
    ...(name === "light" ? {} : tokens(demo, `:root[data-theme="${name}"]`)),
  };
  const grid = {
    ...baseGrid,
    ...(name === "light"
      ? {}
      : tokens(themes, `.tg-root[data-theme="${name}"]`)),
  };
  const check = (palette, fg, bg, minimum) => {
    const ratio = contrast(palette[fg], palette[bg]);
    comparisons++;
    assert.ok(
      ratio >= minimum,
      `${name}: ${fg}/${bg} = ${ratio.toFixed(3)}, needs ${minimum}`,
    );
  };
  for (const bg of ["panel", "surface", "tint"]) {
    for (const fg of ["text", "muted", "accent"]) check(ui, fg, bg, 4.5);
    check(ui, "control-border", bg, 3);
  }
  for (const bg of ["accent", "accent-hover"]) check(ui, "on-accent", bg, 4.5);
  for (const bg of [
    "tg-bg",
    "tg-panel",
    "tg-header",
    "tg-hover",
    "tg-table",
    "tg-banded",
  ]) {
    check(grid, "tg-text", bg, 4.5);
    check(grid, "tg-muted", bg, 4.5);
    check(grid, "tg-accent", bg, 4.5);
  }
  for (const bg of ["tg-bg", "tg-panel"]) check(grid, "tg-input-border", bg, 3);
  check(grid, "tg-error", "tg-error-bg", 4.5);
}

// Scroll containers can gain a browser-generated tab stop even without a
// tabindex attribute. Navigation must stay on the grid's managed focus target.
const { window, document } = parseHTML(
  "<html><body><div id='grid'></div></body></html>",
);
Object.assign(globalThis, {
  window,
  document,
  CustomEvent: window.CustomEvent,
});
class View extends TinyDatagrid {
  bind() {}
  render() {}
  layout() {}
}
const grid = new View(document.querySelector("#grid"), { rows: 4, columns: 3 });
assert.equal(grid.el.getAttribute("role"), "grid");
assert.equal(grid.el.getAttribute("tabindex"), "0");
assert.equal(grid.scroll.getAttribute("tabindex"), "-1");
assert.equal(
  grid.fillHandle.getAttribute("tabindex"),
  "0",
  "keyboard fill remains available",
);
grid.destroy();
console.log(
  `Accessibility: ${comparisons} theme contrast pairs and managed grid tab stops passed`,
);
