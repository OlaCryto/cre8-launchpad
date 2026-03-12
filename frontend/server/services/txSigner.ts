/**
 * Server-side transaction signing service.
 * Private keys NEVER leave the server — the frontend sends transaction descriptions,
 * the server signs and broadcasts them.
 */

import { createPublicClient, createWalletClient, http, parseEther, encodeFunctionData, type Address, type Hash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';

const RPC_URL = process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
const MANAGER_ADDRESS = (process.env.CRE8_MANAGER_ADDRESS || '0x4e972F92461AE6bc080411723C856996Dbe1591E') as Address;

const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(RPC_URL) });

// ============ ABI fragments (only what we need for encoding) ============

const Cre8ManagerABI = [
  {
    name: 'createToken', type: 'function', stateMutability: 'payable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'creatorBuyBps', type: 'uint256' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }, { name: 'tokenAddress', type: 'address' }],
  },
  {
    name: 'createTokenForge', type: 'function', stateMutability: 'payable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'creatorBuyBps', type: 'uint256' },
      { name: 'whitelistDuration', type: 'uint256' },
      { name: 'maxWalletAvax', type: 'uint256' },
      { name: 'maxTxAvax', type: 'uint256' },
      { name: 'whitelistAddrs', type: 'address[]' },
      { name: 'blacklistAddrs', type: 'address[]' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }, { name: 'tokenAddress', type: 'address' }],
  },
  {
    name: 'buy', type: 'function', stateMutability: 'payable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'minTokensOut', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'sell', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'minAvaxOut', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'updateWhitelist', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'accounts', type: 'address[]' },
      { name: 'status', type: 'bool' },
    ],
    outputs: [],
  },
  {
    name: 'updateBlacklist', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'accounts', type: 'address[]' },
      { name: 'status', type: 'bool' },
    ],
    outputs: [],
  },
  {
    name: 'getTokenByAddress', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'tokenAddr', type: 'address' }],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
] as const;

const ERC20TransferABI = [
  {
    name: 'transfer', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// ============ Resolve tokenId ============

async function resolveTokenId(tokenAddress: string): Promise<bigint> {
  return await publicClient.readContract({
    address: MANAGER_ADDRESS,
    abi: Cre8ManagerABI,
    functionName: 'getTokenByAddress',
    args: [tokenAddress as Address],
  });
}

// ============ Address validation ============

const ETH_RE = /^0x[0-9a-fA-F]{40}$/;
function isAddr(v: unknown): v is string {
  return typeof v === 'string' && ETH_RE.test(v);
}

// ============ Transaction Actions ============

export type TxAction =
  | { action: 'createToken'; params: { name: string; symbol: string; creatorBuyBps: number; avaxValue: string } }
  | { action: 'createTokenForge'; params: { name: string; symbol: string; creatorBuyBps: number; whitelistDuration: number; maxWalletAvax: string; maxTxAvax: string; whitelistAddresses: string[]; blacklistAddresses: string[]; avaxValue: string } }
  | { action: 'buy'; params: { tokenAddress: string; minTokensOut: string; avaxValue: string } }
  | { action: 'sell'; params: { tokenAddress: string; tokenAmount: string; minAvaxOut: string } }
  | { action: 'updateWhitelist'; params: { tokenAddress: string; accounts: string[]; status: boolean } }
  | { action: 'updateBlacklist'; params: { tokenAddress: string; accounts: string[]; status: boolean } }
  | { action: 'sendAvax'; params: { to: string; amount: string } }
  | { action: 'sendToken'; params: { tokenAddress: string; to: string; amount: string } };

const ALLOWED_ACTIONS = new Set([
  'createToken', 'createTokenForge', 'buy', 'sell',
  'updateWhitelist', 'updateBlacklist', 'sendAvax', 'sendToken',
]);

/**
 * Sign and broadcast a transaction on behalf of a user.
 * Returns the transaction hash immediately (caller waits for receipt).
 */
export async function signAndSend(privateKey: `0x${string}`, tx: TxAction): Promise<Hash> {
  if (!ALLOWED_ACTIONS.has(tx.action)) {
    throw new Error(`Unknown action: ${tx.action}`);
  }

  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: avalancheFuji,
    transport: http(RPC_URL),
  });

  switch (tx.action) {
    case 'createToken': {
      const { name, symbol, creatorBuyBps, avaxValue } = tx.params;
      if (!name || !symbol || typeof creatorBuyBps !== 'number') throw new Error('Invalid createToken params');
      return await walletClient.writeContract({
        address: MANAGER_ADDRESS,
        abi: Cre8ManagerABI,
        functionName: 'createToken',
        args: [name, symbol, BigInt(creatorBuyBps)],
        value: parseEther(avaxValue),
        gas: 1_500_000n,
      });
    }

    case 'createTokenForge': {
      const p = tx.params;
      if (!p.name || !p.symbol) throw new Error('Invalid createTokenForge params');
      if (!p.whitelistAddresses.every(isAddr)) throw new Error('Invalid whitelist address');
      if (!p.blacklistAddresses.every(isAddr)) throw new Error('Invalid blacklist address');
      return await walletClient.writeContract({
        address: MANAGER_ADDRESS,
        abi: Cre8ManagerABI,
        functionName: 'createTokenForge',
        args: [
          p.name, p.symbol, BigInt(p.creatorBuyBps), BigInt(p.whitelistDuration),
          parseEther(p.maxWalletAvax), parseEther(p.maxTxAvax),
          p.whitelistAddresses as Address[], p.blacklistAddresses as Address[],
        ],
        value: parseEther(p.avaxValue),
        gas: 2_000_000n,
      });
    }

    case 'buy': {
      const { tokenAddress, minTokensOut, avaxValue } = tx.params;
      if (!isAddr(tokenAddress)) throw new Error('Invalid token address');
      const tokenId = await resolveTokenId(tokenAddress);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
      return await walletClient.writeContract({
        address: MANAGER_ADDRESS,
        abi: Cre8ManagerABI,
        functionName: 'buy',
        args: [tokenId, BigInt(minTokensOut), deadline],
        value: parseEther(avaxValue),
        gas: 300_000n,
      });
    }

    case 'sell': {
      const { tokenAddress, tokenAmount, minAvaxOut } = tx.params;
      if (!isAddr(tokenAddress)) throw new Error('Invalid token address');
      const tokenId = await resolveTokenId(tokenAddress);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
      return await walletClient.writeContract({
        address: MANAGER_ADDRESS,
        abi: Cre8ManagerABI,
        functionName: 'sell',
        args: [tokenId, BigInt(tokenAmount), BigInt(minAvaxOut), deadline],
        gas: 300_000n,
      });
    }

    case 'updateWhitelist': {
      const { tokenAddress, accounts, status } = tx.params;
      if (!isAddr(tokenAddress)) throw new Error('Invalid token address');
      if (!accounts.every(isAddr)) throw new Error('Invalid account address');
      const tokenId = await resolveTokenId(tokenAddress);
      return await walletClient.writeContract({
        address: MANAGER_ADDRESS,
        abi: Cre8ManagerABI,
        functionName: 'updateWhitelist',
        args: [tokenId, accounts as Address[], status],
        gas: 200_000n,
      });
    }

    case 'updateBlacklist': {
      const { tokenAddress, accounts, status } = tx.params;
      if (!isAddr(tokenAddress)) throw new Error('Invalid token address');
      if (!accounts.every(isAddr)) throw new Error('Invalid account address');
      const tokenId = await resolveTokenId(tokenAddress);
      return await walletClient.writeContract({
        address: MANAGER_ADDRESS,
        abi: Cre8ManagerABI,
        functionName: 'updateBlacklist',
        args: [tokenId, accounts as Address[], status],
        gas: 200_000n,
      });
    }

    case 'sendAvax': {
      const { to, amount } = tx.params;
      if (!isAddr(to)) throw new Error('Invalid recipient address');
      return await walletClient.sendTransaction({
        to: to as Address,
        value: parseEther(amount),
      });
    }

    case 'sendToken': {
      const { tokenAddress, to, amount } = tx.params;
      if (!isAddr(tokenAddress) || !isAddr(to)) throw new Error('Invalid address');
      return await walletClient.writeContract({
        address: tokenAddress as Address,
        abi: ERC20TransferABI,
        functionName: 'transfer',
        args: [to as Address, BigInt(amount)],
        gas: 65_000n,
      });
    }

    default:
      throw new Error(`Unhandled action`);
  }
}
