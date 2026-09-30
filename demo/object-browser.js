import { toA1 } from '../src/tinygrid.js';
export function installObjectBrowser({grid,$,t,openChart,notify}) {
  const host=$('#sheetObjectList');
  function render(){
    host.replaceChildren();const objects=grid.feature('worksheets')?.listObjects()||grid.listObjects();
    if(!objects.length){const empty=document.createElement('p');empty.className='hint';empty.textContent=t('noObjects');host.append(empty);return;}
    for(const type of ['table','pivot','chart','heatmap']){
      const items=objects.filter(o=>o.type===type);if(!items.length)continue;
      const group=document.createElement('section'),heading=document.createElement('h4');heading.textContent=`${t({table:'objectTables',pivot:'objectPivots',chart:'objectCharts',heatmap:'heatmap'}[type])} · ${items.length}`;group.append(heading);
      for(const item of items){
        const row=document.createElement('div');row.className='sheet-object';
        const open=document.createElement('button');open.className='sheet-object-open';
        const name=document.createElement('strong'),range=document.createElement('span');name.textContent=item.name;range.textContent=`${item.sheetName?item.sheetName+' · ':''}${toA1(item.range.r1,item.range.c1)}:${toA1(item.range.r2,item.range.c2)}`;open.append(name,range);
        open.onclick=()=>{try{if(grid.commitEdit()===false)return;$('#inspector').close();if(item.sheetId&&grid.feature('worksheets').select(item.sheetId)===false)return;if(type==='table')grid.activateTable(item.id);grid.select(item.range.r1,item.range.c1);grid.select(item.range.r2,item.range.c2,true);if(type==='chart')openChart({range:item.range,chartType:item.chartType});else grid.el.focus()}catch(error){notify(error.message)}};
        const remove=document.createElement('button');remove.className='subtle';remove.textContent='×';remove.title=t('removeObject');remove.setAttribute('aria-label',`${t('removeObject')}: ${item.name}`);remove.disabled=grid.readOnly;
        remove.onclick=()=>{try{if(item.sheetId&&grid.feature('worksheets').select(item.sheetId)===false)return;if(type==='table')grid.removeTable(item.id);else if(type==='pivot')grid.feature('pivots').remove(item.id);else if(type==='heatmap')grid.setConditionalFormats(grid.conditionalFormats.filter((_,index)=>index!==item.ruleIndex));else grid.removeVisualization(item.id);render();$('#inspector-objects-tab').focus()}catch(error){notify(error.message)}};
        row.append(open,remove);group.append(row);
      }
      host.append(group);
    }
  }
  const offs=['conditionalformats','objects','table','change','worksheet','locale','readonly','history'].map(event=>grid.on(event,render));render();
  return {render,dispose(){offs.forEach(off=>off());host.replaceChildren()}};
}
