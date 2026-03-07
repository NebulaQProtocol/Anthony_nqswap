import { router } from '../trpc';
import { poolsRouter } from './pools';

export const appRouter = router({
    pools: poolsRouter,
});

export type AppRouter = typeof appRouter;
