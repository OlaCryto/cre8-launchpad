import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TokenImage } from '@/components/TokenImage';
import { TradeTicker } from '@/components/TradeTicker';
import {
  IconFlame,
  IconPlus,
  IconClock,
  IconTrophy,
  IconSchool,
  IconSearch,
  IconRocket,
  IconCrown,
  IconArrowUpRight,
  IconFilter,
  IconLayoutGrid,
  IconLayoutList,
  IconX,
  IconSettings,
  IconCircleDot,
  IconSortDescending,
  IconMessageCircle,
  IconArrowsSort,
} from '@tabler/icons-react';
import { useOnChainTokens, useGlobalTradeActivity, type OnChainToken, type TradeActivity } from '@/hooks/useContracts';
import { formatPrice } from '@/utils/format';

type FilterTab = 'trending' | 'new' | 'graduating' | 'top' | 'oldest' | 'last_trade';
type ViewMode = 'grid' | 'list';

interface RangeFilter {
  min: number;
  max: number;
}

const MCAP_MAX = 50_000_000;
const RESERVE_MAX = 50_000;

// ── Helpers ──

function parseShorthand(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/[$,]/g, '');
  if (!s) return null;
  const match = s.match(/^(\d+(?:\.\d+)?)\s*(k|m|b)?$/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const suffix = match[2];
  if (suffix === 'k') return num * 1_000;
  if (suffix === 'm') return num * 1_000_000;
  if (suffix === 'b') return num * 1_000_000_000;
  return num;
}

function formatShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatReserveShort(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function ageLabel(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function formatMcap(reserve: number): string {
  const mcap = reserve * 1000;
  if (mcap >= 1_000_000) return `$${(mcap / 1_000_000).toFixed(2)}M`;
  if (mcap >= 1_000) return `$${(mcap / 1_000).toFixed(2)}K`;
  return `$${mcap.toFixed(0)}`;
}

function formatVol(vol: number): string {
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(2)}M`;
  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(2)}K`;
  if (vol > 0) return `$${vol.toFixed(0)}`;
  return '-';
}

function addressToColor(address: string): [string, string] {
  const hash = address.toLowerCase().replace('0x', '');
  const hue1 = parseInt(hash.slice(0, 6), 16) % 360;
  const hue2 = (hue1 + 40 + (parseInt(hash.slice(6, 12), 16) % 80)) % 360;
  return [`hsl(${hue1}, 65%, 55%)`, `hsl(${hue2}, 65%, 45%)`];
}

function CreatorAvatar({ address, size = 18 }: { address: string; size?: number }) {
  const [c1, c2] = addressToColor(address);
  return (
    <div
      className="rounded-full shrink-0"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${c1}, ${c2})` }}
    />
  );
}

// ── Sparkline ──

function Sparkline({ data, color = '#E84142', width = 60, height = 24 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (data.length < 2) {
    return <div style={{ width, height }} className="opacity-20 flex items-center justify-center"><span className="text-dim text-[9px]">-</span></div>;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  const isUp = data[data.length - 1] >= data[0];
  const lineColor = isUp ? '#22c55e' : color;

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline points={points} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Range Slider ──

function RangeSlider({
  label, min, max, value, onChange, formatLabel,
}: {
  label: string; min: number; max: number; value: RangeFilter;
  onChange: (v: RangeFilter) => void; formatLabel: (n: number) => string;
}) {
  const minPercent = ((value.min - min) / (max - min)) * 100;
  const maxPercent = ((value.max - min) / (max - min)) * 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-white">{label}</span>
        <span className="text-xs text-dim font-mono tabular-nums">
          {formatLabel(value.min)} - {formatLabel(value.max)}{value.max >= max ? '+' : ''}
        </span>
      </div>
      <div className="relative h-5 flex items-center">
        <div className="absolute inset-x-0 h-1.5 bg-white/[0.06] rounded-full" />
        <div className="absolute h-1.5 bg-cre8-red/60 rounded-full" style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }} />
        <input type="range" min={min} max={max} value={value.min}
          onChange={(e) => { const v = Number(e.target.value); if (v <= value.max) onChange({ ...value, min: v }); }}
          className="absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cre8-red [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-cre8-base [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10"
        />
        <input type="range" min={min} max={max} value={value.max}
          onChange={(e) => { const v = Number(e.target.value); if (v >= value.min) onChange({ ...value, max: v }); }}
          className="absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cre8-red [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-cre8-base [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10"
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-dim/50 font-mono">{formatLabel(min)}</span>
        <span className="text-[10px] text-dim/50 font-mono">{formatLabel(max)}+</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div>
          <label className="text-[10px] text-dim mb-1 block">Minimum</label>
          <input type="text" placeholder="e.g., 10k, 1m"
            className="w-full bg-cre8-base border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-dim/30 focus:outline-none focus:border-white/[0.12]"
            onBlur={(e) => { const p = parseShorthand(e.target.value); if (p !== null && p <= value.max) onChange({ ...value, min: p }); }}
          />
        </div>
        <div>
          <label className="text-[10px] text-dim mb-1 block">Maximum</label>
          <input type="text" placeholder="e.g., 10k, 1m"
            className="w-full bg-cre8-base border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-dim/30 focus:outline-none focus:border-white/[0.12]"
            onBlur={(e) => { const p = parseShorthand(e.target.value); if (p !== null && p >= value.min) onChange({ ...value, max: Math.min(p, max) }); }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Compute per-token stats from global trades ──

interface TokenStats {
  txns: number;
  vol24h: number;
  traders: number;
  sparkline: number[];
  lastTradeTs: number;
}

function useTokenStats(tokens: OnChainToken[], trades: TradeActivity[]): Record<string, TokenStats> {
  return useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const cutoff24h = now - 86400;
    const stats: Record<string, TokenStats> = {};

    for (const t of tokens) {
      stats[t.address] = { txns: 0, vol24h: 0, traders: 0, sparkline: [], lastTradeTs: 0 };
    }

    const traderSets: Record<string, Set<string>> = {};
    const priceBuckets: Record<string, number[]> = {};

    for (const trade of trades) {
      const addr = (trade as any).tokenAddress;
      if (!addr || !stats[addr]) continue;
      const s = stats[addr];
      s.txns++;
      if (trade.timestamp >= cutoff24h) {
        s.vol24h += trade.avaxAmount * 1000;
      }
      if (trade.timestamp > s.lastTradeTs) s.lastTradeTs = trade.timestamp;
      if (!traderSets[addr]) traderSets[addr] = new Set();
      traderSets[addr].add(trade.trader);
      if (!priceBuckets[addr]) priceBuckets[addr] = [];
      priceBuckets[addr].push(trade.newPrice);
    }

    for (const addr of Object.keys(stats)) {
      stats[addr].traders = traderSets[addr]?.size || 0;
      stats[addr].sparkline = priceBuckets[addr] || [];
    }

    return stats;
  }, [tokens, trades]);
}

// ── Main ──

export function HomePage() {
  const { tokens, isLoading } = useOnChainTokens();
  const { trades: globalTrades } = useGlobalTradeActivity(tokens);
  const [filterTab, setFilterTab] = useState<FilterTab>('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterOpen, setFilterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mcapFilter, setMcapFilter] = useState<RangeFilter>({ min: 0, max: MCAP_MAX });
  const [reserveFilter, setReserveFilter] = useState<RangeFilter>({ min: 0, max: RESERVE_MAX });
  const [appliedMcap, setAppliedMcap] = useState<RangeFilter>({ min: 0, max: MCAP_MAX });
  const [appliedReserve, setAppliedReserve] = useState<RangeFilter>({ min: 0, max: RESERVE_MAX });

  const tokenStats = useTokenStats(tokens, globalTrades);
  const hasActiveFilters = appliedMcap.min > 0 || appliedMcap.max < MCAP_MAX || appliedReserve.min > 0 || appliedReserve.max < RESERVE_MAX;

  const handleApplyFilters = useCallback(() => {
    setAppliedMcap({ ...mcapFilter });
    setAppliedReserve({ ...reserveFilter });
    setFilterOpen(false);
  }, [mcapFilter, reserveFilter]);

  const handleClearFilters = useCallback(() => {
    setMcapFilter({ min: 0, max: MCAP_MAX });
    setReserveFilter({ min: 0, max: RESERVE_MAX });
    setAppliedMcap({ min: 0, max: MCAP_MAX });
    setAppliedReserve({ min: 0, max: RESERVE_MAX });
  }, []);

  const filteredTokens = tokens.filter((token) => {
    const q = searchQuery.toLowerCase();
    if (searchQuery && !(
      token.name.toLowerCase().includes(q) ||
      token.symbol.toLowerCase().includes(q) ||
      token.address.toLowerCase().includes(q)
    )) return false;
    const mcap = token.reserveBalance * 1000;
    if (mcap < appliedMcap.min || (appliedMcap.max < MCAP_MAX && mcap > appliedMcap.max)) return false;
    if (token.reserveBalance < appliedReserve.min || (appliedReserve.max < RESERVE_MAX && token.reserveBalance > appliedReserve.max)) return false;
    return true;
  });

  const sortedTokens = [...filteredTokens].sort((a, b) => {
    if (filterTab === 'top') return b.reserveBalance - a.reserveBalance;
    if (filterTab === 'graduating') return b.graduationProgress - a.graduationProgress;
    if (filterTab === 'new') return b.createdAt - a.createdAt;
    if (filterTab === 'oldest') return a.createdAt - b.createdAt;
    if (filterTab === 'last_trade') {
      const aTs = tokenStats[a.address]?.lastTradeTs || 0;
      const bTs = tokenStats[b.address]?.lastTradeTs || 0;
      return bTs - aTs;
    }
    return b.reserveBalance - a.reserveBalance;
  });

  const kingToken = [...tokens].sort((a, b) => b.reserveBalance - a.reserveBalance)[0];

  const tokenSymbols = tokens.reduce<Record<string, string>>((acc, t) => {
    acc[t.address] = t.symbol;
    return acc;
  }, {});

  const filterTabs: { key: FilterTab; label: string; icon: typeof IconFlame }[] = [
    { key: 'trending', label: 'Trending', icon: IconFlame },
    { key: 'new', label: 'New', icon: IconClock },
    { key: 'top', label: 'Market cap', icon: IconTrophy },
    { key: 'graduating', label: 'Graduating', icon: IconSchool },
    { key: 'oldest', label: 'Oldest', icon: IconSortDescending },
    { key: 'last_trade', label: 'Last trade', icon: IconArrowsSort },
  ];

  return (
    <div className="min-h-screen">
      {/* Trade Ticker */}
      <TradeTicker trades={globalTrades} tokenSymbols={tokenSymbols} />

      <div className="p-4 md:p-6 lg:p-8 pb-24">
        <div className="max-w-[1400px] mx-auto space-y-5">

          {/* King of the Hill */}
          {kingToken && !isLoading && (
            <Link
              to={`/token/${kingToken.address}`}
              className="block surface overflow-hidden group hover:border-white/[0.12] transition-all"
            >
              <div className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-white/[0.04]">
                <IconCrown size={14} className="text-amber-400" />
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">King of the Hill</span>
              </div>
              <div className="flex items-center gap-4 p-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-500/20 to-cre8-red/20 flex items-center justify-center overflow-hidden border border-white/[0.08] shrink-0">
                  <TokenImage tokenAddress={kingToken.address} symbol={kingToken.symbol} onChainImageURI={kingToken.imageURI}
                    className="w-full h-full flex items-center justify-center" imgClassName="w-full h-full object-cover" fallbackClassName="text-2xl font-bold text-white/20" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-white">${kingToken.symbol}</h2>
                    <span className="text-sm text-dim">{kingToken.name}</span>
                    {kingToken.isGraduated && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 rounded font-medium">Graduated</span>}
                  </div>
                  {kingToken.description && <p className="text-xs text-dim/70 line-clamp-1 mb-1.5">{kingToken.description}</p>}
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-dim">MCap: <span className="text-white font-mono font-semibold">{formatMcap(kingToken.reserveBalance)}</span></span>
                    <span className="text-dim">Price: <span className="text-white font-mono">{formatPrice(kingToken.currentPrice)}</span></span>
                    <span className="text-dim">Reserve: <span className="text-white font-mono">{kingToken.reserveBalance.toFixed(2)} AVAX</span></span>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  <span className="text-xs text-dim">Trade now</span>
                  <IconArrowUpRight size={16} className="text-amber-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>
            </Link>
          )}

          {/* Search + Filter Tabs */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
                <input type="text" placeholder="Search by name, symbol, or address..."
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-cre8-surface border border-white/[0.06] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-dim/40 focus:outline-none focus:border-white/[0.12] transition-colors"
                />
              </div>
              <Link to="/create"
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-cre8-red hover:bg-cre8-red/90 text-white text-sm font-semibold rounded-xl transition-colors shrink-0">
                <IconPlus size={16} stroke={2} /><span>Launch</span>
              </Link>
            </div>

            {/* Filter Tabs — scrollable row like Pump.fun */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {filterTabs.map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setFilterTab(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap border ${
                    filterTab === key
                      ? 'bg-white/[0.08] text-white border-white/[0.12]'
                      : 'text-dim hover:text-white border-white/[0.04] hover:border-white/[0.08]'
                  }`}>
                  <Icon size={14} />{label}
                </button>
              ))}
            </div>
          </div>

          {/* Token Grid / List */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {isLoading ? Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="surface overflow-hidden">
                  <div className="aspect-[4/3] skeleton rounded-none" />
                  <div className="p-3 space-y-2"><div className="skeleton h-4 w-20" /><div className="skeleton h-3 w-full" /><div className="flex gap-3"><div className="skeleton h-3 w-16" /><div className="skeleton h-3 w-12" /></div></div>
                </div>
              )) : sortedTokens.length === 0 ? (
                <div className="col-span-full py-20 text-center">
                  <IconRocket size={40} className="text-dim/20 mx-auto mb-4" />
                  <p className="text-dim text-base mb-1.5">{tokens.length === 0 ? 'No tokens launched yet' : 'No tokens match your filters'}</p>
                  {tokens.length === 0 ? (
                    <Link to="/create" className="text-cre8-red text-sm font-semibold hover:underline">Be the first to launch</Link>
                  ) : hasActiveFilters && (
                    <button onClick={handleClearFilters} className="text-cre8-red text-sm font-semibold hover:underline">Clear filters</button>
                  )}
                </div>
              ) : sortedTokens.map((token) => {
                const stats = tokenStats[token.address];
                return (
                  <Link key={token.address} to={`/token/${token.address}`}
                    className="surface overflow-hidden group hover:border-white/[0.12] transition-all">
                    <div className="aspect-[4/3] bg-gradient-to-br from-white/[0.02] to-transparent relative overflow-hidden">
                      <TokenImage tokenAddress={token.address} symbol={token.symbol} onChainImageURI={token.imageURI}
                        className="absolute inset-0 w-full h-full flex items-center justify-center" imgClassName="w-full h-full object-cover" fallbackClassName="text-4xl font-bold text-white/[0.04]" />
                      {token.isGraduated && (
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-emerald-500/20 backdrop-blur-sm rounded text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">Graduated</div>
                      )}
                      {!token.isGraduated && token.graduationProgress > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40"><div className="h-full bg-cre8-red" style={{ width: `${Math.min(token.graduationProgress, 100)}%` }} /></div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <CreatorAvatar address={token.creator} />
                        <span className="text-[11px] text-dim font-mono truncate">{token.creator.slice(0, 6)}...{token.creator.slice(-4)}</span>
                        <span className="text-dim/30 text-[10px] ml-auto">{timeAgo(token.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-white text-sm truncate">{token.name}</h3>
                        <span className="text-xs text-cre8-red font-semibold shrink-0">${token.symbol}</span>
                      </div>
                      {token.description ? (
                        <p className="text-xs text-dim/60 line-clamp-2 mb-2 leading-relaxed">{token.description}</p>
                      ) : <div className="mb-2" />}
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-dim">mcap: <span className="text-white font-mono font-semibold">{formatMcap(token.reserveBalance)}</span></span>
                        <span className="text-dim font-mono tabular-nums">{stats?.txns || 0} txns</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            /* ── List View (Pump.fun style) ── */
            <div className="surface overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="text-[11px] text-dim font-medium uppercase tracking-wider border-b border-white/[0.04]">
                    <th className="text-left px-3 py-2.5 w-8">#</th>
                    <th className="text-left px-3 py-2.5">Coin</th>
                    <th className="text-center px-2 py-2.5 w-[70px]">Graph</th>
                    <th className="text-right px-3 py-2.5">MCap</th>
                    <th className="text-right px-3 py-2.5 w-[60px]">Age</th>
                    <th className="text-right px-3 py-2.5">Txns</th>
                    <th className="text-right px-3 py-2.5">24h Vol</th>
                    <th className="text-right px-3 py-2.5">Traders</th>
                    <th className="text-right px-3 py-2.5">Reserve</th>
                    <th className="text-right px-3 py-2.5 w-[70px]">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {isLoading ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-3 py-3"><div className="skeleton h-4 w-4" /></td>
                      <td className="px-3 py-3"><div className="flex items-center gap-3"><div className="skeleton w-8 h-8 rounded-lg" /><div className="space-y-1"><div className="skeleton h-3.5 w-28" /><div className="skeleton h-3 w-16" /></div></div></td>
                      <td className="px-2 py-3"><div className="skeleton h-5 w-14" /></td>
                      <td className="px-3 py-3"><div className="skeleton h-3.5 w-14 ml-auto" /></td>
                      <td className="px-3 py-3"><div className="skeleton h-3.5 w-8 ml-auto" /></td>
                      <td className="px-3 py-3"><div className="skeleton h-3.5 w-10 ml-auto" /></td>
                      <td className="px-3 py-3"><div className="skeleton h-3.5 w-12 ml-auto" /></td>
                      <td className="px-3 py-3"><div className="skeleton h-3.5 w-8 ml-auto" /></td>
                      <td className="px-3 py-3"><div className="skeleton h-3.5 w-12 ml-auto" /></td>
                      <td className="px-3 py-3"><div className="skeleton h-2 w-12 ml-auto" /></td>
                    </tr>
                  )) : sortedTokens.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center">
                        <IconRocket size={32} className="text-dim/30 mx-auto mb-3" />
                        <p className="text-dim text-sm">{tokens.length === 0 ? 'No tokens launched yet' : 'No tokens match your filters'}</p>
                      </td>
                    </tr>
                  ) : sortedTokens.map((token, idx) => {
                    const stats = tokenStats[token.address];
                    return (
                      <tr key={token.address} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-3 py-2.5">
                          <span className="text-dim text-xs font-mono">#{idx + 1}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Link to={`/token/${token.address}`} className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cre8-red/15 to-violet-500/15 flex items-center justify-center shrink-0 overflow-hidden">
                              <TokenImage tokenAddress={token.address} symbol={token.symbol} onChainImageURI={token.imageURI}
                                className="w-full h-full flex items-center justify-center" imgClassName="w-full h-full object-cover" fallbackClassName="text-xs font-bold text-white" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-white text-sm truncate group-hover:text-cre8-red transition-colors">{token.name}</span>
                                {token.isGraduated && <span className="text-[9px] px-1 py-0.5 bg-emerald-500/15 text-emerald-400 rounded font-medium">G</span>}
                              </div>
                              <span className="text-[11px] text-dim font-mono">{token.symbol}</span>
                            </div>
                          </Link>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <Link to={`/token/${token.address}`}>
                            <Sparkline data={stats?.sparkline || []} />
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="font-mono text-[13px] text-white tabular-nums">{formatMcap(token.reserveBalance)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="text-[13px] text-dim tabular-nums">{ageLabel(token.createdAt)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="font-mono text-[13px] text-white tabular-nums">{stats?.txns ? stats.txns.toLocaleString() : '-'}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="font-mono text-[13px] text-white tabular-nums">{formatVol(stats?.vol24h || 0)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="font-mono text-[13px] text-white tabular-nums">{stats?.traders || '-'}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="font-mono text-[13px] text-white tabular-nums">{token.reserveBalance.toFixed(2)}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5 justify-end">
                            <div className="w-10 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${token.graduationProgress >= 100 ? 'bg-emerald-400' : 'bg-cre8-red'}`}
                                style={{ width: `${Math.min(token.graduationProgress, 100)}%` }} />
                            </div>
                            <span className="text-[10px] text-dim font-mono tabular-nums w-6 text-right">{token.graduationProgress.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Load more hint */}
          {!isLoading && sortedTokens.length > 0 && (
            <div className="text-center py-4">
              <p className="text-dim/40 text-xs">Showing {sortedTokens.length} token{sortedTokens.length !== 1 ? 's' : ''}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Toolbar (fixed) ── */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 md:left-[calc(50%+34px)] z-40 flex items-center gap-1 bg-cre8-surface/95 backdrop-blur-md border border-white/[0.08] rounded-2xl p-1.5 shadow-2xl">
        {/* Filter toggle */}
        <div className="relative">
          <button onClick={() => { setFilterOpen(!filterOpen); setSettingsOpen(false); }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
              filterOpen || hasActiveFilters ? 'bg-cre8-red/15 text-cre8-red' : 'text-dim hover:text-white hover:bg-white/[0.06]'
            }`}>
            <IconFilter size={16} /><span>Filter</span>
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-cre8-red" />}
          </button>

          {filterOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setFilterOpen(false)} />
              <div className="absolute bottom-full mb-2 left-0 w-72 bg-cre8-surface border border-white/[0.08] rounded-2xl shadow-2xl z-40 overflow-hidden animate-slide-up">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                  <span className="text-sm font-semibold text-white">Advanced Filters</span>
                  <button onClick={() => setFilterOpen(false)} className="p-1 rounded-lg hover:bg-white/[0.06] text-dim hover:text-white transition-colors"><IconX size={14} /></button>
                </div>
                <div className="p-4 space-y-5">
                  <RangeSlider label="Mcap" min={0} max={MCAP_MAX} value={mcapFilter} onChange={setMcapFilter} formatLabel={formatShort} />
                  <RangeSlider label="Reserve (AVAX)" min={0} max={RESERVE_MAX} value={reserveFilter} onChange={setReserveFilter} formatLabel={formatReserveShort} />
                </div>
                <div className="px-4 pb-4 flex gap-2">
                  <button onClick={handleClearFilters} className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] text-dim hover:bg-white/[0.08] hover:text-white text-sm font-medium transition-colors">Clear</button>
                  <button onClick={handleApplyFilters} className="flex-1 px-4 py-2.5 rounded-xl bg-cre8-red hover:bg-cre8-red/90 text-white text-sm font-semibold transition-colors">Apply</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* View Mode */}
        <button onClick={() => setViewMode('grid')}
          className={`p-2 rounded-xl transition-colors ${viewMode === 'grid' ? 'bg-white/[0.08] text-white' : 'text-dim hover:text-white hover:bg-white/[0.04]'}`} title="Grid view">
          <IconLayoutGrid size={18} />
        </button>
        <button onClick={() => setViewMode('list')}
          className={`p-2 rounded-xl transition-colors ${viewMode === 'list' ? 'bg-white/[0.08] text-white' : 'text-dim hover:text-white hover:bg-white/[0.04]'}`} title="List view">
          <IconLayoutList size={18} />
        </button>

        {/* Settings */}
        <div className="relative">
          <button onClick={() => { setSettingsOpen(!settingsOpen); setFilterOpen(false); }}
            className={`p-2 rounded-xl transition-colors ${settingsOpen ? 'bg-white/[0.08] text-white' : 'text-dim hover:text-white hover:bg-white/[0.04]'}`} title="Settings">
            <IconSettings size={18} />
          </button>
          {settingsOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setSettingsOpen(false)} />
              <div className="absolute bottom-full mb-2 right-0 w-56 bg-cre8-surface border border-white/[0.08] rounded-2xl shadow-2xl z-40 overflow-hidden animate-slide-up">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <span className="text-sm font-semibold text-white">Display Settings</span>
                </div>
                <div className="p-3 space-y-1">
                  <div className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                    <span className="text-sm text-dim">Show descriptions</span>
                    <div className="w-8 h-4.5 bg-cre8-red/60 rounded-full relative cursor-pointer">
                      <div className="absolute right-0.5 top-0.5 w-3.5 h-3.5 bg-white rounded-full" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                    <span className="text-sm text-dim">Animate ticker</span>
                    <div className="w-8 h-4.5 bg-cre8-red/60 rounded-full relative cursor-pointer">
                      <div className="absolute right-0.5 top-0.5 w-3.5 h-3.5 bg-white rounded-full" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                    <span className="text-sm text-dim">Compact mode</span>
                    <div className="w-8 h-4.5 bg-white/[0.1] rounded-full relative cursor-pointer">
                      <div className="absolute left-0.5 top-0.5 w-3.5 h-3.5 bg-white/50 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
