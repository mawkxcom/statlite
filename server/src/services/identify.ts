import crypto from 'node:crypto';

export function getClientIp(headers: Record<string, string | string[] | undefined>, remoteAddr?: string): string {
  const xff = (headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  const realIp = (headers['x-real-ip'] as string | undefined)?.trim();
  return xff || realIp || remoteAddr || '0.0.0.0';
}

export function computeVisitorId(ip: string, ua: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(ip + '|' + ua);
  return hash.digest('hex').slice(0, 32);
}


