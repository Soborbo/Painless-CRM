import { buildTemplateVars, formatAddressLine } from '@/lib/comms/template-vars';
import { describe, expect, it } from 'vitest';

const residential = {
  customer_type: 'residential',
  first_name: 'Sam',
  last_name: 'Jones',
  company_name: null,
  primary_email: 'sam@example.com',
};

describe('formatAddressLine', () => {
  it('joins present parts, skipping blanks', () => {
    expect(
      formatAddressLine({ line1: '12 High St', line2: null, city: 'Bristol', postcode: 'BS1 4ST' }),
    ).toBe('12 High St, Bristol, BS1 4ST');
  });

  it('returns empty string for a null address', () => {
    expect(formatAddressLine(null)).toBe('');
  });

  it('trims and drops empty segments', () => {
    expect(formatAddressLine({ line1: ' Flat 2 ', line2: '  ', city: 'Bath', postcode: '' })).toBe(
      'Flat 2, Bath',
    );
  });
});

describe('buildTemplateVars', () => {
  const base = {
    jobNumber: 'PR-1024',
    moveDate: '2026-07-15T00:00:00.000Z',
    arrivalWindow: '8:00–9:00',
    surveyAt: '2026-06-20T13:30:00.000Z',
    fromStage: 'contacted',
    toStage: 'quoted',
    customer: residential,
    senderCompanyName: 'Painless Removals',
    currentAddress: { line1: '1 A Rd', line2: null, city: 'Bristol', postcode: 'BS1 1AA' },
    newAddress: { line1: '2 B Rd', line2: null, city: 'Bath', postcode: 'BA1 1BB' },
  };

  it('maps customer name parts and the sender company', () => {
    const v = buildTemplateVars(base);
    expect(v.first_name).toBe('Sam');
    expect(v.last_name).toBe('Jones');
    expect(v.customer_name).toBe('Sam Jones');
    // company_name is the SENDER, never the customer.
    expect(v.company_name).toBe('Painless Removals');
    expect(v.job_number).toBe('PR-1024');
  });

  it('renders move_time from the arrival window and splits survey_at', () => {
    const v = buildTemplateVars(base);
    expect(v.move_time).toBe('8:00–9:00');
    expect(v.booked_date).not.toBe('');
    expect(v.booked_time).not.toBe('');
    // booked_date is a date only, booked_time a time only — they differ.
    expect(v.booked_date).not.toBe(v.booked_time);
  });

  it('formats the from/to addresses', () => {
    const v = buildTemplateVars(base);
    expect(v.current_address).toBe('1 A Rd, Bristol, BS1 1AA');
    expect(v.new_address).toBe('2 B Rd, Bath, BA1 1BB');
  });

  it('a business customer keeps the sender as company_name', () => {
    const v = buildTemplateVars({
      ...base,
      customer: {
        customer_type: 'business',
        first_name: null,
        last_name: null,
        company_name: 'Acme Ltd',
        primary_email: 'ops@acme.test',
      },
    });
    expect(v.customer_name).toBe('Acme Ltd'); // display name uses the customer's company
    expect(v.company_name).toBe('Painless Removals'); // merge var is still the sender
  });

  it('renders missing values as empty strings, not placeholders', () => {
    const v = buildTemplateVars({
      jobNumber: null,
      moveDate: null,
      arrivalWindow: null,
      surveyAt: null,
      customer: null,
      senderCompanyName: null,
      currentAddress: null,
      newAddress: null,
    });
    expect(v.first_name).toBe('');
    expect(v.company_name).toBe('');
    expect(v.move_date).toBe('');
    expect(v.move_time).toBe('');
    expect(v.booked_date).toBe('');
    expect(v.current_address).toBe('');
  });
});
