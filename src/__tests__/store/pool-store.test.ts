import { describe, it, expect, beforeEach } from 'vitest';
import { usePoolStore } from '@/store/pool-store';
import type { Pool, WorkerPriceBatch } from '@/lib/types';

const MOCK_POOLS: Pool[] = [
    { id: 'pool-1', name: 'ETH/USDC', tokenA: 'ETH', tokenB: 'USDC', tvl: 1000000, volume24h: 500000 },
    { id: 'pool-2', name: 'BTC/USDC', tokenA: 'BTC', tokenB: 'USDC', tvl: 2000000, volume24h: 800000 },
];

describe('usePoolStore', () => {
    beforeEach(() => {
        // Reset store between tests
        usePoolStore.setState({ pools: new Map(), selectedPoolId: null });
    });

    it('initializes pools from array', () => {
        usePoolStore.getState().initPools(MOCK_POOLS);

        const state = usePoolStore.getState();
        expect(state.pools.size).toBe(2);
        expect(state.pools.get('pool-1')?.pool.name).toBe('ETH/USDC');
        expect(state.selectedPoolId).toBe('pool-1');
    });

    it('sets initial price state as stale', () => {
        usePoolStore.getState().initPools(MOCK_POOLS);

        const poolData = usePoolStore.getState().pools.get('pool-1');
        expect(poolData?.priceState.status).toBe('stale');
        expect(poolData?.priceState.confirmedPrice).toBeNull();
        expect(poolData?.candles).toEqual([]);
    });

    it('applies a price batch update', () => {
        usePoolStore.getState().initPools(MOCK_POOLS);

        const batch: WorkerPriceBatch = {
            type: 'PRICE_BATCH',
            pools: [
                {
                    poolId: 'pool-1',
                    candle: { time: 1700000000, open: 100, high: 110, low: 95, close: 105 },
                    priceState: {
                        poolId: 'pool-1',
                        pendingPrice: 105,
                        confirmedPrice: 100,
                        pendingBlockNumber: 1001,
                        confirmedBlockNumber: 1000,
                        status: 'pending',
                        lastUpdated: Date.now(),
                    },
                },
            ],
        };

        usePoolStore.getState().applyBatch(batch);

        const poolData = usePoolStore.getState().pools.get('pool-1')!;
        expect(poolData.priceState.pendingPrice).toBe(105);
        expect(poolData.priceState.status).toBe('pending');
        expect(poolData.candles).toHaveLength(1);
        expect(poolData.candles[0].close).toBe(105);
    });

    it('enforces ring buffer size on candles', () => {
        usePoolStore.getState().initPools(MOCK_POOLS);

        // Apply 510 candles (MAX is 500)
        for (let i = 0; i < 510; i++) {
            const batch: WorkerPriceBatch = {
                type: 'PRICE_BATCH',
                pools: [
                    {
                        poolId: 'pool-1',
                        candle: { time: 1700000000 + i, open: 100, high: 110, low: 95, close: 100 + i },
                        priceState: {
                            poolId: 'pool-1',
                            pendingPrice: null,
                            confirmedPrice: 100 + i,
                            pendingBlockNumber: null,
                            confirmedBlockNumber: 1000 + i,
                            status: 'confirmed',
                            lastUpdated: Date.now(),
                        },
                    },
                ],
            };
            usePoolStore.getState().applyBatch(batch);
        }

        const poolData = usePoolStore.getState().pools.get('pool-1')!;
        expect(poolData.candles.length).toBeLessThanOrEqual(500);
        // Oldest candles should have been dropped
        expect(poolData.candles[0].time).toBe(1700000010); // 510 - 500 = 10th candle
    });

    it('does not modify unrelated pools on batch update', () => {
        usePoolStore.getState().initPools(MOCK_POOLS);

        const batch: WorkerPriceBatch = {
            type: 'PRICE_BATCH',
            pools: [
                {
                    poolId: 'pool-1',
                    candle: { time: 1700000000, open: 100, high: 110, low: 95, close: 105 },
                    priceState: {
                        poolId: 'pool-1',
                        pendingPrice: 105,
                        confirmedPrice: 100,
                        pendingBlockNumber: 1001,
                        confirmedBlockNumber: 1000,
                        status: 'pending',
                        lastUpdated: Date.now(),
                    },
                },
            ],
        };

        usePoolStore.getState().applyBatch(batch);

        // Pool 2 should be unchanged
        const pool2 = usePoolStore.getState().pools.get('pool-2')!;
        expect(pool2.priceState.status).toBe('stale');
        expect(pool2.candles).toEqual([]);
    });

    it('selectPool changes selectedPoolId', () => {
        usePoolStore.getState().initPools(MOCK_POOLS);
        usePoolStore.getState().selectPool('pool-2');

        expect(usePoolStore.getState().selectedPoolId).toBe('pool-2');
    });

    it('ignores batch updates for unknown pools', () => {
        usePoolStore.getState().initPools(MOCK_POOLS);

        const batch: WorkerPriceBatch = {
            type: 'PRICE_BATCH',
            pools: [
                {
                    poolId: 'pool-unknown',
                    candle: { time: 1700000000, open: 100, high: 110, low: 95, close: 105 },
                    priceState: {
                        poolId: 'pool-unknown',
                        pendingPrice: 105,
                        confirmedPrice: null,
                        pendingBlockNumber: 1001,
                        confirmedBlockNumber: null,
                        status: 'pending',
                        lastUpdated: Date.now(),
                    },
                },
            ],
        };

        usePoolStore.getState().applyBatch(batch);

        // Store should remain unchanged
        expect(usePoolStore.getState().pools.size).toBe(2);
        expect(usePoolStore.getState().pools.has('pool-unknown')).toBe(false);
    });
});
