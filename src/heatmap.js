const rgb=hex=>{if(!/^#[0-9a-f]{6}$/i.test(hex))throw new TypeError('Expected #rrggbb color');return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16))};
export function heatColor(value,{min=0,max=1,colors=['#17213f','#778cff','#ffe7a3']}={}) {
  if(!Number.isFinite(value))return null;
  if(!Number.isFinite(min)||!Number.isFinite(max)||max<min||colors.length<2)throw new TypeError('Invalid color scale');
  const palette=colors.map(rgb),t=Math.max(0,Math.min(1,max===min?0.5:(value-min)/(max-min)))*(palette.length-1),i=Math.min(palette.length-2,Math.floor(t)),f=t-i;
  const channels=palette[i].map((a,k)=>Math.round(a+(palette[i+1][k]-a)*f));
  return '#'+channels.map(v=>v.toString(16).padStart(2,'0')).join('');
}
export function heatmapRule(range,{min,max,colors=['#17213f','#778cff','#ffe7a3']}={}) {
  heatColor(0,{min,max,colors});return {range:{...range},type:'colorScale',min,max,colors:[...colors]};
}
export function drawHeatmap(canvas,values,rows,columns,options={}) {
  if(values.length!==rows*columns)throw new RangeError('Invalid heatmap dimensions');
  canvas.width=columns;canvas.height=rows;
  const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(columns,rows);
  for(let i=0;i<values.length;i++){const color=heatColor(values[i],options);if(!color)continue;const channels=rgb(color);pixels.data.set([...channels,255],i*4)}
  ctx.putImageData(pixels,0,0);
}
