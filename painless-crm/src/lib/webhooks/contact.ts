import { ContactDetailsSchema, createLeadJob, findOrCreateCustomer } from '@/lib/jobs/intake';
import { z } from 'zod';

// Inbound contact-form webhook from painlessremovals.com.
// Creates (or matches) the customer and opens a `lead` job carrying the
// free-text message in `notes`. Phase 13 automation rules will turn the
// matching `automation_rules.trigger_event = 'lead_created'` into the
// "thanks for getting in touch" email + assignment nudge.

export const IncomingContactSchema = z.object({
  event_id: z.string().min(8).max(120),
  source: z.string().min(1).max(40),
  company_id: z.string().uuid(),
  customer: ContactDetailsSchema,
  message: z.string().trim().max(4000).optional().nullable(),
  preferred_contact: z.enum(['email', 'phone', 'whatsapp']).optional().nullable(),
});

export type IncomingContact = z.infer<typeof IncomingContactSchema>;

export interface IngestContactResult {
  customer_id: string;
  job_id: string;
}

function buildNotes(payload: IncomingContact): string | null {
  const parts: string[] = [];
  if (payload.message?.trim()) parts.push(`Message: ${payload.message.trim()}`);
  if (payload.preferred_contact) parts.push(`Prefers: ${payload.preferred_contact}`);
  if (parts.length === 0) return null;
  return parts.join('\n');
}

export async function ingestContact(
  payload: IncomingContact,
  trustedCompanyId?: string | null,
): Promise<IngestContactResult> {
  // Prefer the server-resolved tenant over the request body (audit H2).
  const companyId = trustedCompanyId ?? payload.company_id;
  const customerId = await findOrCreateCustomer({
    companyId,
    contact: payload.customer,
    source: payload.source,
  });
  const jobId = await createLeadJob({
    companyId,
    customerId,
    source: payload.source,
    notes: buildNotes(payload),
    reason: `Webhook intake: contact (${payload.source})`,
  });
  return { customer_id: customerId, job_id: jobId };
}
