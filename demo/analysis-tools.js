import { heatmapRule } from '../src/heatmap.js';

export function installAnalysisTools({grid,$,t,notify,selection,refresh}) {
  const context=grid.feature('analysis');
  const chartHint=document.createElement('p');chartHint.className='hint';chartHint.dataset.i18n='chartLinkHint';$('#chartRange').closest('.dialog-heading').after(chartHint);
  const controls=document.createElement('div');controls.className='analysis-controls';
  const label=document.createElement('label'),scope=document.createElement('select');scope.id='analysisScope';
  label.append(scope);controls.append(label);const clear=document.createElement('button');clear.dataset.i18n='clearFilters';clear.id='inspectorClearFilters';clear.onclick=()=>{grid.clearFilters();refresh()};controls.append(clear);const capture=document.createElement('button');capture.dataset.i18n='sidebarUseSelection';capture.dataset.title='captureSelection';capture.onclick=()=>context.set({scope:'selection',selection:selection()});controls.append(capture);
  for(const [value,key] of [['visible','scopeVisible'],['all','scopeAll'],['selection','scopeSelection']]){const option=new Option('',value);option.dataset.i18n=key;scope.append(option)}
  const help=document.createElement('p');help.dataset.i18n='analysisHint';help.className='hint';$('#analysisHelpHost').append(help);
  $('#analysisScopeHost').append(controls);
  scope.onchange=()=>{context.set({scope:scope.value,selection:selection()});refresh()};
  grid.on('analysis',()=>{scope.value=context.state.scope;refresh()});
  grid.on('worksheet',()=>context.set({scope:'visible'}));
  const heat=document.createElement('button');heat.id='heatmapBtn';heat.dataset.i18n='heatmap';
  $('.tools-grid').append(heat);
  heat.onclick=()=>{if(grid.readOnly)return;try{const range=selection();if((range.r2-range.r1+1)*(range.c2-range.c1+1)>100000)throw new Error(t('analysisTooLarge'));let min=Infinity,max=-Infinity;for(let r=range.r1;r<=range.r2;r++)for(let c=range.c1;c<=range.c2;c++){const v=grid.getComputedValue(r,c);if(typeof v==='number'&&Number.isFinite(v)){min=Math.min(min,v);max=Math.max(max,v)}}if(!Number.isFinite(min))return notify(t('noData'));grid.setConditionalFormats([...grid.conditionalFormats.filter(rule=>rule.type!=='colorScale'||!['r1','r2','c1','c2'].every(k=>rule.range[k]===range[k])),heatmapRule(range,{min,max})]);notify(`${t('heatmap')}: ${min} → ${max}`);}catch(e){notify(e.message)}};
  grid.on('readonly',()=>{heat.disabled=grid.readOnly});
  const dialog=document.createElement('dialog');dialog.className='analysis-details';dialog.setAttribute('aria-labelledby','sourceRowsTitle');
  const title=document.createElement('h2');title.id='sourceRowsTitle';title.dataset.i18n='sourceRows';
  const close=document.createElement('button');close.dataset.i18n='close';close.onclick=()=>dialog.close();
  const info=document.createElement('p'),body=document.createElement('div');body.className='source-table';
  const previous=document.createElement('button'),next=document.createElement('button');previous.textContent='←';next.textContent='→';previous.dataset.label='previousPage';next.dataset.label='nextPage';
  dialog.append(title,close,info,body,previous,next);document.body.append(dialog);
  let entries=[],headers=[],page=0,source=null,sheetId=null,returnFocus;
  function render(){
    body.replaceChildren();info.textContent=`${entries.length} ${t('rows')} · ${page+1} / ${Math.max(1,Math.ceil(entries.length/100))}`;
    const table=document.createElement('table'),head=document.createElement('tr');
    [t('row'),...headers].forEach(h=>{const th=document.createElement('th');th.scope='col';th.textContent=h;head.append(th)});table.append(head);
    entries.slice(page*100,page*100+100).forEach(({row,record})=>{const tr=document.createElement('tr'),td=document.createElement('td'),button=document.createElement('button');button.textContent=String(row+1);button.onclick=()=>{returnFocus=grid.el;dialog.close();$('#inspector').close();if(sheetId&&grid.feature('worksheets').activeId!==sheetId)grid.feature('worksheets').select(sheetId);grid.select(row,source.c1);grid.el.focus()};td.append(button);tr.append(td);headers.forEach(h=>{const cell=document.createElement('td');cell.textContent=String(record[h]??'');tr.append(cell)});table.append(tr)});body.append(table);previous.disabled=page===0;next.disabled=(page+1)*100>=entries.length;
  }
  previous.onclick=()=>{page--;render()};next.onclick=()=>{page++;render()};dialog.onclose=()=>{if(returnFocus?.isConnected)returnFocus.focus()};
  function show(data,range){entries=data.entries;headers=data.headers;source=range;sheetId=grid.feature('worksheets')?.activeId;page=0;returnFocus=document.activeElement;render();dialog.showModal();close.focus()}
  const drill=document.createElement('button');drill.id='drillPivotBtn';drill.dataset.i18n='sourceRows';$('#pivotSecondaryActions').append(drill);
  drill.onclick=()=>{try{const {row,col}=grid.anchor,pivot=grid.feature('pivots').list().find(p=>row>=p.output.r1&&row<=p.output.r2&&col>=p.output.c1&&col<=p.output.c2);if(pivot)show(grid.feature('pivots').drill(pivot.id,row,col),pivot.source);else notify(t('selectPivotValue'))}catch(e){notify(e.message)}};
  return {show,refreshLabels(){scope.setAttribute('aria-label',t('analysisScope'));heat.disabled=grid.readOnly}};
}
