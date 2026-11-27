import { redis } from '../config/redis.js';
import { AppError, serviceUnavailable } from '../utils/errors.js';

// Fixed-window rate limiter stored in Redis, so limits hold across restarts and
// across multiple server instances.
//   rateLimit({ name: 'login-ip', max: 30, windowSeconds: 900, key: (req) => req.ip })
export function rateLimit({ name, max, windowSeconds, key }) {
  return async (req, res, next) => {
    const id = key(req);
    if (!id) return next();
    const redisKey = `rl:${name}:${id}`;

    let count, ttlMs;
    try {
      // SET NX starts the window only once; INCR + PTTL in the same transaction.
      const results = await redis
        .multi()
        .set(redisKey, 0, 'PX', windowSeconds * 1000, 'NX')
        .incr(redisKey)
        .pttl(redisKey)
        .exec();
      count = results[1][1];
      ttlMs = results[2][1];
    } catch {
      throw serviceUnavailable(); // fail closed
    }

    res.set('RateLimit-Limit', String(max));
    res.set('RateLimit-Remaining', String(Math.max(0, max - count)));
    if (count > max) {
      const retryAfter = Math.max(1, Math.ceil(ttlMs / 1000));
      res.set('Retry-After', String(retryAfter));
      throw new AppError(429, 'RATE_LIMITED', `Too many attempts, try again in ${retryAfter} seconds`);
    }
    next();
  };
}

// Limits for auth. Per-IP limits are generous because many students share one
// hostel/campus Wi-Fi IP; the per-email login limit is what stops password guessing.
const emailKey = (req) =>
  typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : null;

export const loginLimits = [
  rateLimit({ name: 'login-ip', max: 30, windowSeconds: 15 * 60, key: (req) => req.ip }),
  rateLimit({ name: 'login-email', max: 5, windowSeconds: 15 * 60, key: emailKey }),
];

export const registerLimit = rateLimit({
  name: 'register-ip',
  max: 10,
  windowSeconds: 60 * 60,
  key: (req) => req.ip,
});

// Order writes (place, cancel, delegate) — per logged-in user. Runs after
// authenticate, so req.user is set.
export const orderWriteLimit = rateLimit({
  name: 'order-write',
  max: 20,
  windowSeconds: 10 * 60,
  key: (req) => req.user?.id,
});

// Vendor + rider writes (packing, inventory, pickups, arrivals) — per user.
export const staffWriteLimit = rateLimit({
  name: 'staff-write',
  max: 120,
  windowSeconds: 10 * 60,
  key: (req) => req.user?.id,
});

// PIN handover attempts per rider (wrong PINs are also limited per order —
// see riderService.handover).
export const handoverLimit = rateLimit({
  name: 'handover-rider',
  max: 30,
  windowSeconds: 15 * 60,
  key: (req) => req.user?.id,
});
