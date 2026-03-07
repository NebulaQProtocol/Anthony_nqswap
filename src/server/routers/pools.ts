import { z } from 'zod';
import { observable } from '@trpc/server/observable';
import { router, publicProcedure } from '../trpc';
import { EventEmitter } from 'events';
import { PriceUpdateSchema, PoolSchema } from '@/lib/types';
import type { PriceUpdate, Pool } from '@/lib/types';

// Event emitter for broadcasting price updates from WS to tRPC subscribers
export const priceEmitter = new EventEmitter();
priceEmitter.setMaxListeners(100);

// In-memory pool registry (populated from mock WS initial message)
let pools: Pool[] = [];

export function setPools(newPools: Pool[]): void {
    pools = newPools;
}

export function getPools(): Pool[] {
    return pools;
}

export const poolsRouter = router({
    /**
     * Query: get the current list of top pools.
     */
    getTopPools: publicProcedure.query(() => {
        return pools;
    }),

    /**
     * Subscription: stream price updates in real-time.
     */
    onPriceUpdate: publicProcedure.subscription(() => {
        return observable<PriceUpdate>((emit) => {
            const handler = (update: PriceUpdate) => {
                emit.next(update);
            };

            priceEmitter.on('priceUpdate', handler);

            return () => {
                priceEmitter.off('priceUpdate', handler);
            };
        });
    }),
});
