import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TokenImage } from '@/components/TokenImage';
import {
  IconWallet,
  IconActivity,
  IconFlame,
  IconPlus,
  IconClock,
  IconTrophy,
  IconSchool,
  IconSearch,
  IconRocket,
  IconChevronRight,
} from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOnChainTokens, useTokenCount, useAvaxBalance, useGlobalTradeActivity } from '@/hooks/useContracts';
import { formatPrice } from '@/utils/format';

// ---- Trade feed helpers ----

function addressToColor(address: string): [string, string] {
  const hash = address.toLowerCase().replace('0x', '');
  const hue1 = parseInt(hash.slice(0, 6), 16) % 360;
  const hue2 = (hue1 + 40 + (parseInt(hash.slice(6, 12), 16) % 80)) % 360;
  return [`hsl(${hue1}, 65%, 55%)`, `hsl(${hue2}, 65%, 45%)`];
}

function FeedAvatar({ address }: { address: string }) {
  const [c1, c2] = addressToColor(address);
  return (
    <div
      className="w-7 h-7 rounded-full shrink-0"
      style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
    />
  );
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

type TableTab = 'recent' | 'graduating' | 'mcap';

export function HomePage() {
  const { user, isAuthenticated, signInWithX, isLoading: authLoading } = useAuth();
  const { tokens, isLoading } = useOnChainTokens();
  const tokenCount = useTokenCount();
  const avaxBalance = useAvaxBalance(user?.wallet.address);

  const { trades: globalTrades, isLoading: tradesLoading } = useGlobalTradeActivity(tokens);
  const [tableTab, setTableTab] = useState<TableTab>('recent');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter + sort for the main table
  const filteredTokens = tokens.filter((token) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      token.name.toLowerCase().includes(q) ||
      token.symbol.toLowerCase().includes(q) ||
      token.address.toLowerCase().includes(q)
    );
  });

  const sortedTokens = [...filteredTokens].sort((a, b) => {
    if (tableTab === 'mcap') return b.reserveBalance - a.reserveBalance;
    if (tableTab === 'graduating') return b.graduationProgress - a.graduationProgress;
    return b.createdAt - a.createdAt;
  });

  const trendingTokens = [...tokens]
    .sort((a, b) => b.reserveBalance - a.reserveBalance)
    .slice(0, 6);

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto space-y-5">

        {/* Header Row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-dim text-sm mt-0.5">Cre8 Launchpad</p>
          </div>
          <Link
            to="/create"
            className="flex items-center gap-2 px-4 py-2.5 bg-cre8-red hover:bg-cre8-red/90 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <IconPlus size={16} stroke={2} />
            <span className="hidden sm:inline">Launch Token</span>
          </Link>
        </div>

        {/* Top Cards — Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Wallet Balance Card */}
          <div className="surface p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <IconWallet size={18} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-dim">Wallet Balance</p>
                <p className="text-sm text-white font-medium">
                  {isAuthenticated ? 'Connected' : 'Not Connected'}
                </p>
              </div>
            </div>

            {isAuthenticated && user ? (
              <div>
                <p className="font-mono text-2xl font-bold text-white tabular-nums">
                  {avaxBalance.toFixed(4)}
                  <span className="text-sm font-normal text-dim ml-1.5">AVAX</span>
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="font-mono text-dim">{user.wallet.address.slice(0, 6)}...{user.wallet.address.slice(-4)}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-emerald-400">Fuji</span>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-dim text-sm mb-3">Connect to view your balance and trade tokens.</p>
                <button
                  onClick={() => signInWithX()}
                  disabled={authLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-white text-sm font-medium rounded-xl border border-white/[0.08] transition-colors"
                >
                  {authLoading ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                      Sign in with X
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Trading Activity Card */}
          <div className="surface p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <IconActivity size={18} className="text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-dim">Activity</p>
                <p className="text-sm text-white font-medium">Live Feed</p>
              </div>
            </div>

            <div className="space-y-1 max-h-[220px] overflow-y-auto custom-scrollbar">
              {globalTrades.slice(0, 8).map((trade) => (
                <Link
                  key={trade.txHash}
                  to={`/token/${trade.tokenAddress}`}
                  className={`flex items-center gap-2.5 py-1.5 px-1.5 -mx-1.5 rounded-lg hover:bg-white/[0.03] transition-colors ${trade.isNew ? 'animate-trade-flash' : ''}`}
                >
                  {trade.traderAvatar ? (
                    <img src={trade.traderAvatar} alt="" className="w-7 h-7 rounded-full shrink-0 object-cover" />
                  ) : (
                    <FeedAvatar address={trade.trader} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-white truncate">
                      {trade.traderName ? (
                        <span className="font-medium text-white">{trade.traderName}</span>
                      ) : (
                        <span className="font-mono text-dim">{trade.trader.slice(0, 6)}...</span>
                      )}
                      {' '}
                      <span className={trade.type === 'buy' ? 'text-green-400 font-medium' : 'text-cre8-red font-medium'}>
                        {trade.type === 'buy' ? 'bought' : 'sold'}
                      </span>
                      {' '}
                      <span className="font-mono text-white">{trade.avaxAmount.toFixed(trade.avaxAmount < 1 ? 4 : 2)}</span>
                      {' '}
                      <span className="text-dim font-medium">${trade.tokenSymbol}</span>
                    </p>
                    {trade.traderName && (
                      <p className="text-[10px] font-mono text-dim/50 -mt-0.5">{trade.trader.slice(0, 6)}...{trade.trader.slice(-4)}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-dim shrink-0 tabular-nums">{timeAgo(trade.timestamp)}</span>
                </Link>
              ))}
              {globalTrades.length === 0 && !tradesLoading && (
                <p className="text-dim text-sm text-center py-6">No trades yet</p>
              )}
              {tradesLoading && (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2.5 py-1.5">
                      <div className="skeleton w-7 h-7 rounded-full" />
                      <div className="flex-1"><div className="skeleton h-3.5 w-40" /></div>
                      <div className="skeleton h-3 w-10" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Platform Stats Card */}
          <div className="surface p-5 md:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-cre8-red/10 flex items-center justify-center">
                <IconRocket size={18} className="text-cre8-red" />
              </div>
              <div>
                <p className="text-xs text-dim">Platform Stats</p>
                <p className="text-sm text-white font-medium">Cre8 on Fuji</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/[0.03] rounded-xl p-3">
                <p className="font-mono text-lg font-bold text-white tabular-nums">{tokenCount || tokens.length}</p>
                <p className="text-[11px] text-dim">Tokens Launched</p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-3">
                <p className="font-mono text-lg font-bold text-white">$0.02</p>
                <p className="text-[11px] text-dim">Launch Cost</p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-3">
                <p className="font-mono text-lg font-bold text-emerald-400 tabular-nums">
                  {tokens.filter(t => t.isGraduated).length}
                </p>
                <p className="text-[11px] text-dim">Graduated</p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-3">
                <p className="font-mono text-lg font-bold text-white">69K</p>
                <p className="text-[11px] text-dim">Grad. Threshold</p>
              </div>
            </div>
          </div>
        </div>

        {/* Trending Tokens */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <IconFlame size={18} className="text-cre8-red" />
              <h2 className="text-base font-semibold text-white">Trending</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="surface overflow-hidden">
                    <div className="aspect-[5/3] skeleton rounded-none" />
                    <div className="p-3 space-y-2">
                      <div className="skeleton h-4 w-16" />
                      <div className="skeleton h-3 w-20" />
                    </div>
                  </div>
                ))
              : trendingTokens.map((token) => (
                  <Link
                    key={token.address}
                    to={`/token/${token.address}`}
                    className="surface overflow-hidden group hover:border-white/[0.12] transition-colors"
                  >
                    <div className="aspect-[5/3] bg-gradient-to-br from-white/[0.03] to-transparent flex items-center justify-center relative overflow-hidden">
                      <TokenImage
                        tokenAddress={token.address}
                        symbol={token.symbol}
                        onChainImageURI={token.imageURI}
                        className="absolute inset-0 w-full h-full flex items-center justify-center"
                        imgClassName="w-full h-full object-cover"
                        fallbackClassName="text-3xl font-bold text-white/[0.06]"
                      />
                      <div className="absolute top-2 right-2">
                        <IconChevronRight size={14} className="text-dim opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <div className="p-2.5">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-white text-sm truncate">${token.symbol}</h3>
                        {token.isGraduated && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-dim text-xs truncate">{token.name}</span>
                        <span className="font-mono text-xs text-white tabular-nums">{token.reserveBalance.toFixed(1)}</span>
                      </div>
                    </div>
                  </Link>
                ))
            }
            {!isLoading && Array.from({ length: Math.max(0, 6 - trendingTokens.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="surface overflow-hidden opacity-40">
                <div className="aspect-[5/3] bg-white/[0.02]" />
                <div className="p-2.5">
                  <div className="h-4 w-12 bg-white/[0.04] rounded" />
                  <div className="h-3 w-16 bg-white/[0.03] rounded mt-1.5" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Token Dashboard Table */}
        <div className="surface overflow-hidden">
          {/* Table Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTableTab('recent')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tableTab === 'recent' ? 'bg-white/[0.08] text-white' : 'text-dim hover:text-white'
                }`}
              >
                <IconClock size={14} />
                Recent
              </button>
              <button
                onClick={() => setTableTab('graduating')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tableTab === 'graduating' ? 'bg-white/[0.08] text-white' : 'text-dim hover:text-white'
                }`}
              >
                <IconSchool size={14} />
                Graduating
              </button>
              <button
                onClick={() => setTableTab('mcap')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tableTab === 'mcap' ? 'bg-white/[0.08] text-white' : 'text-dim hover:text-white'
                }`}
              >
                <IconTrophy size={14} />
                Top
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
              <input
                type="text"
                placeholder="Search tokens..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder:text-dim/50 focus:outline-none focus:border-white/[0.12] transition-colors"
              />
            </div>
          </div>

          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_100px] gap-4 px-4 py-2.5 text-[11px] text-dim font-medium uppercase tracking-wider border-b border-white/[0.04]">
            <span>Token</span>
            <span>Price</span>
            <span>Reserve</span>
            <span>Creator</span>
            <span className="text-right">Progress</span>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-white/[0.03]">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_100px] gap-4 px-4 py-3.5 items-center">
                  <div className="flex items-center gap-3">
                    <div className="skeleton w-9 h-9 rounded-lg" />
                    <div className="space-y-1.5">
                      <div className="skeleton h-3.5 w-16" />
                      <div className="skeleton h-3 w-12" />
                    </div>
                  </div>
                  <div className="skeleton h-3.5 w-16" />
                  <div className="skeleton h-3.5 w-14" />
                  <div className="skeleton h-3.5 w-20" />
                  <div className="skeleton h-2 w-full" />
                </div>
              ))
            ) : sortedTokens.length === 0 ? (
              <div className="py-16 text-center">
                <IconRocket size={32} className="text-dim/30 mx-auto mb-3" />
                <p className="text-dim text-sm mb-1">
                  {tokens.length === 0 ? 'No tokens launched yet' : 'No tokens match your search'}
                </p>
                {tokens.length === 0 && (
                  <Link to="/create" className="text-cre8-red text-sm font-medium hover:underline">
                    Be the first to launch
                  </Link>
                )}
              </div>
            ) : (
              sortedTokens.slice(0, 15).map((token) => (
                <Link
                  key={token.address}
                  to={`/token/${token.address}`}
                  className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr_100px] gap-2 sm:gap-4 px-4 py-3 items-center hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  {/* Token */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cre8-red/15 to-violet-500/15 flex items-center justify-center shrink-0 overflow-hidden">
                      <TokenImage
                        tokenAddress={token.address}
                        symbol={token.symbol}
                        onChainImageURI={token.imageURI}
                        className="w-full h-full flex items-center justify-center"
                        imgClassName="w-full h-full object-cover"
                        fallbackClassName="text-sm font-bold text-white"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-white text-sm truncate">${token.symbol}</p>
                        {token.isGraduated && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 rounded font-medium">Grad</span>
                        )}
                      </div>
                      <p className="text-xs text-dim truncate">{token.name}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="hidden sm:block">
                    <span className="font-mono text-sm text-white tabular-nums">
                      {formatPrice(token.currentPrice)}
                    </span>
                    <span className="text-[11px] text-dim ml-1">AVAX</span>
                  </div>

                  {/* Reserve */}
                  <span className="hidden sm:block font-mono text-sm text-white tabular-nums">
                    {token.reserveBalance.toFixed(2)}
                  </span>

                  {/* Creator */}
                  <span className="hidden sm:block font-mono text-xs text-dim truncate">
                    {token.creator.slice(0, 6)}...{token.creator.slice(-4)}
                  </span>

                  {/* Progress Bar */}
                  <div className="hidden sm:flex items-center gap-2 justify-end">
                    <div className="w-full max-w-[60px] h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          token.graduationProgress >= 100 ? 'bg-emerald-400' : 'bg-cre8-red'
                        }`}
                        style={{ width: `${Math.min(token.graduationProgress, 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-dim font-mono tabular-nums w-8 text-right">
                      {token.graduationProgress.toFixed(0)}%
                    </span>
                  </div>

                  {/* Mobile: extra info */}
                  <div className="flex sm:hidden items-center gap-3 text-xs text-dim">
                    <span className="font-mono">{formatPrice(token.currentPrice)} AVAX</span>
                    <span>·</span>
                    <span className="font-mono">{token.reserveBalance.toFixed(2)} reserve</span>
                    {token.isGraduated && (
                      <>
                        <span>·</span>
                        <span className="text-emerald-400">Graduated</span>
                      </>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
