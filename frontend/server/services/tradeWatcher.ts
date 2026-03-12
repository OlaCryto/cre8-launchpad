import { createPublicClient, http, type Address, formatEther } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Server } from 'http';

const RPC_URL = process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
const MANAGER_ADDRESS = (process.env.CRE8_MANAGER_ADDRESS || '0x4e972F92461AE6bc080411723C856996Dbe1591E') as Address;

const BuyEvent = {
  name: 'Buy',
  type: 'event',
  inputs: [
    { name: 'buyer', type: 'address', indexed: true },
    { name: 'tokenId', type: 'uint256', indexed: true },
    { name: 'avaxIn', type: 'uint256', indexed: false },
    { name: 'tokensOut', type: 'uint256', indexed: false },
    { name: 'newSupply', type: 'uint256', indexed: false },
    { name: 'newPrice', type: 'uint256', indexed: false },
  ],
} as const;

const SellEvent = {
  name: 'Sell',
  type: 'event',
  inputs: [
    { name: 'seller', type: 'address', indexed: true },
    { name: 'tokenId', type: 'uint256', indexed: true },
    { name: 'tokensIn', type: 'uint256', indexed: false },
    { name: 'avaxOut', type: 'uint256', indexed: false },
    { name: 'newSupply', type: 'uint256', indexed: false },
    { name: 'newPrice', type: 'uint256', indexed: false },
  ],
} as const;

const client = createPublicClient({ chain: avalancheFuji, transport: http(RPC_URL) });

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

function broadcast(data: object) {
  const msg = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) {
      ws.send(msg);
    }
  }
}

let pollInterval: ReturnType<typeof setInterval> | null = null;
let lastBlock = 0n;

async function pollForTrades() {
  try {
    const currentBlock = await client.getBlockNumber();
    if (lastBlock === 0n) {
      lastBlock = currentBlock;
      return;
    }
    if (currentBlock <= lastBlock) return;

    const fromBlock = lastBlock + 1n;
    lastBlock = currentBlock;

    const [buyLogs, sellLogs] = await Promise.all([
      client.getLogs({ address: MANAGER_ADDRESS, event: BuyEvent, fromBlock, toBlock: currentBlock }),
      client.getLogs({ address: MANAGER_ADDRESS, event: SellEvent, fromBlock, toBlock: currentBlock }),
    ]);

    if (buyLogs.length === 0 && sellLogs.length === 0) return;

    // Get block timestamps for new blocks
    const blockNumbers = new Set<bigint>();
    for (const log of [...buyLogs, ...sellLogs]) {
      if (log.blockNumber) blockNumbers.add(log.blockNumber);
    }
    const blockTimestamps = new Map<bigint, number>();
    await Promise.all(
      [...blockNumbers].map(async (bn) => {
        try {
          const block = await client.getBlock({ blockNumber: bn });
          blockTimestamps.set(bn, Number(block.timestamp));
        } catch { /* skip */ }
      })
    );

    for (const log of buyLogs) {
      const args = log.args;
      if (!args) continue;
      broadcast({
        type: 'trade',
        trade: {
          type: 'buy',
          trader: args.buyer as string,
          tokenId: String(args.tokenId),
          avaxAmount: Number(formatEther(args.avaxIn as bigint)),
          tokenAmount: Number(formatEther(args.tokensOut as bigint)),
          newPrice: Number(formatEther(args.newPrice as bigint)),
          timestamp: blockTimestamps.get(log.blockNumber!) || Math.floor(Date.now() / 1000),
          txHash: log.transactionHash || '',
          blockNumber: String(log.blockNumber),
        },
      });
    }

    for (const log of sellLogs) {
      const args = log.args;
      if (!args) continue;
      broadcast({
        type: 'trade',
        trade: {
          type: 'sell',
          trader: args.seller as string,
          tokenId: String(args.tokenId),
          avaxAmount: Number(formatEther(args.avaxOut as bigint)),
          tokenAmount: Number(formatEther(args.tokensIn as bigint)),
          newPrice: Number(formatEther(args.newPrice as bigint)),
          timestamp: blockTimestamps.get(log.blockNumber!) || Math.floor(Date.now() / 1000),
          txHash: log.transactionHash || '',
          blockNumber: String(log.blockNumber),
        },
      });
    }

    if (buyLogs.length + sellLogs.length > 0) {
      console.log(`[TradeWatcher] Broadcast ${buyLogs.length} buys + ${sellLogs.length} sells`);
    }
  } catch (err) {
    console.error('[TradeWatcher] Poll error:', err);
  }
}

const MAX_WS_CLIENTS = 200;

export function startTradeWatcher(server: Server) {
  wss = new WebSocketServer({ server, path: '/ws/trades' });

  wss.on('connection', (ws) => {
    // Reject new connections if at capacity (DoS protection)
    if (clients.size >= MAX_WS_CLIENTS) {
      ws.close(1013, 'Server at capacity');
      return;
    }

    clients.add(ws);
    console.log(`[TradeWatcher] Client connected (${clients.size} total)`);

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[TradeWatcher] Client disconnected (${clients.size} total)`);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });

    // Ignore any incoming messages (read-only broadcast channel)
    ws.on('message', () => {});

    // Send a welcome message so the client knows the connection works
    ws.send(JSON.stringify({ type: 'connected', manager: MANAGER_ADDRESS }));
  });

  // Poll every 3 seconds (faster than the frontend's 10s polling)
  pollInterval = setInterval(pollForTrades, 3000);
  // Initial poll to set lastBlock
  pollForTrades();

  console.log(`[TradeWatcher] WebSocket server started on /ws/trades`);
  console.log(`[TradeWatcher] Watching Cre8Manager: ${MANAGER_ADDRESS}`);
}

export function stopTradeWatcher() {
  if (pollInterval) clearInterval(pollInterval);
  if (wss) wss.close();
  clients.clear();
}
