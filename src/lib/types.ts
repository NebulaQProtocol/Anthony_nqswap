import { z } from 'zod';

// ─── Pool Schema ────────────────────────────────────────
export const PoolSchema = z.object({
    id: z.string(),
    name: z.string(),
    tokenA: z.string(),
    tokenB: z.string(),
    tvl: z.number().nonnegative(),
    volume24h: z.number().nonnegative(),
});

export type Pool = z.infer<typeof PoolSchema>;

// ─── Price Update (from WebSocket / mempool) ────────────
export const PriceUpdateSchema = z.object({
    poolId: z.string(),
    price: z.number().positive(),
    blockNumber: z.number().int().nonnegative(),
    txHash: z.string(),
    timestamp: z.number(),
});

export type PriceUpdate = z.infer<typeof PriceUpdateSchema>;

// ─── OHLC Candle ────────────────────────────────────────
export const OHLCCandleSchema = z.object({
    time: z.number(),
    open: z.number(),
    high: z.number(),
    low: z.number(),
    close: z.number(),
});

export type OHLCCandle = z.infer<typeof OHLCCandleSchema>;

// ─── Confirmation Status ────────────────────────────────
export const ConfirmationStatusEnum = z.enum([
    'pending',
    'confirmed',
    'stale',
]);

export type ConfirmationStatus = z.infer<typeof ConfirmationStatusEnum>;

// ─── Pool Price State (dual-state model) ────────────────
export const PoolPriceStateSchema = z.object({
    poolId: z.string(),
    pendingPrice: z.number().nullable(),
    confirmedPrice: z.number().nullable(),
    pendingBlockNumber: z.number().int().nullable(),
    confirmedBlockNumber: z.number().int().nullable(),
    status: ConfirmationStatusEnum,
    lastUpdated: z.number(),
});

export type PoolPriceState = z.infer<typeof PoolPriceStateSchema>;

// ─── RPC Response ───────────────────────────────────────
export const RPCPoolStateSchema = z.object({
    poolId: z.string(),
    price: z.number().positive(),
    blockNumber: z.number().int().nonnegative(),
});

export type RPCPoolState = z.infer<typeof RPCPoolStateSchema>;

export const RPCResponseSchema = z.object({
    pools: z.array(RPCPoolStateSchema),
    blockNumber: z.number().int().nonnegative(),
});

export type RPCResponse = z.infer<typeof RPCResponseSchema>;

// ─── Worker Messages (discriminated union) ──────────────
export const WorkerPriceBatchSchema = z.object({
    type: z.literal('PRICE_BATCH'),
    pools: z.array(
        z.object({
            poolId: z.string(),
            candle: OHLCCandleSchema,
            priceState: PoolPriceStateSchema,
        })
    ),
});

export const WorkerStatusSchema = z.object({
    type: z.literal('STATUS'),
    wsConnected: z.boolean(),
    rpcConnected: z.boolean(),
    pendingCount: z.number().int().nonnegative(),
});

export const WorkerErrorSchema = z.object({
    type: z.literal('ERROR'),
    message: z.string(),
    source: z.enum(['ws', 'rpc', 'worker']),
});

export const WorkerMessageSchema = z.discriminatedUnion('type', [
    WorkerPriceBatchSchema,
    WorkerStatusSchema,
    WorkerErrorSchema,
]);

export type WorkerPriceBatch = z.infer<typeof WorkerPriceBatchSchema>;
export type WorkerStatus = z.infer<typeof WorkerStatusSchema>;
export type WorkerError = z.infer<typeof WorkerErrorSchema>;
export type WorkerMessage = z.infer<typeof WorkerMessageSchema>;

// ─── Main → Worker Commands ─────────────────────────────
export const WorkerConfigSchema = z.object({
    type: z.literal('INIT'),
    wsUrl: z.string().url(),
    rpcUrl: z.string().url(),
    poolIds: z.array(z.string()),
});

export const WorkerCommandSchema = z.discriminatedUnion('type', [
    WorkerConfigSchema,
    z.object({ type: z.literal('STOP') }),
]);

export type WorkerConfig = z.infer<typeof WorkerConfigSchema>;
export type WorkerCommand = z.infer<typeof WorkerCommandSchema>;
