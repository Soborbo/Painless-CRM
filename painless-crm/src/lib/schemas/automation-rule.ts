import { JOB_STAGES } from '@/lib/jobs/state-machine';
import { z } from 'zod';

// Phase 13 §5 — automation rule form. v1 supports the job.stage_changed trigger
// and the send_email action (the only wired channel); from/to are optional
// stage filters (blank = any).

const optionalStage = z
  .enum(JOB_STAGES)
  .optional()
  .or(z.literal('').transform(() => undefined));

export const AutomationRuleSchema = z.object({
  id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  name: z.string().trim().min(1, 'Name the rule').max(200),
  from_stage: optionalStage,
  to_stage: optionalStage,
  delay_minutes: z.coerce.number().int().min(0).max(100_000).default(0),
  template_id: z.string().uuid('Pick an email template'),
  active: z.coerce.boolean().optional().default(true),
});

export type AutomationRuleInput = z.infer<typeof AutomationRuleSchema>;
