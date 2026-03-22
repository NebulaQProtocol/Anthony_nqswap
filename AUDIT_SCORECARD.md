# Audit Scorecard – Anthony's FullStack Engineer Test Submission

## Overall Result
- **Score: 57 / 100**
- **Pass/Fail: FAIL** (did not fully satisfy mandatory parts of the prompt)

## Rubric and Scoring

### 1) Hybrid data layer via backend API (tRPC/GraphQL) using WS + RPC validation (30 pts)
**Score: 12 / 30**

What is present:
- A tRPC router exists with `getTopPools` and `onPriceUpdate` subscription definitions.
- Backend service classes exist for WebSocket and RPC.

Why points were deducted:
- The front-end data path does **not** consume tRPC for real-time updates or pool bootstrap.
- The UI initializes seed pools directly and starts a browser Web Worker that connects directly to WS + RPC endpoints.
- The backend WS/RPC services are not wired into the active runtime flow.

Verdict: architecture pieces exist, but required backend API integration is incomplete.

### 2) Race condition handling + block confirmation guard UI behavior (25 pts)
**Score: 10 / 25**

What is present:
- A `ConfirmationGuard` exists with pending/confirmed state, dedupe by `txHash`, and stale expiry.
- UI displays pending vs confirmed prices with distinct styling.

Why points were deducted:
- The main candlestick series is fed from worker-aggregated WebSocket updates, not gated by RPC confirmation.
- This violates the requirement that the **main chart should only move after RPC block confirmation**.

Verdict: pending state visualization is implemented, but chart confirmation gating is not fully enforced.

### 3) UI/UX: live candlestick chart + worker throughput target (25 pts)
**Score: 15 / 25**

What is present:
- Uses `lightweight-charts` for candlestick rendering.
- Uses a dedicated Web Worker (`pool-worker.ts`) for processing and batching.
- Worker flush interval is tuned to ~60fps and ring buffer limits memory growth.

Why points were deducted:
- No demonstrated benchmark/proof that UI sustains **1,000 updates/second** without freezing.
- Mock update rate defaults to `100` updates/sec, below the stated target.

Verdict: good performance-oriented design, but requirement-level throughput proof is missing.

### 4) Docker Compose setup (10 pts)
**Score: 10 / 10**

What is present:
- `docker-compose.yml` defines app + mock servers and exposes relevant ports.
- Mock layer includes separate WS and RPC servers with configurable rates.

Verdict: requirement satisfied.

### 5) `THOUGHTS.md` on state management + WebSocket memory leak prevention (10 pts)
**Score: 10 / 10**

What is present:
- Thoughtful explanation of Zustand strategy and selective subscriptions.
- Explicit memory leak controls are discussed (TTL, cleanup lifecycle, bounded buffers).

Verdict: requirement satisfied.

## Additional Notes
- A functional tRPC endpoint is present (`/api/trpc/[trpc]`), but it is not the primary integration path used by the running UI.
- Lint currently fails with one error in the mock server (`prefer-const`) and several warnings.

## Final Judgment
This is a **solid prototype** with strong fundamentals (worker pipeline, dual-state model, dockerized mocks), but it does **not pass** the test as written because two critical acceptance criteria are not fully met:
1) backend API is not the integrated hybrid data layer used by the UI, and
2) chart progression is not strictly confirmation-gated by RPC.
