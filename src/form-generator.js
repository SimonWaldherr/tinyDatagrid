import {
  DecimalValue,
  compactDecimal,
  compareDecimals,
} from "./decimal-values.js";
import { CalendarDate, ClockTime } from "./temporal-values.js";
import { rawText } from "./json-values.js";
export const formKinds = Object.freeze({
  text: "Text",
  email: "E-Mail",
  tel: "Telefon",
  url: "Webadresse",
  number: "Dezimalzahl",
  integer: "Ganzzahl",
  date: "Datum",
  time: "Uhrzeit",
  boolean: "Ja / Nein",
  textarea: "Mehrzeiliger Text",
  list: "Auswahlliste",
  color: "Farbe",
});
const normalized = (value) =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function inferFormKind(label, samples = [], choices = []) {
  if (choices.length) return "list";
  const name = normalized(label);
  if (/e.?mail|courriel|posta elettronica/.test(name)) return "email";
  if (/telefon|telephone|phone|mobile|mobil|handy|cellulare|fax/.test(name))
    return "tel";
  if (/website|webseite|homepage|\burl\b|link|sito web/.test(name))
    return "url";
  if (/datum|\bdate\b|geburt|birthday|\bdata\b/.test(name)) return "date";
  if (/uhrzeit|\btime\b|heure|orario/.test(name)) return "time";
  if (/farbe|colou?r|couleur|colore/.test(name)) return "color";
  if (
    /notiz|bemerk|beschreibung|comment|description|note|descrizione/.test(name)
  )
    return "textarea";
  if (
    /postleitzahl|postcode|postal|\bzip\b|\bid\b|kennung|nummer|numero/.test(
      name,
    )
  )
    return "text";
  if (
    /betrag|preis|kosten|euro|amount|price|prix|montant|importo|prezzo|geplant|^ist$/.test(
      name,
    )
  )
    return "number";
  if (/anzahl|menge|quantity|count|quantita/.test(name)) return "integer";
  if (samples.length && samples.every((value) => typeof value === "boolean"))
    return "boolean";
  if (samples.length && samples.every((value) => value instanceof CalendarDate))
    return "date";
  if (samples.length && samples.every((value) => value instanceof ClockTime))
    return "time";
  if (
    samples.length &&
    samples.every(
      (value) =>
        typeof value === "number" ||
        typeof value === "bigint" ||
        value instanceof DecimalValue,
    )
  )
    return samples.every(
      (value) =>
        typeof value === "bigint" ||
        (typeof value === "number" && Number.isInteger(value)),
    )
      ? "integer"
      : "number";
  if (
    samples.length &&
    samples.every(
      (value) =>
        typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    )
  )
    return "email";
  return "text";
}
export function generateForm(
  grid,
  {
    title = "Eingabeformular",
    overrides = {},
    scope = null,
    maxRows = 10000,
    maxColumns = 256,
  } = {},
) {
  const table = scope?.tableID
    ? grid.listTables().find((t) => t.id === scope.tableID)
    : !scope
      ? grid.tableAt?.(grid.anchor?.row ?? 0, grid.anchor?.col ?? 0) ||
        grid.table
      : null;
  if (scope?.tableID && !table)
    throw new Error("Die Formulartabelle wurde entfernt.");
  const used = grid.getUsedRange();
  const range = table
    ? {
        headerRow: table.headerRow,
        c1: table.c1,
        c2: table.c2,
        tableID: table.id,
      }
    : scope || { headerRow: used.r1, c1: used.c1, c2: used.c2 };
  if (range.c2 - range.c1 + 1 > maxColumns || used.r2 >= maxRows)
    throw new Error("Die Tabelle überschreitet die Formulargrenzen.");
  const end = table ? table.r2 : used.r2,
    fields = [],
    computed = [],
    headers = [];
  for (let col = range.c1; col <= range.c2; col++) {
    const label = rawText(grid.getComputedValue(range.headerRow, col)).trim();
    headers.push([col, rawText(grid.getRawValue(range.headerRow, col))]);
    if (!label) continue;
    const samples = [];
    let formula = null,
      formulaRow;
    for (let row = range.headerRow + 1; row <= end; row++) {
      const cell = grid.getCell(row, col),
        value = grid.getRawValue(row, col);
      if (
        cell.valueType !== "text" &&
        typeof value === "string" &&
        value.startsWith("=")
      ) {
        formula = value;
        formulaRow = row;
      } else if (value !== "" && value != null && samples.length < 30)
        samples.push(value);
    }
    if (formula) {
      computed.push({
        col,
        formula: grid.shiftFormula(
          formula,
          range.headerRow + 1 - formulaRow,
          0,
        ),
        templateRow: range.headerRow + 1,
      });
      continue;
    }
    const row = end + 1;
    if (grid.isCellReadOnly(row, col)) continue;
    const rule = grid.validationRules?.find(
      (r) =>
        col >= r.range.c1 &&
        col <= r.range.c2 &&
        row >= r.range.r1 &&
        row <= r.range.r2,
    );
    const choices = (
      grid.feature("validation")?.listValues(row, col) ||
      rule?.values ||
      []
    ).map(rawText);
    const proposed =
        rule?.type === "integer"
          ? "integer"
          : rule?.type === "number"
            ? "number"
            : inferFormKind(label, samples, choices),
      override = overrides[`c${col}`] || {};
    const kind = override.kind || proposed;
    if (!Object.hasOwn(formKinds, kind))
      throw new Error("Unbekannter Feldtyp.");
    if (kind === "list" && !choices.length)
      throw new Error(
        `„${label}“ benötigt eine Auswahlliste in der Tabellenvalidierung.`,
      );
    fields.push({
      id: `c${col}`,
      col,
      label: String(override.label || label).slice(0, 100),
      kind,
      required: override.required ?? rule?.allowEmpty === false,
      choices,
      ...(rule && ["number", "integer"].includes(rule.type)
        ? { min: rule.min, max: rule.max }
        : {}),
      ...(rule?.type === "textLength"
        ? { minLength: rule.min, maxLength: rule.max }
        : {}),
    });
  }
  if (!fields.length)
    throw new Error(
      "Lege zuerst eine Kopfzeile mit Feldnamen an. Berechnete und geschützte Spalten sind keine Eingabefelder.",
    );
  const structure = JSON.stringify({
    headers,
    computed,
    validation: grid.validationRules || [],
  });
  return {
    version: 1,
    title: String(title).slice(0, 100),
    sheetID: grid.feature("worksheets")?.activeId || null,
    scope: range,
    fields,
    computed,
    structure,
    maxRows,
    maxColumns,
  };
}
export function formValue(field, input) {
  if (input == null || input === "") {
    if (field.required) throw new Error(`„${field.label}“ ist erforderlich.`);
    return "";
  }
  if (typeof input !== "string" || input.length > 10000)
    throw new Error(`„${field.label}“ benötigt einen gültigen Text.`);
  const text = input.trim(),
    fail = (message) => {
      throw new Error(`„${field.label}“ ${message}`);
    };
  if (!text) {
    if (field.required) fail("ist erforderlich.");
    return "";
  }
  if (
    (field.minLength != null && Array.from(input).length < field.minLength) ||
    (field.maxLength != null && Array.from(input).length > field.maxLength)
  )
    fail("hat eine ungültige Textlänge.");
  if (field.kind === "number" || field.kind === "integer") {
    if (
      text.includes(",") &&
      !/^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+),\d+$/.test(text)
    )
      fail("benötigt eine gültige Zahl.");
    const normalized = text.includes(",")
      ? text.replaceAll(".", "").replace(",", ".")
      : text;
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized))
      fail("benötigt eine gültige Zahl.");
    let value;
    try {
      value = DecimalValue.parse(normalized);
    } catch {
      fail("benötigt eine gültige Zahl.");
    }
    if (field.kind === "integer" && value.scale)
      fail("benötigt eine Ganzzahl.");
    if (
      (field.min != null && compareDecimals(value, field.min) < 0) ||
      (field.max != null && compareDecimals(value, field.max) > 0)
    )
      fail("liegt außerhalb des erlaubten Bereichs.");
    return compactDecimal(value);
  }
  if (field.kind === "date") {
    try {
      return CalendarDate.parse(text);
    } catch {
      fail("benötigt ein gültiges Datum.");
    }
  }
  if (field.kind === "time") {
    const match = /^(\d{2}):(\d{2})(?::(\d{2}(?:\.\d{1,3})?))?$/.exec(text);
    if (!match || +match[1] > 23 || +match[2] > 59 || +(match[3] || 0) >= 60)
      fail("benötigt eine gültige Uhrzeit.");
    return new ClockTime(+match[1] * 3600 + +match[2] * 60 + +(match[3] || 0));
  }
  if (field.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))
    fail("benötigt eine gültige E-Mail-Adresse.");
  if (field.kind === "tel" && !/^[+\d][\d\s()./\-]{2,49}$/.test(text))
    fail("benötigt eine gültige Telefonnummer.");
  if (field.kind === "url") {
    try {
      if (!["http:", "https:"].includes(new URL(text).protocol))
        fail("benötigt eine HTTP(S)-Adresse.");
    } catch {
      fail("benötigt eine HTTP(S)-Adresse.");
    }
  }
  if (field.kind === "boolean") {
    if (!["true", "false"].includes(text)) fail("benötigt Ja oder Nein.");
    return text === "true";
  }
  if (field.kind === "list" && !field.choices.includes(input))
    fail("benötigt einen Wert aus der Auswahlliste.");
  if (field.kind === "color" && !/^#[\da-f]{6}$/i.test(text))
    fail("benötigt eine Farbe im Format #rrggbb.");
  return ["textarea", "text", "list"].includes(field.kind) ? input : text;
}
export function appendFormResponse(grid, definition, values) {
  if (
    !values ||
    typeof values !== "object" ||
    Array.isArray(values) ||
    Object.keys(values).some(
      (key) => !definition.fields.some((field) => field.id === key),
    )
  )
    throw new Error("Die Antwort enthält unbekannte Felder.");
  if (
    definition.sheetID &&
    grid.feature("worksheets")?.activeId !== definition.sheetID
  )
    throw new Error("Das Formular gehört zu einem anderen Arbeitsblatt.");
  const fresh = generateForm(grid, {
    scope: definition.scope,
    maxRows: definition.maxRows,
    maxColumns: definition.maxColumns,
  });
  if (fresh.structure !== definition.structure)
    throw new Error(
      "Die Tabellenstruktur hat sich geändert. Erstelle das Formular neu.",
    );
  const table = definition.scope.tableID
    ? grid.listTables().find((t) => t.id === definition.scope.tableID)
    : null;
  const row = (table?.r2 ?? grid.getUsedRange().r2) + 1;
  if (row >= definition.maxRows) throw new Error("Die Tabelle ist voll.");
  const parsed = definition.fields.map((field) => ({
    field,
    value: formValue(field, values[field.id] ?? ""),
  }));
  if (parsed.every(({ value }) => value === ""))
    throw new Error("Trage mindestens einen Wert ein.");
  const writes = [
    ...parsed.map(({ field, value }) => ({
      col: field.col,
      value,
      input: values[field.id] ?? "",
      meta: typeof value === "string" ? { valueType: "text" } : {},
    })),
    ...definition.computed.map((item) => ({
      col: item.col,
      value: grid.shiftFormula(item.formula, row - item.templateRow, 0),
      meta: {},
    })),
  ];
  for (const item of writes) {
    if (
      grid.isCellReadOnly(row, item.col) ||
      grid.getRawValue(row, item.col) !== ""
    )
      throw new Error("Die Zielzeile ist belegt oder geschützt.");
    const error = grid
      .feature("validation")
      ?.validate(row, item.col, item.value);
    if (error) throw new Error(error);
  }
  const result = grid.transaction(() => {
    for (const item of writes) {
      if (grid.setCell(row, item.col, item.value, item.meta) === false)
        throw new Error("Die Antwort konnte nicht übernommen werden.");
      if (Object.hasOwn(item, "input"))
        grid.cells.set(grid.key(row, item.col), {
          ...grid.getCell(row, item.col),
          originalInput: item.input,
        });
    }
  });
  if (result === false)
    throw new Error("Die Antwort konnte nicht übernommen werden.");
  return row;
}
