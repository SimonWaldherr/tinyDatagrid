import { toA1 } from "../src/tinygrid.js";

export function installSQLTools({ grid, $, t, selection, showSource, notify }) {
  const api = grid.feature("sql");
  const button = document.createElement("button");
  button.id = "localSQLBtn";
  button.textContent = "SQL";
  button.dataset.title = "localSQLTitle";
  $("#pivotBtn").after(button);
  const dialog = document.createElement("dialog");
  dialog.className = "wide local-sql-dialog";
  dialog.setAttribute("aria-labelledby", "localSQLTitle");
  const heading = document.createElement("div");
  heading.className = "dialog-heading";
  const title = document.createElement("h2");
  title.id = "localSQLTitle";
  title.dataset.i18n = "localSQLTitle";
  const close = document.createElement("button");
  close.dataset.i18n = "close";
  close.onclick = () => dialog.close();
  heading.append(title, close);
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.dataset.i18n = "localSQLHint";
  const controls = document.createElement("div");
  controls.className = "local-sql-controls";
  const tableLabel = document.createElement("label"),
    tableText = document.createElement("span"),
    tableSelect = document.createElement("select");
  tableText.dataset.i18n = "sourceTable";
  tableSelect.id = "localSQLTable";
  tableLabel.append(tableText, tableSelect);
  const scopeLabel = document.createElement("label"),
    scopeText = document.createElement("span"),
    scope = document.createElement("select");
  scope.id = "localSQLScope";
  scopeText.dataset.i18n = "analysisScope";
  for (const [value, key] of [
    ["all", "scopeAll"],
    ["visible", "scopeVisible"],
    ["selection", "scopeSelection"],
  ]) {
    const option = new Option("", value);
    option.dataset.i18n = key;
    scope.append(option);
  }
  scopeLabel.append(scopeText, scope);
  const example = document.createElement("button");
  example.dataset.i18n = "localSQLExample";
  controls.append(tableLabel, scopeLabel, example);
  const schema = document.createElement("p");
  schema.className = "hint local-sql-schema";
  const editorLabel = document.createElement("label"),
    editorText = document.createElement("span"),
    editor = document.createElement("textarea");
  editorText.dataset.i18n = "localSQLQuery";
  editor.id = "localSQLQuery";
  editor.rows = 5;
  editor.spellcheck = false;
  editor.placeholder = "SELECT * FROM table1 LIMIT 100";
  editorLabel.append(editorText, editor);
  const run = document.createElement("button");
  run.id = "runLocalSQL";
  run.dataset.i18n = "localSQLRun";
  const materialize = document.createElement("button");
  materialize.id = "materializeLocalSQL";
  materialize.dataset.i18n = "localSQLMaterialize";
  materialize.dataset.title = "localSQLMaterializeHint";
  materialize.disabled = true;
  const actions = document.createElement("div");
  actions.className = "local-sql-controls";
  actions.append(run, materialize);
  const openDestination = document.createElement("button");
  openDestination.id = "openSQLDestination";
  openDestination.dataset.i18n = "localSQLOpenDestination";
  openDestination.hidden = true;
  actions.append(openDestination);
  const status = document.createElement("p");
  status.id = "localSQLStatus";
  status.setAttribute("role", "status");
  const body = document.createElement("div");
  body.className = "source-table local-sql-results";
  const pages = document.createElement("div"),
    previous = document.createElement("button"),
    next = document.createElement("button");
  previous.textContent = "←";
  previous.dataset.label = "previousPage";
  next.textContent = "→";
  next.dataset.label = "nextPage";
  pages.append(previous, next);
  pages.hidden = true;
  dialog.append(
    heading,
    hint,
    controls,
    schema,
    editorLabel,
    actions,
    status,
    body,
    pages,
  );
  document.body.append(dialog);
  let tables = [],
    result = null,
    source = null,
    page = 0,
    returnFocus;
  const quote = (name) => `"${name.replaceAll('"', '""')}"`;
  function updateSchema() {
    const table = tables.find((item) => item.id === tableSelect.value);
    schema.textContent = table
      ? `${table.id}: ${table.columns.join(" · ")}`
      : t("noTable");
  }
  function render() {
    body.replaceChildren();
    materialize.disabled =
      !result ||
      grid.readOnly ||
      !grid.feature("worksheets") ||
      !!grid.sqlBinding;
    openDestination.hidden = !result?.destination;
    if (!result) {
      pages.hidden = true;
      return;
    }
    status.textContent = `${result.rowCount} ${t("rows")} · ${page + 1} / ${Math.max(1, Math.ceil(result.rowCount / 50))}`;
    if (result.destination) {
      const { name, range } = result.destination;
      status.textContent += ` · ${t("localSQLMaterialized")}: ${name}:${toA1(range.r1, range.c1)}`;
    }
    const table = document.createElement("table"),
      head = document.createElement("tr");
    for (const column of [...result.columns, t("sourceRows")]) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = column;
      head.append(th);
    }
    const thead = document.createElement("thead"),
      tbody = document.createElement("tbody");
    thead.append(head);
    result.rows.slice(page * 50, page * 50 + 50).forEach((row, index) => {
      const tr = document.createElement("tr");
      for (const value of row) {
        const td = document.createElement("td");
        td.textContent = value == null ? "NULL" : String(value);
        tr.append(td);
      }
      const td = document.createElement("td"),
        drill = document.createElement("button");
      drill.textContent = t("sourceRows");
      drill.onclick = () => {
        const entries = result.drill(page * 50 + index);
        dialog.close();
        showSource({ headers: source.headers, entries }, source.range);
      };
      td.append(drill);
      tr.append(td);
      tbody.append(tr);
    });
    table.append(thead, tbody);
    body.append(table);
    pages.hidden = result.rowCount <= 50;
    previous.disabled = page === 0;
    next.disabled = (page + 1) * 50 >= result.rowCount;
  }
  function execute() {
    result = null;
    source = null;
    page = 0;
    render();
    try {
      result = api.query(editor.value, [], {
        scope: scope.value,
        ...(scope.value === "selection" ? { selection: selection() } : {}),
      });
      const table = grid
        .listTables()
        .find((item) => item.id === result.tableId);
      const meta = api.tables().find((item) => item.id === result.tableId);
      source = {
        headers: meta.columns,
        range: {
          r1: table.headerRow,
          r2: table.r2,
          c1: table.c1,
          c2: table.c2,
        },
      };
      render();
    } catch (error) {
      status.textContent = error.message;
    }
  }
  run.onclick = execute;
  materialize.onclick = () => {
    if (!result) return;
    try {
      const created = api.materialize(result, {
        sheetName: t("localSQLResultName"),
      });
      returnFocus = grid.el;
      dialog.close();
      notify?.(`${t("localSQLMaterialized")}: ${created.name}`);
    } catch (error) {
      status.textContent = error.message;
    }
  };
  grid.on("readonly", () => {
    materialize.disabled =
      !result ||
      grid.readOnly ||
      !grid.feature("worksheets") ||
      !!grid.sqlBinding;
  });
  openDestination.onclick = () => {
    if (!result?.destination) return;
    try {
      const { sheetId, tableId, range } = result.destination;
      grid.feature("worksheets").select(sheetId);
      grid.activateTable(tableId);
      grid.select(range.r1, range.c1);
      returnFocus = grid.el;
      dialog.close();
    } catch (error) {
      status.textContent = error.message;
    }
  };
  editor.onkeydown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      execute();
    }
  };
  tableSelect.onchange = updateSchema;
  example.onclick = () => {
    if (tableSelect.value)
      editor.value = `SELECT * FROM ${quote(tableSelect.value)} LIMIT 100`;
    editor.focus();
  };
  previous.onclick = () => {
    page--;
    render();
  };
  next.onclick = () => {
    page++;
    render();
  };
  button.onclick = () => {
    returnFocus = document.activeElement;
    tables = api.tables();
    tableSelect.replaceChildren(
      ...tables.map(
        (table) => new Option(`${table.name} (${table.id})`, table.id),
      ),
    );
    if (grid.table) tableSelect.value = grid.table.id;
    run.disabled = !tables.length;
    example.disabled = !tables.length;
    updateSchema();
    if (!editor.value && tables.length)
      editor.value = `SELECT * FROM ${quote(tableSelect.value)} LIMIT 100`;
    result = null;
    source = null;
    status.textContent = "";
    render();
    dialog.showModal();
    editor.focus();
  };
  dialog.onclose = () => {
    if (returnFocus?.isConnected) returnFocus.focus();
  };
}
