import { z } from 'zod';

const email = z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address'));

// bcrypt only uses the first 72 bytes, so longer passwords are rejected rather
// than silently truncated.
const newPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Password is too long (max 72 bytes)');

export const personName = z
  .string()
  .trim()
  .min(2, 'Name is too short')
  .max(80, 'Name is too long')
  .regex(/^\p{L}[\p{L} .'-]*$/u, 'Name can only contain letters, spaces and . \' -');

// Nigerian mobile: 0803xxxxxxx or +234803xxxxxxx
export const nigerianPhone = z
  .string()
  .trim()
  .regex(/^(?:\+234|0)[789][01]\d{8}$/, 'Enter a valid Nigerian phone number');

// .strict() rejects unknown fields — e.g. a client trying to send role: "ADMIN".
export const registerSchema = z.strictObject({
  name: personName,
  email,
  phone: nigerianPhone.optional(),
  password: newPassword,
});

export const loginSchema = z.strictObject({
  email,
  password: z.string().min(1, 'Password is required').max(128),
});
