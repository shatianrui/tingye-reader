import React from 'react';
import { Image as NativeImage, type ImageStyle, type StyleProp } from 'react-native';

type Props = {
  source?: { uri?: string } | string; style?: StyleProp<ImageStyle>; contentFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  accessibilityLabel?: string; onError?: () => void; [key: string]: unknown;
};
const MODES = { contain: 'contain', cover: 'cover', fill: 'stretch', none: 'center', 'scale-down': 'contain' } as const;

export function Image({ source, style, contentFit = 'cover', accessibilityLabel, onError }: Props) {
  const uri = typeof source === 'string' ? source : source?.uri;
  return <NativeImage source={uri ? { uri } : undefined} style={style} resizeMode={MODES[contentFit]} accessibilityLabel={accessibilityLabel} onError={onError} />;
}
export default Image;
