import { existsSync } from 'node:fs';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 no longer reads .env itself. Load it for CLI commands (migrate, seed,
// studio). Variables already set in the environment (e.g. by the test setup) win.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js',
  },
  datasource: {
    // CLI only (migrate/seed). On Supabase set MIGRATE_DATABASE_URL to the same
    // database URL with ?sslmode=require; the running app uses DATABASE_URL + DATABASE_SSL.
    url: process.env.MIGRATE_DATABASE_URL || env('DATABASE_URL'),
  },
});
