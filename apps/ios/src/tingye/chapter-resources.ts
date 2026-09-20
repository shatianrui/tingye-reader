import type {Chapter} from './books';

/** Only materialize references belonging to this chapter, never arbitrary file URLs. */
export async function chapterResources(chapter:Chapter, resources:Record<string,string>, write:(name:string,base64:string)=>Promise<string>){
 const result:Record<string,string>={};
 const refs=new Set(((chapter.document?.html||'')+'\n'+(chapter.document?.css||'')).match(/tingye-resource:r\d+/g)||[]);
 for(const ref of refs){
  const id=ref.slice('tingye-resource:'.length),data=resources[id];
  const m=data?.match(/^data:(image\/(?:png|jpeg|gif|webp|avif|svg\+xml)|font\/(?:ttf|otf|woff2?|opentype|truetype));base64,([a-z\d+/=\s]+)$/i);
  if(!m)continue;
  const ext=m[1].split('/')[1].replace('svg+xml','svg').replace('jpeg','jpg').replace('opentype','otf').replace('truetype','ttf');
  result[id]=await write(`${id}.${ext}`,m[2].replace(/\s/g,''));
 }
 return result;
}
