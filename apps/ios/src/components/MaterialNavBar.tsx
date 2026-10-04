import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/useAppTheme';
import MaterialNavIcon from './MaterialNavIcon';
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

/** Height reserved at the bottom of tab screens so content clears the floating bar. */
export const FLOATING_TAB_BAR_SPACE = 104;

/** Floating pill tab bar — flat, borderless-shadow design (20pt inset, 62pt tall). */
export default function MaterialNavBar({ items }: MaterialNavBarProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const dark = theme.scheme === 'dark';
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]}>
      <View
        accessibilityRole="tablist"
        style={[styles.bar, {
          backgroundColor: dark ? 'rgba(22,22,24,0.96)' : 'rgba(255,255,255,0.96)',
          borderColor: theme.colors.outlineVariant,
        }]}
      >
        {items.map((it) => (
          <MaterialNavIcon key={it.key} icon={it.icon} label={it.label} selected={it.isActive} onPress={it.onPress} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 20, right: 20, alignItems: 'center' },
  bar: {
    width: '100%', maxWidth: 520, height: 62, borderRadius: 31, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 7, borderWidth: StyleSheet.hairlineWidth,
  },
});
