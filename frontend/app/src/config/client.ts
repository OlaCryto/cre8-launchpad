// @ts-ignore -- viem types resolve at build time
import { createPublicClient, createWalletClient, http, fallback } from 'viem';
// @ts-ignore
import { privateKeyToAccount } from 'viem/accounts';
// @ts-ignore
import { avalancheFuji, avalanche } from 'viem/chains';
import { ACTIVE_NETWORK } from './wagmi';

const chain = ACTIVE_NETWORK === 'fuji' ? avalancheFuji : avalanche;

const fujiRpcs = [
  'https://hardworking-dawn-sailboat.avalanche-testnet.quiknode.pro/022a54c6e74f3463167816f37d1f2ad5ae91af21/ext/bc/C/rpc/',
  'https://api.avax-test.network/ext/bc/C/rpc',
];

const mainnetRpcs = [
  'https://hardworking-dawn-sailboat.avalanche-mainnet.quiknode.pro/022a54c6e74f3463167816f37d1f2ad5ae91af21/ext/bc/C/rpc/',
  'https://api.avax.network/ext/bc/C/rpc',
];

const rpcs = ACTIVE_NETWORK === 'fuji' ? fujiRpcs : mainnetRpcs;
const transport = fallback(rpcs.map(url => http(url)));

export const publicClient = createPublicClient({
  chain,
  transport,
});

/** Create a wallet client from a private key for signing transactions */
export function createWalletClientFromKey(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain,
    transport,
  });
  return { walletClient, account };
}

export { chain };
