import { RPCResponseSchema } from '@/lib/types';
import type { RPCResponse } from '@/lib/types';

/**
 * RPCClient: makes batched HTTP requests to the mock RPC server
 * for confirmed pool states. Validates responses with Zod.
 */
export class RPCClient {
    private url: string;
    private _isConnected = false;

    constructor(url: string) {
        this.url = url;
    }

    get isConnected(): boolean {
        return this._isConnected;
    }

    /**
     * Fetch confirmed state for a batch of pools in a single request.
     */
    async getPoolStates(poolIds: string[]): Promise<RPCResponse | null> {
        try {
            const response = await fetch(`${this.url}/rpc`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ poolIds }),
            });

            if (!response.ok) {
                console.error(`[RPCClient] HTTP ${response.status}`);
                this._isConnected = false;
                return null;
            }

            const data = await response.json();
            const result = RPCResponseSchema.safeParse(data);

            if (result.success) {
                this._isConnected = true;
                return result.data;
            } else {
                console.error('[RPCClient] Invalid response:', result.error.message);
                return null;
            }
        } catch (err) {
            console.error('[RPCClient] Request failed:', err);
            this._isConnected = false;
            return null;
        }
    }

    /**
     * Health check.
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await fetch(`${this.url}/health`);
            this._isConnected = response.ok;
            return response.ok;
        } catch {
            this._isConnected = false;
            return false;
        }
    }
}
