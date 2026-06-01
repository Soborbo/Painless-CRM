import {
  MAX_ATTEMPTS,
  RETRY_DELAYS_MS,
  hasFailedPermanently,
  isDueForRetry,
  nextRetryDelayMs,
} from '@/lib/worker/offline-queue-core';
import { describe, expect, it } from 'vitest';

describe('nextRetryDelayMs', () => {
  it('follows the 1s/5s/30s/5m/30m schedule', () => {
    expect(nextRetryDelayMs(0)).toBe(1_000);
    expect(nextRetryDelayMs(1)).toBe(5_000);
    expect(nextRetryDelayMs(2)).toBe(30_000);
    expect(nextRetryDelayMs(3)).toBe(300_000);
    expect(nextRetryDelayMs(4)).toBe(1_800_000);
  });
  it('returns null once retries are exhausted', () => {
    expect(nextRetryDelayMs(MAX_ATTEMPTS)).toBeNull();
    expect(nextRetryDelayMs(99)).toBeNull();
  });
  it('treats a negative attempt count as the first delay', () => {
    expect(nextRetryDelayMs(-1)).toBe(RETRY_DELAYS_MS[0]);
  });
});

describe('hasFailedPermanently', () => {
  it('is true at or beyond the max attempts', () => {
    expect(hasFailedPermanently(MAX_ATTEMPTS - 1)).toBe(false);
    expect(hasFailedPermanently(MAX_ATTEMPTS)).toBe(true);
  });
});

describe('isDueForRetry', () => {
  it('is always due when never attempted', () => {
    expect(isDueForRetry({ attempts: 0, lastAttemptAt: null }, 1_000_000)).toBe(true);
  });
  it('waits the backoff window after the last attempt', () => {
    // 1 attempt made → next delay is 5s
    expect(isDueForRetry({ attempts: 1, lastAttemptAt: 100_000 }, 104_000)).toBe(false);
    expect(isDueForRetry({ attempts: 1, lastAttemptAt: 100_000 }, 105_000)).toBe(true);
  });
  it('is never due once permanently failed', () => {
    expect(isDueForRetry({ attempts: MAX_ATTEMPTS, lastAttemptAt: 0 }, 1e12)).toBe(false);
  });
});
