import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmationGuard } from '@/worker/confirmation-guard';

describe('ConfirmationGuard', () => {
    let guard: ConfirmationGuard;

    beforeEach(() => {
        guard = new ConfirmationGuard();
    });

    // ─── Edge Case 1: WS + RPC confirm same value → confirmed ───
    it('promotes pending to confirmed when RPC confirms same price', () => {
        guard.addPending('pool-1', 100, 1000, 'tx-1');
        guard.confirmBlock([{ poolId: 'pool-1', price: 100, blockNumber: 1000 }]);

        const state = guard.getPoolState('pool-1');
        expect(state.status).toBe('confirmed');
        expect(state.confirmedPrice).toBe(100);
        expect(state.pendingPrice).toBeNull(); // pending cleared
    });

    // ─── Edge Case 2: WS + RPC confirm different value → RPC wins ───
    it('uses RPC price when it differs from pending', () => {
        guard.addPending('pool-1', 105, 1000, 'tx-1');
        guard.confirmBlock([{ poolId: 'pool-1', price: 100, blockNumber: 1000 }]);

        const state = guard.getPoolState('pool-1');
        expect(state.confirmedPrice).toBe(100); // RPC wins
        expect(state.pendingPrice).toBeNull(); // pending at block 1000 cleared
    });

    // ─── Edge Case 3: WS + no RPC confirm (reorg) → pending cleared by later block ───
    it('discards pending when RPC confirms a later block without that price', () => {
        guard.addPending('pool-1', 105, 1000, 'tx-1');
        // RPC confirms block 1001 with a different price (block 1000 was reorg'd)
        guard.confirmBlock([{ poolId: 'pool-1', price: 99, blockNumber: 1001 }]);

        const state = guard.getPoolState('pool-1');
        expect(state.confirmedPrice).toBe(99); // RPC's confirmed price
        expect(state.pendingPrice).toBeNull(); // pending at block 1000 discarded (< 1001)
        expect(state.status).toBe('confirmed');
    });

    // ─── Edge Case 4: 5 WS updates before any RPC → oldest expire ───
    it('accumulates multiple pending entries and expires old ones', () => {
        const baseTime = 1700000000000;

        // Use fake timers for deterministic timestamps
        vi.useFakeTimers();

        vi.setSystemTime(baseTime - 70000); // tx-1: 70s before expiry check (stale)
        guard.addPending('pool-1', 100, 1000, 'tx-1');

        vi.setSystemTime(baseTime - 65000); // tx-2: 65s before (stale)
        guard.addPending('pool-1', 101, 1001, 'tx-2');

        vi.setSystemTime(baseTime - 50000); // tx-3: 50s before (fresh — TTL is 60s)
        guard.addPending('pool-1', 102, 1002, 'tx-3');

        vi.setSystemTime(baseTime - 30000); // tx-4: 30s before (fresh)
        guard.addPending('pool-1', 103, 1003, 'tx-4');

        vi.setSystemTime(baseTime - 10000); // tx-5: 10s before (fresh)
        guard.addPending('pool-1', 104, 1004, 'tx-5');

        const expired = guard.expireStale(baseTime);
        expect(expired).toBe(2); // tx-1 and tx-2 expired (>60s old)

        const state = guard.getPoolState('pool-1');
        expect(state.pendingPrice).toBe(104); // latest fresh pending
        expect(state.status).toBe('pending');

        vi.useRealTimers();
    });

    // ─── Edge Case 5: RPC confirms with no prior WS → direct confirmed ───
    it('sets confirmed state directly when no pending exists', () => {
        guard.confirmBlock([{ poolId: 'pool-1', price: 100, blockNumber: 1000 }]);

        const state = guard.getPoolState('pool-1');
        expect(state.confirmedPrice).toBe(100);
        expect(state.pendingPrice).toBeNull();
        expect(state.status).toBe('confirmed');
    });

    // ─── Edge Case 6: WS disconnects → pending prices freeze ───
    it('retains pending prices when no new updates come', () => {
        guard.addPending('pool-1', 100, 1000, 'tx-1');

        // No more updates (WS disconnected), but state persists
        const state = guard.getPoolState('pool-1');
        expect(state.pendingPrice).toBe(100);
        expect(state.status).toBe('pending');
    });

    // ─── Edge Case 7: RPC returns error → last confirmed prices retained ───
    it('retains last confirmed price when no new RPC data arrives', () => {
        guard.confirmBlock([{ poolId: 'pool-1', price: 100, blockNumber: 1000 }]);

        // Simulate RPC failure: no confirmBlock call
        // New pending comes in
        guard.addPending('pool-1', 105, 1001, 'tx-1');

        const state = guard.getPoolState('pool-1');
        expect(state.confirmedPrice).toBe(100); // old confirmed retained
        expect(state.pendingPrice).toBe(105);
        expect(state.status).toBe('pending');
    });

    // ─── Edge Case 8: Multiple pools update simultaneously → independent ───
    it('manages each pool state independently', () => {
        guard.addPending('pool-1', 100, 1000, 'tx-1');
        guard.addPending('pool-2', 200, 1000, 'tx-2');

        guard.confirmBlock([{ poolId: 'pool-1', price: 100, blockNumber: 1000 }]);

        const state1 = guard.getPoolState('pool-1');
        const state2 = guard.getPoolState('pool-2');

        expect(state1.status).toBe('confirmed');
        expect(state1.pendingPrice).toBeNull();
        expect(state2.status).toBe('pending'); // pool-2 not confirmed
        expect(state2.pendingPrice).toBe(200);
    });

    // ─── Edge Case 9: Block numbers arrive out of order → highest wins ───
    it('ignores confirmation with lower block number than existing', () => {
        guard.confirmBlock([{ poolId: 'pool-1', price: 100, blockNumber: 1005 }]);
        guard.confirmBlock([{ poolId: 'pool-1', price: 90, blockNumber: 1003 }]); // older block

        const state = guard.getPoolState('pool-1');
        expect(state.confirmedPrice).toBe(100); // block 1005 price retained
    });

    // ─── Edge Case 10: Duplicate WS messages (same tx twice) → idempotent ───
    it('deduplicates pending entries by txHash', () => {
        guard.addPending('pool-1', 100, 1000, 'tx-same');
        guard.addPending('pool-1', 100, 1000, 'tx-same'); // duplicate
        guard.addPending('pool-1', 100, 1000, 'tx-same'); // duplicate

        expect(guard.pendingCount).toBe(1); // only one entry
    });

    // ─── Additional Tests ───────────────────────────────────

    it('reports stale status when no data exists for a pool', () => {
        const state = guard.getPoolState('pool-unknown');
        expect(state.status).toBe('stale');
        expect(state.confirmedPrice).toBeNull();
        expect(state.pendingPrice).toBeNull();
    });

    it('hasPendingPrices returns false when all confirmed', () => {
        guard.addPending('pool-1', 100, 1000, 'tx-1');
        expect(guard.hasPendingPrices).toBe(true);

        guard.confirmBlock([{ poolId: 'pool-1', price: 100, blockNumber: 1000 }]);
        expect(guard.hasPendingPrices).toBe(false);
    });

    it('knownPoolIds returns all pools with any state', () => {
        guard.addPending('pool-1', 100, 1000, 'tx-1');
        guard.confirmBlock([{ poolId: 'pool-2', price: 200, blockNumber: 1000 }]);

        const ids = guard.knownPoolIds;
        expect(ids).toContain('pool-1');
        expect(ids).toContain('pool-2');
    });

    it('clear removes all state', () => {
        guard.addPending('pool-1', 100, 1000, 'tx-1');
        guard.confirmBlock([{ poolId: 'pool-2', price: 200, blockNumber: 1000 }]);
        guard.clear();

        expect(guard.pendingCount).toBe(0);
        expect(guard.knownPoolIds).toEqual([]);
    });

    it('pending entries for blocks above confirmed block persist', () => {
        guard.addPending('pool-1', 100, 1000, 'tx-1');
        guard.addPending('pool-1', 105, 1002, 'tx-2'); // future block

        guard.confirmBlock([{ poolId: 'pool-1', price: 99, blockNumber: 1001 }]);

        // tx-1 (block 1000) should be cleared, tx-2 (block 1002) should persist
        const state = guard.getPoolState('pool-1');
        expect(state.confirmedPrice).toBe(99);
        expect(state.pendingPrice).toBe(105); // still pending
        expect(state.status).toBe('pending');
    });
});
