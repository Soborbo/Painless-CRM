import { expect, test } from '@playwright/test';

// Deploy-gated smoke suite. Skips entirely unless E2E_BASE_URL points at a
// running instance (local `pnpm dev` or a Cloudflare preview). This is the
// thin first layer of the manual-QA / live-E2E gap documented in VERIFICATION.md
// — it asserts the things that can only be checked against a real server:
// routing, auth redirect, security headers, and graceful public-page handling.
const BASE = process.env.E2E_BASE_URL;

test.describe('smoke (live instance)', () => {
  test.skip(!BASE, 'Set E2E_BASE_URL to a running instance to run live smoke tests');

  test('unauthenticated dashboard redirects to sign-in', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/sign-in|login|auth/i);
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
  });

  test('baseline security headers are present', async ({ request }) => {
    const res = await request.get('/');
    const headers = res.headers();
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    // poweredByHeader is disabled — Next must not advertise itself.
    expect(headers['x-powered-by']).toBeUndefined();
  });

  test('malformed public quote link shows a graceful message, not a 500', async ({ page }) => {
    const res = await page.goto('/quote/not-a-real-token');
    expect(res?.status() ?? 200).toBeLessThan(500);
    await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error/i);
  });

  test('public pages are noindex (no customer data leaks to search)', async ({ request }) => {
    const res = await request.get('/quote/not-a-real-token');
    const robots = res.headers()['x-robots-tag'] ?? '';
    const body = await res.text();
    const metaNoindex = /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(body);
    expect(robots.includes('noindex') || metaNoindex).toBeTruthy();
  });
});
