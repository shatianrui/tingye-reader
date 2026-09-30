type ByteStream=AsyncIterable<Uint8Array>&{destroy?:()=>void};

export async function readBoundedBody(body:ByteStream,limit:number,contentLength?:number){
 try{
  if(!Number.isSafeInteger(limit)||limit<1)throw new Error('Invalid object size limit');
  if(contentLength!==undefined&&(!Number.isSafeInteger(contentLength)||contentLength<0||contentLength>limit))throw new Error('Backup object exceeds its reserved size');
  const chunks:Uint8Array[]=[];let bytes=0;
  for await(const chunk of body){
   bytes+=chunk.byteLength;
   if(bytes>limit)throw new Error('Backup object exceeds its reserved size');
   chunks.push(chunk);
  }
  return Buffer.concat(chunks,bytes);
 }catch(error){body.destroy?.();throw error;}
}
