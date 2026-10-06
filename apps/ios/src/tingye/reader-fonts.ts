import {useFonts} from 'expo-font';
export const readerFonts=[{id:'serif',name:'思源宋体',family:'ReaderSerif',detail:'书卷感 · 适合长篇阅读'},{id:'kai',name:'霞鹜文楷',family:'ReaderKai',detail:'清朗温润 · 适合散文'},{id:'system',name:'系统黑体',family:undefined,detail:'简洁清晰 · 跟随设备'}] as const;
// InkBrush (马善政) is the chrome's display face for titles and seals, not a reading font.
export function useReaderFonts(){return useFonts({ReaderSerif:require('../../assets/fonts/NotoSerifCJKsc-Regular.otf'),ReaderKai:require('../../assets/fonts/LXGWWenKaiLite-Regular.ttf'),InkBrush:require('../../assets/fonts/MaShanZheng-Regular.ttf')});}
