import { LAGOS_UTC_OFFSET_MINUTES } from '../config/business.js';

// Which day's batch an order placed `now` joins for a slot: today if we're
// still before the slot's cutoff (Lagos time), otherwise tomorrow.
// Returns a UTC-midnight Date, suitable for a Postgres DATE column.
export function batchDateFor(slot, now = new Date()) {
  const lagos = new Date(now.getTime() + LAGOS_UTC_OFFSET_MINUTES * 60_000);
  const hhmm = lagos.toISOString().slice(11, 16);
  const day = new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate()));
  if (hhmm >= slot.cutoffTime) day.setUTCDate(day.getUTCDate() + 1);
  return day;
}

export const toDateString = (date) => date.toISOString().slice(0, 10);
