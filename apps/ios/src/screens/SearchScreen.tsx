import { DisplayText as Text } from '../components/DisplayText';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {useLibraryUI} from '../tingye/library-ui';
import BookCover from '../components/BookCover';
import { useAppTheme } from '../theme/useAppTheme';
import { spacing as spacingTokens, shape as shapeTokens } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

export default function SearchScreen({ navigation }: Props) {
  const theme = useAppTheme();
  const {books:sampleBooks}=useLibraryUI();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return sampleBooks.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q)
    );
  }, [query,sampleBooks]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacingTokens.xs,
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.outlineVariant,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          hitSlop={8}
        >
          <Text style={[styles.backText, { color: theme.colors.onSurface }]}>‹</Text>
        </Pressable>
        <View
          style={[
            styles.searchField,
            { backgroundColor: theme.colors.surfaceContainerHigh },
          ]}
        >
          <Text style={[styles.searchIcon, { color: theme.colors.onSurfaceVariant }]}>⌕</Text>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="搜索书名、作者、分类"
            placeholderTextColor={theme.colors.onSurfaceVariant}
            style={[styles.input, { color: theme.colors.onSurface }]}
            returnKeyType="search"
          />
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.cancel, { color: theme.colors.primary }]}>取消</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={results}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.row,
              {
                borderBottomColor: theme.colors.outlineVariant,
                backgroundColor: pressed
                  ? theme.colors.surfaceContainerLow
                  : 'transparent',
              } as StyleProp<ViewStyle>,
            ]}
            onPress={() => navigation.replace('BookDetail', { bookId: item.id })}
            android_ripple={{ color: theme.colors.outlineVariant }}
          >
            <BookCover book={item} width={48} height={64} />
            <View style={styles.rowInfo}>
              <Text
                style={[styles.title, { color: theme.colors.onSurface }]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text
                style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
                numberOfLines={1}
              >
                {item.author} · {item.category}
              </Text>
            </View>
            <Text style={[styles.chevron, { color: theme.colors.onSurfaceVariant }]}>›</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          query.trim().length > 0 ? (
            <View style={styles.empty}>
              <View
                style={[
                  styles.emptyMark,
                  { backgroundColor: theme.colors.surfaceContainerLow },
                ]}
              >
                <Text
                  style={[
                    styles.emptyMarkText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  ⌕
                </Text>
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.onBackground }]}>
                没有找到相关书籍
              </Text>
              <Text
                style={[
                  styles.emptyHint,
                { color: theme.colors.onSurfaceVariant },
                ]}
              >
                换个关键词试试
              </Text>
            </View>
          ) : (
            <View style={styles.hintArea}>
              <Text
                style={[
                  styles.hintTitle,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                试试搜索
              </Text>
              {['小说', '历史', '科幻'].map((seed) => (
                <TouchableOpacity
                  key={seed}
                  onPress={() => setQuery(seed)}
                  style={[
                    styles.seedChip,
                    {
                      backgroundColor: theme.colors.surfaceContainerLow,
                      borderColor: theme.colors.outlineVariant,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.seedText,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {seed}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacingTokens.sm,
    paddingBottom: spacingTokens.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: shapeTokens.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 28,
    lineHeight: 30,
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: shapeTokens.extraSmall,
    paddingHorizontal: spacingTokens.md,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: spacingTokens.sm,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  cancel: {
    marginLeft: spacingTokens.md,
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: spacingTokens.sm,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacingTokens.lg,
    paddingVertical: spacingTokens.md,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowInfo: {
    flex: 1,
    marginLeft: spacingTokens.md,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  chevron: {
    fontSize: 20,
    marginLeft: spacingTokens.sm,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacingTokens.xxxl * 2,
    paddingHorizontal: spacingTokens.xl,
  },
  emptyMark: {
    width: 72,
    height: 72,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacingTokens.lg,
  },
  emptyMarkText: {
    fontSize: 30,
    fontWeight: '500',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 13,
    marginTop: spacingTokens.xs,
  },
  hintArea: {
    paddingHorizontal: spacingTokens.lg,
    paddingTop: spacingTokens.xl,
  },
  hintTitle: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacingTokens.md,
  },
  seedChip: {
    paddingHorizontal: spacingTokens.md,
    paddingVertical: spacingTokens.sm,
    borderRadius: shapeTokens.extraSmall,
    borderWidth: 1,
    marginBottom: spacingTokens.sm,
    alignSelf: 'flex-start',
  },
  seedText: {
    fontSize: 13,
    fontWeight: '500',
  },
});