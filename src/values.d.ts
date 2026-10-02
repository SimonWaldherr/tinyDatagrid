export type DecimalInput = DecimalValue | string | number | bigint;
export type RoundingMode = 'half-up'|'half-even'|'toward-zero'|'away-zero';
export class DecimalValue {
  constructor(coefficient:bigint,scale?:number);
  readonly coefficient:bigint; readonly scale:number;
  static parse(value:DecimalInput):DecimalValue;
  toString():string; toNumber():number;
  toJSON():{$tinyDatagridType:'decimal';value:string};
}
export function decimalOperation(op:'+'|'-'|'*'|'%',a:DecimalInput,b:DecimalInput):DecimalValue;
export function compareDecimals(a:DecimalInput,b:DecimalInput):number;
export function roundDecimal(value:DecimalInput,digits?:number,mode?:RoundingMode):DecimalValue;
export function divideDecimal(a:DecimalInput,b:DecimalInput,digits?:number,mode?:RoundingMode):DecimalValue;
export function formatDecimal(value:DecimalInput,config?:string|Record<string,unknown>,locale?:string):string;
export interface CalendarDate extends Date {calendarText():string;toJSON():any;}
export const CalendarDate: {new(year:number,month:number,day:number):CalendarDate;parse(value:string):CalendarDate};
export class ClockTime {
  constructor(seconds:number);readonly seconds:number;readonly milliseconds:number;
  toString():string;toJSON():{$tinyDatagridType:'time';seconds:number};
}
export class DurationValue {
  constructor(seconds:number);readonly seconds:number;
  toString():string;toJSON():{$tinyDatagridType:'duration';seconds:number};
}
export class FormulaError {
  constructor(code:string,message?:string);readonly code:string;readonly message:string;
  toString():string;toJSON():{$tinyDatagridType:'error';code:string;message:string};
}
export function isFormulaError(value:unknown):value is FormulaError;
