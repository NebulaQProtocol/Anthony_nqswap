'use client';

import React from 'react';
import { usePoolStore, usePoolData } from '@/store/pool-store';
import { formatPrice, formatCompact } from '@/lib/utils';
import type { ConfirmationStatus } from '@/lib/types';

interface PoolRowProps {
    poolId: string;
    isSelected: boolean;
    onSelect: (poolId: string) => void;
}

/**
 * PoolRow: memoized table row for a single pool.
 * Only re-renders when this pool's data changes (via atomic selector).
 */
export const PoolRow = React.memo(function PoolRow({ poolId, isSelected, onSelect }: PoolRowProps) {
    const poolData = usePoolData(poolId);

    if (!poolData) return null;

    const { pool, priceState } = poolData;
    const displayPrice = priceState.pendingPrice ?? priceState.confirmedPrice;
    const status: ConfirmationStatus = priceState.status;

    return (
        <div
            className={`pool-row ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelect(poolId)}
            id={`pool-row-${poolId}`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelect(poolId)}
        >
            <div className="pool-name-cell">
                <span className="name">
                    <span className={`status-dot ${status}`} />
                    {pool.name}
                </span>
                <span className="pair">{pool.tokenA}/{pool.tokenB}</span>
            </div>
            <div className={`pool-price ${status}`}>
                {displayPrice ? formatPrice(displayPrice) : '—'}
            </div>
            <div className="pool-tvl">
                ${formatCompact(pool.tvl)}
            </div>
        </div>
    );
});
