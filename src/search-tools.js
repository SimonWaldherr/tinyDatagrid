// Search bar with options, regular expressions, and replace (Ctrl/Cmd+F, Ctrl+H).
export function installSearch({
  grid,
  $,
  t,
  notify,
  selection,
  language = () => grid.locale || "en",
}) {
  let matches = [],
    index = -1,
    replaceVisible = false,
    invalid = false,
    disposed = false,
    returnFocus = null;
  const offs = [];
  const on = (element, type, listener) => {
    element.addEventListener(type, listener);
    offs.push(() => element.removeEventListener(type, listener));
  };
  function formats() {
    try {
      const locale = String(language()).replaceAll("_", "-");
      return {
        number: new Intl.NumberFormat(locale),
        plural: new Intl.PluralRules(locale),
      };
    } catch {
      return {
        number: new Intl.NumberFormat("en"),
        plural: new Intl.PluralRules("en"),
      };
    }
  }
  function countLabel(key, count, legacy) {
    const { number, plural } = formats(),
      messageKey = key + (plural.select(count) === "one" ? "One" : "Other"),
      message = t(messageKey);
    // Existing host translation callbacks can keep their original label keys.
    return typeof message !== "string" || message === messageKey
      ? `${number.format(count)} ${t(legacy)}`
      : message.replaceAll("{count}", number.format(count));
  }
  const pressed = (selector) =>
    $(selector).getAttribute("aria-pressed") === "true";
  const options = () => ({
    matchCase: pressed("#optCase"),
    wholeCell: pressed("#optWhole"),
    regex: pressed("#optRegex"),
  });
  const query = () => $("#search").value;

  function refresh(move = true) {
    if (disposed) return;
    const text = query();
    matches = [];
    index = -1;
    invalid = false;
    $("#searchBar").dataset.invalid = "false";
    $("#search").setAttribute("aria-invalid", "false");
    if (text) {
      try {
        matches = grid.find(text, {
          ...options(),
          scope: "both",
          visibleOnly: true,
        });
      } catch {
        invalid = true;
        $("#searchBar").dataset.invalid = "true";
        $("#search").setAttribute("aria-invalid", "true");
        $("#searchResult").textContent = t("invalidPattern");
        syncButtons();
        return;
      }
    }
    if (move && matches.length) go(1);
    else
      $("#searchResult").textContent = text
        ? countLabel("searchMatches", matches.length, "matches")
        : "";
    syncButtons();
  }
  function go(direction) {
    if (disposed || invalid) return;
    if (!matches.length) {
      $("#searchResult").textContent = t("noMatches");
      return;
    }
    index =
      index < 0
        ? direction < 0
          ? matches.length - 1
          : 0
        : (index + direction + matches.length) % matches.length;
    const { row, col } = matches[index];
    grid.goTo(row, col);
    $("#searchResult").textContent =
      `${formats().number.format(index + 1)} / ${countLabel("searchMatches", matches.length, "matches")}`;
  }
  function syncButtons() {
    const locked = grid.readOnly,
      has = matches.length > 0;
    $("#replaceOne").disabled = locked || !has;
    $("#replaceAll").disabled = locked || invalid || !query();
    $("#previousMatch").disabled = !has;
    const next = $("#searchBar").querySelector('button[type="submit"]');
    if (next) next.disabled = !has;
    $("#toggleReplace").disabled = false;
  }
  function setReplace(show) {
    replaceVisible = show;
    $("#replaceRow").hidden = !show;
    $("#toggleReplace").setAttribute("aria-expanded", String(show));
    $("#toggleReplace").classList.toggle("open", show);
  }
  function open(withReplace = false) {
    if (disposed) return;
    if ($("#searchBar").hidden) returnFocus = document.activeElement;
    $("#searchBar").hidden = false;
    if (withReplace) setReplace(true);
    const selected = window.getSelection?.().toString();
    if (selected && !selected.includes("\n") && selected.length < 100)
      $("#search").value = selected;
    $("#search").focus();
    $("#search").select();
    refresh(false);
  }
  function close() {
    if (disposed) return;
    $("#searchBar").hidden = true;
    const target = returnFocus?.isConnected ? returnFocus : grid.el;
    target.focus({ preventScroll: true });
  }
  function report(result) {
    if (!result.count) {
      notify(t("replaceNothing"));
      return false;
    }
    notify(
      `${countLabel("searchReplacements", result.count, "replacements")} · ${countLabel("searchCells", result.cells, "cells")}`,
    );
    return true;
  }
  function replaceOne() {
    if (disposed || invalid || !matches.length || grid.readOnly) return;
    const { row, col } = matches[Math.max(0, index)];
    const result = grid.replace(query(), $("#replaceText").value, {
      ...options(),
      range: { r1: row, r2: row, c1: col, c2: col },
    });
    if (!report(result)) return;
    refresh(false);
    const after = matches.findIndex(
      (m) => m.row > row || (m.row === row && m.col > col),
    );
    index = matches.length ? (after < 0 ? matches.length - 1 : after - 1) : -1;
    if (matches.length) go(1);
    else $("#searchResult").textContent = t("noMatches");
  }
  function replaceAll() {
    if (disposed || invalid || !query() || grid.readOnly) return;
    const s = selection(),
      several = s.r1 !== s.r2 || s.c1 !== s.c2;
    let result;
    try {
      result = grid.replace(query(), $("#replaceText").value, {
        ...options(),
        range: several ? s : null,
      });
    } catch {
      notify(t("invalidPattern"));
      return;
    }
    report(result);
    refresh(false);
  }

  on($("#findBtn"), "click", () => open(false));
  on($("#search"), "input", () => refresh());
  on($("#searchBar"), "submit", (event) => {
    event.preventDefault();
    go(1);
  });
  on($("#previousMatch"), "click", () => go(-1));
  on($("#closeSearch"), "click", close);
  on($("#toggleReplace"), "click", () => {
    setReplace(!replaceVisible);
    if (replaceVisible) $("#replaceText").focus();
  });
  for (const id of ["#optCase", "#optWhole", "#optRegex"])
    on($(id), "click", () => {
      $(id).setAttribute("aria-pressed", String(!pressed(id)));
      refresh(false);
    });
  on($("#replaceOne"), "click", replaceOne);
  on($("#replaceAll"), "click", replaceAll);
  on($("#replaceText"), "keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey || event.ctrlKey || event.metaKey) replaceAll();
      else replaceOne();
    }
  });
  on($("#searchBar"), "keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  });
  on(document, "keydown", (event) => {
    if (
      event.defaultPrevented ||
      !(event.ctrlKey || event.metaKey) ||
      event.altKey ||
      document.querySelector("dialog[open]")
    )
      return;
    const key = event.key.toLowerCase();
    if (key === "f") {
      event.preventDefault();
      open(false);
    } else if (key === "h" && event.ctrlKey) {
      event.preventDefault();
      open(true);
    }
  });
  offs.push(grid.on("readonly", syncButtons));
  for (const event of [
    "change",
    "fill",
    "move",
    "filter",
    "sort",
    "table",
    "rowhide",
    "rowshow",
    "columnhide",
    "columnshow",
    "variable",
    "externalvariables",
    "history",
    "worksheet",
  ])
    offs.push(
      grid.on(event, () => {
        if (!$("#searchBar").hidden) refresh(false);
      }),
    );
  function dispose() {
    if (disposed) return;
    disposed = true;
    offs.forEach((off) => off());
    $("#searchBar").hidden = true;
  }
  offs.push(grid.on("destroy", dispose));
  const description = new Set(
    ($("#search").getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .filter(Boolean),
  );
  description.add("searchResult");
  $("#search").setAttribute("aria-describedby", [...description].join(" "));
  $("#searchResult").setAttribute("role", "status");
  $("#searchResult").setAttribute("aria-atomic", "true");
  refresh(false);
  return { open, refresh, close, dispose };
}
