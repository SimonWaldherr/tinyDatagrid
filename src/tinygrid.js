/* tinyDatagrid - dependency-free spreadsheet/grid/pivot library
 * MIT License
 */

import { inferAutofillSeries, findAutofillExtent } from './autofill.js';
import { inferColumnType, coerceDataValue, inferDelimitedRows } from './data-types.js';
import { createLookupFunctions } from './lookups.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
function toPortableValue(value){if(value instanceof Date)return {$tinyDatagridType:'date',value:value.toISOString()};if(typeof value==='bigint')return {$tinyDatagridType:'bigint',value:String(value)};if(value instanceof ArrayBuffer)return {$tinyDatagridType:'binary',value:[...new Uint8Array(value)]};if(ArrayBuffer.isView(value))return {$tinyDatagridType:'binary',value:[...new Uint8Array(value.buffer,value.byteOffset,value.byteLength)]};if(Array.isArray(value))return value.map(toPortableValue);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,toPortableValue(item)]));return value}
function fromPortableValue(value){if(Array.isArray(value))return value.map(fromPortableValue);if(value&&typeof value==='object'){if(value.$tinyDatagridType==='date'&&typeof value.value==='string')return new Date(value.value);if(value.$tinyDatagridType==='bigint'&&typeof value.value==='string')return BigInt(value.value);if(value.$tinyDatagridType==='binary'&&Array.isArray(value.value))return Uint8Array.from(value.value);return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,fromPortableValue(item)]))}return value}
function cursorKey(value){try{return JSON.stringify(toPortableValue(value))??String(value)}catch{return String(value)}}
const SHARE_HASH_PREFIX='tg1.';
function encodeSharePayload(value){
  const bytes=new TextEncoder().encode(JSON.stringify(value)),binary=Array.from(bytes,byte=>String.fromCharCode(byte)).join('');
  return SHARE_HASH_PREFIX+btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
function decodeSharePayload(hash){
  const encoded=String(hash??'').replace(/^#/,'');if(!encoded.startsWith(SHARE_HASH_PREFIX))throw new TypeError('URL does not contain a tinyDatagrid share link');
  const base64=encoded.slice(SHARE_HASH_PREFIX.length).replaceAll('-','+').replaceAll('_','/');
  const binary=atob(base64.padEnd(Math.ceil(base64.length/4)*4,'=')),bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}
function resultHasMore(result){return result?.hasMore==null?result?.nextCursor!=null:Boolean(result.hasMore)}
function upperBound(values,target){let low=0,high=values.length;while(low<high){const middle=(low+high)>>1;if(values[middle]<=target)low=middle+1;else high=middle}return low}

export function colToName(index) {
  let n = index + 1, s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function nameToCol(name) {
  let n = 0;
  for (const ch of name.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

export function parseA1(ref) {
  const m = /^\$?([A-Z]+)\$?(\d+)$/i.exec(ref.trim());
  if (!m) return null;
  return { col: nameToCol(m[1]), row: Number(m[2]) - 1 };
}

export function toA1(row, col) {
  return `${colToName(col)}${row + 1}`;
}

/** Parse a CSV string, including quoted fields, escaped quotes and newlines. */
export function parseCSV(text, delimiter = ',') {
  const rows = []; let row = [], field = '', quoted = false;
  const input = String(text ?? '').replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === delimiter) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length || (input && !/[\r\n]$/.test(input))) { row.push(field); rows.push(row); }
  if (rows.length && rows.at(-1).length === 1 && rows.at(-1)[0] === '' && /[\r\n]$/.test(input)) rows.pop();
  return rows;
}

export function detectDelimiter(text) {
  const sample=String(text??'').replace(/^\uFEFF/,'').split(/\r?\n/).slice(0,12),candidates=[',',';','\t','|'];
  const counts=Object.fromEntries(candidates.map(delimiter=>[delimiter,[]]));
  for(const line of sample){let quoted=false;for(let i=0;i<line.length;i++){if(line[i]==='"'&&line[i+1]==='"'&&quoted){i++;continue}if(line[i]==='"')quoted=!quoted;else if(!quoted&&candidates.includes(line[i]))counts[line[i]].push(1)}}
  return candidates.map(delimiter=>({delimiter,score:counts[delimiter].reduce((sum,n)=>sum+n,0)/Math.max(1,sample.length)})).sort((a,b)=>b.score-a.score)[0].delimiter;
}

export function parseMarkdownTable(text) {
  const lines=String(text??'').replace(/^\uFEFF/,'').split(/\r?\n/).map(line=>line.trim()).filter(line=>line.startsWith('|')&&line.endsWith('|'));
  const rows=lines.map(line=>line.slice(1,-1).split(/(?<!\\)\|/).map(value=>value.trim().replaceAll('\\|','|')));
  return rows.filter(row=>!row.every(value=>/^:?-{3,}:?$/.test(value)));
}

function importMarkupTable(markup,selector='table') {
  const doc=new DOMParser().parseFromString(String(markup??''),'text/html'),table=doc.querySelector(selector);
  if(!table)throw new TypeError('No table found in imported markup');
  return [...table.querySelectorAll('tr')].map(row=>[...row.querySelectorAll('th,td')].map(cell=>cell.getAttribute('data-formula')||cell.textContent.trim()));
}

export function stringifyCSV(rows, delimiter = ',') {
  return rows.map(row => row.map(value => {
    const text = value == null ? '' : value instanceof Date ? value.toISOString() : String(value);
    return /["\r\n]/.test(text) || text.includes(delimiter) ? `"${text.replaceAll('"', '""')}"` : text;
  }).join(delimiter)).join('\r\n');
}

function normalizeRange(a, b) {
  return {
    r1: Math.min(a.row, b.row), c1: Math.min(a.col, b.col),
    r2: Math.max(a.row, b.row), c2: Math.max(a.col, b.col)
  };
}

function flatten(v) {
  if (Array.isArray(v)) return v.flat(Infinity);
  return [v];
}

function asNumber(v) {
  if (v === '' || v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isFormulaError(value) { return typeof value === 'string' && /^#(?:REF!|N\/A|VALUE!|NAME[?!]|NUM!|DIV\/0!|ERROR!|CYCLE!|RANGE!)/.test(value); }
function criteriaMatches(value, criteria) {
  const text=String(criteria??'');const match=/^(<=|>=|<>|!=|=|<|>)(.*)$/.exec(text);let operator='=',expected=criteria;
  if(match){operator=match[1];expected=match[2]}
  const left=Number(value),right=Number(expected);const numeric=value!==''&&expected!==''&&Number.isFinite(left)&&Number.isFinite(right);
  const a=numeric?left:String(value??'').toLocaleLowerCase(),b=numeric?right:String(expected??'').toLocaleLowerCase();
  if(operator==='='){
    if(typeof expected==='string'&&/[?*]/.test(expected)){const pattern=expected.replace(/[.+^${}()|[\]\\]/g,'\\$&').replaceAll('*','.*').replaceAll('?','.');return new RegExp(`^${pattern}$`,'i').test(String(value??''))}
    return numeric?a===b:String(value??'').toLocaleLowerCase()===String(expected??'').toLocaleLowerCase();
  }
  if(operator==='!='||operator==='<>')return a!==b;
  if(operator==='<')return a<b;if(operator==='>')return a>b;if(operator==='<=')return a<=b;if(operator==='>=')return a>=b;
  return false;
}

function normalizedRows(value) { return Array.isArray(value) ? (Array.isArray(value[0]) ? value : value.map(v=>[v])) : [[value]]; }

class FormulaTokenizer {
  constructor(input) { this.s = input; this.i = 0; this.tokens = []; }
  tokenize() {
    while (this.i < this.s.length) {
      const c = this.s[this.i];
      if (/\s/.test(c)) { this.i++; continue; }
      if (c === '"') { this.tokens.push(this.readString()); continue; }
      if (/[0-9.]/.test(c)) { this.tokens.push(this.readNumber()); continue; }
      if (/[A-Za-z_@$]/.test(c)) { this.tokens.push(this.readIdent()); continue; }
      const two = this.s.slice(this.i, this.i + 2);
      if (['<=','>=','<>','!=','=='].includes(two)) { this.tokens.push({type:'op',value:two}); this.i += 2; continue; }
      if (c === ',' || c === ';') { this.tokens.push({type:',',value:','}); this.i++; continue; }
      if ('+-*/^%=<>()\,:&'.includes(c)) {
        const type = '(),:'.includes(c) ? c : 'op';
        this.tokens.push({type,value:c}); this.i++; continue;
      }
      throw new Error(`Unexpected character '${c}'`);
    }
    this.tokens.push({type:'eof', value:''});
    return this.tokens;
  }
  readString() {
    this.i++; let out = '';
    while (this.i < this.s.length) {
      const c = this.s[this.i++];
      if (c === '"') {
        if (this.s[this.i] === '"') { out += '"'; this.i++; continue; }
        break;
      }
      out += c;
    }
    return {type:'string', value:out};
  }
  readNumber() {
    const start = this.i;
    while (/[0-9.eE+-]/.test(this.s[this.i] || '')) {
      const chunk = this.s.slice(start, this.i + 1);
      if (!/^\d*\.?\d*(?:[eE][+-]?\d*)?$/.test(chunk)) break;
      this.i++;
    }
    return {type:'number', value:Number(this.s.slice(start, this.i))};
  }
  readIdent() {
    const start = this.i;
    if (this.s[this.i] === '@') this.i++;
    while (/[A-Za-z0-9_.$]/.test(this.s[this.i] || '')) this.i++;
    return {type:'ident', value:this.s.slice(start, this.i)};
  }
}

class FormulaParser {
  constructor(tokens) { this.t = tokens; this.i = 0; }
  peek(type, value) { const t = this.t[this.i]; return t.type === type && (value == null || t.value === value); }
  take(type, value) {
    const t = this.t[this.i];
    if (!this.peek(type, value)) throw new Error(`Expected ${value ?? type}, got ${t.value || t.type}`);
    this.i++; return t;
  }
  parse() { const e = this.expr(0); this.take('eof'); return e; }
  expr(minBp) {
    let left;
    const t = this.t[this.i++];
    if (t.type === 'number' || t.type === 'string') left = {type:'literal', value:t.value};
    else if (t.type === 'op' && ['+','-'].includes(t.value)) left = {type:'unary', op:t.value, expr:this.expr(70)};
    else if (t.type === '(') { left = this.expr(0); this.take(')'); }
    else if (t.type === 'ident') {
      if (this.peek('(')) {
        this.i++; const args = [];
        if (!this.peek(')')) {
          do { args.push(this.expr(0)); if (!this.peek(',')) break; this.i++; } while (true);
        }
        this.take(')');
        left = {type:'call', name:t.value.toUpperCase(), args};
      } else left = {type:'ident', name:t.value};
    } else throw new Error(`Unexpected token ${t.value || t.type}`);

    while (true) {
      const p = this.t[this.i];
      if (p.type === ':') {
        if (90 < minBp) break;
        this.i++;
        const right = this.expr(91);
        left = {type:'range', left, right};
        continue;
      }
      if (p.type !== 'op') break;
      const bp = {'=':10,'==':10,'<>':10,'!=':10,'<':10,'>':10,'<=':10,'>=':10,'&':20,'+':30,'-':30,'*':40,'/':40,'%':40,'^':50}[p.value];
      if (bp == null || bp < minBp) break;
      this.i++;
      const right = this.expr(bp + (p.value === '^' ? 0 : 1));
      left = {type:'binary', op:p.value, left, right};
    }
    return left;
  }
}

export class FormulaEngine {
  constructor(grid) {
    this.grid = grid;
    this.cache = new Map();
    this.locals = [];
    this.functions = {
      SUM: (...xs) => flatten(xs).reduce((a,v)=>a+asNumber(v),0),
      AVERAGE: (...xs) => { const a=flatten(xs).filter(v=>v!==''&&v!=null); return a.length?a.reduce((s,v)=>s+asNumber(v),0)/a.length:0; },
      AVG: (...xs) => this.functions.AVERAGE(...xs),
      MIN: (...xs) => Math.min(...flatten(xs).map(asNumber)),
      MAX: (...xs) => Math.max(...flatten(xs).map(asNumber)),
      MEDIAN:(...xs)=>{const a=flatten(xs).filter(v=>v!==''&&v!=null&&Number.isFinite(Number(v))).map(Number).sort((x,y)=>x-y),m=a.length>>1;return a.length?(a.length%2?a[m]:(a[m-1]+a[m])/2):'#NUM!'},
      LARGE:(array,k)=>{const a=flatten(array).map(asNumber).sort((x,y)=>y-x);return a[asNumber(k)-1]??'#NUM!'}, SMALL:(array,k)=>{const a=flatten(array).map(asNumber).sort((x,y)=>x-y);return a[asNumber(k)-1]??'#NUM!'},
      COUNT: (...xs) => flatten(xs).filter(v=>v!==''&&v!=null&&!Number.isNaN(Number(v))).length,
      COUNTA: (...xs) => flatten(xs).filter(v=>v!==''&&v!=null).length,
      COUNTBLANK:(...xs)=>flatten(xs).filter(v=>v===''||v==null).length,
      ABS: x => Math.abs(asNumber(x)), ROUND: (x,n=0)=>Number(asNumber(x).toFixed(asNumber(n))),
      ROUNDUP:(x,n=0)=>{const p=10**asNumber(n);return Math.sign(asNumber(x))*Math.ceil(Math.abs(asNumber(x))*p)/p},
      ROUNDDOWN:(x,n=0)=>{const p=10**asNumber(n);return Math.sign(asNumber(x))*Math.floor(Math.abs(asNumber(x))*p)/p},
      FLOOR: x => Math.floor(asNumber(x)), CEIL: x => Math.ceil(asNumber(x)), INT:x=>Math.floor(asNumber(x)), SQRT:x=>Math.sqrt(asNumber(x)),
      POW: (a,b)=>Math.pow(asNumber(a),asNumber(b)), MOD:(a,b)=>asNumber(a)%asNumber(b), SIGN:x=>Math.sign(asNumber(x)),
      IF: (cond,a,b)=>cond?a:b, IFS:(...xs)=>{for(let i=0;i+1<xs.length;i+=2)if(xs[i])return xs[i+1];return '#N/A'},
      SWITCH:(value,...xs)=>{for(let i=0;i+1<xs.length;i+=2)if(value===xs[i])return xs[i+1];return xs.length%2?xs.at(-1):'#N/A'},
      CHOOSE:(index,...xs)=>xs[Math.trunc(asNumber(index))-1]??'#VALUE!',
      IFERROR:(value,fallback)=>isFormulaError(value)?fallback:value, IFNA:(value,fallback)=>value==='#N/A'?fallback:value,
      AND:(...xs)=>flatten(xs).every(Boolean), OR:(...xs)=>flatten(xs).some(Boolean), XOR:(...xs)=>flatten(xs).filter(Boolean).length%2===1, NOT:x=>!x,
      TRUE:()=>true,FALSE:()=>false, ISBLANK:x=>x===''||x==null, ISNUMBER:x=>typeof x==='number'&&Number.isFinite(x), ISTEXT:x=>typeof x==='string'&&!isFormulaError(x), ISLOGICAL:x=>typeof x==='boolean', ISERROR:isFormulaError, N:asNumber, VALUE:x=>{const n=Number(x);return Number.isFinite(n)?n:'#VALUE!'},
      CONCAT: (...xs)=>flatten(xs).join(''), LEN:x=>String(x ?? '').length,
      TEXTJOIN:(separator,ignoreEmpty,...xs)=>flatten(xs).filter(v=>!ignoreEmpty||v!==''&&v!=null).join(String(separator??'')),
      UPPER:x=>String(x??'').toUpperCase(), LOWER:x=>String(x??'').toLowerCase(), PROPER:x=>String(x??'').toLocaleLowerCase().replace(/\b\p{L}/gu,c=>c.toLocaleUpperCase()),
      TRIM:x=>String(x??'').trim().replace(/\s+/g,' '), LEFT:(x,n=1)=>Array.from(String(x??'')).slice(0,Math.max(0,asNumber(n))).join(''),
      RIGHT:(x,n=1)=>{const count=Math.max(0,Math.trunc(asNumber(n)));return count?Array.from(String(x??'')).slice(-count).join(''):''}, MID:(x,start,n)=>Array.from(String(x??'')).slice(Math.max(0,asNumber(start)-1),Math.max(0,asNumber(start)-1)+Math.max(0,asNumber(n))).join(''),
      FIND:(needle,haystack,start=1)=>{const i=String(haystack??'').indexOf(String(needle??''),Math.max(0,asNumber(start)-1));return i<0?'#VALUE!':i+1},
      SEARCH:(needle,haystack,start=1)=>{const i=String(haystack??'').toLocaleLowerCase().indexOf(String(needle??'').toLocaleLowerCase(),Math.max(0,asNumber(start)-1));return i<0?'#VALUE!':i+1},
      SUBSTITUTE:(text,oldText,newText,instance)=>{const s=String(text??''),old=String(oldText??''),replacement=String(newText??'');if(!old)return s;if(instance==null)return s.split(old).join(replacement);let seen=0;return s.replaceAll(old,m=>++seen===asNumber(instance)?replacement:m)},
      REPLACE:(text,start,count,replacement)=>{const a=Array.from(String(text??'')),i=Math.max(0,asNumber(start)-1);a.splice(i,Math.max(0,asNumber(count)),...Array.from(String(replacement??'')));return a.join('')},
      TEXT:(value,format)=>{const f=String(format??'General');if(/%/.test(f))return `${(asNumber(value)*100).toFixed((f.split('.')[1]||'').replace(/[^0]/g,'').length)}%`;const decimals=(f.split('.')[1]||'').replace(/[^0#]/g,'').length;return Number.isFinite(Number(value))?Number(value).toLocaleString(undefined,{minimumFractionDigits:decimals,maximumFractionDigits:decimals}):String(value??'')},
      SUMIF:(range,criteria,sumRange=range)=>{const a=flatten(range),b=flatten(sumRange);return a.reduce((s,v,i)=>s+(criteriaMatches(v,criteria)?asNumber(b[i]):0),0)},
      COUNTIF:(range,criteria)=>flatten(range).filter(v=>criteriaMatches(v,criteria)).length,
      AVERAGEIF:(range,criteria,averageRange=range)=>{const a=flatten(range),b=flatten(averageRange),xs=a.map((v,i)=>criteriaMatches(v,criteria)?b[i]:null).filter(v=>v!==null&&v!==''&&v!=null);return xs.length?xs.reduce((s,v)=>s+asNumber(v),0)/xs.length:'#DIV/0!'},
      SUMIFS:(sumRange,...xs)=>{if(!xs.length||xs.length%2)return '#VALUE!';const sums=flatten(sumRange);return sums.reduce((total,v,i)=>{let ok=true;for(let j=0;j<xs.length;j+=2)if(!criteriaMatches(flatten(xs[j])[i],xs[j+1])){ok=false;break}return total+(ok?asNumber(v):0)},0)},
      COUNTIFS:(...xs)=>{if(!xs.length||xs.length%2)return '#VALUE!';const ranges=xs.filter((_,i)=>i%2===0).map(flatten),criteria=xs.filter((_,i)=>i%2===1);return ranges[0].filter((_,i)=>criteria.every((c,j)=>criteriaMatches(ranges[j][i],c))).length},
      AVERAGEIFS:(averageRange,...xs)=>{if(!xs.length||xs.length%2)return '#VALUE!';const vals=flatten(averageRange),ranges=xs.filter((_,i)=>i%2===0).map(flatten),criteria=xs.filter((_,i)=>i%2===1),hit=vals.filter((v,i)=>criteria.every((c,j)=>criteriaMatches(ranges[j][i],c))&&v!==''&&v!=null);return hit.length?hit.reduce((s,v)=>s+asNumber(v),0)/hit.length:'#DIV/0!'},
      ...createLookupFunctions(),
      FILTER:(array,include,ifEmpty='')=>{const rows=normalizedRows(array),mask=flatten(include);const out=rows.filter((_,i)=>Boolean(mask[i]));return out.length?out:ifEmpty},
      UNIQUE:array=>{const rows=normalizedRows(array),seen=new Set();return rows.filter(row=>{const k=JSON.stringify(row);if(seen.has(k))return false;seen.add(k);return true})},
      SORT:(array,index=1,order=1)=>{const rows=normalizedRows(array),col=Math.max(0,Math.trunc(asNumber(index))-1),direction=asNumber(order)<0?-1:1;return [...rows].sort((a,b)=>{const x=a[col],y=b[col];return (typeof x==='number'&&typeof y==='number'?x-y:String(x??'').localeCompare(String(y??''),undefined,{numeric:true,sensitivity:'base'}))*direction})},
      SEQUENCE:(rows=1,columns=1,start=1,step=1)=>{const r=clamp(Math.trunc(asNumber(rows)),0,10000),c=clamp(Math.trunc(asNumber(columns)),0,10000);if(r*c>100000)return '#NUM!';return Array.from({length:r},(_,ri)=>Array.from({length:c},(_,ci)=>asNumber(start)+(ri*c+ci)*asNumber(step)))},
      TRANSPOSE:array=>{const rows=normalizedRows(array);return rows[0].map((_,c)=>rows.map(row=>row[c]??''))},
      ROWS:array=>normalizedRows(array).length, COLUMNS:array=>normalizedRows(array)[0]?.length||0,
      HSTACK:(...arrays)=>{const matrices=arrays.map(normalizedRows),rows=Math.max(0,...matrices.map(a=>a.length));return Array.from({length:rows},(_,r)=>matrices.flatMap(a=>a[r]||Array(a[0]?.length||1).fill('')))},
      VSTACK:(...arrays)=>arrays.flatMap(a=>normalizedRows(a)),
      SUMPRODUCT:(...arrays)=>{const values=arrays.map(flatten),length=Math.max(0,...values.map(a=>a.length));return Array.from({length},(_,i)=>values.reduce((product,a)=>product*asNumber(a[i]),1)).reduce((sum,n)=>sum+n,0)},
      MAP:(array,lambda)=>{const rows=normalizedRows(array);return rows.map(row=>[lambda(...row)])},
      REDUCE:(initial,array,lambda)=>flatten(array).reduce((acc,value)=>lambda(acc,value),initial),
      SCAN:(initial,array,lambda)=>flatten(array).reduce((out,value)=>{const prev=out.length?out.at(-1)[0]:initial;out.push([lambda(prev,value)]);return out},[]),
      BYROW:(array,lambda)=>normalizedRows(array).map(row=>[lambda(row)]),
      MAKEARRAY:(rows,columns,lambda)=>{const r=clamp(Math.trunc(asNumber(rows)),0,10000),c=clamp(Math.trunc(asNumber(columns)),0,10000);if(r*c>100000)return '#NUM!';return Array.from({length:r},(_,ri)=>Array.from({length:c},(_,ci)=>lambda(ri+1,ci+1)))},
      TODAY: ()=>new Date(new Date().setHours(0,0,0,0)), NOW:()=>new Date(), DATE:(y,m,d)=>new Date(asNumber(y),asNumber(m)-1,asNumber(d)),
      YEAR:x=>new Date(x).getFullYear(), MONTH:x=>new Date(x).getMonth()+1, DAY:x=>new Date(x).getDate(), DATEVALUE:x=>{const d=new Date(x);return Number.isNaN(d.valueOf())?'#VALUE!':d},
      HOUR:x=>new Date(x).getHours(), MINUTE:x=>new Date(x).getMinutes(), SECOND:x=>new Date(x).getSeconds(), DAYS:(end,start)=>Math.round((new Date(end)-new Date(start))/86400000),
      PI:()=>Math.PI, EXP:x=>Math.exp(asNumber(x)), LN:x=>Math.log(asNumber(x)), LOG:(x,base=10)=>Math.log(asNumber(x))/Math.log(asNumber(base)), POWER:(a,b)=>Math.pow(asNumber(a),asNumber(b))
    };
  }
  clearCache() { this.cache.clear(); }
  evaluateFormula(formula, visiting = new Set()) {
    try {
      const tokens = new FormulaTokenizer(formula.replace(/^=/,'')).tokenize();
      const ast = new FormulaParser(tokens).parse();
      return this.evalNode(ast, visiting);
    } catch (e) { return `#ERROR! ${e.message}`; }
  }
  evalNode(n, visiting) {
    switch (n.type) {
      case 'literal': return n.value;
      case 'ident': {
        const upper = n.name.toUpperCase();
        if (upper === 'TRUE'||upper==='WAHR') return true;
        if (upper === 'FALSE'||upper==='FALSCH') return false;
        for(let i=this.locals.length-1;i>=0;i--)if(Object.hasOwn(this.locals[i],upper))return this.locals[i][upper];
        if (/^\$?[A-Z]+\$?\d+$/.test(upper)) {
          const p = parseA1(upper); return this.grid.getComputedValue(p.row,p.col,visiting);
        }
        const key = n.name.startsWith('@') ? n.name.slice(1) : n.name;
        if (this.grid.variables.has(key)) {
          const v = this.grid.variables.get(key);
          return typeof v === 'string' && v.startsWith('=') ? this.evaluateFormula(v, visiting) : v;
        }
        return `#NAME? ${n.name}`;
      }
      case 'range': {
        if (n.left.type !== 'ident' || n.right.type !== 'ident') return '#RANGE!';
        const a = parseA1(n.left.name), b = parseA1(n.right.name); if (!a || !b) return '#RANGE!';
        const rr = normalizeRange(a,b), out=[];
        for(let r=rr.r1;r<=rr.r2;r++){ const row=[]; for(let c=rr.c1;c<=rr.c2;c++) row.push(this.grid.getComputedValue(r,c,visiting)); out.push(row); }
        return out;
      }
      case 'unary': { const raw=this.evalNode(n.expr,visiting);if(isFormulaError(raw))return raw;const v=asNumber(raw); return n.op==='-'?-v:v; }
      case 'binary': {
        const a=this.evalNode(n.left,visiting), b=this.evalNode(n.right,visiting);
        if(isFormulaError(a))return a;if(isFormulaError(b))return b;
        switch(n.op){
          case '+': return asNumber(a)+asNumber(b); case '-': return asNumber(a)-asNumber(b);
          case '*': return asNumber(a)*asNumber(b); case '/': return asNumber(b)===0?'#DIV/0!':asNumber(a)/asNumber(b);
          case '%': return asNumber(a)%asNumber(b); case '^': return Math.pow(asNumber(a),asNumber(b)); case '&': return String(a??'')+String(b??'');
          case '=': case '==': return a==b; case '<>': case '!=': return a!=b; case '<': return a<b; case '>': return a>b; case '<=': return a<=b; case '>=': return a>=b;
        }
      }
      case 'call': {
        if(n.name==='IF'){
          if(n.args.length<2||n.args.length>3)return '#VALUE!';const condition=this.evalNode(n.args[0],visiting);if(isFormulaError(condition))return condition;
          if(condition)return this.evalNode(n.args[1],visiting);return n.args.length===3?this.evalNode(n.args[2],visiting):false;
        }
        if(n.name==='IFERROR'||n.name==='IFNA'){
          if(n.args.length!==2)return '#VALUE!';const value=this.evalNode(n.args[0],visiting);
          return n.name==='IFERROR'?isFormulaError(value)?this.evalNode(n.args[1],visiting):value:value==='#N/A'?this.evalNode(n.args[1],visiting):value;
        }
        if(n.name==='ISERROR')return n.args.length===1?isFormulaError(this.evalNode(n.args[0],visiting)):'#VALUE!';
        if(n.name==='AND'||n.name==='OR'){
          for(const arg of n.args){const value=this.evalNode(arg,visiting);if(isFormulaError(value))return value;const values=flatten(value);if(n.name==='AND'&&values.some(v=>!v))return false;if(n.name==='OR'&&values.some(Boolean))return true}
          return n.name==='AND';
        }
        if(n.name==='IFS'){
          if(!n.args.length||n.args.length%2)return '#VALUE!';for(let i=0;i<n.args.length;i+=2){const condition=this.evalNode(n.args[i],visiting);if(isFormulaError(condition))return condition;if(condition)return this.evalNode(n.args[i+1],visiting)}return '#N/A';
        }
        if(n.name==='SWITCH'){
          if(n.args.length<3)return '#VALUE!';const value=this.evalNode(n.args[0],visiting),hasDefault=n.args.length%2===0,pairEnd=n.args.length-(hasDefault?1:0);
          for(let i=1;i<pairEnd;i+=2){const candidate=this.evalNode(n.args[i],visiting);if(candidate===value)return this.evalNode(n.args[i+1],visiting)}
          return hasDefault?this.evalNode(n.args.at(-1),visiting):'#N/A';
        }
        if(n.name==='LET'){
          if(n.args.length<3||n.args.length%2===0)return '#VALUE!';
          const scope={};this.locals.push(scope);
          try{
            for(let i=0;i<n.args.length-1;i+=2){const binding=n.args[i];if(binding.type!=='ident'||/^\$?[A-Z]+\$?\d+$/i.test(binding.name))return '#NAME?';scope[binding.name.toUpperCase()]=this.evalNode(n.args[i+1],visiting)}
            return this.evalNode(n.args.at(-1),visiting);
          }finally{this.locals.pop()}
        }
        if(n.name==='LAMBDA'){
          if(n.args.length<2||n.args.slice(0,-1).some(p=>p.type!=='ident'||/^\$?[A-Z]+\$?\d+$/i.test(p.name)))return '#VALUE!';
          const params=n.args.slice(0,-1).map(p=>p.name.toUpperCase()),body=n.args.at(-1),engine=this;
          const lambda=(...values)=>{const scope={};params.forEach((name,i)=>scope[name]=values[i]??'');engine.locals.push(scope);try{return engine.evalNode(body,visiting)}finally{engine.locals.pop()}};
          lambda.__tinyLambda=true;return lambda;
        }
        const fn=this.functions[n.name]; if(!fn) return `#NAME? ${n.name}`;
        const args=n.args.map(x=>this.evalNode(x,visiting));
        const lookupFunctions=['MATCH','XMATCH','VLOOKUP','HLOOKUP','XLOOKUP','LOOKUP','SVERWEIS','WVERWEIS','XVERWEIS','VERGLEICH','VERWEIS'];
        const toleratesErrors=['COUNT','COUNTA','COUNTBLANK','COUNTIF','COUNTIFS'];
        if(lookupFunctions.includes(n.name)){if(isFormulaError(args[0]))return args[0]}
        else if(!toleratesErrors.includes(n.name)){const error=args.flatMap(flatten).find(isFormulaError);if(error)return error}
        try { return fn(...args); } catch(e) { return `#ERROR! ${e.message}`; }
      }
    }
  }
}

export class PivotEngine {
  static pivot(data, config={}) {
    const rowFields=config.rows||[], colFields=config.columns||[], valueDefs=(config.values||[]).map(v=>typeof v==='string'?{field:v,aggregate:'sum'}:v);
    const filters=config.filters||{};
    const filtered=data.filter(rec=>Object.entries(filters).every(([k,v])=> typeof v==='function'?v(rec[k],rec):Array.isArray(v)?v.includes(rec[k]):rec[k]===v));
    const rowKeys=[], colKeys=[], rowSeen=new Set(), colSeen=new Set();
    const cells=new Map();
    const makeKey=(rec,fields)=>fields.map(f=>String(rec[f]??'')).join('\u001F');
    const pushUnique=(k,arr,set)=>{if(!set.has(k)){set.add(k);arr.push(k);}};
    for(const rec of filtered){
      const rk=makeKey(rec,rowFields), ck=makeKey(rec,colFields); pushUnique(rk,rowKeys,rowSeen); pushUnique(ck,colKeys,colSeen);
      const key=rk+'\u001E'+ck; if(!cells.has(key)) cells.set(key,{}); const bucket=cells.get(key);
      for(const vd of valueDefs){ const bk=vd.field+'|'+vd.aggregate; (bucket[bk] ||= []).push(rec[vd.field]); }
    }
    const agg=(vals,type)=>{ const nums=vals.map(Number).filter(Number.isFinite); switch((type||'sum').toLowerCase()){
      case 'count': return vals.length; case 'counta': return vals.filter(v=>v!==''&&v!=null).length; case 'avg': case 'average': return nums.length?nums.reduce((a,b)=>a+b,0)/nums.length:0;
      case 'min': return nums.length?Math.min(...nums):null; case 'max':return nums.length?Math.max(...nums):null; case 'first':return vals[0]??null; case 'last':return vals.at(-1)??null; default:return nums.reduce((a,b)=>a+b,0);
    }};
    const matrix=rowKeys.map(rk=>colKeys.map(ck=>{
      const b=cells.get(rk+'\u001E'+ck)||{}; const out={};
      for(const vd of valueDefs){ const k=vd.field+'|'+vd.aggregate; out[vd.as||k]=agg(b[k]||[],vd.aggregate); }
      return out;
    }));
    return {
      rowFields,colFields,values:valueDefs,
      rowKeys:rowKeys.map(k=>k.split('\u001F')), colKeys:colKeys.map(k=>k.split('\u001F')), matrix,
      toTable(){
        const header=[...rowFields];
        for(const ck of this.colKeys){ for(const vd of valueDefs) header.push(`${ck.join(' / ') || 'Total'} · ${vd.as||vd.field}`); }
        const rows=[header];
        this.rowKeys.forEach((rk,ri)=>{ const row=[...rk]; this.colKeys.forEach((ck,ci)=>valueDefs.forEach(vd=>row.push(matrix[ri][ci][vd.as||(vd.field+'|'+vd.aggregate)]))); rows.push(row); });
        return rows;
      }
    };
  }
}

export class TinyDatagrid {
  constructor(container, options={}) {
    this.el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.el) throw new Error('tinyDatagrid container not found');
    this.options = { rows:100, columns:26, rowHeight:28, columnWidth:110, headerWidth:52, headerHeight:28, ...options };
    const overscan=Math.trunc(Number(this.options.virtualizationOverscan??6));
    this.virtualization=Boolean(this.options.virtualization);this.virtualizationOverscan=Number.isFinite(overscan)?Math.max(0,overscan):6;this._virtualFrame=null;this._resizeObserver=null;
    this.rowCount=this.options.rows; this.colCount=this.options.columns;
    this.rowHeights=Array(this.rowCount).fill(this.options.rowHeight); this.colWidths=Array(this.colCount).fill(this.options.columnWidth);
    this.cells=new Map(); this.variables=new Map(); this.engine=new FormulaEngine(this); this.selection={r1:0,c1:0,r2:0,c2:0}; this.anchor={row:0,col:0}; this.hiddenColumns=new Set(); this.hiddenRows=new Set();
    this.table=null;this.columnFilters=new Map();this.filteredRows=new Set();this.sheetName=options.sheetName||'Sheet1';this.freezePanes={rows:0,columns:0};this.conditionalFormats=[];
    this.sqlBinding=null;
    this.readOnly=Boolean(options.readOnly);
    this.listeners=new Map(); this._abort=new AbortController(); this._destroyed=false; this._dragPayload=null; this._fillState=null; this._editing=null;
    this._history=[]; this._future=[]; this.historyLimit=options.historyLimit??100;
    this.build();
    if (options.variables) Object.entries(options.variables).forEach(([k,v])=>this.variables.set(k,v));
    this.render(); this.bind();
    if (options.data) this.load(options.data);
  }
  _listen(target,type,fn,options={}){target.addEventListener(type,fn,{...options,signal:this._abort.signal})}
  on(type,fn){(this.listeners.get(type)||this.listeners.set(type,new Set()).get(type)).add(fn);return()=>this.listeners.get(type)?.delete(fn)}
  emit(type,detail){if(this._destroyed)return;this.listeners.get(type)?.forEach(fn=>fn(detail));this.el.dispatchEvent(new CustomEvent(`tinygrid:${type}`,{detail}));}
  setReadOnly(readOnly=true){this.readOnly=Boolean(readOnly);this.el.classList.toggle('tg-readonly',this.readOnly);this.el.setAttribute('aria-readonly',String(this.readOnly));this.editor.readOnly=this.readOnly;if(this.readOnly){this._fillState=null;this._closeAutofillMenu(true);if(this._editing)this.commitEdit(true)}if(!this.contextMenu.hidden)this._renderAxisMenu(this._contextMenuAxis,this._contextMenuIndex);this.emit('readonly',{readOnly:this.readOnly});return this}
  setVirtualization(enabled=true){const value=Boolean(enabled);if(value===this.virtualization)return this;this.virtualization=value;this._syncVirtualizationObserver();this.render();this.emit('virtualization',{enabled:value,overscan:this.virtualizationOverscan});return this}
  _syncVirtualizationObserver(){
    if(!this.virtualization||typeof globalThis.ResizeObserver!=='function'){this._resizeObserver?.disconnect();this._resizeObserver=null;return}
    if(!this._resizeObserver)this._resizeObserver=new globalThis.ResizeObserver(()=>this._scheduleVirtualRender());
    this._resizeObserver.observe(this.scroll);
  }
  destroy({clear=true}={}){if(this._destroyed)return;this._destroyed=true;if(this._virtualFrame!=null)globalThis.cancelAnimationFrame?.(this._virtualFrame);this._virtualFrame=null;this._resizeObserver?.disconnect();this._resizeObserver=null;this._abort.abort();this.listeners.clear();if(clear){this.el.replaceChildren();this.el.classList.remove('tg-root');this.el.removeAttribute('tabindex')}}
  key(r,c){return `${r},${c}`}
  ensureSize(rows,cols){
    let changed=false;
    if(rows>this.rowCount){while(this.rowHeights.length<rows)this.rowHeights.push(this.options.rowHeight);this.rowCount=rows;changed=true}
    if(cols>this.colCount){while(this.colWidths.length<cols)this.colWidths.push(this.options.columnWidth);this.colCount=cols;changed=true}
    return changed;
  }
  _cloneSQLBinding(binding){return binding?{...binding,columns:[...binding.columns],keyColumns:[...binding.keyColumns],editableColumns:binding.editableColumns?[...binding.editableColumns]:null,seenCursors:new Set(binding.seenCursors||[]),sqlRowIds:new Map(binding.sqlRowIds),originalRows:new Map(binding.originalRows),inserted:new Set(binding.inserted),deleted:new Map(binding.deleted)}:null}
  _snapshot(){return {cells:new Map(this.cells),rowCount:this.rowCount,colCount:this.colCount,rowHeights:[...this.rowHeights],colWidths:[...this.colWidths],hiddenColumns:new Set(this.hiddenColumns),hiddenRows:new Set(this.hiddenRows),table:this.table?{...this.table}:null,columnFilters:new Map([...this.columnFilters].map(([k,v])=>[k,new Set(v)])),sheetName:this.sheetName,freezePanes:{...this.freezePanes},conditionalFormats:structuredClone(this.conditionalFormats),sqlBinding:this._cloneSQLBinding(this.sqlBinding)}}
  _recordHistory(){this._history.push(this._snapshot());if(this._history.length>this.historyLimit)this._history.shift();this._future.length=0}
  _restore(state){this.cells=new Map(state.cells);this.rowCount=state.rowCount;this.colCount=state.colCount;this.rowHeights=[...state.rowHeights];this.colWidths=[...state.colWidths];this.hiddenColumns=new Set(state.hiddenColumns||[]);this.hiddenRows=new Set(state.hiddenRows||[]);this.table=state.table?{...state.table}:null;this.columnFilters=new Map([...state.columnFilters||[]].map(([k,v])=>[k,new Set(v)]));this.sheetName=state.sheetName||'Sheet1';this.freezePanes={rows:0,columns:0,...state.freezePanes};this.conditionalFormats=structuredClone(state.conditionalFormats||[]);this.sqlBinding=this._cloneSQLBinding(state.sqlBinding);this.anchor={row:clamp(this.anchor.row,0,this.rowCount-1),col:clamp(this.anchor.col,0,this.colCount-1)};this.selection={r1:clamp(this.selection.r1,0,this.rowCount-1),c1:clamp(this.selection.c1,0,this.colCount-1),r2:clamp(this.selection.r2,0,this.rowCount-1),c2:clamp(this.selection.c2,0,this.colCount-1)};this.engine.clearCache();this.render();this.emit('change',{type:'history'})}
  get canUndo(){return this._history.length>0}
  get canRedo(){return this._future.length>0}
  undo(){if(!this._history.length)return false;this._future.push(this._snapshot());this._restore(this._history.pop());return true}
  redo(){if(!this._future.length)return false;this._history.push(this._snapshot());this._restore(this._future.pop());return true}
  isCellReadOnly(row,col){if(this.readOnly)return true;if(!this.sqlBinding)return false;if(row===this.sqlBinding.headerRow||!this.sqlBinding.keyColumns.length)return true;const column=this.sqlBinding.columns[col-this.sqlBinding.startCol];if(!column)return true;return Boolean(column.readOnly||column.primaryKey||this.sqlBinding.keyColumns.includes(column.name)||(this.sqlBinding.editableColumns&&!this.sqlBinding.editableColumns.includes(column.name)))}
  _coerceSQLValue(col,value){if(!this.sqlBinding||typeof value!=='string'||value.startsWith('='))return value;const column=this.sqlBinding.columns[col-this.sqlBinding.startCol];return coerceDataValue(value,{type:column?.type||'unknown'})}
  setCell(row,col,value,meta={}){if(this.sqlBinding&&this.isCellReadOnly(row,col))return false;value=this._coerceSQLValue(col,value);this._recordHistory();const grew=this.ensureSize(row+1,col+1);const k=this.key(row,col);const old=this.cells.get(k)||{};this.cells.set(k,{...old,...meta,raw:value});this.engine.clearCache();this._updateFilteredRows();this.emit('change',{row,col,value});if(grew||this.table)this.render();else this.renderCells();return true}
  getCell(row,col){return this.cells.get(this.key(row,col))||{raw:''}}
  getRawValue(row,col){const cell=this.getCell(row,col);return Object.hasOwn(cell,'raw')?cell.raw:''}
  getComputedValue(row,col,visiting=new Set()){
    const k=this.key(row,col); if(this.engine.cache.has(k)) return this.engine.cache.get(k); if(visiting.has(k)) return '#CYCLE!';
    visiting.add(k); const raw=this.getRawValue(row,col); let out=raw;
    if(typeof raw==='string'&&raw.startsWith('=')) out=this.engine.evaluateFormula(raw,visiting);
    else if(typeof raw==='string'&&raw!==''&&!Number.isNaN(Number(raw))){const type=String(this.sqlBinding?.columns[col-this.sqlBinding.startCol]?.type||'').toLowerCase(),numeric=Number(raw),textType=/^(char|character|varchar|nvarchar|nchar|text|string|uuid|uniqueidentifier|citext|enum|set|xml|clob|ntext)\b/.test(type);out=textType||/^[-+]?0\d+$/.test(raw.trim())||/^(decimal|numeric|money|smallmoney|numeric\(.*\))/.test(type)||(/^(bigint|int8|integer64|bigserial)$/.test(type)&&!Number.isSafeInteger(numeric))?raw:numeric}
    visiting.delete(k); this.engine.cache.set(k,out); return out;
  }
  setVariable(name,value){this.variables.set(String(name).replace(/^@/,''),value);this.engine.clearCache();this.renderCells();this.emit('variable',{name,value});}
  getVariable(name){return this.variables.get(String(name).replace(/^@/,''));}
  setRowHeight(row,h){this.rowHeights[row]=clamp(h,18,400);this.layout();this.emit('resize',{type:'row',index:row,size:this.rowHeights[row]});}
  setColumnWidth(col,w){this.colWidths[col]=clamp(w,36,800);this.layout();this.emit('resize',{type:'column',index:col,size:this.colWidths[col]});}
  hideRow(row){if(row<0||row>=this.rowCount||this.hiddenRows.has(row)||this.hiddenRows.size>=this.rowCount-1)return false;this._recordHistory();this.hiddenRows.add(row);let visible=row+1;while(visible<this.rowCount&&this.hiddenRows.has(visible))visible++;if(visible>=this.rowCount){visible=row-1;while(visible>=0&&this.hiddenRows.has(visible))visible--}visible=Math.max(0,visible);this.anchor={row:visible,col:0};this.selection={r1:visible,c1:0,r2:visible,c2:this.colCount-1};this.layout();this.emit('rowhide',{index:row});this.emit('select',{...this.selection});return true}
  showAllRows(){if(!this.hiddenRows.size)return false;const rows=[...this.hiddenRows].sort((a,b)=>a-b);this._recordHistory();this.hiddenRows.clear();this.layout();this.emit('rowshow',{rows});return true}
  insertRow(index){if(this.sqlBinding)return this.insertRecord({});index=clamp(index,0,this.rowCount);this._recordHistory();const shifted=new Map();for(const [key,value] of this.cells){const [row,col]=key.split(',').map(Number);shifted.set(this.key(row>=index?row+1:row,col),value)}this.cells=shifted;this.rowHeights.splice(index,0,this.options.rowHeight);this.hiddenRows=new Set([...this.hiddenRows].map(row=>row>=index?row+1:row));this.rowCount++;this.engine.clearCache();this.anchor={row:index,col:0};this.selection={r1:index,c1:0,r2:index,c2:this.colCount-1};this.render();this.emit('change',{type:'rowinsert',index});return this}
  deleteRow(index,{history=true,trackSQL=true}={}){if(trackSQL&&this.sqlBinding)return this.deleteRecord(index);if(index<0||index>=this.rowCount||this.rowCount<=1)return false;if(history)this._recordHistory();const shifted=new Map();for(const [key,value] of this.cells){const [row,col]=key.split(',').map(Number);if(row!==index)shifted.set(this.key(row>index?row-1:row,col),value)}this.cells=shifted;this.rowHeights.splice(index,1);this.hiddenRows=new Set([...this.hiddenRows].filter(row=>row!==index).map(row=>row>index?row-1:row));if(this.sqlBinding)this.sqlBinding.sqlRowIds=new Map([...this.sqlBinding.sqlRowIds].filter(([row])=>row!==index).map(([row,id])=>[row>index?row-1:row,id]));this.rowCount--;const selected=Math.min(index,this.rowCount-1);this.anchor={row:selected,col:0};this.selection={r1:selected,c1:0,r2:selected,c2:this.colCount-1};this.engine.clearCache();this.render();this.emit('change',{type:'rowdelete',index});return true}
  clearRow(index){if(this.sqlBinding&&(this.readOnly||index===this.sqlBinding.headerRow))return false;this._recordHistory();for(let col=0;col<this.colCount;col++){if(this.sqlBinding&&this.isCellReadOnly(index,col))continue;const key=this.key(index,col),cell=this.cells.get(key);if(cell)this.cells.set(key,{...cell,raw:''})}this.engine.clearCache();this.renderCells();this.emit('change',{type:'rowclear',index});return true}
  autoFitRow(index){let lines=1;for(let col=0;col<this.colCount;col++){if(this.hiddenColumns.has(col))continue;lines=Math.max(lines,String(this.formatValue(this.getComputedValue(index,col),this.getCell(index,col).numberFormat)??'').split('\n').length)}this._recordHistory();this.setRowHeight(index,clamp(lines*18+10,28,400));return this.rowHeights[index]}
  hideColumn(col){if(col<0||col>=this.colCount||this.hiddenColumns.has(col)||this.hiddenColumns.size>=this.colCount-1)return false;this._recordHistory();this.hiddenColumns.add(col);let visible=col+1;while(visible<this.colCount&&this.hiddenColumns.has(visible))visible++;if(visible>=this.colCount){visible=col-1;while(visible>=0&&this.hiddenColumns.has(visible))visible--}visible=Math.max(0,visible);this.anchor={row:0,col:visible};this.selection={r1:0,c1:visible,r2:this.rowCount-1,c2:visible};this.layout();this.emit('columnhide',{index:col});this.emit('select',{...this.selection});return true}
  showAllColumns(){if(!this.hiddenColumns.size)return false;const columns=[...this.hiddenColumns].sort((a,b)=>a-b);this._recordHistory();this.hiddenColumns.clear();this.layout();this.emit('columnshow',{columns});return true}
  insertColumn(index){if(this.sqlBinding)return false;index=clamp(index,0,this.colCount);this._recordHistory();const shifted=new Map();for(const [key,value] of this.cells){const [row,col]=key.split(',').map(Number);shifted.set(this.key(row,col>=index?col+1:col),value)}this.cells=shifted;this.colWidths.splice(index,0,this.options.columnWidth);this.hiddenColumns=new Set([...this.hiddenColumns].map(col=>col>=index?col+1:col));this.colCount++;this.engine.clearCache();this.anchor={row:0,col:index};this.selection={r1:0,c1:index,r2:this.rowCount-1,c2:index};this.render();this.emit('change',{type:'columninsert',index});return this}
  deleteColumn(index){if(this.sqlBinding||index<0||index>=this.colCount||this.colCount<=1)return false;this._recordHistory();const shifted=new Map();for(const [key,value] of this.cells){const [row,col]=key.split(',').map(Number);if(col!==index)shifted.set(this.key(row,col>index?col-1:col),value)}this.cells=shifted;this.colWidths.splice(index,1);this.hiddenColumns=new Set([...this.hiddenColumns].filter(col=>col!==index).map(col=>col>index?col-1:col));this.colCount--;const selected=Math.min(index,this.colCount-1);this.anchor={row:0,col:selected};this.selection={r1:0,c1:selected,r2:this.rowCount-1,c2:selected};this.engine.clearCache();this.render();this.emit('change',{type:'columndelete',index});return true}
  clearColumn(index){if(this.sqlBinding&&(this.readOnly||this.isCellReadOnly(this.sqlBinding.headerRow+1,index)))return false;this._recordHistory();for(let row=0;row<this.rowCount;row++){if(this.sqlBinding&&(row===this.sqlBinding.headerRow||this.isCellReadOnly(row,index)))continue;const key=this.key(row,index),cell=this.cells.get(key);if(cell)this.cells.set(key,{...cell,raw:''})}this.engine.clearCache();this.renderCells();this.emit('change',{type:'columnclear',index});return true}
  autoFitColumn(index){const ctx=document.createElement('canvas').getContext('2d');ctx.font=getComputedStyle(this.el).font;let width=colToName(index).length*8+20;for(let row=0;row<this.rowCount;row++){const text=this.formatValue(this.getComputedValue(row,index),this.getCell(row,index).numberFormat);width=Math.max(width,ctx.measureText(String(text??'')).width+18)}this._recordHistory();this.setColumnWidth(index,clamp(Math.ceil(width),48,800));return this.colWidths[index]}
  load(data,startRow=0,startCol=0){
    if(Array.isArray(data)){
      this._recordHistory();this.sqlBinding=null;
      data.forEach((row,r)=>Array.isArray(row)&&row.forEach((v,c)=>{if(v!==''&&v!=null)this.cells.set(this.key(startRow+r,startCol+c),{raw:v})}));
      const cols=Math.max(0,...data.map(r=>Array.isArray(r)?r.length:0)); this.ensureSize(startRow+data.length,startCol+cols);
    }
    this.engine.clearCache();this.render();
  }
  loadRecords(records,{headers=Object.keys(records?.[0]||{}),includeHeaders=true,startRow=0,startCol=0}={}){
    if(!Array.isArray(records))throw new TypeError('Records must be an array of objects');
    const data=[...(includeHeaders?[headers]:[]),...records.map(record=>headers.map(header=>Object.hasOwn(record||{},header)?record[header]:''))];
    this.load(data,startRow,startCol);return {rows:records.length,headers:[...headers]};
  }
  _sqlRecord(row,columns=this.sqlBinding.columns){const record={};columns.forEach((column,index)=>{const col=this.sqlBinding.startCol+index,raw=this.getRawValue(row,col);record[column.name]=typeof raw==='string'&&raw.startsWith('=')?this.getComputedValue(row,col):raw});return record}
  _sqlKey(record){const columns=this.sqlBinding.keyColumns;if(!columns.length)return null;if(columns.some(name=>record[name]==null))throw new TypeError(`SQL key is missing a value (${columns.join(', ')})`);return `pk:${JSON.stringify(columns.map(name=>toPortableValue(record[name])))}`}
  loadResultSet(result,{tableName=result?.tableName??null,keyColumns=result?.keyColumns||result?.primaryKey||[],editableColumns=null,readOnly=true,replace=true}={}){
    if(!result||!Array.isArray(result.rows))throw new TypeError('SQL result must provide a rows array');
    let columns=Array.isArray(result.columns)?result.columns.map((column,index)=>typeof column==='string'?{name:column,type:'unknown'}:{...column,name:String(column.name??column.columnName??`column_${index+1}`),type:column.type??column.dataType??column.typeName??'unknown'}):[];
    if(!columns.length){const first=result.rows[0];const names=Array.isArray(first)?first.map((_,index)=>`column_${index+1}`):Object.keys(first||{});columns=names.map(name=>({name:String(name),type:'unknown'}))}
    keyColumns=[...new Set((Array.isArray(keyColumns)?keyColumns:[keyColumns]).map(value=>typeof value==='string'?value:value?.name).filter(Boolean).map(String))];if(!keyColumns.length)keyColumns=columns.filter(column=>column.primaryKey||column.isPrimaryKey).map(column=>String(column.name));
    columns=columns.map(column=>({...column,name:String(column.name),primaryKey:Boolean(column.primaryKey||column.isPrimaryKey||keyColumns.includes(column.name)),readOnly:Boolean(column.readOnly||column.isReadOnly||column.generated||column.isGenerated||column.computed)}));
    if(new Set(columns.map(column=>column.name)).size!==columns.length)throw new TypeError('SQL result column names must be unique; alias repeated fields in the query');
    for(const key of keyColumns)if(!columns.some(column=>column.name===key))throw new TypeError(`SQL key column not found: ${key}`);
    if(editableColumns!=null){editableColumns=[...new Set((Array.isArray(editableColumns)?editableColumns:[editableColumns]).map(column=>typeof column==='string'?column:column?.name).filter(Boolean).map(String))];for(const name of editableColumns)if(!columns.some(column=>column.name===name))throw new TypeError(`Editable SQL column not found: ${name}`)}
    const records=result.rows.map(row=>Array.isArray(row)?Object.fromEntries(columns.map((column,index)=>[column.name,row[index]??null])):Object.fromEntries(columns.map(column=>[column.name,row?.[column.name]??null])));
    columns=columns.map(column=>{const type=String(column.type||'unknown').toLowerCase();if(!['','unknown','any'].includes(type)||keyColumns.includes(column.name))return column;const inferred=inferColumnType(records.map(record=>record[column.name]));return inferred==='unknown'?column:{...column,type:inferred}});
    records.forEach(record=>columns.forEach(column=>{if(!keyColumns.includes(column.name))record[column.name]=coerceDataValue(record[column.name],{type:column.type})}));
    if(!columns.length)throw new TypeError('SQL result must include column metadata, including for an empty result');if(!readOnly&&!keyColumns.length)throw new TypeError('Editable SQL results require keyColumns so updates can target rows safely');
    const startCol=0,headerRow=0,matrix=[columns.map(column=>column.name),...records.map(record=>columns.map(column=>record[column.name]))];
    if(!replace&&this.sqlBinding)return this.appendResultPage({...result,columns,rows:result.rows},{tableName,keyColumns,editableColumns,readOnly});
    const binding={tableName,columns,keyColumns,editableColumns,startCol,headerRow,firstDataRow:headerRow+1,lastDataRow:headerRow+records.length,loadedRows:records.length,fetchedRows:records.length,totalRows:Number.isFinite(result.rowCount)?result.rowCount:records.length,hasMore:resultHasMore(result),nextCursor:result.nextCursor??null,seenCursors:new Set(result.nextCursor==null?[]:[cursorKey(result.nextCursor)]),emptyPageCount:0,queryId:result.queryId??null,metadata:result.metadata??null,sqlRowIds:new Map(),originalRows:new Map(),inserted:new Set(),deleted:new Map(),nextInsertId:1};
    records.forEach((record,index)=>{if(keyColumns.some(name=>record[name]==null))throw new TypeError(`SQL key is missing a value (${keyColumns.join(', ')})`);const id=keyColumns.length?`pk:${JSON.stringify(keyColumns.map(name=>toPortableValue(record[name])))}`:`row:${index}`;if(binding.originalRows.has(id))throw new TypeError(`Duplicate SQL key in result: ${id}`);binding.sqlRowIds.set(binding.firstDataRow+index,id);binding.originalRows.set(id,structuredClone(record))});
    this._importMatrix(matrix,{replace:true,startRow:0,startCol});this.table={r1:headerRow,c1:startCol,r2:Math.max(headerRow,records.length),c2:startCol+columns.length-1,headerRow,style:'banded'};this.columnFilters.clear();this.filteredRows.clear();this.sqlBinding=binding;
    this.setReadOnly(Boolean(readOnly));this._history.length=0;this._future.length=0;this.engine.clearCache();this.render();this.emit('sqlresult',{tableName,rows:records.length,totalRows:binding.totalRows,columns:columns.map(column=>({...column})),readOnly:Boolean(readOnly)});return {rows:records.length,totalRows:binding.totalRows,columns};
  }
  appendResultPage(result){
    if(!this.sqlBinding)throw new Error('Load the first SQL result page before appending another page');
    const binding=this.sqlBinding,columns=(result.columns||binding.columns).map(column=>typeof column==='string'?{name:column}:column);
    if(columns.map(column=>String(column.name??column.columnName)).join('\u001f')!==binding.columns.map(column=>column.name).join('\u001f'))throw new TypeError('SQL result page schema does not match the active result');
    if(!result||!Array.isArray(result.rows))throw new TypeError('SQL page must provide a rows array');
    const rows=result.rows,hasMore=resultHasMore(result),nextCursor=result.nextCursor??null;
    if(hasMore&&nextCursor==null&&!rows.length)throw new Error('SQL page made no progress: it returned no rows, cursor, or end-of-results signal');
    if(hasMore&&!rows.length&&binding.emptyPageCount>=4)throw new Error('SQL pagination returned too many empty pages in a row');
    if(hasMore&&nextCursor!=null&&binding.seenCursors.has(cursorKey(nextCursor)))throw new Error('SQL pagination cursor did not advance; refusing to append the same page again');
    const records=rows.map(row=>Array.isArray(row)?Object.fromEntries(binding.columns.map((column,index)=>[column.name,row[index]??null])):Object.fromEntries(binding.columns.map(column=>[column.name,row?.[column.name]??null])));const pageIds=records.map((record,index)=>{if(binding.keyColumns.some(name=>record[name]==null))throw new TypeError(`SQL key is missing a value (${binding.keyColumns.join(', ')})`);return binding.keyColumns.length?`pk:${JSON.stringify(binding.keyColumns.map(name=>toPortableValue(record[name])))}`:`row:${binding.fetchedRows+index}`});const pageSeen=new Set();for(const id of pageIds){if(pageSeen.has(id)||binding.originalRows.has(id))throw new TypeError(`Duplicate SQL key across pages: ${id}`);pageSeen.add(id)}
    records.forEach(record=>binding.columns.forEach(column=>{record[column.name]=coerceDataValue(record[column.name],{type:column.type})}));const startRow=binding.lastDataRow+1,matrix=records.map(record=>binding.columns.map(column=>record[column.name]));
    if(matrix.length)this._importMatrix(matrix,{startRow,startCol:binding.startCol,preserveDataSource:true});
    records.forEach((record,index)=>{const row=startRow+index,id=pageIds[index];binding.sqlRowIds.set(row,id);binding.originalRows.set(id,structuredClone(record))});
    binding.loadedRows+=records.length;binding.fetchedRows+=records.length;binding.lastDataRow=Math.max(binding.headerRow,binding.firstDataRow+binding.loadedRows-1);binding.totalRows=Number.isFinite(result.rowCount)?result.rowCount:binding.totalRows;binding.hasMore=hasMore;binding.nextCursor=nextCursor;if(hasMore&&nextCursor!=null)binding.seenCursors.add(cursorKey(nextCursor));binding.emptyPageCount=records.length?0:binding.emptyPageCount+1;if(result.metadata!=null)binding.metadata=result.metadata;this.table.r2=binding.lastDataRow;this.render();this.emit('sqlpage',{rows:records.length,loadedRows:binding.loadedRows,fetchedRows:binding.fetchedRows,totalRows:binding.totalRows,hasMore:binding.hasMore,nextCursor:binding.nextCursor});return {rows:records.length,loadedRows:binding.loadedRows,fetchedRows:binding.fetchedRows,totalRows:binding.totalRows,hasMore:binding.hasMore,nextCursor:binding.nextCursor};
  }
  getSQLMetadata(){if(!this.sqlBinding)return null;const {tableName,columns,keyColumns,editableColumns,loadedRows,fetchedRows,totalRows,hasMore,nextCursor,queryId,metadata}=this.sqlBinding;return {tableName,columns:columns.map(column=>({...column})),keyColumns:[...keyColumns],editableColumns:editableColumns?[...editableColumns]:null,loadedRows,fetchedRows,totalRows,hasMore,nextCursor,queryId,metadata,readOnly:this.readOnly}}
  insertRecord(record){
    if(!this.sqlBinding||this.readOnly||!this.sqlBinding.keyColumns.length)throw new Error('An editable SQL result set with keyColumns is required to insert a record');
    const binding=this.sqlBinding,row=binding.lastDataRow+1;this._recordHistory();this.ensureSize(row+1,this.colCount);binding.columns.forEach((column,index)=>this.cells.set(this.key(row,binding.startCol+index),{raw:Object.hasOwn(record||{},column.name)?record[column.name]:undefined}));this.rowHeights[row]=this.options.rowHeight;binding.lastDataRow=row;binding.loadedRows++;this.table.r2=row;const id=`insert:${binding.nextInsertId++}`;binding.sqlRowIds.set(row,id);binding.inserted.add(id);this.engine.clearCache();this.render();this.emit('sqlinsert',{row,record:{...record},clientId:id});return {row,clientId:id};
  }
  deleteRecord(row){
    if(!this.sqlBinding||this.readOnly||!this.sqlBinding.keyColumns.length||row<=this.sqlBinding.headerRow||row>this.sqlBinding.lastDataRow)return false;
    const binding=this.sqlBinding,id=binding.sqlRowIds.get(row);if(!id)return false;const record=this._sqlRecord(row),key=Object.fromEntries(binding.keyColumns.map(name=>[name,record[name]]));this._recordHistory();if(binding.inserted.has(id))binding.inserted.delete(id);else binding.deleted.set(id,structuredClone(binding.originalRows.get(id)));const removed=this.deleteRow(row,{history:false,trackSQL:false});if(removed){binding.loadedRows=Math.max(0,binding.loadedRows-1);binding.lastDataRow=Math.max(binding.headerRow,binding.lastDataRow-1);this.table.r2=binding.lastDataRow;this.emit('sqldelete',{key,clientId:id})}return removed;
  }
  getDataChanges(){
    if(!this.sqlBinding)return {updates:[],inserts:[],deletes:[]};const binding=this.sqlBinding,updates=[],inserts=[];
    for(const [row,id] of binding.sqlRowIds){if(row<binding.firstDataRow||row>binding.lastDataRow)continue;const current=this._sqlRecord(row);if(binding.inserted.has(id)){inserts.push({clientId:id,record:current});continue}const original=binding.originalRows.get(id);if(!original)continue;const changes={};for(const column of binding.columns){const name=column.name;if(JSON.stringify(toPortableValue(current[name]))!==JSON.stringify(toPortableValue(original[name])))changes[name]=current[name]}if(Object.keys(changes).length){const key=Object.fromEntries(binding.keyColumns.map(name=>[name,original[name]]));updates.push({key,original:structuredClone(original),changes})}}
    const deletes=[...binding.deleted].map(([id,original])=>({key:Object.fromEntries(binding.keyColumns.map(name=>[name,original?.[name]])),original:structuredClone(original),clientId:id}));return {updates,inserts,deletes};
  }
  acceptDataChanges({keyMap={},recordsByClientId={}}={}){
    if(!this.sqlBinding)return false;const binding=this.sqlBinding,pending=this.getDataChanges(),counts={updates:pending.updates.length,inserts:pending.inserts.length,deletes:pending.deletes.length},getResult=(collection,id)=>collection instanceof Map?collection.get(id):collection[id],returnedValues=id=>{const generated=getResult(keyMap,id),record=getResult(recordsByClientId,id)||{};return {...record,...(generated==null?{}:typeof generated==='object'?generated:{[binding.keyColumns[0]]:generated})};};
    for(const [row,id] of binding.sqlRowIds){if(!binding.inserted.has(id))continue;const serverValues=returnedValues(id),current=this._sqlRecord(row);for(const name of binding.keyColumns)if(serverValues[name]==null&&current[name]==null)throw new Error(`Save succeeded but returned no generated SQL key for inserted row ${id}`)}
    for(const [row,id] of [...binding.sqlRowIds]){if(row<binding.firstDataRow||row>binding.lastDataRow)continue;const values=returnedValues(id);for(const [name,value] of Object.entries(values)){const index=binding.columns.findIndex(column=>column.name===name);if(index>=0)this.cells.set(this.key(row,binding.startCol+index),{...this.getCell(row,binding.startCol+index),raw:value})}if(Object.keys(values).length)this.engine.clearCache();let currentId=id;if(binding.inserted.has(id)){currentId=this._sqlKey(this._sqlRecord(row));binding.sqlRowIds.set(row,currentId);binding.inserted.delete(id);binding.originalRows.delete(id)}binding.originalRows.set(currentId,structuredClone(this._sqlRecord(row)));binding.inserted.delete(currentId)}
    for(const id of binding.deleted.keys())binding.originalRows.delete(id);binding.deleted.clear();this.engine.clearCache();this.renderCells();this._history.length=0;this._future.length=0;this.emit('sqlsaved',{changes:counts});return true;
  }
  toArray(range={r1:0,c1:0,r2:this.rowCount-1,c2:this.colCount-1},computed=false){
    const rr={r1:Math.min(range.r1,range.r2),c1:Math.min(range.c1,range.c2),r2:Math.max(range.r1,range.r2),c2:Math.max(range.c1,range.c2)};
    const out=[];for(let r=rr.r1;r<=rr.r2;r++){const row=[];for(let c=rr.c1;c<=rr.c2;c++)row.push(computed?this.getComputedValue(r,c):this.getRawValue(r,c));out.push(row)}return out;
  }
  getUsedRange(){if(this.sqlBinding)return {r1:this.sqlBinding.headerRow,c1:this.sqlBinding.startCol,r2:this.sqlBinding.lastDataRow,c2:this.sqlBinding.startCol+this.sqlBinding.columns.length-1};let r2=0,c2=0;for(const [key,cell] of this.cells){if(cell.raw===''||cell.raw==null)continue;const [r,c]=key.split(',').map(Number);r2=Math.max(r2,r);c2=Math.max(c2,c)}return {r1:0,c1:0,r2,c2}}
  exportCSV({range,computed=false,delimiter=','}={}){return stringifyCSV(this.toArray(range||this.getUsedRange(),computed),delimiter)}
  exportTSV({range,computed=false}={}){return this.exportCSV({range,computed,delimiter:'\t'})}
  exportHTML({range,computed=true}={}){const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');const rows=this.toArray(range||this.getUsedRange(),computed);return `<!doctype html><meta charset="utf-8"><table><tbody>${rows.map(row=>`<tr>${row.map(value=>`<td>${escape(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`}
  exportMarkdown({range,computed=true}={}){const rows=this.toArray(range||this.getUsedRange(),computed).map(row=>row.map(value=>String(value??'').replaceAll('|','\\|').replace(/\r?\n/g,'<br>')));if(!rows.length)return '';return [rows[0],rows[0].map(()=> '---'),...rows.slice(1)].map(row=>`| ${row.join(' | ')} |`).join('\n')}
  importCSV(text,options={}){return this.importDelimited(text,{...options,delimiter:options.delimiter||detectDelimiter(text)})}
  _importMatrix(data,{startRow=0,startCol=0,replace=false,preserveDataSource=false,cellFormats=null}={}){
    if(!Array.isArray(data)||!data.length)return 0;const width=Math.max(0,...data.map(row=>Array.isArray(row)?row.length:0));this._recordHistory();
    if(replace){this.cells=new Map();this.hiddenRows.clear();this.hiddenColumns.clear();this.table=null;this.columnFilters.clear();this.sqlBinding=null;this.rowCount=Math.max(1,this.options.rows,startRow+data.length);this.colCount=Math.max(1,this.options.columns,startCol+width);this.rowHeights=Array(this.rowCount).fill(this.options.rowHeight);this.colWidths=Array(this.colCount).fill(this.options.columnWidth)}else if(!preserveDataSource)this.sqlBinding=null;
    else for(let r=startRow;r<startRow+data.length;r++)for(let c=startCol;c<startCol+width;c++)this.cells.delete(this.key(r,c));
    data.forEach((row,r)=>Array.isArray(row)&&row.forEach((value,c)=>{const format=cellFormats?.get(`${r},${c}`);this.cells.set(this.key(startRow+r,startCol+c),{...(format?{numberFormat:format}:{}),raw:value})}));
    this.ensureSize(startRow+data.length,startCol+width);this.engine.clearCache();this.render();this.emit('change',{type:'import',rows:data.length,replace});return data.length;
  }
  importDelimited(text,{delimiter=detectDelimiter(text),inferTypes=true,locale,headerRow=0,...options}={}){let data=parseCSV(text,delimiter),cellFormats;if(inferTypes){const inferred=inferDelimitedRows(data,{locale,headerRow});data=inferred.rows;cellFormats=inferred.formats}return this._importMatrix(data,{...options,cellFormats})}
  importHTML(markup,options={}){return this._importMatrix(importMarkupTable(markup),options)}
  importMarkdown(markdown,options={}){return this._importMatrix(parseMarkdownTable(markdown),options)}
  importNDJSON(text,{startRow=0,startCol=0,replace=false,inferTypes=false,locale}={}){
    const records=String(text??'').split(/\r?\n/).filter(line=>line.trim()).map(line=>JSON.parse(line));if(!records.length)return 0;
    if(records.every(Array.isArray))return this._importMatrix(records,{startRow,startCol,replace});
    if(records.every(record=>record&&typeof record==='object'&&!Array.isArray(record))){const headers=[...new Set(records.flatMap(Object.keys))];const data=[headers,...records.map(record=>headers.map(header=>Object.hasOwn(record,header)?record[header]:''))];if(inferTypes){const inferred=inferDelimitedRows(data,{locale});return this._importMatrix(inferred.rows,{startRow,startCol,replace,cellFormats:inferred.formats})}return this._importMatrix(data,{startRow,startCol,replace})}
    return this._importMatrix(records.map(record=>[record]),{startRow,startCol,replace});
  }
  importSpreadsheetXML(xml,options={}){
    const doc=new DOMParser().parseFromString(String(xml??''),'application/xml');if(doc.querySelector('parsererror'))throw new TypeError('Invalid XML document');
    const elements=[...doc.getElementsByTagName('*')],worksheets=elements.filter(element=>element.localName==='Worksheet');let table=worksheets[0]?.getElementsByTagName('*');table=[...(table||[])].find(element=>element.localName==='Table');if(!table)throw new TypeError('No SpreadsheetML worksheet found');
    const rows=[...table.getElementsByTagName('*')].filter(element=>element.localName==='Row'),data=[];let rowIndex=0;
    for(const row of rows){const explicitRow=Number([...row.attributes].find(attr=>attr.localName==='Index')?.value);if(explicitRow>0)rowIndex=explicitRow-1;const values=[];let colIndex=0;for(const cell of [...row.children].filter(element=>element.localName==='Cell')){const explicitCol=Number([...cell.attributes].find(attr=>attr.localName==='Index')?.value);if(explicitCol>0)colIndex=explicitCol-1;const item=[...cell.getElementsByTagName('*')].find(element=>element.localName==='Data');let value=item?.textContent??'';const type=item?[...item.attributes].find(attr=>attr.localName==='Type')?.value:null;if(type==='Number')value=Number(value);else if(type==='Boolean')value=value==='1';else if(type==='DateTime')value=new Date(value);values[colIndex++]=value}data[rowIndex++]=values}
    return this._importMatrix(data,{replace:true,...options});
  }
  async importFile(file,options={}){
    if(typeof file==='string')throw new TypeError('importFile expects a File object');const name=(file.name||'').toLowerCase();if(/\.(xlsx|xlsm|xlsb|ods)$/.test(name))throw new TypeError('This archive-based spreadsheet format needs an XLSX/ODS adapter. Use CSV, TSV, HTML, SpreadsheetML XML or JSON for now.');const text=await file.text(),trimmed=text.trimStart();
    if(/\.(ndjson|jsonl)$/.test(name))return this.importNDJSON(text,{replace:true,...options});
    if(/\.(html?|htm)$/.test(name)||/^<!doctype html|^<html|<table[\s>]/i.test(trimmed))return this.importHTML(text,{replace:true,...options});
    if(/\.xls$/.test(name))throw new TypeError('Binary .xls files are not supported; export them as CSV, HTML or SpreadsheetML XML first.');
    if(/\.(md|markdown)$/.test(name)||/^\|[^\n]+\|\s*\n\|?\s*:?-{3,}/.test(trimmed))return this.importMarkdown(text,{replace:true,...options});
    if(/\.xml$/.test(name)||/^<\?xml/i.test(trimmed))return this.importSpreadsheetXML(text,{replace:true,...options});
    if(/\.json$/.test(name)||/^[\[{]/.test(trimmed)){try{return this.importJSON(text,{...options,replace:true})}catch(error){if(/\.json$/.test(name))throw error}}
    const delimiter=/\.(tsv|tab)$/.test(name)?'\t':/\.csv$/.test(name)?detectDelimiter(text):detectDelimiter(text);
    return this.importDelimited(text,{...options,delimiter,replace:true});
  }
  exportJSON({range=this.getUsedRange(),computed=true,headerRow=range.r1}={}){
    const table=this.toArray(range,computed),offset=headerRow-range.r1;const headers=(table[offset]||[]).map((v,i)=>String(v||colToName(range.c1+i)));
    return table.slice(offset+1).filter((row,index)=>this.sqlBinding?this.sqlBinding.sqlRowIds.has(headerRow+1+index):row.some(v=>v!==''&&v!=null)).map(row=>Object.fromEntries(headers.map((header,i)=>[header,this.sqlBinding?row[i]:(row[i]??'')])));
  }
  exportWorkbook({values=true,formulas=true,formatting=true,dimensions=true}={}){
    const cells=[];
    for(const [key,meta] of this.cells){const [row,col]=key.split(',').map(Number),raw=meta.raw;const cell={row,col};
      if(typeof raw==='string'&&raw.startsWith('=')){if(formulas)cell.formula=raw;if(values)cell.value=toPortableValue(this.getComputedValue(row,col))}else if(values&&raw!==''&&raw!=null)cell.value=toPortableValue(raw);
      if(formatting){if(meta.numberFormat!=null)cell.numberFormat=meta.numberFormat;if(meta.style)cell.style={...meta.style};if(meta.className)cell.className=meta.className}
      if(Object.keys(cell).length>2)cells.push(cell);
    }
    const dims=dimensions?{rows:this.rowCount,columns:this.colCount,rowHeights:[...this.rowHeights],columnWidths:[...this.colWidths],hiddenRows:[...this.hiddenRows].sort((a,b)=>a-b),hiddenColumns:[...this.hiddenColumns].sort((a,b)=>a-b)}:undefined;
    const sheet={id:'sheet1',name:this.sheetName,cells,variables:toPortableValue(Object.fromEntries(this.variables)),...(dims?{dimensions:dims}:{}),freezePanes:{...this.freezePanes},conditionalFormats:structuredClone(this.conditionalFormats),table:this.table?{...this.table}:null,filters:[...this.columnFilters].map(([column,values])=>({column,values:[...values]}))};
    const workbook={format:'tinyDatagrid-workbook',version:2,activeSheetId:'sheet1',sheets:[sheet],cells,variables:sheet.variables};
    if(dims)workbook.dimensions=dims;
    return workbook;
  }
  /** Create a self-contained URL that restores this workbook from its hash. */
  createShareURL(baseURL=globalThis.location?.href){
    if(!baseURL)throw new TypeError('A base URL is required outside a browser');
    const url=new URL(baseURL);url.hash=encodeSharePayload(this.exportWorkbook());return url.toString();
  }
  /** Restore a workbook encoded in a tinyDatagrid share URL hash. */
  importShareHash(hash=globalThis.location?.hash){return this.importWorkbook(decodeSharePayload(hash),{replace:true})}
  importWorkbook(input,{replace=true,startRow=0,startCol=0,values=true,formulas=true,formatting=true,dimensions=true}={}){
    const workbook=typeof input==='string'?JSON.parse(input):input;
    if(!workbook||workbook.format!=='tinyDatagrid-workbook')throw new TypeError('Workbook JSON must use the tinyDatagrid-workbook format');
    const activeSheet=Array.isArray(workbook.sheets)?(workbook.sheets.find(sheet=>sheet.id===workbook.activeSheetId)||workbook.sheets[0]):null;
    const payload=activeSheet||workbook;if(!Array.isArray(payload.cells))throw new TypeError('Workbook sheet must contain a cells array');
    this._recordHistory();if(replace){this.cells=new Map();this.sqlBinding=null}
    const dims=payload.dimensions||workbook.dimensions;
    if(replace){this.sheetName=payload.name||'Sheet1';this.freezePanes={rows:0,columns:0,...payload.freezePanes};this.conditionalFormats=structuredClone(payload.conditionalFormats||[]);this.table=payload.table?{...payload.table}:null;this.columnFilters=new Map((payload.filters||[]).map(item=>[Number(item.column),new Set((item.values||[]).map(String))]))}
    if(replace&&dimensions&&dims&&startRow===0&&startCol===0){
      this.rowCount=Math.max(1,Math.trunc(Number(dims.rows)||1));this.colCount=Math.max(1,Math.trunc(Number(dims.columns)||1));
      this.rowHeights=Array.from({length:this.rowCount},(_,i)=>clamp(Number(dims.rowHeights?.[i])||this.options.rowHeight,18,400));
      this.colWidths=Array.from({length:this.colCount},(_,i)=>clamp(Number(dims.columnWidths?.[i])||this.options.columnWidth,36,800));
      this.hiddenRows=new Set((dims.hiddenRows||[]).map(Number).filter(i=>Number.isInteger(i)&&i>=0&&i<this.rowCount));
      this.hiddenColumns=new Set((dims.hiddenColumns||[]).map(Number).filter(i=>Number.isInteger(i)&&i>=0&&i<this.colCount));
    }else if(replace){this.hiddenRows.clear();this.hiddenColumns.clear()}
    if(replace&&(payload.variables||workbook.variables)&&typeof (payload.variables||workbook.variables)==='object')this.variables=new Map(Object.entries(fromPortableValue(payload.variables||workbook.variables)));
    for(const source of payload.cells){if(!source||!Number.isInteger(source.row)||!Number.isInteger(source.col)||source.row<0||source.col<0)continue;const row=startRow+source.row,col=startCol+source.col,meta={};let hasValue=false,value;
      if(formulas&&typeof source.formula==='string'){value=source.formula;hasValue=true;if(startRow||startCol)value=this.shiftFormula(value,startRow,startCol)}else if(values&&Object.hasOwn(source,'value')){value=fromPortableValue(source.value);hasValue=true}
      if(formatting){if(Object.hasOwn(source,'numberFormat'))meta.numberFormat=source.numberFormat;if(source.style&&typeof source.style==='object')meta.style={...source.style};if(typeof source.className==='string')meta.className=source.className}
      if(hasValue||Object.keys(meta).length)this.cells.set(this.key(row,col),{...(this.cells.get(this.key(row,col))||{}),...meta,...(hasValue?{raw:value}:{})});
      this.ensureSize(row+1,col+1);
    }
    this.anchor={row:clamp(this.anchor.row,0,this.rowCount-1),col:clamp(this.anchor.col,0,this.colCount-1)};this.selection={r1:clamp(this.selection.r1,0,this.rowCount-1),c1:clamp(this.selection.c1,0,this.colCount-1),r2:clamp(this.selection.r2,0,this.rowCount-1),c2:clamp(this.selection.c2,0,this.colCount-1)};this.engine.clearCache();this._updateFilteredRows();this.render();this.emit('change',{type:'workbookimport',cells:payload.cells.length});return {cells:payload.cells.length,rows:this.rowCount,columns:this.colCount};
  }
  importJSON(input,options={}){
    const data=typeof input==='string'?JSON.parse(input):input;
    if(data?.format==='tinyDatagrid-workbook')return this.importWorkbook(data,options);
    if(!Array.isArray(data))throw new TypeError('JSON import expects an array');
    if(!data.length)return {rows:0,headers:[]};
    if(Array.isArray(data[0])){if(options.replace)return {rows:this._importMatrix(data,{startRow:options.startRow||0,startCol:options.startCol||0,replace:true}),headers:[]};this.load(data,options.startRow||0,options.startCol||0);return {rows:data.length,headers:[]}}
    if(options.replace){const headers=options.headers||Object.keys(data[0]||{});const rows=[...(options.includeHeaders===false?[]:[headers]),...data.map(record=>headers.map(header=>Object.hasOwn(record||{},header)?record[header]:''))];return {rows:this._importMatrix(rows,{startRow:options.startRow||0,startCol:options.startCol||0,replace:true}),headers}}
    return this.loadRecords(data,options);
  }
  formatSelection(format){
    const s=this.selection,r1=Math.min(s.r1,s.r2),r2=Math.max(s.r1,s.r2),c1=Math.min(s.c1,s.c2),c2=Math.max(s.c1,s.c2);
    this._recordHistory();
    for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++){const cell=this.getCell(r,c);this.cells.set(this.key(r,c),{...cell,numberFormat:format||null})}
    this.renderCells();this.emit('format',{range:{r1,c1,r2,c2},format:format||null});
  }
  createTable(range=this.getUsedRange(),{headerRow=range.r1,style='banded'}={}){
    const normalized={r1:clamp(Math.min(range.r1,range.r2),0,this.rowCount-1),c1:clamp(Math.min(range.c1,range.c2),0,this.colCount-1),r2:clamp(Math.max(range.r1,range.r2),0,this.rowCount-1),c2:clamp(Math.max(range.c1,range.c2),0,this.colCount-1)};
    headerRow=clamp(headerRow,normalized.r1,normalized.r2);this._recordHistory();this.table={...normalized,headerRow,style};this.columnFilters.clear();this._updateFilteredRows();this.render();this.emit('table',{...this.table});return this;
  }
  removeTable(){if(!this.table)return false;this._recordHistory();this.table=null;this.columnFilters.clear();this.filteredRows.clear();this.render();this.emit('table',{removed:true});return true}
  _updateFilteredRows(){
    this.filteredRows.clear();if(!this.table)return;
    const {r1,r2,headerRow,c1,c2}=this.table;
    for(let row=headerRow+1;row<=r2;row++){
      for(const [col,allowed] of this.columnFilters){if(col<c1||col>c2)continue;const value=String(this.getComputedValue(row,col)??'');if(!allowed.has(value)){this.filteredRows.add(row);break}}
    }
  }
  setColumnFilter(col,values){if(!this.table||col<this.table.c1||col>this.table.c2)return false;this._recordHistory();if(values==null)this.columnFilters.delete(col);else this.columnFilters.set(col,new Set([...values].map(String)));this._updateFilteredRows();this.layout();this.emit('filter',{column:col,values:values==null?null:[...this.columnFilters.get(col)],rows:[...this.filteredRows]});return true}
  clearFilters(){if(!this.columnFilters.size)return false;this._recordHistory();this.columnFilters.clear();this._updateFilteredRows();this.layout();this.emit('filter',{clear:true,rows:[]});return true}
  sortTable(col,direction='asc'){
    if(!this.table||(this.readOnly&&!this.sqlBinding)||col<this.table.c1||col>this.table.c2)return false;
    const {headerRow,r2,c1,c2}=this.table,rows=[];for(let row=headerRow+1;row<=r2;row++){const values=[];for(let c=c1;c<=c2;c++)values.push({...this.getCell(row,c)});rows.push({values,row,height:this.rowHeights[row],hidden:this.hiddenRows.has(row),sqlId:this.sqlBinding?.sqlRowIds.get(row),value:this.getComputedValue(row,col)})}
    const sign=direction==='desc'?-1:1;rows.sort((a,b)=>{const x=a.value,y=b.value;if(x==null||x==='')return y==null||y===''?a.row-b.row:1;if(y==null||y==='')return -1;if(typeof x==='number'&&typeof y==='number')return (x-y)*sign;return String(x).localeCompare(String(y),undefined,{numeric:true,sensitivity:'base'})*sign||a.row-b.row});
    this._recordHistory();const sortedSqlRows=this.sqlBinding?new Map([...this.sqlBinding.sqlRowIds].filter(([row])=>row<=headerRow||row>r2)):null;rows.forEach((item,index)=>{const row=headerRow+1+index;for(let c=c1;c<=c2;c++){const cell={...item.values[c-c1]},raw=cell.raw;if(typeof raw==='string'&&raw.startsWith('='))cell.raw=this.shiftFormula(raw,row-item.row,0);if(cell.raw===''&&!cell.style&&!cell.numberFormat&&!cell.className)this.cells.delete(this.key(row,c));else this.cells.set(this.key(row,c),cell)}this.rowHeights[row]=item.height;this.hiddenRows.delete(row);if(item.hidden)this.hiddenRows.add(row);if(sortedSqlRows&&item.sqlId)sortedSqlRows.set(row,item.sqlId)});if(sortedSqlRows)this.sqlBinding.sqlRowIds=sortedSqlRows;
    this.engine.clearCache();this._updateFilteredRows();this.render();this.emit('sort',{column:col,direction});return true;
  }
  toRecords({headerRow=this.table?.headerRow??0,startRow=headerRow+1,endRow=this.table?.r2??this.rowCount-1,startCol=this.table?.c1??0,endCol=this.table?.c2??this.colCount-1,visibleOnly=false}={}){
    const headers=[];for(let c=startCol;c<=endCol;c++)headers.push(String(this.getComputedValue(headerRow,c)||colToName(c)));
    const out=[];for(let r=startRow;r<=endRow;r++){if(visibleOnly&&(this.hiddenRows.has(r)||this.filteredRows.has(r)))continue;const rec={};let nonEmpty=false;headers.forEach((h,i)=>{const v=this.getComputedValue(r,startCol+i);rec[h]=v;if(v!==''&&v!=null)nonEmpty=true});if(nonEmpty||this.sqlBinding?.sqlRowIds.has(r))out.push(rec)}return out;
  }
  pivot(config){const source={visibleOnly:Boolean(this.table),...(config.source||{})};return PivotEngine.pivot(this.toRecords(source),config)}
  setFreezePanes({rows=this.freezePanes.rows,columns=this.freezePanes.columns}={}){this.freezePanes={rows:clamp(Math.trunc(rows)||0,0,this.rowCount-1),columns:clamp(Math.trunc(columns)||0,0,this.colCount-1)};this.emit('freezepanes',{...this.freezePanes});return this}
  setConditionalFormats(rules=[]){if(!Array.isArray(rules))throw new TypeError('Conditional formatting rules must be an array');this.conditionalFormats=structuredClone(rules);this.emit('conditionalformats',{rules:this.conditionalFormats});return this}
  shiftFormula(formula,dr,dc){
    const strings=[];const masked=formula.replace(/"(?:""|[^"])*"/g,s=>{strings.push(s);return `\u0000${strings.length-1}\u0000`});
    return masked.replace(/(^|[^A-Z0-9_@])(\$?)([A-Z]+)(\$?)(\d+)(?![A-Z0-9_])/gi,(m,prefix,ac,col,ar,row)=>{const nc=ac?nameToCol(col):Math.max(0,nameToCol(col)+dc);const nr=ar?Number(row)-1:Math.max(0,Number(row)-1+dr);return `${prefix}${ac}${colToName(nc)}${ar}${nr+1}`}).replace(/\u0000(\d+)\u0000/g,(_,i)=>strings[Number(i)]);
  }
  _fillBounds(source,target){
    const src={r1:Math.min(source.r1,source.r2),c1:Math.min(source.c1,source.c2),r2:Math.max(source.r1,source.r2),c2:Math.max(source.c1,source.c2)};
    const dst={r1:Math.min(src.r1,target.r1,target.r2),c1:Math.min(src.c1,target.c1,target.c2),r2:Math.max(src.r2,target.r1,target.r2),c2:Math.max(src.c2,target.c1,target.c2)};
    return {src,dst,extendsRows:dst.r1<src.r1||dst.r2>src.r2,extendsColumns:dst.c1<src.c1||dst.c2>src.c2};
  }
  _canFill(source,target){
    if(this.readOnly)return false;
    if(!this.sqlBinding)return true;
    const {dst}=this._fillBounds(source,target);
    for(let row=dst.r1;row<=dst.r2;row++)for(let col=dst.c1;col<=dst.c2;col++)if(this.isCellReadOnly(row,col))return false;
    return true;
  }
  _ambiguousAutofill(source,target){
    const {src,dst,extendsRows,extendsColumns}=this._fillBounds(source,target);
    if(!extendsRows&&!extendsColumns)return null;
    const height=src.r2-src.r1+1,width=src.c2-src.c1+1;
    if(extendsRows){
      for(let col=src.c1;col<=src.c2;col++){
        const values=Array.from({length:height},(_,index)=>this.getRawValue(src.r1+index,col)),series=inferAutofillSeries(values);
        if(series.ambiguous)return {series,values,axis:'vertical',src,dst};
      }
    }else{
      for(let row=src.r1;row<=src.r2;row++){
        const values=Array.from({length:width},(_,index)=>this.getRawValue(row,src.c1+index)),series=inferAutofillSeries(values);
        if(series.ambiguous)return {series,values,axis:'horizontal',src,dst};
      }
    }
    return null;
  }
  _autofillPreview(series,mode,offsets){
    return offsets.map(offset=>{
      const item=mode==='repeat'?series.repeatAt(offset):series.valueAt(offset),value=item.value;
      return value instanceof Date?value.toLocaleDateString():String(value??'');
    }).join(', ');
  }
  _openAutofillMenu(source,target,ambiguity){
    this._autofillPending={source:{...source},target:{...target}};
    this.selection={...target};this.updateSelectionOverlay();
    const {src,dst,axis,series}=ambiguity,seedLength=axis==='vertical'?src.r2-src.r1+1:src.c2-src.c1+1;
    const positive=axis==='vertical'?dst.r2>src.r2:dst.c2>src.c2;
    const count=Math.min(2,axis==='vertical'?(positive?dst.r2-src.r2:src.r1-dst.r1):(positive?dst.c2-src.c2:src.c1-dst.c1));
    const offsets=Array.from({length:count},(_,index)=>positive?seedLength+index:-1-index);
    const menu=this.autofillMenu,title=document.createElement('div');title.className='tg-menu-title';title.textContent='Mehrere Fortsetzungen sind möglich';menu.replaceChildren(title);
    const choices=[['series',`Serie fortsetzen: ${this._autofillPreview(series,'series',offsets)}`],['repeat',`Muster wiederholen: ${this._autofillPreview(series,'repeat',offsets)}`]];
    for(const [mode,label] of choices){const button=document.createElement('button');button.type='button';button.className='tg-autofill-option';button.dataset.autofillMode=mode;button.textContent=label;menu.append(button)}
    menu.hidden=false;
    const root=this.el.getBoundingClientRect(),handle=this.fillHandle.getBoundingClientRect();let left=handle.left-root.left,top=handle.bottom-root.top+7;
    if(left+menu.offsetWidth>root.width)left=handle.right-root.left-menu.offsetWidth;
    if(top+menu.offsetHeight>root.height)top=handle.top-root.top-menu.offsetHeight-7;
    menu.style.left=clamp(left,0,Math.max(0,root.width-menu.offsetWidth))+'px';menu.style.top=clamp(top,0,Math.max(0,root.height-menu.offsetHeight))+'px';menu.querySelector('button')?.focus();
  }
  _closeAutofillMenu(restore=false){
    if(!this.autofillMenu||this.autofillMenu.hidden)return false;
    const pending=this._autofillPending;this._autofillPending=null;this.autofillMenu.hidden=true;
    if(restore&&pending){this.selection={...pending.source};this.anchor={row:this.selection.r1,col:this.selection.c1};this.updateSelectionOverlay()}
    return true;
  }
  _requestAutofill(source,target){
    if(!this._canFill(source,target))return false;
    const ambiguity=this._ambiguousAutofill(source,target);
    if(ambiguity){this._openAutofillMenu(source,target,ambiguity);return null}
    return this.fill(source,target,{mode:'series'});
  }
  _chooseAutofill(mode){
    const pending=this._autofillPending;if(!pending)return false;
    this._closeAutofillMenu();const filled=this.fill(pending.source,pending.target,{mode});
    this.selection={...(filled?pending.target:pending.source)};this.anchor={row:this.selection.r1,col:this.selection.c1};this.updateSelectionOverlay();this.el.focus();return filled;
  }
  fillDownToContiguousData(source=this.selection){
    if(this.readOnly)return false;
    const target=findAutofillExtent(source,{rowCount:this.rowCount,getValue:(row,col)=>this.getRawValue(row,col)});
    if(!target)return false;
    const result=this._requestAutofill(source,target);
    if(result===true){this.selection={...target};this.anchor={row:target.r1,col:target.c1};this.updateSelectionOverlay()}
    return result!==false;
  }
  fill(source,target,{mode='series'}={}){
    const {src,dst,extendsRows,extendsColumns}=this._fillBounds(source,target);
    if(!extendsRows&&!extendsColumns)return false;
    if(!this._canFill(source,target))return false;
    this._recordHistory();this.ensureSize(dst.r2+1,dst.c2+1);
    const h=src.r2-src.r1+1,w=src.c2-src.c1+1;
    const seriesCache=new Map();
    for(let r=dst.r1;r<=dst.r2;r++)for(let c=dst.c1;c<=dst.c2;c++){
      if(r>=src.r1&&r<=src.r2&&c>=src.c1&&c<=src.c2)continue;
      let sr,sc,raw;
      if(extendsRows){
        sc=src.c1+((c-src.c1)%w+w)%w;
        let series=seriesCache.get(`c${sc}`);if(!series){series=inferAutofillSeries(Array.from({length:h},(_,index)=>this.getRawValue(src.r1+index,sc)));seriesCache.set(`c${sc}`,series)}const item=mode==='repeat'?series.repeatAt(r-src.r1):series.valueAt(r-src.r1);
        sr=src.r1+item.sourceIndex;raw=item.value;
      }else{
        sr=src.r1+((r-src.r1)%h+h)%h;
        let series=seriesCache.get(`r${sr}`);if(!series){series=inferAutofillSeries(Array.from({length:w},(_,index)=>this.getRawValue(sr,src.c1+index)));seriesCache.set(`r${sr}`,series)}const item=mode==='repeat'?series.repeatAt(c-src.c1):series.valueAt(c-src.c1);
        sc=src.c1+item.sourceIndex;raw=item.value;
      }
      if(typeof raw==='string'&&raw.startsWith('='))raw=this.shiftFormula(raw,r-sr,c-sc);
      this.cells.set(this.key(r,c),{...this.getCell(sr,sc),raw});
    }
    this.engine.clearCache();this.render();this.emit('fill',{source:src,target:dst,direction:extendsRows?(extendsColumns?'both':'vertical'):'horizontal'});return true;
  }
  moveRange(source,destRow,destCol){
    this._recordHistory();
    const src={r1:Math.min(source.r1,source.r2),c1:Math.min(source.c1,source.c2),r2:Math.max(source.r1,source.r2),c2:Math.max(source.c1,source.c2)};
    this.ensureSize(destRow+(src.r2-src.r1)+1,destCol+(src.c2-src.c1)+1);
    const temp=[];for(let r=src.r1;r<=src.r2;r++)for(let c=src.c1;c<=src.c2;c++)temp.push([r-src.r1,c-src.c1,{...this.getCell(r,c)}]);
    for(let r=src.r1;r<=src.r2;r++)for(let c=src.c1;c<=src.c2;c++)this.cells.delete(this.key(r,c));
    temp.forEach(([dr,dc,cell])=>this.cells.set(this.key(destRow+dr,destCol+dc),cell));
    this.engine.clearCache();this.selection={r1:destRow,c1:destCol,r2:destRow+(src.r2-src.r1),c2:destCol+(src.c2-src.c1)};this.render();this.updateSelectionOverlay();this.emit('move',{source:src,destination:{row:destRow,col:destCol}});
  }
  build(){
    this.el.classList.add('tg-root'); this.el.tabIndex=0;this.el.setAttribute('aria-readonly',String(this.readOnly));if(this.readOnly)this.el.classList.add('tg-readonly');
    this.el.innerHTML=`<div class="tg-corner"></div><div class="tg-colheaders"></div><div class="tg-rowheaders"></div><div class="tg-scroll"><div class="tg-canvas"></div></div><div class="tg-selection"><div class="tg-fill-handle"></div></div><div class="tg-context-menu" role="menu" hidden></div><div class="tg-filter-menu" role="dialog" aria-label="Filter" hidden></div><div class="tg-autofill-menu" role="dialog" aria-label="Ausfüllmethode" hidden></div><input class="tg-editor" spellcheck="false"/>`;
    this.scroll=this.el.querySelector('.tg-scroll');this.canvas=this.el.querySelector('.tg-canvas');this.colHeaders=this.el.querySelector('.tg-colheaders');this.rowHeaders=this.el.querySelector('.tg-rowheaders');this.selectionEl=this.el.querySelector('.tg-selection');this.fillHandle=this.el.querySelector('.tg-fill-handle');this.fillHandle.setAttribute('role','button');this.fillHandle.setAttribute('tabindex','0');this.fillHandle.setAttribute('aria-label','Fill selected cells');this.fillHandle.title='Drag to fill or double-click to fill down';this.contextMenu=this.el.querySelector('.tg-context-menu');this.filterMenu=this.el.querySelector('.tg-filter-menu');this.autofillMenu=this.el.querySelector('.tg-autofill-menu');this.editor=this.el.querySelector('.tg-editor');this.editor.readOnly=this.readOnly;
  }
  _setColumnSelection(col){this.anchor={row:0,col};this.selection={r1:0,c1:col,r2:this.rowCount-1,c2:col};this.updateSelectionOverlay();this.emit('select',{...this.selection})}
  _setRowSelection(row){this.anchor={row,col:0};this.selection={r1:row,c1:0,r2:row,c2:this.colCount-1};this.updateSelectionOverlay();this.emit('select',{...this.selection})}
  _positionContextMenu(){const menu=this.contextMenu,root=this.el.getBoundingClientRect(),point=this._contextMenuPoint;menu.hidden=false;const width=menu.offsetWidth,height=menu.offsetHeight;menu.style.left=clamp(point.x-root.left,0,Math.max(0,root.width-width))+'px';menu.style.top=clamp(point.y-root.top,0,Math.max(0,root.height-height))+'px'}
  _renderAxisMenu(axis,index,sizeEditor=false){
    this._contextMenuAxis=axis;this._contextMenuIndex=index;const row=axis==='row',sizeName=row?'Zeilenhöhe':'Spaltenbreite',size=row?this.rowHeights[index]:this.colWidths[index],min=row?18:36,max=row?400:800;
    if(sizeEditor){this.contextMenu.innerHTML=`<div class="tg-menu-title">${sizeName}</div><form class="tg-width-form"><label for="tg-size-input">${row?'Höhe':'Breite'} (${min}–${max} px)</label><input id="tg-size-input" type="number" min="${min}" max="${max}" step="1" value="${Math.round(size)}"><div class="tg-menu-actions"><button type="button" data-action="back">Zurück</button><button type="submit">OK</button></div></form>`;this._positionContextMenu();const input=this.contextMenu.querySelector('input');input.focus();input.select();return}
    const items=row?[
      ['copy','Zeile kopieren'],['clear','Inhalte löschen'],
      ['insertBefore','Zeile darüber einfügen'],['insertAfter','Zeile darunter einfügen'],['delete','Zeile löschen'],
      ['size','Zeilenhöhe…'],['autoFit','Zeilenhöhe automatisch anpassen'],
      ['hide','Zeile ausblenden'],['showAll','Alle ausgeblendeten Zeilen einblenden']
    ]:[
      ['copy','Spalte kopieren'],['clear','Inhalte löschen'],
      ['insertBefore','Spalte links einfügen'],['insertAfter','Spalte rechts einfügen'],['delete','Spalte löschen'],
      ['size','Spaltenbreite…'],['autoFit','Spaltenbreite automatisch anpassen'],
      ['hide','Spalte ausblenden'],['showAll','Alle ausgeblendeten Spalten einblenden']
    ];
    this.contextMenu.replaceChildren();
    let visibleItems=this.readOnly?items.slice(0,1):items;if(this.sqlBinding&&!this.readOnly)visibleItems=row?items.filter(([action])=>['copy','clear','delete','size','autoFit','hide','showAll'].includes(action)):items.filter(([action])=>['copy','size','autoFit','hide','showAll'].includes(action));
    visibleItems.forEach(([action,label],itemIndex)=>{if([2,5,7].includes(itemIndex)){const separator=document.createElement('div');separator.className='tg-menu-separator';separator.setAttribute('role','separator');this.contextMenu.append(separator)}const button=document.createElement('button');button.type='button';button.className='tg-menu-item';button.setAttribute('role','menuitem');button.dataset.action=action;button.textContent=label;if(action==='delete'&&(row?this.rowCount:this.colCount)<=1)button.disabled=true;if(action==='hide'&&(row?this.hiddenRows.size>=this.rowCount-1:this.hiddenColumns.size>=this.colCount-1))button.disabled=true;if(action==='showAll'&&!(row?this.hiddenRows.size:this.hiddenColumns.size))button.disabled=true;this.contextMenu.append(button)});
    this._positionContextMenu();
  }
  _openColumnMenu(col,event){event.preventDefault();event.stopPropagation();this._setColumnSelection(col);this._contextMenuPoint={x:event.clientX,y:event.clientY};this._renderAxisMenu('column',col)}
  _openRowMenu(row,event){event.preventDefault();event.stopPropagation();this._setRowSelection(row);this._contextMenuPoint={x:event.clientX,y:event.clientY};this._renderAxisMenu('row',row)}
  _closeColumnMenu(){this.contextMenu.hidden=true;this.contextMenu.replaceChildren()}
  _handleAxisMenuAction(action){if(this.readOnly&&action!=='copy')return;const axis=this._contextMenuAxis,index=this._contextMenuIndex,row=axis==='row';if(this.sqlBinding&&!row&&['clear','insertBefore','insertAfter','delete'].includes(action))return;if(action==='size'){this._renderAxisMenu(axis,index,true);return}if(action==='back'){this._renderAxisMenu(axis,index);return}if(action==='copy'){const range=row?{r1:index,c1:0,r2:index,c2:this.colCount-1}:{r1:0,c1:index,r2:this.rowCount-1,c2:index};const text=this.toArray(range,false).map(values=>values.join('\t')).join('\n');navigator.clipboard?.writeText(text).catch(()=>{});this._closeColumnMenu();return}this._closeColumnMenu();if(action==='clear')row?this.clearRow(index):this.clearColumn(index);else if(action==='insertBefore')row?this.insertRow(index):this.insertColumn(index);else if(action==='insertAfter')row?this.insertRow(index+1):this.insertColumn(index+1);else if(action==='delete')row?this.deleteRow(index):this.deleteColumn(index);else if(action==='autoFit')row?this.autoFitRow(index):this.autoFitColumn(index);else if(action==='hide')row?this.hideRow(index):this.hideColumn(index);else if(action==='showAll')row?this.showAllRows():this.showAllColumns()}
  _openFilterMenu(col,trigger){
    if(!this.table||col<this.table.c1||col>this.table.c2)return;
    this._filterColumn=col;this._filterOptions=new Map();for(let row=this.table.headerRow+1;row<=this.table.r2;row++){const value=String(this.getComputedValue(row,col)??'');this._filterOptions.set(value,(this._filterOptions.get(value)||0)+1)}
    const active=this.columnFilters.get(col),menu=this.filterMenu;menu.replaceChildren();
    const title=document.createElement('div');title.className='tg-filter-title';title.textContent=String(this.getComputedValue(this.table.headerRow,col)||colToName(col));menu.append(title);
    if(!this.readOnly||this.sqlBinding){for(const [direction,label] of [['asc','Aufsteigend sortieren'],['desc','Absteigend sortieren']]){const button=document.createElement('button');button.type='button';button.className='tg-menu-item';button.dataset.sort=direction;button.textContent=label;menu.append(button)}const separator=document.createElement('div');separator.className='tg-menu-separator';menu.append(separator)}
    const search=document.createElement('input');search.type='search';search.className='tg-filter-search';search.placeholder='Suchen';search.setAttribute('aria-label','Filterwerte suchen');menu.append(search);
    const options=document.createElement('div');options.className='tg-filter-options';options.dataset.filterOptions='';
    const all=document.createElement('label');all.className='tg-filter-option';const allBox=document.createElement('input');allBox.type='checkbox';allBox.dataset.selectAll='';allBox.checked=!active||active.size===this._filterOptions.size;all.append(allBox,document.createTextNode(' (Alle auswählen)'));options.append(all);
    for(const [value,count] of this._filterOptions){const label=document.createElement('label');label.className='tg-filter-option';label.dataset.search=value.toLocaleLowerCase();const box=document.createElement('input');box.type='checkbox';box.dataset.filterValue=value;box.checked=!active||active.has(value);const text=document.createElement('span');text.textContent=value||'(Leer)';const amount=document.createElement('small');amount.textContent=String(count);label.append(box,text,amount);options.append(label)}menu.append(options);
    const actions=document.createElement('div');actions.className='tg-menu-actions';const clear=document.createElement('button');clear.type='button';clear.dataset.filterClear='';clear.textContent='Filter löschen';const apply=document.createElement('button');apply.type='button';apply.dataset.filterApply='';apply.textContent='Anwenden';actions.append(clear,apply);menu.append(actions);
    const root=this.el.getBoundingClientRect(),rect=trigger.getBoundingClientRect();menu.hidden=false;menu.style.left=clamp(rect.left-root.left,0,Math.max(0,root.width-menu.offsetWidth))+'px';menu.style.top=clamp(rect.bottom-root.top,0,Math.max(0,root.height-menu.offsetHeight))+'px';
  }
  _closeFilterMenu(){this.filterMenu.hidden=true;this.filterMenu.replaceChildren()}
  _handleFilterMenuClick(event){const button=event.target.closest('button');if(!button)return;const col=this._filterColumn;if(button.dataset.sort){this._closeFilterMenu();this.sortTable(col,button.dataset.sort)}else if(button.hasAttribute('data-filter-clear')){this.setColumnFilter(col,null);this._closeFilterMenu()}else if(button.hasAttribute('data-filter-apply')){const checked=[...this.filterMenu.querySelectorAll('[data-filter-value]:checked')].map(input=>input.dataset.filterValue);this.setColumnFilter(col,checked.length===this._filterOptions.size?null:checked);this._closeFilterMenu()}}
  offsets(arr){const out=[0];for(let i=0;i<arr.length;i++)out.push(out[i]+arr[i]);return out}
  _visibleRange(offsets,count,scrollPosition,viewportSize,fallbackSize){
    if(!count)return {start:0,end:0};
    const size=viewportSize||fallbackSize,first=Math.min(count-1,Math.max(0,upperBound(offsets,Math.max(0,scrollPosition))-1)),last=upperBound(offsets,Math.max(0,scrollPosition)+size);
    return {start:Math.max(0,first-this.virtualizationOverscan),end:Math.min(count,Math.max(first+1,last)+this.virtualizationOverscan)};
  }
  _scheduleVirtualRender(){
    if(!this.virtualization||this._virtualFrame!=null||this._destroyed)return;
    if(typeof globalThis.requestAnimationFrame!=='function'){this.renderHeaders();this.renderCells();this.syncHeaders();this.updateSelectionOverlay();return}
    this._virtualFrame=globalThis.requestAnimationFrame(()=>{this._virtualFrame=null;if(this._destroyed||!this.virtualization)return;this.renderHeaders();this.renderCells();this.syncHeaders();this.updateSelectionOverlay()});
  }
  layout(){
    this._updateFilteredRows();this.displayColWidths=this.colWidths.map((width,col)=>this.hiddenColumns.has(col)?0:width);this.displayRowHeights=this.rowHeights.map((height,row)=>this.hiddenRows.has(row)||this.filteredRows.has(row)?0:height);this.colOffsets=this.offsets(this.displayColWidths);this.rowOffsets=this.offsets(this.displayRowHeights);const W=this.colOffsets.at(-1),H=this.rowOffsets.at(-1);
    this.canvas.style.width=W+'px';this.canvas.style.height=H+'px';
    this.renderHeaders();this.renderCells();this.syncHeaders();this.updateSelectionOverlay();
  }
  render(){this.layout()}
  renderHeaders(){
    this.colHeaders.innerHTML='';this.rowHeaders.innerHTML='';
    const cols=this.virtualization?this._visibleRange(this.colOffsets,this.colCount,this.scroll.scrollLeft,this.scroll.clientWidth,this.options.columnWidth*10):{start:0,end:this.colCount};
    const rows=this.virtualization?this._visibleRange(this.rowOffsets,this.rowCount,this.scroll.scrollTop,this.scroll.clientHeight,this.options.rowHeight*20):{start:0,end:this.rowCount};
    for(let c=cols.start;c<cols.end;c++){if(this.virtualization&&!this.displayColWidths[c])continue;const h=document.createElement('div');h.className='tg-colhead';h.textContent=colToName(c);h.style.left=this.colOffsets[c]+'px';h.style.width=this.displayColWidths[c]+'px';h.dataset.col=c;if(this.hiddenColumns.has(c))h.classList.add('tg-hidden-column');const rz=document.createElement('span');rz.className='tg-resize-x';h.append(rz);this.colHeaders.append(h)}
    for(let r=rows.start;r<rows.end;r++){if(this.virtualization&&!this.displayRowHeights[r])continue;const h=document.createElement('div');h.className='tg-rowhead';h.textContent=String(r+1);h.style.top=this.rowOffsets[r]+'px';h.style.height=this.displayRowHeights[r]+'px';h.dataset.row=r;if(this.hiddenRows.has(r)||this.filteredRows.has(r))h.classList.add('tg-hidden-row');const rz=document.createElement('span');rz.className='tg-resize-y';h.append(rz);this.rowHeaders.append(h)}
  }
  syncHeaders(){
    const sx=this.scroll?.scrollLeft||0, sy=this.scroll?.scrollTop||0;
    this.colHeaders.querySelectorAll('.tg-colhead').forEach(h=>{const c=+h.dataset.col;h.style.left=(this.colOffsets[c]-sx)+'px'});
    this.rowHeaders.querySelectorAll('.tg-rowhead').forEach(h=>{const r=+h.dataset.row;h.style.top=(this.rowOffsets[r]-sy)+'px'});
  }
  renderCells(){
    this.canvas.innerHTML='';const frag=document.createDocumentFragment();
    const rows=this.virtualization?this._visibleRange(this.rowOffsets,this.rowCount,this.scroll.scrollTop,this.scroll.clientHeight,this.options.rowHeight*20):{start:0,end:this.rowCount};
    const cols=this.virtualization?this._visibleRange(this.colOffsets,this.colCount,this.scroll.scrollLeft,this.scroll.clientWidth,this.options.columnWidth*10):{start:0,end:this.colCount};
    for(let r=rows.start;r<rows.end;r++)for(let c=cols.start;c<cols.end;c++){
      if(this.virtualization&&(!this.displayRowHeights[r]||!this.displayColWidths[c]))continue;
      const d=document.createElement('div');d.className='tg-cell';d.dataset.row=r;d.dataset.col=c;d.draggable=false;d.style.left=this.colOffsets[c]+'px';d.style.top=this.rowOffsets[r]+'px';d.style.width=this.displayColWidths[c]+'px';d.style.height=this.displayRowHeights[r]+'px';if(this.hiddenColumns.has(c))d.classList.add('tg-hidden-column');if(this.hiddenRows.has(r)||this.filteredRows.has(r))d.classList.add('tg-hidden-row');
      const v=this.getComputedValue(r,c);const meta=this.getCell(r,c);
      if(this.table&&r===this.table.headerRow&&c>=this.table.c1&&c<=this.table.c2){d.classList.add('tg-table-header');const label=document.createElement('span');label.className='tg-table-header-label';label.textContent=this.formatValue(v,meta.numberFormat);const trigger=document.createElement('button');trigger.type='button';trigger.className='tg-filter-trigger';trigger.dataset.filterColumn=c;trigger.setAttribute('aria-label',`Filter ${label.textContent}`);trigger.textContent=this.columnFilters.has(c)?'▾•':'▾';d.append(label,trigger)}else d.textContent=this.formatValue(v,meta.numberFormat);
      if(typeof v==='number')d.classList.add('tg-number');if(meta.numberFormat==='currency'||meta.numberFormat?.type==='currency')d.classList.add('tg-currency');if(meta.className)d.classList.add(meta.className);if(meta.style)Object.assign(d.style,meta.style);if(this.table&&this.table.style==='banded'&&r>this.table.headerRow&&(r-this.table.headerRow)%2===0)d.classList.add('tg-table-banded');frag.append(d);
    }
    this.canvas.append(frag);this.updateSelectionOverlay();
  }
  formatValue(value,format){
    if(value instanceof Date)return value.toLocaleString();
    if(value instanceof ArrayBuffer||ArrayBuffer.isView(value))return `[Binary ${value.byteLength} bytes]`;
    if(value&&typeof value==='object')return JSON.stringify(value);
    if(typeof value!=='number'||!Number.isFinite(value)||!format)return String(value??'');
    const config=typeof format==='string'?{type:format}:format;
    if(config.type==='currency')return new Intl.NumberFormat(config.locale,{style:'currency',currency:config.currency||'EUR',maximumFractionDigits:config.maximumFractionDigits??2}).format(value);
    if(config.type==='percent')return new Intl.NumberFormat(config.locale,{style:'percent',maximumFractionDigits:config.maximumFractionDigits??1}).format(value);
    if(config.type==='number')return new Intl.NumberFormat(config.locale,{maximumFractionDigits:config.maximumFractionDigits??2}).format(value);
    return String(value);
  }
  getCellAtClient(x,y){
    const rect=this.scroll.getBoundingClientRect();const px=x-rect.left+this.scroll.scrollLeft,py=y-rect.top+this.scroll.scrollTop;
    const find=(offs,p)=>{let lo=0,hi=offs.length-2;while(lo<=hi){const m=(lo+hi)>>1;if(p<offs[m])hi=m-1;else if(p>=offs[m+1])lo=m+1;else return m}return clamp(lo,0,offs.length-2)};
    return {row:find(this.rowOffsets,py),col:find(this.colOffsets,px)};
  }
  updateSelectionOverlay(){
    if(!this.colOffsets)return;const s=this.selection;const r1=Math.min(s.r1,s.r2),r2=Math.max(s.r1,s.r2),c1=Math.min(s.c1,s.c2),c2=Math.max(s.c1,s.c2);
    const sr=this.scroll.getBoundingClientRect(),root=this.el.getBoundingClientRect();const left=this.options.headerWidth + this.colOffsets[c1]-this.scroll.scrollLeft;const top=this.options.headerHeight + this.rowOffsets[r1]-this.scroll.scrollTop;
    this.selectionEl.style.left=left+'px';this.selectionEl.style.top=top+'px';this.selectionEl.style.width=(this.colOffsets[c2+1]-this.colOffsets[c1])+'px';this.selectionEl.style.height=(this.rowOffsets[r2+1]-this.rowOffsets[r1])+'px';
    this.selectionEl.style.display=this.colOffsets[c2+1]===this.colOffsets[c1]||this.rowOffsets[r2+1]===this.rowOffsets[r1]?'none':'block';
  }
  select(row,col,extend=false){
    row=clamp(row,0,this.rowCount-1);col=clamp(col,0,this.colCount-1);
    if(extend)this.selection={r1:this.anchor.row,c1:this.anchor.col,r2:row,c2:col};else{this.anchor={row,col};this.selection={r1:row,c1:col,r2:row,c2:col}}
    this.scrollToCell(row,col);this.updateSelectionOverlay();this.emit('select',{...this.selection});
  }
  goTo(row,col){const grew=this.ensureSize(row+1,col+1);if(grew)this.render();this.select(row,col);this.scrollToCell(row,col);return this}
  scrollToCell(row,col){
    const top=this.rowOffsets[row]||0,bottom=this.rowOffsets[row+1]??top,left=this.colOffsets[col]||0,right=this.colOffsets[col+1]??left;
    if(top<this.scroll.scrollTop)this.scroll.scrollTop=top;else if(bottom>this.scroll.scrollTop+this.scroll.clientHeight)this.scroll.scrollTop=bottom-this.scroll.clientHeight;
    if(left<this.scroll.scrollLeft)this.scroll.scrollLeft=left;else if(right>this.scroll.scrollLeft+this.scroll.clientWidth)this.scroll.scrollLeft=right-this.scroll.clientWidth;
  }
  edit(row=this.selection.r2,col=this.selection.c2,initial=null){
    if(this.isCellReadOnly(row,col))return false;
    const left=this.options.headerWidth+this.colOffsets[col]-this.scroll.scrollLeft,top=this.options.headerHeight+this.rowOffsets[row]-this.scroll.scrollTop;
    this.editor.style.left=left+'px';this.editor.style.top=top+'px';this.editor.style.width=this.displayColWidths[col]+'px';this.editor.style.height=this.displayRowHeights[row]+'px';this.editor.value=initial??this.getRawValue(row,col);this.editor.style.display='block';this.editor.focus();this.editor.select();this._editing={row,col};
  }
  commitEdit(cancel=false){if(!this._editing)return;if(!cancel&&!this.isCellReadOnly(this._editing.row,this._editing.col)){const {row,col}=this._editing;this.setCell(row,col,this.editor.value)}this._editing=null;this.editor.style.display='none';this.el.focus()}
  copySelection(){return this.toArray(this.selection,false).map(r=>r.join('\t')).join('\n')}
  pasteText(text,start=this.anchor){if(this.readOnly)return false;const rows=text.replace(/\r/g,'').split('\n').map(r=>r.split('\t'));if(this.sqlBinding&&rows.some((row,dr)=>row.some((_,dc)=>this.isCellReadOnly(start.row+dr,start.col+dc))))return false;this._recordHistory();rows.forEach((rr,dr)=>rr.forEach((v,dc)=>this.cells.set(this.key(start.row+dr,start.col+dc),{raw:this._coerceSQLValue(start.col+dc,v)})));this.ensureSize(start.row+rows.length,start.col+Math.max(...rows.map(r=>r.length)));this.engine.clearCache();this.render();return true}
  bind(){
    this._syncVirtualizationObserver();
    if(typeof globalThis.addEventListener==='function')this._listen(globalThis,'resize',()=>this._scheduleVirtualRender());
    this._listen(this.scroll,'scroll',()=>{this.syncHeaders();this.updateSelectionOverlay();this._scheduleVirtualRender();this._closeColumnMenu();this._closeFilterMenu();this._closeAutofillMenu(true);this.emit('scroll',{scrollTop:this.scroll.scrollTop,clientHeight:this.scroll.clientHeight,scrollHeight:this.scroll.scrollHeight,remaining:Math.max(0,this.scroll.scrollHeight-this.scroll.scrollTop-this.scroll.clientHeight)})});
    this._listen(document,'pointerdown',e=>{if(!this.autofillMenu.hidden&&!this.el.contains(e.target))this._closeAutofillMenu(true)});
    this._listen(this.colHeaders,'contextmenu',e=>{const h=e.target.closest('.tg-colhead');if(h&&!e.target.classList.contains('tg-resize-x'))this._openColumnMenu(+h.dataset.col,e)});
    this._listen(this.el,'pointerdown',e=>{if(!this.contextMenu.hidden&&!this.contextMenu.contains(e.target))this._closeColumnMenu();if(!this.filterMenu.hidden&&!this.filterMenu.contains(e.target)&&!e.target.closest('.tg-filter-trigger'))this._closeFilterMenu();if(!this.autofillMenu.hidden&&!this.autofillMenu.contains(e.target))this._closeAutofillMenu(true)});
    this._listen(this.rowHeaders,'contextmenu',e=>{const h=e.target.closest('.tg-rowhead');if(h&&!e.target.classList.contains('tg-resize-y'))this._openRowMenu(+h.dataset.row,e)});
    this._listen(this.contextMenu,'click',e=>{const button=e.target.closest('[data-action]');if(button&&!button.disabled)this._handleAxisMenuAction(button.dataset.action)});
    this._listen(this.contextMenu,'submit',e=>{if(!e.target.matches('.tg-width-form'))return;e.preventDefault();const input=e.target.querySelector('input'),size=Number(input.value),row=this._contextMenuAxis==='row',min=row?18:36,max=row?400:800;if(!Number.isFinite(size)||size<min||size>max){input.reportValidity();return}const index=this._contextMenuIndex;this._recordHistory();row?this.setRowHeight(index,size):this.setColumnWidth(index,size);this._closeColumnMenu()});
    this._listen(this.contextMenu,'keydown',e=>{if(e.key==='Escape'){e.preventDefault();this._renderAxisMenu(this._contextMenuAxis,this._contextMenuIndex);this.contextMenu.querySelector('[data-action="size"]')?.focus()}});
    this._listen(this.filterMenu,'click',e=>this._handleFilterMenuClick(e));
    this._listen(this.autofillMenu,'click',e=>{const button=e.target.closest('[data-autofill-mode]');if(button)this._chooseAutofill(button.dataset.autofillMode)});
    this._listen(this.autofillMenu,'keydown',e=>{if(e.key==='Escape'){e.preventDefault();this._closeAutofillMenu(true);this.fillHandle.focus()}});
    this._listen(this.autofillMenu,'focusout',e=>{if(!this.autofillMenu.hidden&&!this.autofillMenu.contains(e.relatedTarget))this._closeAutofillMenu(true)});
    const filterInput=e=>{if(e.target.matches('.tg-filter-search')){const query=e.target.value.toLocaleLowerCase();this.filterMenu.querySelectorAll('[data-filter-value]').forEach(box=>{box.closest('.tg-filter-option').hidden=!box.dataset.filterValue.toLocaleLowerCase().includes(query)})}else if(e.target.matches('[data-select-all]'))this.filterMenu.querySelectorAll('[data-filter-value]').forEach(box=>{if(!box.closest('.tg-filter-option').hidden)box.checked=e.target.checked})};this._listen(this.filterMenu,'input',filterInput);this._listen(this.filterMenu,'change',filterInput);
    this._listen(this.canvas,'click',e=>{const trigger=e.target.closest('.tg-filter-trigger');if(trigger){e.preventDefault();e.stopPropagation();this._openFilterMenu(+trigger.dataset.filterColumn,trigger)}});
    this._listen(this.canvas,'pointerdown',e=>{if(e.button!==0||e.target.closest('.tg-filter-trigger'))return;const cell=e.target.closest('.tg-cell');if(!cell)return;this.el.focus();const row=+cell.dataset.row,col=+cell.dataset.col;this.select(row,col,e.shiftKey);this._selectDrag={pointerId:e.pointerId};this.canvas.setPointerCapture(e.pointerId);e.preventDefault()});
    this._listen(this.canvas,'pointermove',e=>{if(!this._selectDrag||e.pointerId!==this._selectDrag.pointerId)return;const p=this.getCellAtClient(e.clientX,e.clientY);this.select(p.row,p.col,true)});
    this._listen(this.canvas,'pointerup',e=>{if(this._selectDrag?.pointerId===e.pointerId)this._selectDrag=null});
    this._listen(this.canvas,'pointercancel',e=>{if(this._selectDrag?.pointerId===e.pointerId)this._selectDrag=null});
    this._listen(this.canvas,'dblclick',e=>{const cell=e.target.closest('.tg-cell');if(cell)this.edit(+cell.dataset.row,+cell.dataset.col)});
    this._listen(this.fillHandle,'dblclick',e=>{e.preventDefault();e.stopPropagation();this.fillDownToContiguousData()});
    this._listen(this.fillHandle,'keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;e.preventDefault();e.stopPropagation();this.fillDownToContiguousData()});
    this._listen(this.fillHandle,'pointerdown',e=>{if(this.readOnly)return;e.preventDefault();e.stopPropagation();this._fillState={source:{...this.selection},target:{...this.selection}};this.fillHandle.setPointerCapture(e.pointerId)});
    this._listen(this.fillHandle,'pointermove',e=>{if(!this._fillState)return;const p=this.getCellAtClient(e.clientX,e.clientY);this._fillState.target={r1:Math.min(this._fillState.source.r1,p.row),c1:Math.min(this._fillState.source.c1,p.col),r2:Math.max(this._fillState.source.r2,p.row),c2:Math.max(this._fillState.source.c2,p.col)};this.selection={...this._fillState.target};this.updateSelectionOverlay()});
    this._listen(this.fillHandle,'pointerup',e=>{if(!this._fillState)return;const {source,target}=this._fillState;this._fillState=null;const result=this._requestAutofill(source,target);if(result!==null){this.selection={...(result?target:source)};this.anchor={row:this.selection.r1,col:this.selection.c1};this.updateSelectionOverlay()}});
    this._listen(this.fillHandle,'pointercancel',()=>{if(!this._fillState)return;this.selection={...this._fillState.source};this._fillState=null;this.updateSelectionOverlay()});
    const resize=(axis)=>e=>{if(this.readOnly)return;e.preventDefault();e.stopPropagation();const head=e.target.parentElement;const idx=+(axis==='x'?head.dataset.col:head.dataset.row);const start=axis==='x'?e.clientX:e.clientY;const size=axis==='x'?this.colWidths[idx]:this.rowHeights[idx];const move=ev=>{if(this.readOnly)return;const d=(axis==='x'?ev.clientX:ev.clientY)-start;axis==='x'?this.setColumnWidth(idx,size+d):this.setRowHeight(idx,size+d)};const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)};window.addEventListener('pointermove',move,{signal:this._abort.signal});window.addEventListener('pointerup',up,{signal:this._abort.signal})};
    this._listen(this.colHeaders,'pointerdown',e=>{if(e.target.classList.contains('tg-resize-x'))resize('x')(e);else{const h=e.target.closest('.tg-colhead');if(h)this._setColumnSelection(+h.dataset.col)}});
    this._listen(this.rowHeaders,'pointerdown',e=>{if(e.target.classList.contains('tg-resize-y'))resize('y')(e);else{const h=e.target.closest('.tg-rowhead');if(h)this._setRowSelection(+h.dataset.row)}});
    this._listen(this.editor,'keydown',e=>{if(e.key==='Enter'){e.preventDefault();this.commitEdit();this.select(Math.min(this.rowCount-1,this.anchor.row+1),this.anchor.col)}else if(e.key==='Escape'){e.preventDefault();this.commitEdit(true)}else if(e.key==='Tab'){e.preventDefault();this.commitEdit();this.select(this.anchor.row,Math.min(this.colCount-1,this.anchor.col+(e.shiftKey?-1:1)))}});
    this._listen(this.editor,'blur',()=>this.commitEdit());
    this._listen(this.el,'keydown',async e=>{if(e.key==='Escape'&&!this.autofillMenu.hidden){e.preventDefault();this._closeAutofillMenu(true);return}if(e.key==='Escape'&&!this.filterMenu.hidden){e.preventDefault();this._closeFilterMenu();return}if(e.key==='Escape'&&!this.contextMenu.hidden){this._closeColumnMenu();return}if(this.contextMenu.contains(e.target)||this.filterMenu.contains(e.target)||this.autofillMenu.contains(e.target)||this._editing)return;const a=this.anchor;
      if(this.readOnly&&(['Enter','F2','Backspace','Delete'].includes(e.key)||((e.metaKey||e.ctrlKey)&&['z','y','v'].includes(e.key.toLowerCase()))||(e.key.length===1&&!e.metaKey&&!e.ctrlKey&&!e.altKey))){e.preventDefault();return}
      if(e.key==='Enter'||e.key==='F2'){e.preventDefault();this.edit();return}
      if(e.key==='Backspace'||e.key==='Delete'){e.preventDefault();const s=this.selection;if(this.sqlBinding){for(let r=Math.min(s.r1,s.r2);r<=Math.max(s.r1,s.r2);r++)for(let c=Math.min(s.c1,s.c2);c<=Math.max(s.c1,s.c2);c++)if(this.isCellReadOnly(r,c))return}this._recordHistory();for(let r=Math.min(s.r1,s.r2);r<=Math.max(s.r1,s.r2);r++)for(let c=Math.min(s.c1,s.c2);c<=Math.max(s.c1,s.c2);c++)this.cells.set(this.key(r,c),{...this.getCell(r,c),raw:''});this.engine.clearCache();this.renderCells();return}
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?this.redo():this.undo();return}
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='y'){e.preventDefault();this.redo();return}
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='c'){e.preventDefault();await navigator.clipboard?.writeText(this.copySelection());return}
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='v'){e.preventDefault();const t=await navigator.clipboard?.readText?.();if(t!=null)this.pasteText(t,a);return}
      const arrows={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]};if(arrows[e.key]){e.preventDefault();const [dr,dc]=arrows[e.key];this.select(a.row+dr,a.col+dc,e.shiftKey);if(!e.shiftKey)this.anchor={row:clamp(a.row+dr,0,this.rowCount-1),col:clamp(a.col+dc,0,this.colCount-1)};return}
      if(e.key.length===1&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault();this.edit(a.row,a.col,e.key)}
    });
  }
}

// Keep the original named export available for existing integrations.
export { TinyDatagrid as TinyGrid };
export default TinyDatagrid;
