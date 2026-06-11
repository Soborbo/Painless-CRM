import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Baseline security headers applied to every response. These are all safe with
// React/Next as-is. A strict script-src/style-src CSP needs nonce wiring and is
// deferred to phase 2; the CSP here only adds clickjacking + base-uri/object-src
// hardening (frame-ancestors duplicates X-Frame-Options for modern browsers).
const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  // Worker PWA uses the camera (job photos / vehicle checks) and geolocation;
  // keep those same-origin, deny the rest.
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), geolocation=(self), microphone=(), payment=(), usb=()',
  },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  reactCompiler: true,
  typedRoutes: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'painlessremovals.com' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default withNextIntl(config);
