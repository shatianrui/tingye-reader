import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/useAppTheme';
import MaterialNavIcon from './MaterialNavIcon';

export interface NavBarItem {
  key: string;
  icon: string;
  label: string;
  onPress: () => void;
  isActive: boolean;
}

export interface MaterialNavBarProps {
  items: NavBarItem[];
}

/**
 * Material 3 NavigationBar — bottom navigation with tonal pill indicators.
 * Renders inside the safe-area so it lifts correctly above gesture bars.
 */
export default function MaterialNavBar({ items }: MaterialNavBarProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom,
          backgroundColor: theme.colors.surfaceContainer,
          borderTopColor: theme.colors.outlineVariant,
        },
      ]}
      accessibilityRole="tablist"
    >
      <View style={styles.row}>
        {items.map((it) => (
          <MaterialNavIcon
            key={it.key}
            icon={it.icon}
            label={it.label}
            selected={it.isActive}
            onPress={it.onPress}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    width:'100%',maxWidth:600,alignSelf:'center',
    paddingHorizontal: 12,
    paddingTop: 12,
  },
});