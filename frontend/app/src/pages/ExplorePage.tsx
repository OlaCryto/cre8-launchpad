import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, TrendingUp, Rocket, Flame, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useOnChainTokens } from '@/hooks/useContracts';
import { formatPrice } from '@/utils/format';

const filters = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
];

const sortOptions = [
  { id: 'newest', label: 'Newest' },
  { id: 'reserve', label: 'Reserve' },
  { id: 'price', label: 'Price' },
];

export function ExplorePage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const { tokens, isLoading } = useOnChainTokens();

  const filteredTokens = tokens.filter((token) => {
    if (activeFilter === 'new') {
      const dayAgo = Date.now() / 1000 - 86400;
      if (token.createdAt < dayAgo) return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        token.name.toLowerCase().includes(query) ||
        token.symbol.toLowerCase().includes(query) ||
        token.address.toLowerCase().includes(query)
      );
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'reserve') return b.reserveBalance - a.reserveBalance;
    if (sortBy === 'price') return b.currentPrice - a.currentPrice;
    return b.createdAt - a.createdAt;
  });

  return (
    <div className="min-h-screen">
      {/* Header Stats */}
      <div className="border-b border-white/[0.06] bg-cre8-surface/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm">{tokens.length} tokens launched</span>
            </div>
            <div className="flex items-center gap-2 text-dim">
              <Rocket className="w-4 h-4" />
              <span className="text-sm">Avalanche Fuji</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dim" />
          <Input
            placeholder="Search by name, symbol, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 bg-cre8-surface border-white/[0.06] text-white placeholder:text-dim rounded-xl"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex gap-2">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeFilter === filter.id
                    ? 'bg-cre8-red text-white'
                    : 'bg-cre8-surface text-dim hover:text-white border border-white/[0.06]'
                }`}
              >
                {filter.id === 'new' && <Flame className="w-4 h-4 inline mr-1" />}
                {filter.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none px-4 py-2 pr-10 rounded-xl bg-cre8-surface text-white text-sm border border-white/[0.06] focus:outline-none focus:border-cre8-red/50"
            >
              {sortOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <TrendingUp className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim pointer-events-none" />
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-cre8-red/30 border-t-cre8-red rounded-full animate-spin mx-auto mb-4" />
            <p className="text-dim">Loading tokens from chain...</p>
          </div>
        )}

        {/* Token List */}
        {!isLoading && (
          <div className="space-y-2">
            {filteredTokens.map((token) => (
              <Link
                key={token.address}
                to={`/token/${token.address}`}
                className="flex items-center gap-4 p-4 surface-interactive cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cre8-red/15 to-violet-500/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-white">{token.symbol.charAt(0)}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{token.name}</h3>
                    {token.isGraduated && (
                      <span className="px-2 py-0.5 bg-green-500/15 text-green-400 text-xs rounded-full font-medium">
                        Graduated
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-dim">
                    <span className="font-mono">${token.symbol}</span>
                    <span className="text-white/20">|</span>
                    <span className="font-mono">{token.creator.slice(0, 6)}...{token.creator.slice(-4)}</span>
                    <span className="text-white/20">|</span>
                    <span className="text-green-400">
                      {new Date(token.createdAt * 1000).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex-shrink-0 text-right hidden sm:block">
                  <p className="text-xs text-dim mb-0.5">Price</p>
                  <p className="font-mono font-semibold text-white tabular-nums">
                    {formatPrice(token.currentPrice)}
                  </p>
                </div>

                <div className="flex-shrink-0 text-right">
                  <p className="text-xs text-dim mb-0.5">Reserve</p>
                  <p className="font-mono font-semibold text-white tabular-nums">{token.reserveBalance.toFixed(2)} AVAX</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredTokens.length === 0 && (
          <div className="text-center py-12">
            <Zap className="w-10 h-10 text-cre8-red/30 mx-auto mb-4" />
            <p className="text-dim mb-4">
              {tokens.length === 0
                ? 'No tokens launched yet. Be the first!'
                : 'No tokens match your search.'
              }
            </p>
            {tokens.length === 0 && (
              <Link to="/create" className="text-cre8-red hover:underline font-medium text-sm">
                Launch a token
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
