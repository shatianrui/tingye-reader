import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { DisplayText as Text } from './DisplayText';
import { brand } from '../theme/tokens';

// Decorative pieces of the 水墨 chrome. All are hidden from accessibility and
// never take touches; the controls around them carry the labels.

/** Three layered ridges, far to near, stretched to the given box. */
export function InkMountains({ width, height, color = brand.wash, strength = 1, style }: {
  width: number | `${number}%`; height: number; color?: string; strength?: number; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View pointerEvents="none" style={[{ width, height }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 390 160" preserveAspectRatio="none">
        <Path d="M0 96 L34 70 L58 84 L96 38 L128 76 L160 58 L206 92 L246 48 L280 78 L318 56 L352 82 L390 64 V160 H0 Z" fill={color} fillOpacity={0.07 * strength} />
        <Path d="M0 122 C30 104 52 96 80 108 C104 118 122 86 152 84 C186 82 202 112 236 110 C270 108 292 90 326 92 C352 94 372 104 390 100 V160 H0 Z" fill={color} fillOpacity={0.12 * strength} />
        <Path d="M0 160 V140 C44 130 84 126 128 136 C170 146 214 128 262 132 C306 136 350 148 390 138 V160 Z" fill={color} fillOpacity={0.2 * strength} />
      </Svg>
    </View>
  );
}

/** A square cinnabar seal (印章) with one brush character and an inner frame. */
export function Seal({ char = '听', size = 44, color = brand.cinnabar, ink = brand.onCinnabar, style }: {
  char?: string; size?: number; color?: string; ink?: string; style?: StyleProp<ViewStyle>;
}) {
  const inset = Math.max(2, Math.round(size * 0.07));
  return (
    <View pointerEvents="none" style={[{ width: size, height: size, borderRadius: Math.max(2, size * 0.08), backgroundColor: color, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View style={{ position: 'absolute', left: inset, top: inset, right: inset, bottom: inset, borderWidth: 1, borderColor: ink, opacity: 0.5, borderRadius: 1 }} />
      <Text allowFontScaling={false} style={{ fontFamily: brand.brush, fontSize: Math.round(size * 0.56), lineHeight: Math.round(size * 0.7), color: ink }}>{char}</Text>
    </View>
  );
}

/** A short tapered brush stroke, used under the active tab or filter. */
export function BrushStroke({ width = 30, color = brand.cinnabar }: { width?: number; color?: string }) {
  return (
    <View pointerEvents="none" style={{ width, height: width * 0.2 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 34 7" preserveAspectRatio="none">
        <Path d="M1 4.2C8 2.2 18 2 33 3.2L32.2 5.4C20 5 9 5.4 1.6 6.4Z" fill={color} />
      </Svg>
    </View>
  );
}

/** A small rotated square: the cinnabar dot that marks the active item. */
export function Diamond({ size = 6, color = brand.cinnabar }: { size?: number; color?: string }) {
  return <View pointerEvents="none" style={{ width: size, height: size, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />;
}

/** Hairline plus a second, fainter rule beneath it, like a printed 界栏. */
export function DoubleRule({ color, faint, style }: { color: string; faint: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={style}>
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: color }} />
      <View style={{ height: 1, marginTop: 2, backgroundColor: faint }} />
    </View>
  );
}
