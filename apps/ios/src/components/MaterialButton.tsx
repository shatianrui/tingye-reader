import { DisplayText as Text } from './DisplayText';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useAppTheme } from '../theme/useAppTheme';
import { shape as shapeTokens, spacing as spacingTokens } from '../theme/tokens';
import { GlyphIcon } from './Icon';

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'elevated';

export interface MaterialButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: ButtonVariant;
  /** Optional leading icon glyph (text/emoji) rendered in a 18dp slot. */
  icon?: string;
  /** Stretch to fill the parent's main axis. */
  fullWidth?: boolean;
  /** Override container style. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Material 3 expressive button.
 *
 * - `filled`   → primary background, onPrimary foreground (default CTA).
 * - `tonal`    → secondaryContainer background, onSecondaryContainer foreground.
 * - `outlined` → transparent + 1dp outline, primary foreground.
 * - `text`     → transparent, primary foreground, no border.
 * - `elevated` → surface background with level1 shadow, primary foreground.
 *
 * Sizing follows M3: 40dp height for compact rows, 56dp for prominent
 * hero CTAs (controlled via `style` override). Corner radius is the
 * full pill by default (height/2), per M3 expressive guidance.
 */
export default function MaterialButton({
  label,
  variant = 'filled',
  icon,
  fullWidth,
  style,
  disabled,
  onPress,
  ...rest
}: MaterialButtonProps) {
  const theme = useAppTheme();

  const containerStyle: ViewStyle = (() => {
    switch (variant) {
      case 'filled':
        return { backgroundColor: theme.colors.primary };
      case 'tonal':
        return { backgroundColor: theme.colors.secondaryContainer };
      case 'outlined':
        return { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.outline };
      case 'text':
        return { backgroundColor: 'transparent' };
      case 'elevated':
        return {
          backgroundColor: theme.colors.surfaceContainerLow,
          ...theme.elevation.level1,
        };
    }
  })();

  const textColor = (() => {
    switch (variant) {
      case 'filled':
        return theme.colors.onPrimary;
      case 'tonal':
        return theme.colors.onSecondaryContainer;
      case 'outlined':
      case 'text':
        return theme.colors.primary;
      case 'elevated':
        return theme.colors.primary;
    }
  })();

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPress={onPress as ((e: GestureResponderEvent) => void) | undefined}
      style={({ pressed }) => [
        styles.base,
        containerStyle,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ ...rest.accessibilityState, disabled: !!disabled }}
    >
      {icon ? <View style={styles.icon}><GlyphIcon glyph={icon} size={18} color={textColor} /></View> : null}
      <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: spacingTokens.lg,
    borderRadius: shapeTokens.full,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  icon: {
    marginRight: spacingTokens.sm,
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.38,
  },
});