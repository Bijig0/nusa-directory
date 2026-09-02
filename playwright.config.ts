import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4321',
    trace: 'retain-on-failure',
    // A preinstalled Chromium can be pointed at with CHROME_PATH (e.g. /opt/pw-browsers/chromium-*/chrome-linux/chrome).
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'bun run dev',
        url: 'http://localhost:4321/',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
