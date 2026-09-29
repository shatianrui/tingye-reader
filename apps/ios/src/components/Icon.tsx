import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

// Line icons from the 听页 Figma design (24×24 grid, round caps).
export type IconName =
  | 'shelf' | 'compass' | 'user' | 'search' | 'plus' | 'play' | 'pause' | 'back' | 'more' | 'list'
  | 'sun' | 'moon' | 'type' | 'headphones' | 'sync' | 'sliders' | 'prev' | 'next' | 'chev' | 'chevdown'
  | 'check' | 'eink' | 'bookmark' | 'close' | 'cloud' | 'wave' | 'lock' | 'speed' | 'mic' | 'backup'
  | 'logout' | 'flame' | 'ticket' | 'import';

type Props = { name: IconName; size?: number; color: string; strokeWidth?: number };

export default function Icon({ name, size = 24, color, strokeWidth = 1.8 }: Props) {
  const s = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const f = { fill: color, stroke: 'none' };
  const body = (() => {
    switch (name) {
      case 'shelf': return <><Rect x={3.5} y={4} width={4} height={16} rx={1} {...s}/><Rect x={9.5} y={4} width={4} height={16} rx={1} {...s}/><Path d="m15.5 5.2 3.8-1 3.2 15.6-3.8 1z" {...s}/></>;
      case 'compass': return <><Circle cx={12} cy={12} r={9} {...s}/><Path d="m15.5 8.5-2 5-5 2 2-5z" {...s}/></>;
      case 'user': return <><Circle cx={12} cy={8} r={4} {...s}/><Path d="M4 21a8 8 0 0 1 16 0" {...s}/></>;
      case 'search': return <><Circle cx={11} cy={11} r={7} {...s}/><Path d="m20 20-3.5-3.5" {...s}/></>;
      case 'plus': return <Path d="M12 5v14M5 12h14" {...s}/>;
      case 'import': return <Path d="M12 4v11M7 10l5 5 5-5M5 20h14" {...s}/>;
      case 'play': return <Path d="M8 5.2v13.6L19 12z" {...f}/>;
      case 'pause': return <><Rect x={6.5} y={5} width={4} height={14} rx={1.2} {...f}/><Rect x={13.5} y={5} width={4} height={14} rx={1.2} {...f}/></>;
      case 'back': return <Path d="m15 5-7 7 7 7" {...s}/>;
      case 'chev': return <Path d="m9 5 7 7-7 7" {...s}/>;
      case 'chevdown': return <Path d="m5 9 7 7 7-7" {...s}/>;
      case 'more': return <><Circle cx={5} cy={12} r={1.6} {...f}/><Circle cx={12} cy={12} r={1.6} {...f}/><Circle cx={19} cy={12} r={1.6} {...f}/></>;
      case 'list': return <><Path d="M9 6h12M9 12h12M9 18h12" {...s}/><Circle cx={4.5} cy={6} r={1.1} {...f}/><Circle cx={4.5} cy={12} r={1.1} {...f}/><Circle cx={4.5} cy={18} r={1.1} {...f}/></>;
      case 'sun': return <><Circle cx={12} cy={12} r={4} {...s}/><Path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" {...s}/></>;
      case 'moon': return <Path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" {...s}/>;
      case 'type': return <Path d="M3.5 19 8.5 5l5 14M5.3 14.5h6.4M14.5 19l3.2-8.5 3.3 8.5M15.4 16.6h4.6" {...s}/>;
      case 'headphones': return <><Path d="M3.5 17v-4a8.5 8.5 0 0 1 17 0v4" {...s}/><Rect x={3.5} y={14} width={4} height={7} rx={1.6} {...s}/><Rect x={16.5} y={14} width={4} height={7} rx={1.6} {...s}/></>;
      case 'sync': return <Path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" {...s}/>;
      case 'sliders': return <><Path d="M4 7h9M17 7h3M4 17h3M11 17h9" {...s}/><Circle cx={15} cy={7} r={2} {...s}/><Circle cx={9} cy={17} r={2} {...s}/></>;
      case 'prev': return <><Path d="M18 6v12L9 12z" {...f}/><Path d="M6 6v12" {...s}/></>;
      case 'next': return <><Path d="M6 6v12l9-6z" {...f}/><Path d="M18 6v12" {...s}/></>;
      case 'check': return <Path d="m5 12.5 4.5 4.5L19 7.5" {...s}/>;
      case 'eink': return <><Rect x={5} y={2.5} width={14} height={19} rx={2.5} {...s}/><Path d="M8.5 7h7M8.5 10.5h7M8.5 14h4" {...s}/></>;
      case 'bookmark': return <Path d="M6.5 3.5h11v17l-5.5-4-5.5 4z" {...s}/>;
      case 'close': return <Path d="M6 6l12 12M18 6 6 18" {...s}/>;
      case 'cloud': return <Path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.6 1.6 3.8 3.8 0 0 1-.5 7.4z" {...s}/>;
      case 'wave': return <Path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" {...s}/>;
      case 'lock': return <><Rect x={5} y={10.5} width={14} height={10} rx={2.5} {...s}/><Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" {...s}/></>;
      case 'speed': return <Path d="M4.5 17a8.5 8.5 0 1 1 15 0M12 13l4-4.5" {...s}/>;
      case 'mic': return <><Rect x={9} y={3} width={6} height={11} rx={3} {...s}/><Path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" {...s}/></>;
      case 'backup': return <Path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.6 1.6 3.8 3.8 0 0 1-.5 7.4M12 11v8M9 14l3-3 3 3" {...s}/>;
      case 'logout': return <Path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14M10 16l-4-4 4-4M6 12h10" {...s}/>;
      case 'flame': return <Path d="M12 21c4 0 6.5-2.6 6.5-6.2 0-3.4-2.4-5.3-3.7-7.8-.7 2-1.8 3-3 3.4.2-3-1-5.9-3.6-7.4.2 3.3-3.7 5.9-3.7 11.2C4.5 18 7.4 21 12 21z" {...s}/>;
      case 'ticket': return <Path d="M3.5 8.5V6h17v2.5a2.5 2.5 0 0 0 0 5V16h-17v-2.5a2.5 2.5 0 0 0 0-5zM14 6v10" {...s}/>;
    }
  })();
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{body}</Svg>;
}
