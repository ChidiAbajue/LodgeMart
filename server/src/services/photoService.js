import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

// Stall pickup photos go straight from the rider's phone to Cloudinary (the API
// never handles image bytes). The server hands out a short-lived SIGNED upload
// permission; the Cloudinary API secret never leaves the server. The api_key
// and cloud name are public identifiers that Cloudinary requires the client to send.

export const PICKUP_PHOTO_FOLDER = 'lodgemart/stall-pickups';

function config() {
  if (!env.cloudinary) {
    throw new AppError(503, 'UPLOADS_NOT_CONFIGURED', 'Photo uploads are not available right now');
  }
  return env.cloudinary;
}

// Cloudinary signature: SHA-1 of the alphabetically sorted params + api secret.
export function signParams(params, apiSecret) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1').update(toSign + apiSecret).digest('hex');
}

export function createPickupUploadSignature(now = Date.now()) {
  const { apiKey, apiSecret, cloudName } = config();
  const params = {
    folder: PICKUP_PHOTO_FOLDER,
    timestamp: Math.floor(now / 1000), // Cloudinary rejects signatures older than 1 hour
    allowed_formats: 'jpg,jpeg,png,webp,heic',
  };
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    fields: { ...params, api_key: apiKey, signature: signParams(params, apiSecret) },
  };
}

// A stall pickup must reference a photo in OUR Cloudinary account and folder.
// Without Cloudinary configured (local dev), any https URL is accepted.
export function assertPickupPhotoUrl(photoUrl) {
  if (!env.cloudinary) return;
  const prefix = `https://res.cloudinary.com/${env.cloudinary.cloudName}/image/upload/`;
  let ok = false;
  try {
    const u = new URL(photoUrl);
    ok = `${u.origin}${u.pathname}`.startsWith(prefix) && u.pathname.includes(`/${PICKUP_PHOTO_FOLDER}/`);
  } catch {
    ok = false;
  }
  if (!ok) {
    throw new AppError(400, 'INVALID_PHOTO', 'Upload the stall photo first, then send the URL Cloudinary returned');
  }
}
