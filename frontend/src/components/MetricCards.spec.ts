import { describe, it, expect } from 'vitest';
import { formatCurrency, formatNumber } from './MetricCards';

describe('MetricCards formatters', () => {
  it('formats Colombian Peso currency accurately with no fractions', () => {
    const formatted = formatCurrency(1500000);
    expect(formatted).toContain('1.500.000');
    expect(formatted).toContain('$');
  });

  it('formats integers with locale number formatting', () => {
    expect(formatNumber(12500)).toBe('12.500');
    expect(formatNumber(0)).toBe('0');
  });
});
