/**
 * Contract hooks — read from Cre8Manager (UUPS proxy) via viem.
 * Single-contract architecture: all reads go to one address.
 */

import { useState, useEffect, useRef } from 'react';
import { type Address, formatEther, parseEther } from 'viem';
import { publicClient } from '@/config/client';
import { CONTRACTS, ACTIVE_NETWORK } from '@/config/wagmi';
import { Cre8ManagerABI, BuyEvent, SellEvent, ERC20ABI, TransferEvent } from '@/config/abis';

const contracts = CONTRACTS[ACTIVE_NETWORK];
const managerAddress = contracts.Cre8Manager as Address;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ============ Types ============

export interface TokenLaunchInfo {
  tokenAddress: string;
  tokenId: bigint;
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
  twitter: string;
  telegram: string;
  website: string;
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
  newPrice?: number;
  timestamp: number;
  txHash: string;
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
  tokenId: bigint;
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
  isForgeToken: boolean;
}

// ============ Helpers ============

/** Fetch token metadata (description, socials, image) from backend */
async function fetchTokenMetadata(tokenAddress: string): Promise<{
  description: string; imageURI: string; twitter: string; telegram: string; website: string;
}> {
  const defaults = { description: '', imageURI: '', twitter: '', telegram: '', website: '' };
  try {
    const res = await fetch(`${API_BASE}/api/tokens/${tokenAddress.toLowerCase()}/creator`);
    if (!res.ok) return defaults;
    const data = await res.json();
    return {
      description: data.description || '',
      imageURI: data.image_url || '',
      twitter: data.twitter || '',
      telegram: data.telegram || '',
      website: data.website || '',
    };
  } catch {
    return defaults;
  }
}

/** Check if a token has a whitelist (Forge Mode) by checking whitelistConfig endTime */
async function checkIsForgeToken(tokenId: bigint): Promise<boolean> {
  try {
    const result = await publicClient.readContract({
      address: managerAddress,
      abi: Cre8ManagerABI,
      functionName: 'isWhitelistActive',
      args: [tokenId],
    });
    // If it was ever a forge token, whitelistConfig.endTime > 0
    // But isWhitelistActive only returns true during WL phase
    // We can't easily distinguish "was forge" vs "easy" after WL ends
    // For now, treat active whitelist as forge
    return result as boolean;
  } catch {
    return false;
  }
}

/** Batch-resolve wallet addresses -> user profiles from backend */
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

// ============ Hooks ============

/** Load all tokens from Cre8Manager */
export function useOnChainTokens() {
  const [tokens, setTokens] = useState<OnChainToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const count = await publicClient.readContract({
          address: managerAddress,
          abi: Cre8ManagerABI,
          functionName: 'tokenCount',
        }) as bigint;

        if (cancelled) return;

        if (count === 0n) {
          setTokens([]);
          setIsLoading(false);
          return;
        }

        // Read all tokens in parallel (tokenIds are 1-based)
        const tokenIds = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));

        const results = await Promise.allSettled(
          tokenIds.map(async (tokenId) => {
            const info = await publicClient.readContract({
              address: managerAddress,
              abi: Cre8ManagerABI,
              functionName: 'getTokenInfo',
              args: [tokenId],
            }) as any;

            const tokenAddr = info[0] as string;

            // Fetch metadata from backend (fire in parallel)
            const [meta, isForge] = await Promise.all([
              fetchTokenMetadata(tokenAddr),
              checkIsForgeToken(tokenId),
            ]);

            // Check for image in backend
            let imageURI = meta.imageURI;
            if (!imageURI) {
              try {
                const imgRes = await fetch(`${API_BASE}/api/images/${tokenAddr.toLowerCase()}`);
                if (imgRes.ok) imageURI = `${API_BASE}/api/images/${tokenAddr.toLowerCase()}`;
              } catch { /* no image */ }
            }

            return {
              address: tokenAddr,
              tokenId,
              name: info[2] as string,
              symbol: info[3] as string,
              creator: info[1] as string,
              createdAt: 0, // Not returned by getTokenInfo; use backend data if needed
              currentPrice: Number(formatEther(info[6] as bigint)),
              reserveBalance: Number(formatEther(info[5] as bigint)),
              graduationProgress: Number(info[8] as bigint) / 100, // bps to %
              isGraduated: info[9] as boolean,
              imageURI,
              description: meta.description,
              isForgeToken: isForge,
            } as OnChainToken;
          })
        );

        if (cancelled) return;

        const loaded = results
          .filter((r): r is PromiseFulfilledResult<OnChainToken> => r.status === 'fulfilled')
          .map((r) => r.value)
          .reverse(); // newest first (higher tokenId = newer)

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

/** Get token launch info from Cre8Manager by token address */
export function useTokenLaunch(tokenAddress: string | undefined) {
  const [data, setData] = useState<TokenLaunchInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tokenAddress) { setIsLoading(false); return; }

    let cancelled = false;

    async function load() {
      try {
        // Look up tokenId from address
        const tokenId = await publicClient.readContract({
          address: managerAddress,
          abi: Cre8ManagerABI,
          functionName: 'getTokenByAddress',
          args: [tokenAddress as Address],
        }) as bigint;

        if (cancelled) return;

        // Read token info + metadata in parallel
        const [info, meta] = await Promise.all([
          publicClient.readContract({
            address: managerAddress,
            abi: Cre8ManagerABI,
            functionName: 'getTokenInfo',
            args: [tokenId],
          }),
          fetchTokenMetadata(tokenAddress),
        ]);

        if (cancelled) return;

        const i = info as any;
        const reserveAvax = Number(formatEther(i[5] as bigint));
        const progress = Number(i[8] as bigint) / 100;

        // Check for image in backend
        let imageURI = meta.imageURI;
        if (!imageURI) {
          try {
            const imgRes = await fetch(`${API_BASE}/api/images/${tokenAddress.toLowerCase()}`);
            if (imgRes.ok) imageURI = `${API_BASE}/api/images/${tokenAddress.toLowerCase()}`;
          } catch { /* no image */ }
        }

        setData({
          tokenAddress: tokenAddress!,
          tokenId,
          creator: i[1] as string,
          createdAt: 0, // use backend if needed
          currentPrice: Number(formatEther(i[6] as bigint)),
          reserveBalance: reserveAvax,
          tokensSold: i[4] as bigint,
          graduationProgress: progress,
          isGraduated: i[9] as boolean,
          tradingEnabled: !(i[9] as boolean),
          imageURI,
          description: meta.description,
          twitter: meta.twitter,
          telegram: meta.telegram,
          website: meta.website,
        });
      } catch (err) {
        console.error('[useTokenLaunch] failed for', tokenAddress, err);
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [tokenAddress]);

  return { data, isLoading };
}

/** Get bonding curve price quote from Cre8Manager */
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

    async function load() {
      try {
        // Resolve tokenId first
        const tokenId = await publicClient.readContract({
          address: managerAddress,
          abi: Cre8ManagerABI,
          functionName: 'getTokenByAddress',
          args: [tokenAddress as Address],
        }) as bigint;

        const amountWei = parseEther(avaxAmount.toString());

        if (isBuy) {
          const result = await publicClient.readContract({
            address: managerAddress,
            abi: Cre8ManagerABI,
            functionName: 'getBuyQuote',
            args: [tokenId, amountWei],
          }) as any;

          if (!cancelled) {
            setQuote({
              tokensOut: Number(formatEther(result[0] as bigint)),
              priceImpact: 0, // Not returned by new contract
              fee: Number(formatEther(result[1] as bigint)),
            });
          }
        } else {
          // For sell, avaxAmount is actually token amount
          const tokenAmountWei = parseEther(avaxAmount.toString());
          const result = await publicClient.readContract({
            address: managerAddress,
            abi: Cre8ManagerABI,
            functionName: 'getSellQuote',
            args: [tokenId, tokenAmountWei],
          }) as any;

          if (!cancelled) {
            setQuote({
              tokensOut: Number(formatEther(result[0] as bigint)),
              priceImpact: 0,
              fee: Number(formatEther(result[1] as bigint)),
            });
          }
        }
      } catch {
        if (!cancelled) setQuote(null);
      }
    }

    const debounce = setTimeout(load, 300);
    return () => { cancelled = true; clearTimeout(debounce); };
  }, [tokenAddress, avaxAmount, isBuy]);

  return quote;
}

/** Get token count from Cre8Manager */
export function useTokenCount() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    async function load() {
      try {
        const result = await publicClient.readContract({
          address: managerAddress,
          abi: Cre8ManagerABI,
          functionName: 'tokenCount',
        });
        setCount(Number(result));
      } catch {
        setCount(0);
      }
    }
    load();
  }, []);

  return count;
}

/** Get user's AVAX balance from chain */
export function useAvaxBalance(address: string | undefined) {
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    if (!address) { setBalance(0); return; }

    let cancelled = false;

    async function load() {
      try {
        const bal = await publicClient.getBalance({ address: address as Address });
        if (!cancelled) setBalance(Number(formatEther(bal)));
      } catch {
        if (!cancelled) setBalance(0);
      }
    }

    load();
    const interval = setInterval(load, 15000);
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

    async function load() {
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

    load();
    return () => { cancelled = true; };
  }, [tokenAddress, userAddress]);

  return balance;
}

// ============ Trade Activity ============

/** Parse Buy/Sell event logs from Cre8Manager into TradeActivity */
async function parseTradeLogs(
  buyLogs: any[],
  sellLogs: any[],
  existingTimestamps?: Map<bigint, number>,
): Promise<{ trades: TradeActivity[]; timestamps: Map<bigint, number> }> {
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

/** Get trade activity (Buy/Sell events from Cre8Manager) with live polling */
export function useTradeActivity(tokenAddress: string | undefined) {
  const [trades, setTrades] = useState<TradeActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const tokenIdRef = useRef<bigint>(0n);
  const lastBlockRef = useRef<bigint>(0n);
  const timestampsRef = useRef<Map<bigint, number>>(new Map());
  const knownTxHashes = useRef<Set<string>>(new Set());
  const userCacheRef = useRef<Record<string, { handle: string; name: string; avatar: string }>>({});

  // Initial load
  useEffect(() => {
    if (!tokenAddress) { setIsLoading(false); return; }
    let cancelled = false;

    async function load() {
      try {
        // Look up tokenId
        const tokenId = await publicClient.readContract({
          address: managerAddress,
          abi: Cre8ManagerABI,
          functionName: 'getTokenByAddress',
          args: [tokenAddress as Address],
        }) as bigint;

        if (cancelled) return;
        tokenIdRef.current = tokenId;

        const currentBlock = await publicClient.getBlockNumber();

        // Try exact creation block from backend, fall back to generous estimate
        let startBlock: bigint;
        try {
          const creatorRes = await fetch(`${API_BASE}/api/tokens/${tokenAddress}/creator`);
          if (creatorRes.ok) {
            const creatorData = await creatorRes.json();
            if (creatorData.created_block) {
              startBlock = BigInt(creatorData.created_block) - 1n;
            } else {
              throw new Error('no block');
            }
          } else {
            throw new Error('not found');
          }
        } catch {
          // Generous fallback: ~2.5 hours at 2s/block
          startBlock = currentBlock > 5000n ? currentBlock - 5000n : 0n;
        }

        if (cancelled) return;

        // Build chunk ranges then fire ALL in parallel
        const CHUNK = 2000n;
        const ranges: { from: bigint; to: bigint }[] = [];
        for (let from = startBlock; from <= currentBlock; from += CHUNK + 1n) {
          ranges.push({ from, to: from + CHUNK > currentBlock ? currentBlock : from + CHUNK });
        }

        // Query Buy and Sell events from Cre8Manager, filtered by tokenId (indexed param)
        const results = await Promise.all(
          ranges.map(({ from, to }) =>
            Promise.all([
              publicClient.getLogs({
                address: managerAddress,
                event: BuyEvent,
                args: { tokenId },
                fromBlock: from,
                toBlock: to,
              }),
              publicClient.getLogs({
                address: managerAddress,
                event: SellEvent,
                args: { tokenId },
                fromBlock: from,
                toBlock: to,
              }),
            ])
          )
        );

        if (cancelled) return;

        const allBuyLogs = results.flatMap(([buys]) => buys);
        const allSellLogs = results.flatMap(([, sells]) => sells);

        const { trades: allTrades, timestamps } = await parseTradeLogs(allBuyLogs, allSellLogs);

        timestampsRef.current = timestamps;
        lastBlockRef.current = currentBlock;
        for (const t of allTrades) knownTxHashes.current.add(t.txHash);

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
      if (tokenIdRef.current === 0n || lastBlockRef.current === 0n) return;

      try {
        const currentBlock = await publicClient.getBlockNumber();
        if (currentBlock <= lastBlockRef.current) return;

        const fromBlock = lastBlockRef.current + 1n;
        const tokenId = tokenIdRef.current;

        const [buyLogs, sellLogs] = await Promise.all([
          publicClient.getLogs({
            address: managerAddress,
            event: BuyEvent,
            args: { tokenId },
            fromBlock,
            toBlock: currentBlock,
          }),
          publicClient.getLogs({
            address: managerAddress,
            event: SellEvent,
            args: { tokenId },
            fromBlock,
            toBlock: currentBlock,
          }),
        ]);

        lastBlockRef.current = currentBlock;
        if (buyLogs.length === 0 && sellLogs.length === 0) return;

        const { trades: newTrades, timestamps } = await parseTradeLogs(
          buyLogs, sellLogs, timestampsRef.current,
        );
        timestampsRef.current = timestamps;

        let fresh: TradeActivity[] = newTrades
          .filter((t) => !knownTxHashes.current.has(t.txHash))
          .map((t): TradeActivity => ({ ...t, isNew: true }));

        if (fresh.length === 0) return;
        for (const t of fresh) knownTxHashes.current.add(t.txHash);

        fresh = await enrichTradesWithUsers(fresh, userCacheRef.current);

        if (!cancelled) {
          setTrades((prev) => {
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
        const currentBlock = await publicClient.getBlockNumber();

        // Try exact creation block from backend
        let startBlock: bigint;
        try {
          const creatorRes = await fetch(`${API_BASE}/api/tokens/${tokenAddress}/creator`);
          if (creatorRes.ok) {
            const data = await creatorRes.json();
            if (data.created_block) {
              startBlock = BigInt(data.created_block) - 1n;
            } else {
              throw new Error('no block');
            }
          } else {
            throw new Error('not found');
          }
        } catch {
          startBlock = currentBlock > 5000n ? currentBlock - 5000n : 0n;
        }

        if (cancelled) return;

        // Paginate Transfer events in parallel
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

        const totalSupply = await publicClient.readContract({
          address: tokenAddress as Address,
          abi: ERC20ABI,
          functionName: 'totalSupply',
        }) as bigint;

        const totalSupplyNum = Number(formatEther(totalSupply));

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

export interface GlobalTrade extends TradeActivity {
  tokenAddress: string;
  tokenSymbol: string;
}

/**
 * Global live trade feed — queries Cre8Manager Buy/Sell events across ALL tokens.
 * Resolves token symbols and trader names.
 */
export function useGlobalTradeActivity(tokens: OnChainToken[]) {
  const [trades, setTrades] = useState<GlobalTrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const lastBlockRef = useRef<bigint>(0n);
  const knownTxRef = useRef<Set<string>>(new Set());
  const tokensRef = useRef<OnChainToken[]>(tokens);
  const userCacheRef = useRef<Record<string, { handle: string; name: string; avatar: string }>>({});
  const timestampsRef = useRef<Map<bigint, number>>(new Map());

  useEffect(() => { tokensRef.current = tokens; }, [tokens]);

  const resolveSymbol = (tokenId: bigint): { symbol: string; address: string } => {
    const t = tokensRef.current.find((tk) => tk.tokenId === tokenId);
    return t ? { symbol: t.symbol, address: t.address } : { symbol: `#${tokenId}`, address: '' };
  };

  async function parseGlobalLogs(
    buyLogs: any[],
    sellLogs: any[],
    existingTimestamps?: Map<bigint, number>,
  ): Promise<{ trades: GlobalTrade[]; timestamps: Map<bigint, number> }> {
    const blockNumbers = new Set<bigint>();
    for (const log of [...buyLogs, ...sellLogs]) {
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

    // Resolve trader names
    const allTraders = [
      ...buyLogs.map((l) => ((l as any).args.buyer as string).toLowerCase()),
      ...sellLogs.map((l) => ((l as any).args.seller as string).toLowerCase()),
    ];
    const uncached = allTraders.filter((addr) => !userCacheRef.current[addr]);
    if (uncached.length > 0) {
      const resolved = await resolveWalletUsers(uncached);
      Object.assign(userCacheRef.current, resolved);
    }

    const buys: GlobalTrade[] = buyLogs.map((log) => {
      const args = (log as any).args;
      const tokenId = args.tokenId as bigint;
      const { symbol, address } = resolveSymbol(tokenId);
      const traderAddr = (args.buyer as string).toLowerCase();
      const userInfo = userCacheRef.current[traderAddr];
      return {
        type: 'buy' as const,
        trader: args.buyer as string,
        traderName: userInfo?.name || userInfo?.handle,
        traderAvatar: userInfo?.avatar,
        tokenAddress: address,
        tokenSymbol: symbol,
        avaxAmount: Number(formatEther(args.avaxIn as bigint)),
        tokenAmount: Number(formatEther(args.tokensOut as bigint)),
        newPrice: Number(formatEther(args.newPrice as bigint)),
        timestamp: blockTimestamps.get(log.blockNumber!) || 0,
        txHash: log.transactionHash || '',
        isNew: false,
      };
    });

    const sells: GlobalTrade[] = sellLogs.map((log) => {
      const args = (log as any).args;
      const tokenId = args.tokenId as bigint;
      const { symbol, address } = resolveSymbol(tokenId);
      const traderAddr = (args.seller as string).toLowerCase();
      const userInfo = userCacheRef.current[traderAddr];
      return {
        type: 'sell' as const,
        trader: args.seller as string,
        traderName: userInfo?.name || userInfo?.handle,
        traderAvatar: userInfo?.avatar,
        tokenAddress: address,
        tokenSymbol: symbol,
        avaxAmount: Number(formatEther(args.avaxOut as bigint)),
        tokenAmount: Number(formatEther(args.tokensIn as bigint)),
        newPrice: Number(formatEther(args.newPrice as bigint)),
        timestamp: blockTimestamps.get(log.blockNumber!) || 0,
        txHash: log.transactionHash || '',
        isNew: false,
      };
    });

    return {
      trades: [...buys, ...sells].sort((a, b) => b.timestamp - a.timestamp),
      timestamps: blockTimestamps,
    };
  }

  // Initial load — fetch last 24h of Buy/Sell events
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const ONE_DAY = 43_200n;
        const startBlock = currentBlock > ONE_DAY ? currentBlock - ONE_DAY : 0n;

        const CHUNK = 2000n;
        const ranges: { from: bigint; to: bigint }[] = [];
        for (let from = startBlock; from <= currentBlock; from += CHUNK + 1n) {
          ranges.push({ from, to: from + CHUNK > currentBlock ? currentBlock : from + CHUNK });
        }

        const results = await Promise.all(
          ranges.map(({ from, to }) =>
            Promise.all([
              publicClient.getLogs({ address: managerAddress, event: BuyEvent, fromBlock: from, toBlock: to }),
              publicClient.getLogs({ address: managerAddress, event: SellEvent, fromBlock: from, toBlock: to }),
            ])
          )
        );

        if (cancelled) return;

        const allBuyLogs = results.flatMap(([buys]) => buys);
        const allSellLogs = results.flatMap(([, sells]) => sells);

        const { trades: parsed, timestamps } = await parseGlobalLogs(allBuyLogs, allSellLogs);
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

  // Re-resolve token symbols when the tokens list changes
  useEffect(() => {
    if (tokens.length === 0) return;

    setTrades((prev) => {
      let changed = false;
      const updated = prev.map((trade) => {
        // Find by tokenAddress match
        const t = tokens.find((tk) => tk.address.toLowerCase() === trade.tokenAddress.toLowerCase());
        if (t && t.symbol !== trade.tokenSymbol) {
          changed = true;
          return { ...trade, tokenSymbol: t.symbol };
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

        const [buyLogs, sellLogs] = await Promise.all([
          publicClient.getLogs({ address: managerAddress, event: BuyEvent, fromBlock, toBlock: currentBlock }),
          publicClient.getLogs({ address: managerAddress, event: SellEvent, fromBlock, toBlock: currentBlock }),
        ]);

        lastBlockRef.current = currentBlock;
        if (buyLogs.length === 0 && sellLogs.length === 0) return;

        const { trades: newTrades, timestamps } = await parseGlobalLogs(
          buyLogs, sellLogs, timestampsRef.current,
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
            return [...fresh, ...existing].slice(0, 50);
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

// ============ Price Changes (from backend API) ============

interface PriceChanges {
  price: number;
  change_5m: number;
  change_1h: number;
  change_6h: number;
  change_24h: number;
}

export function usePriceChanges(tokenAddress: string | undefined) {
  const [data, setData] = useState<PriceChanges | null>(null);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    if (!tokenAddress) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`${API_URL}/api/prices/${tokenAddress}`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch { /* API may not be running */ }
    }

    load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [tokenAddress, API_URL]);

  return data;
}

// ============ Creator Verification ============

export function useCreatorStatus() {
  const [status, setStatus] = useState<{
    is_verified: boolean;
    has_pending: boolean;
    project_name?: string;
  } | null>(null);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    const session = localStorage.getItem('cre8_session');
    if (!session) return;

    fetch(`${API_URL}/api/creators/status`, {
      headers: { Authorization: `Bearer ${session}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStatus(data); })
      .catch(() => {});
  }, [API_URL]);

  return status;
}

export function useIsVerifiedCreator(address: string | undefined) {
  const [verified, setVerified] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    if (!address) return;
    fetch(`${API_URL}/api/creators/check/${address}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setVerified(data.is_verified); })
      .catch(() => {});
  }, [address, API_URL]);

  return verified;
}
