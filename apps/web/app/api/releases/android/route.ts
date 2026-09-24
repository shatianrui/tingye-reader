export function GET(req:Request){
  const origin=new URL(process.env.APP_ORIGIN||req.url).origin;
  return Response.redirect(new URL('/releases/wereader-1.8.0-18001.apk',origin),307);
}
export const HEAD=GET;
