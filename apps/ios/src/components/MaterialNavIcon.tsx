import { DisplayText as Text } from './DisplayText';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../theme/useAppTheme';
import Icon, { type IconName } from './Icon';
import { Diamond } from './Ink';

export interface MaterialNavIconProps {
  icon: IconName;
  label: string;
  selected: boolean;
  onPress: () => void;
}

/** Tab item: icon over label; the active one is inked and gets a cinnabar diamond before its label. */
export default function MaterialNavIcon({ icon, label, selected, onPress }: MaterialNavIconProps) {
  const theme = useAppTheme();
  const fg = selected ? theme.colors.onSurface : theme.colors.onSurfaceVariant;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      <Icon name={icon} size={22} color={fg} strokeWidth={selected ? 1.9 : 1.5} />
      <View style={styles.labelRow}>
        {selected && <Diamond size={5} color={theme.colors.tertiary} />}
        <Text style={[styles.label, { color: fg }, selected && styles.labelActive]} numberOfLines={1} allowFontScaling={false}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', gap: 3 },
  pressed: { opacity: 0.6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { fontSize: 12, fontWeight: '500', letterSpacing: 1 },
  labelActive: { fontWeight: '700' },
});
