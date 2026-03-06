/**
 * Forge mode hooks — read/write operations for LaunchManager, PresaleVault, VestingContract.
 */

import { useState, useEffect, useCallback } from 'react';
import { type Address, formatEther, parseEther } from 'viem';
import { publicClient, createWalletClientFromKey } from '@/config/client';
import { CONTRACTS, ACTIVE_NETWORK } from '@/config/wagmi';
import { LaunchManagerABI, PresaleVaultABI, VestingContractABI, ERC20ABI } from '@/config/abis';
import { useAuth } from '@/contexts/AuthContext';

const contracts = CONTRACTS[ACTIVE_NETWORK];

// ============ Types ============

export interface ForgeLaunchInfo {
  launchId: number;
  creator: string;
  token: string;
  bondingCurve: string;
  presaleVault: string;
  vestingContract: string;
  phase: number; // 0=Presale, 1=PresaleClosed, 2=WhitelistOnly, 3=Public, 4=Graduated
  createdAt: number;
  launchedAt: number;
  config: {
    name: string;
    symbol: string;
    presaleEnabled: boolean;
    whitelistEnabled: boolean;
    vestingEnabled: boolean;
  };
}

export interface PresaleInfo {
  state: number; // 0=Pending, 1=Open, 2=Closed, 3=Finalized, 4=Cancelled
  totalRaised: number;
  totalContributors: number;
  maxPerWallet: number;
  endTime: number;
  startTime: number;
  creator: string;
  token: string;
  totalTokensBought: number;
  hardCap: number;
  softCap: number;
}

export interface ContributorInfo {
  contributed: number;
  tokenAllocation: number;
  claimed: boolean;
  refunded: boolean;
  remainingAllowance: number;
}

export interface VestingInfo {
  beneficiary: string;
  token: string;
  totalAmount: number;
  released: number;
  releasable: number;
  vestedAmount: number;
  cliffEnd: number;
  vestingEnd: number;
  revoked: boolean;
  progress: number; // basis points (0-10000)
}

export const PHASE_LABELS = ['Presale', 'Presale Closed', 'Whitelist Only', 'Public', 'Graduated'] as const;
export const VAULT_STATE_LABELS = ['Pending', 'Open', 'Closed', 'Finalized', 'Cancelled'] as const;

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

interface TxState {
  isLoading: boolean;
  isPending: boolean;
  hash: string | null;
  error: string | null;
}

const INITIAL_TX: TxState = { isLoading: false, isPending: false, hash: null, error: null };

// ============ Read Hooks ============

/** Get a Forge launch by ID */
export function useForgeLaunch(launchId: number | undefined) {
  const [data, setData] = useState<ForgeLaunchInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (launchId === undefined) { setIsLoading(false); return; }
    let cancelled = false;

    async function load() {
      try {
        const [launchResult, configResult] = await Promise.all([
          publicClient.readContract({
            address: contracts.LaunchManager as Address,
            abi: LaunchManagerABI,
            functionName: 'getLaunch',
            args: [BigInt(launchId)],
          }),
          publicClient.readContract({
            address: contracts.LaunchManager as Address,
            abi: LaunchManagerABI,
            functionName: 'getLaunchConfig',
            args: [BigInt(launchId)],
          }),
        ]);

        if (cancelled) return;

        const l = launchResult as any;
        const c = configResult as any;

        setData({
          launchId,
          creator: l[0] || l.creator,
          token: l[1] || l.token,
          bondingCurve: l[2] || l.bondingCurve,
          presaleVault: l[3] || l.presaleVault,
          vestingContract: l[4] || l.vestingContract,
          phase: Number(l[5] ?? l.phase),
          createdAt: Number(l[6] ?? l.createdAt),
          launchedAt: Number(l[7] ?? l.launchedAt),
          config: {
            name: c[0] || c.name,
            symbol: c[1] || c.symbol,
            presaleEnabled: c[2] ?? c.presaleEnabled,
            whitelistEnabled: c[3] ?? c.whitelistEnabled,
            vestingEnabled: c[4] ?? c.vestingEnabled,
          },
        });
      } catch (err) {
        console.error('[useForgeLaunch] failed:', err);
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [launchId]);

  return { data, isLoading };
}

/** Get all Forge launches for a given creator */
export function useCreatorForgeLaunches(creatorAddress: string | undefined) {
  const [launches, setLaunches] = useState<ForgeLaunchInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!creatorAddress) { setIsLoading(false); return; }
    let cancelled = false;

    async function load() {
      try {
        const ids = await publicClient.readContract({
          address: contracts.LaunchManager as Address,
          abi: LaunchManagerABI,
          functionName: 'getCreatorLaunches',
          args: [creatorAddress as Address],
        }) as bigint[];

        if (cancelled || ids.length === 0) {
          if (!cancelled) { setLaunches([]); setIsLoading(false); }
          return;
        }

        const results = await Promise.all(
          ids.map(async (id) => {
            const [launchResult, configResult] = await Promise.all([
              publicClient.readContract({
                address: contracts.LaunchManager as Address,
                abi: LaunchManagerABI,
                functionName: 'getLaunch',
                args: [id],
              }),
              publicClient.readContract({
                address: contracts.LaunchManager as Address,
                abi: LaunchManagerABI,
                functionName: 'getLaunchConfig',
                args: [id],
              }),
            ]);
            const l = launchResult as any;
            const c = configResult as any;
            return {
              launchId: Number(id),
              creator: l[0] || l.creator,
              token: l[1] || l.token,
              bondingCurve: l[2] || l.bondingCurve,
              presaleVault: l[3] || l.presaleVault,
              vestingContract: l[4] || l.vestingContract,
              phase: Number(l[5] ?? l.phase),
              createdAt: Number(l[6] ?? l.createdAt),
              launchedAt: Number(l[7] ?? l.launchedAt),
              config: {
                name: c[0] || c.name,
                symbol: c[1] || c.symbol,
                presaleEnabled: c[2] ?? c.presaleEnabled,
                whitelistEnabled: c[3] ?? c.whitelistEnabled,
                vestingEnabled: c[4] ?? c.vestingEnabled,
              },
            } as ForgeLaunchInfo;
          })
        );

        if (!cancelled) setLaunches(results);
      } catch (err) {
        console.error('[useCreatorForgeLaunches] failed:', err);
        if (!cancelled) { setLaunches([]); setError('Failed to load launches'); }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [creatorAddress]);

  return { launches, isLoading, error };
}

/** Get presale vault info */
export function usePresaleVault(vaultAddress: string | undefined) {
  const [data, setData] = useState<PresaleInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!vaultAddress || vaultAddress === '0x0000000000000000000000000000000000000000') {
      setIsLoading(false);
      return;
    }
    let cancelled = false;

    async function load() {
      try {
        const addr = vaultAddress as Address;
        const [state, totalRaised, totalContributors, config, token, totalTokensBought] = await Promise.all([
          publicClient.readContract({ address: addr, abi: PresaleVaultABI, functionName: 'state' }),
          publicClient.readContract({ address: addr, abi: PresaleVaultABI, functionName: 'totalRaised' }),
          publicClient.readContract({ address: addr, abi: PresaleVaultABI, functionName: 'totalContributors' }),
          publicClient.readContract({ address: addr, abi: PresaleVaultABI, functionName: 'config' }),
          publicClient.readContract({ address: addr, abi: PresaleVaultABI, functionName: 'token' }).catch(() => '0x0000000000000000000000000000000000000000'),
          publicClient.readContract({ address: addr, abi: PresaleVaultABI, functionName: 'totalTokensBought' }).catch(() => 0n),
        ]);

        if (cancelled) return;

        const c = config as any;
        setData({
          state: Number(state),
          totalRaised: Number(formatEther(totalRaised as bigint)),
          totalContributors: Number(totalContributors),
          maxPerWallet: Number(formatEther(c[0] ?? c.maxPerWallet)),
          endTime: Number(c[3] ?? c.endTime),
          startTime: Number(c[2] ?? c.startTime),
          creator: c[4] ?? c.creator,
          token: token as string,
          totalTokensBought: Number(formatEther(totalTokensBought as bigint)),
          hardCap: Number(formatEther(c[5] ?? c.hardCap ?? 0n)),
          softCap: Number(formatEther(c[6] ?? c.softCap ?? 0n)),
        });
      } catch (err) {
        console.error('[usePresaleVault] failed:', err);
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [vaultAddress]);

  return { data, isLoading };
}

/** Get contributor info from a presale vault */
export function useContributorInfo(vaultAddress: string | undefined, userAddress: string | undefined) {
  const [data, setData] = useState<ContributorInfo | null>(null);

  useEffect(() => {
    if (!vaultAddress || !userAddress || vaultAddress === '0x0000000000000000000000000000000000000000') return;
    let cancelled = false;

    async function load() {
      try {
        const addr = vaultAddress as Address;
        const [info, remaining] = await Promise.all([
          publicClient.readContract({
            address: addr,
            abi: PresaleVaultABI,
            functionName: 'getContributor',
            args: [userAddress as Address],
          }),
          publicClient.readContract({
            address: addr,
            abi: PresaleVaultABI,
            functionName: 'remainingAllowance',
            args: [userAddress as Address],
          }),
        ]);

        if (cancelled) return;

        const i = info as any;
        setData({
          contributed: Number(formatEther(i.contributed ?? i[0])),
          tokenAllocation: Number(formatEther(i.tokenAllocation ?? i[1])),
          claimed: i.claimed ?? i[2],
          refunded: i.refunded ?? i[3],
          remainingAllowance: Number(formatEther(remaining as bigint)),
        });
      } catch {
        if (!cancelled) setData(null);
      }
    }

    load();
    const interval = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [vaultAddress, userAddress]);

  return data;
}

/** Get presale contributors list */
export function usePresaleContributors(vaultAddress: string | undefined) {
  const [contributors, setContributors] = useState<{ address: string; amount: number }[]>([]);

  useEffect(() => {
    if (!vaultAddress || vaultAddress === '0x0000000000000000000000000000000000000000') return;
    let cancelled = false;

    async function load() {
      try {
        const result = await publicClient.readContract({
          address: vaultAddress as Address,
          abi: PresaleVaultABI,
          functionName: 'getContributors',
          args: [0n, 20n],
        });

        if (cancelled) return;

        const r = result as any;
        const addresses = r[0] || r.addresses;
        const amounts = r[1] || r.amounts;
        const list = addresses.map((addr: string, i: number) => ({
          address: addr,
          amount: Number(formatEther(amounts[i])),
        }));
        setContributors(list);
      } catch {
        if (!cancelled) setContributors([]);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [vaultAddress]);

  return contributors;
}

/** Get vesting info from a VestingContract */
export function useVestingInfo(vestingAddress: string | undefined) {
  const [data, setData] = useState<VestingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!vestingAddress || vestingAddress === '0x0000000000000000000000000000000000000000') {
      setIsLoading(false);
      return;
    }
    let cancelled = false;

    async function load() {
      try {
        const addr = vestingAddress as Address;
        const [info, progress] = await Promise.all([
          publicClient.readContract({ address: addr, abi: VestingContractABI, functionName: 'getVestingInfo' }),
          publicClient.readContract({ address: addr, abi: VestingContractABI, functionName: 'getProgress' }),
        ]);

        if (cancelled) return;

        const v = info as any;
        setData({
          beneficiary: v[0] ?? v.beneficiary,
          token: v[1] ?? v.token,
          totalAmount: Number(formatEther(v[2] ?? v.totalAmount)),
          released: Number(formatEther(v[3] ?? v.released)),
          releasable: Number(formatEther(v[4] ?? v.releasable)),
          vestedAmount: Number(formatEther(v[5] ?? v.vestedAmount)),
          cliffEnd: Number(v[6] ?? v.cliffEnd),
          vestingEnd: Number(v[7] ?? v.vestingEnd),
          revoked: v[8] ?? v.revoked,
          progress: Number(progress) / 100, // convert bps to percentage
        });
      } catch (err) {
        console.error('[useVestingInfo] failed:', err);
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [vestingAddress]);

  return { data, isLoading };
}

// ============ Write Hooks ============

/** Create a Forge mode launch via LaunchManager */
export function useCreateForgeLaunch() {
  const [state, setState] = useState<TxState>(INITIAL_TX);
  const wallet = useWalletClient();

  const execute = useCallback(async (params: {
    name: string;
    symbol: string;
    description: string;
    imageURI: string;
    twitter: string;
    telegram: string;
    website: string;
    presaleEnabled: boolean;
    whitelistEnabled: boolean;
    vestingEnabled: boolean;
    presaleMaxPerWallet: bigint;
    presaleDuration: bigint;
    presaleHardCap: bigint;
    presaleSoftCap: bigint;
    whitelist: string[];
    whitelistDuration: bigint;
    vestingTeamBps: bigint;
    vestingCliff: bigint;
    vestingDuration: bigint;
  }) => {
    if (!wallet) throw new Error('Not authenticated');
    setState({ isLoading: true, isPending: false, hash: null, error: null });

    try {
      const hash = await wallet.walletClient.writeContract({
        address: contracts.LaunchManager as Address,
        abi: LaunchManagerABI,
        functionName: 'createForgeLaunch',
        args: [{
          name: params.name,
          symbol: params.symbol,
          description: params.description,
          imageURI: params.imageURI,
          twitter: params.twitter,
          telegram: params.telegram,
          website: params.website,
          presaleEnabled: params.presaleEnabled,
          whitelistEnabled: params.whitelistEnabled,
          vestingEnabled: params.vestingEnabled,
          presaleMaxPerWallet: params.presaleMaxPerWallet,
          presaleDuration: params.presaleDuration,
          presaleHardCap: params.presaleHardCap,
          presaleSoftCap: params.presaleSoftCap,
          whitelist: params.whitelist as Address[],
          whitelistDuration: params.whitelistDuration,
          vestingTeamBps: params.vestingTeamBps,
          vestingCliff: params.vestingCliff,
          vestingDuration: params.vestingDuration,
        }],
        value: parseEther('0.02'), // creation fee
        gas: 5_000_000n,
      });

      setState(s => ({ ...s, isPending: true, hash }));
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setState({ isLoading: false, isPending: false, hash, error: null });
      return receipt;
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Forge launch creation failed';
      setState({ isLoading: false, isPending: false, hash: null, error: msg });
      throw err;
    }
  }, [wallet]);

  return { ...state, execute };
}

/** Contribute AVAX to a presale vault */
export function useContribute() {
  const [state, setState] = useState<TxState>(INITIAL_TX);
  const wallet = useWalletClient();

  const execute = useCallback(async (vaultAddress: string, avaxAmount: number) => {
    if (!wallet) throw new Error('Not authenticated');
    setState({ isLoading: true, isPending: false, hash: null, error: null });

    try {
      const hash = await wallet.walletClient.writeContract({
        address: vaultAddress as Address,
        abi: PresaleVaultABI,
        functionName: 'contribute',
        args: [],
        value: parseEther(avaxAmount.toString()),
        gas: 200_000n,
      });

      setState(s => ({ ...s, isPending: true, hash }));
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setState({ isLoading: false, isPending: false, hash, error: null });
      return receipt;
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Contribution failed';
      setState({ isLoading: false, isPending: false, hash: null, error: msg });
      throw err;
    }
  }, [wallet]);

  return { ...state, execute };
}

/** Claim presale tokens from a finalized vault */
export function useClaimPresale() {
  const [state, setState] = useState<TxState>(INITIAL_TX);
  const wallet = useWalletClient();

  const execute = useCallback(async (vaultAddress: string) => {
    if (!wallet) throw new Error('Not authenticated');
    setState({ isLoading: true, isPending: false, hash: null, error: null });

    try {
      const hash = await wallet.walletClient.writeContract({
        address: vaultAddress as Address,
        abi: PresaleVaultABI,
        functionName: 'claim',
        args: [],
        gas: 200_000n,
      });

      setState(s => ({ ...s, isPending: true, hash }));
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setState({ isLoading: false, isPending: false, hash, error: null });
      return receipt;
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Claim failed';
      setState({ isLoading: false, isPending: false, hash: null, error: msg });
      throw err;
    }
  }, [wallet]);

  return { ...state, execute };
}

/** Refund from a cancelled presale vault */
export function useRefundPresale() {
  const [state, setState] = useState<TxState>(INITIAL_TX);
  const wallet = useWalletClient();

  const execute = useCallback(async (vaultAddress: string) => {
    if (!wallet) throw new Error('Not authenticated');
    setState({ isLoading: true, isPending: false, hash: null, error: null });

    try {
      const hash = await wallet.walletClient.writeContract({
        address: vaultAddress as Address,
        abi: PresaleVaultABI,
        functionName: 'refund',
        args: [],
        gas: 200_000n,
      });

      setState(s => ({ ...s, isPending: true, hash }));
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setState({ isLoading: false, isPending: false, hash, error: null });
      return receipt;
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Refund failed';
      setState({ isLoading: false, isPending: false, hash: null, error: msg });
      throw err;
    }
  }, [wallet]);

  return { ...state, execute };
}

/** Release vested tokens */
export function useReleaseVesting() {
  const [state, setState] = useState<TxState>(INITIAL_TX);
  const wallet = useWalletClient();

  const execute = useCallback(async (vestingAddress: string) => {
    if (!wallet) throw new Error('Not authenticated');
    setState({ isLoading: true, isPending: false, hash: null, error: null });

    try {
      const hash = await wallet.walletClient.writeContract({
        address: vestingAddress as Address,
        abi: VestingContractABI,
        functionName: 'release',
        args: [],
        gas: 200_000n,
      });

      setState(s => ({ ...s, isPending: true, hash }));
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setState({ isLoading: false, isPending: false, hash, error: null });
      return receipt;
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Release failed';
      setState({ isLoading: false, isPending: false, hash: null, error: msg });
      throw err;
    }
  }, [wallet]);

  return { ...state, execute };
}

/** Execute a launch after presale closes */
export function useExecuteLaunch() {
  const [state, setState] = useState<TxState>(INITIAL_TX);
  const wallet = useWalletClient();

  const execute = useCallback(async (launchId: number) => {
    if (!wallet) throw new Error('Not authenticated');
    setState({ isLoading: true, isPending: false, hash: null, error: null });

    try {
      const hash = await wallet.walletClient.writeContract({
        address: contracts.LaunchManager as Address,
        abi: LaunchManagerABI,
        functionName: 'executeLaunch',
        args: [BigInt(launchId)],
        gas: 5_000_000n,
      });

      setState(s => ({ ...s, isPending: true, hash }));
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setState({ isLoading: false, isPending: false, hash, error: null });
      return receipt;
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Launch execution failed';
      setState({ isLoading: false, isPending: false, hash: null, error: msg });
      throw err;
    }
  }, [wallet]);

  return { ...state, execute };
}
