import { lifeStep, mandelbrot, computeMandelbrot } from '../src/simulations.js';
import { drawHeatmap, heatmapRule } from '../src/heatmap.js';

export function installSimulations({grid,$,t,notify}) {
  grid.registerFunction('MANDELBROT',mandelbrot);
  const dialog=document.createElement('dialog');dialog.className='simulation-dialog';dialog.setAttribute('aria-labelledby','simulationTitle');
  dialog.innerHTML=`<div class="dialog-heading"><h2 id="simulationTitle"></h2><button type="button" data-action="close" data-i18n="close"></button></div>
    <p data-i18n="simulationHint"></p><div class="simulation-controls">
    <label><span data-i18n="speed"></span><input name="speed" type="range" min="1" max="20" value="5"></label>
    <label data-life><input name="wrap" type="checkbox"><span data-i18n="wrapEdges"></span></label>
    <label data-mandel>X<input name="x" type="number" step="0.05" value="-0.5"></label>
    <label data-mandel>Y<input name="y" type="number" step="0.05" value="0"></label>
    <label data-mandel><span data-i18n="span"></span><input name="span" type="number" min="0.000001" max="10" step="any" value="3.5"></label>
    <label data-mandel><span data-i18n="iterations"></span><input name="iterations" type="number" min="1" max="2000" step="1" value="200"></label>
    </div><div class="tool-row"><button data-action="run"></button><button data-action="step" data-i18n="singleStep" data-life></button><button data-action="reset" data-i18n="reset"></button><button data-action="cancel" data-i18n="cancel"></button></div>
    <p id="simulationKeyboard" data-i18n="simulationKeyboard"></p><canvas tabindex="0" role="img" aria-describedby="simulationKeyboard"></canvas>
    <progress max="1" value="0"></progress><output aria-live="polite"></output>
    <div class="tool-row"><label data-mandel><input name="formulas" type="checkbox"><span data-i18n="simulationFormulas"></span></label><button data-action="insert" data-i18n="simulationInsert"></button></div>`;
  document.body.append(dialog);
  const q=s=>dialog.querySelector(s),input=name=>q(`[name="${name}"]`),button=name=>q(`[data-action="${name}"]`),canvas=q('canvas');
  let kind='life',rows=48,columns=64,values=new Uint8Array(rows*columns),generation=0,timer=null,job=null,ready=false,cursor=0,parameters=null,opener;
  const scale=()=>({min:0,max:kind==='life'?1:parameters?.iterations||200,colors:kind==='life'?['#141a30','#8ea2ff']:['#141a30','#778cff','#ffe7a3','#141a30']});
  function labels(){q('#simulationTitle').textContent=kind==='life'?'Conway’s Game of Life':'Mandelbrot';button('run').textContent=t(kind==='life'?(timer?'pause':'start'):'calculate');button('insert').disabled=!ready||!!job||grid.readOnly;button('step').disabled=!!timer;button('cancel').disabled=!timer&&!job;q('progress').setAttribute('aria-label',t('progress'));canvas.setAttribute('aria-label',`${q('#simulationTitle').textContent} · ${rows} × ${columns}`);}
  function paint(){drawHeatmap(canvas,values,rows,columns,scale());if(kind==='life'&&document.activeElement===canvas){const ctx=canvas.getContext('2d');ctx.strokeStyle='#ffffff';ctx.lineWidth=.2;ctx.strokeRect(cursor%columns+.1,Math.floor(cursor/columns)+.1,.8,.8);}q('output').textContent=kind==='life'?`${t('generation')} ${generation} · ${values.reduce((n,v)=>n+v,0)} ${t('livingCells')}`:`${columns} × ${rows} · ${parameters?.iterations||200} ${t('iterations')}`;labels();}
  function pause(){clearTimeout(timer);timer=null;labels();}
  function cancel(){pause();job?.abort();job=null;labels();}
  function step(){values=lifeStep(values,rows,columns,{wrap:input('wrap').checked});generation++;ready=true;paint();}
  function tick(){step();timer=setTimeout(tick,1000/Number(input('speed').value));labels();}
  function reset(){cancel();generation=0;cursor=0;ready=kind==='life';rows=kind==='life'?48:96;columns=kind==='life'?64:128;values=new Uint8Array(rows*columns);if(kind==='life'){for(const [r,c] of [[1,2],[2,3],[3,1],[3,2],[3,3]])values[r*columns+c]=1;}else{input('x').value='-0.5';input('y').value='0';input('span').value='3.5';input('iterations').value='200';parameters=null;}q('progress').value=0;paint();}
  async function calculate(){
    cancel();for(const name of ['x','y','span','iterations'])if(!input(name).reportValidity())return;
    const options={rows,columns,centerX:Number(input('x').value),centerY:Number(input('y').value),span:Number(input('span').value),iterations:Number(input('iterations').value)};
    const controller=new AbortController();job=controller;ready=false;q('progress').value=0;labels();
    try{const result=await computeMandelbrot(options,{signal:controller.signal,onProgress:value=>{q('progress').value=value}});if(job!==controller)return;values=result;parameters=options;ready=true;q('progress').value=1;paint();}
    catch(error){if(error.name!=='AbortError')notify(error.message)}finally{if(job===controller){job=null;labels()}}
  }
  for(const name of ['x','y','span','iterations'])input(name).oninput=()=>{cancel();ready=false;labels()};
  button('run').onclick=()=>kind==='life'?(timer?pause():tick()):calculate();button('step').onclick=step;button('reset').onclick=reset;button('cancel').onclick=cancel;
  button('close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{cancel();opener?.isConnected&&opener.focus()});
  const stopOnBackground=()=>{if(document.hidden)cancel()};document.addEventListener('visibilitychange',stopOnBackground);
  function toggle(index){if(kind!=='life')return;pause();values[index]=values[index]?0:1;ready=true;paint();q('output').textContent+=` · ${Math.floor(index/columns)+1}:${index%columns+1} = ${values[index]}`;}
  canvas.onclick=e=>{const box=canvas.getBoundingClientRect(),c=Math.min(columns-1,Math.max(0,Math.floor((e.clientX-box.left)/box.width*columns))),r=Math.min(rows-1,Math.max(0,Math.floor((e.clientY-box.top)/box.height*rows)));cursor=r*columns+c;toggle(cursor)};
  canvas.onfocus=paint;canvas.onblur=paint;
  canvas.onkeydown=e=>{const steps={ArrowLeft:-1,ArrowRight:1,ArrowUp:-columns,ArrowDown:columns};if(e.key in steps){e.preventDefault();cursor=Math.max(0,Math.min(values.length-1,cursor+steps[e.key]));paint();q('output').textContent=`${Math.floor(cursor/columns)+1}:${cursor%columns+1} = ${values[cursor]}`}else if(e.key===' '||e.key==='Enter'){e.preventDefault();toggle(cursor)}};
  button('insert').onclick=()=>{
    if(!ready||job||grid.readOnly)return;pause();
    try{
      if(grid.commitEdit()===false)return;
      const cells=[];for(let r=0;r<rows;r++)for(let c=0;c<columns;c++){
        const formula=kind==='mandelbrot'&&input('formulas').checked;
        const real=parameters?parameters.centerX+((c+0.5)/columns-0.5)*parameters.span:0,imag=parameters?parameters.centerY+((r+0.5)/rows-0.5)*parameters.span*rows/columns:0;
        cells.push({row:r,col:c,...(formula?{formula:`=MANDELBROT(${real};${imag};${parameters.iterations})`}:{value:values[r*columns+c]})});
      }
      const ws=grid.feature('worksheets');const base=kind==='life'?'Game of Life':'Mandelbrot';let name=base,index=2;while(ws.list().some(s=>s.name.toLowerCase()===name.toLowerCase()))name=`${base} ${index++}`;ws.select(ws.add(name));
      ws.importSheet({name:grid.sheetName,cells,dimensions:{rows,columns,columnWidths:Array(columns).fill(24),rowHeights:Array(rows).fill(24)},conditionalFormats:[heatmapRule({r1:0,c1:0,r2:rows-1,c2:columns-1},scale())],table:null,filters:[],pivotTables:[],validationRules:[],freezePanes:{rows:0,columns:0}});
      opener=grid.el;dialog.close();grid.select(0,0);grid.el.focus();notify(t('simulationInserted'));
    }catch(error){notify(error.message)}
  };
  for(const [value,key] of [['life','demoLife'],['mandelbrot','demoMandelbrot']]){const option=new Option('',value);option.dataset.i18n=key;$('#demoContents').append(option)}
  const openButton=document.createElement('button');openButton.dataset.i18n='simulations';openButton.onclick=()=>open('life');$('.tools-grid').append(openButton);
  function open(next){opener=document.activeElement;kind=next;dialog.querySelectorAll('[data-life]').forEach(el=>el.hidden=kind!=='life');dialog.querySelectorAll('[data-mandel]').forEach(el=>el.hidden=kind!=='mandelbrot');input('speed').parentElement.hidden=kind!=='life';reset();dialog.showModal();button('run').focus();if(kind==='mandelbrot')void calculate();}
  return {open,dispose(){cancel();document.removeEventListener('visibilitychange',stopOnBackground);dialog.remove();openButton.remove()}};
}
