import type {CellRange} from './tinygrid.js';
export type HeatScale={min?:number;max?:number;colors?:string[]};
export function heatColor(value:number,scale?:HeatScale):string|null;
export function heatmapRule(range:CellRange,scale?:HeatScale):HeatScale & {range:CellRange;type:'colorScale'};
export function drawHeatmap(canvas:HTMLCanvasElement,values:ArrayLike<number>,rows:number,columns:number,scale?:HeatScale):void;
