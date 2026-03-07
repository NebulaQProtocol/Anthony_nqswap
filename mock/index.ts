import { startWebSocketServer } from './ws-server';
import { startRPCServer } from './rpc-server';

console.log('=== nQ-Swap Mock Servers Starting ===');

// Start both servers in the same process
startWebSocketServer();
startRPCServer();

console.log('=== All mock servers running ===');
