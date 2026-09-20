"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { readingDocument } from "@/lib/reading-document";

export type PageLayout = { start: number; end: number }[];
export function NovelReader({ text, title, fontSize, index, offset, page, follow, seekToken, highlight, onLayout, onPage, onSentence }: {
  text: string; title: string; fontSize: number; index: number; offset: number; page: number; follow: boolean; seekToken: number; highlight: boolean;
  onLayout: (pages: PageLayout) => void; onPage: (page: number) => void; onSentence: (index: number) => void;
}) {
  const paragraphs = useMemo(() => readingDocument(text), [text]);
  const windowRef = useRef<HTMLDivElement>(null), flowRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 600, height: 420 });
  const [revision, setRevision] = useState(0);
  const stride = size.width + 32;
  useLayoutEffect(() => {
    const node = windowRef.current!;
    const resize = () => {
      const box = node.getBoundingClientRect();
      const height = Math.max(130, Math.floor(window.innerHeight - box.top - (window.innerWidth < 768 ? 265 : 215)));
      setSize(old => old.width === node.clientWidth && old.height === height ? old : { width: node.clientWidth, height });
    };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(node);
    window.addEventListener("resize", resize);
    return () => { observer.disconnect(); window.removeEventListener("resize", resize); };
  }, []);
  useLayoutEffect(() => {
    const node = flowRef.current!;
    const measure = () => {
      const count = Math.max(1, Math.round((node.scrollWidth + 32) / stride));
      const pages = Array.from({ length: count }, () => ({ start: Infinity, end: 0 }));
      const left = node.getBoundingClientRect().left;
      for (const span of node.querySelectorAll<HTMLElement>("[data-sentence]")) {
        const n = Number(span.dataset.sentence);
        for (const rect of span.getClientRects()) {
          const p = Math.max(0, Math.min(count - 1, Math.floor((rect.left - left + 1) / stride)));
          pages[p].start = Math.min(pages[p].start, n); pages[p].end = Math.max(pages[p].end, n + 1);
        }
      }
      pages.forEach((p, i) => { if (!Number.isFinite(p.start)) p.start = pages[i - 1]?.start || 0; });
      onLayout(pages); setRevision(v => v + 1);
    };
    measure(); let alive = true;
    void document.fonts.ready.then(() => { if (alive) measure(); });
    return () => { alive = false; };
  }, [paragraphs, title, size, stride, fontSize, onLayout]);
  const pageForPosition = () => {
    const node = flowRef.current;
    if (!node) return 0;
    const n = index, character = offset;
    const pieces = [...node.querySelectorAll<HTMLElement>(`[data-sentence="${n}"]`)];
    const span = pieces.find(s => character >= Number(s.dataset.offset) && character < Number(s.dataset.offset) + (s.textContent?.length || 0)) || pieces[0];
    if (!span?.firstChild) return 0;
    const range = document.createRange();
    const at = Math.max(0, Math.min((span.textContent?.length || 1) - 1, character - Number(span.dataset.offset)));
    range.setStart(span.firstChild, at); range.setEnd(span.firstChild, at + 1);
    return Math.max(0, Math.floor((range.getBoundingClientRect().left - node.getBoundingClientRect().left + 1) / stride));
  };
  // Reflow and explicit navigation restore position; manual page turns stay put.
  useEffect(() => { onPage(pageForPosition()); }, [revision, seekToken]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (follow) onPage(pageForPosition()); }, [follow, index, offset]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="novel-window" ref={windowRef} style={{ height: size.height }}>
    <div className="novel-flow prose" ref={flowRef} style={{ fontSize, height: size.height, columnWidth: size.width, columnGap: 32, transform: `translateX(-${page * stride}px)` }}>
      <h2 className="novel-chapter">{title}</h2>
      {paragraphs.map((pieces, p) => <p key={p}>{pieces.map((piece, i) => piece.index < 0 ? piece.text : <span key={i} data-sentence={piece.index} data-offset={piece.offset} className={highlight && index === piece.index ? "sentence current" : "sentence"} onClick={() => onSentence(piece.index)}>{piece.text}</span>)}</p>)}
    </div>
  </div>;
}
