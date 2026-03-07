import type { OHLCCandle, PriceUpdate } from '@/lib/types';

interface OHLCBucket {
    open: number;
    high: number;
    low: number;
    close: number;
    time: number;
    dirty: boolean;
}

/**
 * CandlestickAggregator: accumulates raw price updates into OHLC candle buckets
 * per pool, then flushes dirty buckets at a fixed interval (~60fps).
 *
 * This runs inside a Web Worker to keep the main thread clear.
 */
export class CandlestickAggregator {
    private buckets: Map<string, OHLCBucket> = new Map();

    /**
     * Process a single price update. Updates or creates an OHLC bucket for the pool.
     */
    onPriceUpdate(update: PriceUpdate): void {
        const existing = this.buckets.get(update.poolId);

        const time = Math.floor(update.timestamp / 1000); // Lightweight Charts uses seconds

        if (!existing) {
            this.buckets.set(update.poolId, {
                open: update.price,
                high: update.price,
                low: update.price,
                close: update.price,
                time,
                dirty: true,
            });
        } else {
            if (time > existing.time) {
                // Time has advanced (new second). Start a new candle bucket.
                // To prevent visual gaps, we use the previous close as the new open.
                existing.open = existing.close;
                existing.high = Math.max(existing.close, update.price);
                existing.low = Math.min(existing.close, update.price);
                existing.close = update.price;
                existing.time = time;
                existing.dirty = true;
            } else {
                // Same candle period
                existing.high = Math.max(existing.high, update.price);
                existing.low = Math.min(existing.low, update.price);
                existing.close = update.price;
                existing.dirty = true;
            }
        }
    }

    /**
     * Flush all dirty buckets as OHLC candles. Resets dirty flag.
     * Returns only pools that had updates since last flush.
     */
    flush(): Map<string, OHLCCandle> {
        const result = new Map<string, OHLCCandle>();

        for (const [poolId, bucket] of this.buckets) {
            if (!bucket.dirty) continue;

            result.set(poolId, {
                time: bucket.time,
                open: bucket.open,
                high: bucket.high,
                low: bucket.low,
                close: bucket.close,
            });

            bucket.dirty = false;
        }

        return result;
    }

    /**
     * Start a new candle period for all pools (e.g., when time interval changes).
     */
    startNewPeriod(timestamp: number): void {
        const time = Math.floor(timestamp / 1000);
        for (const [, bucket] of this.buckets) {
            bucket.open = bucket.close;
            bucket.high = bucket.close;
            bucket.low = bucket.close;
            bucket.time = time;
            bucket.dirty = false;
        }
    }

    /**
     * Get the number of active pool buckets.
     */
    get poolCount(): number {
        return this.buckets.size;
    }

    /**
     * Reset all state.
     */
    clear(): void {
        this.buckets.clear();
    }
}
