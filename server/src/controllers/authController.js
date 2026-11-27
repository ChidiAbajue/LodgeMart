import * as authService from '../services/authService.js';
import { revokeToken } from '../services/tokenService.js';

// POST /api/auth/register — public. Creates a STUDENT account and logs them in.
export async function register(req, res) {
  res.status(201).json(await authService.registerStudent(req.body));
}

// POST /api/auth/login — public.
export async function login(req, res) {
  res.json(await authService.login(req.body));
}

// POST /api/auth/logout — revokes the current token.
export async function logout(req, res) {
  await revokeToken(req.auth);
  res.status(204).end();
}

// GET /api/auth/me — the logged-in user's profile.
export function me(req, res) {
  const { isActive, ...user } = req.user; // eslint-disable-line no-unused-vars
  res.json({ user });
}
