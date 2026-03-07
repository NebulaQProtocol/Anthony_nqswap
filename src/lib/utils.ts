import { WS_RECONNECT_BASE_MS, WS_RECONNECT_MAX_MS } from './constants';

/**
 * Calculate exponential backoff delay with jitter.
 * @param attempt - The current retry attempt (0-indexed)
 * @returns Delay in milliseconds
 */
export function calculateBackoff(attempt: number): number {
    const delay = Math.min(
        WS_RECONNECT_BASE_MS * Math.pow(2, attempt),
        WS_RECONNECT_MAX_MS
    );
    // Add 0-25% jitter to prevent thundering herd
    const jitter = delay * 0.25 * Math.random();
    return delay + jitter;
}

/**
 * Format a price for display (up to 6 decimal places, trailing zeros stripped).
 */
export function formatPrice(price: number): string {
    if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(6);
}

/**
 * Format a timestamp as a short time string (HH:MM:SS).
 */
export function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString('en-US', { hour12: false });
}

/**
 * Format a large number compactly (e.g., 1.2M, 345K).
 */
export function formatCompact(value: number): string {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toFixed(0);
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
