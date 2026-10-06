// react-native for the desktop renderer: react-native-web, plus an Alert that
// actually shows (react-native-web's is a no-op) as a native Windows dialog.
import { desktop } from '../desktop';

export * from 'react-native-web';

type Button = { text?: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' };
export const Alert = {
  alert(title: string, message?: string, buttons?: Button[]) {
    const list: Button[] = buttons?.length ? [...buttons] : [{ text: '好' }];
    // Esc / closing the dialog must never pick an action, so menus get an explicit cancel.
    if (list.length > 1 && !list.some(b => b.style === 'cancel')) list.push({ text: '取消', style: 'cancel' });
    const cancelled = list.findIndex(b => b.style === 'cancel');
    const index = desktop.sync<number>('dialog:message', { title, message, buttons: list.map(b => b.text ?? '好'), cancelId: cancelled >= 0 ? cancelled : list.length - 1 });
    // Let the dialog's click finish before the app reacts, like the native Alert.
    setTimeout(() => list[index]?.onPress?.(), 0);
  },
  prompt() { throw new Error('Alert.prompt is not available on desktop'); },
};

// react-native-web has no BackHandler. On desktop, Esc and the mouse "back"
// button play its role: the newest handler that returns true consumes it
// (close a panel, hide the reader menu, return to the shelf).
type BackListener = () => boolean | null | undefined;
const backListeners: BackListener[] = [];
function goBack() { for (const listener of [...backListeners].reverse()) if (listener()) return true; return false; }
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
    const target = event.target as Element | null;
    if (target?.closest?.('input,textarea,[contenteditable="true"]')) return;
    if (goBack()) event.preventDefault();
  });
  window.addEventListener('mouseup', event => { if (event.button === 3 && goBack()) event.preventDefault(); });
}
export const BackHandler = {
  addEventListener(_event: 'hardwareBackPress', listener: BackListener) {
    backListeners.push(listener);
    return { remove: () => { const i = backListeners.lastIndexOf(listener); if (i >= 0) backListeners.splice(i, 1); } };
  },
  exitApp() { window.close(); },
};

