/** Explicit opt-in persistence. No database is opened until save/restore/clear. */
export function indexedDBStorage({key,database='tinyDatagrid',autoSave=false,delay=500}={}){
  if(typeof key!=='string'||!key)throw new TypeError('Storage requires a nonempty document key');
  return {name:'indexedDB',setup(grid){
    let connection=null,opening=null,disposed=false,timer=null,loading=false,queue=Promise.resolve();
    function open(){
      if(disposed)return Promise.reject(new Error('Storage plugin disposed'));
      if(connection)return Promise.resolve(connection);if(opening)return opening;
      opening=new Promise((resolve,reject)=>{
        if(!globalThis.indexedDB){reject(new Error('IndexedDB unavailable'));return}
        const request=globalThis.indexedDB.open(database,1);
        request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('documents'))request.result.createObjectStore('documents')};
        request.onerror=()=>reject(request.error);
        request.onblocked=()=>grid.emit('storageblocked',{database});
        request.onsuccess=()=>{if(disposed){request.result.close();reject(new Error('Storage plugin disposed'));return}connection=request.result;connection.onversionchange=()=>{connection?.close();connection=null};resolve(connection)};
      }).finally(()=>{opening=null});return opening;
    }
    async function run(mode,operation){
      const db=await open();return new Promise((resolve,reject)=>{
        const tx=db.transaction('documents',mode),request=operation(tx.objectStore('documents'));
        tx.oncomplete=()=>resolve(request.result);tx.onabort=()=>reject(tx.error||request.error||new Error('Storage transaction aborted'));tx.onerror=()=>{};
      });
    }
    function serialize(operation){const next=queue.then(operation);queue=next.catch(()=>{});return next}
    const api={
      save(){const workbook=grid.exportWorkbook();return serialize(async()=>{await run('readwrite',store=>store.put({workbook,savedAt:new Date().toISOString()},key));grid.emit('storage',{type:'saved',key});return true})},
      restore(){clearTimeout(timer);return serialize(async()=>{const item=await run('readonly',store=>store.get(key));if(!item)return false;loading=true;try{const result=grid.importWorkbook(item.workbook);if(result===false)return false;grid.clearHistory();grid.emit('storage',{type:'restored',key});return true}finally{loading=false}})},
      clear(){clearTimeout(timer);return serialize(async()=>{await run('readwrite',store=>store.delete(key));grid.emit('storage',{type:'cleared',key});return true})},
      destroy(){disposed=true;clearTimeout(timer);for(const off of unsubscribe)off();connection?.close();connection=null}
    };
    const changed=()=>{if(!autoSave||loading||disposed)return;clearTimeout(timer);timer=setTimeout(()=>{try{api.save().catch(error=>grid.emit('storageerror',{error,key}))}catch(error){grid.emit('storageerror',{error,key})}},Math.max(0,delay))};
    const unsubscribe=['mutation','worksheet','history'].map(event=>grid.on(event,changed));
    return api;
  }};
}
