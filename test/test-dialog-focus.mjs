import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { keepDialogFocus } from "../src/dialog-focus.js";

const { window, document } = parseHTML(
  '<html><body><button id="outside"></button><dialog open><button id="first"></button><input disabled><button hidden></button><button id="last"></button></dialog></body></html>',
);
Object.assign(globalThis, {
  window,
  document,
  getComputedStyle: () => ({ visibility: "visible" }),
});
let active = null;
Object.defineProperty(document, "activeElement", { get: () => active });
const dialog = document.querySelector("dialog"),
  first = document.querySelector("#first"),
  last = document.querySelector("#last");
const matches = dialog.matches.bind(dialog);
let modal = true;
dialog.matches = (selector) =>
  selector === ":modal" ? modal : matches(selector);
// Layout and focus are browser boundaries; the model only exercises key routing.
for (const button of dialog.querySelectorAll("button,input")) {
  Object.defineProperty(button, "tabIndex", { value: 0 });
  button.getClientRects = () => [{}];
  button.focus = () => {
    active = button;
  };
}
dialog.focus = () => {
  active = dialog;
};
const press = (target, shiftKey = false) => {
  const event = {
    key: "Tab",
    target,
    shiftKey,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
  keepDialogFocus(event);
  return event;
};
active = first;
assert.equal(press(first, true).defaultPrevented, true);
assert.equal(active, last);
assert.equal(press(last).defaultPrevented, true);
assert.equal(active, first);
assert.equal(
  press(first).defaultPrevented,
  false,
  "ordinary navigation remains native",
);
active = dialog;
assert.equal(press(dialog).defaultPrevented, true);
assert.equal(active, first);
active = document.querySelector("#outside");
assert.equal(press(active).defaultPrevented, false);
modal = false;
active = first;
assert.equal(
  press(first, true).defaultPrevented,
  false,
  "nonmodal dialogs do not trap focus",
);
modal = true;
for (const node of dialog.querySelectorAll("button,input")) node.remove();
active = dialog;
assert.equal(press(dialog).defaultPrevented, true);
assert.equal(active, dialog);
console.log(
  "Dialog focus: forward/reverse boundaries, disabled/hidden controls, nonmodal and empty dialogs passed",
);
