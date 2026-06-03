// Strict pounds -> integer pence. Audit (low): the previous `Math.round(Number(x)
// * 100)` mis-rounded half-penny inputs (1.005 * 100 === 100.4999…) and silently
// accepted non-money tokens via Number() (hex '0x10', scientific '1e2'). This
// requires a plain decimal with at most 2 fraction digits and combines the parts
// with integer arithmetic — no float multiply. Returns null for any non-money
// token so each caller maps it to its own blank/reject value.
const MONEY_RE = /^-?\d+(\.\d{1,2})?$/;

export function poundsToPence(raw: string): number | null {
  const trimmed = raw.trim();
  if (!MONEY_RE.test(trimmed)) return null;
  const negative = trimmed.startsWith('-');
  const [whole, frac = ''] = (negative ? trimmed.slice(1) : trimmed).split('.');
  const pence = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return negative ? -pence : pence;
}
