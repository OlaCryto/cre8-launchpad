import { Link } from 'react-router-dom';
import type { TradeActivity } from '@/hooks/useContracts';

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

interface TradeTickerProps {
  trades: TradeActivity[];
  tokenSymbols?: Record<string, string>;
}

function TickerItem({ trade, tokenSymbol }: { trade: TradeActivity; tokenSymbol?: string }) {
  const symbol = tokenSymbol || trade.txHash.slice(0, 6);
  return (
    <span className="inline-flex items-center gap-1.5 px-3 whitespace-nowrap text-[13px]">
      <span className="font-mono text-dim/60">{trade.trader.slice(0, 6)}</span>
      <span className={trade.type === 'buy' ? 'text-green-400 font-semibold' : 'text-cre8-red font-semibold'}>
        {trade.type === 'buy' ? 'bought' : 'sold'}
      </span>
      <span className="text-white font-mono font-medium">
        {trade.avaxAmount < 0.01 ? trade.avaxAmount.toFixed(4) : trade.avaxAmount.toFixed(2)}
      </span>
      <span className="text-dim">AVAX of</span>
      <span className="text-white font-semibold">${symbol}</span>
      <span className="text-dim/40 text-xs">{timeAgo(trade.timestamp)}</span>
      <span className="text-dim/20 mx-2">|</span>
    </span>
  );
}

export function TradeTicker({ trades, tokenSymbols = {} }: TradeTickerProps) {
  if (trades.length === 0) return null;

  const displayTrades = trades.slice(0, 30);

  return (
    <div className="w-full overflow-hidden bg-cre8-surface/80 border-b border-white/[0.04] py-2 relative">
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-cre8-base to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-cre8-base to-transparent z-10 pointer-events-none" />
      <div className="ticker-track flex">
        {[...displayTrades, ...displayTrades].map((trade, i) => (
          <Link
            key={`${trade.txHash}-${i}`}
            to={`/token/${(trade as any).tokenAddress || '#'}`}
            className="hover:opacity-80 transition-opacity"
          >
            <TickerItem
              trade={trade}
              tokenSymbol={tokenSymbols[(trade as any).tokenAddress] || (trade as any).tokenSymbol}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
