export type ReadingTheme = {
  id:string; name:string; dark:boolean; background:string; surface:string;
  text:string; muted:string; line:string; accent:string; onAccent:string; highlight:string;
  eink?:boolean;
};
// Ink-wash paper colours. The ids are persisted in reader preferences, so they
// keep their original keys (sage = 烟雨, forest = 夜墨 …) and saved choices map
// onto the new palette without a migration. `surface` is the page itself and
// `background` the menus and panels around it. Accent is cinnabar (朱砂).
export const readingThemes: ReadingTheme[] = [
  {id:'paper',name:'宣纸',dark:false,background:'#F8F4EB',surface:'#F4EFE4',text:'#1F1E1B',muted:'#6B6862',line:'#DCD3C1',accent:'#A83226',onAccent:'#F6F0E4',highlight:'#E7DCC4'},
  {id:'eink',name:'电纸书',dark:false,background:'#E8E7E0',surface:'#F1F0E9',text:'#111111',muted:'#555550',line:'#BDBCB5',accent:'#242422',onAccent:'#F7F6EF',highlight:'#C9C8C0',eink:true},
  {id:'white',name:'素绢',dark:false,background:'#F6F4EF',surface:'#FBF9F4',text:'#25231F',muted:'#67635B',line:'#DEDAD0',accent:'#A83226',onAccent:'#F6F0E4',highlight:'#E9E1CF'},
  {id:'sepia',name:'古卷',dark:false,background:'#DFD1B5',surface:'#E6D9BF',text:'#3E3427',muted:'#66573F',line:'#D2C3A4',accent:'#9A3A26',onAccent:'#F6F0E4',highlight:'#D6C092'},
  {id:'sage',name:'烟雨',dark:false,background:'#DCDCD8',surface:'#E2E2DE',text:'#2B2C2B',muted:'#5C5D5A',line:'#CCCCC6',accent:'#A13328',onAccent:'#F6F0E4',highlight:'#CFCBC0'},
  {id:'mist',name:'黛蓝',dark:false,background:'#D5DBE3',surface:'#DCE1E8',text:'#25303D',muted:'#56606E',line:'#C7CFDA',accent:'#A13328',onAccent:'#F6F0E4',highlight:'#C3CDDA'},
  {id:'lilac',name:'藕荷',dark:false,background:'#E3D6D8',surface:'#EADFE0',text:'#3C2F31',muted:'#6A5A5D',line:'#D9C9CB',accent:'#9E3326',onAccent:'#F6F0E4',highlight:'#DCC7C9'},
  {id:'forest',name:'夜墨',dark:true,background:'#1C1B17',surface:'#15140F',text:'#D9D2C2',muted:'#A39D90',line:'#3A3832',accent:'#D9705F',onAccent:'#1C1B17',highlight:'#4A3B2E'},
  {id:'ink',name:'玄夜',dark:true,background:'#151517',surface:'#0E0E10',text:'#B9B6AE',muted:'#8F8C85',line:'#2A2A2E',accent:'#D9705F',onAccent:'#151517',highlight:'#3A2A28'},
];
export function readingTheme(id?:string, legacyNight=false) {
  return readingThemes.find(theme=>theme.id===id)??readingThemes[legacyNight?7:0];
}
