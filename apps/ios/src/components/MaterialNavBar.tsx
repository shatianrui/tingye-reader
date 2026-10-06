import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/useAppTheme';
import MaterialNavIcon from './MaterialNavIcon';
import { DoubleRule } from './Ink';
import type { IconName } from './Icon';

export interface NavBarItem {
  key: string;
  icon: IconName;
  label: string;
  onPress: () => void;
  isActive: boolean;
}

export interface MaterialNavBarProps {
  items: NavBarItem[];
}

/** Height reserved at the bottom of tab screens (plus the safe-area inset) so content clears the bar. */
export const FLOATING_TAB_BAR_SPACE = 76;

/** Docked paper tab bar under a double rule; the active tab is inked and marked with a cinnabar diamond. */
export default function MaterialNavBar({ items }: MaterialNavBarProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: theme.colors.background }]}>
      <DoubleRule color={theme.colors.outline} faint={theme.colors.outlineVariant} style={styles.rule} />
      <View accessibilityRole="tablist" style={styles.bar}>
        {items.map((it) => (
          <MaterialNavIcon key={it.key} icon={it.icon} label={it.label} selected={it.isActive} onPress={it.onPress} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 6 },
  rule: { position: 'absolute', left: 0, right: 0, top: 0 },
  bar: { width: '100%', maxWidth: 560, alignSelf: 'center', height: 54, flexDirection: 'row', alignItems: 'center' },
});
