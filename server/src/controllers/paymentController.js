import * as monnify from '../services/monnifyClient.js';
import { applyMonnifyPayment } from '../services/orderService.js';
import { applyWalletFunding } from '../services/walletService.js';
import { applyTransferEvent } from '../services/payoutService.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// POST /api/payments/monnify/webhook — public, but only accepted with a valid
// `monnify-signature` (HMAC-SHA512 of the exact raw body with our secret key).
// As Monnify recommends, money events are then re-checked with Monnify's own
// API before anything changes. Answers 200 for anything authentic (even events
// we ignore) so Monnify doesn't keep retrying.
export async function monnifyWebhook(req, res) {
  if (!monnify.isValidWebhookSignature(req.rawBody, req.get('monnify-signature'))) {
    throw new AppError(401, 'INVALID_SIGNATURE', 'Invalid webhook signature');
  }
  const { eventType, eventData } = req.body ?? {};
  let result = 'IGNORED';

  if (eventType === 'SUCCESSFUL_TRANSACTION' && eventData?.transactionReference) {
    // Re-check with Monnify; never trust the webhook body for amounts alone.
    const tx = await monnify.getTransaction(eventData.transactionReference);
    result = tx.product?.type === 'RESERVED_ACCOUNT' ? await applyWalletFunding(tx) : await applyMonnifyPayment(tx);
  } else if (['SUCCESSFUL_DISBURSEMENT', 'FAILED_DISBURSEMENT', 'REVERSED_DISBURSEMENT'].includes(eventType) && eventData?.reference) {
    const t = await monnify.getTransferStatus(eventData.reference);
    // Act on what Monnify says now, using its status as the event.
    const confirmed = { SUCCESS: 'SUCCESSFUL_DISBURSEMENT', FAILED: 'FAILED_DISBURSEMENT', REVERSED: 'REVERSED_DISBURSEMENT' }[t.status];
    result = confirmed ? await applyTransferEvent(confirmed, { ...eventData, ...t, reference: eventData.reference }) : 'STILL_PROCESSING';
  }
  logger.info({ eventType, result }, 'Monnify webhook');
  res.json({ received: true });
}
