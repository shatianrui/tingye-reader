import { DisplayText as Text } from '../components/DisplayText';
import {memo,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,View,type TextStyle} from 'react-native';
import type {BookBlock,PositionedLine,TextPage,Typography} from './typesetting';
import {blockDisplay,chapterBlocks,paginateBlocks,positionLines} from './typesetting';
import type {Chapter} from './books';
import {sentenceRanges} from './pagination';
import type {ReadingTheme} from './themes';
import {readerFonts} from './reader-fonts';

type Props={chapter:Chapter;width:number;height:number;fontSize:number;typography:Typography;fontsReady:boolean;colors:ReadingTheme;pageStart:number;activePosition:number;onEnds:(ends:number[])=>void;onToggle:()=>void;onSelect:(position:number)=>void};
export default function PaginatedText(props:Props){
 const key=[props.chapter.text,JSON.stringify(props.chapter.blocks),props.width,props.height,props.fontSize,JSON.stringify(props.typography),props.fontsReady].join('|');
 return <MeasuredChapter key={key} {...props}/>;
}
const MeasuredChapter=memo(function MeasuredChapter(p:Props){
 const blocks=useMemo(()=>chapterBlocks(p.chapter),[p.chapter]);
 const ranges=useMemo(()=>sentenceRanges(p.chapter.text),[p.chapter.text]);
 const measured=useRef(new Map<number,PositionedLine[]>());
 const [batch,setBatch]=useState(0),[pages,setPages]=useState<TextPage[]>([]);
 const family=p.fontsReady?readerFonts.find(f=>f.id===p.typography.font)?.family:undefined;
 const styleFor=(b:BookBlock):TextStyle=>({fontFamily:family,fontSize:p.fontSize*(b.kind==='heading'?1.22:1),lineHeight:Math.round(p.fontSize*p.typography.lineHeight*(b.kind==='heading'?1.15:1)),fontWeight:b.kind==='heading'?'600':'400',color:b.kind==='quote'?p.colors.muted:p.colors.text,textAlign:b.align??(b.kind==='heading'?'center':b.kind==='verse'?'left':p.typography.alignment),includeFontPadding:false,writingDirection:'ltr'});
 const receive=useCallback((index:number,lines:PositionedLine[])=>{
  if(measured.current.has(index)||!lines.length)return;measured.current.set(index,lines);
  if(measured.current.size===blocks.length){const result=paginateBlocks(blocks,blocks.map((_,i)=>measured.current.get(i)!),p.height,p.fontSize,p.typography.paragraphGap,p.chapter.text.length);setPages(result);}
  else if(measured.current.size%32===0)setBatch(measured.current.size);
 },[blocks,p.height,p.fontSize,p.typography.paragraphGap,p.chapter.text.length]);
 useEffect(()=>{if(pages.length)p.onEnds(pages.map(x=>x.end));},[pages,p.onEnds]);
 const current=pages.find(page=>page.start<=p.pageStart&&page.end>p.pageStart)??pages[0];
 const content=(block:BookBlock,highlight:boolean)=>{
  let lo=0,hi=ranges.length;while(lo<hi){const mid=(lo+hi)>>>1;if(ranges[mid].end<=block.start)lo=mid+1;else hi=mid;}const blockRanges:typeof ranges=[];for(let i=lo;i<ranges.length&&ranges[i].start<block.end;i++)blockRanges.push(ranges[i]);
  const display=blockDisplay(p.chapter,block,p.typography.indent);
  const marks=(p.chapter.marks||[]).filter(m=>m.end>block.start&&m.start<block.end);
  const cuts=[...new Set([block.start,block.end,...marks.flatMap(m=>[Math.max(block.start,m.start),Math.min(block.end,m.end)]),...blockRanges.flatMap(r=>[Math.max(block.start,r.start),Math.min(block.end,r.end)])])].sort((a,b)=>a-b);
  return <>{display.prefix>0?'\u3000\u3000':null}{cuts.slice(0,-1).map((from,i)=>{const end=cuts[i+1],r=blockRanges.find(r=>r.start<=from&&r.end>from),m=marks.filter(m=>m.start<=from&&m.end>from);return <Text key={from} suppressHighlighting onPress={highlight?event=>{event.stopPropagation();p.onToggle();}:undefined} onLongPress={highlight&&r?event=>{event.stopPropagation();p.onSelect(r.index);}:undefined} style={{fontWeight:m.some(m=>m.bold)?'700':undefined,fontStyle:m.some(m=>m.italic)?'italic':undefined,backgroundColor:highlight&&r?.index===p.activePosition?p.colors.highlight:undefined}}>{p.chapter.text.slice(from,end)}</Text>;})}</>;
 };
 return <>
  {!pages.length&&<View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{position:'absolute',top:0,left:0,width:p.width,opacity:0}}>{blocks.slice(batch,batch+32).map((b,i)=>{const index=batch+i,display=blockDisplay(p.chapter,b,p.typography.indent);return <Text key={index} textBreakStrategy="highQuality" lineBreakStrategyIOS="standard" allowFontScaling={false} style={[styleFor(b),{position:'absolute',width:p.width}]} onTextLayout={e=>receive(index,positionLines(display.text,b,display.prefix,e.nativeEvent.lines))}>{content(b,false)}</Text>;})}</View>}
  {!current?<View style={{paddingTop:32,gap:12,alignItems:'center'}}><ActivityIndicator color={p.colors.accent}/><Text style={{color:p.colors.muted,fontSize:12}}>正在整理书页…</Text></View>:current.fragments.map(f=>{const block=blocks[f.block],lines=measured.current.get(f.block)!;return <View key={f.block} style={{position:'absolute',top:f.top,left:0,width:p.width,height:f.height,overflow:'hidden'}}><Text textBreakStrategy="highQuality" lineBreakStrategyIOS="standard" allowFontScaling={false} onPress={p.onToggle} style={[styleFor(block),{width:p.width,transform:[{translateY:-lines[f.first].y}]}]}>{content(block,true)}</Text></View>;})}
 </>;
});
