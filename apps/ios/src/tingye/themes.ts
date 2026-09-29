export type ReadingTheme = {
  id:string; name:string; dark:boolean; background:string; surface:string;
  text:string; muted:string; line:string; accent:string; onAccent:string; highlight:string;
  eink?:boolean;
};
export const readingThemes: ReadingTheme[] = [
  {id:'paper',name:'暖纸',dark:false,background:'#F9F6ED',surface:'#FFFEFA',text:'#283C31',muted:'#68746C',line:'#E6E4D9',accent:'#2B5C4B',onAccent:'#FFFFFF',highlight:'#EDDCAF'},
  {id:'eink',name:'电纸书',dark:false,background:'#E8E7E0',surface:'#F1F0E9',text:'#111111',muted:'#555550',line:'#BDBCB5',accent:'#242422',onAccent:'#F7F6EF',highlight:'#C9C8C0',eink:true},
  {id:'white',name:'素白',dark:false,background:'#F2F3F5',surface:'#FFFFFF',text:'#252B33',muted:'#626C7A',line:'#DFE3E8',accent:'#334D68',onAccent:'#FFFFFF',highlight:'#DCE7F4'},
  {id:'sepia',name:'旧书',dark:false,background:'#E8DCC5',surface:'#F3E8D2',text:'#44382B',muted:'#77634C',line:'#D8CAAE',accent:'#755438',onAccent:'#FFFFFF',highlight:'#E1C58D'},
  {id:'sage',name:'竹青',dark:false,background:'#DCE8DC',surface:'#EAF2E5',text:'#283D31',muted:'#5E7563',line:'#CBDCC7',accent:'#365E45',onAccent:'#FFFFFF',highlight:'#CADCAD'},
  {id:'mist',name:'雾蓝',dark:false,background:'#DEE7EE',surface:'#EDF3F7',text:'#283C50',muted:'#61768A',line:'#CDDCE7',accent:'#365D79',onAccent:'#FFFFFF',highlight:'#C9DCEB'},
  {id:'lilac',name:'暮紫',dark:false,background:'#E8E1EF',surface:'#F3EDF7',text:'#44374F',muted:'#7A6685',line:'#DCD0E5',accent:'#6B4D80',onAccent:'#FFFFFF',highlight:'#DFCEEB'},
  {id:'forest',name:'深林',dark:true,background:'#17251F',surface:'#1C2D24',text:'#DDDCCD',muted:'#A2B2A6',line:'#344A3B',accent:'#A8C4AC',onAccent:'#17251F',highlight:'#566446'},
  {id:'ink',name:'墨夜',dark:true,background:'#121214',surface:'#000000',text:'#BABCC0',muted:'#94979E',line:'#2A2D33',accent:'#719CE0',onAccent:'#101A2B',highlight:'#293C58'},
];
export function readingTheme(id?:string, legacyNight=false) {
  return readingThemes.find(theme=>theme.id===id)??readingThemes[legacyNight?7:0];
}
