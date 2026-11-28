import { z } from 'zod';

const CLOUDINARY_URL_PATTERN = /^cloudinary:\/\/([^:@\s]+):([^@\s]+)@([a-z0-9_-]+)$/i;

// Every setting the server needs. The app refuses to start if any required
// value is missing or malformed, so misconfiguration fails loudly at boot.
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('1d'),
    CLIENT_URL: z
      .string()
      .min(1)
      .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),

    // Paystack. Blank = card payments and vendor transfers are switched off (503).
    PAYSTACK_SECRET_KEY: z
      .string()
      .optional()
      .default('')
      .refine((k) => k === '' || /^sk_(test|live)_[A-Za-z0-9]+$/.test(k), 'must look like sk_test_… or sk_live_…'),
    PAYSTACK_PUBLIC_KEY: z.string().optional().default(''),
    PAYSTACK_BASE_URL: z.url().default('https://api.paystack.co'),
    PAYSTACK_CALLBACK_URL: z.union([z.url(), z.literal('')]).default(''), // where Paystack sends the student after paying
    PENDING_PAYMENT_TTL_MINUTES: z.coerce.number().int().min(5).max(24 * 60).default(30),

    // Cloudinary, for stall pickup photos: cloudinary://<api_key>:<api_secret>@<cloud_name>
    CLOUDINARY_URL: z
      .string()
      .optional()
      .default('')
      .refine((u) => u === '' || CLOUDINARY_URL_PATTERN.test(u), 'must be cloudinary://<api_key>:<api_secret>@<cloud_name>'),
  })
  // Safety: live Paystack keys move real money. Only production may use them.
  .refine((e) => e.NODE_ENV === 'production' || !e.PAYSTACK_SECRET_KEY.startsWith('sk_live_'), {
    path: ['PAYSTACK_SECRET_KEY'],
    message: 'a LIVE key is only allowed when NODE_ENV=production — use your sk_test_ key',
  })
  .transform((e) => {
    const m = e.CLOUDINARY_URL.match(CLOUDINARY_URL_PATTERN);
    return {
      ...e,
      cloudinary: m ? { apiKey: m[1], apiSecret: m[2], cloudName: m[3] } : null,
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
