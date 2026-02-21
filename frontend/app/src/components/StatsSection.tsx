import { Trophy, TrendingUp } from 'lucide-react';

const traders = [
  { rank: 1, name: 'degenking.avax', volume: '$2.4M', profit: '+$456K', winRate: '78%', avatar: '/images/token_01.jpg' },
  { rank: 2, name: 'moonboy.avax', volume: '$1.8M', profit: '+$312K', winRate: '71%', avatar: '/images/token_02.jpg' },
  { rank: 3, name: 'pepeholder.avax', volume: '$1.2M', profit: '+$198K', winRate: '65%', avatar: '/images/token_03.jpg' },
  { rank: 4, name: 'wagmi.avax', volume: '$980K', profit: '+$145K', winRate: '62%', avatar: '/images/token_04.jpg' },
  { rank: 5, name: 'diamondhands.avax', volume: '$756K', profit: '+$89K', winRate: '58%', avatar: '/images/token_05.jpg' },
];

export function StatsSection() {
  return (
    <section className="relative py-20 bg-[#0D0D12]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Big Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { label: 'Total Volume', value: '$48.2M+' },
            { label: 'Tokens Launched', value: '12,847' },
            { label: 'Active Traders', value: '2,341' },
            { label: 'Graduated', value: '156' },
          ].map((stat, i) => (
            <div key={i} className="bg-[#050508] border border-white/[0.06] rounded-2xl p-6 text-center">
              <p className="font-mono text-2xl md:text-3xl font-bold text-white mb-1">{stat.value}</p>
              <p className="text-sm text-[#8B8B9E]">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Leaderboard */}
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <Trophy className="w-5 h-5 text-[#E84142]" />
            <h3 className="text-xl font-bold text-white">Top Traders</h3>
          </div>

          <div className="bg-[#050508] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="grid grid-cols-12 gap-4 p-4 text-sm text-[#8B8B9E] border-b border-white/[0.06]">
              <span className="col-span-1">#</span>
              <span className="col-span-5">Trader</span>
              <span className="col-span-3 text-right">Volume</span>
              <span className="col-span-3 text-right">Profit</span>
            </div>
            {traders.map((trader) => (
              <div key={trader.rank} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-white/5 transition-colors border-b border-white/[0.06] last:border-0">
                <div className="col-span-1">
                  {trader.rank <= 3 ? (
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      trader.rank === 1 ? 'bg-[#FFD700] text-black' :
                      trader.rank === 2 ? 'bg-[#C0C0C0] text-black' :
                      'bg-[#CD7F32] text-black'
                    }`}>
                      {trader.rank}
                    </span>
                  ) : (
                    <span className="text-[#8B8B9E]">{trader.rank}</span>
                  )}
                </div>
                <div className="col-span-5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden">
                    <img src={trader.avatar} alt={trader.name} className="w-full h-full object-cover" />
                  </div>
                  <span className="font-mono text-white truncate">{trader.name}</span>
                </div>
                <span className="col-span-3 text-right font-mono text-white">{trader.volume}</span>
                <span className="col-span-3 text-right font-mono text-green-400 flex items-center justify-end gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {trader.profit}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
