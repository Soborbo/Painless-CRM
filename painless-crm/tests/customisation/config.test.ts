import { parseCubicPresets } from '@/lib/customisation/cubic-presets';
import { DocumentTextSchema, resolveDocumentText } from '@/lib/customisation/document-text';
import { parseLeadProviders, resolveSourceForProvider } from '@/lib/customisation/lead-providers';
import { describe, expect, it } from 'vitest';

describe('resolveDocumentText', () => {
  it('returns empty strings for missing/junk config', () => {
    expect(resolveDocumentText(null)).toEqual({
      acceptance_terms: '',
      signoff_declaration: '',
      quote_footer: '',
    });
    expect(resolveDocumentText([1, 2])).toEqual({
      acceptance_terms: '',
      signoff_declaration: '',
      quote_footer: '',
    });
  });
  it('picks string fields, ignores non-strings', () => {
    expect(
      resolveDocumentText({ acceptance_terms: 'Pay within 7 days', quote_footer: 5 }),
    ).toEqual({ acceptance_terms: 'Pay within 7 days', signoff_declaration: '', quote_footer: '' });
  });
  it('schema enforces max length', () => {
    const ok = DocumentTextSchema.safeParse({
      acceptance_terms: 'a',
      signoff_declaration: '',
      quote_footer: '',
    });
    expect(ok.success).toBe(true);
    expect(
      DocumentTextSchema.safeParse({
        acceptance_terms: 'a'.repeat(8001),
        signoff_declaration: '',
        quote_footer: '',
      }).success,
    ).toBe(false);
  });
});

describe('parseCubicPresets', () => {
  it('keeps valid, drops malformed, dedupes case-insensitively, sorts', () => {
    const out = parseCubicPresets([
      { name: 'Sofa', cubic_ft: 50 },
      { name: 'sofa', cubic_ft: 99 }, // dup
      { name: 'Bed', cubic_ft: 'x' }, // bad
      { name: 'Box', cubic_ft: '10' }, // coerced
    ]);
    expect(out).toEqual([
      { name: 'Box', cubic_ft: 10 },
      { name: 'Sofa', cubic_ft: 50 },
    ]);
  });
  it('returns [] for junk', () => {
    expect(parseCubicPresets(null)).toEqual([]);
    expect(parseCubicPresets({})).toEqual([]);
  });
});

describe('lead providers', () => {
  it('parses and defaults active to true', () => {
    const out = parseLeadProviders([{ name: 'Compare My Move', source_key: 'compare_my_move' }]);
    expect(out).toEqual([
      { name: 'Compare My Move', source_key: 'compare_my_move', active: true },
    ]);
  });
  it('rejects a bad source_key', () => {
    expect(parseLeadProviders([{ name: 'X', source_key: 'Bad Key' }])).toEqual([]);
  });
  it('resolves source for an active provider, case-insensitively', () => {
    const providers = parseLeadProviders([
      { name: 'Reallymoving', source_key: 'reallymoving', active: true },
      { name: 'Old', source_key: 'old', active: false },
    ]);
    expect(resolveSourceForProvider(providers, 'reallymoving')).toBe('reallymoving');
    expect(resolveSourceForProvider(providers, 'REALLYMOVING')).toBe('reallymoving');
    expect(resolveSourceForProvider(providers, 'Old')).toBeNull(); // inactive
    expect(resolveSourceForProvider(providers, 'unknown')).toBeNull();
  });
});
