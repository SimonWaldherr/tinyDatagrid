/** Pure numerical kernels; no grid or browser dependency. */
export function lifeStep(cells,rows,columns,{wrap=false}={}) {
  if(!Number.isInteger(rows)||!Number.isInteger(columns)||rows<1||columns<1||rows*columns>1000000||cells.length!==rows*columns)throw new RangeError('Invalid Life dimensions');
  const next=new Uint8Array(cells.length);
  for(let r=0;r<rows;r++)for(let c=0;c<columns;c++){
    let n=0;
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
      if(!dr&&!dc)continue;let y=r+dr,x=c+dc;
      if(wrap){y=(y+rows)%rows;x=(x+columns)%columns}
      if(y>=0&&y<rows&&x>=0&&x<columns&&cells[y*columns+x])n++;
    }
    next[r*columns+c]=Number(n===3||(n===2&&!!cells[r*columns+c]));
  }
  return next;
}
export function mandelbrot(real,imag,maxIterations=200) {
  if(!Number.isFinite(real)||!Number.isFinite(imag)||!Number.isInteger(maxIterations)||maxIterations<1||maxIterations>10000)throw new RangeError('Invalid Mandelbrot parameters');
  let x=0,y=0,n=0;
  while(x*x+y*y<=4&&n<maxIterations){const next=x*x-y*y+real;y=2*x*y+imag;x=next;n++}
  return n;
}
/** Cancellable worker job. Results arrive once complete; progress is 0..1. */
export function computeMandelbrot(options,{signal,onProgress=()=>{}}={}) {
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new DOMException('Aborted','AbortError'));return}
    const worker=new Worker(new URL('./simulation-worker.js',import.meta.url),{type:'module'});
    const done=()=>{worker.terminate();signal?.removeEventListener('abort',abort)};
    const abort=()=>{done();reject(new DOMException('Aborted','AbortError'))};
    signal?.addEventListener('abort',abort,{once:true});
    worker.onerror=e=>{done();reject(new Error(e.message||'Worker failed'))};
    worker.onmessage=({data})=>{if(data.error){done();reject(new Error(data.error))}else if(data.values){done();resolve(data.values)}else onProgress(data.progress)};
    try{worker.postMessage(options)}catch(error){done();reject(error)}
  });
}
