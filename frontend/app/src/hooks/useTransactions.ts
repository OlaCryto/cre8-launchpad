/**
 * Transaction hooks — write operations to Cre8Manager via viem walletClient.
 * Each hook exposes { isLoading, isPending, hash, error, execute }.
 *
 * Single-contract architecture: all writes go to Cre8Manager.
 * No more Router/Factory/CreatorRegistry separation.
 */

import { useState, useCallback } from 'react';
import { type Address, type Hash, parseEther, decodeEventLog } from 'viem';
import { publicClient, createWalletClientFromKey } from '@/config/client';
import { CONTRACTS, ACTIVE_NETWORK } from '@/config/wagmi';
import { Cre8ManagerABI, ERC20ABI, TokenCreatedEvent } from '@/config/abis';
import { useAuth } from '@/contexts/AuthContext';

const contracts = CONTRACTS[ACTIVE_NETWORK];
const managerAddress = contracts.Cre8Manager as Address;
const CREATION_FEE = parseEther('0.02');

// ============ Types ============

interface TxState {
  isLoading: boolean;
  isPending: boolean;
  hash: Hash | null;
  error: string | null;
}

const INITIAL_STATE: TxState = {
  isLoading: false,
  isPending: false,
  hash: null,
  error: null,
};

// ============ Helpers ============

function useWalletClient() {
  const { user } = useAuth();
  if (!user?.wallet.privateKey) return null;
  try {
    return createWalletClientFromKey(user.wallet.privateKey as `0x${string}`);
  } catch {
    return null;
  }
}

/** Resolve token address to tokenId via Cre8Manager */
async function resolveTokenId(tokenAddress: string): Promise<bigint> {
  return await publicClient.readContract({
    address: managerAddress,
    abi: Cre8ManagerABI,
    functionName: 'getTokenByAddress',
    args: [tokenAddress as Address],
  }) as bigint;
}

// ============ Hooks ============

/** Create a token via Cre8Manager.createToken (Easy Mode) with optional creator initial buy */
export function useCreateTokenAndBuy() {
  const [state, setState] = useState<TxState>(INITIAL_STATE);
  const wallet = useWalletClient();

  const execute = useCallback(async (params: {
    name: string;
    symbol: string;
    description: string;
    imageURI: string;
    twitter: string;
    telegram: string;
    website: string;
    creatorBuyBps: number;
    creatorBuyAvax: number;
  }) => {
    if (!wallet) throw new Error('Not authenticated');
    setState({ isLoading: true, isPending: false, hash: null, error: null });

    try {
      // msg.value = creation fee + actual AVAX for initial buy
      const buyAvax = params.creatorBuyBps > 0 && params.creatorBuyAvax > 0
        ? parseEther(params.creatorBuyAvax.toString())
        : 0n;
      const totalValue = CREATION_FEE + buyAvax;

      // Cre8Manager.createToken(name, symbol, creatorBuyBps)
      // Metadata (description, image, socials) stored in backend, not on-chain
      const hash = await wallet.walletClient.writeContract({
        address: managerAddress,
        abi: Cre8ManagerABI,
        functionName: 'createToken',
        args: [
          params.name,
          params.symbol,
          BigInt(params.creatorBuyBps),
        ],
        value: totalValue,
        gas: 1_500_000n,
      });

      setState(s => ({ ...s, isPending: true, hash }));
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setState({ isLoading: false, isPending: false, hash, error: null });

      // Parse TokenCreated event to get the new token address
      let tokenAddress: string | null = null;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: [TokenCreatedEvent],
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'TokenCreated') {
            tokenAddress = (decoded.args as any).token;
            break;
          }
        } catch {
          // Not our event
        }
      }

      return { ...receipt, tokenAddress };
    } catch (err: any) {
      let msg = err?.shortMessage || err?.message || 'Transaction failed';
      if (msg.includes('insufficient funds') || msg.includes('exceeds the balance')) {
        msg = 'Insufficient AVAX balance. You need at least 0.05 AVAX (creation fee + gas).';
      }
      setState({ isLoading: false, isPending: false, hash: null, error: msg });
      throw err;
    }
  }, [wallet]);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return { ...state, execute, reset };
}

/** Buy tokens on bonding curve via Cre8Manager.buy(tokenId, minTokensOut, deadline) */
export function useBuy() {
  const [state, setState] = useState<TxState>(INITIAL_STATE);
  const wallet = useWalletClient();

  const execute = useCallback(async (params: {
    tokenAddress: string;
    avaxAmount: number;
    minTokensOut: bigint;
  }) => {
    if (!wallet) throw new Error('Not authenticated');
    setState({ isLoading: true, isPending: false, hash: null, error: null });

    try {
      const tokenId = await resolveTokenId(params.tokenAddress);
      const value = parseEther(params.avaxAmount.toString());
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 min

      const hash = await wallet.walletClient.writeContract({
        address: managerAddress,
        abi: Cre8ManagerABI,
        functionName: 'buy',
        args: [tokenId, params.minTokensOut, deadline],
        value,
        gas: 300_000n,
      });

      setState(s => ({ ...s, isPending: true, hash }));
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setState({ isLoading: false, isPending: false, hash, error: null });
      return receipt;
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Buy failed';
      setState({ isLoading: false, isPending: false, hash: null, error: msg });
      throw err;
    }
  }, [wallet]);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return { ...state, execute, reset };
}

/**
 * Sell tokens via Cre8Manager.sell(tokenId, amount, minAvaxOut, deadline).
 * No ERC20 approve needed — Cre8Manager is the token owner and burns directly.
 */
export function useSell() {
  const [state, setState] = useState<TxState>(INITIAL_STATE);
  const wallet = useWalletClient();

  const execute = useCallback(async (params: {
    tokenAddress: string;
    tokenAmount: bigint;
    minAvaxOut: bigint;
  }) => {
    if (!wallet) throw new Error('Not authenticated');
    setState({ isLoading: true, isPending: false, hash: null, error: null });

    try {
      const tokenId = await resolveTokenId(params.tokenAddress);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

      const hash = await wallet.walletClient.writeContract({
        address: managerAddress,
        abi: Cre8ManagerABI,
        functionName: 'sell',
        args: [tokenId, params.tokenAmount, params.minAvaxOut, deadline],
        gas: 300_000n,
      });

      setState(s => ({ ...s, isPending: true, hash }));
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setState({ isLoading: false, isPending: false, hash, error: null });
      return receipt;
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Sell failed';
      setState({ isLoading: false, isPending: false, hash: null, error: msg });
      throw err;
    }
  }, [wallet]);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return { ...state, execute, reset };
}

/** Send AVAX to any address */
export function useSendAVAX() {
  const [state, setState] = useState<TxState>(INITIAL_STATE);
  const wallet = useWalletClient();

  const execute = useCallback(async (params: {
    to: string;
    amount: number;
  }) => {
    if (!wallet) throw new Error('Not authenticated');
    setState({ isLoading: true, isPending: false, hash: null, error: null });

    try {
      const hash = await wallet.walletClient.sendTransaction({
        to: params.to as Address,
        value: parseEther(params.amount.toString()),
      });

      setState(s => ({ ...s, isPending: true, hash }));
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setState({ isLoading: false, isPending: false, hash, error: null });
      return receipt;
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Transfer failed';
      setState({ isLoading: false, isPending: false, hash: null, error: msg });
      throw err;
    }
  }, [wallet]);

  const reset = useCallback(() => setState(INITIAL_STATE), []);
  return { ...state, execute, reset };
}

/** Send ERC20 tokens to any address */
export function useSendToken() {
  const [state, setState] = useState<TxState>(INITIAL_STATE);
  const wallet = useWalletClient();

  const execute = useCallback(async (params: {
    tokenAddress: string;
    to: string;
    amount: bigint;
  }) => {
    if (!wallet) throw new Error('Not authenticated');
    setState({ isLoading: true, isPending: false, hash: null, error: null });

    try {
      const hash = await wallet.walletClient.writeContract({
        address: params.tokenAddress as Address,
        abi: ERC20ABI,
        functionName: 'transfer',
        args: [params.to as Address, params.amount],
        gas: 65_000n,
      });

      setState(s => ({ ...s, isPending: true, hash }));
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setState({ isLoading: false, isPending: false, hash, error: null });
      return receipt;
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Token transfer failed';
      setState({ isLoading: false, isPending: false, hash: null, error: msg });
      throw err;
    }
  }, [wallet]);

  const reset = useCallback(() => setState(INITIAL_STATE), []);
  return { ...state, execute, reset };
}
