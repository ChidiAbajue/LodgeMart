import { LAGOS_UTC_OFFSET_MINUTES, NO_DELIVERY_WEEKDAYS } from '../config/business.js';

// Which day's batch an order placed `now` joins for a slot: today if we're
// still before the slot's cutoff (Lagos time), otherwise tomorrow; days without
// deliveries (Sunday) roll on to the next delivery day.
// Returns a UTC-midnight Date, suitable for a Postgres DATE column.
export function batchDateFor(slot, now = new Date()) {
  const lagos = new Date(now.getTime() + LAGOS_UTC_OFFSET_MINUTES * 60_000);
  const hhmm = lagos.toISOString().slice(11, 16);
  const day = new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate()));
  if (hhmm >= slot.cutoffTime) day.setUTCDate(day.getUTCDate() + 1);
  while (NO_DELIVERY_WEEKDAYS.includes(day.getUTCDay())) day.setUTCDate(day.getUTCDate() + 1);
  return day;
}

export const toDateString = (date) => date.toISOString().slice(0, 10);

// Has the cutoff for this batch (slot on batchDate) passed, in Lagos time?
// Stall pickups are only allowed after cutoff, so no late order is left behind.
export function isPastCutoff(slot, batchDate, now = new Date()) {
  const lagos = new Date(now.getTime() + LAGOS_UTC_OFFSET_MINUTES * 60_000);
  const today = lagos.toISOString().slice(0, 10);
  const day = toDateString(batchDate);
  if (day !== today) return day < today;
  return lagos.toISOString().slice(11, 16) >= slot.cutoffTime;
}

// "2026-11-28" -> UTC-midnight Date for a Postgres DATE column.
export const fromDateString = (s) => new Date(`${s}T00:00:00Z`);

// The newest batch date of this slot whose cutoff has passed (Lagos time):
// today once the cutoff is past, otherwise yesterday. Batches on or before this
// date have been sent to vendors; later ones are still open to students.
export function latestClosedBatchDate(slot, now = new Date()) {
  const lagos = new Date(now.getTime() + LAGOS_UTC_OFFSET_MINUTES * 60_000);
  const day = new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate()));
  if (lagos.toISOString().slice(11, 16) < slot.cutoffTime) day.setUTCDate(day.getUTCDate() - 1);
  return day;
}
