# nQ-Swap Real-Time DEX Monitoring Dashboard: Architectural Thoughts & Trade-offs

This document outlines the key architectural decisions, performance optimizations, and trade-offs made while building the nQ-Swap DEX monitoring dashboard.

## 1. The Block Confirmation Guard (Dual-State Price Model)
The core challenge of this project was reconciling a fast, unreliable WebSocket feed (pending prices) with a slow, reliable RPC feed (confirmed prices), while gracefully handling blockchain reorganizations.

**Solution: The `ConfirmationGuard`**
- **Idempotency**: WebSocket updates are deduplicated by `txHash` to handle duplicate events safely.
- **Higher-Block-Wins**: The RPC acts as the absolute source of truth. When the RPC confirms a block, the guard immediately promotes that block's price and discards any pending prices <= that block number.
- **Reorg Handling**: If the WebSocket emits a price for block `N`, but the RPC later confirms a different price for block `N` (or a later block without that transaction), the pending price is safely overwritten or discarded. The app inherently trusts the RPC.
- **Stale Expiry (TTL)**: Pending prices older than 60 seconds (configurable via `PENDING_TTL_MS`) are aggressively garbage collected to prevent memory leaks from dropped WebSocket connections or abandoned transactions.

## 2. Web Worker Data Pipeline (1000 updates/sec)
React's rendering cycle fundamentally cannot handle 1000 state updates per second without freezing the main thread. 

**Solution: `CandlestickAggregator` in a Dedicated Thread**
- All WebSocket connections, Zod parsing, and RPC polling happen inside a background Web Worker (`pool-worker.ts`).
- **OHLC Batching**: The aggregator batches thousands of raw price points into Open-High-Low-Close (OHLC) candles. The worker flushes these candles to the main thread at a fixed 60fps interval (`BATCH_INTERVAL_MS = 16`).
- **Result**: The main thread only receives 60 messages per second, regardless of whether the WebSocket sends 100 or 10,000 updates per second. UI performance remains perfectly silky smooth.

## 3. Zustand Ring Buffers & Atomic Selectors
Even with 60fps batching, storing infinite time-series data would eventually crash the browser tab (OOM).

**Solution:**
- **Ring Buffer**: The Zustand store limits chart history to the last 500 candles per pool (`MAX_CANDLES_PER_POOL`). Older candles are dropped sequentially.
- **Atomic Selectors**: React components use fine-grained selectors (e.g., `usePoolData(poolId)`) rather than subscribing to the entire store. `PoolRow` components are wrapped in `React.memo` and only re-render when their specific pool data changes. The `ConnectionStatus` badge uses an entirely separate `connection-store` to prevent pool price updates from triggering header re-renders.

## 4. Imperative Chart Updates (Lightweight Charts)
Declarative React wrappers for charts (like Recharts) often struggle with high-frequency updates because they require a full DOM diffing cycle for every data point.

**Solution:**
- We chose TradingView's `lightweight-charts` mapped to a plain `HTMLDivElement` `ref`.
- **Bypassing React**: The `CandlestickChart` component receives new data via a `useEffect` and calls `series.setData()` imperatively. This sidesteps React's Virtual DOM entirely, interacting directly with the Canvas API for maximum performance.

## 5. Type Safety & RPC
- **tRPC**: Chose over REST/GraphQL for effortless end-to-end type safety between the mock server, the Next.js API route, and the client.
- **Zod**: Used strictly at the system boundaries. The Web Worker parses raw WebSocket JSON against `PriceUpdateSchema`. The RPC client parses responses against `RPCResponseSchema`. This ensures malformed data from upstream providers never poisons our internal state.

## 6. Resilience & Adaptive Polling
- **Exponential Backoff**: Both the WebSocket client and Web Worker implement reconnect logic with jitter to prevent thundering herd problems on upstream services.
- **Adaptive RPC Polling**: The worker polls the RPC aggressively (`1s`) only when there are pending prices awaiting confirmation. When idle, it slows down to `10s` to save RPC compute resources.

## Conclusion & Future Scaling
This architecture safely scales to handle thousands of updates per second on the client. If we were to transition this to a production backend, the heavy lifting (Zod validation, OHLC aggregation, and race-condition resolution) could be moved to a robust Go or Rust microservice, replacing the browser Web Worker with a single, pre-aggregated server-side WebSocket feed directly to the client.
