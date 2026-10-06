import { DisplayText as Text } from '../components/DisplayText';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated as RNAnimated, Easing, FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Book } from '../types/models';
import { useLibraryUI, positionLabel, bookProgress } from '../tingye/library-ui';
import { adaptiveShelfLayout } from '../tingye/reader-layout';
import BookCover from '../components/BookCover';
import Icon from '../components/Icon';
import ScreenHeader from '../components/ScreenHeader';
import { FLOATING_TAB_BAR_SPACE } from '../components/MaterialNavBar';
import { useAppTheme } from '../theme/useAppTheme';
import { brand } from '../theme/tokens';
import { BrushStroke, Diamond, InkMountains, Seal } from '../components/Ink';

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}

type Filter = 'all' | 'reading' | 'new';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'reading', label: '在读' },
  { key: 'new', label: '未开卷' },
];

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ShelfScreen({ navigation }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const ui = useLibraryUI();
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const width = windowWidth - insets.left - insets.right;
  const { columns, shelfWidth, cellWidth, coverWidth, coverHeight } = adaptiveShelfLayout(width, fontScale);
  const [filter, setFilter] = useState<Filter>('all');
  const list = useRef<FlatList<Book>>(null), headerHeight = useRef(0), scrollAnchor = useRef({ index: 0, headerOffset: 0 });
  const previousColumns = useRef(columns), restore = useRef(false);
  const rowHeight = coverHeight + Math.ceil(70 * fontScale);
  if (previousColumns.current !== columns) { previousColumns.current = columns; restore.current = true; }
  const restoreScroll = () => {
    if (!restore.current) return;
    restore.current = false;
    const a = scrollAnchor.current;
    list.current?.scrollToOffset({ offset: a.headerOffset >= 0 ? a.headerOffset : headerHeight.current + Math.floor(a.index / columns) * rowHeight, animated: false });
  };
  const native = (id?: string) => ui.nativeBooks.find(b => b.id === id);
  const all = ui.books;
  const items = useMemo(() => filter === 'all' ? all : all.filter(b => {
    const n = ui.nativeBooks.find(x => x.id === b.id);
    const started = !!n && (!!n.chapter || !!n.position);
    return filter === 'reading' ? started : !started;
  }), [all, filter, ui.nativeBooks]);
  const continueReading = all[0];
  const minutes = Math.round((ui.stats[todayKey()] || 0) / 60);
  const subtitle = `${all.length} 本书 · 今日已读 ${minutes} 分钟`;
  const actions = [
    { icon: 'search' as const, label: '搜索', onPress: () => navigation.navigate('Search') },
    { icon: 'sync' as const, label: ui.busy ? '同步中' : '同步', onPress: ui.refresh, disabled: ui.busy },
    { icon: 'plus' as const, label: '导入书籍', onPress: ui.importBooks, disabled: ui.busy },
  ];

  if (all.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
        <ScreenHeader title="书架" subtitle="导入第一本书开始阅读" actions={actions} />
        <View style={styles.emptyContent}>
          <Seal char="页" size={88} color={theme.colors.tertiary} ink={theme.colors.onTertiary} style={styles.emptyMark} />
          <Text style={[styles.emptyTitle, { color: theme.colors.onBackground }]}>书架还是空的</Text>
          <Text style={[styles.emptyBody, { color: theme.colors.onSurfaceVariant }]}>导入 EPUB、TXT 或 PDF，{'\n'}随时在这里继续阅读和听书。</Text>
          <Pressable accessibilityRole="button" onPress={ui.importBooks} style={({ pressed }) => [styles.primaryPill, { backgroundColor: theme.colors.primary }, pressed && { opacity: 0.85 }]}>
            <Icon name="plus" size={18} color={theme.colors.onPrimary} /><Text style={[styles.primaryPillText, { color: theme.colors.onPrimary }]}>导入书籍</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader title="书架" subtitle={subtitle} actions={actions} />
      <FlatList ref={list}
        style={{ width: shelfWidth, alignSelf: 'center' }}
        onContentSizeChange={restoreScroll}
        onScroll={event => { if (restore.current) return; const y = event.nativeEvent.contentOffset.y; scrollAnchor.current = y < headerHeight.current ? { index: 0, headerOffset: Math.max(0, y) } : { index: Math.floor((y - headerHeight.current) / rowHeight) * columns, headerOffset: -1 }; }}
        scrollEventThrottle={100}
        data={items}
        keyExtractor={b => b.id}
        key={columns}
        numColumns={columns}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: FLOATING_TAB_BAR_SPACE + insets.bottom }}
        ListHeaderComponent={<View onLayout={event => { headerHeight.current = event.nativeEvent.layout.height; }}>
          {!!ui.notice && <Pressable accessibilityRole="button" accessibilityHint="轻点关闭提示" onPress={ui.dismissNotice}
            style={[styles.notice, { backgroundColor: theme.colors.surfaceContainerLow, borderColor: theme.colors.outlineVariant }]}>
            <Icon name="cloud" size={18} color={theme.colors.primary} />
            <Text style={{ flex: 1, color: theme.colors.onSurfaceVariant, fontSize: 13, lineHeight: 19 }}>{ui.notice}</Text>
            <Icon name="close" size={16} color={theme.colors.outline} />
          </Pressable>}
          {continueReading && <ContinueReadingCard
            book={continueReading}
            percent={bookProgress(native(continueReading.id))}
            progressLabel={positionLabel(native(continueReading.id))}
            onRead={() => navigation.navigate('Reader', { bookId: continueReading.id })}
            onListen={() => navigation.navigate('Reader', { bookId: continueReading.id, listen: true })}
            onDetail={() => navigation.navigate('BookDetail', { bookId: continueReading.id })}
          />}
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>我的书架</Text>
            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>长按书籍可备份 / 修复 / 移除</Text>
          </View>
          <View style={[styles.chips, { borderBottomColor: theme.colors.outlineVariant }]}>
            {FILTERS.map(f => {
              const on = f.key === filter;
              return <Pressable key={f.key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setFilter(f.key)} style={styles.chip}>
                <Text style={{ color: on ? theme.colors.onSurface : theme.colors.onSurfaceVariant, fontSize: 15, fontWeight: on ? '700' : '400', letterSpacing: 1 }}>{f.label}</Text>
                {on ? <BrushStroke width={30} color={theme.colors.tertiary} /> : <View style={{ height: 6 }} />}
              </Pressable>;
            })}
          </View>
          {items.length === 0 && <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', paddingVertical: 32 }}>这个分类暂时没有书</Text>}
        </View>}
        columnWrapperStyle={{ gap: 12 }}
        renderItem={({ item }) => {
          const n = native(item.id);
          const percent = bookProgress(n);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.title}，${positionLabel(n)}`}
              accessibilityHint="长按查看更多操作"
              style={({ pressed }) => [styles.cell, { maxWidth: cellWidth, height: rowHeight }, pressed && { opacity: 0.7 }]}
              onPress={() => navigation.navigate('Reader', { bookId: item.id })}
              onLongPress={() => ui.actions(item.id)}
            >
              <BookCover book={item} width={coverWidth} height={coverHeight} />
              <Text style={[styles.cellTitle, { maxWidth: cellWidth - 4, color: theme.colors.onBackground }]} numberOfLines={1}>{item.title}</Text>
              <View style={[styles.cellMetaRow, { width: coverWidth }]}>
                <Text style={[styles.cellMeta, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>{positionLabel(n)}</Text>
                {percent > 0 && <Text style={[styles.cellMeta, { color: theme.colors.primary }]}>{Math.round(percent * 100)}%</Text>}
              </View>
              {percent > 0 && <View style={[styles.cellTrack, { width: coverWidth, backgroundColor: theme.colors.outlineVariant }]}>
                <View style={{ width: `${Math.round(percent * 100)}%`, height: '100%', backgroundColor: theme.colors.primary }} />
              </View>}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

interface ContinueCardProps {
  book: Book;
  progressLabel: string;
  percent: number;
  onRead: () => void;
  onListen: () => void;
  onDetail: () => void;
}

function ContinueReadingCard({ book, percent, progressLabel, onRead, onListen, onDetail }: ContinueCardProps) {
  const theme = useAppTheme();
  const fill = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    fill.setValue(0);
    RNAnimated.timing(fill, { toValue: percent, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [percent, fill]);
  const width = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`继续阅读 ${book.title}`} onPress={onRead} onLongPress={onDetail}
      style={({ pressed }) => [styles.continueCard, { backgroundColor: theme.colors.surfaceContainerLow, borderColor: theme.colors.outlineVariant }, pressed && { opacity: 0.92 }]}>
      <InkMountains width="100%" height={84} color={theme.colors.onSurface} style={styles.continueWash} />
      <View style={styles.continueCover}><BookCover book={book} width={86} height={118} /></View>
      <View style={{ flex: 1, marginLeft: 16 }}>
        <View style={styles.continueOverlineRow}>
          <Diamond size={7} color={theme.colors.tertiary} />
          <Text style={[styles.continueOverline, { color: theme.colors.onSurfaceVariant }]}>继续阅读</Text>
        </View>
        <Text numberOfLines={2} style={[styles.continueTitle, { color: theme.colors.onSurface }]}>{book.title}</Text>
        <Text numberOfLines={1} style={[styles.continueMeta, { color: theme.colors.onSurfaceVariant }]}>{book.author ? `${book.author} · ` : ''}{progressLabel}</Text>
        <View style={[styles.continueTrack, { backgroundColor: theme.colors.outline }]}>
          <RNAnimated.View style={{ width, height: 3, marginTop: -1, backgroundColor: theme.colors.onSurface }} />
        </View>
        <View style={styles.continueActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="阅读" onPress={onRead} style={({ pressed }) => [styles.readPill, { backgroundColor: theme.colors.primary }, pressed && { opacity: 0.85 }]}>
            <Text style={{ color: theme.colors.onPrimary, fontSize: 15, letterSpacing: 4 }}>续读</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="听书" onPress={onListen} hitSlop={4} style={({ pressed }) => pressed && { opacity: 0.75 }}>
            <Seal size={44} color={theme.colors.tertiary} ink={theme.colors.onTertiary} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  emptyContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, paddingBottom: FLOATING_TAB_BAR_SPACE },
  emptyMark: { marginBottom: 24 },
  emptyTitle: { fontFamily: brand.brush, fontSize: 30, lineHeight: 38, marginBottom: 8 },
  emptyBody: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  primaryPill: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 26, borderRadius: 2, marginTop: 24 },
  primaryPillText: { fontSize: 15, letterSpacing: 4 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 2, borderWidth: StyleSheet.hairlineWidth, marginTop: 4, marginBottom: 12 },
  continueCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, padding: 16, overflow: 'hidden', marginTop: 4 },
  continueWash: { position: 'absolute', left: 60, right: 0, bottom: 0 },
  continueCover: { shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 5 } },
  continueOverlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  continueOverline: { fontSize: 12, letterSpacing: 2 },
  continueTitle: { fontFamily: brand.brush, fontSize: 28, lineHeight: 36, marginTop: 2 },
  continueMeta: { fontSize: 12, marginTop: 2 },
  continueTrack: { height: StyleSheet.hairlineWidth, marginTop: 12 },
  continueActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  readPill: { height: 44, paddingHorizontal: 22, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 24, marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  chips: { flexDirection: 'row', gap: 24, marginBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  chip: { minHeight: 46, alignItems: 'center', justifyContent: 'center', gap: 2 },
  cell: { flex: 1, alignItems: 'center' },
  cellTitle: { fontSize: 13, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  cellMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  cellMeta: { fontSize: 11 },
  cellTrack: { height: 2, marginTop: 5, overflow: 'hidden' },
});
