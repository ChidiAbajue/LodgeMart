import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './env.js';

// TLS: "verify" checks the server certificate against DATABASE_CA_CERT (best);
// "require" encrypts without checking who answers. Don't also put sslmode=… in
// DATABASE_URL — the URL setting would override this one.
const ssl = {
  off: undefined,
  require: { rejectUnauthorized: false },
  verify: { rejectUnauthorized: true, ca: env.DATABASE_CA_CERT },
}[env.DATABASE_SSL];

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL, ...(ssl && { ssl }) }),
});
