// @ts-ignore -- viem types resolve at build time
import { createPublicClient, http, fallback } from 'viem';
// @ts-ignore
import { avalancheFuji, avalanche } from 'viem/chains';
import { ACTIVE_NETWORK } from './wagmi';

const chain = ACTIVE_NETWORK === 'fuji' ? avalancheFuji : avalanche;

const fujiRpcs = [
  // Premium RPC via env var — never hardcode API keys in source
  ...(import.meta.env.VITE_FUJI_RPC_URL ? [import.meta.env.VITE_FUJI_RPC_URL] : []),
  'https://api.avax-test.network/ext/bc/C/rpc',
];

const mainnetRpcs = [
  ...(import.meta.env.VITE_MAINNET_RPC_URL ? [import.meta.env.VITE_MAINNET_RPC_URL] : []),
  'https://api.avax.network/ext/bc/C/rpc',
];

const rpcs = ACTIVE_NETWORK === 'fuji' ? fujiRpcs : mainnetRpcs;
const transport = fallback(rpcs.map(url => http(url, {
  batch: true,
  retryCount: 2,
  retryDelay: 1000,
})));

export const publicClient = createPublicClient({
  chain,
  transport,
  batch: {
    multicall: {
      wait: 50,       // batch calls within 50ms window
      batchSize: 512,  // max 512 calls per batch
    },
  },
});

export { chain };
