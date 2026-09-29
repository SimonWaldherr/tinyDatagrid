import { featureTranslator } from './feature-i18n.js';

// Worksheet tab strip with a context menu; requires worksheets() to be installed first.
//   Right click, long press (touch), the ContextMenu key or Shift+F10 open the menu.
//   Double click or F2 renames inside the tab; tabs can be dragged to reorder (mouse).
const TAB_COLORS = [['Blue', '#2a78d6'], ['Green', '#1baf7a'], ['Yellow', '#eda100'], ['Orange', '#eb6834'], ['Red', '#e34948'], ['Pink', '#e87ba4'], ['Violet', '#4a3aa7'], ['Gray', '#898781']];
const LONG_PRESS = 500;

export function worksheetTabs({ container, translate } = {}) {
  return { name: 'worksheetTabs', setup(grid) {
    const sheets = grid.feature('worksheets');
    if (!sheets) throw new Error('Install worksheets() before worksheetTabs()');
    const host = typeof container === 'string' ? document.querySelector(container) : container;
    if (!host) throw new Error('Worksheet tabs container missing');
    const fallback = () => featureTranslator(grid.locale);
    const t = key => { const value = translate?.(key); return value && value !== key ? value : fallback()(key); };
    const abort = new AbortController();
    const on = (node, type, listener, options = {}) => node.addEventListener(type, listener, { ...options, signal: abort.signal });

    const root = document.createElement('div'); root.className = 'tg-worksheet-bar'; host.append(root);
    // The menu lives inside the grid root so it inherits the theme variables; fixed positioning lets it leave the grid.
    const menu = document.createElement('div'); menu.className = 'tg-context-menu tg-sheet-menu'; menu.setAttribute('role', 'menu'); menu.hidden = true; grid.el.append(menu);
    const dialog = document.createElement('dialog'); dialog.className = 'tg-worksheet-dialog'; document.body.append(dialog);
    let renaming = null, menuFor = null, dragging = null, suppressClick = false, pressTimer = 0, pressStart = null;
    const finePointer = () => globalThis.matchMedia?.('(pointer: fine)').matches ?? true;
    const locked = () => grid.readOnly || Boolean(grid.sqlBinding);

    function safely(action) { try { return action(); } catch (error) { grid.emit('worksheeterror', { error }); } }
    const refocus = id => queueMicrotask(() => tabButton(id)?.focus({ preventScroll: true }));
    const tabButton = id => [...root.querySelectorAll('[data-sheet-id]')].find(node => node.dataset.sheetId === id);
    function newSheetName() {
      const names = new Set(sheets.list().map(sheet => sheet.name.toLowerCase()));
      let index = 1; while (names.has(`${t('wsSheet')} ${index}`.toLowerCase())) index++;
      return `${t('wsSheet')} ${index}`;
    }
    function addSheet(after) {
      if (locked() || grid.commitEdit() === false) return;
      safely(() => {
        const id = sheets.add(newSheetName());
        if (after) { const position = sheets.list().findIndex(sheet => sheet.id === after); if (position >= 0) sheets.move(id, position + 1); }
        sheets.select(id); grid.el.focus({ preventScroll: true });
      });
    }
    function neighbour(id, direction) {
      const all = sheets.list(), index = all.findIndex(sheet => sheet.id === id);
      for (let i = index + direction; i >= 0 && i < all.length; i += direction) if (!all[i].hidden) return { id: all[i].id, index: i };
      return null;
    }

    // ---- inline rename ---------------------------------------------------------
    function beginRename(id) {
      if (locked() || grid.commitEdit() === false) return;
      if (!sheets.list().some(sheet => sheet.id === id)) return;
      closeMenu(false); renaming = id; render(true);
      const input = root.querySelector('.tg-worksheet-rename');
      input?.focus(); input?.select();
    }
    function finishRename(commit, input, id) {
      if (renaming !== id) return true;
      const value = input.value.trim(), current = sheets.list().find(sheet => sheet.id === id)?.name;
      if (commit && value && value !== current) {
        try { sheets.rename(id, value); }
        catch (error) { input.setAttribute('aria-invalid', 'true'); input.title = error.message; return false; }
      }
      renaming = null; render(true); tabButton(id)?.focus();
      return true;
    }

    // ---- delete confirmation ---------------------------------------------------
    function confirmDelete(id) {
      const entry = sheets.list().find(sheet => sheet.id === id);
      if (!entry || locked() || sheets.list().length < 2) return;
      dialog.replaceChildren();
      dialog.setAttribute('aria-label', t('wsDelete'));
      const form = document.createElement('form'), title = document.createElement('h2'), message = document.createElement('p'), actions = document.createElement('div');
      const cancel = document.createElement('button'), remove = document.createElement('button');
      form.method = 'dialog'; title.textContent = t('wsDelete');
      message.textContent = t('wsDeleteQuestion').replace('{name}', entry.name);
      actions.className = 'tg-worksheet-actions';
      cancel.type = 'button'; cancel.textContent = t('wsCancel'); cancel.onclick = () => dialog.close();
      remove.type = 'submit'; remove.textContent = t('wsDelete'); remove.className = 'danger';
      form.onsubmit = event => { event.preventDefault(); dialog.close(); safely(() => { sheets.remove(id); grid.el.focus({ preventScroll: true }); }); };
      actions.append(cancel, remove); form.append(title, message, actions); dialog.append(form);
      dialog.showModal(); cancel.focus();
    }

    // ---- context menu ----------------------------------------------------------
    function items(id) {
      const all = sheets.list(), entry = all.find(sheet => sheet.id === id), visible = all.filter(sheet => !sheet.hidden), hidden = all.filter(sheet => sheet.hidden);
      const off = locked(), left = neighbour(id, -1), right = neighbour(id, 1);
      const list = [
        { id: 'insert', label: t('wsInsert'), enabled: !off, run: () => addSheet(id) },
        { id: 'rename', label: t('wsRename'), shortcut: 'F2', enabled: !off, run: () => beginRename(id) },
        { id: 'duplicate', label: t('wsDuplicate'), enabled: !off, run: () => { if (grid.commitEdit() === false) return; safely(() => { const copy = sheets.duplicate(id); if (copy) { sheets.select(copy); grid.el.focus({ preventScroll: true }); } }); } },
        { type: 'separator' },
        { id: 'left', label: t('wsMoveLeft'), enabled: !off && Boolean(left), run: () => { safely(() => sheets.move(id, left.index)); refocus(id); } },
        { id: 'right', label: t('wsMoveRight'), enabled: !off && Boolean(right), run: () => { safely(() => sheets.move(id, right.index)); refocus(id); } },
        { type: 'separator' },
        { type: 'colors' },
        { type: 'separator' },
        { id: 'hide', label: t('wsHide'), enabled: !off && visible.length > 1, run: () => safely(() => sheets.setHidden(id, true)) }
      ];
      for (const sheet of hidden.slice(0, 6)) list.push({ id: `show-${sheet.id}`, label: `${t('wsShow')}: ${sheet.name}`, enabled: !off, run: () => safely(() => sheets.setHidden(sheet.id, false)) });
      if (hidden.length > 6) list.push({ id: 'show-all', label: t('wsShowAll'), enabled: !off, run: () => safely(() => hidden.forEach(sheet => sheets.setHidden(sheet.id, false))) });
      list.push({ type: 'separator' }, { id: 'delete', label: `${t('wsDelete')} …`, danger: true, enabled: !off && all.length > 1, run: () => confirmDelete(id) });
      return { list, color: entry?.color ?? null };
    }
    function closeMenu(returnFocus = true) {
      if (menu.hidden) return;
      menu.hidden = true; menu.replaceChildren();
      const id = menuFor; menuFor = null;
      root.querySelectorAll('[aria-expanded="true"]').forEach(node => node.removeAttribute('aria-expanded'));
      if (returnFocus && id) (tabButton(id) ?? grid.el).focus({ preventScroll: true });
    }
    function openMenu(id, point) {
      const entry = sheets.list().find(sheet => sheet.id === id); if (!entry) return;
      if (grid.commitEdit() === false) return;
      grid._closeColumnMenu?.(); grid._closeFilterMenu?.();
      closeMenu(false); menuFor = id;
      const { list, color } = items(id);
      menu.replaceChildren();
      menu.setAttribute('aria-label', `${t('wsMenu')}: ${entry.name}`);
      for (const item of list) {
        if (item.type === 'separator') { const line = document.createElement('div'); line.className = 'tg-menu-separator'; line.setAttribute('role', 'separator'); menu.append(line); continue; }
        if (item.type === 'colors') {
          const title = document.createElement('div'), group = document.createElement('div');
          title.className = 'tg-menu-title'; title.textContent = t('wsColor'); title.setAttribute('role', 'presentation');
          group.className = 'tg-sheet-colors'; group.setAttribute('role', 'group'); group.setAttribute('aria-label', t('wsColor'));
          const choices = [[null, 'wsColorNone', null], ...TAB_COLORS.map(([name, value]) => [value, `wsColor${name}`, value])];
          for (const [value, label] of choices) {
            const swatch = document.createElement('button');
            swatch.type = 'button'; swatch.className = `tg-sheet-color${value ? '' : ' none'}`; swatch.setAttribute('role', 'menuitemradio');
            swatch.setAttribute('aria-checked', String(value === color)); swatch.setAttribute('aria-label', t(label)); swatch.title = t(label);
            if (value) swatch.style.setProperty('--swatch', value);
            swatch.disabled = locked();
            swatch.onclick = () => { closeMenu(false); safely(() => sheets.setColor(id, value)); refocus(id); };
            group.append(swatch);
          }
          menu.append(title, group); continue;
        }
        const button = document.createElement('button');
        button.type = 'button'; button.className = `tg-menu-item${item.danger ? ' danger' : ''}`; button.setAttribute('role', 'menuitem'); button.disabled = !item.enabled;
        const label = document.createElement('span'); label.textContent = item.label; button.append(label);
        if (item.shortcut) { const hint = document.createElement('span'); hint.className = 'tg-menu-shortcut'; hint.textContent = item.shortcut; button.append(hint); }
        button.onclick = () => { if (button.disabled) return; closeMenu(false); item.run(); };
        menu.append(button);
      }
      tabButton(id)?.setAttribute('aria-expanded', 'true');
      menu.style.visibility = 'hidden'; menu.style.left = '0px'; menu.style.top = '0px'; menu.hidden = false;
      const width = menu.offsetWidth, height = menu.offsetHeight, margin = 6;
      const x = Math.max(margin, Math.min(point.x, innerWidth - width - margin));
      // The strip sits at the bottom of the page: open upwards when there is no room below.
      const anchor = tabButton(id)?.getBoundingClientRect();
      let y = point.y + height + margin > innerHeight ? (anchor ? anchor.top - height - 4 : point.y - height) : point.y;
      y = Math.max(margin, Math.min(y, innerHeight - height - margin));
      menu.style.left = `${x}px`; menu.style.top = `${y}px`; menu.style.visibility = '';
      menu.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
    }
    on(menu, 'keydown', event => {
      event.stopPropagation();
      const buttons = [...menu.querySelectorAll('button:not(:disabled)')], index = buttons.indexOf(document.activeElement);
      const move = target => { event.preventDefault(); buttons[(target + buttons.length) % buttons.length]?.focus(); };
      if (event.key === 'Escape') { event.preventDefault(); closeMenu(); }
      else if (event.key === 'Tab') closeMenu(false);
      else if (event.key === 'ArrowDown') move(index + 1);
      else if (event.key === 'ArrowUp') move(index - 1);
      else if (event.key === 'Home') move(0);
      else if (event.key === 'End') move(buttons.length - 1);
      else if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && document.activeElement?.classList.contains('tg-sheet-color')) move(index + (event.key === 'ArrowRight' ? 1 : -1));
    });
    on(document, 'pointerdown', event => { if (!menu.hidden && !menu.contains(event.target)) closeMenu(false); }, { capture: true });
    on(window, 'resize', () => closeMenu(false));
    on(window, 'blur', () => closeMenu(false));

    // ---- tab strip -------------------------------------------------------------
    function render(force = false) {
      if (renaming && !force) return;
      root.replaceChildren();
      const list = document.createElement('div'); list.className = 'tg-worksheet-list'; list.setAttribute('role', 'tablist'); list.setAttribute('aria-label', t('wsSheets'));
      const entries = sheets.list(), visible = entries.filter(entry => !entry.hidden);
      for (const entry of visible) {
        if (entry.id === renaming) {
          const input = document.createElement('input');
          input.className = 'tg-worksheet-rename'; input.value = entry.name; input.maxLength = 80; input.required = true; input.setAttribute('aria-label', t('wsName')); input.spellcheck = false;
          input.style.width = `${Math.min(40, Math.max(10, entry.name.length + 3))}ch`;
          input.onkeydown = event => {
            event.stopPropagation();
            if (event.key === 'Enter') { event.preventDefault(); finishRename(true, input, entry.id); }
            else if (event.key === 'Escape') { event.preventDefault(); finishRename(false, input, entry.id); }
          };
          input.oninput = () => { input.removeAttribute('aria-invalid'); input.removeAttribute('title'); input.style.width = `${Math.min(40, Math.max(10, input.value.length + 3))}ch`; };
          input.onblur = () => { if (!finishRename(true, input, entry.id)) finishRename(false, input, entry.id); };
          list.append(input); continue;
        }
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'tg-worksheet-tab'; button.textContent = entry.name; button.dataset.sheetId = entry.id;
        button.setAttribute('role', 'tab'); button.setAttribute('aria-haspopup', 'menu'); if (grid.el.id) button.setAttribute('aria-controls', grid.el.id);
        button.setAttribute('aria-selected', String(entry.id === sheets.activeId)); button.tabIndex = entry.id === sheets.activeId ? 0 : -1; button.disabled = Boolean(grid.sqlBinding);
        if (entry.color) { button.classList.add('has-color'); button.style.setProperty('--tab-color', entry.color); }
        if (finePointer() && !locked()) button.draggable = true;
        button.onclick = () => { if (suppressClick) { suppressClick = false; return; } safely(() => { sheets.select(entry.id); grid.el.focus({ preventScroll: true }); }); };
        button.ondblclick = () => beginRename(entry.id);
        button.oncontextmenu = event => { event.preventDefault(); suppressClick = false; openMenu(entry.id, { x: event.clientX, y: event.clientY }); };
        button.onkeydown = event => {
          const index = visible.findIndex(item => item.id === entry.id);
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const target = event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + visible.length) % visible.length;
            safely(() => { sheets.select(visible[target].id); root.querySelector('[aria-selected="true"]')?.focus(); });
          } else if (event.key === 'F2') { event.preventDefault(); beginRename(entry.id); }
          else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); const rect = button.getBoundingClientRect(); openMenu(entry.id, { x: rect.left, y: rect.top }); }
        };
        // Touch has no contextmenu event on iOS, so a long press opens the menu.
        button.onpointerdown = event => {
          suppressClick = false;
          if (event.pointerType === 'mouse') return;
          pressStart = { x: event.clientX, y: event.clientY };
          clearTimeout(pressTimer);
          pressTimer = setTimeout(() => { suppressClick = true; setTimeout(() => { suppressClick = false; }, 800); openMenu(entry.id, pressStart); }, LONG_PRESS);
        };
        for (const cancel of ['onpointerup', 'onpointercancel', 'onpointerleave']) button[cancel] = () => clearTimeout(pressTimer);
        button.onpointermove = event => { if (pressStart && Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) > 10) clearTimeout(pressTimer); };
        button.ondragstart = event => { dragging = entry.id; closeMenu(false); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', entry.name); };
        list.append(button);
      }
      on(list, 'dragover', event => {
        if (!dragging) return;
        const tab = event.target.closest?.('.tg-worksheet-tab'); event.preventDefault();
        list.querySelectorAll('.drop-before,.drop-after').forEach(node => node.classList.remove('drop-before', 'drop-after'));
        if (tab && tab.dataset.sheetId !== dragging) { const rect = tab.getBoundingClientRect(); tab.classList.add(event.clientX < rect.left + rect.width / 2 ? 'drop-before' : 'drop-after'); }
      });
      on(list, 'drop', event => {
        if (!dragging) return;
        event.preventDefault();
        const tab = event.target.closest?.('.tg-worksheet-tab'), source = dragging; dragging = null;
        if (!tab || tab.dataset.sheetId === source) return;
        const rect = tab.getBoundingClientRect(), all = sheets.list();
        const from = all.findIndex(sheet => sheet.id === source);
        let to = all.findIndex(sheet => sheet.id === tab.dataset.sheetId) + (event.clientX < rect.left + rect.width / 2 ? 0 : 1);
        if (from < to) to--;
        safely(() => sheets.move(source, to));
      });
      on(list, 'dragend', () => { dragging = null; list.querySelectorAll('.drop-before,.drop-after').forEach(node => node.classList.remove('drop-before', 'drop-after')); });
      const add = document.createElement('button');
      add.type = 'button'; add.className = 'tg-worksheet-add'; add.textContent = '+'; add.setAttribute('aria-label', t('wsAdd')); add.title = t('wsAdd');
      add.disabled = locked(); add.onclick = () => addSheet(null);
      root.append(list, add);
    }
    const unsubscribe = ['worksheet', 'change', 'readonly', 'locale', 'sqlresult'].map(event => grid.on(event, event === 'worksheet' ? () => { closeMenu(false); render(); } : () => render()));
    render();
    return {
      render, closeMenu, openMenu,
      rename: beginRename,
      /** Open the context menu below a tab (kept for the earlier manage() API). */
      manage(id) { const rect = tabButton(id)?.getBoundingClientRect(); openMenu(id, { x: rect?.left ?? 0, y: rect?.top ?? 0 }); },
      destroy() { abort.abort(); clearTimeout(pressTimer); unsubscribe.forEach(off => off()); dialog.remove(); menu.remove(); root.remove(); }
    };
  } };
}
