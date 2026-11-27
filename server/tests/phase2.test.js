import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { redis, connectRedis } from '../src/config/redis.js';
import { requireRole, assertOwnerOrAdmin } from '../src/middleware/authMiddleware.js';

const app = createApp();
const PASSWORD = 'password123';
const TEST_DOMAIN = '@phase2.test';
const SEEDED = {
  STUDENT: 'chinedu.unizik@gmail.com',
  VENDOR: 'ogaemeka@lodgemart.ng',
  RIDER: 'tunde.dispatch@lodgemart.ng',
  ADMIN: 'ops@lodgemart.ng',
};

async function loginAs(email, password = PASSWORD) {
  return request(app).post('/api/auth/login').send({ email, password });
}

async function clearRateLimits() {
  const keys = await redis.keys('rl:*');
  if (keys.length) await redis.del(...keys);
}

beforeAll(async () => {
  // Safety: tests flush keys, so they must be on the test Redis DB (index 1).
  if (!process.env.REDIS_URL.endsWith('/1')) throw new Error('Tests must use Redis DB 1');
  await connectRedis();
});
beforeEach(clearRateLimits);
afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
  await clearRateLimits();
  await prisma.$disconnect();
  await redis.quit();
});

describe('register', () => {
  const body = { name: 'Ada Obi', email: `ada${TEST_DOMAIN}`, phone: '08031234567', password: 'longenough1' };

  it('creates a STUDENT, hashes the password with bcrypt cost 12, returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send(body);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toMatchObject({ email: body.email, role: 'STUDENT', name: 'Ada Obi' });
    expect(res.body.user.passwordHash).toBeUndefined();

    const row = await prisma.user.findUnique({ where: { email: body.email } });
    expect(row.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(row.passwordHash).not.toContain(body.password);
  });

  it('rejects a duplicate email (case/whitespace-insensitive) with 409', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...body, email: `  ADA${TEST_DOMAIN.toUpperCase()} ` });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects role escalation: unknown fields like role are refused', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...body, email: `sneaky${TEST_DOMAIN}`, role: 'ADMIN' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.user.findUnique({ where: { email: `sneaky${TEST_DOMAIN}` } })).toBeNull();
  });

  it.each([
    ['short password', { password: 'short' }],
    ['password over 72 bytes', { password: 'x'.repeat(73) }],
    ['bad email', { email: 'not-an-email' }],
    ['bad phone', { phone: '12345' }],
    ['HTML in name', { name: '<script>alert(1)</script>' }],
  ])('rejects %s', async (_label, override) => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...body, email: `v${Math.random()}${TEST_DOMAIN}`, ...override });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('never echoes the password back in validation errors', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...body, email: 'bad', password: 'SuperSecretValue' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('SuperSecretValue');
  });
});

describe('login', () => {
  it.each(Object.entries(SEEDED))('logs in the seeded %s', async (role, email) => {
    const res = await loginAs(email);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe(role);
    expect(res.body.user.passwordHash).toBeUndefined();
    const decoded = jwt.decode(res.body.token, { complete: true });
    expect(decoded.header.alg).toBe('HS256');
    expect(decoded.payload).toMatchObject({ sub: res.body.user.id, role });
    expect(decoded.payload.jti).toBeTruthy();
    expect(decoded.payload.exp).toBeGreaterThan(decoded.payload.iat);
  });

  it('gives the same error for wrong password and unknown email (no enumeration)', async () => {
    const wrong = await loginAs(SEEDED.STUDENT, 'wrong-password');
    const unknown = await loginAs(`nobody${TEST_DOMAIN}`);
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('refuses a disabled account', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Gone User', email: `gone${TEST_DOMAIN}`, password: 'longenough1' });
    await prisma.user.update({ where: { email: `gone${TEST_DOMAIN}` }, data: { isActive: false } });
    const res = await loginAs(`gone${TEST_DOMAIN}`, 'longenough1');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });
});

describe('authentication on protected routes', () => {
  it('GET /me returns the logged-in user', async () => {
    const { body } = await loginAs(SEEDED.STUDENT);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: SEEDED.STUDENT, role: 'STUDENT', walletBalanceKobo: 5_000_000 }); // ₦50,000
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('requires a token (secure by default, incl. unknown /api routes)', async () => {
    for (const [method, path] of [['get', '/api/auth/me'], ['post', '/api/auth/logout'], ['get', '/api/does-not-exist']]) {
      const res = await request(app)[method](path);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('returns 404 for unknown /api routes once logged in', async () => {
    const { body } = await loginAs(SEEDED.STUDENT);
    const res = await request(app).get('/api/does-not-exist').set('Authorization', `Bearer ${body.token}`);
    expect(res.status).toBe(404);
  });

  it('rejects a tampered token', async () => {
    const { body } = await loginAs(SEEDED.STUDENT);
    const [h, p, s] = body.token.split('.');
    const payload = JSON.parse(Buffer.from(p, 'base64url'));
    const forged = Buffer.from(JSON.stringify({ ...payload, role: 'ADMIN' })).toString('base64url');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${h}.${forged}.${s}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects an unsigned alg=none token', async () => {
    const user = await prisma.user.findUnique({ where: { email: SEEDED.ADMIN } });
    const none = jwt.sign({ role: 'ADMIN', jti: 'x' }, null, { algorithm: 'none', subject: user.id });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${none}`);
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const user = await prisma.user.findUnique({ where: { email: SEEDED.STUDENT } });
    const expired = jwt.sign({ role: 'STUDENT' }, process.env.JWT_SECRET, {
      subject: user.id, jwtid: 'expired-test', expiresIn: -10,
    });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('a disabled account loses access immediately, even with a valid token', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Soon Gone', email: `soongone${TEST_DOMAIN}`, password: 'longenough1' });
    await prisma.user.update({ where: { email: `soongone${TEST_DOMAIN}` }, data: { isActive: false } });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${reg.body.token}`);
    expect(res.status).toBe(401);
  });
});

describe('logout', () => {
  it('revokes the token in Redis; other sessions stay valid', async () => {
    const a = (await loginAs(SEEDED.RIDER)).body.token;
    const b = (await loginAs(SEEDED.RIDER)).body.token;
    const out = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${a}`);
    expect(out.status).toBe(204);

    const reused = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${a}`);
    expect(reused.status).toBe(401);
    expect(reused.body.error.code).toBe('TOKEN_REVOKED');

    const other = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${b}`);
    expect(other.status).toBe(200);

    const { jti, exp } = jwt.decode(a);
    const ttl = await redis.ttl(`auth:revoked:${jti}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(exp - Math.floor(Date.now() / 1000) + 1);
  });
});

describe('rate limiting', () => {
  it('locks an email after 5 login attempts in 15 minutes', async () => {
    for (let i = 0; i < 5; i++) expect((await loginAs(SEEDED.VENDOR, 'wrong')).status).toBe(401);
    const blocked = await loginAs(SEEDED.VENDOR); // even the right password
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    // Different email is unaffected
    expect((await loginAs(SEEDED.ADMIN)).status).toBe(200);
  });

  it('counts the email limit case-insensitively', async () => {
    for (let i = 0; i < 5; i++) await loginAs(SEEDED.VENDOR.toUpperCase(), 'wrong');
    expect((await loginAs(SEEDED.VENDOR)).status).toBe(429);
  });

  it('limits registrations per IP', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app).post('/api/auth/register').send({ name: 'Rate Test', email: 'bad' });
    }
    const res = await request(app).post('/api/auth/register').send({ name: 'Rate Test', email: 'bad' });
    expect(res.status).toBe(429);
  });
});

describe('role and ownership helpers', () => {
  const run = (mw, user) => {
    try {
      mw({ user }, {}, () => {});
      return 'ok';
    } catch (e) {
      return e.status;
    }
  };

  it('requireRole allows listed roles and blocks others with 403', () => {
    expect(run(requireRole('VENDOR'), { role: 'VENDOR' })).toBe('ok');
    expect(run(requireRole('RIDER', 'ADMIN'), { role: 'ADMIN' })).toBe('ok');
    expect(run(requireRole('ADMIN'), { role: 'STUDENT' })).toBe(403);
    expect(run(requireRole('ADMIN'), undefined)).toBe(401);
  });

  it('assertOwnerOrAdmin hides other users\' resources as 404', () => {
    const me = { id: 'u1', role: 'STUDENT' };
    expect(() => assertOwnerOrAdmin(me, 'u1')).not.toThrow();
    expect(() => assertOwnerOrAdmin(me, 'u2')).toThrow(expect.objectContaining({ status: 404 }));
    expect(() => assertOwnerOrAdmin({ id: 'a', role: 'ADMIN' }, 'u2')).not.toThrow();
  });
});

