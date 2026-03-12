import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Rocket, Shield, Check, Globe, MessageCircle, Github, FileText,
  Edit, Save, X, Plus, ExternalLink, Wallet,
  TrendingUp, Award, ChevronRight, Users, ArrowLeft,
  Flame, Clock, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth, type CreatorProject } from '@/contexts/AuthContext';
import { useAvaxBalance } from '@/hooks/useContracts';
import { publicClient } from '@/config/client';
import { CONTRACTS, ACTIVE_NETWORK, FEES } from '@/config/wagmi';
import { Cre8ManagerABI, TokenCreatedEvent, TokenCreatedForgeEvent } from '@/config/abis';
import { formatEther } from 'viem';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const cre8Manager = CONTRACTS[ACTIVE_NETWORK].Cre8Manager as `0x${string}`;

interface CreatorToken {
  tokenId: bigint;
  tokenAddress: string;
  name: string;
  symbol: string;
  currentSupply: bigint;
  reserveBalance: bigint;
  currentPrice: bigint;
  marketCap: bigint;
  graduationProgress: bigint;
  graduated: boolean;
  isForge: boolean;
}

/** Fetch all tokens created by a specific address from on-chain events */
function useCreatorTokens(creatorAddress: string | undefined) {
  const [tokens, setTokens] = useState<CreatorToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!creatorAddress) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        // Fetch both Easy and Forge token creation events for this creator
        const [easyLogs, forgeLogs] = await Promise.all([
          publicClient.getLogs({
            address: cre8Manager,
            event: TokenCreatedEvent as any,
            args: { creator: creatorAddress as `0x${string}` },
            fromBlock: 0n,
            toBlock: 'latest',
          }),
          publicClient.getLogs({
            address: cre8Manager,
            event: TokenCreatedForgeEvent as any,
            args: { creator: creatorAddress as `0x${string}` },
            fromBlock: 0n,
            toBlock: 'latest',
          }),
        ]);

        // Collect all tokenIds with forge flag
        const tokenEntries: { tokenId: bigint; isForge: boolean }[] = [];
        for (const log of easyLogs) {
          const args = (log as any).args;
          if (args?.tokenId != null) {
            tokenEntries.push({ tokenId: BigInt(args.tokenId), isForge: false });
          }
        }
        for (const log of forgeLogs) {
          const args = (log as any).args;
          if (args?.tokenId != null) {
            tokenEntries.push({ tokenId: BigInt(args.tokenId), isForge: true });
          }
        }

        if (cancelled) return;

        if (tokenEntries.length === 0) {
          setTokens([]);
          setIsLoading(false);
          return;
        }

        // Fetch token info for each
        const infos = await Promise.all(
          tokenEntries.map(async (entry) => {
            try {
              const result = await publicClient.readContract({
                address: cre8Manager,
                abi: Cre8ManagerABI,
                functionName: 'getTokenInfo',
                args: [entry.tokenId],
              }) as any[];

              return {
                tokenId: entry.tokenId,
                tokenAddress: result[0] as string,
                name: result[2] as string,
                symbol: result[3] as string,
                currentSupply: BigInt(result[4]),
                reserveBalance: BigInt(result[5]),
                currentPrice: BigInt(result[6]),
                marketCap: BigInt(result[7]),
                graduationProgress: BigInt(result[8]),
                graduated: result[9] as boolean,
                isForge: entry.isForge,
              } as CreatorToken;
            } catch {
              return null;
            }
          })
        );

        if (!cancelled) {
          setTokens(infos.filter((t): t is CreatorToken => t !== null));
          setIsLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load tokens');
          setIsLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [creatorAddress]);

  return { tokens, isLoading, error };
}

// ============ Quick Action Card ============

function ActionCard({
  icon: Icon,
  title,
  description,
  accent,
  onClick,
}: {
  icon: typeof Rocket;
  title: string;
  description: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="surface-interactive p-4 text-left group"
    >
      <div className={`w-10 h-10 rounded-xl ${accent} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-cre8-red transition-colors">{title}</h3>
      <p className="text-xs text-dim leading-relaxed">{description}</p>
      <ChevronRight className="w-4 h-4 text-dim mt-2 group-hover:translate-x-1 transition-transform" />
    </button>
  );
}

// ============ Profile Editor ============

function ProfileEditor({
  profile,
  onSave,
  onCancel,
}: {
  profile: CreatorProject;
  onSave: (updated: CreatorProject) => void;
  onCancel: () => void;
}) {
  const [data, setData] = useState({ ...profile });
  const update = (fields: Partial<CreatorProject>) => setData(prev => ({ ...prev, ...fields }));

  const authenticityItems = [
    { label: 'Project name', filled: !!data.projectName.trim() },
    { label: 'Description', filled: !!data.description.trim() },
    { label: 'GitHub', filled: !!data.githubRepo.trim() },
    { label: 'Whitepaper', filled: !!data.whitepaper.trim() },
    { label: 'Website', filled: !!data.website.trim() },
    { label: 'Telegram', filled: !!data.telegram.trim() },
  ];
  const score = authenticityItems.filter(i => i.filled).length;

  return (
    <div className="space-y-5">
      {/* Authenticity Score */}
      <div className="surface p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-400" />
            <span className="text-sm font-semibold text-white">Authenticity Score</span>
          </div>
          <span className={`text-sm font-bold font-mono ${
            score >= 5 ? 'text-green-400' : score >= 3 ? 'text-amber-400' : 'text-dim'
          }`}>{score}/{authenticityItems.length}</span>
        </div>
        <div className="flex gap-1 mb-2.5">
          {authenticityItems.map((item, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
              item.filled ? 'bg-green-400' : 'bg-white/[0.06]'
            }`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {authenticityItems.map((item, i) => (
            <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
              item.filled ? 'bg-green-400/10 text-green-400' : 'bg-white/[0.04] text-dim/50'
            }`}>
              {item.filled && <Check className="w-2.5 h-2.5" />}
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {/* Edit Form */}
      <div className="surface p-5 space-y-4">
        <div>
          <label className="block text-sm text-dim mb-1.5">Project Name <span className="text-cre8-red">*</span></label>
          <Input value={data.projectName} onChange={(e) => update({ projectName: e.target.value })}
            className="bg-cre8-base border-white/[0.06] text-white rounded-lg" />
        </div>
        <div>
          <label className="block text-sm text-dim mb-1.5">Description</label>
          <Textarea value={data.description} onChange={(e) => update({ description: e.target.value })}
            className="bg-cre8-base border-white/[0.06] text-white rounded-lg min-h-[100px]" />
          <p className="text-xs text-dim/50 mt-1">{data.description.length}/1000</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2 text-sm text-dim mb-1.5"><Github className="w-3.5 h-3.5" />GitHub</label>
            <Input value={data.githubRepo} onChange={(e) => update({ githubRepo: e.target.value })} placeholder="https://github.com/..." className="bg-cre8-base border-white/[0.06] text-white rounded-lg" />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-dim mb-1.5"><FileText className="w-3.5 h-3.5" />Whitepaper</label>
            <Input value={data.whitepaper} onChange={(e) => update({ whitepaper: e.target.value })} placeholder="https://docs..." className="bg-cre8-base border-white/[0.06] text-white rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2 text-sm text-dim mb-1.5"><Globe className="w-3.5 h-3.5" />Website</label>
            <Input value={data.website} onChange={(e) => update({ website: e.target.value })} placeholder="https://..." className="bg-cre8-base border-white/[0.06] text-white rounded-lg" />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-dim mb-1.5"><MessageCircle className="w-3.5 h-3.5" />Telegram</label>
            <Input value={data.telegram} onChange={(e) => update({ telegram: e.target.value })} placeholder="t.me/..." className="bg-cre8-base border-white/[0.06] text-white rounded-lg" />
          </div>
        </div>
      </div>

      {/* Save / Cancel */}
      <div className="flex gap-3">
        <Button onClick={onCancel} variant="outline" className="flex-1 border-white/[0.08] text-white hover:bg-white/[0.04] rounded-xl py-5">
          <X className="w-4 h-4 mr-2" />Cancel
        </Button>
        <Button
          onClick={() => {
            if (!data.projectName.trim()) { toast.error('Project name is required'); return; }
            onSave({ ...data, isVerified: score >= 5 });
          }}
          className="flex-1 bg-cre8-red hover:bg-cre8-red/90 text-white font-semibold rounded-xl py-5"
        >
          <Save className="w-4 h-4 mr-2" />Save Changes
        </Button>
      </div>
    </div>
  );
}

// ============ Main Dashboard ============

export function CreatorDashboardPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, signInWithX, updateCreatorProfile } = useAuth();
  const avaxBalance = useAvaxBalance(user?.wallet?.address);
  const { tokens, isLoading: tokensLoading, error: tokensError } = useCreatorTokens(user?.wallet?.address);
  const [view, setView] = useState<'main' | 'edit'>('main');

  // Check creator verification status
  const [creatorStatus, setCreatorStatus] = useState<{ isVerified: boolean; hasPending: boolean } | null>(null);
  useEffect(() => {
    if (!isAuthenticated) { setCreatorStatus(null); return; }
    const session = localStorage.getItem('cre8_session');
    if (!session) return;
    fetch(`${API_BASE}/api/creators/status`, { headers: { Authorization: `Bearer ${session}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setCreatorStatus({ isVerified: data.is_verified, hasPending: data.has_pending }); })
      .catch(() => {});
  }, [isAuthenticated]);

  const profile = user?.creatorProfile;

  // Computed stats
  const totalLaunched = tokens.length;
  const forgeTokens = tokens.filter(t => t.isForge).length;
  const graduated = tokens.filter(t => t.graduated).length;
  const totalMarketCap = tokens.reduce((sum, t) => sum + t.marketCap, 0n);

  // Authenticity score for display
  const authenticityItems = profile ? [
    { label: 'Project name', filled: !!profile.projectName.trim() },
    { label: 'Description', filled: !!profile.description.trim() },
    { label: 'GitHub', filled: !!profile.githubRepo.trim() },
    { label: 'Whitepaper', filled: !!profile.whitepaper.trim() },
    { label: 'Website', filled: !!profile.website.trim() },
    { label: 'Telegram', filled: !!profile.telegram.trim() },
  ] : [];
  const authenticityScore = authenticityItems.filter(i => i.filled).length;

  // Not signed in
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-cre8-red/10 flex items-center justify-center mx-auto mb-4">
            <Flame className="w-7 h-7 text-cre8-red" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Creator Dashboard</h2>
          <p className="text-sm text-dim mb-6">Sign in to access Forge Mode — launch tokens with whitelist and anti-bot protection.</p>
          <Button onClick={signInWithX} className="bg-cre8-red hover:bg-cre8-red/90 text-white font-semibold rounded-xl px-8 py-5">
            Sign in to continue
          </Button>
        </div>
      </div>
    );
  }

  // Not verified — show apply CTA
  if (!creatorStatus?.isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Verified Creators Only</h2>
          <p className="text-sm text-dim mb-6 leading-relaxed">
            Forge Mode is available exclusively to verified creators. Apply for verification to unlock whitelist and anti-bot features.
          </p>
          {creatorStatus?.hasPending ? (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-400 font-medium">Your application is under review</span>
            </div>
          ) : (
            <Button onClick={() => navigate('/creator/apply')} className="bg-cre8-red hover:bg-cre8-red/90 text-white font-semibold rounded-xl px-8 py-5">
              <Shield className="w-4 h-4 mr-2" />
              Apply for Creator Verification
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <div className="max-w-4xl mx-auto px-3 sm:px-6 pt-2">

        {/* Sub-views */}
        {view === 'edit' && profile ? (
          <ProfileEditor
            profile={profile}
            onSave={(updated) => {
              updateCreatorProfile(updated);
              setView('main');
              toast.success('Profile updated!');
            }}
            onCancel={() => setView('main')}
          />
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-xl font-bold text-white">{profile?.projectName || 'Creator Dashboard'}</h1>
                  {profile?.isVerified && (
                    <Badge className="bg-green-500/15 text-green-400 text-xs">
                      <Check className="w-3 h-3 mr-1" />Verified
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-dim">Creator Control Center</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-cre8-surface rounded-lg border border-white/[0.06]">
                  <Wallet className="w-4 h-4 text-dim" />
                  <span className="text-sm text-white font-mono">{avaxBalance.toFixed(2)} AVAX</span>
                </div>
                {profile && (
                  <Button
                    onClick={() => setView('edit')}
                    className="bg-cre8-red/10 text-cre8-red hover:bg-cre8-red/20 border border-cre8-red/30 text-sm rounded-lg"
                  >
                    <Edit className="w-3.5 h-3.5 mr-1.5" />Edit Profile
                  </Button>
                )}
              </div>
            </div>

            {/* Profile Summary Card */}
            {profile && (
              <div className="surface p-5 mb-5">
                <div className="flex flex-col sm:flex-row gap-5">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-14 h-14 rounded-xl bg-cre8-red/10 flex items-center justify-center shrink-0">
                      <span className="text-xl font-bold text-cre8-red">{profile.projectName.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold text-white truncate">{profile.projectName}</h2>
                      {profile.description && (
                        <p className="text-sm text-dim mt-1 line-clamp-2">{profile.description}</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {profile.website && (
                          <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] text-xs text-dim hover:text-white hover:bg-white/[0.06] transition-colors">
                            <Globe className="w-3 h-3" />Website<ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        {profile.githubRepo && (
                          <a href={profile.githubRepo.startsWith('http') ? profile.githubRepo : `https://${profile.githubRepo}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] text-xs text-dim hover:text-white hover:bg-white/[0.06] transition-colors">
                            <Github className="w-3 h-3" />GitHub<ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        {profile.whitepaper && (
                          <a href={profile.whitepaper.startsWith('http') ? profile.whitepaper : `https://${profile.whitepaper}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] text-xs text-dim hover:text-white hover:bg-white/[0.06] transition-colors">
                            <FileText className="w-3 h-3" />Docs<ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        {profile.telegram && (
                          <a href={profile.telegram.startsWith('http') ? profile.telegram : `https://${profile.telegram}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] text-xs text-dim hover:text-white hover:bg-white/[0.06] transition-colors">
                            <MessageCircle className="w-3 h-3" />Telegram<ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Authenticity */}
                  <div className="sm:w-44 shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-xs font-semibold text-dim uppercase tracking-wider">Trust Score</span>
                    </div>
                    <div className="flex items-end gap-2 mb-2">
                      <span className={`text-3xl font-bold font-mono ${
                        authenticityScore >= 5 ? 'text-green-400' : authenticityScore >= 3 ? 'text-amber-400' : 'text-dim'
                      }`}>{authenticityScore}</span>
                      <span className="text-sm text-dim mb-1">/ {authenticityItems.length}</span>
                    </div>
                    <div className="flex gap-0.5">
                      {authenticityItems.map((item, i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full ${
                          item.filled ? 'bg-green-400' : 'bg-white/[0.06]'
                        }`} />
                      ))}
                    </div>
                    <p className="text-[10px] text-dim/60 mt-2">
                      {authenticityScore >= 5 ? 'Verified creator' :
                       authenticityScore >= 3 ? 'Add more details for verification' :
                       'Complete your profile to build trust'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="surface p-4 text-center">
                <p className="text-2xl font-bold text-white font-mono">{tokensLoading ? '...' : totalLaunched}</p>
                <p className="text-xs text-dim mt-0.5">Tokens Launched</p>
              </div>
              <div className="surface p-4 text-center">
                <p className="text-2xl font-bold text-amber-400 font-mono">{tokensLoading ? '...' : forgeTokens}</p>
                <p className="text-xs text-dim mt-0.5">Forge Launches</p>
              </div>
              <div className="surface p-4 text-center">
                <p className="text-2xl font-bold text-green-400 font-mono">{tokensLoading ? '...' : graduated}</p>
                <p className="text-xs text-dim mt-0.5">Graduated</p>
              </div>
              <div className="surface p-4 text-center">
                <p className="text-2xl font-bold text-cre8-red font-mono">
                  {tokensLoading ? '...' : parseFloat(formatEther(totalMarketCap)).toFixed(1)}
                </p>
                <p className="text-xs text-dim mt-0.5">Total MCap (AVAX)</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <ActionCard
                  icon={Rocket}
                  title="Easy Launch"
                  description="Launch a token instantly — goes live on the bonding curve immediately."
                  accent="bg-cre8-red/10 text-cre8-red"
                  onClick={() => navigate('/create')}
                />
                <ActionCard
                  icon={Shield}
                  title="Forge Launch"
                  description="Launch with whitelist, max wallet, max tx, and anti-bot protection."
                  accent="bg-amber-400/10 text-amber-400"
                  onClick={() => navigate('/create')}
                />
                <ActionCard
                  icon={Users}
                  title="View Profile"
                  description="See your public creator profile as others see it."
                  accent="bg-green-400/10 text-green-400"
                  onClick={() => navigate(`/profile/${user.wallet.address}`)}
                />
              </div>
            </div>

            {/* Creator Earnings */}
            <div className="surface p-5 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <TrendingUp className="w-4 h-4 text-cre8-red" />
                    <h3 className="font-semibold text-white text-sm">Creator Earnings</h3>
                  </div>
                  <p className="text-xs text-dim">You earn {FEES.TRADING_CREATOR * 100}% of all trading volume on your tokens.</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-2xl font-bold text-cre8-red">0.00</p>
                  <p className="text-xs text-dim">AVAX claimable</p>
                </div>
              </div>
              <Button
                disabled
                className="mt-4 bg-white/[0.04] text-dim rounded-lg text-sm cursor-not-allowed"
              >
                No Earnings Yet
              </Button>
            </div>

            {/* Launched Tokens */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Your Tokens</h2>
                <button onClick={() => navigate('/create')} className="text-xs text-cre8-red hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" />Launch New
                </button>
              </div>
              {tokensError ? (
                <div className="surface p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                  </div>
                  <p className="text-sm text-white font-medium mb-1">Failed to load tokens</p>
                  <p className="text-xs text-dim mb-4">Could not connect to the blockchain. Check your network and try again.</p>
                  <Button onClick={() => window.location.reload()} className="bg-white/[0.06] hover:bg-white/[0.1] text-white text-sm rounded-lg px-6">
                    Retry
                  </Button>
                </div>
              ) : tokensLoading ? (
                <div className="surface p-8 text-center">
                  <div className="w-6 h-6 border-2 border-cre8-red/30 border-t-cre8-red rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-dim">Loading your tokens...</p>
                </div>
              ) : tokens.length === 0 ? (
                <div className="surface p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
                    <Rocket className="w-6 h-6 text-dim" />
                  </div>
                  <p className="text-sm text-white font-medium mb-1">No tokens launched yet</p>
                  <p className="text-xs text-dim mb-4">Launch your first token to see it here.</p>
                  <div className="flex justify-center gap-3">
                    <Button onClick={() => navigate('/create')} className="bg-cre8-red hover:bg-cre8-red/90 text-white font-medium rounded-lg text-sm px-5">
                      <Flame className="w-3.5 h-3.5 mr-1.5" />Launch Token
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {tokens.map((t) => (
                    <Link
                      key={t.tokenId.toString()}
                      to={`/token/${t.tokenAddress}`}
                      className="surface-interactive flex items-center gap-3 p-4"
                    >
                      <div className="w-10 h-10 rounded-xl bg-cre8-red/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-cre8-red">{t.symbol.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{t.name}</p>
                        <p className="text-xs text-dim">${t.symbol}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-dim font-mono">
                          {parseFloat(formatEther(t.marketCap)).toFixed(2)} AVAX
                        </span>
                        {t.isForge && (
                          <Badge className="bg-amber-400/15 text-amber-400 text-[10px]">
                            <Shield className="w-2.5 h-2.5 mr-0.5" />Forge
                          </Badge>
                        )}
                        {t.graduated ? (
                          <Badge className="bg-green-500/15 text-green-400 text-[10px]">Graduated</Badge>
                        ) : (
                          <Badge className="bg-blue-400/15 text-blue-400 text-[10px]">
                            {Number(t.graduationProgress)}% to DEX
                          </Badge>
                        )}
                        <ChevronRight className="w-4 h-4 text-dim" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="mt-6 p-4 rounded-xl border border-white/[0.04] bg-white/[0.01]">
              <div className="flex items-start gap-3">
                <Award className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-white font-medium mb-1">Pro Tip</p>
                  <p className="text-xs text-dim leading-relaxed">
                    Use Forge Mode to launch with whitelist protection — give your community early access while blocking snipers
                    with max wallet and max transaction limits.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
