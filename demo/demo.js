import { inferDelimitedRows, inferDataValue } from '../src/data-types.js';
import TinyDatagrid, { parseA1, toA1, parseCSV, detectDelimiter } from '../src/tinygrid.js';
import { translator } from './i18n.js';
import { freezePanes, conditionalFormatting, dataValidation } from '../src/features.js';
import { sheetPivots } from '../src/pivots.js';
import { functionHelp, documentedFunctions } from '../src/function-help.js';

const $ = selector => document.querySelector(selector);
const all = selector => [...document.querySelectorAll(selector)];
function preference(key, fallback) { try { return localStorage.getItem(`tinygrid.${key}`) || fallback; } catch { return fallback; } }
function savePreference(key, value) { try { localStorage.setItem(`tinygrid.${key}`, value); } catch { /* Preferences are optional. */ } }
let language = preference('language', navigator.language.startsWith('de') ? 'de' : 'en');
if (!['de', 'en'].includes(language)) language = 'en';
let t = translator(language);
let theme = preference('theme', 'system');
if (!['system', 'light', 'dark'].includes(theme)) theme = 'system';
document.documentElement.dataset.theme = theme;
$('#theme').value = theme;
$('#language').value = language;
const grid = new TinyDatagrid('#grid', { rows: 60, columns: 12, columnWidth: 120, rowHeight: 31, historyLimit: 100, externalVariables: { vat: 0.19 }, plugins: [freezePanes(), conditionalFormatting(), dataValidation(), sheetPivots()], locale: language });
let shareError = false;
let shared = false;
if (location.hash.startsWith('#tg1.')) {
  try { grid.importShareHash(); shared = true; }
  catch { shareError = true; }
}
if (!shared) {
  grid.sheetName = t('title');
  grid.load([
    ['Artikel', 'Kategorie', 'Lagerort', 'Bestand', 'Min. Bestand', 'Einzelwert', 'Lagerwert', 'Status'],
    ['Akkuschrauber', 'Werkzeug', 'Wallersdorf', 8, 5, 89.9, '=D2*F2', '=IF(D2<E2,"Nachbestellen","OK")'],
    ['Schutzhelm', 'Sicherheit', 'Wallersdorf', 3, 4, 42.5, '=D3*F3', '=IF(D3<E3,"Nachbestellen","OK")'],
    ['Warnweste', 'Sicherheit', 'Landau', 24, 10, 8.9, '=D4*F4', '=IF(D4<E4,"Nachbestellen","OK")'],
    ['Ladegerät', 'Elektronik', 'Landau', 6, 4, 34, '=D5*F5', '=IF(D5<E5,"Nachbestellen","OK")'],
    ['Erste-Hilfe-Set', 'Sicherheit', 'Wallersdorf', 2, 3, 29.9, '=D6*F6', '=IF(D6<E6,"Nachbestellen","OK")'],
    ['Messgerät', 'Elektronik', 'Dingolfing', 4, 2, 119, '=D7*F7', '=IF(D7<E7,"Nachbestellen","OK")'],
    ['Werkzeugkoffer', 'Werkzeug', 'Dingolfing', 5, 3, 64.5, '=D8*F8', '=IF(D8<E8,"Nachbestellen","OK")'],
    ['Kabeltrommel', 'Elektronik', 'Landau', 7, 5, 54.9, '=D9*F9', '=IF(D9<E9,"Nachbestellen","OK")'],
    ['Handschuhe', 'Sicherheit', 'Dingolfing', 12, 8, 6.5, '=D10*F10', '=IF(D10<E10,"Nachbestellen","OK")']
  ]);
  grid.setCell(0,8,t('grossValue'));
  for(let row=1;row<=9;row++)grid.setCell(row,8,`=G${row+1}*(1+@vat)`);
  [170,135,135,90,110,115,125,145,130].forEach((width,col) => grid.setColumnWidth(col,width));
  grid.createTable({r1:0,c1:0,r2:9,c2:8});
  grid.selection={r1:1,c1:5,r2:9,c2:6};grid.formatSelection({type:'currency',currency:'EUR',maximumFractionDigits:2});
  grid.selection={r1:1,c1:8,r2:9,c2:8};grid.formatSelection({type:'currency',currency:'EUR',maximumFractionDigits:2});
  grid.setFreezePanes({rows:1,columns:1});
  grid.setConditionalFormats([{range:{r1:1,c1:7,r2:9,c2:7},operator:'eq',value:'Nachbestellen',style:{color:'var(--tg-error)',backgroundColor:'var(--tg-error-bg)',fontWeight:'bold'}}]);
  grid.setValidationRules([{range:{r1:1,c1:3,r2:9,c2:4},type:'integer',min:0,allowEmpty:false,message:t('stockValidation')}]);
}
grid.select(1,0);
grid.clearHistory();

let noticeTimer;
function notify(message) {
  clearTimeout(noticeTimer);$('#notice').textContent=message;$('#notice').hidden=false;
  noticeTimer=setTimeout(()=>{$('#notice').hidden=true;},6500);
}
grid.on('validationerror',detail=>notify(detail.message));
function fail(error){notify(`${t('failed')}: ${error.message}`);}
const fmt = value => typeof value==='number' ? value.toLocaleString(language,{maximumFractionDigits:2}) : String(value??'');
function selection() { const s=grid.selection;return {r1:Math.min(s.r1,s.r2),r2:Math.max(s.r1,s.r2),c1:Math.min(s.c1,s.c2),c2:Math.max(s.c1,s.c2)}; }
function syncName() { $('#sheetName').value=grid.sheetName;$('#sheetTab').textContent=grid.sheetName;document.title=`${grid.sheetName} · tinyDatagrid`; }
function syncSelection() {
  const s=selection(),a=grid.anchor,cell=grid.getCell(a.row,a.col),style=cell.style||{};
  $('#nameBox').value=toA1(s.r1,s.c1)+(s.r1!==s.r2||s.c1!==s.c2?':'+toA1(s.r2,s.c2):'');
  if(document.activeElement!==$('#formula'))$('#formula').value=grid.getRawValue(a.row,a.col)??'';
  let count=0,sum=0,numbers=0;
  for(const key of grid.cells.keys()){
    const [r,c]=key.split(',').map(Number);if(r<s.r1||r>s.r2||c<s.c1||c>s.c2)continue;
    if(grid.hiddenRows.has(r)||grid.filteredRows.has(r)||grid.hiddenColumns.has(c))continue;
    const value=grid.getComputedValue(r,c);if(value!==''&&value!=null)count++;
    if(typeof value==='number'&&Number.isFinite(value)){sum+=value;numbers++;}
  }
  $('#statistics').replaceChildren(...[['count',count],['sum',sum],['average',numbers?sum/numbers:0]].map(([key,value])=>{const span=document.createElement('span'),strong=document.createElement('strong');span.textContent=t(key);strong.textContent=fmt(value);span.append(strong);return span;}));
  $('#selectionStatus').textContent=`${t('selection')} ${$('#nameBox').value}`;
  $('#dimensions').textContent=`${grid.rowCount} ${t('rows')} · ${grid.colCount} ${t('columns')}`;
  $('#boldBtn').setAttribute('aria-pressed',String(style.fontWeight==='bold'));
  $('#italicBtn').setAttribute('aria-pressed',String(style.fontStyle==='italic'));
  all('[data-align]').forEach(button=>button.setAttribute('aria-pressed',String(style.textAlign===button.dataset.align)));
  $('#numberFormat').value=(typeof cell.numberFormat==='string'?cell.numberFormat:cell.numberFormat?.type)||'general';
  syncControls();syncName();
}
const editableControls=['#boldBtn','#italicBtn','#clearStyleBtn','#numberFormat','#sumBtn','#tableBtn','#autoWidthBtn','#unhideBtn','#importBtn','#formulaApply','#sheetName'];
function syncControls(){
  const locked=grid.readOnly;
  editableControls.forEach(id=>$(id).disabled=locked);all('[data-align]').forEach(button=>button.disabled=locked);
  $('#formula').readOnly=locked;$('#readOnlyBtn').setAttribute('aria-pressed',String(locked));$('#modeStatus').textContent=t(locked?'readOnly':'ready');
  const history=grid.historyState;
  $('#undoBtn').disabled=locked||!history.undo;$('#redoBtn').disabled=locked||!history.redo;
  $('#undoCount').textContent=history.undo;$('#redoCount').textContent=history.redo;
  for(const [id,key,count,shortcut] of [['#undoBtn','undo',history.undo,'Ctrl / ⌘ + Z'],['#redoBtn','redo',history.redo,'Ctrl / ⌘ + Shift + Z · Ctrl + Y']]){
    const label=`${t(key)} (${count}) · ${shortcut}`;$(id).setAttribute('aria-label',label);$(id).title=label;
  }
  $('#sortAscBtn').disabled=locked||!grid.table;$('#sortDescBtn').disabled=locked||!grid.table;
  $('#insertPivotBtn').disabled=locked||!grid.table;$('#removePivotBtn').disabled=locked||!grid.getCell(grid.anchor.row,grid.anchor.col).pivotOwner;
  $('#clearFiltersBtn').disabled=!grid.columnFilters.size;
}
function setInspector(open){$('#inspector').hidden=!open;$('#inspectorBtn').setAttribute('aria-expanded',String(open));$('#sideToggle').setAttribute('aria-expanded',String(open));}
setInspector(innerWidth>1050);
$('#inspectorBtn').onclick=$('#sideToggle').onclick=()=>setInspector($('#inspector').hidden);
$('#closeInspector').onclick=()=>{setInspector(false);$('#sideToggle').focus();};

// Real tabs with a roving tab stop; the selected panel stays in normal tab order.
const tabs=all('[role="tab"]');
function activateTab(tab){tabs.forEach(item=>{const active=item===tab;item.setAttribute('aria-selected',String(active));item.tabIndex=active?0:-1;$('#'+item.getAttribute('aria-controls')).hidden=!active;});}
tabs.forEach((tab,index)=>{tab.onclick=()=>activateTab(tab);tab.onkeydown=e=>{let next;if(e.key==='ArrowRight')next=(index+1)%tabs.length;else if(e.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;e.preventDefault();activateTab(tabs[next]);tabs[next].focus();};});
function applyLanguage(){
  t=translator(language);document.documentElement.lang=language;
  all('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));
  all('[data-label]').forEach(el=>{el.setAttribute('aria-label',t(el.dataset.label));el.title=t(el.dataset.label);});
  all('[data-title]').forEach(el=>el.title=t(el.dataset.title));
  all('[data-placeholder]').forEach(el=>el.placeholder=t(el.dataset.placeholder));
  grid.setLocale(language);syncSelection();refreshPivotFields();renderPivot();refreshSearch(false);refreshFunctionHelp();refreshReferences();
}
$('#language').onchange=()=>{language=$('#language').value;savePreference('language',language);applyLanguage();};
$('#theme').onchange=()=>{theme=$('#theme').value;document.documentElement.dataset.theme=theme;savePreference('theme',theme);};

$('#sheetTab').onclick=()=>{if(!grid.readOnly){$('#sheetName').focus();$('#sheetName').select();}};
$('#sheetName').onchange=()=>{const name=$('#sheetName').value.trim();if(name&&!grid.readOnly&&name!==grid.sheetName){grid.setSheetName(name);}syncName();};
$('#sheetName').onkeydown=e=>{if(e.key==='Enter'){$('#sheetName').blur();grid.el.focus({preventScroll:true});}if(e.key==='Escape'){syncName();grid.el.focus({preventScroll:true});}};
$('#formulaBar').onsubmit=e=>{e.preventDefault();if(grid.readOnly)return;if(grid.setCell(grid.anchor.row,grid.anchor.col,$('#formula').value)===false)return;grid.el.focus({preventScroll:true});syncSelection();};
$('#formulaCancel').onclick=()=>{grid.el.focus({preventScroll:true});syncSelection();};
$('#formula').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('#formulaBar').requestSubmit();return}if(e.key==='Escape'){e.preventDefault();grid.el.focus({preventScroll:true});syncSelection();}};
let expandedFormula=false,traceMode='precedents';
function resizeFormula(){const input=$('#formula');input.style.height='auto';input.style.height=Math.min(expandedFormula?220:84,Math.max(32,input.scrollHeight))+'px';}
$('#formulaExpand').onclick=()=>{expandedFormula=!expandedFormula;$('#formulaExpand').setAttribute('aria-expanded',String(expandedFormula));$('#formula').rows=expandedFormula?5:1;resizeFormula();};
function showFunction(name){const info=functionHelp(name,language,grid.options.functionHelp||{});$('#functionSignature').textContent=info.signature;$('#functionDescription').textContent=info.description;}
function refreshFunctionHelp(){
  const query=$('#functionSearch').value.toUpperCase(),selected=$('#functionList').value;
  const names=[...new Set([...documentedFunctions(),...Object.keys(grid.engine.functions)])].sort().filter(name=>name.includes(query));
  $('#functionList').replaceChildren(...names.map(name=>new Option(name,name)));
  if(names.includes(selected))$('#functionList').value=selected;
  const text=$('#formula').value.slice(0,$('#formula').selectionStart).replace(/"(?:""|[^"])*"/g,'');
  const current=[...text.matchAll(/([A-Za-z_][A-Za-z0-9_.]*)\s*\(/g)].at(-1)?.[1].toUpperCase();
  if(!query&&names.includes(current))$('#functionList').value=current;
  if(names.length)showFunction($('#functionList').value);else{$('#functionSignature').textContent='';$('#functionDescription').textContent=t('noMatches');}
}
$('#formulaHelpBtn').onclick=()=>{const open=$('#formulaHelpPanel').hidden;$('#formulaHelpPanel').hidden=!open;$('#formulaHelpBtn').setAttribute('aria-expanded',String(open));if(open)refreshFunctionHelp();};
$('#functionSearch').oninput=refreshFunctionHelp;$('#functionList').onchange=()=>showFunction($('#functionList').value);
$('#formula').oninput=()=>{resizeFormula();if(!$('#formulaHelpPanel').hidden)refreshFunctionHelp();};
$('#formula').onclick=()=>{if(!$('#formulaHelpPanel').hidden)refreshFunctionHelp();};
function refreshReferences(){
  all('.tg-trace').forEach(cell=>cell.classList.remove('tg-trace'));if($('#dependencyPanel').hidden)return;
  const items=traceMode==='precedents'?grid.getPrecedents():grid.getDependents(),list=$('#referenceList');list.replaceChildren();
  for(const item of items){
    const range=traceMode==='precedents'?{r1:Math.min(item.a.row,item.b.row),r2:Math.max(item.a.row,item.b.row),c1:Math.min(item.a.col,item.b.col),c2:Math.max(item.a.col,item.b.col)}:{r1:item.row,r2:item.row,c1:item.col,c2:item.col};
    const button=document.createElement('button');button.type='button';button.textContent=traceMode==='precedents'?item.text:(item.sheet?item.sheet+'!':'')+item.address;
    const ws=grid.feature('worksheets'),local=item.sheetId===(ws?.activeId??null)&&!(item.sheet&&item.sheetId==null&&traceMode==='precedents');
    button.disabled=!local&&!item.sheetId;
    button.onclick=()=>{if(!local&&ws&&!ws.select(item.sheetId))return;grid.goTo(range.r1,range.c1);grid.select(range.r2,range.c2,true);grid.el.focus({preventScroll:true});};list.append(button);
    if(local)all('#grid [role="gridcell"]').filter(cell=>+cell.dataset.row>=range.r1&&+cell.dataset.row<=range.r2&&+cell.dataset.col>=range.c1&&+cell.dataset.col<=range.c2).forEach(cell=>cell.classList.add('tg-trace'));
  }
  if(traceMode==='precedents'){
    const formula=String(grid.getRawValue(grid.anchor.row,grid.anchor.col)).replace(/"(?:""|[^"])*"/g,'');
    for(const name of new Set([...formula.matchAll(/@([A-Za-z_][A-Za-z0-9_.]*)/g)].map(m=>m[1]))){const span=document.createElement('span');span.textContent=`@${name} = ${fmt(grid.getVariable(name))}`;list.append(span)}
  }
  if(!list.childNodes.length)list.textContent=t('noReferences');
}
$('#traceBtn').onclick=()=>{const open=$('#dependencyPanel').hidden;$('#dependencyPanel').hidden=!open;$('#traceBtn').setAttribute('aria-expanded',String(open));refreshReferences();};
for(const [id,mode] of [['#precedentsBtn','precedents'],['#dependentsBtn','dependents']])$(id).onclick=()=>{traceMode=mode;$('#precedentsBtn').setAttribute('aria-pressed',String(mode==='precedents'));$('#dependentsBtn').setAttribute('aria-pressed',String(mode==='dependents'));refreshReferences();};
$('#moveRangeBtn').onclick=()=>{if(!grid.readOnly){$('#moveDialog').showModal();$('#moveTarget').focus();}};
$('#closeMove').onclick=()=>$('#moveDialog').close();
$('#moveForm').onsubmit=e=>{e.preventDefault();const point=parseA1($('#moveTarget').value);if(!point)return;try{if(grid.moveRange(selection(),point.row,point.col)===false){notify(t('moveRejected'));return}$('#moveDialog').close();syncData();}catch(error){fail(error)}};
grid.on('historyconflict',()=>notify(t('historyConflict')));
grid.on('change',refreshReferences);grid.on('move',refreshReferences);grid.on('scroll',()=>requestAnimationFrame(refreshReferences));
$('#nameBox').onkeydown=e=>{if(e.key!=='Enter')return;e.preventDefault();const [start,end,...rest]=$('#nameBox').value.trim().split(':');const a=parseA1(start||''),b=parseA1(end||start||'');if(rest.length||!a||!b||[a,b].some(p=>p.row<0||p.row>=10000||p.col<0||p.col>=256)||(a&&b&&(Math.abs(a.row-b.row)+1)*(Math.abs(a.col-b.col)+1)>10000)){notify(t('invalidAddress'));return;}
  // Keep navigation bounded to a manageable DOM size; larger sheets use virtualization.
  if(Math.max(a.row,b.row)>500||Math.max(a.col,b.col)>100)grid.setVirtualization(true);
  grid.goTo(a.row,a.col);grid.goTo(b.row,b.col);grid.select(a.row,a.col);grid.select(b.row,b.col,true);grid.el.focus({preventScroll:true});};
function undo(){if(grid.undo())notify(t('undone'));}
function redo(){if(grid.redo())notify(t('redone'));}
$('#undoBtn').onclick=undo;$('#redoBtn').onclick=redo;
$('#vatRate').onchange=()=>grid.setExternalVariable('vat',Number($('#vatRate').value));
$('#recalculateBtn').onclick=()=>{grid.recalculate();notify(t('recalculated'));};
$('#readOnlyBtn').onclick=()=>grid.setReadOnly(!grid.readOnly);
$('#boldBtn').onclick=()=>grid.styleSelection({fontWeight:grid.getCell(grid.anchor.row,grid.anchor.col).style?.fontWeight==='bold'?'normal':'bold'});
$('#italicBtn').onclick=()=>grid.styleSelection({fontStyle:grid.getCell(grid.anchor.row,grid.anchor.col).style?.fontStyle==='italic'?'normal':'italic'});
$('#clearStyleBtn').onclick=()=>grid.styleSelection({fontWeight:'',fontStyle:'',textAlign:''});
all('[data-align]').forEach(button=>button.onclick=()=>grid.styleSelection({textAlign:button.dataset.align}));
$('#numberFormat').onchange=()=>{if(!grid.readOnly){const type=$('#numberFormat').value;grid.formatSelection(type==='general'?null:{type,...(type==='currency'?{currency:'EUR'}:{}),maximumFractionDigits:2});}};
$('#sumBtn').onclick=()=>{
  if(grid.readOnly)return;const s=selection();
  if(s.c1!==s.c2||grid.getRawValue(s.r2+1,s.c1)!==''||!Array.from({length:s.r2-s.r1+1},(_,i)=>grid.getComputedValue(s.r1+i,s.c1)).some(v=>typeof v==='number')){notify(t('sumHint'));return;}
  grid.setCell(s.r2+1,s.c1,`=SUM(${toA1(s.r1,s.c1)}:${toA1(s.r2,s.c1)})`);grid.goTo(s.r2+1,s.c1);grid.el.focus({preventScroll:true});notify(t('sumAdded'));
};
$('#tableBtn').onclick=()=>{if(!grid.readOnly)grid.createTable(grid.getUsedRange());};
function sort(direction){const col=grid.anchor.col;if(!grid.table||col<grid.table.c1||col>grid.table.c2){notify(t('sortHint'));return;}grid.sortTable(col,direction);}
$('#sortAscBtn').onclick=()=>sort('asc');$('#sortDescBtn').onclick=()=>sort('desc');
$('#clearFiltersBtn').onclick=()=>grid.clearFilters();
$('#autoWidthBtn').onclick=()=>{if(grid.readOnly)return;const s=selection();grid.transaction(()=>{for(let c=s.c1;c<=s.c2;c++)grid.autoFitColumn(c);});};
$('#unhideBtn').onclick=()=>{if(!grid.readOnly){grid.transaction(()=>{grid.showAllRows();grid.showAllColumns();});}};

let matches=[],matchIndex=-1;
function openSearch(){ $('#searchBar').hidden=false;$('#search').focus();$('#search').select(); }
function refreshSearch(move=true){
  const query=$('#search').value.toLocaleLowerCase(language);matches=[];matchIndex=-1;
  if(query)for(const [key,cell] of grid.cells){const [row,col]=key.split(',').map(Number);if(grid.hiddenRows.has(row)||grid.filteredRows.has(row)||grid.hiddenColumns.has(col))continue;if(`${cell.raw??''} ${fmt(grid.getComputedValue(row,col))}`.toLocaleLowerCase(language).includes(query))matches.push({row,col});}
  matches.sort((a,b)=>a.row-b.row||a.col-b.col);
  if(move&&matches.length)goToMatch(1);else $('#searchResult').textContent=query?`${matches.length} ${t('matches')}`:'';
}
function goToMatch(direction){if(!matches.length){$('#searchResult').textContent=t('noMatches');return;}matchIndex=(matchIndex+direction+matches.length)%matches.length;const p=matches[matchIndex];grid.goTo(p.row,p.col);$('#searchResult').textContent=`${matchIndex+1} / ${matches.length} ${t('matches')}`;}
$('#findBtn').onclick=openSearch;$('#search').oninput=()=>refreshSearch();$('#searchBar').onsubmit=e=>{e.preventDefault();goToMatch(1);};$('#previousMatch').onclick=()=>goToMatch(-1);
function closeSearch(){$('#searchBar').hidden=true;grid.el.focus({preventScroll:true});}
$('#closeSearch').onclick=closeSearch;$('#searchBar').onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();closeSearch();}};
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'&&!document.querySelector('dialog[open]')){e.preventDefault();openSearch();}});

// Text fields keep native text undo until their edit is committed. Commands
// from the grid are already handled there; toolbar focus also supports undo.
document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.altKey||!(e.ctrlKey||e.metaKey)||document.querySelector('dialog[open]'))return;
  if(e.target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]'))return;
  const key=e.key.toLowerCase();if(key!=='z'&&key!=='y')return;
  e.preventDefault();if(grid.readOnly)return;
  key==='y'||e.shiftKey?redo():undo();
});

function refreshPivotFields(){
  const table=grid.table,fields=[];
  if(table)for(let c=table.c1;c<=table.c2;c++)fields.push(String(grid.getComputedValue(table.headerRow,c)||`${t('column')} ${c+1}`));
  [$('#pivotRows'),$('#pivotColumns'),$('#pivotValues')].forEach((select,index)=>{
    const previous=select.value,wasInitialized=select.dataset.initialized==='true';select.replaceChildren();
    if(index===1){const option=new Option(t('none'),'');select.append(option);}
    fields.forEach(field=>select.append(new Option(field,field)));select.disabled=!table;
    if(wasInitialized&&(fields.includes(previous)||index===1&&previous===''))select.value=previous;
    else select.value=index===0?(fields[1]||fields[0]||''):index===1?'':fields.includes('Lagerwert')?'Lagerwert':fields.at(-1)||'';
    select.dataset.initialized='true';
  });
}
function renderPivot(){
  const table=grid.table,pivot=$('#pivot'),chart=$('#pivotChart');pivot.replaceChildren();chart.replaceChildren();
  $('#recordCount').textContent=fmt(grid.toRecords({visibleOnly:true}).length);
  $('#formulaCount').textContent=fmt([...grid.cells.values()].filter(cell=>typeof cell.raw==='string'&&cell.raw.startsWith('=')).length);
  if(!table){pivot.textContent=t('noTable');return;}
  const rowField=$('#pivotRows').value,valueField=$('#pivotValues').value,columnField=$('#pivotColumns').value;
  if(!rowField||!valueField)return;
  const rows=grid.pivot({rows:[rowField],columns:columnField?[columnField]:[],values:[{field:valueField,aggregate:$('#pivotAggregate').value,as:valueField}]}).toTable({totalLabel:t('total')});
  if(rows.length<2){pivot.textContent=t('noData');return;}
  const result=document.createElement('table'),caption=document.createElement('caption');caption.textContent=`${t('pivot')} · ${t($('#pivotAggregate').value)} · ${valueField}`;result.append(caption);
  const head=document.createElement('thead'),body=document.createElement('tbody');result.append(head,body);
  rows.forEach((row,i)=>{const tr=document.createElement('tr');row.forEach((value,c)=>{const cell=document.createElement(i&&c?'td':'th');if(!i)cell.scope='col';else if(!c)cell.scope='row';cell.textContent=fmt(value);tr.append(cell);});(i?body:head).append(tr);});pivot.append(result);
  const chartRows=rows.slice(1),max=Math.max(1,...chartRows.map(row=>Math.abs(Number(row[1])||0)));
  const chartTitle=document.createElement('p');chartTitle.className='hint';chartTitle.textContent=`${t('chart')} · ${rows[0][1]??valueField}`;chart.append(chartTitle);
  chartRows.slice(0,12).forEach(row=>{const wrap=document.createElement('div'),label=document.createElement('span'),value=document.createElement('strong'),track=document.createElement('div'),bar=document.createElement('span');wrap.className='chart-row';label.textContent=String(row[0]);value.textContent=fmt(row[1]);track.className='chart-track';bar.style.width=`${Math.abs(Number(row[1])||0)/max*100}%`;track.append(bar);wrap.append(label,value,track);chart.append(wrap);});
}
$('#insertPivotBtn').onclick=()=>{
  if(grid.readOnly||!grid.table)return;
  try{
    const source={r1:grid.table.headerRow,c1:grid.table.c1,r2:grid.table.r2,c2:grid.table.c2},target={...grid.anchor};
    grid.feature('pivots').insert({source,target,config:{rows:[$('#pivotRows').value],columns:$('#pivotColumns').value?[$('#pivotColumns').value]:[],values:[{field:$('#pivotValues').value,aggregate:$('#pivotAggregate').value,as:$('#pivotValues').value}]}});
    syncData();notify(t('pivotInserted'));
  }catch(error){fail(error)}
};
$('#removePivotBtn').onclick=()=>{const a=grid.anchor,pivot=grid.feature('pivots').list().find(p=>a.row>=p.output.r1&&a.row<=p.output.r2&&a.col>=p.output.c1&&a.col<=p.output.c2);if(pivot&&grid.feature('pivots').remove(pivot.id))syncData();};
['#pivotRows','#pivotColumns','#pivotValues','#pivotAggregate'].forEach(id=>$(id).onchange=renderPivot);
function syncData(){syncSelection();refreshPivotFields();renderPivot();if(!$('#searchBar').hidden)refreshSearch(false);}
grid.on('history',syncControls);
['change','format','fill','move','filter','sort','table','rowhide','rowshow','columnhide','columnshow','resize','variable'].forEach(event=>grid.on(event,syncData));
grid.on('select',syncSelection);grid.on('select',()=>{resizeFormula();refreshReferences();if(!$('#formulaHelpPanel').hidden)refreshFunctionHelp();});grid.on('readonly',syncControls);

function showDialog(id){grid.commitEdit();$(id).showModal();}
$('#helpBtn').onclick=()=>showDialog('#helpDialog');$('#exportBtn').onclick=()=>showDialog('#exportDialog');
$('#importBtn').onclick=()=>{if(!grid.readOnly)showDialog('#importDialog');};
$('#chooseFileBtn').onclick=()=>{if(!grid.readOnly)$('#dataFile').click();};
let pendingImport=null;
function renderImportPreview(){
  const area=$('#importPreviewTable');area.replaceChildren();if(!pendingImport)return;
  $('#importFilename').textContent=pendingImport.file.name;
  const delimited=/\.(csv|tsv|tab|txt)$/i.test(pendingImport.file.name);$('#inferImportTypes').disabled=!delimited;
  if(!delimited){area.textContent=t('importPreviewOther');return}
  const raw=parseCSV(pendingImport.text,/\.(tsv|tab)$/i.test(pendingImport.file.name)?'\t':detectDelimiter(pendingImport.text));
  const inferred=$('#inferImportTypes').checked?inferDelimitedRows(raw,{locale:pendingImport.locale}):null;
  const table=document.createElement('table'),caption=document.createElement('caption');caption.textContent=t('importPreviewSample');table.append(caption);
  for(let r=0;r<Math.min(6,raw.length);r++){
    const row=document.createElement('tr');
    for(let c=0;c<Math.min(8,raw[r].length);c++){
      const cell=document.createElement('td'),value=inferred?inferred.rows[r][c]:raw[r][c],type=!inferred||inferred.textCells.has(`${r},${c}`)?'text':inferDataValue(value,{locale:pendingImport.locale}).type;
      cell.textContent=`${raw[r][c]} → ${value instanceof Date?value.toISOString():String(value??'')} (${type}${typeof value==='bigint'?' / BigInt':''})`;row.append(cell);
    }
    table.append(row);
  }
  area.append(table);
}
$('#inferImportTypes').onchange=renderImportPreview;
$('#importDialog').addEventListener('close',()=>{pendingImport=null;$('#importPreview').hidden=true;});
$('#dataFile').onchange=async()=>{const file=$('#dataFile').files?.[0];if(!file)return;try{if(grid.readOnly)return;const text=await file.text();pendingImport={file,text,locale:language};$('#importPreview').hidden=false;renderImportPreview();}catch(error){fail(error);}finally{$('#dataFile').value='';}};
$('#applyImport').onclick=async()=>{if(!pendingImport||grid.readOnly)return;const pending=pendingImport;try{await grid.importFile(pending.file,{locale:pending.locale,inferTypes:$('#inferImportTypes').checked});if(!grid.table&&!/\.json$/i.test(pending.file.name))grid.createTable(grid.getUsedRange());syncData();$('#importDialog').close();notify(`${t('imported')}: ${pending.file.name}`);}catch(error){fail(error);}};

function download(filename,content,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#downloadBtn').onclick=()=>{try{
  const format=$('#exportFormat').value,base=grid.sheetName.replace(/[\\/:*?"<>|]/g,'-')||'tiny-datagrid';
  const formats={workbook:()=>['json',JSON.stringify(grid.exportWorkbook(),null,2),'application/json'],csv:()=>['csv',grid.exportCSV(),'text/csv'],tsv:()=>['tsv',grid.exportTSV(),'text/tab-separated-values'],json:()=>['json',JSON.stringify(grid.exportJSON(),null,2),'application/json'],html:()=>['html',grid.exportHTML(),'text/html'],markdown:()=>['md',grid.exportMarkdown(),'text/markdown']};
  const [ext,content,type]=formats[format]();download(`${base}.${ext}`,content,`${type};charset=utf-8`);$('#exportDialog').close();notify(t('downloaded'));
}catch(error){fail(error);}};
$('#shareBtn').onclick=()=>{try{grid.commitEdit();$('#shareURL').value=grid.createShareURL();$('#shareFeedback').textContent=$('#shareURL').value.length>12000?t('longLink'):'';showDialog('#shareDialog');}catch(error){fail(error);}};
$('#shareURL').onclick=()=>$('#shareURL').select();
$('#copyLinkBtn').onclick=async()=>{try{await navigator.clipboard.writeText($('#shareURL').value);$('#shareFeedback').textContent=t('copied');}catch{$('#shareURL').focus();$('#shareURL').select();$('#shareFeedback').textContent=t('manualCopy');}};
applyLanguage();
if(shareError)notify(t('invalidLink'));
