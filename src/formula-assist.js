import {
  formulaCatalog,
  formulaDefinition,
  localizedFormulaName,
  resolveFormulaName,
} from "./formula-catalog.js";
import { functionHelp } from "./function-help.js";

// Formula autocomplete and argument hints for any text input or textarea.
//   attachFormulaAssist(grid.editor, grid)            in-cell editor
//   attachFormulaAssist(document.querySelector('#formula'), grid, { language: () => lang })
let sequence = 0;
const cellReference = /^\$?[A-Za-z]{1,3}\$?\d+$/;

function escapeText(text) {
  return text.replace(
    /[&<>]/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch],
  );
}
/** Everything the formula engine can call: documented names, built-ins, feature functions and host callbacks. */
export function formulaNames(grid, language = "en") {
  const functions = grid.engine?.functions || {},
    names = new Set();
  for (const record of formulaCatalog) {
    if (
      record.availability === "core" ||
      typeof functions[record.id] === "function"
    )
      names.add(localizedFormulaName(record.id, language));
  }
  for (const name of Object.keys(functions))
    if (!formulaDefinition(name)) names.add(name);
  for (const feature of grid.engine?._formulaFeatures?.values?.() || [])
    for (const name of feature.functions.keys())
      names.add(localizedFormulaName(name, language));
  return [...names].sort();
}

const searchKey = (value) =>
  String(value).normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
/** Search all accepted names, returning one preferred localized name per operation. */
export function searchFormulaNames(grid, query, language = "en") {
  const needle = searchKey(query),
    names = formulaNames(grid, language),
    starts = [],
    inside = [];
  for (const name of names) {
    const aliases = [name, ...(formulaDefinition(name)?.aliases ?? [])].map(
      searchKey,
    );
    if (aliases.some((alias) => alias.startsWith(needle))) starts.push(name);
    else if (aliases.some((alias) => alias.includes(needle))) inside.push(name);
  }
  return [...starts, ...inside];
}

/** Split a signature such as JSON.GET(json; path; default?) into its name and parameter list. */
export function parseSignature(signature) {
  const open = signature.indexOf("("),
    close = signature.lastIndexOf(")");
  if (open < 0 || close < open) return { name: signature, params: [] };
  return {
    name: signature.slice(0, open),
    params: signature
      .slice(open + 1, close)
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean),
  };
}
/** Describe the formula text before the caret: the word being typed and the call that surrounds it. */
export function analyzeFormula(text, caret) {
  if (!text.startsWith("=")) return null;
  const before = text.slice(0, caret).replace(/"(?:""|[^"])*"/g, '""');
  if (before.includes('"')) return null; // the caret is inside a text literal
  const word = /(@?[\p{L}_][\p{L}\p{M}0-9_.]*)$/u.exec(before);
  let depth = 0,
    argument = 0,
    index = before.length - 1;
  for (; index >= 0; index--) {
    const ch = before[index];
    if (ch === ")") depth++;
    else if (ch === "(") {
      if (!depth) break;
      depth--;
    } else if ((ch === ";" || ch === ",") && !depth) argument++;
  }
  const call =
    index >= 0
      ? /([\p{L}_][\p{L}\p{M}0-9_.]*)\s*$/u.exec(before.slice(0, index))?.[1]
      : null;
  return {
    word: word?.[1] ?? "",
    start: caret - (word?.[1].length ?? 0),
    call: call ? call.toUpperCase() : null,
    argument,
  };
}

export function attachFormulaAssist(input, grid, options = {}) {
  const maxItems = options.maxItems ?? 8,
    id = `tg-assist-${++sequence}`;
  const language = () =>
    typeof options.language === "function"
      ? options.language()
      : (options.language ?? grid.locale ?? "en");
  const popup = document.createElement("div"),
    hint = document.createElement("div"),
    list = document.createElement("ul");
  popup.className = "tg-assist";
  popup.hidden = true;
  popup.id = id;
  hint.className = "tg-assist-hint";
  hint.hidden = true;
  list.className = "tg-assist-list";
  list.setAttribute("role", "listbox");
  popup.append(hint, list);
  grid.el.append(popup);
  const saved = [
    "aria-autocomplete",
    "aria-controls",
    "aria-expanded",
    "aria-activedescendant",
  ].map((name) => [name, input.getAttribute(name)]);
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", id);
  input.setAttribute("aria-expanded", "false");
  let items = [],
    active = 0,
    context = null;

  const info = (name) =>
    functionHelp(name, language(), grid.options?.functionHelp || {});
  let names = [];
  const known = (name) => {
    try {
      const id = resolveFormulaName(name);
      return names.some((candidate) => resolveFormulaName(candidate) === id);
    } catch {
      return false;
    }
  };

  function candidates(word) {
    if (!word || cellReference.test(word)) return [];
    if (word.startsWith("@")) {
      const query = word.slice(1).toLowerCase(),
        names = new Set([
          ...(grid.variables?.keys?.() || []),
          ...(grid.externalVariables?.keys?.() || []),
        ]);
      return [...names]
        .filter(
          (name) =>
            name.toLowerCase().startsWith(query) &&
            name.toLowerCase() !== query,
        )
        .sort()
        .slice(0, maxItems)
        .map((name) => ({ name: `@${name}`, kind: "variable" }));
    }
    return searchFormulaNames(grid, word, language())
      .slice(0, maxItems)
      .map((name) => ({ name, kind: "function" }));
  }
  function renderHint(current) {
    if (!current.call || !known(current.call)) {
      hint.hidden = true;
      return;
    }
    const help = info(current.call),
      { name, params } = parseSignature(help.signature);
    const variadic = params.length && /…$/.test(params.at(-1));
    const focus = params.length
      ? Math.min(current.argument, variadic ? params.length - 1 : params.length)
      : -1;
    hint.innerHTML = `${escapeText(name)}(${params.map((param, index) => (index === focus ? `<b>${escapeText(param)}</b>` : escapeText(param))).join("; ")})<span class="tg-assist-summary">${escapeText(help.description)}</span>`;
    hint.hidden = false;
  }
  function renderList(current) {
    items = candidates(current.word);
    active = Math.min(active, Math.max(0, items.length - 1));
    list.replaceChildren(
      ...items.map((item, index) => {
        const row = document.createElement("li"),
          name = document.createElement("span"),
          text = document.createElement("span");
        row.className = "tg-assist-item";
        row.id = `${id}-${index}`;
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", String(index === active));
        name.className = "tg-assist-name";
        name.textContent = item.name;
        text.className = "tg-assist-desc";
        text.textContent =
          item.kind === "variable" ? "" : info(item.name).description;
        row.append(name, text);
        row.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          accept(index);
        });
        return row;
      }),
    );
    list.hidden = !items.length;
  }
  function place() {
    const rect = input.getBoundingClientRect(),
      width = popup.offsetWidth || 300,
      height = popup.offsetHeight || 0;
    const left = Math.max(8, Math.min(rect.left, innerWidth - width - 8));
    const below = rect.bottom + 4,
      top =
        below + height > innerHeight - 8 && rect.top - height - 4 > 8
          ? rect.top - height - 4
          : below;
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
  }
  function update() {
    if (document.activeElement !== input) {
      close();
      return;
    }
    context = analyzeFormula(input.value, input.selectionStart ?? 0);
    if (!context) {
      close();
      return;
    }
    names = formulaNames(grid, language());
    renderHint(context);
    renderList(context);
    const visible = !hint.hidden || items.length;
    popup.hidden = !visible;
    input.setAttribute("aria-expanded", String(Boolean(items.length)));
    if (items.length)
      input.setAttribute("aria-activedescendant", `${id}-${active}`);
    else input.removeAttribute("aria-activedescendant");
    if (visible) place();
  }
  function close() {
    popup.hidden = true;
    items = [];
    active = 0;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }
  function accept(index = active) {
    const item = items[index];
    if (!item || !context) return;
    const value = input.value,
      caret = input.selectionStart ?? value.length;
    const insert = item.kind === "function" ? `${item.name}(` : item.name;
    input.value = value.slice(0, context.start) + insert + value.slice(caret);
    const position = context.start + insert.length;
    input.setSelectionRange(position, position);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    update();
  }
  function move(step) {
    active = (active + step + items.length) % items.length;
    [...list.children].forEach((row, index) =>
      row.setAttribute("aria-selected", String(index === active)),
    );
    input.setAttribute("aria-activedescendant", `${id}-${active}`);
    list.children[active]?.scrollIntoView({ block: "nearest" });
  }
  function keydown(event) {
    if (grid._formulaReferenceContext?.(input) && /^Arrow/.test(event.key))
      return;
    if (
      popup.hidden ||
      !items.length ||
      event.isComposing ||
      event.shiftKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopImmediatePropagation();
      move(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      event.stopImmediatePropagation();
      accept();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }
  }
  const later = () => requestAnimationFrame(update);
  input.addEventListener("keydown", keydown, true);
  input.addEventListener("input", update);
  input.addEventListener("keyup", (event) => {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
      update();
  });
  input.addEventListener("click", update);
  input.addEventListener("focus", later);
  input.addEventListener("blur", close);
  return {
    update,
    close,
    destroy() {
      input.removeEventListener("keydown", keydown, true);
      input.removeEventListener("input", update);
      input.removeEventListener("click", update);
      input.removeEventListener("focus", later);
      input.removeEventListener("blur", close);
      for (const [name, value] of saved)
        value == null
          ? input.removeAttribute(name)
          : input.setAttribute(name, value);
      popup.remove();
    },
  };
}

/** Connect the demo's searchable function reference and formula dependency inspector. */
export function installFormulaTools({
  grid,
  $,
  t,
  language = () => grid.locale || "en",
  formatValue = (value) => String(value ?? ""),
}) {
  let traceMode = "precedents";
  function showFunction(name) {
    const info = functionHelp(
      name,
      language(),
      grid.options?.functionHelp || {},
    );
    $("#functionSignature").textContent = info.signature;
    $("#functionDescription").textContent = info.description;
  }
  function refreshFunctionHelp() {
    const query = $("#functionSearch").value.toUpperCase(),
      selected = $("#functionList").value;
    const names = searchFormulaNames(grid, query, language());
    $("#functionList").replaceChildren(
      ...names.map((name) => new Option(name, name)),
    );
    if (names.includes(selected)) $("#functionList").value = selected;
    const formula = $("#formula"),
      text = formula.value
        .slice(0, formula.selectionStart)
        .replace(/"(?:""|[^"])*"/g, "");
    const current = [...text.matchAll(/([\p{L}_][\p{L}\p{M}0-9_.]*)\s*\(/gu)]
      .at(-1)?.[1]
      .toUpperCase();
    if (!query && current) {
      try {
        const preferred = localizedFormulaName(current, language());
        if (names.includes(preferred)) $("#functionList").value = preferred;
      } catch {
        /* A partially typed call has no catalog entry yet. */
      }
    }
    if (names.length) showFunction($("#functionList").value);
    else {
      $("#functionSignature").textContent = "";
      $("#functionDescription").textContent = t("noMatches");
    }
  }
  function refreshReferences() {
    grid.el
      .querySelectorAll(".tg-trace")
      .forEach((cell) => cell.classList.remove("tg-trace"));
    if ($("#dependencyPanel").hidden) return;
    const items =
        traceMode === "precedents"
          ? grid.getPrecedents()
          : grid.getDependents(),
      list = $("#referenceList");
    list.replaceChildren();
    for (const item of items) {
      const range =
        traceMode === "precedents"
          ? {
              r1: Math.min(item.a.row, item.b.row),
              r2: Math.max(item.a.row, item.b.row),
              c1: Math.min(item.a.col, item.b.col),
              c2: Math.max(item.a.col, item.b.col),
            }
          : { r1: item.row, r2: item.row, c1: item.col, c2: item.col };
      const button = document.createElement("button");
      button.type = "button";
      button.textContent =
        traceMode === "precedents"
          ? item.text
          : (item.sheet ? `${item.sheet}!` : "") + item.address;
      const worksheets = grid.feature("worksheets");
      const local =
        item.sheetId === (worksheets?.activeId ?? null) &&
        !(item.sheet && item.sheetId == null && traceMode === "precedents");
      button.disabled = !local && !item.sheetId;
      button.onclick = () => {
        if (!local && worksheets && !worksheets.select(item.sheetId)) return;
        grid.goTo(range.r1, range.c1);
        grid.select(range.r2, range.c2, true);
        grid.el.focus({ preventScroll: true });
      };
      list.append(button);
      if (local)
        grid.el.querySelectorAll('[role="gridcell"]').forEach((cell) => {
          const row = Number(cell.dataset.row),
            col = Number(cell.dataset.col);
          if (
            row >= range.r1 &&
            row <= range.r2 &&
            col >= range.c1 &&
            col <= range.c2
          )
            cell.classList.add("tg-trace");
        });
    }
    if (traceMode === "precedents") {
      const formula = String(
        grid.getRawValue(grid.anchor.row, grid.anchor.col),
      ).replace(/"(?:""|[^"])*"/g, "");
      for (const name of new Set(
        [...formula.matchAll(/@([A-Za-z_][A-Za-z0-9_.]*)/g)].map(
          (match) => match[1],
        ),
      )) {
        const span = document.createElement("span");
        span.textContent = `@${name} = ${formatValue(grid.getVariable(name))}`;
        list.append(span);
      }
    }
    if (!list.childNodes.length) list.textContent = t("noReferences");
  }

  $("#formulaHelpBtn").onclick = () => {
    const open = $("#formulaHelpPanel").hidden;
    $("#formulaHelpPanel").hidden = !open;
    $("#formulaHelpBtn").setAttribute("aria-expanded", String(open));
    if (open) refreshFunctionHelp();
  };
  $("#functionSearch").oninput = refreshFunctionHelp;
  $("#functionList").onchange = () => showFunction($("#functionList").value);
  $("#formula").addEventListener("input", () => {
    if (!$("#formulaHelpPanel").hidden) refreshFunctionHelp();
  });
  $("#formula").addEventListener("click", () => {
    if (!$("#formulaHelpPanel").hidden) refreshFunctionHelp();
  });
  $("#traceBtn").onclick = () => {
    const open = $("#dependencyPanel").hidden;
    $("#dependencyPanel").hidden = !open;
    $("#traceBtn").setAttribute("aria-expanded", String(open));
    refreshReferences();
  };
  for (const [id, mode] of [
    ["#precedentsBtn", "precedents"],
    ["#dependentsBtn", "dependents"],
  ])
    $(id).onclick = () => {
      traceMode = mode;
      $("#precedentsBtn").setAttribute(
        "aria-pressed",
        String(mode === "precedents"),
      );
      $("#dependentsBtn").setAttribute(
        "aria-pressed",
        String(mode === "dependents"),
      );
      refreshReferences();
    };
  grid.on("select", refreshReferences);
  grid.on("change", refreshReferences);
  grid.on("move", refreshReferences);
  grid.on("scroll", () => requestAnimationFrame(refreshReferences));
  return { refreshFunctionHelp, refreshReferences };
}
