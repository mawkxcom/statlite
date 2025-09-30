import { db } from './pool.js';
export function migrate() {
    const schema = `
  CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS visitors (
    id TEXT PRIMARY KEY, -- hash(ip+ua)
    ip TEXT NOT NULL,
    ua TEXT NOT NULL,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id TEXT NOT NULL,
    page_path TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    ip TEXT NOT NULL,
    ua TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (site_id) REFERENCES sites(id)
  );

  CREATE INDEX IF NOT EXISTS idx_page_views_site ON page_views(site_id);
  CREATE INDEX IF NOT EXISTS idx_page_views_site_page ON page_views(site_id, page_path);
  CREATE INDEX IF NOT EXISTS idx_page_views_visitor_time ON page_views(visitor_id, created_at);
  `;
    db.exec(schema);
}
if (process.env.NODE_ENV !== 'test') {
    migrate();
}
