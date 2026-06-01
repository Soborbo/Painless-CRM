import { z } from 'zod';

// Phase 13 §4 — message template schemas (email + SMS). Bodies use {{variable}}
// merge placeholders rendered by lib/comms/render.

const optionalText = z
  .string()
  .trim()
  .max(200)
  .optional()
  .or(z.literal('').transform(() => undefined));

export const EmailTemplateSchema = z.object({
  id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  name: z.string().trim().min(1, 'Name the template').max(200),
  category: optionalText,
  subject_template: z.string().trim().min(1, 'Add a subject').max(500),
  body_template: z.string().trim().min(1, 'Add a body').max(20_000),
  active: z.coerce.boolean().optional().default(true),
});

export type EmailTemplateInput = z.infer<typeof EmailTemplateSchema>;

export const SmsTemplateSchema = z.object({
  id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  name: z.string().trim().min(1, 'Name the template').max(200),
  // SMS segments are short; keep templates well under typical limits.
  body_template: z.string().trim().min(1, 'Add a body').max(1600),
  active: z.coerce.boolean().optional().default(true),
});

export type SmsTemplateInput = z.infer<typeof SmsTemplateSchema>;
