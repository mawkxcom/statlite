import { Router } from 'express';
import { db, enqueueWrite } from '../db/pool.js';
import { migrate } from '../db/migrate.js';
import { trackSchema } from '../utils/validator.js';
import { computeVisitorId, getClientIp } from '../services/identify.js';
import { checkIpRateLimit, getResetMs, isAnomalous } from '../services/ratelimit.js';
export const statsRouter = Router();
// Ensure schema exists
migrate();
const trackHandler = (req, res) => {
    const ip = getClientIp(req.headers, req.socket.remoteAddress);
    if (!checkIpRateLimit(ip)) {
        return res.status(429).json({ error: 'Too Many Requests', retryAfterMs: getResetMs(ip) });
    }
    const parsed = trackSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid payload' });
    }
    const { site, page, title } = parsed.data;
    const ua = String(req.headers['user-agent'] || '');
    const visitorId = computeVisitorId(ip, ua);
    const now = Date.now();
    if (isAnomalous(ip)) {
        return res.status(429).json({ error: 'Anomalous traffic' });
    }
    enqueueWrite(() => {
        db.prepare('INSERT OR IGNORE INTO sites(id, created_at) VALUES(?, ?)').run(site, now);
        db.prepare('INSERT INTO visitors(id, ip, ua, first_seen, last_seen) VALUES(?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen').run(visitorId, ip, ua, now, now);
        const recent = db
            .prepare('SELECT 1 FROM page_views WHERE site_id=? AND page_path=? AND visitor_id=? AND created_at>? LIMIT 1')
            .get(site, page, visitorId, now - 30_000);
        if (!recent) {
            db.prepare('INSERT INTO page_views(site_id, page_path, visitor_id, ip, ua, created_at) VALUES(?,?,?,?,?,?)').run(site, page, visitorId, ip, ua, now);
        }
    });
    // Stats snapshot
    const totalPvRow = db.prepare('SELECT COUNT(*) as c FROM page_views WHERE site_id=?').get(site);
    const totalPv = Number(totalPvRow?.c ?? 0);
    const totalUv = db
        .prepare('SELECT COUNT(DISTINCT visitor_id) as c FROM page_views WHERE site_id=?')
        .get(site);
    const totalUvNum = Number(totalUv?.c ?? 0);
    const pagePv = db
        .prepare('SELECT COUNT(*) as c FROM page_views WHERE site_id=? AND page_path=?')
        .get(site, page);
    const pagePvNum = Number(pagePv?.c ?? 0);
    res.json({ ok: true, site, page, title, totalPv, totalUv: totalUvNum, pagePv: pagePvNum });
};
statsRouter.post('/track', trackHandler);
statsRouter.get('/summary', ((req, res) => {
    const site = String(req.query.site || '');
    const page = String(req.query.page || '');
    if (!site)
        return res.status(400).json({ error: 'site required' });
    const totalPvRow2 = db.prepare('SELECT COUNT(*) as c FROM page_views WHERE site_id=?').get(site);
    const totalPv2 = Number(totalPvRow2?.c ?? 0);
    const totalUvRow2 = db
        .prepare('SELECT COUNT(DISTINCT visitor_id) as c FROM page_views WHERE site_id=?')
        .get(site);
    const totalUv2 = Number(totalUvRow2?.c ?? 0);
    const pagePv2 = page
        ? Number(db
            .prepare('SELECT COUNT(*) as c FROM page_views WHERE site_id=? AND page_path=?')
            .get(site, page)?.c ?? 0)
        : undefined;
    res.json({ ok: true, site, totalPv: totalPv2, totalUv: totalUv2, pagePv: pagePv2 });
}));
