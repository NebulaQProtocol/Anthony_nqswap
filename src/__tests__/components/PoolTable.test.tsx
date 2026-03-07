// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { usePoolStore } from '@/store/pool-store';
import { PoolTable } from '@/components/pool-table/PoolTable';
import type { Pool, WorkerPriceBatch } from '@/lib/types';

const MOCK_POOLS: Pool[] = [
    { id: 'pool-1', name: 'ETH/USDC', tokenA: 'ETH', tokenB: 'USDC', tvl: 125000000, volume24h: 45000000 },
    { id: 'pool-2', name: 'BTC/USDC', tokenA: 'BTC', tokenB: 'USDC', tvl: 280000000, volume24h: 92000000 },
    { id: 'pool-3', name: 'SOL/USDC', tokenA: 'SOL', tokenB: 'USDC', tvl: 35000000, volume24h: 18000000 },
];

describe('PoolTable', () => {
    beforeEach(() => {
        usePoolStore.setState({ pools: new Map(), selectedPoolId: null });
    });

    it('shows loading state when no pools exist', () => {
        render(<PoolTable />);
        expect(screen.getByText('Connecting to data feed...')).toBeDefined();
    });

    it('renders all pool rows after initialization', () => {
        usePoolStore.getState().initPools(MOCK_POOLS);
        render(<PoolTable />);

        expect(screen.getAllByText('ETH/USDC').length).toBeGreaterThan(0);
        expect(screen.getAllByText('BTC/USDC').length).toBeGreaterThan(0);
        expect(screen.getAllByText('SOL/USDC').length).toBeGreaterThan(0);
    });

    it('shows correct pool count in header', () => {
        usePoolStore.getState().initPools(MOCK_POOLS);
        render(<PoolTable />);

        expect(screen.getByText('Top 3 Pools')).toBeDefined();
    });

    it('renders pending price with pending CSS class', () => {
        usePoolStore.getState().initPools(MOCK_POOLS);

        const batch: WorkerPriceBatch = {
            type: 'PRICE_BATCH',
            pools: [
                {
                    poolId: 'pool-1',
                    candle: { time: 1700000000, open: 1850, high: 1860, low: 1845, close: 1855 },
                    priceState: {
                        poolId: 'pool-1',
                        pendingPrice: 1855,
                        confirmedPrice: 1850,
                        pendingBlockNumber: 1001,
                        confirmedBlockNumber: 1000,
                        status: 'pending',
                        lastUpdated: Date.now(),
                    },
                },
            ],
        };
        usePoolStore.getState().applyBatch(batch);

        render(<PoolTable />);

        const priceElement = document.querySelector('#pool-row-pool-1 .pool-price');
        expect(priceElement?.classList.contains('pending')).toBe(true);
    });

    it('renders confirmed price with confirmed CSS class', () => {
        usePoolStore.getState().initPools(MOCK_POOLS);

        const batch: WorkerPriceBatch = {
            type: 'PRICE_BATCH',
            pools: [
                {
                    poolId: 'pool-1',
                    candle: { time: 1700000000, open: 1850, high: 1860, low: 1845, close: 1855 },
                    priceState: {
                        poolId: 'pool-1',
                        pendingPrice: null,
                        confirmedPrice: 1855,
                        pendingBlockNumber: null,
                        confirmedBlockNumber: 1001,
                        status: 'confirmed',
                        lastUpdated: Date.now(),
                    },
                },
            ],
        };
        usePoolStore.getState().applyBatch(batch);

        render(<PoolTable />);

        const priceElement = document.querySelector('#pool-row-pool-1 .pool-price');
        expect(priceElement?.classList.contains('confirmed')).toBe(true);
    });
});
