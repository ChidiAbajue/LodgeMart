import { findActiveUser } from '../services/authService.js';
import { verifyToken, isTokenRevoked } from '../services/tokenService.js';
import { forbidden, notFound, unauthenticated } from '../utils/errors.js';

// Routes reachable without logging in. Everything else under /api needs a
// valid token (secure by default — a new route is protected unless added here).
const PUBLIC_ROUTES = new Set([
  'GET /api/health',
  'POST /api/auth/register',
  'POST /api/auth/login',
  'GET /api/catalog',
]);

function routeKey(req) {
  const path = req.originalUrl.split('?')[0].replace(/\/+$/, '') || '/';
  return `${req.method} ${path}`;
}

export async function authenticate(req, res, next) {
  if (PUBLIC_ROUTES.has(routeKey(req))) return next();

  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthenticated();

  const payload = verifyToken(token);
  if (await isTokenRevoked(payload.jti)) {
    throw unauthenticated('You have been logged out, please log in again', 'TOKEN_REVOKED');
  }

  // Load the user fresh on every request: a disabled account or changed role
  // takes effect immediately, not when the token expires.
  const user = await findActiveUser(payload.sub);
  if (!user) throw unauthenticated('Account not found or disabled', 'INVALID_TOKEN');

  req.user = user;
  req.auth = { jti: payload.jti, exp: payload.exp };
  next();
}

// requireRole('VENDOR') or requireRole('RIDER', 'ADMIN')
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) throw unauthenticated();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };

// Ownership check for a single resource. Answers 404 (not 403) so a student
// can't probe whether someone else's order id exists. Admins may see anything.
export function assertOwnerOrAdmin(user, ownerId) {
  if (user.role === 'ADMIN') return;
  if (!ownerId || ownerId !== user.id) throw notFound();
}
