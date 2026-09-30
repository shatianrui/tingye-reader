import {isIP} from 'node:net';

/** Only read the header our ingress overwrites; never fall back to caller headers. */
export function clientIp(req:Request,header=process.env.AUTH_IP_HEADER||(process.env.VERCEL==='1'?'x-vercel-forwarded-for':'x-tingye-client-ip')){
 const value=req.headers.get(header)?.trim();
 return value&&isIP(value)?value:'unknown';
}
