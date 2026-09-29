import { indexedDBStorage } from '../src/indexeddb.js';

// IndexedDB stores the workbook. A synchronous recovery copy covers reloads
// before the asynchronous transaction finishes; a separate key keeps edit drafts.
export async function installAutosave(grid,{formula,status,key}={}){
  const recoveryKey=`${key}:recovery`,draftKey=`${key}:draft`;
  grid.use(indexedDBStorage({key,database:'tinyDatagrid-demo'}));
  const storage=grid.feature('indexedDB');
  let timer,revision=0,restored=false,backupAvailable=false;
  const read=name=>{try{return localStorage.getItem(name)}catch{return null}};
  const remove=name=>{try{localStorage.removeItem(name)}catch{}};
  const put=(name,value)=>{try{localStorage.setItem(name,value);return true}catch{return false}};
  const recovery=read(recoveryKey);
  if(recovery){try{grid.importWorkbook(JSON.parse(recovery),{replace:true});grid.clearHistory();restored=true;backupAvailable=true}catch{status('saveFailed')}}
  if(!restored){try{restored=await storage.restore()}catch{status('saveFailed')}}
  function backup(){
    try{backupAvailable=put(recoveryKey,JSON.stringify(grid.exportWorkbook({computedValues:false})));return backupAvailable}catch{return false}
  }
  async function save(withBackup=true){
    clearTimeout(timer);const version=revision;status('savingLocal');if(withBackup)backup();
    try{await storage.save();if(version===revision){remove(recoveryKey);backupAvailable=false;status('savedLocal')}}
    catch{status(backupAvailable?'savedLocal':'saveFailed')}
  }
  function changed(){revision++;remove(draftKey);status('savingLocal');clearTimeout(timer);timer=setTimeout(save,150);}
  for(const event of ['mutation','history','worksheet'])grid.on(event,changed);
  function draft(){
    const editing=grid._editing;
    if(editing)put(draftKey,JSON.stringify({sheetId:grid.feature('worksheets')?.activeId,...editing,value:grid.editor.value}));
    else if(document.activeElement===formula)put(draftKey,JSON.stringify({sheetId:grid.feature('worksheets')?.activeId,...grid.anchor,value:formula.value}));
  }
  grid.editor.addEventListener('input',draft);formula.addEventListener('input',draft);
  // The first keystroke is inserted by edit(), before the editor's input event.
  grid.el.addEventListener('keydown',()=>queueMicrotask(draft));
  grid.on('select',()=>{if(!grid._editing&&document.activeElement!==formula)remove(draftKey)});
  function flush(){draft();clearTimeout(timer);if(revision){backup();void save(false)}}
  window.addEventListener('pagehide',flush);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush()});
  const savedDraft=read(draftKey);
  return {restored,save,restoreDraft(){
    if(!savedDraft)return;
    try{const item=JSON.parse(savedDraft);if(item.sheetId&&grid.feature('worksheets')&&item.sheetId!==grid.feature('worksheets').activeId){if(!grid.feature('worksheets').list().some(s=>s.id===item.sheetId))return;grid.feature('worksheets').select(item.sheetId)}if(!Number.isInteger(item.row)||!Number.isInteger(item.col)||item.row<0||item.col<0||item.row>=grid.rowCount||item.col>=grid.colCount||typeof item.value!=='string')return;
      grid.select(item.row,item.col);grid.edit(item.row,item.col,item.value);put(draftKey,savedDraft);
    }catch{status('saveFailed')}
  }};
}
