import { summariseUserAgent } from '@/lib/quotes/acceptance-ua';
import { describe, expect, it } from 'vitest';

describe('summariseUserAgent', () => {
  it('returns null for null input', () => {
    expect(summariseUserAgent(null)).toBeNull();
  });

  it('returns null for empty / whitespace strings', () => {
    expect(summariseUserAgent('')).toBeNull();
    expect(summariseUserAgent('   ')).toBeNull();
  });

  it('parses an iPhone UA with version', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
    const out = summariseUserAgent(ua);
    expect(out?.device).toBe('iPhone');
    expect(out?.short).toBe('iPhone 17.4');
    expect(out?.full).toBe(ua);
  });

  it('parses an iPad UA with version', () => {
    const ua =
      'Mozilla/5.0 (iPad; CPU OS 16_1 like Mac OS X) AppleWebKit/605.1.15 Version/16.1 Mobile Safari/604.1';
    const out = summariseUserAgent(ua);
    expect(out?.device).toBe('iPad');
    expect(out?.short).toBe('iPad 16.1');
  });

  it('parses an Android UA with version', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';
    const out = summariseUserAgent(ua);
    expect(out?.device).toBe('Android');
    expect(out?.short).toBe('Android 14');
  });

  it('detects Mac without version digits', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
    const out = summariseUserAgent(ua);
    expect(out?.device).toBe('Mac');
    expect(out?.short).toBe('Mac');
  });

  it('detects Windows without version digits', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
    const out = summariseUserAgent(ua);
    expect(out?.device).toBe('Windows');
    expect(out?.short).toBe('Windows');
  });

  it('falls back to "Other browser" for unrecognised shapes', () => {
    const ua = 'curl/8.4.0';
    const out = summariseUserAgent(ua);
    expect(out?.device).toBe('Other');
    expect(out?.short).toBe('Other browser');
    expect(out?.full).toBe('curl/8.4.0');
  });

  it('preserves the full UA string for hover/title display', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
    expect(summariseUserAgent(ua)?.full).toBe(ua);
  });

  it('iOS underscores in versions are normalised to dots', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X)';
    expect(summariseUserAgent(ua)?.short).toBe('iPhone 17.4.1');
  });
});
