'use client';

import { usePoolMap, usePoolStore } from '@/store/pool-store';
import { PoolRow } from './PoolRow';

export function PoolTable() {
    const poolsMap = usePoolMap();
    const pools = Array.from(poolsMap.values());
    const selectedPoolId = usePoolStore((s) => s.selectedPoolId);
    const selectPool = usePoolStore((s) => s.selectPool);

    return (
        <div className="pool-table-panel" id="pool-table-panel">
            <div className="pool-table-header">
                Top {pools.length} Pools
            </div>
            <div className="pool-table">
                {pools.length === 0 ? (
                    <div className="loading-state">
                        <div className="loading-spinner" />
                        Connecting to data feed...
                    </div>
                ) : (
                    pools.map((poolData) => (
                        <PoolRow
                            key={poolData.pool.id}
                            poolId={poolData.pool.id}
                            isSelected={poolData.pool.id === selectedPoolId}
                            onSelect={selectPool}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
