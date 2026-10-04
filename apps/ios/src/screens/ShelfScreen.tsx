import { DisplayText as Text } from '../components/DisplayText';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated as RNAnimated, Easing, FlatList, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
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

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}

type Filter = 'all' | 'reading' | 'new';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'reading', label: '在读' },
  { key: 'new', label: '未开始' },
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
          <View style={[styles.emptyMark, { backgroundColor: theme.colors.primaryContainer }]}>
            <Icon name="shelf" size={44} color={theme.colors.primary} strokeWidth={1.6} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.onBackground }]}>书架还是空的</Text>
          <Text style={[styles.emptyBody, { color: theme.colors.onSurfaceVariant }]}>导入 EPUB、TXT 或 PDF，{'\n'}随时在这里继续阅读和听书。</Text>
          <Pressable accessibilityRole="button" onPress={ui.importBooks} style={({ pressed }) => [styles.primaryPill, { backgroundColor: theme.colors.primary }, pressed && { opacity: 0.85 }]}>
            <Icon name="plus" size={18} color="#FFFFFF" /><Text style={styles.primaryPillText}>导入书籍</Text>
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {FILTERS.map(f => {
              const on = f.key === filter;
              return <Pressable key={f.key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setFilter(f.key)}
                style={[styles.chip, on ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary } : { backgroundColor: theme.colors.surfaceContainerLow, borderColor: theme.colors.outlineVariant }]}>
                <Text style={{ color: on ? theme.colors.onPrimary : theme.colors.onSurfaceVariant, fontSize: 13, fontWeight: on ? '700' : '500' }}>{f.label}</Text>
              </Pressable>;
            })}
          </ScrollView>
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
                <View style={{ width: `${Math.round(percent * 100)}%`, height: '100%', borderRadius: 2, backgroundColor: theme.colors.primary }} />
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
  const card = theme.colors.inverseSurface;
  const onCard = theme.colors.inverseOnSurface;
  const sub = theme.scheme === 'dark' ? 'rgba(28,28,30,0.6)' : 'rgba(255,255,255,0.62)';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`继续阅读 ${book.title}`} onPress={onRead} onLongPress={onDetail}
      style={({ pressed }) => [styles.continueCard, { backgroundColor: card }, pressed && { opacity: 0.92 }]}>
      <BookCover book={book} width={86} height={118} />
      <View style={{ flex: 1, marginLeft: 16 }}>
        <Text style={[styles.continueOverline, { color: brand.gold }]}>继续阅读</Text>
        <Text numberOfLines={2} style={[styles.continueTitle, { color: onCard }]}>{book.title}</Text>
        <Text numberOfLines={1} style={[styles.continueMeta, { color: sub }]}>{book.author ? `${book.author} · ` : ''}{progressLabel}</Text>
        <View style={[styles.continueTrack, { backgroundColor: theme.scheme === 'dark' ? 'rgba(28,28,30,0.16)' : 'rgba(255,255,255,0.18)' }]}>
          <RNAnimated.View style={{ width, height: '100%', borderRadius: 2, backgroundColor: brand.gold }} />
        </View>
        <View style={styles.continueActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="阅读" onPress={onRead} style={({ pressed }) => [styles.readPill, { backgroundColor: onCard }, pressed && { opacity: 0.85 }]}>
            <Text style={{ color: card, fontSize: 13, fontWeight: '700' }}>阅读</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="听书" onPress={onListen} style={({ pressed }) => [styles.listenPill, { borderColor: theme.scheme === 'dark' ? 'rgba(28,28,30,0.35)' : 'rgba(255,255,255,0.5)' }, pressed && { opacity: 0.7 }]}>
            <Icon name="headphones" size={15} color={onCard} /><Text style={{ color: onCard, fontSize: 13, fontWeight: '700' }}>听书</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  emptyContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, paddingBottom: FLOATING_TAB_BAR_SPACE },
  emptyMark: { width: 104, height: 104, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontFamily: brand.serif, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  emptyBody: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  primaryPill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 46, paddingHorizontal: 24, borderRadius: 23, marginTop: 24 },
  primaryPillText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, marginTop: 4, marginBottom: 12 },
  continueCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 18, overflow: 'hidden', marginTop: 4 },
  continueOverline: { fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  continueTitle: { fontFamily: brand.serif, fontSize: 19, fontWeight: '700', lineHeight: 26, marginTop: 6 },
  continueMeta: { fontSize: 12, marginTop: 4 },
  continueTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 12 },
  continueActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  readPill: { height: 34, paddingHorizontal: 20, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  listenPill: { flexDirection: 'row', gap: 5, height: 34, paddingHorizontal: 16, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  chips: { gap: 8, paddingBottom: 16 },
  chip: { height: 34, paddingHorizontal: 16, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cell: { flex: 1, alignItems: 'center' },
  cellTitle: { fontSize: 13, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  cellMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  cellMeta: { fontSize: 11 },
  cellTrack: { height: 3, borderRadius: 2, marginTop: 5, overflow: 'hidden' },
});
