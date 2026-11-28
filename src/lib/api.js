// Tiny client for the LodgeMart API (server/). See docs/API.md.
// VITE_API_URL: full API base in production (e.g. https://lodgemart-api.onrender.com/api).
// In local dev it defaults to /api, which vite.config.js proxies to http://localhost:4000.
const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const TOKEN_KEY = 'lm_token';

let token = null;
try {
  token = localStorage.getItem(TOKEN_KEY);
} catch {
  token = null;
}

const listeners = new Set();
/** Called when the server rejects our session (401), so the app can sign out. */
export function onUnauthorized(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setToken(t) {
  token = t || null;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode: session lasts for this tab only */
  }
}
export const hasToken = () => Boolean(token);

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || (status === 0 ? 'Cannot reach LodgeMart right now. Check your connection.' : `Request failed (${status})`));
    this.status = status;
    this.code = body?.error?.code;
    this.details = body?.error?.details;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, null);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (res.status === 401 && token && !path.startsWith('/auth/login')) {
    setToken(null);
    listeners.forEach((fn) => fn());
  }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

// Local development without Cloudinary: the API accepts any https photo URL
// (it refuses to boot in production without CLOUDINARY_URL), so dev builds
// stand in this placeholder. Never compiled into production builds.
const DEV_PLACEHOLDER_PHOTO = 'https://placehold.co/640x480/jpg?text=Dev+stall+photo';

/** Upload a photo straight to Cloudinary with a signature from our API. */
export async function uploadStallPhoto(dataUrl) {
  let sig;
  try {
    sig = await api('/rider/photo-upload-signature');
  } catch (err) {
    if (import.meta.env.DEV && err.code === 'UPLOADS_NOT_CONFIGURED') return DEV_PLACEHOLDER_PHOTO;
    throw err;
  }
  const fd = new FormData();
  Object.entries(sig.fields).forEach(([k, v]) => fd.append(k, v));
  fd.append('file', dataUrl);
  let res;
  try {
    res = await fetch(sig.uploadUrl, { method: 'POST', body: fd });
  } catch {
    throw new ApiError(0, null);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.secure_url) {
    throw new ApiError(res.status, { error: { message: json?.error?.message || 'Photo upload failed, please retake' } });
  }
  return json.secure_url;
}
