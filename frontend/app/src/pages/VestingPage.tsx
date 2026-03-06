import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Lock, TrendingUp, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useForgeLaunch, useVestingInfo, useReleaseVesting } from '@/hooks/useForge';

export function VestingPage() {
  const { launchId } = useParams();
  const id = launchId !== undefined ? parseInt(launchId) : undefined;
  const { isAuthenticated, isLoading: authLoading, signInWithX, user } = useAuth();

  const { data: launch, isLoading: launchLoading } = useForgeLaunch(id);
  const { data: vesting, isLoading: vestingLoading } = useVestingInfo(launch?.vestingContract);
  const { isLoading: releasing, execute: releaseVesting } = useReleaseVesting();

  const isLoading = launchLoading || vestingLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!launch || !vesting) {
    return (
      <div className="min-h-screen pb-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-dim hover:text-white mb-6 text-sm">
            <ArrowLeft className="w-4 h-4" />Back to Dashboard
          </Link>
          <div className="surface p-8 text-center">
            <AlertCircle className="w-8 h-8 text-dim mx-auto mb-3" />
            <p className="text-dim">Launch not found or vesting not enabled.</p>
          </div>
        </div>
      </div>
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const inCliff = now < vesting.cliffEnd;
  const isFullyVested = now >= vesting.vestingEnd;
  const timeUntilCliff = inCliff ? vesting.cliffEnd - now : 0;
  const daysUntilCliff = Math.floor(timeUntilCliff / 86400);
  const timeUntilVested = !isFullyVested ? vesting.vestingEnd - now : 0;
  const daysUntilVested = Math.floor(timeUntilVested / 86400);

  const isBeneficiary = user?.wallet?.address?.toLowerCase() === vesting.beneficiary.toLowerCase();

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toFixed(0);
  };

  const handleRelease = async () => {
    try {
      await releaseVesting(launch.vestingContract);
      toast.success('Vested tokens released!');
    } catch (err: any) {
      toast.error('Release failed', { description: err?.shortMessage || err?.message });
    }
  };

  return (
    <div className="min-h-screen pb-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <Link to="/" className="inline-flex items-center gap-2 text-dim hover:text-white mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" />Back to Dashboard
        </Link>

        {/* Header */}
        <div className="surface p-5 mb-5">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-xl bg-purple-500/15 flex items-center justify-center shrink-0">
              <Lock className="w-7 h-7 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">{launch.config.name} Vesting</h1>
              <p className="font-mono text-cre8-red text-sm">${launch.config.symbol}</p>
              <Badge className={`mt-1 text-xs ${vesting.revoked ? 'bg-red-500/15 text-red-400' : 'bg-purple-500/15 text-purple-400'}`}>
                <Lock className="w-3 h-3 mr-1" />
                {vesting.revoked ? 'Revoked' : isFullyVested ? 'Fully Vested' : inCliff ? 'In Cliff' : 'Vesting Active'}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-cre8-base rounded-lg text-xs">
            <div className="flex-1">
              <span className="text-dim">Beneficiary: </span>
              <code className="font-mono text-white">{vesting.beneficiary.slice(0, 8)}...{vesting.beneficiary.slice(-6)}</code>
            </div>
            <div>
              <span className="text-dim">Token: </span>
              <code className="font-mono text-white">{vesting.token.slice(0, 8)}...{vesting.token.slice(-6)}</code>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="surface p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-dim text-sm">Vesting Progress</span>
            <span className="font-mono text-white text-sm tabular-nums">{vesting.progress.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden mb-5">
            <div className="h-full bg-gradient-to-r from-purple-500 to-cre8-red rounded-full transition-all" style={{ width: `${Math.min(vesting.progress, 100)}%` }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-cre8-base rounded-lg p-3">
              <p className="text-[11px] text-dim mb-0.5">Total Locked</p>
              <p className="font-mono text-lg font-bold text-white tabular-nums">{formatNumber(vesting.totalAmount)}</p>
            </div>
            <div className="bg-cre8-base rounded-lg p-3">
              <p className="text-[11px] text-dim mb-0.5">Vested</p>
              <p className="font-mono text-lg font-bold text-green-400 tabular-nums">{formatNumber(vesting.vestedAmount)}</p>
            </div>
            <div className="bg-cre8-base rounded-lg p-3">
              <p className="text-[11px] text-dim mb-0.5">Released</p>
              <p className="font-mono text-lg font-bold text-white tabular-nums">{formatNumber(vesting.released)}</p>
            </div>
            <div className="bg-cre8-base rounded-lg p-3">
              <p className="text-[11px] text-dim mb-0.5">Claimable Now</p>
              <p className="font-mono text-lg font-bold text-cre8-red tabular-nums">{formatNumber(vesting.releasable)}</p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="surface p-5 mb-5">
          <h3 className="font-semibold text-white text-sm mb-4">Vesting Timeline</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${inCliff ? 'bg-amber-500/15' : 'bg-green-500/15'}`}>
                <Clock className={`w-4 h-4 ${inCliff ? 'text-amber-400' : 'text-green-400'}`} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white text-sm">Cliff Period</p>
                <p className="text-xs text-dim">
                  {inCliff ? `${daysUntilCliff} days remaining` : 'Completed'}
                </p>
              </div>
              {!inCliff && <Check className="w-4 h-4 text-green-400" />}
            </div>

            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${!inCliff && !isFullyVested ? 'bg-cre8-red/15' : 'bg-white/[0.06]'}`}>
                <TrendingUp className={`w-4 h-4 ${!inCliff && !isFullyVested ? 'text-cre8-red' : 'text-dim'}`} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white text-sm">Linear Vesting</p>
                <p className="text-xs text-dim">
                  {isFullyVested ? 'Completed' : inCliff ? 'Starts after cliff' : `${daysUntilVested} days until fully vested`}
                </p>
              </div>
              {isFullyVested && <Check className="w-4 h-4 text-green-400" />}
            </div>

            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isFullyVested ? 'bg-green-500/15' : 'bg-white/[0.06]'}`}>
                <Lock className={`w-4 h-4 ${isFullyVested ? 'text-green-400' : 'text-dim'}`} />
              </div>
              <div className="flex-1">
                <p className={`font-medium text-sm ${isFullyVested ? 'text-white' : 'text-dim'}`}>Fully Vested</p>
                <p className="text-xs text-dim">All tokens unlocked</p>
              </div>
              {isFullyVested && <Check className="w-4 h-4 text-green-400" />}
            </div>
          </div>
        </div>

        {/* Claim */}
        <div className="surface p-5">
          {!isAuthenticated ? (
            <div className="text-center py-2">
              <p className="text-dim text-sm mb-3">Sign in with X to view and claim your vested tokens.</p>
              <Button onClick={signInWithX} disabled={authLoading}
                className="w-full bg-black hover:bg-black/80 text-white font-semibold rounded-lg py-4 border border-white/20">
                {authLoading ? 'Signing in...' : 'Sign in with X'}
              </Button>
            </div>
          ) : vesting.revoked ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <h3 className="font-semibold text-white text-sm">Vesting Revoked</h3>
              </div>
              <p className="text-dim text-sm">This vesting schedule has been revoked. Vested tokens were released to the beneficiary.</p>
            </>
          ) : vesting.releasable > 0 && isBeneficiary ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-white text-sm">Claim Tokens</h3>
                  <p className="text-xs text-dim">{formatNumber(vesting.releasable)} tokens available</p>
                </div>
              </div>
              <Button onClick={handleRelease} disabled={releasing}
                className="w-full bg-cre8-red hover:bg-cre8-red/90 text-white font-semibold rounded-lg py-4">
                {releasing ? 'Releasing...' : `Claim ${formatNumber(vesting.releasable)} tokens`}
              </Button>
            </>
          ) : inCliff ? (
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
          ) : vesting.releasable === 0 && vesting.released > 0 ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <Check className="w-4 h-4 text-green-400" />
                <h3 className="font-semibold text-white text-sm">All Tokens Claimed</h3>
              </div>
              <p className="text-dim text-sm">
                {isFullyVested
                  ? 'All vested tokens have been claimed.'
                  : 'You have claimed all available tokens. New tokens will be claimable as they vest.'}
              </p>
            </>
          ) : !isBeneficiary ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-4 h-4 text-dim" />
                <h3 className="font-semibold text-white text-sm">Viewing Vesting Schedule</h3>
              </div>
              <p className="text-dim text-sm">Only the beneficiary can claim vested tokens.</p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
