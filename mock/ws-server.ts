import { WebSocketServer, WebSocket } from 'ws';
import { SEED_POOLS } from './data/seed-pools';

const WS_PORT = parseInt(process.env.WS_PORT || '8080', 10);
const UPDATE_RATE = parseInt(process.env.MOCK_UPDATE_RATE || '100', 10);
const REORG_RATE = parseFloat(process.env.MOCK_REORG_RATE || '0.05');

// Track current prices and block number
const currentPrices: Map<string, number> = new Map();
let currentBlockNumber = 1000;
let reorgBlocks: Set<number> = new Set(); // blocks that will be reorg'd

// Initialize prices
SEED_POOLS.forEach((pool) => {
    currentPrices.set(pool.id, pool.initialPrice);
});

/**
 * Generate a random price walk: ±0.1% to ±1% per tick.
 */
function walkPrice(current: number): number {
    const changePercent = (Math.random() - 0.5) * 0.02; // ±1%
    const newPrice = current * (1 + changePercent);
    return Math.max(newPrice, 0.000001); // Prevent zero/negative
}

/**
 * Advance block number periodically (every ~2 seconds simulates ~12s Ethereum blocks).
 */
function advanceBlock(): void {
    currentBlockNumber++;
    // Mark some blocks for reorg
    if (Math.random() < REORG_RATE) {
        reorgBlocks.add(currentBlockNumber);
        console.log(`[Mock WS] Block ${currentBlockNumber} will be reorg'd`);
    }
}

// Advance block every 2 seconds
setInterval(advanceBlock, 2000);

export function startWebSocketServer(): WebSocketServer {
    const wss = new WebSocketServer({ port: WS_PORT });

    console.log(`[Mock WS] Server listening on port ${WS_PORT} (rate: ${UPDATE_RATE}/s, reorg: ${REORG_RATE * 100}%)`);

    wss.on('connection', (ws: WebSocket) => {
        console.log('[Mock WS] Client connected');

        // Send initial pool list
        ws.send(JSON.stringify({
            type: 'POOLS',
            pools: SEED_POOLS.map(({ initialPrice, ...pool }) => pool),
        }));

        // Start sending price updates at the configured rate
        const interval = setInterval(() => {
            if (ws.readyState !== WebSocket.OPEN) return;

            // Pick a random pool to update
            const pool = SEED_POOLS[Math.floor(Math.random() * SEED_POOLS.length)];
            const oldPrice = currentPrices.get(pool.id)!;
            const newPrice = walkPrice(oldPrice);
            currentPrices.set(pool.id, newPrice);

            const update = {
                type: 'PRICE_UPDATE',
                poolId: pool.id,
                price: newPrice,
                blockNumber: currentBlockNumber,
                txHash: `0x${Math.random().toString(16).slice(2, 18)}`,
                timestamp: Date.now(),
            };

            ws.send(JSON.stringify(update));
        }, 1000 / UPDATE_RATE);

        ws.on('close', () => {
            console.log('[Mock WS] Client disconnected');
            clearInterval(interval);
        });

        ws.on('error', (err) => {
            console.error('[Mock WS] Error:', err.message);
            clearInterval(interval);
        });
    });

    return wss;
}

// Export reorg state for RPC server to query
export function isReorgBlock(blockNumber: number): boolean {
    return reorgBlocks.has(blockNumber);
}

export function getConfirmedPrices(): Map<string, { price: number; blockNumber: number }> {
    const confirmed = new Map<string, { price: number; blockNumber: number }>();
    // Confirmed prices lag behind by 1-3 blocks, and exclude reorg'd blocks
    const confirmedBlock = currentBlockNumber - 2; // 2 block lag
    SEED_POOLS.forEach((pool) => {
        const price = currentPrices.get(pool.id)!;
        // If the current block was reorg'd, use a slightly different price
        if (reorgBlocks.has(confirmedBlock)) {
            // Reorg: don't confirm this block's price, use previous
            confirmed.set(pool.id, {
                price: price * (1 + (Math.random() - 0.5) * 0.005), // slightly different
                blockNumber: confirmedBlock - 1,
            });
        } else {
            confirmed.set(pool.id, { price, blockNumber: confirmedBlock });
        }
    });
    return confirmed;
}

export function getCurrentBlockNumber(): number {
    return currentBlockNumber;
}
