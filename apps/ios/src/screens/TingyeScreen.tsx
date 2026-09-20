import { DisplayText as Text } from '../components/DisplayText';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useAppTheme } from '../theme/useAppTheme';
import { spacing as spacingTokens, shape as shapeTokens } from '../theme/tokens';

const READER_URL = 'https://tingye-reader.tianruisha24.chatgpt.site/';

export default function TingyeScreen() {
  const theme = useAppTheme();
  const opening = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const openReader = async (external = false) => {
    if (opening.current) return;
    opening.current = true;
    setBusy(true);
    setError('');
    try {
      if (external) {
        await Linking.openURL(READER_URL);
      } else {
        const result = await WebBrowser.openBrowserAsync(READER_URL, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          toolbarColor: theme.colors.surface,
          controlsColor: theme.colors.primary,
          dismissButtonStyle: 'close',
          enableBarCollapsing: true,
          readerMode: false,
          showTitle: true,
        });
        if (result.type === WebBrowser.WebBrowserResultType.LOCKED) {
          setError('已有窗口正在打开，请关闭后重试。');
        }
      }
    } catch {
      setError('暂时无法打开听页。请重试，或选择在浏览器中打开。');
    } finally {
      opening.current = false;
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <View
            style={[
              styles.brandMark,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
            accessibilityElementsHidden
          >
            <Text style={[styles.brandMarkText, { color: theme.colors.onPrimaryContainer }]}>听</Text>
          </View>
          <Text style={[styles.brand, { color: theme.colors.primary }]}>微读 · 听页</Text>
        </View>

        <View style={styles.hero}>
          <Text style={[styles.title, { color: theme.colors.onBackground }]} accessibilityRole="header">
            继续你的故事
          </Text>
          <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
            打开听页，用 ChatGPT 账号登录。{'\n'}完成验证后，即可阅读和听书。
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={() => { void openReader(); }}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: theme.colors.primary },
              (pressed || busy) && styles.dimmed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={theme.colors.onPrimary} />
            ) : (
              <Text style={[styles.primaryText, { color: theme.colors.onPrimary }]}>打开听页</Text>
            )}
          </Pressable>
          <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
            支持系统通行密钥验证
          </Text>
          {error ? (
            <Text style={[styles.error, { color: theme.colors.error }]} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </View>

        <View
          style={[
            styles.note,
            { backgroundColor: theme.colors.surfaceContainerLow },
          ]}
        >
          <Text style={[styles.noteTitle, { color: theme.colors.onSurface }]}>登录后，在同一窗口继续听书</Text>
          <Text style={[styles.noteText, { color: theme.colors.onSurfaceVariant }]}>
            验证成功会自动进入听页。阅读时保留该窗口；关闭后，可从这里再次打开。
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          accessibilityState={{ disabled: busy }}
          onPress={() => { void openReader(true); }}
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.6 }]}
        >
          <Text style={[styles.secondaryText, { color: theme.colors.primary }]}>在浏览器中打开</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: spacingTokens.xl,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacingTokens.sm,
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: shapeTokens.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacingTokens.sm,
  },
  brandMarkText: {
    fontSize: 18,
    fontWeight: '600',
  },
  brand: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacingTokens.xxl * 1.5,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacingTokens.lg,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: spacingTokens.lg,
  },
  primary: {
    minHeight: 56,
    width: '100%',
    borderRadius: shapeTokens.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacingTokens.xl,
    padding: spacingTokens.lg,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  dimmed: { opacity: 0.7 },
  hint: {
    fontSize: 12,
    marginTop: spacingTokens.md,
  },
  error: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: spacingTokens.lg,
    textAlign: 'center',
  },
  note: {
    borderRadius: shapeTokens.large,
    padding: spacingTokens.lg,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacingTokens.sm,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 22,
  },
  secondary: {
    minHeight: 48,
    padding: spacingTokens.lg,
    alignItems: 'center',
    marginTop: spacingTokens.md,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '500',
  },
});