// Phase 06b §3 — phone-number matching for the global search. The spec lists
// "phone numbers" as a search target ("any customer whose phone matches the
// digits of the query"), but a plain ilike fails the moment the typed and
// stored formats differ — "07700 900123" won't substring-match a stored
// "07700900123". These pure helpers let the query strip formatting to bare
// digits so a formatted query still matches a normalised stored number.
//
// This covers the common case (UK numbers stored as clean digits). Full
// bidirectional matching — a *stored* number that itself carries spaces —
// needs a normalised generated column + trigram index, deferred to v0.2.

const PHONE_PUNCTUATION = /^[\d\s+().-]+$/;
const NON_DIGIT = /\D/g;

// Minimum digits before a query is treated as a phone search — short enough to
// match a partial (last 4+ of a number), long enough to avoid firing on stray
// numerals like a house number in an address query.
export const MIN_PHONE_DIGITS = 4;

// Strips everything that isn't a digit. Drops a leading "+" too — matching on
// the national digits is the pragmatic behaviour for a substring search.
export function normalizePhoneDigits(input: string): string {
  return input.replace(NON_DIGIT, '');
}

// A query is "phone-like" when it is made up purely of phone punctuation
// (digits, spaces, +, -, parens, dots) and carries enough digits to be a
// number rather than, say, a postcode fragment. "BS9 4PN" has letters → false;
// "07700 900123" → true.
export function isPhoneLikeQuery(input: string): boolean {
  const trimmed = input.trim();
  if (!PHONE_PUNCTUATION.test(trimmed)) return false;
  return normalizePhoneDigits(trimmed).length >= MIN_PHONE_DIGITS;
}
