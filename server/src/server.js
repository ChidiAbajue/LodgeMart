import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { prisma } from './config/prisma.js';
import { redis, connectRedis } from './config/redis.js';
import { expireStalePendingOrders } from './services/orderService.js';

await prisma.$connect();
await connectRedis();

const server = createApp().listen(env.PORT, () => {
  logger.info(`LodgeMart API listening on http://localhost:${env.PORT}`);
  if (!env.monnify) logger.warn('MONNIFY_* not set: bank transfers, wallet funding and vendor payouts disabled');
  else if (!env.monnify.walletAccountNumber) logger.warn('MONNIFY_WALLET_ACCOUNT_NUMBER not set: vendor payouts disabled');
  if (!env.cloudinary) logger.warn('CLOUDINARY_URL not set: stall photo uploads disabled (any https photoUrl accepted)');
});

// Every minute: unpaid card orders past their TTL give their stock back.
const expiryTimer = setInterval(() => {
  expireStalePendingOrders().catch((err) => logger.error({ err }, 'Pending-order expiry failed'));
}, 60_000);
expiryTimer.unref();

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  clearInterval(expiryTimer);
  server.close();
  await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
