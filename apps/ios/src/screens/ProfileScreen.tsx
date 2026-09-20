import { DisplayText as Text } from '../components/DisplayText';
import React, { useMemo, useState } from 'react';
import appConfig from '../../app.json';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {useLibraryUI} from '../tingye/library-ui';
import MaterialAppBar from '../components/MaterialAppBar';
import ThemeSwitcher from '../components/ThemeSwitcher';
import ReadingChart, { type ReadingChartRange } from '../components/ReadingChart';
import { useAppTheme } from '../theme/useAppTheme';
import { spacing as spacingTokens, shape as shapeTokens } from '../theme/tokens';

function StatItem({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
    </View>
  );
}

function formatMinutes(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} 分钟`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${h} 小时` : `${h} 小时 ${mm} 分`;
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function dateKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function offsetDay(daysBack: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysBack);
  return d;
}

/**
 * Builds the per-day seconds array + labels for the requested range.
 * - 'week'  → 7 entries, oldest first, labels are weekday short names ("一","二"...).
 * - 'month' → 30 entries, oldest first, labels are sparse day numbers (every 5 days)
 *             so the x-axis stays readable on a phone-sized chart.
 */
function useReadingSeries(stats: Record<string, number>, range: ReadingChartRange) {
  return useMemo(() => {
    const N = range === 'week' ? 7 : 30;
    const out: { seconds: number; label: string }[] = [];
    for (let i = N - 1; i >= 0; i--) {
      const d = offsetDay(i);
      const key = dateKey(d);
      let label = '';
      if (range === 'week') {
        label = WEEKDAY_LABELS[d.getDay()];
      } else if (i === N - 1 || i === 0 || i % 5 === 0) {
        label = String(d.getDate()).padStart(2, '0');
      }
      out.push({ seconds: stats[key] ?? 0, label });
    }
    return out;
  }, [stats, range]);
}

export default function ProfileScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const ui=useLibraryUI(),stats=ui.stats;
  const total=Object.values(stats).reduce((a,b)=>a+b,0);
  const today=stats[dateKey(new Date())]||0;
  const days=Object.keys(stats).length;
  const notes=ui.books.length;
  const [chartRange, setChartRange] = useState<ReadingChartRange>('week');

  const series = useReadingSeries(stats, chartRange);



  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <MaterialAppBar title="我" variant="small" />
      <ScrollView
        contentContainerStyle={{width:'100%',maxWidth:760,alignSelf:'center',
          paddingHorizontal: spacingTokens.lg,
          paddingBottom: insets.bottom + 100,
        }}
      >
        <View
          style={[
            styles.profileCard,
            { backgroundColor: theme.colors.surfaceContainerLow },
          ]}
        >
          <View style={styles.profileHeader}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  { color: theme.colors.onPrimaryContainer },
                ]}
              >
                ◔
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text
                style={[styles.username, { color: theme.colors.onSurface }]}
              >
                {ui.username}
              </Text>
              <Text
                style={[
                  styles.userHandle,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                继续每天 15 分钟，养成阅读习惯
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.statsCard,
            { backgroundColor: theme.colors.surfaceContainer },
          ]}
        >
          <StatItem label="累计阅读" value={formatMinutes(total)} />
          <View
            style={[
              styles.statsDivider,
              { backgroundColor: theme.colors.outlineVariant },
            ]}
          />
          <StatItem label="今日阅读" value={formatMinutes(today)} />
          <View
            style={[
              styles.statsDivider,
              { backgroundColor: theme.colors.outlineVariant },
            ]}
          />
          <StatItem label="阅读天数" value={`${days}`} />
          <View
            style={[
              styles.statsDivider,
              { backgroundColor: theme.colors.outlineVariant },
            ]}
          />
          <StatItem label="藏书" value={`${notes}`} />
        </View>

        <Text
          style={[
            styles.sectionLabel,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          阅读活动
        </Text>
        <View
          style={[
            styles.chartCard,
            { backgroundColor: theme.colors.surfaceContainerLow },
          ]}
        >
          <ReadingChart
            dailySeconds={series.map((s) => s.seconds)}
            labels={series.map((s) => s.label)}
            range={chartRange}
            showRangeToggle
            onRangeChange={setChartRange}
          />
        </View>

        <Text
          style={[
            styles.sectionLabel,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          外观
        </Text>
        <View
          style={[
            styles.tileGroup,
            { backgroundColor: theme.colors.surfaceContainerLow },
          ]}
        >
          <ThemeSwitcher layout="list" />
        </View>

        <Text
          style={[
            styles.sectionLabel,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          账户
        </Text>
        <View
          style={[
            styles.tileGroup,
            { backgroundColor: theme.colors.surfaceContainerLow },
          ]}
        >
          {[
            { label: '云同步', icon: '↻',action:ui.refresh },
            { label: '导入书籍', icon: '＋',action:ui.importBooks },
            { label: '听书设置', icon: '⚙',action:ui.settings },
            { label:'退出登录 / 切换账号',icon:'↗',action:ui.logout },
          ].map((item, i, arr) => (
            <Pressable
              key={item.label}
              onPress={item.action}
              android_ripple={{ color: theme.colors.outlineVariant }}
              style={({ pressed }) => [
                styles.tile,
                {
                  borderBottomColor: theme.colors.outlineVariant,
                  borderBottomWidth:
                    i === arr.length - 1 ? 0 : StyleSheet.hairlineWidth,
                  backgroundColor: pressed
                    ? theme.colors.surfaceContainer
                    : 'transparent',
                },
              ]}
              accessibilityRole="button"
            >
              <Text style={[styles.tileIcon, { color: theme.colors.onSurfaceVariant }]}>
                {item.icon}
              </Text>
              <Text style={[styles.tileText, { color: theme.colors.onSurface }]}>
                {item.label}
              </Text>
              <Text style={[styles.tileArrow, { color: theme.colors.onSurfaceVariant }]}>›</Text>
            </Pressable>
          ))}
        </View>

        <Text
          style={[
            styles.versionLabel,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          听页 · v{appConfig.expo.version} · iPhone
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  profileCard: {
    borderRadius: shapeTokens.extraLarge,
    padding: spacingTokens.lg,
    marginTop: spacingTokens.md,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '500',
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacingTokens.lg,
  },
  username: {
    fontSize: 18,
    fontWeight: '600',
  },
  userHandle: {
    fontSize: 12,
    marginTop: spacingTokens.xs,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacingTokens.lg,
    borderRadius: shapeTokens.large,
    paddingVertical: spacingTokens.lg,
    paddingHorizontal: spacingTokens.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statsDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: spacingTokens.xl,
    marginBottom: spacingTokens.sm,
    paddingHorizontal: spacingTokens.xs,
  },
  chartCard: {
    borderRadius: shapeTokens.extraLarge,
    paddingHorizontal: spacingTokens.lg,
    paddingVertical: spacingTokens.lg,
  },
  tileGroup: {
    borderRadius: shapeTokens.large,
    overflow: 'hidden',
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacingTokens.lg,
    paddingVertical: spacingTokens.md,
  },
  tileIcon: {
    width: 28,
    fontSize: 18,
    textAlign: 'center',
  },
  tileText: {
    flex: 1,
    marginLeft: spacingTokens.sm,
    fontSize: 15,
    fontWeight: '500',
  },
  tileArrow: {
    fontSize: 20,
  },
  versionLabel: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacingTokens.xl,
  },
});