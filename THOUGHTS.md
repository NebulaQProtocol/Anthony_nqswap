# nQ-Swap Dashboard: Architectural Notes & Trade-offs

Here are some notes on how I approached the real-time DEX dashboard, specifically around state management and performance. Parsing 1,000 updates a second in the browser is usually a recipe for a frozen tab, so I had to make some specific architectural decisions to keep things smooth.

## The Dual-State Price Model (WS vs RPC)
The biggest challenge was dealing with the race conditions between the fast, noisy mempool WebSocket and the slow, reliable RPC node. 

I ended up building a `ConfirmationGuard` class to manage this. 
- It treats the RPC as absolute law. If the RPC confirms a block, we instantly promote that price and dump any pending prices from the WS that are from the same or older blocks.
- To handle duplicate WS events (which happens constantly with real mempools), the guard dedupes everything against the `txHash`.
- To handle reorgs: if the WS emits a price, but the RPC later confirms a different price for that same block, we just overwrite the pending price. The UI inherently trusts the RPC over the WS.
- I also added a 60-second TTL to pending prices. If the RPC never confirms a transaction (maybe it got dropped from the mempool or the WS disconnected), we just expire it. This prevents the pending queue from leaking memory over time.

## State Management (Why Zustand?)
Trying to push 1000 updates a second through React Context or Redux would trigger way too many re-renders. 

I went with Zustand because it lets us use atomic selectors. For example, the `PoolRow` component only subscribes to data for its specific pool ID. When BTC updates, the ETH row doesn't re-render. 

Even with atomic selectors, storing infinite tick data is going to cause an OOM crash eventually. So the Zustand store uses a strict ring buffer. We only keep the last 500 candles per pool in state. As new ones come in, the oldest ones get dropped.

## The Web Worker Data Pipeline
React just can't handle 1000/sec on the main thread, no matter how optimized the state is. So I pushed all the heavy lifting to a background Web Worker (`pool-worker.ts`).

The worker handles the raw WebSocket connection, parses the JSON using Zod (to ensure type safety at the boundary so bad data doesn't poison our state), and feeds it into a custom `CandlestickAggregator`. 

Instead of sending every single tick to the main thread, the aggregator batches raw ticks into OHLC (Open, High, Low, Close) candles, and then flushes those to the main thread at a smooth 60fps (~16ms intervals). As a result, the main React thread only ever sees a maximum of 60 messages a second, keeping the UI completely lag-free.

## Charting (Bypassing React)
Since we have to draw so much data rapidly, declarative chart libraries like Recharts were too slow (they require a full DOM diffing cycle for every tick). 

I used TradingView's `lightweight-charts`. The `CandlestickChart` component just renders an empty `div` and we use a `useEffect` to imperatively push updates directly to the canvas using `series.setData()`. This completely bypasses React's virtual DOM and gets us maximum render performance.

## Future Thoughts
This setup scales surprisingly well for a pure client-side MVP approach. But if we were to push this to a real production environment, we should probably move the `CandlestickAggregator` and the WS/RPC merging logic out of the browser and into a Go or Rust backend service. Then the frontend would just subscribe to a single, clean, pre-computed WebSocket feed from our own server.
