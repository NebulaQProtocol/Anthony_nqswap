import express from 'express';
import cors from 'cors';
import { getConfirmedPrices, getCurrentBlockNumber } from './ws-server';

const RPC_PORT = parseInt(process.env.RPC_PORT || '8081', 10);

export function startRPCServer(): void {
    const app = express();
    app.use(cors());
    app.use(express.json());

    /**
     * JSON-RPC endpoint for batch pool state queries.
     * Accepts: POST { poolIds: string[] }
     * Returns: { pools: [...], blockNumber: number }
     */
    app.post('/rpc', (req, res) => {
        const { poolIds } = req.body;

        if (!Array.isArray(poolIds)) {
            res.status(400).json({ error: 'poolIds must be an array' });
            return;
        }

        const confirmedPrices = getConfirmedPrices();
        const blockNumber = getCurrentBlockNumber();

        const pools = poolIds
            .filter((id: string) => confirmedPrices.has(id))
            .map((id: string) => {
                const state = confirmedPrices.get(id)!;
                return {
                    poolId: id,
                    price: state.price,
                    blockNumber: state.blockNumber,
                };
            });

        res.json({ pools, blockNumber });
    });

    /**
     * Health check endpoint.
     */
    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', blockNumber: getCurrentBlockNumber() });
    });

    app.listen(RPC_PORT, () => {
        console.log(`[Mock RPC] Server listening on port ${RPC_PORT}`);
    });
}
