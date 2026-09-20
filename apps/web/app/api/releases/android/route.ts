export function GET(req:Request){return Response.redirect(new URL('/releases/wereader-1.8.0-18001.apk',req.url),307);}
export const HEAD=GET;
