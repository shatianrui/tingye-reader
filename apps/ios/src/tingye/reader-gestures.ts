export function swipePage(start:{x:number;y:number},end:{x:number;y:number}) {
  const dx=end.x-start.x,dy=end.y-start.y;
  return Math.abs(dx)>=50 && Math.abs(dx)>Math.abs(dy)*1.5 ? (dx<0?1:-1) : 0;
}
