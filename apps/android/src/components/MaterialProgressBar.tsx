import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../theme/useAppTheme';
import { shape as shapeTokens } from '../theme/tokens';

export interface MaterialProgressBarProps {
  /** 0..1 normalized progress. Values are clamped. */
  value: number;
  /** Visual height in dp; defaults to 4 (M3 linear indicator compact). */
  height?: number;
  /** Track + fill color override; defaults to surfaceVariant + primary. */
  trackColor?: string;
  fillColor?: string;
}

/**
 * Material 3 linear progress indicator. Used on book shelf cells and detail
 * pages to show reading progress without breaking the rounded aesthetic.
 *
 * If you need an indeterminate variant, animate `value` from the call site.
 */
export default function MaterialProgressBar({
  value,
  height = 4,
  trackColor,
  fillColor,
}: MaterialProgressBarProps) {
  const theme = useAppTheme();
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <View
      style={[
        styles.track,
        {
          height,
          borderRadius: height / 2,
          backgroundColor: trackColor ?? theme.colors.surfaceVariant,
        },
      ]}
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(clamped * 100) }}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: fillColor ?? theme.colors.primary,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: shapeTokens.full,
  },
});