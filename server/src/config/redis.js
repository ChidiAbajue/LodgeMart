import { Redis } from 'ioredis';
import { env } from './env.js';

export const redis = new Redis(env.REDIS_URL, {
  // Fail fast instead of queueing commands forever when Redis is down,
  // so the health check can report it.
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  lazyConnect: true,
});

// Without a listener, ioredis logs unhandled error events on every reconnect.
redis.on('error', () => {});

export async function connectRedis() {
  if (redis.status === 'wait') await redis.connect();
}
