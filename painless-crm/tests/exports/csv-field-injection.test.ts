import { csvField } from '@/lib/exports/jobs-csv';
import { describe, expect, it } from 'vitest';

// Audit M6 — CSV/spreadsheet formula injection. A text cell beginning with
// = + - @ (or a leading tab/CR) is executed as a formula by Excel/Sheets, so
// user-controlled export fields must be neutralised.
describe('csvField formula-injection hardening', () => {
  it('prefixes a leading = with an apostrophe', () => {
    expect(csvField('=1+1')).toBe("'=1+1");
    // A formula that also contains quotes/commas is apostrophe-prefixed AND
    // RFC-4180 quoted (internal quotes doubled).
    expect(csvField('=HYPERLINK("http://evil","x")')).toBe(
      '"\'=HYPERLINK(""http://evil"",""x"")"',
    );
  });

  it('neutralises +, -, @ and leading tab/CR triggers', () => {
    expect(csvField('+1+1')).toBe("'+1+1");
    expect(csvField('-2+3')).toBe("'-2+3");
    expect(csvField('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvField('\tcmd')).toBe("'\tcmd");
  });

  it('combines neutralisation with RFC-4180 quoting when needed', () => {
    // Leading '=' plus an embedded comma → apostrophe-prefixed AND quoted.
    expect(csvField('=1,2')).toBe('"\'=1,2"');
  });

  it('does NOT touch ordinary text or numbers', () => {
    expect(csvField('Smith & Sons')).toBe('Smith & Sons');
    expect(csvField('john@example.com')).toBe('john@example.com'); // @ not leading
    expect(csvField(1234)).toBe('1234');
    expect(csvField(-500)).toBe('-500'); // negative NUMBER is not a formula
    expect(csvField(null)).toBe('');
    expect(csvField(undefined)).toBe('');
  });
});
