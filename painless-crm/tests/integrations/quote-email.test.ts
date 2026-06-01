import {
  type QuoteEmailInput,
  renderQuoteAcceptedEmail,
  renderQuoteEmail,
} from '@/lib/integrations/resend/quote';
import { describe, expect, it } from 'vitest';

const BASE: QuoteEmailInput = {
  to: 'mary@example.com',
  customerName: 'Mary Smith',
  shareUrl: 'https://crm.example.com/quote/abc123',
  totalPence: 84_000,
  validUntil: '2026-06-15T00:00:00Z',
};

describe('renderQuoteEmail', () => {
  it('greets the customer and includes the share link', () => {
    const { subject, text } = renderQuoteEmail(BASE);
    expect(subject).toBe('Your Painless Removals quote');
    expect(text).toContain('Hi Mary Smith,');
    expect(text).toContain('https://crm.example.com/quote/abc123');
  });

  it('formats the total in GBP when present', () => {
    expect(renderQuoteEmail(BASE).text).toContain('£840');
  });

  it('omits the total line when the total is null', () => {
    const { text } = renderQuoteEmail({ ...BASE, totalPence: null });
    expect(text).not.toContain('Quote total:');
  });

  it('includes the validity date when present and omits it otherwise', () => {
    expect(renderQuoteEmail(BASE).text).toContain('valid until');
    const { text } = renderQuoteEmail({ ...BASE, validUntil: null });
    expect(text).not.toContain('valid until');
  });

  it('always signs off as Painless Removals', () => {
    expect(renderQuoteEmail(BASE).text.trimEnd().endsWith('Painless Removals')).toBe(true);
  });
});

describe('renderQuoteAcceptedEmail', () => {
  it('confirms the booking and shows the agreed total', () => {
    const { subject, text } = renderQuoteAcceptedEmail({
      to: 'mary@example.com',
      customerName: 'Mary Smith',
      totalPence: 84_000,
    });
    expect(subject).toBe('Your Painless Removals booking is confirmed');
    expect(text).toContain('Hi Mary Smith,');
    expect(text).toContain('Agreed total: £840');
    expect(text.trimEnd().endsWith('Painless Removals')).toBe(true);
  });

  it('omits the total line when null', () => {
    const { text } = renderQuoteAcceptedEmail({
      to: 'x@example.com',
      customerName: 'X',
      totalPence: null,
    });
    expect(text).not.toContain('Agreed total:');
  });
});
