import type {TinyDatagrid} from './tinygrid.js';
export type FormKind='text'|'email'|'tel'|'url'|'number'|'integer'|'date'|'time'|'boolean'|'textarea'|'list'|'color';
export interface FormField {id:string;col:number;label:string;kind:FormKind;required?:boolean;choices:string[];min?:number;max?:number;minLength?:number;maxLength?:number;}
export interface FormDefinition {version:1;title:string;sheetID:string|null;scope:{headerRow:number;c1:number;c2:number;tableID?:string};fields:FormField[];computed:Array<{col:number;formula:string;templateRow:number}>;structure:string;maxRows:number;maxColumns:number;}
export const formKinds:Readonly<Record<FormKind,string>>;
export function inferFormKind(label:string,samples?:unknown[],choices?:string[]):FormKind;
export function generateForm(grid:TinyDatagrid,options?:{title?:string;overrides?:Record<string,Partial<Pick<FormField,'label'|'kind'|'required'>>>;scope?:FormDefinition['scope'];maxRows?:number;maxColumns?:number}):FormDefinition;
export function formValue(field:FormField,input:unknown):unknown;
export function appendFormResponse(grid:TinyDatagrid,definition:FormDefinition,values:Record<string,string>):number;
