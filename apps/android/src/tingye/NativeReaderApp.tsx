import { DisplayText as Text } from '../components/DisplayText';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, FlatList, Linking, Modal, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import * as Speech from 'expo-speech';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, restoreSession, signOut, clearSession, type Session } from './client';
import AccountScreen from './AccountScreen';
import CloudConnection from './CloudConnection';
import RootNavigator from '../navigation/RootNavigator';
import {LibraryUIContext,presentLibrary,useReadingMetrics} from './library-ui';
import {useAppTheme} from '../theme/useAppTheme';
import {nativeLibrary} from './native-library';
import { samples, sentences, type Book } from './books';
import { parseBook } from './import-book';
import { defaultVoice, normalizeVoice, voices, type VoiceConfig, type VoiceOption } from './voices';
import { readerPlayer, usePlayer } from './player';
import { sentenceRanges } from './pagination';
import { readingTheme, readingThemes, type ReadingTheme } from './themes';
import { voiceSourceChanged } from './playback-settings';
import OriginalReader,{type OriginalReaderHandle,type ReaderPage} from './OriginalReader';
import {resourcePath} from './original-document';
import ReadingTypographySettings from './ReadingTypographySettings';
import {useReaderFonts} from './reader-fonts';
import {defaultTypography,normalizeTypography,type Typography} from './typesetting';

import {adaptiveReaderLayout} from './reader-layout';

type Preferences = { fontSize:number; theme:string; voice:VoiceConfig;typography:Typography;originalLayout:boolean;spreadMode:'auto'|'single' };
const initial:Preferences = {fontSize:22,theme:'paper',voice:defaultVoice,typography:defaultTypography,originalLayout:true,spreadMode:'auto'};
const errorText=(e:unknown)=>e instanceof Error?e.message:'操作失败，请重试。';

export default function NativeReaderApp(){
 const {width:windowWidth,height}=useWindowDimensions();
 const insets=useSafeAreaInsets(),width=windowWidth-insets.left-insets.right;
 const [identity,setIdentity]=useState<Session['user']|null>(null),[initializing,setInitializing]=useState(true),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [books,setBooks]=useState<Book[]>(samples),[book,setBook]=useState<Book|null>(null),[chapter,setChapter]=useState(0),[position,setPosition]=useState(0);
 const [prefs,setPrefs]=useState(initial),[panel,setPanel]=useState<'settings'|'toc'|'rate'|null>(null),[voiceList,setVoiceList]=useState<Speech.Voice[]>([]),[miniVoices,setMiniVoices]=useState<VoiceOption[]>([]),[voicesBusy,setVoicesBusy]=useState(false),[voiceNotice,setVoiceNotice]=useState('');
 const [pageStart,setPageStart]=useState(0),[pageEnds,setPageEnds]=useState<number[]>([]),[pageHeight,setPageHeight]=useState(0),[pageWidth,setPageWidth]=useState(0);
 const [controlsVisible,setControlsVisible]=useState(false);
 const originalReader=useRef<OriginalReaderHandle>(null);
 const [readerPage,setReaderPage]=useState<ReaderPage>({index:0,count:1,start:0,end:0});
 const [fontsReady,fontError]=useReaderFonts();
 const layout=adaptiveReaderLayout(width,height,prefs.typography.margin,prefs.spreadMode==='single');

 const [readingCursor,setReadingCursor]=useState<{chapter:number;offset:number}|null>(null);
 const [draftVoice,setDraftVoice]=useState<VoiceConfig>(defaultVoice);
 const player=usePlayer(),colors=readingTheme(prefs.theme);
 const latest=useRef({book,chapter,position});latest.current={book,chapter,position};
 const pendingProgress=useRef<ReturnType<typeof setTimeout>|null>(null),progressQueue=useRef(Promise.resolve());
 const prefsReady=useRef(false);
 const library=useRef<ReturnType<typeof nativeLibrary>|null>(null);
 const chrome=useAppTheme();
 const metrics=useReadingMetrics(identity?.userId,!!book);
 const presentedBooks=useMemo(()=>presentLibrary(books),[books]);
 const loadLibraryBook=useCallback(async(id:string)=>{const shelf=library.current;if(!shelf)throw Error('请先登录');return shelf.open(id);},[]);
 const returnToShelf=()=>{readerPlayer.stop();save();setBook(null);void progressQueue.current.then(reload);};
 const currentChapter=book?.chapters[chapter];
 const ranges=useMemo(()=>sentenceRanges(currentChapter?.text||''),[currentChapter]);
 const reload=useCallback(async()=>{const shelf=library.current;if(!shelf)return;setBooks(await shelf.list());const result=await shelf.list(true);if(library.current===shelf)setBooks(result);},[]);
 const save=useCallback(()=>{
   const p=latest.current;if(!p.book)return;
   const shelf=library.current;if(!shelf)return;
   progressQueue.current=progressQueue.current.catch(()=>{}).then(()=>shelf.progress(p.book!,p.chapter,p.position)).catch(e=>setNotice(`本机进度保存失败：${errorText(e)}`));
 },[]);
 useEffect(()=>{
   let disposed=false;
   const initialization=(async()=>{try{
     const stored=await AsyncStorage.getItem('tingye.native.preferences.v1');if(stored){const p=JSON.parse(stored);setPrefs({...initial,...p,theme:readingTheme(p.theme,p.night===true).id,fontSize:Math.max(16,Math.min(30,Number(p.fontSize)||22)),voice:normalizeVoice(p.voice),typography:normalizeTypography(p.typography)});}
     const saved=await restoreSession();if(saved){library.current=nativeLibrary(saved.user.userId);setIdentity(saved.user);setBooks(await library.current.list());
      try{const verified=await api<{user:Session['user']|null}>('/api/auth',{signal:AbortSignal.timeout(7000)});if(!verified.user){await clearSession();library.current=null;setIdentity(null);setBooks(samples);setNotice('登录已过期，请重新登录。');}else void reload();}catch{setNotice('云端暂时不可用，已下载书籍可继续阅读。');}
     }
   }catch(e){setNotice(errorText(e));}finally{prefsReady.current=true;setInitializing(false);}})();
   void Speech.getAvailableVoicesAsync().then(setVoiceList).catch(()=>{});
   const sub=AppState.addEventListener('change',state=>{if(state!=='active')save();else void library.current?.flush();});
   const retry=setInterval(()=>{void library.current?.flush();},30000);
   return()=>{disposed=true;clearInterval(retry);sub.remove();readerPlayer.stop();if(pendingProgress.current)clearTimeout(pendingProgress.current);save();};
 },[reload,save]);
 useEffect(()=>{if(prefsReady.current)void AsyncStorage.setItem('tingye.native.preferences.v1',JSON.stringify(prefs)).catch(()=>{});},[prefs]);
 useEffect(()=>{if(!book||pendingProgress.current)return;pendingProgress.current=setTimeout(()=>{pendingProgress.current=null;save();},800);},[book,chapter,position,save]);
 useEffect(()=>{readerPlayer.onPosition=(ci,si,offset)=>{setChapter(ci);setPosition(si);setReadingCursor({chapter:ci,offset});};return()=>{readerPlayer.onPosition=null;};},[]);
 useEffect(()=>{setPageStart(0);setPageEnds([]);setReaderPage({index:0,count:1,start:0,end:0});},[chapter,book?.id]);
 useEffect(()=>{readerPlayer.stop();setReadingCursor(null);},[book?.id]);
 const activeRange=ranges[position];
 const pageIndex=readerPage.index;
 const readerConfig=useMemo(()=>({fontSize:prefs.fontSize,typography:prefs.typography,colors,original:prefs.originalLayout,spread:layout.spread}),[prefs.fontSize,prefs.typography,colors,prefs.originalLayout,layout.spread]);
 const paginationReady=useCallback((next:ReaderPage)=>{setReaderPage(next);setPageStart(next.anchor??next.start);setPageEnds([next.end]);if(next.manual)readerPlayer.stop();if(!player.active||next.manual){const si=ranges.findIndex(r=>r.end>(next.anchor??next.start));setPosition(Math.max(0,si));}},[ranges,player.active]);
 const signedIn=(next:Session)=>{readerPlayer.clearCache();setBook(null);library.current=nativeLibrary(next.user.userId);setIdentity(next.user);setNotice('');setBooks(samples);void reload().catch(e=>setNotice(errorText(e)));};
 const openBook=async(item:Book,initialChapter?:number)=>{const shelf=library.current;if(busy||!shelf)return;readerPlayer.stop();save();await progressQueue.current;setBusy(true);setNotice('');try{const b=await shelf.open(item.id);if(library.current!==shelf)return;setBook(b);setControlsVisible(false);setChapter(Math.max(0,Math.min(initialChapter??b.chapter??0,b.chapters.length-1)));setPosition(initialChapter===undefined?(b.position||0):0);}catch(e){setNotice(errorText(e));}finally{setBusy(false);}};
 const importBooks=async()=>{if(busy||!library.current)return;const selection=await DocumentPicker.getDocumentAsync({type:'*/*',multiple:true,copyToCacheDirectory:true});if(selection.canceled)return;setBusy(true);setNotice('');const failures:string[]=[];let imported=0;for(const asset of selection.assets){try{const b=await parseBook(asset.uri,asset.name);await library.current.importBook(b);imported++;}catch(e){failures.push(`${asset.name}：${errorText(e)}`);}}setBooks(await library.current.list());setNotice([imported?`已保存 ${imported} 本到手机。点击“同步”上传正文和进度，再在其他设备点击同步。`:'',...failures].filter(Boolean).join('\n'));setBusy(false);};
 const synchronize=async()=>{const shelf=library.current;if(busy||!shelf)return;setBusy(true);setNotice('正在同步正文与阅读进度…');try{save();await progressQueue.current;const r=await shelf.synchronize();if(library.current!==shelf)return;setBooks(r.books);setNotice([`${r.errors.length||r.missing.length?'同步部分完成':'同步完成'}：上传 ${r.uploaded} 本，下载 ${r.downloaded} 本，已核对阅读进度。`,r.missing.length?`${r.missing.length} 本尚无云端正文，请先在原设备升级后点击同步：${r.missing.slice(0,5).join('、')}`:'',...r.errors.slice(0,5)].filter(Boolean).join('\n'));}catch(e){if(library.current===shelf)setNotice('同步失败：'+errorText(e));}finally{if(library.current===shelf)setBusy(false);}};
 const removeBook=(item:Book)=>Alert.alert('移除书籍',`删除《${item.title}》的本机副本、云端备份及进度？`,[{text:'取消',style:'cancel'},{text:'删除',style:'destructive',onPress:()=>{void library.current?.remove(item.id).then(()=>library.current?.list()).then(result=>{if(result)setBooks(result);}).catch(e=>setNotice(errorText(e)));}}]);
 const bookActions=(item:Book)=>{if(busy)return;Alert.alert(item.title,'本机书籍可以离线阅读；备份后可在网页和其他设备恢复。',[{text:'云端备份',onPress:()=>{setBusy(true);void library.current?.backup(item.id).then(()=>{setNotice('云端备份完成。');return reload();}).catch(e=>setNotice(errorText(e))).finally(()=>setBusy(false));}},{text:'移除书籍',style:'destructive',onPress:()=>removeBook(item)},{text:'取消',style:'cancel'}]);};
 const jump=(ci:number,si=0)=>{readerPlayer.stop();setChapter(ci);setPosition(si);setPageStart(0);setPageEnds([]);setPanel(null);};
 const crossChapter=(delta:number)=>{readerPlayer.stop();if(book&&chapter+delta>=0&&chapter+delta<book.chapters.length)jump(chapter+delta,delta<0?Math.max(0,sentences(book.chapters[chapter+delta].text).length-1):0);};
 const turn=(delta:number)=>{readerPlayer.stop();originalReader.current?.turn(delta);};
 const play=()=>{if(!book||!pageEnds.length)return;setControlsVisible(false);if(player.active&&player.buffering)readerPlayer.stop();else if(player.active)readerPlayer.togglePause();else{const si=ranges.findIndex(r=>r.end>pageStart);setPosition(Math.max(0,si));void readerPlayer.start(book,chapter,Math.max(0,si),prefs.voice,{startOffset:pageStart});}};
 const selectOffset=(offset:number)=>{readerPlayer.stop();const si=ranges.findIndex(r=>r.end>offset);setPosition(Math.max(0,si));originalReader.current?.seek(offset);setControlsVisible(true);};
 const followBookLink=(href:string)=>{if(!book)return;const target=resourcePath(currentChapter?.document?.path||'',href);const ci=book.chapters.findIndex(c=>c.document?.path===target);if(ci>=0)jump(ci);};
 const openSettings=()=>{setDraftVoice({...prefs.voice});setVoiceNotice('');setPanel('settings');};
 const changeVoice=(voice:VoiceConfig)=>setDraftVoice(voice);
 const changeRate=(rate:number)=>{readerPlayer.setRate(rate);setPrefs(p=>({...p,voice:{...p.voice,rate}}));setDraftVoice(v=>({...v,rate}));};
 const closePanel=()=>{
   if(panel==='settings'){
     const voice={...draftVoice,model:draftVoice.model.trim(),voice:draftVoice.voice.trim()};
     if(voice.provider!=='system'&&(!voice.model||!voice.voice)){Alert.alert('请补全语音设置','模型和音色不能为空。');return;}
     const changed=voiceSourceChanged(prefs.voice,voice),state=readerPlayer.snapshot(),current=latest.current;
     setPrefs(p=>({...p,voice}));
     if(changed&&state.active&&current.book){
       const start=sentenceRanges(current.book.chapters[state.chapter].text)[state.position]?.start??0;
       void readerPlayer.start(current.book,state.chapter,state.position,voice,{startOffset:start,paused:state.paused});
     }
   }
   setPanel(null);
 };
 const chooseProvider=(provider:VoiceConfig['provider'])=>{const model=provider==='glm'?'glm-tts':provider==='minimax'?'speech-2.8-hd':'';const next={provider,model,voice:'',rate:draftVoice.rate};next.voice=voices(next)[0]?.value||'';changeVoice(next);setVoiceNotice('');};
 const loadMiniVoices=async()=>{setVoicesBusy(true);setVoiceNotice('');try{const data=await api<{voices:VoiceOption[]}>('/api/tts/voices',{method:'POST',body:JSON.stringify({provider:'minimax'})});setMiniVoices(data.voices);setVoiceNotice('已加载 '+data.voices.length+' 个可用音色');}catch(e){setVoiceNotice(errorText(e));}finally{setVoicesBusy(false);}};
 useEffect(()=>{if(panel==='settings'&&draftVoice.provider==='minimax'&&!miniVoices.length)void loadMiniVoices();},[panel,draftVoice.provider]);
 const logout=async()=>{readerPlayer.clearCache();save();await progressQueue.current;try{await signOut();library.current=null;setIdentity(null);setBook(null);setBooks(samples);setPanel(null);setNotice('');setMiniVoices([]);}catch(e){setNotice(errorText(e));}};
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
 if(initializing)return <SafeAreaView style={[styles.page,{backgroundColor:colors.background}]}><ActivityIndicator style={{flex:1}} color={colors.accent}/></SafeAreaView>;
 return <SafeAreaView edges={identity&&!book?['left','right']:['top','bottom','left','right']} style={[styles.page,{backgroundColor:book?colors.surface:chrome.colors.background}]}><StatusBar style={(book?colors.dark:chrome.scheme==='dark')?'light':'dark'}/>
  {!book&&!identity&&<View style={[styles.header,{borderBottomColor:colors.line}]}>
   {book?<Pressable accessibilityRole="button" accessibilityLabel="返回书架" onPress={()=>{returnToShelf();}} style={styles.iconButton}><Text style={{fontSize:32,color:colors.text}}>‹</Text></Pressable>:<Text style={{fontSize:16,fontWeight:'700',color:colors.accent}}>听页</Text>}
   <Text numberOfLines={1} style={[styles.headerTitle,{color:colors.text}]}>{title}</Text>
   <Pressable accessibilityRole="button" accessibilityLabel="设置" onPress={openSettings} style={styles.iconButton}><Text style={{fontSize:23,color:colors.text}}>⋯</Text></Pressable>
  </View>}
  {!!notice&&(!!book||!identity)&&<Pressable onPress={()=>setNotice('')}><Text selectable style={[styles.notice,{color:colors.text,backgroundColor:colors.highlight}]}>{notice}</Text></Pressable>}
  {!identity?<AccountScreen colors={colors} onSignedIn={signedIn}/>:!book?<LibraryUIContext.Provider value={{books:presentedBooks,nativeBooks:books,username:identity.username,busy,notice,...metrics,
      load:loadLibraryBook,open:async(id,initialChapter)=>{const item=books.find(b=>b.id===id);if(item)await openBook(item,initialChapter);},
      importBooks:()=>{void importBooks().catch(e=>setNotice(errorText(e)));},
      refresh:()=>{void synchronize();},
      actions:id=>{const item=books.find(b=>b.id===id);if(item&&!item.sample)bookActions(item);},
      settings:openSettings,logout:()=>{void logout();},dismissNotice:()=>setNotice('')}}><RootNavigator/></LibraryUIContext.Provider>:<View style={[styles.reader,{backgroundColor:colors.surface}]} testID="immersive-reader">
    <View style={[styles.readingHeading,{height:layout.desktop?52:layout.compactHeight?24:34,width:layout.contentWidth,alignSelf:'center',paddingHorizontal:0,flexDirection:'row',alignItems:'center',gap:8}]}>
      {layout.desktop&&<ReaderButton colors={colors} label="书架" onPress={returnToShelf}/>}
      <Text numberOfLines={1} style={{flex:1,fontSize:14,color:colors.accent,fontWeight:'600'}}>{currentChapter?.title}</Text>
      {layout.desktop&&<><ReaderButton colors={colors} label="目录" onPress={()=>setPanel('toc')}/><ReaderButton colors={colors} label="阅读设置" onPress={openSettings}/></>}
    </View>
    <View accessible={false} testID="reading-body" style={[styles.readingBody,{width:layout.contentWidth,alignSelf:'center',marginHorizontal:0}]}
      onLayout={event=>{setPageHeight(event.nativeEvent.layout.height);setPageWidth(event.nativeEvent.layout.width);}}>
      <Pressable accessible={false} testID="reading-empty-space" onPress={toggleControls} style={StyleSheet.absoluteFill}/>
      {currentChapter&&pageWidth>0&&pageHeight>0&&<OriginalReader key={book.id+':'+chapter} ref={originalReader} chapter={currentChapter} pdf={book.pdf} resources={book.resources} chapterIndex={chapter} config={readerConfig} initialOffset={activeRange?.start??0} offset={player.active&&readingCursor?.chapter===chapter?readingCursor.offset:undefined} highlight={player.active?activeRange:undefined} onPage={paginationReady} onToggle={toggleControls} onPlay={play} onHideControls={()=>setControlsVisible(false)} onBoundary={crossChapter} onSelect={selectOffset} onLink={followBookLink}/>}

    </View>
    <View style={[styles.readingFooter,{height:layout.compactHeight?48:60,paddingHorizontal:layout.gutter,width:layout.contentWidth+2*layout.gutter,alignSelf:'center'}]}>
      <Pressable accessibilityRole="button" accessibilityLabel={controlsVisible?'隐藏功能栏':'显示功能栏'} onPress={toggleControls} style={styles.readingProgress}><Text style={{fontSize:11,color:colors.muted}}>第 {chapter+1} / {book.chapters.length} 章 · {pageIndex+1} / {readerPage.count} 页</Text><Text style={{fontSize:10,color:colors.muted,marginTop:4}}>{layout.desktop?'正文内：← → / PgUp PgDn 翻页 · 空格 听/停 · M 菜单 · Esc 隐藏':'轻点正文显隐菜单 · 左右滑动翻页'}</Text></Pressable>
      {layout.desktop&&<View style={{flexDirection:'row',gap:8,marginRight:12}}><ReaderButton colors={colors} label="上一页" onPress={()=>turn(-1)}/><ReaderButton colors={colors} label="下一页" onPress={()=>turn(1)}/></View>}
      {!controlsVisible&&<Pressable accessibilityRole="button" accessibilityLabel={player.active&&!player.paused?'暂停朗读':'开始朗读'} onPress={play} style={[styles.listenBubble,{backgroundColor:colors.accent}]}>{player.buffering?<ActivityIndicator color={colors.onAccent}/>:<Text style={{color:colors.onAccent,fontSize:21,fontWeight:'500'}}>{player.active&&!player.paused?'Ⅱ':'听'}</Text>}</Pressable>}
    </View>
    {controlsVisible&&<>
      <View testID="reader-top-toolbar" style={[styles.readerTopToolbar,{left:(width-layout.controlsWidth)/2,right:(width-layout.controlsWidth)/2,backgroundColor:colors.background,borderBottomColor:colors.line}]}>
        <Pressable accessibilityRole="button" accessibilityLabel="返回书架" onPress={()=>{returnToShelf();}} style={styles.iconButton}><Text style={{fontSize:32,color:colors.text}}>‹</Text></Pressable>
        <Text numberOfLines={1} style={{flex:1,fontSize:16,fontWeight:'600',color:colors.text}}>{book.title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="设置" onPress={openSettings} style={styles.iconButton}><Text style={{fontSize:25,color:colors.text}}>⋯</Text></Pressable>
      </View>
      <View testID="reader-bottom-toolbar" style={[styles.readerBottomToolbar,{left:(width-layout.controlsWidth)/2,right:(width-layout.controlsWidth)/2,paddingHorizontal:width<360?10:22,backgroundColor:colors.background,borderTopColor:colors.line}]}>
        <View style={styles.readerPageNavigation}><Pressable accessibilityRole="button" accessibilityLabel="上一页" onPress={()=>turn(-1)} style={styles.iconButton}><Text style={{color:colors.text}}>‹ 上一页</Text></Pressable><Text style={{fontSize:12,color:colors.muted}}>{pageIndex+1} / {readerPage.count}</Text><Pressable accessibilityRole="button" accessibilityLabel="下一页" onPress={()=>turn(1)} style={styles.iconButton}><Text style={{color:colors.text}}>下一页 ›</Text></Pressable></View>
        <View style={styles.readerTools}>
          <ReaderTool colors={colors} symbol="☰" label="目录" onPress={()=>setPanel('toc')}/>
          <ReaderTool colors={colors} symbol={colors.dark?'☼':'☾'} label={colors.dark?'日间':'夜间'} onPress={()=>setPrefs(p=>({...p,theme:colors.dark?'paper':'ink'}))}/>
          <Pressable accessibilityRole="button" accessibilityLabel={player.active&&!player.paused?'暂停朗读':'开始朗读'} onPress={play} style={[styles.listenBubble,{backgroundColor:colors.accent}]}>{player.buffering?<ActivityIndicator color={colors.onAccent}/>:<Text style={{color:colors.onAccent,fontSize:21}}>{player.active&&!player.paused?'Ⅱ':'听'}</Text>}</Pressable>
          <ReaderTool colors={colors} symbol="Aa" label="字体 / 排版" onPress={openSettings}/>
          <ReaderTool colors={colors} symbol={prefs.voice.rate+"×"} label="语速" onPress={()=>{setDraftVoice({...prefs.voice});setPanel('rate');}}/>
        </View>
      </View>
    </>}
    {!!player.error&&<ReaderErrorBanner colors={colors} message={player.error} bottom={controlsVisible?120:66} onOpenSettings={openSettings} onRetry={()=>{void play();}}/>}
  </View>}
  <Modal visible={!!panel} transparent animationType="fade" supportedOrientations={['portrait','landscape']} onRequestClose={closePanel}>
   <SafeAreaProvider><View style={{flex:1,backgroundColor:layout.widePanel?'rgba(0,0,0,.28)':colors.background,alignItems:'flex-end'}}>
   <Pressable accessibilityRole="button" accessibilityLabel="关闭面板" onPress={closePanel} style={StyleSheet.absoluteFill}/>
   <SafeAreaView style={[styles.page,{width:layout.widePanel?layout.panelWidth:'100%',backgroundColor:colors.background}]}>
    <View style={styles.modalHeader}><Text style={{flex:1,fontSize:width<360?19:23,fontWeight:'600',color:colors.text}}>{panel==='toc'?'目录':panel==='rate'?'朗读语速':'阅读与听书设置'}</Text><ReaderButton colors={colors} label="完成" onPress={closePanel}/></View>
    {panel==='rate'?<ScrollView contentContainerStyle={{padding:24,gap:20}}><Text style={{color:colors.text,fontSize:18}}>当前语速 {prefs.voice.rate}×</Text><View style={styles.chips}>{[.5,.75,1,1.25,1.5,1.75,2].map(rate=><ReaderButton colors={colors} key={rate} label={rate+'×'} primary={prefs.voice.rate===rate} onPress={()=>changeRate(rate)}/>)}</View><Text style={{color:colors.muted}}>调整后立即应用；本地语音从当前词语继续朗读。</Text></ScrollView>:panel==='toc'?<FlatList data={book?.chapters} keyExtractor={(_,i)=>String(i)} renderItem={({item,index})=><Pressable accessibilityRole="button" onPress={()=>jump(index)} style={[styles.tocRow,{borderBottomColor:colors.line,backgroundColor:chapter===index?colors.highlight:undefined}]}><Text style={{color:colors.text,fontSize:17}}>{index+1}　{item.title}</Text></Pressable>}/>:<ScrollView contentContainerStyle={{padding:24,gap:20}} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
     {player.active&&<View style={[styles.settingsPlayback,{borderColor:colors.line,backgroundColor:colors.surface}]}><View style={{flex:1}}><Text style={{color:colors.text,fontWeight:'600'}}>{player.paused?'已暂停':player.buffering?'正在准备声音…':'听书继续播放中'}</Text><Text style={{color:colors.muted,fontSize:12,marginTop:6}}>调整字号和背景不会中断声音</Text></View><ReaderButton colors={colors} label={player.paused?'继续':'暂停'} onPress={()=>readerPlayer.togglePause()}/></View>}
     <Text style={[styles.label,{color:colors.muted}]}>书籍排版</Text><View style={styles.chips}><ReaderButton colors={colors} label="原书图文" primary={prefs.originalLayout} onPress={()=>setPrefs(p=>({...p,originalLayout:true}))}/><ReaderButton colors={colors} label="自定义阅读" primary={!prefs.originalLayout} onPress={()=>setPrefs(p=>({...p,originalLayout:false}))}/></View><Text style={{color:colors.muted,fontSize:13}}>原书图文保留 EPUB 样式、图片和表格。切换自定义阅读可应用下方字体、行距；PDF 保留原始页面，可双指缩放。</Text>
     <Text style={[styles.label,{color:colors.muted}]}>展开阅读</Text><View style={styles.chips}><ReaderButton colors={colors} label="自动双页" primary={prefs.spreadMode!=='single'} onPress={()=>setPrefs(p=>({...p,spreadMode:'auto'}))}/><ReaderButton colors={colors} label="始终单页" primary={prefs.spreadMode==='single'} onPress={()=>setPrefs(p=>({...p,spreadMode:'single'}))}/></View><Text style={{color:colors.muted,fontSize:13}}>宽屏自动并排显示两页，合屏回到单页并保留当前阅读位置。PDF 和固定版式 EPUB 保留原页。</Text>
     <Text style={[styles.label,{color:colors.muted}]}>字号</Text><View style={styles.chips}><ReaderButton colors={colors} label="A−" onPress={()=>setPrefs(p=>({...p,originalLayout:false,fontSize:Math.max(16,p.fontSize-2)}))}/><Text style={{alignSelf:'center',color:colors.text,minWidth:32,textAlign:'center'}}>{prefs.fontSize}</Text><ReaderButton colors={colors} label="A＋" onPress={()=>setPrefs(p=>({...p,originalLayout:false,fontSize:Math.min(30,p.fontSize+2)}))}/></View>
     <ReadingTypographySettings value={prefs.typography} onChange={typography=>setPrefs(p=>({...p,typography,originalLayout:false}))} colors={colors} fontSize={prefs.fontSize} fontsReady={!!fontsReady}/>
     <Text style={[styles.label,{color:colors.muted}]}>阅读背景</Text><View style={styles.chips}>{readingThemes.map(theme=><Pressable key={theme.id} accessibilityRole="button" accessibilityLabel={theme.name} accessibilityState={{selected:prefs.theme===theme.id}} onPress={()=>setPrefs(p=>({...p,theme:theme.id}))} style={[styles.themeCard,{backgroundColor:theme.surface,borderColor:prefs.theme===theme.id?colors.accent:colors.line,borderWidth:prefs.theme===theme.id?2:1}]}><Text style={{fontSize:23,color:theme.text}}>文</Text><Text style={{fontSize:13,color:theme.text,marginTop:8,alignSelf:'stretch',textAlign:'center',marginHorizontal:4}}>{theme.name}{prefs.theme===theme.id?' ✓':''}</Text></Pressable>)}</View>
     <Text style={[styles.label,{color:colors.muted}]}>语速</Text><View style={styles.chips}>{[.5,.75,1,1.25,1.5,1.75,2].map(rate=><ReaderButton colors={colors} key={rate} label={rate+'×'} primary={prefs.voice.rate===rate} onPress={()=>changeRate(rate)}/>)}</View>
     <Text style={{color:colors.muted,lineHeight:22,fontSize:13}}>{prefs.voice.provider==='system'?'本地语音立即应用新语速，从当前词语继续。':'语速立即生效，保留当前播放位置。1× 更接近音色原本的节奏。'}</Text>
     <CloudConnection colors={colors}/>
     <Text style={[styles.label,{color:colors.muted}]}>语音服务</Text><View style={styles.chips}>{(['system','glm','minimax'] as const).map((provider,i)=><ReaderButton colors={colors} key={provider} label={['本地语音','GLM','MiniMax'][i]} primary={draftVoice.provider===provider} onPress={()=>chooseProvider(provider)}/>)}</View>
     {draftVoice.provider!=='system'&&<><Text style={[styles.label,{color:colors.muted}]}>模型</Text><TextInput value={draftVoice.model} editable={false} onChangeText={model=>changeVoice({...draftVoice,model})} autoCapitalize="none" style={[styles.input,{color:colors.text,borderColor:colors.line}]}/></>}
     {draftVoice.provider==='minimax'&&<><Text style={{color:colors.muted}}>中国区 · 使用服务端密钥</Text><ReaderButton colors={colors} label={voicesBusy?'正在获取音色…':'刷新全部音色'} disabled={voicesBusy} onPress={()=>{void loadMiniVoices();}}/>{!!voiceNotice&&<Text style={{color:colors.muted}}>{voiceNotice}</Text>}</>}
     <Text style={[styles.label,{color:colors.muted}]}>音色</Text><View style={styles.chips}>{selectedVoices.map(v=><ReaderButton colors={colors} key={v.value} label={v.label} primary={draftVoice.voice===v.value} onPress={()=>changeVoice({...draftVoice,voice:v.value})}/>)}</View>
     {draftVoice.provider!=='system'&&<TextInput value={draftVoice.voice} onChangeText={voice=>changeVoice({...draftVoice,voice})} placeholder="音色名称 / 自定义音色 ID" placeholderTextColor={colors.muted} autoCapitalize="none" style={[styles.input,{color:colors.text,borderColor:colors.line}]}/>}
     <Text style={{color:colors.muted,lineHeight:24}}>点“完成”后应用模型和音色。正在听书时会从当前句重新开始；已暂停时保持暂停。云端语音按段落预合成，GLM 和 MiniMax 均使用服务端密钥。</Text>
     {identity&&<><Text selectable style={{color:colors.text}}>当前账号：{identity.username}</Text><Text style={{color:colors.muted}}>听页 1.6.4 · 本机书籍 · 云端进度同步</Text><ReaderButton colors={colors} label="退出登录 / 切换账号" onPress={()=>{void logout();}}/></>}
    </ScrollView>}
   </SafeAreaView></View></SafeAreaProvider>
  </Modal>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 reader:{flex:1},readingHeading:{height:34,paddingHorizontal:24,justifyContent:'center'},readingBody:{flex:1,marginHorizontal:24,overflow:'hidden'},readingFooter:{height:60,paddingHorizontal:24,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},readingProgress:{minHeight:44,justifyContent:'center',flex:1},listenBubble:{width:48,height:48,borderRadius:24,alignItems:'center',justifyContent:'center'},readerTopToolbar:{position:'absolute',top:0,left:0,right:0,minHeight:56,paddingHorizontal:16,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:StyleSheet.hairlineWidth},readerBottomToolbar:{position:'absolute',bottom:0,left:0,right:0,paddingHorizontal:22,paddingBottom:6,borderTopWidth:StyleSheet.hairlineWidth},readerPageNavigation:{height:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},readerTools:{height:64,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},readerTool:{minHeight:52,minWidth:48,alignItems:'center',justifyContent:'center',gap:3},readerError:{position:'absolute',left:20,right:20,padding:14,borderWidth:1,borderRadius:14,shadowOpacity:0.08,shadowRadius:6,shadowOffset:{width:0,height:3},elevation:3,gap:10},
readerErrorHeader:{flexDirection:'row',alignItems:'flex-start',gap:10},
readerErrorBadge:{width:24,height:24,borderRadius:12,alignItems:'center',justifyContent:'center',marginTop:2},
readerErrorBadgeText:{fontSize:14,fontWeight:'700',lineHeight:16},
readerErrorTitle:{fontSize:15,fontWeight:'600',lineHeight:20},
readerErrorHint:{fontSize:12,lineHeight:17,marginTop:2},
readerErrorDismiss:{width:28,height:28,borderRadius:14,alignItems:'center',justifyContent:'center'},
readerErrorDetail:{fontSize:11,lineHeight:15,opacity:0.85},
readerErrorAction:{height:36,borderRadius:18,alignItems:'center',justifyContent:'center',paddingHorizontal:16},
readerErrorActionText:{fontSize:14,fontWeight:'600'},themeCard:{width:'22%',minHeight:88,borderRadius:15,alignItems:'center',justifyContent:'center',paddingVertical:12},settingsPlayback:{flexDirection:'row',alignItems:'center',gap:12,borderWidth:1,borderRadius:16,padding:15},page:{flex:1},header:{height:60,flexDirection:'row',alignItems:'center',paddingHorizontal:20,borderBottomWidth:1,gap:14},headerTitle:{fontSize:18,fontWeight:'600',flex:1,textAlign:'center'},iconButton:{minHeight:48,minWidth:48,justifyContent:'center',alignItems:'center'},button:{minHeight:44,paddingHorizontal:17,paddingVertical:11,borderRadius:13,borderWidth:1,alignItems:'center',justifyContent:'center'},notice:{padding:14,fontSize:14,lineHeight:22},login:{flexGrow:1,justifyContent:'center',padding:30},shelfIntro:{padding:24,paddingBottom:16},actions:{flexDirection:'row',gap:12,paddingHorizontal:18},cover:{height:208,borderRadius:12,padding:20,justifyContent:'space-between'},coverTitle:{fontSize:25,fontWeight:'500',color:'#F4EEDA',lineHeight:36},coverAuthor:{color:'#E5DCC1',fontSize:13},coverRule:{height:2,width:35,backgroundColor:'#C5BDA5',opacity:.65},chapterBar:{flexDirection:'row',alignItems:'center',paddingHorizontal:24,paddingVertical:17},paper:{flex:1,marginHorizontal:16,borderRadius:18,borderWidth:1,padding:24,paddingBottom:16},pageFooter:{flexDirection:'row',justifyContent:'space-between',borderTopWidth:1,paddingTop:14,marginTop:14},pageControls:{height:55,paddingHorizontal:20,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},player:{height:94,borderTopWidth:1,paddingHorizontal:24,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},play:{width:64,height:64,borderRadius:32,alignItems:'center',justifyContent:'center'},modalHeader:{flexDirection:'row',padding:20,justifyContent:'space-between',alignItems:'center'},tocRow:{paddingHorizontal:24,paddingVertical:18,borderBottomWidth:1},label:{fontSize:14,fontWeight:'600'},chips:{flexDirection:'row',flexWrap:'wrap',gap:9},input:{borderWidth:1,borderRadius:12,padding:14,fontSize:16,minHeight:48},
});

// Defined outside the reader: cursor updates must not remount settings controls.
const ReaderButton=({colors,label,onPress,primary=false,disabled=false}:{colors:ReadingTheme;label:string;onPress:()=>void;primary?:boolean;disabled?:boolean})=><Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed})=>[styles.button,{backgroundColor:primary?colors.accent:colors.surface,borderColor:colors.line,opacity:(pressed||disabled)?0.6:1}]}><Text style={{color:primary?colors.onAccent:colors.text,fontSize:16,fontWeight:'600'}}>{label}</Text></Pressable>;

const ReaderTool=({colors,symbol,label,onPress}:{colors:ReadingTheme;symbol:string;label:string;onPress:()=>void})=><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.readerTool}><Text style={{color:colors.text,fontSize:23}}>{symbol}</Text><Text style={{color:colors.muted,fontSize:10}}>{label}</Text></Pressable>;

/**
 * ReaderErrorBanner — replaces the plain "player.error" Pressable that previously
 * showed only the raw server message. We classify the message so users get a
 * targeted suggestion:
 *   quota   → cloud TTS quota/rate-limit → switch to system voice
 *   auth    → re-login
 *   network → retry
 *   other   → open settings (fall through)
 *
 * Dismissable via a local "知道了" pill so a stale error doesn't block the
 * controls; the banner re-appears if the player emits a new error.
 */
type ErrorKind = 'rate' | 'quota' | 'auth' | 'network' | 'other';

const ERROR_PATTERNS: Array<{ kind: ErrorKind; match: RegExp }> = [
  { kind: 'rate', match: /请求过快|请求过于频繁|rate\s*limit|too\s*many|频率|限流/i },
  { kind: 'quota', match: /额度|quota|余额|朗读上限/i },
  { kind: 'auth', match: /登录|登录已过期|token|未授权|unauthor|401/i },
  { kind: 'network', match: /网络|云端|连接不上|timeout|timed?\s*out|connect|offline/i },
];

function classifyError(message: string): ErrorKind {
  for (const { kind, match } of ERROR_PATTERNS) {
    if (match.test(message)) return kind;
  }
  return 'other';
}

function ReaderErrorBanner({
  colors,
  message,
  bottom,
  onOpenSettings,
  onRetry,
}: {
  colors: ReadingTheme;
  message: string;
  bottom: number;
  onOpenSettings: () => void;
  onRetry: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    // Reset when the underlying error changes (e.g. user retried successfully
    // and a new error arrived).
    setDismissed(false);
  }, [message]);

  const kind = classifyError(message);
  const title =
    kind === 'rate'
      ? '语音请求暂时受限'
      : kind === 'quota'
      ? '语音服务额度受限'
      : kind === 'auth'
      ? '登录状态已过期'
      : kind === 'network'
      ? '暂时连接不上云端'
      : '听书出错';
  const hint =
    kind === 'rate'
      ? '稍候再试，或到设置切换本地语音。'
      : kind === 'quota'
      ? '到设置切换本地语音，或检查语音服务账户额度。'
      : kind === 'auth'
      ? '重新登录后可以从原章节继续听书。'
      : kind === 'network'
      ? '检查网络后再试一次，已下载的正文仍可阅读。'
      : '到设置里换个语音试试，或稍后再试。';
  // Settings actions open the existing panel; only retry restarts playback.
  const onPrimary =
    kind === 'rate'
      ? onRetry
      : kind === 'quota'
      ? () => {
          onOpenSettings();
        }
      : kind === 'auth'
      ? onOpenSettings
      : kind === 'network'
      ? onRetry
      : onOpenSettings;
  const primaryLabel =
    kind === 'rate'
      ? '重试'
      : kind === 'quota'
      ? '语音设置'
      : kind === 'auth'
      ? '账户设置'
      : kind === 'network'
      ? '重试'
      : '打开设置';

  if (dismissed) return null;

  return (
    <View
      style={[
        styles.readerError,
        {
          bottom,
          backgroundColor: colors.surface,
          borderColor: colors.line,
          shadowColor: colors.accent,
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.readerErrorHeader}>
        <View
          style={[
            styles.readerErrorBadge,
            { backgroundColor: colors.accent },
          ]}
          accessibilityElementsHidden
        >
          <Text style={[styles.readerErrorBadgeText, { color: colors.onAccent }]}>!</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            selectable
            style={[styles.readerErrorTitle, { color: colors.text }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            selectable
            style={[styles.readerErrorHint, { color: colors.muted }]}
            numberOfLines={2}
          >
            {hint}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭提示"
          onPress={() => setDismissed(true)}
          style={({ pressed }) => [
            styles.readerErrorDismiss,
            pressed && { opacity: 0.6 },
          ]}
          hitSlop={6}
        >
          <Text style={{ color: colors.muted, fontSize: 16 }}>✕</Text>
        </Pressable>
      </View>
      <Text
        selectable
        style={[styles.readerErrorDetail, { color: colors.muted }]}
        numberOfLines={3}
      >
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={primaryLabel}
        onPress={onPrimary}
        style={({ pressed }) => [
          styles.readerErrorAction,
          { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.readerErrorActionText, { color: colors.onAccent }]}>
          {primaryLabel}
        </Text>
      </Pressable>
    </View>
  );
}
