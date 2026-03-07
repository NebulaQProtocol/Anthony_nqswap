'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePoolStore } from '@/store/pool-store';
import { useConnectionStore } from '@/store/connection-store';
import type { WorkerMessage } from '@/lib/types';
import { DEFAULT_WS_URL, DEFAULT_RPC_URL } from '@/lib/constants';

/**
 * usePoolWorker: manages the Web Worker lifecycle.
 * - Creates the worker on mount
 * - Sends INIT command with connection URLs
 * - Routes worker messages to Zustand stores
 * - Cleans up (terminates) on unmount — prevents memory leaks
 */
export function usePoolWorker(poolIds: string[]) {
    const workerRef = useRef<Worker | null>(null);
    const applyBatch = usePoolStore((s) => s.applyBatch);
    const setWsStatus = useConnectionStore((s) => s.setWsStatus);
    const setRpcStatus = useConnectionStore((s) => s.setRpcStatus);
    const setLastUpdate = useConnectionStore((s) => s.setLastUpdate);

    const handleMessage = useCallback(
        (event: MessageEvent<WorkerMessage>) => {
            const msg = event.data;

            switch (msg.type) {
                case 'PRICE_BATCH':
                    applyBatch(msg);
                    setLastUpdate(Date.now());
                    break;

                case 'STATUS':
                    setWsStatus(msg.wsConnected ? 'connected' : 'disconnected');
                    setRpcStatus(msg.rpcConnected ? 'connected' : 'disconnected');
                    break;

                case 'ERROR':
                    console.error(`[Worker ${msg.source}] ${msg.message}`);
                    if (msg.source === 'ws') setWsStatus('reconnecting');
                    if (msg.source === 'rpc') setRpcStatus('disconnected');
                    break;
            }
        },
        [applyBatch, setWsStatus, setRpcStatus, setLastUpdate]
    );

    useEffect(() => {
        if (poolIds.length === 0) return;

        const worker = new Worker(
            new URL('../worker/pool-worker.ts', import.meta.url)
        );
        workerRef.current = worker;

        worker.onmessage = handleMessage;

        worker.onerror = (e) => {
            console.error('[usePoolWorker] Worker crashed:', e);
            setWsStatus('disconnected');
            setRpcStatus('disconnected');
        };

        // Initialize worker
        worker.postMessage({
            type: 'INIT',
            wsUrl: DEFAULT_WS_URL,
            rpcUrl: DEFAULT_RPC_URL,
            poolIds,
        });

        return () => {
            worker.postMessage({ type: 'STOP' });
            worker.terminate();
            workerRef.current = null;
        };
    }, [poolIds, handleMessage, setWsStatus, setRpcStatus]);

    return workerRef;
}
