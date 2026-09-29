// Optional UI/data features. Import only the factories your host needs.
import { parseJSONText, isJSONContainer, JSONValue, jsonType } from './json-values.js';
const styleKeys=new Set(['backgroundColor','color','fontWeight','fontStyle','textDecoration','textAlign']);
const operators=new Set(['eq','ne','gt','gte','lt','lte','between','contains','empty','notEmpty']);
// JSON validation accepts objects/arrays and text that parses to one; kind narrows it to object or array.
function isJSONData(value,kind){
  let data=value instanceof JSONValue?value.value:value;
  if(typeof data==='string'){try{data=parseJSONText(data)}catch{return false}}
  return isJSONContainer(data)&&(kind==null||jsonType(data)===kind);
}
const inRange=(r,c,range)=>r>=range.r1&&r<=range.r2&&c>=range.c1&&c<=range.c2;
function ranges(rules){
  if(!Array.isArray(rules))throw new TypeError('Rules must be an array');
  for(const rule of rules){const r=rule?.range;if(!r||!['r1','r2','c1','c2'].every(k=>Number.isInteger(r[k])&&r[k]>=0)||r.r1>r.r2||r.c1>r.c2)throw new TypeError('Invalid rule range')}
}
function matches(value,rule){
  const other=rule.value;
  switch(rule.operator){
    case 'eq':return value===other;
    case 'ne':return value!==other;
    case 'empty':return value===''||value==null;
    case 'notEmpty':return value!==''&&value!=null;
    case 'contains':return String(value??'').includes(String(other??''));
    default:{if(value===''||value==null||!Number.isFinite(Number(value)))return false;const a=Number(value),b=Number(other);
      switch(rule.operator){case 'gt':return a>b;case 'gte':return a>=b;case 'lt':return a<b;case 'lte':return a<=b;case 'between':return a>=b&&a<=Number(rule.max)}
    }
  }
  return false;
}
export function conditionalFormatting(){return {name:'conditionalFormatting',setup(grid){
  const checkRules=rules=>{ranges(rules);for(const rule of rules){if(!operators.has(rule.operator))throw new TypeError('Invalid conditional operator');if(!rule.style||typeof rule.style!=='object'||Object.keys(rule.style).some(k=>!styleKeys.has(k)))throw new TypeError('Invalid conditional style')}};
  checkRules(grid.conditionalFormats);
  return {checkRules,cellStyle(row,col,value){const result={};for(const rule of grid.conditionalFormats){if(inRange(row,col,rule.range)&&matches(value,rule)){Object.assign(result,rule.style);if(rule.stopIfTrue)break}}return result}};
}}}
export function dataValidation(){return {name:'validation',setup(grid){
  const checkRules=rules=>{
    ranges(rules);
    for(const rule of rules){
      if(!['number','integer','list','textLength','json'].includes(rule.type))throw new TypeError('Invalid validation type');
      if(rule.type==='json'&&rule.kind!=null&&!['object','array'].includes(rule.kind))throw new TypeError('Invalid JSON kind');
      if(rule.type==='list'&&!Array.isArray(rule.values))throw new TypeError('List validation requires values');
      if(rule.min!=null&&!Number.isFinite(rule.min)||rule.max!=null&&!Number.isFinite(rule.max)||rule.min!=null&&rule.max!=null&&rule.min>rule.max)throw new TypeError('Invalid validation bounds');
    }
  };
  checkRules(grid.validationRules);
  return {checkRules,validate(row,col,value){
    for(const rule of grid.validationRules){
      if(!inRange(row,col,rule.range))continue;
      const empty=value===''||value==null;if(empty&&rule.allowEmpty!==false)continue;
      if(typeof value==='string'&&value.startsWith('=')&&rule.allowFormula===true)continue;
      let valid=!empty;
      if(rule.type==='json')valid&&=isJSONData(value,rule.kind);
      else if(rule.type==='list')valid&&=rule.values.some(item=>Object.is(item,value)||String(item)===String(value));
      else {const numeric=rule.type==='textLength'?Array.from(String(value??'')).length:typeof value==='number'||typeof value==='string'&&value.trim()!==''?Number(value):NaN;valid&&=Number.isFinite(numeric)&&(rule.type!=='integer'||Number.isInteger(numeric))&&(rule.min==null||numeric>=rule.min)&&(rule.max==null||numeric<=rule.max)}
      if(!valid)return rule.message||'Value does not satisfy the validation rule';
    }
    return null;
  }};
}}}
export function freezePanes(){return {name:'freezePanes',setup(){return {}}}}
