import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 4,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:43783',
    headless: true,
    viewport: { width: 1000, height: 800 },
    deviceScaleFactor: 1,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    // Canvas ink bounds differ substantially across engines (especially BiDi).
    // The portable fit contract uses each engine's DOM, not Canvas ink bounds.
    { name: 'firefox', testMatch: '**/fit*.spec.ts', use: { browserName: 'firefox' } },
    { name: 'webkit', testMatch: '**/fit*.spec.ts', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'node scripts/browser-server.ts',
    url: 'http://127.0.0.1:43783',
    reuseExistingServer: false,
  },
});
