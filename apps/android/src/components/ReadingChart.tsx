import { DisplayText as Text } from './DisplayText';
import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useAppTheme } from '../theme/useAppTheme';
import { spacing as spacingTokens, shape as shapeTokens } from '../theme/tokens';

export type ReadingChartRange = 'week' | 'month';

export interface ReadingChartProps {
  /** Daily reading seconds in chronological order, oldest first. */
  dailySeconds: number[];
  /** Optional labels (e.g. weekday names or day-of-month numbers). */
  labels?: string[];
  /** Range range selector; defaults to a 7-day week. */
  range?: ReadingChartRange;
  /** Show the segmented toggle inline (defaults to true). */
  showRangeToggle?: boolean;
  /** Notify parent when the segmented toggle changes (driven by parent state). */
  onRangeChange?: (r: ReadingChartRange) => void;
}

const CHART_HEIGHT = 168;
const TOP_PADDING = 12;
const BOTTOM_PADDING = 26;
const LABEL_GUTTER = 6;
const BAR_RADIUS = 4;

interface BarDatum {
  index: number;
  seconds: number;
  label: string;
  isToday: boolean;
}

/**
 * Compact bar chart for daily reading activity.
 *
 * - Bars are anchored to a baseline at the chart bottom and grow upward.
 * - The y-axis is auto-scaled to the max bar plus headroom, with a
 *   "nice" upper bound (rounded to the nearest 30 / 60 min) so the gridline
 *   labels don't wobble when the data shifts by one minute.
 * - Today's bar is highlighted with `primary` instead of `primaryContainer`
 *   so it stands out without needing a separate legend.
 * - The optional segmented toggle ("周" / "月") sits above the chart and
 *   does NOT re-mount the chart on switch — the data array length is part of
 *   the parent's responsibility.
 */
export default function ReadingChart({
  dailySeconds,
  labels,
  range = 'week',
  showRangeToggle = true,
  onRangeChange,
}: ReadingChartProps) {
  const theme = useAppTheme();
  const [width, setWidth] = useState(0);

  const data = useMemo<BarDatum[]>(() => {
    const len = dailySeconds.length;
    return dailySeconds.map((seconds, i) => ({
      index: i,
      seconds,
      label: labels?.[i] ?? '',
      isToday: i === len - 1,
    }));
  }, [dailySeconds, labels]);

  const stats = useMemo(() => {
    const maxSeconds = data.reduce((m, d) => Math.max(m, d.seconds), 0);
    // Round up to a "nice" 30-minute boundary so the top label is stable.
    const niceMax = niceUpperBound(maxSeconds);
    const totalSeconds = data.reduce((sum, d) => sum + d.seconds, 0);
    return { maxSeconds: niceMax, totalSeconds };
  }, [data]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (width === 0) {
    return <View style={{ height: CHART_HEIGHT }} onLayout={onLayout} />;
  }

  const slotWidth = (width - LABEL_GUTTER * (data.length + 1)) / data.length;
  const barWidth = Math.max(6, Math.min(slotWidth - 2, 28));
  const innerHeight = CHART_HEIGHT - TOP_PADDING - BOTTOM_PADDING;
  const gridLines = 4;
  const gridStep = stats.maxSeconds / gridLines;
  const labelStepMin = Math.round(gridStep / 60);

  return (
    <View>
      {showRangeToggle ? (
        <RangeToggle
          active={range}
          onChange={(r) => {
            if (r !== range && onRangeChange) onRangeChange(r);
          }}
        />
      ) : null}

      <View
        accessibilityLabel={`过去 ${
          range === 'week' ? '7' : '30'
        } 天的阅读时长柱状图，总计 ${Math.round(stats.totalSeconds / 60)} 分钟`}
      >
        <Svg width={width} height={CHART_HEIGHT}>
          <G>
            {/* Gridlines */}
            {Array.from({ length: gridLines + 1 }).map((_, i) => {
              const y = TOP_PADDING + (innerHeight * i) / gridLines;
              const value = stats.maxSeconds - gridStep * i;
              const minutes = Math.round(value / 60);
              return (
                <G key={`grid-${i}`}>
                  <Line
                    x1={LABEL_GUTTER}
                    y1={y}
                    x2={width - LABEL_GUTTER}
                    y2={y}
                    stroke={theme.colors.outlineVariant}
                    strokeWidth={i === gridLines ? 1 : 0.5}
                    strokeDasharray={i === gridLines ? undefined : '2,4'}
                  />
                  {i % 1 === 0 ? (
                    <SvgText
                      x={LABEL_GUTTER}
                      y={y - 3}
                      fill={theme.colors.onSurfaceVariant}
                      fontSize={9}
                      fontWeight="500"
                    >
                      {labelStepMin > 0 ? `${minutes}m` : `${Math.round(value)}s`}
                    </SvgText>
                  ) : null}
                </G>
              );
            })}

            {/* Bars */}
            {data.map((d, i) => {
              const x = LABEL_GUTTER + i * (slotWidth + LABEL_GUTTER) + slotWidth / 2 - barWidth / 2;
              const barHeight =
                stats.maxSeconds === 0
                  ? 0
                  : Math.max(2, (d.seconds / stats.maxSeconds) * innerHeight);
              const y = TOP_PADDING + innerHeight - barHeight;
              const fill = d.isToday ? theme.colors.primary : theme.colors.primaryContainer;
              return (
                <G key={`bar-${d.index}`}>
                  <Rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx={BAR_RADIUS}
                    ry={BAR_RADIUS}
                    fill={fill}
                  />
                  {d.label ? (
                    <SvgText
                      x={x + barWidth / 2}
                      y={TOP_PADDING + innerHeight + 16}
                      fill={
                        d.isToday
                          ? theme.colors.onSurface
                          : theme.colors.onSurfaceVariant
                      }
                      fontSize={10}
                      fontWeight={d.isToday ? '700' : '500'}
                      textAnchor="middle"
                    >
                      {d.label}
                    </SvgText>
                  ) : null}
                </G>
              );
            })}
          </G>
        </Svg>
      </View>

      <View
        style={[
          styles.legend,
          { borderTopColor: theme.colors.outlineVariant },
        ]}
      >
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              { backgroundColor: theme.colors.primary },
            ]}
          />
          <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>
            今日
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          />
          <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>
            历史
          </Text>
        </View>
        <Text style={[styles.totalLabel, { color: theme.colors.onSurface }]}>
          合计 {Math.round(stats.totalSeconds / 60)} 分钟
        </Text>
      </View>
    </View>
  );
}

interface RangeToggleProps {
  active: ReadingChartRange;
  onChange: (r: ReadingChartRange) => void;
}

function RangeToggle({ active, onChange }: RangeToggleProps) {
  const theme = useAppTheme();
  const opts: { value: ReadingChartRange; label: string }[] = [
    { value: 'week', label: '近 7 天' },
    { value: 'month', label: '近 30 天' },
  ];
  return (
    <View
      style={[
        styles.toggle,
        {
          backgroundColor: theme.colors.surfaceContainer,
          borderColor: theme.colors.outlineVariant,
        },
      ]}
      accessibilityRole="tablist"
    >
      {opts.map((o) => {
        const isActive = o.value === active;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(o.value)}
            style={[
              styles.toggleOption,
              isActive && {
                backgroundColor: theme.colors.secondaryContainer,
              },
            ]}
          >
            <Text
              style={[
                styles.toggleLabel,
                {
                  color: isActive
                    ? theme.colors.onSecondaryContainer
                    : theme.colors.onSurfaceVariant,
                },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Round a max reading duration up to a "nice" boundary for chart scaling. */
function niceUpperBound(seconds: number): number {
  if (seconds <= 0) return 60 * 30; // default 30 minutes when no data yet
  const minutes = seconds / 60;
  // Step up to next multiple of 30 minutes, with a minimum of 30.
  const step = 30;
  return Math.max(step, Math.ceil(minutes / step) * step) * 60;
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: shapeTokens.full,
    borderWidth: 1,
    marginBottom: spacingTokens.md,
    alignSelf: 'flex-start',
  },
  toggleOption: {
    paddingHorizontal: spacingTokens.md,
    height: 32,
    borderRadius: shapeTokens.full,
    justifyContent: 'center',
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacingTokens.sm,
    marginTop: spacingTokens.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacingTokens.md,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '500',
  },
  totalLabel: {
    marginLeft: 'auto',
    fontSize: 12,
    fontWeight: '600',
  },
});