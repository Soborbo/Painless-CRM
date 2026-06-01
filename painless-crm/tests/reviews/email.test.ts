import { type ReviewEmailVariant, buildReviewRequestEmail } from '@/lib/reviews/email';
import { describe, expect, it } from 'vitest';

const input = {
  customerName: 'Jane Smith',
  reviewUrl: 'https://crm.example/r/abc/review',
  complaintsUrl: 'https://crm.example/feedback/abc',
};

const VARIANTS: ReviewEmailVariant[] = ['initial', 'followup1', 'followup2'];

describe('buildReviewRequestEmail — universal, no gating (ADR-010)', () => {
  it('always carries BOTH links, in every variant', () => {
    for (const v of VARIANTS) {
      const mail = buildReviewRequestEmail(v, input);
      expect(mail.text).toContain(input.reviewUrl);
      expect(mail.text).toContain(input.complaintsUrl);
      expect(mail.html).toContain(input.reviewUrl);
      expect(mail.html).toContain(input.complaintsUrl);
    }
  });

  it('renders the two links with identical prominence (no button hierarchy)', () => {
    const { html } = buildReviewRequestEmail('initial', input);
    // Both CTAs go through the same paragraph + anchor renderer, so the wrapper
    // markup must appear exactly twice — neither link can outrank the other.
    const paragraphs = html.match(/<p style="margin:12px 0;font-size:16px;">/g) ?? [];
    expect(paragraphs).toHaveLength(2);
    const anchors = html.match(/style="color:#0066cc;text-decoration:underline;"/g) ?? [];
    expect(anchors).toHaveLength(2);
  });

  it('greets the customer by name', () => {
    expect(buildReviewRequestEmail('initial', input).text).toContain('Jane Smith');
  });
});
