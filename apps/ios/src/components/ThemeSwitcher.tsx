import { DisplayText as Text } from './DisplayText';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../theme/useAppTheme';
import { useAppearance, type AppearanceMode } from '../store/useAppearance';
import { spacing as spacingTokens, shape as shapeTokens } from '../theme/tokens';

const OPTIONS: { value: AppearanceMode; label: string; icon: string }[] = [
  { value: 'system', label: '跟随系统', icon: '◐' },
  { value: 'light', label: '浅色', icon: '☼' },
  { value: 'dark', label: '深色', icon: '☾' },
];

export interface ThemeSwitcherProps {
  /** Stack vertically (default) or render as a horizontal segmented control. */
  layout?: 'segmented' | 'list';
}

/**
 * Three-state theme switcher that drives `useAppearance`.
 *
 * - `segmented` (default): one container with three pill buttons sharing the row.
 * - `list`: each option is a full-width row with a leading icon (used when the
 *   switcher is embedded inside a list-tile group on the profile page).
 *
 * The active option uses `secondaryContainer` background per Material 3
 * filter-chip guidance, even though it's a switcher; the visual cue is
 * consistent with the rest of the app's selected-state language.
 */
export default function ThemeSwitcher({ layout = 'segmented' }: ThemeSwitcherProps) {
  const theme = useAppTheme();
  const mode = useAppearance((s) => s.mode);
  const setMode = useAppearance((s) => s.setMode);

  if (layout === 'list') {
    return (
      <View style={{ gap: 0 }}>
        {OPTIONS.map((opt) => {
          const active = opt.value === mode;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              android_ripple={{ color: theme.colors.outlineVariant }}
              onPress={() => setMode(opt.value)}
              style={({ pressed }) => [
                styles.listRow,
                {
                  backgroundColor: pressed ? theme.colors.surfaceContainer : 'transparent',
                },
              ]}
            >
              <Text style={[styles.listIcon, { color: theme.colors.onSurfaceVariant }]}>
                {opt.icon}
              </Text>
              <Text style={[styles.listLabel, { color: theme.colors.onSurface }]}>
                {opt.label}
              </Text>
              <View
                style={[
                  styles.radioOuter,
                  { borderColor: active ? theme.colors.primary : theme.colors.outline },
                ]}
              >
                {active ? (
                  <View
                    style={[
                      styles.radioInner,
                      { backgroundColor: theme.colors.primary },
                    ]}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.segmented,
        {
          backgroundColor: theme.colors.surfaceContainer,
          borderColor: theme.colors.outlineVariant,
        },
      ]}
      accessibilityRole="radiogroup"
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === mode;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => setMode(opt.value)}
            style={[
              styles.segment,
              active && {
                backgroundColor: theme.colors.secondaryContainer,
              },
            ]}
          >
            <Text
              style={[
                styles.segmentIcon,
                {
                  color: active
                    ? theme.colors.onSecondaryContainer
                    : theme.colors.onSurfaceVariant,
                },
              ]}
            >
              {opt.icon}
            </Text>
            <Text
              style={[
                styles.segmentLabel,
                {
                  color: active
                    ? theme.colors.onSecondaryContainer
                    : theme.colors.onSurfaceVariant,
                },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: shapeTokens.extraSmall,
    borderWidth: 1,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: shapeTokens.extraSmall,
    paddingHorizontal: spacingTokens.md,
  },
  segmentIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacingTokens.lg,
    paddingVertical: spacingTokens.md,
  },
  listIcon: {
    width: 28,
    fontSize: 18,
    textAlign: 'center',
  },
  listLabel: {
    flex: 1,
    marginLeft: spacingTokens.sm,
    fontSize: 15,
    fontWeight: '500',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});