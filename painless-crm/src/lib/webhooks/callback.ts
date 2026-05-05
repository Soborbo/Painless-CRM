import { ContactDetailsSchema, createLeadJob, findOrCreateCustomer } from '@/lib/jobs/intake';
import { z } from 'zod';

// Inbound callback request webhook. The same shape backs both the regular
// callback form and the clearance-callback form on painlessremovals.com — the
// route file picks the `kind` so the audit trail and notes carry the context.

export const CALLBACK_KINDS = ['callback', 'clearance_callback'] as const;
export type CallbackKind = (typeof CALLBACK_KINDS)[number];

export const IncomingCallbackSchema = z.object({
  event_id: z.string().min(8).max(120),
  source: z.string().min(1).max(40),
  company_id: z.string().uuid(),
  kind: z.enum(CALLBACK_KINDS).default('callback'),
  customer: ContactDetailsSchema,
  preferred_window: z.string().trim().max(120).optional().nullable(),
  property_postcode: z.string().min(2).max(12).optional().nullable(),
  message: z.string().trim().max(2000).optional().nullable(),
});

export type IncomingCallback = z.infer<typeof IncomingCallbackSchema>;

export interface IngestCallbackResult {
  customer_id: string;
  job_id: string;
}

function buildNotes(payload: IncomingCallback): string {
  const parts: string[] = [
    `Callback request (${payload.kind === 'clearance_callback' ? 'clearance' : 'standard'})`,
  ];
  if (payload.preferred_window) parts.push(`Preferred window: ${payload.preferred_window}`);
  if (payload.property_postcode) parts.push(`Property postcode: ${payload.property_postcode}`);
  if (payload.message?.trim()) parts.push(`Message: ${payload.message.trim()}`);
  return parts.join('\n');
}

export async function ingestCallback(payload: IncomingCallback): Promise<IngestCallbackResult> {
  const customerId = await findOrCreateCustomer({
    companyId: payload.company_id,
    contact: payload.customer,
    source: payload.source,
  });
  const jobId = await createLeadJob({
    companyId: payload.company_id,
    customerId,
    source: payload.source,
    notes: buildNotes(payload),
    reason: `Webhook intake: ${payload.kind} (${payload.source})`,
  });
  return { customer_id: customerId, job_id: jobId };
}
