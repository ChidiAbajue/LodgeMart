import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { redis, connectRedis } from '../src/lib/redis.js';

const app = createApp();

beforeAll(async () => {
  await connectRedis();
});
afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

describe('health check', () => {
  it('reports database and redis up', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.services).toEqual({ database: 'up', redis: 'up' });
  });
});

describe('error format', () => {
  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 BAD_JSON for malformed JSON without leaking a stack trace', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_JSON');
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js/);
  });
});

describe('security headers', () => {
  it('sets helmet headers and hides x-powered-by', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });
});

describe('CORS', () => {
  it('allows the configured frontend origin', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('rejects unknown origins', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('env validation', () => {
  const valid = {
    DATABASE_URL: 'postgresql://u:p@localhost:5433/db',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'x'.repeat(32),
    CLIENT_URL: 'http://a.com, http://b.com',
  };

  it('accepts a valid config and splits CLIENT_URL', () => {
    expect(parseEnv(valid).CLIENT_URL).toEqual(['http://a.com', 'http://b.com']);
  });

  it('rejects a missing JWT_SECRET', () => {
    const { JWT_SECRET, ...rest } = valid;
    expect(() => parseEnv(rest)).toThrow(/JWT_SECRET/);
  });

  it('rejects a short JWT_SECRET', () => {
    expect(() => parseEnv({ ...valid, JWT_SECRET: 'short' })).toThrow(/at least 32/);
  });

  it('rejects a missing DATABASE_URL', () => {
    const { DATABASE_URL, ...rest } = valid;
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });
});

describe('seeded data matches the prototype', () => {
  it('has the catalog, vendors, slots and hubs', async () => {
    expect(await prisma.product.count()).toBe(8);
    expect(await prisma.vendor.count()).toBe(3);
    expect(await prisma.batchSlot.count()).toBe(3);
    expect(await prisma.hub.count()).toBe(3);
    const rice = await prisma.product.findUnique({ where: { id: 'sku-rice' } });
    expect(rice.studentPriceKobo).toBe(520000);
  });

  it('has one user per role with bcrypt-hashed passwords (never plaintext)', async () => {
    const users = await prisma.user.findMany();
    expect(new Set(users.map((u) => u.role))).toEqual(new Set(['STUDENT', 'VENDOR', 'RIDER', 'ADMIN']));
    for (const u of users) {
      expect(u.passwordHash).toMatch(/^\$2[aby]\$12\$/);
      expect(u.passwordHash).not.toContain('password123');
    }
    expect(await bcrypt.compare('password123', users[0].passwordHash)).toBe(true);
  });

  it('has order #4082 split across two vendors with correct totals', async () => {
    const order = await prisma.order.findUnique({
      where: { orderNumber: 4082 },
      include: { items: true },
    });
    expect(order.totalKobo).toBe(1445000);
    expect(order.subtotalKobo + order.deliveryFeeKobo).toBe(order.totalKobo);
    expect(order.requiresBagMerge).toBe(true);
    expect(new Set(order.items.map((i) => i.vendorId))).toEqual(new Set(['v-emeka', 'v-ngozi']));
  });

  it('continues order numbers from #4083', async () => {
    const [{ last_value }] = await prisma.$queryRaw`
      SELECT last_value FROM "Order_orderNumber_seq"`;
    expect(Number(last_value)).toBe(4082);
  });
});
