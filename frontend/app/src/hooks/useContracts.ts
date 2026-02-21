/**
 * Contract hooks — read from deployed Fuji contracts via viem.
 */

import { useState, useEffect, useRef } from 'react';
import { type Address, formatEther, parseEther } from 'viem';
import { publicClient } from '@/config/client';
import { CONTRACTS, ACTIVE_NETWORK, TOKEN_CONSTANTS } from '@/config/wagmi';
import { LaunchpadFactoryABI, BondingCurveABI, LaunchpadRouterABI, ERC20ABI, TokenMetadataABI, TokensPurchasedEvent, TokensSoldEvent, TransferEvent, SwapExecutedEvent } from '@/config/abis';

const contracts = CONTRACTS[ACTIVE_NETWORK];

// ============ Types ============

export interface TokenLaunchInfo {
  tokenAddress: string;
  bondingCurve: string;
  creator: string;
  createdAt: number;
  currentPrice: number;
  reserveBalance: number;
  tokensSold: bigint;
  graduationProgress: number;
  isGraduated: boolean;
  tradingEnabled: boolean;
  imageURI: string;
  description: string;
}

export interface BondingCurveQuote {
  tokensOut: number;
  priceImpact: number;
  fee: number;
}

export interface TradeActivity {
  type: 'buy' | 'sell';
  trader: string;
  traderName?: string;
  traderAvatar?: string;
  avaxAmount: number;
  tokenAmount: number;
  newPrice: number;
  timestamp: number;
  txHash: string;
  /** True for trades that just appeared via live polling */
  isNew?: boolean;
}

export interface TokenHolder {
  address: string;
  holderName?: string;
  holderAvatar?: string;
  balance: number;
  percentage: number;
}

/** Lightweight token summary for lists (Explore, Home) */
export interface OnChainToken {
  address: string;
  name: string;
  symbol: string;
  creator: string;
  createdAt: number;
  currentPrice: number;
  reserveBalance: number;
  graduationProgress: number;
  isGraduated: boolean;
  imageURI: string;
  description: string;
}

// ============ Hooks ============

/** Load all tokens from the on-chain Factory + read metadata */
export function useOnChainTokens() {
  const [tokens, setTokens] = useState<OnChainToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // 1. Get total token count
        const count = await publicClient.readContract({
          address: contracts.LaunchpadFactory as Address,
          abi: LaunchpadFactoryABI,
          functionName: 'getTokenCount',
        }) as bigint;

        if (cancelled) return;

        if (count === 0n) {
          setTokens([]);
          setIsLoading(false);
          return;
        }

        // 2. Get all token addresses (max 50 for now)
        const limit = count > 50n ? 50n : count;
        const addresses = await publicClient.readContract({
          address: contracts.LaunchpadFactory as Address,
          abi: LaunchpadFactoryABI,
          functionName: 'getTokens',
          args: [0n, limit],
        }) as string[];

        if (cancelled) return;

        // 3. For each token, read metadata in parallel
        const results = await Promise.allSettled(
          addresses.map(async (addr) => {
            const [launchInfo, name, symbol, tokenMeta] = await Promise.all([
              publicClient.readContract({
                address: contracts.LaunchpadFactory as Address,
                abi: LaunchpadFactoryABI,
                functionName: 'getLaunchInfo',
                args: [addr as Address],
              }),
              publicClient.readContract({
                address: addr as Address,
                abi: ERC20ABI,
                functionName: 'name',
              }),
              publicClient.readContract({
                address: addr as Address,
                abi: ERC20ABI,
                functionName: 'symbol',
              }),
              publicClient.readContract({
                address: addr as Address,
                abi: TokenMetadataABI,
                functionName: 'metadata',
              }).catch(() => null),
            ]);

            const curveAddress = (launchInfo as any).bondingCurve;

            // Read bonding curve data
            const [currentPrice, reserveBalance] = await Promise.all([
              publicClient.readContract({
                address: curveAddress as Address,
                abi: BondingCurveABI,
                functionName: 'getCurrentPrice',
              }),
              publicClient.readContract({
                address: curveAddress as Address,
                abi: BondingCurveABI,
                functionName: 'reserveBalance',
              }),
            ]);

            const reserveAvax = Number(formatEther(reserveBalance as bigint));
            const graduationTarget = Number(TOKEN_CONSTANTS.GRADUATION_THRESHOLD);

            return {
              address: addr,
              name: name as string,
              symbol: symbol as string,
              creator: (launchInfo as any).creator,
              createdAt: Number((launchInfo as any).createdAt),
              currentPrice: Number(formatEther(currentPrice as bigint)),
              reserveBalance: reserveAvax,
              graduationProgress: Math.min((reserveAvax / graduationTarget) * 100, 100),
              isGraduated: (launchInfo as any).isGraduated,
              imageURI: (tokenMeta as any)?.imageURI || '',
              description: (tokenMeta as any)?.description || '',
            } as OnChainToken;
          })
        );

        if (cancelled) return;

        const loaded = results
          .filter((r): r is PromiseFulfilledResult<OnChainToken> => r.status === 'fulfilled')
          .map((r) => r.value)
          .sort((a, b) => b.createdAt - a.createdAt); // newest first

        setTokens(loaded);
      } catch (err) {
        console.error('[useOnChainTokens] failed:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { tokens, isLoading };
}

/** Get token launch info from Factory + BondingCurve */
export function useTokenLaunch(tokenAddress: string | undefined) {
  const [data, setData] = useState<TokenLaunchInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tokenAddress) { setIsLoading(false); return; }

    let cancelled = false;

    async function fetch() {
      try {
        const launchInfo = await publicClient.readContract({
          address: contracts.LaunchpadFactory as Address,
          abi: LaunchpadFactoryABI,
          functionName: 'getLaunchInfo',
          args: [tokenAddress as Address],
        });

        if (cancelled) return;

        const curveAddress = (launchInfo as any).bondingCurve;

        const [currentPrice, reserveBalance, tokensSold, curveState, tokenMeta] = await Promise.all([
          publicClient.readContract({
            address: curveAddress as Address,
            abi: BondingCurveABI,
            functionName: 'getCurrentPrice',
          }),
          publicClient.readContract({
            address: curveAddress as Address,
            abi: BondingCurveABI,
            functionName: 'reserveBalance',
          }),
          publicClient.readContract({
            address: curveAddress as Address,
            abi: BondingCurveABI,
            functionName: 'currentSupply',
          }),
          publicClient.readContract({
            address: curveAddress as Address,
            abi: BondingCurveABI,
            functionName: 'state',
          }),
          publicClient.readContract({
            address: tokenAddress as Address,
            abi: TokenMetadataABI,
            functionName: 'metadata',
          }).catch(() => null),
        ]);

        if (cancelled) return;

        const reserveAvax = Number(formatEther(reserveBalance as bigint));
        const graduationTarget = Number(TOKEN_CONSTANTS.GRADUATION_THRESHOLD);
        const progress = Math.min((reserveAvax / graduationTarget) * 100, 100);

        setData({
          tokenAddress: tokenAddress!,
          bondingCurve: curveAddress as string,
          creator: (launchInfo as any).creator,
          createdAt: Number((launchInfo as any).createdAt),
          currentPrice: Number(formatEther(currentPrice as bigint)),
          reserveBalance: reserveAvax,
          tokensSold: tokensSold as bigint,
          graduationProgress: progress,
          isGraduated: (launchInfo as any).isGraduated || curveState === 2,
          tradingEnabled: curveState === 0,
          imageURI: (tokenMeta as any)?.imageURI || '',
          description: (tokenMeta as any)?.description || '',
        });
      } catch (err) {
        console.error('[useTokenLaunch] failed for', tokenAddress, err);
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [tokenAddress]);

  return { data, isLoading };
}

/** Get bonding curve price quote for buy/sell */
export function useBondingCurveQuote(
  tokenAddress: string | undefined,
  avaxAmount: number,
  isBuy: boolean,
) {
  const [quote, setQuote] = useState<BondingCurveQuote | null>(null);

  useEffect(() => {
    if (!tokenAddress || avaxAmount <= 0) {
      setQuote(null);
      return;
    }

    let cancelled = false;

    async function fetch() {
      try {
        const amountWei = parseEther(avaxAmount.toString());

        if (isBuy) {
          const result = await publicClient.readContract({
            address: contracts.LaunchpadRouter as Address,
            abi: LaunchpadRouterABI,
            functionName: 'getQuoteBuy',
            args: [tokenAddress as Address, amountWei],
          });

          if (!cancelled) {
            setQuote({
              tokensOut: Number(formatEther((result as any)[0])),
              priceImpact: Number((result as any)[2]) / 100,
              fee: Number(formatEther((result as any)[1])),
            });
          }
        } else {
          const tokenAmountWei = parseEther(avaxAmount.toString());
          const result = await publicClient.readContract({
            address: contracts.LaunchpadRouter as Address,
            abi: LaunchpadRouterABI,
            functionName: 'getQuoteSell',
            args: [tokenAddress as Address, tokenAmountWei],
          });

          if (!cancelled) {
            setQuote({
              tokensOut: Number(formatEther((result as any)[0])),
              priceImpact: Number((result as any)[2]) / 100,
              fee: Number(formatEther((result as any)[1])),
            });
          }
        }
      } catch {
        // Quote unavailable — leave null
        if (!cancelled) setQuote(null);
      }
    }

    const debounce = setTimeout(fetch, 300);
    return () => { cancelled = true; clearTimeout(debounce); };
  }, [tokenAddress, avaxAmount, isBuy]);

  return quote;
}

/** Get token count from factory */
export function useTokenCount() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    async function fetch() {
      try {
        const result = await publicClient.readContract({
          address: contracts.LaunchpadFactory as Address,
          abi: LaunchpadFactoryABI,
          functionName: 'getTokenCount',
        });
        setCount(Number(result));
      } catch {
        setCount(0);
      }
    }
    fetch();
  }, []);

  return count;
}

/** Get user's AVAX balance from chain */
export function useAvaxBalance(address: string | undefined) {
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    if (!address) { setBalance(0); return; }

    let cancelled = false;

    async function fetch() {
      try {
        const bal = await publicClient.getBalance({
          address: address as Address,
        });
        if (!cancelled) setBalance(Number(formatEther(bal)));
      } catch {
        if (!cancelled) setBalance(0);
      }
    }

    fetch();
    const interval = setInterval(fetch, 15000); // refresh every 15s
    return () => { cancelled = true; clearInterval(interval); };
  }, [address]);

  return balance;
}

/** Get user's ERC20 token balance */
export function useTokenBalance(tokenAddress: string | undefined, userAddress: string | undefined) {
  const [balance, setBalance] = useState<bigint>(0n);

  useEffect(() => {
    if (!tokenAddress || !userAddress) { setBalance(0n); return; }
    let cancelled = false;

    async function fetch() {
      try {
        const bal = await publicClient.readContract({
          address: tokenAddress as Address,
          abi: ERC20ABI,
          functionName: 'balanceOf',
          args: [userAddress as Address],
        });
        if (!cancelled) setBalance(bal as bigint);
      } catch {
        if (!cancelled) setBalance(0n);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [tokenAddress, userAddress]);

  return balance;
}

/** Parse buy/sell event logs into TradeActivity objects */
async function parseTradeLogs(
  buyLogs: any[],
  sellLogs: any[],
  existingTimestamps?: Map<bigint, number>,
): Promise<{ trades: TradeActivity[]; timestamps: Map<bigint, number> }> {
  // Collect unique block numbers we haven't resolved yet
  const blockNumbers = new Set<bigint>();
  for (const log of [...buyLogs, ...sellLogs]) {
    if (log.blockNumber && (!existingTimestamps || !existingTimestamps.has(log.blockNumber))) {
      blockNumbers.add(log.blockNumber);
    }
  }

  const blockTimestamps = new Map<bigint, number>(existingTimestamps || []);
  await Promise.all(
    [...blockNumbers].map(async (blockNumber) => {
      try {
        const block = await publicClient.getBlock({ blockNumber });
        blockTimestamps.set(blockNumber, Number(block.timestamp));
      } catch {
        blockTimestamps.set(blockNumber, Math.floor(Date.now() / 1000));
      }
    })
  );

  const buys: TradeActivity[] = buyLogs.map((log) => ({
    type: 'buy' as const,
    trader: (log as any).args.buyer as string,
    avaxAmount: Number(formatEther((log as any).args.avaxIn as bigint)),
    tokenAmount: Number(formatEther((log as any).args.tokensOut as bigint)),
    newPrice: Number(formatEther((log as any).args.newPrice as bigint)),
    timestamp: blockTimestamps.get(log.blockNumber!) || 0,
    txHash: log.transactionHash || '',
    isNew: false,
  }));

  const sells: TradeActivity[] = sellLogs.map((log) => ({
    type: 'sell' as const,
    trader: (log as any).args.seller as string,
    avaxAmount: Number(formatEther((log as any).args.avaxOut as bigint)),
    tokenAmount: Number(formatEther((log as any).args.tokensIn as bigint)),
    newPrice: Number(formatEther((log as any).args.newPrice as bigint)),
    timestamp: blockTimestamps.get(log.blockNumber!) || 0,
    txHash: log.transactionHash || '',
    isNew: false,
  }));

  return {
    trades: [...buys, ...sells].sort((a, b) => b.timestamp - a.timestamp),
    timestamps: blockTimestamps,
  };
}

/** Enrich trades with user names from backend */
async function enrichTradesWithUsers(
  trades: TradeActivity[],
  userCache: Record<string, { handle: string; name: string; avatar: string }>,
): Promise<TradeActivity[]> {
  const uncached = trades
    .map((t) => t.trader.toLowerCase())
    .filter((addr) => !userCache[addr]);

  if (uncached.length > 0) {
    const resolved = await resolveWalletUsers(uncached);
    Object.assign(userCache, resolved);
  }

  return trades.map((t) => {
    const info = userCache[t.trader.toLowerCase()];
    if (info) {
      return { ...t, traderName: info.name || info.handle, traderAvatar: info.avatar };
    }
    return t;
  });
}

/** Get trade activity (buy/sell events) with live polling for new trades */
export function useTradeActivity(tokenAddress: string | undefined) {
  const [trades, setTrades] = useState<TradeActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const curveRef = useRef<Address | null>(null);
  const lastBlockRef = useRef<bigint>(0n);
  const timestampsRef = useRef<Map<bigint, number>>(new Map());
  const knownTxHashes = useRef<Set<string>>(new Set());
  const userCacheRef = useRef<Record<string, { handle: string; name: string; avatar: string }>>({});

  // Initial load — fetch all historical trades
  useEffect(() => {
    if (!tokenAddress) { setIsLoading(false); return; }
    let cancelled = false;

    async function load() {
      try {
        const launchInfo = await publicClient.readContract({
          address: contracts.LaunchpadFactory as Address,
          abi: LaunchpadFactoryABI,
          functionName: 'getLaunchInfo',
          args: [tokenAddress as Address],
        });

        if (cancelled) return;

        const curveAddress = (launchInfo as any).bondingCurve as Address;
        curveRef.current = curveAddress;
        const createdAt = Number((launchInfo as any).createdAt);

        const currentBlock = await publicClient.getBlockNumber();
        const now = Math.floor(Date.now() / 1000);
        const secondsAgo = Math.max(now - createdAt, 0);
        const blocksAgo = BigInt(Math.ceil(secondsAgo / 2)) + 500n;
        const startBlock = currentBlock > blocksAgo ? currentBlock - blocksAgo : 0n;

        if (cancelled) return;

        // Build chunk ranges then fire ALL in parallel
        const CHUNK = 2000n;
        const ranges: { from: bigint; to: bigint }[] = [];
        for (let from = startBlock; from <= currentBlock; from += CHUNK + 1n) {
          ranges.push({ from, to: from + CHUNK > currentBlock ? currentBlock : from + CHUNK });
        }

        const results = await Promise.all(
          ranges.map(({ from, to }) =>
            Promise.all([
              publicClient.getLogs({ address: curveAddress, event: TokensPurchasedEvent, fromBlock: from, toBlock: to }),
              publicClient.getLogs({ address: curveAddress, event: TokensSoldEvent, fromBlock: from, toBlock: to }),
            ])
          )
        );

        if (cancelled) return;

        const allBuyLogs = results.flatMap(([buys]) => buys);
        const allSellLogs = results.flatMap(([, sells]) => sells);

        if (cancelled) return;

        const { trades: allTrades, timestamps } = await parseTradeLogs(allBuyLogs, allSellLogs);
        timestampsRef.current = timestamps;
        lastBlockRef.current = currentBlock;

        // Track known tx hashes
        for (const t of allTrades) knownTxHashes.current.add(t.txHash);

        // Enrich with user names
        const enriched = await enrichTradesWithUsers(allTrades, userCacheRef.current);

        if (!cancelled) setTrades(enriched);
      } catch (err) {
        console.error('[useTradeActivity] failed:', err);
        if (!cancelled) setTrades([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [tokenAddress]);

  // Poll for new trades every 10 seconds
  useEffect(() => {
    if (!tokenAddress) return;
    let cancelled = false;

    const interval = setInterval(async () => {
      if (!curveRef.current || lastBlockRef.current === 0n) return;

      try {
        const currentBlock = await publicClient.getBlockNumber();
        if (currentBlock <= lastBlockRef.current) return;

        const fromBlock = lastBlockRef.current + 1n;

        const [buyLogs, sellLogs] = await Promise.all([
          publicClient.getLogs({ address: curveRef.current, event: TokensPurchasedEvent, fromBlock, toBlock: currentBlock }),
          publicClient.getLogs({ address: curveRef.current, event: TokensSoldEvent, fromBlock, toBlock: currentBlock }),
        ]);

        lastBlockRef.current = currentBlock;

        if (buyLogs.length === 0 && sellLogs.length === 0) return;

        const { trades: newTrades, timestamps } = await parseTradeLogs(
          buyLogs, sellLogs, timestampsRef.current,
        );
        timestampsRef.current = timestamps;

        // Filter out any we already have & mark as new
        let fresh: TradeActivity[] = newTrades
          .filter((t) => !knownTxHashes.current.has(t.txHash))
          .map((t): TradeActivity => ({ ...t, isNew: true }));

        if (fresh.length === 0) return;
        for (const t of fresh) knownTxHashes.current.add(t.txHash);

        // Enrich with user names
        fresh = await enrichTradesWithUsers(fresh, userCacheRef.current);

        if (!cancelled) {
          setTrades((prev) => {
            // Clear isNew flag on old trades
            const existing = prev.map((t) => ({ ...t, isNew: false }));
            return [...fresh, ...existing];
          });
        }
      } catch (err) {
        console.error('[useTradeActivity] poll failed:', err);
      }
    }, 10_000);

    return () => { cancelled = true; clearInterval(interval); };
  }, [tokenAddress]);

  return { trades, isLoading };
}

/** Get token holders by reading Transfer events and checking current balances */
export function useTokenHolders(tokenAddress: string | undefined) {
  const [holders, setHolders] = useState<TokenHolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tokenAddress) { setIsLoading(false); return; }
    let cancelled = false;

    async function load() {
      try {
        // Get token creation time for block estimation
        const launchInfo = await publicClient.readContract({
          address: contracts.LaunchpadFactory as Address,
          abi: LaunchpadFactoryABI,
          functionName: 'getLaunchInfo',
          args: [tokenAddress as Address],
        });

        if (cancelled) return;

        const createdAt = Number((launchInfo as any).createdAt);
        const currentBlock = await publicClient.getBlockNumber();
        const now = Math.floor(Date.now() / 1000);
        const secondsAgo = Math.max(now - createdAt, 0);
        const blocksAgo = BigInt(Math.ceil(secondsAgo / 2)) + 500n;
        const startBlock = currentBlock > blocksAgo ? currentBlock - blocksAgo : 0n;

        if (cancelled) return;

        // Paginate Transfer events — fire ALL chunks in parallel
        const CHUNK = 2000n;
        const uniqueAddresses = new Set<string>();
        const ZERO = '0x0000000000000000000000000000000000000000';

        const ranges: { from: bigint; to: bigint }[] = [];
        for (let from = startBlock; from <= currentBlock; from += CHUNK + 1n) {
          ranges.push({ from, to: from + CHUNK > currentBlock ? currentBlock : from + CHUNK });
        }

        const transferResults = await Promise.all(
          ranges.map(({ from, to }) =>
            publicClient.getLogs({
              address: tokenAddress as Address,
              event: TransferEvent,
              fromBlock: from,
              toBlock: to,
            })
          )
        );

        for (const logs of transferResults) {
          for (const log of logs) {
            const toAddr = (log as any).args.to as string;
            const fromAddr = (log as any).args.from as string;
            if (toAddr && toAddr !== ZERO) uniqueAddresses.add(toAddr.toLowerCase());
            if (fromAddr && fromAddr !== ZERO) uniqueAddresses.add(fromAddr.toLowerCase());
          }
        }

        if (cancelled) return;

        // Read current balanceOf for each unique address
        const addresses = [...uniqueAddresses];
        const balances = await Promise.all(
          addresses.map(async (addr) => {
            try {
              const bal = await publicClient.readContract({
                address: tokenAddress as Address,
                abi: ERC20ABI,
                functionName: 'balanceOf',
                args: [addr as Address],
              });
              return { address: addr, balance: bal as bigint };
            } catch {
              return { address: addr, balance: 0n };
            }
          })
        );

        if (cancelled) return;

        // Get total supply for percentage calculation
        const totalSupply = await publicClient.readContract({
          address: tokenAddress as Address,
          abi: ERC20ABI,
          functionName: 'totalSupply',
        }) as bigint;

        const totalSupplyNum = Number(formatEther(totalSupply));

        // Filter non-zero, format, and sort
        const holderList: TokenHolder[] = balances
          .filter((b) => b.balance > 0n)
          .map((b) => {
            const balNum = Number(formatEther(b.balance));
            return {
              address: b.address,
              balance: balNum,
              percentage: totalSupplyNum > 0 ? (balNum / totalSupplyNum) * 100 : 0,
            };
          })
          .sort((a, b) => b.balance - a.balance);

        // Resolve user names for holders
        const holderAddresses = holderList.map((h) => h.address);
        const userMap = await resolveWalletUsers(holderAddresses);
        const enrichedHolders = holderList.map((h) => {
          const info = userMap[h.address.toLowerCase()];
          if (info) {
            return { ...h, holderName: info.name || info.handle, holderAvatar: info.avatar };
          }
          return h;
        });

        setHolders(enrichedHolders);
      } catch (err) {
        console.error('[useTokenHolders] failed:', err);
        if (!cancelled) setHolders([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [tokenAddress]);

  return { holders, isLoading };
}

// ============ Global Trade Feed ============

export interface GlobalTrade {
  type: 'buy' | 'sell';
  trader: string;
  traderName?: string;
  traderAvatar?: string;
  tokenAddress: string;
  tokenSymbol: string;
  avaxAmount: number;
  tokenAmount: number;
  timestamp: number;
  txHash: string;
  isNew?: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/** Batch-resolve wallet addresses → user profiles from backend */
async function resolveWalletUsers(
  addresses: string[],
): Promise<Record<string, { handle: string; name: string; avatar: string }>> {
  if (addresses.length === 0) return {};
  try {
    const unique = [...new Set(addresses.map(a => a.toLowerCase()))];
    const res = await fetch(`${API_BASE}/api/users/by-wallet?addresses=${unique.join(',')}`);
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * Global live trade feed — queries Router's SwapExecuted events across ALL tokens.
 * Resolves token symbols from the provided tokens list.
 * Resolves trader names from the backend user database.
 * Polls every 10 seconds for new trades.
 */
export function useGlobalTradeActivity(tokens: OnChainToken[]) {
  const [trades, setTrades] = useState<GlobalTrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const lastBlockRef = useRef<bigint>(0n);
  const knownTxRef = useRef<Set<string>>(new Set());
  const tokensRef = useRef<OnChainToken[]>(tokens);
  const userCacheRef = useRef<Record<string, { handle: string; name: string; avatar: string }>>({});

  // Keep tokens ref current
  useEffect(() => { tokensRef.current = tokens; }, [tokens]);

  const resolveSymbol = (addr: string): string => {
    const t = tokensRef.current.find(
      (tk) => tk.address.toLowerCase() === addr.toLowerCase(),
    );
    return t ? t.symbol : addr.slice(0, 6);
  };

  async function parseSwapLogs(
    logs: any[],
    existingTimestamps?: Map<bigint, number>,
  ): Promise<{ trades: GlobalTrade[]; timestamps: Map<bigint, number> }> {
    const blockNumbers = new Set<bigint>();
    for (const log of logs) {
      if (log.blockNumber && (!existingTimestamps || !existingTimestamps.has(log.blockNumber))) {
        blockNumbers.add(log.blockNumber);
      }
    }

    const blockTimestamps = new Map<bigint, number>(existingTimestamps || []);
    await Promise.all(
      [...blockNumbers].map(async (bn) => {
        try {
          const block = await publicClient.getBlock({ blockNumber: bn });
          blockTimestamps.set(bn, Number(block.timestamp));
        } catch {
          blockTimestamps.set(bn, Math.floor(Date.now() / 1000));
        }
      }),
    );

    // Collect trader addresses that aren't in the cache yet
    const uncachedTraders = logs
      .map((log) => ((log as any).args.user as string).toLowerCase())
      .filter((addr) => !userCacheRef.current[addr]);

    if (uncachedTraders.length > 0) {
      const resolved = await resolveWalletUsers(uncachedTraders);
      Object.assign(userCacheRef.current, resolved);
    }

    const parsed: GlobalTrade[] = logs.map((log) => {
      const args = (log as any).args;
      const isBuy = args.isBuy as boolean;
      const amountIn = Number(formatEther(args.amountIn as bigint));
      const amountOut = Number(formatEther(args.amountOut as bigint));
      const tokenAddr = args.token as string;
      const traderAddr = (args.user as string).toLowerCase();
      const userInfo = userCacheRef.current[traderAddr];

      return {
        type: isBuy ? 'buy' : 'sell',
        trader: args.user as string,
        traderName: userInfo?.name || userInfo?.handle,
        traderAvatar: userInfo?.avatar,
        tokenAddress: tokenAddr,
        tokenSymbol: resolveSymbol(tokenAddr),
        avaxAmount: isBuy ? amountIn : amountOut,
        tokenAmount: isBuy ? amountOut : amountIn,
        timestamp: blockTimestamps.get(log.blockNumber!) || 0,
        txHash: log.transactionHash || '',
        isNew: false,
      };
    });

    return {
      trades: parsed.sort((a, b) => b.timestamp - a.timestamp),
      timestamps: blockTimestamps,
    };
  }

  const timestampsRef = useRef<Map<bigint, number>>(new Map());

  // Initial load — fetch recent SwapExecuted events from Router
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const currentBlock = await publicClient.getBlockNumber();
        // Scan last 24 hours (~43,200 blocks at 2s/block)
        const ONE_DAY = 43_200n;
        const startBlock = currentBlock > ONE_DAY ? currentBlock - ONE_DAY : 0n;

        // Build chunk ranges then fire ALL in parallel (much faster than sequential)
        const CHUNK = 2000n;
        const ranges: { from: bigint; to: bigint }[] = [];
        for (let from = startBlock; from <= currentBlock; from += CHUNK + 1n) {
          ranges.push({ from, to: from + CHUNK > currentBlock ? currentBlock : from + CHUNK });
        }

        const results = await Promise.all(
          ranges.map(({ from, to }) =>
            publicClient.getLogs({
              address: contracts.LaunchpadRouter as Address,
              event: SwapExecutedEvent,
              fromBlock: from,
              toBlock: to,
            })
          )
        );

        if (cancelled) return;

        const allLogs = results.flat();

        const { trades: parsed, timestamps } = await parseSwapLogs(allLogs);
        timestampsRef.current = timestamps;
        lastBlockRef.current = currentBlock;
        for (const t of parsed) knownTxRef.current.add(t.txHash);

        if (!cancelled) setTrades(parsed);
      } catch (err) {
        console.error('[useGlobalTradeActivity] load failed:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // Re-resolve token symbols when the tokens list loads/changes
  useEffect(() => {
    if (tokens.length === 0) return;

    setTrades((prev) => {
      let changed = false;
      const updated = prev.map((trade) => {
        const resolved = resolveSymbol(trade.tokenAddress);
        if (resolved !== trade.tokenSymbol) {
          changed = true;
          return { ...trade, tokenSymbol: resolved };
        }
        return trade;
      });
      return changed ? updated : prev;
    });
  }, [tokens]);

  // Poll for new trades every 10 seconds
  useEffect(() => {
    let cancelled = false;

    const interval = setInterval(async () => {
      if (lastBlockRef.current === 0n) return;

      try {
        const currentBlock = await publicClient.getBlockNumber();
        if (currentBlock <= lastBlockRef.current) return;

        const fromBlock = lastBlockRef.current + 1n;
        const logs = await publicClient.getLogs({
          address: contracts.LaunchpadRouter as Address,
          event: SwapExecutedEvent,
          fromBlock,
          toBlock: currentBlock,
        });

        lastBlockRef.current = currentBlock;
        if (logs.length === 0) return;

        const { trades: newTrades, timestamps } = await parseSwapLogs(
          logs, timestampsRef.current,
        );
        timestampsRef.current = timestamps;

        const fresh = newTrades
          .filter((t) => !knownTxRef.current.has(t.txHash))
          .map((t) => ({ ...t, isNew: true }));

        if (fresh.length === 0) return;
        for (const t of fresh) knownTxRef.current.add(t.txHash);

        if (!cancelled) {
          setTrades((prev) => {
            const existing = prev.map((t) => ({ ...t, isNew: false }));
            return [...fresh, ...existing].slice(0, 50); // keep last 50
          });
        }
      } catch (err) {
        console.error('[useGlobalTradeActivity] poll failed:', err);
      }
    }, 10_000);

    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return { trades, isLoading };
}
