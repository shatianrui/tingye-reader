import {useEffect,useState} from 'react';
import {Pressable,View} from 'react-native';
import {DisplayText as Text} from '../components/DisplayText';
import type {ReadingTheme} from './themes';
import {styles} from './reader-styles';
// Defined outside the reader: cursor updates must not remount settings controls.
export const ReaderButton=({colors,label,onPress,primary=false,disabled=false}:{colors:ReadingTheme;label:string;onPress:()=>void;primary?:boolean;disabled?:boolean})=><Pressable accessibilityRole="button" accessibilityState={{disabled,selected:primary}} disabled={disabled} onPress={onPress} style={({pressed})=>[styles.button,{backgroundColor:primary?(colors.eink?colors.text:colors.accent):colors.surface,borderColor:colors.eink?colors.text:colors.line,borderWidth:colors.eink?1.5:1,borderRadius:colors.eink?4:22,opacity:(pressed||disabled)?0.6:1}]}><Text style={{color:primary?(colors.eink?colors.surface:colors.onAccent):colors.text,fontSize:15,fontWeight:'600'}}>{label}</Text></Pressable>;

/**
 * ReaderErrorBanner — replaces the plain "player.error" Pressable that previously
 * showed only the raw server message. We classify the message so users get a
 * targeted suggestion:
 *   quota   → cloud TTS quota/rate-limit → switch to system voice
 *   auth    → re-login
 *   network → retry
 *   other   → open settings (fall through)
 *
 * Dismissable via a local "知道了" pill so a stale error doesn't block the
 * controls; the banner re-appears if the player emits a new error.
 */
type ErrorKind = 'timing' | 'rate' | 'quota' | 'auth' | 'network' | 'other';

const ERROR_PATTERNS: Array<{ kind: ErrorKind; match: RegExp }> = [
  { kind: 'timing', match: /词级时间戳|设备语音识别/ },
  { kind: 'rate', match: /请求过快|请求过于频繁|rate\s*limit|too\s*many|频率|限流/i },
  { kind: 'quota', match: /额度|quota|余额|朗读上限/i },
  { kind: 'auth', match: /登录|登录已过期|token|未授权|unauthor|401/i },
  { kind: 'network', match: /网络|云端|连接不上|timeout|timed?\s*out|connect|offline/i },
];

function classifyError(message: string): ErrorKind {
  for (const { kind, match } of ERROR_PATTERNS) {
    if (match.test(message)) return kind;
  }
  return 'other';
}

export function ReaderErrorBanner({
  colors,
  message,
  bottom,
  onOpenSettings,
  onRetry,
}: {
  colors: ReadingTheme;
  message: string;
  bottom: number;
  onOpenSettings: () => void;
  onRetry: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    // Reset when the underlying error changes (e.g. user retried successfully
    // and a new error arrived).
    setDismissed(false);
  }, [message]);

  const kind = classifyError(message);
  const title =
    kind === 'timing' ? '准确跟读暂不可用' : kind === 'rate'
      ? '语音请求暂时受限'
      : kind === 'quota'
      ? '语音服务额度受限'
      : kind === 'auth'
      ? '登录状态已过期'
      : kind === 'network'
      ? '暂时连接不上云端'
      : '听书出错';
  const hint =
    kind === 'timing' ? '声音会继续播放，可到设置切换本地语音。' : kind === 'rate'
      ? '稍候再试，或到设置切换本地语音。'
      : kind === 'quota'
      ? '到设置切换本地语音，或检查语音服务账户额度。'
      : kind === 'auth'
      ? '重新登录后可以从原章节继续听书。'
      : kind === 'network'
      ? '检查网络后再试一次，已下载的正文仍可阅读。'
      : '到设置里换个语音试试，或稍后再试。';
  // Settings actions open the existing panel; only retry restarts playback.
  const onPrimary =
    kind === 'rate'
      ? onRetry
      : kind === 'quota'
      ? () => {
          onOpenSettings();
        }
      : kind === 'auth'
      ? onOpenSettings
      : kind === 'network'
      ? onRetry
      : onOpenSettings;
  const primaryLabel =
    kind === 'rate'
      ? '重试'
      : kind === 'quota'
      ? '语音设置'
      : kind === 'auth'
      ? '账户设置'
      : kind === 'network'
      ? '重试'
      : '打开设置';

  if (dismissed) return null;

  return (
    <View
      style={[
        styles.readerError,
        {
          bottom,
          backgroundColor: colors.surface,
          borderColor: colors.line,
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.readerErrorHeader}>
        <View
          style={[
            styles.readerErrorBadge,
            { backgroundColor: colors.accent },
          ]}
          accessibilityElementsHidden
        >
          <Text style={[styles.readerErrorBadgeText, { color: colors.onAccent }]}>!</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            selectable
            style={[styles.readerErrorTitle, { color: colors.text }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            selectable
            style={[styles.readerErrorHint, { color: colors.muted }]}
            numberOfLines={2}
          >
            {hint}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭提示"
          onPress={() => setDismissed(true)}
          style={({ pressed }) => [
            styles.readerErrorDismiss,
            pressed && { opacity: 0.6 },
          ]}
          hitSlop={6}
        >
          <Text style={{ color: colors.muted, fontSize: 16 }}>✕</Text>
        </Pressable>
      </View>
      <Text
        selectable
        style={[styles.readerErrorDetail, { color: colors.muted }]}
        numberOfLines={3}
      >
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={primaryLabel}
        onPress={onPrimary}
        style={({ pressed }) => [
          styles.readerErrorAction,
          { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.readerErrorActionText, { color: colors.onAccent }]}>
          {primaryLabel}
        </Text>
      </Pressable>
    </View>
  );
}
