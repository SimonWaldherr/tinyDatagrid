const sheet="(?:'(?:''|[^'])*'|[A-Za-z_][A-Za-z0-9_.]*)";
const address='\\$?[A-Za-z]+\\$?[1-9][0-9]*';
const pattern=new RegExp(`"(?:""|[^"])*"|(?<![A-Za-z0-9_@.$])(?:(?<sheet>${sheet})\\s*!\\s*)?(?<a>${address})(?:\\s*:\\s*(?:(?<endSheet>${sheet})\\s*!\\s*)?(?<b>${address}))?(?![A-Za-z0-9_.]|\\s*\\()`, 'g');
const unquote=name=>name?.startsWith("'")?name.slice(1,-1).replaceAll("''", "'"):name;
const cell=text=>{const m=/^(\$?)([A-Za-z]+)(\$?)(\d+)$/.exec(text);let c=0;for(const char of m[2].toUpperCase())c=c*26+char.charCodeAt(0)-64;return {row:+m[4]-1,col:c-1,ac:m[1],ar:m[3]}};
function addressOf(p){let n=p.col+1,name='';while(n){name=String.fromCharCode(65+(n-1)%26)+name;n=Math.floor((n-1)/26)}return `${p.ac||''}${name}${p.ar||''}${p.row+1}`}
export function references(formula){
  if(typeof formula!=='string'||!formula.startsWith('='))return [];
  return [...formula.matchAll(pattern)].filter(m=>m.groups?.a).map(m=>({start:m.index,end:m.index+m[0].length,text:m[0],sheet:unquote(m.groups.sheet),sheetText:m.groups.sheet,endSheet:unquote(m.groups.endSheet),endSheetText:m.groups.endSheet,a:cell(m.groups.a),b:cell(m.groups.b||m.groups.a),range:Boolean(m.groups.b)}));
}
const within=(p,r)=>p.row>=r.r1&&p.row<=r.r2&&p.col>=r.c1&&p.col<=r.c2;
export function followsMove(formula,{source,rowDelta,colDelta,ownerId,movedId,resolve}){
  const refs=references(formula);let output=formula;
  for(const ref of refs.reverse()){
    if((ref.sheet?resolve(ref.sheet):ownerId)!==movedId)continue;
    if(ref.endSheet&&resolve(ref.endSheet)!==movedId)continue;
    const shifted=p=>within(p,source)?{...p,row:p.row+rowDelta,col:p.col+colDelta}:p;
    const prefix=ref.sheetText?ref.sheetText+'!':'';
    const r={r1:Math.min(ref.a.row,ref.b.row),r2:Math.max(ref.a.row,ref.b.row),c1:Math.min(ref.a.col,ref.b.col),c2:Math.max(ref.a.col,ref.b.col)};
    if(r.r2<source.r1||r.r1>source.r2||r.c2<source.c1||r.c1>source.c2)continue;
    let replacement;
    if(!ref.range)replacement=prefix+addressOf(shifted(ref.a));
    else if(within(ref.a,source)&&within(ref.b,source))replacement=prefix+addressOf(shifted(ref.a))+':'+(ref.endSheetText?ref.endSheetText+'!':'')+addressOf(shifted(ref.b));
    else {
      if((r.r2-r.r1+1)*(r.c2-r.c1+1)>10000)throw new RangeError('Partially moved ranges may contain at most 10,000 cells');
      const rows=[];
      for(let row=r.r1;row<=r.r2;row++){const cells=[];for(let col=r.c1;col<=r.c2;col++)cells.push(prefix+addressOf(shifted({row,col,ar:ref.a.ar,ac:ref.a.ac})));rows.push(`HSTACK(${cells.join(';')})`)}
      replacement=`VSTACK(${rows.join(';')})`;
    }
    output=output.slice(0,ref.start)+replacement+output.slice(ref.end);
  }
  return output;
}
export function containsReference(ref,row,col){return row>=Math.min(ref.a.row,ref.b.row)&&row<=Math.max(ref.a.row,ref.b.row)&&col>=Math.min(ref.a.col,ref.b.col)&&col<=Math.max(ref.a.col,ref.b.col)}
