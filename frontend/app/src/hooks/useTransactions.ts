/**
 * Transaction hooks — write operations to Fuji contracts via viem walletClient.
 * Each hook exposes { isLoading, isPending, hash, error, execute }.
 */

import { useState, useCallback } from 'react';
import { type Address, type Hash, parseEther, decodeEventLog } from 'viem';
import { publicClient, createWalletClientFromKey } from '@/config/client';
import { CONTRACTS, ACTIVE_NETWORK } from '@/config/wagmi';
import { LaunchpadRouterABI, CreatorRegistryABI, ERC20ABI, TokenCreatedEvent } from '@/config/abis';
import { useAuth } from '@/contexts/AuthContext';

const contracts = CONTRACTS[ACTIVE_NETWORK];

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

// ============ Hooks ============

/** Create a token with optional initial buy */
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
    buyAmountAvax: number;
    minTokensOut?: bigint;
  }) => {
    if (!wallet) throw new Error('Not authenticated');
    setState({ isLoading: true, isPending: false, hash: null, error: null });

    try {
      const creationFee = parseEther('0.02');
      // Router requires msg.value > creationFee, so always include a minimum buy
      const buyAmount = params.buyAmountAvax > 0
        ? parseEther(params.buyAmountAvax.toString())
        : parseEther('0.001'); // minimum buy so msg.value > creationFee
      const totalValue = creationFee + buyAmount;

      // Strip base64 data URIs — too large for on-chain storage
      const safeImageURI = params.imageURI.startsWith('data:') ? '' : params.imageURI;

      const hash = await wallet.walletClient.writeContract({
        address: contracts.LaunchpadRouter as Address,
        abi: LaunchpadRouterABI,
        functionName: 'createTokenAndBuy',
        args: [
          {
            name: params.name,
            symbol: params.symbol,
            description: params.description,
            imageURI: safeImageURI,
            twitter: params.twitter,
            telegram: params.telegram,
            website: params.website,
          },
          params.minTokensOut ?? 0n,
        ],
        value: totalValue,
        gas: 2_000_000n,
      });

      setState(s => ({ ...s, isPending: true, hash }));
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setState({ isLoading: false, isPending: false, hash, error: null });

      // Parse the TokenCreated event to get the new token address
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
          // Not the event we're looking for
        }
      }

      return { ...receipt, tokenAddress };
    } catch (err: any) {
      let msg = err?.shortMessage || err?.message || 'Transaction failed';
      // Make RPC errors more user-friendly
      if (msg.includes('insufficient funds') || msg.includes('exceeds the balance')) {
        msg = 'Insufficient AVAX balance. You need at least 0.03 AVAX (creation fee + gas).';
      } else if (err?.name === 'InvalidInputRpcError' || msg.includes('Missing or invalid parameters')) {
        msg = 'Transaction rejected by network. Please try again.';
      }
      setState({ isLoading: false, isPending: false, hash: null, error: msg });
      throw err;
    }
  }, [wallet]);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return { ...state, execute, reset };
}

/** Buy tokens on bonding curve */
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
      const value = parseEther(params.avaxAmount.toString());
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 min

      const hash = await wallet.walletClient.writeContract({
        address: contracts.LaunchpadRouter as Address,
        abi: LaunchpadRouterABI,
        functionName: 'buy',
        args: [{
          token: params.tokenAddress as Address,
          amountIn: value,
          minAmountOut: params.minTokensOut,
          recipient: wallet.account.address,
          deadline,
        }],
        value,
        gas: 500_000n,
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

/** Sell tokens — handles ERC20 approve + sell in two steps */
export function useSell() {
  const [state, setState] = useState<TxState & { step: 'idle' | 'approving' | 'selling' }>({
    ...INITIAL_STATE,
    step: 'idle',
  });
  const wallet = useWalletClient();

  const execute = useCallback(async (params: {
    tokenAddress: string;
    tokenAmount: bigint;
    minAvaxOut: bigint;
  }) => {
    if (!wallet) throw new Error('Not authenticated');
    setState({ isLoading: true, isPending: false, hash: null, error: null, step: 'approving' });

    try {
      // Step 1: Check allowance
      const currentAllowance = await publicClient.readContract({
        address: params.tokenAddress as Address,
        abi: ERC20ABI,
        functionName: 'allowance',
        args: [wallet.account.address, contracts.LaunchpadRouter as Address],
      }) as bigint;

      // Step 2: Approve if needed
      if (currentAllowance < params.tokenAmount) {
        const approveHash = await wallet.walletClient.writeContract({
          address: params.tokenAddress as Address,
          abi: ERC20ABI,
          functionName: 'approve',
          args: [contracts.LaunchpadRouter as Address, params.tokenAmount],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // Step 3: Execute sell
      setState(s => ({ ...s, step: 'selling' }));
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

      const hash = await wallet.walletClient.writeContract({
        address: contracts.LaunchpadRouter as Address,
        abi: LaunchpadRouterABI,
        functionName: 'sell',
        args: [{
          token: params.tokenAddress as Address,
          amountIn: params.tokenAmount,
          minAmountOut: params.minAvaxOut,
          recipient: wallet.account.address,
          deadline,
        }],
        gas: 500_000n,
      });

      setState(s => ({ ...s, isPending: true, hash }));
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setState({ isLoading: false, isPending: false, hash, error: null, step: 'idle' });
      return receipt;
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Sell failed';
      setState({ isLoading: false, isPending: false, hash: null, error: msg, step: 'idle' });
      throw err;
    }
  }, [wallet]);

  const reset = useCallback(() => setState({ ...INITIAL_STATE, step: 'idle' }), []);

  return { ...state, execute, reset };
}

/** Create an on-chain creator profile */
export function useCreateProfile() {
  const [state, setState] = useState<TxState>(INITIAL_STATE);
  const wallet = useWalletClient();

  const execute = useCallback(async (params: {
    handle: string;
    displayName: string;
    avatarURI: string;
    bio: string;
  }) => {
    if (!wallet) throw new Error('Not authenticated');
    setState({ isLoading: true, isPending: false, hash: null, error: null });

    try {
      const hash = await wallet.walletClient.writeContract({
        address: contracts.CreatorRegistry as Address,
        abi: CreatorRegistryABI,
        functionName: 'createProfile',
        args: [params.handle, params.displayName, params.avatarURI, params.bio],
      });

      setState(s => ({ ...s, isPending: true, hash }));
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setState({ isLoading: false, isPending: false, hash, error: null });
      return receipt;
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Profile creation failed';
      setState({ isLoading: false, isPending: false, hash: null, error: msg });
      throw err;
    }
  }, [wallet]);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return { ...state, execute, reset };
}
