import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { hashPassword, verifyPassword, burnPasswordCheck } from '../utils/password.js';
import { signToken } from './tokenService.js';

// The only user fields ever sent to the client. passwordHash is never selected.
export const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  isActive: true,
  walletBalanceKobo: true,
  defaultZoneId: true,
  defaultHubId: true,
  vendorId: true,
  createdAt: true,
};

const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

function session(user) {
  const { isActive, ...publicUser } = user; // eslint-disable-line no-unused-vars
  return { token: signToken(user), tokenType: 'Bearer', user: publicUser };
}

// Public sign-up creates STUDENT accounts only. Vendor, rider and admin
// accounts are created by an admin (Phase 6), never by self-registration.
export async function registerStudent({ name, email, phone, password }) {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');

  try {
    const user = await prisma.user.create({
      data: { name, email, phone, passwordHash: await hashPassword(password), role: 'STUDENT' },
      select: publicUserSelect,
    });
    return session(user);
  } catch (err) {
    // Two sign-ups with the same email at the same moment: unique constraint wins.
    if (err?.code === 'P2002') {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    }
    throw err;
  }
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { ...publicUserSelect, passwordHash: true },
  });
  if (!user) {
    await burnPasswordCheck(password);
    throw invalidCredentials();
  }
  const { passwordHash, ...rest } = user;
  if (!(await verifyPassword(password, passwordHash))) throw invalidCredentials();
  if (!rest.isActive) throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
  return session(rest);
}

export function findActiveUser(id) {
  return prisma.user.findFirst({ where: { id, isActive: true }, select: publicUserSelect });
}
