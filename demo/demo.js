import { worksheets } from '../src/worksheets.js';
import { worksheetTabs } from '../src/worksheet-tabs.js';
import { cellContextMenu } from '../src/cell-context-menu.js';
import { installAutosave } from './autosave.js';
import { demoWorkbook } from './file-tools.js';
import { exportPNG, printPDF } from '../src/exporters.js';
import { inferDelimitedRows, inferDataValue } from '../src/data-types.js';
import TinyDatagrid, { parseA1, toA1, parseCSV, detectDelimiter } from '../src/tinygrid.js';
import { translator, languages, detectLanguage } from './i18n.js';
import * as features from '../src/features.js';
const { freezePanes, conditionalFormatting, dataValidation } = features;
// Optional formula plugins are installed when this build of the library provides them.
const optionalPlugins = ['dynamicArrays', 'jsonFunctions'].flatMap(name => typeof features[name] === 'function' ? [features[name]()] : []);
import { sheetPivots } from '../src/pivots.js';
import { rawText } from '../src/json-values.js';
import { installJSONTools } from '../src/json-tools.js';
import { installSearch } from '../src/search-tools.js';
import { installCharts } from '../src/charts.js';
import { attachFormulaAssist, installFormulaTools } from '../src/formula-assist.js';

const $ = selector => document.querySelector(selector);
const all = selector => [...document.querySelectorAll(selector)];
function preference(key, fallback) { try { return localStorage.getItem(`tinygrid.${key}`) || fallback; } catch { return fallback; } }
function savePreference(key, value) { try { localStorage.setItem(`tinygrid.${key}`, value); } catch { /* Preferences are optional. */ } }
let language = detectLanguage([preference('language', ''), ...(navigator.languages || [navigator.language])]);
let t = translator(language);
const themes = ['system', 'light', 'dark', 'ocean', 'paper', 'midnight', 'graphite', 'contrast'];
const typefaces = { system: '', serif: 'Georgia,"Iowan Old Style","Times New Roman",serif', mono: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace' };
let theme = preference('theme', 'system');
if (!themes.includes(theme)) theme = 'system';
let typeface = preference('typeface', 'system');
if (!(typeface in typefaces)) typeface = 'system';
function applyTheme() {
  document.documentElement.dataset.theme = theme;
  all('[data-theme-choice]').forEach(button => { const active = button.dataset.themeChoice === theme; button.setAttribute('aria-checked', String(active)); button.tabIndex = active ? 0 : -1; });
  const background = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (background) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
}
function applyTypeface() {
  if (typefaces[typeface]) document.documentElement.style.setProperty('--tg-font', typefaces[typeface]); else document.documentElement.style.removeProperty('--tg-font');
  $('#typeface').value = typeface;
  grid.layout();
}
$('#language').replaceChildren(...languages.map(([code, name]) => new Option(name, code)));
$('#language').value = language;
const grid = new TinyDatagrid('#grid', { rows: 60, columns: 12, columnWidth: 120, rowHeight: 31, historyLimit: 100, plugins: [freezePanes(), conditionalFormatting(), dataValidation(), ...optionalPlugins, sheetPivots(), worksheets()], locale: language });
let shareError = false;
let shared = false;
if (location.hash.startsWith('#tg1.')) {
  try { grid.importShareHash(); shared = true; }
  catch { shareError = true; }
}
if (!shared) grid.sheetName = t('title');
$('.app').inert=true;
const autosave=await installAutosave(grid,{formula:$('#formula'),key:`demo:${location.pathname}:${location.hash.startsWith('#tg1.')?location.hash:'local'}`,status:key=>{const el=$('#localSaveStatus');el.dataset.i18n=key;el.textContent=t(key);}});
$('.app').inert=false;
grid.select(0,0);
grid.clearHistory();
applyTheme();applyTypeface();
// iOS keeps the layout viewport under the keyboard; follow the visual viewport so the cell editor stays visible.
if(window.visualViewport){
  const syncViewport=()=>{const v=visualViewport;if(Math.abs(v.scale-1)<.01){document.documentElement.style.setProperty('--app-height',`${Math.round(v.height)}px`);if(v.offsetTop>0)scrollTo(0,0);}};
  visualViewport.addEventListener('resize',syncViewport);visualViewport.addEventListener('scroll',syncViewport);syncViewport();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if(theme==='system')applyTheme();});

let noticeTimer;
function notify(message) {
  clearTimeout(noticeTimer);$('#notice').textContent=message;$('#notice').hidden=false;
  noticeTimer=setTimeout(()=>{$('#notice').hidden=true;},6500);
}
grid.on('validationerror',detail=>notify(detail.message));
function fail(error){notify(`${t('failed')}: ${error.message}`);}
const fmt = value => typeof value==='number' ? value.toLocaleString(language,{maximumFractionDigits:2}) : String(value??'');
function selection() { const s=grid.selection;return {r1:Math.min(s.r1,s.r2),r2:Math.max(s.r1,s.r2),c1:Math.min(s.c1,s.c2),c2:Math.max(s.c1,s.c2)}; }
function syncName() { $('#sheetName').value=grid.sheetName;document.title=`${grid.sheetName} · tinyDatagrid`; }
function syncSelection() {
  const s=selection(),a=grid.anchor,cell=grid.getCell(a.row,a.col),style=cell.style||{};
  $('#nameBox').value=toA1(s.r1,s.c1)+(s.r1!==s.r2||s.c1!==s.c2?':'+toA1(s.r2,s.c2):'');
  if(document.activeElement!==$('#formula'))$('#formula').value=rawText(grid.getRawValue(a.row,a.col));
  let count=0,sum=0,numbers=0;
  const area=(s.r2-s.r1+1)*(s.c2-s.c1+1);
  function* selectedKeys(){if(area<=Math.min(grid.cells.size,10000)){for(let r=s.r1;r<=s.r2;r++)for(let c=s.c1;c<=s.c2;c++)yield `${r},${c}`;}else yield* grid.cells.keys();}
  for(const key of selectedKeys()){
    const [r,c]=key.split(',').map(Number);if(r<s.r1||r>s.r2||c<s.c1||c>s.c2)continue;
    if(grid.hiddenRows.has(r)||grid.filteredRows.has(r)||grid.hiddenColumns.has(c))continue;
    const value=grid.getComputedValue(r,c);if(value!==''&&value!=null)count++;
    if(typeof value==='number'&&Number.isFinite(value)){sum+=value;numbers++;}
  }
  $('#statistics').replaceChildren(...[['count',count],['sum',sum],['average',numbers?sum/numbers:0]].map(([key,value])=>{const span=document.createElement('span'),strong=document.createElement('strong');span.textContent=t(key);strong.textContent=fmt(value);span.append(strong);return span;}));
  $('#inspectorSelection').textContent=$('#nameBox').value;$('#inspectorValue').textContent=String(grid.getComputedValue(grid.anchor.row,grid.anchor.col)??'').slice(0,500);
  $('#selectionStatus').textContent=`${t('selection')} ${$('#nameBox').value}`;
  $('#dimensions').textContent=`${grid.rowCount} ${t('rows')} · ${grid.colCount} ${t('columns')}`;
  $('#boldBtn').setAttribute('aria-pressed',String(style.fontWeight==='bold'));
  $('#italicBtn').setAttribute('aria-pressed',String(style.fontStyle==='italic'));
  all('[data-align]').forEach(button=>button.setAttribute('aria-pressed',String(style.textAlign===button.dataset.align)));
  $('#numberFormat').value=(typeof cell.numberFormat==='string'?cell.numberFormat:cell.numberFormat?.type)||'general';
  syncControls();syncName();jsonTools?.sync();
}
let jsonTools, formulaTools;
const editableControls=['#boldBtn','#italicBtn','#clearStyleBtn','#numberFormat','#sumBtn','#toolFitBtn','#tableBtn','#autoWidthBtn','#unhideBtn','#importBtn','#formulaApply','#sheetName'];
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
let inspectorTimer;
function scheduleInspector(){clearTimeout(inspectorTimer);if(!$('#inspector').hidden)inspectorTimer=setTimeout(()=>{refreshPivotFields();renderPivot();},120);}
function setInspector(open){$('#inspector').hidden=!open;if(open)scheduleInspector();$('#inspectorBtn').setAttribute('aria-expanded',String(open));$('#sideToggle').setAttribute('aria-expanded',String(open));}
setInspector(innerWidth>1050);
$('#inspectorBtn').onclick=$('#sideToggle').onclick=()=>setInspector($('#inspector').hidden);
$('#pivotBtn').onclick=()=>{
  setInspector(true);$('#pivotSection').open=true;
  refreshPivotFields();renderPivot();
  const summary=$('#pivotSection summary');summary.focus();summary.scrollIntoView({block:'nearest'});
};
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
  grid.setLocale(language);syncSelection();refreshPivotFields();renderPivot();refreshSearch(false);formulaTools?.refreshFunctionHelp();formulaTools?.refreshReferences();syncFreezeControls();
}
$('#language').onchange=()=>{language=$('#language').value;savePreference('language',language);applyLanguage();};
function chooseTheme(name){theme=name;savePreference('theme',theme);applyTheme();}
const themeButtons=all('[data-theme-choice]');
themeButtons.forEach((button,index)=>{
  button.onclick=()=>chooseTheme(button.dataset.themeChoice);
  button.onkeydown=e=>{
    const next={ArrowRight:index+1,ArrowDown:index+1,ArrowLeft:index-1,ArrowUp:index-1,Home:0,End:themeButtons.length-1}[e.key];
    if(next===undefined)return;e.preventDefault();const target=themeButtons[(next+themeButtons.length)%themeButtons.length];chooseTheme(target.dataset.themeChoice);target.focus();
  };
});
$('#appearanceBtn').onclick=()=>showDialog('#appearanceDialog');$('#closeAppearance').onclick=()=>$('#appearanceDialog').close();
$('#typeface').onchange=()=>{typeface=$('#typeface').value;savePreference('typeface',typeface);applyTypeface();};


$('#sheetName').onchange=()=>{const name=$('#sheetName').value.trim();if(name&&!grid.readOnly&&name!==grid.sheetName){try{grid.feature('worksheets').rename(grid.feature('worksheets').activeId,name)}catch(error){fail(error)}}syncName();};
$('#sheetName').onkeydown=e=>{if(e.key==='Enter'){$('#sheetName').blur();grid.el.focus({preventScroll:true});}if(e.key==='Escape'){syncName();grid.el.focus({preventScroll:true});}};
function applyFormula(direction){
  if(grid.readOnly)return;
  if(grid.setCell(grid.anchor.row,grid.anchor.col,$('#formula').value)===false)return;
  grid.el.focus({preventScroll:true});
  if(direction)grid.moveSelection(direction);
  syncSelection();
}
$('#formulaBar').onsubmit=e=>{e.preventDefault();applyFormula();};
$('#formulaCancel').onclick=()=>{grid.el.focus({preventScroll:true});syncSelection();};
$('#formula').onkeydown=e=>{
  if(e.isComposing||e.defaultPrevented)return;
  if((e.key==='Enter'&&!e.shiftKey)||e.key==='Tab'){
    e.preventDefault();applyFormula(e.key==='Tab'?(e.shiftKey?'left':'right'):((e.ctrlKey||e.metaKey)?'up':'down'));return;
  }
  if(e.key==='Escape'){e.preventDefault();grid.el.focus({preventScroll:true});syncSelection();}
};
let expandedFormula=false;
function resizeFormula(){const input=$('#formula');input.style.height='auto';input.style.height=Math.min(expandedFormula?220:84,Math.max(32,input.scrollHeight))+'px';}
$('#formulaExpand').onclick=()=>{expandedFormula=!expandedFormula;$('#formulaExpand').setAttribute('aria-expanded',String(expandedFormula));$('#formula').rows=expandedFormula?5:1;resizeFormula();};
$('#formula').oninput=resizeFormula;
$('#moveRangeBtn').onclick=()=>{if(!grid.readOnly){$('#moveDialog').showModal();$('#moveTarget').focus();}};
$('#closeMove').onclick=()=>$('#moveDialog').close();
$('#moveForm').onsubmit=e=>{e.preventDefault();const point=parseA1($('#moveTarget').value);if(!point)return;try{if(grid.moveRange(selection(),point.row,point.col)===false){notify(t('moveRejected'));return}$('#moveDialog').close();syncData();}catch(error){fail(error)}};
grid.on('historyconflict',()=>notify(t('historyConflict')));
$('#nameBox').onkeydown=e=>{if(e.key!=='Enter')return;e.preventDefault();const [start,end,...rest]=$('#nameBox').value.trim().split(':');const a=parseA1(start||''),b=parseA1(end||start||'');if(rest.length||!a||!b||[a,b].some(p=>p.row<0||p.row>=10000||p.col<0||p.col>=256)||(a&&b&&(Math.abs(a.row-b.row)+1)*(Math.abs(a.col-b.col)+1)>10000)){notify(t('invalidAddress'));return;}
  // Keep navigation bounded to a manageable DOM size; larger sheets use virtualization.
  if(Math.max(a.row,b.row)>500||Math.max(a.col,b.col)>100)grid.setVirtualization(true);
  grid.goTo(a.row,a.col);grid.goTo(b.row,b.col);grid.select(a.row,a.col);grid.select(b.row,b.col,true);grid.el.focus({preventScroll:true});};
function undo(){if(grid.undo())notify(t('undone'));}
function redo(){if(grid.redo())notify(t('redone'));}
$('#undoBtn').onclick=undo;$('#redoBtn').onclick=redo;
function syncFreezeControls(){
  const {rows,columns}=grid.freezePanes;
  $('#freezeStatus').textContent=`${t('rows')}: ${rows} · ${t('columns')}: ${columns}`;
  $('#unfreezeBtn').disabled=!rows&&!columns;
  $('#freezeSelectionBtn').disabled=grid.anchor.row===0&&grid.anchor.col===0;
}
$('#freezeRowBtn').onclick=()=>grid.setFreezePanes({rows:1});
$('#freezeColumnBtn').onclick=()=>grid.setFreezePanes({columns:1});
$('#freezeSelectionBtn').onclick=()=>{const {row,col}=grid.anchor;if(grid.rowOffsets[row]>=grid.scroll.clientHeight-31||grid.colOffsets[col]>=grid.scroll.clientWidth-48){notify(t('freezeTooLarge'));return}grid.setFreezePanes({rows:row,columns:col});};
$('#unfreezeBtn').onclick=()=>grid.setFreezePanes({rows:0,columns:0});
for(const event of ['freezepanes','select','change'])grid.on(event,syncFreezeControls);
syncFreezeControls();
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
$('#toolFunctionsBtn').onclick=()=>{if($('#formulaHelpPanel').hidden)$('#formulaHelpBtn').click();$('#functionSearch').focus();};
$('#toolReferencesBtn').onclick=()=>{if($('#dependencyPanel').hidden)$('#traceBtn').click();$('#precedentsBtn').focus();};
$('#toolFitBtn').onclick=()=>$('#autoWidthBtn').click();
$('#tableBtn').onclick=()=>{if(!grid.readOnly)grid.createTable(grid.getUsedRange());};
function sort(direction){const col=grid.anchor.col;if(!grid.table||col<grid.table.c1||col>grid.table.c2){notify(t('sortHint'));return;}grid.sortTable(col,direction);}
$('#sortAscBtn').onclick=()=>sort('asc');$('#sortDescBtn').onclick=()=>sort('desc');
$('#clearFiltersBtn').onclick=()=>grid.clearFilters();
$('#autoWidthBtn').onclick=()=>{if(grid.readOnly)return;const s=selection();grid.transaction(()=>{for(let c=s.c1;c<=s.c2;c++)grid.autoFitColumn(c);});};
$('#unhideBtn').onclick=()=>{if(!grid.readOnly){grid.transaction(()=>{grid.showAllRows();grid.showAllColumns();});}};

installCharts({grid,$,t:key=>t(key),notify,selection,getLanguage:()=>language});
const searchTools=installSearch({grid,$,t:key=>t(key),notify,selection});
const refreshSearch=searchTools.refresh,openSearch=searchTools.open;
formulaTools=installFormulaTools({grid,$,t:key=>t(key),language:()=>language,formatValue:fmt});

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
    else select.value=index===0?(fields[1]||fields[0]||''):index===1?'':fields.at(-1)||'';
    select.dataset.initialized='true';
  });
}
function renderPivot(manual=false){
  if($('#inspector').hidden)return;
  const table=grid.table,pivot=$('#pivot'),chart=$('#pivotChart');pivot.replaceChildren();chart.replaceChildren();
  let rowCount=table?Math.max(0,table.r2-table.headerRow):0;
  if(table)for(const row of new Set([...grid.hiddenRows,...grid.filteredRows]))if(row>table.headerRow&&row<=table.r2)rowCount--;
  let filled=0,formulas=0;for(const [key,cell] of grid.cells){const [r,c]=key.split(',').map(Number);if(cell.raw!==''&&cell.raw!=null&&!grid.hiddenRows.has(r)&&!grid.filteredRows.has(r)&&!grid.hiddenColumns.has(c))filled++;if(cell.valueType!=='text'&&typeof cell.raw==='string'&&cell.raw.startsWith('='))formulas++;}
  $('#recordLabel').textContent=t(table?'visibleRows':'filledCells');$('#recordCount').textContent=fmt(table?rowCount:filled);
  $('#pivotSource').textContent=table?`${toA1(table.headerRow,table.c1)}:${toA1(table.r2,table.c2)} · ${fmt(rowCount)} ${t('rows')}`:t('noTable');
  $('#formulaCount').textContent=fmt(formulas);
  if(!table){pivot.textContent=t('noTable');return;}
  if(!$('#pivotSection').open)return;
  const work=(table.r2-table.headerRow)*(table.c2-table.c1+1);
  if(work>500000){pivot.textContent=t('analysisTooLarge');return}
  if(work>100000&&!manual){pivot.textContent=t('analysisManual');return}
  const rowField=$('#pivotRows').value,valueField=$('#pivotValues').value,columnField=$('#pivotColumns').value;
  if(!rowField||!valueField)return;
  const rows=grid.pivot({rows:[rowField],columns:columnField?[columnField]:[],values:[{field:valueField,aggregate:$('#pivotAggregate').value,as:valueField}]}).toTable({totalLabel:t('total')});
  if(rows.length<2){pivot.textContent=t('noData');return;}
  const displayRows=rows.slice(0,201);if(rows.length>201){const note=document.createElement('p');note.textContent=t('analysisTruncated');pivot.append(note);}
  const result=document.createElement('table'),caption=document.createElement('caption');caption.textContent=`${t('pivot')} · ${t($('#pivotAggregate').value)} · ${valueField}`;result.append(caption);
  const head=document.createElement('thead'),body=document.createElement('tbody');result.append(head,body);
  displayRows.forEach((row,i)=>{const tr=document.createElement('tr');row.forEach((value,c)=>{const cell=document.createElement(i&&c?'td':'th');if(!i)cell.scope='col';else if(!c)cell.scope='row';cell.textContent=fmt(value);tr.append(cell);});(i?body:head).append(tr);});pivot.append(result);
  const chartRows=rows.slice(1,201),max=Math.max(1,...chartRows.map(row=>Math.abs(Number(row[1])||0)));
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
$('#refreshPivotBtn').onclick=()=>renderPivot(true);$('#pivotSection').ontoggle=()=>scheduleInspector();
function syncData(){syncSelection();scheduleInspector();if(!$('#searchBar').hidden)refreshSearch(false);}
grid.on('history',syncControls);
['change','format','fill','move','filter','sort','table','rowhide','rowshow','columnhide','columnshow','resize','variable'].forEach(event=>grid.on(event,syncData));
grid.on('select',syncSelection);grid.on('select',resizeFormula);grid.on('readonly',syncControls);

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
const fileBase=()=>grid.sheetName.replace(/[\\/:*?"<>|]/g,'-')||'tiny-datagrid';
function saveWorkbook(){if(grid.commitEdit()===false)return;download(`${fileBase()}.json`,JSON.stringify(grid.exportWorkbook(),null,2),'application/json;charset=utf-8');notify(t('downloaded'));}
$('#fileLoadBtn').onclick=()=>{if(!grid.readOnly)showDialog('#importDialog');};
$('#fileSaveBtn').onclick=()=>{try{saveWorkbook()}catch(error){fail(error)}};
$('#fileExportBtn').onclick=()=>showDialog('#exportDialog');
$('#loadDemoBtn').onclick=()=>{if(grid.readOnly||grid.commitEdit()===false)return;try{grid.feature('worksheets').importSheet(demoWorkbook($('#demoContents').value,language).sheets[0]);grid.scroll.scrollTop=0;grid.scroll.scrollLeft=0;grid.select(0,0);syncData();notify(t('demoLoaded'));}catch(error){fail(error)}};
$('#exportFormat').onchange=()=>{$('#exportRange').disabled=$('#exportFormat').value==='workbook';};
$('#exportRange').disabled=true;
$('#downloadBtn').onclick=async()=>{const button=$('#downloadBtn');try{
  if(grid.commitEdit()===false)return;
  const format=$('#exportFormat').value,base=fileBase(),range=$('#exportRange').value==='selection'?selection():grid.getUsedRange();
  if(format==='pdf'){printPDF(grid,range);$('#exportDialog').close();return}
  if(format==='png'){button.disabled=true;download(`${base}.png`,await exportPNG(grid,range),'image/png');}
  else{
    const formats={workbook:()=>['json',JSON.stringify(grid.exportWorkbook(),null,2),'application/json'],csv:()=>['csv',grid.exportCSV({range}),'text/csv'],tsv:()=>['tsv',grid.exportTSV({range}),'text/tab-separated-values'],json:()=>['json',JSON.stringify(grid.exportJSON({range}),(_,value)=>typeof value==='bigint'?String(value):value,2),'application/json'],html:()=>['html',grid.exportHTML({range}),'text/html'],markdown:()=>['md',grid.exportMarkdown({range}),'text/markdown']};
    const [ext,content,type]=formats[format]();download(`${base}.${ext}`,content,`${type};charset=utf-8`);
  }
  $('#exportDialog').close();notify(t('downloaded'));
}catch(error){fail(error);}finally{button.disabled=false}};
$('#shareBtn').onclick=()=>{try{grid.commitEdit();$('#shareURL').value=grid.createShareURL();$('#shareFeedback').textContent=$('#shareURL').value.length>12000?t('longLink'):'';showDialog('#shareDialog');}catch(error){fail(error);}};
$('#shareURL').onclick=()=>$('#shareURL').select();
$('#copyLinkBtn').onclick=async()=>{try{await navigator.clipboard.writeText($('#shareURL').value);$('#shareFeedback').textContent=t('copied');}catch{$('#shareURL').focus();$('#shareURL').select();$('#shareFeedback').textContent=t('manualCopy');}};
jsonTools=installJSONTools({grid,$,t:key=>t(key),notify,showDialog,selection});
attachFormulaAssist(grid.editor,grid,{language:()=>language});attachFormulaAssist($('#formula'),grid,{language:()=>language});
grid.use(cellContextMenu());grid.use(worksheetTabs({container:$('#sheetTabs')}));
grid.on('contextmenuerror',({error})=>fail(error));grid.on('worksheeterror',({error})=>fail(error));grid.on('worksheet',syncData);
applyLanguage();
if(shareError)notify(t('invalidLink'));
autosave.restoreDraft();
