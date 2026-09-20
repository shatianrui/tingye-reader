import { DisplayText as Text } from '../components/DisplayText';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutChangeEvent,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TextStyle,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { sampleBooks } from '../data/sampleBooks';
import { bookRepository } from '../data/bookRepository';
import type { Annotation, Chapter, PageSpec } from '../types/models';
import { useReaderSettings, MIN_FONT_SIZE, MAX_FONT_SIZE, type PageTurnMode } from '../store/useReaderSettings';
import { useAppState } from '../store/useAppState';
import { readerThemes, readerThemeOrder, readerThemeLabels, type ReaderTheme } from '../theme/readerThemes';
import { useTextMeasurer } from '../reader/TextMeasurer';
import { paginateBook } from '../reader/pagination';
import { buildAnnotatedSpans } from '../reader/spanBuilder';
import { ttsController, useTtsController } from '../reader/ttsController';

type Props = NativeStackScreenProps<RootStackParamList, 'Reader'>;

const RATE_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];
const LINE_HEIGHT_PRESETS: { label: string; value: number }[] = [
  { label: '紧凑', value: 1.5 },
  { label: '适中', value: 1.8 },
  { label: '宽松', value: 2.2 },
];

interface Paragraph {
  offset: number; // absolute chapter offset
  text: string;
}

/** Splits a chapter-relative text slice into paragraph chunks with absolute chapter offsets. */
function splitParagraphs(text: string, sliceStart: number): Paragraph[] {
  const out: Paragraph[] = [];
  let cursor = sliceStart;
  const parts = text.split('\n');
  for (const part of parts) {
    if (part.length > 0) out.push({ offset: cursor, text: part });
    cursor += part.length + 1;
  }
  return out;
}

export default function ReaderScreen({ route, navigation }: Props) {
  const book = sampleBooks.find((b) => b.id === route.params.bookId)!;

  const settings = useReaderSettings();
  const colors = readerThemes[settings.theme];
  const appState = useAppState();
  const tts = useTtsController();
  const { measure, host } = useTextMeasurer();

  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [chapterIndex, setChapterIndex] = useState(route.params.initialChapterIndex ?? 0);
  const [charOffset, setCharOffset] = useState(0);
  const [pages, setPages] = useState<PageSpec[] | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);
  const [displayPanel, setDisplayPanel] = useState(false);
  const [tocVisible, setTocVisible] = useState(false);
  const [tocTab, setTocTab] = useState<'toc' | 'bookmark' | 'note'>('toc');
  const [notePrompt, setNotePrompt] = useState<{ start: number; end: number; text: string } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const scrollRef = useRef<ScrollView>(null);
  const startedAtRef = useRef(Date.now());
  const restoredRef = useRef(false);
  const paginationKeyRef = useRef('');

  const fontSize = settings.fontSize;
  const textStyle: TextStyle = useMemo(
    () => ({
      fontSize,
      lineHeight: Math.round(fontSize * settings.lineHeight),
      color: colors.text,
    }),
    [fontSize, settings.lineHeight, colors.text]
  );

  // ---- load chapters, restore progress ----
  useEffect(() => {
    bookRepository.loadChapters(book).then((cs) => {
      setChapters(cs);
      if (route.params.initialChapterIndex == null && !restoredRef.current) {
        const p = appState.progressOf(book.id);
        if (p) {
          setChapterIndex(p.chapterIndex);
          setCharOffset(p.charOffset);
        }
      }
      restoredRef.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  const charsBefore = useMemo(() => {
    if (!chapters) return [];
    const arr: number[] = [];
    let sum = 0;
    for (const c of chapters) {
      arr.push(sum);
      sum += c.content.length;
    }
    return arr;
  }, [chapters]);
  const totalChars = useMemo(
    () => (chapters ? chapters.reduce((a, c) => a + c.content.length, 0) : 1),
    [chapters]
  );

  // ---- pagination (slide mode) ----
  useEffect(() => {
    if (!chapters || layout.width === 0 || layout.height === 0 || settings.pageMode !== 'slide') return;
    const key = `${layout.width}x${layout.height}:${fontSize}:${settings.lineHeight}`;
    if (paginationKeyRef.current === key && pages) return;
    paginationKeyRef.current = key;
    paginateBook(measure, chapters, textStyle, layout.width - 32, layout.height - 32).then((p) => {
      setPages(p);
      const idx = p.findIndex(
        (pg) => pg.chapterIndex === chapterIndex && pg.end > charOffset
      );
      const targetIndex = idx >= 0 ? idx : 0;
      setPageIndex(targetIndex);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ x: targetIndex * layout.width, animated: false });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapters, layout.width, layout.height, fontSize, settings.lineHeight, settings.pageMode]);

  // ---- persistence ----
  const percent = useMemo(() => {
    if (!chapters || charsBefore.length === 0) return 0;
    const before = charsBefore[chapterIndex] ?? 0;
    return Math.max(0, Math.min(1, (before + charOffset) / Math.max(1, totalChars)));
  }, [chapters, charsBefore, chapterIndex, charOffset, totalChars]);

  const saveProgress = useCallback(() => {
    appState.saveProgress({
      bookId: book.id,
      chapterIndex,
      charOffset,
      percent,
      updatedAt: Date.now(),
    });
  }, [appState, book.id, chapterIndex, charOffset, percent]);

  useEffect(() => {
    return () => {
      const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
      useAppState.getState().addReadingSeconds(elapsed);
      const p = useAppState.getState();
      p.saveProgress({
        bookId: book.id,
        chapterIndex,
        charOffset,
        percent,
        updatedAt: Date.now(),
      });
      ttsController.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- TTS wiring ----
  useEffect(() => {
    ttsController.configure(
      (ci, sentence) => {
        setChapterIndex(ci);
        setCharOffset(sentence.start);
        if (settings.pageMode === 'slide' && pages) {
          const idx = pages.findIndex((pg) => pg.chapterIndex === ci && pg.end > sentence.start);
          if (idx >= 0 && idx !== pageIndex) {
            setPageIndex(idx);
            scrollRef.current?.scrollTo({ x: idx * layout.width, animated: true });
          }
        } else if (settings.pageMode === 'scroll' && chapters) {
          const chapterLen = chapters[ci]?.content.length || 1;
          const fraction = sentence.start / chapterLen;
          scrollRef.current?.scrollTo({ y: fraction * 4000, animated: true });
        }
      },
      () => setMenuVisible(true)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, pageIndex, layout.width, settings.pageMode, chapters]);

  if (!chapters) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
        {host}
      </View>
    );
  }

  const chapter = chapters[chapterIndex];

  const jumpToChapter = (index: number) => {
    if (tts.isActive) {
      ttsController.skipToChapter(index);
    }
    setChapterIndex(index);
    setCharOffset(0);
    setTocVisible(false);
    if (settings.pageMode === 'slide' && pages) {
      const idx = pages.findIndex((pg) => pg.chapterIndex === index);
      if (idx >= 0) {
        setPageIndex(idx);
        scrollRef.current?.scrollTo({ x: idx * layout.width, animated: false });
      }
    }
  };

  const goToPage = (idx: number) => {
    if (!pages || idx < 0 || idx >= pages.length) return;
    setPageIndex(idx);
    const pg = pages[idx];
    setChapterIndex(pg.chapterIndex);
    setCharOffset(pg.start);
    scrollRef.current?.scrollTo({ x: idx * layout.width, animated: true });
  };

  const onTapZone = (x: number) => {
    if (layout.width === 0) return;
    if (x < layout.width / 3) {
      goToPage(pageIndex - 1);
    } else if (x > (layout.width * 2) / 3) {
      goToPage(pageIndex + 1);
    } else {
      setMenuVisible((v) => !v);
    }
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, layout.width));
    if (pages && idx !== pageIndex && idx >= 0 && idx < pages.length) {
      setPageIndex(idx);
      const pg = pages[idx];
      setChapterIndex(pg.chapterIndex);
      setCharOffset(pg.start);
      saveProgress();
    }
  };

  const toggleBookmark = () => {
    if (settings.pageMode === 'slide' && pages) {
      const pg = pages[pageIndex];
      appState.bookmarkAt(book.id, pg.chapterIndex, pg.start, pg.end);
    } else {
      appState.bookmarkAt(book.id, chapterIndex, 0, chapter.content.length + 1);
    }
  };

  const isBookmarked =
    settings.pageMode === 'slide' && pages
      ? appState.isBookmarked(book.id, pages[pageIndex].chapterIndex, pages[pageIndex].start, pages[pageIndex].end)
      : appState.isBookmarked(book.id, chapterIndex, 0, chapter.content.length + 1);

  const onLongPressParagraph = (start: number, end: number, text: string) => {
    if (tts.isActive) return;
    Alert.alert('文字操作', text.length > 30 ? text.slice(0, 30) + '…' : text, [
      {
        text: '划线',
        onPress: () => appState.addAnnotation({ bookId: book.id, chapterIndex, start, end, type: 'highlight', selectedText: text }),
      },
      { text: '写想法', onPress: () => setNotePrompt({ start, end, text }) },
      { text: '取消', style: 'cancel' },
    ]);
  };

  const saveNote = () => {
    if (!notePrompt) return;
    appState.addAnnotation({
      bookId: book.id,
      chapterIndex,
      start: notePrompt.start,
      end: notePrompt.end,
      type: 'note',
      selectedText: notePrompt.text,
      note: noteText,
    });
    setNotePrompt(null);
    setNoteText('');
  };

  const chapterAnnotations = appState.annotationsOf(book.id).filter((a) => a.chapterIndex === chapterIndex);
  const ttsRange =
    tts.isActive && tts.chapterIndex === chapterIndex && tts.currentRange ? tts.currentRange : null;

  const renderParagraphs = (paragraphs: Paragraph[]) =>
    paragraphs.map((p, i) => (
      <Text
        key={`${p.offset}-${i}`}
        style={[textStyle, styles.paragraph]}
        onLongPress={() => onLongPressParagraph(p.offset, p.offset + p.text.length, p.text)}
      >
        {buildAnnotatedSpans(p.text, p.offset, chapterAnnotations, ttsRange, colors, textStyle)}
      </Text>
    ));

  const onLayout = (e: LayoutChangeEvent) => {
    setLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
  };

  const startTts = () => {
    ttsController.start({ chapters, chapterIndex, fromOffset: charOffset, rate: settings.ttsRate });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {host}
      {menuVisible && (
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.topBarBtn}>‹ 返回</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {chapter?.title}
          </Text>
          <TouchableOpacity onPress={toggleBookmark}>
            <Text style={styles.topBarBtn}>{isBookmarked ? '★' : '☆'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.pageArea} onLayout={onLayout}>
        {settings.pageMode === 'slide' ? (
          pages && layout.width > 0 ? (
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onMomentumEnd}
              contentOffset={{ x: pageIndex * layout.width, y: 0 }}
            >
              {pages.map((pg, i) => {
                const ch = chapters[pg.chapterIndex];
                const text = ch.content.slice(pg.start, pg.end);
                const paragraphs = splitParagraphs(text, pg.start);
                const pageAnnotations = appState
                  .annotationsOf(book.id)
                  .filter((a) => a.chapterIndex === pg.chapterIndex);
                const pageTtsRange =
                  tts.isActive && tts.chapterIndex === pg.chapterIndex && tts.currentRange
                    ? tts.currentRange
                    : null;
                return (
                  <View key={i} style={{ width: layout.width, height: layout.height }}>
                    <TouchableOpacity
                      activeOpacity={1}
                      style={styles.tapCatcher}
                      onPress={(e) => onTapZone(e.nativeEvent.locationX)}
                    >
                      <View style={styles.pageContent} pointerEvents="box-none">
                        {paragraphs.map((p, pi) => (
                          <Text
                            key={pi}
                            style={[textStyle, styles.paragraph]}
                            onLongPress={() => onLongPressParagraph(p.offset, p.offset + p.text.length, p.text)}
                          >
                            {buildAnnotatedSpans(p.text, p.offset, pageAnnotations, pageTtsRange, colors, textStyle)}
                          </Text>
                        ))}
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <ActivityIndicator style={{ marginTop: 40 }} />
          )
        ) : (
          <ScrollView ref={scrollRef} style={styles.pageContent}>
            <TouchableOpacity activeOpacity={1} onPress={() => setMenuVisible((v) => !v)}>
              {renderParagraphs(splitParagraphs(chapter.content, 0))}
            </TouchableOpacity>
            <View style={styles.chapterNavRow}>
              <TouchableOpacity
                disabled={chapterIndex === 0}
                onPress={() => jumpToChapter(chapterIndex - 1)}
              >
                <Text style={[styles.chapterNavBtn, { opacity: chapterIndex === 0 ? 0.3 : 1 }]}>上一章</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={chapterIndex >= chapters.length - 1}
                onPress={() => jumpToChapter(chapterIndex + 1)}
              >
                <Text style={[styles.chapterNavBtn, { opacity: chapterIndex >= chapters.length - 1 ? 0.3 : 1 }]}>
                  下一章
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>

      {menuVisible && !tts.isActive && (
        <View style={styles.bottomBar}>
          <Text style={styles.percentText}>{Math.round(percent * 100)}%</Text>
          <TouchableOpacity onPress={() => setTocVisible(true)}>
            <Text style={styles.bottomBtn}>目录</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={startTts}>
            <Text style={styles.bottomBtn}>听书</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDisplayPanel(true)}>
            <Text style={styles.bottomBtn}>显示</Text>
          </TouchableOpacity>
        </View>
      )}

      {tts.isActive && (
        <View style={styles.ttsBar}>
          <TouchableOpacity onPress={() => ttsController.skipToChapter(chapterIndex - 1)} disabled={chapterIndex === 0}>
            <Text style={styles.ttsBtn}>上一章</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => (tts.isPaused ? ttsController.resume() : ttsController.pause())}>
            <Text style={styles.ttsBtnMain}>{tts.isPaused ? '▶' : '❚❚'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => ttsController.skipToChapter(chapterIndex + 1)}
            disabled={chapterIndex >= chapters.length - 1}
          >
            <Text style={styles.ttsBtn}>下一章</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => ttsController.stop()}>
            <Text style={styles.ttsBtn}>退出听书</Text>
          </TouchableOpacity>
          <View style={styles.rateRow}>
            {RATE_OPTIONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.rateChip, settings.ttsRate === r && styles.rateChipActive]}
                onPress={() => {
                  settings.setTtsRate(r);
                  ttsController.setRate(r);
                }}
              >
                <Text style={[styles.rateChipText, settings.ttsRate === r && styles.rateChipTextActive]}>{r}x</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Display settings panel */}
      <Modal visible={displayPanel} transparent animationType="slide" onRequestClose={() => setDisplayPanel(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDisplayPanel(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>显示设置</Text>

            <View style={styles.rowBetween}>
              <TouchableOpacity onPress={() => settings.setFontSize(fontSize - 1)}>
                <Text style={styles.fontBtn}>A-</Text>
              </TouchableOpacity>
              <Text>{fontSize}</Text>
              <TouchableOpacity onPress={() => settings.setFontSize(fontSize + 1)}>
                <Text style={styles.fontBtn}>A+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.rowBetween}>
              {LINE_HEIGHT_PRESETS.map((p) => (
                <TouchableOpacity
                  key={p.label}
                  style={[styles.chip, settings.lineHeight === p.value && styles.chipActive]}
                  onPress={() => settings.setLineHeight(p.value)}
                >
                  <Text style={[styles.chipText, settings.lineHeight === p.value && styles.chipTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.rowBetween}>
              {(['slide', 'scroll'] as PageTurnMode[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.chip, settings.pageMode === m && styles.chipActive]}
                  onPress={() => settings.setPageMode(m)}
                >
                  <Text style={[styles.chipText, settings.pageMode === m && styles.chipTextActive]}>
                    {m === 'slide' ? '左右翻页' : '上下滚动'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.rowBetween}>
              {readerThemeOrder.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.themeSwatch,
                    { backgroundColor: readerThemes[t].background, borderColor: readerThemes[t].text },
                    settings.theme === t && styles.themeSwatchActive,
                  ]}
                  onPress={() => settings.setTheme(t)}
                >
                  <Text style={{ fontSize: 10, color: readerThemes[t].text }}>{readerThemeLabels[t]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* TOC / Bookmarks / Notes sheet */}
      <Modal visible={tocVisible} transparent animationType="slide" onRequestClose={() => setTocVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setTocVisible(false)}>
          <View style={[styles.sheet, { height: '70%' }]}>
            <View style={styles.tabRow}>
              {(['toc', 'bookmark', 'note'] as const).map((t) => (
                <TouchableOpacity key={t} onPress={() => setTocTab(t)} style={styles.tabItem}>
                  <Text style={[styles.tabLabel, tocTab === t && styles.tabLabelActive]}>
                    {t === 'toc' ? '目录' : t === 'bookmark' ? '书签' : '想法'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView>
              {tocTab === 'toc' &&
                chapters.map((c, i) => (
                  <TouchableOpacity key={i} style={styles.tocRow} onPress={() => jumpToChapter(i)}>
                    <Text style={[styles.tocRowText, i === chapterIndex && styles.tocRowActive]} numberOfLines={1}>
                      {i === chapterIndex ? '▶ ' : ''}
                      {c.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              {(tocTab === 'bookmark' || tocTab === 'note') &&
                appState
                  .annotationsOf(book.id)
                  .filter((a) => (tocTab === 'bookmark' ? a.type === 'bookmark' : a.type !== 'bookmark'))
                  .sort((a, b) => a.chapterIndex - b.chapterIndex || a.start - b.start)
                  .map((a) => (
                    <AnnotationRow
                      key={a.id}
                      annotation={a}
                      chapterTitle={chapters[a.chapterIndex]?.title ?? ''}
                      onPress={() => jumpToChapter(a.chapterIndex)}
                      onDelete={() => appState.removeAnnotation(a.id)}
                    />
                  ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Note dialog */}
      <Modal visible={!!notePrompt} transparent animationType="fade" onRequestClose={() => setNotePrompt(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.noteDialog}>
            <Text style={styles.sheetTitle}>写想法</Text>
            <Text style={styles.noteQuote} numberOfLines={3}>
              {notePrompt?.text}
            </Text>
            <TextInput
              style={styles.noteInput}
              multiline
              value={noteText}
              onChangeText={setNoteText}
              placeholder="写下你的想法…"
            />
            <View style={styles.rowBetween}>
              <TouchableOpacity onPress={() => { setNotePrompt(null); setNoteText(''); }}>
                <Text style={styles.fontBtn}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveNote}>
                <Text style={[styles.fontBtn, { color: '#2B6BE0' }]}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function AnnotationRow({
  annotation,
  chapterTitle,
  onPress,
  onDelete,
}: {
  annotation: Annotation;
  chapterTitle: string;
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <TouchableOpacity style={styles.tocRow} onPress={onPress}>
      <Text style={styles.annotationText} numberOfLines={2}>
        {annotation.type === 'bookmark' ? '🔖 ' : annotation.type === 'note' ? '📝 ' : '✒️ '}
        {annotation.selectedText || chapterTitle}
      </Text>
      {annotation.note ? <Text style={styles.annotationNote}>{annotation.note}</Text> : null}
      <Text style={styles.annotationChapter}>{chapterTitle}</Text>
      <TouchableOpacity onPress={onDelete}>
        <Text style={styles.deleteBtn}>删除</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 10,
  },
  topBarBtn: { fontSize: 16 },
  topBarTitle: { flex: 1, textAlign: 'center', marginHorizontal: 8, fontSize: 14 },
  pageArea: { flex: 1 },
  pageContent: { flex: 1, paddingHorizontal: 16, paddingVertical: 16 },
  tapCatcher: { flex: 1 },
  paragraph: { marginBottom: 12 },
  chapterNavRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 24 },
  chapterNavBtn: { fontSize: 14, color: '#2B6BE0' },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  percentText: { fontSize: 12, color: '#999' },
  bottomBtn: { fontSize: 14 },
  ttsBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  ttsBtn: { fontSize: 13 },
  ttsBtnMain: { fontSize: 22, textAlign: 'center' },
  rateRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 10, gap: 8 },
  rateChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#EEE' },
  rateChipActive: { backgroundColor: '#2B2B2B' },
  rateChipText: { fontSize: 12, color: '#555' },
  rateChipTextActive: { color: '#FFF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, gap: 20 },
  sheetTitle: { fontSize: 15, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  fontBtn: { fontSize: 16, paddingHorizontal: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#F1F1F3' },
  chipActive: { backgroundColor: '#2B2B2B' },
  chipText: { color: '#555' },
  chipTextActive: { color: '#FFF' },
  themeSwatch: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  themeSwatchActive: { borderWidth: 3 },
  tabRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EEE' },
  tabItem: { flex: 1, alignItems: 'center', paddingBottom: 10 },
  tabLabel: { color: '#999' },
  tabLabelActive: { color: '#2B2B2B', fontWeight: '700' },
  tocRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#F3F3F3' },
  tocRowText: { fontSize: 14 },
  tocRowActive: { color: '#2B6BE0', fontWeight: '700' },
  annotationText: { fontSize: 13 },
  annotationNote: { fontSize: 12, color: '#666', marginTop: 4 },
  annotationChapter: { fontSize: 11, color: '#AAA', marginTop: 4 },
  deleteBtn: { fontSize: 12, color: '#C0392B', marginTop: 6 },
  noteDialog: { margin: 24, backgroundColor: '#FFF', borderRadius: 12, padding: 20, gap: 14 },
  noteQuote: { fontSize: 12, color: '#999', fontStyle: 'italic' },
  noteInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#EEE',
    borderRadius: 8,
    padding: 10,
    textAlignVertical: 'top',
  },
});
