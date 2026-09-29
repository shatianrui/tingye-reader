import type { PropsWithChildren } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { DisplayText as Text } from '../components/DisplayText';
import type { ReadingTheme } from './themes';
import { ReaderButton } from './ReaderControls';
import { brand } from '../theme/tokens';

type Props = PropsWithChildren<{
  visible: boolean;
  title: string;
  colors: ReadingTheme;
  width: number;
  panelWidth: number;
  wide: boolean;
  onClose: () => void;
}>;

/** Full-screen React controls on phones; a bounded side panel on wide windows. */
export function ReaderPanel({ visible, title, colors, width, panelWidth, wide, onClose, children }: Props) {
  return <Modal visible={visible} transparent presentationStyle="overFullScreen"
    animationType="fade" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
    onRequestClose={onClose}>
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: wide ? 'rgba(0,0,0,.28)' : colors.background, alignItems: 'flex-end' }}>
        {wide && <Pressable accessibilityRole="button" accessibilityLabel="关闭面板" onPress={onClose} style={StyleSheet.absoluteFill}/>}
        <SafeAreaView edges={['top', 'bottom', 'left', 'right']} testID="reader-settings-panel"
          accessibilityViewIsModal style={{ flex: 1, width: wide ? panelWidth : '100%', backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12 }}>
            <Text accessibilityRole="header" style={{ flex: 1, fontSize: width < 360 ? 19 : 23, fontWeight: '700', fontFamily: brand.serif, color: colors.text }}>{title}</Text>
            <ReaderButton colors={colors} label="完成" onPress={onClose}/>
          </View>
          {children}
        </SafeAreaView>
      </View>
    </SafeAreaProvider>
  </Modal>;
}
