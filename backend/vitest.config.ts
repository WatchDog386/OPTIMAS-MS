import { defineConfig } from 'vitest/config';

const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgresql://optimas:optimas@localhost:5432/optimas_test?schema=public';

export default defineConfig({
  test: {
    globalSetup: './test/global-setup.ts',
    include: ['test/**/*.test.ts'],
    // One shared database: run files one after another.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DB,
      JWT_SECRET: 'test-secret-test-secret-test-secret',
      PUSH_ENABLED: 'true',
      VAPID_PUBLIC_KEY: 'BPtp-gmJzaaoquyUbijWlfkzT2tbjLjH7I0mW0y_EgeYJVR9gfP3HEXSwE68TdZmuS4qwsWo9QlqfGCWS1R01ZA',
      VAPID_PRIVATE_KEY: 'm5yIJhlReY1-n-Bb58zCILPNRRI7OQJrSEQWK22zR-E',
      VAPID_SUBJECT: 'mailto:test@example.com',
      LOGIN_RATE_LIMIT: '1000',
      API_RATE_LIMIT: '100000',
      UPLOAD_DIR: 'uploads-test',
      OFFICE_LAT: '-1.2921',
      OFFICE_LNG: '36.8219',
      MAX_ROUTERS_IN_CUSTODY: '5',
    },
  },
});
