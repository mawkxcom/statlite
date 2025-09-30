type Stamp = { count: number; resetAt: number };

const ipBuckets = new Map<string, Stamp>();
const anomalyBuckets = new Map<string, Stamp>();

export function checkIpRateLimit(ip: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = ipBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count < limit) {
    bucket.count += 1;
    return true;
  }
  return false;
}

export function getResetMs(ip: string): number {
  const now = Date.now();
  const b = ipBuckets.get(ip);
  return Math.max(0, (b?.resetAt ?? now) - now);
}

// Simple anomaly detection: requests exceeding 5x of normal limit in a window
export function isAnomalous(ip: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = anomalyBuckets.get(ip);
  if (!b || b.resetAt <= now) {
    anomalyBuckets.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }
  b.count += 1;
  return b.count > limit * 5;
}



