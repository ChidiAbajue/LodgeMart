import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

export const healthRouter = Router();

async function check(fn) {
  try {
    await fn();
    return 'up';
  } catch {
    return 'down';
  }
}

healthRouter.get('/', async (req, res) => {
  const [database, cache] = await Promise.all([
    check(() => prisma.$queryRaw`SELECT 1`),
    check(() => redis.ping()),
  ]);
  const ok = database === 'up' && cache === 'up';
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    services: { database, redis: cache },
    time: new Date().toISOString(),
  });
});
