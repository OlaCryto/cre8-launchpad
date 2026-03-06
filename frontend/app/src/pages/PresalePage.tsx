import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Users, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  useForgeLaunch,
  usePresaleVault,
  useContributorInfo,
  usePresaleContributors,
  useContribute,
  useClaimPresale,
  useRefundPresale,
  useExecuteLaunch,
  VAULT_STATE_LABELS,
} from '@/hooks/useForge';

export function PresalePage() {
  const { launchId } = useParams();
  const id = launchId !== undefined ? parseInt(launchId) : undefined;
  const { isAuthenticated, isLoading: authLoading, signInWithX, user } = useAuth();

  const { data: launch, isLoading: launchLoading } = useForgeLaunch(id);
  const { data: vault, isLoading: vaultLoading } = usePresaleVault(launch?.presaleVault);
  const contributor = useContributorInfo(launch?.presaleVault, user?.wallet?.address);
  const contributors = usePresaleContributors(launch?.presaleVault);

  const { isLoading: contributing, execute: contribute } = useContribute();
  const { isLoading: claiming, execute: claimPresale } = useClaimPresale();
  const { isLoading: refunding, execute: refundPresale } = useRefundPresale();
  const { isLoading: executing, execute: executeLaunch } = useExecuteLaunch();

  const [contributeAmount, setContributeAmount] = useState('');

  const isLoading = launchLoading || vaultLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!launch || !vault) {
    return (
      <div className="min-h-screen pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-dim hover:text-white mb-6 text-sm">
            <ArrowLeft className="w-4 h-4" />Back to Dashboard
          </Link>
          <div className="surface p-8 text-center">
            <AlertCircle className="w-8 h-8 text-dim mx-auto mb-3" />
            <p className="text-dim">Launch not found or presale not enabled.</p>
          </div>
        </div>
      </div>
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const timeRemaining = vault.endTime > now ? (vault.endTime - now) * 1000 : 0;
  const daysRemaining = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
  const hoursRemaining = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

  // Vault states: 0=Pending, 1=Open, 2=Closed, 3=Finalized, 4=Cancelled
  const stateLabel = VAULT_STATE_LABELS[vault.state] || 'Unknown';
  const isOpen = vault.state === 1;
  const isFinalized = vault.state === 3;
  const isCancelled = vault.state === 4;
  const isClosed = vault.state === 2;

  const getStatusBadge = () => {
    switch (vault.state) {
      case 1: return { text: 'Open', className: 'bg-green-500/15 text-green-400' };
      case 2: return { text: 'Closed', className: 'bg-amber-500/15 text-amber-400' };
      case 3: return { text: 'Finalized', className: 'bg-cre8-red/15 text-cre8-red' };
      case 4: return { text: 'Cancelled', className: 'bg-red-500/15 text-red-400' };
      default: return { text: stateLabel, className: 'bg-white/[0.06] text-dim' };
    }
  };

  const statusBadge = getStatusBadge();

  const handleContribute = async () => {
    const amount = parseFloat(contributeAmount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }

    try {
      await contribute(launch.presaleVault, amount);
      toast.success(`Contributed ${amount} AVAX!`);
      setContributeAmount('');
    } catch (err: any) {
      toast.error('Contribution failed', { description: err?.shortMessage || err?.message });
    }
  };

  const handleClaim = async () => {
    try {
      await claimPresale(launch.presaleVault);
      toast.success('Tokens claimed!');
    } catch (err: any) {
      toast.error('Claim failed', { description: err?.shortMessage || err?.message });
    }
  };

  const handleRefund = async () => {
    try {
      await refundPresale(launch.presaleVault);
      toast.success('Refund successful!');
    } catch (err: any) {
      toast.error('Refund failed', { description: err?.shortMessage || err?.message });
    }
  };

  const handleExecuteLaunch = async () => {
    if (id === undefined) return;
    try {
      await executeLaunch(id);
      toast.success('Launch executed! Token deployed.');
    } catch (err: any) {
      toast.error('Launch execution failed', { description: err?.shortMessage || err?.message });
    }
  };

  const canClaim = isFinalized && contributor && !contributor.claimed && contributor.tokenAllocation > 0;
  const canRefund = isCancelled && contributor && !contributor.refunded && contributor.contributed > 0;
  const isCreator = user?.wallet?.address?.toLowerCase() === launch.creator.toLowerCase();
  const canExecute = (isClosed || (isOpen && timeRemaining === 0)) && isCreator;

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
              <div className="w-16 h-16 rounded-xl bg-cre8-red/15 flex items-center justify-center shrink-0">
                <span className="text-2xl font-bold text-cre8-red">{launch.config.symbol?.charAt(0) || '?'}</span>
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white">{launch.config.name} Presale</h1>
                <p className="font-mono text-cre8-red text-sm">${launch.config.symbol}</p>
                <Badge className={statusBadge.className + ' mt-1'}>{statusBadge.text}</Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-cre8-base rounded-lg">
            <div>
              <p className="text-xs text-dim">Created by</p>
              <p className="font-mono text-white text-sm">{launch.creator.slice(0, 6)}...{launch.creator.slice(-4)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left */}
          <div className="space-y-4">
            {/* Stats + Hard Cap Progress */}
            <div className="surface p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-dim text-sm">Total Raised</span>
                <span className="font-mono text-white text-lg font-bold tabular-nums">{vault.totalRaised.toFixed(2)} AVAX</span>
              </div>
              {vault.hardCap > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-dim">Progress to Hard Cap</span>
                    <span className="text-white font-mono tabular-nums">{Math.min(100, (vault.totalRaised / vault.hardCap) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-white/[0.06] rounded-full overflow-hidden relative">
                    {vault.softCap > 0 && (
                      <div
                        className="absolute top-0 h-full border-r-2 border-amber-400/60 z-10"
                        style={{ left: `${Math.min(100, (vault.softCap / vault.hardCap) * 100)}%` }}
                        title={`Soft cap: ${vault.softCap} AVAX`}
                      />
                    )}
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cre8-red to-cre8-red/80 transition-all duration-500"
                      style={{ width: `${Math.min(100, (vault.totalRaised / vault.hardCap) * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] mt-1">
                    <span className="text-dim">0</span>
                    {vault.softCap > 0 && (
                      <span className="text-amber-400 font-mono tabular-nums">Soft: {vault.softCap} AVAX</span>
                    )}
                    <span className="text-dim font-mono tabular-nums">Hard: {vault.hardCap} AVAX</span>
                  </div>
                </div>
              )}
              {/* Soft cap warning */}
              {isOpen && vault.softCap > 0 && vault.totalRaised < vault.softCap && (
                <div className="flex items-start gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-3">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-400/90">
                    Soft cap of {vault.softCap} AVAX not yet met. If the presale closes below this amount, all contributions will be refunded.
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-dim">
                  <Users className="w-3.5 h-3.5" />
                  <span className="text-sm tabular-nums">{vault.totalContributors}</span>
                </div>
                <span className="text-xs text-dim">contributors</span>
              </div>
            </div>

            {/* Time */}
            {isOpen && (
              <div className="surface p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-cre8-red" />
                  <h3 className="font-semibold text-white text-sm">Time Remaining</h3>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-cre8-base rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-white tabular-nums">{daysRemaining}</p>
                    <p className="text-xs text-dim">Days</p>
                  </div>
                  <div className="bg-cre8-base rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-white tabular-nums">{hoursRemaining}</p>
                    <p className="text-xs text-dim">Hours</p>
                  </div>
                  <div className="bg-cre8-base rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-white tabular-nums">{minutesRemaining}</p>
                    <p className="text-xs text-dim">Min</p>
                  </div>
                </div>
              </div>
            )}

            {/* Presale info */}
            <div className="bg-cre8-surface/50 border border-white/[0.04] rounded-xl p-4 space-y-2">
              {vault.hardCap > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-dim">Hard Cap</span>
                  <span className="text-white font-mono tabular-nums">{vault.hardCap} AVAX</span>
                </div>
              )}
              {vault.softCap > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-dim">Soft Cap</span>
                  <span className="text-amber-400 font-mono tabular-nums">{vault.softCap} AVAX</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-dim">Max per wallet</span>
                <span className="text-white font-mono tabular-nums">{vault.maxPerWallet} AVAX</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dim">Presale vault</span>
                <span className="text-white font-mono text-xs tabular-nums">{launch.presaleVault.slice(0, 8)}...{launch.presaleVault.slice(-6)}</span>
              </div>
            </div>

            {/* Your Contribution */}
            {isAuthenticated && contributor && contributor.contributed > 0 && (
              <div className="surface p-5">
                <h3 className="font-semibold text-white text-sm mb-3">Your Contribution</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-dim">Contributed</span><span className="font-mono text-white tabular-nums">{contributor.contributed.toFixed(4)} AVAX</span></div>
                  {isFinalized && (
                    <div className="flex justify-between"><span className="text-dim">Allocation</span><span className="font-mono text-white tabular-nums">{contributor.tokenAllocation.toLocaleString()} tokens</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-dim">Claimed</span><span className="font-mono text-white">{contributor.claimed ? 'Yes' : 'No'}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Right */}
          <div className="space-y-4">
            {/* Contribute form */}
            {isOpen && (
              <div className="surface p-5">
                <h3 className="font-semibold text-white text-sm mb-3">Contribute</h3>
                {isAuthenticated ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-dim mb-1.5 block">Amount (AVAX)</label>
                      <div className="relative">
                        <Input type="number" placeholder="0.0" value={contributeAmount} onChange={(e) => setContributeAmount(e.target.value)}
                          className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/50 rounded-lg pr-16" />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-dim text-sm">AVAX</span>
                      </div>
                      <p className="text-xs text-dim/60 mt-1">
                        Max per wallet: {vault.maxPerWallet} AVAX
                        {contributor ? ` (${contributor.remainingAllowance.toFixed(2)} remaining)` : ''}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      {['1', '2', '5', String(vault.maxPerWallet)].map((amt) => (
                        <button key={amt} onClick={() => setContributeAmount(amt)}
                          className="flex-1 py-1.5 rounded-md bg-white/[0.04] text-xs text-dim hover:bg-white/[0.08] hover:text-white transition-colors">
                          {parseFloat(amt) === vault.maxPerWallet ? 'Max' : amt}
                        </button>
                      ))}
                    </div>
                    <Button onClick={handleContribute} disabled={contributing}
                      className="w-full bg-cre8-red hover:bg-cre8-red/90 text-white font-semibold rounded-lg py-4">
                      {contributing ? 'Contributing...' : 'Contribute'}
                    </Button>
                    <p className="text-xs text-dim text-center">
                      From {user?.wallet.address.slice(0, 6)}...{user?.wallet.address.slice(-4)}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-dim text-sm mb-3">Sign in with X to contribute.</p>
                    <Button onClick={signInWithX} disabled={authLoading}
                      className="w-full bg-black hover:bg-black/80 text-white font-semibold rounded-lg py-4 border border-white/20">
                      {authLoading ? 'Signing in...' : 'Sign in with X'}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Execute Launch (creator action after presale closes) */}
            {canExecute && (
              <div className="surface p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <h3 className="font-semibold text-white text-sm">Presale Closed</h3>
                </div>
                <p className="text-dim text-sm mb-3">
                  Presale has ended with {vault.totalRaised.toFixed(2)} AVAX raised. Execute the launch to deploy the token.
                </p>
                <Button onClick={handleExecuteLaunch} disabled={executing}
                  className="w-full bg-cre8-red hover:bg-cre8-red/90 text-white font-semibold rounded-lg py-4">
                  {executing ? 'Executing...' : 'Execute Launch'}
                </Button>
              </div>
            )}

            {/* Claim tokens */}
            {isFinalized && (
              <div className="surface p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Check className="w-4 h-4 text-green-400" />
                  <h3 className="font-semibold text-white text-sm">Presale Finalized</h3>
                </div>
                <p className="text-dim text-sm mb-3">
                  Token deployed. {vault.totalTokensBought > 0 ? `${vault.totalTokensBought.toLocaleString()} tokens distributed.` : 'Claim your tokens.'}
                </p>
                {isAuthenticated && canClaim ? (
                  <Button onClick={handleClaim} disabled={claiming}
                    className="w-full bg-green-500 hover:bg-green-500/90 text-white font-semibold rounded-lg py-4">
                    {claiming ? 'Claiming...' : `Claim ${contributor?.tokenAllocation.toLocaleString()} tokens`}
                  </Button>
                ) : isAuthenticated && contributor?.claimed ? (
                  <p className="text-center text-green-400 text-sm">Tokens already claimed</p>
                ) : !isAuthenticated ? (
                  <Button onClick={signInWithX} disabled={authLoading}
                    className="w-full bg-black hover:bg-black/80 text-white font-semibold rounded-lg py-4 border border-white/20">
                    Sign in to Claim
                  </Button>
                ) : null}
                {launch.token !== '0x0000000000000000000000000000000000000000' && (
                  <Link to={`/token/${launch.token}`} className="block mt-3 text-center text-xs text-cre8-red hover:underline">
                    View token page
                  </Link>
                )}
              </div>
            )}

            {/* Refund */}
            {isCancelled && (
              <div className="surface p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <h3 className="font-semibold text-white text-sm">Presale Cancelled</h3>
                </div>
                <p className="text-dim text-sm mb-3">The presale was cancelled. You can get a full refund.</p>
                {isAuthenticated && canRefund ? (
                  <Button onClick={handleRefund} disabled={refunding}
                    className="w-full bg-red-500 hover:bg-red-500/90 text-white font-semibold rounded-lg py-4">
                    {refunding ? 'Refunding...' : `Refund ${contributor?.contributed.toFixed(4)} AVAX`}
                  </Button>
                ) : isAuthenticated && contributor?.refunded ? (
                  <p className="text-center text-dim text-sm">Already refunded</p>
                ) : !isAuthenticated ? (
                  <Button onClick={signInWithX} disabled={authLoading}
                    className="w-full bg-black hover:bg-black/80 text-white font-semibold rounded-lg py-4 border border-white/20">
                    Sign in to Claim Refund
                  </Button>
                ) : null}
              </div>
            )}

            {/* Contributors */}
            <div className="surface p-5">
              <h3 className="font-semibold text-white text-sm mb-3">Recent Contributors</h3>
              {contributors.length > 0 ? (
                <div className="space-y-2">
                  {contributors.map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 bg-cre8-base rounded-lg">
                      <p className="font-mono text-xs text-white">{c.address.slice(0, 6)}...{c.address.slice(-4)}</p>
                      <p className="font-mono text-sm text-white tabular-nums">{c.amount.toFixed(2)} AVAX</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-dim text-sm text-center py-4">No contributors yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
