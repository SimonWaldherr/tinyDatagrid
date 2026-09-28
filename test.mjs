import assert from 'node:assert/strict';
import { FormulaEngine, PivotEngine, colToName, nameToCol, parseA1 } from './src/tinygrid.js';

assert.equal(colToName(0), 'A');
assert.equal(colToName(25), 'Z');
assert.equal(colToName(26), 'AA');
assert.equal(nameToCol('AA'), 26);
assert.deepEqual(parseA1('$C$12'), { row: 11, col: 2 });

const cells = new Map([
  ['0,0', 10], ['0,1', 20], ['1,0', 5], ['1,1', 2]
]);
const fake = {
  variables: new Map([['tax', .19]]),
  getComputedValue(r,c){ return cells.get(`${r},${c}`) ?? ''; }
};
const f = new FormulaEngine(fake);
assert.equal(f.evaluateFormula('=A1+B1'), 30);
assert.equal(f.evaluateFormula('=SUM(A1:B2)'), 37);
assert.ok(Math.abs(f.evaluateFormula('=A1*(1+@tax)') - 11.9) < 1e-12);
assert.equal(f.evaluateFormula('=IF(A1>B1,"x","y")'), 'y');
assert.equal(f.evaluateFormula('=2^3^2'), 512);

const records = [
  {Region:'N',Quarter:'Q1',Revenue:10},
  {Region:'N',Quarter:'Q1',Revenue:15},
  {Region:'N',Quarter:'Q2',Revenue:7},
  {Region:'S',Quarter:'Q1',Revenue:4}
];
const p = PivotEngine.pivot(records,{rows:['Region'],columns:['Quarter'],values:[{field:'Revenue',aggregate:'sum',as:'Revenue'}]});
assert.equal(p.matrix[0][0].Revenue, 25);
assert.equal(p.matrix[0][1].Revenue, 7);
assert.equal(p.matrix[1][0].Revenue, 4);
console.log('tinyDatagrid tests passed');
