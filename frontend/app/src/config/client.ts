// @ts-ignore -- viem types resolve at build time
import { createPublicClient, createWalletClient, http } from 'viem';
// @ts-ignore
import { privateKeyToAccount } from 'viem/accounts';
// @ts-ignore
import { avalancheFuji, avalanche } from 'viem/chains';
import { ACTIVE_NETWORK } from './wagmi';

const chain = ACTIVE_NETWORK === 'fuji' ? avalancheFuji : avalanche;

export const publicClient = createPublicClient({
  chain,
  transport: http(),
});

/** Create a wallet client from a private key for signing transactions */
export function createWalletClientFromKey(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(),
  });
  return { walletClient, account };
}

export { chain };
