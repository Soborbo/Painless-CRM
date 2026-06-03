import { INVOICE_KINDS, TRIGGER_EVENTS } from '@/lib/comms/automation';
import { JOB_STAGES } from '@/lib/jobs/state-machine';
import { z } from 'zod';

// Phase 13 §5 + Phase 13b (ADR-024) — automation rule form. The send_email
// action is the only wired channel. A rule fires on one trigger event; the
// relevant filter fields depend on that event (the action picks what to store):
//   job.stage_changed → from/to stage (+ service_type for the quote split) and
//     an optional requires_stage dwell-guard for delayed follow-ups.
//   invoice.created / payment.recorded → an optional `kind` filter.
//   job.created → no filters.

const optionalStage = z
  .enum(JOB_STAGES)
  .optional()
  .or(z.literal('').transform(() => undefined));

const optionalKind = z
  .enum(INVOICE_KINDS)
  .optional()
  .or(z.literal('').transform(() => undefined));

const optionalServiceType = z
  .enum(['removal', 'waste_clearance', 'storage'])
  .optional()
  .or(z.literal('').transform(() => undefined));

export const AutomationRuleSchema = z.object({
  id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  name: z.string().trim().min(1, 'Name the rule').max(200),
  trigger_event: z.enum(TRIGGER_EVENTS).default('job.stage_changed'),
  from_stage: optionalStage,
  to_stage: optionalStage,
  service_type: optionalServiceType,
  kind: optionalKind,
  requires_stage: optionalStage,
  delay_minutes: z.coerce.number().int().min(0).max(100_000).default(0),
  template_id: z.string().uuid('Pick an email template'),
  active: z.coerce.boolean().optional().default(true),
});

export type AutomationRuleInput = z.infer<typeof AutomationRuleSchema>;
