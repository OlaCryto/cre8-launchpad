/**
 * Forge mode hooks — create tokens with whitelist + manage whitelist/blacklist.
 * All write operations go through server-side signing (private key never in browser).
 *
 * Forge Mode = whitelist phase (1-60 min) with fixed AVAX limits per wallet/tx,
 * then automatic transition to public trading.
 */

import { useState, useEffect, useCallback } from 'react';
import { type Address, formatEther, decodeEventLog } from 'viem';
import { publicClient } from '@/config/client';
import { CONTRACTS, ACTIVE_NETWORK } from '@/config/wagmi';
import { Cre8ManagerABI, TokenCreatedForgeEvent } from '@/config/abis';
import { useAuth } from '@/contexts/AuthContext';
import { serverSignTransaction } from '@/lib/serverSign';

const contracts = CONTRACTS[ACTIVE_NETWORK];
const managerAddress = contracts.Cre8Manager as Address;

// ============ Types ============

export interface WhitelistInfo {
  isActive: boolean;
  endTime: number;
  maxWalletAvax: number;
  maxTxAvax: number;
}

export interface WhitelistAllowance {
  remaining: number;
  isWhitelisted: boolean;
}

// ============ Helpers ============

interface TxState {
  isLoading: boolean;
  isPending: boolean;
  hash: string | null;
  error: string | null;
}

const INITIAL_TX: TxState = { isLoading: false, isPending: false, hash: null, error: null };

/** Resolve token address to tokenId */
async function resolveTokenId(tokenAddress: string): Promise<bigint> {
  return await publicClient.readContract({
    address: managerAddress,
    abi: Cre8ManagerABI,
    functionName: 'getTokenByAddress',
    args: [tokenAddress as Address],
  }) as bigint;
}

// ============ Read Hooks ============

/** Check if whitelist is currently active for a token */
export function useWhitelistInfo(tokenAddress: string | undefined) {
  const [data, setData] = useState<WhitelistInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tokenAddress) { setIsLoading(false); return; }
    let cancelled = false;

    async function load() {
      try {
        const tokenId = await resolveTokenId(tokenAddress!);

        const isActive = await publicClient.readContract({
          address: managerAddress,
          abi: Cre8ManagerABI,
          functionName: 'isWhitelistActive',
          args: [tokenId],
        }) as boolean;

        const whitelistConfigABI = [{
          name: 'whitelistConfig',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: '', type: 'uint256' }],
          outputs: [
            { name: 'endTime', type: 'uint256' },
            { name: 'maxWalletAvax', type: 'uint256' },
            { name: 'maxTxAvax', type: 'uint256' },
          ],
        }] as const;

        const result = await publicClient.readContract({
          address: managerAddress,
          abi: whitelistConfigABI,
          functionName: 'whitelistConfig',
          args: [tokenId],
        }) as any;

        if (!cancelled) {
          setData({
            isActive,
            endTime: Number(result[0] ?? result.endTime),
            maxWalletAvax: Number(formatEther(result[1] ?? result.maxWalletAvax)),
            maxTxAvax: Number(formatEther(result[2] ?? result.maxTxAvax)),
          });
        }
      } catch (err) {
        console.error('[useWhitelistInfo] failed:', err);
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [tokenAddress]);

  return { data, isLoading };
}

/** Get remaining whitelist allowance for a specific wallet */
export function useWhitelistAllowance(tokenAddress: string | undefined, walletAddress: string | undefined) {
  const [data, setData] = useState<WhitelistAllowance | null>(null);

  useEffect(() => {
    if (!tokenAddress || !walletAddress) return;
    let cancelled = false;

    async function load() {
      try {
        const tokenId = await resolveTokenId(tokenAddress!);

        const remaining = await publicClient.readContract({
          address: managerAddress,
          abi: Cre8ManagerABI,
          functionName: 'getWhitelistAllowance',
          args: [tokenId, walletAddress as Address],
        }) as bigint;

        const MAX_UINT = 2n ** 256n - 1n;
        const isWhitelisted = remaining > 0n;
        const remainingAvax = remaining === MAX_UINT
          ? Infinity
          : Number(formatEther(remaining));

        if (!cancelled) {
          setData({ remaining: remainingAvax, isWhitelisted });
        }
      } catch {
        if (!cancelled) setData(null);
      }
    }

    load();
    const interval = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [tokenAddress, walletAddress]);

  return data;
}

// ============ Write Hooks ============

/** Create a Forge Mode token via Cre8Manager.createTokenForge */
export function useCreateForgeToken() {
  const [state, setState] = useState<TxState>(INITIAL_TX);
  const { isAuthenticated } = useAuth();

  const execute = useCallback(async (params: {
    name: string;
    symbol: string;
    creatorBuyBps: number;
    creatorBuyAvax: number;
    whitelistDuration: number;
    maxWalletAvax: number;
    maxTxAvax: number;
    whitelistAddresses: string[];
    blacklistAddresses: string[];
  }) => {
    if (!isAuthenticated) throw new Error('Not authenticated');
    setState({ isLoading: true, isPending: false, hash: null, error: null });

    try {
      const buyAvax = params.creatorBuyBps > 0 && params.creatorBuyAvax > 0
        ? params.creatorBuyAvax : 0;
      const creationFee = 0.02;
      const totalValue = creationFee + buyAvax;

      const hash = await serverSignTransaction({
        action: 'createTokenForge',
        params: {
          name: params.name,
          symbol: params.symbol,
          creatorBuyBps: params.creatorBuyBps,
          whitelistDuration: params.whitelistDuration,
          maxWalletAvax: params.maxWalletAvax.toString(),
          maxTxAvax: params.maxTxAvax.toString(),
          whitelistAddresses: params.whitelistAddresses,
          blacklistAddresses: params.blacklistAddresses,
          avaxValue: totalValue.toString(),
        },
      });

      setState(s => ({ ...s, isPending: true, hash }));
      const receipt = await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      setState({ isLoading: false, isPending: false, hash, error: null });

      let tokenAddress: string | null = null;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: [TokenCreatedForgeEvent],
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'TokenCreatedForge') {
            tokenAddress = (decoded.args as any).token;
            break;
          }
        } catch {
          // Not our event
        }
      }

      return { ...receipt, tokenAddress };
    } catch (err: any) {
      let msg = err?.shortMessage || err?.message || 'Forge launch creation failed';
      if (msg.includes('insufficient funds') || msg.includes('exceeds the balance')) {
        msg = 'Insufficient AVAX balance.';
      }
      setState({ isLoading: false, isPending: false, hash: null, error: msg });
      throw err;
    }
  }, [isAuthenticated]);

  return { ...state, execute };
}

/** Update whitelist addresses during active whitelist phase (creator only) */
export function useUpdateWhitelist() {
  const [state, setState] = useState<TxState>(INITIAL_TX);
  const { isAuthenticated } = useAuth();

  const execute = useCallback(async (
    tokenAddress: string,
    accounts: string[],
    status: boolean,
  ) => {
    if (!isAuthenticated) throw new Error('Not authenticated');
    setState({ isLoading: true, isPending: false, hash: null, error: null });

    try {
      const hash = await serverSignTransaction({
        action: 'updateWhitelist',
        params: { tokenAddress, accounts, status },
      });

      setState(s => ({ ...s, isPending: true, hash }));
      await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      setState({ isLoading: false, isPending: false, hash, error: null });
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Whitelist update failed';
      setState({ isLoading: false, isPending: false, hash: null, error: msg });
      throw err;
    }
  }, [isAuthenticated]);

  return { ...state, execute };
}

/** Update blacklist addresses (creator only, any time) */
export function useUpdateBlacklist() {
  const [state, setState] = useState<TxState>(INITIAL_TX);
  const { isAuthenticated } = useAuth();

  const execute = useCallback(async (
    tokenAddress: string,
    accounts: string[],
    status: boolean,
  ) => {
    if (!isAuthenticated) throw new Error('Not authenticated');
    setState({ isLoading: true, isPending: false, hash: null, error: null });

    try {
      const hash = await serverSignTransaction({
        action: 'updateBlacklist',
        params: { tokenAddress, accounts, status },
      });

      setState(s => ({ ...s, isPending: true, hash }));
      await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      setState({ isLoading: false, isPending: false, hash, error: null });
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Blacklist update failed';
      setState({ isLoading: false, isPending: false, hash: null, error: msg });
      throw err;
    }
  }, [isAuthenticated]);

  return { ...state, execute };
}
