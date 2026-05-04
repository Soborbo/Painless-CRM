import { type QuoteInput, QuoteInputSchema } from '@/lib/schemas/pricing';

// Pure FormData → QuoteInput coercion. Lives outside the 'use server' module
// so it can be unit-tested without spinning up an action server.

export function parseSimulationForm(
  form: FormData,
): { ok: true; input: QuoteInput } | { ok: false; message: string } {
  const complications = form.getAll('complications').flatMap((v) =>
    typeof v === 'string'
      ? v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  );
  const source = form.get('source');
  const parsed = QuoteInputSchema.safeParse({
    size_code: form.get('size_code'),
    distance_miles: Number(form.get('distance_miles')),
    complications,
    source: typeof source === 'string' && source.length > 0 ? source : undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  return { ok: true, input: parsed.data };
}
