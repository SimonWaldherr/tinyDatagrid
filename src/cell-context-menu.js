/** Optional cell menu. Host actions can be added without changing the grid core. */
export function cellContextMenu({translate,items=[]}={}){return {name:'cellContextMenu',setup(grid){
  const labels={edit:['Bearbeiten','Edit'],copy:['Kopieren','Copy'],paste:['Einfügen','Paste'],clear:['Inhalt löschen','Clear contents'],undo:['Rückgängig','Undo'],redo:['Wiederholen','Redo'],insertRow:['Zeile oberhalb einfügen','Insert row above'],insertColumn:['Spalte links einfügen','Insert column left'],deleteRow:['Zeile löschen','Delete row'],deleteColumn:['Spalte löschen','Delete column'],menu:['Zellaktionen','Cell actions']};
  const t=key=>translate?.(key)||labels[key]?.[String(grid.locale).startsWith('de')?0:1]||key;
  const abort=new AbortController(),on=(node,event,fn,options={})=>node.addEventListener(event,fn,{...options,signal:abort.signal});
  const menu=document.createElement('div');menu.className='tg-context-menu tg-cell-menu';menu.setAttribute('role','menu');menu.hidden=true;grid.el.append(menu);
  const close=(focus=true)=>{menu.hidden=true;if(focus)grid.el.focus({preventScroll:true})};
  const editable=()=>!grid.readOnly&&!grid.isCellReadOnly(grid.anchor.row,grid.anchor.col);
  const actions=[
    {id:'edit',enabled:editable,action:()=>grid.edit()},
    {id:'copy',action:async()=>{if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(grid.copySelection())}},
    {id:'paste',enabled:editable,action:async()=>{if(!navigator.clipboard?.readText)throw new Error('Clipboard unavailable');const target={...grid.anchor},sheet=grid.feature('worksheets')?.activeId;const text=await navigator.clipboard.readText();if(sheet!==grid.feature('worksheets')?.activeId||grid.readOnly)return;grid.pasteText(text,target)}},
    {id:'clear',enabled:editable,action:()=>grid.clearSelection()},
    {id:'undo',enabled:()=>!grid.readOnly&&grid.canUndo,action:()=>grid.undo()},
    {id:'redo',enabled:()=>!grid.readOnly&&grid.canRedo,action:()=>grid.redo()},
    {id:'insertRow',enabled:editable,action:()=>grid.insertRow(grid.anchor.row)},
    {id:'insertColumn',enabled:()=>editable()&&!grid.sqlBinding,action:()=>grid.insertColumn(grid.anchor.col)},
    {id:'deleteRow',enabled:()=>editable()&&grid.rowCount>1,action:()=>grid.deleteRow(grid.anchor.row)},
    {id:'deleteColumn',enabled:()=>editable()&&!grid.sqlBinding&&grid.colCount>1,action:()=>grid.deleteColumn(grid.anchor.col)},...items];
  function open(x,y){
    if(grid.commitEdit()===false)return;
    grid._closeColumnMenu();grid._closeFilterMenu();menu.replaceChildren();menu.setAttribute('aria-label',t('menu'));
    for(const item of actions){const button=document.createElement('button');button.type='button';button.className='tg-menu-item';button.setAttribute('role','menuitem');button.textContent=item.label||t(item.id);button.disabled=item.enabled?!item.enabled(grid):false;
      button.onclick=async()=>{if(button.disabled||(item.enabled&&!item.enabled(grid)))return;close();try{await item.action(grid)}catch(error){grid.emit('contextmenuerror',{error})}};menu.append(button)}
    menu.hidden=false;const root=grid.el.getBoundingClientRect();menu.style.left=Math.max(0,Math.min(x-root.left,grid.el.clientWidth-menu.offsetWidth))+'px';menu.style.top=Math.max(0,Math.min(y-root.top,grid.el.clientHeight-menu.offsetHeight))+'px';menu.querySelector('button:not(:disabled)')?.focus();
  }
  on(grid.canvas,'contextmenu',event=>{const cell=event.target.closest('.tg-cell');if(!cell)return;event.preventDefault();const row=+cell.dataset.row,col=+cell.dataset.col,s=grid.selection;if(row<Math.min(s.r1,s.r2)||row>Math.max(s.r1,s.r2)||col<Math.min(s.c1,s.c2)||col>Math.max(s.c1,s.c2))grid.select(row,col);open(event.clientX,event.clientY)});
  on(grid.el,'keydown',event=>{if(event.target!==grid.el)return;if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){event.preventDefault();event.stopImmediatePropagation();const cell=grid.canvas.querySelector(`[data-row="${grid.anchor.row}"][data-col="${grid.anchor.col}"]`),rect=(cell||grid.scroll).getBoundingClientRect();open(rect.left,rect.bottom)}},{capture:true});
  on(menu,'keydown',event=>{event.stopPropagation();const buttons=[...menu.querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(document.activeElement);if(event.key==='Escape'){event.preventDefault();close()}else if(event.key==='Tab')close(false);else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus()}});
  on(document,'pointerdown',event=>{if(!menu.hidden&&!menu.contains(event.target))close(false)},{capture:true});
  const off=grid.on('scroll',()=>close(false)),sheetOff=grid.on('worksheet',()=>close(false));
  return {open,close,destroy(){abort.abort();off();sheetOff();menu.remove()}};
}}}
