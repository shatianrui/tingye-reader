export type ReaderTheme = 'day' | 'night' | 'eyeCare';

export interface ReaderThemeColors {
  background: string;
  text: string;
  secondaryText: string;
  highlight: string; // annotation highlight color (rgba)
  ttsHighlight: string; // current-TTS-sentence highlight color (rgba)
  isDark: boolean;
}

export const readerThemes: Record<ReaderTheme, ReaderThemeColors> = {
  day: {
    background: '#FAF6EE',
    text: '#2B2B2B',
    secondaryText: '#8A8778',
    highlight: 'rgba(61,139,255,0.33)',
    ttsHighlight: 'rgba(255,201,61,0.4)',
    isDark: false,
  },
  night: {
    background: '#121212',
    text: '#9E9E9E',
    secondaryText: '#5C5C5C',
    highlight: 'rgba(61,139,255,0.3)',
    ttsHighlight: 'rgba(199,169,61,0.25)',
    isDark: true,
  },
  eyeCare: {
    background: '#CFE6C8',
    text: '#2E3B2A',
    secondaryText: '#6B7D66',
    highlight: 'rgba(61,139,255,0.33)',
    ttsHighlight: 'rgba(232,179,61,0.4)',
    isDark: false,
  },
};

export const readerThemeOrder: ReaderTheme[] = ['day', 'night', 'eyeCare'];
export const readerThemeLabels: Record<ReaderTheme, string> = {
  day: '日间',
  night: '夜间',
  eyeCare: '护眼',
};
