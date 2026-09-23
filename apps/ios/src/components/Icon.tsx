import React from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { DisplayText as Text } from './DisplayText';

export type IconName =
  | 'search' | 'shelf' | 'discover' | 'profile' | 'back' | 'forward' | 'plus' | 'more'
  | 'list' | 'moon' | 'sun' | 'play' | 'pause' | 'sync' | 'close';

// Glyphs the screens already pass around as "icons"; each maps to a drawn line icon.
const glyphs: Record<string, IconName> = {
  '⌕': 'search', '☰': 'list', '◯': 'discover', '◔': 'profile', '‹': 'back', '›': 'forward',
  '＋': 'plus', '+': 'plus', '⋯': 'more', '···': 'more', '☾': 'moon', '☼': 'sun', '✕': 'close',
};

const names = new Set<string>(Object.values(glyphs).concat(['shelf', 'play', 'pause', 'sync']));

export function resolveIcon(value: string): IconName | undefined {
  return names.has(value) ? (value as IconName) : glyphs[value];
}

export function Icon({ name, size = 22, color, strokeWidth = 1.8 }: { name: IconName; size?: number; color: string; strokeWidth?: number }) {
  const line = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'search' && <><Circle cx={11} cy={11} r={6.5} {...line} /><Line x1={20} y1={20} x2={16} y2={16} {...line} /></>}
      {name === 'shelf' && <><Path d="M12 6.5c-1.6-1.6-4.3-2.1-7.3-1.6v13.3c3-.5 5.7 0 7.3 1.6 1.6-1.6 4.3-2.1 7.3-1.6V4.9c-3-.5-5.7 0-7.3 1.6z" {...line} /><Path d="M12 6.5v13.3" {...line} /></>}
      {name === 'discover' && <><Circle cx={12} cy={12} r={8.5} {...line} /><Path d="M15.2 8.8l-1.9 4.5-4.5 1.9 1.9-4.5z" {...line} /></>}
      {name === 'profile' && <><Circle cx={12} cy={8.3} r={3.6} {...line} /><Path d="M4.8 19.5c0-3.9 3.3-6.3 7.2-6.3s7.2 2.4 7.2 6.3" {...line} /></>}
      {name === 'back' && <Path d="M15 5l-7 7 7 7" {...line} />}
      {name === 'forward' && <Path d="M9 5l7 7-7 7" {...line} />}
      {name === 'plus' && <><Line x1={12} y1={5} x2={12} y2={19} {...line} /><Line x1={5} y1={12} x2={19} y2={12} {...line} /></>}
      {name === 'more' && <><Circle cx={5.5} cy={12} r={1.6} fill={color} /><Circle cx={12} cy={12} r={1.6} fill={color} /><Circle cx={18.5} cy={12} r={1.6} fill={color} /></>}
      {name === 'list' && <><Line x1={9} y1={6} x2={20} y2={6} {...line} /><Line x1={9} y1={12} x2={20} y2={12} {...line} /><Line x1={9} y1={18} x2={20} y2={18} {...line} /><Circle cx={4.5} cy={6} r={1.2} fill={color} /><Circle cx={4.5} cy={12} r={1.2} fill={color} /><Circle cx={4.5} cy={18} r={1.2} fill={color} /></>}
      {name === 'moon' && <Path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" {...line} />}
      {name === 'sun' && <><Circle cx={12} cy={12} r={4} {...line} /><Path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" {...line} /></>}
      {name === 'play' && <Path d="M8 5.5v13l11-6.5z" fill={color} />}
      {name === 'pause' && <><Rect x={6} y={5} width={4} height={14} rx={1} fill={color} /><Rect x={14} y={5} width={4} height={14} rx={1} fill={color} /></>}
      {name === 'sync' && <><Path d="M19.5 12a7.5 7.5 0 0 1-12.8 5.3" {...line} /><Path d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3" {...line} /><Path d="M17.5 3.5v3.3h-3.3" {...line} /><Path d="M6.5 20.5v-3.3h3.3" {...line} /></>}
      {name === 'close' && <><Line x1={6} y1={6} x2={18} y2={18} {...line} /><Line x1={18} y1={6} x2={6} y2={18} {...line} /></>}
    </Svg>
  );
}

/** Draws a line icon for a known name or legacy glyph; any other string still renders as text. */
export function GlyphIcon({ glyph, size = 22, color, textStyle }: { glyph: string; size?: number; color: string; textStyle?: StyleProp<TextStyle> }) {
  const name = resolveIcon(glyph);
  if (name) return <Icon name={name} size={size} color={color} />;
  return <Text style={[{ fontSize: size, lineHeight: size + 2, color }, textStyle]} allowFontScaling={false}>{glyph}</Text>;
}
