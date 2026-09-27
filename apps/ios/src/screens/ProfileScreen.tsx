import { DisplayText as Text } from '../components/DisplayText';
import React, { useMemo, useState } from 'react';
import appConfig from '../../app.json';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {useLibraryUI} from '../tingye/library-ui';
import ScreenHeader from '../components/ScreenHeader';
import Icon, { type IconName } from '../components/Icon';
import Gradient from '../components/Gradient';
import { FLOATING_TAB_BAR_SPACE } from '../components/MaterialNavBar';
import ThemeSwitcher from '../components/ThemeSwitcher';
import ReadingChart, { type ReadingChartRange } from '../components/ReadingChart';
import { useAppTheme } from '../theme/useAppTheme';
import { spacing as spacingTokens, shape as shapeTokens, brand } from '../theme/tokens';

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
        <View style={styles.profileCard}>
          <Gradient from={brand.green} to={brand.deep} id="profile" />
          <View style={styles.profileGlow} />
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(ui.username||'读').slice(0,1).toUpperCase()}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text numberOfLines={1} style={styles.username}>{ui.username}</Text>
              <Text style={styles.userHandle}>继续每天 15 分钟，养成阅读习惯</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <StatItem label="累计阅读" value={formatMinutes(total)} />
            <StatItem label="今日" value={formatMinutes(today)} />
            <StatItem label="阅读天数" value={`${days}`} />
            <StatItem label="藏书" value={`${notes}`} />
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
  profileCard: { borderRadius: 26, padding: 20, marginTop: 4, overflow: 'hidden' },
  profileGlow: { position: 'absolute', width: 200, height: 200, borderRadius: 100, right: -70, top: -90, backgroundColor: 'rgba(201,162,89,0.18)' },
  profileHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1.5, borderColor: 'rgba(201,162,89,0.8)' },
  avatarText: { fontFamily: brand.serif, fontSize: 26, fontWeight: '700', color: '#FFFFFF' },
  profileInfo: { flex: 1, marginLeft: spacingTokens.lg },
  username: { fontFamily: brand.serif, fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  userHandle: { fontSize: 12, marginTop: spacingTokens.xs, color: 'rgba(255,255,255,0.7)' },
  statsRow: { flexDirection: 'row', marginTop: 20, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.2)' },
  statItem: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  statValue: { fontSize: 15, fontWeight: '700', color: brand.gold },
  statLabel: { fontSize: 11, marginTop: 4, color: 'rgba(255,255,255,0.65)' },
  sectionLabel: { fontFamily: brand.serif, fontSize: 17, fontWeight: '700', marginTop: spacingTokens.xl, marginBottom: spacingTokens.sm, paddingHorizontal: spacingTokens.xs },
  chartCard: { borderRadius: 22, paddingHorizontal: spacingTokens.lg, paddingVertical: spacingTokens.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E6E1D4' },
  tileGroup: { borderRadius: 22, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E6E1D4' },
  tile: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacingTokens.lg, paddingVertical: 12 },
  tileIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileText: { flex: 1, marginLeft: spacingTokens.md, fontSize: 15, fontWeight: '500' },
  versionLabel: { fontSize: 12, textAlign: 'center', marginTop: spacingTokens.xl },
});