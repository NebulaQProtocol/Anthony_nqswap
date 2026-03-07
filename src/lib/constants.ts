// ─── Batching & Worker ──────────────────────────────────
/** Interval (ms) at which the worker flushes batched OHLC updates to the main thread. ~60fps. */
export const BATCH_INTERVAL_MS = 16;

/** Maximum number of candles retained per pool (ring buffer). */
export const MAX_CANDLES_PER_POOL = 500;

/** Time-to-live (ms) for pending prices before they are auto-discarded. */
export const PENDING_TTL_MS = 60_000;

// ─── RPC Polling ────────────────────────────────────────
/** RPC polling interval (ms) when there are pending prices to confirm. */
export const RPC_POLL_FAST_MS = 2_000;

/** RPC polling interval (ms) when idle (no pending prices). */
export const RPC_POLL_IDLE_MS = 10_000;

// ─── WebSocket Reconnection ─────────────────────────────
/** Base delay (ms) for exponential backoff reconnection. */
export const WS_RECONNECT_BASE_MS = 1_000;

/** Maximum delay (ms) for exponential backoff reconnection. */
export const WS_RECONNECT_MAX_MS = 30_000;

// ─── Mock Server Defaults ───────────────────────────────
/** Default mock WS update rate (updates per second). */
export const MOCK_UPDATE_RATE = 100;

/** Default mock reorg rate (probability 0-1 that a block is reorg'd). */
export const MOCK_REORG_RATE = 0.05;

// ─── URLs (defaults, overridden by env) ─────────────────
export const DEFAULT_WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';
export const DEFAULT_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8081';

// ─── UI ─────────────────────────────────────────────────
/** Number of top pools to display. */
export const TOP_POOLS_COUNT = 10;

/** CSS color for pending (unconfirmed) prices. */
export const PENDING_COLOR = '#f59e0b'; // amber-500

/** CSS color for confirmed prices. */
export const CONFIRMED_COLOR = '#22c55e'; // green-500

/** CSS color for stale prices. */
export const STALE_COLOR = '#ef4444'; // red-500
