import { DisplayText as Text } from './DisplayText';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../theme/useAppTheme';
import { shape as shapeTokens, spacing as spacingTokens } from '../theme/tokens';

export interface MaterialChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Optional leading glyph rendered in an 18dp slot. */
  icon?: string;
  /** Display only (no press feedback). Defaults to true when no `onPress`. */
  readOnly?: boolean;
}

/**
 * Material 3 assist / filter chip.
 *
 * - With `onPress`: behaves as a filter chip with selected/unselected states.
 * - Without `onPress` (or `readOnly`): renders as a label-style chip on
 *   surfaceContainer, useful for inline metadata on book detail pages.
 *
 * Selected state uses secondaryContainer / onSecondaryContainer.
 * Unselected state uses surfaceContainerLow + outlineVariant border.
 */
export default function MaterialChip({
  label,
  selected,
  onPress,
  icon,
  readOnly,
}: MaterialChipProps) {
  const theme = useAppTheme();
  const interactive = !!onPress && !readOnly;

  const palette = selected
    ? {
        bg: theme.colors.secondaryContainer,
        fg: theme.colors.onSecondaryContainer,
        border: 'transparent' as const,
      }
    : {
        bg: theme.colors.surfaceContainerLow,
        fg: theme.colors.onSurfaceVariant,
        border: theme.colors.outlineVariant,
      };

  const children = (
    <>
      {icon ? <Text style={[styles.icon, { color: palette.fg }]}>{icon}</Text> : null}
      <Text style={[styles.label, { color: palette.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </>
  );

  if (interactive) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: !!selected }}
        style={({ pressed }) => [
          styles.base,
          { backgroundColor: palette.bg, borderColor: palette.border },
          pressed && styles.pressed,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: palette.bg, borderColor: palette.border },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: spacingTokens.md,
    borderRadius: shapeTokens.small,
    borderWidth: 1,
    marginRight: spacingTokens.sm,
    marginBottom: spacingTokens.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  icon: {
    fontSize: 14,
    marginRight: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});