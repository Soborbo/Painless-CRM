import { stripPII } from '@/lib/sentry/strip-pii';
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  beforeSend(event) {
    if (event.request?.data) event.request.data = stripPII(event.request.data);
    if (event.extra) event.extra = stripPII(event.extra);
    if (event.user) event.user = { id: event.user.id };
    return event;
  },
});
