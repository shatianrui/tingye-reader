import type {Dispatch, SetStateAction} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {DisplayText as Text} from '../components/DisplayText';
import Icon from '../components/Icon';
import {brand} from '../theme/tokens';
import {ReaderButton} from './ReaderControls';
import {SettingsCard} from './ReaderChrome';
import ReadingTypographySettings from './ReadingTypographySettings';
import {styles} from './reader-styles';
import {readingThemes, type ReadingTheme} from './themes';
import type {Preferences} from './use-reader-preferences';

/** 阅读设置 panel: font size, background swatches, e-ink mode, layout and typography. */
export default function ReadingAppearancePanel({prefs, setPrefs, colors, fontsReady, onChooseTheme, onToggleEink}: {
  prefs: Preferences; setPrefs: Dispatch<SetStateAction<Preferences>>; colors: ReadingTheme; fontsReady: boolean;
  onChooseTheme: (theme: ReadingTheme) => void; onToggleEink: () => void;
}) {
  const stepStyle = [styles.fontStep, {borderColor: colors.eink ? colors.text : colors.line, borderRadius: colors.eink ? 4 : 18}];
  return <ScrollView contentContainerStyle={{padding: 20, gap: 16}}>
    <SettingsCard colors={colors}>
      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}><Text style={[styles.label, {color: colors.text}]}>字号</Text><Text style={{color: colors.muted, fontSize: 13}}>{prefs.fontSize}</Text></View>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
        <Pressable accessibilityRole="button" accessibilityLabel="减小字号" onPress={() => setPrefs(p => ({...p, originalLayout: false, fontSize: Math.max(16, p.fontSize - 2)}))} style={stepStyle}><Text style={{color: colors.text, fontSize: 14, fontFamily: brand.serif}}>A</Text></Pressable>
        <View style={{flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.line}}><View style={{width: `${Math.round((prefs.fontSize - 16) / 14 * 100)}%`, height: '100%', borderRadius: 2, backgroundColor: colors.eink ? colors.text : colors.accent}}/></View>
        <Pressable accessibilityRole="button" accessibilityLabel="增大字号" onPress={() => setPrefs(p => ({...p, originalLayout: false, fontSize: Math.min(30, p.fontSize + 2)}))} style={stepStyle}><Text style={{color: colors.text, fontSize: 22, fontFamily: brand.serif}}>A</Text></Pressable>
      </View>
    </SettingsCard>
    <SettingsCard colors={colors}>
      <Text style={[styles.label, {color: colors.text}]}>阅读背景</Text>
      <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 14}}>{readingThemes.map(theme => {
        const selected = prefs.theme === theme.id;
        return <Pressable key={theme.id} accessibilityRole="button" accessibilityLabel={theme.name} accessibilityState={{selected}} onPress={() => onChooseTheme(theme)} style={{alignItems: 'center', gap: 6, width: 52}}>
          <View style={[styles.swatch, {backgroundColor: theme.surface, borderColor: selected ? (colors.eink ? colors.text : colors.accent) : theme.line, borderWidth: selected ? 2.5 : 1, borderRadius: theme.eink ? 8 : 22}]}>{selected ? <Icon name="check" size={18} color={theme.text} strokeWidth={2.4}/> : <Text style={{color: theme.text, fontSize: 15, fontFamily: brand.serif}}>文</Text>}</View>
          <Text numberOfLines={1} style={{fontSize: 11, color: selected ? colors.text : colors.muted}}>{theme.name}</Text>
        </Pressable>;
      })}</View>
    </SettingsCard>
    <Pressable accessibilityRole="switch" accessibilityState={{checked: !!colors.eink}} onPress={onToggleEink} style={[styles.einkCard, {backgroundColor: colors.eink ? colors.surface : colors.highlight + '55', borderColor: colors.eink ? colors.text : colors.line, borderWidth: colors.eink ? 1.5 : StyleSheet.hairlineWidth, borderRadius: colors.eink ? 4 : 20}]}>
      <View style={[styles.einkIcon, {borderColor: colors.text, borderRadius: colors.eink ? 4 : 14}]}><Icon name="eink" size={24} color={colors.text}/></View>
      <View style={{flex: 1}}><Text style={{color: colors.text, fontSize: 16, fontWeight: '700', fontFamily: brand.serif}}>电纸书模式</Text><Text style={{color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4}}>高对比灰阶 · 衬线字体 · 单页留白 · 无动画，接近 Kindle 电子墨水屏。</Text></View>
      <View style={[styles.toggle, {backgroundColor: colors.eink ? colors.text : colors.line, borderRadius: colors.eink ? 4 : 14}]}><View style={[styles.toggleKnob, {backgroundColor: colors.surface, alignSelf: colors.eink ? 'flex-end' : 'flex-start', borderRadius: colors.eink ? 2 : 11}]}/></View>
    </Pressable>
    <SettingsCard colors={colors}>
      <Text style={[styles.label, {color: colors.text}]}>书籍排版</Text><View style={styles.chips}><ReaderButton colors={colors} label="原书图文" primary={prefs.originalLayout} onPress={() => setPrefs(p => ({...p, originalLayout: true}))}/><ReaderButton colors={colors} label="自定义阅读" primary={!prefs.originalLayout} onPress={() => setPrefs(p => ({...p, originalLayout: false}))}/></View><Text style={{color: colors.muted, fontSize: 12, lineHeight: 18}}>原书图文保留 EPUB 样式、图片和表格；自定义阅读应用下方字体、行距。PDF 保留原始页面，可双指缩放。</Text>
      <Text style={[styles.label, {color: colors.text}]}>展开阅读</Text><View style={styles.chips}><ReaderButton colors={colors} label="自动双页" primary={prefs.spreadMode !== 'single'} onPress={() => setPrefs(p => ({...p, spreadMode: 'auto'}))}/><ReaderButton colors={colors} label="始终单页" primary={prefs.spreadMode === 'single'} onPress={() => setPrefs(p => ({...p, spreadMode: 'single'}))}/></View>
    </SettingsCard>
    <ReadingTypographySettings value={prefs.typography} onChange={typography => setPrefs(p => ({...p, typography, originalLayout: false}))} colors={colors} fontSize={prefs.fontSize} fontsReady={fontsReady}/>
  </ScrollView>;
}
