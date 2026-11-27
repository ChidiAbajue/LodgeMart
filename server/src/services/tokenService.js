import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { redis } from '../config/redis.js';
import { serviceUnavailable, unauthenticated } from '../utils/errors.js';

const ALGORITHM = 'HS256';
const revokedKey = (jti) => `auth:revoked:${jti}`;

export function signToken(user) {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, {
    algorithm: ALGORITHM,
    subject: user.id,
    jwtid: randomUUID(),
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

// Returns the decoded payload, or throws 401. Pins the algorithm so a token
// signed with "none" or another algorithm is rejected.
export function verifyToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITHM] });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw unauthenticated('Your session has expired, please log in again', 'TOKEN_EXPIRED');
    }
    throw unauthenticated('Invalid session, please log in again', 'INVALID_TOKEN');
  }
}

// Logout: remember the token id in Redis until the token would have expired anyway.
export async function revokeToken({ jti, exp }) {
  const ttlSeconds = exp - Math.floor(Date.now() / 1000);
  if (ttlSeconds <= 0) return;
  try {
    await redis.set(revokedKey(jti), '1', 'EX', ttlSeconds);
  } catch {
    throw serviceUnavailable();
  }
}

export async function isTokenRevoked(jti) {
  try {
    return (await redis.exists(revokedKey(jti))) === 1;
  } catch {
    // Fail closed: if we can't check revocation, don't accept the token.
    throw serviceUnavailable();
  }
}
