import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { redis, connectRedis } from '../src/config/redis.js';
import { parseEnv } from '../src/config/env.js';

const app = createApp();
const ADMIN_EMAIL = 'bootstrap.admin@phase7.test';
const runNode = (args, env = {}) =>
  spawnSync(process.execPath, args, { env: { ...process.env, ...env }, encoding: 'utf8', timeout: 60_000 });

beforeAll(async () => {
  await connectRedis();
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: '@phase7.test' } } });
  const keys = await redis.keys('rl:*');
  if (keys.length) await redis.del(...keys);
  await prisma.$disconnect();
  await redis.quit();
});

describe('Supabase lock-down', () => {
  it('Row Level Security is ON for every table (direct REST access sees nothing)', async () => {
    const rows = await prisma.$queryRaw`
      SELECT c.relname AS table, c.relrowsecurity AS rls
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'`;
    expect(rows.length).toBeGreaterThan(10);
    const unprotected = rows.filter((r) => !r.rls).map((r) => r.table);
    // If this fails after adding a model: add a migration that runs
    // ALTER TABLE "<Name>" ENABLE ROW LEVEL SECURITY;
    expect(unprotected).toEqual([]);
  });

  it('the API (table owner) still works with RLS on', async () => {
    const res = await request(app).get('/api/catalog');
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBeGreaterThan(0);
  });
});

describe('production-safe seeding', () => {
  it('the sample seed (wipes data, demo logins) refuses to run in production', async () => {
    const before = await prisma.user.count();
    const r = runNode(['prisma/seed.js'], { NODE_ENV: 'production' });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Refusing to run the sample seed in production/);
    expect(await prisma.user.count()).toBe(before);
  });

  it('the reference seed only adds missing rows and never overwrites admin changes', async () => {
    const original = await prisma.product.findUnique({ where: { id: 'sku-rice' } });
    await prisma.product.update({ where: { id: 'sku-rice' }, data: { studentPriceKobo: 555_500 } });
    await prisma.zoneHub.delete({ where: { zoneId_hubId: { zoneId: 'tempsite', hubId: 'aroma-junction' } } });
    const counts = async () => [await prisma.product.count(), await prisma.hub.count(), await prisma.batchSlot.count(), await prisma.user.count()];
    const before = await counts();

    const r = runNode(['prisma/seedReference.js'], { NODE_ENV: 'production' });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Reference seed complete/);
    expect((await prisma.product.findUnique({ where: { id: 'sku-rice' } })).studentPriceKobo).toBe(555_500); // untouched
    expect(await prisma.zoneHub.findUnique({ where: { zoneId_hubId: { zoneId: 'tempsite', hubId: 'aroma-junction' } } })).not.toBeNull(); // re-added
    expect(await counts()).toEqual(before);

    await prisma.product.update({ where: { id: 'sku-rice' }, data: { studentPriceKobo: original.studentPriceKobo } });
  });
});

describe('create-admin script', () => {
  const admin = (env) => runNode(['scripts/createAdmin.js'], { ADMIN_EMAIL, ADMIN_NAME: 'Boot Admin', ...env });

  it.each([
    ['short password', { ADMIN_PASSWORD: 'short' }],
    ['guessable password', { ADMIN_PASSWORD: 'password123456' }],
    ['bad email', { ADMIN_PASSWORD: 'a-strong-pass-123', ADMIN_EMAIL: 'nope' }],
  ])('refuses a %s', (_l, env) => {
    const r = admin(env);
    expect(r.status).toBe(1);
  });

  it('creates an admin who can log in, never prints the password, and can reset it', async () => {
    const r = admin({ ADMIN_PASSWORD: 'first-strong-pass-1' });
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).not.toContain('first-strong-pass-1');
    let login = await request(app).post('/api/auth/login').send({ email: ADMIN_EMAIL, password: 'first-strong-pass-1' });
    expect(login.body.user.role).toBe('ADMIN');

    expect(admin({ ADMIN_PASSWORD: 'second-strong-pass-2' }).stdout).toMatch(/reset password/);
    login = await request(app).post('/api/auth/login').send({ email: ADMIN_EMAIL, password: 'second-strong-pass-2' });
    expect(login.status).toBe(200);
  });

  it('will not turn an existing student into an admin', () => {
    const r = admin({ ADMIN_EMAIL: 'chinedu.unizik@gmail.com', ADMIN_PASSWORD: 'a-strong-pass-123' });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/already exists as a STUDENT/);
  });
});

describe('production configuration guard rails', () => {
  const prod = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://u:p@aws-0-eu-central-1.pooler.supabase.com:5432/postgres',
    DATABASE_SSL: 'require',
    REDIS_URL: 'rediss://default:x@eu1-example.upstash.io:6379',
    JWT_SECRET: 'z'.repeat(96),
    CLIENT_URL: 'https://lodge-mart.vercel.app',
  };
  it('accepts a sensible production config', () => {
    expect(() => parseEnv(prod)).not.toThrow();
  });
  it.each([
    ['http frontend origin', { CLIENT_URL: 'http://lodge-mart.vercel.app' }, /CLIENT_URL/],
    ['unencrypted remote database', { DATABASE_SSL: 'off' }, /DATABASE_SSL/],
    ['short JWT secret', { JWT_SECRET: 'z'.repeat(40) }, /JWT_SECRET/],
    ['verify without a CA certificate', { DATABASE_SSL: 'verify' }, /DATABASE_CA_CERT/],
  ])('refuses %s', (_l, override, msg) => {
    expect(() => parseEnv({ ...prod, ...override })).toThrow(msg);
  });
});
