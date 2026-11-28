// Create (or reset) the first ADMIN account — the safe way to bootstrap a fresh
// production database, since the sample seed (with demo logins) is refused there.
//
//   ADMIN_EMAIL=ops@yourdomain.ng ADMIN_NAME="Amaka Nwosu" ADMIN_PASSWORD='…' npm run create-admin
//
// The password comes from the environment (never a command-line argument, which
// would end up in shell history) and is never printed.
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

function fail(message) {
  console.error(`create-admin: ${message}`);
  process.exit(1);
}

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const name = (process.env.ADMIN_NAME || '').trim();
const password = process.env.ADMIN_PASSWORD || '';

if (!process.env.DATABASE_URL) fail('DATABASE_URL is not set');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('set ADMIN_EMAIL to a valid email');
if (name.length < 2) fail('set ADMIN_NAME');
if (password.length < 12) fail('ADMIN_PASSWORD must be at least 12 characters');
if (Buffer.byteLength(password) > 72) fail('ADMIN_PASSWORD is too long (max 72 bytes)');
if (/^(password|admin|lodgemart)/i.test(password)) fail('ADMIN_PASSWORD is too easy to guess');

const ssl = process.env.DATABASE_SSL === 'require'
  ? { rejectUnauthorized: false }
  : process.env.DATABASE_SSL === 'verify'
    ? { rejectUnauthorized: true, ca: process.env.DATABASE_CA_CERT }
    : undefined;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ...(ssl && { ssl }) }),
});

try {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (existing && existing.role !== 'ADMIN') fail(`${email} already exists as a ${existing.role}; use another email`);
  await prisma.user.upsert({
    where: { email },
    create: { email, name, passwordHash, role: 'ADMIN' },
    update: { name, passwordHash, isActive: true },
  });
  console.log(`create-admin: ${existing ? 'reset password for' : 'created'} admin ${email}`);
} finally {
  await prisma.$disconnect();
}
