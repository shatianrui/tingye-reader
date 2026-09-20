import {useMemo,useState} from 'react';
import {FlatList,Image,Pressable,StyleSheet,Text,TextInput,View,useWindowDimensions} from 'react-native';
import type {Book} from './books';
import {readerLayout} from './reader-layout';
import type {ReadingTheme} from './themes';

type Props={books:Book[];colors:ReadingTheme;busy:boolean;onOpen:(book:Book)=>void;onActions:(book:Book)=>void;onImport:()=>void;onRefresh:()=>void;onSettings:()=>void};

export function BookCover({book,compact=false}:{book:Book;compact?:boolean}) {
 const palette=book.color==='blue'?['#E0E8E9','#415D68']:book.color==='ochre'?['#EFD8C0','#83552F']:['#DEE3D2','#4F6245'];
 return <View style={[styles.cover,{backgroundColor:palette[0]},compact&&{width:74,height:104,flexShrink:0,padding:12,borderRadius:8}]}>
  <View style={[styles.spine,{backgroundColor:palette[1]}]}/>
  <Text numberOfLines={compact?3:4} style={{fontSize:compact?15:24,lineHeight:compact?22:34,fontWeight:'600',color:palette[1],letterSpacing:1}}>{book.title}</Text>
  <View style={{gap:9}}><View style={{width:18,height:1,backgroundColor:palette[1],opacity:.45}}/><Text numberOfLines={1} style={{fontSize:compact?9:11,color:palette[1]}}>{book.author||'佚名'}</Text></View>
 </View>;
}

export default function ShelfScreen({books,colors,busy,onOpen,onActions,onImport,onRefresh,onSettings}:Props){
 const {width}=useWindowDimensions(),layout=readerLayout(width);
 const [query,setQuery]=useState('');
 const filtered=useMemo(()=>books.filter(book=>(book.title+' '+book.author).toLowerCase().includes(query.trim().toLowerCase())),[books,query]);
 const recent=books.find(book=>Number(book.position)>0||Number(book.chapter)>0)||books[0];
 return <View style={{flex:1}} testID="shelf-screen">
  <View style={styles.header}><View style={{flexDirection:'row',alignItems:'center',gap:10}}><Image source={require('../../assets/tingye-icon-v4.png')} style={{width:36,height:36,borderRadius:10}}/><Text style={{color:colors.text,fontSize:20,fontWeight:'700',letterSpacing:2}}>听页</Text></View><Pressable accessibilityRole="button" accessibilityLabel="打开设置" onPress={onSettings} style={[styles.circle,{backgroundColor:colors.surface}]}><Text style={{color:colors.text,fontSize:24,lineHeight:26}}>···</Text></Pressable></View>
  <FlatList key={layout.columns} data={filtered} numColumns={layout.columns} keyExtractor={book=>book.id} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{paddingHorizontal:layout.shelfPadding,paddingBottom:24,gap:22}} columnWrapperStyle={{gap:layout.gap}}
   ListHeaderComponent={<View style={{gap:22,paddingTop:14}}>
    <View style={{gap:8}}><Text style={{fontSize:34,fontWeight:'700',letterSpacing:1,color:colors.text}}>我的书架</Text><Text style={{fontSize:14,lineHeight:22,color:colors.muted}}>把时间，留给喜欢的书。</Text></View>
    {recent&&!query&&<Pressable accessibilityRole="button" accessibilityLabel={'继续阅读 '+recent.title} onPress={()=>onOpen(recent)} style={[styles.resume,{backgroundColor:colors.surface,borderColor:colors.line}]}>
     <BookCover book={recent} compact/>
     <View style={{flex:1,gap:8}}><Text style={{fontSize:11,letterSpacing:2,color:colors.accent,fontWeight:'600'}}>继续阅读</Text><Text numberOfLines={2} style={{fontSize:20,lineHeight:28,fontWeight:'600',color:colors.text}}>{recent.title}</Text><Text numberOfLines={1} style={{fontSize:12,color:colors.muted}}>第 {(recent.chapter||0)+1} 章 · 翻开下一页</Text></View><View style={[styles.resumeArrow,{backgroundColor:colors.accent}]}><Text style={{color:colors.onAccent,fontSize:23}}>›</Text></View>
    </Pressable>}
    <View style={{flexDirection:'row',alignItems:'center',gap:12}}><Text style={{fontSize:19,fontWeight:'600',color:colors.text}}>全部书籍</Text><Text style={{color:colors.muted,fontSize:13}}>{books.length} 本</Text></View>
    <TextInput accessibilityLabel="搜索书架" value={query} onChangeText={setQuery} placeholder="搜索书名或作者" placeholderTextColor={colors.muted} clearButtonMode="while-editing" style={[styles.search,{backgroundColor:colors.surface,color:colors.text,borderColor:colors.line}]}/>
   </View>}
   ListEmptyComponent={<Text style={{paddingVertical:35,color:colors.muted,textAlign:'center'}}>没有找到这本书，试试其他关键词。</Text>}
   renderItem={({item})=><Pressable accessibilityRole="button" accessibilityLabel={'阅读 '+item.title} disabled={busy} onPress={()=>onOpen(item)} onLongPress={()=>!item.sample&&onActions(item)} style={{width:layout.coverWidth,gap:10}}>
    <View style={{height:layout.coverWidth*1.28}}><BookCover book={item}/></View><Text numberOfLines={2} style={{fontSize:16,lineHeight:23,fontWeight:'500',color:colors.text}}>{item.title}</Text><Text style={{fontSize:11,color:colors.muted}}>{item.format}  ·  {item.sample?'精选试读':'我的藏书'}</Text>
   </Pressable>}/>
  <View style={[styles.bottom,{backgroundColor:colors.background,borderColor:colors.line}]}><Pressable accessibilityRole="button" accessibilityLabel="同步书架" disabled={busy} onPress={onRefresh} style={[styles.sync,{backgroundColor:colors.surface,borderColor:colors.line}]}><Text style={{color:colors.text,fontSize:16}}>↻ 同步</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={onImport} style={[styles.importButton,{backgroundColor:colors.accent,opacity:busy?.5:1}]}><Text style={{color:colors.onAccent,fontSize:17,fontWeight:'600'}}>{busy?'正在处理…':'＋ 导入书籍'}</Text></Pressable></View>
 </View>;
}
const styles=StyleSheet.create({
 header:{height:58,paddingHorizontal:24,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},circle:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center'},
 resume:{padding:16,borderRadius:22,borderWidth:1,flexDirection:'row',alignItems:'center',gap:16},resumeArrow:{width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center'},
 cover:{width:'100%',height:'100%',borderRadius:12,padding:21,justifyContent:'space-between',overflow:'hidden'},spine:{position:'absolute',top:0,bottom:0,left:5,width:1,opacity:.16},search:{minHeight:48,paddingHorizontal:16,paddingVertical:12,borderRadius:14,borderWidth:1,fontSize:15},
 bottom:{paddingHorizontal:22,paddingTop:12,paddingBottom:10,borderTopWidth:StyleSheet.hairlineWidth,flexDirection:'row',gap:12},sync:{height:52,minWidth:92,paddingHorizontal:16,borderRadius:17,borderWidth:1,alignItems:'center',justifyContent:'center'},importButton:{flex:1,minHeight:52,borderRadius:17,alignItems:'center',justifyContent:'center'},
});
