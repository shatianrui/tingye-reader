import { DisplayText as Text } from './DisplayText';
import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../theme/useAppTheme';
import { spacing as spacingTokens, shape as shapeTokens } from '../theme/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface MaterialAppBarProps {
  title: string;
  /** Optional smaller line shown above the title (M3 small app bar). */
  overline?: string;
  leadingIcon?: string;
  trailingIcon?: string;
  onLeadingPress?: () => void;
  onTrailingPress?: () => void;
  /** Center-aligned (M3 small) vs left-aligned (M3 centerAligned). */
  variant?: 'small' | 'centerAligned';
  style?: StyleProp<ViewStyle>;
}

/**
 * Material 3 app bar.
 *
 * - `small`: left edge-aligned title (most common for top-level screens).
 * - `centerAligned`: title centered, used on detail pages that need more
 *   symmetry (BookDetail uses this).
 *
 * Renders inside a SafeAreaView-aware container so consumers don't have to
 * wrap it themselves; pass `style` to override the background if you need
 * a tinted surface.
 */
export default function MaterialAppBar({
  title,
  overline,
  leadingIcon,
  trailingIcon,
  onLeadingPress,
  onTrailingPress,
  variant = 'small',
  style,
}: MaterialAppBarProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, backgroundColor: theme.colors.surface },
        style,
      ]}
    >
      <View style={styles.row}>
        {leadingIcon ? (
          <Pressable
            onPress={onLeadingPress}
            accessibilityRole="button"
            accessibilityLabel={leadingIcon==='⌕'?'搜索':'返回'}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Text style={[styles.iconText, { color: theme.colors.onSurface }]}>{leadingIcon}</Text>
          </Pressable>
        ) : (
          <View style={styles.iconButtonPlaceholder} />
        )}
        <View
          style={[
            styles.titleSlot,
            variant === 'centerAligned' ? styles.titleCenter : styles.titleLeft,
          ]}
        >
          {overline ? (
            <Text style={[styles.overline, { color: theme.colors.onSurfaceVariant }]}>{overline}</Text>
          ) : null}
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              { color: theme.colors.onSurface },
              variant === 'centerAligned' && styles.titleCenterText,
            ]}
          >
            {title}
          </Text>
        </View>
        {trailingIcon ? (
          <Pressable
            onPress={onTrailingPress}
            accessibilityRole="button"
            accessibilityLabel={trailingIcon==='⌕'?'搜索':'操作'}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Text style={[styles.iconText, { color: theme.colors.onSurface }]}>{trailingIcon}</Text>
          </Pressable>
        ) : (
          <View style={styles.iconButtonPlaceholder} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacingTokens.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacingTokens.sm,
    minHeight: 56,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: shapeTokens.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  iconText: {
    fontSize: 22,
    lineHeight: 24,
  },
  titleSlot: {
    flex: 1,
    paddingHorizontal: spacingTokens.xs,
  },
  titleLeft: {
    alignItems: 'flex-start',
  },
  titleCenter: {
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: 0,
  },
  titleCenterText: {
    textAlign: 'center',
  },
  overline: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});