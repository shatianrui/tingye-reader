// Layout uses logical points; safe-area insets are provided by the native root.
export function readerLayout(width:number) {
 const gutter=width<390?18:22;
 const contentWidth=Math.min(720,Math.max(280,width-gutter*2));
 const columns=width>=700?3:2;
 const shelfPadding=22, gap=18;
 return {gutter,contentWidth,columns,shelfPadding,gap,coverWidth:(width-shelfPadding*2-gap*(columns-1))/columns};
}

// Window dp, rather than device identity, also handles multi-window and rotation.
export function adaptiveReaderLayout(width:number,height:number,margin=22,single=false){
 const gutter=Math.min(margin,Math.max(12,width*.075));
 const available=Math.max(1,width-gutter*2);
 const spread=!single&&available>=620&&height>=420;
 return {gutter,spread,contentWidth:Math.min(spread?1180:680,available),
   widePanel:width>=720,panelWidth:Math.min(440,width),
   controlsWidth:Math.min(720,width),compactHeight:height<500,desktop:width>=1000&&height>=500};
}
export function adaptiveShelfLayout(width:number,fontScale=1){
 const shelfWidth=Math.min(1100,width),padding=16,gap=12;
 const columns=Math.max(2,Math.min(6,Math.floor((shelfWidth-padding*2+gap)/(Math.max(128,112*fontScale)+gap))));
 const cellWidth=(shelfWidth-padding*2-gap*(columns-1))/columns;
 const coverWidth=Math.min(148,cellWidth-8);
 return {shelfWidth,columns,cellWidth,coverWidth,coverHeight:Math.round(coverWidth*1.36),padding,gap};
}
