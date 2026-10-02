import { formulaNumber } from './numeric-values.js';
import { DecimalValue, decimalOperation, compactDecimal, compareDecimals, exactDivide } from './decimal-values.js';
import { FormulaError } from './formula-errors.js';
const blank=value=>value===''||value==null;
export function numericOperand(value){if(value instanceof DecimalValue||typeof value==='bigint')return value;return formulaNumber(value);}
export function arithmetic(op,a,b){return compactDecimal(decimalOperation(op,numericOperand(a),numericOperand(b)));}
export function divideNumbers(a,b){a=numericOperand(a);b=numericOperand(b);if(compareDecimals(b,0)===0)return new FormulaError('#DIV/0!');if(a instanceof DecimalValue||b instanceof DecimalValue||typeof a==='bigint'||typeof b==='bigint')return compactDecimal(exactDivide(a,b));return formulaNumber(a/b);}
export function sumNumbers(values){return values.filter(value=>!blank(value)).reduce((sum,value)=>arithmetic('+',sum,value),0);}
export function meanNumbers(values){const items=values.filter(value=>!blank(value));return items.length?divideNumbers(sumNumbers(items),items.length):new FormulaError('#N/A');}
export function numericExtreme(values,maximum){const items=values.filter(value=>!blank(value)).map(numericOperand);return items.length?items.reduce((a,b)=>compareDecimals(a,b)*(maximum?1:-1)>=0?a:b):new FormulaError('#N/A');}
export const numericCount=values=>values.filter(value=>typeof value==='number'&&Number.isFinite(value)||typeof value==='bigint'||value instanceof DecimalValue).length;
