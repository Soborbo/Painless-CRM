import { CompanySettingsSchema, SettingsVersionSchema } from '@/lib/schemas/settings';
import {
  DEFAULT_BRAND_COLOR,
  DEFAULT_COMPANY_NAME,
  isHexColor,
  isVersionConflict,
  resolveBranding,
} from '@/lib/settings/branding';
import { describe, expect, it } from 'vitest';

const VALID = {
  company_name: 'Painless Removals',
  brand_color: '#0066cc',
  logo_url: 'https://example.com/logo.png',
  vat_number: 'GB123456789',
  ico_registration: '12345678',
  default_quote_validity_days: 7,
  default_deposit_percent: 25,
  default_currency: 'GBP',
  default_locale: 'en-GB',
  default_timezone: 'Europe/London',
};

describe('CompanySettingsSchema', () => {
  it('accepts a fully valid payload', () => {
    expect(CompanySettingsSchema.safeParse(VALID).success).toBe(true);
  });

  it('requires a non-empty company name', () => {
    expect(CompanySettingsSchema.safeParse({ ...VALID, company_name: '  ' }).success).toBe(false);
  });

  it.each(['#fff', '#0066cc', '#ABCDEF'])('accepts hex colour %s', (brand_color) => {
    expect(CompanySettingsSchema.safeParse({ ...VALID, brand_color }).success).toBe(true);
  });

  it.each(['0066cc', '#12', 'blue', '#1234'])('rejects bad colour %s', (brand_color) => {
    expect(CompanySettingsSchema.safeParse({ ...VALID, brand_color }).success).toBe(false);
  });

  it('treats empty optional fields as undefined (NULL)', () => {
    const parsed = CompanySettingsSchema.safeParse({
      ...VALID,
      logo_url: '',
      vat_number: '',
      ico_registration: '',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.logo_url).toBeUndefined();
      expect(parsed.data.vat_number).toBeUndefined();
    }
  });

  it('rejects a malformed logo URL', () => {
    expect(CompanySettingsSchema.safeParse({ ...VALID, logo_url: 'not-a-url' }).success).toBe(false);
  });

  it('coerces numeric defaults from form strings and enforces ranges', () => {
    const ok = CompanySettingsSchema.safeParse({
      ...VALID,
      default_quote_validity_days: '14',
      default_deposit_percent: '33.5',
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.default_quote_validity_days).toBe(14);

    expect(
      CompanySettingsSchema.safeParse({ ...VALID, default_quote_validity_days: 0 }).success,
    ).toBe(false);
    expect(CompanySettingsSchema.safeParse({ ...VALID, default_deposit_percent: 101 }).success).toBe(
      false,
    );
  });

  it('rejects unknown currency/locale', () => {
    expect(CompanySettingsSchema.safeParse({ ...VALID, default_currency: 'JPY' }).success).toBe(
      false,
    );
    expect(CompanySettingsSchema.safeParse({ ...VALID, default_locale: 'de-DE' }).success).toBe(
      false,
    );
  });
});

describe('SettingsVersionSchema', () => {
  it('accepts 0 (no row yet) and positive integers', () => {
    expect(SettingsVersionSchema.safeParse('0').success).toBe(true);
    expect(SettingsVersionSchema.safeParse('3').success).toBe(true);
  });
  it('rejects negative and non-numeric', () => {
    expect(SettingsVersionSchema.safeParse('-1').success).toBe(false);
    expect(SettingsVersionSchema.safeParse('x').success).toBe(false);
  });
});

describe('resolveBranding (brand merge)', () => {
  it('falls back to defaults when the source is null', () => {
    expect(resolveBranding(null)).toEqual({
      companyName: DEFAULT_COMPANY_NAME,
      brandColor: DEFAULT_BRAND_COLOR,
      logoUrl: null,
    });
  });

  it('uses stored values when present', () => {
    expect(
      resolveBranding({
        company_name: 'Acme Move',
        brand_color: '#ff8800',
        logo_url: 'https://cdn/acme.png',
      }),
    ).toEqual({ companyName: 'Acme Move', brandColor: '#ff8800', logoUrl: 'https://cdn/acme.png' });
  });

  it('falls back the colour when it is malformed but keeps the name', () => {
    const b = resolveBranding({ company_name: 'Acme', brand_color: 'orange', logo_url: '  ' });
    expect(b.brandColor).toBe(DEFAULT_BRAND_COLOR);
    expect(b.companyName).toBe('Acme');
    expect(b.logoUrl).toBeNull();
  });

  it('honours an explicit fallback name over the global default', () => {
    expect(resolveBranding({ company_name: null }, 'Tenant Co').companyName).toBe('Tenant Co');
  });
});

describe('isHexColor', () => {
  it('narrows valid hex and rejects the rest', () => {
    expect(isHexColor('#abc')).toBe(true);
    expect(isHexColor('#aabbcc')).toBe(true);
    expect(isHexColor('aabbcc')).toBe(false);
    expect(isHexColor(null)).toBe(false);
    expect(isHexColor(undefined)).toBe(false);
  });
});

describe('isVersionConflict', () => {
  it('flags a null update result as a conflict', () => {
    expect(isVersionConflict(null)).toBe(true);
    expect(isVersionConflict({ company_id: 'x' })).toBe(false);
  });
});
