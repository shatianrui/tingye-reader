export type ProgressWrite={id:string;chapter:number;position:number;updatedAt:number};
export type SaveState='saving'|'saved'|'error';

/** A bounded throttle: continuous playback cannot postpone a local write forever. */
export function createProgressSaver(write:(value:ProgressWrite)=>Promise<unknown>,status:(value:SaveState)=>void,delay=700){
 let pending:ProgressWrite|undefined,timer:ReturnType<typeof setTimeout>|undefined;
 let queue:Promise<void>=Promise.resolve();
 let version=0;
 function schedule(value:ProgressWrite){
  pending={...value};version++;status('saving');
  if(timer===undefined)timer=setTimeout(()=>{timer=undefined;void flush().catch(()=>{});},delay);
 }
 function flush():Promise<void>{
  if(timer!==undefined){clearTimeout(timer);timer=undefined;}
  const value=pending,currentVersion=version;pending=undefined;
  if(!value)return queue;
  queue=queue.catch(()=>{}).then(async()=>{
   try{await write(value);if(version===currentVersion&&!pending)status('saved');}
   catch(error){if(version===currentVersion&&!pending)pending=value;status('error');throw error;}
  });
  return queue;
 }
 return {schedule,flush};
}
