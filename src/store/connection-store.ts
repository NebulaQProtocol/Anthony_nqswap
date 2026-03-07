import { create } from 'zustand';

type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

interface ConnectionStoreState {
    wsStatus: ConnectionState;
    rpcStatus: ConnectionState;
    lastUpdate: number | null;

    setWsStatus: (status: ConnectionState) => void;
    setRpcStatus: (status: ConnectionState) => void;
    setLastUpdate: (timestamp: number) => void;
}

/**
 * Separate store for connection status.
 * Prevents pool data updates from triggering re-renders of connection UI.
 */
export const useConnectionStore = create<ConnectionStoreState>((set) => ({
    wsStatus: 'disconnected',
    rpcStatus: 'disconnected',
    lastUpdate: null,

    setWsStatus: (status) => set({ wsStatus: status }),
    setRpcStatus: (status) => set({ rpcStatus: status }),
    setLastUpdate: (timestamp) => set({ lastUpdate: timestamp }),
}));

// ─── Atomic Selectors ───────────────────────────────────
export function useWsStatus(): ConnectionState {
    return useConnectionStore((s) => s.wsStatus);
}

export function useRpcStatus(): ConnectionState {
    return useConnectionStore((s) => s.rpcStatus);
}
