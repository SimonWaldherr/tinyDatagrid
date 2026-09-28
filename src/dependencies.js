/** Dynamic dependencies include the branches actually read by IF/lookup/custom functions. */
export class Dependencies {
  constructor(cache) { this.cache=cache;this.reads=new Map();this.users=new Map();this.stack=[];this.evaluations=0; }
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
  invalidate(key) {
    const pending=[key],seen=new Set();
    while(pending.length){const current=pending.pop();if(seen.has(current))continue;seen.add(current);this.cache.delete(current);for(const user of this.users.get(current)||[])pending.push(user)}
    for(const current of seen)this.forget(current);
    return seen.size;
  }
  clear(){this.cache.clear();this.reads.clear();this.users.clear();}
}

export class CellMap extends Map {
  constructor(grid,entries){super();this.grid=grid;for(const [key,value] of entries||[])super.set(key,value)}
  set(key,value){
    const old=this.get(key);
    if(old&&!Object.is(old.raw,value?.raw)&&Object.hasOwn(old,'originalInput')&&Object.is(old.originalInput,value?.originalInput))value={...value,originalInput:value.raw};
    if(!Object.is(old?.raw,value?.raw)||old?.valueType!==value?.valueType){
      this.grid._validateWrite?.(key,value?.raw);
      this.grid.engine?.dependencies.invalidate(this.grid._calculationKey(key));
    }
    return super.set(key,value);
  }
  delete(key){if(this.has(key)){this.grid._validateWrite?.(key,'');this.grid.engine?.dependencies.invalidate(this.grid._calculationKey(key))}return super.delete(key)}
  clear(){for(const key of this.keys())this.grid._validateWrite?.(key,'');this.grid.engine?.clearCache();super.clear()}
}
