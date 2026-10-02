import assert from 'node:assert/strict';
import TinyDatagrid, { FormulaEngine } from '../src/tinygrid.js';

const input = new Map([['0,0','  MARCH1  '], ['1,0',3], ['2,0',4]]);
const engine = new FormulaEngine({variables:new Map(),getComputedValue:(r,c)=>input.get(`${r},${c}`)??''});
engine.registerFunctions({
  '=LTRIM': value=>String(value??'').trimStart(),
  'math.total': rows=>rows.flat().reduce((sum,value)=>sum+value,0),
  LABEL: (value,prefix='gene:')=>prefix+value,
  F1: value=>value*2
});
assert.equal(engine.evaluateFormula('=ltrim(A1)'), 'MARCH1  ');
assert.equal(engine.evaluateFormula('=LABEL(LTRIM(A1); "symbol:")'), 'symbol:MARCH1  ');
assert.equal(engine.evaluateFormula('=MATH.TOTAL(A2:A3)'), 7);
assert.equal(engine.evaluateFormula('=F1(5)'), 10);
assert.equal(engine.evaluateFormula('=LTRIM("  🧬  ")'), '🧬  ');
assert.equal(engine.evaluateFormula('=SUM(MATH.TOTAL(A2:A3),1)'), 8);
assert.equal(new FormulaEngine({variables:new Map()}).evaluateFormula('=LABEL("x"; "prefix:")'), '#NAME? LABEL');
assert.throws(()=>engine.registerFunctions({VALID:()=>1,INVALID:'return 2'}), TypeError);
assert.equal(engine.evaluateFormula('=VALID()'), '#NAME? VALID');
assert.throws(()=>engine.registerFunctions({'a':()=>1,'=A':()=>2}), TypeError);
assert.throws(()=>engine.registerFunction(null,()=>1), TypeError);
assert.throws(()=>engine.registerFunction('NO SPACES',()=>1), TypeError);
engine.registerFunction('FAIL',()=>{throw new Error('domain error');});
assert.equal(engine.evaluateFormula('=FAIL()'), '#ERROR! domain error');
let called=false;
engine.registerFunction('CHECK',value=>{called=true;return value;});
assert.equal(engine.evaluateFormula('=CHECK(1/0)'), '#DIV/0!');assert.equal(called,false);
engine.registerFunction('LATER',async()=>{throw new Error('async unsupported');});
assert.equal(engine.evaluateFormula('=LATER()'), '#ERROR! Custom formula functions must return synchronously');
engine.registerFunction('AVERAGE',()=>Promise.resolve(3));
assert.equal(engine.evaluateFormula('=AVG(1,2)'), '#ERROR! Custom formula functions must return synchronously');
engine.unregisterFunction('AVERAGE');
engine.registerFunction('SUM',(...args)=>args.length);
assert.equal(engine.evaluateFormula('=SUM(10,20)'), 2);
assert.equal(engine.unregisterFunction('=sum'), true);
assert.equal(engine.evaluateFormula('=SUM(10,20)'), 30);
assert.equal(engine.unregisterFunction('SUM'), false);
engine.registerFunction('IF',(...args)=>args.join('|'));
assert.equal(engine.evaluateFormula('=IF(TRUE,"yes","no")'), 'true|yes|no');
engine.unregisterFunction('IF');
assert.equal(engine.evaluateFormula('=IF(TRUE,"yes",1/0)'), 'yes');

// Exercise the public grid APIs with the real data/formula/history model, without DOM rendering.
class ModelGrid extends TinyDatagrid {
  build(){}
  bind(){}
  setLocale(locale){this.locale=locale;return this;}
  render(){this._updateFilteredRows();}
  renderCells(){}
  layout(){this._updateFilteredRows();}
  emit(){}
}
const grid=new ModelGrid({}, {rows:5,columns:3,functions:{'=SCALE':value=>value*2}});
grid.load([[5,'=SCALE(A1)','=B1+1']]);
assert.equal(grid.getComputedValue(0,2),11);
grid.registerFunction('scale',value=>value*3);
assert.equal(grid.getComputedValue(0,2),16, 'Replacing a function invalidates dependent-cell caches');
assert.equal(grid.unregisterFunction('scale'),true);
assert.equal(grid.getComputedValue(0,2),'#NAME? SCALE');
assert.equal(grid.unregisterFunction('scale'),false);
grid.registerFunctions({SCALE:value=>value*4});
assert.equal(grid.getComputedValue(0,2),21);
assert.equal(grid.shiftFormula('=F1(A1)+math.F2(A2)+"A3"',1,0),'=F1(A2)+math.F2(A3)+"A3"');
const filtered=new ModelGrid({}, {rows:3,columns:1,functions:{VALUE_OF:()=>1}});
filtered.load([['value'],['=VALUE_OF()']]);filtered.createTable({r1:0,c1:0,r2:1,c2:0});filtered.setColumnFilter(0,['1']);
assert.equal(filtered.filteredRows.size,0);
filtered.registerFunction('VALUE_OF',()=>2);
assert.ok(filtered.filteredRows.has(1),'Function updates refresh active filters');
const workbook=JSON.stringify(grid.exportWorkbook());
assert.ok(!workbook.includes('value=>'), 'Workbooks contain data, not executable callback source');
const restored=new ModelGrid({}, {rows:5,columns:3});
restored.importWorkbook(workbook);
assert.equal(restored.getComputedValue(0,1),'#NAME? SCALE');
restored.registerFunction('SCALE',value=>value*4);
assert.equal(restored.getComputedValue(0,2),21);

const identifiers=new ModelGrid({}, {rows:4,columns:3});
identifiers.importCSV('gene_symbol,date,amount\n2310009E13,2026-09-28,3\nMARCH1,2024-02-29,4',{delimiter:',',locale:'en-US'});
assert.equal(identifiers.getComputedValue(1,0),'2310009E13');
assert.equal(identifiers.getComputedValue(2,0),'MARCH1');
assert.ok(identifiers.getComputedValue(1,1) instanceof Date);
assert.equal(identifiers.getComputedValue(1,2),3);
restored.importShareHash(new URL(identifiers.createShareURL('https://example.test/demo/')).hash);
assert.equal(restored.getComputedValue(1,0),'2310009E13');
identifiers.importCSV('symbol\n2310009E13',{inferTypes:false,replace:true});
assert.equal(identifiers.getComputedValue(1,0),'2310009E13');
console.log('Custom function and typed import tests passed');
