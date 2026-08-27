import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 300_000,
  expect: { timeout: 260_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'off'
  }
});
