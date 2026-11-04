/** Keep Tab at the boundaries of a native modal, including embedded WebViews. */
export function keepDialogFocus(event) {
  if (event.key !== "Tab" || event.defaultPrevented) return;
  const dialog = event.target?.closest?.("dialog[open]");
  if (!dialog?.matches(":modal")) return;
  const controls = [
    ...dialog.querySelectorAll(
      'button, input, select, textarea, a[href], summary, [tabindex], [contenteditable="true"]',
    ),
  ].filter(
    (node) =>
      node.tabIndex >= 0 &&
      !node.matches(":disabled") &&
      !node.closest("[hidden], [inert]") &&
      node.getClientRects().length &&
      getComputedStyle(node).visibility !== "hidden",
  );
  const first = controls[0],
    last = controls.at(-1),
    active = document.activeElement;
  if (!first) {
    event.preventDefault();
    dialog.tabIndex = -1;
    dialog.focus();
  } else if (
    !controls.includes(active) ||
    (event.shiftKey ? active === first : active === last)
  ) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
}
