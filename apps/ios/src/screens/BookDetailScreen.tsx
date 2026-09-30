import { DisplayText as Text } from '../components/DisplayText';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {useLibraryUI} from '../tingye/library-ui';

import type { Chapter } from '../types/models';
import BookCover from '../components/BookCover';
import Icon, { type IconName } from '../components/Icon';
import Gradient from '../components/Gradient';
import { useAppTheme } from '../theme/useAppTheme';
import { spacing as spacingTokens, brand } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'BookDetail'>;

const EMPTY_SET: ReadonlySet<number> = new Set();
const CONTENT_MAX_WIDTH = 900;

export default function BookDetailScreen({ route, navigation }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const ui=useLibraryUI();
  const book = ui.books.find((b) => b.id === route.params.bookId);
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nativeBook=ui.nativeBooks.find(b=>b.id===book?.id);
  const percent=chapters?.length?Math.min(1,(nativeBook?.chapter||0)/chapters.length):0;
  const toggleChapterRead=ui.toggleMark;
  const readChapterSet=useMemo(()=>new Set(book?ui.marks[book.id]||[]:[]),[ui.marks,book?.id]);
  const readChapterCount = readChapterSet.size;

  // ----- Selection / multi-select state -----
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSet, setSelectedSet] = useState<Set<number>>(new Set());

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedSet(new Set());
  }, []);

  // Auto-exit selection mode if the set drains to empty.
  useEffect(() => {
    if (selectionMode && selectedSet.size === 0) {
      setSelectionMode(false);
    }
  }, [selectionMode, selectedSet]);

  const onChapterLongPress = useCallback(
    (i: number) => {
      setSelectionMode((prev) => {
        if (!prev) {
          setSelectedSet(new Set([i]));
          return true;
        }
        setSelectedSet((prevSet) => {
          const next = new Set(prevSet);
          if (next.has(i)) next.delete(i);
          else next.add(i);
          return next;
        });
        return true;
      });
    },
    []
  );

  const onChapterPress = useCallback(
    (i: number) => {
      if (selectionMode) {
        setSelectedSet((prev) => {
          const next = new Set(prev);
          if (next.has(i)) next.delete(i);
          else next.add(i);
          return next;
        });
        return;
      }
      navigation.navigate('Reader', { bookId: book!.id, initialChapterIndex: i });
    },
    [selectionMode, book, navigation]
  );

  const bulkMark = useCallback(() => {
    if (!book) return;
    let touched = 0;
    for (const i of selectedSet) {
      if (!readChapterSet.has(i)) {
        toggleChapterRead(book.id, i);
        touched++;
      }
    }
    exitSelection();
    if (touched > 0) {
      // Lightweight inline feedback; users feel their tap registered.
    }
  }, [book, selectedSet, readChapterSet, toggleChapterRead, exitSelection]);

  const bulkUnmark = useCallback(() => {
    if (!book) return;
    for (const i of selectedSet) {
      if (readChapterSet.has(i)) toggleChapterRead(book.id, i);
    }
    exitSelection();
  }, [book, selectedSet, readChapterSet, toggleChapterRead, exitSelection]);

  const selectAll = useCallback(() => {
    if (!chapters) return;
    setSelectedSet(new Set(chapters.map((_, i) => i)));
  }, [chapters]);

  useEffect(()=>{
    let live=true;setError(null);setChapters(null);
    if(book)void ui.load(book.id).then(b=>{if(live)setChapters(b.chapters.map(c=>({title:c.title,content:c.text})));}).catch(e=>{if(live)setError(e.message);});
    return()=>{live=false;};
  },[book?.id,ui.load]);

  const openReader = (initialChapterIndex?: number) => {
    navigation.navigate('Reader', { bookId: book!.id, initialChapterIndex });
  };

  const totalChapters = chapters?.length ?? 0;
  const selectionBarHeight = insets.top + 116;

  const hero = book ? (
    <View style={styles.hero}>
      <Gradient from={brand.green} to={brand.deep} id="book-detail" />
      <View style={styles.heroGlow} />
      <View style={styles.heroInner}>
        <View style={styles.heroTop}>
          <View style={styles.heroCover}><BookCover book={book} width={104} height={146} /></View>
          <View style={styles.heroInfo}>
            <Text numberOfLines={1} style={styles.heroOverline}>{book.category}</Text>
            <Text style={styles.heroTitle} numberOfLines={3}>{book.title}</Text>
            {!!book.author && <Text style={styles.heroAuthor} numberOfLines={1}>{book.author}</Text>}
            <View style={styles.heroStats}>
              <HeroStat label="章节" value={String(totalChapters || '—')} />
              <HeroDivider />
              <HeroStat label="当前" value={`第 ${(nativeBook?.chapter || 0) + 1} 章`} />
              <HeroDivider />
              <HeroStat label="藏书" value={nativeBook?.sample ? '示例' : '已导入'} />
            </View>
          </View>
        </View>

        {percent > 0 ? (
          <View style={styles.heroProgress}>
            <View style={styles.heroProgressRow}>
              <Text style={styles.heroProgressTitle}>已读 {Math.round(percent * 100)}%</Text>
              <Text style={styles.heroProgressMeta}>
                第 {Math.min(totalChapters, (nativeBook?.chapter || 0) + 1)} / {totalChapters} 章
              </Text>
            </View>
            <View style={styles.heroTrack}>
              <View style={{ width: `${Math.round(percent * 100)}%`, height: '100%', borderRadius: 2, backgroundColor: brand.gold }} />
            </View>
          </View>
        ) : null}

        <View style={styles.ctaRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={percent > 0 ? `继续阅读 ${book.title}` : `开始阅读 ${book.title}`}
            onPress={() => openReader(undefined)}
            style={({ pressed }) => [styles.ctaRead, pressed && { opacity: 0.88 }]}
          >
            <Icon name="play" size={16} color={brand.deep} />
            <Text style={styles.ctaReadText}>{percent > 0 ? '继续阅读' : '开始阅读'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`听书 ${book.title}`}
            onPress={() => navigation.navigate('Reader', { bookId: book.id, listen: true })}
            style={({ pressed }) => [styles.ctaListen, pressed && { opacity: 0.7 }]}
          >
            <Icon name="headphones" size={16} color="#FFFFFF" />
            <Text style={styles.ctaListenText}>听书</Text>
          </Pressable>
        </View>
      </View>
    </View>
  ) : null;

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: selectionMode ? selectionBarHeight : 0,
          paddingBottom: selectionMode ? insets.bottom + 32 : insets.bottom + 104,
        }}
        showsVerticalScrollIndicator={false}
        scrollIndicatorInsets={{ top: selectionMode ? selectionBarHeight : 0 }}
      >
        {!book ? (
          <View style={styles.missing}>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>书籍不存在</Text>
          </View>
        ) : (
          <>
            {hero}

            <View style={styles.body}>
              <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>简介</Text>
              <View style={[styles.card, { backgroundColor: theme.colors.surfaceContainerLow, borderColor: theme.colors.outlineVariant }]}>
                <Text style={[styles.intro, { color: theme.colors.onSurfaceVariant }]}>{book.intro}</Text>
              </View>

              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: theme.colors.onSurface, marginTop: 0 }]}>目录</Text>
                {chapters && chapters.length > 0 ? (
                  <Text style={[styles.chapterReadCount, { color: theme.colors.onSurfaceVariant }]}>
                    {readChapterCount > 0 ? `已读 ${readChapterCount} / ${chapters.length}` : `共 ${chapters.length} 章`}
                  </Text>
                ) : null}
              </View>

              {!selectionMode ? (
                <Text style={[styles.sectionHint, { color: theme.colors.onSurfaceVariant }]}>
                  长按章节可批量管理已读状态
                </Text>
              ) : null}

              {error ? (
                <Text style={[styles.error, { color: theme.colors.error }]}>加载失败：{error}</Text>
              ) : !chapters ? (
                <ActivityIndicator style={{ marginTop: spacingTokens.xl }} color={theme.colors.primary} />
              ) : (
                <View style={[styles.card, { backgroundColor: theme.colors.surfaceContainerLow, borderColor: theme.colors.outlineVariant, padding: 0 }]}>
                  {chapters.map((c, i) => {
                    const isRead = readChapterSet.has(i);
                    const isSelected = selectedSet.has(i);
                    const rowState: 'read' | 'selected' | 'normal' = isSelected
                      ? 'selected'
                      : isRead
                      ? 'read'
                      : 'normal';
                    return (
                      <Pressable
                        key={i}
                        android_ripple={{ color: theme.colors.outlineVariant }}
                        style={[
                          styles.chapterRow,
                          {
                            borderBottomColor: theme.colors.outlineVariant,
                            borderBottomWidth: i === chapters.length - 1 ? 0 : StyleSheet.hairlineWidth,
                            backgroundColor: rowState === 'selected' ? theme.colors.secondaryContainer : 'transparent',
                          } as StyleProp<ViewStyle>,
                        ]}
                        onPress={() => onChapterPress(i)}
                        onLongPress={() => onChapterLongPress(i)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={
                          isRead
                            ? `${c.title}，已读${isSelected ? '，已选中' : ''}`
                            : `${c.title}，未读${isSelected ? '，已选中' : ''}`
                        }
                      >
                        {selectionMode ? (
                          <View
                            style={[
                              styles.checkbox,
                              {
                                borderColor: isSelected ? theme.colors.primary : theme.colors.outline,
                                backgroundColor: isSelected ? theme.colors.primary : 'transparent',
                              },
                            ]}
                          >
                            {isSelected ? <Icon name="check" size={13} color={theme.colors.onPrimary} strokeWidth={2.4} /> : null}
                          </View>
                        ) : (
                          <View
                            style={[
                              styles.chapterIndexBubble,
                              { backgroundColor: isRead ? theme.colors.primaryContainer : theme.colors.surfaceContainerHighest },
                            ]}
                          >
                            {isRead ? (
                              <Icon name="check" size={13} color={theme.colors.onPrimaryContainer} strokeWidth={2.4} />
                            ) : (
                              <Text style={[styles.chapterIndexText, { color: theme.colors.onSurfaceVariant }]}>
                                {String(i + 1).padStart(2, '0')}
                              </Text>
                            )}
                          </View>
                        )}
                        <Text
                          style={[
                            styles.chapterTitle,
                            {
                              color:
                                rowState === 'selected'
                                  ? theme.colors.onSecondaryContainer
                                  : isRead
                                  ? theme.colors.onSurfaceVariant
                                  : theme.colors.onSurface,
                              textDecorationLine: !selectionMode && isRead ? 'line-through' : 'none',
                              fontWeight: rowState === 'selected' ? '600' : '500',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {c.title}
                        </Text>
                        {!selectionMode ? <Icon name="chev" size={16} color={theme.colors.onSurfaceVariant} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {selectionMode ? (
        <SelectionBar
          selectedCount={selectedSet.size}
          totalCount={totalChapters}
          insetTop={insets.top}
          onClose={exitSelection}
          onSelectAll={selectAll}
          onMark={bulkMark}
          onUnmark={bulkUnmark}
        />
      ) : book ? (
        <FloatingNav insetTop={insets.top} onBack={() => navigation.goBack()} onVoice={ui.settings} />
      ) : (
        <FloatingNav insetTop={insets.top} onBack={() => navigation.goBack()} />
      )}

      {!selectionMode && book ? (
        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: insets.bottom + spacingTokens.sm,
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.outlineVariant,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="书籍管理"
            accessibilityState={{ disabled: !!nativeBook?.sample }}
            disabled={!!nativeBook?.sample}
            onPress={() => ui.actions(book.id)}
            style={({ pressed }) => [
              styles.managePill,
              { backgroundColor: theme.colors.secondaryContainer },
              (pressed || !!nativeBook?.sample) && { opacity: nativeBook?.sample ? 0.4 : 0.7 },
            ]}
          >
            <Icon name="sliders" size={17} color={theme.colors.onSecondaryContainer} />
            <Text style={[styles.managePillText, { color: theme.colors.onSecondaryContainer }]}>书籍管理 · 备份 / 修复 / 移除</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** Frosted circular buttons floating over the brand hero. */
function FloatingNav({ insetTop, onBack, onVoice }: { insetTop: number; onBack: () => void; onVoice?: () => void }) {
  return (
    <View style={[styles.floatingNav, { paddingTop: insetTop + 8 }]} pointerEvents="box-none">
      <View style={styles.floatingRow}>
        <NavCircle icon="back" label="返回书架" onPress={onBack} />
        <View style={{ flex: 1 }} />
        {onVoice ? <NavCircle icon="mic" label="语音设置" onPress={onVoice} /> : null}
      </View>
    </View>
  );
}

function NavCircle({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.navCircle, pressed && { opacity: 0.75 }]}
    >
      <Icon name={icon} size={20} color="#FFFFFF" />
    </Pressable>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStat}>
      <Text numberOfLines={1} style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function HeroDivider() {
  return <View style={styles.heroDivider} />;
}

interface SelectionBarProps {
  selectedCount: number;
  totalCount: number;
  insetTop: number;
  onClose: () => void;
  onSelectAll: () => void;
  onMark: () => void;
  onUnmark: () => void;
}

function SelectionBar({
  selectedCount,
  totalCount,
  insetTop,
  onClose,
  onSelectAll,
  onMark,
  onUnmark,
}: SelectionBarProps) {
  const theme = useAppTheme();
  const allSelected = totalCount > 0 && selectedCount === totalCount;
  const disabled = selectedCount === 0;
  return (
    <View
      style={[
        selectionStyles.container,
        { paddingTop: insetTop + 6, backgroundColor: theme.colors.surfaceContainer, borderBottomColor: theme.colors.outlineVariant },
      ]}
    >
      <View style={selectionStyles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="退出选择"
          onPress={onClose}
          style={({ pressed }) => [selectionStyles.iconButton, pressed && { opacity: 0.6 }]}
          hitSlop={8}
        >
          <Icon name="close" size={18} color={theme.colors.onSurface} />
        </Pressable>
        <Text style={[selectionStyles.title, { color: theme.colors.onSurface }]} numberOfLines={1}>
          已选 {selectedCount}{totalCount > 0 ? ` / ${totalCount}` : ''}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={allSelected ? '取消全选' : '全选'}
          onPress={onSelectAll}
          style={({ pressed }) => [selectionStyles.textAction, pressed && { opacity: 0.6 }]}
          hitSlop={8}
        >
          <Text style={[selectionStyles.textActionLabel, { color: theme.colors.primary }]}>
            {allSelected ? '取消全选' : '全选'}
          </Text>
        </Pressable>
      </View>
      <View style={selectionStyles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="标记为已读"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onMark}
          style={({ pressed }) => [
            selectionStyles.pill,
            { backgroundColor: theme.colors.primary },
            (pressed || disabled) && { opacity: disabled ? 0.4 : 0.8 },
          ]}
        >
          <Icon name="check" size={16} color={theme.colors.onPrimary} strokeWidth={2.2} />
          <Text style={[selectionStyles.pillLabel, { color: theme.colors.onPrimary }]}>标记为已读</Text>
        </Pressable>
        <View style={{ width: spacingTokens.sm }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="取消已读"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onUnmark}
          style={({ pressed }) => [
            selectionStyles.pill,
            { borderColor: theme.colors.outline },
            (pressed || disabled) && { opacity: disabled ? 0.4 : 0.7 },
          ]}
        >
          <Text style={[selectionStyles.pillLabel, { color: theme.colors.primary }]}>取消已读</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  missing: { flex: 1, minHeight: 240, alignItems: 'center', justifyContent: 'center' },

  // ----- Brand hero -----
  hero: { overflow: 'hidden', borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, right: -80, top: -90, backgroundColor: 'rgba(201,162,89,0.18)' },
  heroInner: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', paddingHorizontal: spacingTokens.xl, paddingTop: 64, paddingBottom: spacingTokens.xl },
  heroTop: { flexDirection: 'row' },
  heroCover: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 10 },
  heroInfo: { flex: 1, marginLeft: spacingTokens.xl, justifyContent: 'flex-end' },
  heroOverline: { color: brand.gold, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  heroTitle: { color: '#FFFFFF', fontFamily: brand.serif, fontSize: 22, fontWeight: '700', lineHeight: 30, marginTop: 6 },
  heroAuthor: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: spacingTokens.xs },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: spacingTokens.lg },
  heroStat: { flex: 1 },
  heroStatValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  heroStatLabel: { color: 'rgba(255,255,255,0.62)', fontSize: 10, marginTop: 3, letterSpacing: 0.4 },
  heroDivider: { width: StyleSheet.hairlineWidth, height: 22, marginHorizontal: spacingTokens.md, backgroundColor: 'rgba(255,255,255,0.22)' },
  heroProgress: { marginTop: spacingTokens.xl },
  heroProgressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacingTokens.sm },
  heroProgressTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  heroProgressMeta: { color: 'rgba(255,255,255,0.65)', fontSize: 11 },
  heroTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  ctaRow: { flexDirection: 'row', gap: spacingTokens.md, marginTop: spacingTokens.xl },
  ctaRead: { flex: 1.4, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  ctaReadText: { color: brand.deep, fontSize: 15, fontWeight: '700' },
  ctaListen: { flex: 1, height: 48, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  ctaListenText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  // ----- Floating nav -----
  floatingNav: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, paddingHorizontal: spacingTokens.lg },
  floatingRow: { flexDirection: 'row', alignItems: 'center', width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  navCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },

  // ----- Body -----
  body: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', paddingHorizontal: spacingTokens.xl },
  sectionTitle: { fontFamily: brand.serif, fontSize: 19, fontWeight: '700', marginTop: spacingTokens.xl, marginBottom: spacingTokens.sm },
  card: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  intro: { fontSize: 14, lineHeight: 23, padding: spacingTokens.lg },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: spacingTokens.xl, marginBottom: spacingTokens.sm },
  chapterReadCount: { fontSize: 12, fontWeight: '500' },
  sectionHint: { fontSize: 11, marginTop: -spacingTokens.xs, marginBottom: spacingTokens.sm },
  error: { paddingHorizontal: spacingTokens.xs },
  chapterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacingTokens.lg, paddingVertical: spacingTokens.md },
  chapterIndexBubble: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: spacingTokens.md },
  chapterIndexText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: spacingTokens.md },
  chapterTitle: { flex: 1, fontSize: 14, marginRight: spacingTokens.sm },

  // ----- Bottom bar -----
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacingTokens.xl,
    paddingTop: spacingTokens.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: brand.ink,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  managePill: {
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  managePillText: { fontSize: 14, fontWeight: '600' },
});

const selectionStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    paddingBottom: spacingTokens.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacingTokens.sm, minHeight: 48 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 16, fontWeight: '700', fontFamily: brand.serif, paddingHorizontal: spacingTokens.sm },
  textAction: { paddingHorizontal: spacingTokens.sm, height: 40, justifyContent: 'center' },
  textActionLabel: { fontSize: 14, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', paddingHorizontal: spacingTokens.lg, paddingTop: spacingTokens.sm },
  pill: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pillLabel: { fontSize: 14, fontWeight: '600' },
});
