import { createContext, forwardRef, useContext, type PropsWithChildren } from 'react';
import { Platform, Text as NativeText, useWindowDimensions, type TextProps } from 'react-native';

const DisplayScaleContext = createContext('native');

export function DisplayScaleProvider({ children }: PropsWithChildren) {
  const { scale, fontScale } = useWindowDimensions();
  const revision = Platform.OS === 'android' ? `${scale}:${fontScale}` : 'native';
  return <DisplayScaleContext.Provider value={revision}>{children}</DisplayScaleContext.Provider>;
}

// Fabric's ParagraphState can reuse pixel-sized spans when only display density
// changes. Recreate the text host at that boundary, not the screen, reader,
// input fields or audio player. Ordinary window resizing keeps the same host.
export const DisplayText = forwardRef<NativeText, TextProps>(function DisplayText(props, ref) {
  const revision = useContext(DisplayScaleContext);
  return <NativeText {...props} ref={ref} key={revision} />;
});
