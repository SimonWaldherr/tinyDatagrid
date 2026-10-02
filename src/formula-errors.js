const codes=new Set(['#REF!','#N/A','#VALUE!','#NAME?','#NAME!','#NUM!','#DIV/0!','#ERROR!','#CYCLE!','#SPILL!','#RANGE!']);
export class FormulaError {
  constructor(text,message=''){
    const match=/^(#[^\s]+)(?:\s+(.*))?$/.exec(String(text));
    if(!match||!codes.has(match[1]))throw new TypeError('Unknown formula error code');
    this.code=match[1];this.message=message||match[2]||'';Object.freeze(this);
  }
  toString(){return this.code+(this.message?' '+this.message:'');}
  toJSON(){return {$tinyDatagridType:'error',code:this.code,message:this.message};}
}
export const isFormulaError=value=>value instanceof FormulaError;
// Keep the original public value-returning API. Internal evaluation and the
// new calculation-value API retain typed errors so '#N/A' text stays text.
export function displayFormulaResult(value){return value instanceof FormulaError?(['#VALUE!','#NUM!'].includes(value.code)?value.code:String(value)):Array.isArray(value)?value.map(displayFormulaResult):value;}
