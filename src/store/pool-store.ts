import { create } from 'zustand';
import type { OHLCCandle, PoolPriceState, WorkerPriceBatch, Pool } from '@/lib/types';
import { MAX_CANDLES_PER_POOL } from '@/lib/constants';

interface PoolData {
    pool: Pool;
    priceState: PoolPriceState;
    candles: OHLCCandle[];
}

interface PoolStoreState {
    pools: Map<string, PoolData>;
    selectedPoolId: string | null;

    // Actions
    initPools: (pools: Pool[]) => void;
    applyBatch: (batch: WorkerPriceBatch) => void;
    selectPool: (poolId: string) => void;
}

export const usePoolStore = create<PoolStoreState>((set, get) => ({
    pools: new Map(),
    selectedPoolId: null,

    initPools: (pools: Pool[]) => {
        const poolMap = new Map<string, PoolData>();
        pools.forEach((pool) => {
            poolMap.set(pool.id, {
                pool,
                priceState: {
                    poolId: pool.id,
                    pendingPrice: null,
                    confirmedPrice: null,
                    pendingBlockNumber: null,
                    confirmedBlockNumber: null,
                    status: 'stale',
                    lastUpdated: Date.now(),
                },
                candles: [],
            });
        });

        set({
            pools: poolMap,
            selectedPoolId: pools[0]?.id ?? null,
        });
    },

    applyBatch: (batch: WorkerPriceBatch) => {
        set((state) => {
            const newPools = new Map(state.pools);

            for (const update of batch.pools) {
                const existing = newPools.get(update.poolId);
                if (!existing) continue;

                // Ring buffer: keep last MAX_CANDLES_PER_POOL candles
                const candles = [...existing.candles];
                const lastCandle = candles[candles.length - 1];

                if (lastCandle && lastCandle.time === update.candle.time) {
                    candles[candles.length - 1] = update.candle;
                } else {
                    candles.push(update.candle);
                    if (candles.length > MAX_CANDLES_PER_POOL) {
                        candles.shift();
                    }
                }

                newPools.set(update.poolId, {
                    ...existing,
                    priceState: update.priceState,
                    candles,
                });
            }

            return { pools: newPools };
        });
    },

    selectPool: (poolId: string) => {
        set({ selectedPoolId: poolId });
    },
}));

// ─── Atomic Selectors ───────────────────────────────────
// These prevent unnecessary re-renders by subscribing to specific slices.

export function usePoolMap(): Map<string, PoolData> {
    return usePoolStore((state) => state.pools);
}

export function usePoolData(poolId: string): PoolData | undefined {
    return usePoolStore((state) => state.pools.get(poolId));
}

export function useSelectedPoolId(): string | null {
    return usePoolStore((state) => state.selectedPoolId);
}

export function useSelectedPool(): PoolData | undefined {
    return usePoolStore((state) => {
        if (!state.selectedPoolId) return undefined;
        return state.pools.get(state.selectedPoolId);
    });
}

export function usePoolCandles(poolId: string): OHLCCandle[] {
    return usePoolStore((state) => state.pools.get(poolId)?.candles ?? []);
}
