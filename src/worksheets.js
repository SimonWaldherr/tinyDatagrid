import { TinyDatagrid, FormulaEngine, fromPortableValue } from './tinygrid.js';
/** Optional worksheet collection. Each sheet has its own data, selection and undo stack. */
export function worksheets(){return {name:'worksheets',setup(grid){
  const exportOne=grid.exportWorkbook,importOne=grid.importWorkbook;
  const sheets=new Map(),models=new Map();let active='sheet1',sequence=1,switching=false;
  function saveActive(){
    if(switching)return;
    const workbook=exportOne.call(grid,{computedValues:false}),sheet=workbook.sheets[0];sheet.id=active;
    models.delete(active);sheets.set(active,{sheet,state:grid._snapshot(),selection:{...grid.selection},anchor:{...grid.anchor},history:[...grid._history],future:[...grid._future]});
  }
  function switchTo(id){
    if(grid._historyDepth)throw new Error('Cannot switch sheets during a transaction');
    if(grid.sqlBinding)throw new Error('Detach the SQL result before switching worksheets');
    if(grid._editing&&grid.commitEdit()===false)return false;
    if(id===active)return true;if(!sheets.has(id))throw new Error('Unknown worksheet');
    saveActive();const previous=active,next=sheets.get(id);switching=true;active=id;
    try{
      if(next.state){grid.anchor={...next.anchor};grid.selection={...next.selection};grid._restore(next.state)}
      else {const result=importOne.call(grid,{format:'tinyDatagrid-workbook',version:2,sheets:[next.sheet],activeSheetId:id});if(result===false)throw new Error('Worksheet import rejected');grid.anchor={row:0,col:0};grid.selection={r1:0,c1:0,r2:0,c2:0}}
      active=id;grid._history=[...(next.history||[])];grid._future=[...(next.future||[])];grid._historyBefore=null;grid.render();
    }catch(error){active=previous;const old=sheets.get(previous);grid._restore(old.state);grid._history=old.history;grid._future=old.future;throw error}
    finally{switching=false}
    grid.emit('worksheet',{type:'select',id});grid.emit('history',grid.historyState);return true;
  }
  function resolve(name){
    if(sheets.has(name))return name;
    const matches=[...sheets].filter(([id,item])=>String(id===active?grid.sheetName:item.sheet.name||'Sheet1').toLowerCase()===String(name).toLowerCase());
    return matches.length===1?matches[0][0]:null;
  }
  function model(id){
    if(id===active)return grid;if(models.has(id))return models.get(id);
    const item=sheets.get(id);
    if(!item.state){
      item.readCells=new Map(item.sheet.cells.filter(cell=>cell&&Number.isInteger(cell.row)&&Number.isInteger(cell.col)&&cell.row>=0&&cell.col>=0).map(cell=>[`${cell.row},${cell.col}`,{...cell,...(Object.hasOwn(cell,'originalInput')?{originalInput:fromPortableValue(cell.originalInput)}:{}),raw:typeof cell.formula==='string'?cell.formula:fromPortableValue(Object.hasOwn(cell,'value')?cell.value:'')} ]));
      item.readVariables=new Map(Object.entries(fromPortableValue(item.sheet.variables||{})));
    }
    let pivotController;const view={get pivotTables(){return sheets.get(id).state?.pivotTables||sheets.get(id).sheet.pivotTables||[]},options:grid.options,externalVariables:grid.externalVariables,
      get variables(){return sheets.get(id).state?.variables||sheets.get(id).readVariables},
      get cells(){return sheets.get(id).state?.cells||sheets.get(id).readCells},
      get sqlBinding(){return sheets.get(id).state?.sqlBinding||null},
      feature:name=>name==='worksheets'?api:name==='dynamicArrays'?grid.feature('dynamicArrays'):name==='pivots'&&grid.feature('pivots')?(pivotController??=grid.feature('pivots').forGrid(view)):undefined,
      _calculationKey:key=>JSON.stringify([id,key]),
      key:TinyDatagrid.prototype.key,getCell:TinyDatagrid.prototype.getCell,
      getRawValue:TinyDatagrid.prototype.getRawValue,getComputedValue:TinyDatagrid.prototype.getComputedValue,getVariable:TinyDatagrid.prototype.getVariable,_spillValue:TinyDatagrid.prototype._spillValue,getSpill:TinyDatagrid.prototype.getSpill
    };
    view.engine=new FormulaEngine(view);view.engine.cache=grid.engine.cache;view.engine.dependencies=grid.engine.dependencies;
    view.engine.functions=grid.engine.functions;view.engine._customFunctions=grid.engine._customFunctions;
    models.set(id,view);return view;
  }
  const api={
    referenceDocuments(){return [...sheets].map(([id,item])=>({id,name:id===active?grid.sheetName:item.sheet.name,cells:model(id).cells,variables:model(id).variables}))},
    applyReferenceChanges(changes,forward){
      for(const change of changes){if(!sheets.has(change.sheetId))return false;const view=model(change.sheetId),value=change.kind==='cell'?view.cells.get(change.key)?.raw:view.variables.get(change.key);if(!Object.is(value,forward?change.before:change.after)){grid.emit('historyconflict',{sheetId:change.sheetId,key:change.key});return false}}
      for(const change of changes){const item=sheets.get(change.sheetId),view=model(change.sheetId),value=forward?change.after:change.before;
        if(change.kind==='cell'){view.cells.set(change.key,{...view.cells.get(change.key),raw:value});const [row,col]=change.key.split(',').map(Number),cell=item.sheet.cells.find(c=>c.row===row&&c.col===col);if(cell){cell.formula=value;delete cell.value}}
        else {view.variables.set(change.key,value);item.sheet.variables={...item.sheet.variables,[change.key]:value}}
      }
      grid.engine.clearCache();return true;
    },
    get activeId(){return active},
    calculationKey:key=>JSON.stringify([active,key]),
    resolve,
    read(name,cell,visiting=new Set()){
      const id=resolve(name);grid.engine.dependencies.read('worksheets:names');
      if(!id)return '#REF!';return model(id).getComputedValue(cell.row,cell.col,visiting);
    },
    list(){saveActive();return [...sheets].map(([id,{sheet}])=>({id,name:sheet.name}))},
    add(name='Sheet'){
      if(grid._historyDepth||grid.sqlBinding)throw new Error('Cannot add worksheet during a transaction or SQL session');
      saveActive();let id;do{id=`sheet${++sequence}`}while(sheets.has(id));
      sheets.set(id,{sheet:{id,name:String(name),cells:[],variables:{},dimensions:{rows:grid.options.rows,columns:grid.options.columns}}});
      grid.engine.dependencies.invalidate('worksheets:names');grid.render();grid.emit('worksheet',{type:'add',id});return id;
    },
    select:switchTo,
    rename(id,name){if(!sheets.has(id)&&id!==active)throw new Error('Unknown worksheet');if(id===active)grid.setSheetName(name);else{const item=sheets.get(id);item.sheet.name=String(name);if(item.state)item.state.sheetName=String(name)}grid.engine.clearCache();grid.render();grid.emit('worksheet',{type:'rename',id})},
    remove(id){saveActive();if(sheets.size===1)throw new Error('At least one worksheet is required');if(!sheets.has(id))return false;if(id===active&&!switchTo([...sheets.keys()].find(key=>key!==id)))return false;sheets.delete(id);models.delete(id);grid.engine.clearCache();grid.render();grid.emit('worksheet',{type:'remove',id});return true},
    destroy(){grid.exportWorkbook=exportOne;grid.importWorkbook=importOne;sheets.clear();models.clear();grid.engine.clearCache()}
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
    const previous=new Map(sheets),previousId=active,previousState=grid._snapshot(),previousHistory=[...grid._history],previousFuture=[...grid._future];
    sheets.clear();models.clear();for(const sheet of workbook.sheets)sheets.set(sheet.id,{sheet:structuredClone(sheet)});active=selected;
    try{const result=importOne.call(grid,{...workbook,activeSheetId:selected},options);if(result===false)throw new Error('Worksheet import rejected');
      grid.clearHistory();saveActive();grid.emit('worksheet',{type:'import',id:active});return result;
    }catch(error){sheets.clear();for(const [id,item] of previous)sheets.set(id,item);active=previousId;models.clear();grid._historyBefore=null;grid._history=previousHistory;grid._future=previousFuture;grid._restore(previousState);throw error}

  };
  return api;
}}}
