import { describe, it, expect } from 'vitest';
import { formatUtcDateTime } from './date';

describe('formatUtcDateTime', () => {
  it('formats numeric epoch milliseconds correctly in UTC', () => {
    // 1772658192000 is 2026-03-04T21:03:12.000Z
    const result = formatUtcDateTime(1772658192000);
    expect(result).not.toBe('Invalid Date');
    expect(result).toContain('04/03/2026');
    expect(result).toContain('21:03:12');
  });

  it('formats string epoch milliseconds correctly in UTC without returning "Invalid Date"', () => {
    // This directly tests the bug scenario where PostgreSQL bigint is serialized as string
    const result = formatUtcDateTime('1772658192000');
    expect(result).not.toBe('Invalid Date');
    expect(result).toContain('04/03/2026');
    expect(result).toContain('21:03:12');
  });

  it('formats standard ISO 8601 strings correctly in UTC', () => {
    const result = formatUtcDateTime('2026-03-04T21:03:12.000Z');
    expect(result).not.toBe('Invalid Date');
    expect(result).toContain('04/03/2026');
    expect(result).toContain('21:03:12');
  });

  it('safely handles null, undefined, and empty string without throwing', () => {
    expect(formatUtcDateTime(null)).toBe('-');
    expect(formatUtcDateTime(undefined)).toBe('-');
    expect(formatUtcDateTime('')).toBe('-');
  });

  it('safely handles invalid date strings without returning "Invalid Date"', () => {
    expect(formatUtcDateTime('invalid-timestamp-string')).toBe('-');
    expect(formatUtcDateTime(NaN)).toBe('-');
  });
});
