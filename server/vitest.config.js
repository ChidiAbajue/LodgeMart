import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// Tests always run against .env.test (separate lodgemart_test database).
const testEnv = parseEnv(readFileSync(new URL('./.env.test', import.meta.url), 'utf8'));

export default defineConfig({
  test: {
    env: testEnv,
    globalSetup: './tests/globalSetup.js',
    fileParallelism: false, // tests share one database
    testTimeout: 15000,
  },
});
