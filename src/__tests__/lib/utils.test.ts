import { describe, it, expect } from 'vitest';
import { calculateBackoff, formatPrice, formatTime, formatCompact, clamp } from '@/lib/utils';

describe('calculateBackoff', () => {
    it('returns base delay for attempt 0', () => {
        const delay = calculateBackoff(0);
        // 1000ms base + up to 25% jitter → between 1000 and 1250
        expect(delay).toBeGreaterThanOrEqual(1000);
        expect(delay).toBeLessThanOrEqual(1250);
    });

    it('doubles delay for each attempt', () => {
        // Attempt 3 → base * 2^3 = 8000, + up to 25% jitter = 8000-10000
        const delay = calculateBackoff(3);
        expect(delay).toBeGreaterThanOrEqual(8000);
        expect(delay).toBeLessThanOrEqual(10000);
    });

    it('caps at max delay', () => {
        // Attempt 20 → would be huge, but capped at 30000 + 25% = 30000-37500
        const delay = calculateBackoff(20);
        expect(delay).toBeGreaterThanOrEqual(30000);
        expect(delay).toBeLessThanOrEqual(37500);
    });
});

describe('formatPrice', () => {
    it('formats large prices with 2 decimals', () => {
        expect(formatPrice(1850.5)).toBe('1,850.50');
    });

    it('formats medium prices with 4 decimals', () => {
        expect(formatPrice(1.2345)).toBe('1.2345');
    });

    it('formats small prices with 6 decimals', () => {
        expect(formatPrice(0.001234)).toBe('0.001234');
    });
});

describe('formatCompact', () => {
    it('formats billions', () => {
        expect(formatCompact(1_500_000_000)).toBe('1.5B');
    });

    it('formats millions', () => {
        expect(formatCompact(2_500_000)).toBe('2.5M');
    });

    it('formats thousands', () => {
        expect(formatCompact(42_000)).toBe('42.0K');
    });

    it('formats small numbers as-is', () => {
        expect(formatCompact(999)).toBe('999');
    });
});

describe('clamp', () => {
    it('clamps below min', () => {
        expect(clamp(-5, 0, 100)).toBe(0);
    });

    it('clamps above max', () => {
        expect(clamp(150, 0, 100)).toBe(100);
    });

    it('returns value within range', () => {
        expect(clamp(50, 0, 100)).toBe(50);
    });

    it('handles min === max', () => {
        expect(clamp(50, 10, 10)).toBe(10);
    });
});
