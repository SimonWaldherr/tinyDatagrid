import { sumNumbers, meanNumbers, numericExtreme, numericCount } from './numeric-operations.js';
import { FormulaError } from './formula-errors.js';
import { formulaNumber, checkedResult } from './numeric-values.js';

// All functions return ordinary rectangular arrays; the grid owns spilling,
// dependencies, collision detection and persistence. No implicit text inference.
const MAX_CELLS=100000, MAX_TEXT=1000000;
const blank=value=>value===''||value==null;
const flat=value=>Array.isArray(value)?value.flat(Infinity):[value];
function size(rows,cols){if(rows*cols>MAX_CELLS)throw new RangeError('Array exceeds 100,000 cells');}
function integer(value){const n=formulaNumber(value);if(!Number.isSafeInteger(n))throw new RangeError('Expected integer');return n;}
function text(value){if(value==null)return '';if(!['string','number','boolean','bigint'].includes(typeof value))throw new TypeError('Expected text');const s=String(value);if(s.length>MAX_TEXT)throw new RangeError('Text too long');return s;}
function matrix(value){
  const rows=Array.isArray(value)?(value.some(Array.isArray)?value:value.map(v=>[v])):[[value]];
  if(!rows.length)return [];
  const width=Array.isArray(rows[0])?rows[0].length:0;
  size(rows.length,width);
  if(!width||rows.some(row=>!Array.isArray(row)||row.length!==width))throw new TypeError('Expected rectangular array');
  return rows;
}
function rectangle(rows){if(!rows.length)return '';const width=rows.reduce((n,row)=>Math.max(n,row.length),0);size(rows.length,width);return width?rows.map(row=>[...row,...Array(width-row.length).fill('')]):'';}
function checked(min,max,fn){return (...args)=>{
  if(args.length<min||args.length>max)return new FormulaError('#VALUE!');
  try{return fn(...args)}catch(error){return error instanceof RangeError?new FormulaError('#NUM!'):new FormulaError('#VALUE!')}
};}
function names(value){const result=flat(value);if(!result.length||result.some(v=>typeof v!=='string'||!v))throw new TypeError('Expected field names');return result;}
function table(source){
  const rows=matrix(source);if(!rows.length)throw new TypeError('Expected header row');
  const headers=rows[0];if(headers.some(h=>typeof h!=='string'||!h.trim())||new Set(headers).size!==headers.length)throw new TypeError('Headers must be unique nonempty text');
  return {headers,rows:rows.slice(1).filter(row=>!row.every(blank))};
}
function indices(headers,fields){const out=fields.map(field=>headers.indexOf(field));return out.includes(-1)?null:out;}
// Keys retain scalar types: numeric 1, text "1", and booleans are distinct.
function key(values){return JSON.stringify(values.map(v=>{
  if(blank(v))return ['blank'];
  if(v instanceof Date){if(!Number.isFinite(v.getTime()))throw new TypeError('Invalid date');return ['date',v.toISOString()];}
  if(!['string','number','bigint','boolean'].includes(typeof v)||typeof v==='number'&&!Number.isFinite(v))throw new TypeError('Expected scalar key');
  return [typeof v,String(v)];
}));}
function positions(value,length){return flat(value).map(v=>{const n=integer(v),i=n<0?length+n:n-1;if(!n||i<0||i>=length)throw new TypeError('Index outside array');return i;});}
function sliceBounds(length,count,drop){
  const n=integer(count);
  if(drop)return n>=0?[Math.min(n,length),length]:[0,Math.max(0,length+n)];
  return n>=0?[0,Math.min(n,length)]:[Math.max(0,length+n),length];
}
function cut(source,rows,cols,drop){
  const array=matrix(source);if(!array.length)return '';
  const [start,end]=sliceBounds(array.length,rows,drop),[left,right]=cols===undefined?[0,array[0].length]:sliceBounds(array[0].length,cols,drop);
  if(start===end||left===right)return '';
  return array.slice(start,end).map(row=>row.slice(left,right));
}
function splitText(value,columnDelimiter,rowDelimiter){
  const source=text(value),column=text(columnDelimiter),row=rowDelimiter===undefined?null:text(rowDelimiter);
  if(!column||row!==null&&(!row||row===column))throw new TypeError('Distinct nonempty delimiters required');
  const lines=row===null?[source]:source.split(row),out=[];let cells=0;
  for(const line of lines){const parts=line.split(column);cells+=parts.length;if(cells>MAX_CELLS)throw new RangeError('Too many parts');out.push(parts);}
  return rectangle(out);
}
function parseCSV(value,delimiter=','){
  const source=text(value),sep=text(delimiter);
  if([...sep].length!==1||/["\r\n]/.test(sep))throw new TypeError('Expected one delimiter character');
  if(!source)return '';
  const rows=[];let row=[],field='',quoted=false,closed=false,cells=0;
  const push=()=>{if(++cells>MAX_CELLS)throw new RangeError('Too many fields');row.push(field);field='';closed=false;};
  for(let i=source.charCodeAt(0)===0xFEFF?1:0;i<source.length;i++){
    const ch=source[i];
    if(quoted){if(ch==='"'){if(source[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=ch;continue;}
    if(source.startsWith(sep,i)){push();i+=sep.length-1;continue;}
    if(ch==='\r'||ch==='\n'){push();rows.push(row);row=[];if(ch==='\r'&&source[i+1]==='\n')i++;continue;}
    if(closed)throw new TypeError('Unexpected text after closing quote');
    if(ch==='"'){if(field)throw new TypeError('Unexpected quote');quoted=true;}else field+=ch;
  }
  if(quoted)throw new TypeError('Unclosed quote');
  if(field||closed||row.length||!/[\r\n]$/.test(source)){push();rows.push(row);}
  return rectangle(rows);
}
function extractAll(value,pattern,flags='u'){
  const source=text(value),flagText=text(flags),regex=new RegExp(text(pattern),flagText.includes('g')?flagText:flagText+'g'),out=[];let cells=0;
  for(const match of source.matchAll(regex)){
    const row=(match.length>1?match.slice(1):[match[0]]).map(v=>v??'');cells+=row.length;
    if(cells>MAX_CELLS)throw new RangeError('Too many matches');out.push(row);
  }
  return rectangle(out);
}
const aggregates=new Set(['sum','count','counta','avg','average','min','max','first','last']);
function aggregate(values,mode){
  if(mode==='count')return numericCount(values);
  if(mode==='counta')return values.filter(v=>!blank(v)).length;
  if(mode==='first')return values[0]??'';
  if(mode==='last')return values.at(-1)??'';
  if(mode==='min'||mode==='max')return numericExtreme(values,mode==='max');
  return mode==='avg'||mode==='average'?meanNumbers(values):sumNumbers(values);
}
function uniqueHeaders(labels){const used=new Set();return labels.map(label=>{let name=label,n=2;while(used.has(name))name=`${label} (${n++})`;used.add(name);return name;});}
function groupBy(source,rowFields,valueFields,modes='SUM'){
  const {headers,rows}=table(source),groups=names(rowFields),values=names(valueFields),methods=flat(modes).map(v=>text(v).toLowerCase());
  if(methods.length!==1&&methods.length!==values.length||methods.some(m=>!aggregates.has(m)))throw new TypeError('Invalid aggregates');
  const ri=indices(headers,groups),vi=indices(headers,values);if(!ri||!vi)return new FormulaError('#REF!');
  const width=groups.length+values.length;size(1,width);size(rows.length,width);
  const buckets=new Map();
  for(const row of rows){
    const group=ri.map(i=>row[i]),id=key(group);let bucket=buckets.get(id);
    if(!bucket){size(buckets.size+2,width);bucket={group,values:vi.map(()=>[])};buckets.set(id,bucket);}
    vi.forEach((index,i)=>bucket.values[i].push(row[index]));
  }
  const out=[uniqueHeaders([...groups,...values.map((v,i)=>`${v} · ${(methods[i]??methods[0]).toUpperCase()}`)])];
  for(const bucket of buckets.values())out.push([...bucket.group,...bucket.values.map((v,i)=>aggregate(v,methods[i]??methods[0]))]);
  return out;
}
function unpivot(source,idFields,fieldName='Field',valueName='Value'){
  const {headers,rows}=table(source),ids=names(idFields),ii=indices(headers,ids);if(!ii)return new FormulaError('#REF!');
  const label=text(fieldName),value=text(valueName);
  if(!label.trim()||!value.trim()||new Set([...ids,label,value]).size!==ids.length+2)throw new TypeError('Output names must be unique');
  const remaining=headers.map((_,i)=>i).filter(i=>!ii.includes(i));size(1+rows.length*remaining.length,ids.length+2);
  const out=[[...ids,label,value]];
  for(const row of rows)for(const col of remaining)out.push([...ii.map(i=>row[i]),headers[col],row[col]]);
  return out;
}
function join(left,right,leftKeys,rightKeys,mode='inner'){
  const a=table(left),b=table(right),ak=names(leftKeys),bk=names(rightKeys),kind=text(mode).toLowerCase();
  if(ak.length!==bk.length||!['inner','left','right','full'].includes(kind))throw new TypeError('Invalid join options');
  const ai=indices(a.headers,ak),bi=indices(b.headers,bk);if(!ai||!bi)return new FormulaError('#REF!');
  size(a.rows.length,ak.length);size(b.rows.length,bk.length);
  const width=a.headers.length+b.headers.length;size(1,width);
  const out=[uniqueHeaders([...a.headers,...b.headers])],lookup=new Map(),used=new Set();
  const rowKey=(row,cols)=>{const values=cols.map(i=>row[i]);return values.some(blank)?null:key(values);};
  b.rows.forEach((row,i)=>{const id=rowKey(row,bi);if(id!==null){if(!lookup.has(id))lookup.set(id,[]);lookup.get(id).push(i);}});
  const push=(l,r)=>{size(out.length+1,width);out.push([...l,...r]);};
  for(const row of a.rows){const id=rowKey(row,ai),hits=id===null?null:lookup.get(id);
    if(hits)for(const index of hits){used.add(index);push(row,b.rows[index]);}
    else if(kind==='left'||kind==='full')push(row,Array(b.headers.length).fill(''));
  }
  if(kind==='right'||kind==='full')b.rows.forEach((row,i)=>{if(!used.has(i))push(Array(a.headers.length).fill(''),row);});
  return out;
}
function flattenArray(source,ignoreBlank,horizontal){
  if(typeof ignoreBlank!=='boolean')throw new TypeError('Expected Boolean ignoreBlank');
  const values=matrix(source).flat().filter(v=>!ignoreBlank||!blank(v));
  return values.length?(horizontal?[values]:values.map(v=>[v])):'';
}
function frequency(source,bins){
  const data=matrix(source).flat().filter(v=>!blank(v)),limits=flat(bins).map(v=>formulaNumber(v));size(limits.length+1,1);
  if(limits.some((n,i)=>i&&n<=limits[i-1]))throw new TypeError('Bins must strictly increase');
  const counts=Array(limits.length+1).fill(0);
  for(const value of data){const n=formulaNumber(value);let lo=0,hi=limits.length;while(lo<hi){const mid=(lo+hi)>>1;if(n<=limits[mid])hi=mid;else lo=mid+1;}counts[lo]++;}
  return counts.map(n=>[n]);
}
export function createArrayFunctions(){return {
  TEXTSPLIT:checked(2,3,splitText),
  'CSV.PARSE':checked(1,2,parseCSV),
  REGEXP_EXTRACTALL:checked(2,3,extractAll),
  GROUPBY:checked(3,4,groupBy),
  UNPIVOT:checked(2,4,unpivot),
  'TABLE.JOIN':checked(4,5,join),
  CHOOSECOLS:checked(2,Infinity,(source,...cols)=>{const a=matrix(source);if(!a.length)return '';const ids=positions(cols,a[0].length);size(a.length,ids.length);return a.map(row=>ids.map(i=>row[i]));}),
  CHOOSEROWS:checked(2,Infinity,(source,...rows)=>{const a=matrix(source);if(!a.length)return '';const ids=positions(rows,a.length);size(ids.length,a[0].length);return ids.map(i=>a[i].slice());}),
  TAKE:checked(2,3,(source,rows,cols)=>cut(source,rows,cols,false)),
  DROP:checked(2,3,(source,rows,cols)=>cut(source,rows,cols,true)),
  TOCOL:checked(1,2,(source,ignoreBlank=false)=>flattenArray(source,ignoreBlank,false)),
  TOROW:checked(1,2,(source,ignoreBlank=false)=>flattenArray(source,ignoreBlank,true)),
  FREQUENCY:checked(2,2,frequency)
};}
