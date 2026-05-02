const PII_KEYS = new Set([
  'email',
  'phone',
  'phone_number',
  'mobile',
  'first_name',
  'last_name',
  'full_name',
  'name',
  'address',
  'street',
  'city',
  'postcode',
  'postal_code',
  'date_of_birth',
  'dob',
  'national_insurance',
  'company_name',
]);

const REDACTED = '[REDACTED]';

export function stripPII<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripPII(item)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (PII_KEYS.has(key.toLowerCase())) {
      out[key] = REDACTED;
    } else {
      out[key] = stripPII(val);
    }
  }
  return out as T;
}
