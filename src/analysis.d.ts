import type {TinyDatagrid,CellRange,GridPlugin} from './tinygrid.js';
import type {SheetPivotOptions} from './pivots.js';
export type AnalysisOptions={scope?:'all'|'visible'|'selection';selection?:CellRange};
export type SourceEntry={row:number;record:Record<string,unknown>};
export interface AnalysisContext {readonly state:AnalysisOptions;set(options:AnalysisOptions):this;records(source:CellRange):{headers:string[];entries:SourceEntry[]};pivot(source:CellRange,config:SheetPivotOptions['config']):ReturnType<typeof pivotAnalysis>;filter(column:number,values:unknown[]|null):void}
export const analysisScopes:string[];
export function includesAnalysisRow(grid:TinyDatagrid,row:number,options?:AnalysisOptions):boolean;
export function analysisRecords(grid:TinyDatagrid,source:CellRange,options?:AnalysisOptions):{headers:string[];entries:SourceEntry[]};
export function pivotAnalysis(grid:TinyDatagrid,source:CellRange,config:SheetPivotOptions['config'],options?:AnalysisOptions):{headers:string[];result:ReturnType<TinyDatagrid['pivot']>;drill(row:number,col:number):SourceEntry[]};
export function analysisContext(options?:AnalysisOptions):GridPlugin<AnalysisContext>;
