export function lifeStep(cells:ArrayLike<number>,rows:number,columns:number,options?:{wrap?:boolean}):Uint8Array;
export function mandelbrot(real:number,imag:number,maxIterations?:number):number;
export type MandelbrotOptions={rows?:number;columns?:number;centerX?:number;centerY?:number;span?:number;iterations?:number};
export function computeMandelbrot(options:MandelbrotOptions,callbacks?:{signal?:AbortSignal;onProgress?:(fraction:number)=>void}):Promise<Uint16Array>;
