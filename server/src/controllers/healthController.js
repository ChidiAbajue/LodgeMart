import { prisma } from '../config/prisma.js';
import { redis } from '../config/redis.js';

async function check(fn) {
  try {
    await fn();
    return 'up';
  } catch {
    return 'down';
  }
}

// GET /api/health — public. Reports whether Postgres and Redis are reachable.
export async function getHealth(req, res) {
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
}
