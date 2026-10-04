import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { DisplayText as Text } from '../components/DisplayText';
import Icon, { type IconName } from '../components/Icon';
import { brand } from '../theme/tokens';
import type { ReadingTheme } from './themes';

const GOLD = brand.gold;
const SERIF = brand.serif;

type PlayerState = { active: boolean; paused: boolean; buffering: boolean };

// Bare icon buttons like the reference design (微信读书): no tile background,
// just a 24pt glyph with a 44pt touch target.
function BarButton({ colors, icon, label, onPress }: { colors: ReadingTheme; icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8}
      style={({ pressed }) => [s.barButton, pressed && { opacity: 0.5 }]}>
      <Icon name={icon} size={24} color={colors.text} strokeWidth={colors.eink ? 2 : 1.7} />
    </Pressable>
  );
}

export function ReaderTopBar({ colors, title, subtitle, left, right, onBack, onListen, onMore }: {
  colors: ReadingTheme; title: string; subtitle?: string; left: number; right: number;
  onBack: () => void; onListen: () => void; onMore: () => void;
}) {
  const eink = colors.eink === true;
  return (
    <View testID="reader-top-toolbar" style={[s.top, { left, right, backgroundColor: colors.background, borderBottomColor: eink ? colors.text : colors.line, borderBottomWidth: eink ? 1.5 : StyleSheet.hairlineWidth }]}>
      <BarButton colors={colors} icon="back" label="返回书架" onPress={onBack} />
      <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 6 }}>
        <Text numberOfLines={1} style={{ fontFamily: SERIF, fontSize: 16, fontWeight: '700', color: colors.text }}>{title}</Text>
        {!!subtitle && <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{subtitle}</Text>}
      </View>
      <BarButton colors={colors} icon="headphones" label="听书播放器" onPress={onListen} />
      <BarButton colors={colors} icon="more" label="更多设置" onPress={onMore} />
    </View>
  );
}

function Tool({ colors, icon, label, active, onPress }: { colors: ReadingTheme; icon: IconName; label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }} onPress={onPress} style={({ pressed }) => [s.tool, pressed && { opacity: 0.5 }]}>
      <Icon name={icon} size={24} color={active ? colors.accent : colors.text} strokeWidth={colors.eink ? 2 : 1.7} />
      <Text numberOfLines={1} style={{ color: active ? colors.accent : colors.muted, fontSize: 11, fontWeight: active ? '700' : '500' }}>{label}</Text>
    </Pressable>
  );
}

/** Chapter scrubber: drag or tap to preview a chapter, release to jump; VoiceOver swipes up/down. */
function ChapterSlider({ colors, chapter, chapterCount, onSeek, onPrev, onNext }: {
  colors: ReadingTheme; chapter: number; chapterCount: number;
  onSeek: (chapter: number) => void; onPrev: () => void; onNext: () => void;
}) {
  const eink = colors.eink === true;
  const [preview, setPreview] = useState<number | null>(null);
  const width = useRef(0);
  const last = Math.max(0, chapterCount - 1);
  const at = (x: number) => (last === 0 || width.current <= 0 ? 0 : Math.round(Math.max(0, Math.min(1, x / width.current)) * last));
  const latest = useRef({ at, onSeek });
  latest.current = { at, onSeek };
  const startX = useRef(0);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    // locationX is only reliable at touch-down; follow the finger with dx afterwards.
    onPanResponderGrant: e => { startX.current = e.nativeEvent.locationX; setPreview(latest.current.at(startX.current)); },
    onPanResponderMove: (_, g) => setPreview(latest.current.at(startX.current + g.dx)),
    onPanResponderRelease: (_, g) => { const target = latest.current.at(startX.current + g.dx); setPreview(null); latest.current.onSeek(target); },
    onPanResponderTerminate: () => setPreview(null),
  }), []);
  const shown = preview ?? chapter;
  const percent = `${last === 0 ? 100 : Math.round((shown / last) * 100)}%` as const;
  return (
    // 44pt touch target (Apple HIG) around the 5pt visual track; its width is the seek coordinate space.
    <View accessible accessibilityRole="adjustable" accessibilityLabel="章节进度" accessibilityValue={{ min: 1, max: chapterCount, now: chapter + 1, text: `第 ${chapter + 1} 章，共 ${chapterCount} 章` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => (e.nativeEvent.actionName === 'increment' ? onNext() : onPrev())}
      onLayout={e => { width.current = e.nativeEvent.layout.width; }} {...responder.panHandlers} style={s.slider}>
      {preview !== null && <Text pointerEvents="none" style={[s.sliderBubble, { color: colors.text, backgroundColor: colors.surface, borderColor: eink ? colors.text : colors.line }]}>第 {preview + 1} / {chapterCount} 章</Text>}
      <View pointerEvents="none" style={[s.track, { backgroundColor: eink ? colors.surface : colors.line, borderWidth: eink ? 1 : 0, borderColor: colors.text }]}>
        <View style={{ width: percent, height: '100%', backgroundColor: eink ? colors.text : colors.accent, borderRadius: 3 }} />
        <View style={[s.knob, preview !== null && s.knobActive, { left: percent, backgroundColor: colors.surface, borderColor: eink ? colors.text : colors.accent }]} />
      </View>
    </View>
  );
}

/** 可隐藏底栏：章节滑杆 + 五个纯图标工具（参考微信读书：目录/听书/日夜间/字体/设置）。 */
export function ReaderBottomPanel(p: {
  colors: ReadingTheme; left: number; right: number; compact: boolean;
  chapter: number; chapterCount: number; player: PlayerState;
  onPrevChapter: () => void; onNextChapter: () => void; onSeekChapter: (chapter: number) => void;
  onToc: () => void; onListen: () => void; onNight: () => void; onType: () => void; onMore: () => void;
}) {
  const { colors } = p;
  const eink = colors.eink === true;
  const listening = p.player.active;
  return (
    <View testID="reader-bottom-toolbar" style={[s.bottom, { left: p.left, right: p.right, backgroundColor: colors.background, paddingHorizontal: p.compact ? 14 : 24,
      borderTopColor: eink ? colors.text : colors.line, borderTopWidth: eink ? 1.5 : StyleSheet.hairlineWidth, borderTopLeftRadius: eink ? 0 : 24, borderTopRightRadius: eink ? 0 : 24 }]}>
      <View style={s.chapterRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="上一章" onPress={p.onPrevChapter} hitSlop={8} style={s.chapterBtn}><Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>上一章</Text></Pressable>
        <ChapterSlider colors={colors} chapter={p.chapter} chapterCount={p.chapterCount} onSeek={p.onSeekChapter} onPrev={p.onPrevChapter} onNext={p.onNextChapter} />
        <Pressable accessibilityRole="button" accessibilityLabel="下一章" onPress={p.onNextChapter} hitSlop={8} style={s.chapterBtn}><Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>下一章</Text></Pressable>
      </View>
      <View style={s.tools}>
        <Tool colors={colors} icon="list" label="目录" onPress={p.onToc} />
        <Tool colors={colors} icon="headphones" label={listening ? '朗读中' : '听书'} active={listening} onPress={p.onListen} />
        <Tool colors={colors} icon={colors.dark ? 'sun' : 'moon'} label={colors.dark ? '日间' : '夜间'} onPress={p.onNight} />
        <Tool colors={colors} icon="type" label="字体" onPress={p.onType} />
        <Tool colors={colors} icon="sliders" label="设置" onPress={p.onMore} />
      </View>
    </View>
  );
}

export function ListenFab({ colors, player, onPress, onLongPress }: { colors: ReadingTheme; player: PlayerState; onPress: () => void; onLongPress: () => void }) {
  const eink = colors.eink === true;
  const playing = player.active && !player.paused;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={playing ? '暂停朗读' : '开始朗读'} accessibilityHint="长按打开听书播放器" onPress={onPress} onLongPress={onLongPress}
      style={({ pressed }) => [s.fab, { backgroundColor: eink ? colors.surface : colors.accent, borderRadius: eink ? 6 : 24, borderWidth: eink ? 1.5 : StyleSheet.hairlineWidth, borderColor: eink ? colors.text : colors.line }, pressed && { opacity: 0.8 }]}>
      {player.buffering && playing ? <ActivityIndicator color={eink ? colors.text : colors.onAccent} /> : <Icon name={playing ? 'pause' : 'headphones'} size={21} color={eink ? colors.text : colors.onAccent} />}
    </Pressable>
  );
}

// Defined at module scope so each sentence advance re-renders, not remounts, the controls.
function PlayerChip({ icon, label, onPress, fg, eink, line }: { icon: IconName; label: string; onPress: () => void; fg: string; eink: boolean; line: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [s.chip, { borderColor: eink ? line : 'rgba(246,243,234,0.28)', borderRadius: eink ? 4 : 18, borderWidth: eink ? 1.5 : 1 }, pressed && { opacity: 0.6 }]}>
      <Icon name={icon} size={16} color={fg} /><Text numberOfLines={1} style={{ color: fg, fontSize: 12, fontWeight: '600', maxWidth: 110 }}>{label}</Text>
    </Pressable>
  );
}

function PlayerControl({ icon, label, onPress, fg }: { icon: IconName; label: string; onPress: () => void; fg: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={({ pressed }) => [s.ctl, pressed && { opacity: 0.5 }]}>
      <Icon name={icon} size={26} color={fg} />
    </Pressable>
  );
}

export function PlayerSheet(p: {
  visible: boolean; colors: ReadingTheme; title: string; author?: string; chapterTitle?: string;
  sentences: string[]; position: number; rate: number; voiceLabel: string; player: PlayerState;
  onClose: () => void; onPlay: () => void; onSeek: (sentence: number) => void; onPrevChapter: () => void; onNextChapter: () => void;
  onRate: () => void; onVoice: () => void; onToc: () => void; onDismiss?: () => void;
}) {
  const { colors } = p;
  const eink = colors.eink === true;
  const fg = eink ? colors.text : brand.onBrand;
  const sub = eink ? colors.muted : 'rgba(246,243,234,0.62)';
  const playing = p.player.active && !p.player.paused;
  const total = Math.max(1, p.sentences.length);
  const current = Math.max(0, Math.min(p.position, total - 1));
  const from = Math.max(0, current - 1);
  const excerpt = p.sentences.slice(from, from + 4);
  const chip = { fg, eink, line: colors.text };
  return (
    <Modal visible={p.visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={p.onClose} onDismiss={p.onDismiss}
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: eink ? colors.background : brand.deep }}>
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
                <PlayerControl fg={fg} icon="prev" label="上一章" onPress={p.onPrevChapter} />
                <PlayerControl fg={fg} icon="back" label="上一句" onPress={() => p.onSeek(Math.max(0, current - 1))} />
                <Pressable accessibilityRole="button" accessibilityLabel={playing ? '暂停朗读' : '开始朗读'} onPress={p.onPlay}
                  style={({ pressed }) => [s.bigPlay, { backgroundColor: eink ? colors.text : GOLD, borderRadius: eink ? 8 : 36 }, pressed && { opacity: 0.85 }]}>
                  {p.player.buffering && playing ? <ActivityIndicator color={eink ? colors.surface : brand.ink} /> : <Icon name={playing ? 'pause' : 'play'} size={30} color={eink ? colors.surface : brand.ink} />}
                </Pressable>
                <PlayerControl fg={fg} icon="chev" label="下一句" onPress={() => p.onSeek(Math.min(total - 1, current + 1))} />
                <PlayerControl fg={fg} icon="next" label="下一章" onPress={p.onNextChapter} />
              </View>
              <View style={s.chips}>
                <PlayerChip {...chip} icon="speed" label={`${p.rate}× 语速`} onPress={p.onRate} />
                <PlayerChip {...chip} icon="mic" label={p.voiceLabel} onPress={p.onVoice} />
                <PlayerChip {...chip} icon="list" label="目录" onPress={p.onToc} />
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
  top: { position: 'absolute', top: 0, minHeight: 52, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bottom: { position: 'absolute', bottom: 0, paddingTop: 12, paddingBottom: 6, gap: 8 },
  barButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  chapterBtn: { minWidth: 44, alignItems: 'center' },
  slider: { flex: 1, height: 44, justifyContent: 'center' },
  sliderBubble: { position: 'absolute', bottom: 34, alignSelf: 'center', fontSize: 12, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  track: { height: 5, borderRadius: 3, justifyContent: 'center' },
  knob: { position: 'absolute', width: 16, height: 16, borderRadius: 8, marginLeft: -8, borderWidth: 2.5 },
  knobActive: { width: 22, height: 22, borderRadius: 11, marginLeft: -11 },
  tools: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 2 },
  tool: { flex: 1, alignItems: 'center', gap: 4 },
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
