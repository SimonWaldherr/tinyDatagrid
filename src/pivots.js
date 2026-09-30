import { PivotEngine } from './tinygrid.js';
import { includesAnalysisRow, pivotAnalysis } from './analysis.js';
const contains=(range,row,col)=>row>=range.r1&&row<=range.r2&&col>=range.c1&&col<=range.c2;
const overlaps=(a,b)=>a.r1<=b.r2&&a.r2>=b.r1&&a.c1<=b.c2&&a.c2>=b.c1;
const rectangle=r=>r&&['r1','c1','r2','c2'].every(k=>Number.isInteger(r[k])&&r[k]>=0)&&r.r2>=r.r1&&r.c2>=r.c1;
const rectOf=table=>({r1:table.headerRow,c1:table.c1,r2:table.r2,c2:table.c2});
const sameRect=(a,b)=>a.r1===b.r1&&a.c1===b.c1&&a.r2===b.r2&&a.c2===b.c2;
const AGGREGATES=['sum','count','counta','avg','average','min','max','first','last'];
const error=value=>typeof value==='string'&&/^#(?:REF|VALUE|CYCLE|ERROR|NAME|DIV|NUM|N\/A|SPILL)/.test(value);
function controller(grid){
  let refreshing=false,writing=false;
  const token=id=>grid._calculationKey(`pivot:${id}`);
  const tableById=id=>(grid._tables||[]).find(table=>(table.id||'table1')===id);
  /** Validate the settings shared by insert() and update(); returns private copies. */
  function checked(config,analysis){
    if(!Array.isArray(config?.values)||!config.values.length)throw new TypeError('Pivot requires value fields');
    if(!['all','visible','selection'].includes(analysis?.scope)||analysis.scope==='selection'&&!rectangle(analysis.selection))throw new TypeError('Invalid analysis scope');
    const copy=structuredClone(config);for(const value of copy.values)if(typeof value!=='string'&&!AGGREGATES.includes(value.aggregate||'sum'))throw new TypeError('Unsupported aggregate');
    return {config:copy,analysis:structuredClone(analysis)};
  }
  function write(key,value){grid.engine.dependencies.invalidate(grid._calculationKey(key));writing=true;try{if(value)Map.prototype.set.call(grid.cells,key,value);else Map.prototype.delete.call(grid.cells,key)}finally{writing=false}}
  function refresh(){
    if(refreshing)return;refreshing=true;
    try{for(const pivot of grid.pivotTables){
      if(!rectangle(pivot.source)||!Number.isInteger(pivot.target?.row)||!Number.isInteger(pivot.target?.col)||pivot.target.row<0||pivot.target.col<0||!Array.isArray(pivot.config?.values)||typeof pivot.id!=='string')throw new TypeError('Invalid pivot definition');
      const key=token(pivot.id);
      // A pivot bound to a table follows its range, so appended rows and moved tables are picked up.
      const bound=pivot.table&&tableById(pivot.table);
      if(bound&&!sameRect(rectOf(bound),pivot.source)){pivot.source=rectOf(bound);grid.engine.dependencies.invalidate(key,new Set(grid.engine.dependencies.stack))}
      if(grid.engine.cache.has(key))continue;
      let table,failure=null;grid.engine.dependencies.begin(key);
      try{
        const s=pivot.source,headers=[];for(let c=s.c1;c<=s.c2;c++)headers.push(String(grid.getComputedValue(s.r1,c)));
        if(new Set(headers).size!==headers.length)throw new Error('#VALUE!');
        const fields=[...(pivot.config.rows||[]),...(pivot.config.columns||[]),...pivot.config.values.map(v=>typeof v==='string'?v:v.field),...Object.keys(pivot.config.filters||{})];
        if(fields.some(f=>!headers.includes(f)))throw new Error('#REF!');
        const records=[];for(let r=s.r1+1;r<=s.r2;r++){
          if(pivot.analysis?.scope==='visible'&&grid.isTableRowVisible?!grid.isTableRowVisible(r,s.c1):!includesAnalysisRow(grid,r,pivot.analysis||{scope:'all'}))continue;
          const values=headers.map((_,i)=>grid.getComputedValue(r,s.c1+i));const invalid=values.find(error);if(invalid)throw new Error(invalid);
          if(values.some(v=>v!==''&&v!=null))records.push(Object.fromEntries(headers.map((h,i)=>[h,values[i]])));
        }
        table=PivotEngine.pivot(records,pivot.config).toTable();
        if(!table[0].length)table=[['Pivot']];
      }catch(e){failure=error(e.message)?e.message:'#ERROR!';table=[[failure]]}
      finally{grid.engine.dependencies.end()}
      const range={r1:pivot.target.row,c1:pivot.target.col,r2:pivot.target.row+table.length-1,c2:pivot.target.col+Math.max(...table.map(r=>r.length))-1};
      if(overlaps(range,pivot.source)||grid.pivotTables.some(p=>p.id!==pivot.id&&(overlaps(range,p.source)||p.output&&overlaps(range,p.output))))failure='#SPILL!';
      for(let r=range.r1;r<=range.r2;r++)for(let c=range.c1;c<=range.c2;c++){const cell=grid.cells.get(grid.key(r,c));if(cell&&cell.pivotOwner!==pivot.id&&(cell.raw!==''&&cell.raw!=null||cell.pivotOwner)){failure='#SPILL!';grid.engine.dependencies.stack.push(key);try{grid.engine.dependencies.read(grid._calculationKey(grid.key(r,c)))}finally{grid.engine.dependencies.stack.pop()}}}
      const pending=[key],seen=new Set();
      while(pending.length){const dependency=pending.pop();if(seen.has(dependency))continue;seen.add(dependency);for(const child of grid.engine.dependencies.reads.get(dependency)||[])pending.push(child)}
      for(let r=range.r1;r<=range.r2;r++)for(let c=range.c1;c<=range.c2;c++)if(seen.has(grid._calculationKey(grid.key(r,c)))&&!failure)failure='#CYCLE!';
      if(failure){table=[[failure]];range.r2=range.r1;range.c2=range.c1}
      const dependencies=[...(grid.engine.dependencies.reads.get(key)||[])];
      // Remove only cells that have left this pivot's output rectangle.
      for(const [cellKey,cell] of grid.cells)if(cell.pivotOwner===pivot.id){const [r,c]=cellKey.split(',').map(Number);if(!contains(range,r,c))write(cellKey,null);}
      for(let r=0;r<table.length;r++)for(let c=0;c<table[r].length;c++){
        const cellKey=grid.key(range.r1+r,range.c1+c),existing=grid.cells.get(cellKey);
        if(existing?.pivotOwner!==pivot.id&&(existing?.raw!==''&&existing?.raw!=null||existing?.pivotOwner))continue;
        if(existing?.pivotOwner===pivot.id&&Object.is(existing.raw,table[r][c]))continue;
        write(cellKey,{...existing,raw:table[r][c],pivotOwner:pivot.id,...(r===0?{style:{...existing?.style,fontWeight:'bold'}}:{})});
      }
      pivot.output=range;pivot.error=failure;grid.ensureSize?.(range.r2+1,range.c2+1);
      grid.engine.dependencies.forget(key);grid.engine.dependencies.stack.push(key);try{for(const dependency of dependencies)grid.engine.dependencies.read(dependency)}finally{grid.engine.dependencies.stack.pop()}
      grid.engine.cache.set(key,true);
    }}finally{refreshing=false}
  }
  return {
    refresh,
    invalidateVisibility(){for(const pivot of grid.pivotTables)if(pivot.analysis?.scope==='visible')grid.engine.dependencies.invalidate(token(pivot.id))},
    drill(id,row,col){const pivot=grid.pivotTables.find(p=>p.id===id);if(!pivot)throw new Error('Unknown pivot');refresh();if(pivot.error)return {headers:[],entries:[]};const view=pivotAnalysis(grid,pivot.source,pivot.config,pivot.analysis||{scope:'all'});return {headers:view.headers,entries:view.drill(row-pivot.target.row,col-pivot.target.col)}},
    beforeRead(row,col){if(refreshing&&grid.pivotTables.some(p=>p.output&&contains(p.output,row,col)))return '#CYCLE!';refresh();const owner=grid.cells.get(grid.key(row,col))?.pivotOwner;if(owner)grid.engine.dependencies.read(token(owner));return null},
    beforeWrite(key){if(writing||grid._pivotRestore)return;const cell=grid.cells.get(key);if(cell?.pivotOwner){const e=new Error('Pivot result cells cannot be edited; remove the pivot first.');e.validation={...Object.fromEntries(['row','col'].map((name,i)=>[name,Number(key.split(',')[i])])),message:e.message};throw e}},
    insert({source,table,target,config,analysis={scope:"all"}}){
      if(grid.readOnly)throw new Error('Grid is read-only');
      const bound=table==null?null:tableById(table);if(table!=null&&!bound)throw new Error('Unknown table');
      if(bound)source=rectOf(bound);
      if(!rectangle(source)||!Number.isInteger(target?.row)||!Number.isInteger(target?.col)||target.row<0||target.col<0)throw new TypeError('Invalid pivot source or target');
      const copy=checked(config,analysis);
      if(contains(source,target.row,target.col)||grid.pivotTables.some(p=>p.output&&overlaps(source,p.output)))throw new Error('Pivot source must not include pivot results');
      const at=grid.getCell(target.row,target.col);if(at.raw!==''&&at.raw!=null||at.pivotOwner)throw new Error('Pivot target is occupied');
      let id;let index=1;do{id=`pivot${index++}`}while(grid.pivotTables.some(p=>p.id===id));
      grid.transaction(()=>{grid.pivotTables.push({id,source:{...source},...(bound?{table:bound.id||'table1'}:{}),target:{...target},config:copy.config,analysis:copy.analysis,output:{r1:target.row,c1:target.col,r2:target.row,c2:target.col}});refresh();grid.render();grid.emit('change',{type:'pivotinsert',id})});return id;
    },
    /**
     * Change the settings of an existing pivot: config, analysis, target, and the source (a table id, or a range
     * that detaches the pivot from its table). Omitted settings stay as they are. One undo step.
     */
    update(id,changes={}){
      if(grid.readOnly)throw new Error('Grid is read-only');
      const pivot=grid.pivotTables.find(p=>p.id===id);if(!pivot)throw new Error('Unknown pivot');
      let source={...pivot.source},table=pivot.table;
      if(changes.table!==undefined){
        if(changes.table===null)table=undefined;
        else{const bound=tableById(changes.table);if(!bound)throw new Error('Unknown table');table=bound.id||'table1';source=rectOf(bound)}
      }else if(changes.source){source={...changes.source};table=undefined}
      const target=changes.target?{...changes.target}:{...pivot.target};
      if(!rectangle(source)||!Number.isInteger(target.row)||!Number.isInteger(target.col)||target.row<0||target.col<0)throw new TypeError('Invalid pivot source or target');
      const next=checked(changes.config??pivot.config,changes.analysis??pivot.analysis??{scope:'all'});
      if(contains(source,target.row,target.col)||grid.pivotTables.some(p=>p.output&&overlaps(source,p.output)))throw new Error('Pivot source must not include pivot results');
      const at=grid.getCell(target.row,target.col);if((at.raw!==''&&at.raw!=null||at.pivotOwner)&&at.pivotOwner!==id)throw new Error('Pivot target is occupied');
      return grid.transaction(()=>{
        Object.assign(pivot,{source,target,config:next.config,analysis:next.analysis});
        if(table)pivot.table=table;else delete pivot.table;
        grid.engine.dependencies.invalidate(token(id));refresh();grid.render();grid.emit('change',{type:'pivotupdate',id});
        return true;
      });
    },
    /** Recalculate one pivot (or all when no id is given) now, even if nothing it reads has changed. */
    recalculate(id){
      if(id!=null&&!grid.pivotTables.some(p=>p.id===id))return false;
      for(const pivot of grid.pivotTables)if(id==null||pivot.id===id)grid.engine.dependencies.invalidate(token(pivot.id),new Set(grid.engine.dependencies.stack));
      refresh();grid.render?.();return true;
    },
    /** The pivot whose result covers a cell, or null. */
    at(row,col){refresh();const pivot=grid.pivotTables.find(p=>p.output&&contains(p.output,row,col));return pivot?structuredClone(pivot):null},
    get(id){refresh();const pivot=grid.pivotTables.find(p=>p.id===id);return pivot?structuredClone(pivot):null},
    remove(id){if(grid.readOnly)return false;if(!grid.pivotTables.some(p=>p.id===id))return false;return grid.transaction(()=>{grid.pivotTables=grid.pivotTables.filter(p=>p.id!==id);for(const [key,cell] of grid.cells)if(cell.pivotOwner===id)write(key,null);grid.engine.dependencies.invalidate(token(id));grid.render();grid.emit('change',{type:'pivotremove',id});return true})},
    list(){refresh();return structuredClone(grid.pivotTables)},
    forGrid:controller
  };
}
export function sheetPivots(){return {name:'pivots',setup:controller}}
