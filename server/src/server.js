import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { prisma } from './config/prisma.js';
import { redis, connectRedis } from './config/redis.js';

await prisma.$connect();
await connectRedis();

const server = createApp().listen(env.PORT, () => {
  logger.info(`LodgeMart API listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  server.close();
  await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
