import { DisplayText as Text } from '../components/DisplayText';
import {forwardRef,useEffect,useImperativeHandle,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,View} from 'react-native';
import {WebView} from 'react-native-webview';
import {Asset} from 'expo-asset';
import {Directory,File,Paths} from 'expo-file-system';
import type {Chapter} from './books';
import type {ReadingCursor} from './player';
import {originalPage,type ReaderConfig} from './original-page';
import {pdfPage} from './pdf-page';
import {chapterResources} from './chapter-resources';
export type ReaderPage={index:number;count:number;start:number;end:number;anchor?:number;manual?:boolean};
export type OriginalReaderHandle={turn:(delta:number)=>void;seek:(offset:number)=>void};
type Props={chapter:Chapter;pdf?:string;resources?:Record<string,string>;chapterIndex:number;config:ReaderConfig;initialOffset:number;playback?:ReadingCursor;onPage:(page:ReaderPage)=>void;onBoundary:(delta:number)=>void;onToggle:()=>void;onPlay:()=>void;onHideControls:()=>void;onLink:(href:string)=>void};
const fontModules=[require('../../assets/fonts/NotoSerifCJKsc-Regular.otf'),require('../../assets/fonts/LXGWWenKaiLite-Regular.ttf')];
let resources:Promise<string>|undefined,pdfEngine:Promise<string>|undefined;
const loadResources=()=>resources??=Promise.all(fontModules.map(async(module,index)=>{
 const a=Asset.fromModule(module);await a.downloadAsync();
 // WKWebView can only read resources inside its explicitly granted local directory.
 const dir=new Directory(Paths.cache,'original-reader','fonts');dir.create({intermediates:true,idempotent:true});
 const font=new File(dir,`${a.hash||index}.${index===0?'otf':'ttf'}`);
 if(!font.exists)new File(a.localUri||a.uri).copy(font);
 return font.uri;
})).then(([serif,kai])=>`@font-face{font-family:ReaderSerif;src:url("${serif}")}@font-face{font-family:ReaderKai;src:url("${kai}")}`);
const loadPdf=()=>pdfEngine??=(async()=>{const a=Asset.fromModule(require('../../assets/reader/pdf.reader'));await a.downloadAsync();return new File(a.localUri||a.uri).text();})();
export default forwardRef<OriginalReaderHandle,Props>(function OriginalReader(p,ref){
 const web=useRef<WebView>(null),latest=useRef(p);latest.current=p;
 const [uri,setUri]=useState(''),[ready,setReady]=useState(false),[error,setError]=useState(''),[fallback,setFallback]=useState(false),[generation,setGeneration]=useState(0);
 const source=useMemo(()=>({uri}),[uri]);
 const pageOffset=useRef(p.initialOffset),retries=useRef(0),readyRef=useRef(false);
 const command=(value:unknown)=>web.current?.injectJavaScript(`window.readerCommand&&window.readerCommand(${JSON.stringify(value).replace(/</g,'\\u003c')});true;`);
 useImperativeHandle(ref,()=>({turn:delta=>{if(fallback)latest.current.onBoundary(delta);else command({type:'turn',delta});},seek:offset=>command({type:'seek',offset})}),[fallback]);
 useEffect(()=>{let cancelled=false,owned:Directory|undefined;setUri('');setReady(false);readyRef.current=false;setError('');setFallback(false);
  void Promise.all([loadResources(),p.pdf?loadPdf():Promise.resolve('')]).then(async([fontCss,engine])=>{
   if(cancelled)return;
   owned=new Directory(Paths.cache,'original-reader',`chapter-${Date.now()}-${Math.random().toString(36).slice(2)}`);owned.create({intermediates:true,idempotent:true});
   const local=p.pdf?{}:await chapterResources(p.chapter,p.resources||{},async(name,base64)=>{
    if(cancelled)throw Error('Reading closed');const file=new File(owned!,name);file.write(base64,{encoding:'base64'});return file.uri;
   });
   if(cancelled)return;
   const page=new File(owned,'page.html'),now=latest.current;
   page.write(p.pdf?pdfPage(p.pdf,p.chapterIndex,p.chapter.text,now.config,engine):originalPage(p.chapter,now.config,pageOffset.current,fontCss,local));setUri(page.uri);
  }).catch(e=>{resources=undefined;pdfEngine=undefined;if(!cancelled){setError(String(e.message||e));setFallback(true);}});
  return()=>{cancelled=true;if(owned?.exists)owned.delete();};
 },[p.chapter,p.pdf,p.chapterIndex,generation]);
 useEffect(()=>{if(ready)command({type:'config',value:p.config});},[p.config,ready]);
 // One bridge message owns both pagination and highlighting, including reloads.
 useEffect(()=>{if(ready)command({type:'playback',cursor:p.playback??null});},[p.playback,ready]);
 useEffect(()=>{if(!uri)return;const timer=setTimeout(()=>{if(!readyRef.current){setError('排版响应超时，可重试或先阅读纯文本。');setFallback(true);}},20000);return()=>clearTimeout(timer);},[uri]);
 useEffect(()=>{if(fallback)p.onPage({index:0,count:1,start:0,end:p.chapter.text.length});},[fallback,p.chapter]);
 const recover=()=>{if(retries.current++<2){pageOffset.current=latest.current.playback?.offset??pageOffset.current;setGeneration(v=>v+1);}else{setError('显示组件已重新启动，可重试或阅读纯文本。');setFallback(true);}};
 return <View style={{flex:1,backgroundColor:p.config.colors.surface}}>
  {!fallback&&!!uri&&<WebView ref={web} key={generation} source={source} style={{flex:1,backgroundColor:p.config.colors.surface}} allowingReadAccessToURL={Paths.cache.uri} automaticallyAdjustContentInsets={false} contentInsetAdjustmentBehavior="never" bounces={false} originWhitelist={['*']} javaScriptEnabled domStorageEnabled={false} incognito thirdPartyCookiesEnabled={false} sharedCookiesEnabled={false} allowFileAccess allowFileAccessFromFileURLs allowUniversalAccessFromFileURLs={false} mixedContentMode="never" setSupportMultipleWindows={false} javaScriptCanOpenWindowsAutomatically={false} textZoom={100} scrollEnabled={!!p.pdf} overScrollMode="never" onShouldStartLoadWithRequest={r=>r.url===uri||r.url==='about:blank'||r.url.startsWith(uri+'#')} onRenderProcessGone={recover} onContentProcessDidTerminate={recover} onError={()=>{setError('书页加载失败，可重试或继续阅读纯文本。');setFallback(true);}} onMessage={event=>{try{const m=JSON.parse(event.nativeEvent.data);if(m.type==='ready'){readyRef.current=true;setReady(true);}else if(m.type==='page'&&[m.index,m.count,m.start,m.end].every(Number.isFinite)&&m.count>0&&m.count<100000){pageOffset.current=Number.isFinite(m.anchor)?m.anchor:m.start;latest.current.onPage(m);}else if(m.type==='toggle')latest.current.onToggle();else if(m.type==='play')latest.current.onPlay();else if(m.type==='hideControls')latest.current.onHideControls();else if(m.type==='boundary'&&(m.delta===1||m.delta===-1))latest.current.onBoundary(m.delta);else if(m.type==='link'&&typeof m.href==='string')latest.current.onLink(m.href);else if(m.type==='error'){setError(String(m.message));setFallback(true);}}catch{}}}/>}
  {!ready&&!fallback&&<View pointerEvents="none" style={{position:'absolute',top:12,left:0,right:0,alignItems:'center'}}><ActivityIndicator color={p.config.colors.accent}/></View>}
  {fallback&&<ScrollView contentContainerStyle={{padding:12}}><Text style={{color:p.config.colors.muted,fontSize:13,marginBottom:12}}>{error}</Text><Pressable onPress={()=>{retries.current=0;setGeneration(v=>v+1);}}><Text style={{color:p.config.colors.accent,marginBottom:18}}>重试原书排版</Text></Pressable><Text selectable onPress={p.onToggle} style={{color:p.config.colors.text,fontSize:p.config.fontSize,lineHeight:p.config.fontSize*p.config.typography.lineHeight}}>{p.chapter.text||'此页为插图页，请重试原书排版。'}</Text></ScrollView>}
 </View>;
});

