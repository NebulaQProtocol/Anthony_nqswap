import { describe, it, expect, beforeEach } from 'vitest';
import { CandlestickAggregator } from '@/worker/aggregator';
import type { PriceUpdate } from '@/lib/types';

function makePriceUpdate(overrides: Partial<PriceUpdate> = {}): PriceUpdate {
    return {
        poolId: 'pool-1',
        price: 100,
        blockNumber: 1000,
        txHash: `0x${Math.random().toString(16).slice(2)}`,
        timestamp: 1700000000000,
        ...overrides,
    };
}

describe('CandlestickAggregator', () => {
    let aggregator: CandlestickAggregator;

    beforeEach(() => {
        aggregator = new CandlestickAggregator();
    });

    it('creates a new OHLC bucket on first update', () => {
        aggregator.onPriceUpdate(makePriceUpdate({ price: 100 }));
        const candles = aggregator.flush();

        expect(candles.size).toBe(1);
        const candle = candles.get('pool-1')!;
        expect(candle.open).toBe(100);
        expect(candle.high).toBe(100);
        expect(candle.low).toBe(100);
        expect(candle.close).toBe(100);
    });

    it('tracks high and low across multiple updates', () => {
        aggregator.onPriceUpdate(makePriceUpdate({ price: 100 }));
        aggregator.onPriceUpdate(makePriceUpdate({ price: 120 }));
        aggregator.onPriceUpdate(makePriceUpdate({ price: 80 }));
        aggregator.onPriceUpdate(makePriceUpdate({ price: 110 }));

        const candle = aggregator.flush().get('pool-1')!;
        expect(candle.open).toBe(100);
        expect(candle.high).toBe(120);
        expect(candle.low).toBe(80);
        expect(candle.close).toBe(110);
    });

    it('returns empty map when no updates since last flush', () => {
        const candles = aggregator.flush();
        expect(candles.size).toBe(0);
    });

    it('returns empty map on second flush without new updates', () => {
        aggregator.onPriceUpdate(makePriceUpdate());
        aggregator.flush(); // first flush
        const second = aggregator.flush(); // second flush, no new data
        expect(second.size).toBe(0);
    });

    it('resets open price to previous close after flush', () => {
        aggregator.onPriceUpdate(makePriceUpdate({ price: 100 }));
        aggregator.onPriceUpdate(makePriceUpdate({ price: 150 }));
        aggregator.flush();

        // Next update after flush
        aggregator.onPriceUpdate(makePriceUpdate({ price: 160 }));
        const candle = aggregator.flush().get('pool-1')!;

        // Open should be previous close (150), not the new price
        expect(candle.open).toBe(150);
        expect(candle.high).toBe(160);
        expect(candle.close).toBe(160);
    });

    it('handles multiple pools independently', () => {
        aggregator.onPriceUpdate(makePriceUpdate({ poolId: 'pool-1', price: 100 }));
        aggregator.onPriceUpdate(makePriceUpdate({ poolId: 'pool-2', price: 200 }));
        aggregator.onPriceUpdate(makePriceUpdate({ poolId: 'pool-1', price: 110 }));

        const candles = aggregator.flush();
        expect(candles.size).toBe(2);
        expect(candles.get('pool-1')!.close).toBe(110);
        expect(candles.get('pool-2')!.close).toBe(200);
    });

    it('converts timestamp to seconds for Lightweight Charts', () => {
        aggregator.onPriceUpdate(makePriceUpdate({ timestamp: 1700000000123 }));
        const candle = aggregator.flush().get('pool-1')!;
        expect(candle.time).toBe(1700000000); // truncated to seconds
    });

    it('handles burst of 1000 updates efficiently', () => {
        for (let i = 0; i < 1000; i++) {
            aggregator.onPriceUpdate(
                makePriceUpdate({
                    poolId: `pool-${i % 10}`,
                    price: 100 + Math.random() * 10,
                })
            );
        }

        const candles = aggregator.flush();
        expect(candles.size).toBe(10); // 10 pools
    });

    it('startNewPeriod resets all buckets', () => {
        aggregator.onPriceUpdate(makePriceUpdate({ price: 100 }));
        aggregator.flush();

        aggregator.startNewPeriod(1700001000000);

        aggregator.onPriceUpdate(makePriceUpdate({ price: 105 }));
        const candle = aggregator.flush().get('pool-1')!;
        expect(candle.time).toBe(1700001000);
    });

    it('clear removes all state', () => {
        aggregator.onPriceUpdate(makePriceUpdate());
        expect(aggregator.poolCount).toBe(1);
        aggregator.clear();
        expect(aggregator.poolCount).toBe(0);
        expect(aggregator.flush().size).toBe(0);
    });
});
