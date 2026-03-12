import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { TokenImage } from '@/components/TokenImage';
import { TradingChart } from '@/components/TradingChart';
import { BondingCurveViz } from '@/components/BondingCurveViz';
import { ThreadSection } from '@/components/ThreadSection';
import {
  Check, Copy, ExternalLink, Share2, Star,
  BarChart3, Filter,
  Twitter, Globe, MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { formatPrice } from '@/utils/format';
import { useAuth } from '@/contexts/AuthContext';
import { useTokenLaunch, useBondingCurveQuote, useAvaxBalance, useTokenBalance, useTradeActivity, useTokenHolders, usePriceChanges } from '@/hooks/useContracts';
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
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function addressToColor(address: string): [string, string] {
  const hash = address.toLowerCase().replace('0x', '');
  const hue1 = parseInt(hash.slice(0, 6), 16) % 360;
  const hue2 = (hue1 + 40 + (parseInt(hash.slice(6, 12), 16) % 80)) % 360;
  return [`hsl(${hue1}, 65%, 55%)`, `hsl(${hue2}, 65%, 45%)`];
}

function AddressAvatar({ address, size = 32 }: { address: string; size?: number }) {
  const [c1, c2] = addressToColor(address);
  return (
    <div className="rounded-full shrink-0"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${c1}, ${c2})` }} />
  );
}

function formatTokenQty(amount: number): string {
  if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)}B`;
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M`;
  if (amount >= 1e3) return `${(amount / 1e3).toFixed(2)}K`;
  return amount.toFixed(0);
}

function formatMcapShort(mcap: number): string {
  if (mcap >= 1e6) return `$${(mcap / 1e6).toFixed(1)}M`;
  if (mcap >= 1e3) return `$${(mcap / 1e3).toFixed(1)}K`;
  return `$${mcap.toFixed(0)}`;
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
          publicClient.readContract({ address: address as any, abi: ERC20ABI, functionName: 'name' }),
          publicClient.readContract({ address: address as any, abi: ERC20ABI, functionName: 'symbol' }),
        ]);
        if (!cancelled) setMeta({ name: name as string, symbol: symbol as string });
      } catch { if (!cancelled) setMeta(null); }
      finally { if (!cancelled) setLoading(false); }
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
  const isOwnToken = !!user?.wallet?.address && !!displayCreator &&
    user.wallet.address.toLowerCase() === displayCreator.toLowerCase();

  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [copied, setCopied] = useState(false);
  const [chartInterval, setChartInterval] = useState<'1H' | '4H' | '1D' | '1W' | 'ALL'>('1H');
  const [tradeFilter, setTradeFilter] = useState(false);
  const [tradeMinSize, setTradeMinSize] = useState(0.05);
  const [starred, setStarred] = useState(false);
  const [starLoading, setStarLoading] = useState(false);

  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // Check follow status on mount
  useEffect(() => {
    if (!displayCreator || !isAuthenticated) return;
    const session = localStorage.getItem('cre8_session');
    if (!session) return;
    fetch(`${API_URL}/api/follows/${displayCreator}`, {
      headers: { Authorization: `Bearer ${session}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setFollowing(data.following); })
      .catch(() => {});
  }, [displayCreator, isAuthenticated, API_URL]);

  // Check favorite status on mount
  useEffect(() => {
    if (!tokenAddress || !isAuthenticated) return;
    const session = localStorage.getItem('cre8_session');
    if (!session) return;
    fetch(`${API_URL}/api/favorites`, {
      headers: { Authorization: `Bearer ${session}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.favorites) setStarred(data.favorites.includes(tokenAddress.toLowerCase()));
      })
      .catch(() => {});
  }, [tokenAddress, isAuthenticated, API_URL]);

  const handleFollow = async () => {
    if (!isAuthenticated || !displayCreator) return;
    const session = localStorage.getItem('cre8_session');
    if (!session) return;
    setFollowLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/follows/${displayCreator}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFollowing(data.followed);
      }
    } catch { /* ignore */ }
    setFollowLoading(false);
  };

  const [slippage, setSlippage] = useState(() => {
    try { return parseFloat(localStorage.getItem('cre8_slippage') || '2'); } catch { return 2; }
  });
  const [showSlippage, setShowSlippage] = useState(false);

  const updateSlippage = (val: number) => {
    setSlippage(val);
    try { localStorage.setItem('cre8_slippage', String(val)); } catch { /* ignore */ }
  };

  const toggleStar = async () => {
    if (!tokenAddress || !isAuthenticated) return;
    const session = localStorage.getItem('cre8_session');
    if (!session) return;
    setStarLoading(true);
    const wasFav = starred;
    setStarred(!wasFav); // optimistic update
    try {
      const res = await fetch(`${API_URL}/api/favorites/${tokenAddress.toLowerCase()}`, {
        method: wasFav ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${session}` },
      });
      if (!res.ok) setStarred(wasFav); // revert on failure
    } catch {
      setStarred(wasFav); // revert on error
    }
    setStarLoading(false);
  };

  const quote = useBondingCurveQuote(displayAddress, parseFloat(amount) || 0, activeTab === 'buy');
  const balance = useAvaxBalance(user?.wallet.address);
  const tokenBalance = useTokenBalance(displayAddress, user?.wallet.address);
  const { isLoading: buyLoading, isPending: buyPending, execute: executeBuy } = useBuy();
  const { isLoading: sellLoading, isPending: sellPending, execute: executeSell } = useSell();
  const { trades, isLoading: tradesLoading } = useTradeActivity(displayAddress);
  const { holders, isLoading: holdersLoading } = useTokenHolders(displayAddress);
  const priceChanges = usePriceChanges(displayAddress);

  const explorer = CHAINS[ACTIVE_NETWORK].explorer;

  const quickAmountsBuy = [
    { label: 'Reset', value: '0' },
    { label: '0.1', value: '0.1' },
    { label: '0.5', value: '0.5' },
    { label: '1', value: '1' },
    { label: 'Max', value: balance.toFixed(4) },
  ];
  const quickAmountsSell = ['25', '50', '75', '100'];

  const tokenBalanceFormatted = Number(formatEther(tokenBalance));
  const positionValue = tokenBalanceFormatted * (launchData?.currentPrice || 0);

  const filteredTrades = useMemo(() => {
    if (!tradeFilter) return trades;
    return trades.filter(t => t.avaxAmount >= tradeMinSize);
  }, [trades, tradeFilter, tradeMinSize]);

  const vol24h = useMemo(() => {
    const cutoff = Math.floor(Date.now() / 1000) - 86400;
    return trades.filter(t => t.timestamp >= cutoff).reduce((sum, t) => sum + t.avaxAmount, 0);
  }, [trades]);

  const traderCount = useMemo(() => {
    return new Set(trades.map(t => t.trader)).size;
  }, [trades]);

  const handleBuy = async () => {
    const avaxAmount = parseFloat(amount);
    if (!avaxAmount || avaxAmount <= 0) { toast.error('Enter a valid amount'); return; }
    if (avaxAmount > balance) { toast.error('Insufficient AVAX balance'); return; }
    if (!displayAddress) return;
    try {
      const slipMul = 1 - (slippage / 100);
      const minOut = quote ? BigInt(Math.floor(quote.tokensOut * slipMul * 1e18)) : 0n;
      const receipt = await executeBuy({ tokenAddress: displayAddress, avaxAmount, minTokensOut: minOut });
      toast.success(`Bought $${displaySymbol}!`, { description: `TX: ${receipt.transactionHash.slice(0, 14)}...` });
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
      const slipMul = 1 - (slippage / 100);
      const minOut = quote ? parseEther((quote.tokensOut * slipMul).toFixed(18)) : 0n;
      const receipt = await executeSell({ tokenAddress: displayAddress, tokenAmount: tokenAmountWei, minAvaxOut: minOut });
      toast.success(`Sold $${displaySymbol}!`, { description: `TX: ${receipt.transactionHash.slice(0, 14)}...` });
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

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied to clipboard!');
  };

  const marketCap = launchData?.reserveBalance ? launchData.reserveBalance * 1000 : 0;

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

  if (!tokenAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Token Not Found</h1>
          <Link to="/"><Button className="bg-cre8-red hover:bg-cre8-red/90">Back to Home</Button></Link>
        </div>
      </div>
    );
  }

  const graduationProgress = launchData?.graduationProgress || 0;
  const currentPrice = launchData?.currentPrice || 0;
  const reserveBalance = launchData?.reserveBalance || 0;
  const timeIntervals: Array<'1H' | '4H' | '1D' | '1W' | 'ALL'> = ['1H', '4H', '1D', '1W', 'ALL'];
  const description = launchData?.description || '';

  return (
    <div className="min-h-screen">
      {/* ── Token Header ── */}
      <div className="border-b border-white/[0.06]">
        <div className="max-w-[1400px] mx-auto px-3 md:px-4 py-3 md:py-4">
          <div className="flex items-start gap-2.5 md:gap-4">
            {/* Back */}
            <Link to="/" className="text-dim hover:text-white transition-colors mt-1 shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </Link>

            {/* Token Avatar */}
            <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-cre8-red/20 to-violet-500/20 flex items-center justify-center border border-white/[0.08] overflow-hidden shrink-0">
              <TokenImage tokenAddress={tokenAddress!} symbol={displaySymbol} onChainImageURI={launchData?.imageURI}
                className="w-full h-full flex items-center justify-center" imgClassName="w-full h-full object-cover" fallbackClassName="text-base md:text-xl font-bold text-white" />
            </div>

            {/* Token Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                <h1 className="text-base md:text-xl font-bold text-white truncate">{displayName}</h1>
                <span className="text-xs md:text-sm text-dim">{displaySymbol}</span>
                {launchData?.isGraduated && (
                  <>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-500/15 text-emerald-400 rounded-full font-semibold">Graduated</span>
                    <a
                      href={`https://traderjoexyz.com/avalanche/trade?inputCurrency=AVAX&outputCurrency=${tokenAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hidden sm:flex text-[10px] px-2 py-0.5 bg-blue-500/15 text-blue-400 rounded-full font-semibold hover:bg-blue-500/25 transition-colors items-center gap-1"
                    >
                      Trade on TraderJoe <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                    <a
                      href={`https://dexscreener.com/avalanche/${tokenAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hidden sm:flex text-[10px] px-2 py-0.5 bg-green-500/15 text-green-400 rounded-full font-semibold hover:bg-green-500/25 transition-colors items-center gap-1"
                    >
                      DexScreener <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5 md:gap-2 mt-0.5 md:mt-1 text-[11px] md:text-xs text-dim">
                <AddressAvatar address={displayCreator} size={16} />
                <a href={`${explorer}/address/${displayCreator}`} target="_blank" rel="noopener noreferrer" className="font-mono hover:text-white transition-colors">
                  {displayCreator.slice(0, 6)}...{displayCreator.slice(-4)}
                </a>
                <span className="text-dim/30">·</span>
                <span>{launchData?.createdAt ? formatTimeAgo(launchData.createdAt) : ''}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
              <button onClick={handleShare}
                className="flex items-center gap-1.5 p-1.5 md:px-3 md:py-1.5 rounded-lg border border-white/[0.08] text-sm text-dim hover:text-white hover:bg-white/[0.04] transition-colors">
                <Share2 className="w-3.5 h-3.5" /><span className="hidden md:inline">Share</span>
              </button>
              <button onClick={copyAddress}
                className="flex items-center gap-1.5 p-1.5 md:px-3 md:py-1.5 rounded-lg border border-white/[0.08] text-sm text-dim hover:text-white hover:bg-white/[0.04] transition-colors font-mono">
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden md:inline">{displayAddress?.slice(0, 4)}...{displayAddress?.slice(-4)}</span>
              </button>
              <button onClick={toggleStar} disabled={starLoading}
                className={`p-1.5 rounded-lg border transition-colors ${starred ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-white/[0.08] text-dim hover:text-white hover:bg-white/[0.04]'}`}>
                <Star className={`w-4 h-4 ${starred ? 'fill-amber-400' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-[1400px] mx-auto px-3 md:px-4 py-3 md:py-5">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 md:gap-5">
          {/* Trading panel — show first on mobile for quick access */}
          <div className="xl:hidden space-y-3">
            {/* Trading Panel (mobile) */}
            <div className="surface p-3">
              {launchData?.isGraduated ? (
                <div className="text-center py-4">
                  <h3 className="text-base font-bold text-white mb-1">Token Graduated!</h3>
                  <p className="text-xs text-dim mb-3">Trade on TraderJoe DEX for the best liquidity.</p>
                  <div className="flex gap-2">
                    <a
                      href={`https://traderjoexyz.com/avalanche/trade?inputCurrency=AVAX&outputCurrency=${tokenAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold text-xs transition-colors"
                    >
                      TraderJoe <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={`https://dexscreener.com/avalanche/${tokenAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-dim hover:text-white text-xs font-semibold transition-colors"
                    >
                      DexScreener <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex bg-cre8-base p-1 rounded-lg mb-2 border border-white/[0.04]">
                    <button onClick={() => { setActiveTab('buy'); setAmount(''); }}
                      className={`flex-1 py-2 rounded-md font-semibold text-sm transition-all ${activeTab === 'buy' ? 'bg-green-500 text-white' : 'text-dim hover:text-white'}`}>
                      Buy
                    </button>
                    <button onClick={() => { setActiveTab('sell'); setAmount(''); }}
                      className={`flex-1 py-2 rounded-md font-semibold text-sm transition-all ${activeTab === 'sell' ? 'bg-red-500 text-white' : 'text-dim hover:text-white'}`}>
                      Sell
                    </button>
                  </div>
                  <div className="relative mb-2">
                    <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
                      className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/50 rounded-lg pr-16 h-10 text-base font-mono focus-visible:ring-1 focus-visible:ring-white/20" />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <span className="text-dim text-xs font-semibold">{activeTab === 'buy' ? 'AVAX' : displaySymbol}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 mb-2">
                    {activeTab === 'buy' ? quickAmountsBuy.map((btn) => (
                      <button key={btn.label} onClick={() => setAmount(btn.value === '0' ? '' : btn.value)}
                        className="flex-1 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.04] text-[11px] text-dim hover:bg-white/[0.08] hover:text-white transition-colors font-mono">
                        {btn.label}
                      </button>
                    )) : quickAmountsSell.map((pct) => (
                      <button key={pct} onClick={() => { if (tokenBalanceFormatted > 0) setAmount((tokenBalanceFormatted * parseInt(pct) / 100).toString()); }}
                        className="flex-1 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.04] text-[11px] text-dim hover:bg-white/[0.08] hover:text-white transition-colors font-mono">
                        {pct}%
                      </button>
                    ))}
                  </div>
                  {isAuthenticated ? (
                    <Button onClick={activeTab === 'buy' ? handleBuy : handleSell} disabled={buyLoading || sellLoading || !amount}
                      className={`w-full font-semibold rounded-lg h-10 text-sm ${activeTab === 'buy' ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}>
                      {(buyLoading || sellLoading) && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />}
                      {activeTab === 'buy'
                        ? (buyPending ? 'Confirming...' : buyLoading ? 'Submitting...' : `Buy ${displaySymbol}`)
                        : (sellPending ? 'Confirming...' : sellLoading ? 'Selling...' : `Sell ${displaySymbol}`)}
                    </Button>
                  ) : (
                    <Button onClick={signInWithX} disabled={isLoading}
                      className="w-full bg-cre8-red hover:bg-cre8-red/90 text-white font-semibold rounded-lg h-10 text-sm">
                      {isLoading ? 'Signing in...' : 'Log in to buy'}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Left */}
          <div className="xl:col-span-8 space-y-4">
            {/* Market Cap + Stats Bar */}
            <div className="flex flex-col md:flex-row md:flex-wrap md:items-end gap-3 md:gap-6 px-1">
              <div>
                <p className="text-xs text-dim mb-0.5">Market Cap</p>
                <p className="text-xl md:text-2xl font-bold text-white font-mono tabular-nums">{formatMcapShort(marketCap)}</p>
              </div>
              <div className="hidden md:block flex-1" />
              <div className="flex items-center gap-2 md:gap-4 text-xs overflow-x-auto no-scrollbar">
                <div className="text-center px-3 py-1.5 bg-cre8-surface rounded-lg border border-white/[0.04]">
                  <p className="text-dim mb-0.5">Vol 24h</p>
                  <p className="text-white font-mono font-semibold tabular-nums">{vol24h > 0 ? `${vol24h.toFixed(2)}` : '-'}</p>
                </div>
                <div className="text-center px-3 py-1.5 bg-cre8-surface rounded-lg border border-white/[0.04]">
                  <p className="text-dim mb-0.5">Price</p>
                  <p className="text-white font-mono font-semibold tabular-nums">{formatPrice(currentPrice)}</p>
                </div>
                <div className="text-center px-3 py-1.5 bg-cre8-surface rounded-lg border border-white/[0.04]">
                  <p className="text-dim mb-0.5">Txns</p>
                  <p className="text-white font-mono font-semibold tabular-nums">{trades.length || '-'}</p>
                </div>
                <div className="text-center px-3 py-1.5 bg-cre8-surface rounded-lg border border-white/[0.04]">
                  <p className="text-dim mb-0.5">Traders</p>
                  <p className="text-white font-mono font-semibold tabular-nums">{traderCount || '-'}</p>
                </div>
                {priceChanges && (
                  <>
                    {[
                      { label: '5m', value: priceChanges.change_5m },
                      { label: '1h', value: priceChanges.change_1h },
                      { label: '6h', value: priceChanges.change_6h },
                      { label: '24h', value: priceChanges.change_24h },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center px-3 py-1.5 bg-cre8-surface rounded-lg border border-white/[0.04]">
                        <p className="text-dim mb-0.5">{label}</p>
                        <p className={`font-mono font-semibold tabular-nums ${value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-white'}`}>
                          {value !== null && value !== undefined ? `${value > 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                        </p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Chart */}
            <div className="surface overflow-hidden flex flex-col min-h-[280px] md:min-h-[420px]">
              <div className="px-3 md:px-4 py-2 md:py-3 flex items-center justify-between border-b border-white/[0.06]">
                <div className="flex items-center gap-1 md:gap-2">
                  {timeIntervals.map((interval) => (
                    <button key={interval} onClick={() => setChartInterval(interval)}
                      className={`px-2 md:px-2.5 py-1 rounded-md text-[11px] md:text-xs font-medium transition-colors ${chartInterval === interval ? 'bg-white/[0.08] text-white' : 'text-dim hover:text-white'}`}>
                      {interval}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 relative">
                <TradingChart trades={trades} currentPrice={currentPrice} interval={chartInterval} isLoading={tradesLoading} />
              </div>
            </div>

            {/* Social links + Description */}
            {(description || launchData?.description || launchData?.twitter || launchData?.website || launchData?.telegram) && (
              <div className="px-1 space-y-2">
                {/* Social Links Row */}
                <div className="flex items-center gap-3 flex-wrap">
                  {launchData?.twitter && (
                    <a href={launchData.twitter.startsWith('http') ? launchData.twitter : `https://x.com/${launchData.twitter.replace('@', '')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-dim hover:text-white transition-colors">
                      <Twitter className="w-3.5 h-3.5" /><span className="font-mono truncate max-w-[120px]">{launchData.twitter}</span>
                    </a>
                  )}
                  {launchData?.telegram && (
                    <a href={launchData.telegram.startsWith('http') ? launchData.telegram : `https://t.me/${launchData.telegram}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-dim hover:text-white transition-colors">
                      <MessageSquare className="w-3.5 h-3.5" /><span className="font-mono truncate max-w-[120px]">{launchData.telegram}</span>
                    </a>
                  )}
                  {launchData?.website && (
                    <a href={launchData.website.startsWith('http') ? launchData.website : `https://${launchData.website}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-dim hover:text-white transition-colors">
                      <Globe className="w-3.5 h-3.5" /><span className="font-mono truncate max-w-[120px]">{launchData.website}</span>
                    </a>
                  )}
                  <a href={`${explorer}/token/${displayAddress}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-dim hover:text-white transition-colors ml-auto">
                    View on Explorer <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-sm text-dim/70">{description || 'No description...'}</p>
              </div>
            )}

            {/* Comments + Trades Tabs */}
            <div className="surface overflow-hidden">
              <Tabs defaultValue="comments">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <TabsList className="bg-transparent gap-4 p-0 h-auto">
                    <TabsTrigger value="comments" className="data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-cre8-red text-dim rounded-none px-0 py-1.5 text-sm font-semibold bg-transparent">
                      Comments
                    </TabsTrigger>
                    <TabsTrigger value="trades" className="data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-cre8-red text-dim rounded-none px-0 py-1.5 text-sm font-semibold bg-transparent">
                      Trades
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="comments" className="m-0">
                  <ThreadSection tokenAddress={displayAddress!} tokenSymbol={displaySymbol} />
                </TabsContent>

                <TabsContent value="trades" className="m-0">
                  {/* Trade filter bar */}
                  <div className="px-4 py-2 border-b border-white/[0.04] flex items-center gap-3">
                    <button onClick={() => setTradeFilter(!tradeFilter)}
                      className={`flex items-center gap-1.5 text-xs transition-colors ${tradeFilter ? 'text-cre8-red' : 'text-dim hover:text-white'}`}>
                      <Filter className="w-3 h-3" />
                      <span>filter by size</span>
                      <div className={`w-7 h-3.5 rounded-full relative transition-colors ${tradeFilter ? 'bg-cre8-red/60' : 'bg-white/[0.1]'}`}>
                        <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${tradeFilter ? 'right-0.5' : 'left-0.5'}`} />
                      </div>
                    </button>
                    {tradeFilter && (
                      <>
                        <input type="number" value={tradeMinSize} step={0.01} min={0}
                          onChange={(e) => setTradeMinSize(parseFloat(e.target.value) || 0)}
                          className="w-16 bg-cre8-base border border-white/[0.06] rounded px-2 py-1 text-xs text-white font-mono focus:outline-none" />
                        <span className="text-[10px] text-dim">(showing trades &gt; {tradeMinSize} AVAX)</span>
                      </>
                    )}
                  </div>

                  {tradesLoading ? (
                    <div className="p-8 text-center">
                      <div className="w-6 h-6 border-2 border-cre8-red/30 border-t-cre8-red rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-dim text-sm">Loading trades...</p>
                    </div>
                  ) : filteredTrades.length === 0 ? (
                    <div className="p-8 text-center text-dim">
                      <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      <p>{trades.length === 0 ? 'No trades yet' : 'No trades match filter'}</p>
                    </div>
                  ) : (
                    <div>
                      {/* Desktop table header */}
                      <div className="hidden md:grid grid-cols-[1.4fr_0.6fr_0.9fr_0.9fr_0.7fr_0.5fr] gap-3 px-4 py-2 text-[11px] text-dim font-medium uppercase tracking-wider border-b border-white/[0.04]">
                        <span>Account</span>
                        <span>Type</span>
                        <span className="text-right">Amount (AVAX)</span>
                        <span className="text-right">Amount ({displaySymbol})</span>
                        <span className="text-right">Time</span>
                        <span className="text-right">Txn</span>
                      </div>
                      <div className="max-h-[500px] overflow-y-auto divide-y divide-white/[0.03]">
                        {filteredTrades.map((trade, i) => (
                          <div key={`${trade.txHash}-${i}`} className={trade.isNew ? 'animate-trade-flash' : ''}>
                            {/* Desktop row */}
                            <div className="hidden md:grid grid-cols-[1.4fr_0.6fr_0.9fr_0.9fr_0.7fr_0.5fr] gap-3 px-4 py-2.5 text-[13px] hover:bg-white/[0.02] transition-colors items-center">
                              <div className="flex items-center gap-2 min-w-0">
                                {trade.traderAvatar ? (
                                  <img src={trade.traderAvatar} alt="" className="w-6 h-6 rounded-full shrink-0 object-cover" />
                                ) : (
                                  <AddressAvatar address={trade.trader} size={24} />
                                )}
                                <span className="font-mono text-white text-xs truncate">{trade.trader.slice(0, 6)}...{trade.trader.slice(-4)}</span>
                              </div>
                              <span className={`font-semibold ${trade.type === 'buy' ? 'text-green-400' : 'text-cre8-red'}`}>
                                {trade.type === 'buy' ? 'Buy' : 'Sell'}
                              </span>
                              <span className="font-mono text-white text-right tabular-nums">
                                {trade.avaxAmount < 0.01 ? trade.avaxAmount.toFixed(6) : trade.avaxAmount.toFixed(4)}
                              </span>
                              <span className="font-mono text-white text-right tabular-nums">
                                {formatTokenQty(trade.tokenAmount)}
                              </span>
                              <span className="text-dim text-right text-xs">{formatTimeAgo(trade.timestamp)}</span>
                              <a href={`${explorer}/tx/${trade.txHash}`} target="_blank" rel="noopener noreferrer"
                                className="text-right font-mono text-xs text-dim hover:text-white transition-colors truncate">
                                {trade.txHash.slice(0, 6)}
                              </a>
                            </div>
                            {/* Mobile compact row */}
                            <div className="md:hidden flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.02] transition-colors">
                              {trade.traderAvatar ? (
                                <img src={trade.traderAvatar} alt="" className="w-5 h-5 rounded-full shrink-0 object-cover" />
                              ) : (
                                <AddressAvatar address={trade.trader} size={20} />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[11px] font-semibold ${trade.type === 'buy' ? 'text-green-400' : 'text-cre8-red'}`}>
                                    {trade.type === 'buy' ? 'Buy' : 'Sell'}
                                  </span>
                                  <span className="font-mono text-white text-xs">
                                    {trade.avaxAmount < 0.01 ? trade.avaxAmount.toFixed(4) : trade.avaxAmount.toFixed(2)} AVAX
                                  </span>
                                </div>
                                <span className="font-mono text-dim text-[10px]">{trade.trader.slice(0, 6)}...{trade.trader.slice(-4)}</span>
                              </div>
                              <div className="text-right shrink-0">
                                <a href={`${explorer}/tx/${trade.txHash}`} target="_blank" rel="noopener noreferrer"
                                  className="text-dim text-[10px] hover:text-white transition-colors">{formatTimeAgo(trade.timestamp)}</a>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* ── Right Sidebar ── */}
          <div className="xl:col-span-4 space-y-4">
            {/* Trading Panel — hidden on mobile (shown above chart instead) */}
            <div className="hidden xl:block surface p-4">
              {launchData?.isGraduated ? (
                <div className="text-center py-6">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">Token Graduated!</h3>
                  <p className="text-sm text-dim mb-5">This token has graduated to TraderJoe DEX. Trade it there for the best liquidity.</p>
                  <div className="space-y-2">
                    <a
                      href={`https://traderjoexyz.com/avalanche/trade?inputCurrency=AVAX&outputCurrency=${tokenAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm transition-colors"
                    >
                      Trade on TraderJoe <ExternalLink className="w-4 h-4" />
                    </a>
                    <a
                      href={`https://dexscreener.com/avalanche/${tokenAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-dim hover:text-white hover:bg-white/[0.08] font-semibold text-sm transition-colors"
                    >
                      View on DexScreener <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                  {/* Still show position if user holds tokens */}
                  {isAuthenticated && user?.wallet?.address && tokenBalanceFormatted > 0 && (
                    <div className="mt-5 pt-4 border-t border-white/[0.06]">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-dim">Your balance</span>
                        <span className="text-white font-mono tabular-nums">{tokenBalanceFormatted.toLocaleString()} {displaySymbol}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
              <div className="flex bg-cre8-base p-1 rounded-lg mb-3 border border-white/[0.04]">
                <button onClick={() => { setActiveTab('buy'); setAmount(''); }}
                  className={`flex-1 py-2.5 rounded-md font-semibold text-sm transition-all ${activeTab === 'buy' ? 'bg-green-500 text-white' : 'text-dim hover:text-white'}`}>
                  Buy
                </button>
                <button onClick={() => { setActiveTab('sell'); setAmount(''); }}
                  className={`flex-1 py-2.5 rounded-md font-semibold text-sm transition-all ${activeTab === 'sell' ? 'bg-red-500 text-white' : 'text-dim hover:text-white'}`}>
                  Sell
                </button>
              </div>

              {/* Slippage link */}
              <div className="flex items-center justify-between text-[11px] mb-2 px-0.5">
                <span className="text-dim">Slippage: {slippage}%</span>
                <button className="text-dim hover:text-white transition-colors" onClick={() => setShowSlippage(!showSlippage)}>
                  {showSlippage ? 'Close' : 'Set max slippage'}
                </button>
              </div>

              {showSlippage && (
                <div className="mb-3 p-2.5 bg-cre8-base rounded-lg border border-white/[0.06]">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {[0.5, 1, 2, 5, 10].map(v => (
                      <button key={v} onClick={() => updateSlippage(v)}
                        className={`flex-1 py-1 rounded text-xs font-mono transition-colors ${slippage === v ? 'bg-cre8-red/20 text-cre8-red border border-cre8-red/30' : 'bg-white/[0.04] text-dim hover:text-white border border-white/[0.04]'}`}>
                        {v}%
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" value={slippage} min={0.1} max={50} step={0.1}
                      onChange={(e) => updateSlippage(parseFloat(e.target.value) || 2)}
                      className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-xs text-white font-mono focus:outline-none" />
                    <span className="text-xs text-dim">%</span>
                  </div>
                </div>
              )}

              {/* Amount input */}
              <div className="relative mb-2">
                <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
                  className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/50 rounded-lg pr-16 h-11 text-lg font-mono focus-visible:ring-1 focus-visible:ring-white/20" />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  <span className="text-dim text-xs font-semibold">{activeTab === 'buy' ? 'AVAX' : displaySymbol}</span>
                </div>
              </div>

              {/* Quick amounts */}
              <div className="flex gap-1.5 mb-3">
                {activeTab === 'buy' ? quickAmountsBuy.map((btn) => (
                  <button key={btn.label} onClick={() => setAmount(btn.value === '0' ? '' : btn.value)}
                    className="flex-1 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.04] text-xs text-dim hover:bg-white/[0.08] hover:text-white transition-colors font-mono">
                    {btn.label}
                  </button>
                )) : quickAmountsSell.map((pct) => (
                  <button key={pct} onClick={() => { if (tokenBalanceFormatted > 0) setAmount((tokenBalanceFormatted * parseInt(pct) / 100).toString()); }}
                    className="flex-1 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.04] text-xs text-dim hover:bg-white/[0.08] hover:text-white transition-colors font-mono">
                    {pct}%
                  </button>
                ))}
              </div>

              {/* Submit */}
              {isAuthenticated ? (
                <Button onClick={activeTab === 'buy' ? handleBuy : handleSell} disabled={buyLoading || sellLoading || !amount}
                  className={`w-full font-semibold rounded-lg h-11 text-sm ${activeTab === 'buy' ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}>
                  {(buyLoading || sellLoading) && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />}
                  {activeTab === 'buy'
                    ? (buyPending ? 'Confirming...' : buyLoading ? 'Submitting...' : `Buy ${displaySymbol}`)
                    : (sellPending ? 'Confirming...' : sellLoading ? 'Selling...' : `Sell ${displaySymbol}`)}
                </Button>
              ) : (
                <Button onClick={signInWithX} disabled={isLoading}
                  className="w-full bg-cre8-red hover:bg-cre8-red/90 text-white font-semibold rounded-lg h-11 text-sm">
                  {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> : null}
                  {isLoading ? 'Signing in...' : 'Log in to buy'}
                </Button>
              )}

              {/* Position Info */}
              {isAuthenticated && user?.wallet?.address && (
                <div className="mt-3 pt-3 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white font-mono tabular-nums">${positionValue.toFixed(2)}</span>
                    <span className="text-sm text-dim font-mono tabular-nums">{tokenBalanceFormatted.toLocaleString()} {displaySymbol}</span>
                  </div>
                  {(() => {
                    const addr = user.wallet.address.toLowerCase();
                    const myTrades = trades.filter(t => t.trader.toLowerCase() === addr);
                    const totalSpent = myTrades.filter(t => t.type === 'buy').reduce((s, t) => s + t.avaxAmount, 0);
                    const totalReceived = myTrades.filter(t => t.type === 'sell').reduce((s, t) => s + t.avaxAmount, 0);
                    const costBasis = totalSpent - totalReceived;
                    const pnl = positionValue - costBasis;
                    const pnlPct = costBasis > 0 ? ((pnl / costBasis) * 100) : 0;
                    return (
                      <div className="flex items-center gap-4 text-[11px] text-dim">
                        <span>Position</span>
                        <span>{myTrades.length} trade{myTrades.length !== 1 ? 's' : ''}</span>
                        <span className={`ml-auto font-mono tabular-nums ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {costBasis > 0 ? `${pnl >= 0 ? '+' : ''}${pnl.toFixed(4)} AVAX (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)` : '-'}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Quote details */}
              {amount && parseFloat(amount) > 0 && (
                <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-dim">You receive</span>
                    <span className="font-mono font-semibold text-white tabular-nums">
                      {activeTab === 'buy'
                        ? (quote ? `${quote.tokensOut.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${displaySymbol}` : `0 ${displaySymbol}`)
                        : (quote ? `${quote.tokensOut.toFixed(4)} AVAX` : '0 AVAX')}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-dim">Impact</span>
                    <span className={`font-mono px-1.5 py-0.5 rounded ${quote && quote.priceImpact > 2 ? 'bg-orange-500/15 text-orange-400' : 'bg-green-500/15 text-green-400'}`}>
                      {quote ? `${quote.priceImpact.toFixed(2)}%` : '<0.01%'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-dim">Fee</span>
                    <span className="font-mono text-white tabular-nums">{quote ? `${quote.fee.toFixed(4)} AVAX` : '0'}</span>
                  </div>
                </div>
              )}
                </>
              )}
            </div>

            {/* Creator Rewards */}
            <div className="surface p-4">
              <p className="text-sm font-semibold text-white mb-3">Creator rewards</p>
              <div className="flex items-center gap-3">
                <AddressAvatar address={displayCreator} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-white text-sm truncate">{displayCreator.slice(0, 6)}...{displayCreator.slice(-4)}</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-cre8-red/15 text-cre8-red rounded font-semibold">Creator</span>
                  </div>
                  <p className="text-[11px] text-dim mt-0.5">0.2% of trades</p>
                </div>
                {isAuthenticated && !isOwnToken && (
                  <button onClick={handleFollow} disabled={followLoading}
                    className={`text-xs border rounded-lg px-3 py-1.5 transition-colors shrink-0 ${following ? 'bg-cre8-red/15 text-cre8-red border-cre8-red/30' : 'text-dim hover:text-white border-white/[0.06]'}`}>
                    {followLoading ? '...' : following ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            </div>

            {/* Bonding Curve */}
            <BondingCurveViz progress={graduationProgress} reserveBalance={reserveBalance} targetReserve={69000} currentPrice={currentPrice} isGraduated={!!launchData?.isGraduated} />

            {/* Top Holders */}
            <div className="surface overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Top holders</span>
                <span className="text-[10px] text-dim">{holders.length} holders</span>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {holdersLoading ? (
                  <div className="p-6 text-center"><div className="w-5 h-5 border-2 border-cre8-red/30 border-t-cre8-red rounded-full animate-spin mx-auto" /></div>
                ) : holders.length === 0 ? (
                  <div className="p-6 text-center text-dim text-sm">No holders yet</div>
                ) : (
                  <div className="divide-y divide-white/[0.02]">
                    {holders.map((holder, i) => (
                      <a key={holder.address} href={`${explorer}/address/${holder.address}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2.5 px-4 py-2 hover:bg-white/[0.02] transition-colors">
                        {holder.holderAvatar ? (
                          <img src={holder.holderAvatar} alt="" className="w-5 h-5 rounded-full shrink-0 object-cover" />
                        ) : (
                          <AddressAvatar address={holder.address} size={20} />
                        )}
                        <span className="font-mono text-white text-xs truncate flex-1">
                          {holder.holderName || `${holder.address.slice(0, 6)}...${holder.address.slice(-4)}`}
                          {i === 0 && holder.percentage > 50 && <span className="text-[9px] text-blue-400 ml-1.5">Liquidity pool</span>}
                        </span>
                        <span className="font-mono text-dim text-xs tabular-nums shrink-0">{holder.percentage.toFixed(2)}%</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
