import { DisplayText as Text } from '../components/DisplayText';
import {Pressable,View} from 'react-native';
import {useState} from 'react';
import {fontLicenses} from './font-licenses';
import type {Typography} from './typesetting';
import {defaultTypography} from './typesetting';
import {readerFonts} from './reader-fonts';
import type {ReadingTheme} from './themes';

export default function ReadingTypographySettings({value,onChange,colors,fontSize,fontsReady}:{value:Typography;onChange:(next:Typography)=>void;colors:ReadingTheme;fontSize:number;fontsReady:boolean}){
 const [showLicense,setShowLicense]=useState(false);
 const set=(next:Partial<Typography>)=>onChange({...value,...next});
 const choice=(label:string,selected:boolean,press:()=>void)=><Pressable key={label} accessibilityRole="radio" accessibilityState={{checked:selected}} onPress={press} style={{minHeight:44,paddingHorizontal:15,paddingVertical:12,borderRadius:12,borderWidth:1,borderColor:selected?colors.accent:colors.line,backgroundColor:selected?colors.highlight:colors.surface}}><Text style={{color:colors.text,fontSize:14}}>{label}</Text></Pressable>;
 return <View style={{gap:18}}>
  <Text style={{color:colors.muted,fontSize:13}}>字体 · 安装后离线可用</Text>
  {readerFonts.map(font=><Pressable key={font.id} accessibilityRole="radio" accessibilityLabel={font.name} accessibilityState={{checked:value.font===font.id}} onPress={()=>set({font:font.id})} style={{borderRadius:16,borderWidth:value.font===font.id?2:1,borderColor:value.font===font.id?colors.accent:colors.line,padding:16,backgroundColor:colors.surface,gap:6}}><View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={{fontFamily:fontsReady?font.family:undefined,color:colors.text,fontSize:20}}>{font.name}</Text><Text style={{color:colors.accent}}>{value.font===font.id?'✓':''}</Text></View><Text style={{color:colors.muted,fontSize:12}}>{font.detail}</Text></Pressable>)}
  <View style={{padding:20,borderWidth:1,borderColor:colors.line,borderRadius:16,backgroundColor:colors.surface}}><Text style={{fontSize:11,color:colors.muted,marginBottom:12}}>排版预览</Text><Text allowFontScaling={false} style={{fontFamily:fontsReady?readerFonts.find(f=>f.id===value.font)?.family:undefined,fontSize,lineHeight:Math.round(fontSize*value.lineHeight),color:colors.text,textAlign:value.alignment}}>{value.indent?'　　':''}风翻开了书页，故事慢慢有了声音。</Text><View style={{height:fontSize*value.paragraphGap}}/><Text allowFontScaling={false} style={{fontFamily:fontsReady?readerFonts.find(f=>f.id===value.font)?.family:undefined,fontSize,lineHeight:Math.round(fontSize*value.lineHeight),color:colors.text}}>{value.indent?'　　':''}留一些空白，让阅读从容下来。</Text></View>
  <Text style={{color:colors.muted,fontSize:13}}>行距</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{[1.5,1.7,1.85,2.1].map((n,i)=>choice(['紧凑','适中','舒展','宽松'][i],value.lineHeight===n,()=>set({lineHeight:n})))}</View>
  <Text style={{color:colors.muted,fontSize:13}}>段落间距</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{[0,.3,.55,.9].map((n,i)=>choice(['无','小','适中','大'][i],value.paragraphGap===n,()=>set({paragraphGap:n})))}</View>
  <Text style={{color:colors.muted,fontSize:13}}>页边距</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{[16,24,32,40].map((n,i)=>choice(['窄','适中','宽','留白'][i],value.margin===n,()=>set({margin:n})))}</View>
  <Text style={{color:colors.muted,fontSize:13}}>首行缩进</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{choice('补齐两字缩进',value.indent,()=>set({indent:true}))}{choice('沿用原文',!value.indent,()=>set({indent:false}))}</View>
  <Text style={{color:colors.muted,fontSize:13}}>正文对齐</Text><View style={{flexDirection:'row',gap:8}}>{choice('自然左对齐',value.alignment==='left',()=>set({alignment:'left'}))}{choice('两端对齐',value.alignment==='justify',()=>set({alignment:'justify'}))}</View>
  <Pressable accessibilityRole="button" onPress={()=>onChange({...defaultTypography})} style={{padding:14,alignItems:'center'}}><Text style={{color:colors.accent}}>恢复舒适排版</Text></Pressable>
  <Text style={{color:colors.muted,fontSize:12,lineHeight:20}}>保留原文与段落顺序，不按朗读句子拆行。切换排版会重新分页，听书继续播放。字体：Noto Serif CJK、LXGW WenKai Lite（SIL OFL 1.1）。</Text>
  <Pressable accessibilityRole="button" onPress={()=>setShowLicense(v=>!v)} style={{paddingVertical:12}}><Text style={{color:colors.accent}}>开源字体许可 {showLicense?"−":"＋"}</Text></Pressable>
  {showLicense&&<Text selectable style={{fontSize:11,lineHeight:18,color:colors.muted}}>{fontLicenses}</Text>}
 </View>;
}
