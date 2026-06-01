// Phase 12 — invoice money maths. Pure + integer pence throughout so there's no
// float drift. VAT is computed per line (each line carries its own rate) and
// summed, matching how Xero totals an invoice.

export interface InvoiceLineCalc {
  quantity: number;
  unit_price_pence: number;
  vat_rate: number; // percent, e.g. 20 for 20%
}

export interface InvoiceTotals {
  subtotal_pence: number; // ex-VAT
  vat_pence: number;
  total_pence: number; // inc-VAT
}

// Ex-VAT total for one line. Rounded to whole pence.
export function lineSubtotalPence(quantity: number, unitPricePence: number): number {
  return Math.round(quantity * unitPricePence);
}

export function computeInvoiceTotals(lines: InvoiceLineCalc[]): InvoiceTotals {
  let subtotal = 0;
  let vat = 0;
  for (const line of lines) {
    const sub = lineSubtotalPence(line.quantity, line.unit_price_pence);
    subtotal += sub;
    vat += Math.round((sub * (line.vat_rate ?? 0)) / 100);
  }
  return { subtotal_pence: subtotal, vat_pence: vat, total_pence: subtotal + vat };
}
