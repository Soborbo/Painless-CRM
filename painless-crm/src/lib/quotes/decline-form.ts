import { z } from 'zod';

// Pure parser for the public decline form. Lives outside the Server Action so
// it can be unit-tested without bootstrapping a request context. The reason
// field is optional and trimmed; whitespace-only input is treated the same as
// "no reason given" so we never persist a blank string.

const Schema = z.object({
  token: z.string().min(10),
  reason: z
    .string()
    .max(500)
    .optional()
    .transform((v) => (v ? v.trim() : '')),
});

export interface ParsedDecline {
  token: string;
  reason: string | null;
}

export type ParseDeclineResult =
  | { ok: true; data: ParsedDecline }
  | { ok: false; reason: 'invalid_token' | 'reason_too_long' };

export function parseDeclineForm(input: { token: unknown; reason: unknown }): ParseDeclineResult {
  const candidate = {
    token: typeof input.token === 'string' ? input.token : '',
    reason: typeof input.reason === 'string' ? input.reason : undefined,
  };
  const parsed = Schema.safeParse(candidate);
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some(
      (issue) => issue.path[0] === 'reason' && issue.code === 'too_big',
    );
    return { ok: false, reason: tooLong ? 'reason_too_long' : 'invalid_token' };
  }
  return {
    ok: true,
    data: { token: parsed.data.token, reason: parsed.data.reason ? parsed.data.reason : null },
  };
}
