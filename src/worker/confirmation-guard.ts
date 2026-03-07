import type { PoolPriceState, ConfirmationStatus } from '@/lib/types';
import { PENDING_TTL_MS } from '@/lib/constants';

interface PendingEntry {
    price: number;
    blockNumber: number;
    timestamp: number;
    txHash: string;
}

/**
 * ConfirmationGuard: manages the dual-state price model (pending vs confirmed).
 *
 * - Pending prices come from WebSocket (fast, unreliable)
 * - Confirmed prices come from RPC (slow, reliable)
 * - Pending prices are promoted or rejected when RPC data arrives
 *
 * This runs inside a Web Worker.
 */
export class ConfirmationGuard {
    /** Map of poolId → array of pending price entries (ordered by arrival) */
    private pending: Map<string, PendingEntry[]> = new Map();

    /** Map of poolId → last confirmed state */
    private confirmed: Map<string, { price: number; blockNumber: number }> = new Map();

    /**
     * Add a pending price from WebSocket.
     * Deduplicates by txHash within the same pool.
     */
    addPending(poolId: string, price: number, blockNumber: number, txHash: string): void {
        if (!this.pending.has(poolId)) {
            this.pending.set(poolId, []);
        }

        const entries = this.pending.get(poolId)!;

        // Deduplicate by txHash (idempotent)
        if (entries.some((e) => e.txHash === txHash)) {
            return;
        }

        entries.push({
            price,
            blockNumber,
            timestamp: Date.now(),
            txHash,
        });
    }

    /**
     * Confirm a block from RPC. For each pool:
     * - If RPC provides a confirmed price, it becomes the source of truth
     * - All pending entries at or below the confirmed block number are discarded
     * - RPC price always wins over pending price
     */
    confirmBlock(
        confirmedPools: { poolId: string; price: number; blockNumber: number }[]
    ): void {
        for (const { poolId, price, blockNumber } of confirmedPools) {
            // Update confirmed state
            const existing = this.confirmed.get(poolId);
            // Only update if this block number is higher (prevents out-of-order issues)
            if (!existing || blockNumber >= existing.blockNumber) {
                this.confirmed.set(poolId, { price, blockNumber });
            }

            // Remove pending entries at or below confirmed block
            const entries = this.pending.get(poolId);
            if (entries) {
                const remaining = entries.filter((e) => e.blockNumber > blockNumber);
                if (remaining.length === 0) {
                    this.pending.delete(poolId);
                } else {
                    this.pending.set(poolId, remaining);
                }
            }
        }
    }

    /**
     * Expire stale pending entries older than PENDING_TTL_MS.
     */
    expireStale(now: number = Date.now()): number {
        let expiredCount = 0;

        for (const [poolId, entries] of this.pending) {
            const remaining = entries.filter((e) => {
                const isStale = now - e.timestamp > PENDING_TTL_MS;
                if (isStale) expiredCount++;
                return !isStale;
            });

            if (remaining.length === 0) {
                this.pending.delete(poolId);
            } else {
                this.pending.set(poolId, remaining);
            }
        }

        return expiredCount;
    }

    /**
     * Get the current price state for a pool (dual-state model).
     */
    getPoolState(poolId: string): PoolPriceState {
        const confirmedState = this.confirmed.get(poolId);
        const pendingEntries = this.pending.get(poolId);

        // Latest pending price (most recent entry)
        const latestPending = pendingEntries?.[pendingEntries.length - 1] ?? null;

        let status: ConfirmationStatus = 'confirmed';
        if (!confirmedState) {
            status = latestPending ? 'pending' : 'stale';
        } else if (latestPending) {
            status = 'pending';
        }

        return {
            poolId,
            pendingPrice: latestPending?.price ?? null,
            confirmedPrice: confirmedState?.price ?? null,
            pendingBlockNumber: latestPending?.blockNumber ?? null,
            confirmedBlockNumber: confirmedState?.blockNumber ?? null,
            status,
            lastUpdated: Date.now(),
        };
    }

    /**
     * Get the total number of pending entries across all pools.
     */
    get pendingCount(): number {
        let count = 0;
        for (const entries of this.pending.values()) {
            count += entries.length;
        }
        return count;
    }

    /**
     * Get all pool IDs that have any state (pending or confirmed).
     */
    get knownPoolIds(): string[] {
        const ids = new Set<string>();
        for (const id of this.pending.keys()) ids.add(id);
        for (const id of this.confirmed.keys()) ids.add(id);
        return Array.from(ids);
    }

    /**
     * Check if any pools have pending prices (used for adaptive polling).
     */
    get hasPendingPrices(): boolean {
        return this.pending.size > 0;
    }

    /**
     * Reset all state.
     */
    clear(): void {
        this.pending.clear();
        this.confirmed.clear();
    }
}
