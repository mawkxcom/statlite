import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import pino from 'pino';
import { securityHeaders } from './middlewares/security.js';
import path from 'node:path';
import fs from 'node:fs';
import { statsRouter } from './routes/stats.js';
import { requestLogger } from './middlewares/logger.js';

const logger = pino({ transport: { target: 'pino-pretty' } });

const app = express();
app.disable('x-powered-by');

app.use(helmet());
// CORS allowlist from env: STATLITE_CORS_ORIGINS="https://a.com,https://b.com"
const corsEnv = process.env.STATLITE_CORS_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
const corsOptions: cors.CorsOptions = corsEnv.length === 0
  ? { origin: true, credentials: false }
  : { origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const allowed = corsEnv.some(o => origin === o);
      cb(allowed ? null : new Error('CORS not allowed'), allowed);
    }, credentials: false };
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json());
app.use(securityHeaders());
app.use(requestLogger());

// Static assets
let publicDir = process.env.STATLITE_PUBLIC_DIR || '';
if (!publicDir) {
  const candidateRootPublic = path.resolve(process.cwd(), '..', 'public');
  if (fs.existsSync(candidateRootPublic)) {
    publicDir = candidateRootPublic;
  } else {
    publicDir = path.join(process.cwd(), 'public');
  }
}
app.use(express.static(publicDir));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/stats', statsRouter);

function resolvePort(): number {
  const fromEnv = process.env.PORT || process.env.STATLITE_PORT;
  if (fromEnv && /^\d+$/.test(fromEnv)) return Number(fromEnv);
  const arg = process.argv.find(a => a.startsWith('--port='));
  if (arg) {
    const v = arg.split('=')[1];
    if (v && /^\d+$/.test(v)) return Number(v);
  }
  return 8787;
}

const PORT = resolvePort();
app.listen(PORT, () => {
  logger.info(`statlite server listening on :${PORT}`);
});


