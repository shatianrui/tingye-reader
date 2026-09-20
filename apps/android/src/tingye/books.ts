import type {BookBlock,BookMark} from './typesetting';
export type Chapter={title:string;text:string;blocks?:BookBlock[];marks?:BookMark[];document?:import('./original-document').OriginalDocument};
export type Book={id:string;title:string;author:string;format:string;chapters:Chapter[];pdf?:string;resources?:Record<string,string>;cover?:string;position?:number;chapter?:number;color?:string;sample?:boolean};
export function sentences(text:string):string[]{return (text.replace(/\r/g,"").match(/[^。！？.!?\n]+[。！？.!?]+[”’」』"]?|[^。！？.!?\n]+(?:\n|$)/g)||[]).map(s=>s.trim()).filter(Boolean).flatMap(s=>s.length>260?(s.match(/.{1,180}(?:[，,；;：:]|$)|.{1,180}/gu)||[s]):[s]);}
export const samples:Book[]=[{id:"sample-guxiang",title:"故乡",author:"鲁迅",format:"示例 · 节选",sample:true,color:"green",chapters:[{title:"归乡",text:`我冒了严寒，回到相隔二千余里，别了二十余年的故乡去。
时候既然是深冬；渐近故乡时，天气又阴晦了，冷风吹进船舱中，呜呜的响，从篷隙向外一望，苍黄的天底下，远近横着几个萧索的荒村，没有一些活气。
我的心禁不住悲凉起来了。
阿！这不是我二十年来时时记得的故乡？
我所记得的故乡全不如此。
我的故乡好得多了。
但要我记起他的美丽，说出他的佳处来，却又没有影像，没有言辞了。
仿佛也就如此。
于是我自己解释说：故乡本也如此，——虽然没有进步，也未必有如我所感的悲凉，这只是我自己心情的改变罢了，因为我这次回乡，本没有什么好心绪。
我这次是专为了别他而来的。
我们多年聚族而居的老屋，已经公同卖给别姓了，交屋的期限，只在本年，所以必须赶在正月初一以前，永别了熟识的老屋，而且远离了熟识的故乡，搬家到我在谋食的异地去。
第二日清早晨我到了我家的门口了。
瓦楞上许多枯草的断茎当风抖着，正在说明这老屋难免易主的原因。
几房的本家大约已经搬走了，所以很寂静。
我到了自家的房外，我的母亲早已迎着出来了，接着便飞出了八岁的侄儿宏儿。
我的母亲很高兴，但也藏着许多凄凉的神情，教我坐下，歇息，喝茶，且不谈搬家的事。
宏儿没有见过我，远远的对面站着只是看。
但我们终于谈到搬家的事。
我说外间的寓所已经租定了，又买了几件家具，此外须将家里所有的木器卖去，再去增添。
母亲也说好，而且行李也略已齐集，木器不便搬运的，也小半卖去了，只是收不起钱来。
你休息一两天，去拜望亲戚本家一回，我们便可以走了。
是的。
还有闰土，他每到我家来时，总问起你，很想见你一回面。
我已经将你到家的大约日期通知他，他也许就要来了。`},{title:"少年闰土",text:`这时候，我的脑里忽然闪出一幅神异的图画来：深蓝的天空中挂着一轮金黄的圆月，下面是海边的沙地，都种着一望无际的碧绿的西瓜，其间有一个十一二岁的少年，项带银圈，手捏一柄钢叉，向一匹猹尽力的刺去，那猹却将身一扭，反从他的胯下逃走了。
这少年便是闰土。
我认识他时，也不过十多岁，离现在将有三十年了。
那时我的父亲还在世，家景也好，我正是一个少爷。
那一年，我家是一件大祭祀的值年。
这祭祀，说是三十多年才能轮到一回，所以很郑重。
正月里供祖像，供品很多，祭器很讲究，拜的人也很多，祭器也很要防偷去。
我家只有一个忙月，忙不过来，他便对父亲说，可以叫他的儿子闰土来管祭器的。
我的父亲允许了；我也很高兴，因为我早听到闰土这名字，而且知道他和我仿佛年纪，闰月生的，五行缺土，所以他的父亲叫他闰土。
他是能装弶捉小鸟雀的。
我于是日日盼望新年，新年到，闰土也就到了。
好容易到了年末，有一日，母亲告诉我，闰土来了，我便飞跑的去看。`},{title:"希望",text:`我在朦胧中，眼前展开一片海边碧绿的沙地来，上面深蓝的天空中挂着一轮金黄的圆月。
我想：希望是本无所谓有，无所谓无的。
这正如地上的路；其实地上本没有路，走的人多了，也便成了路。`}]},{id:"sample-chuntian",title:"春",author:"朱自清",format:"示例 · 节选",sample:true,color:"blue",chapters:[{title:"一切都像刚睡醒的样子",text:`盼望着，盼望着，东风来了，春天的脚步近了。
一切都像刚睡醒的样子，欣欣然张开了眼。
山朗润起来了，水涨起来了，太阳的脸红起来了。
小草偷偷地从土里钻出来，嫩嫩的，绿绿的。
园子里，田野里，瞧去，一大片一大片满是的。
坐着，躺着，打两个滚，踢几脚球，赛几趟跑，捉几回迷藏。
风轻悄悄的，草软绵绵的。
桃树、杏树、梨树，你不让我，我不让你，都开满了花赶趟儿。
红的像火，粉的像霞，白的像雪。
花里带着甜味儿；闭了眼，树上仿佛已经满是桃儿、杏儿、梨儿。
花下成千成百的蜜蜂嗡嗡地闹着，大小的蝴蝶飞来飞去。
野花遍地是：杂样儿，有名字的，没名字的，散在草丛里，像眼睛，像星星，还眨呀眨的。`}]},{id:"sample-stray",title:"飞鸟集",author:"泰戈尔",format:"示例 · 英文节选",sample:true,color:"ochre",chapters:[{title:"Stray Birds",text:`Stray birds of summer come to my window to sing and fly away.
And yellow leaves of autumn, which have no songs, flutter and fall there with a sigh.
O Troupe of little vagrants of the world, leave your footprints in my words.
The world puts off its mask of vastness to its lover.
It becomes small as one song, as one kiss of the eternal.
It is the tears of the earth that keep her smiles in bloom.
The mighty desert is burning for the love of a blade of grass who shakes her head and laughs and flies away.
If you shed tears when you miss the sun, you also miss the stars.
The sands in your way beg for your song and your movement, dancing water.
Will you carry the burden of their lameness?` }]}];
