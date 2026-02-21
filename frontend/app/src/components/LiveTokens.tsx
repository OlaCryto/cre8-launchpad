import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link } from 'react-router-dom';
import { ChevronRight, TrendingUp, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnChainTokens } from '@/hooks/useContracts';

gsap.registerPlugin(ScrollTrigger);

export function LiveTokens() {
  const sectionRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { tokens, isLoading } = useOnChainTokens();

  useEffect(() => {
    if (tokens.length === 0) return;

    const ctx = gsap.context(() => {
      const items = listRef.current?.querySelectorAll('.token-row');
      if (items) {
        gsap.fromTo(items,
          { x: -30, opacity: 0 },
          {
            x: 0, opacity: 1,
            stagger: 0.08,
            scrollTrigger: {
              trigger: listRef.current,
              start: 'top 85%',
              end: 'top 55%',
              scrub: 0.5
            }
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, [tokens]);

  return (
    <section ref={sectionRef} className="relative py-20 bg-[#050508]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">Live Launches</h2>
            <p className="text-[#8B8B9E]">Tokens launched on-chain</p>
          </div>
          <Link to="/explore">
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 rounded-full">
              View All
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>

        {isLoading && (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-[#E84142]/30 border-t-[#E84142] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[#8B8B9E]">Loading tokens...</p>
          </div>
        )}

        {!isLoading && tokens.length === 0 && (
          <div className="text-center py-12 bg-[#0D0D12] border border-white/[0.06] rounded-2xl">
            <Zap className="w-10 h-10 text-[#E84142]/30 mx-auto mb-3" />
            <p className="text-[#8B8B9E] mb-3">No tokens launched yet.</p>
            <Link to="/create">
              <Button className="bg-[#E84142] hover:bg-[#E84142]/90 text-white rounded-xl">
                Launch a Token
              </Button>
            </Link>
          </div>
        )}

        {!isLoading && tokens.length > 0 && (
          <div ref={listRef} className="space-y-2">
            {tokens.slice(0, 6).map((token) => (
              <Link
                key={token.address}
                to={`/token/${token.address}`}
                className="token-row flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-[#0D0D12] border border-white/[0.06] rounded-2xl hover:border-[#E84142]/30 transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-[#E84142]/20 to-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-white">{token.symbol.charAt(0)}</span>
                </div>

                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white truncate">{token.name}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#8B8B9E] truncate">
                    <span className="font-mono flex-shrink-0">${token.symbol}</span>
                    <span className="flex-shrink-0">•</span>
                    <span className="truncate">{token.creator.slice(0, 6)}...{token.creator.slice(-4)}</span>
                  </div>
                </div>

                <div className="text-right w-20 sm:w-24 flex-shrink-0">
                  <p className="font-mono font-bold text-white text-sm sm:text-base">{token.reserveBalance.toFixed(2)} AVAX</p>
                  <p className="text-xs text-[#8B8B9E] hidden sm:block">Reserve</p>
                </div>

                <Button
                  size="sm"
                  className="bg-[#E84142]/10 hover:bg-[#E84142]/20 text-[#E84142] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 px-2 sm:px-3"
                >
                  <TrendingUp className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Trade</span>
                </Button>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
