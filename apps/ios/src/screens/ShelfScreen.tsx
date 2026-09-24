import { DisplayText as Text } from '../components/DisplayText';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Animated as RNAnimated,
  Easing,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type {Book} from '../types/models';
import {useLibraryUI,positionLabel,bookProgress} from '../tingye/library-ui';

import {adaptiveShelfLayout} from '../tingye/reader-layout';
import BookCover from '../components/BookCover';
import MaterialAppBar from '../components/MaterialAppBar';
import MaterialProgressBar from '../components/MaterialProgressBar';
import MaterialButton from '../components/MaterialButton';
import MaterialChip from '../components/MaterialChip';
import appConfig from '../../app.json';
import { useAppTheme } from '../theme/useAppTheme';
import { spacing as spacingTokens, shape as shapeTokens } from '../theme/tokens';

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}

// Shown on the first screen so the installed build can be confirmed without digging.
const shelfVersion = `听页 v${appConfig.expo.version} (${appConfig.expo.ios.buildNumber})`;

function showActionSheet(onDetail: () => void, onRemove: () => void) {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['详情', '移出书架', '取消'], cancelButtonIndex: 2, destructiveButtonIndex: 1 },
      (index) => {
        if (index === 0) onDetail();
        if (index === 1) onRemove();
      }
    );
  } else {
    Alert.alert('书籍操作', undefined, [
      { text: '详情', onPress: onDetail },
      { text: '移出书架', style: 'destructive', onPress: onRemove },
      { text: '取消', style: 'cancel' },
    ]);
  }
}

export default function ShelfScreen({ navigation }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const ui=useLibraryUI();
  const {width:windowWidth,fontScale}=useWindowDimensions();
  const width=windowWidth-insets.left-insets.right;
  const {columns,shelfWidth,cellWidth,coverWidth,coverHeight}=adaptiveShelfLayout(width,fontScale);
  const list=useRef<FlatList<Book>>(null),headerHeight=useRef(0),scrollAnchor=useRef({index:0,headerOffset:0});
  const previousColumns=useRef(columns),restore=useRef(false);
  const rowHeight=coverHeight+Math.ceil(64*fontScale);
  if(previousColumns.current!==columns){previousColumns.current=columns;restore.current=true;}
  const restoreScroll=()=>{if(!restore.current)return;restore.current=false;const a=scrollAnchor.current;list.current?.scrollToOffset({offset:a.headerOffset>=0?a.headerOffset:headerHeight.current+Math.floor(a.index/columns)*rowHeight,animated:false});};
  const [status,setStatus]=useState<'all'|'reading'|'unread'>('all');
  const items=useMemo(()=>status==='all'?ui.books:ui.books.filter(b=>{
    const native=ui.nativeBooks.find(n=>n.id===b.id),started=!!native&&(!!native.chapter||!!native.position);
    return status==='reading'?started:!started;
  }),[ui.books,ui.nativeBooks,status]);
  const continueReading=ui.books[0];
  const progressLabel=(id?:string)=>positionLabel(ui.nativeBooks.find(b=>b.id===id));
  const continuePercent=bookProgress(ui.nativeBooks.find(b=>b.id===continueReading?.id));

  if (ui.books.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: theme.colors.background }]}>
        <MaterialAppBar
          title="书架" overline={shelfVersion}
          variant="small"
          trailingIcon="⌕"
          onTrailingPress={() => navigation.navigate('Search')}
        />
        <View style={styles.emptyContent}>
          <View
            style={[
              styles.emptyMark,
              { backgroundColor: theme.colors.secondaryContainer },
            ]}
          >
            <Text style={[styles.emptyMarkText, { color: theme.colors.onSecondaryContainer }]}>☰</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.onBackground }]}>书架还是空的</Text>
          <Text style={[styles.emptyBody, { color: theme.colors.onSurfaceVariant }]}>
            导入你喜欢的书，{'\n'}随时在这里继续阅读和听书。
          </Text>
          <MaterialButton
            label="导入书籍"
            variant="filled"
            onPress={ui.importBooks}
            style={{ marginTop: spacingTokens.xl }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <MaterialAppBar
        title="书架" overline={shelfVersion}
        variant="small"
        trailingIcon="⌕"
        onTrailingPress={() => navigation.navigate('Search')}
      />
      <FlatList ref={list}
        style={{width:shelfWidth,alignSelf:'center'}}
        onContentSizeChange={restoreScroll}
        onScroll={event=>{if(restore.current)return;const y=event.nativeEvent.contentOffset.y;scrollAnchor.current=y<headerHeight.current?{index:0,headerOffset:Math.max(0,y)}:{index:Math.floor((y-headerHeight.current)/rowHeight)*columns,headerOffset:-1};}}
        scrollEventThrottle={100}
        data={items}
        keyExtractor={(b) => b.id}
        key={columns}
        numColumns={columns}
        contentContainerStyle={{
          paddingHorizontal: spacingTokens.lg,
          paddingBottom: insets.bottom + 100,
        }}
        ListHeaderComponent={<View onLayout={event=>{headerHeight.current=event.nativeEvent.layout.height;}}>
          <View style={{flexDirection:"row",flexWrap:"wrap",gap:8,marginTop:12}}><MaterialButton label="导入书籍" icon="＋" disabled={ui.busy} onPress={ui.importBooks}/><MaterialButton label={ui.busy?"同步中…":"同步"} variant="tonal" disabled={ui.busy} onPress={ui.refresh}/><MaterialButton label={ui.einkMode?"电子书模式 · 已开启":"电子书模式"} variant={ui.einkMode?"filled":"outlined"} accessibilityState={{checked:ui.einkMode}} onPress={()=>ui.setEinkMode(!ui.einkMode)}/></View>
          {!!ui.notice&&<Pressable onPress={ui.dismissNotice}><Text style={{color:theme.colors.onSurfaceVariant,paddingVertical:12}}>{ui.notice}</Text></Pressable>}
          {continueReading ? (
            <ContinueReadingCard
              book={continueReading}
              percent={continuePercent}
              progressLabel={progressLabel(continueReading.id)}
              onPress={() => navigation.navigate('Reader', { bookId: continueReading.id })}
              onDetail={() => navigation.navigate('BookDetail', { bookId: continueReading.id })}
            />
          ) : null}
          <View style={styles.filters}>{([['all','全部'],['reading','在读'],['unread','未开始']] as const).map(([key,label])=><MaterialChip key={key} label={label} selected={status===key} onPress={()=>setStatus(key)}/>)}</View></View>
        }
        ListEmptyComponent={<Text style={[styles.filterEmpty,{color:theme.colors.onSurfaceVariant}]}>{status==='reading'?'还没有开始读的书。':'所有书都已经开始读了。'}</Text>}
        columnWrapperStyle={{ gap: spacingTokens.md }}
        renderItem={({ item }) => {
          const percent=100*bookProgress(ui.nativeBooks.find(b=>b.id===item.id));
          return (
            <TouchableOpacity
              style={[styles.cell,{maxWidth:cellWidth,height:rowHeight,marginBottom:0}]}
              onPress={() => navigation.navigate('Reader', { bookId: item.id })}
              onLongPress={() => ui.actions(item.id)}
            >
              <BookCover book={item} width={coverWidth} height={coverHeight} />
              <Text
                style={[styles.cellTitle, { maxWidth:cellWidth-8,color: theme.colors.onBackground }]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text
                style={[styles.cellMeta, { color: theme.colors.onSurfaceVariant }]}
                numberOfLines={1}
              >
                {progressLabel(item.id)}
              </Text>
              {percent > 0 ? (
                <View style={styles.cellProgress}>
                  <MaterialProgressBar value={percent / 100} height={3} />
                </View>
              ) : null}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

interface ContinueCardProps {
  book: Book | undefined;
  progressLabel: string;
  percent: number;
  onPress: () => void;
  onDetail: () => void;
}

function ContinueReadingCard({ book, percent, progressLabel, onPress, onDetail }: ContinueCardProps) {
  const theme = useAppTheme();
  // Spring-driven card lift: scale + shadow swell when pressed.
  const press = useRef(new RNAnimated.Value(0)).current;
  const fill = useRef(new RNAnimated.Value(0)).current;
  // Idle "tilt" transform — gives the cover a subtle shelf-style perspective.
  const idle = useRef(new RNAnimated.Value(1)).current;

  // Animate progress from 0 → percent on mount so the bar visibly fills
  // instead of jumping to its final state.
  useEffect(() => {
    fill.setValue(0);
    RNAnimated.timing(fill, {
      toValue: percent,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [percent, fill]);

  // One-time idle-to-0.5 micro animation on mount → book "settles" onto shelf.
  useEffect(() => {
    idle.setValue(0);
    RNAnimated.timing(idle, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [idle]);

  const onPressIn = () =>
    RNAnimated.spring(press, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
      tension: 120,
    }).start();
  const onPressOut = () =>
    RNAnimated.spring(press, {
      toValue: 0,
      useNativeDriver: true,
      friction: 6,
      tension: 120,
    }).start();

  if (!book) return null;

  const cardScale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.98] });
  const coverRotate = idle.interpolate({
    inputRange: [0, 1],
    outputRange: ['-3deg', '0deg'],
  });
  const coverTranslateY = idle.interpolate({
    inputRange: [0, 1],
    outputRange: [-4, 0],
  });
  const shadowOpacity = press.interpolate({
    inputRange: [0, 1],
    outputRange: [0.08, 0.18],
  });
  const shadowRadius = press.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 10],
  });

  return (
    <RNAnimated.View
      style={[
        styles.continueCardWrap,
        {
          transform: [{ scale: cardScale }],
          shadowColor: theme.colors.shadow,
          shadowOpacity:0.08,
          shadowRadius:4,
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        android_ripple={{ color: theme.colors.outlineVariant }}
        style={({ pressed }) => [
          styles.continueCard,
          {
            backgroundColor: theme.colors.surfaceContainer,
            opacity: pressed ? 0.95 : 1,
          },
        ]}
      >
        <View style={styles.continueHeader}>
          <Text style={[styles.continueOverline, { color: theme.colors.primary }]}>继续阅读</Text>
          <Text style={[styles.continuePercent, { color: theme.colors.onSurfaceVariant }]}>
            {progressLabel}
          </Text>
        </View>
        <View style={styles.continueBody}>
          <RNAnimated.View
            style={[
              styles.continueCoverWrap,
              {
                transform: [
                  { perspective: 600 },
                  { rotate: coverRotate },
                  { translateY: coverTranslateY },
                ],
              },
            ]}
          >
            <BookCover book={book} width={72} height={100} />
          </RNAnimated.View>
          <View style={styles.continueInfo}>
            <Text
              style={[styles.continueTitle, { color: theme.colors.onSurface }]}
              numberOfLines={2}
            >
              {book.title}
            </Text>
            <Text
              style={[styles.continueAuthor, { color: theme.colors.onSurfaceVariant }]}
              numberOfLines={1}
            >
              {book.author}
            </Text>
            <View style={styles.continueProgress}>
              <AnimatedProgressBar fill={fill} />
            </View>
            <View style={styles.continueActions}>
              <Pressable
                onPress={onPress}
                accessibilityRole="button"
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <Text style={[styles.continuePrimaryAction, { color: theme.colors.primary }]}>
                  继续 ›
                </Text>
              </Pressable>
              <Pressable
                onPress={onDetail}
                accessibilityRole="button"
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <Text
                  style={[
                    styles.continueSecondaryAction,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  详情
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Pressable>
    </RNAnimated.View>
  );
}

/**
 * Animated variant of MaterialProgressBar driven by an `Animated.Value`.
 * The non-animated version still exists for non-progress-bar use cases;
 * this one re-implements the layout inline so we can bind `width: '${fill*100}%'`
 * to the driver.
 */
function AnimatedProgressBar({ fill }: { fill: RNAnimated.AnimatedInterpolation<number> }) {
  const theme = useAppTheme();
  const width = fill.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  return (
    <View
      style={{
        height: 4,
        borderRadius: 2,
        backgroundColor: theme.colors.surfaceVariant,
        overflow: 'hidden',
      }}
    >
      <RNAnimated.View
        style={{
          height: '100%',
          width,
          backgroundColor: theme.colors.primary,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  empty: { flex: 1 },
  emptyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacingTokens.xl,
  },
  emptyMark: {
    width: 96,
    height: 96,
    borderRadius: shapeTokens.extraLarge,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacingTokens.xl,
  },
  emptyMarkText: {
    fontSize: 44,
    fontWeight: '500',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: spacingTokens.sm,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  continueCardWrap: {
    marginVertical: spacingTokens.lg,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    borderRadius: shapeTokens.extraLarge,
  },
  continueCard: {
    borderRadius: shapeTokens.extraLarge,
    padding: spacingTokens.lg,
  },
  continueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacingTokens.md,
  },
  continueOverline: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  continuePercent: {
    fontSize: 12,
    fontWeight: '500',
  },
  continueBody: {
    flexDirection: 'row',
  },
  continueCoverWrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  continueInfo: {
    flex: 1,
    marginLeft: spacingTokens.lg,
    justifyContent: 'space-between',
  },
  continueTitle: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  continueAuthor: {
    fontSize: 13,
    marginTop: spacingTokens.xs,
  },
  continueProgress: {
    marginTop: spacingTokens.md,
  },
  continueActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacingTokens.md,
  },
  continuePrimaryAction: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: spacingTokens.lg,
  },
  continueSecondaryAction: {
    fontSize: 14,
    fontWeight: '500',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    marginBottom: spacingTokens.xl,
    maxWidth: 110,
  },
  cellTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: spacingTokens.sm,
    textAlign: 'center',
    maxWidth: 100,
  },
  cellMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  filters: {
    flexDirection: 'row',
    gap: spacingTokens.sm,
    marginBottom: spacingTokens.lg,
  },
  filterEmpty: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: spacingTokens.xl,
  },
  cellProgress: {
    marginTop: spacingTokens.xs,
    width: '100%',
    paddingHorizontal: spacingTokens.xs,
  },
  pressed: {
    opacity: 0.6,
  },
});