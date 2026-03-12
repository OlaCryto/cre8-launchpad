/**
 * Transaction hooks — write operations to Cre8Manager via server-side signing.
 * Each hook exposes { isLoading, isPending, hash, error, execute }.
 *
 * Private keys NEVER reach the browser. All signing happens on the server.
 */

import { useState, useCallback } from 'react';
import { type Hash, parseEther, decodeEventLog } from 'viem';
import { publicClient } from '@/config/client';
import { TokenCreatedEvent } from '@/config/abis';
import { useAuth } from '@/contexts/AuthContext';
import { serverSignTransaction } from '@/lib/serverSign';

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

// ============ Hooks ============

/** Create a token via Cre8Manager.createToken (Easy Mode) with optional creator initial buy */
export function useCreateTokenAndBuy() {
  const [state, setState] = useState<TxState>(INITIAL_STATE);
  const { isAuthenticated } = useAuth();

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
    if (!isAuthenticated) throw new Error('Not authenticated');
    setState({ isLoading: true, isPending: false, hash: null, error: null });

    try {
      const buyAvax = params.creatorBuyBps > 0 && params.creatorBuyAvax > 0
        ? params.creatorBuyAvax : 0;
      const creationFee = 0.02;
      const totalValue = creationFee + buyAvax;

      const hash = await serverSignTransaction({
        action: 'createToken',
        params: {
          name: params.name,
          symbol: params.symbol,
          creatorBuyBps: params.creatorBuyBps,
          avaxValue: totalValue.toString(),
        },
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
  }, [isAuthenticated]);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return { ...state, execute, reset };
}

/** Buy tokens on bonding curve via Cre8Manager.buy */
export function useBuy() {
  const [state, setState] = useState<TxState>(INITIAL_STATE);
  const { isAuthenticated } = useAuth();

  const execute = useCallback(async (params: {
    tokenAddress: string;
    avaxAmount: number;
    minTokensOut: bigint;
  }) => {
    if (!isAuthenticated) throw new Error('Not authenticated');
    setState({ isLoading: true, isPending: false, hash: null, error: null });

    try {
      const hash = await serverSignTransaction({
        action: 'buy',
        params: {
          tokenAddress: params.tokenAddress,
          minTokensOut: params.minTokensOut.toString(),
          avaxValue: params.avaxAmount.toString(),
        },
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
  }, [isAuthenticated]);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return { ...state, execute, reset };
}

/**
 * Sell tokens via Cre8Manager.sell.
 * No ERC20 approve needed — Cre8Manager is the token owner and burns directly.
 */
export function useSell() {
  const [state, setState] = useState<TxState>(INITIAL_STATE);
  const { isAuthenticated } = useAuth();

  const execute = useCallback(async (params: {
    tokenAddress: string;
    tokenAmount: bigint;
    minAvaxOut: bigint;
  }) => {
    if (!isAuthenticated) throw new Error('Not authenticated');
    setState({ isLoading: true, isPending: false, hash: null, error: null });

    try {
      const hash = await serverSignTransaction({
        action: 'sell',
        params: {
          tokenAddress: params.tokenAddress,
          tokenAmount: params.tokenAmount.toString(),
          minAvaxOut: params.minAvaxOut.toString(),
        },
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
  }, [isAuthenticated]);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return { ...state, execute, reset };
}

/** Send AVAX to any address */
export function useSendAVAX() {
  const [state, setState] = useState<TxState>(INITIAL_STATE);
  const { isAuthenticated } = useAuth();

  const execute = useCallback(async (params: {
    to: string;
    amount: number;
  }) => {
    if (!isAuthenticated) throw new Error('Not authenticated');
    setState({ isLoading: true, isPending: false, hash: null, error: null });

    try {
      const hash = await serverSignTransaction({
        action: 'sendAvax',
        params: { to: params.to, amount: params.amount.toString() },
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
  }, [isAuthenticated]);

  const reset = useCallback(() => setState(INITIAL_STATE), []);
  return { ...state, execute, reset };
}

/** Send ERC20 tokens to any address */
export function useSendToken() {
  const [state, setState] = useState<TxState>(INITIAL_STATE);
  const { isAuthenticated } = useAuth();

  const execute = useCallback(async (params: {
    tokenAddress: string;
    to: string;
    amount: bigint;
  }) => {
    if (!isAuthenticated) throw new Error('Not authenticated');
    setState({ isLoading: true, isPending: false, hash: null, error: null });

    try {
      const hash = await serverSignTransaction({
        action: 'sendToken',
        params: {
          tokenAddress: params.tokenAddress,
          to: params.to,
          amount: params.amount.toString(),
        },
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
  }, [isAuthenticated]);

  const reset = useCallback(() => setState(INITIAL_STATE), []);
  return { ...state, execute, reset };
}
