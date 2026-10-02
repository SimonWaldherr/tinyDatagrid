// Search bar with options, regular expressions, and replace (Ctrl/Cmd+F, Ctrl+H).
export function installSearch({ grid, $, t, notify, selection }) {
  let matches = [],
    index = -1,
    replaceVisible = false;
  const pressed = (selector) =>
    $(selector).getAttribute("aria-pressed") === "true";
  const options = () => ({
    matchCase: pressed("#optCase"),
    wholeCell: pressed("#optWhole"),
    regex: pressed("#optRegex"),
  });
  const query = () => $("#search").value;

  function refresh(move = true) {
    const text = query();
    matches = [];
    index = -1;
    $("#searchBar").dataset.invalid = "false";
    if (text) {
      try {
        matches = grid.find(text, {
          ...options(),
          scope: "both",
          visibleOnly: true,
        });
      } catch {
        $("#searchBar").dataset.invalid = "true";
        $("#searchResult").textContent = t("invalidPattern");
        syncButtons();
        return;
      }
    }
    if (move && matches.length) go(1);
    else
      $("#searchResult").textContent = text
        ? `${matches.length} ${t("matches")}`
        : "";
    syncButtons();
  }
  function go(direction) {
    if (!matches.length) {
      $("#searchResult").textContent = t("noMatches");
      return;
    }
    index = (index + direction + matches.length) % matches.length;
    const { row, col } = matches[index];
    grid.goTo(row, col);
    $("#searchResult").textContent =
      `${index + 1} / ${matches.length} ${t("matches")}`;
  }
  function syncButtons() {
    const locked = grid.readOnly,
      has = matches.length > 0;
    $("#replaceOne").disabled = locked || !has;
    $("#replaceAll").disabled = locked || !query();
    $("#previousMatch").disabled = !has;
    $("#toggleReplace").disabled = false;
  }
  function setReplace(show) {
    replaceVisible = show;
    $("#replaceRow").hidden = !show;
    $("#toggleReplace").setAttribute("aria-expanded", String(show));
    $("#toggleReplace").classList.toggle("open", show);
  }
  function open(withReplace = false) {
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
    $("#searchBar").hidden = true;
    grid.el.focus({ preventScroll: true });
  }
  function report(result) {
    if (!result.count) {
      notify(t("replaceNothing"));
      return false;
    }
    notify(
      `${result.count} ${t("replacements")} · ${result.cells} ${t("cells")}`,
    );
    return true;
  }
  function replaceOne() {
    if (index < 0 || grid.readOnly) return;
    const { row, col } = matches[index];
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
    if (!query() || grid.readOnly) return;
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

  $("#findBtn").onclick = () => open(false);
  $("#search").oninput = () => refresh();
  $("#searchBar").onsubmit = (event) => {
    event.preventDefault();
    go(1);
  };
  $("#previousMatch").onclick = () => go(-1);
  $("#closeSearch").onclick = close;
  $("#toggleReplace").onclick = () => {
    setReplace(!replaceVisible);
    if (replaceVisible) $("#replaceText").focus();
  };
  for (const id of ["#optCase", "#optWhole", "#optRegex"])
    $(id).onclick = () => {
      $(id).setAttribute("aria-pressed", String(!pressed(id)));
      refresh(false);
    };
  $("#replaceOne").onclick = replaceOne;
  $("#replaceAll").onclick = replaceAll;
  $("#replaceText").onkeydown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey || event.ctrlKey || event.metaKey) replaceAll();
      else replaceOne();
    }
  };
  $("#searchBar").onkeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };
  document.addEventListener("keydown", (event) => {
    if (
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
  grid.on("readonly", syncButtons);
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
  ])
    grid.on(event, () => {
      if (!$("#searchBar").hidden) refresh(false);
    });
  return { open, refresh, close };
}
