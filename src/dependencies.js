/** Dynamic dependencies include the branches actually read by IF/lookup/custom functions. */
export class Dependencies {
  constructor(cache) {
    this.cache=cache;this.cycle=0;this.cycleTime=Date.now();this.reads=new Map();this.users=new Map();this.stack=[];this.evaluations=0;
    // Dynamic-array state. Keys are calculation keys, so worksheet views can share this object.
    this.spills=new Map();   // origin -> {row,col,rows,cols,matrix}
    this.covered=new Map();  // spilled cell -> origin
    this.blocked=new Map();  // origin -> {row,col,rows,cols,message} while #SPILL!
    this.dirty=new Set();    // keys invalidated since the last settle
    this.dirtyAll=true;
  }
  read(key) {
    const owner=this.stack.at(-1);if(owner==null||owner===key)return;
    let reads=this.reads.get(owner);if(!reads)this.reads.set(owner,reads=new Set());
    reads.add(key);let users=this.users.get(key);if(!users)this.users.set(key,users=new Set());users.add(owner);
  }
  begin(key) { this.forget(key);this.stack.push(key);this.evaluations++; }
  end() { this.stack.pop(); }
  forget(key) {
    for(const dependency of this.reads.get(key)||[]){const users=this.users.get(dependency);users?.delete(key);if(!users?.size)this.users.delete(dependency)}
    this.reads.delete(key);
  }
  /** Drop cached results that depend on key. Cells listed in skip are mid-evaluation and left alone. */
  invalidate(key,skip) {
    if(!skip){this.cycle++;this.cycleTime=Date.now();}
    const pending=[key,...(!skip?(this.users.get('volatile:cycle')||[]):[])],seen=new Set();
    while(pending.length){const current=pending.pop();if(seen.has(current)||skip?.has(current))continue;seen.add(current);this.cache.delete(current);for(const user of this.users.get(current)||[])pending.push(user)}
    for(const current of seen){this.forget(current);this.dirty.add(current)}
    if(this.dirty.size>50000){this.dirty.clear();this.dirtyAll=true}
    return seen.size;
  }
  clear(){this.cycle++;this.cycleTime=Date.now();this.cache.clear();this.reads.clear();this.users.clear();this.spills.clear();this.covered.clear();this.blocked.clear();this.dirty.clear();this.dirtyAll=true;}
}

export class CellMap extends Map {
  constructor(grid,entries){super();this.grid=grid;for(const [key,value] of entries||[])super.set(key,value)}
  set(key,value){
    const old=this.get(key);
    if(old&&!Object.is(old.raw,value?.raw)&&Object.hasOwn(old,'originalInput')&&Object.is(old.originalInput,value?.originalInput))value={...value,originalInput:value.raw};
    if(!Object.is(old?.raw,value?.raw)||old?.valueType!==value?.valueType){
      this.grid._validateWrite?.(key,value?.raw,value?.valueType);
      this.grid.engine?.dependencies.invalidate(this.grid._calculationKey(key));
      this.grid.engine?.cellChanged?.(key);
    }
    return super.set(key,value);
  }
  delete(key){if(this.has(key)){this.grid._validateWrite?.(key,'');this.grid.engine?.dependencies.invalidate(this.grid._calculationKey(key));this.grid.engine?.cellChanged?.(key)}return super.delete(key)}
  clear(){for(const key of this.keys())this.grid._validateWrite?.(key,'');this.grid.engine?.clearCache();super.clear()}
}
