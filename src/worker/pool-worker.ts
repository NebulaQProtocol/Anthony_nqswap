import { CandlestickAggregator } from './aggregator';
import { ConfirmationGuard } from './confirmation-guard';
import { PriceUpdateSchema } from '@/lib/types';
import type { WorkerMessage, WorkerCommand, PriceUpdate } from '@/lib/types';
import {
    BATCH_INTERVAL_MS,
    RPC_POLL_FAST_MS,
    RPC_POLL_IDLE_MS,
} from '@/lib/constants';
import { calculateBackoff } from '@/lib/utils';

// ─── State ──────────────────────────────────────────────
const aggregator = new CandlestickAggregator();
const guard = new ConfirmationGuard();

let ws: WebSocket | null = null;
let rpcUrl: string = '';
let poolIds: string[] = [];
let wsConnected = false;
let rpcConnected = false;
let reconnectAttempt = 0;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let batchInterval: ReturnType<typeof setInterval> | null = null;
let rpcPollInterval: ReturnType<typeof setInterval> | null = null;

// ─── Worker Message Handler ─────────────────────────────

/**
 * Type-safe postMessage to main thread.
 */
function postWorkerMessage(msg: WorkerMessage): void {
    self.postMessage(msg);
}

/**
 * Connect to the WebSocket server.
 */
function connectWebSocket(url: string): void {
    try {
        ws = new WebSocket(url);

        ws.onopen = () => {
            console.log('[Worker] WebSocket connected');
            wsConnected = true;
            reconnectAttempt = 0;
            postWorkerMessage({
                type: 'STATUS',
                wsConnected: true,
                rpcConnected,
                pendingCount: guard.pendingCount,
            });
        };

        ws.onmessage = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data as string);

                if (data.type === 'PRICE_UPDATE') {
                    const parsed = PriceUpdateSchema.safeParse(data);
                    if (parsed.success) {
                        handlePriceUpdate(parsed.data);
                    }
                    // Silently drop invalid messages (counted in status)
                }
            } catch {
                // Malformed JSON — skip
            }
        };

        ws.onclose = () => {
            console.log('[Worker] WebSocket disconnected');
            wsConnected = false;
            postWorkerMessage({
                type: 'STATUS',
                wsConnected: false,
                rpcConnected,
                pendingCount: guard.pendingCount,
            });
            scheduleReconnect(url);
        };

        ws.onerror = () => {
            // onerror is always followed by onclose, so we handle reconnect there
            wsConnected = false;
        };
    } catch (err) {
        postWorkerMessage({
            type: 'ERROR',
            message: `WebSocket connection failed: ${err}`,
            source: 'ws',
        });
        scheduleReconnect(url);
    }
}

/**
 * Schedule a reconnection with exponential backoff.
 */
function scheduleReconnect(url: string): void {
    if (reconnectTimeout) clearTimeout(reconnectTimeout);

    const delay = calculateBackoff(reconnectAttempt);
    reconnectAttempt++;

    console.log(`[Worker] Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempt})`);
    reconnectTimeout = setTimeout(() => connectWebSocket(url), delay);
}

/**
 * Handle an incoming validated price update.
 */
function handlePriceUpdate(update: PriceUpdate): void {
    // Feed to aggregator for OHLC batching
    aggregator.onPriceUpdate(update);

    // Feed to confirmation guard as pending
    guard.addPending(update.poolId, update.price, update.blockNumber, update.txHash);
}

/**
 * Poll the RPC for confirmed block state.
 */
async function pollRPC(): Promise<void> {
    if (!rpcUrl || poolIds.length === 0) return;

    try {
        const response = await fetch(`${rpcUrl}/rpc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ poolIds }),
        });

        if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);

        const data = await response.json();

        if (data.pools && Array.isArray(data.pools)) {
            guard.confirmBlock(data.pools);
            rpcConnected = true;
        }
    } catch (err) {
        rpcConnected = false;
        postWorkerMessage({
            type: 'ERROR',
            message: `RPC poll failed: ${err}`,
            source: 'rpc',
        });
    }
}

/**
 * Flush aggregator and send batched update to main thread.
 */
function flushBatch(): void {
    const candles = aggregator.flush();
    if (candles.size === 0) return;

    // Expire stale pending entries
    guard.expireStale();

    // Build batch message
    const pools = Array.from(candles.entries()).map(([poolId, candle]) => ({
        poolId,
        candle,
        priceState: guard.getPoolState(poolId),
    }));

    postWorkerMessage({ type: 'PRICE_BATCH', pools });
}

/**
 * Start adaptive RPC polling.
 */
function startRPCPolling(): void {
    const poll = async () => {
        await pollRPC();
        // Adaptive: fast when pending, slow when idle
        const interval = guard.hasPendingPrices ? RPC_POLL_FAST_MS : RPC_POLL_IDLE_MS;
        rpcPollInterval = setTimeout(poll, interval) as unknown as ReturnType<typeof setInterval>;
    };
    poll();
}

/**
 * Stop all activity.
 */
function shutdown(): void {
    if (ws) {
        ws.close();
        ws = null;
    }
    if (batchInterval) {
        clearInterval(batchInterval);
        batchInterval = null;
    }
    if (rpcPollInterval) {
        clearTimeout(rpcPollInterval as unknown as number);
        rpcPollInterval = null;
    }
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
    aggregator.clear();
    guard.clear();
}

// ─── Incoming Commands from Main Thread ─────────────────
self.onmessage = (event: MessageEvent<WorkerCommand>) => {
    const command = event.data;

    switch (command.type) {
        case 'INIT':
            shutdown(); // Clean any previous state
            rpcUrl = command.rpcUrl;
            poolIds = command.poolIds;

            // Connect WebSocket
            connectWebSocket(command.wsUrl);

            // Start batch flushing at ~60fps
            batchInterval = setInterval(flushBatch, BATCH_INTERVAL_MS);

            // Start adaptive RPC polling
            startRPCPolling();

            console.log('[Worker] Initialized', { wsUrl: command.wsUrl, rpcUrl, poolIds });
            break;

        case 'STOP':
            shutdown();
            console.log('[Worker] Stopped');
            break;
    }
};
