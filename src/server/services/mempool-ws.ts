import { EventEmitter } from 'events';
import { PriceUpdateSchema, PoolSchema } from '@/lib/types';
import type { PriceUpdate, Pool } from '@/lib/types';
import { calculateBackoff } from '@/lib/utils';
import WebSocket from 'ws';

/**
 * MempoolWSService: connects to the mock WebSocket server,
 * validates incoming messages with Zod, and emits typed events.
 *
 * Handles reconnection with exponential backoff.
 */
export class MempoolWSService extends EventEmitter {
    private ws: WebSocket | null = null;
    private url: string;
    private reconnectAttempt = 0;
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    private _isConnected = false;

    constructor(url: string) {
        super();
        this.url = url;
    }

    get isConnected(): boolean {
        return this._isConnected;
    }

    connect(): void {
        try {
            this.ws = new WebSocket(this.url);

            this.ws.on('open', () => {
                console.log('[MempoolWS] Connected to', this.url);
                this._isConnected = true;
                this.reconnectAttempt = 0;
                this.emit('connected');
            });

            this.ws.on('message', (data: WebSocket.Data) => {
                try {
                    const parsed = JSON.parse(data.toString());

                    if (parsed.type === 'POOLS') {
                        // Initial pool list
                        const pools = parsed.pools;
                        if (Array.isArray(pools)) {
                            const validPools: Pool[] = [];
                            for (const pool of pools) {
                                const result = PoolSchema.safeParse(pool);
                                if (result.success) validPools.push(result.data);
                            }
                            this.emit('pools', validPools);
                        }
                    } else if (parsed.type === 'PRICE_UPDATE') {
                        const result = PriceUpdateSchema.safeParse(parsed);
                        if (result.success) {
                            this.emit('priceUpdate', result.data);
                        }
                        // Drop invalid messages silently
                    }
                } catch {
                    // Malformed JSON — skip
                }
            });

            this.ws.on('close', () => {
                console.log('[MempoolWS] Disconnected');
                this._isConnected = false;
                this.emit('disconnected');
                this.scheduleReconnect();
            });

            this.ws.on('error', (err: Error) => {
                console.error('[MempoolWS] Error:', err.message);
                this._isConnected = false;
            });
        } catch (err) {
            console.error('[MempoolWS] Connection failed:', err);
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

        const delay = calculateBackoff(this.reconnectAttempt);
        this.reconnectAttempt++;

        console.log(`[MempoolWS] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempt})`);
        this.reconnectTimeout = setTimeout(() => this.connect(), delay);
    }

    disconnect(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this._isConnected = false;
    }
}
