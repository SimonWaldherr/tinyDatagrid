import { DecimalValue, compareDecimals } from './decimal-values.js';
import { CalendarDate, ClockTime, DurationValue } from './temporal-values.js';
export const scalarKind=value=>value instanceof DecimalValue||typeof value==='number'||typeof value==='bigint'?'number':value instanceof CalendarDate?'date':value instanceof Date?'datetime':value instanceof ClockTime?'time':value instanceof DurationValue?'duration':value===null?'null':typeof value;
// null means unlike types. Equality is false; ordered comparison must reject it.
export function compareScalars(left,right){
  const kind=scalarKind(left);if(kind!==scalarKind(right))return null;
  if(kind==='number')return compareDecimals(left,right);
  if(kind==='date'||kind==='datetime'){if(!Number.isFinite(left.getTime())||!Number.isFinite(right.getTime()))throw new TypeError('Invalid date');return Math.sign(left-right);}
  if(kind==='time'||kind==='duration')return Math.sign(left.seconds-right.seconds);
  if(['string','boolean'].includes(kind))return left<right?-1:left>right?1:0;
  if(kind==='null'||kind==='undefined')return 0;
  throw new TypeError('Expected comparable scalar values');
}
