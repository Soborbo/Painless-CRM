import { buildContainerImport, parseCsv } from '@/lib/storage/csv-import';
import { describe, expect, it } from 'vitest';

describe('parseCsv', () => {
  it('parses a simple grid (LF)', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('handles CRLF and a trailing newline without an empty row', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('respects quotes: embedded commas, newlines and doubled quotes', () => {
    expect(parseCsv('code,notes\nA-1,"bay 3, ground"')).toEqual([
      ['code', 'notes'],
      ['A-1', 'bay 3, ground'],
    ]);
    expect(parseCsv('code,notes\nA-1,"line1\nline2"')).toEqual([
      ['code', 'notes'],
      ['A-1', 'line1\nline2'],
    ]);
    expect(parseCsv('code,notes\nA-1,"she said ""hi"""')).toEqual([
      ['code', 'notes'],
      ['A-1', 'she said "hi"'],
    ]);
  });
});

const HEADER = 'container_code,size_cubic_ft,monthly_rate_pounds,status,notes';

describe('buildContainerImport', () => {
  it('imports valid rows, converting pounds to pence and upper-casing codes', () => {
    const r = buildContainerImport(`${HEADER}\na-101,160,95,available,Ground floor`, []);
    expect(r.errors).toEqual([]);
    expect(r.valid).toHaveLength(1);
    expect(r.valid[0]).toMatchObject({
      container_code: 'A-101',
      size_cubic_ft: 160,
      monthly_rate_pence: 9500,
      status: 'available',
      notes: 'Ground floor',
    });
  });

  it('defaults status to available and allows blank size/notes', () => {
    const r = buildContainerImport(`${HEADER}\nA-1,,50,,`, []);
    expect(r.valid[0]).toMatchObject({ status: 'available', size_cubic_ft: null, notes: null });
  });

  it('reports a missing required column instead of silently importing', () => {
    const r = buildContainerImport('size_cubic_ft,monthly_rate_pounds\n160,95', []);
    expect(r.valid).toEqual([]);
    expect(r.errors[0]?.message).toMatch(/container_code/);
  });

  it('flags bad rows by line number and keeps the good ones', () => {
    const r = buildContainerImport(
      `${HEADER}\nA-1,160,95,available,ok\nB-2,160,,available,no-rate`,
      [],
    );
    expect(r.valid.map((c) => c.container_code)).toEqual(['A-1']);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]?.line).toBe(3); // header is line 1
  });

  it('rejects an unknown status', () => {
    const r = buildContainerImport(`${HEADER}\nA-1,160,95,exploded,x`, []);
    expect(r.valid).toEqual([]);
    expect(r.errors).toHaveLength(1);
  });

  it('skips duplicates within the file and against existing codes (no silent drops)', () => {
    const r = buildContainerImport(
      `${HEADER}\nA-1,160,95,available,x\nA-1,160,95,available,dup\nB-2,160,95,available,y`,
      ['B-2'],
    );
    expect(r.valid.map((c) => c.container_code)).toEqual(['A-1']);
    expect(r.duplicateCodes).toEqual(['A-1', 'B-2']);
    expect(r.totalDataRows).toBe(3);
  });

  it('ignores blank lines', () => {
    const r = buildContainerImport(`${HEADER}\n\nA-1,160,95,available,x\n`, []);
    expect(r.valid).toHaveLength(1);
    expect(r.totalDataRows).toBe(1);
  });

  it('reports an empty file', () => {
    expect(buildContainerImport('', []).errors[0]?.message).toMatch(/empty/i);
  });

  // Audit M5 — the reported line must be the TRUE physical file line even when a
  // blank line or a multi-line quoted field precedes the offending row.
  it('reports the physical line when a blank line precedes a bad row', () => {
    // line 1 header, line 2 blank, line 3 good, line 4 bad (no rate)
    const r = buildContainerImport(
      `${HEADER}\n\nA-1,160,95,available,ok\nB-2,160,,available,no-rate`,
      [],
    );
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]?.line).toBe(4);
  });

  it('counts embedded newlines in a quoted field toward the physical line', () => {
    // The A-1 notes field spans physical lines 2-3, so B-2 (bad) is line 4.
    const r = buildContainerImport(
      `${HEADER}\nA-1,160,95,available,"multi\nline note"\nB-2,160,,available,no-rate`,
      [],
    );
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]?.line).toBe(4);
    expect(r.valid[0]?.notes).toBe('multi\nline note');
  });

  it('strips a stray CR inside a quoted multi-line field (CRLF source)', () => {
    const r = buildContainerImport(`${HEADER}\r\nA-1,160,95,available,"a\r\nb"\r\n`, []);
    expect(r.valid[0]?.notes).toBe('a\nb');
  });
});
