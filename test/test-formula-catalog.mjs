import assert from 'node:assert/strict';
import TinyDatagrid, { FormulaEngine } from '../src/tinygrid.js';
import { formulaCatalog, formulaLanguages, formulaDefinition, resolveFormulaName, localizedFormulaName } from '../src/formula-catalog.js';
import { functionHelp } from '../src/function-help.js';
import { formulaNames, searchFormulaNames, analyzeFormula } from '../src/formula-assist.js';
import { references } from '../src/references.js';
const engine=new FormulaEngine({variables:new Map(),getComputedValue:r=>[2,3][r]??''});
const f=text=>engine.evaluateFormula(text);
const special=new Set(['LET','LAMBDA']);
for(const id of Object.keys(engine.functions))assert.equal(formulaDefinition(id)?.id,id,`Undocumented implementation: ${id}`);
let aliases=0;
for(const record of formulaCatalog){
  if(record.availability==='core'&&!special.has(record.id))assert.equal(typeof engine.functions[record.id],'function',record.id);
  for(const language of formulaLanguages)assert.ok(record.names[language],`${record.id}/${language}`);
  const sentinel=`operation:${record.id}`;engine.registerFunction(record.id,()=>sentinel);
  for(const alias of record.aliases){
    assert.equal(resolveFormulaName(alias),record.id);assert.equal(f(`=${alias.toLowerCase()}()`),sentinel,alias);
    const plain=alias.normalize('NFD').replace(/\p{M}/gu,'');assert.equal(f(`=${plain}()`),sentinel,plain);
    assert.equal(f(`=${alias.normalize('NFD')}()`),sentinel,`NFD: ${alias}`);
    assert.equal(functionHelp(alias,'de').name,alias);aliases++;
  }
  assert.equal(engine.unregisterFunction(record.names.it),true);
}
for(const language of formulaLanguages){
  const name=id=>localizedFormulaName(id,language);
  assert.equal(f(`=${name('SUM')}(A1:A2)`),5);
  assert.equal(f(`=${name('IF')}(${name('TRUE')};42;1/0)`),42);
  assert.equal(f(`=${name('IFERROR')}(1/0;7)`),7);
  assert.equal(f(`=${name('AND')}(${name('FALSE')};1/0)`),false);
  assert.equal(f(`=${name('SWITCH')}(1;1;42;2;1/0)`),42);
  assert.deepEqual(f(`=${name('UPPER')}(${name('SPLIT')}("a,b";","))`),[['A','B']]);
  assert.equal(f(`=${name('LET')}(amount;4;${name('SUM')}(amount;2))`),6);
  assert.deepEqual(f(`=${name('MAP')}(${name('SEQUENCE')}(2);${name('LAMBDA')}(item;item*2))`),[[2],[4]]);
  assert.equal(f(`=${name('YEAR')}(${name('DATE')}(15;1;2))`),15);
  assert.equal(f(`=${name('COLOR.MIX')}("#000";"#fff")`),'#808080');
  assert.match(f(`=${name('WEB.GET')}("https://example.com")`),/^#NAME\?/);
  const names=formulaNames({engine},language);assert.equal(names.filter(n=>resolveFormulaName(n)==='SUM').length,1);assert.ok(!names.some(n=>resolveFormulaName(n).startsWith('WEB.')));
}
assert.deepEqual(searchFormulaNames({engine},'moyenne','de').filter(name=>resolveFormulaName(name)==='AVERAGE'),['MITTELWERT']);
assert.ok(searchFormulaNames({engine},'repeter','fr').includes('RÉPÉTER'));
assert.ok(searchFormulaNames({engine},'color.green','de').includes('FARBE.GRÜN'));
assert.equal(f('=SOMME(SUMME(1;2);SOMMA(3;4))'),10);
assert.equal(f('=CONCAT("SUMME; ANNÉE; DATA";"!" )'),'SUMME; ANNÉE; DATA!');
assert.equal(f('=DATE.ISO(DATUM.ADDIEREN("2024-02-29";1;"Jahr"))'),'2025-02-28');
assert.equal(f('=DATE.ISO(DATE.AJOUTER("2024-02-29";1;"année"))'),'2025-02-28');
assert.equal(f('=DATE.ISO(DATA.AGGIUNGI("2024-02-29";1;"anno"))'),'2025-02-28');
assert.equal(f('=TIME.FORMAT(HEURE.AJOUTER("23:30";90;"minutes"))'),'01:00:00');
assert.equal(f('=DATE.DIFF("2026-03-28";"2026-03-30";"Tage")'),2);
assert.equal(f('=DAYS("2026-03-30";"2026-03-28")'),2);
assert.equal(f('=DATE(2026;2;30)'),'#VALUE!');assert.equal(f('=DATEVALUE("02/03/2026")'),'#VALUE!');
assert.deepEqual(f('=DATE.ISO(DATE.SEQUENCE("2024-01-31";3;"mois"))'),[['2024-01-31'],['2024-02-29'],['2024-03-31']]);
assert.deepEqual(f('=DATE.ISO(DATE.SEQUENCE("2026-03-28";3;"giorni"))'),[['2026-03-28'],['2026-03-29'],['2026-03-30']]);
assert.equal(f('=DATE.SEQUENCE("2024-01-01";100001)'),'#NUM!');
engine.registerFunction('MITTELWERT',()=>123);assert.equal(f('=AVG(1;2)'),123);assert.equal(engine.functions.MEDIA,engine.functions.AVERAGE);engine.unregisterFunction('MOYENNE');assert.equal(f('=MEDIA(1;2)'),1.5);
assert.throws(()=>engine.registerFunctions({SUM:()=>1,SOMME:()=>2}),/Duplicate/);assert.equal(f('=SUM(1;2)'),3);
engine.registerFunction('APP.ÉCHO',value=>value);assert.equal(f('=app.écho(3)'),3);
assert.equal(analyzeFormula('=RÉPÉTER("a";2)',9)?.call,'RÉPÉTER');
assert.equal(functionHelp('COUNTIF').signature,'COUNTIF(range; criteria)');
assert.equal(functionHelp('SI','fr').signature,'SI(condition; yes; no=false)');
assert.equal(functionHelp('SUMME','de',{SUM:{de:'Custom sum'}}).description,'Custom sum');
assert.deepEqual(references('=SOMME(ÉA1;A1;"A2")').map(ref=>ref.text),['A1']);
assert.equal(TinyDatagrid.prototype.shiftFormula('=SOMME(ÉA1;A1;"A2")',1,0),'=SOMME(ÉA1;A2;"A2")');
console.log(`Formula catalog: ${formulaCatalog.length} definitions and ${aliases} aliases passed, including lazy evaluation and calendar semantics`);
