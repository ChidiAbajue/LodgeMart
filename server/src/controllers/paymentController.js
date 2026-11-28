import { isValidWebhookSignature } from '../services/paystackClient.js';
import { applyPaystackPayment } from '../services/orderService.js';
import { applyTransferEvent } from '../services/payoutService.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// POST /api/payments/paystack/webhook — public, but only accepted with a valid
// Paystack signature over the exact raw body. Answers 200 for anything
// authentic (even events we ignore) so Paystack doesn't keep retrying.
export async function paystackWebhook(req, res) {
  if (!isValidWebhookSignature(req.rawBody, req.get('x-paystack-signature'))) {
    throw new AppError(401, 'INVALID_SIGNATURE', 'Invalid webhook signature');
  }
  const { event, data } = req.body ?? {};
  let result = 'IGNORED';
  if (event === 'charge.success') {
    result = await applyPaystackPayment({
      reference: data?.reference,
      status: data?.status,
      amount: data?.amount,
      currency: data?.currency,
    });
  } else if (typeof event === 'string' && event.startsWith('transfer.')) {
    result = await applyTransferEvent(event, data);
  }
  logger.info({ event, reference: data?.reference, result }, 'Paystack webhook');
  res.json({ received: true });
}
