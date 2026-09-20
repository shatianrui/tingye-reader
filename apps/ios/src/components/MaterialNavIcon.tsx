import { DisplayText as Text } from './DisplayText';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../theme/useAppTheme';
import { shape as shapeTokens, spacing as spacingTokens } from '../theme/tokens';

export interface MaterialNavIconProps {
  icon: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Hide the label and only show the icon (M3 "labeled false" mode). */
  showLabel?: boolean;
}

/**
 * Material 3 NavigationBar item.
 *
 * Active state: pill background in secondaryContainer, icon + label in
 * onSecondaryContainer. Inactive: transparent background, onSurfaceVariant
 * foreground. The pill grows in width to fit the label so the bar has the
 * characteristic M3 "expanding indicator" feel.
 *
 * Uses vector glyphs (unicode arrow / symbol) instead of emoji so the visual
 * weight matches the Material You line-icon system.
 */
export default function MaterialNavIcon({
  icon,
  label,
  selected,
  onPress,
  showLabel = true,
}: MaterialNavIconProps) {
  const theme = useAppTheme();
  const fg = selected ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        selected && { backgroundColor: theme.colors.secondaryContainer },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.iconSlot}>
        <Text style={[styles.icon, { color: fg }]} allowFontScaling={false}>
          {icon}
        </Text>
      </View>
      {showLabel ? (
        <Text
          style={[styles.label, { color: fg }]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    paddingHorizontal: spacingTokens.md,
    marginHorizontal: spacingTokens.xxs,
    borderRadius: shapeTokens.full,
  },
  pressed: {
    opacity: 0.85,
  },
  iconSlot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 22,
    lineHeight: 24,
  },
  label: {
    marginLeft: spacingTokens.sm,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});