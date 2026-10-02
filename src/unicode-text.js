import { FormulaError } from './formula-errors.js';
import { formulaNumber } from './numeric-values.js';
export const codePoints=value=>Array.from(String(value??''));
export function textIndex(value,{zero=false}={}){const number=formulaNumber(value);if(!Number.isSafeInteger(number)||number<(zero?0:1))throw new TypeError('Invalid text position/length');return number;}
// Search offsets map back to original code points, even if case conversion
// changes the number of UTF-16 units (for example capital dotted I).
export function findText(needle,haystack,start=1,ignoreCase=false){
  const points=codePoints(haystack),offset=textIndex(start)-1;
  if(offset>points.length)return new FormulaError('#N/A');
  const parts=points.slice(offset).map(point=>ignoreCase?point.toLowerCase():point), offsets=[];let length=0;
  for(const part of parts){offsets.push(length);length+=part.length;}offsets.push(length);
  const query=ignoreCase?String(needle??'').toLowerCase():String(needle??'');const source=parts.join(''),positions=new Map(offsets.map((index,position)=>[index,position]));let found=source.indexOf(query);
  while(found>=0){const index=positions.get(found);if(index!==undefined&&positions.has(found+query.length))return offset+index+1;found=source.indexOf(query,found+1);}
  return new FormulaError('#N/A');
}
