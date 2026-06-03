import { z } from 'zod';

// Phase 25a — custom job fields as config-as-data (ADR-034). Admins define a
// small set of extra fields (the "defs", stored on settings.custom_field_defs);
// each job carries a {key: value} map (jobs.custom_fields). Everything here is
// pure: def validation and value coercion-against-defs, validated by zod at read
// so a malformed stored config degrades gracefully instead of crashing a page.

export const CUSTOM_FIELD_TYPES = ['text', 'number', 'select', 'checkbox'] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const MAX_DEFS = 50;
const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;

export const CustomFieldDefSchema = z
  .object({
    key: z.string().regex(KEY_RE, { message: 'Key must be lower_snake_case (start with a letter)' }),
    label: z.string().trim().min(1, { message: 'Label is required' }).max(80),
    type: z.enum(CUSTOM_FIELD_TYPES),
    options: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    required: z.boolean().optional(),
  })
  .superRefine((def, ctx) => {
    if (def.type === 'select' && (!def.options || def.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A select field needs at least one option',
        path: ['options'],
      });
    }
  });

export type CustomFieldDef = z.infer<typeof CustomFieldDefSchema>;

// Resilient read: keep each individually-valid def, drop malformed ones, and
// de-duplicate by key (first wins). Never throws — a bad stored config yields
// fewer fields, not a crashed job page.
export function parseDefs(raw: unknown): CustomFieldDef[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomFieldDef[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const parsed = CustomFieldDefSchema.safeParse(item);
    if (!parsed.success) continue;
    if (seen.has(parsed.data.key)) continue;
    seen.add(parsed.data.key);
    out.push(parsed.data);
    if (out.length >= MAX_DEFS) break;
  }
  return out;
}

export interface ValueResult {
  values: Record<string, string | number | boolean>;
  errors: Record<string, string>;
}

// Coerce a raw {key: string} form map against the defs into typed values, with
// per-field errors. Unknown keys are ignored (only defined fields are stored).
export function validateValues(
  defs: readonly CustomFieldDef[],
  input: Record<string, string>,
): ValueResult {
  const values: ValueResult['values'] = {};
  const errors: ValueResult['errors'] = {};

  for (const def of defs) {
    const raw = (input[def.key] ?? '').trim();

    if (def.type === 'checkbox') {
      values[def.key] = raw === 'on' || raw === 'true';
      continue;
    }

    if (raw === '') {
      if (def.required) errors[def.key] = `${def.label} is required`;
      continue; // omit empty optional values
    }

    if (def.type === 'number') {
      const n = Number(raw);
      if (!Number.isFinite(n)) errors[def.key] = `${def.label} must be a number`;
      else values[def.key] = n;
      continue;
    }

    if (def.type === 'select') {
      if (!def.options?.includes(raw)) errors[def.key] = `${def.label}: not a valid option`;
      else values[def.key] = raw;
      continue;
    }

    values[def.key] = raw; // text
  }

  return { values, errors };
}

// Read a stored values map (jsonb) into a plain {key: string} for display/edit.
export function readValues(raw: unknown): Record<string, string | number | boolean> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  }
  return out;
}
