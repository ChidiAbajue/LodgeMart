import { z } from 'zod';

const CLOUDINARY_URL_PATTERN = /^cloudinary:\/\/([^:@\s]+):([^@\s]+)@([a-z0-9_-]+)$/i;

// Every setting the server needs. The app refuses to start if any required
// value is missing or malformed, so misconfiguration fails loudly at boot.
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.url(),
    // TLS to the database. Local docker: off. Supabase: "require" (encrypted) or,
    // better, "verify" with DATABASE_CA_CERT = Supabase's CA certificate (PEM text).
    DATABASE_SSL: z.enum(['off', 'require', 'verify']).default('off'),
    DATABASE_CA_CERT: z.string().optional().default(''),
    REDIS_URL: z.url(),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('1d'),
    CLIENT_URL: z
      .string()
      .min(1)
      .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),

    // Monnify (by Moniepoint). Blank = bank transfers, virtual accounts and vendor
    // payouts are switched off (503). Dashboard → Developer → API Keys & Contracts.
    MONNIFY_API_KEY: z
      .string()
      .optional()
      .default('')
      .refine((k) => k === '' || /^MK_(TEST|PROD)_[A-Za-z0-9]+$/.test(k), 'must look like MK_TEST_… or MK_PROD_…'),
    MONNIFY_SECRET_KEY: z.string().optional().default(''),
    MONNIFY_CONTRACT_CODE: z.string().optional().default('').refine((c) => c === '' || /^\d{6,20}$/.test(c), 'must be digits'),
    // Your Monnify wallet account number (Disbursements page): vendor payouts are sent from it.
    MONNIFY_WALLET_ACCOUNT_NUMBER: z.string().optional().default('').refine((a) => a === '' || /^\d{10}$/.test(a), 'must be 10 digits'),
    MONNIFY_BASE_URL: z.url().default('https://sandbox.monnify.com'),
    MONNIFY_REDIRECT_URL: z.union([z.url(), z.literal('')]).default(''), // frontend page after checkout
    PENDING_PAYMENT_TTL_MINUTES: z.coerce.number().int().min(5).max(24 * 60).default(30),

    // Cloudinary, for stall pickup photos: cloudinary://<api_key>:<api_secret>@<cloud_name>
    CLOUDINARY_URL: z
      .string()
      .optional()
      .default('')
      .refine((u) => u === '' || CLOUDINARY_URL_PATTERN.test(u), 'must be cloudinary://<api_key>:<api_secret>@<cloud_name>'),
  })
  .refine((e) => e.DATABASE_SSL !== 'verify' || e.DATABASE_CA_CERT.includes('BEGIN CERTIFICATE'), {
    path: ['DATABASE_CA_CERT'],
    message: 'DATABASE_SSL=verify needs the CA certificate (PEM) in DATABASE_CA_CERT',
  })
  // Production guard rails: refuse obviously unsafe live settings.
  .refine((e) => e.NODE_ENV !== 'production' || e.CLIENT_URL.every((o) => o.startsWith('https://')), {
    path: ['CLIENT_URL'],
    message: 'in production every allowed frontend origin must be https://',
  })
  // Unencrypted is only OK on the same machine or a private network: a host with no dots is a
  // private service name (Render's internal Postgres hostnames look like `dpg-abc123-a`).
  .refine((e) => e.NODE_ENV !== 'production' || e.DATABASE_SSL !== 'off' || /@(localhost|127\.0\.0\.1|[a-z0-9-]+)[:/]/i.test(e.DATABASE_URL), {
    path: ['DATABASE_SSL'],
    message: 'in production a remote database must use DATABASE_SSL=require or verify',
  })
  // ≥ 43 chars: a 256-bit base64 value (Render's generateValue) or ≥ 172 bits of hex.
  .refine((e) => e.NODE_ENV !== 'production' || e.JWT_SECRET.length >= 43, {
    path: ['JWT_SECRET'],
    message: 'in production JWT_SECRET must be at least 43 characters (256-bit random)',
  })
  .refine((e) => e.NODE_ENV !== 'production' || e.CLOUDINARY_URL !== '', {
    path: ['CLOUDINARY_URL'],
    message: 'in production stall photos must be verified: set CLOUDINARY_URL',
  })
  // Monnify: all three credentials together, or none.
  .refine((e) => [e.MONNIFY_API_KEY, e.MONNIFY_SECRET_KEY, e.MONNIFY_CONTRACT_CODE].every((v) => v === '') ||
    [e.MONNIFY_API_KEY, e.MONNIFY_SECRET_KEY, e.MONNIFY_CONTRACT_CODE].every((v) => v !== ''), {
    path: ['MONNIFY_API_KEY'],
    message: 'set MONNIFY_API_KEY, MONNIFY_SECRET_KEY and MONNIFY_CONTRACT_CODE together',
  })
  // Safety: live Monnify keys / the live API move real money. Only production may use them,
  // and a test key must never point at the live API (or the other way round).
  .refine((e) => e.NODE_ENV === 'production' || (!e.MONNIFY_API_KEY.startsWith('MK_PROD_') && !e.MONNIFY_BASE_URL.includes('api.monnify.com')), {
    path: ['MONNIFY_API_KEY'],
    message: 'LIVE Monnify keys/API are only allowed when NODE_ENV=production — use your MK_TEST_ key and the sandbox',
  })
  .refine((e) => !e.MONNIFY_API_KEY || e.MONNIFY_API_KEY.startsWith('MK_PROD_') === e.MONNIFY_BASE_URL.includes('api.monnify.com'), {
    path: ['MONNIFY_BASE_URL'],
    message: 'MK_PROD_ keys go with https://api.monnify.com, MK_TEST_ keys with https://sandbox.monnify.com',
  })
  .transform((e) => {
    const m = e.CLOUDINARY_URL.match(CLOUDINARY_URL_PATTERN);
    return {
      ...e,
      cloudinary: m ? { apiKey: m[1], apiSecret: m[2], cloudName: m[3] } : null,
      monnify: e.MONNIFY_API_KEY
        ? {
            apiKey: e.MONNIFY_API_KEY,
            secretKey: e.MONNIFY_SECRET_KEY,
            contractCode: e.MONNIFY_CONTRACT_CODE,
            walletAccountNumber: e.MONNIFY_WALLET_ACCOUNT_NUMBER,
            baseUrl: e.MONNIFY_BASE_URL.replace(/\/+$/, ''),
            redirectUrl: e.MONNIFY_REDIRECT_URL,
          }
        : null,
    };
  });

export function parseEnv(source) {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    // Messages name the variable but never echo its value (secrets stay out of logs).
    const problems = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}

export const env = parseEnv(process.env);
