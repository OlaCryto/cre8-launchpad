import { TrendingUp } from 'lucide-react';
import { useOnChainTokens } from '@/hooks/useContracts';
import { formatPrice } from '@/utils/format';

export function TokenTicker() {
  const { tokens } = useOnChainTokens();

  if (tokens.length === 0) return null;

  const doubled = [...tokens, ...tokens];

  return (
    <div className="bg-[#0D0D12] border-y border-white/[0.06] py-3 overflow-hidden">
      <div className="flex animate-scroll gap-8 whitespace-nowrap">
        {doubled.map((token, i) => (
          <div key={`${token.address}-${i}`} className="flex items-center gap-3">
            <span className="font-mono font-bold text-white">${token.symbol}</span>
            <span className="font-mono text-[#8B8B9E]">
              {formatPrice(token.currentPrice)}
            </span>
            <span className="flex items-center gap-1 font-mono text-sm text-[#8B8B9E]">
              <TrendingUp className="w-3 h-3" />
              {token.reserveBalance.toFixed(2)} AVAX
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
