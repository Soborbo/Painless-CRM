import { z } from 'zod';

// Phase 11 §5 — complaint schemas. The public feedback form (no auth) and the
// admin status/assignment actions.

// What the customer fills in on /feedback/{token}. Photos deferred (needs the
// Storage bucket — see Phase 09 deferral notes).
export const PublicFeedbackSchema = z.object({
  description: z.string().trim().min(1, 'Please tell us what went wrong').max(4000),
  severity_self_assessed: z.enum(['minor', 'needs_fix', 'major']),
  preferred_resolution: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  contact_method: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type PublicFeedbackInput = z.infer<typeof PublicFeedbackSchema>;

// Admin: advance a complaint's status (and optionally record resolution notes
// or an assignee). Optimistic concurrency via version.
export const ComplaintUpdateSchema = z.object({
  id: z.string().uuid(),
  version: z.coerce.number().int().nonnegative(),
  status: z.enum(['new', 'investigating', 'resolved', 'escalated']),
  resolution_notes: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  assigned_to_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type ComplaintUpdateInput = z.infer<typeof ComplaintUpdateSchema>;
