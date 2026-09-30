/** Serialize catalog read/modify/write across every tab sharing this database. */
export function idbCatalog<T extends {id:string}>(open:()=>Promise<IDBDatabase>){
 async function load():Promise<T[]>{
  const db=await open();
  return new Promise((resolve,reject)=>{
   const request=db.transaction('catalog').objectStore('catalog').getAll();
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error);
  });
 }
 async function update(change:(entries:T[])=>void):Promise<T[]>{
  const db=await open();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction('catalog','readwrite'),store=tx.objectStore('catalog');
   let next:T[]=[],failure:unknown;
   const request=store.getAll();
   request.onsuccess=()=>{
    try{
     next=request.result;
     const previous=new Map(next.map(entry=>[entry.id,JSON.stringify(entry)]));
     // This callback must stay synchronous so IndexedDB keeps the transaction open.
     change(next);
     for(const entry of next){
      if(previous.get(entry.id)!==JSON.stringify(entry))store.put(entry);
      previous.delete(entry.id);
     }
     for(const id of previous.keys())store.delete(id);
    }catch(error){failure=error;tx.abort();}
   };
   tx.oncomplete=()=>resolve(next);
   tx.onerror=tx.onabort=()=>reject(failure??tx.error??Error('本机书架保存失败。'));
  });
 }
 async function save(entries:T[]){await update(current=>{
  for(const entry of entries){const index=current.findIndex(row=>row.id===entry.id);if(index<0)current.push(entry);else current[index]=entry;}
 });}
 return {load,save,update};
}
