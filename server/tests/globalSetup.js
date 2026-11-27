import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// Before the test run: bring the TEST database schema up to date (additive only,
// never drops anything) and reload the sample data rows.
export default function setup() {
  const testEnv = parseEnv(readFileSync(new URL('../.env.test', import.meta.url), 'utf8'));
  const dbName = new URL(testEnv.DATABASE_URL).pathname.slice(1);
  if (dbName !== 'lodgemart_test') {
    throw new Error(`Refusing to seed: .env.test points at "${dbName}", not lodgemart_test`);
  }
  const opts = { stdio: 'pipe', env: { ...process.env, ...testEnv } };
  execSync('npx prisma migrate deploy', opts);
  execSync('node prisma/seed.js', opts);
}
