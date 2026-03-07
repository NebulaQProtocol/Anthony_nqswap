'use client';

import { useWsStatus, useRpcStatus } from '@/store/connection-store';

export function ConnectionStatus() {
    const wsStatus = useWsStatus();
    const rpcStatus = useRpcStatus();

    // Overall status: worst of the two
    const overallStatus = wsStatus === 'disconnected' || rpcStatus === 'disconnected'
        ? 'disconnected'
        : wsStatus === 'reconnecting' || rpcStatus === 'reconnecting'
            ? 'reconnecting'
            : 'connected';

    const labels: Record<string, string> = {
        connected: 'Live',
        reconnecting: 'Reconnecting...',
        disconnected: 'Disconnected',
    };

    return (
        <div className="header-status">
            <div className={`connection-badge ${overallStatus}`} id="connection-status">
                <span className="dot" />
                <span>{labels[overallStatus]}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>WS: {wsStatus}</span>
                <span>·</span>
                <span>RPC: {rpcStatus}</span>
            </div>
        </div>
    );
}
