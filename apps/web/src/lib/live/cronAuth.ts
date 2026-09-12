import { timingSafeEqual } from 'node:crypto';
export function authorized(request: {headers: Headers}): boolean {
  const secret=process.env.CRON_SECRET, actual=request.headers.get('authorization');
  if(!secret||!actual)return false;
  const a=Buffer.from(actual),b=Buffer.from(`Bearer ${secret}`);
  return a.length===b.length&&timingSafeEqual(a,b);
}
export function internalHeaders(){
  if(!process.env.CRON_SECRET)throw new Error('CRON_SECRET não configurado');
  return {Authorization:`Bearer ${process.env.CRON_SECRET}`,'Cache-Control':'no-cache'};
}
