import { stripPII } from '@/lib/sentry/strip-pii';
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  beforeSend(event) {
    if (event.request?.data) event.request.data = stripPII(event.request.data);
    if (event.extra) event.extra = stripPII(event.extra);
    if (event.contexts) event.contexts = stripPII(event.contexts);
    // Breadcrumb payloads can carry PII too (audit) — scrub their data bags.
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((b) =>
        b.data ? { ...b, data: stripPII(b.data) } : b,
      );
    }
    if (event.user) {
      event.user = { id: event.user.id };
    }
    return event;
  },
});
