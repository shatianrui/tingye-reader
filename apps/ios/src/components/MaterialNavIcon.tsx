import { DisplayText as Text } from './DisplayText';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useAppTheme } from '../theme/useAppTheme';
import Icon, { type IconName } from './Icon';

export interface MaterialNavIconProps {
  icon: IconName;
  label: string;
  selected: boolean;
  onPress: () => void;
}

/** Floating pill tab item: active tab gets a soft brand pill with its label. */
export default function MaterialNavIcon({ icon, label, selected, onPress }: MaterialNavIconProps) {
  const theme = useAppTheme();
  const fg = selected ? theme.colors.primary : theme.colors.onSurfaceVariant;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.item, selected && { backgroundColor: theme.colors.primaryContainer }, pressed && styles.pressed]}
    >
      <Icon name={icon} size={21} color={fg} strokeWidth={selected ? 2 : 1.8} />
      <Text style={[styles.label, { color: fg }, selected && styles.labelActive]} numberOfLines={1} allowFontScaling={false}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { flex: 1, height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 3 },
  pressed: { opacity: 0.8 },
  label: { fontSize: 13, fontWeight: '500' },
  labelActive: { fontWeight: '700' },
});
