/** Reusable worksheet navigation; requires worksheets() to be installed first. */
export function worksheetTabs({container,translate}={}){return {name:'worksheetTabs',setup(grid){
  const sheets=grid.feature('worksheets');if(!sheets)throw new Error('Install worksheets() before worksheetTabs()');
  const host=typeof container==='string'?document.querySelector(container):container;if(!host)throw new Error('Worksheet tabs container missing');
  const labels={sheets:['Arbeitsblätter','Worksheets'],add:['Blatt hinzufügen','Add sheet'],name:['Blattname','Sheet name'],rename:['Umbenennen','Rename'],remove:['Blatt löschen','Delete sheet'],cancel:['Abbrechen','Cancel'],confirm:['Blatt endgültig löschen? Bezüge auf dieses Blatt werden ungültig.','Delete this sheet permanently? References to it will become invalid.'],sheet:['Tabelle','Sheet']};
  const t=key=>translate?.(key)||labels[key]?.[String(grid.locale).startsWith('de')?0:1]||key;
  const root=document.createElement('div');root.className='tg-worksheet-bar';host.append(root);
  const dialog=document.createElement('dialog');dialog.className='tg-worksheet-dialog';document.body.append(dialog);
  function safely(action){try{action()}catch(error){grid.emit('worksheeterror',{error})}}
  function manage(id){
    if(grid.readOnly||grid.sqlBinding)return;if(grid.commitEdit()===false)return;
    const entry=sheets.list().find(sheet=>sheet.id===id);if(!entry)return;
    dialog.replaceChildren();const form=document.createElement('form'),label=document.createElement('label'),input=document.createElement('input'),save=document.createElement('button'),remove=document.createElement('button'),cancel=document.createElement('button'),message=document.createElement('p');
    label.textContent=t('name');input.value=entry.name;input.required=true;input.maxLength=80;label.append(input);save.textContent=t('rename');save.type='submit';remove.type=cancel.type='button';remove.textContent=t('remove');remove.disabled=sheets.list().length===1;cancel.textContent=t('cancel');message.setAttribute('role','status');dialog.setAttribute('aria-label',t('name'));form.append(label,save,remove,cancel,message);dialog.append(form);
    let confirming=false;remove.onclick=()=>{if(!confirming){confirming=true;message.textContent=t('confirm');remove.textContent=t('confirm');return}safely(()=>{sheets.remove(id);dialog.close();grid.el.focus()})};
    cancel.onclick=()=>dialog.close();form.onsubmit=event=>{event.preventDefault();try{sheets.rename(id,input.value.trim());dialog.close();grid.el.focus()}catch(error){message.textContent=error.message}};dialog.showModal();input.focus();input.select();
  }
  function render(){
    root.replaceChildren();const list=document.createElement('div');list.className='tg-worksheet-list';list.setAttribute('role','tablist');list.setAttribute('aria-label',t('sheets'));
    const entries=sheets.list();for(const entry of entries){const button=document.createElement('button');button.type='button';button.className='tg-worksheet-tab';button.textContent=entry.name;button.setAttribute('role','tab');if(grid.el.id)button.setAttribute('aria-controls',grid.el.id);button.setAttribute('aria-selected',String(entry.id===sheets.activeId));button.tabIndex=entry.id===sheets.activeId?0:-1;button.disabled=Boolean(grid.sqlBinding);
      button.onclick=()=>safely(()=>{sheets.select(entry.id);grid.el.focus()});button.ondblclick=()=>manage(entry.id);button.oncontextmenu=event=>{event.preventDefault();manage(entry.id)};
      button.onkeydown=event=>{const index=entries.findIndex(s=>s.id===entry.id);if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const target=event.key==='Home'?0:event.key==='End'?entries.length-1:(index+(event.key==='ArrowRight'?1:-1)+entries.length)%entries.length;safely(()=>{sheets.select(entries[target].id);root.querySelector('[aria-selected="true"]')?.focus()})}else if(event.key==='F2'||event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){event.preventDefault();manage(entry.id)}};list.append(button)}
    const add=document.createElement('button');add.type='button';add.textContent='+';add.setAttribute('aria-label',t('add'));add.title=t('add');add.disabled=grid.readOnly||Boolean(grid.sqlBinding);add.onclick=()=>safely(()=>{if(grid.commitEdit()===false)return;let i=1;const names=new Set(entries.map(s=>s.name.toLowerCase()));while(names.has(`${t('sheet')} ${i}`.toLowerCase()))i++;const id=sheets.add(`${t('sheet')} ${i}`);sheets.select(id);grid.el.focus()});root.append(list,add);
  }
  const unsubscribe=['worksheet','change','readonly','locale','sqlresult'].map(event=>grid.on(event,render));render();
  return {render,manage,destroy(){unsubscribe.forEach(off=>off());dialog.remove();root.remove()}};
}}}
