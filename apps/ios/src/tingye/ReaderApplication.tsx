import {ReaderPanel} from './ReaderPanel';
import appConfig from '../../app.json';
import {ReaderButton,ReaderErrorBanner} from './ReaderControls';
import {ReaderTopBar,ReaderBottomPanel,ListenFab,PlayerSheet} from './ReaderChrome';
import Icon from '../components/Icon';
import {styles} from './reader-styles';
import { DisplayText as Text } from '../components/DisplayText';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, FlatList, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import * as Speech from 'expo-speech';
import { api, restoreSession, signOut, clearSession, type Session } from './client';
import AccountScreen from './AccountScreen';
import CloudConnection from './CloudConnection';
import RootNavigator from '../navigation/RootNavigator';
import {LibraryUIContext,presentLibrary,useReadingMetrics} from './library-ui';
import {useAppTheme} from '../theme/useAppTheme';
import {brand} from '../theme/tokens';
import {nativeLibrary} from './native-library';
import { samples, sentences, type Book } from './books';
import { parseBook } from './import-book';
import {needsOriginalRepair} from './book-repair';
import { MODEL_OPTIONS, defaultVoice, voices, type VoiceConfig, type VoiceOption } from './voices';
import { readerPlayer, usePlayer } from './player';
import { sentenceRanges } from './pagination';
import { readingTheme, type ReadingTheme } from './themes';
import { voiceSourceChanged } from './playback-settings';
import { loadVoiceCredentials } from './voice-keys';
import OriginalReader,{type OriginalReaderHandle,type ReaderPage} from './OriginalReader';
import {resourcePath} from './original-document';
import ReadingAppearancePanel from './ReadingAppearancePanel';
import {useReaderPreferences} from './use-reader-preferences';
import {useReaderFonts} from './reader-fonts';
import {defaultTypography} from './typesetting';

import {readerServices, type ReaderServices} from './reader-services';
import {createReadingProgress} from './reading-progress';
import {adaptiveReaderLayout} from './reader-layout';

const errorText=(e:unknown)=>e instanceof Error?e.message:'操作失败，请重试。';

export default function ReaderApplication({services=readerServices}:{services?:ReaderServices}={}){
 const {width:windowWidth,height}=useWindowDimensions();
 const insets=useSafeAreaInsets(),width=windowWidth-insets.left-insets.right;
 const [identity,setIdentity]=useState<Session['user']|null>(null),[initializing,setInitializing]=useState(true),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [books,setBooks]=useState<Book[]>(samples),[book,setBook]=useState<Book|null>(null),[savedChapter,setChapter]=useState(0),[savedPosition,setPosition]=useState(0);
 const {prefs,setPrefs,loadPreferences,markPreferencesReady}=useReaderPreferences();
 const [panel,setPanel]=useState<'settings'|'type'|'toc'|'rate'|null>(null),[playerOpen,setPlayerOpen]=useState(false),[voiceList,setVoiceList]=useState<Speech.Voice[]>([]),[miniVoices,setMiniVoices]=useState<VoiceOption[]>([]),[voicesBusy,setVoicesBusy]=useState(false),[voiceNotice,setVoiceNotice]=useState('');
 const [pageStart,setPageStart]=useState(0),[pageEnds,setPageEnds]=useState<number[]>([]),[pageHeight,setPageHeight]=useState(0),[pageWidth,setPageWidth]=useState(0);
 const [controlsVisible,setControlsVisible]=useState(false);
 const [repairRevision,setRepairRevision]=useState(0);
 const originalReader=useRef<OriginalReaderHandle>(null);
 const [readerPage,setReaderPage]=useState<ReaderPage>({index:0,count:1,start:0,end:0});
 const [fontsReady,fontError]=useReaderFonts();
 const layout=adaptiveReaderLayout(width,Math.max(1,height-insets.top-insets.bottom),prefs.typography.margin,prefs.spreadMode==='single');

 const [draftVoice,setDraftVoice]=useState<VoiceConfig>(defaultVoice);
 const player=usePlayer(),colors=readingTheme(prefs.theme);
 const chapter=player.active?player.chapter:savedChapter,position=player.active?player.position:savedPosition;
 const latest=useRef({book,chapter,position});latest.current={book,chapter,position};
 const pendingProgress=useRef<ReturnType<typeof setTimeout>|null>(null),progressQueue=useRef(Promise.resolve());
 const readingProgress=useRef(createReadingProgress());
 const library=useRef<ReturnType<typeof nativeLibrary>|null>(null);
 const chrome=useAppTheme();
 const metrics=useReadingMetrics(identity?.userId,!!book);
 const presentedBooks=useMemo(()=>presentLibrary(books),[books]);
 const loadLibraryBook=useCallback(async(id:string)=>{const shelf=library.current;if(!shelf)throw Error('请先登录');return shelf.open(id);},[]);
 const returnToShelf=()=>{readerPlayer.stop();setPlayerOpen(false);save();readingProgress.current.clear();setBook(null);void progressQueue.current.then(reload);};
 const currentChapter=book?.chapters[chapter];
 const ranges=useMemo(()=>sentenceRanges(currentChapter?.text||''),[currentChapter]);
 const playerSentences=useMemo(()=>ranges.map(r=>(currentChapter?.text||'').slice(r.start,r.end).trim()),[ranges,currentChapter]);
 const reload=useCallback(async()=>{const shelf=library.current;if(!shelf)return;setBooks(await shelf.list());const result=await shelf.list(true);if(library.current===shelf)setBooks(result);},[]);
 const save=useCallback(()=>{
   const shelf=library.current;if(!shelf)return;
   const p=readingProgress.current.take();if(!p)return;
   progressQueue.current=progressQueue.current.catch(()=>{}).then(()=>shelf.progress(p.book,p.chapter,p.position,p.updatedAt)).catch(e=>setNotice(`本机进度保存失败：${errorText(e)}`));
 },[]);
 useEffect(()=>{
   let disposed=false;
   const initialization=(async()=>{try{
     await loadPreferences();
     const saved=await services.restore();if(saved){library.current=services.library(saved.user.userId);setIdentity(saved.user);setBooks(await library.current.list());
      try{const verified=await services.verify();if(!verified.user){await clearSession();library.current=null;setIdentity(null);setBooks(samples);setNotice('登录已过期，请重新登录。');}else void reload();}catch{setNotice('云端暂时不可用，已下载书籍可继续阅读。');}
     }
   }catch(e){setNotice(errorText(e));}finally{markPreferencesReady();setInitializing(false);}})();
   void Speech.getAvailableVoicesAsync().then(setVoiceList).catch(()=>{});
   const sub=AppState.addEventListener('change',state=>{if(state!=='active')save();else void library.current?.flush();});
   const retry=setInterval(()=>{void library.current?.flush();},30000);
   return()=>{disposed=true;clearInterval(retry);sub.remove();readerPlayer.stop();if(pendingProgress.current)clearTimeout(pendingProgress.current);save();};
 },[reload,save,loadPreferences,markPreferencesReady]);
 // Throttle rather than debounce: rapid sentence boundaries must not postpone
 // persistence forever. save() reads the latest cursor when the timer fires.
 useEffect(()=>{if(!book||pendingProgress.current)return;pendingProgress.current=setTimeout(()=>{pendingProgress.current=null;save();},800);},[book,chapter,position,save]);
 useEffect(()=>{let previous='';readerPlayer.onPosition=(ci,si)=>{readingProgress.current.move(ci,si);const key=`${ci}:${si}`;if(key===previous)return;previous=key;latest.current={...latest.current,chapter:ci,position:si};setChapter(ci);setPosition(si);};return()=>{readerPlayer.onPosition=null;};},[]);
 useEffect(()=>{setPageStart(0);setPageEnds([]);setReaderPage({index:0,count:1,start:0,end:0});},[chapter,book?.id]);
 useEffect(()=>{readerPlayer.stop();},[book?.id]);
 const activeRange=ranges[position];
 const pageIndex=readerPage.index;
 const readerConfig=useMemo(()=>({fontSize:prefs.fontSize,typography:prefs.typography,colors,original:prefs.originalLayout,spread:layout.spread,eink:colors.eink===true}),[prefs.fontSize,prefs.typography,colors,prefs.originalLayout,layout.spread]);
 const paginationReady=useCallback((next:ReaderPage)=>{setReaderPage(next);setPageStart(next.anchor??next.start);setPageEnds([next.end]);if(next.manual)readerPlayer.stop();if(next.manual){const si=Math.max(0,ranges.findIndex(r=>r.end>(next.anchor??next.start)));readingProgress.current.move(chapter,si);setPosition(si);}},[ranges,chapter]);
 const signedIn=(next:Session)=>{readerPlayer.clearCache();setBook(null);library.current=services.library(next.user.userId);setIdentity(next.user);setNotice('');setBooks(samples);void reload().catch(e=>setNotice(errorText(e)));};
 const openBook=async(item:Book,initialChapter?:number)=>{const shelf=library.current;if(busy||!shelf){pendingListen.current=false;return;}readerPlayer.stop();save();await progressQueue.current;setBusy(true);setNotice('');try{const b=await shelf.open(item.id);if(library.current!==shelf)return;const ci=Math.max(0,Math.min(initialChapter??b.chapter??0,b.chapters.length-1)),si=initialChapter===undefined?(b.position||0):0;readingProgress.current.restore(b,b.chapter||0,b.position||0);if(initialChapter!==undefined)readingProgress.current.move(ci,si);setBook(b);setControlsVisible(false);setChapter(ci);setPosition(si);}catch(e){pendingListen.current=false;setNotice(errorText(e));}finally{setBusy(false);}};
 const importBooks=async()=>{if(busy||!library.current)return;const selection=await DocumentPicker.getDocumentAsync({type:'*/*',multiple:true,copyToCacheDirectory:true});if(selection.canceled)return;setBusy(true);setNotice('');const failures:string[]=[];let imported=0;for(const asset of selection.assets){try{const b=await parseBook(asset.uri,asset.name);await library.current.importBook(b);imported++;}catch(e){failures.push(`${asset.name}：${errorText(e)}`);}}setBooks(await library.current.list());setNotice([imported?`已保存 ${imported} 本到手机。点击“同步”→“上传本机备份”，再在其他设备选择“从云端还原”。`:'',...failures].filter(Boolean).join('\n'));setBusy(false);};
 const runBackup=async(mode:'upload'|'download')=>{
  const shelf=library.current;if(busy||!shelf)return;setBusy(true);setNotice('正在核对云端账号与书架…');
  try{
   const verified=await services.verify();
   if(!verified.user)throw Error('登录已过期，请重新登录。本机书籍不会删除。');
   if(verified.user.userId!==identity?.userId)throw Error('云端账号与当前本机账号不一致，请退出后登录同一听页账号。本机书籍不会删除。');
   if(library.current!==shelf)return;
   readerPlayer.stop();save();await progressQueue.current;if(mode==='download'){readingProgress.current.clear();setBook(null);}
   const r=await (mode==='upload'?shelf.uploadAll:shelf.synchronize)(state=>{
    if(library.current!==shelf)return;
    setBooks(state.books);
    const step=state.title?`${state.phase==='upload'?'正在上传':'正在下载'}：${state.title}`:'正在核对书架与阅读进度…';
    setNotice(`账号 ${verified.user!.username} · 云端 ${state.cloudCount} 条书目\n已上传 ${state.uploaded} 本，已下载 ${state.downloaded} 本。${step}`);
   });
   if(library.current!==shelf)return;setBooks(r.books);
   setNotice([`账号 ${verified.user.username} · 云端 ${r.cloudCount} 条书目`,`${r.errors.length||r.missing.length?'备份/还原部分完成':'备份/还原完成'}：上传 ${r.uploaded} 本，下载 ${r.downloaded} 本。${r.errors.length?'部分步骤失败，详见下方。':'已核对阅读进度。'}`,r.progressUpdates.length?`已更新 ${r.progressUpdates.length} 本阅读位置：${r.progressUpdates.slice(0,3).map(b=>`${b.title} · 第 ${(b.chapter||0)+1} 章，第 ${(b.position||0)+1} 句`).join('；')}`:'',r.restored?`已恢复 ${r.restored} 条重新出现在云端的书目。`:'',r.missing.length?`${r.missing.length} 本尚无云端正文，请先在原设备升级后点击同步：${r.missing.slice(0,5).join('、')}`:'',...r.errors.slice(0,5)].filter(Boolean).join('\n'));
  }catch(e){if(library.current===shelf)setNotice('同步失败：'+errorText(e));}
  finally{if(library.current===shelf)setBusy(false);}
 };
 const synchronize=()=>{if(busy)return;Alert.alert('备份与还原','上传会保存本机书籍、图片、排版和当前阅读位置。还原会用云端版本替换同名书籍的本机内容及进度，请先上传需要保留的本机修改。',[{text:'上传本机备份',onPress:()=>{void runBackup('upload');}},{text:'从云端还原',onPress:()=>{void runBackup('download');}},{text:'取消',style:'cancel'}]);};
 const removeBook=(item:Book)=>Alert.alert('移除书籍',`删除《${item.title}》的本机副本、云端备份及进度？`,[{text:'取消',style:'cancel'},{text:'删除',style:'destructive',onPress:()=>{void library.current?.remove(item.id).then(()=>library.current?.list()).then(result=>{if(result)setBooks(result);}).catch(e=>setNotice(errorText(e)));}}]);
 const repairBook=async(item:Book)=>{
  const shelf=library.current;if(busy||!shelf)return;
  const choice=await DocumentPicker.getDocumentAsync({type:'*/*',multiple:false,copyToCacheDirectory:true});if(choice.canceled)return;
  readerPlayer.stop();save();await progressQueue.current;setBusy(true);setNotice('');
  try{
   const asset=choice.assets[0],original=await parseBook(asset.uri,asset.name);
   if(original.format!==item.format)throw Error('请选择这本书同格式的原文件。');
   const restored=await shelf.repair(item.id,original);if(library.current!==shelf)return;
   setPrefs(p=>({...p,originalLayout:true}));setPanel(null);
   if(book?.id===item.id){readingProgress.current.restore(restored,restored.chapter||0,restored.position||0);setRepairRevision(n=>n+1);setBook(restored);setChapter(restored.chapter||0);setPosition(restored.position||0);setPageStart(0);}
   setBooks(await shelf.list());setNotice('已重新导入原书图文和封面，保留书架条目与阅读位置。可重新备份到云端。');
  }catch(e){setNotice(errorText(e));}finally{setBusy(false);}
 };
 const bookActions=(item:Book)=>{if(busy)return;Alert.alert(item.title,'本机书籍可以离线阅读；备份后可在网页和其他设备恢复。',[{text:'修复原书图文 / 封面',onPress:()=>{void repairBook(item);}},{text:'云端备份',onPress:()=>{setBusy(true);readerPlayer.stop();save();void progressQueue.current.then(()=>library.current?.backup(item.id)).then(()=>{setNotice('完整书籍与当前阅读位置已备份。');return reload();}).catch(e=>setNotice(errorText(e))).finally(()=>setBusy(false));}},{text:'移除书籍',style:'destructive',onPress:()=>removeBook(item)},{text:'取消',style:'cancel'}]);};
 const jump=(ci:number,si=0)=>{readerPlayer.stop();readingProgress.current.move(ci,si);setChapter(ci);setPosition(si);setPageStart(0);setPageEnds([]);setPanel(null);};
 const crossChapter=(delta:number)=>{readerPlayer.stop();if(book&&chapter+delta>=0&&chapter+delta<book.chapters.length)jump(chapter+delta,delta<0?Math.max(0,sentences(book.chapters[chapter+delta].text).length-1):0);};
 const turn=(delta:number)=>{readerPlayer.stop();originalReader.current?.turn(delta);};
 const play=()=>{if(!book||!pageEnds.length)return;setControlsVisible(false);if(player.active)readerPlayer.togglePause();else{const si=ranges.findIndex(r=>r.end>pageStart);setPosition(Math.max(0,si));void readerPlayer.start(book,chapter,Math.max(0,si),prefs.voice,{startOffset:pageStart});}};
 const pendingListen=useRef(false);
 useEffect(()=>{if(pendingListen.current&&book&&pageEnds.length){pendingListen.current=false;play();}},[book,pageEnds]);
 const listenFrom=(si:number)=>{if(!book||!ranges[si])return;readingProgress.current.move(chapter,si);setPosition(si);void readerPlayer.start(book,chapter,si,prefs.voice,{startOffset:ranges[si].start,paused:false});};
 const openPlayer=()=>{setControlsVisible(false);setPlayerOpen(true);};
 const afterPlayerAction=useRef<(()=>void)|null>(null);
 const runAfterPlayer=()=>{const action=afterPlayerAction.current;afterPlayerAction.current=null;action?.();};
 // iOS cannot present the panel Modal until the player Modal has finished dismissing.
 const afterPlayer=(action:()=>void)=>{afterPlayerAction.current=action;setPlayerOpen(false);setTimeout(runAfterPlayer,1200);};
 const playerChapter=(delta:number)=>{if(!book)return;const ci=chapter+delta;if(ci<0||ci>=book.chapters.length)return;const state=readerPlayer.snapshot();jump(ci,0);if(state.active)void readerPlayer.start(book,ci,0,prefs.voice,{startOffset:0,paused:state.paused});};
 const cycleRate=()=>{const rates=[.75,1,1.25,1.5,1.75,2],i=rates.indexOf(prefs.voice.rate);changeRate(rates[(i+1)%rates.length]);};
 const toggleEink=()=>{const target=colors.eink?readingTheme('paper'):readingTheme('eink');chooseReadingTheme(target);};
 const voiceLabel=prefs.voice.provider==='system'?'本地语音':`${prefs.voice.provider==='glm'?'GLM':'MiniMax'} · ${(prefs.voice.provider==='minimax'&&miniVoices.length?miniVoices:voices(prefs.voice)).find(v=>v.value===prefs.voice.voice)?.label||prefs.voice.voice||'默认'}`;
 const followBookLink=(href:string)=>{if(!book)return;const target=resourcePath(currentChapter?.document?.path||'',href);const ci=book.chapters.findIndex(c=>c.document?.path===target);if(ci>=0)jump(ci);};
 const openSettings=()=>{setDraftVoice({...prefs.voice});setVoiceNotice('');setPanel('settings');};
 const chooseReadingTheme=(theme:ReadingTheme)=>setPrefs(p=>theme.eink?{...p,theme:theme.id,originalLayout:false,spreadMode:'single',fontSize:22,typography:{...defaultTypography,font:'serif',lineHeight:1.7,paragraphGap:.3,margin:32,indent:true,alignment:'justify'}}:{...p,theme:theme.id});
 const changeVoice=(voice:VoiceConfig)=>setDraftVoice(voice);
 const changeRate=(rate:number)=>{readerPlayer.setRate(rate);setPrefs(p=>({...p,voice:{...p.voice,rate}}));setDraftVoice(v=>({...v,rate}));};
 const applyDraftVoice=()=>{
     const voice={...draftVoice,model:draftVoice.model.trim(),voice:draftVoice.voice.trim()};
     if(voice.provider!=='system'&&(!voice.model||!voice.voice)){Alert.alert('请补全语音设置','模型和音色不能为空。');return false;}
     const changed=voiceSourceChanged(prefs.voice,voice),state=readerPlayer.snapshot(),current=latest.current;
     setPrefs(p=>({...p,voice}));
     if(changed&&state.active&&current.book){
       const start=sentenceRanges(current.book.chapters[state.chapter].text)[state.position]?.start??0;
       void readerPlayer.start(current.book,state.chapter,state.position,voice,{startOffset:start,paused:state.paused});
     }
     return true;
 };
 const closePanel=()=>{
   if(panel==='settings'&&!applyDraftVoice())return;
   setPanel(null);
 };
 const chooseProvider=(provider:VoiceConfig['provider'])=>{const model=provider==='glm'?'glm-tts':provider==='minimax'?'speech-2.8-hd':'';const next:VoiceConfig={provider,model,voice:'',rate:draftVoice.rate,apiKey:draftVoice.provider===provider?draftVoice.apiKey:'',groupId:draftVoice.provider===provider?draftVoice.groupId:''};next.voice=voices(next)[0]?.value||'';changeVoice(next);setVoiceNotice('');setMiniVoices([]);
  if(provider==='glm'||provider==='minimax')void loadVoiceCredentials().then(creds=>{const saved=creds[provider];if(saved)setDraftVoice(v=>v.provider===provider?{...v,apiKey:v.apiKey||saved.key||'',groupId:v.groupId||saved.groupId||''}:v);});};
 const loadMiniVoices=async()=>{setVoicesBusy(true);setVoiceNotice('');try{const data=await api<{voices:VoiceOption[]}>('/api/tts/voices',{method:'POST',body:JSON.stringify({provider:'minimax',key:draftVoice.apiKey||'',groupId:draftVoice.groupId||''})});setMiniVoices(data.voices);setVoiceNotice('已加载 '+data.voices.length+' 个可用音色');}catch(e){setVoiceNotice(errorText(e));}finally{setVoicesBusy(false);}};
 useEffect(()=>{if(panel==='settings'&&draftVoice.provider==='minimax'&&!miniVoices.length&&draftVoice.apiKey)void loadMiniVoices();},[panel,draftVoice.provider,draftVoice.apiKey]);
 const logout=async()=>{readerPlayer.clearCache();save();await progressQueue.current;try{await signOut();library.current=null;readingProgress.current.clear();setIdentity(null);setBook(null);setBooks(samples);setPanel(null);setNotice('');setMiniVoices([]);}catch(e){setNotice(errorText(e));}};
 const title=book?.title||'我的书架';
 const selectedVoices=draftVoice.provider==='system'?voiceList.map(v=>({value:v.identifier,label:`${v.name} · ${v.language}`})):draftVoice.provider==='minimax'&&miniVoices.length?miniVoices:voices(draftVoice);
 const toggleControls=()=>setControlsVisible(visible=>!visible);
 useEffect(()=>{
   const handler=BackHandler.addEventListener('hardwareBackPress',()=>{
     if(panel){closePanel();return true;}
     if(controlsVisible){setControlsVisible(false);return true;}
     if(book){returnToShelf();return true;}
     return false;
   });
   return()=>handler.remove();
 },[panel,controlsVisible,book,save,closePanel]);
 // Serif headings use the bundled ReaderSerif face; iOS lays out text once, so wait for registration.
 if(initializing||(!fontsReady&&!fontError))return <SafeAreaView style={[styles.page,{backgroundColor:colors.background}]}><ActivityIndicator style={{flex:1}} color={colors.accent}/></SafeAreaView>;
 return <SafeAreaView edges={identity&&!book?['left','right']:['top','bottom','left','right']} style={[styles.page,{backgroundColor:book?colors.surface:chrome.colors.background}]}><StatusBar style={(book?colors.dark:chrome.scheme==='dark')?'light':'dark'}/>
  {!book&&!identity&&<View style={[styles.header,{borderBottomColor:colors.line}]}>
   {book?<Pressable accessibilityRole="button" accessibilityLabel="返回书架" onPress={()=>{returnToShelf();}} style={styles.iconButton}><Text style={{fontSize:32,color:colors.text}}>‹</Text></Pressable>:<Text style={{fontSize:16,fontWeight:'700',color:colors.accent}}>听页</Text>}
   <Text numberOfLines={1} style={[styles.headerTitle,{color:colors.text}]}>{title}</Text>
   <Pressable accessibilityRole="button" accessibilityLabel="设置" onPress={openSettings} style={styles.iconButton}><Text style={{fontSize:23,color:colors.text}}>⋯</Text></Pressable>
  </View>}
  {!!notice&&(!!book||!identity)&&<Pressable onPress={()=>setNotice('')}><Text selectable style={[styles.notice,{color:colors.text,backgroundColor:colors.highlight}]}>{notice}</Text></Pressable>}
  {!identity?<AccountScreen colors={colors} onSignedIn={signedIn}/>:<View style={{flex:1,display:book?'none':'flex'}}><LibraryUIContext.Provider value={{books:presentedBooks,nativeBooks:books,username:identity.username,busy,notice,...metrics,
      load:loadLibraryBook,open:async(id,initialChapter,listen)=>{const item=books.find(b=>b.id===id);if(!item)return;pendingListen.current=!!listen;await openBook(item,initialChapter);},
      importBooks:()=>{void importBooks().catch(e=>setNotice(errorText(e)));},
      refresh:()=>{void synchronize();},
      actions:id=>{const item=books.find(b=>b.id===id);if(item&&!item.sample)bookActions(item);},
      settings:openSettings,logout:()=>{void logout();},dismissNotice:()=>setNotice('')}}><RootNavigator/></LibraryUIContext.Provider></View>}
  {identity&&book&&<View style={[styles.reader,{backgroundColor:colors.surface}]} testID="immersive-reader">
    {/* 桌面端保留常驻章节栏；移动端为全沉浸正文，顶栏/底栏均为可隐藏的悬浮菜单 */}
    {layout.desktop&&<View style={[styles.readingHeading,{height:52,width:layout.contentWidth,alignSelf:'center',paddingHorizontal:0,flexDirection:'row',alignItems:'center',gap:8}]}>
      <ReaderButton colors={colors} label="书架" onPress={returnToShelf}/>
      <Text numberOfLines={1} style={{flex:1,fontSize:13,color:colors.muted,fontWeight:'600',fontFamily:brand.serif,letterSpacing:.5}}>{currentChapter?.title}</Text>
      <ReaderButton colors={colors} label="目录" onPress={()=>setPanel('toc')}/><ReaderButton colors={colors} label="阅读设置" onPress={openSettings}/>
    </View>}
    {needsOriginalRepair(book)&&<Pressable accessibilityRole="button" onPress={()=>{void repairBook(book);}} style={{paddingHorizontal:18,paddingVertical:8,backgroundColor:colors.highlight}}><Text style={{color:colors.text,fontSize:13}}>这是旧版纯文字副本 · 点此重新导入原书图片、排版与封面</Text></Pressable>}
    <View accessible={false} testID="reading-body" style={[styles.readingBody,{width:layout.contentWidth,alignSelf:'center',marginHorizontal:0}]}
      onLayout={event=>{setPageHeight(event.nativeEvent.layout.height);setPageWidth(event.nativeEvent.layout.width);}}>
      <Pressable accessible={false} testID="reading-empty-space" onPress={toggleControls} style={StyleSheet.absoluteFill}/>
      {currentChapter&&pageWidth>0&&pageHeight>0&&<OriginalReader key={book.id+':'+chapter+':'+repairRevision} ref={originalReader} chapter={currentChapter} pdf={book.pdf} resources={book.resources} chapterIndex={chapter} config={readerConfig} initialOffset={activeRange?.start??0} onPage={paginationReady} onToggle={toggleControls} onPlay={play} onHideControls={()=>setControlsVisible(false)} onBoundary={crossChapter} onLink={followBookLink}/>}
      {/* 沉浸态右下角的极小页码（pointerEvents 透传，不影响轻点显隐菜单） */}
      {!layout.desktop&&<View pointerEvents="none" style={{position:'absolute',right:0,bottom:6}}>
        <Text style={{fontSize:11,color:colors.muted,letterSpacing:.5}}>第 {chapter+1} / {book.chapters.length} 章 · {pageIndex+1} / {readerPage.count} 页</Text>
      </View>}
    </View>
    {/* 悬浮「听」圆钮：菜单隐藏时常驻右下，菜单展开时隐藏避免与底栏重叠 */}
    {!layout.desktop&&!controlsVisible&&<View pointerEvents="box-none" style={{position:'absolute',right:16,bottom:40}}>
      <ListenFab colors={colors} player={player} onPress={play} onLongPress={openPlayer}/>
    </View>}
    {layout.desktop&&<View style={[styles.readingFooter,{height:layout.compactHeight?48:60,paddingHorizontal:layout.gutter,width:layout.contentWidth+2*layout.gutter,alignSelf:'center'}]}>
      <Pressable accessibilityRole="button" accessibilityLabel={controlsVisible?'隐藏功能栏':'显示功能栏'} onPress={toggleControls} style={styles.readingProgress}><Text style={{fontSize:11,color:colors.muted}}>第 {chapter+1} / {book.chapters.length} 章 · {pageIndex+1} / {readerPage.count} 页</Text><Text numberOfLines={1} style={{fontSize:10,color:colors.muted,marginTop:4}}>{player.active?(player.timingNotice?'整句高亮 · 进度估算':'整句高亮 · 朗读同步'):'正文内：← → / PgUp PgDn 翻页 · 空格 听/停 · M 菜单 · Esc 隐藏'}</Text></Pressable>
      <View style={{flexDirection:'row',gap:8,marginRight:12}}><ReaderButton colors={colors} label="上一页" onPress={()=>turn(-1)}/><ReaderButton colors={colors} label="下一页" onPress={()=>turn(1)}/></View>
      {!controlsVisible&&<ListenFab colors={colors} player={player} onPress={play} onLongPress={openPlayer}/>}
    </View>}
    {controlsVisible&&<>
      <ReaderTopBar colors={colors} title={book.title} subtitle={currentChapter?.title} left={(width-layout.controlsWidth)/2} right={(width-layout.controlsWidth)/2} onBack={returnToShelf} onListen={openPlayer} onMore={openSettings}/>
      <ReaderBottomPanel colors={colors} left={(width-layout.controlsWidth)/2} right={(width-layout.controlsWidth)/2} compact={width<360}
        chapter={chapter} chapterCount={book.chapters.length} player={player}
        onPrevChapter={()=>crossChapter(-1)} onNextChapter={()=>crossChapter(1)} onSeekChapter={ci=>{if(ci!==chapter)jump(ci);}}
        onToc={()=>setPanel('toc')} onListen={openPlayer} onNight={()=>setPrefs(p=>({...p,theme:colors.dark?'paper':'ink'}))} onType={()=>setPanel('type')} onMore={openSettings}/>
    </>}
    {!!player.error&&<ReaderErrorBanner colors={colors} message={player.error} bottom={controlsVisible?190:104} onOpenSettings={openSettings} onRetry={()=>{void play();}}/>}
    <PlayerSheet visible={playerOpen} colors={colors} title={book.title} author={book.author} chapterTitle={currentChapter?.title}
      sentences={playerSentences} position={player.active?position:Math.max(0,ranges.findIndex(r=>r.end>pageStart))}
      rate={prefs.voice.rate} voiceLabel={voiceLabel} player={player} onClose={()=>setPlayerOpen(false)}
      onPlay={()=>{if(player.active)readerPlayer.togglePause();else play();}} onSeek={listenFrom}
      onPrevChapter={()=>playerChapter(-1)} onNextChapter={()=>playerChapter(1)} onRate={cycleRate} onDismiss={runAfterPlayer}
      onVoice={()=>afterPlayer(openSettings)} onToc={()=>afterPlayer(()=>setPanel('toc'))}/>
  </View>}
  <ReaderPanel visible={!!panel} title={panel==='toc'?'目录':panel==='rate'?'朗读语速':panel==='type'?'阅读设置':'听书与更多设置'} colors={colors} width={width} wide={layout.widePanel} panelWidth={layout.panelWidth} onClose={closePanel}>
    {panel==='rate'?<ScrollView contentContainerStyle={{padding:24,gap:20}}><Text style={{color:colors.text,fontSize:18}}>当前语速 {prefs.voice.rate}×</Text><View style={styles.chips}>{[.5,.75,1,1.25,1.5,1.75,2].map(rate=><ReaderButton colors={colors} key={rate} label={rate+'×'} primary={prefs.voice.rate===rate} onPress={()=>changeRate(rate)}/>)}</View><Text style={{color:colors.muted}}>调整后立即应用；本地语音从当前词语继续朗读。</Text></ScrollView>:panel==='toc'?<FlatList data={book?.chapters} keyExtractor={(_,i)=>String(i)} renderItem={({item,index})=><Pressable accessibilityRole="button" onPress={()=>jump(index)} style={[styles.tocRow,{borderBottomColor:colors.line,backgroundColor:chapter===index?colors.highlight:undefined,flexDirection:'row',alignItems:'center',gap:12}]}><Text style={{color:chapter===index?colors.accent:colors.muted,fontSize:13,minWidth:28}}>{index+1}</Text><Text numberOfLines={2} style={{flex:1,color:colors.text,fontSize:16,fontFamily:brand.serif,fontWeight:chapter===index?'700':'400'}}>{item.title}</Text>{chapter===index&&<Icon name="headphones" size={16} color={colors.accent}/>}</Pressable>}/>:panel==='type'?<ReadingAppearancePanel prefs={prefs} setPrefs={setPrefs} colors={colors} fontsReady={!!fontsReady} onChooseTheme={chooseReadingTheme} onToggleEink={toggleEink}/>:<ScrollView contentContainerStyle={{padding:24,gap:20}} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
     {player.active&&<View style={[styles.settingsPlayback,{borderColor:colors.line,backgroundColor:colors.surface}]}><View style={{flex:1}}><Text style={{color:colors.text,fontWeight:'600'}}>{player.paused?'已暂停':player.buffering?'正在准备声音…':'听书继续播放中'}</Text><Text style={{color:colors.muted,fontSize:12,marginTop:6}}>调整字号和背景不会中断声音</Text></View><ReaderButton colors={colors} label={player.paused?'继续':'暂停'} onPress={()=>readerPlayer.togglePause()}/></View>}
     <Pressable accessibilityRole="button" onPress={()=>{if(applyDraftVoice())setPanel('type');}} style={[styles.settingsPlayback,{borderColor:colors.eink?colors.text:colors.line,borderWidth:colors.eink?1.5:1,backgroundColor:colors.surface}]}><Icon name="type" size={22} color={colors.text}/><View style={{flex:1}}><Text style={{color:colors.text,fontWeight:'600'}}>阅读外观与排版</Text><Text style={{color:colors.muted,fontSize:12,marginTop:4}}>字号 · 背景 · 电纸书模式 · 字体行距</Text></View><Icon name="chev" size={18} color={colors.muted}/></Pressable>
     <Text style={[styles.label,{color:colors.muted}]}>语速</Text><View style={styles.chips}>{[.5,.75,1,1.25,1.5,1.75,2].map(rate=><ReaderButton colors={colors} key={rate} label={rate+'×'} primary={prefs.voice.rate===rate} onPress={()=>changeRate(rate)}/>)}</View>
     <Text style={{color:colors.muted,lineHeight:22,fontSize:13}}>{prefs.voice.provider==='system'?'本地语音立即应用新语速，从当前词语继续。':'语速立即生效，保留当前播放位置。1× 更接近音色原本的节奏。'}</Text>
     {player.active&&!!player.timingNotice&&<Text style={{color:colors.muted,lineHeight:22}}>{player.timingNotice} 高亮始终显示整句，翻页跟随句内朗读位置。GLM 时间戳在后台分析，不等待识别即可播放；未取得时间戳时使用估算进度。</Text>}
     <CloudConnection colors={colors}/>
     <Text style={[styles.label,{color:colors.muted}]}>语音服务</Text><View style={styles.chips}>{(['system','glm','minimax'] as const).map((provider,i)=><ReaderButton colors={colors} key={provider} label={['本地语音','GLM','MiniMax'][i]} primary={draftVoice.provider===provider} onPress={()=>chooseProvider(provider)}/>)}</View>
     {draftVoice.provider!=='system'&&<><Text style={[styles.label,{color:colors.muted}]}>{draftVoice.provider==='glm'?'GLM API 密钥':'MiniMax API 密钥'}</Text><TextInput value={draftVoice.apiKey||''} onChangeText={apiKey=>changeVoice({...draftVoice,apiKey:apiKey.trim()})} placeholder={draftVoice.provider==='glm'?'在智谱开放平台创建 API Key':'在 MiniMax 开放平台创建 API Key'} placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} secureTextEntry style={[styles.input,{color:colors.text,borderColor:colors.line}]}/></>}
     {draftVoice.provider==='minimax'&&<><Text style={[styles.label,{color:colors.muted}]}>MiniMax GroupId</Text><TextInput value={draftVoice.groupId||''} onChangeText={groupId=>changeVoice({...draftVoice,groupId:groupId.trim()})} placeholder="MiniMax 开放平台用户中心查看 GroupId" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} style={[styles.input,{color:colors.text,borderColor:colors.line}]}/></>}
     {draftVoice.provider!=='system'&&<Text style={{color:colors.muted,fontSize:12,lineHeight:18}}>密钥仅保存在本机安全存储，合成时随请求经听页云端转发给语音服务商，云端不存储。</Text>}
     {draftVoice.provider!=='system'&&<><Text style={[styles.label,{color:colors.muted}]}>模型</Text><View style={styles.chips}>{(MODEL_OPTIONS[draftVoice.provider]||[]).map(m=><ReaderButton colors={colors} key={m.value} label={m.label} primary={draftVoice.model===m.value} onPress={()=>changeVoice({...draftVoice,model:m.value})}/>)}</View><TextInput value={draftVoice.model} onChangeText={model=>changeVoice({...draftVoice,model})} placeholder="模型名称 / 自定义模型 ID" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} style={[styles.input,{color:colors.text,borderColor:colors.line}]}/></>}
     {draftVoice.provider==='minimax'&&<><ReaderButton colors={colors} label={voicesBusy?'正在获取音色…':'刷新全部音色'} disabled={voicesBusy} onPress={()=>{void loadMiniVoices();}}/>{!!voiceNotice&&<Text style={{color:colors.muted}}>{voiceNotice}</Text>}</>}
     <Text style={[styles.label,{color:colors.muted}]}>音色</Text><View style={styles.chips}>{selectedVoices.map(v=><ReaderButton colors={colors} key={v.value} label={v.label} primary={draftVoice.voice===v.value} onPress={()=>changeVoice({...draftVoice,voice:v.value})}/>)}</View>
     {draftVoice.provider!=='system'&&<TextInput value={draftVoice.voice} onChangeText={voice=>changeVoice({...draftVoice,voice})} placeholder="音色名称 / 自定义音色 ID" placeholderTextColor={colors.muted} autoCapitalize="none" style={[styles.input,{color:colors.text,borderColor:colors.line}]}/>}
     <Text style={{color:colors.muted,lineHeight:24}}>点“完成”后应用密钥、模型和音色。正在听书时会从当前句重新开始；已暂停时保持暂停。云端语音按段落预合成，使用上方填写的密钥，费用由对应服务商账户承担。</Text>
     {identity&&<><Text selectable style={{color:colors.text}}>当前账号：{identity.username}</Text><Text style={{color:colors.muted}}>听页 {appConfig.expo.version} · 本机书籍 · 云端进度同步</Text><ReaderButton colors={colors} label="退出登录 / 切换账号" onPress={()=>{void logout();}}/></>}
    </ScrollView>}
  </ReaderPanel>
 </SafeAreaView>;
}
