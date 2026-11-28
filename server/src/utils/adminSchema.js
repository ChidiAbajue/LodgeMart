import { z } from 'zod';
import { personName, nigerianPhone } from './authSchema.js';

const email = z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address'));
const date = z.iso.date('Use YYYY-MM-DD');
const text = (max) => z.string().trim().min(1).max(max);
const bankCode = z.string().trim().regex(/^\d{3,6}$/, 'Bank code is 3–6 digits (e.g. 058 GTBank, 50515 Moniepoint)');
const accountNumber = z.string().trim().regex(/^\d{10}$/, 'Account number must be 10 digits (NUBAN)');

export const summaryQuery = z.strictObject({ from: date.optional(), to: date.optional() });

export const adminOrdersQuery = z.strictObject({
  status: z.enum(['PENDING_PAYMENT', 'ORDER_PLACED', 'PACKED_AT_MARKET', 'RIDER_IN_TRANSIT', 'READY_AT_HUB', 'COLLECTED', 'LEFT_AT_KIOSK', 'CANCELLED']).optional(),
  batchDate: date.optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

export const usersQuery = z.strictObject({ role: z.enum(['STUDENT', 'VENDOR', 'RIDER', 'ADMIN']).optional() });

const vendorDetails = z.strictObject({
  stallName: text(80).optional(),
  market: text(80).default('Eke Awka'),
  stallNumber: text(30),
  bankName: text(60),
  bankCode,
  bankAccountNumber: accountNumber,
});

// Admin creates staff accounts. A VENDOR must come with stall + bank details.
export const createStaffSchema = z
  .strictObject({
    role: z.enum(['VENDOR', 'RIDER', 'ADMIN']),
    name: personName,
    email,
    phone: nigerianPhone.optional(),
    password: z.string().min(10, 'Staff passwords must be at least 10 characters').refine((p) => Buffer.byteLength(p) <= 72, 'Password is too long'),
    vendor: vendorDetails.optional(),
  })
  .refine((d) => (d.role === 'VENDOR') === Boolean(d.vendor), {
    path: ['vendor'],
    message: 'Vendor accounts need stall and bank details (and only vendors have them)',
  });

export const userIdParams = z.strictObject({ id: z.uuid('Invalid user id') });
export const vendorIdParams = z.strictObject({ id: text(64) });

export const setActiveSchema = z.strictObject({ isActive: z.boolean() });

export const updateVendorSchema = z
  .strictObject({
    name: text(80).optional(),
    stallNumber: text(30).optional(),
    market: text(80).optional(),
    bankName: text(60).optional(),
    bankCode: bankCode.optional(),
    bankAccountNumber: accountNumber.optional(),
    isActive: z.boolean().optional(),
    priorityTier: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, 'Nothing to update');
