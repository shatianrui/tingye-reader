import { DisplayText as Text } from '../components/DisplayText';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated as RNAnimated,
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

import MaterialAppBar from '../components/MaterialAppBar';
import MaterialButton from '../components/MaterialButton';
import MaterialProgressBar from '../components/MaterialProgressBar';
import { useAppTheme } from '../theme/useAppTheme';
import { spacing as spacingTokens, shape as shapeTokens } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'BookDetail'>;

const EMPTY_SET: ReadonlySet<number> = new Set();

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

  if (!book) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <MaterialAppBar
          title="书籍详情"
          variant="small"
          leadingIcon="‹"
          onLeadingPress={() => navigation.goBack()}
        />
        <Text style={{ color: theme.colors.onSurfaceVariant }}>书籍不存在</Text>
      </View>
    );
  }

  const openReader = (initialChapterIndex?: number) => {
    navigation.navigate('Reader', { bookId: book.id, initialChapterIndex });
  };

  const totalChapters = chapters?.length ?? 0;

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {selectionMode ? (
        <SelectionAppBar
          selectedCount={selectedSet.size}
          totalCount={totalChapters}
          theme={theme}
          onClose={exitSelection}
          onSelectAll={selectAll}
          onMark={bulkMark}
          onUnmark={bulkUnmark}
        />
      ) : (
        <MaterialAppBar
          title="书籍详情"
          variant="small"
          leadingIcon="‹"
          onLeadingPress={() => navigation.goBack()}
        />
      )}
      <ScrollView
        contentContainerStyle={{width:'100%',maxWidth:900,alignSelf:'center',
          paddingBottom: selectionMode ? insets.bottom + 32 : insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <BookCover book={book} width={120} height={168} />
          <View style={styles.headerInfo}>
            <Text
              style={[styles.title, { color: theme.colors.onBackground }]}
              numberOfLines={3}
            >
              {book.title}
            </Text>
            <Text
              style={[styles.author, { color: theme.colors.onSurfaceVariant }]}
              numberOfLines={1}
            >
              {book.author}
            </Text>

            <View style={styles.statsRow}>
              <Stat label="章节" value={String(totalChapters||"—")} />
              <Divider />
              <Stat label="位置" value={`第 ${(nativeBook?.chapter||0)+1} 章`} />
              <Divider />
              <Stat label="分类" value={book.category} />
            </View>
          </View>
        </View>

        {percent > 0 ? (
          <View
            style={[
              styles.progressCard,
              { backgroundColor: theme.colors.surfaceContainerLow },
            ]}
          >
            <View style={styles.progressHeader}>
              <Text style={[styles.progressTitle, { color: theme.colors.onSurface }]}>
                已读 {Math.round(percent * 100)}%
              </Text>
              <Pressable
                onPress={() => openReader()}
                accessibilityRole="button"
                style={({ pressed }) => [pressed && { opacity: 0.6 }]}
              >
                <Text style={[styles.progressAction, { color: theme.colors.primary }]}>
                  继续阅读 ›
                </Text>
              </Pressable>
            </View>
            <MaterialProgressBar value={percent} height={4} />
          </View>
        ) : null}

        <Text
          style={[styles.sectionTitle, { color: theme.colors.onBackground }]}
        >
          简介
        </Text>
        <Text
          style={[styles.intro, { color: theme.colors.onSurfaceVariant }]}
        >
          {book.intro}
        </Text>

        <View style={styles.sectionHeaderRow}>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.onBackground, marginTop: 0 }]}
          >
            目录
          </Text>
          {chapters && chapters.length > 0 ? (
            <Text
              style={[styles.chapterReadCount, { color: theme.colors.onSurfaceVariant }]}
            >
              {readChapterCount > 0
                ? `已读 ${readChapterCount} / ${chapters.length}`
                : `共 ${chapters.length} 章`}
            </Text>
          ) : null}
        </View>

        {!selectionMode ? (
          <Text
            style={[
              styles.sectionHint,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            长按章节可批量管理已读状态
          </Text>
        ) : null}

        {error ? (
          <Text style={[styles.error, { color: theme.colors.error }]}>
            加载失败：{error}
          </Text>
        ) : !chapters ? (
          <ActivityIndicator style={{ marginTop: spacingTokens.lg }} color={theme.colors.primary} />
        ) : (
          <View
            style={[
              styles.chapterList,
              { backgroundColor: theme.colors.surfaceContainerLow },
            ]}
          >
            {chapters.map((c, i) => {
              const isRead = readChapterSet.has(i);
              const isSelected = selectedSet.has(i);
              const rowState: 'read' | 'selected' | 'normal' = isSelected
                ? 'selected'
                : isRead
                ? 'read'
                : 'normal';
              const onToggle = () => {
                toggleChapterRead(book.id, i);
              };
              return (
                <Pressable
                  key={i}
                  android_ripple={{ color: theme.colors.outlineVariant }}
                  style={[
                    styles.chapterRow,
                    {
                      borderBottomColor: theme.colors.outlineVariant,
                      borderBottomWidth:
                        i === chapters.length - 1 ? 0 : StyleSheet.hairlineWidth,
                      backgroundColor:
                        rowState === 'selected'
                          ? theme.colors.secondaryContainer
                          : 'transparent',
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
                          borderColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.outline,
                          backgroundColor: isSelected
                            ? theme.colors.primary
                            : 'transparent',
                        },
                      ]}
                    >
                      {isSelected ? (
                        <Text style={[styles.checkboxTick, { color: theme.colors.onPrimary }]}>
                          ✓
                        </Text>
                      ) : null}
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.chapterIndexBubble,
                        {
                          backgroundColor: isRead
                            ? theme.colors.primaryContainer
                            : theme.colors.surfaceContainerHighest,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chapterIndexText,
                          {
                            color: isRead
                              ? theme.colors.onPrimaryContainer
                              : theme.colors.onSurfaceVariant,
                          },
                        ]}
                      >
                        {isRead ? '✓' : String(i + 1).padStart(2, '0')}
                      </Text>
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
                  {!selectionMode ? (
                    <Text
                      style={[
                        styles.chapterChevron,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      ›
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {!selectionMode ? (
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
          <View style={styles.bottomRow}>
            <MaterialButton
              label="书籍管理"
              variant="tonal"
              onPress={() => ui.actions(book.id)}
              disabled={!!nativeBook?.sample}
              style={{ flex: 1 }}
            />
            <MaterialButton
              label="语音设置"
              variant="outlined"
              onPress={ui.settings}
              style={{ flex: 1 }}
            />
            <MaterialButton
              label="开始阅读"
              variant="filled"
              onPress={() => openReader(undefined)}
              style={{ flex: 1.4 }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

interface SelectionAppBarProps {
  selectedCount: number;
  totalCount: number;
  theme: ReturnType<typeof useAppTheme>;
  onClose: () => void;
  onSelectAll: () => void;
  onMark: () => void;
  onUnmark: () => void;
}

function SelectionAppBar({
  selectedCount,
  totalCount,
  theme,
  onClose,
  onSelectAll,
  onMark,
  onUnmark,
}: SelectionAppBarProps) {
  const allSelected = totalCount > 0 && selectedCount === totalCount;
  return (
    <View
      style={[
        selectionStyles.container,
        {
          backgroundColor: theme.colors.surfaceContainer,
          borderBottomColor: theme.colors.outlineVariant,
        },
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
          <Text style={[selectionStyles.icon, { color: theme.colors.onSurface }]}>✕</Text>
        </Pressable>
        <Text
          style={[selectionStyles.title, { color: theme.colors.onSurface }]}
          numberOfLines={1}
        >
          已选 {selectedCount}
          {totalCount > 0 ? ` / ${totalCount}` : ''}
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
        <MaterialButton
          label="标记为已读"
          variant="filled"
          onPress={onMark}
          disabled={selectedCount === 0}
          style={{ flex: 1 }}
        />
        <View style={{ width: spacingTokens.sm }} />
        <MaterialButton
          label="取消已读"
          variant="outlined"
          onPress={onUnmark}
          disabled={selectedCount === 0}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: theme.colors.onBackground }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Divider() {
  const theme = useAppTheme();
  return (
    <View
      style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacingTokens.lg,
    paddingTop: spacingTokens.lg,
    paddingBottom: spacingTokens.md,
  },
  headerInfo: {
    marginLeft: spacingTokens.lg,
    flex: 1,
    justifyContent: 'flex-end',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 30,
  },
  author: {
    fontSize: 14,
    marginTop: spacingTokens.sm,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacingTokens.lg,
  },
  stat: {
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    marginHorizontal: spacingTokens.md,
  },
  progressCard: {
    marginHorizontal: spacingTokens.lg,
    padding: spacingTokens.lg,
    borderRadius: shapeTokens.large,
    marginTop: spacingTokens.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacingTokens.md,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressAction: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacingTokens.xl,
    marginBottom: spacingTokens.sm,
    paddingHorizontal: spacingTokens.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacingTokens.xl,
    marginBottom: spacingTokens.sm,
    paddingHorizontal: spacingTokens.lg,
  },
  chapterReadCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  sectionHint: {
    fontSize: 11,
    paddingHorizontal: spacingTokens.lg,
    marginTop: -spacingTokens.xs,
    marginBottom: spacingTokens.sm,
  },
  intro: {
    fontSize: 14,
    lineHeight: 22,
    paddingHorizontal: spacingTokens.lg,
  },
  error: {
    paddingHorizontal: spacingTokens.lg,
  },
  chapterList: {
    marginHorizontal: spacingTokens.lg,
    borderRadius: shapeTokens.large,
    overflow: 'hidden',
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacingTokens.lg,
    paddingVertical: spacingTokens.md,
  },
  chapterIndexBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacingTokens.md,
  },
  chapterIndexText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacingTokens.md,
  },
  checkboxTick: {
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 14,
  },
  chapterTitle: {
    flex: 1,
    fontSize: 14,
  },
  chapterChevron: {
    fontSize: 18,
    marginLeft: spacingTokens.sm,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacingTokens.lg,
    paddingTop: spacingTokens.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bottomRow: {
    flexDirection: 'row',
    gap: spacingTokens.sm,
  },
});

const selectionStyles = StyleSheet.create({
  container: {
    paddingTop: spacingTokens.md,
    paddingBottom: spacingTokens.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacingTokens.sm,
    minHeight: 48,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
    fontWeight: '500',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: spacingTokens.sm,
  },
  textAction: {
    paddingHorizontal: spacingTokens.sm,
    height: 40,
    justifyContent: 'center',
  },
  textActionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacingTokens.lg,
    paddingTop: spacingTokens.sm,
  },
});