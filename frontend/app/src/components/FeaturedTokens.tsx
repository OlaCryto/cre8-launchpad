import { Link } from 'react-router-dom';
import { TrendingUp, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnChainTokens, type OnChainToken } from '@/hooks/useContracts';
import { formatPrice } from '@/utils/format';

function TokenCard({ token }: { token: OnChainToken }) {
  return (
    <Link
      to={`/token/${token.address}`}
      className="bg-[#0D0D12] border border-white/[0.06] rounded-2xl p-5 hover:-translate-y-0.5 hover:border-[#E84142]/30 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#E84142]/20 to-violet-500/20 flex items-center justify-center">
            <span className="text-xl font-bold text-white">{token.symbol.charAt(0)}</span>
          </div>
          <div>
            <h3 className="font-bold text-white">{token.name}</h3>
            <p className="font-mono text-sm text-[#8B8B9E]">${token.symbol}</p>
          </div>
        </div>
        {token.isGraduated && (
          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
            Graduated
          </span>
        )}
      </div>

      {/* Graduation bar */}
      <div className="mb-4">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#E84142] to-[#FF6B6B] rounded-full"
            style={{ width: `${Math.min(token.graduationProgress, 100)}%` }}
          />
        </div>
        <p className="text-xs text-[#8B8B9E] mt-1">{token.graduationProgress.toFixed(1)}% to graduation</p>
      </div>

      {/* Stats */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-[#8B8B9E] mb-1">Price</p>
          <p className="font-mono font-bold text-white">
            {formatPrice(token.currentPrice)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#8B8B9E] mb-1">Reserve</p>
          <p className="font-mono font-bold text-white">{token.reserveBalance.toFixed(2)} AVAX</p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.06]">
        <span className="text-xs text-[#8B8B9E]">
          {token.creator.slice(0, 6)}...{token.creator.slice(-4)}
        </span>
        <Button size="sm" className="bg-[#E84142]/10 hover:bg-[#E84142]/20 text-[#E84142] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
          <TrendingUp className="w-4 h-4 mr-1" />
          Trade
        </Button>
      </div>
    </Link>
  );
}

export function FeaturedTokens() {
  const { tokens, isLoading } = useOnChainTokens();

  if (isLoading || tokens.length === 0) return null;

  // Show up to 6 tokens
  const displayTokens = tokens.slice(0, 6);

  return (
    <section className="relative py-20 bg-[#0D0D12]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Launched Tokens</h2>
          <p className="text-[#8B8B9E]">Explore tokens trading on bonding curves</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayTokens.map((token) => (
            <TokenCard key={token.address} token={token} />
          ))}
        </div>

        {tokens.length > 6 && (
          <div className="text-center mt-8">
            <Link to="/explore">
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 rounded-full">
                View All {tokens.length} Tokens
                <Zap className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
