/** The values a cell may hold when a list validation rule covers it, or null. */
export function listChoices(grid, row, col) {
  return grid.feature("validation")?.listValues?.(row, col) ?? null;
}

/**
 * Optional choice menu for cells with a list validation rule (`{ type: 'list', values }`).
 * The active cell shows an arrow; click it, or press Alt+Down, to pick a value.
 */
export function listDropdown({ translate } = {}) {
  return {
    name: "listDropdown",
    setup(grid) {
      const abort = new AbortController(),
        on = (node, event, fn, options = {}) =>
          node.addEventListener(event, fn, {
            ...options,
            signal: abort.signal,
          });
      const menu = document.createElement("div");
      menu.className = "tg-context-menu tg-list-menu";
      menu.setAttribute("role", "listbox");
      menu.tabIndex = -1;
      menu.hidden = true;
      grid.el.append(menu);
      let target = null; // { row, col, values, active }
      const cellAt = (row, col) =>
        grid.canvas.querySelector(`[data-row="${row}"][data-col="${col}"]`);
      function close(focus = true) {
        if (menu.hidden) return;
        menu.hidden = true;
        menu.removeAttribute("aria-activedescendant");
        target = null;
        if (focus) grid.el.focus({ preventScroll: true });
      }
      function highlight(index) {
        if (!target) return;
        target.active = index;
        for (const item of menu.children)
          item.classList.toggle(
            "tg-menu-active",
            +item.dataset.index === index,
          );
        const item = menu.children[index];
        menu.setAttribute("aria-activedescendant", item.id);
        item.scrollIntoView?.({ block: "nearest" });
      }
      function choose(index) {
        const { row, col, values } = target;
        close();
        grid.setCell(row, col, String(values[index]));
      }
      function open(row = grid.anchor.row, col = grid.anchor.col) {
        const values = listChoices(grid, row, col);
        if (
          !values?.length ||
          grid.readOnly ||
          grid.isCellReadOnly(row, col) ||
          grid.commitEdit() === false
        )
          return false;
        const cell = cellAt(row, col);
        if (!cell) return false;
        grid._closeColumnMenu?.();
        grid._closeFilterMenu?.();
        const current = String(grid.getRawValue(row, col) ?? "");
        menu.replaceChildren(
          ...values.map((value, index) => {
            const item = document.createElement("div");
            item.className = "tg-menu-item";
            item.setAttribute("role", "option");
            item.id = `${grid._gridId}-choice-${index}`;
            item.dataset.index = index;
            item.textContent = String(value);
            item.setAttribute(
              "aria-selected",
              String(String(value) === current),
            );
            return item;
          }),
        );
        menu.setAttribute(
          "aria-label",
          translate?.("listChoose") || grid.t("listChoose"),
        );
        menu.hidden = false;
        target = { row, col, values, active: 0 };
        const root = grid.el.getBoundingClientRect(),
          box = cell.getBoundingClientRect();
        menu.style.minWidth = `${Math.max(120, box.width)}px`;
        const width = menu.offsetWidth,
          height = menu.offsetHeight;
        let top = box.bottom - root.top;
        if (
          top + height > grid.el.clientHeight - 4 &&
          box.top - root.top - height >= 4
        )
          top = box.top - root.top - height; // no room below: open upwards
        menu.style.left = `${Math.max(4, Math.min(box.left - root.left, grid.el.clientWidth - width - 4))}px`;
        menu.style.top = `${Math.max(4, top)}px`;
        const selected = values.findIndex((value) => String(value) === current);
        highlight(Math.max(0, selected));
        menu.focus({ preventScroll: true });
        return true;
      }

      on(menu, "keydown", (event) => {
        if (!target) return;
        event.stopPropagation();
        const last = target.values.length - 1,
          key = event.key;
        if (key === "Escape") {
          event.preventDefault();
          close();
        } else if (key === "Tab") close(false);
        else if (key === "ArrowDown") {
          event.preventDefault();
          highlight(Math.min(last, target.active + 1));
        } else if (key === "ArrowUp") {
          event.preventDefault();
          highlight(Math.max(0, target.active - 1));
        } else if (key === "Home") {
          event.preventDefault();
          highlight(0);
        } else if (key === "End") {
          event.preventDefault();
          highlight(last);
        } else if (key === "Enter" || key === " ") {
          event.preventDefault();
          choose(target.active);
        } else if (
          key.length === 1 &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          // type-ahead: jump to the next value that starts with the letter
          const letter = key.toLowerCase(),
            order = target.values.map((_, index) => index),
            from = target.active + 1;
          const next = [...order.slice(from), ...order.slice(0, from)].find(
            (index) =>
              String(target.values[index]).toLowerCase().startsWith(letter),
          );
          if (next !== undefined) highlight(next);
        }
      });
      on(menu, "click", (event) => {
        const item = event.target.closest("[role=option]");
        if (item && target) choose(+item.dataset.index);
      });
      on(menu, "pointermove", (event) => {
        const item = event.target.closest("[role=option]");
        if (item && target) highlight(+item.dataset.index);
      });
      on(
        document,
        "pointerdown",
        (event) => {
          if (!menu.hidden && !menu.contains(event.target)) close(false);
        },
        { capture: true },
      );

      // A press captures the pointer on the canvas, so the click reports the canvas: find the arrow by position.
      // Only a cell that was already active opens its menu, so selecting a cell near its edge does not.
      let armed = null;
      on(
        grid.canvas,
        "pointerdown",
        (event) => {
          const cell = event.target.closest?.(".tg-cell"),
            row = cell && +cell.dataset.row,
            col = cell && +cell.dataset.col;
          armed =
            cell &&
            row === grid.anchor.row &&
            col === grid.anchor.col &&
            cell.classList.contains("tg-has-list")
              ? { row, col }
              : null;
        },
        { capture: true },
      );
      on(grid.canvas, "click", (event) => {
        if (!armed) return;
        const { row, col } = armed;
        armed = null;
        const cell = cellAt(row, col),
          box = cell?.getBoundingClientRect();
        if (
          box &&
          event.clientX >= box.right - 30 &&
          event.clientX <= box.right &&
          event.clientY >= box.top &&
          event.clientY <= box.bottom
        )
          open(row, col);
      });
      on(
        grid.el,
        "keydown",
        (event) => {
          if (
            event.target !== grid.el ||
            !event.altKey ||
            event.key !== "ArrowDown" ||
            !listChoices(grid, grid.anchor.row, grid.anchor.col)
          )
            return;
          event.preventDefault();
          event.stopImmediatePropagation();
          open();
        },
        { capture: true },
      );
      const offs = [
        grid.on("scroll", () => close(false)),
        grid.on("select", () => close(false)),
        grid.on("worksheet", () => close(false)),
      ];
      return {
        open,
        close,
        destroy() {
          abort.abort();
          offs.forEach((off) => off?.());
          menu.remove();
        },
      };
    },
  };
}
