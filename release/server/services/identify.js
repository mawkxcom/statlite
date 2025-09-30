import crypto from 'node:crypto';
export function getClientIp(headers, remoteAddr) {
    const xff = headers['x-forwarded-for']?.split(',')[0]?.trim();
    const realIp = headers['x-real-ip']?.trim();
    return xff || realIp || remoteAddr || '0.0.0.0';
}
export function computeVisitorId(ip, ua) {
    const hash = crypto.createHash('sha256');
    hash.update(ip + '|' + ua);
    return hash.digest('hex').slice(0, 32);
}
