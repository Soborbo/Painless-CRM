import { defineConfig, devices } from '@playwright/test';

// E2E harness. Unit/integration tests run under Vitest (see vitest.config.ts);
// Playwright owns only `tests/e2e/`, so it never tries to load the Vitest specs.
//
// The suite targets a RUNNING instance, given by E2E_BASE_URL. There is no live
// deploy yet (go-live is infra-gated), so locally and in the default CI job the
// specs SKIP themselves when E2E_BASE_URL is unset — `pnpm test:e2e` is green
// and runnable rather than erroring on a missing config. Point E2E_BASE_URL at a
// Cloudflare preview URL (or a local `pnpm dev`) to actually exercise them.
const baseURL = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
