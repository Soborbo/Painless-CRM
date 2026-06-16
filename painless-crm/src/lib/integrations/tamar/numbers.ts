import { normalizePhone } from '@/lib/migration/normalize';

// Our own Tamar-hosted number(s). Pure helpers — no I/O. Used to (a) drive the
// poll's ?number= param and (b) classify a CDR's direction (a call *to* one of
// our numbers is inbound; a call *from* one of them is outbound).

/** Parse the comma/semicolon-separated TAMAR_NUMBERS env value into a
 *  de-duplicated list of E.164 numbers. Split is on , or ; only — never
 *  whitespace, since a number is commonly written with internal spaces
 *  ("0117 974 0082"). Blank/garbage entries are dropped. */
export function parseTamarNumbers(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const token of raw.split(/[,;]+/)) {
    const e164 = normalizePhone(token);
    if (e164 && !out.includes(e164)) out.push(e164);
  }
  return out;
}

/** True when `num` (any format) normalises to one of our E.164 numbers. */
export function isOurNumber(ourNumbers: string[], num: string | null | undefined): boolean {
  const e164 = normalizePhone(num);
  return e164 !== null && ourNumbers.includes(e164);
}
