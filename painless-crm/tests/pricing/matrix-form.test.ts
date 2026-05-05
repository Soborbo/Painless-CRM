import { SMOKE_PRICING_CONFIG } from '@/lib/pricing/fixtures';
import {
  MATRIX_COLS,
  MATRIX_ROWS,
  applyMatrixEdit,
  marginFieldName,
  parseMatrixEditForm,
} from '@/lib/pricing/form';
import { describe, expect, it } from 'vitest';

function buildMatrixForm(
  cells: number[][],
  options: { version_label?: string; notes?: string } = {},
): FormData {
  const fd = new FormData();
  fd.append('version_label', options.version_label ?? 'v1');
  if (options.notes !== undefined) fd.append('notes', options.notes);
  for (let row = 0; row < cells.length; row++) {
    for (let col = 0; col < (cells[row] ?? []).length; col++) {
      fd.append(marginFieldName(row, col), String(cells[row]?.[col] ?? 0));
    }
  }
  return fd;
}

const fullPercentMatrix: number[][] = [
  [18, 22, 26],
  [20, 24, 28],
  [22, 26, 30],
  [24, 28, 32],
  [26, 30, 34],
];

describe('marginFieldName', () => {
  it('returns the canonical encoding', () => {
    expect(marginFieldName(0, 0)).toBe('margin_0_0');
    expect(marginFieldName(4, 2)).toBe('margin_4_2');
  });
});

describe('parseMatrixEditForm', () => {
  it('coerces a 5×3 form of percentages into [0,1] decimals', () => {
    const result = parseMatrixEditForm(buildMatrixForm(fullPercentMatrix));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.margin_matrix.length).toBe(MATRIX_ROWS);
      expect(result.input.margin_matrix[0]?.length).toBe(MATRIX_COLS);
      expect(result.input.margin_matrix[0]?.[0]).toBeCloseTo(0.18, 5);
      expect(result.input.margin_matrix[4]?.[2]).toBeCloseTo(0.34, 5);
    }
  });

  it('captures the version_label and notes', () => {
    const result = parseMatrixEditForm(
      buildMatrixForm(fullPercentMatrix, { version_label: 'v2.0', notes: 'rate review' }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.version_label).toBe('v2.0');
      expect(result.input.notes).toBe('rate review');
    }
  });

  it('rejects when a cell is missing', () => {
    const fd = buildMatrixForm(fullPercentMatrix);
    fd.delete(marginFieldName(2, 1));
    const result = parseMatrixEditForm(fd);
    expect(result.ok).toBe(false);
  });

  it('rejects negative percentages', () => {
    const negative = fullPercentMatrix.map((row) => [...row]);
    if (negative[0]) negative[0][0] = -1;
    const result = parseMatrixEditForm(buildMatrixForm(negative));
    expect(result.ok).toBe(false);
  });

  it('rejects percentages above 100', () => {
    const tooHigh = fullPercentMatrix.map((row) => [...row]);
    if (tooHigh[0]) tooHigh[0][0] = 101;
    const result = parseMatrixEditForm(buildMatrixForm(tooHigh));
    expect(result.ok).toBe(false);
  });

  it('rejects an empty version_label', () => {
    const result = parseMatrixEditForm(buildMatrixForm(fullPercentMatrix, { version_label: '' }));
    expect(result.ok).toBe(false);
  });
});

describe('applyMatrixEdit', () => {
  it('overwrites the margin matrix while preserving every other field', () => {
    const newMatrix: number[][] = fullPercentMatrix.map((row) => row.map((v) => v / 100));
    const merged = applyMatrixEdit(SMOKE_PRICING_CONFIG, {
      version_label: 'v2.0',
      margin_matrix: newMatrix as never,
      notes: null,
    });
    expect(merged.version_label).toBe('v2.0');
    expect(merged.margin_matrix).toEqual(newMatrix);
    expect(merged.size_categories).toEqual(SMOKE_PRICING_CONFIG.size_categories);
    expect(merged.distance_bands).toEqual(SMOKE_PRICING_CONFIG.distance_bands);
    expect(merged.crew_hourly_rate_pence).toBe(SMOKE_PRICING_CONFIG.crew_hourly_rate_pence);
    expect(merged.complications).toEqual(SMOKE_PRICING_CONFIG.complications);
  });

  it('does not alias the source matrix', () => {
    const newMatrix = fullPercentMatrix.map((row) => row.map((v) => v / 100));
    const merged = applyMatrixEdit(SMOKE_PRICING_CONFIG, {
      version_label: 'v2.0',
      margin_matrix: newMatrix as never,
      notes: null,
    });
    if (merged.margin_matrix[0]) merged.margin_matrix[0][0] = 0.99;
    expect(newMatrix[0]?.[0]).toBe(0.18);
  });
});
