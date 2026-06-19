// Calendar auth = the Gmail service-account JWT-bearer primitive (ADR-044)
// re-used with the calendar scope. SECURITY-CRITICAL (CLAUDE.md "*/auth.ts"):
// it produces write-capable bearer tokens. We deliberately IMPORT getAccessToken
// from gmail/auth (a DO-NOT-MODIFY */auth.ts) rather than fork it — the only
// delta from Gmail is the scope and that the JWT `sub` is the impersonated
// calendar organiser, not a mailbox. Lifting the shared primitive into a
// neutral integrations/google/auth.ts is a later clean-up that needs sign-off
// (it would move a protected file). See ADR-045.

import { type ServiceAccountCreds, getAccessToken } from '@/lib/integrations/gmail/auth';

// Full read/write calendar scope. The SA must have this added to its
// domain-wide-delegation authorisation in Workspace Admin alongside
// gmail.readonly before live pushes succeed (until then: token_request_failed →
// the client/sync degrade to a typed failure, never throw).
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

export type CalendarCreds = ServiceAccountCreds;

export { getAccessToken };
