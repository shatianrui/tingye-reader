"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Search } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Book } from "@/lib/books";

export function ChapterNavigation({book,current,open,onOpenChange,onJump}:{book:Book;current:number;open:boolean;onOpenChange:(v:boolean)=>void;onJump:(chapter:number)=>void}) {
 const [query,setQuery]=useState(""),[number,setNumber]=useState(String(current+1));
 const listRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(open){const frame=requestAnimationFrame(()=>listRef.current?.querySelector('[aria-current="location"]')?.scrollIntoView({block:"center"}));return()=>cancelAnimationFrame(frame)}},[open,current]);
 function jump(index:number){onJump(index);onOpenChange(false)}
 const filtered=book.chapters.map((chapter,index)=>({chapter,index})).filter(({chapter,index})=>!query.trim()||chapter.title.toLowerCase().includes(query.trim().toLowerCase())||String(index+1)===query.trim());
 const valid=Number.isInteger(Number(number))&&Number(number)>=1&&Number(number)<=book.chapters.length;
 return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="bottom" className="chapter-sheet"><SheetHeader><SheetTitle>章节目录</SheetTitle><SheetDescription>{book.title} · 共 {book.chapters.length} 章</SheetDescription></SheetHeader><div className="toc-controls"><label className="toc-search"><Search size={18}/><input aria-label="搜索章节" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索章节名称或序号"/></label><form className="toc-jump" onSubmit={e=>{e.preventDefault();if(valid)jump(Number(number)-1)}}><label htmlFor="chapter-number">跳到第</label><input id="chapter-number" inputMode="numeric" pattern="[0-9]*" value={number} onChange={e=>setNumber(e.target.value)} aria-label="章节序号"/><span>章</span><button className="primary" type="submit" disabled={!valid}>跳转 <ChevronRight size={16}/></button></form></div><div className="toc-list" ref={listRef} role="navigation" aria-label="可跳转章节">{filtered.length?filtered.map(({chapter,index})=><button key={index} aria-current={index===current?"location":undefined} className={index===current?"toc-chapter selected":"toc-chapter"} onClick={()=>jump(index)}><span className="toc-number">{String(index+1).padStart(2,"0")}</span><span>{chapter.title}</span>{index===current?<Check size={18}/>:<ChevronRight size={17}/>}</button>):<p className="toc-empty">没有匹配的章节，试试其他关键词。</p>}</div><div className="toc-footer">当前：第 {current+1} 章 · {book.chapters[current]?.title}<button onClick={()=>{setQuery("");requestAnimationFrame(()=>listRef.current?.querySelector('[aria-current="location"]')?.scrollIntoView({block:"center",behavior:"smooth"}))}}>定位当前章</button></div></SheetContent></Sheet>
}
