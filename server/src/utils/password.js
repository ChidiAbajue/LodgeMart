import bcrypt from 'bcryptjs';

export const BCRYPT_ROUNDS = 12;

export const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);

export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

// Used when the email doesn't exist, so a failed login takes the same time
// whether or not the account exists (stops email enumeration by timing).
let dummyHash;
export async function burnPasswordCheck(plain) {
  dummyHash ??= await bcrypt.hash('lodgemart-timing-equaliser', BCRYPT_ROUNDS);
  await bcrypt.compare(plain, dummyHash);
}
