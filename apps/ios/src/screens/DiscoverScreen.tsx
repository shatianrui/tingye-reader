import { DisplayText as Text } from '../components/DisplayText';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {useLibraryUI} from '../tingye/library-ui';
import type { Book } from '../types/models';
import BookCover from '../components/BookCover';
import ScreenHeader from '../components/ScreenHeader';
import Gradient from '../components/Gradient';
import { FLOATING_TAB_BAR_SPACE } from '../components/MaterialNavBar';
import { useAppTheme } from '../theme/useAppTheme';
import { spacing as spacingTokens, brand } from '../theme/tokens';

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}

function RankingCard({
  title,
  books,
  onPress,
}: {
  title: string;
  books: Book[];
  onPress: (id: string) => void;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.rankingCard,
        { backgroundColor: theme.colors.surfaceContainerLow, borderColor: theme.colors.outlineVariant },
      ]}
    >
      <Text style={[styles.rankingTitle, { color: theme.colors.onSurface }]}>{title}</Text>
      {books.slice(0, 3).map((b, i) => (
        <TouchableOpacity
          key={b.id}
          style={styles.rankingRow}
          onPress={() => onPress(b.id)}
        >
          <View
            style={[
              styles.rankingBadge,
              {
                backgroundColor:
                  i === 0 ? brand.gold : theme.colors.primaryContainer,
              },
            ]}
          >
            <Text
              style={[
                styles.rankingBadgeText,
                { color: i === 0 ? '#FFFFFF' : theme.colors.primary },
              ]}
            >
              {i + 1}
            </Text>
          </View>
          <Text
            style={[styles.rankingBookTitle, { color: theme.colors.onSurface }]}
            numberOfLines={1}
          >
            {b.title}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function BookListTile({ book, onPress }: { book: Book; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.listTile,
        { borderBottomColor: theme.colors.outlineVariant },
        pressed && ({ backgroundColor: theme.colors.surfaceContainerLow } as StyleProp<ViewStyle>),
      ]}
      onPress={onPress}
      android_ripple={{ color: theme.colors.outlineVariant }}
    >
      <BookCover book={book} width={64} height={88} />
      <View style={styles.listTileInfo}>
        <Text
          style={[styles.listTileTitle, { color: theme.colors.onSurface }]}
          numberOfLines={1}
        >
          {book.title}
        </Text>
        <Text
          style={[styles.listTileAuthor, { color: theme.colors.onSurfaceVariant }]}
          numberOfLines={1}
        >
          {book.author} · {book.category}
        </Text>
        <Text
          style={[styles.listTileIntro, { color: theme.colors.onSurfaceVariant }]}
          numberOfLines={2}
        >
          {book.intro}
        </Text>
      </View>
    </Pressable>
  );
}

export default function DiscoverScreen({ navigation }: Props) {
  const ui=useLibraryUI(),sampleBooks=ui.books;
  const bookCategories=useMemo(()=>['全部',...new Set(sampleBooks.map(b=>b.category))],[sampleBooks]);
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState('全部');

  const topRated = useMemo(() => [...sampleBooks].sort((a, b) => b.rating - a.rating), [sampleBooks]);
  const topReaders = useMemo(() => [...sampleBooks].sort((a, b) => b.readers - a.readers), [sampleBooks]);
  const newest = useMemo(() => sampleBooks.filter((b) => b.isNew), [sampleBooks]);

  const filtered = useMemo(
    () => (category === '全部' ? sampleBooks : sampleBooks.filter((b) => b.category === category)),
    [category,sampleBooks]
  );

  const openDetail = (bookId: string) => navigation.navigate('BookDetail', { bookId });

  // Hero carousel: feature top-rated first, then "rising" picks, then newest.
  // De-duplicate by id so a single book never appears twice in the strip.
  const heroBooks = useMemo(() => {
    const seen = new Set<string>();
    const out: Book[] = [];
    for (const b of topRated) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      out.push(b);
      if (out.length >= 3) break;
    }
    for (const b of topReaders) {
      if (seen.has(b.id) || out.length >= 5) continue;
      seen.add(b.id);
      out.push(b);
    }
    for (const b of newest) {
      if (out.length >= 5) break;
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      out.push(b);
      if (out.length >= 5) break;
    }
    return out;
  }, [topRated, topReaders, newest]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader
        title="发现"
        subtitle="从你的书架里挑一本，读或听"
        actions={[{ icon: 'search', label: '搜索', onPress: () => navigation.navigate('Search') }]}
      />

      <FlatList
        data={filtered}
        keyExtractor={(b) => b.id}
        ListHeaderComponent={
          <View>
            {heroBooks.length > 0 ? (
              <HeroCarousel books={heroBooks} onPress={openDetail} />
            ) : null}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rankingScroll}
            >
              <RankingCard title="我的藏书" books={topRated} onPress={openDetail} />
              <RankingCard title="最近收藏" books={topReaders} onPress={openDetail} />
              <RankingCard title="待阅读" books={newest} onPress={openDetail} />
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipScroll}
            >
              {bookCategories.map((c) => {
                const on = category === c;
                return (
                  <Pressable
                    key={c}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => setCategory(c)}
                    style={[styles.chip, on ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary } : { backgroundColor: theme.colors.surfaceContainerLow, borderColor: theme.colors.outlineVariant }]}
                  >
                    <Text style={{ color: on ? theme.colors.onPrimary : theme.colors.onSurfaceVariant, fontSize: 13, fontWeight: on ? '700' : '500' }}>{c}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text
              style={[
                styles.sectionTitle,
                { color: theme.colors.onBackground },
              ]}
            >
              {category === '全部' ? '我的书籍' : `${category} · 好书`}
            </Text>
          </View>
        }
        renderItem={({ item }) => <BookListTile book={item} onPress={() => openDetail(item.id)} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + FLOATING_TAB_BAR_SPACE }}
      />
    </View>
  );
}

function HeroSlide({
  book,
  onPress,
  width,
}: {
  book: Book;
  onPress: () => void;
  width: number;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: theme.colors.outlineVariant }}
      style={({ pressed }) => [
        styles.hero,
        {
          width:Math.max(0,width-spacingTokens.lg*2),
          backgroundColor: brand.deep,
          opacity: pressed ? 0.95 : 1,
        },
      ]}
    >
      <Gradient from={brand.green} to={brand.deep} id={'hero' + book.id.replace(/[^a-zA-Z0-9]/g, '')} />
      <BookCover book={book} width={84} height={116} />
      <View style={styles.heroInfo}>
        <Text
          style={[styles.heroOverline, { color: brand.gold }]}
          numberOfLines={1}
        >
          今日推荐
        </Text>
        <Text
          style={[styles.heroTitle, { color: '#FFFFFF' }]}
          numberOfLines={2}
        >
          {book.title}
        </Text>
        <Text
          style={[styles.heroAuthor, { color: '#FFFFFF' }]}
          numberOfLines={1}
        >
          {book.author} · {book.category}
        </Text>
        <Text
          style={[styles.heroIntro, { color: '#FFFFFF' }]}
          numberOfLines={2}
        >
          {book.intro}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Paged carousel that auto-advances every 5s.
 * - Active index tracks scroll position via `onMomentumScrollEnd`.
 * - Auto-play is paused when the user starts dragging and resumes 4s after
 *   they release, so a manual swipe isn't immediately yanked away.
 * - The indicator row uses a "width-modulating dot" (M3 carousel style).
 */
function HeroCarousel({ books, onPress }: { books: Book[]; onPress: (id: string) => void }) {
  const theme = useAppTheme();
  const [active, setActive] = useState(0);
  const [width, setWidth] = useState(0);
  const [auto, setAuto] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!auto || books.length <= 1) return;
    const t = setInterval(() => {
      setActive((i) => (i + 1) % books.length);
    }, 5000);
    return () => clearInterval(t);
  }, [auto, books.length]);

  useEffect(() => {
    if (width === 0 || books.length === 0) return;
    scrollRef.current?.scrollTo({ x: active * width, animated: true });
  }, [active, width, books.length]);

  useEffect(
    () => () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    },
    []
  );

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== width) setWidth(w);
  };

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width === 0) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setActive(Math.min(books.length - 1, Math.max(0, i)));
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setAuto(true), 4000);
  };

  const handleBeginDrag = () => setAuto(false);

  if (books.length === 0) return null;

  return (
    <View style={styles.heroCarouselWrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={handleLayout}
        onScrollBeginDrag={handleBeginDrag}
        onMomentumScrollEnd={handleMomentumEnd}
        scrollEventThrottle={16}
      >
        {books.map((book) => (
          <HeroSlide
            key={book.id}
            book={book}
            width={width || 360}
            onPress={() => onPress(book.id)}
          />
        ))}
      </ScrollView>
      {books.length > 1 ? (
        <View
          style={styles.heroIndicators}
          accessibilityRole="tablist"
          accessibilityLabel={`精选推荐，共 ${books.length} 项，当前第 ${active + 1} 项`}
        >
          {books.map((_, i) => (
            <View
              key={i}
              style={[
                styles.heroIndicator,
                {
                  width: i === active ? 18 : 6,
                  backgroundColor:
                    i === active
                      ? brand.gold
                      : theme.colors.outlineVariant,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroCarouselWrapper: {
    marginTop: spacingTokens.lg,
    marginBottom: spacingTokens.lg,
  },
  heroIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacingTokens.md,
  },
  heroIndicator: {
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
  hero: {
    flexDirection: 'row',
    marginHorizontal: spacingTokens.lg,
    padding: spacingTokens.lg + 2,
    borderRadius: 26,
    overflow: 'hidden',
  },
  heroInfo: {
    flex: 1,
    marginLeft: spacingTokens.lg,
    justifyContent: 'center',
  },
  heroOverline: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: spacingTokens.xs,
    letterSpacing: 2,
  },
  heroTitle: {
    fontFamily: brand.serif,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  heroAuthor: {
    fontSize: 12,
    marginTop: spacingTokens.xs,
    opacity: 0.85,
  },
  heroIntro: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacingTokens.sm,
    opacity: 0.85,
  },
  rankingScroll: {
    paddingHorizontal: spacingTokens.lg,
    paddingBottom: spacingTokens.lg,
    gap: spacingTokens.md,
  },
  rankingCard: {
    width: 180,
    padding: spacingTokens.lg,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rankingTitle: {
    fontFamily: brand.serif,
    fontWeight: '700',
    marginBottom: spacingTokens.md,
    fontSize: 15,
  },
  rankingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacingTokens.xs + 2,
  },
  rankingBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacingTokens.sm,
  },
  rankingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  rankingBookTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  chipScroll: {
    paddingHorizontal: spacingTokens.lg,
    paddingVertical: spacingTokens.sm,
    gap: 8,
  },
  chip: { height: 34, paddingHorizontal: 16, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: {
    fontFamily: brand.serif,
    fontSize: 19,
    fontWeight: '700',
    marginTop: spacingTokens.md,
    marginBottom: spacingTokens.sm,
    paddingHorizontal: spacingTokens.lg,
  },
  listTile: {
    flexDirection: 'row',
    paddingHorizontal: spacingTokens.lg,
    paddingVertical: spacingTokens.md,
    alignItems: 'flex-start',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listTileInfo: {
    flex: 1,
    marginLeft: spacingTokens.md,
    justifyContent: 'flex-start',
  },
  listTileTitle: {
    fontFamily: brand.serif,
    fontSize: 16,
    fontWeight: '700',
  },
  listTileAuthor: {
    fontSize: 12,
    marginTop: spacingTokens.xs,
  },
  listTileIntro: {
    fontSize: 13,
    marginTop: spacingTokens.xs,
    lineHeight: 19,
  },
});