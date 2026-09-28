/** Optional worksheet collection. Each sheet has its own data, selection and undo stack. */
export function worksheets(){return {name:'worksheets',setup(grid){
  const exportOne=grid.exportWorkbook,importOne=grid.importWorkbook;
  const sheets=new Map();let active='sheet1',sequence=1,switching=false;
  function saveActive(){
    if(switching)return;
    const workbook=exportOne.call(grid),sheet=workbook.sheets[0];sheet.id=active;
    sheets.set(active,{sheet,state:grid._snapshot(),selection:{...grid.selection},anchor:{...grid.anchor},history:[...grid._history],future:[...grid._future]});
  }
  function switchTo(id){
    if(grid._historyDepth)throw new Error('Cannot switch sheets during a transaction');
    if(grid.sqlBinding)throw new Error('Detach the SQL result before switching worksheets');
    if(grid._editing&&grid.commitEdit()===false)return false;
    if(id===active)return true;if(!sheets.has(id))throw new Error('Unknown worksheet');
    saveActive();const previous=active,next=sheets.get(id);switching=true;
    try{
      if(next.state){grid.anchor={...next.anchor};grid.selection={...next.selection};grid._restore(next.state)}
      else {const result=importOne.call(grid,{format:'tinyDatagrid-workbook',version:2,sheets:[next.sheet],activeSheetId:id});if(result===false)throw new Error('Worksheet import rejected');grid.anchor={row:0,col:0};grid.selection={r1:0,c1:0,r2:0,c2:0}}
      active=id;grid._history=[...(next.history||[])];grid._future=[...(next.future||[])];grid._historyBefore=null;grid.render();
    }catch(error){const old=sheets.get(previous);grid._restore(old.state);grid._history=old.history;grid._future=old.future;throw error}
    finally{switching=false}
    grid.emit('worksheet',{type:'select',id});grid.emit('history',grid.historyState);return true;
  }
  const api={
    get activeId(){return active},
    list(){saveActive();return [...sheets].map(([id,{sheet}])=>({id,name:sheet.name}))},
    add(name='Sheet'){
      if(grid._historyDepth||grid.sqlBinding)throw new Error('Cannot add worksheet during a transaction or SQL session');
      saveActive();let id;do{id=`sheet${++sequence}`}while(sheets.has(id));
      sheets.set(id,{sheet:{id,name:String(name),cells:[],variables:{},dimensions:{rows:grid.options.rows,columns:grid.options.columns}}});
      grid.emit('worksheet',{type:'add',id});return id;
    },
    select:switchTo,
    rename(id,name){if(!sheets.has(id)&&id!==active)throw new Error('Unknown worksheet');if(id===active)grid.setSheetName(name);else{const item=sheets.get(id);item.sheet.name=String(name);if(item.state)item.state.sheetName=String(name)}grid.emit('worksheet',{type:'rename',id})},
    remove(id){saveActive();if(sheets.size===1)throw new Error('At least one worksheet is required');if(!sheets.has(id))return false;if(id===active&&!switchTo([...sheets.keys()].find(key=>key!==id)))return false;sheets.delete(id);grid.emit('worksheet',{type:'remove',id});return true},
    destroy(){grid.exportWorkbook=exportOne;grid.importWorkbook=importOne;sheets.clear()}
  };
  saveActive();
  grid.exportWorkbook=function(options){
    if(switching)return exportOne.call(grid,options);
    saveActive();const current=exportOne.call(grid,options);current.sheets=[...sheets.values()].map(item=>structuredClone(item.sheet));current.activeSheetId=active;
    // Collection export always preserves every sheet in full.
    delete current.cells;delete current.variables;delete current.dimensions;return current;
  };
  grid.importWorkbook=function(input,options={}){
    if(switching||options.replace===false)return importOne.call(grid,input,options);
    if(grid._historyDepth)throw new Error('Import a worksheet collection outside a transaction');
    const workbook=typeof input==='string'?JSON.parse(input):input;
    if(!Array.isArray(workbook?.sheets)||!workbook.sheets.length)return importOne.call(grid,input,options);
    const ids=new Set();for(const sheet of workbook.sheets){if(typeof sheet.id!=='string'||ids.has(sheet.id)||!Array.isArray(sheet.cells))throw new TypeError('Invalid worksheet collection');ids.add(sheet.id)}
    const selected=ids.has(workbook.activeSheetId)?workbook.activeSheetId:workbook.sheets[0].id;
    const result=importOne.call(grid,{...workbook,activeSheetId:selected},options);if(result===false)return false;
    sheets.clear();for(const sheet of workbook.sheets)sheets.set(sheet.id,{sheet:structuredClone(sheet)});
    active=selected;grid.clearHistory();saveActive();grid.emit('worksheet',{type:'import',id:active});return result;
  };
  return api;
}}}
