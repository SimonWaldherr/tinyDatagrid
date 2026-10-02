import type {TinyDatagrid} from './tinygrid.js';
import type {FormDefinition,FormField} from './form-generator.js';
export const formCSS:string;
export function formInput(field:FormField):HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;
export function openFormGenerator(options:{grid:TinyDatagrid;title?:string;overrides?:Record<string,Partial<Pick<FormField,'label'|'kind'|'required'>>>;onDefinitionChange?:(definition:FormDefinition)=>void;onSubmit?:(definition:FormDefinition,values:Record<string,string>)=>Promise<unknown>;onShare?:(definition:FormDefinition)=>Promise<{urls:string[]}>;onStop?:()=>Promise<unknown>;renderQR?:(url:string,canvas:HTMLCanvasElement)=>void}):{dialog:HTMLDialogElement;stopped:(reason?:string)=>void;message:(text:string,error?:boolean)=>void};
