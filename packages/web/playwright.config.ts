import { defineConfig } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:5173';
const isHosted =
  Boolean(process.env.BASE_URL) && !/localhost|127\.0\.0\.1/.test(process.env.BASE_URL);

export default defineConfig({
  testDir: './e2e',
  timeout: isHosted ? 360_000 : 300_000,
  expect: { timeout: isHosted ? 300_000 : 260_000 },
  reporter: 'list',
  use: {
    baseURL,
    trace: 'off'
  }
});
