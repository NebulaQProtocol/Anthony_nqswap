'use client';

import { useMemo, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { CandlestickChart } from '@/components/chart/CandlestickChart';
import { PoolTable } from '@/components/pool-table/PoolTable';
import { usePoolWorker } from '@/hooks/usePoolWorker';
import { usePoolStore } from '@/store/pool-store';
import { SEED_POOL_IDS } from '@/lib/seed-pool-ids';

export default function DashboardPage() {
  const initPools = usePoolStore((s) => s.initPools);

  // Initialize pools on mount
  useEffect(() => {
    // In a real app, this would come from the tRPC query.
    // For the MVP, we initialize with seed data so the worker can start immediately.
    initPools(SEED_POOL_IDS.map((id) => ({
      id,
      name: id.replace('pool-', '').replace(/-/g, '/').toUpperCase(),
      tokenA: id.replace('pool-', '').split('-')[0].toUpperCase(),
      tokenB: id.replace('pool-', '').split('-')[1]?.toUpperCase() || 'USDC',
      tvl: 0,
      volume24h: 0,
    })));
  }, [initPools]);

  const poolIds = useMemo(() => SEED_POOL_IDS, []);

  // Start the Web Worker data pipeline
  usePoolWorker(poolIds);

  return (
    <div className="dashboard">
      <Header />
      <div className="dashboard-content">
        <CandlestickChart />
        <PoolTable />
      </div>
    </div>
  );
}
