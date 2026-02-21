import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { TokenImage } from '@/components/TokenImage';
import { TradingChart } from '@/components/TradingChart';
import {
  Check, Copy, ExternalLink,
  Users, BarChart3, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { formatPrice } from '@/utils/format';
import { useAuth } from '@/contexts/AuthContext';
import { useTokenLaunch, useBondingCurveQuote, useAvaxBalance, useTokenBalance, useTradeActivity, useTokenHolders } from '@/hooks/useContracts';
import { useBuy, useSell } from '@/hooks/useTransactions';
import { publicClient } from '@/config/client';
import { ERC20ABI } from '@/config/abis';
import { CHAINS, ACTIVE_NETWORK } from '@/config/wagmi';
// @ts-ignore
import { parseEther, formatEther, type Address } from 'viem';

function isAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() / 1000) - timestamp);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''}`;
  const months = Math.floor(days / 30);
  return `${months} month${months !== 1 ? 's' : ''}`;
}

/** Generate a deterministic gradient avatar from an address */
function addressToColor(address: string): [string, string] {
  const hash = address.toLowerCase().replace('0x', '');
  const hue1 = parseInt(hash.slice(0, 6), 16) % 360;
  const hue2 = (hue1 + 40 + (parseInt(hash.slice(6, 12), 16) % 80)) % 360;
  return [`hsl(${hue1}, 65%, 55%)`, `hsl(${hue2}, 65%, 45%)`];
}

function AddressAvatar({ address, size = 32 }: { address: string; size?: number }) {
  const [c1, c2] = addressToColor(address);
  return (
    <div
      className="rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
      }}
    />
  );
}

function formatTokenQty(amount: number): string {
  if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)}B`;
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M`;
  if (amount >= 1e3) return `${(amount / 1e3).toFixed(2)}K`;
  return amount.toFixed(0);
}


function useOnChainTokenMeta(address: string | undefined) {
  const [meta, setMeta] = useState<{ name: string; symbol: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address || !isAddress(address)) { setLoading(false); return; }
    let cancelled = false;

    async function fetch() {
      try {
        const [name, symbol] = await Promise.all([
          publicClient.readContract({
            address: address as any,
            abi: ERC20ABI,
            functionName: 'name',
          }),
          publicClient.readContract({
            address: address as any,
            abi: ERC20ABI,
            functionName: 'symbol',
          }),
        ]);
        if (!cancelled) setMeta({ name: name as string, symbol: symbol as string });
      } catch {
        if (!cancelled) setMeta(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [address]);

  return { meta, loading };
}

export function TokenDetailPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const { isAuthenticated, isLoading, signInWithX, user } = useAuth();

  const tokenAddress = ticker && isAddress(ticker) ? ticker : undefined;

  const { meta: chainMeta, loading: metaLoading } = useOnChainTokenMeta(tokenAddress);
  const { data: launchData, isLoading: launchLoading } = useTokenLaunch(tokenAddress);

  const displayAddress = tokenAddress;
  const displayName = chainMeta?.name || 'Loading...';
  const displaySymbol = chainMeta?.symbol || '';
  const displayCreator = launchData?.creator || '';

  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [copied, setCopied] = useState(false);
  const [chartInterval, setChartInterval] = useState<'1H' | '4H' | '1D' | '1W' | 'ALL'>('1H');

  const quote = useBondingCurveQuote(displayAddress, parseFloat(amount) || 0, activeTab === 'buy');
  const balance = useAvaxBalance(user?.wallet.address);
  const tokenBalance = useTokenBalance(displayAddress, user?.wallet.address);
  const { isLoading: buyLoading, isPending: buyPending, execute: executeBuy } = useBuy();
  const { isLoading: sellLoading, isPending: sellPending, step: sellStep, execute: executeSell } = useSell();
  const { trades, isLoading: tradesLoading } = useTradeActivity(displayAddress);
  const { holders, isLoading: holdersLoading } = useTokenHolders(displayAddress);

  const explorer = CHAINS[ACTIVE_NETWORK].explorer;


  const quickAmountsBuy = ['0.1', '0.5', '1', '5'];
  const quickAmountsSell = ['25', '50', '75', '100'];

  const handleBuy = async () => {
    const avaxAmount = parseFloat(amount);
    if (!avaxAmount || avaxAmount <= 0) { toast.error('Enter a valid amount'); return; }
    if (avaxAmount > balance) { toast.error('Insufficient AVAX balance'); return; }
    if (!displayAddress) return;

    try {
      const minOut = quote
        ? BigInt(Math.floor(quote.tokensOut * 0.98 * 1e18))
        : 0n;

      const receipt = await executeBuy({
        tokenAddress: displayAddress,
        avaxAmount,
        minTokensOut: minOut,
      });

      toast.success(`Bought $${displaySymbol}!`, {
        description: `TX: ${receipt.transactionHash.slice(0, 14)}...`,
      });
      setAmount('');
    } catch (err: any) {
      toast.error('Buy failed', { description: err?.shortMessage || err?.message });
    }
  };

  const handleSell = async () => {
    const tokenAmount = parseFloat(amount);
    if (!tokenAmount || tokenAmount <= 0) { toast.error('Enter a valid amount'); return; }
    if (!displayAddress) return;

    try {
      const tokenAmountWei = parseEther(tokenAmount.toString());
      const minOut = quote
        ? parseEther((quote.tokensOut * 0.98).toFixed(18))
        : 0n;

      const receipt = await executeSell({
        tokenAddress: displayAddress,
        tokenAmount: tokenAmountWei,
        minAvaxOut: minOut,
      });

      toast.success(`Sold $${displaySymbol}!`, {
        description: `TX: ${receipt.transactionHash.slice(0, 14)}...`,
      });
      setAmount('');
    } catch (err: any) {
      toast.error('Sell failed', { description: err?.shortMessage || err?.message });
    }
  };

  const copyAddress = () => {
    if (displayAddress) {
      navigator.clipboard.writeText(displayAddress);
      setCopied(true);
      toast.success('Address copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const marketCap = launchData?.reserveBalance ? launchData.reserveBalance * 1000 : 0;

  // Loading
  if (tokenAddress && (metaLoading || launchLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-cre8-red/30 border-t-cre8-red rounded-full animate-spin mx-auto" />
          <p className="text-dim">Loading token data...</p>
        </div>
      </div>
    );
  }

  // Not found
  if (!tokenAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Token Not Found</h1>
          <Link to="/">
            <Button className="bg-cre8-red hover:bg-cre8-red/90">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const graduationProgress = launchData?.graduationProgress || 0;
  const currentPrice = launchData?.currentPrice || 0;
  const reserveBalance = launchData?.reserveBalance || 0;
  const tokensSold = launchData?.tokensSold ? Number(formatEther(launchData.tokensSold)) : 0;
  const tokenBalanceFormatted = Number(formatEther(tokenBalance));
  const timeIntervals: Array<'1H' | '4H' | '1D' | '1W' | 'ALL'> = ['1H', '4H', '1D', '1W', 'ALL'];

  return (
    <div className="min-h-screen">
      {/* Token Info Bar */}
      <div className="border-b border-white/[0.06] glass-nav">
        <div className="max-w-[1400px] mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cre8-red/20 to-violet-500/20 flex items-center justify-center border border-white/[0.08] overflow-hidden">
                <TokenImage
                  tokenAddress={tokenAddress!}
                  symbol={displaySymbol}
                  onChainImageURI={launchData?.imageURI}
                  className="w-full h-full flex items-center justify-center"
                  imgClassName="w-full h-full object-cover"
                  fallbackClassName="text-lg font-bold text-white"
                />
              </div>
              <div>
                <h1 className="text-base font-bold text-white">${displaySymbol}</h1>
                <p className="text-xs text-dim">{displayName}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5 ml-auto text-sm">
              <div className="text-right">
                <p className="text-[11px] text-dim">Price</p>
                <p className="text-white font-mono tabular-nums">{formatPrice(currentPrice)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-dim">Reserve</p>
                <p className="text-white font-mono tabular-nums">{reserveBalance.toFixed(4)} AVAX</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-dim">Sold</p>
                <p className="text-white font-mono tabular-nums">{tokensSold.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-dim">MCap</p>
                <p className="text-white font-mono tabular-nums">${marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
              {launchData?.isGraduated && (
                <span className="px-2 py-0.5 bg-green-500/15 text-green-400 text-xs rounded-full font-medium">
                  Graduated
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="max-w-[1400px] mx-auto px-4 py-5">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* Left — Chart & Activity */}
          <div className="xl:col-span-8 space-y-5">
            {/* Chart */}
            <div className="surface overflow-hidden flex flex-col min-h-[420px]">
              <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  {timeIntervals.map((interval) => (
                    <button
                      key={interval}
                      onClick={() => setChartInterval(interval)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        chartInterval === interval
                          ? 'bg-white/[0.08] text-white'
                          : 'text-dim hover:text-white'
                      }`}
                    >
                      {interval}
                    </button>
                  ))}
                </div>
                <div className="text-right">
                  <span className="text-dim text-xs">Creator </span>
                  <span className="text-xs font-mono text-violet-400">{displayCreator.slice(0, 6)}...{displayCreator.slice(-4)}</span>
                </div>
              </div>

              <div className="flex-1 relative">
                <TradingChart
                  trades={trades}
                  currentPrice={currentPrice}
                  interval={chartInterval}
                  isLoading={tradesLoading}
                />
              </div>
            </div>

            {/* Activity Tabs */}
            <div className="surface overflow-hidden">
              <Tabs defaultValue="activity">
                <div className="p-3 border-b border-white/[0.06]">
                  <TabsList className="bg-transparent gap-1 p-0 h-auto">
                    <TabsTrigger value="activity" className="data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-dim rounded-lg px-3 py-1.5 text-sm font-medium">
                      <BarChart3 className="w-3.5 h-3.5 mr-1.5" />Activity
                    </TabsTrigger>
                    <TabsTrigger value="holders" className="data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-dim rounded-lg px-3 py-1.5 text-sm font-medium">
                      <Users className="w-3.5 h-3.5 mr-1.5" />Holders
                    </TabsTrigger>
                    <TabsTrigger value="creator" className="data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-dim rounded-lg px-3 py-1.5 text-sm font-medium">
                      <Globe className="w-3.5 h-3.5 mr-1.5" />Creator
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="activity" className="m-0">
                  {tradesLoading ? (
                    <div className="p-8 text-center">
                      <div className="w-6 h-6 border-2 border-cre8-red/30 border-t-cre8-red rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-dim text-sm">Loading trades...</p>
                    </div>
                  ) : trades.length === 0 ? (
                    <div className="p-8 text-center text-dim">
                      <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      <p>No trades yet</p>
                      <p className="text-sm mt-1 opacity-70">Be the first to trade this token!</p>
                    </div>
                  ) : (
                    <div>
                      {/* Table header */}
                      <div className="grid grid-cols-[1.6fr_0.8fr_1fr_1fr_0.8fr_0.9fr] gap-3 px-4 py-2.5 text-[11px] text-dim font-medium uppercase tracking-wider border-b border-white/[0.04]">
                        <span>Trader</span>
                        <span>Type</span>
                        <span className="text-right">Token Qty</span>
                        <span className="text-right">Price</span>
                        <span className="text-right">AVAX</span>
                        <span className="text-right">Date</span>
                      </div>
                      {/* Trade rows */}
                      <div className="max-h-[480px] overflow-y-auto divide-y divide-white/[0.03]">
                        {trades.map((trade, i) => (
                          <a
                            key={`${trade.txHash}-${i}`}
                            href={`${explorer}/tx/${trade.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`grid grid-cols-[1.6fr_0.8fr_1fr_1fr_0.8fr_0.9fr] gap-3 px-4 py-3 text-sm hover:bg-white/[0.03] transition-all items-center ${
                              trade.isNew ? 'animate-trade-flash' : ''
                            }`}
                          >
                            {/* Trader */}
                            <div className="flex items-center gap-2.5 min-w-0">
                              {trade.traderAvatar ? (
                                <img src={trade.traderAvatar} alt="" className="w-7 h-7 rounded-full shrink-0 object-cover" />
                              ) : (
                                <AddressAvatar address={trade.trader} size={28} />
                              )}
                              <div className="min-w-0">
                                {trade.traderName ? (
                                  <>
                                    <p className="text-white text-xs font-medium truncate">{trade.traderName}</p>
                                    <p className="font-mono text-[10px] text-dim/50 truncate">{trade.trader.slice(0, 6)}...{trade.trader.slice(-4)}</p>
                                  </>
                                ) : (
                                  <span className="font-mono text-white text-xs truncate">
                                    {trade.trader.slice(0, 6)}...{trade.trader.slice(-4)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Type */}
                            <span className={`font-semibold text-[13px] ${trade.type === 'buy' ? 'text-green-400' : 'text-cre8-red'}`}>
                              {trade.type === 'buy' ? 'Bought' : 'Sold'}
                            </span>

                            {/* Token Qty */}
                            <span className="font-mono text-white text-right tabular-nums text-[13px]">
                              {formatTokenQty(trade.tokenAmount)}
                            </span>

                            {/* Price */}
                            <span className="font-mono text-dim text-right tabular-nums text-[13px]">
                              {formatPrice(trade.newPrice)}
                            </span>

                            {/* AVAX */}
                            <div className="flex items-center justify-end gap-1.5">
                              <span className={`font-mono tabular-nums text-[13px] ${trade.type === 'buy' ? 'text-green-400' : 'text-cre8-red'}`}>
                                {trade.avaxAmount < 0.01 ? trade.avaxAmount.toFixed(4) : trade.avaxAmount.toFixed(2)}
                              </span>
                            </div>

                            {/* Date */}
                            <span className="text-dim text-right text-xs whitespace-nowrap">
                              {formatTimeAgo(trade.timestamp)}
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="holders" className="m-0">
                  {holdersLoading ? (
                    <div className="p-8 text-center">
                      <div className="w-6 h-6 border-2 border-cre8-red/30 border-t-cre8-red rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-dim text-sm">Loading holders...</p>
                    </div>
                  ) : holders.length === 0 ? (
                    <div className="p-8 text-center text-dim">
                      <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      <p>No holders yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/[0.03]">
                      <div className="grid grid-cols-4 gap-4 px-4 py-2.5 text-xs text-dim font-medium">
                        <span>#</span>
                        <span>Address</span>
                        <span className="text-right">Balance</span>
                        <span className="text-right">%</span>
                      </div>
                      {holders.map((holder, i) => (
                        <a
                          key={holder.address}
                          href={`${explorer}/address/${holder.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="grid grid-cols-4 gap-4 px-4 py-3 text-sm hover:bg-white/[0.02] transition-colors items-center"
                        >
                          <span className="text-dim">{i + 1}</span>
                          <div className="flex items-center gap-2 min-w-0">
                            {holder.holderAvatar ? (
                              <img src={holder.holderAvatar} alt="" className="w-5 h-5 rounded-full shrink-0 object-cover" />
                            ) : (
                              <AddressAvatar address={holder.address} size={20} />
                            )}
                            <div className="min-w-0">
                              {holder.holderName ? (
                                <>
                                  <p className="text-white text-xs font-medium truncate">{holder.holderName}</p>
                                  <p className="font-mono text-[10px] text-dim/50 truncate">{holder.address.slice(0, 6)}...{holder.address.slice(-4)}</p>
                                </>
                              ) : (
                                <span className="font-mono text-white text-xs">{holder.address.slice(0, 6)}...{holder.address.slice(-4)}</span>
                              )}
                            </div>
                          </div>
                          <span className="font-mono text-white text-right tabular-nums">
                            {holder.balance > 1e6
                              ? `${(holder.balance / 1e6).toFixed(2)}M`
                              : holder.balance > 1e3
                                ? `${(holder.balance / 1e3).toFixed(2)}K`
                                : holder.balance.toFixed(0)}
                          </span>
                          <span className="font-mono text-dim text-right tabular-nums">{holder.percentage.toFixed(2)}%</span>
                        </a>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="creator" className="m-0">
                  {displayCreator && (
                    <div className="p-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cre8-red/15 to-violet-500/15 flex items-center justify-center">
                          <span className="text-lg font-bold text-white">
                            {displayCreator.startsWith('0x') ? displayCreator.slice(2, 4).toUpperCase() : displayCreator.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-white font-semibold">
                            {displayCreator.startsWith('0x')
                              ? `${displayCreator.slice(0, 6)}...${displayCreator.slice(-4)}`
                              : `@${displayCreator}`
                            }
                          </p>
                          <a
                            href={`${explorer}/address/${displayCreator}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-cre8-red hover:underline inline-flex items-center gap-1 mt-0.5 font-mono"
                          >
                            View on explorer <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Right — Sidebar */}
          <div className="xl:col-span-4 space-y-4">
            {/* Trading Panel */}
            <div className="surface p-4">
              <div className="flex bg-cre8-base p-1 rounded-lg mb-4 border border-white/[0.04]">
                <button
                  onClick={() => { setActiveTab('buy'); setAmount(''); }}
                  className={`flex-1 py-2.5 rounded-md font-semibold text-sm transition-all ${
                    activeTab === 'buy'
                      ? 'bg-green-500 text-white'
                      : 'text-dim hover:text-white'
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => { setActiveTab('sell'); setAmount(''); }}
                  className={`flex-1 py-2.5 rounded-md font-semibold text-sm transition-all ${
                    activeTab === 'sell'
                      ? 'bg-red-500 text-white'
                      : 'text-dim hover:text-white'
                  }`}
                >
                  Sell
                </button>
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-xs text-dim mb-1.5 px-0.5">
                  <span>{activeTab === 'buy' ? 'Amount (AVAX)' : 'Amount (tokens)'}</span>
                  <span className="tabular-nums">{activeTab === 'buy' ? `${balance.toFixed(4)} AVAX` : `${tokenBalanceFormatted.toLocaleString()} ${displaySymbol}`}</span>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/50 rounded-lg pr-16 h-12 text-lg font-mono focus-visible:ring-1 focus-visible:ring-white/20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dim text-xs font-semibold">
                    {activeTab === 'buy' ? 'AVAX' : displaySymbol}
                  </span>
                </div>
              </div>

              <div className="flex gap-1.5 mb-4">
                {activeTab === 'buy' ? (
                  quickAmountsBuy.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setAmount(amt)}
                      className="flex-1 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.04] text-xs text-dim hover:bg-white/[0.08] hover:text-white transition-colors font-mono"
                    >
                      {amt}
                    </button>
                  ))
                ) : (
                  quickAmountsSell.map((pct) => (
                    <button
                      key={pct}
                      onClick={() => {
                        if (tokenBalanceFormatted > 0) {
                          setAmount((tokenBalanceFormatted * parseInt(pct) / 100).toString());
                        }
                      }}
                      className="flex-1 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.04] text-xs text-dim hover:bg-white/[0.08] hover:text-white transition-colors font-mono"
                    >
                      {pct}%
                    </button>
                  ))
                )}
              </div>

              {isAuthenticated ? (
                <Button
                  onClick={activeTab === 'buy' ? handleBuy : handleSell}
                  disabled={buyLoading || sellLoading || !amount}
                  className={`w-full font-semibold rounded-lg h-11 text-sm ${
                    activeTab === 'buy'
                      ? 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20'
                      : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                  }`}
                >
                  {(buyLoading || sellLoading) && (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  )}
                  {activeTab === 'buy'
                    ? (buyPending ? 'Confirming...' : buyLoading ? 'Submitting...' : `Buy ${displaySymbol}`)
                    : (sellStep === 'approving' ? 'Approving...' : sellPending ? 'Confirming...' : sellLoading ? 'Selling...' : `Sell ${displaySymbol}`)
                  }
                </Button>
              ) : (
                <Button
                  onClick={signInWithX}
                  disabled={isLoading}
                  className="w-full bg-cre8-red/10 hover:bg-cre8-red/20 border border-cre8-red/20 text-cre8-red font-semibold rounded-lg h-11 text-sm"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  )}
                  {isLoading ? 'Signing in...' : 'Connect to Trade'}
                </Button>
              )}
            </div>

            {/* Quote */}
            <div className="surface p-4 space-y-2.5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-dim">You receive</span>
                <span className="font-mono font-semibold text-white tabular-nums">
                  {activeTab === 'buy'
                    ? (quote ? `${quote.tokensOut.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${displaySymbol}` : `0 ${displaySymbol}`)
                    : (quote ? `${quote.tokensOut.toFixed(4)} AVAX` : '0 AVAX')}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-dim">Price impact</span>
                <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${quote && quote.priceImpact > 2 ? 'bg-orange-500/15 text-orange-400' : 'bg-green-500/15 text-green-400'}`}>
                  {quote ? `${quote.priceImpact.toFixed(2)}%` : '<0.01%'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-dim">Fee</span>
                <span className="font-mono text-white text-xs tabular-nums">{quote ? `${quote.fee.toFixed(4)} AVAX` : '0 AVAX'}</span>
              </div>
            </div>

            {/* Contract Address */}
            <div className="surface p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-dim shrink-0">CA</span>
                <div className="flex items-center gap-1 overflow-hidden">
                  <span className="text-xs font-mono text-white truncate px-2 py-1 bg-cre8-base rounded">{displayAddress || '-'}</span>
                  <button onClick={copyAddress} className="p-1.5 hover:bg-white/[0.06] rounded transition-colors shrink-0">
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-dim" />}
                  </button>
                  <a href={`${explorer}/token/${displayAddress}`} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-white/[0.06] rounded transition-colors shrink-0">
                    <ExternalLink className="w-3.5 h-3.5 text-dim" />
                  </a>
                </div>
              </div>
            </div>

            {/* Graduation Progress */}
            <div className="surface p-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-white">Graduation</span>
                <span className="text-sm font-semibold text-green-400 tabular-nums">{graduationProgress.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-cre8-base rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all"
                  style={{ width: `${Math.min(graduationProgress, 100)}%` }}
                />
              </div>
              <p className="text-xs text-dim text-center tabular-nums">
                {Math.max(0, 69000 - reserveBalance).toFixed(1)} AVAX to graduate
              </p>
              {launchData?.isGraduated && (
                <div className="mt-2.5 p-2 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                  <span className="text-green-400 text-xs font-semibold">Graduated to TraderJoe</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
