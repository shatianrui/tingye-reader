import {createContext,useContext,useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {Book as NativeBook} from './books';
import type {Book} from '../types/models';
import type {Entry} from './library';

export function presentLibrary(books: NativeBook[]) {
  return [...books].sort((a,b)=>Number((b as Entry).updatedAt||0)-Number((a as Entry).updatedAt||0)).map(b=>({
    id:b.id,title:b.title,author:b.author,category:b.sample?'示例节选':b.format,
    intro:b.sample?'内置示例，可直接阅读和听书。':`${b.format} · ${(b as Entry).local?'已保存到手机，可离线阅读。':(b as Entry).backedUp?'云端备份，打开后下载到手机。':'正文在导入设备，可通过云端备份同步。'}`,
    format:'txt' as const,coverColors:(b.color==='blue'?['#486477','#263e50']:b.color==='ochre'?['#A38353','#70512b']:['#375E4B','#1e3c2e']) as [string,string],
    coverUri:(b as Entry).coverUri,rating:0,readers:0,isNew:!b.position&&!b.chapter,
  }));
}
export function bookProgress(book?:NativeBook){
  const count=book?.chapters.length||(book as Entry|undefined)?.chapterCount||0;
  return count?Math.max(0,Math.min(1,(book?.chapter||0)/count)):0;
}
export function positionLabel(book?:NativeBook) {
  return !book||(!book.chapter&&!book.position)?'未开始':`第 ${(book.chapter||0)+1} 章`;
}
type Metrics={owner:string;stats:Record<string,number>;marks:Record<string,number[]>};
export function useReadingMetrics(userId:string|undefined,reading:boolean) {
  const [state,setState]=useState<Metrics>({owner:'',stats:{},marks:{}});
  const writes=useRef(Promise.resolve());
  useEffect(()=>{let live=true;if(userId)void AsyncStorage.getItem('tingye.metrics.v1:'+userId).then(raw=>{
    const saved=raw?JSON.parse(raw):{};if(live)setState({owner:userId,stats:saved.stats||{},marks:saved.marks||{}});
  }).catch(()=>{if(live)setState({owner:userId,stats:{},marks:{}});});return()=>{live=false;};},[userId]);
  useEffect(()=>{if(!userId||state.owner!==userId)return;const value=JSON.stringify(state),key='tingye.metrics.v1:'+userId;
    writes.current=writes.current.catch(()=>{}).then(()=>AsyncStorage.setItem(key,value)).catch(()=>{});
  },[state,userId]);
  useEffect(()=>{
    if(!reading||!userId||state.owner!==userId)return;
    let last=Date.now(),active=AppState.currentState==='active';
    const record=()=>{const now=Date.now(),seconds=Math.floor((now-last)/1000);last=now;if(!active||seconds<=0)return;
      const d=new Date(),key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      setState(s=>s.owner===userId?{...s,stats:{...s.stats,[key]:(s.stats[key]||0)+seconds}}:s);
    };
    const timer=setInterval(record,15000),sub=AppState.addEventListener('change',next=>{record();active=next==='active';});
    return()=>{record();clearInterval(timer);sub.remove();};
  },[reading,userId,state.owner]);
  const toggleMark=(id:string,index:number)=>setState(s=>{if(s.owner!==userId)return s;const list=s.marks[id]||[];
    return {...s,marks:{...s.marks,[id]:list.includes(index)?list.filter(i=>i!==index):[...list,index]}};});
  return {stats:state.owner===userId?state.stats:{},marks:state.owner===userId?state.marks:{},toggleMark};
}

export type LibraryUI={books:Book[];nativeBooks:NativeBook[];username:string;busy:boolean;notice:string;
  stats:Record<string,number>;marks:Record<string,number[]>;toggleMark:(id:string,index:number)=>void;
  open:(id:string,chapter?:number)=>Promise<void>;load:(id:string)=>Promise<NativeBook>;
  importBooks:()=>void;refresh:()=>void;actions:(id:string)=>void;settings:()=>void;logout:()=>void;dismissNotice:()=>void;
};
export const LibraryUIContext=createContext<LibraryUI|null>(null);
export function useLibraryUI(){const value=useContext(LibraryUIContext);if(!value)throw Error('Library UI needs the signed-in library');return value;}
