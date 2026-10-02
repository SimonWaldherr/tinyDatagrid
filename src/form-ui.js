import {
  generateForm,
  appendFormResponse,
  formKinds,
} from "./form-generator.js";
export const formCSS = `.tg-form-dialog{box-sizing:border-box;width:min(640px,calc(100% - 24px));max-height:90dvh;border:1px solid #cbd5e1;border-radius:16px;padding:20px;color:#172b26;background:white;font:16px system-ui}.tg-form-dialog::backdrop{background:#10221d80}.tg-form-dialog h2{margin:0 0 14px}.tg-form-dialog label{display:grid;gap:6px;margin:12px 0}.tg-form-dialog input,.tg-form-dialog select,.tg-form-dialog textarea{box-sizing:border-box;width:100%;min-height:44px;padding:10px;border:1px solid #aabbb5;border-radius:8px;font:inherit;background:white;color:inherit}.tg-form-dialog button{min-height:44px;padding:10px 14px;border:1px solid #aabbb5;border-radius:8px;background:#edf5f2;color:#172b26;font:inherit;cursor:pointer}.tg-form-dialog button:disabled{opacity:.5}.tg-form-dialog .tg-form-actions{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.tg-form-dialog .tg-field-settings{display:grid;grid-template-columns:minmax(100px,1fr) minmax(120px,1fr) auto;gap:8px;align-items:center;border-bottom:1px solid #edf2f0;padding:8px 0}.tg-form-dialog .tg-field-settings label{display:flex;align-items:center;font-size:13px;margin:0}.tg-form-dialog input[type=checkbox]{width:22px;min-height:22px}.tg-form-dialog canvas{display:block;max-width:100%;height:auto;margin:16px auto;background:white}.tg-form-dialog [role=status]{white-space:pre-wrap;overflow-wrap:anywhere}.tg-form-dialog .tg-form-error{color:#a21b24}.tg-form-dialog a{overflow-wrap:anywhere}.tg-form-dialog small{color:#52645d}.tg-form-dialog [hidden]{display:none!important}@media(max-width:560px){dialog.tg-form-dialog{width:100%;max-width:100%;margin:auto 0 0;border-radius:14px 14px 0 0;padding-bottom:calc(20px + env(safe-area-inset-bottom));}}`;
function node(tag, text) {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  return element;
}
export function formInput(field) {
  let input;
  if (["list", "boolean"].includes(field.kind)) {
    input = node("select");
    for (const [value, label] of [
      ["", "Bitte wählen"],
      ...(field.kind === "boolean"
        ? [
            ["true", "Ja"],
            ["false", "Nein"],
          ]
        : field.choices.map((value) => [value, value])),
    ]) {
      const option = node("option", label);
      option.value = value;
      input.append(option);
    }
  } else if (field.kind === "textarea") {
    input = node("textarea");
    input.rows = 3;
  } else {
    input = node("input");
    input.type = ["email", "tel", "url", "date", "time"].includes(field.kind)
      ? field.kind
      : "text";
    if (field.kind === "number" || field.kind === "integer")
      input.inputMode = field.kind === "integer" ? "numeric" : "decimal";
    if (field.kind === "time") input.step = "0.001";
  }
  input.name = field.id;
  input.required = field.required === true;
  input.maxLength = field.maxLength ?? 10000;
  if (field.minLength != null) input.minLength = field.minLength;
  const autocomplete = {
    email: "email",
    tel: "tel",
    url: "url",
    text: /name/i.test(field.label) ? "name" : "off",
  };
  input.autocomplete = autocomplete[field.kind] || "off";
  if (["email", "url"].includes(field.kind)) {
    input.autocapitalize = "none";
    input.spellcheck = false;
  }
  return input;
}
export function openFormGenerator({
  grid,
  title = "Eingabeformular",
  overrides = {},
  onDefinitionChange = () => {},
  onSubmit = async (spec, values) => appendFormResponse(grid, spec, values),
  onShare,
  onStop,
  renderQR,
}) {
  let definition = generateForm(grid, { title, overrides }),
    published = false,
    busy = false,
    closed = false;
  const dialog = node("dialog");
  dialog.className = "tg-form-dialog";
  const style = node("style", formCSS);
  dialog.append(style, node("h2", "Formular erstellen"));
  const settings = node("details"),
    summary = node("summary", "Feldtypen und Pflichtfelder anpassen"),
    settingsBody = node("div");
  settings.append(summary, settingsBody);
  const titleLabel = node("label", "Formulartitel"),
    titleInput = node("input");
  titleInput.value = title;
  titleInput.maxLength = 100;
  titleLabel.append(titleInput);
  settingsBody.append(titleLabel);
  const controls = definition.fields.map((field) => {
    const row = node("div");
    row.className = "tg-field-settings";
    const label = node("input");
    label.value = field.label;
    label.maxLength = 100;
    label.setAttribute("aria-label", "Feldname");
    const kind = node("select");
    kind.setAttribute("aria-label", `${field.label}: Feldtyp`);
    for (const [id, text] of Object.entries(formKinds)) {
      if (id === "list" && !field.choices.length) continue;
      const option = node("option", text);
      option.value = id;
      kind.append(option);
    }
    kind.value = field.kind;
    const requiredLabel = node("label", "Pflicht"),
      required = node("input");
    required.type = "checkbox";
    required.setAttribute("aria-label", field.label + ": Pflichtfeld");
    required.checked = field.required === true;
    requiredLabel.prepend(required);
    row.append(label, kind, requiredLabel);
    settingsBody.append(row);
    return { field, label, kind, required };
  });
  const apply = node("button", "Vorschau aktualisieren");
  apply.type = "button";
  settingsBody.append(apply);
  dialog.append(settings);
  const form = node("form"),
    body = node("div"),
    actions = node("div");
  actions.className = "tg-form-actions";
  const submit = node("button", "Antwort in Tabelle speichern");
  submit.type = "submit";
  actions.append(submit);
  form.append(body, actions);
  dialog.append(form);
  const share = node("button", "Als Webseite im WLAN freigeben");
  share.type = "button";
  share.hidden = !onShare;
  actions.append(share);
  const server = node("section"),
    urls = node("select"),
    link = node("a"),
    canvas = node("canvas"),
    stop = node("button", "Freigabe beenden");
  server.hidden = true;
  urls.setAttribute("aria-label", "Lokale Netzwerkadresse");
  link.target = "_blank";
  link.rel = "noreferrer";
  stop.type = "button";
  server.append(
    node(
      "p",
      "Geräte im selben Netzwerk können Antworten senden. Die App muss geöffnet bleiben. Die Freigabe nutzt lokales HTTP; der Link berechtigt zur Eingabe.",
    ),
    urls,
    link,
    canvas,
    stop,
  );
  dialog.append(server);
  const status = node("p");
  status.setAttribute("role", "status");
  dialog.append(status);
  const close = node("button", "Schließen");
  close.type = "button";
  dialog.append(close);
  let inputs = [];
  function preview() {
    body.replaceChildren(node("h3", definition.title));
    inputs = definition.fields.map((field) => {
      const label = node("label", field.label + (field.required ? " *" : "")),
        input = formInput(field);
      label.append(input);
      body.append(label);
      return input;
    });
    if (definition.computed.length)
      body.append(
        node(
          "small",
          `${definition.computed.length} berechnete Spalten werden automatisch fortgeführt.`,
        ),
      );
  }
  function message(text, error = false) {
    status.textContent = text;
    status.classList.toggle("tg-form-error", error);
  }
  function locking(value) {
    busy = value;
    for (const button of [apply, submit, share, stop, close])
      button.disabled = value;
    for (const control of controls)
      for (const input of [control.label, control.kind, control.required])
        input.disabled = value || published;
    titleInput.disabled = value || published;
    apply.disabled = value || published;
    share.disabled = value || published;
  }
  apply.onclick = () => {
    try {
      const overrides = Object.fromEntries(
        controls.map(({ field, label, kind, required }) => [
          field.id,
          { label: label.value, kind: kind.value, required: required.checked },
        ]),
      );
      definition = generateForm(grid, {
        title: titleInput.value,
        scope: definition.scope,
        overrides,
      });
      preview();
      onDefinitionChange(definition);
      message("Vorschau aktualisiert.");
    } catch (error) {
      message(error.message, true);
    }
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    locking(true);
    try {
      await onSubmit(
        definition,
        Object.fromEntries(inputs.map((input) => [input.name, input.value])),
      );
      form.reset();
      message(
        "Antwort in der Tabelle gespeichert. Eine weitere Antwort ist möglich.",
      );
    } catch (error) {
      message(error.message, true);
    } finally {
      locking(false);
    }
  };
  urls.onchange = () => {
    link.href = urls.value;
    link.textContent = urls.value;
    renderQR?.(urls.value, canvas);
  };
  share.onclick = async () => {
    locking(true);
    try {
      const result = await onShare(definition);
      published = true;
      urls.replaceChildren();
      for (const url of result.urls) {
        const option = node("option", url);
        option.value = url;
        urls.append(option);
      }
      server.hidden = false;
      urls.onchange();
      close.textContent = "Schließen und Freigabe beenden";
      message("Freigabe aktiv. QR-Code scannen oder Adresse öffnen.");
    } catch (error) {
      message(error.message, true);
    } finally {
      locking(false);
    }
  };
  async function end() {
    if (published) {
      await onStop?.();
      published = false;
    }
    server.hidden = true;
    close.textContent = "Schließen";
    locking(false);
  }
  stop.onclick = async () => {
    locking(true);
    try {
      await end();
      message("Freigabe beendet.");
    } catch (error) {
      message(error.message, true);
      locking(false);
    }
  };
  close.onclick = async () => {
    if (busy) return;
    locking(true);
    try {
      await end();
      closed = true;
      dialog.close();
      dialog.remove();
    } catch (error) {
      message(error.message, true);
      locking(false);
    }
  };
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close.click();
  });
  dialog.addEventListener("close", () => {
    if (!closed) {
      onStop?.();
      dialog.remove();
    }
  });
  preview();
  document.body.append(dialog);
  dialog.showModal();
  inputs[0]?.focus();
  return {
    dialog,
    stopped(reason = "Freigabe beendet.") {
      published = false;
      server.hidden = true;
      close.textContent = "Schließen";
      locking(false);
      message(reason);
    },
    message,
  };
}
