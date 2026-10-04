import { DisplayText as Text } from '../components/DisplayText';
import React, { useMemo, useState } from 'react';
import appConfig from '../../app.json';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {useLibraryUI} from '../tingye/library-ui';
import ScreenHeader from '../components/ScreenHeader';
import Icon, { type IconName } from '../components/Icon';
import { FLOATING_TAB_BAR_SPACE } from '../components/MaterialNavBar';
import ThemeSwitcher from '../components/ThemeSwitcher';
import ReadingChart, { type ReadingChartRange } from '../components/ReadingChart';
import { useAppTheme } from '../theme/useAppTheme';
import { spacing as spacingTokens, brand } from '../theme/tokens';

function StatItem({ label, value, valueColor, labelColor }: { label: string; value: string; valueColor: string; labelColor: string }) {
  return (
    <View style={styles.statItem}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, { color: valueColor }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: labelColor }]}>{label}</Text>
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
      <ScreenHeader title="我" subtitle="阅读记录 · 外观 · 账户" />
      <ScrollView
        contentContainerStyle={{width:'100%',maxWidth:760,alignSelf:'center',
          paddingHorizontal: spacingTokens.lg,
          paddingBottom: insets.bottom + FLOATING_TAB_BAR_SPACE,
        }}
      >
        <View style={[styles.profileCard, { backgroundColor: theme.colors.inverseSurface }]}>
          <View style={styles.profileHeader}>
            <View style={[styles.avatar, { borderColor: brand.gold, backgroundColor: theme.scheme === 'dark' ? 'rgba(28,28,30,0.12)' : 'rgba(255,255,255,0.14)' }]}>
              <Text style={[styles.avatarText, { color: theme.colors.inverseOnSurface }]}>{(ui.username||'读').slice(0,1).toUpperCase()}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text numberOfLines={1} style={[styles.username, { color: theme.colors.inverseOnSurface }]}>{ui.username}</Text>
              <Text style={[styles.userHandle, { color: theme.colors.inverseOnSurface }]}>继续每天 15 分钟，养成阅读习惯</Text>
            </View>
          </View>
          <View style={[styles.statsRow, { borderTopColor: theme.scheme === 'dark' ? 'rgba(28,28,30,0.18)' : 'rgba(255,255,255,0.2)' }]}>
            <StatItem label="累计阅读" value={formatMinutes(total)} valueColor={brand.gold} labelColor={theme.colors.inverseOnSurface} />
            <StatItem label="今日" value={formatMinutes(today)} valueColor={brand.gold} labelColor={theme.colors.inverseOnSurface} />
            <StatItem label="阅读天数" value={`${days}`} valueColor={brand.gold} labelColor={theme.colors.inverseOnSurface} />
            <StatItem label="藏书" value={`${notes}`} valueColor={brand.gold} labelColor={theme.colors.inverseOnSurface} />
          </View>
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
          {([
            { label: '云同步 · 备份与还原', icon: 'backup',action:ui.refresh },
            { label: '导入书籍', icon: 'import',action:ui.importBooks },
            { label: '听书设置', icon: 'headphones',action:ui.settings },
            { label:'退出登录 / 切换账号',icon:'logout',action:ui.logout },
          ] as {label:string;icon:IconName;action:()=>void}[]).map((item, i, arr) => (
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
              <View style={[styles.tileIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                <Icon name={item.icon} size={18} color={theme.colors.primary} />
              </View>
              <Text style={[styles.tileText, { color: theme.colors.onSurface }]}>
                {item.label}
              </Text>
              <Icon name="chev" size={18} color={theme.colors.outline} />
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
  profileCard: { borderRadius: 20, padding: 20, marginTop: 4, overflow: 'hidden' },
  profileHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  avatarText: { fontFamily: brand.serif, fontSize: 26, fontWeight: '700' },
  profileInfo: { flex: 1, marginLeft: spacingTokens.lg },
  username: { fontFamily: brand.serif, fontSize: 20, fontWeight: '700' },
  userHandle: { fontSize: 12, marginTop: spacingTokens.xs, opacity: 0.7 },
  statsRow: { flexDirection: 'row', marginTop: 20, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  statItem: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  statValue: { fontSize: 15, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 4, opacity: 0.65 },
  sectionLabel: { fontSize: 15, fontWeight: '700', marginTop: spacingTokens.xl, marginBottom: spacingTokens.sm, paddingHorizontal: spacingTokens.xs },
  chartCard: { borderRadius: 16, paddingHorizontal: spacingTokens.lg, paddingVertical: spacingTokens.lg },
  tileGroup: { borderRadius: 16, overflow: 'hidden' },
  tile: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacingTokens.lg, paddingVertical: 12 },
  tileIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tileText: { flex: 1, marginLeft: spacingTokens.md, fontSize: 15, fontWeight: '500' },
  versionLabel: { fontSize: 12, textAlign: 'center', marginTop: spacingTokens.xl },
});