import { FormulaError } from './formula-errors.js';
// Exact base-10 values for money and decimal arithmetic. Never infer a rounded
// binary Number from a longer source value. Instances are immutable/portable.
const MAX_DIGITS=4096, MAX_SCALE=1000;
const pow10=scale=>{if(!Number.isSafeInteger(scale)||Math.abs(scale)>MAX_SCALE)throw new RangeError('Decimal scale outside range');return 10n**BigInt(scale);};
function integer(value){if(typeof value!=='number'||!Number.isSafeInteger(value))throw new TypeError('Expected integer');return value;}
export class DecimalValue {
  constructor(coefficient,scale=0){
    coefficient=BigInt(coefficient);scale=integer(scale);if(scale<0||scale>MAX_SCALE||coefficient.toString().length>MAX_DIGITS)throw new RangeError('Decimal outside supported range');
    while(scale&&coefficient%10n===0n){coefficient/=10n;scale--;}
    this.coefficient=coefficient;this.scale=scale;Object.freeze(this);
  }
  static parse(value){
    if(value instanceof DecimalValue)return value;
    if(typeof value==='number'&&(!Number.isFinite(value)||Number.isInteger(value)&&!Number.isSafeInteger(value)))throw new RangeError('Unsafe Number cannot be repaired');
    if(!['number','bigint','string'].includes(typeof value))throw new TypeError('Expected decimal value');
    const text=String(value);if(text.length>MAX_DIGITS)throw new RangeError('Decimal too long');
    const match=/^([+-]?)(\d+(?:\.\d*)?|\.\d+)(?:[eE]([+-]?\d+))?$/.exec(text);
    if(!match)throw new TypeError('Expected unambiguous decimal with decimal point');
    const [,sign,mantissa,exponent='0']=match;let scale=(mantissa.split('.')[1]?.length??0)-Number(exponent);
    if(!Number.isSafeInteger(scale)||Math.abs(scale)>MAX_SCALE)throw new RangeError('Decimal exponent outside range');
    let coefficient=BigInt((sign==='-'?'-':'')+mantissa.replace('.',''));if(scale<0){coefficient*=pow10(-scale);scale=0;}
    return new DecimalValue(coefficient,scale);
  }
  toString(){const negative=this.coefficient<0n,digits=(negative?-this.coefficient:this.coefficient).toString().padStart(this.scale+1,'0');return `${negative?'-':''}${this.scale?digits.slice(0,-this.scale)+'.'+digits.slice(-this.scale):digits}`;}
  toJSON(){return {$tinyDatagridType:'decimal',value:this.toString()};}
  toNumber(){const result=Number(this.toString());if(!Number.isFinite(result)||Number.isInteger(result)&&!Number.isSafeInteger(result)||compareDecimals(this,DecimalValue.parse(result))!==0)throw new RangeError('Decimal conversion would lose precision');return result;}
  [Symbol.toPrimitive](hint){return hint==='number'?this.toNumber():this.toString();}
}
function align(a,b){a=DecimalValue.parse(a);b=DecimalValue.parse(b);const scale=Math.max(a.scale,b.scale);return [a.coefficient*pow10(scale-a.scale),b.coefficient*pow10(scale-b.scale),scale];}
export function compareDecimals(a,b){const [x,y]=align(a,b);return x<y?-1:x>y?1:0;}
export function decimalOperation(op,a,b){
  a=DecimalValue.parse(a);b=DecimalValue.parse(b);
  if(op==='*')return new DecimalValue(a.coefficient*b.coefficient,a.scale+b.scale);
  const [x,y,scale]=align(a,b);
  if(op==='+')return new DecimalValue(x+y,scale);
  if(op==='-')return new DecimalValue(x-y,scale);
  if(op==='%'){if(y===0n)throw new RangeError('Division by zero');return new DecimalValue(x%y,scale);}
  throw new TypeError('Unknown decimal operation');
}
export function roundDecimal(value,digits=0,mode='half-up'){
  value=DecimalValue.parse(value);digits=integer(digits);if(Math.abs(digits)>MAX_SCALE)throw new RangeError('Decimal scale outside range');
  if(!['half-up','half-even','toward-zero','away-zero'].includes(mode))throw new TypeError('Unknown rounding mode');
  if(digits>=value.scale)return value;
  const divisor=pow10(value.scale-digits),negative=value.coefficient<0n,absolute=negative?-value.coefficient:value.coefficient;
  let coefficient=absolute/divisor;const rest=absolute%divisor;
  if(mode==='away-zero'&&rest||mode==='half-up'&&rest*2n>=divisor||mode==='half-even'&&(rest*2n>divisor||rest*2n===divisor&&coefficient%2n===1n))coefficient++;
  if(negative)coefficient=-coefficient;
  return digits<0?new DecimalValue(coefficient*pow10(-digits),0):new DecimalValue(coefficient,digits);
}
export function divideDecimal(a,b,digits=18,mode='half-up'){
  a=DecimalValue.parse(a);b=DecimalValue.parse(b);digits=integer(digits);if(digits<0||digits>MAX_SCALE)throw new RangeError('Decimal scale outside range');
  if(!['half-up','half-even','toward-zero','away-zero'].includes(mode))throw new TypeError('Unknown rounding mode');
  if(b.coefficient===0n)throw new RangeError('Division by zero');
  let numerator=a.coefficient,denominator=b.coefficient;const shift=digits+b.scale-a.scale;
  if(shift>=0)numerator*=pow10(shift);else denominator*=pow10(-shift);
  const negative=(numerator<0n)!==(denominator<0n);numerator=numerator<0n?-numerator:numerator;denominator=denominator<0n?-denominator:denominator;
  let quotient=numerator/denominator;const rest=numerator%denominator;
  if(mode==='away-zero'&&rest||mode==='half-up'&&rest*2n>=denominator||mode==='half-even'&&(rest*2n>denominator||rest*2n===denominator&&quotient%2n===1n))quotient++;
  return new DecimalValue(negative?-quotient:quotient,digits);
}
// Ordinary arithmetic uses exact decimal operations on canonical numeric input.
// Ordinary repeating division remains an approximate Number; DECIMAL.DIVIDE
// explicitly controls its number of places and rounding rule.
export function compactDecimal(value){value=DecimalValue.parse(value);if(value.scale===0){const n=value.coefficient;return n<=BigInt(Number.MAX_SAFE_INTEGER)&&n>=BigInt(Number.MIN_SAFE_INTEGER)?Number(n):n;}try{return value.toNumber();}catch{return value;}}
export function formatDecimal(value,format,locale='en'){
  const config=typeof format==='string'?{type:format}:format;
  if(!config||!['number','currency','percent'].includes(config.type))return String(value);
  let n=DecimalValue.parse(value);if(config.type==='percent')n=decimalOperation('*',n,100);
  const digits=config.maximumFractionDigits??(config.type==='currency'?2:config.type==='percent'?1:2),minimum=config.minimumFractionDigits??(config.type==='currency'?2:0);
  if(!Number.isSafeInteger(minimum)||minimum<0||minimum>digits)throw new RangeError('Invalid display precision');
  n=roundDecimal(n,digits);const text=n.toString(),negative=text.startsWith('-'),[whole,fraction='']=text.replace(/^-/,'').split('.');
  const lang=config.locale||locale,decimal=new Intl.NumberFormat(lang).formatToParts(1.1).find(p=>p.type==='decimal')?.value||'.';
  const grouped=new Intl.NumberFormat(lang,{maximumFractionDigits:0}).format(BigInt(whole));
  let formatted=grouped+(fraction||minimum?decimal+fraction.padEnd(minimum,'0'):'');
  if(config.type==='currency'||config.type==='percent'){
    const options=config.type==='currency'?{style:'currency',currency:config.currency||'EUR'}:{style:'percent'};
    const parts=new Intl.NumberFormat(lang,options).formatToParts(negative?-1:1);let emitted=false;
    formatted=parts.map(part=>{if(['integer','group','decimal','fraction'].includes(part.type)){if(emitted)return '';emitted=true;return formatted;}return part.value;}).join('');
  }else if(negative)formatted='-'+formatted;
  return formatted;
}
export function createDecimalFunctions(){
  const checked=(min,max,fn)=>(...args)=>{if(args.length<min||args.length>max)return new FormulaError('#VALUE!');try{return fn(...args);}catch(error){return error instanceof RangeError?new FormulaError('#NUM!'):new FormulaError('#VALUE!');}};
  return {
    'DECIMAL.PARSE':checked(1,1,DecimalValue.parse),
    'DECIMAL.ADD':checked(2,2,(a,b)=>decimalOperation('+',a,b)),
    'DECIMAL.SUBTRACT':checked(2,2,(a,b)=>decimalOperation('-',a,b)),
    'DECIMAL.MULTIPLY':checked(2,2,(a,b)=>decimalOperation('*',a,b)),
    'DECIMAL.DIVIDE':checked(2,4,(a,b,digits=18,mode='half-up')=>DecimalValue.parse(b).coefficient===0n?new FormulaError('#DIV/0!'):divideDecimal(a,b,digits,mode)),
    'DECIMAL.ROUND':checked(1,3,roundDecimal),
    'DECIMAL.FORMAT':checked(1,1,value=>DecimalValue.parse(value).toString()),
    'DECIMAL.NUMBER':checked(1,1,value=>DecimalValue.parse(value).toNumber())
  };
}
export function exactDivide(a,b){
  a=DecimalValue.parse(a);b=DecimalValue.parse(b);if(b.coefficient===0n)throw new RangeError('Division by zero');
  let numerator=a.coefficient*pow10(b.scale),denominator=b.coefficient*pow10(a.scale);
  const gcd=(x,y)=>{x=x<0n?-x:x;y=y<0n?-y:y;while(y)[x,y]=[y,x%y];return x;};
  const divisor=gcd(numerator,denominator);numerator/=divisor;denominator/=divisor;
  if(denominator<0n){numerator=-numerator;denominator=-denominator;}
  let twos=0,fives=0;while(denominator%2n===0n){denominator/=2n;twos++;}while(denominator%5n===0n){denominator/=5n;fives++;}
  if(denominator!==1n)throw new RangeError('Repeating decimal: use DECIMAL.DIVIDE with explicit precision');
  const scale=Math.max(twos,fives);return new DecimalValue(numerator*2n**BigInt(scale-twos)*5n**BigInt(scale-fives),scale);
}
