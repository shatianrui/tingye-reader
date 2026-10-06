import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DisplayText as Text } from './DisplayText';
import Icon, { type IconName } from './Icon';
import { useAppTheme } from '../theme/useAppTheme';
import { brand } from '../theme/tokens';

export type HeaderAction = { icon: IconName; label: string; onPress: () => void; disabled?: boolean };

export function RoundButton({ icon, label, onPress, disabled }: HeaderAction) {
  const theme = useAppTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} hitSlop={6}
      style={({ pressed }) => [styles.round, { borderColor: theme.colors.outline }, (pressed || disabled) && { opacity: 0.55 }]}>
      <Icon name={icon} size={20} color={theme.colors.onSurface} strokeWidth={1.6} />
    </Pressable>
  );
}

/** Brush-written page title with ink-outlined circular actions (书架 / 发现 / 我). */
export default function ScreenHeader({ title, subtitle, actions = [] }: { title: string; subtitle?: string; actions?: HeaderAction[] }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 10 }]}>
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, { color: theme.colors.onSurface }]}>{title}</Text>
        {!!subtitle && <Text numberOfLines={1} style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>{subtitle}</Text>}
      </View>
      <View style={styles.actions}>{actions.map(a => <RoundButton key={a.label} {...a} />)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 14, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  title: { fontFamily: brand.brush, fontSize: 40, lineHeight: 50 },
  subtitle: { fontSize: 12, marginTop: 2, letterSpacing: 1.5 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
