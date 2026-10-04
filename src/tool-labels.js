/** Translate generated controls using the same attributes as the demo markup. */
export function applyToolLabels(root, t) {
  for (const element of [
    root,
    ...root.querySelectorAll("[data-i18n], [data-title], [data-label]"),
  ]) {
    if (element.dataset.i18n) element.textContent = t(element.dataset.i18n);
    if (element.dataset.title) element.title = t(element.dataset.title);
    if (element.dataset.label)
      element.setAttribute("aria-label", t(element.dataset.label));
  }
}
