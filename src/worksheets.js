import { FormulaError } from './formula-errors.js';
import { parseDataJSON } from './numeric-values.js';
import { TinyDatagrid, FormulaEngine, fromPortableValue } from './tinygrid.js';
/** Optional worksheet collection. Each sheet has its own data, selection and undo stack. */
export function worksheets(){return {name:'worksheets',setup(grid){
  const exportOne=grid.exportWorkbook,importOne=grid.importWorkbook;
  const sheets=new Map(),models=new Map(),meta=new Map();let active='sheet1',sequence=1,switching=false;
  const tabColor=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():null;
  const isHidden=id=>Boolean(meta.get(id)?.hidden);
  const visibleIds=()=>[...sheets.keys()].filter(id=>!isHidden(id));
  const withMeta=(id,sheet)=>{const item=meta.get(id);if(item?.color)sheet.tabColor=item.color;if(item?.hidden)sheet.hidden=true;return sheet};
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
    if(isHidden(id))meta.set(id,{...meta.get(id),hidden:false});
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
      get _tables(){const item=sheets.get(id),state=item.state;return state?.tables||item.sheet.tables||(state?.table?[state.table]:item.sheet.table?[item.sheet.table]:[])},
      feature:name=>name==='worksheets'?api:name==='dynamicArrays'?grid.feature('dynamicArrays'):name==='pivots'&&grid.feature('pivots')?(pivotController??=grid.feature('pivots').forGrid(view)):undefined,
      isTableRowVisible(row,col){
        const item=sheets.get(id),state=item.state,tables=state?.tables||item.sheet.tables||(state?.table?[state.table]:item.sheet.table?[item.sheet.table]:[]);
        const hidden=state?.hiddenRows||new Set(item.sheet.dimensions?.hiddenRows||[]);if(hidden.has(row))return false;
        const table=tables.find(t=>row>=t.r1&&row<=t.r2&&col>=t.c1&&col<=t.c2);if(!table||row<=table.headerRow)return true;
        const stored=table.filters||state?.columnFilters||item.sheet.filters||[];
        const filters=stored instanceof Map?stored:new Map(stored.map(f=>[f.column,new Set((f.values||[]).map(String))]));
        return [...filters].every(([c,values])=>values.has(String(view.getComputedValue(row,c)??'')));
      },
      isAnalysisRowVisible(row){return view.isTableRowVisible(row,0)},
      _calculationKey:key=>JSON.stringify([id,key]),
      key:TinyDatagrid.prototype.key,getCell:TinyDatagrid.prototype.getCell,
      getRawValue:TinyDatagrid.prototype.getRawValue,getComputedValue:TinyDatagrid.prototype.getComputedValue,getCalculationValue:TinyDatagrid.prototype.getCalculationValue,getVariable:TinyDatagrid.prototype.getVariable,_spillValue:TinyDatagrid.prototype._spillValue,getSpill:TinyDatagrid.prototype.getSpill
    };
    view.engine=new FormulaEngine(view);view.engine.cache=grid.engine.cache;view.engine.dependencies=grid.engine.dependencies;
    view.engine.functions=grid.engine.functions;view.engine._customFunctions=grid.engine._customFunctions;
    models.set(id,view);return view;
  }
  function validateName(name,id){
    name=String(name).trim();if(!name||name.length>80)throw new TypeError('Sheet name must contain 1–80 characters');
    if([...sheets].some(([key,item])=>key!==id&&(String(key===active?grid.sheetName:item.sheet.name).toLowerCase()===name.toLowerCase()||key.toLowerCase()===name.toLowerCase())))throw new TypeError('Sheet name already exists');
    return name;
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
    listObjects(){return [...sheets].flatMap(([id,item])=>{
      const source=item.state||item.sheet;
      const objects=id===active?grid.listObjects():[
        ...(source.tables||(source.table?[source.table]:[])).map(t=>({id:t.id||'table1',name:t.name||'Table 1',type:'table',range:{r1:t.r1,c1:t.c1,r2:t.r2,c2:t.c2}})),
        ...(source.pivotTables||[]).map(p=>({id:p.id,name:p.id,type:'pivot',range:{...p.output}})),
        ...(source.visualizations||[]).map(v=>({...structuredClone(v),type:'chart'})),
        ...(source.conditionalFormats||[]).flatMap((rule,index)=>rule.type==='colorScale'?[{id:`heatmap${index}`,type:'heatmap',name:`Heatmap ${index+1}`,range:{...rule.range},ruleIndex:index}]:[])
      ];return objects.map(object=>({...object,sheetId:id,sheetName:id===active?grid.sheetName:item.sheet.name}));
    })},
    get activeId(){return active},
    calculationKey:key=>JSON.stringify([active,key]),
    resolve,
    read(name,cell,visiting=new Set()){
      const id=resolve(name);grid.engine.dependencies.read('worksheets:names');
      if(!id)return new FormulaError('#REF!');return model(id).getCalculationValue(cell.row,cell.col,visiting);
    },
    isRowVisible(name,row,col){
      const id=resolve(name);grid.engine.dependencies.read('worksheets:names');
      if(!id)return false;
      const view=model(id);grid.engine.dependencies.read(view._calculationKey('visibility'));
      return view.isTableRowVisible(row,col);
    },
    list(){return [...sheets].map(([id,{sheet}])=>({id,name:id===active?grid.sheetName:sheet.name,color:meta.get(id)?.color??null,hidden:isHidden(id)}))},
    add(name){
      if(grid.readOnly)throw new Error('Workbook is read-only');
      if(name==null){let i=1;while(resolve(`Sheet ${i}`))i++;name=`Sheet ${i}`}name=validateName(name);
      if(grid._historyDepth||grid.sqlBinding)throw new Error('Cannot add worksheet during a transaction or SQL session');
      saveActive();let id;do{id=`sheet${++sequence}`}while(sheets.has(id));
      sheets.set(id,{sheet:{id,name:String(name),cells:[],variables:{},dimensions:{rows:grid.options.rows,columns:grid.options.columns}}});
      grid.engine.dependencies.invalidate('worksheets:names');grid.render();grid.emit('worksheet',{type:'add',id});return id;
    },
    select:switchTo,
    importSheet(sheet){if(grid.readOnly)throw new Error('Workbook is read-only');if(!sheet||!Array.isArray(sheet.cells))throw new TypeError('Invalid worksheet');const name=validateName(sheet.name||grid.sheetName,active);const result=importOne.call(grid,{format:'tinyDatagrid-workbook',version:2,activeSheetId:active,sheets:[{...sheet,id:active,name}]},{replace:true});if(result!==false){saveActive();grid.emit('worksheet',{type:'importSheet',id:active})}return result;},
    rename(id,name){if(grid.readOnly)throw new Error('Workbook is read-only');name=validateName(name,id);if(!sheets.has(id)&&id!==active)throw new Error('Unknown worksheet');if(id===active)grid.setSheetName(name);else{const item=sheets.get(id);item.sheet.name=String(name);if(item.state)item.state.sheetName=String(name)}grid.engine.clearCache();grid.render();grid.emit('worksheet',{type:'rename',id})},
    remove(id){if(grid.readOnly)throw new Error('Workbook is read-only');if(grid._editing&&grid.commitEdit()===false)return false;saveActive();if(sheets.size===1)throw new Error('At least one worksheet is required');if(!sheets.has(id))return false;if(id===active&&!switchTo([...sheets.keys()].find(key=>key!==id&&!isHidden(key))??[...sheets.keys()].find(key=>key!==id)))return false;sheets.delete(id);models.delete(id);meta.delete(id);if(!visibleIds().length)meta.set(active,{...meta.get(active),hidden:false});grid.engine.clearCache();grid.render();grid.emit('worksheet',{type:'remove',id});return true},
    /** Copy a sheet next to its source. History starts empty; formulas keep pointing at the same sheets by name. */
    duplicate(id,name){
      if(grid.readOnly)throw new Error('Workbook is read-only');
      if(grid._historyDepth||grid.sqlBinding)throw new Error('Cannot duplicate a worksheet during a transaction or SQL session');
      if(grid._editing&&grid.commitEdit()===false)return null;
      if(!sheets.has(id))throw new Error('Unknown worksheet');
      saveActive();
      const source=sheets.get(id).sheet,copy=structuredClone(source);
      if(name==null){let n=2;while(resolve(`${source.name} (${n})`))n++;name=`${source.name} (${n})`}
      copy.name=validateName(name);let newId;do{newId=`sheet${++sequence}`}while(sheets.has(newId));copy.id=newId;
      const entries=[...sheets],at=entries.findIndex(([key])=>key===id);entries.splice(at+1,0,[newId,{sheet:copy}]);sheets.clear();for(const [key,item] of entries)sheets.set(key,item);
      if(meta.get(id)?.color)meta.set(newId,{color:meta.get(id).color});
      grid.engine.dependencies.invalidate('worksheets:names');grid.emit('worksheet',{type:'duplicate',id:newId,source:id});return newId;
    },
    /** Reorder tabs. The index is the zero-based position among all sheets, hidden ones included. */
    move(id,index){
      if(grid.readOnly)throw new Error('Workbook is read-only');
      if(!sheets.has(id))throw new Error('Unknown worksheet');
      const entries=[...sheets],from=entries.findIndex(([key])=>key===id),to=Math.max(0,Math.min(entries.length-1,Math.trunc(Number(index))));
      if(!Number.isFinite(to)||from===to)return false;
      const [item]=entries.splice(from,1);entries.splice(to,0,item);sheets.clear();for(const [key,value] of entries)sheets.set(key,value);
      grid.emit('worksheet',{type:'move',id,index:to});return true;
    },
    /** Tab color as #rrggbb, or null to clear it. */
    setColor(id,color){
      if(grid.readOnly)throw new Error('Workbook is read-only');
      if(!sheets.has(id))throw new Error('Unknown worksheet');
      const value=color==null||color===''?null:tabColor(color);
      if(color!=null&&color!==''&&!value)throw new TypeError('Tab color must be #rrggbb');
      meta.set(id,{...meta.get(id),color:value});grid.emit('worksheet',{type:'color',id});return true;
    },
    /** Hide or show a tab. At least one sheet stays visible; hiding the active sheet selects a neighbour. */
    setHidden(id,hidden=true){
      if(grid.readOnly)throw new Error('Workbook is read-only');
      if(!sheets.has(id))throw new Error('Unknown worksheet');
      hidden=Boolean(hidden);if(hidden===isHidden(id))return true;
      if(hidden){
        const visible=visibleIds();if(visible.length<2)throw new Error('At least one visible worksheet is required');
        if(id===active){const at=visible.indexOf(id),target=visible[at+1]??visible[at-1];if(!switchTo(target))return false}
      }
      meta.set(id,{...meta.get(id),hidden});grid.emit('worksheet',{type:hidden?'hide':'show',id});return true;
    },
    destroy(){grid.exportWorkbook=exportOne;grid.importWorkbook=importOne;sheets.clear();models.clear();meta.clear();grid.engine.clearCache()}
  };
  saveActive();
  grid.exportWorkbook=function(options){
    if(switching)return exportOne.call(grid,options);
    saveActive();const current=exportOne.call(grid,options);current.sheets=[...sheets].map(([id,item])=>withMeta(id,structuredClone(item.sheet)));current.activeSheetId=active;
    // Collection export always preserves every sheet in full.
    delete current.cells;delete current.variables;delete current.dimensions;return current;
  };
  grid.importWorkbook=function(input,options={}){
    if(switching||options.replace===false)return importOne.call(grid,input,options);
    if(grid._historyDepth)throw new Error('Import a worksheet collection outside a transaction');
    const workbook=typeof input==='string'?parseDataJSON(input):input;
    if(workbook?.formulaModel&&workbook.formulaModel!=='structured-v1')throw new TypeError('Unsupported formula model');
    if(!Array.isArray(workbook?.sheets)||!workbook.sheets.length)return importOne.call(grid,input,options);
    const ids=new Set();for(const sheet of workbook.sheets){if(typeof sheet.id!=='string'||ids.has(sheet.id)||!Array.isArray(sheet.cells))throw new TypeError('Invalid worksheet collection');ids.add(sheet.id)}
    const selected=ids.has(workbook.activeSheetId)?workbook.activeSheetId:workbook.sheets[0].id;
    const previous=new Map(sheets),previousMeta=new Map([...meta].map(([key,value])=>[key,{...value}])),previousId=active,previousState=grid._snapshot(),previousHistory=[...grid._history],previousFuture=[...grid._future];
    sheets.clear();models.clear();meta.clear();for(const sheet of workbook.sheets){sheets.set(sheet.id,{sheet:structuredClone(sheet)});const color=tabColor(sheet.tabColor);if(color||sheet.hidden===true)meta.set(sheet.id,{color,hidden:sheet.hidden===true&&sheet.id!==selected})}active=selected;
    if(!visibleIds().length)meta.set(selected,{...meta.get(selected),hidden:false});
    try{const result=importOne.call(grid,{...workbook,activeSheetId:selected},options);if(result===false)throw new Error('Worksheet import rejected');
      grid.clearHistory();saveActive();grid.emit('worksheet',{type:'import',id:active});return result;
    }catch(error){sheets.clear();for(const [id,item] of previous)sheets.set(id,item);meta.clear();for(const [id,value] of previousMeta)meta.set(id,value);active=previousId;models.clear();grid._historyBefore=null;grid._history=previousHistory;grid._future=previousFuture;grid._restore(previousState);throw error}

  };
  return api;
}}}
