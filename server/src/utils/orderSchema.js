import { z } from 'zod';
import { personName, nigerianPhone } from './authSchema.js';

const id = z.string().trim().min(1).max(64);

// Note what is NOT here: prices, totals, PINs, status, vendor ids. The server
// decides all of those; strictObject rejects them if a client sends them.
export const createOrderSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        productId: id,
        qty: z.number().int().min(1, 'Quantity must be at least 1').max(50, 'Maximum 50 per item'),
      }),
    )
    .min(1, 'Your basket is empty')
    .max(20, 'Maximum 20 different items per order')
    .refine((items) => new Set(items.map((i) => i.productId)).size === items.length, {
      message: 'Each product can only appear once — combine the quantities',
    }),
  zoneId: id,
  hubId: id,
  batchSlotId: id,
  paymentMethod: z.enum(['WALLET'], {
    error: 'Only WALLET payment is available for now (Paystack is coming)',
  }),
});

export const delegateSchema = z.strictObject({
  name: personName,
  phone: nigerianPhone,
});

export const orderIdParams = z.strictObject({
  id: z.uuid('Invalid order id'),
});
