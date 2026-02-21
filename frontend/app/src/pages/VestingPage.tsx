import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Lock, TrendingUp, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

const vestingData = {
  tokenName: 'MoonWolf',
  tokenTicker: '$WOLF',
  tokenImage: '/images/token_05.jpg',
  tokenAddress: '0x1234...5678',
  totalAmount: '100000000',
  released: '25000000',
  releasable: '5000000',
  vestedAmount: '30000000',
  cliffEnd: Date.now() + 86400000 * 15,
  vestingEnd: Date.now() + 86400000 * 180,
  progress: 30,
  inCliff: true,
};

export function VestingPage() {
  const { launchId: _launchId } = useParams();
  const { isAuthenticated, isLoading, signInWithX } = useAuth();
  const [claiming, setClaiming] = useState(false);

  const timeUntilCliff = vestingData.cliffEnd - Date.now();
  const daysUntilCliff = Math.floor(timeUntilCliff / (1000 * 60 * 60 * 24));

  const timeUntilVested = vestingData.vestingEnd - Date.now();
  const daysUntilVested = Math.floor(timeUntilVested / (1000 * 60 * 60 * 24));

  const formatNumber = (num: string) => {
    const n = parseInt(num);
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  return (
    <div className="min-h-screen pb-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <Link to="/portfolio" className="inline-flex items-center gap-2 text-dim hover:text-white mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" />Back to Portfolio
        </Link>

        {/* Header */}
        <div className="surface p-5 mb-5">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
              <img src={vestingData.tokenImage} alt={vestingData.tokenName} className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">{vestingData.tokenName} Vesting</h1>
              <p className="font-mono text-cre8-red text-sm">{vestingData.tokenTicker}</p>
              <Badge className="bg-cre8-red/15 text-cre8-red mt-1 text-xs">
                <Lock className="w-3 h-3 mr-1" />Vesting Active
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 bg-cre8-base rounded-lg">
            <span className="text-xs text-dim">Token:</span>
            <code className="font-mono text-xs text-white">{vestingData.tokenAddress}</code>
          </div>
        </div>

        {/* Progress */}
        <div className="surface p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-dim text-sm">Vesting Progress</span>
            <span className="font-mono text-white text-sm tabular-nums">{vestingData.progress}%</span>
          </div>
          <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden mb-5">
            <div className="h-full bg-gradient-to-r from-cre8-red to-red-400 rounded-full" style={{ width: `${vestingData.progress}%` }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-cre8-base rounded-lg p-3">
              <p className="text-[11px] text-dim mb-0.5">Total Locked</p>
              <p className="font-mono text-lg font-bold text-white tabular-nums">{formatNumber(vestingData.totalAmount)} {vestingData.tokenTicker}</p>
            </div>
            <div className="bg-cre8-base rounded-lg p-3">
              <p className="text-[11px] text-dim mb-0.5">Vested</p>
              <p className="font-mono text-lg font-bold text-green-400 tabular-nums">{formatNumber(vestingData.vestedAmount)} {vestingData.tokenTicker}</p>
            </div>
            <div className="bg-cre8-base rounded-lg p-3">
              <p className="text-[11px] text-dim mb-0.5">Released</p>
              <p className="font-mono text-lg font-bold text-white tabular-nums">{formatNumber(vestingData.released)} {vestingData.tokenTicker}</p>
            </div>
            <div className="bg-cre8-base rounded-lg p-3">
              <p className="text-[11px] text-dim mb-0.5">Claimable Now</p>
              <p className="font-mono text-lg font-bold text-cre8-red tabular-nums">{formatNumber(vestingData.releasable)} {vestingData.tokenTicker}</p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="surface p-5 mb-5">
          <h3 className="font-semibold text-white text-sm mb-4">Vesting Timeline</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${vestingData.inCliff ? 'bg-amber-500/15' : 'bg-green-500/15'}`}>
                <Clock className={`w-4 h-4 ${vestingData.inCliff ? 'text-amber-400' : 'text-green-400'}`} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white text-sm">Cliff Period</p>
                <p className="text-xs text-dim">
                  {vestingData.inCliff ? `${daysUntilCliff} days remaining` : 'Completed'}
                </p>
              </div>
              {!vestingData.inCliff && <Check className="w-4 h-4 text-green-400" />}
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-cre8-red/15 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-cre8-red" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white text-sm">Linear Vesting</p>
                <p className="text-xs text-dim">{daysUntilVested} days until fully vested</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center">
                <Lock className="w-4 h-4 text-dim" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-dim text-sm">Fully Vested</p>
                <p className="text-xs text-dim">All tokens unlocked</p>
              </div>
            </div>
          </div>
        </div>

        {/* Claim */}
        <div className="surface p-5">
          {!isAuthenticated ? (
            <div className="text-center py-2">
              <p className="text-dim text-sm mb-3">Sign in with X to view and claim your vested tokens.</p>
              <Button onClick={signInWithX} disabled={isLoading} className="w-full bg-black hover:bg-black/80 text-white font-semibold rounded-lg py-4 border border-white/20">
                {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> : (
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                )}
                {isLoading ? 'Signing in...' : 'Sign in with X'}
              </Button>
            </div>
          ) : parseInt(vestingData.releasable) > 0 ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-white text-sm">Claim Tokens</h3>
                  <p className="text-xs text-dim">{formatNumber(vestingData.releasable)} {vestingData.tokenTicker} available</p>
                </div>
              </div>
              <Button className="w-full bg-cre8-red hover:bg-cre8-red/90 text-white font-semibold rounded-lg py-4" onClick={() => setClaiming(true)} disabled={claiming}>
                {claiming ? 'Claiming...' : `Claim ${formatNumber(vestingData.releasable)} ${vestingData.tokenTicker}`}
              </Button>
            </>
          ) : vestingData.inCliff ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-white text-sm">In Cliff Period</h3>
              </div>
              <p className="text-dim text-sm mb-3">
                Tokens are locked during the cliff period. Claimable after {daysUntilCliff} days.
              </p>
              <Button className="w-full bg-white/[0.06] text-white rounded-lg py-4" disabled>
                Claim Available in {daysUntilCliff} Days
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <Check className="w-4 h-4 text-green-400" />
                <h3 className="font-semibold text-white text-sm">All Tokens Claimed</h3>
              </div>
              <p className="text-dim text-sm">You have claimed all available tokens. New tokens will be claimable as they vest.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
