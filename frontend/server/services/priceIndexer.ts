import { createPublicClient, http, type Address } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { addPriceSnapshot } from '../database.js';

const RPC_URL = process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
const FACTORY_ADDRESS = (process.env.FACTORY_ADDRESS || '0x0926707Dc7a64d63f37390d7C616352b180E807a') as Address;
const SNAPSHOT_INTERVAL = parseInt(process.env.SNAPSHOT_INTERVAL_MS || '300000', 10);

const LaunchpadFactoryABI = [
  { inputs: [], name: 'getTokenCount', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'index', type: 'uint256' }], name: 'getTokenByIndex', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
] as const;

const BondingCurveABI = [
  { inputs: [], name: 'getCurrentPrice', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'reserveBalance', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

const LaunchpadTokenABI = [
  { inputs: [], name: 'bondingCurve', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
] as const;

const client = createPublicClient({ chain: avalancheFuji, transport: http(RPC_URL) });

async function snapshotAllTokens() {
  if (!FACTORY_ADDRESS) return;

  try {
    const count = await client.readContract({
      address: FACTORY_ADDRESS,
      abi: LaunchpadFactoryABI,
      functionName: 'getTokenCount',
    });

    const total = Number(count);
    if (total === 0) return;

    for (let i = 0; i < total; i++) {
      try {
        const tokenAddr = await client.readContract({
          address: FACTORY_ADDRESS,
          abi: LaunchpadFactoryABI,
          functionName: 'getTokenByIndex',
          args: [BigInt(i)],
        });

        const curveAddr = await client.readContract({
          address: tokenAddr as Address,
          abi: LaunchpadTokenABI,
          functionName: 'bondingCurve',
        });

        const [priceRaw, reserveRaw] = await Promise.all([
          client.readContract({ address: curveAddr as Address, abi: BondingCurveABI, functionName: 'getCurrentPrice' }),
          client.readContract({ address: curveAddr as Address, abi: BondingCurveABI, functionName: 'reserveBalance' }),
        ]);

        const price = Number(priceRaw) / 1e18;
        const reserve = Number(reserveRaw) / 1e18;
        const marketCap = reserve * 1000;

        await addPriceSnapshot((tokenAddr as string).toLowerCase(), price, reserve, marketCap);
      } catch {
        // Individual token failure — skip
      }
    }

    console.log(`[PriceIndexer] Snapshot complete: ${total} tokens`);
  } catch (err) {
    console.error('[PriceIndexer] Failed:', err);
  }
}

export function startPriceIndexer() {
  if (!FACTORY_ADDRESS) {
    console.log('[PriceIndexer] No FACTORY_ADDRESS set, skipping price indexer');
    return;
  }

  console.log(`[PriceIndexer] Starting (interval: ${SNAPSHOT_INTERVAL / 1000}s)`);

  setTimeout(() => {
    snapshotAllTokens();
    setInterval(snapshotAllTokens, SNAPSHOT_INTERVAL);
  }, 10_000);
}
