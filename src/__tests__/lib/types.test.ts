import { describe, it, expect } from 'vitest';
import {
    PoolSchema,
    PriceUpdateSchema,
    OHLCCandleSchema,
    ConfirmationStatusEnum,
    PoolPriceStateSchema,
    RPCPoolStateSchema,
    RPCResponseSchema,
    WorkerMessageSchema,
    WorkerCommandSchema,
} from '@/lib/types';

describe('PoolSchema', () => {
    it('accepts valid pool data', () => {
        const valid = {
            id: 'pool-1',
            name: 'ETH/USDC',
            tokenA: 'ETH',
            tokenB: 'USDC',
            tvl: 1_000_000,
            volume24h: 500_000,
        };
        expect(PoolSchema.parse(valid)).toEqual(valid);
    });

    it('rejects negative TVL', () => {
        const invalid = {
            id: 'pool-1',
            name: 'ETH/USDC',
            tokenA: 'ETH',
            tokenB: 'USDC',
            tvl: -100,
            volume24h: 500_000,
        };
        expect(() => PoolSchema.parse(invalid)).toThrow();
    });

    it('rejects missing fields', () => {
        expect(() => PoolSchema.parse({ id: 'pool-1' })).toThrow();
    });
});

describe('PriceUpdateSchema', () => {
    it('accepts valid price update', () => {
        const valid = {
            poolId: 'pool-1',
            price: 1850.50,
            blockNumber: 12345,
            txHash: '0xabc123',
            timestamp: Date.now(),
        };
        expect(PriceUpdateSchema.parse(valid)).toEqual(valid);
    });

    it('rejects zero price', () => {
        const invalid = {
            poolId: 'pool-1',
            price: 0,
            blockNumber: 12345,
            txHash: '0xabc123',
            timestamp: Date.now(),
        };
        expect(() => PriceUpdateSchema.parse(invalid)).toThrow();
    });

    it('rejects negative price', () => {
        const invalid = {
            poolId: 'pool-1',
            price: -10,
            blockNumber: 12345,
            txHash: '0xabc123',
            timestamp: Date.now(),
        };
        expect(() => PriceUpdateSchema.parse(invalid)).toThrow();
    });

    it('rejects float block numbers', () => {
        const invalid = {
            poolId: 'pool-1',
            price: 100,
            blockNumber: 12345.5,
            txHash: '0xabc123',
            timestamp: Date.now(),
        };
        expect(() => PriceUpdateSchema.parse(invalid)).toThrow();
    });
});

describe('OHLCCandleSchema', () => {
    it('accepts valid candle', () => {
        const valid = { time: 1700000000, open: 100, high: 110, low: 95, close: 105 };
        expect(OHLCCandleSchema.parse(valid)).toEqual(valid);
    });
});

describe('ConfirmationStatusEnum', () => {
    it('accepts valid statuses', () => {
        expect(ConfirmationStatusEnum.parse('pending')).toBe('pending');
        expect(ConfirmationStatusEnum.parse('confirmed')).toBe('confirmed');
        expect(ConfirmationStatusEnum.parse('stale')).toBe('stale');
    });

    it('rejects invalid status', () => {
        expect(() => ConfirmationStatusEnum.parse('unknown')).toThrow();
    });
});

describe('PoolPriceStateSchema', () => {
    it('accepts valid price state with nulls', () => {
        const valid = {
            poolId: 'pool-1',
            pendingPrice: null,
            confirmedPrice: 1850.50,
            pendingBlockNumber: null,
            confirmedBlockNumber: 12345,
            status: 'confirmed' as const,
            lastUpdated: Date.now(),
        };
        expect(PoolPriceStateSchema.parse(valid)).toEqual(valid);
    });

    it('accepts pending state', () => {
        const valid = {
            poolId: 'pool-1',
            pendingPrice: 1855.0,
            confirmedPrice: 1850.50,
            pendingBlockNumber: 12346,
            confirmedBlockNumber: 12345,
            status: 'pending' as const,
            lastUpdated: Date.now(),
        };
        expect(PoolPriceStateSchema.parse(valid)).toEqual(valid);
    });
});

describe('RPCResponseSchema', () => {
    it('accepts valid batched response', () => {
        const valid = {
            pools: [
                { poolId: 'pool-1', price: 1850.50, blockNumber: 12345 },
                { poolId: 'pool-2', price: 42000.0, blockNumber: 12345 },
            ],
            blockNumber: 12345,
        };
        expect(RPCResponseSchema.parse(valid)).toEqual(valid);
    });

    it('rejects pools with zero price', () => {
        const invalid = {
            pools: [{ poolId: 'pool-1', price: 0, blockNumber: 12345 }],
            blockNumber: 12345,
        };
        expect(() => RPCResponseSchema.parse(invalid)).toThrow();
    });
});

describe('WorkerMessageSchema (discriminated union)', () => {
    it('accepts PRICE_BATCH message', () => {
        const msg = {
            type: 'PRICE_BATCH' as const,
            pools: [
                {
                    poolId: 'pool-1',
                    candle: { time: 1700000000, open: 100, high: 110, low: 95, close: 105 },
                    priceState: {
                        poolId: 'pool-1',
                        pendingPrice: 105,
                        confirmedPrice: 100,
                        pendingBlockNumber: 12346,
                        confirmedBlockNumber: 12345,
                        status: 'pending' as const,
                        lastUpdated: Date.now(),
                    },
                },
            ],
        };
        expect(WorkerMessageSchema.parse(msg)).toEqual(msg);
    });

    it('accepts STATUS message', () => {
        const msg = {
            type: 'STATUS' as const,
            wsConnected: true,
            rpcConnected: true,
            pendingCount: 3,
        };
        expect(WorkerMessageSchema.parse(msg)).toEqual(msg);
    });

    it('accepts ERROR message', () => {
        const msg = {
            type: 'ERROR' as const,
            message: 'Connection lost',
            source: 'ws' as const,
        };
        expect(WorkerMessageSchema.parse(msg)).toEqual(msg);
    });

    it('rejects unknown message type', () => {
        const msg = { type: 'UNKNOWN', data: 'test' };
        expect(() => WorkerMessageSchema.parse(msg)).toThrow();
    });
});

describe('WorkerCommandSchema', () => {
    it('accepts INIT command', () => {
        const cmd = {
            type: 'INIT' as const,
            wsUrl: 'ws://localhost:8080',
            rpcUrl: 'http://localhost:8081',
            poolIds: ['pool-1', 'pool-2'],
        };
        expect(WorkerCommandSchema.parse(cmd)).toEqual(cmd);
    });

    it('accepts STOP command', () => {
        const cmd = { type: 'STOP' as const };
        expect(WorkerCommandSchema.parse(cmd)).toEqual(cmd);
    });

    it('rejects INIT with invalid URL', () => {
        const cmd = {
            type: 'INIT' as const,
            wsUrl: 'not-a-url',
            rpcUrl: 'http://localhost:8081',
            poolIds: ['pool-1'],
        };
        expect(() => WorkerCommandSchema.parse(cmd)).toThrow();
    });
});
