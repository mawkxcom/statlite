import type { RequestHandler } from 'express';
import pino from 'pino';

export const logger = pino({ transport: { target: 'pino-pretty' } });

export function requestLogger(): RequestHandler {
  return (req, res, next) => {
    const start = Date.now();
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
    res.on('finish', () => {
      const ms = Date.now() - start;
      logger.info({ method: req.method, url: req.originalUrl, status: res.statusCode, ms, ip }, 'request');
    });
    next();
  };
}


