import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { DisplayText as Text } from '../components/DisplayText';
import Icon, { type IconName } from '../components/Icon';
import Gradient from '../components/Gradient';
import type { ReadingTheme } from './themes';

const GOLD = '#C9A259';
const SERIF = 'Songti SC';

type PlayerState = { active: boolean; paused: boolean; buffering: boolean };

function Round({ colors, icon, label, onPress, size = 40 }: { colors: ReadingTheme; icon: IconName; label: string; onPress: () => void; size?: number }) {
  const eink = colors.eink === true;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: eink ? 4 : size / 2, alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.surface, borderWidth: eink ? 1.5 : StyleSheet.hairlineWidth, borderColor: eink ? colors.text : colors.line }, pressed && { opacity: 0.6 }]}>
      <Icon name={icon} size={20} color={colors.text} strokeWidth={eink ? 2 : 1.8} />
    </Pressable>
  );
}

export function ReaderTopBar({ colors, title, subtitle, left, right, onBack, onListen, onMore }: {
  colors: ReadingTheme; title: string; subtitle?: string; left: number; right: number;
  onBack: () => void; onListen: () => void; onMore: () => void;
}) {
  const eink = colors.eink === true;
  return (
    <View testID="reader-top-toolbar" style={[s.top, { left, right, backgroundColor: colors.background, borderBottomColor: eink ? colors.text : colors.line, borderBottomWidth: eink ? 1.5 : StyleSheet.hairlineWidth }, !eink && s.shadow]}>
      <Round colors={colors} icon="back" label="返回书架" onPress={onBack} />
      <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 6 }}>
        <Text numberOfLines={1} style={{ fontFamily: SERIF, fontSize: 16, fontWeight: '700', color: colors.text }}>{title}</Text>
        {!!subtitle && <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{subtitle}</Text>}
      </View>
      <Round colors={colors} icon="headphones" label="听书播放器" onPress={onListen} />
      <Round colors={colors} icon="more" label="更多设置" onPress={onMore} />
    </View>
  );
}

function Tool({ colors, icon, label, active, onPress }: { colors: ReadingTheme; icon: IconName; label: string; active?: boolean; onPress: () => void }) {
  const eink = colors.eink === true;
  const bg = active ? colors.text : eink ? colors.surface : colors.highlight + '66';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }} onPress={onPress} style={({ pressed }) => [s.tool, pressed && { opacity: 0.6 }]}>
      <View style={[s.toolTile, { backgroundColor: bg, borderRadius: eink ? 6 : 18, borderWidth: eink ? 1.5 : 0, borderColor: colors.text }]}>
        <Icon name={icon} size={22} color={active ? colors.surface : colors.text} strokeWidth={eink ? 2 : 1.8} />
      </View>
      <Text numberOfLines={1} style={{ color: active ? colors.text : colors.muted, fontSize: 11, fontWeight: active ? '700' : '500' }}>{label}</Text>
    </Pressable>
  );
}

export function ReaderBottomPanel(p: {
  colors: ReadingTheme; left: number; right: number; compact: boolean;
  chapter: number; chapterCount: number; pageIndex: number; pageCount: number; rate: number; player: PlayerState;
  onPrevChapter: () => void; onNextChapter: () => void; onPrevPage: () => void; onNextPage: () => void;
  onPlay: () => void; onOpenPlayer: () => void; onRate: () => void;
  onToc: () => void; onNight: () => void; onType: () => void; onEink: () => void; onMore: () => void;
}) {
  const { colors } = p;
  const eink = colors.eink === true;
  const playing = p.player.active && !p.player.paused;
  const progress = p.chapterCount > 1 ? p.chapter / (p.chapterCount - 1) : 1;
  const cardText = eink ? colors.text : '#FFFFFF';
  return (
    <View testID="reader-bottom-toolbar" style={[s.bottom, { left: p.left, right: p.right, backgroundColor: colors.background, paddingHorizontal: p.compact ? 12 : 20,
      borderTopColor: eink ? colors.text : colors.line, borderTopWidth: eink ? 1.5 : StyleSheet.hairlineWidth, borderTopLeftRadius: eink ? 0 : 28, borderTopRightRadius: eink ? 0 : 28 }, !eink && s.shadow]}>
      <View style={s.chapterRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="上一章" onPress={p.onPrevChapter} hitSlop={8}><Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>上一章</Text></Pressable>
        <View style={[s.track, { backgroundColor: eink ? colors.surface : colors.line, borderWidth: eink ? 1 : 0, borderColor: colors.text }]}>
          <View style={{ width: `${Math.round(progress * 100)}%`, height: '100%', backgroundColor: eink ? colors.text : colors.accent, borderRadius: 3 }} />
          <View style={[s.knob, { left: `${Math.round(progress * 100)}%`, backgroundColor: colors.surface, borderColor: eink ? colors.text : colors.accent }]} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="下一章" onPress={p.onNextChapter} hitSlop={8}><Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>下一章</Text></Pressable>
      </View>
      <View style={s.pageRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="上一页" onPress={p.onPrevPage} hitSlop={8} style={s.pageBtn}><Icon name="back" size={16} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 12 }}>上一页</Text></Pressable>
        <Text style={{ fontSize: 12, color: colors.muted }}>第 {p.chapter + 1}/{p.chapterCount} 章 · {p.pageIndex + 1}/{p.pageCount} 页</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="下一页" onPress={p.onNextPage} hitSlop={8} style={s.pageBtn}><Text style={{ color: colors.muted, fontSize: 12 }}>下一页</Text><Icon name="chev" size={16} color={colors.muted} /></Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="打开听书播放器" onPress={p.onOpenPlayer}
        style={[s.listenCard, { borderRadius: eink ? 6 : 22, backgroundColor: eink ? colors.surface : colors.accent, borderWidth: eink ? 1.5 : 0, borderColor: colors.text }]}>
        {!eink && !colors.dark && <Gradient from={colors.accent} to="#1C3E33" id="listen" />}
        <View style={{ flex: 1 }}>
          <Text style={{ color: cardText, fontSize: 15, fontWeight: '700', fontFamily: SERIF }}>{playing ? '正在朗读' : p.player.active ? '已暂停' : '从本句开始听'}</Text>
          <Text style={{ color: cardText, opacity: 0.75, fontSize: 11, marginTop: 3 }}>{p.player.buffering && playing ? '正在准备声音…' : '整句高亮 · 自动翻页跟读'}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="朗读语速" onPress={p.onRate} hitSlop={6}
          style={[s.rate, { borderColor: eink ? colors.text : 'rgba(255,255,255,0.45)', borderRadius: eink ? 4 : 14 }]}>
          <Text style={{ color: cardText, fontSize: 12, fontWeight: '700' }}>{p.rate}×</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={playing ? '暂停朗读' : '开始朗读'} onPress={p.onPlay}
          style={[s.cardPlay, { backgroundColor: eink ? colors.text : GOLD, borderRadius: eink ? 6 : 24 }]}>
          {p.player.buffering && playing ? <ActivityIndicator color={eink ? colors.surface : '#1E2A23'} /> : <Icon name={playing ? 'pause' : 'play'} size={22} color={eink ? colors.surface : '#1E2A23'} />}
        </Pressable>
      </Pressable>
      <View style={s.tools}>
        <Tool colors={colors} icon="list" label="目录" onPress={p.onToc} />
        <Tool colors={colors} icon={colors.dark ? 'sun' : 'moon'} label={colors.dark ? '日间' : '夜间'} onPress={p.onNight} />
        <Tool colors={colors} icon="type" label="字体排版" onPress={p.onType} />
        <Tool colors={colors} icon="eink" label="电纸书" active={eink} onPress={p.onEink} />
        <Tool colors={colors} icon="sliders" label="更多设置" onPress={p.onMore} />
      </View>
    </View>
  );
}

export function ListenFab({ colors, player, onPress, onLongPress }: { colors: ReadingTheme; player: PlayerState; onPress: () => void; onLongPress: () => void }) {
  const eink = colors.eink === true;
  const playing = player.active && !player.paused;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={playing ? '暂停朗读' : '开始朗读'} accessibilityHint="长按打开听书播放器" onPress={onPress} onLongPress={onLongPress}
      style={({ pressed }) => [s.fab, { backgroundColor: eink ? colors.surface : colors.accent, borderRadius: eink ? 6 : 24, borderWidth: eink ? 1.5 : 0, borderColor: colors.text }, !eink && s.shadow, pressed && { opacity: 0.8 }]}>
      {player.buffering && playing ? <ActivityIndicator color={eink ? colors.text : colors.onAccent} /> : <Icon name={playing ? 'pause' : 'headphones'} size={21} color={eink ? colors.text : colors.onAccent} />}
    </Pressable>
  );
}

export function PlayerSheet(p: {
  visible: boolean; colors: ReadingTheme; title: string; author?: string; chapterTitle?: string;
  sentences: string[]; position: number; rate: number; voiceLabel: string; player: PlayerState;
  onClose: () => void; onPlay: () => void; onSeek: (sentence: number) => void; onPrevChapter: () => void; onNextChapter: () => void;
  onRate: () => void; onVoice: () => void; onToc: () => void;
}) {
  const { colors } = p;
  const eink = colors.eink === true;
  const fg = eink ? colors.text : '#F6F3EA';
  const sub = eink ? colors.muted : 'rgba(246,243,234,0.62)';
  const playing = p.player.active && !p.player.paused;
  const total = Math.max(1, p.sentences.length);
  const current = Math.max(0, Math.min(p.position, total - 1));
  const from = Math.max(0, current - 1);
  const excerpt = p.sentences.slice(from, from + 4);
  const Chip = ({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [s.chip, { borderColor: eink ? colors.text : 'rgba(246,243,234,0.28)', borderRadius: eink ? 4 : 18, borderWidth: eink ? 1.5 : 1 }, pressed && { opacity: 0.6 }]}>
      <Icon name={icon} size={16} color={fg} /><Text numberOfLines={1} style={{ color: fg, fontSize: 12, fontWeight: '600', maxWidth: 110 }}>{label}</Text>
    </Pressable>
  );
  const Ctl = ({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={({ pressed }) => [s.ctl, pressed && { opacity: 0.5 }]}>
      <Icon name={icon} size={26} color={fg} />
    </Pressable>
  );
  return (
    <Modal visible={p.visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={p.onClose}
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: eink ? colors.background : '#1C3E33' }}>
          {!eink && <Gradient from="#2B5C4B" to="#0F241C" id="player" />}
          <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1 }}>
            <View style={s.playerHead}>
              <Pressable accessibilityRole="button" accessibilityLabel="收起播放器" onPress={p.onClose} hitSlop={8}
                style={[s.headBtn, { borderColor: eink ? colors.text : 'rgba(246,243,234,0.25)', borderRadius: eink ? 4 : 20, borderWidth: eink ? 1.5 : 1 }]}>
                <Icon name="chevdown" size={20} color={fg} />
              </Pressable>
              <Text style={{ flex: 1, textAlign: 'center', color: sub, fontSize: 12, letterSpacing: 1 }}>正在听书</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="目录" onPress={p.onToc} hitSlop={8}
                style={[s.headBtn, { borderColor: eink ? colors.text : 'rgba(246,243,234,0.25)', borderRadius: eink ? 4 : 20, borderWidth: eink ? 1.5 : 1 }]}>
                <Icon name="list" size={20} color={fg} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28, paddingBottom: 24, width: '100%', maxWidth: 620, alignSelf: 'center' }}>
              <View style={[s.cover, { backgroundColor: eink ? colors.surface : 'rgba(246,243,234,0.08)', borderColor: eink ? colors.text : 'rgba(201,162,89,0.55)', borderRadius: eink ? 4 : 18, borderWidth: eink ? 1.5 : 1 }]}>
                <Text numberOfLines={3} style={{ fontFamily: SERIF, fontSize: 22, fontWeight: '700', color: fg, textAlign: 'center', lineHeight: 30 }}>{p.title}</Text>
                <View style={{ width: 28, height: 2, backgroundColor: eink ? colors.text : GOLD, marginVertical: 12 }} />
                {!!p.author && <Text numberOfLines={1} style={{ color: sub, fontSize: 12 }}>{p.author}</Text>}
              </View>
              <Text numberOfLines={2} style={{ fontFamily: SERIF, color: fg, fontSize: 20, fontWeight: '700', marginTop: 22 }}>{p.title}</Text>
              <Text numberOfLines={1} style={{ color: sub, fontSize: 13, marginTop: 4 }}>{p.chapterTitle || ' '}</Text>
              <View style={[s.excerpt, { backgroundColor: eink ? colors.surface : 'rgba(0,0,0,0.16)', borderRadius: eink ? 4 : 18, borderWidth: eink ? 1.5 : 0, borderColor: colors.text }]}>
                {excerpt.length ? excerpt.map((text, i) => {
                  const on = from + i === current;
                  return <Text key={from + i} onPress={() => p.onSeek(from + i)} style={{ fontFamily: SERIF, fontSize: 16, lineHeight: 28, color: on ? fg : sub,
                    fontWeight: on ? '700' : '400', backgroundColor: on && !eink ? 'rgba(201,162,89,0.28)' : undefined, textDecorationLine: on && eink ? 'underline' : 'none' }}>{text}</Text>;
                }) : <Text style={{ color: sub }}>本章暂无可朗读文字</Text>}
              </View>
              <View style={{ marginTop: 22 }}>
                <View style={[s.pTrack, { backgroundColor: eink ? colors.surface : 'rgba(246,243,234,0.18)', borderWidth: eink ? 1 : 0, borderColor: colors.text }]}>
                  <View style={{ width: `${Math.round(((current + 1) / total) * 100)}%`, height: '100%', borderRadius: 2, backgroundColor: eink ? colors.text : GOLD }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text style={{ color: sub, fontSize: 11 }}>第 {current + 1} 句</Text>
                  <Text style={{ color: sub, fontSize: 11 }}>共 {total} 句</Text>
                </View>
              </View>
              <View style={s.controls}>
                <Ctl icon="prev" label="上一章" onPress={p.onPrevChapter} />
                <Ctl icon="back" label="上一句" onPress={() => p.onSeek(Math.max(0, current - 1))} />
                <Pressable accessibilityRole="button" accessibilityLabel={playing ? '暂停朗读' : '开始朗读'} onPress={p.onPlay}
                  style={({ pressed }) => [s.bigPlay, { backgroundColor: eink ? colors.text : GOLD, borderRadius: eink ? 8 : 36 }, pressed && { opacity: 0.85 }]}>
                  {p.player.buffering && playing ? <ActivityIndicator color={eink ? colors.surface : '#1E2A23'} /> : <Icon name={playing ? 'pause' : 'play'} size={30} color={eink ? colors.surface : '#1E2A23'} />}
                </Pressable>
                <Ctl icon="chev" label="下一句" onPress={() => p.onSeek(Math.min(total - 1, current + 1))} />
                <Ctl icon="next" label="下一章" onPress={p.onNextChapter} />
              </View>
              <View style={s.chips}>
                <Chip icon="speed" label={`${p.rate}× 语速`} onPress={p.onRate} />
                <Chip icon="mic" label={p.voiceLabel} onPress={p.onVoice} />
                <Chip icon="list" label="目录" onPress={p.onToc} />
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}

export function SettingsCard({ colors, children }: { colors: ReadingTheme; children: React.ReactNode }) {
  const eink = colors.eink === true;
  return <View style={{ backgroundColor: colors.surface, borderRadius: eink ? 4 : 20, borderWidth: eink ? 1.5 : StyleSheet.hairlineWidth, borderColor: eink ? colors.text : colors.line, padding: 16, gap: 14 }}>{children}</View>;
}

const s = StyleSheet.create({
  shadow: { shadowColor: '#1E2A23', shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  top: { position: 'absolute', top: 0, minHeight: 60, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  bottom: { position: 'absolute', bottom: 0, paddingTop: 14, paddingBottom: 8, gap: 10 },
  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  track: { flex: 1, height: 5, borderRadius: 3, justifyContent: 'center' },
  knob: { position: 'absolute', width: 16, height: 16, borderRadius: 8, marginLeft: -8, borderWidth: 2.5 },
  pageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 28 },
  listenCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingLeft: 16, paddingRight: 10, gap: 10, overflow: 'hidden' },
  rate: { borderWidth: 1, paddingHorizontal: 9, height: 28, alignItems: 'center', justifyContent: 'center' },
  cardPlay: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  tools: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 2 },
  tool: { flex: 1, alignItems: 'center', gap: 5 },
  toolTile: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  fab: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  playerHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, gap: 12 },
  headBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  cover: { alignSelf: 'center', width: 168, height: 228, marginTop: 8, alignItems: 'center', justifyContent: 'center', padding: 18 },
  excerpt: { marginTop: 18, padding: 16, gap: 4 },
  pTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  ctl: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  bigPlay: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 22 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36 },
});
