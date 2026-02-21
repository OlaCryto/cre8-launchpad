import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, Users, Check, AlertCircle, Globe, Github, FileText, MessageCircle, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const presaleData = {
  tokenName: 'MoonWolf',
  tokenTicker: '$WOLF',
  tokenImage: '/images/token_05.jpg',
  creator: '@wolfmaster',
  creatorAvatar: '/images/token_01.jpg',
  status: 'open' as 'open' | 'closed' | 'finalized' | 'cancelled',
  totalRaised: '45.2',
  target: '100',
  contributors: 234,
  maxPerWallet: '10',
  endTime: Date.now() + 86400000 * 2,
  userContribution: '5',
  userAllocation: '25000',
  fundsToLiquidity: 80,
  project: {
    name: 'MoonWolf Protocol',
    description: 'A decentralized lending protocol built on Avalanche with adaptive interest rates and cross-chain collateral support.',
    githubRepo: 'https://github.com/moonwolf-protocol',
    whitepaper: 'https://docs.moonwolf.io',
    website: 'https://moonwolf.io',
    telegram: 't.me/moonwolf',
  },
};

const contributors = [
  { address: '0x1234...5678', amount: '10.0', time: '2h ago' },
  { address: '0xabcd...efgh', amount: '8.5', time: '3h ago' },
  { address: '0x9876...5432', amount: '7.2', time: '5h ago' },
  { address: '0xwxyz...mnop', amount: '6.0', time: '6h ago' },
  { address: '0xqwer...tyui', amount: '5.5', time: '8h ago' },
];

export function PresalePage() {
  const { isAuthenticated, isLoading, signInWithX, user } = useAuth();
  const [contributeAmount, setContributeAmount] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const progress = (parseFloat(presaleData.totalRaised) / parseFloat(presaleData.target)) * 100;
  const timeRemaining = presaleData.endTime - Date.now();
  const daysRemaining = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
  const hoursRemaining = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  const getStatusBadge = () => {
    switch (presaleData.status) {
      case 'open': return { text: 'Open', className: 'bg-green-500/15 text-green-400' };
      case 'closed': return { text: 'Closed', className: 'bg-amber-500/15 text-amber-400' };
      case 'finalized': return { text: 'Finalized', className: 'bg-cre8-red/15 text-cre8-red' };
      case 'cancelled': return { text: 'Cancelled', className: 'bg-red-500/15 text-red-400' };
    }
  };

  const statusBadge = getStatusBadge();

  const handleContribute = () => {
    if (!contributeAmount || parseFloat(contributeAmount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    toast.success(`Contributed ${contributeAmount} AVAX! (Demo mode)`);
    setContributeAmount('');
  };

  const toggleNotifications = () => {
    setNotificationsEnabled(!notificationsEnabled);
    toast.success(notificationsEnabled ? 'Notifications disabled' : 'You\'ll be notified when this presale updates');
  };

  return (
    <div className="min-h-screen pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <Link to="/" className="inline-flex items-center gap-2 text-dim hover:text-white mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" />Back to Dashboard
        </Link>

        {/* Header */}
        <div className="surface p-5 mb-5">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
                <img src={presaleData.tokenImage} alt={presaleData.tokenName} className="w-full h-full object-cover" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white">{presaleData.tokenName} Presale</h1>
                <p className="font-mono text-cre8-red text-sm">{presaleData.tokenTicker}</p>
                <Badge className={statusBadge.className + ' mt-1'}>{statusBadge.text}</Badge>
              </div>
            </div>
            {isAuthenticated && (
              <button
                onClick={toggleNotifications}
                className={`p-2 rounded-lg transition-colors ${
                  notificationsEnabled ? 'bg-cre8-red/15 text-cre8-red' : 'bg-white/[0.04] text-dim hover:text-white'
                }`}
              >
                <Bell className={`w-4 h-4 ${notificationsEnabled ? 'fill-current' : ''}`} />
              </button>
            )}
          </div>

          <Link to={`/profile/${presaleData.creator}`} className="flex items-center gap-3 p-3 bg-cre8-base rounded-lg hover:bg-white/[0.04] transition-colors">
            <div className="w-8 h-8 rounded-full overflow-hidden">
              <img src={presaleData.creatorAvatar} alt={presaleData.creator} className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-xs text-dim">Created by</p>
              <p className="font-mono text-white text-sm">{presaleData.creator}</p>
            </div>
          </Link>
        </div>

        {/* Project Info */}
        <div className="surface p-5 mb-5">
          <h3 className="font-semibold text-white text-sm mb-2">About {presaleData.project.name}</h3>
          <p className="text-dim text-sm mb-3">{presaleData.project.description}</p>
          <div className="flex flex-wrap gap-2">
            {presaleData.project.githubRepo && (
              <a href={presaleData.project.githubRepo} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] text-xs text-dim hover:text-white hover:bg-white/[0.06] transition-colors">
                <Github className="w-3.5 h-3.5" />GitHub
              </a>
            )}
            {presaleData.project.whitepaper && (
              <a href={presaleData.project.whitepaper} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] text-xs text-dim hover:text-white hover:bg-white/[0.06] transition-colors">
                <FileText className="w-3.5 h-3.5" />Docs
              </a>
            )}
            {presaleData.project.website && (
              <a href={presaleData.project.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] text-xs text-dim hover:text-white hover:bg-white/[0.06] transition-colors">
                <Globe className="w-3.5 h-3.5" />Website
              </a>
            )}
            {presaleData.project.telegram && (
              <a href={`https://${presaleData.project.telegram}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] text-xs text-dim hover:text-white hover:bg-white/[0.06] transition-colors">
                <MessageCircle className="w-3.5 h-3.5" />Telegram
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left */}
          <div className="space-y-4">
            {/* Progress */}
            <div className="surface p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-dim text-sm">Progress</span>
                <span className="font-mono text-white text-sm tabular-nums">{progress.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden mb-4">
                <div className="h-full bg-gradient-to-r from-cre8-red to-red-400 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold text-white tabular-nums">{presaleData.totalRaised} AVAX</p>
                  <p className="text-xs text-dim">raised of {presaleData.target} AVAX</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-dim">
                    <Users className="w-3.5 h-3.5" />
                    <span className="text-sm tabular-nums">{presaleData.contributors}</span>
                  </div>
                  <p className="text-xs text-dim">contributors</p>
                </div>
              </div>
            </div>

            {/* Time */}
            <div className="surface p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-cre8-red" />
                <h3 className="font-semibold text-white text-sm">Time Remaining</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-cre8-base rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-white tabular-nums">{daysRemaining}</p>
                  <p className="text-xs text-dim">Days</p>
                </div>
                <div className="bg-cre8-base rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-white tabular-nums">{hoursRemaining}</p>
                  <p className="text-xs text-dim">Hours</p>
                </div>
              </div>
            </div>

            {/* Liquidity Info */}
            <div className="bg-cre8-surface/50 border border-white/[0.04] rounded-xl p-4">
              <div className="flex justify-between text-sm">
                <span className="text-dim">Funds to liquidity</span>
                <span className="text-white font-mono tabular-nums">{presaleData.fundsToLiquidity}%</span>
              </div>
              <p className="text-xs text-dim/60 mt-1">
                {presaleData.fundsToLiquidity}% of raised AVAX goes to bonding curve liquidity at launch.
              </p>
            </div>

            {/* Your Contribution */}
            {isAuthenticated && (
              <div className="surface p-5">
                <h3 className="font-semibold text-white text-sm mb-3">Your Contribution</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-dim">Contributed</span><span className="font-mono text-white tabular-nums">{presaleData.userContribution} AVAX</span></div>
                  <div className="flex justify-between"><span className="text-dim">Allocation</span><span className="font-mono text-white tabular-nums">{presaleData.userAllocation} {presaleData.tokenTicker}</span></div>
                  <div className="flex justify-between"><span className="text-dim">Remaining</span><span className="font-mono text-white tabular-nums">{parseFloat(presaleData.maxPerWallet) - parseFloat(presaleData.userContribution)} AVAX</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Right */}
          <div className="space-y-4">
            {presaleData.status === 'open' && (
              <div className="surface p-5">
                <h3 className="font-semibold text-white text-sm mb-3">Contribute</h3>
                {isAuthenticated ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-dim mb-1.5 block">Amount (AVAX)</label>
                      <div className="relative">
                        <Input type="number" placeholder="0.0" value={contributeAmount} onChange={(e) => setContributeAmount(e.target.value)} className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/50 rounded-lg pr-16" />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-dim text-sm">AVAX</span>
                      </div>
                      <p className="text-xs text-dim/60 mt-1">Max per wallet: {presaleData.maxPerWallet} AVAX</p>
                    </div>
                    <div className="flex gap-1.5">
                      {['1', '2', '5', presaleData.maxPerWallet].map((amt) => (
                        <button key={amt} onClick={() => setContributeAmount(amt)} className="flex-1 py-1.5 rounded-md bg-white/[0.04] text-xs text-dim hover:bg-white/[0.08] hover:text-white transition-colors">
                          {amt === presaleData.maxPerWallet ? 'Max' : amt}
                        </button>
                      ))}
                    </div>
                    <Button onClick={handleContribute} className="w-full bg-cre8-red hover:bg-cre8-red/90 text-white font-semibold rounded-lg py-4">
                      Contribute
                    </Button>
                    <p className="text-xs text-dim text-center">
                      From {user?.wallet.address.slice(0, 6)}...{user?.wallet.address.slice(-4)}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-dim text-sm mb-3">Sign in with X to contribute.</p>
                    <Button onClick={signInWithX} disabled={isLoading} className="w-full bg-black hover:bg-black/80 text-white font-semibold rounded-lg py-4 border border-white/20">
                      {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> : (
                        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                      )}
                      {isLoading ? 'Signing in...' : 'Sign in with X'}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {presaleData.status === 'finalized' && (
              <div className="surface p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Check className="w-4 h-4 text-green-400" />
                  <h3 className="font-semibold text-white text-sm">Presale Finalized</h3>
                </div>
                <p className="text-dim text-sm mb-3">The presale ended successfully. Claim your tokens.</p>
                {isAuthenticated ? (
                  <Button className="w-full bg-green-500 hover:bg-green-500/90 text-white font-semibold rounded-lg py-4">
                    Claim {presaleData.userAllocation} {presaleData.tokenTicker}
                  </Button>
                ) : (
                  <Button onClick={signInWithX} disabled={isLoading} className="w-full bg-black hover:bg-black/80 text-white font-semibold rounded-lg py-4 border border-white/20">
                    Sign in to Claim
                  </Button>
                )}
              </div>
            )}

            {presaleData.status === 'cancelled' && (
              <div className="surface p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <h3 className="font-semibold text-white text-sm">Presale Cancelled</h3>
                </div>
                <p className="text-dim text-sm mb-3">The presale was cancelled. You can get a full refund.</p>
                {isAuthenticated ? (
                  <Button className="w-full bg-red-500 hover:bg-red-500/90 text-white font-semibold rounded-lg py-4">
                    Refund {presaleData.userContribution} AVAX
                  </Button>
                ) : (
                  <Button onClick={signInWithX} disabled={isLoading} className="w-full bg-black hover:bg-black/80 text-white font-semibold rounded-lg py-4 border border-white/20">
                    Sign in to Claim Refund
                  </Button>
                )}
              </div>
            )}

            {/* Contributors */}
            <div className="surface p-5">
              <h3 className="font-semibold text-white text-sm mb-3">Recent Contributors</h3>
              <div className="space-y-2">
                {contributors.map((contributor, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-cre8-base rounded-lg">
                    <div>
                      <p className="font-mono text-xs text-white">{contributor.address}</p>
                      <p className="text-[11px] text-dim">{contributor.time}</p>
                    </div>
                    <p className="font-mono text-sm text-white tabular-nums">{contributor.amount} AVAX</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
